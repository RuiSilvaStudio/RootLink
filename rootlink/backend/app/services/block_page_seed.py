"""Idempotent seed for Content Studio block pages (CONTENT_STUDIO.md §6).

Creates the 6 block-composed pages (home, donate, leaderboard, ranking, tools,
groups) with their sections, all published. Called from app.main.lifespan()
after Base.metadata.create_all, the same way seed_default_theme and
seed_element_catalog work. Idempotent: skips pages that already exist.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.block_page import BlockPage, BlockSection

# (slug, label, [(block_type, order), ...])
_BLOCK_PAGES: list[tuple[str, str, list[tuple[str, int]]]] = [
    ("home", "Homepage", [
        ("home-hero", 0),
        ("home-categories", 1),
        ("home-tools", 2),
        ("home-community", 3),
        ("home-recent", 4),
        ("home-cta", 5),
    ]),
    ("donate", "Donate", [
        ("donate-hero", 0),
        ("donate-balance", 1),
        ("donate-tiers", 2),
        ("donate-leaderboard", 3),
        ("donate-how-it-works", 4),
    ]),
    ("leaderboard", "Leaderboard", [
        ("leaderboard-hero", 0),
        ("leaderboard-list", 1),
    ]),
    ("ranking", "Ranking", [
        ("ranking-hero", 0),
        ("ranking-details", 1),
    ]),
    ("tools", "Tools", [
        ("tools-header", 0),
        ("tools-grid", 1),
    ]),
    ("groups", "Groups", [
        ("groups-header", 0),
        ("groups-hero", 1),
    ]),
]


async def seed_block_pages(session: AsyncSession) -> None:
    """Create the 6 block pages + their sections (idempotent).
    Also ensures existing pages are published."""
    for slug, label, sections in _BLOCK_PAGES:
        existing = await session.scalar(
            select(BlockPage).where(BlockPage.slug == slug)
        )
        if existing is None:
            page = BlockPage(
                slug=slug,
                label=label,
                is_published=True,
            )
            session.add(page)
            await session.flush()
            for block_type, order in sections:
                session.add(
                    BlockSection(
                        page_id=page.id,
                        block_type=block_type,
                        props={},
                        order=order,
                    )
                )
        else:
            # Ensure existing pages are published
            existing.is_published = True
    await session.commit()
