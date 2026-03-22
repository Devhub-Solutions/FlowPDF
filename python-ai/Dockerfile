FROM python:3.11-slim

WORKDIR /app

# System libraries required by OpenCV / Pillow / LibGL used by ultralytics
# and system dependencies needed by Playwright Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install CPU-only PyTorch first to keep image size manageable
RUN pip install --no-cache-dir \
    torch==2.3.1+cpu \
    torchvision==0.18.1+cpu \
    --extra-index-url https://download.pytorch.org/whl/cpu

# Install remaining dependencies (including playwright)
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright Chromium browser and its OS dependencies
RUN playwright install chromium --with-deps

COPY main.py vncv_ocr.py vietocr_vgg_transformer.yml .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
