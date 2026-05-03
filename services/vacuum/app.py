import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from models import HealthData, HealthResponse
from routers.status import router as status_router
from services.vacuum_service import start, stop
from settings import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Vacuum sidecar starting on port %d", settings.sidecar_port)
    await start()
    yield
    await stop()
    logger.info("Vacuum sidecar stopped")


app = FastAPI(title="Vacuum Sidecar", lifespan=lifespan)
app.include_router(status_router)


@app.get("/health")
async def health() -> HealthResponse:
    return HealthResponse(data=HealthData(ok=True))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=settings.sidecar_port)
