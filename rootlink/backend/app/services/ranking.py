import math
from datetime import datetime, timezone


def wilson_score(up: int, down: int) -> float:
    total = up + down
    if total == 0:
        return 0.0
    z = 1.96
    phat = up / total
    return (phat + z * z / (2 * total) - z * math.sqrt((phat * (1 - phat) + z * z / (4 * total)) / total)) / (
        1 + z * z / total
    )


def freshness_score(published_at: datetime | None, half_life_hours: float = 168.0) -> float:
    if published_at is None:
        return 0.0
    now = datetime.now(timezone.utc)
    if published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=timezone.utc)
    age_hours = (now - published_at).total_seconds() / 3600
    if age_hours < 0:
        age_hours = 0
    return math.exp(-0.693 * age_hours / half_life_hours)


def engagement_score(
    comments: int = 0,
    bookmarks: int = 0,
    views: int = 0,
) -> float:
    raw = math.log1p(comments * 3 + bookmarks * 2 + views * 0.1)
    return min(raw / 10.0, 1.0)


def compute_rank(
    relevance: float = 0.0,
    rating_up: int = 0,
    rating_down: int = 0,
    published_at: datetime | None = None,
    comments: int = 0,
    bookmarks: int = 0,
    views: int = 0,
    is_boosted: bool = False,
) -> float:
    rating = wilson_score(rating_up, rating_down)
    fresh = freshness_score(published_at)
    engage = engagement_score(comments, bookmarks, views)
    boost = 1.0 if is_boosted else 0.0

    return (
        relevance * 0.40
        + rating * 0.25
        + fresh * 0.15
        + engage * 0.10
        + boost * 0.10
    )


RANKING_WEIGHTS = {
    "relevance": 0.40,
    "rating": 0.25,
    "freshness": 0.15,
    "engagement": 0.10,
    "boost": 0.10,
}

RANKING_DESCRIPTION = {
    "relevance": "How well the content matches the search query or category filter",
    "rating": "Community thumbs up/down using Wilson score (favours confident ratings)",
    "freshness": "Time decay with a 7-day half-life — newer content scores higher",
    "engagement": "Comments, bookmarks, and views (log-scaled to prevent runaway scores)",
    "boost": "Community Supported flag — active point boost adds a capped 10% nudge",
}
