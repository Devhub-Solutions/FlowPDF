# FlowPDF

**DOCX Template → PDF rendering microservice.**  
Upload a `.docx` template with `{placeholder}` variables, inject JSON data, and get a crisp PDF back in milliseconds.

---

## Architecture

```
React UI  →  FlowPDF API  →  Docxtemplater  →  DOCX  →  Gotenberg  →  PDF
```

| Service | Port | Description |
|---|---|---|
| `flowpdf-frontend` | 3001 | React UI (Nginx) |
| `flowpdf-api` | 8080 | NodeJS Express API |
| `gotenberg` | 3000 | LibreOffice-based PDF converter |

---

## Quick Start

```bash
# Clone and start
git clone <repo>
cd flowpdf
docker compose up --build
```

- **UI**: http://localhost:3001  
- **API**: http://localhost:8080  
- **API Docs (Swagger)**: http://localhost:8080/api-docs  
- **Gotenberg**: http://localhost:3000

### Pull Pre-built Images

```bash
docker pull ghcr.io/devhub-solutions/flowpdf-api:latest
docker pull ghcr.io/devhub-solutions/flowpdf-frontend:latest
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
| `data` | JSON string | ✅ | Variable values |
| `signature` | file (image) | ❌ | Signature image |
| `logo` | file (image) | ❌ | Logo image |
| `image1` | file (image) | ❌ | Additional image 1 |
| `image2` | file (image) | ❌ | Additional image 2 |
| `image3` | file (image) | ❌ | Additional image 3 |
| `html` | string | ❌ | HTML string (skips template) |
| `url` | string | ❌ | URL to convert to PDF |

**Response**: `application/pdf` binary

**Curl example:**
```bash
curl -X POST http://localhost:8080/api/render \
  -H "Authorization: Bearer flowpdf_dev_key" \
  -F "template=@contract.docx" \
  -F 'data={"name":"Nguyen Van A","amount":"5,000,000 VND","date":"2025-01-15"}' \
  --output document.pdf
```

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

---

## Environment Variables

### API (`flowpdf-api`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Server port |
| `FLOWPDF_API_KEY` | *(none)* | Auth key (skip if unset) |
| `GOTENBERG_URL` | `http://localhost:3000` | Gotenberg endpoint |
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

**Images:**
- `ghcr.io/devhub-solutions/flowpdf-api`
- `ghcr.io/devhub-solutions/flowpdf-frontend`

---

## Development

```bash
# API only (with hot reload)
cd api && npm install && npm run dev

# Frontend only
cd frontend && npm install && npm run dev
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
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                 # Main UI
│   │   ├── services/api.ts
│   │   └── main.tsx
│   ├── Dockerfile
│   ├── nginx.conf
│   └── vite.config.ts
│
├── docker-compose.yml
└── README.md
```

---

## License

MIT
