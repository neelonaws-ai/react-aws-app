# React App — AWS S3 + CloudFront

A React SPA (Vite) hosted on AWS S3 + CloudFront, designed to be embedded
inline in a Salesforce Experience Cloud site via iframe.

---

## Project structure

```
react-aws-app/
├── src/
│   ├── components/
│   │   ├── Layout.jsx / .module.css     ← shell, nav, header/footer
│   │   └── StatCard.jsx / .module.css   ← metric card
│   ├── hooks/
│   │   └── useSalesforceBridge.js       ← postMessage ↔ Salesforce
│   ├── pages/
│   │   ├── Dashboard.jsx / .module.css
│   │   ├── About.jsx / .module.css
│   │   └── NotFound.jsx / .module.css
│   ├── App.jsx                          ← routing
│   ├── main.jsx                         ← React entry point
│   └── index.css                        ← design tokens + reset
├── infrastructure/
│   ├── lwc-reactIframeHost.js           ← Salesforce LWC (copy to SF org)
│   ├── lwc-reactIframeHost.html
│   └── lwc-reactIframeHost.js-meta.xml
├── scripts/
│   ├── setup-aws.sh                     ← one-time AWS provisioning
│   └── deploy.sh                        ← manual deploy
├── .github/workflows/deploy.yml         ← CI/CD pipeline
├── vite.config.js
└── index.html
```

---

## Local development

```bash
npm install
npm run dev
# → http://localhost:5173
```

---

## AWS setup (one-time)

### Prerequisites
- AWS CLI configured (`aws configure`)
- IAM user with: `AmazonS3FullAccess`, `CloudFrontFullAccess`, `AmazonRoute53FullAccess`

### Run the setup script

```bash
# Edit config variables at the top of the script first
nano scripts/setup-aws.sh

chmod +x scripts/setup-aws.sh
./scripts/setup-aws.sh
```

This creates:
- S3 bucket (private, versioning enabled)
- CloudFront Origin Access Control (OAC)
- CloudFront Response Headers Policy (frame-ancestors for Salesforce)
- CloudFront distribution (HTTPS, React Router support, gzip)
- S3 bucket policy granting CloudFront OAC access
- `infrastructure/outputs.env` with all generated IDs

---

## Manual deploy

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

---

## CI/CD via GitHub Actions

### GitHub Secrets required

| Secret | Where to get it |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM → Users → Security credentials |
| `AWS_SECRET_ACCESS_KEY` | IAM → Users → Security credentials |
| `S3_BUCKET` | From `infrastructure/outputs.env` |
| `CLOUDFRONT_DISTRIBUTION_ID` | From `infrastructure/outputs.env` |
| `VITE_SF_BASE_URL` | Your Salesforce Experience site URL |
| `VITE_API_BASE_URL` | Your backend API URL |
| `VITE_APP_NAME` | e.g. `MyApp` |

Push to `main` → GitHub Actions builds and deploys automatically.

---

## Salesforce integration

### 1. Add to CSP Trusted Sites

> Experience Builder → Administration → Security → CSP Trusted Sites → New

| Field | Value |
|---|---|
| Name | ReactApp |
| URL | `https://your-distribution.cloudfront.net` |
| Context | ✓ Frame |

### 2. Deploy LWC to Salesforce org

Copy files from `infrastructure/` into your Salesforce project:

```
force-app/main/default/lwc/reactIframeHost/
  ├── reactIframeHost.js          ← from infrastructure/lwc-reactIframeHost.js
  ├── reactIframeHost.html        ← from infrastructure/lwc-reactIframeHost.html
  └── reactIframeHost.js-meta.xml
```

Update `REACT_APP_ORIGIN` in `reactIframeHost.js` to your CloudFront domain.

```bash
sf project deploy start --source-dir force-app/main/default/lwc/reactIframeHost
```

### 3. Add component to Experience Builder

Drag `React Iframe Host` component onto any page in Experience Builder.

---

## Cache strategy

| File | Cache-Control | Reason |
|---|---|---|
| `index.html` | `no-cache` | Always fresh — entry point |
| `assets/*.js` | `max-age=31536000, immutable` | Content-hashed filename |
| `assets/*.css` | `max-age=31536000, immutable` | Content-hashed filename |

---

## Environment variables

| Variable | Description |
|---|---|
| `VITE_APP_ENV` | `development` or `production` |
| `VITE_APP_NAME` | Display name |
| `VITE_SF_BASE_URL` | Salesforce Experience site URL |
| `VITE_API_BASE_URL` | Backend API base URL |
