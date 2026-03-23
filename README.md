# FlowPDF

> **Copyright (C) 2025 Công ty TNHH Devhub Solutions (MST: 0319405240)**  
> Licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.  
> Commercial / proprietary licensing available — see [License](#license) section below.

**DOCX Template → PDF rendering microservice.**  
Upload a `.docx` template with `{placeholder}` variables, inject JSON data, and get a crisp PDF back in milliseconds.

---

## Architecture

```
React UI  →  FlowPDF API  →  Docxtemplater  →  DOCX  →  Gotenberg  →  PDF
```

| Service | Port | Description |
|---|---|---|
| `flowpdf` | 8080 | Unified app (API + UI) |
| `gotenberg` | internal only | LibreOffice/Chromium PDF converter reachable only inside Docker network |

---

## Quick Start

```bash
# Clone and start
git clone <repo>
cd flowpdf
docker compose up --build
```

- **UI**: http://localhost:8080  
- **API**: http://localhost:8080/api  
- **API Docs (Swagger)**: http://localhost:8080/api-docs  

`gotenberg` is intentionally not published to the host. The `flowpdf` service talks to it internally at `http://gotenberg:3000`.

### Pull Pre-built Image

```bash
docker pull ghcr.io/devhub-solutions/flowpdf:latest
```

---

## API Documentation

Interactive Swagger UI is available at:

```
http://localhost:8080/api-docs
```

OpenAPI JSON spec:

```
http://localhost:8080/api-docs.json
```

---

## API Reference

### Authentication

All `/api/*` endpoints require:

```
Authorization: Bearer flowpdf_dev_key
```

Change the key via `FLOWPDF_API_KEY` env var.

---

### POST /api/render

Render a DOCX template to PDF (binary response).

**Request** — `multipart/form-data`:

| Field | Type | Required | Description |
|---|---|---|---|
| `template` | file (.docx) | ✅ | DOCX template file |
| `data` | JSON string | ❌ | Variable values and optional image size config |
| `signature` | file (image) | ❌ | Image for `{%signature}` |
| `logo` | file (image) | ❌ | Image for `{%logo}` |
| `<any-image-key>` | file (image) | ❌ | Image for matching `{%<any-image-key>}` placeholder |
| `html` | string | ❌ | HTML string (skips template) |
| `url` | string | ❌ | URL to convert to PDF |

All uploaded images are normalized to PNG before DOCX injection. In practice, any format supported by `sharp` can be uploaded.

**Response**: `application/pdf` binary

**Curl example:**
```bash
curl -X POST http://localhost:8080/api/render \
  -H "Authorization: Bearer flowpdf_dev_key" \
  -F "template=@contract.docx" \
  -F 'data={"name":"Nguyen Van A","amount":"5,000,000 VND","date":"2025-01-15","imageOptions":{"signature":{"width":180,"height":60},"logo":{"w":140,"h":70}}}' \
  -F "signature=@signature.gif" \
  -F "logo=@brand.webp" \
  --output document.pdf
```

**Image size config in `data`:**
```json
{
  "imageOptions": {
    "signature": { "width": 180, "height": 60 },
    "logo": { "w": 140, "h": 70 }
  }
}
```

Also supported:
- `_imageOptions` as an alternative key
- `width`, `height`
- `widthPx`, `heightPx`
- `w`, `h`

---

### POST /api/preview

Same as `/render` but returns base64-encoded PDF.

**Response:**
```json
{
  "success": true,
  "pdf": "<base64 string>",
  "size": 48392
}
```

`/api/preview` supports the same image upload behavior and `imageOptions` / `_imageOptions` JSON config as `/api/render`.

---

### POST /api/analyze

Detect placeholders in a DOCX template.

```bash
curl -X POST http://localhost:8080/api/analyze \
  -H "Authorization: Bearer flowpdf_dev_key" \
  -F "template=@contract.docx"
```

**Response:**
```json
{
  "placeholders": ["name", "amount", "date", "company"]
}
```

---

### POST /api/combine

Combine multiple files of different types into a single PDF.

**Supported file types:** PDF, JPEG, PNG, TIFF, BMP, GIF, DOC, DOCX

Each non-PDF file is first converted to PDF, then all PDFs are merged in the specified order.

**Request** — `multipart/form-data`:

| Field | Type | Required | Description |
|---|---|---|---|
| `files` | file[] | ✅ | Files to combine (max 20). Supported: image (jpg, png, tif, tiff, bmp, gif), doc, docx, pdf |
| `order` | JSON string | ❌ | Array of filenames specifying merge order. Files not listed are appended at the end. If omitted, upload order is used. |

**Curl example:**
```bash
curl -X POST http://localhost:8080/api/combine \
  -H "Authorization: Bearer flowpdf_dev_key" \
  -F "files=@cover.pdf" \
  -F "files=@scan.tiff" \
  -F "files=@contract.docx" \
  -F "files=@photo.jpg" \
  -F 'order=["cover.pdf","scan.tiff","contract.docx","photo.jpg"]' \
  --output combined.pdf
```

**Response**: `application/pdf` binary

**Errors:**
```json
{ "error": "No files provided. Upload files using the \"files\" field." }
{ "error": "Unsupported file type: file.xyz (application/octet-stream). Supported types: ..." }
{ "error": "Invalid JSON in order field. Expected an array of filenames." }
```

---

### GET /api/health

Health check including Gotenberg status.

```bash
curl http://localhost:8080/api/health
```

**Response:**
```json
{
  "status": "ok",
  "gotenberg": "ok",
  "timestamp": "2025-01-15T10:00:00.000Z"
}
```

---

## Template Syntax

Templates use [Docxtemplater](https://docxtemplater.com/) syntax:

```
{name}           → simple text substitution
{price}          → numeric value
{%signature}     → image placeholder (requires image upload)
{#items}...{/}   → loop
{?condition}...{/} → conditional
```

Notes:
- Image placeholders should use the form `{%imageKey}`.
- The uploaded multipart field name must match the image key exactly.
- Image placeholders work best when placed in their own paragraph or table cell.

---

## Environment Variables

### API (`flowpdf-api`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Server port |
| `FLOWPDF_API_KEY` | *(none)* | Auth key (skip if unset) |
| `GOTENBERG_URL` | `http://gotenberg:3000` | Internal Docker Gotenberg endpoint |
| `PYTHON_AI_URL` | `http://localhost:8000` | Internal Python AI service base URL |
| `PYTHON_AI_TIMEOUT_MS` | `120000` | Timeout (ms) for Python AI requests from the API |
| `LOG_LEVEL` | `info` | winston log level |

---

## HTML & URL rendering

Beyond DOCX templates, the API also converts:

**HTML to PDF:**
```bash
curl -X POST http://localhost:8080/api/render \
  -H "Authorization: Bearer flowpdf_dev_key" \
  -F 'html=<h1>Hello World</h1><p>This is a PDF.</p>' \
  --output output.pdf
```

**URL to PDF:**
```bash
curl -X POST http://localhost:8080/api/render \
  -H "Authorization: Bearer flowpdf_dev_key" \
  -F 'url=https://example.com' \
  --output output.pdf
```

---

## CI/CD

Docker images are automatically built and pushed to GitHub Container Registry on every push to `main` and on version tags.

**Workflow:** `.github/workflows/docker-build.yml`

| Trigger | Action |
|---|---|
| Push to `main` | Build & push with `latest` + `main` + `sha-*` tags |
| Push tag `v*` | Build & push with semver tags (`1.0.0`, `1.0`) |
| Pull request | Build only (no push) |

**Image:**
- `ghcr.io/devhub-solutions/flowpdf`

### Required Secret: `GH_PAT`

The workflow automatically sets the published container package to **public** after each push. This requires a secret named `GH_PAT` because the default `GITHUB_TOKEN` lacks the API permission to change organization package visibility.

**Setup (one-time, performed by an org admin):**

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. Click **Generate new token (classic)**
3. Give it a descriptive name (e.g. `flowpdf-packages-visibility`)
4. Select the scope: **`write:packages`**
5. Click **Generate token** and copy the value
6. Go to the repository → **Settings → Secrets and variables → Actions**
7. Click **New repository secret**, name it `GH_PAT`, paste the token value, and save

Once `GH_PAT` is set, every push to `main` or a version tag will push the image **and** ensure it remains publicly accessible at `ghcr.io/devhub-solutions/flowpdf`.

---

## Development

```bash
# API only (with hot reload)
cd api && npm install && npm run dev

# Frontend only
cd frontend && npm install && npm run dev
```

If you change frontend dependencies, update the lockfile before rebuilding Docker:

```bash
cd frontend && npm install
```

---

## Project Structure

```
flowpdf/
├── .github/
│   └── workflows/
│       └── docker-build.yml       # CI/CD pipeline
├── api/
│   ├── src/
│   │   ├── config/swagger.ts      # OpenAPI/Swagger config
│   │   ├── controllers/
│   │   │   ├── renderController.ts
│   │   │   └── combineController.ts
│   │   ├── middleware/auth.ts
│   │   ├── routes/index.ts
│   │   ├── services/
│   │   │   ├── docxService.ts      # Docxtemplater
│   │   │   └── gotenbergService.ts # PDF conversion + merge + retry
│   │   ├── utils/logger.ts
│   │   └── index.ts
│   ├── Dockerfile                   # Standalone API image
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                 # Route entry
│   │   ├── components/
│   │   │   ├── icons/Ico.tsx
│   │   │   ├── layout/AppLayout.tsx
│   │   │   └── ui/StepBadge.tsx
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx
│   │   │   ├── RenderPage.tsx
│   │   │   ├── MergePage.tsx
│   │   │   └── BuilderPage.tsx
│   │   ├── services/api.ts
│   │   ├── types/index.ts
│   │   ├── utils/uid.ts
│   │   └── main.tsx
│   ├── Dockerfile                   # Standalone frontend image
│   ├── nginx.conf
│   └── vite.config.ts
│
├── Dockerfile                       # Unified image (API + UI)
├── docker-compose.yml
└── README.md
```

---

## License

FlowPDF is copyright (C) 2025 **Công ty TNHH Devhub Solutions** (MST: 0319405240) and is
distributed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

This project incorporates [Ultralytics YOLO](https://github.com/ultralytics/ultralytics),
which is licensed under AGPL-3.0. Use of Ultralytics software in this project therefore
requires this project to also be distributed under AGPL-3.0.

### What AGPL-3.0 means for you

| Use-case | Requirement |
|---|---|
| Use the public hosted service | No source-code obligations |
| Self-host with no modifications | Must keep this LICENSE file intact |
| Self-host with modifications | Must publish your modified source under AGPL-3.0 |
| Embed / redistribute in your own product | Must open-source the whole combined work under AGPL-3.0 |
| Internal / proprietary use without open-sourcing | **Commercial license required** — contact us |

### Commercial Licensing

If you need to use FlowPDF in a proprietary product, integrate it internally
without the AGPL-3.0 source-disclosure obligation, or require a support agreement,
please contact:

**Công ty TNHH Devhub Solutions**  
GitHub: <https://github.com/Devhub-Solutions>

### Third-party components

See [`NOTICE`](NOTICE) for a full list of third-party open-source components and
their respective licenses.
