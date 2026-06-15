#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Build and deploy React app to S3 + invalidate CloudFront
#
# Usage:
#   chmod +x scripts/deploy.sh
#   ./scripts/deploy.sh
#
# Reads from infrastructure/outputs.env or expects env vars set
# =============================================================================

set -euo pipefail

# Load outputs if available
if [ -f "./infrastructure/outputs.env" ]; then
  export $(grep -v '^#' ./infrastructure/outputs.env | xargs)
fi

# Validate required vars
: "${S3_BUCKET:?Need S3_BUCKET}"
: "${CLOUDFRONT_DISTRIBUTION_ID:?Need CLOUDFRONT_DISTRIBUTION_ID}"
: "${AWS_REGION:=ap-southeast-2}"

echo ""
echo "▶ Building React app..."
npm run build
echo "  ✓ Build complete → dist/"

echo ""
echo "▶ Syncing assets to S3 (long-lived cache)..."
# All hashed assets — cache forever
aws s3 sync dist/ "s3://${S3_BUCKET}" \
  --delete \
  --exclude "index.html" \
  --cache-control "public, max-age=31536000, immutable" \
  --region "$AWS_REGION"

echo "▶ Uploading index.html (no-cache)..."
# index.html — always fresh
aws s3 cp dist/index.html "s3://${S3_BUCKET}/index.html" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html" \
  --region "$AWS_REGION"
echo "  ✓ S3 sync complete"

echo ""
echo "▶ Invalidating CloudFront cache..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
  --paths "/index.html" \
  --query 'Invalidation.Id' \
  --output text)
echo "  ✓ Invalidation created: $INVALIDATION_ID"

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✓ Deployment complete!"
DOMAIN=$(aws cloudfront get-distribution \
  --id "$CLOUDFRONT_DISTRIBUTION_ID" \
  --query 'Distribution.DomainName' \
  --output text 2>/dev/null || echo "check AWS console")
echo "  URL: https://${DOMAIN}"
echo "═══════════════════════════════════════════════"
echo ""
