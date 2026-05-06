import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from models import HealthData, HealthResponse
from routers.catalog import router as catalog_router
from routers.playback import router as playback_router
from routers.stream import router as stream_router
from settings import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Media sidecar starting on port %d", settings.sidecar_port)
    yield
    logger.info("Media sidecar stopped")


app = FastAPI(title="Media Sidecar", lifespan=lifespan)
app.include_router(catalog_router)
app.include_router(playback_router)
app.include_router(stream_router)


@app.get("/health")
async def health() -> HealthResponse:
    return HealthResponse(data=HealthData(ok=True))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=settings.sidecar_port)
