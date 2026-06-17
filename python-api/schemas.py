"""Pydantic request / response models for the API."""

from typing import List
from pydantic import BaseModel


class SentimentRequest(BaseModel):
    text: str


class SentimentResponse(BaseModel):
    sentimentScore: float
    stressScore: int
    cognitiveLoad: str
    keywords: List[str]
    intervention: str
    modelClass: str
    processedOnPremises: bool
