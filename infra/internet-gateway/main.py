#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "kubernetes>=31.0.0",
#   "cloudflare>=3.0.0",
# ]
# ///
"""
Internet Gateway Operator

Watches Kubernetes services for annotations and:
- Updates Cloudflare DNS records (if auto-dns: true)
- Creates Ingress with TLS via cert-manager (if auto-https: true)

Required annotations on Service:
  internet-gateway/host: subdomain.klmn.sh
  internet-gateway/auto-dns: "true"       # optional
  internet-gateway/auto-https: "true"     # optional
  internet-gateway/ip-mode: "node-port"   # optional, auto-detect node IPs

Environment variables (from secrets):
  CLOUDFLARE_API_KEY - API token with Zone:Read and DNS:Edit permissions
"""

import logging
import os
import sys
import time
from dataclasses import dataclass

import cloudflare
from kubernetes import client, config, watch

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# Annotation keys
ANN_HOST = "internet-gateway/host"
ANN_AUTO_DNS = "internet-gateway/auto-dns"
ANN_AUTO_HTTPS = "internet-gateway/auto-https"
ANN_IP_MODE = "internet-gateway/ip-mode"  # "node-port" to auto-detect node IPs

# Cert-manager issuer name (must exist in cluster)
CLUSTER_ISSUER = os.getenv("CLUSTER_ISSUER", "letsencrypt-prod")


@dataclass
class ServiceConfig:
    name: str
    namespace: str
    host: str
    auto_dns: bool
    auto_https: bool
    ip_mode: str | None  # "node-port" or None (for LoadBalancer)
    external_ips: list[str]  # Can have multiple IPs for round-robin DNS
    port: int


def parse_service(svc: client.V1Service, pod_node_ips: list[str]) -> ServiceConfig | None:
    """Parse service annotations and extract config."""
    annotations = svc.metadata.annotations or {}
    host = annotations.get(ANN_HOST)
    if not host:
        return None

    auto_dns = annotations.get(ANN_AUTO_DNS, "").lower() == "true"
    auto_https = annotations.get(ANN_AUTO_HTTPS, "").lower() == "true"
    ip_mode = annotations.get(ANN_IP_MODE)

    external_ips: list[str] = []

    if ip_mode == "node-port":
        # Use IPs of nodes where pods are running
        external_ips = pod_node_ips
    elif svc.status and svc.status.load_balancer and svc.status.load_balancer.ingress:
        # LoadBalancer mode - get IP from status
        for ingress in svc.status.load_balancer.ingress:
            if ingress.ip:
                external_ips.append(ingress.ip)

    # Get first port (or nodePort for node-port mode)
    port = 80
    if svc.spec.ports:
        if ip_mode == "node-port" and svc.spec.ports[0].node_port:
            port = svc.spec.ports[0].node_port
        else:
            port = svc.spec.ports[0].port

    return ServiceConfig(
        name=svc.metadata.name,
        namespace=svc.metadata.namespace,
        host=host,
        auto_dns=auto_dns,
        auto_https=auto_https,
        ip_mode=ip_mode,
        external_ips=external_ips,
        port=port,
    )


