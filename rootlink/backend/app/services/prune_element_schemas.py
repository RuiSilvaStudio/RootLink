"""One-time: prune ElementSchema is_visible based on actual Tailwind class usage.

For each of the 56 component types, sets is_visible=False on properties the
component's source code never uses (no matching Tailwind classes found).
Properties that ARE used keep is_visible=True. Safe to re-run — only updates
rows where is_visible doesn't match the target.

Run once via: python -m app.services.prune_element_schemas
"""

import asyncio
import os

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.models.element_schema import ElementSchema

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./rootlink.db")

ALL_PROPS = [
    "font-family", "font-size", "font-weight", "font-style", "text-align",
    "color", "text-decoration", "letter-spacing", "line-height",
    "background-color", "border-color", "padding", "gap", "border-radius",
]

# Per-component: which properties are actually used (found in Tailwind classes).
# Derived from scanning every component's source code for matching utility classes.
USED: dict[str, set[str]] = {
    "IconContainer": {"color", "background-color", "border-radius"},
    "SectionHeader": {"font-family", "font-size", "font-weight", "color", "line-height", "background-color", "border-radius"},
    "LinkWithArrow": {"font-family", "font-size", "font-weight", "color", "gap"},
    "FilterPill": {"font-size", "color", "background-color", "border-color", "padding", "gap", "border-radius"},
    "SidebarWidget": {"font-family", "font-size", "font-weight", "color", "letter-spacing", "background-color", "border-color", "padding", "gap", "border-radius"},
    "RankedListRow": {"font-family", "font-size", "font-weight", "color", "background-color", "border-color", "padding", "gap", "border-radius"},
    "ResultCard": {"font-family", "font-size", "font-weight", "color", "background-color", "border-color", "padding", "gap", "border-radius"},
    "Avatar": {"font-family", "font-size", "font-weight", "color", "background-color", "border-radius"},
    "Badge": {"font-family", "font-size", "font-weight", "color", "letter-spacing", "background-color", "border-color", "padding", "gap", "border-radius"},
    "Button": {"font-family", "font-size", "font-weight", "color", "letter-spacing", "background-color", "border-color", "padding", "gap", "border-radius"},
    "Card": set(),
    "PageHeader": {"font-family", "font-size", "font-weight", "color", "letter-spacing", "line-height", "background-color", "border-radius"},
    "Section": {"font-family", "font-size", "font-weight", "text-align", "color", "letter-spacing", "line-height", "background-color", "padding", "border-radius"},
    "StatCounter": {"font-family", "font-size", "text-align", "color", "letter-spacing"},
    "Toggle": {"font-family", "font-size", "color", "background-color", "border-color", "gap", "border-radius"},
    "Tooltip": {"font-size", "color", "line-height", "background-color", "padding", "border-radius"},
    "Input": {"font-family", "font-size", "font-weight", "color", "letter-spacing", "background-color", "border-color", "padding", "border-radius"},
    "Select": {"font-family", "font-size", "font-weight", "color", "letter-spacing", "background-color", "border-color", "padding", "border-radius"},
    "Textarea": {"font-family", "font-size", "font-weight", "color", "letter-spacing", "background-color", "border-color", "padding", "border-radius"},
    "ProgressBar": {"font-family", "font-size", "color", "background-color", "border-radius"},
    "HeroBlock": {"font-family", "font-size", "font-weight", "text-align", "color", "line-height", "background-color", "padding", "gap", "border-radius"},
    "TextBlock": {"font-family", "font-size", "font-weight", "color", "line-height", "background-color", "padding", "border-radius"},
    "CardGridBlock": {"font-family", "font-size", "font-weight", "color", "line-height", "background-color", "border-color", "padding", "gap", "border-radius"},
    "CtaBlock": {"font-family", "font-size", "font-weight", "text-align", "color", "line-height", "background-color", "padding", "gap", "border-radius"},
    "HomeHeroBlock": {"font-family", "font-size", "font-weight", "font-style", "text-align", "color", "letter-spacing", "line-height", "background-color", "border-color", "padding", "gap", "border-radius"},
    "HomeCategoriesBlock": {"font-family", "font-size", "font-weight", "text-align", "color", "line-height", "background-color", "padding", "gap"},
    "HomeToolsBlock": {"font-family", "font-size", "font-weight", "color", "line-height", "background-color", "padding", "gap", "border-radius"},
    "HomeCommunityBlock": {"font-family", "font-size", "font-weight", "color", "line-height", "background-color", "border-color", "padding", "gap", "border-radius"},
    "HomeRecentBlock": {"font-family", "font-size", "font-weight", "text-align", "color", "line-height", "background-color", "padding", "gap", "border-radius"},
    "HomeCtaBlock": {"font-family", "font-size", "font-weight", "text-align", "color", "line-height", "background-color", "padding", "gap"},
    "DonateHeroBlock": {"font-family", "font-size", "font-weight", "text-align", "color"},
    "DonateBalanceBlock": {"font-family", "font-size", "font-weight", "text-align", "color", "background-color", "border-color", "padding", "border-radius"},
    "DonateTiersBlock": {"font-family", "font-size", "font-weight", "color", "background-color", "border-color", "padding", "gap", "border-radius"},
    "DonateLeaderboardBlock": {"font-family", "font-size", "font-weight", "color", "background-color", "border-color", "padding", "gap", "border-radius"},
    "DonateHowItWorksBlock": {"font-family", "font-size", "font-weight", "color", "background-color", "border-color", "padding", "border-radius"},
    "LeaderboardHeroBlock": {"font-family", "font-size", "font-weight", "text-align", "color"},
    "LeaderboardListBlock": {"font-family", "text-align", "color", "background-color", "padding", "border-radius"},
    "RankingHeroBlock": {"font-family", "font-size", "font-weight", "text-align", "color"},
    "RankingDetailsBlock": {"font-family", "font-size", "font-weight", "color", "background-color", "border-color", "padding", "gap", "border-radius"},
    "ToolsHeaderBlock": {"font-family", "font-size", "font-weight", "color", "gap"},
    "ToolsGridBlock": {"font-family", "font-size", "font-weight", "color", "line-height", "background-color", "border-color", "padding", "gap", "border-radius"},
    "GroupsHeaderBlock": {"color"},
    "GroupsHeroBlock": {"font-size", "font-weight", "color", "line-height", "background-color", "border-color", "padding", "gap"},
    "ContentCardSkeleton": {"background-color", "border-color", "padding", "gap", "border-radius"},
    "CardSkeleton": {"background-color", "border-color", "padding", "gap", "border-radius"},
    "ListSkeleton": {"background-color", "border-color", "padding", "gap", "border-radius"},
    "ProfileSkeleton": {"gap", "border-radius"},
    "TextSkeleton": {"border-radius"},
    "PageSkeleton": {"padding", "border-radius"},
    "EmptyState": {"font-family", "font-size", "font-weight", "text-align", "color", "line-height", "background-color", "padding", "border-radius"},
    "ImageUpload": {"font-family", "font-size", "font-weight", "text-align", "color", "letter-spacing", "line-height", "background-color", "border-color", "padding", "gap", "border-radius"},
    "InfoPopover": {"font-size", "color", "line-height", "background-color", "border-color", "padding", "border-radius"},
    "OptimizedImage": {"background-color"},
    "ScrollReveal": set(),
    "GrainOverlay": {"border-radius"},
    "HeroParticleCanvas": set(),
}


async def prune() -> None:
    engine = create_async_engine(DATABASE_URL)
    async with AsyncSession(engine) as session:
        updated = 0
        for comp_type, used_props in USED.items():
            for prop_name in ALL_PROPS:
                should_be_visible = prop_name in used_props
                rows = (
                    await session.execute(
                        select(ElementSchema).where(
                            ElementSchema.element_type == comp_type,
                            ElementSchema.property_name == prop_name,
                            ElementSchema.is_visible != should_be_visible,
                        )
                    )
                ).scalars().all()
                for row in rows:
                    row.is_visible = should_be_visible
                    updated += 1
        await session.commit()
        print(f"Pruned {updated} property visibility rows across {len(USED)} component types")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(prune())
