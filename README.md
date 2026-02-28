<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="Version" />
  <img src="https://img.shields.io/badge/license-Devhub--Solutions-blue" alt="License" />
  <img src="https://img.shields.io/docker/pulls/library/python.svg?label=Docker%20(Python%203.10+)" alt="Docker Pulls" />
  <img src="https://img.shields.io/badge/build-passing-brightgreen.svg" alt="Build Status" />
  <img src="https://img.shields.io/github/stars/Devhub-Solutions/FlowPDF?style=social" alt="GitHub Stars" />
  <img src="https://img.shields.io/github/issues/Devhub-Solutions/FlowPDF.svg" alt="Issues" />
  <img src="https://img.shields.io/github/forks/Devhub-Solutions/FlowPDF.svg" alt="Forks" />
</p>

# FlowPDF



**FlowPDF** là hệ thống tự động hóa tạo tài liệu từ form, hỗ trợ thiết kế template từ file DOCX, mapping dữ liệu, và xuất PDF chuyên nghiệp qua REST API.

## Tính năng nổi bật

- Thiết kế template trực quan từ file DOCX (drag & select, gán nhãn biến)
- Mapping dữ liệu động (table loop, array)
- Xuất PDF chất lượng cao giữ nguyên layout, font, bảng, hình ảnh
- REST API bảo mật (API Key & JWT)
- Lưu trữ persistent với MySQL
- Giao diện frontend hiện đại, dễ sử dụng

## Kiến trúc tổng quan

- **Backend:** Python (FastAPI), chia module rõ ràng: `api`, `core`, `models`, `services`, `utils`, `workers`
- **Frontend:** HTML/CSS/JS tách riêng, phục vụ qua FastAPI static files
- **Database:** MySQL (cấu hình qua docker-compose)
- **PDF Engine:** LibreOffice (chạy trong Docker)
- **Authentication:** API Key cho hệ thống ngoài, JWT cho frontend/user

## Hướng dẫn cài đặt

### Yêu cầu

- Docker & Docker Compose
- Python 3.10+ (nếu chạy local)
- MySQL

### Chạy bằng Docker

```bash
git clone https://github.com/Devhub-Solutions/FlowPDF.git
cd FlowPDF
docker-compose up --build
```

- Truy cập API docs: http://localhost:8000/api-docs hoặc http://localhost:8000/docs
- Truy cập giao diện: http://localhost:8000/ui

### Chạy local (dev)

1. Cài Python, pip, LibreOffice
2. Cài package: `pip install -r requirements.txt`
3. Chạy server: `uvicorn app.main:app --reload`
4. Cấu hình biến môi trường trong .env nếu cần

## Hướng dẫn sử dụng nhanh

1. **Upload DOCX**: Gửi file lên `/api/v1/designer/raw`
2. **Xem cấu trúc**: GET `/api/v1/designer/{template_id}/structure`
3. **Tạo mapping**: POST `/api/v1/designer/{template_id}/mappings`
4. **Publish template**: POST `/api/v1/designer/{template_id}/publish`
5. **Render PDF**: POST `/api/v1/designer/{template_id}/render` với dữ liệu

Chi tiết API và ví dụ curl xem tại file api-docs.html hoặc truy cập `/api-docs`.

## Tham khảo thêm

- Trang landing: `/landing.html`
- Swagger UI: `/docs`
- Cấu hình Docker: app.Dockerfile, `docker-compose.yml`