class CloudflareDNS:
    """Manages Cloudflare DNS records."""

    def __init__(self):
        token = os.getenv("CLOUDFLARE_API_KEY")
        if not token:
            log.warning("CLOUDFLARE_API_KEY not set, DNS updates disabled")
            self.client = None
            return
        # Clear env vars to prevent SDK auto-detection, then pass token explicitly
        os.environ.pop("CLOUDFLARE_API_KEY", None)
        os.environ.pop("CLOUDFLARE_API_TOKEN", None)
        self.client = cloudflare.Cloudflare(api_token=token)
        self._zone_cache: dict[str, str] = {}  # domain -> zone_id

    def _get_zone_id(self, host: str) -> str | None:
        """Get zone ID for a hostname by looking up the base domain."""
        # Extract base domain (last two parts): pg.klmn.sh -> klmn.sh
        parts = host.split(".")
        if len(parts) < 2:
            log.error(f"Invalid hostname: {host}")
            return None
        domain = ".".join(parts[-2:])

        if domain in self._zone_cache:
            return self._zone_cache[domain]

        try:
            zones = self.client.zones.list(name=domain)
            for zone in zones.result:
                if zone.name == domain:
                    self._zone_cache[domain] = zone.id
                    log.info(f"Found zone ID for {domain}: {zone.id}")
                    return zone.id
            log.error(f"No Cloudflare zone found for domain: {domain}")
            return None
        except Exception as e:
            log.error(f"Failed to lookup zone for {domain}: {e}")
            return None

    def upsert_records(self, host: str, ips: list[str]) -> bool:
        """Create or update DNS A records. Supports multiple IPs for round-robin."""
        if not self.client or not ips:
            return False

        zone_id = self._get_zone_id(host)
        if not zone_id:
            return False

        try:
            # Get existing records
            records = self.client.dns.records.list(zone_id=zone_id, name=host, type="A")
            existing = {r.content: r for r in records.result if r.name == host}
            existing_ips = set(existing.keys())
            desired_ips = set(ips)

            # Delete records for IPs no longer needed
            for ip in existing_ips - desired_ips:
                self.client.dns.records.delete(dns_record_id=existing[ip].id, zone_id=zone_id)
                log.info(f"Deleted DNS record {host} -> {ip}")

            # Create records for new IPs
            for ip in desired_ips - existing_ips:
                self.client.dns.records.create(
                    zone_id=zone_id,
                    name=host,
                    type="A",
                    content=ip,
                    proxied=False,
                )
                log.info(f"Created DNS record {host} -> {ip}")

            if existing_ips == desired_ips:
                log.info(f"DNS records {host} -> {ips} already up to date")

            return True
        except Exception as e:
            log.error(f"Failed to update DNS for {host}: {e}")
            return False

    def delete_records(self, host: str) -> bool:
        """Delete all DNS A records for host."""
        if not self.client:
            return False

        zone_id = self._get_zone_id(host)
        if not zone_id:
            return False

        try:
            records = self.client.dns.records.list(zone_id=zone_id, name=host, type="A")
            for record in records.result:
                if record.name == host:
                    self.client.dns.records.delete(dns_record_id=record.id, zone_id=zone_id)
                    log.info(f"Deleted DNS record {host} -> {record.content}")
            return True
        except Exception as e:
            log.error(f"Failed to delete DNS for {host}: {e}")
            return False


class IngressManager:
    """Manages Kubernetes Ingress resources for HTTPS."""

    def __init__(self, networking_api: client.NetworkingV1Api):
        self.api = networking_api

    def _ingress_name(self, svc_name: str) -> str:
        return f"{svc_name}-gateway"

    def upsert_ingress(self, cfg: ServiceConfig) -> bool:
        """Create or update Ingress with TLS."""
        ingress_name = self._ingress_name(cfg.name)
        secret_name = f"{cfg.host.replace('.', '-')}-tls"

        ingress = client.V1Ingress(
            api_version="networking.k8s.io/v1",
            kind="Ingress",
            metadata=client.V1ObjectMeta(
                name=ingress_name,
                namespace=cfg.namespace,
                annotations={
                    "cert-manager.io/cluster-issuer": CLUSTER_ISSUER,
                    "nginx.ingress.kubernetes.io/ssl-redirect": "true",
                },
                labels={
                    "app.kubernetes.io/managed-by": "internet-gateway",
                },
            ),
            spec=client.V1IngressSpec(
                ingress_class_name="nginx",
                tls=[
                    client.V1IngressTLS(
                        hosts=[cfg.host],
                        secret_name=secret_name,
                    )
                ],
                rules=[
                    client.V1IngressRule(
                        host=cfg.host,
                        http=client.V1HTTPIngressRuleValue(
                            paths=[
                                client.V1HTTPIngressPath(
                                    path="/",
                                    path_type="Prefix",
                                    backend=client.V1IngressBackend(
                                        service=client.V1IngressServiceBackend(
                                            name=cfg.name,
                                            port=client.V1ServiceBackendPort(number=cfg.port),
                                        )
                                    ),
                                )
                            ]
                        ),
                    )
                ],
            ),
        )

        try:
            try:
                self.api.read_namespaced_ingress(name=ingress_name, namespace=cfg.namespace)
                self.api.replace_namespaced_ingress(
                    name=ingress_name, namespace=cfg.namespace, body=ingress
                )
                log.info(f"Updated Ingress {cfg.namespace}/{ingress_name} for {cfg.host}")
            except client.exceptions.ApiException as e:
                if e.status == 404:
                    self.api.create_namespaced_ingress(namespace=cfg.namespace, body=ingress)
                    log.info(f"Created Ingress {cfg.namespace}/{ingress_name} for {cfg.host}")
                else:
                    raise
            return True
        except Exception as e:
            log.error(f"Failed to upsert Ingress for {cfg.name}: {e}")
            return False

    def delete_ingress(self, name: str, namespace: str) -> bool:
        """Delete Ingress resource."""
        ingress_name = self._ingress_name(name)
        try:
            self.api.delete_namespaced_ingress(name=ingress_name, namespace=namespace)
            log.info(f"Deleted Ingress {namespace}/{ingress_name}")
            return True
        except client.exceptions.ApiException as e:
            if e.status == 404:
                return True  # Already gone
            log.error(f"Failed to delete Ingress {ingress_name}: {e}")
            return False


