import os
import importlib
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from dotenv import load_dotenv

# Load .env file
load_dotenv()

app = FastAPI(
    title="Document Automation System",
    description="Production-ready document automation system with template rendering, Excel import, and PDF conversion.",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Auth Middleware ───
# Public paths that don't require authentication
PUBLIC_PATHS = {
    "/", "/health", "/docs", "/openapi.json", "/redoc",
    "/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/logout",
    "/login", "/api-docs",
}
PUBLIC_PREFIXES = ("/frontend/",)


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    path = request.url.path

    # Skip auth for public paths
    if path in PUBLIC_PATHS or any(path.startswith(p) for p in PUBLIC_PREFIXES):
        return await call_next(request)

    # Skip auth for OPTIONS (CORS preflight)
    if request.method == "OPTIONS":
        return await call_next(request)

    # Check API Key
    api_key = request.headers.get("X-API-Key")
    if api_key:
        from app.core.config import settings
        if api_key == settings.API_KEY:
            return await call_next(request)
        return JSONResponse(status_code=401, content={"detail": "Invalid API Key"})

    # Check JWT (Bearer token or cookie)
    from app.core.auth import decode_access_token
    token = None

    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
    else:
        token = request.cookies.get("access_token")

    if token:
        payload = decode_access_token(token)
        if payload:
            return await call_next(request)
        return JSONResponse(status_code=401, content={"detail": "Token expired or invalid"})

    # No auth provided — redirect to login for browser, 401 for API
    if path.startswith("/api/"):
        return JSONResponse(status_code=401, content={"detail": "Authentication required. Use Bearer token or X-API-Key header."})
    
    # Browser request — redirect to login
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/login")


# Ensure local storage directory exists
STORAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "storage")
os.makedirs(os.path.join(STORAGE_DIR, "templates"), exist_ok=True)
os.makedirs(os.path.join(STORAGE_DIR, "uploads"), exist_ok=True)
os.makedirs(os.path.join(STORAGE_DIR, "rendered"), exist_ok=True)
os.makedirs(os.path.join(STORAGE_DIR, "pdfs"), exist_ok=True)

# Start background file cleanup scheduler
from app.services.cleanup_service import start_cleanup_scheduler
start_cleanup_scheduler()

# Dynamically import and include routers from app/api/v1
api_v1_path = os.path.join(os.path.dirname(__file__), "api", "v1")
for filename in sorted(os.listdir(api_v1_path)):
    if filename.endswith(".py") and filename != "__init__.py":
        module_name = filename[:-3]  # Remove .py extension
        module_path = f"app.api.v1.{module_name}"
        try:
            module = importlib.import_module(module_path)
            if hasattr(module, "router"):
                app.include_router(module.router, prefix=f"/api/v1/{module_name}", tags=[module_name])
                print(f"✅ Included router: {module_path}")
            else:
                print(f"⚠️  Module {module_path} does not have a 'router' object.")
        except Exception as e:
            print(f"❌ Error importing module {module_path}: {e}")
            import traceback
            traceback.print_exc()

@app.get("/", tags=["root"])
async def root():
    """Serve landing page."""
    return FileResponse(os.path.join(FRONTEND_DIR, "landing.html"))

@app.get("/health", tags=["root"])
async def health_check():
    from app.core.database import check_db_connection
    db_ok = check_db_connection()
    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
    }

# ─── Serve Frontend ───
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")

@app.get("/ui", tags=["frontend"])
async def serve_frontend():
    """Serve the Template Designer frontend."""
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

@app.get("/login", tags=["frontend"])
async def serve_login():
    """Serve login page."""
    return FileResponse(os.path.join(FRONTEND_DIR, "login.html"))

@app.get("/api-docs", tags=["frontend"])
async def serve_api_docs():
    """Serve API documentation page."""
    return FileResponse(os.path.join(FRONTEND_DIR, "api-docs.html"))

# Mount static files (CSS, JS, etc.)
if os.path.exists(FRONTEND_DIR):
    app.mount("/frontend", StaticFiles(directory=FRONTEND_DIR), name="frontend")
