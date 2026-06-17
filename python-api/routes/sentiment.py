"""POST /api/analyze-sentiment — text-only distress analysis."""

from fastapi import APIRouter

from schemas import SentimentRequest, SentimentResponse
from analysis import analyse_text_distress

router = APIRouter()


@router.post("/api/analyze-sentiment", response_model=SentimentResponse)
async def analyze_sentiment(payload: SentimentRequest):
    result = analyse_text_distress(payload.text)
    return SentimentResponse(**result)
