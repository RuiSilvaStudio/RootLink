from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class TaxonomyFamily(TimestampMixin, Base):
    __tablename__ = "taxonomy_families"

    id: Mapped[int] = mapped_column(primary_key=True)
    value: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    label: Mapped[str] = mapped_column(String(100))
    label_pt: Mapped[str] = mapped_column(String(100))
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class TaxonomyCategory(TimestampMixin, Base):
    __tablename__ = "taxonomy_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("taxonomy_families.id", ondelete="CASCADE"), index=True)
    value: Mapped[str] = mapped_column(String(50), index=True)
    label: Mapped[str] = mapped_column(String(100))
    label_pt: Mapped[str] = mapped_column(String(100))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


SEED_FAMILIES = [
    {"value": "agricultura", "label": "Agriculture", "label_pt": "Agricultura", "icon": "Sprout", "sort_order": 1},
    {"value": "pecuaria", "label": "Livestock", "label_pt": "Pecuária", "icon": "Bird", "sort_order": 2},
    {"value": "jardinagem", "label": "Gardening", "label_pt": "Jardinagem", "icon": "Flower", "sort_order": 3},
    {"value": "carpintaria_construcao", "label": "Carpentry & Construction", "label_pt": "Carpintaria & Construção", "icon": "TreePine", "sort_order": 4},
    {"value": "artesanato_oficios", "label": "Crafts & Trades", "label_pt": "Artesanato & Ofícios", "icon": "Wrench", "sort_order": 5},
    {"value": "auto_suficiencia", "label": "Self-Sufficiency", "label_pt": "Auto-suficiência", "icon": "Home", "sort_order": 6},
    {"value": "economia_circular", "label": "Circular Economy", "label_pt": "Economia Circular", "icon": "RefreshCw", "sort_order": 7},
    {"value": "gestao_residuos", "label": "Waste Management", "label_pt": "Gestão de Resíduos", "icon": "Trash2", "sort_order": 8},
    {"value": "saude_bem_estar", "label": "Health & Well-being", "label_pt": "Saúde & Bem-Estar", "icon": "HeartPulse", "sort_order": 9},
    {"value": "energia_renovavel", "label": "Renewable Energy", "label_pt": "Energia Renovável", "icon": "Zap", "sort_order": 10},
    {"value": "economia_social", "label": "Social Economy", "label_pt": "Economia Social", "icon": "Handshake", "sort_order": 11},
]

