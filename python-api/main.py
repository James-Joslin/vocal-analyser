"""
Application entry point.

Creates the FastAPI app, mounts all routers, and triggers model preload
on startup.  Run with: ``uvicorn main:app --host 0.0.0.0 --port 8000``
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from models import preload_models
from routes import health_router, transcribe_router, sentiment_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    preload_models()
    yield


app = FastAPI(
    title="Psychological Stress Analytics Engine",
    description=(
        "On-premises FastAPI service using faster-whisper, "
        "Wav2Vec2 emotion classification, and DistilBERT sentiment analysis."
    ),
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(transcribe_router)
app.include_router(sentiment_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)