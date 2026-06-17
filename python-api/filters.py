"""
Post-transcription quality filters.

Two failure modes are caught:
1. **Static hallucinations** — stock phrases Whisper generates on non-speech
   audio ("Thank you for watching", "I'm sorry", CJK/French variants).
2. **Decoder loops** — the model gets stuck repeating one token endlessly
   ("yeah, yeah, yeah, …" × 200).
"""

import re
from collections import Counter

# Phrases Whisper hallucinates on background noise / silence.
WHISPER_HALLUCINATIONS = frozenset(s.lower() for s in (
    "Thank you for watching",
    "Thanks for watching",
    "Thank you for listening",
    "Thanks for listening",
    "Please subscribe",
    "Subscribe to my channel",
    "Like and subscribe",
    "See you next time",
    "See you in the next video",
    "I'm sorry",
    "Goodbye",
    "Bye",
    "Bye bye",
    "Bye-bye",
    "You",
    "...",
    "MBC 뉴스 이덕영입니다",
    "Sous-titrage ST' 501",
    "ご視聴ありがとうございました",
))


def is_whisper_hallucination(text: str) -> bool:
    """Return True if the text is a known Whisper noise-hallucination."""
    cleaned = text.strip().lower().rstrip(".!,")
    if len(cleaned) < 3:
        return True
    return cleaned in WHISPER_HALLUCINATIONS


def is_decoder_loop(text: str) -> bool:
    """Detect Whisper decoder loops where a word or short phrase repeats
    endlessly (e.g. "yeah, yeah, yeah, …" × 200).

    Returns True if any single token makes up more than half the words
    and the output is long enough for that to be meaningful (≥ 8 words).
    """
    words = re.findall(r"[a-zA-Z]+", text.lower())
    if len(words) < 8:
        return False

    counts = Counter(words)
    _most_common_word, most_common_count = counts.most_common(1)[0]
    return most_common_count > len(words) * 0.5


def is_bad_transcription(text: str) -> bool:
    """Combined filter: static hallucinations + decoder loops."""
    return is_whisper_hallucination(text) or is_decoder_loop(text)