SEED_CATEGORIES = [
    # Agricultura
    {"family": "agricultura", "value": "horticultura", "label": "Horticulture", "label_pt": "Horticultura", "sort_order": 1},
    {"family": "agricultura", "value": "fruticultura", "label": "Fruit Growing", "label_pt": "Fruticultura", "sort_order": 2},
    {"family": "agricultura", "value": "permacultura", "label": "Permaculture", "label_pt": "Permacultura", "sort_order": 3},
    {"family": "agricultura", "value": "agricultura_regenerativa", "label": "Regenerative Agriculture", "label_pt": "Agricultura Regenerativa", "sort_order": 4},
    {"family": "agricultura", "value": "agricultura_biodinamica", "label": "Biodynamic Agriculture", "label_pt": "Agricultura Biodinâmica", "sort_order": 5},
    # Pecuária
    {"family": "pecuaria", "value": "apicultura", "label": "Beekeeping", "label_pt": "Apicultura", "sort_order": 1},
    {"family": "pecuaria", "value": "avicultura", "label": "Poultry Farming", "label_pt": "Avicultura", "sort_order": 2},
    {"family": "pecuaria", "value": "caprinocultura", "label": "Goat Farming", "label_pt": "Caprinocultura", "sort_order": 3},
    {"family": "pecuaria", "value": "ovinocultura", "label": "Sheep Farming", "label_pt": "Ovinocultura", "sort_order": 4},
    {"family": "pecuaria", "value": "bovinocultura", "label": "Cattle Farming", "label_pt": "Bovinocultura", "sort_order": 5},
    {"family": "pecuaria", "value": "suinocultura", "label": "Pig Farming", "label_pt": "Suinocultura", "sort_order": 6},
    {"family": "pecuaria", "value": "equinocultura", "label": "Horse Breeding", "label_pt": "Equinocultura", "sort_order": 7},
    {"family": "pecuaria", "value": "cunicultura", "label": "Rabbit Farming", "label_pt": "Cunicultura", "sort_order": 8},
    # Jardinagem
    {"family": "jardinagem", "value": "jardinagem_ornamental", "label": "Ornamental Gardening", "label_pt": "Jardinagem Ornamental", "sort_order": 1},
    {"family": "jardinagem", "value": "jardins_alimentares", "label": "Food Gardens", "label_pt": "Jardins Alimentares", "sort_order": 2},
    {"family": "jardinagem", "value": "paisagismo", "label": "Landscaping", "label_pt": "Paisagismo", "sort_order": 3},
    {"family": "jardinagem", "value": "jardinagem_sustentavel", "label": "Sustainable Gardening", "label_pt": "Jardinagem Sustentável", "sort_order": 4},
    # Carpintaria & Construção
    {"family": "carpintaria_construcao", "value": "carpintaria", "label": "Carpentry", "label_pt": "Carpintaria", "sort_order": 1},
    {"family": "carpintaria_construcao", "value": "marcenaria", "label": "Woodworking", "label_pt": "Marcenaria", "sort_order": 2},
    {"family": "carpintaria_construcao", "value": "bioconstrucao", "label": "Bioconstruction", "label_pt": "Bioconstrução", "sort_order": 3},
    {"family": "carpintaria_construcao", "value": "construcao_natural", "label": "Natural Building", "label_pt": "Construção Natural", "sort_order": 4},
    # Artesanato & Ofícios
    {"family": "artesanato_oficios", "value": "ceramica", "label": "Ceramics", "label_pt": "Cerâmica", "sort_order": 1},
    {"family": "artesanato_oficios", "value": "cestaria", "label": "Basketry", "label_pt": "Cestaria", "sort_order": 2},
    {"family": "artesanato_oficios", "value": "texteis", "label": "Textiles", "label_pt": "Têxteis", "sort_order": 3},
    {"family": "artesanato_oficios", "value": "couro", "label": "Leatherwork", "label_pt": "Couro", "sort_order": 4},
    {"family": "artesanato_oficios", "value": "metalurgia", "label": "Metalwork", "label_pt": "Metalurgia", "sort_order": 5},
    # Auto-suficiência
    {"family": "auto_suficiencia", "value": "conservacao_alimentar", "label": "Food Preservation", "label_pt": "Conservação Alimentar", "sort_order": 1},
    {"family": "auto_suficiencia", "value": "fermentacao", "label": "Fermentation", "label_pt": "Fermentação", "sort_order": 2},
    {"family": "auto_suficiencia", "value": "energia_renovavel", "label": "Renewable Energy", "label_pt": "Energia Renovável", "sort_order": 3},
    {"family": "auto_suficiencia", "value": "gestao_agua", "label": "Water Management", "label_pt": "Gestão de Água", "sort_order": 4},
    {"family": "auto_suficiencia", "value": "gestao_residuos", "label": "Waste Management", "label_pt": "Gestão de Resíduos", "sort_order": 5},
    # Economia Circular
    {"family": "economia_circular", "value": "reparo_reuso", "label": "Repair & Reuse", "label_pt": "Reparo e Reuso", "sort_order": 1},
    {"family": "economia_circular", "value": "upcycling", "label": "Upcycling", "label_pt": "Upcycling", "sort_order": 2},
    {"family": "economia_circular", "value": "partilha_emprestimo", "label": "Sharing & Lending", "label_pt": "Partilha e Empréstimo", "sort_order": 3},
    {"family": "economia_circular", "value": "escambo_troca", "label": "Barter & Exchange", "label_pt": "Escambo e Troca", "sort_order": 4},
    {"family": "economia_circular", "value": "produtos_sustentaveis", "label": "Sustainable Products", "label_pt": "Produtos Sustentáveis", "sort_order": 5},
    # Gestão de Resíduos
    {"family": "gestao_residuos", "value": "compostagem_comunitaria", "label": "Community Composting", "label_pt": "Compostagem Comunitária", "sort_order": 1},
    {"family": "gestao_residuos", "value": "reciclagem", "label": "Recycling", "label_pt": "Reciclagem", "sort_order": 2},
    {"family": "gestao_residuos", "value": "reducao_residuos", "label": "Waste Reduction", "label_pt": "Redução de Resíduos", "sort_order": 3},
    {"family": "gestao_residuos", "value": "residuos_organicos", "label": "Organic Waste", "label_pt": "Resíduos Orgânicos", "sort_order": 4},
    {"family": "gestao_residuos", "value": "residuos_perigosos", "label": "Hazardous Waste", "label_pt": "Resíduos Perigosos", "sort_order": 5},
    # Saúde & Bem-Estar
    {"family": "saude_bem_estar", "value": "terapias_naturais", "label": "Natural Therapies", "label_pt": "Terapias Naturais", "sort_order": 1},
    {"family": "saude_bem_estar", "value": "slow_living", "label": "Slow Living", "label_pt": "Slow Living", "sort_order": 2},
    {"family": "saude_bem_estar", "value": "saude_mental", "label": "Mental Health", "label_pt": "Saúde Mental", "sort_order": 3},
    {"family": "saude_bem_estar", "value": "nutricao", "label": "Nutrition", "label_pt": "Nutrição", "sort_order": 4},
    {"family": "saude_bem_estar", "value": "bem_estar_fisico", "label": "Physical Wellness", "label_pt": "Bem-Estar Físico", "sort_order": 5},
    {"family": "saude_bem_estar", "value": "apoio_social", "label": "Social Support", "label_pt": "Apoio Social", "sort_order": 6},
    # Energia Renovável
    {"family": "energia_renovavel", "value": "energia_solar", "label": "Solar Energy", "label_pt": "Energia Solar", "sort_order": 1},
    {"family": "energia_renovavel", "value": "energia_eolica", "label": "Wind Energy", "label_pt": "Energia Eólica", "sort_order": 2},
    {"family": "energia_renovavel", "value": "energia_hidrica", "label": "Hydro Energy", "label_pt": "Energia Hídrica", "sort_order": 3},
    {"family": "energia_renovavel", "value": "biomassa", "label": "Biomass", "label_pt": "Biomassa", "sort_order": 4},
    {"family": "energia_renovavel", "value": "eficiencia_energetica", "label": "Energy Efficiency", "label_pt": "Eficiência Energética", "sort_order": 5},
    {"family": "energia_renovavel", "value": "cer_comunidade_energia", "label": "Community Energy (CER)", "label_pt": "Comunidade de Energia Renovável (CER)", "sort_order": 6},
    # Economia Social
    {"family": "economia_social", "value": "cooperativas", "label": "Cooperatives", "label_pt": "Cooperativas", "sort_order": 1},
    {"family": "economia_social", "value": "ajuda_mutua", "label": "Mutual Aid", "label_pt": "Ajuda Mútua", "sort_order": 2},
    {"family": "economia_social", "value": "projetos_comunitarios", "label": "Community Projects", "label_pt": "Projetos Comunitários", "sort_order": 3},
    {"family": "economia_social", "value": "gestao_sem_fins_lucrativos", "label": "Non-Profit Management", "label_pt": "Gestão Sem Fins Lucrativos", "sort_order": 4},
    {"family": "economia_social", "value": "voluntariado", "label": "Volunteering", "label_pt": "Voluntariado", "sort_order": 5},
]

# Maps old flat categories to new families (for backfill migration)
CATEGORY_TO_FAMILY_MAP = {
    "gardening": "jardinagem",
    "woodworking": "carpintaria_construcao",
    "craft_trades": "artesanato_oficios",
    "homesteading": "auto_suficiencia",
    "building": "carpintaria_construcao",
    "general": "auto_suficiencia",
}
