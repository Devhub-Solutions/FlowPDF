from celery import Celery
from ..core.config import settings

celery_app = Celery(
    "worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

celery_app.conf.task_routes = {
    "app.workers.tasks.*": {"queue": "document_queue"}
}

celery_app.autodiscover_tasks(["app.workers"])
