# MTProxy Kubernetes Deployment

Telegram MTProxy runs as a DaemonSet on VPN nodes (same as xray) using port 8443.

## Architecture

- **Image**: `telegrammessenger/proxy:latest` (official Telegram image)
- **Port**: 8443 (container internal 443 mapped to hostPort 8443)
- **Deployment**: DaemonSet on nodes with `node-role: vpn-node`
- **Multi-user**: ConfigMap-based user management with init container extracting secrets
- **User Limit**: **Maximum 16 users** (MTProxy limitation - only first 16 users from ConfigMap are used)
- **RBAC**: Allows `xray-app` service account to manage ConfigMaps in `mtproxy` namespace

## Prerequisites

The deployment automatically creates:
- `mtproxy` namespace
- RBAC Role and RoleBinding for `xray-app` service account

Before deploying, you must create the `mtproxy-users` ConfigMap in the `mtproxy` namespace.

### ConfigMap Structure

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mtproxy-users
  namespace: mtproxy
data:
  users.json: |
    {
      "users": [
        {
          "secret": "0123456789abcdef0123456789abcdef",
          "name": "user@email.com",
          "description": "User Name / user_id"
        }
      ]
    }
```

### Creating Initial ConfigMap

```bash
# Generate a random secret (32 hex characters)
ADMIN_SECRET=$(head -c 16 /dev/urandom | xxd -ps -c 16)

# Create namespace
kubectl create namespace mtproxy --dry-run=client -o yaml | kubectl apply -f -

# Create ConfigMap with initial user
kubectl create configmap mtproxy-users -n mtproxy \
  --from-literal=users.json="{\"users\":[{\"secret\":\"$ADMIN_SECRET\",\"name\":\"admin\",\"description\":\"Admin user\"}]}"

echo "Admin secret: $ADMIN_SECRET"
```

## Deployment

From the `infra/` directory:

```bash
./apply.sh k8s mtproxy
```

## Verification

```bash
# Check pod status
kubectl get pods -n mtproxy -o wide

# Check logs
kubectl logs -n mtproxy -l app=mtproxy

# Verify ConfigMap
kubectl get configmap mtproxy-users -n mtproxy -o jsonpath='{.data.users\.json}' | jq
```

## Getting Connection Info

```bash
# Get node IP
NODE_IP=$(kubectl get nodes -l node-role=vpn-node -o jsonpath='{.items[0].status.addresses[?(@.type=="ExternalIP")].address}')

# Get a user secret
SECRET=$(kubectl get configmap mtproxy-users -n mtproxy -o jsonpath='{.data.users\.json}' | jq -r '.users[0].secret')

# Generate Telegram link
echo "https://t.me/proxy?server=$NODE_IP&port=8443&secret=$SECRET"
```

## Adding Users

User management should be handled by an external tool that updates the ConfigMap. Manual process:

```bash
# Generate new secret
USER_SECRET=$(head -c 16 /dev/urandom | xxd -ps -c 16)
USER_NAME="alice"
USER_DESC="Alice's access"

# Update ConfigMap
kubectl get configmap mtproxy-users -n mtproxy -o json | \
  jq --arg secret "$USER_SECRET" --arg name "$USER_NAME" --arg desc "$USER_DESC" \
    '.data."users.json" = (.data."users.json" | fromjson | .users += [{"secret": $secret, "name": $name, "description": $desc}] | tojson)' | \
  kubectl apply -f -

# Restart pods
kubectl rollout restart daemonset/mtproxy -n mtproxy

# Display connection info
NODE_IP=$(kubectl get nodes -l node-role=vpn-node -o jsonpath='{.items[0].status.addresses[?(@.type=="ExternalIP")].address}')
echo "New user: $USER_NAME"
echo "Secret: $USER_SECRET"
echo "Link: https://t.me/proxy?server=$NODE_IP&port=8443&secret=$USER_SECRET"
```

## Firewall

Port 8443 has been added to firewall rules in `infra/ansible/tasks/firewall.yaml`. Run ansible playbook to apply:

```bash
cd infra/ansible
ansible-playbook -i inventory.yaml playbook.yaml --tags firewall
```

## Testing Connection

```bash
# Test port connectivity
NODE_IP=$(kubectl get nodes -l node-role=vpn-node -o jsonpath='{.items[0].status.addresses[?(@.type=="ExternalIP")].address}')
nc -zv $NODE_IP 8443
```

Open the generated Telegram link on a mobile device with Telegram installed to test the proxy.
