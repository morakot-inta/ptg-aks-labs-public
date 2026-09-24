#!/usr/bin/env bash
set -euo pipefail

# Builds the sample-app Docker image locally.
# Usage:
#   ./build.sh [tag]
#   ACR=myregistry ./build.sh poc-v1   -> builds myregistry.azurecr.io/order-api:poc-v1
#
# Env vars:
#   IMAGE_NAME  image repository name (default: order-api)
#   TAG         image tag (default: poc-v1, overridden by $1)
#   ACR         optional ACR name; when set, prefixes the image with $ACR.azurecr.io/

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

IMAGE_NAME="${IMAGE_NAME:-order-api}"
TAG="${1:-${TAG:-poc-v1}}"

if [[ -n "${ACR:-}" ]]; then
  IMAGE="${ACR}.azurecr.io/${IMAGE_NAME}:${TAG}"
else
  IMAGE="${IMAGE_NAME}:${TAG}"
fi

echo "Building ${IMAGE} from ${SCRIPT_DIR}"
docker build -t "${IMAGE}" "${SCRIPT_DIR}"

echo "Built image: ${IMAGE}"
