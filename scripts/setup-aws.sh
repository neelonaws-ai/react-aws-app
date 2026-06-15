#!/usr/bin/env bash
# =============================================================================
# setup-aws.sh — Provision S3 + CloudFront for React app
#
# Usage:
#   chmod +x scripts/setup-aws.sh
#   ./scripts/setup-aws.sh
#
# Prerequisites:
#   - AWS CLI configured (aws configure)
#   - IAM user with S3FullAccess + CloudFrontFullAccess + ACMFullAccess
# =============================================================================

set -euo pipefail

# ─── Config — edit these ─────────────────────────────────────────
BUCKET_NAME="neels-react-app-prod"          # Must be globally unique
REGION="ap-southeast-2"                  # Sydney
CUSTOM_DOMAIN="app.yourdomain.com"       # Your domain (or leave blank)
SF_DOMAIN="https://yourdomain.my.site.com"  # Your Salesforce Experience site
APP_NAME="MyReactApp-$(date +%s)"
# ─────────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════"
echo "  AWS S3 + CloudFront Setup for React App"
echo "═══════════════════════════════════════════════"
echo ""

# ─── Step 1: Create S3 bucket ─────────────────────────────────
echo "▶ Creating S3 bucket: $BUCKET_NAME in $REGION..."

if aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
  echo "  Bucket already exists — skipping creation"
else
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket \
      --bucket "$BUCKET_NAME" \
      --region "$REGION"
  else
    aws s3api create-bucket \
      --bucket "$BUCKET_NAME" \
      --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION"
  fi
  echo "  ✓ Bucket created"
fi

# ─── Step 2: Block all public access (CloudFront uses OAC) ────
echo "▶ Blocking public access on bucket..."
aws s3api put-public-access-block \
  --bucket "$BUCKET_NAME" \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
echo "  ✓ Public access blocked"

# ─── Step 3: Enable versioning (enables rollback) ─────────────
echo "▶ Enabling bucket versioning..."
aws s3api put-bucket-versioning \
  --bucket "$BUCKET_NAME" \
  --versioning-configuration Status=Enabled
echo "  ✓ Versioning enabled"

# ─── Step 4: Create Origin Access Control ─────────────────────
echo "▶ Creating CloudFront Origin Access Control..."
OAC_ID=$(aws cloudfront create-origin-access-control \
  --origin-access-control-config "{
    \"Name\": \"${APP_NAME}-OAC\",
    \"Description\": \"OAC for ${APP_NAME}\",
    \"OriginAccessControlOriginType\": \"s3\",
    \"SigningBehavior\": \"always\",
    \"SigningProtocol\": \"sigv4\"
  }" \
  --query 'OriginAccessControl.Id' \
  --output text)
echo "  ✓ OAC created: $OAC_ID"

# ─── Step 5: Create CloudFront Response Headers Policy ────────
echo "▶ Creating response headers policy (frame-ancestors for SF)..."
RHP_ID=$(aws cloudfront create-response-headers-policy \
  --response-headers-policy-config "{
    \"Name\": \"${APP_NAME}-SF-iframe-Policy\",
    \"SecurityHeadersConfig\": {
      \"ContentSecurityPolicy\": {
        \"ContentSecurityPolicy\": \"frame-ancestors ${SF_DOMAIN} https://*.lightning.force.com\",
        \"Override\": true
      },
      \"ContentTypeOptions\": {
        \"Override\": true
      },
      \"ReferrerPolicy\": {
        \"ReferrerPolicy\": \"strict-origin-when-cross-origin\",
        \"Override\": true
      }
    }
  }" \
  --query 'ResponseHeadersPolicy.Id' \
  --output text)
echo "  ✓ Response headers policy created: $RHP_ID"