class Operator:
    """Main operator loop."""

    def __init__(self):
        # Load k8s config (in-cluster or from kubeconfig)
        try:
            config.load_incluster_config()
            log.info("Loaded in-cluster config")
        except config.ConfigException:
            config.load_kube_config()
            log.info("Loaded kubeconfig")

        self.core_api = client.CoreV1Api()
        self.networking_api = client.NetworkingV1Api()
        self.custom_api = client.CustomObjectsApi()
        self.dns = CloudflareDNS()
        self.ingress = IngressManager(self.networking_api)
        self.managed: dict[str, ServiceConfig] = {}  # key: namespace/name
        self._node_ip_map: dict[str, str] = {}  # node_name -> ip
        self._has_cert_manager = False
        self._has_ingress_nginx = False

    def _check_prerequisites(self):
        """Check if cert-manager and ingress-nginx are installed."""
        # Check cert-manager
        try:
            self.custom_api.list_cluster_custom_object("cert-manager.io", "v1", "clusterissuers")
            self._has_cert_manager = True
            log.info("cert-manager: installed")
        except client.exceptions.ApiException as e:
            if e.status == 404:
                self._has_cert_manager = False
                log.warning("cert-manager: not installed. auto-https will not work.")
                log.warning("  Install: helm install cert-manager jetstack/cert-manager --set crds.enabled=true")
            else:
                raise

        # Check ingress-nginx
        try:
            pods = self.core_api.list_namespaced_pod(
                "ingress-nginx",
                label_selector="app.kubernetes.io/component=controller",
            )
            if any(p.status.phase == "Running" for p in pods.items):
                self._has_ingress_nginx = True
                log.info("ingress-nginx: installed")
            else:
                self._has_ingress_nginx = False
                log.warning("ingress-nginx: not running. auto-https will not work.")
        except client.exceptions.ApiException as e:
            if e.status == 404:
                self._has_ingress_nginx = False
                log.warning("ingress-nginx: not installed. auto-https will not work.")
                log.warning("  Install: helm install ingress-nginx ingress-nginx/ingress-nginx")
            else:
                raise

    def _key(self, namespace: str, name: str) -> str:
        return f"{namespace}/{name}"

    def _refresh_node_ips(self):
        """Build map of node name to external IP."""
        try:
            nodes = self.core_api.list_node()
            self._node_ip_map = {}
            for node in nodes.items:
                node_name = node.metadata.name
                ip = None
                # Prefer ExternalIP, fall back to InternalIP
                for addr in node.status.addresses:
                    if addr.type == "ExternalIP":
                        ip = addr.address
                        break
                if not ip:
                    for addr in node.status.addresses:
                        if addr.type == "InternalIP":
                            ip = addr.address
                            break
                if ip:
                    self._node_ip_map[node_name] = ip
            log.info(f"Refreshed node IPs: {self._node_ip_map}")
        except Exception as e:
            log.error(f"Failed to fetch node IPs: {e}")

    def _get_pod_node_ips(self, svc: client.V1Service) -> list[str]:
        """Get IPs of nodes where service's pods are running."""
        if not svc.spec.selector:
            return []
        # Build label selector string
        selector = ",".join(f"{k}={v}" for k, v in svc.spec.selector.items())
        try:
            pods = self.core_api.list_namespaced_pod(
                namespace=svc.metadata.namespace,
                label_selector=selector,
            )
            node_ips = set()
            for pod in pods.items:
                if pod.status.phase == "Running" and pod.spec.node_name:
                    ip = self._node_ip_map.get(pod.spec.node_name)
                    if ip:
                        node_ips.add(ip)
            return list(node_ips)
        except Exception as e:
            log.error(f"Failed to get pods for service {svc.metadata.name}: {e}")
            return []

    def _get_ingress_controller_ips(self) -> list[str]:
        """Get IPs of nodes where ingress-nginx controller runs."""
        try:
            pods = self.core_api.list_namespaced_pod(
                namespace="ingress-nginx",
                label_selector="app.kubernetes.io/component=controller",
            )
            node_ips = set()
            for pod in pods.items:
                if pod.status.phase == "Running" and pod.spec.node_name:
                    ip = self._node_ip_map.get(pod.spec.node_name)
                    if ip:
                        node_ips.add(ip)
            return list(node_ips)
        except Exception as e:
            log.warning(f"Failed to get ingress controller pods: {e}")
            return []

    def handle_service(self, event_type: str, svc: client.V1Service):
        """Process a service event."""
        key = self._key(svc.metadata.namespace, svc.metadata.name)

        if event_type == "DELETED":
            if key in self.managed:
                cfg = self.managed.pop(key)
                log.info(f"Service {key} deleted, cleaning up")
                if cfg.auto_dns:
                    self.dns.delete_records(cfg.host)
                if cfg.auto_https:
                    self.ingress.delete_ingress(cfg.name, cfg.namespace)
            return

        annotations = svc.metadata.annotations or {}
        # For auto-https, use ingress controller IPs; for node-port, use pod node IPs
        if annotations.get(ANN_AUTO_HTTPS, "").lower() == "true":
            external_ips = self._get_ingress_controller_ips()
        elif annotations.get(ANN_IP_MODE) == "node-port":
            external_ips = self._get_pod_node_ips(svc)
        else:
            external_ips = []
        cfg = parse_service(svc, external_ips)
        if not cfg:
            # No gateway annotations, clean up if previously managed
            if key in self.managed:
                old_cfg = self.managed.pop(key)
                log.info(f"Service {key} annotations removed, cleaning up")
                if old_cfg.auto_dns:
                    self.dns.delete_records(old_cfg.host)
                if old_cfg.auto_https:
                    self.ingress.delete_ingress(old_cfg.name, old_cfg.namespace)
            return

        # Handle DNS
        if cfg.auto_dns:
            if not cfg.external_ips:
                log.warning(f"Service {key} has auto-dns but no IPs (check ip-mode or LoadBalancer status)")
            else:
                self.dns.upsert_records(cfg.host, cfg.external_ips)

        # Handle HTTPS/Ingress
        if cfg.auto_https:
            if not self._has_cert_manager or not self._has_ingress_nginx:
                log.warning(f"Service {key} has auto-https but prerequisites missing, skipping Ingress")
            else:
                self.ingress.upsert_ingress(cfg)

        self.managed[key] = cfg
        log.info(f"Processed service {key}: host={cfg.host}, ips={cfg.external_ips}, dns={cfg.auto_dns}, https={cfg.auto_https}")

    def run(self):
        """Main watch loop with reconnection."""
        log.info("Starting Internet Gateway Operator")
        self._check_prerequisites()

        while True:
            try:
                # Refresh node IPs for node-port mode
                self._refresh_node_ips()

                # Initial sync - list all services
                log.info("Performing initial sync...")
                services = self.core_api.list_service_for_all_namespaces()
                for svc in services.items:
                    self.handle_service("ADDED", svc)

                # Watch for changes
                log.info("Watching for service changes...")
                resource_version = services.metadata.resource_version
                w = watch.Watch()

                for event in w.stream(
                    self.core_api.list_service_for_all_namespaces,
                    resource_version=resource_version,
                    timeout_seconds=300,
                ):
                    event_type = event["type"]
                    svc = event["object"]
                    self.handle_service(event_type, svc)

            except client.exceptions.ApiException as e:
                if e.status == 410:  # Gone - resource version too old
                    log.info("Watch expired, resyncing...")
                else:
                    log.error(f"API error: {e}")
                    time.sleep(5)
            except Exception as e:
                log.error(f"Unexpected error: {e}")
                time.sleep(5)


def main():
    try:
        operator = Operator()
        operator.run()
    except KeyboardInterrupt:
        log.info("Shutting down")
        sys.exit(0)


if __name__ == "__main__":
    main()
