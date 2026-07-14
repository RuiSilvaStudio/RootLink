import os

from celery import Celery
from celery.schedules import crontab

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")

celery_app = Celery(
    "rootlink",
    broker=REDIS_URL,
    backend=REDIS_URL.replace("/0", "/1"),
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

# `autodiscover_tasks(["app.tasks"])` does NOT do what it looks like — by
# default it does Django-app-style discovery, importing `<package>.tasks`
# for each entry, so `["app.tasks"]` tries to import `app.tasks.tasks`
# (doesn't exist) and silently registers zero tasks. Confirmed live in prod
# 2026-07-04 (docs/LESSONS.md #36): point decay / RSS crawl / draft cleanup
# have likely never actually executed since Celery was introduced — the
# worker starts cleanly, connects to Redis, and logs an empty `[tasks]`
# block, then every beat-scheduled job fails at dispatch with "Received
# unregistered task" only when its schedule next fires. Explicit imports
# are the fix (task modules self-register via the `@celery_app.task`
# decorator on import) — no discovery magic to get wrong again.
from app.tasks import draft_cleanup, feed_crawler, feed_digest, point_decay  # noqa: E402,F401

celery_app.conf.beat_schedule = {
    "point-decay-daily": {
        "task": "app.tasks.point_decay.apply_decay",
        "schedule": crontab(hour=0, minute=0),
    },
    "crawl-priority-1": {
        "task": "app.tasks.feed_crawler.crawl_feeds_by_priority",
        "schedule": crontab(minute="*/15"),
        "args": (1,),
    },
    "crawl-priority-2": {
        "task": "app.tasks.feed_crawler.crawl_feeds_by_priority",
        "schedule": crontab(minute=0),
        "args": (2,),
    },
    "crawl-priority-3": {
        "task": "app.tasks.feed_crawler.crawl_feeds_by_priority",
        "schedule": crontab(hour="*/6", minute=0),
        "args": (3,),
    },
    "draft-cleanup-monthly": {
        "task": "app.tasks.draft_cleanup.cleanup_stale_drafts",
        "schedule": crontab(hour=2, minute=0, day_of_month=1),
    },
    "feed-digest-daily": {
        "task": "app.tasks.feed_digest.send_daily_digest",
        "schedule": crontab(hour=17, minute=0),
    },
}