# ─── Step 6: Create CloudFront distribution ───────────────────
echo "▶ Creating CloudFront distribution..."
DISTRIBUTION=$(aws cloudfront create-distribution \
  --distribution-config "{
    \"CallerReference\": \"${APP_NAME}-$(date +%s)\",
    \"DefaultRootObject\": \"index.html\",
    \"Origins\": {
      \"Quantity\": 1,
      \"Items\": [{
        \"Id\": \"S3-${BUCKET_NAME}\",
        \"DomainName\": \"${BUCKET_NAME}.s3.${REGION}.amazonaws.com\",
        \"S3OriginConfig\": { \"OriginAccessIdentity\": \"\" },
        \"OriginAccessControlId\": \"${OAC_ID}\"
      }]
    },
    \"DefaultCacheBehavior\": {
      \"TargetOriginId\": \"S3-${BUCKET_NAME}\",
      \"ViewerProtocolPolicy\": \"redirect-to-https\",
      \"CachePolicyId\": \"658327ea-f89d-4fab-a63d-7e88639e58f6\",
      \"ResponseHeadersPolicyId\": \"${RHP_ID}\",
      \"AllowedMethods\": {
        \"Quantity\": 2,
        \"Items\": [\"GET\", \"HEAD\"],
        \"CachedMethods\": { \"Quantity\": 2, \"Items\": [\"GET\", \"HEAD\"] }
      },
      \"Compress\": true
    },
    \"CustomErrorResponses\": {
      \"Quantity\": 2,
      \"Items\": [
        {
          \"ErrorCode\": 403,
          \"ResponsePagePath\": \"/index.html\",
          \"ResponseCode\": \"200\",
          \"ErrorCachingMinTTL\": 0
        },
        {
          \"ErrorCode\": 404,
          \"ResponsePagePath\": \"/index.html\",
          \"ResponseCode\": \"200\",
          \"ErrorCachingMinTTL\": 0
        }
      ]
    },
    \"Enabled\": true,
    \"HttpVersion\": \"http2and3\",
    \"Comment\": \"${APP_NAME} React SPA\"
  }")

DISTRIBUTION_ID=$(echo "$DISTRIBUTION" | python3 -c "import sys,json; print(json.load(sys.stdin)['Distribution']['Id'])")
CF_DOMAIN=$(echo "$DISTRIBUTION" | python3 -c "import sys,json; print(json.load(sys.stdin)['Distribution']['DomainName'])")
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "  ✓ Distribution created: $DISTRIBUTION_ID"
echo "  ✓ CloudFront domain: $CF_DOMAIN"

# ─── Step 7: Attach bucket policy for CloudFront OAC ─────────
echo "▶ Attaching S3 bucket policy for CloudFront OAC..."
cat > /tmp/bucket-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontOAC",
      "Effect": "Allow",
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${DISTRIBUTION_ID}"
        }
      }
    }
  ]
}
EOF

aws s3api put-bucket-policy \
  --bucket "$BUCKET_NAME" \
  --policy file:///tmp/bucket-policy.json
echo "  ✓ Bucket policy attached"

# ─── Save outputs ─────────────────────────────────────────────
cat > ./infrastructure/outputs.env <<EOF
# Generated by setup-aws.sh — $(date)
# Add these to GitHub Actions secrets
S3_BUCKET=${BUCKET_NAME}
AWS_REGION=${REGION}
CLOUDFRONT_DISTRIBUTION_ID=${DISTRIBUTION_ID}
CLOUDFRONT_DOMAIN=${CF_DOMAIN}
EOF

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✓ Setup complete!"
echo "═══════════════════════════════════════════════"
echo ""
echo "  CloudFront URL:      https://${CF_DOMAIN}"
echo "  S3 Bucket:           ${BUCKET_NAME}"
echo "  Distribution ID:     ${DISTRIBUTION_ID}"
echo ""
echo "  Next steps:"
echo "  1. Add GitHub secrets (see infrastructure/outputs.env)"
echo "  2. Run: npm run build && ./scripts/deploy.sh"
if [ -n "$CUSTOM_DOMAIN" ]; then
echo "  3. Set up custom domain: ${CUSTOM_DOMAIN}"
echo "     - Request ACM cert in us-east-1"
echo "     - Add CNAME to CloudFront distribution"
fi
echo "  4. Add ${CF_DOMAIN} to Salesforce CSP Trusted Sites"
echo ""
