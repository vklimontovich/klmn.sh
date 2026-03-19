# MTProxy Kubernetes Deployment

N independent MTProxy servers run as DaemonSets on VPN nodes, each on its own port (8443+i).
Secrets are fetched from an HTTP provisioner at pod startup.

## Architecture

- **N DaemonSets** (`mtproxy-0`…`mtproxy-N-1`), one pod per VPN node each
- Each pod runs `telegrammessenger/proxy:latest` on containerPort 443, hostPort `8443+i`
- **N** defaults to 10, controlled by `MTPROXY_COUNT` env var
- Init container fetches the per-instance secret from a provisioner; falls back to a random secret

## Provisioner Protocol

At startup, the init container calls:

```
GET ${MT_PROXY_PROVISIONER}?origin=${NODE_NAME}&index=${i}
X-Auth-Key: ${MT_PROXY_AUTH_KEY}
```

Expected response (200 OK):

```json
{ "secret": "0123456789abcdef0123456789abcdef" }
```

`secret` must be 32 hex characters (16 bytes). On any error (non-200, timeout, parse failure,
missing field), the init container generates a random secret via `/dev/urandom` and logs it
to stderr.

## Prerequisites

One-time manual bootstrap (before first deploy):

```bash
kubectl create namespace mtproxy --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic mtproxy-auth-key -n mtproxy --from-literal=auth-key=<YOUR_KEY>
```

The presync hook will fail with a clear message if `mtproxy-auth-key` is missing.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MTPROXY_COUNT` | `10` | Number of MTProxy instances (DaemonSets) |
| `MT_PROXY_PROVISIONER` | `""` | HTTP endpoint for secret provisioning |

## Deployment

```bash
export MT_PROXY_PROVISIONER=https://your-provisioner/secret
./apply.sh k8s mtproxy
```

## Verification

```bash
# Check all pods
kubectl get pods -n mtproxy -o wide

# Check init container logs (provisioner result or random secret notice)
kubectl logs -n mtproxy <pod> -c extract-secret

# Test ports (replace NODE_IP)
for port in $(seq 8443 8452); do nc -zv $NODE_IP $port; done
```

## Connection Links

```bash
NODE_IP=$(kubectl get nodes -l node-role=vpn-node \
  -o jsonpath='{.items[0].status.addresses[?(@.type=="ExternalIP")].address}')

# Get secret for instance i (e.g. i=0)
SECRET=$(kubectl exec -n mtproxy \
  $(kubectl get pod -n mtproxy -l app=mtproxy-0 -o name | head -1) \
  -- cat /secrets/SECRET)

echo "https://t.me/proxy?server=$NODE_IP&port=8443&secret=$SECRET"
```

## Firewall

Port range `8443:8452` (or `8443:8443+N-1`) is opened in `infra/ansible/tasks/firewall.yaml`.
The range is derived from `MTPROXY_COUNT` (same env var). Apply with:

```bash
cd infra/ansible
ansible-playbook -i inventory.yaml playbook.yaml --tags firewall
```
