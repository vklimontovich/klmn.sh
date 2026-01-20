# Internet Gateway Operator

Kubernetes operator that watches services for annotations and automatically:
- Updates Cloudflare DNS records
- Creates Ingress resources with TLS certificates via cert-manager

## Prerequisites

### 1. nginx-ingress controller

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx --namespace ingress-nginx --create-namespace
```

### 2. cert-manager with Let's Encrypt ClusterIssuer

```bash
# Install cert-manager
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager --namespace cert-manager --create-namespace --set crds.enabled=true

# Create ClusterIssuer
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: ${LETSENCRYPT_EMAIL}
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

### 3. Cloudflare credentials secret

Create a secret with Cloudflare API token:

```bash
kubectl create namespace internet-gateway

kubectl create secret generic cloudflare-credentials -n internet-gateway \
  --from-literal=CLOUDFLARE_API_KEY=<your-api-token>
```

The API token needs `Zone:Read` and `Zone:DNS:Edit` permissions. Zone ID is auto-detected from hostname.

## Usage

### Service annotations

Add these annotations to any Service to expose it:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app
  annotations:
    internet-gateway/host: "app.klmn.sh"      # Required: hostname
    internet-gateway/auto-dns: "true"         # Optional: update Cloudflare DNS
    internet-gateway/auto-https: "true"       # Optional: create Ingress with TLS
spec:
  type: LoadBalancer  # Required for auto-dns
  ports:
    - port: 80
      targetPort: 8080
  selector:
    app: my-app
```

### Annotation reference

| Annotation | Required | Description |
|------------|----------|-------------|
| `internet-gateway/host` | Yes | Hostname where service will be available |
| `internet-gateway/auto-dns` | No | If `true`, creates/updates Cloudflare A record |
| `internet-gateway/auto-https` | No | If `true`, creates Ingress with TLS via cert-manager |
| `internet-gateway/ip-mode` | No | `node-port` to auto-detect node IPs (creates round-robin DNS) |

### Requirements

- For `auto-dns`: Service must be `type: LoadBalancer` with an external IP
- For `auto-https`: nginx-ingress and cert-manager must be installed

### TCP services (PostgreSQL, Redis, etc.)

For non-HTTP services, use `auto-dns` only (without `auto-https`). The service handles its own TLS.

**Option 1: NodePort** (auto-detects node IPs, creates round-robin DNS)

```yaml
service:
  type: NodePort
  nodePorts:
    postgresql: 30432
  annotations:
    internet-gateway/host: "pg.klmn.sh"
    internet-gateway/auto-dns: "true"
    internet-gateway/ip-mode: "node-port"
```

Connect: `psql "host=pg.klmn.sh port=30432 sslmode=require"`

**Option 2: LoadBalancer** (if you have MetalLB or cloud provider)

```yaml
service:
  type: LoadBalancer
  annotations:
    internet-gateway/host: "pg.klmn.sh"
    internet-gateway/auto-dns: "true"
```

Connect: `psql "host=pg.klmn.sh sslmode=require"`

## Running the operator

### Local development

```bash
# Requires kubectl configured with cluster access
./operator.py
```

### In-cluster deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: internet-gateway-operator
  namespace: internet-gateway
spec:
  replicas: 1
  selector:
    matchLabels:
      app: internet-gateway-operator
  template:
    metadata:
      labels:
        app: internet-gateway-operator
    spec:
      serviceAccountName: internet-gateway-operator
      containers:
        - name: operator
          image: python:3.12-slim
          command: ["uv", "run", "/app/operator.py"]
          envFrom:
            - secretRef:
                name: cloudflare-credentials
          volumeMounts:
            - name: operator-script
              mountPath: /app
      volumes:
        - name: operator-script
          configMap:
            name: internet-gateway-operator
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: internet-gateway-operator
  namespace: internet-gateway
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: internet-gateway-operator
rules:
  - apiGroups: [""]
    resources: ["services"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["networking.k8s.io"]
    resources: ["ingresses"]
    verbs: ["get", "list", "create", "update", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: internet-gateway-operator
subjects:
  - kind: ServiceAccount
    name: internet-gateway-operator
    namespace: internet-gateway
roleRef:
  kind: ClusterRole
  name: internet-gateway-operator
  apiGroup: rbac.authorization.k8s.io
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CLOUDFLARE_API_KEY` | For DNS | Cloudflare API token (Zone:Read + DNS:Edit) |
| `CLUSTER_ISSUER` | No | cert-manager ClusterIssuer name (default: `letsencrypt-prod`) |
