"""One-time seed: create ElementSchema rows for all known component types.

Reads the master list of data-rl-component values present in the frontend
codebase and inserts the 14 default properties for each component type into
the element_schemas table. Idempotent — skips rows that already exist,
safe to re-run.

Run once via: python -m app.services.seed_element_schemas
"""

import asyncio
import os

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.models.base import Base
from app.models.element_schema import ElementSchema

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./rootlink.db")

# All data-rl-component values in the frontend — 83 types.
# Includes original tagged components (49, after removing 6 skeletons + OptimizedImage)
# and 34 extracted card components (Phase 1-3).
COMPONENT_TYPES = [
    # ── Original tagged components (49) ──
    "Avatar", "Badge", "Button", "Card", "CardGridBlock",
    "CtaBlock", "DonateBalanceBlock", "DonateHeroBlock",
    "DonateHowItWorksBlock", "DonateLeaderboardBlock", "DonateTiersBlock",
    "EmptyState", "FilterPill", "GrainOverlay", "GroupsHeaderBlock",
    "GroupsHeroBlock", "HeroBlock", "HeroParticleCanvas", "HomeCategoriesBlock",
    "HomeCommunityBlock", "HomeCtaBlock", "HomeHeroBlock", "HomeRecentBlock",
    "HomeToolsBlock", "IconContainer", "ImageUpload", "InfoPopover", "Input",
    "LeaderboardHeroBlock", "LeaderboardListBlock", "LinkWithArrow",
    "PageHeader", "ProgressBar", "RankedListRow", "RankingDetailsBlock",
    "RankingHeroBlock", "ResultCard", "ScrollReveal", "Section",
    "SectionHeader", "Select", "SidebarWidget", "StatCounter", "Textarea",
    "TextBlock", "Toggle", "ToolsGridBlock", "ToolsHeaderBlock",
    "Tooltip",
    # ── Phase 1 — Listing page cards (11) ──
    "EventListCard", "MarketplaceListCard", "GroupListCard", "PlantListCard",
    "FeedItemCard", "NetworkUserCard", "ArticleListRow",
    "LearningCourseCard", "LearningEnrollmentCard", "LearningAllCourseCard",
    "LearningPathCard",
    # ── Phase 2 — Event detail cards (7) ──
    "EventScheduleItem", "EventAmenityCard", "EventSponsorCard",
    "EventDonationRow", "EventTicketCard", "EventAttendeeChip",
    "EventVendorRow",
    # ── Phase 2 — Profile cards (13) ──
    "ProfileGroupMiniCard", "ProfileContentCard", "ProfileEventRow",
    "ProfileGroupRow", "ProfileCourseRow", "ProfileListingRow",
    "ProfileSaleRow", "ProfilePurchaseRow", "ProfileTicketRow",
    "ProfileRsvpRow", "ProfileDonationRow", "ProfileEnrollmentRow",
    "ProfileCommentRow",
    # ── Phase 3 — Minor page cards (3) ──
    "MarketplaceSellerCard", "GroupMemberChip", "PopularContentCard",
]

# Default properties for every component type — matches the overlay
# inspector's constrained-controls fallback (14 properties total).
DEFAULT_PROPERTIES = [
    # Text properties
    {
        "property_name": "font-family",
        "property_type": "extrinsic",
        "control_type": "font-family",
        "options": None,
    },
    {
        "property_name": "font-size",
        "property_type": "extrinsic",
        "control_type": "type-scale",
        "options": None,
    },
    {
        "property_name": "font-weight",
        "property_type": "extrinsic",
        "control_type": "button-group",
        "options": [
            {"value": "300", "label": "Light"},
            {"value": "400", "label": "Regular"},
            {"value": "500", "label": "Medium"},
            {"value": "600", "label": "Semi"},
            {"value": "700", "label": "Bold"},
        ],
    },
    {
        "property_name": "font-style",
        "property_type": "extrinsic",
        "control_type": "button-group",
        "options": [
            {"value": "normal", "label": "Normal"},
            {"value": "italic", "label": "Italic"},
        ],
    },
    {
        "property_name": "text-align",
        "property_type": "extrinsic",
        "control_type": "button-group",
        "options": [
            {"value": "left", "label": "Left"},
            {"value": "center", "label": "Center"},
            {"value": "right", "label": "Right"},
        ],
    },
    {
        "property_name": "color",
        "property_type": "extrinsic",
        "control_type": "palette",
        "options": None,
    },
    {
        "property_name": "text-decoration",
        "property_type": "extrinsic",
        "control_type": "button-group",
        "options": [
            {"value": "none", "label": "None"},
            {"value": "underline", "label": "Underline"},
        ],
    },
    {
        "property_name": "letter-spacing",
        "property_type": "extrinsic",
        "control_type": "slider",
        "options": None,
    },
    {
        "property_name": "line-height",
        "property_type": "extrinsic",
        "control_type": "slider",
        "options": None,
    },
    # Block (container) properties
    {
        "property_name": "background-color",
        "property_type": "extrinsic",
        "control_type": "palette",
        "options": None,
    },
    {
        "property_name": "border-color",
        "property_type": "extrinsic",
        "control_type": "palette",
        "options": None,
    },
    {
        "property_name": "padding",
        "property_type": "extrinsic",
        "control_type": "slider",
        "options": None,
    },
    {
        "property_name": "gap",
        "property_type": "extrinsic",
        "control_type": "slider",
        "options": None,
    },
    {
        "property_name": "border-radius",
        "property_type": "extrinsic",
        "control_type": "slider",
        "options": None,
    },
]


async def seed() -> None:
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSession(engine) as session:
        added = 0
        for comp_type in COMPONENT_TYPES:
            for prop in DEFAULT_PROPERTIES:
                existing = await session.scalar(
                    select(ElementSchema).where(
                        ElementSchema.element_type == comp_type,
                        ElementSchema.property_name == prop["property_name"],
                    )
                )
                if existing is None:
                    session.add(
                        ElementSchema(
                            element_type=comp_type,
                            property_name=prop["property_name"],
                            property_type=prop["property_type"],
                            control_type=prop["control_type"],
                            options=prop["options"],
                            is_visible=True,
                        )
                    )
                    added += 1
        await session.commit()
        print(f"Element schema seed complete: {added} new rows ({len(COMPONENT_TYPES)} types × {len(DEFAULT_PROPERTIES)} properties)")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
