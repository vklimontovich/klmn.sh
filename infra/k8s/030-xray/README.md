# XRay REALITY Proxy

VLESS + REALITY proxy server. Traffic looks like normal TLS to microsoft.com.

## Deploy

```bash
# Label nodes that should run xray
kubectl label node <node-name> node-role=xray

# Deploy
helmfile -f infra/k8s/030-xray/helmfile.yaml apply
```

First deploy generates credentials in `xray-credentials` secret.

## Get Client URL

```bash
NS=xray
HOST=<your-external-host>
PORT=$(kubectl get svc xray -n $NS -o jsonpath='{.spec.ports[0].nodePort}')
PUBLIC_KEY=$(kubectl get secret xray-credentials -n $NS -o jsonpath='{.data.public-key}' | base64 -d)
UUID=$(kubectl get secret xray-credentials -n $NS -o jsonpath='{.data.admin-uuid}' | base64 -d)
SHORT_ID=$(kubectl get secret xray-credentials -n $NS -o jsonpath='{.data.short-id}' | base64 -d)

echo "vless://${UUID}@${HOST}:${PORT}?type=tcp&security=reality&encryption=none&flow=xtls-rprx-vision&pbk=${PUBLIC_KEY}&sid=${SHORT_ID}&sni=www.microsoft.com#xray"
```

## Config Structure

Two ConfigMaps:
- `xray-config` — static settings (managed by helmfile)
- `xray-users` — user list (managed externally)

XRay merges them on startup.

## User Management

Users are in separate ConfigMap `xray-users`. Helmfile creates it on first deploy with admin user,
then it's managed externally (scripts, operator, etc).

### Add User

```bash
NEW_UUID=$(uuidgen | tr '[:upper:]' '[:lower:]')
kubectl edit configmap xray-users -n xray
# Add to clients array:
# {"id": "$NEW_UUID", "email": "user@example.com", "flow": "xtls-rprx-vision"}
kubectl rollout restart deployment/xray -n xray
```

### Remove User

```bash
kubectl edit configmap xray-users -n xray
# Remove from clients array
kubectl rollout restart deployment/xray -n xray
```

### Users JSON format

```json
{
  "inbounds": [{
    "tag": "vless-reality",
    "settings": {
      "clients": [
        {"id": "uuid-1", "email": "user1@xray", "flow": "xtls-rprx-vision"},
        {"id": "uuid-2", "email": "user2@xray", "flow": "xtls-rprx-vision"}
      ]
    }
  }]
}
```
