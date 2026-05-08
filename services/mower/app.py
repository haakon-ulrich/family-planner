import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from models import HealthData, HealthResponse
from routers.status import router as status_router
from services.mower_service import is_mqtt_connected
from services.mower_service import start as mower_start
from services.mower_service import stop as mower_stop
from settings import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Mower sidecar starting on port %d", settings.mower_sidecar_port)
    await mower_start()
    yield
    await mower_stop()
    logger.info("Mower sidecar stopped")


app = FastAPI(title="Mower Sidecar", lifespan=lifespan)
app.include_router(status_router)


@app.get("/health")
async def health() -> HealthResponse:
    return HealthResponse(data=HealthData(ok=True, mqtt_connected=is_mqtt_connected()))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=settings.mower_sidecar_port)
