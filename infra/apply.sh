#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[x]${NC} $1"; exit 1; }

requireSecret() {
    local var_name="$1"
    local description="$2"
    if [[ -z "${!var_name:-}" ]]; then
        error "$var_name is not set.\n\n    $description"
    fi
}

# Check dependencies
check_deps() {
    command -v kubectl >/dev/null 2>&1 || error "kubectl not found"
    command -v helmfile >/dev/null 2>&1 || error "helmfile not found"
    command -v helm >/dev/null 2>&1 || error "helm not found"
}

check_ansible_deps() {
    command -v ansible-playbook >/dev/null 2>&1 || error "ansible-playbook not found. Install with: pip install ansible"
}

# Run ansible playbook
run_ansible() {
    check_ansible_deps

    requireSecret GITHUB_TOKEN "Export your GitHub token:\n    export GITHUB_TOKEN=ghp_xxxx"
    requireSecret TAILSCALE_AUTH_KEY "Export your Tailscale auth key:\n    export TAILSCALE_AUTH_KEY=tskey-auth-xxxx\n\n    Get it from: https://login.tailscale.com/admin/settings/keys"

    log "Running ansible playbook..."
    ansible-playbook -i ansible/inventory.yaml ansible/playbook.yaml "$@"
    log "Ansible playbook completed"
}

# Check env requirements for a folder
check_env_requirements() {
    local folder="$1"
    if [[ -f "$folder/env-requirements.txt" ]]; then
        while IFS= read -r line; do
            # Skip comments and empty lines
            [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
            local var_name=$(echo "$line" | xargs)
            [[ -z "$var_name" ]] && continue
            if [[ -z "${!var_name:-}" ]]; then
                error "$var_name is required for $(basename "$folder").\n    Set it in .envrc or export it."
            fi
        done < "$folder/env-requirements.txt"
    fi
}

# Apply a single k8s folder based on its contents
apply_folder() {
    local folder="$1"
    local name=$(basename "$folder")

    check_env_requirements "$folder"
    log "Applying $name..."

    if [[ -f "$folder/apply.sh" ]]; then
        # Custom apply script
        bash "$folder/apply.sh"
    elif [[ -f "$folder/helmfile.yaml.gotmpl" ]]; then
        # Helmfile with Go templates
        helmfile -f "$folder/helmfile.yaml.gotmpl" sync
    elif [[ -f "$folder/helmfile.yaml" ]]; then
        # Helmfile
        helmfile -f "$folder/helmfile.yaml" sync
    elif [[ -f "$folder/kustomization.yaml" ]]; then
        # Kustomize
        kubectl apply -k "$folder"
    elif compgen -G "$folder/*.yaml" > /dev/null; then
        # Plain manifests
        kubectl apply -f "$folder/"
    else
        warn "Don't know how to apply $folder, skipping"
        return 1
    fi

    log "$name applied"
}

# Apply k8s resources
apply_k8s() {
    check_deps
    local target="${1:-}"

    if [[ -n "$target" ]]; then
        # Apply specific service
        local folder=$(find k8s -maxdepth 1 -type d -name "*$target*" | head -1)
        if [[ -z "$folder" ]]; then
            error "Service not found: $target"
        fi
        apply_folder "$folder"
    else
        # Apply all services in sorted order
        for folder in $(find k8s -maxdepth 1 -type d -name "[0-9]*" | sort); do
            apply_folder "$folder"
        done
    fi

    log "K8s resources applied successfully"
}

# Usage
usage() {
    cat <<EOF
Usage: $0 <command> [options]

Commands:
    ansible             Run ansible playbook to configure nodes (Docker, Tailscale, K3s)
    k8s [service]       Apply k8s resources. If service specified, apply only that service.
    help                Show this help

Environment variables:
    GITHUB_TOKEN           GitHub token for GHCR registry (required for ansible)
    TAILSCALE_AUTH_KEY     Tailscale auth key for joining tailnet (required for ansible)
    CLOUDFLARE_API_KEY   Cloudflare API token for DNS management (required for internet-gateway)
    GCP_PROJECT_ID         GCP project ID (enables PostgreSQL backups if set)
    GCS_BACKUP_BUCKET      GCS bucket name (default: \$GCP_PROJECT_ID-pg-backups)

Examples:
    ./apply.sh ansible
    ./apply.sh k8s                      # Apply all k8s services
    ./apply.sh k8s internet-gateway     # Apply only internet-gateway
    ./apply.sh k8s postgres             # Apply only postgres
EOF
}

# Main
main() {
    local cmd="${1:-}"

    case "$cmd" in
        ansible)
            shift
            run_ansible "$@"
            ;;
        k8s)
            shift
            apply_k8s "${1:-}"
            ;;
        help|--help|-h)
            usage
            ;;
        "")
            error "Command required: ansible or k8s\n\nRun '$0 help' for usage"
            ;;
        *)
            error "Unknown command: $cmd\n\nRun '$0 help' for usage"
            ;;
    esac
}

main "$@"
