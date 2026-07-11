"""Idempotent seed for the Content Studio element catalog + font library.

Seeds all 83 component types (data-rl-component values from the frontend)
with their 14 default properties, and the default fonts (Fraunces, Source
Serif 4). Called from `app.main.lifespan()` after `Base.metadata.create_all`.

Per-component property visibility (is_visible) is set based on actual Tailwind
class usage — components that don't use a property (e.g. a Skeleton with no
text-align) have that property hidden from the inspector.

Idempotent: skips a schema row if (element_type, property_name) already exists,
and skips a font if its name already exists — so re-runs and a racing second
uvicorn worker (Dockerfile.prod runs `--workers 2`; the lifespan is
flock-serialized, see `app/main.py`) no-op. Existing rows' is_visible is
NOT changed by the seed — only new rows get the correct visibility. The
dashboard catalog page can toggle visibility manually after seeding.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.element_schema import ElementSchema
from app.models.font import Font

# ── 83 component types (data-rl-component values in the frontend) ──
_COMPONENT_TYPES = [
    # Original tagged components (49)
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
    # Phase 1 — Listing page cards (11)
    "EventListCard", "MarketplaceListCard", "GroupListCard", "PlantListCard",
    "FeedItemCard", "NetworkUserCard", "ArticleListRow",
    "LearningCourseCard", "LearningEnrollmentCard", "LearningAllCourseCard",
    "LearningPathCard",
    # Phase 2 — Event detail cards (7)
    "EventScheduleItem", "EventAmenityCard", "EventSponsorCard",
    "EventDonationRow", "EventTicketCard", "EventAttendeeChip",
    "EventVendorRow",
    # Phase 2 — Profile cards (13)
    "ProfileGroupMiniCard", "ProfileContentCard", "ProfileEventRow",
    "ProfileGroupRow", "ProfileCourseRow", "ProfileListingRow",
    "ProfileSaleRow", "ProfilePurchaseRow", "ProfileTicketRow",
    "ProfileRsvpRow", "ProfileDonationRow", "ProfileEnrollmentRow",
    "ProfileCommentRow",
    # Phase 3 — Minor page cards (3)
    "MarketplaceSellerCard", "GroupMemberChip", "PopularContentCard",
]

# ── 14 default properties for every component type ──
# Matches the overlay inspector's constrained-controls fallback.
_DEFAULT_PROPERTIES = [
    {"property_name": "font-family", "property_type": "extrinsic", "control_type": "font-family", "options": None},
    {"property_name": "font-size", "property_type": "extrinsic", "control_type": "type-scale", "options": None},
    {"property_name": "font-weight", "property_type": "extrinsic", "control_type": "button-group", "options": [
        {"value": "300", "label": "Light"}, {"value": "400", "label": "Regular"},
        {"value": "500", "label": "Medium"}, {"value": "600", "label": "Semi"},
        {"value": "700", "label": "Bold"}]},
    {"property_name": "font-style", "property_type": "extrinsic", "control_type": "button-group", "options": [
        {"value": "normal", "label": "Normal"}, {"value": "italic", "label": "Italic"}]},
    {"property_name": "text-align", "property_type": "extrinsic", "control_type": "button-group", "options": [
        {"value": "left", "label": "Left"}, {"value": "center", "label": "Center"},
        {"value": "right", "label": "Right"}, {"value": "justify", "label": "Justify"}]},
    {"property_name": "color", "property_type": "extrinsic", "control_type": "palette", "options": None},
    {"property_name": "text-decoration", "property_type": "extrinsic", "control_type": "button-group", "options": [
        {"value": "none", "label": "None"}, {"value": "underline", "label": "Underline"}]},
    {"property_name": "letter-spacing", "property_type": "extrinsic", "control_type": "slider", "options": None},
    {"property_name": "line-height", "property_type": "extrinsic", "control_type": "slider", "options": None},
    {"property_name": "background-color", "property_type": "extrinsic", "control_type": "palette", "options": None},
    {"property_name": "border-color", "property_type": "extrinsic", "control_type": "palette", "options": None},
    {"property_name": "padding", "property_type": "extrinsic", "control_type": "slider", "options": None},
    {"property_name": "gap", "property_type": "extrinsic", "control_type": "slider", "options": None},
    {"property_name": "border-radius", "property_type": "extrinsic", "control_type": "slider", "options": None},
]

# ── Per-component property visibility ──
# Derived from scanning each component's source code for matching Tailwind
# utility classes. Components that don't use a property have it hidden from
# the inspector. Card uses custom CSS classes (card-lift etc.) so has no
# visible properties. ScrollReveal and HeroParticleCanvas use none.
_USED: dict[str, set[str]] = {
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
    "EmptyState": {"font-family", "font-size", "font-weight", "text-align", "color", "line-height", "background-color", "padding", "border-radius"},
    "ImageUpload": {"font-family", "font-size", "font-weight", "text-align", "color", "letter-spacing", "line-height", "background-color", "border-color", "padding", "gap", "border-radius"},
    "InfoPopover": {"font-size", "color", "line-height", "background-color", "border-color", "padding", "border-radius"},
    "ScrollReveal": set(),
    "GrainOverlay": {"border-radius"},
    "HeroParticleCanvas": set(),
    # Phase 1-3 extracted cards — default to all properties visible (not pruned)
    # since their source was extracted from inline JSX that uses the same
    # Tailwind classes as the original pages.
}

# (name, family, url). `family` is the CSS font-family value (internal quotes
# + fallbacks included); `url` is the Google Fonts CSS URL the frontend injects.
_DEFAULT_FONTS: list[tuple[str, str, str]] = [
    ("Fraunces", '"Fraunces", Georgia, serif',
     "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..900&display=swap"),
    ("Source Serif 4", '"Source Serif 4", Georgia, serif',
     "https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,300..700&display=swap"),
]


async def seed_default_element_catalog(session: AsyncSession) -> None:
    """Seed all 83 component types + their properties + default fonts (idempotent).

    New rows get correct is_visible based on actual Tailwind class usage.
    Existing rows are not changed — visibility can be toggled in the dashboard.
    """
    for comp_type in _COMPONENT_TYPES:
        used_props = _USED.get(comp_type)
        for prop in _DEFAULT_PROPERTIES:
            existing = await session.scalar(
                select(ElementSchema).where(
                    ElementSchema.element_type == comp_type,
                    ElementSchema.property_name == prop["property_name"],
                )
            )
            if existing is None:
                # New row: set is_visible based on prune data.
                # If the component is in _USED, show only used props.
                # If not in _USED (e.g. Phase 1-3 extracted cards), show all.
                is_visible = True
                if used_props is not None:
                    is_visible = prop["property_name"] in used_props
                session.add(
                    ElementSchema(
                        element_type=comp_type,
                        property_name=prop["property_name"],
                        property_type=prop["property_type"],
                        control_type=prop["control_type"],
                        options=prop["options"],
                        is_visible=is_visible,
                    )
                )

    for name, family, url in _DEFAULT_FONTS:
        existing = await session.scalar(select(Font).where(Font.name == name))
        if existing is None:
            session.add(Font(name=name, family=family, url=url, is_active=True))

    await session.commit()
