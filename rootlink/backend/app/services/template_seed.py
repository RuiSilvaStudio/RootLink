"""Starter long-form templates (CONTENT_PLATFORM.md §5.4).

Seeded idempotently on startup. Admins can edit/extend them via the
content-templates API; we only insert templates whose `key` is missing.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content_template import ContentTemplate


def _h(text: str, level: int = 2) -> dict:
    return {"type": "header", "data": {"text": text, "level": level}}


def _p(text: str = "") -> dict:
    return {"type": "paragraph", "data": {"text": text}}


def _list(items: list[str], style: str = "unordered") -> dict:
    return {"type": "list", "data": {"style": style, "items": items}}


STARTER_TEMPLATES: list[dict] = [
    {
        "key": "how_to",
        "label_en": "How-to / build log",
        "label_pt": "Tutorial / diário de construção",
        "description_en": "Step-by-step guide with materials and tips",
        "description_pt": "Guia passo-a-passo com materiais e dicas",
        "icon": "list-checks",
        "sort_order": 10,
        "body": {"blocks": [
            _h("What you'll make"),
            _p("A short description of the result and who it's for."),
            _h("Materials & tools"),
            _list(["Item 1", "Item 2", "Item 3"]),
            _h("Steps"),
            _list(["Step one", "Step two", "Step three"], "ordered"),
            _h("Tips & troubleshooting"),
            _p("Common mistakes and how to avoid them."),
        ]},
    },
    {
        "key": "plant_profile",
        "label_en": "Plant profile",
        "label_pt": "Ficha de planta",
        "description_en": "Care guide for a single plant or crop",
        "description_pt": "Guia de cuidados para uma planta ou cultura",
        "icon": "leaf",
        "sort_order": 20,
        "body": {"blocks": [
            _h("Overview"),
            _p("Common name, family and a one-line summary."),
            _h("Growing conditions"),
            _list(["Sun:", "Soil:", "Water:", "Hardiness:"]),
            _h("Sowing & harvest"),
            _p("When to sow, transplant and harvest."),
            _h("Pests & problems"),
            _p("What to watch for."),
        ]},
    },
    {
        "key": "recipe",
        "label_en": "Recipe",
        "label_pt": "Receita",
        "description_en": "Ingredients and method",
        "description_pt": "Ingredientes e preparação",
        "icon": "utensils",
        "sort_order": 30,
        "body": {"blocks": [
            _h("About this dish"),
            _p("A line or two about the result, servings and time."),
            _h("Ingredients"),
            _list(["", "", ""]),
            _h("Method"),
            _list(["", "", ""], "ordered"),
            _h("Notes"),
            _p("Substitutions and storage."),
        ]},
    },
    {
        "key": "project_journal",
        "label_en": "Project journal",
        "label_pt": "Diário de projeto",
        "description_en": "Document progress over time",
        "description_pt": "Documente o progresso ao longo do tempo",
        "icon": "notebook-pen",
        "sort_order": 40,
        "body": {"blocks": [
            _h("The project"),
            _p("Goal and starting point."),
            _h("Progress"),
            _p("Date — what you did, what worked, what didn't."),
            _h("Next steps"),
            _list(["", ""]),
        ]},
    },
    {
        "key": "comparison",
        "label_en": "Comparison / review",
        "label_pt": "Comparação / análise",
        "description_en": "Weigh options side by side",
        "description_pt": "Compare opções lado a lado",
        "icon": "scale",
        "sort_order": 50,
        "body": {"blocks": [
            _h("What we're comparing"),
            _p("The options and why it matters."),
            _h("Option A"),
            _list(["Pros:", "Cons:"]),
            _h("Option B"),
            _list(["Pros:", "Cons:"]),
            _h("Verdict"),
            _p("Which one, and for whom."),
        ]},
    },
    {
        "key": "blank",
        "label_en": "Blank",
        "label_pt": "Em branco",
        "description_en": "Start from scratch",
        "description_pt": "Começar do zero",
        "icon": "file",
        "sort_order": 99,
        "body": {"blocks": []},
    },
]


async def seed_content_templates(db: AsyncSession) -> int:
    """Insert any starter templates whose key is missing. Returns count inserted."""
    existing = set(
        (await db.execute(select(ContentTemplate.key).where(ContentTemplate.kind == "article"))).scalars().all()
    )
    inserted = 0
    for tpl in STARTER_TEMPLATES:
        if tpl["key"] in existing:
            continue
        db.add(ContentTemplate(kind="article", **tpl))
        inserted += 1
    if inserted:
        await db.commit()
    return inserted
