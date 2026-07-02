"""Seeds the three legal documents (Privacidade / Termos / Legal) idempotently.

Mirrors the content originally drafted in
`frontend/content/legal/{privacidade,termos,legal}.ts` (kept there only as an
offline fallback now that the DB is the source of truth — see
`app/api/legal.py`). Only inserts a row when its `slug` doesn't exist yet, so
re-running this on every startup never clobbers edits made through the admin
panel.

Seeded as already "published" (draft == published_snapshot) so the pages that
were already live before this admin UI existed keep showing the exact same
text — nothing regresses. The next edit + Publish from `/admin/legal` moves
the version forward from there.
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.legal_document import LegalDocument


def _p(text: str) -> dict:
    return {"type": "p", "text": text}


def _ul(items: list[str]) -> dict:
    return {"type": "ul", "items": items}


def _section(id: str, heading: str, blocks: list[dict]) -> dict:
    return {"id": id, "heading": heading, "blocks": blocks}


_TODAY = "2026-07-02"

_PRIVACIDADE = {
    "title": "Política de Privacidade",
    "description": "Como o RootLink recolhe, usa, partilha e protege os seus dados pessoais.",
    "intro": [
        "O RootLink é uma plataforma de comunidade para jardineiros, produtores, artesãos, "
        "profissionais e famílias. Esta política explica, de forma simples e honesta, que dados "
        "pessoais recolhemos, para quê, com quem os partilhamos e quais os seus direitos.",
        "Este documento é um rascunho em desenvolvimento (ver aviso no topo da página) e reflete "
        "o funcionamento real da plataforma tal como existe hoje — não promessas futuras.",
    ],
    "sections": [
        _section("responsavel", "1. Quem é o responsável pelo tratamento dos seus dados", [
            _p(
                "O RootLink é, neste momento, um projeto independente ainda não constituído como "
                "empresa, associação ou ONG. O responsável pelo tratamento dos seus dados pessoais "
                "é Rui Silva, através do contacto abaixo."
            ),
            _ul([
                "Contacto: rui.fc.silva@proton.me",
                "Serviço disponibilizado atualmente em rootlink.ruisilvastudio.com (domínio provisório, sujeito a alteração)",
            ]),
        ]),
        _section("dados-recolhidos", "2. Que dados pessoais recolhemos", [
            _p("Recolhemos apenas os dados necessários para o funcionamento da plataforma:"),
            _ul([
                "Conta e perfil: nome, email, palavra-passe (armazenada de forma cifrada, nunca em texto simples), biografia, idioma preferido, fotografia de perfil.",
                "Localização: a sua localização aproximada (cidade/região) pode ser visível a outros utilizadores caso ative essa opção; as suas coordenadas exatas são privadas e nunca mostradas a terceiros, apenas usadas para funcionalidades como \"perto de mim\".",
                "Contas profissionais e de organização: dados adicionais fornecidos voluntariamente, como tipo de entidade, número de registo/NIF, área de serviço, certificações.",
                "Conteúdo que publica: artigos, comentários, avaliações, anúncios de mercado, eventos, projetos de reaproveitamento, e as imagens que carrega para esse conteúdo.",
                "Mensagens privadas trocadas com outros utilizadores através do sistema de mensagens do RootLink.",
                "Dados de transações: ao usar o mercado, doações ou bilhetes de eventos, guardamos identificadores de transação e estado do pagamento (ex.: pago/pendente/reembolsado). Não guardamos números de cartão — os pagamentos são processados diretamente pelo Stripe (e, futuramente, pela Liberapay).",
                "Dados técnicos mínimos: um token de sessão (JWT) guardado localmente no seu dispositivo (localStorage) para o manter autenticado. Não usamos cookies de rastreio nem ferramentas de análise/publicidade de terceiros.",
            ]),
        ]),
        _section("nao-recolhemos", "3. O que não recolhemos", [
            _p("É tão importante dizer o que não fazemos como o que fazemos:"),
            _ul([
                "Não usamos cookies de rastreio, pixels publicitários ou ferramentas de análise de comportamento (ex.: Google Analytics).",
                "Não pedimos nem guardamos documentos de identificação, dados biométricos ou dados de saúde.",
                "Não recolhemos o seu número de telefone pessoal (apenas contactos opcionais fornecidos por organizadores de eventos, indicados por eles próprios).",
                "Removemos automaticamente os metadados de localização (EXIF/GPS) de todas as fotografias que carrega, para evitar revelar acidentalmente a localização da sua casa.",
                "Não vendemos nem partilhamos os seus dados para efeitos de publicidade.",
            ]),
        ]),
        _section("finalidades", "4. Para que usamos os seus dados", [
            _ul([
                "Para criar e gerir a sua conta e autenticação.",
                "Para lhe mostrar conteúdo, pessoas e iniciativas relevantes perto de si.",
                "Para processar pagamentos, doações e bilhetes através dos nossos parceiros de pagamento.",
                "Para moderar conteúdo e manter a comunidade segura (incluindo um registo de auditoria das ações de moderação).",
                "Para cumprir obrigações legais quando aplicável.",
            ]),
            _p(
                "O fundamento legal para estes tratamentos é, consoante o caso, a execução do "
                "contrato consigo (os Termos de Utilização), o nosso interesse legítimo em manter "
                "a plataforma funcional e segura, ou o seu consentimento explícito (por exemplo, "
                "ao tornar a sua localização pública)."
            ),
        ]),
        _section("partilha", "5. Com quem partilhamos os seus dados", [
            _p(
                "Não vendemos os seus dados. Partilhamos apenas o estritamente necessário com os "
                "seguintes prestadores de serviço, que atuam como subcontratantes:"
            ),
            _ul([
                "Stripe — processamento de pagamentos, doações e subcontas de vendedores do mercado. O Stripe nunca nos dá acesso aos dados completos do seu cartão.",
                "Liberapay — meio de doação recorrente em preparação; ainda não está ativo em produção.",
                "Cloudflare — rede de distribuição de conteúdo (CDN) e proteção usada à frente do nosso servidor, para acelerar e proteger o acesso à plataforma.",
                "Vercel — aloja a interface (frontend) do RootLink.",
            ]),
            _p(
                "Podemos também divulgar dados quando exigido por lei ou para proteger os direitos, "
                "segurança e propriedade do RootLink e dos seus utilizadores."
            ),
        ]),
        _section("armazenamento", "6. Onde e como guardamos os seus dados", [
            _p(
                "O backend do RootLink corre num servidor próprio, com a interface alojada na "
                "Vercel e o tráfego protegido pela Cloudflare. Alguns destes prestadores podem "
                "processar dados fora do Espaço Económico Europeu, sujeitos às garantias "
                "contratuais exigidas pelo RGPD (ex.: cláusulas contratuais-tipo). Esta secção "
                "será revista e detalhada com apoio jurídico antes da publicação final desta "
                "política."
            ),
        ]),
        _section("conservacao", "7. Durante quanto tempo guardamos os seus dados", [
            _p(
                "Ainda não temos prazos de conservação fixos definidos para cada tipo de dado — "
                "este é um ponto identificado como pendente e que será resolvido antes da "
                "publicação oficial desta política. Hoje, a prática é a seguinte:"
            ),
            _ul([
                "Os dados da sua conta e do conteúdo que publica são mantidos enquanto a sua conta estiver ativa.",
                "Quando elimina a sua conta, dados de envolvimento pessoal (comentários, avaliações, marcadores, notificações, participação em grupos) são apagados de forma definitiva.",
                "O conteúdo que autorou (artigos, anúncios, eventos) é mantido mas desassociado da sua identidade (anonimizado), para preservar o valor coletivo desse conteúdo para a comunidade.",
                "Mantemos um registo de auditoria de ações de moderação por motivos de responsabilização e conformidade legal.",
            ]),
        ]),
        _section("direitos", "8. Os seus direitos (RGPD)", [
            _p("Ao abrigo do Regulamento Geral sobre a Proteção de Dados, tem direito a:"),
            _ul([
                "Aceder e exportar os seus dados — disponível diretamente na plataforma, no seu perfil, incluindo o seu perfil, conteúdo publicado, comentários e avaliações. (Nota: esta exportação ainda não inclui mensagens, encomendas do mercado ou bilhetes/doações de eventos — estamos a trabalhar para alargar este âmbito.)",
                "Retificar os seus dados — pode editar o seu perfil a qualquer momento.",
                "Apagar a sua conta — disponível no seu perfil; ver secção 7 sobre o que acontece a conteúdo autorado.",
                "Opor-se ou limitar certos tratamentos, e retirar consentimentos dados anteriormente.",
                "Apresentar reclamação junto da Comissão Nacional de Proteção de Dados (CNPD), a autoridade de controlo em Portugal — www.cnpd.pt.",
            ]),
            _p(
                "Para exercer qualquer um destes direitos que não esteja disponível diretamente na "
                "plataforma, contacte-nos através de rui.fc.silva@proton.me."
            ),
        ]),
        _section("seguranca", "9. Segurança", [
            _ul([
                "As palavras-passe são guardadas de forma cifrada, nunca em texto simples.",
                "As comunicações com a plataforma são feitas via HTTPS.",
                "Os metadados de localização são removidos das fotografias carregadas.",
                "Nenhum sistema é 100% seguro; se identificar uma vulnerabilidade, agradecemos que nos contacte de forma responsável (ver SECURITY.md do projeto).",
            ]),
        ]),
        _section("menores", "10. Menores de idade", [
            _p(
                "O RootLink destina-se a pessoas com 16 anos ou mais. Não recolhemos "
                "intencionalmente dados de pessoas com menos de 16 anos. Se tomarmos "
                "conhecimento de que recolhemos dados de um menor de 16 anos sem o devido "
                "consentimento, iremos eliminá-los assim que possível."
            ),
        ]),
        _section("alteracoes", "11. Alterações a esta política", [
            _p(
                "Podemos atualizar esta política à medida que a plataforma evolui. Alterações "
                "materiais serão indicadas através de uma nova data de \"última atualização\" e de "
                "uma entrada no histórico de alterações no final desta página. Sempre que "
                "razoavelmente possível, avisaremos com antecedência antes de alterações "
                "significativas entrarem em vigor."
            ),
        ]),
        _section("contacto", "12. Contacto", [
            _p(
                "Para qualquer questão sobre esta política ou sobre os seus dados pessoais, "
                "contacte-nos em rui.fc.silva@proton.me."
            ),
        ]),
    ],
    "version": "0.1",
    "effective_date": _TODAY,
    "changelog": [
        {"date": _TODAY, "version": "0.1", "summary": "Primeiro rascunho, para revisão interna e jurídica. Ainda não publicado."},
    ],
}

_TERMOS = {
    "title": "Termos de Utilização",
    "description": "As regras que regem o uso do RootLink por si e por todos os membros da comunidade.",
    "intro": [
        "Estes Termos de Utilização regulam o acesso e uso do RootLink. Ao criar uma conta ou "
        "usar a plataforma, está a concordar com estes termos.",
        "Este documento é um rascunho em desenvolvimento (ver aviso no topo da página) e será "
        "revisto com apoio jurídico antes de ser publicado oficialmente.",
    ],
    "sections": [
        _section("aceitacao", "1. Aceitação dos termos", [
            _p(
                "Ao aceder ou usar o RootLink, concorda em ficar vinculado a estes Termos de "
                "Utilização e à nossa Política de Privacidade. Se não concordar, não deve usar a "
                "plataforma."
            ),
        ]),
        _section("quem-pode-usar", "2. Quem pode usar o RootLink", [
            _p(
                "Tem de ter pelo menos 16 anos para criar uma conta no RootLink. Ao criar uma "
                "conta, declara e garante que cumpre este requisito de idade."
            ),
            _p(
                "O RootLink suporta diferentes tipos de conta: utilizadores individuais, "
                "profissionais e organizações. Cada tipo de conta pode ter campos e "
                "funcionalidades adicionais, mas todos estão sujeitos a estes Termos."
            ),
        ]),
        _section("conta", "3. A sua conta", [
            _ul([
                "É responsável por manter a confidencialidade da sua palavra-passe e por toda a atividade realizada através da sua conta.",
                "Deve fornecer informação verdadeira e mantê-la atualizada.",
                "Deve notificar-nos imediatamente se suspeitar de uso não autorizado da sua conta.",
            ]),
        ]),
        _section("conteudo", "4. Conteúdo que publica", [
            _p(
                "Mantém a propriedade sobre o conteúdo que publica no RootLink (artigos, "
                "comentários, avaliações, anúncios, imagens, eventos, projetos). Ao publicar, "
                "concede ao RootLink uma licença não exclusiva, mundial e gratuita para "
                "armazenar, apresentar e distribuir esse conteúdo dentro da plataforma, com o "
                "único propósito de operar o serviço."
            ),
            _p(
                "É inteiramente responsável pelo conteúdo que publica, incluindo a sua legalidade, "
                "veracidade e o facto de não infringir direitos de terceiros."
            ),
        ]),
        _section("regras-comunidade", "5. Regras da comunidade e moderação", [
            _p(
                "Espera-se que todos os membros sigam o nosso Código de Conduta. Não é permitido "
                "publicar conteúdo ilegal, assediador, discriminatório, enganoso ou que viole "
                "direitos de terceiros."
            ),
            _p(
                "Reservamo-nos o direito de rever, rejeitar ou remover conteúdo, e de suspender ou "
                "banir contas que violem estas regras. As decisões de moderação ficam registadas "
                "para efeitos de responsabilização, e pode pedir revisão de uma decisão de "
                "moderação através do contacto indicado abaixo."
            ),
        ]),
        _section("mercado-doacoes", "6. Mercado, eventos, doações e pagamentos", [
            _p(
                "O RootLink disponibiliza funcionalidades de mercado (venda de produtos e "
                "serviços entre membros), bilhetes de eventos e doações. Os pagamentos são "
                "processados por prestadores externos (atualmente Stripe; futuramente também "
                "Liberapay) — o RootLink nunca tem acesso aos dados completos do seu cartão."
            ),
            _p(
                "Nas transações entre membros (por exemplo, compra e venda no mercado), o "
                "RootLink atua como intermediário técnico e não é parte no contrato entre "
                "comprador e vendedor, salvo indicação em contrário."
            ),
            _p(
                "Para usar a funcionalidade de doações associada a iniciativas, eventos ou "
                "organizações, a entidade responsável deve ser identificável e aceitar "
                "responsabilidade pela utilização correta dos fundos recebidos, e concordar "
                "expressamente com estas regras."
            ),
        ]),
        _section("propriedade-intelectual", "7. Propriedade intelectual do RootLink", [
            _p(
                "O nome, logótipo, design e código do RootLink pertencem ao RootLink (ou aos seus "
                "licenciadores) e são protegidos pelas leis de propriedade intelectual "
                "aplicáveis. Estes Termos não lhe concedem qualquer direito sobre essa "
                "propriedade, salvo o necessário para usar a plataforma normalmente."
            ),
        ]),
        _section("isencao-garantias", "8. Isenção de garantias e limitação de responsabilidade", [
            _p(
                "O RootLink é um projeto em desenvolvimento ativo (fase beta), disponibilizado "
                "\"tal como está\" e \"conforme disponível\", sem garantias de qualquer tipo, "
                "expressas ou implícitas, quanto à disponibilidade contínua, ausência de erros ou "
                "adequação a um fim específico."
            ),
            _p(
                "Na máxima medida permitida por lei, o RootLink não será responsável por danos "
                "indiretos, incidentais ou consequenciais resultantes do uso ou impossibilidade de "
                "uso da plataforma, incluindo perdas decorrentes de transações entre utilizadores."
            ),
        ]),
        _section("suspensao", "9. Suspensão e cessação", [
            _p(
                "Pode eliminar a sua conta a qualquer momento através do seu perfil. Podemos "
                "suspender ou terminar o seu acesso caso viole estes Termos ou o Código de "
                "Conduta, tentando sempre, sempre que razoável, notificá-lo e permitir-lhe "
                "recurso da decisão."
            ),
        ]),
        _section("alteracoes", "10. Alterações a estes termos", [
            _p(
                "Podemos atualizar estes Termos à medida que a plataforma evolui. Alterações "
                "materiais serão indicadas através de uma nova data de \"última atualização\" e de "
                "uma entrada no histórico de alterações no final desta página. Sempre que "
                "razoavelmente possível, avisaremos com antecedência antes de alterações "
                "significativas entrarem em vigor, e o uso continuado da plataforma após essa "
                "data constitui aceitação dos novos termos."
            ),
        ]),
        _section("lei-aplicavel", "11. Lei aplicável e resolução de litígios", [
            _p(
                "Estes Termos regem-se pela lei portuguesa e pelo Regulamento Geral sobre a "
                "Proteção de Dados (RGPD), sem prejuízo de normas de proteção do consumidor que "
                "lhe sejam aplicáveis no seu país de residência."
            ),
            _p(
                "Se for consumidor residente na União Europeia, pode também recorrer à plataforma "
                "europeia de Resolução de Litígios em Linha (ODR): ec.europa.eu/consumers/odr."
            ),
        ]),
        _section("contacto", "12. Contacto", [
            _p("Para qualquer questão sobre estes Termos, contacte-nos em rui.fc.silva@proton.me."),
        ]),
    ],
    "version": "0.1",
    "effective_date": _TODAY,
    "changelog": [
        {"date": _TODAY, "version": "0.1", "summary": "Primeiro rascunho, para revisão interna e jurídica. Ainda não publicado."},
    ],
}

_LEGAL = {
    "title": "Aviso Legal",
    "description": "Identificação do responsável pelo RootLink, alojamento e informação legal obrigatória.",
    "intro": [
        "Este Aviso Legal identifica quem está por detrás do RootLink e complementa a Política "
        "de Privacidade e os Termos de Utilização.",
        "Este documento é um rascunho em desenvolvimento (ver aviso no topo da página) e será "
        "revisto com apoio jurídico antes de ser publicado oficialmente.",
    ],
    "sections": [
        _section("identificacao", "1. Identificação do responsável", [
            _p(
                "O RootLink é, neste momento, um projeto independente, ainda não constituído "
                "como empresa, associação ou ONG. É responsável pelo projeto:"
            ),
            _ul([
                "Responsável: Rui Silva",
                "Contacto: rui.fc.silva@proton.me",
                "Serviço disponibilizado atualmente em rootlink.ruisilvastudio.com (domínio provisório e sujeito a alteração; qualquer outro domínio associado ao projeto que não este é apenas para fins de teste/desenvolvimento)",
            ]),
            _p(
                "Este aviso será atualizado com o nome, número de identificação fiscal/registo e "
                "morada de uma entidade legalmente constituída, caso e quando o RootLink venha a "
                "ser formalmente registado (por exemplo, como associação ou empresa)."
            ),
        ]),
        _section("natureza", "2. Natureza do projeto", [
            _p(
                "O RootLink encontra-se em fase inicial de desenvolvimento ativo. Referências "
                "informais ao RootLink como iniciativa \"comunitária\" ou de cariz social descrevem "
                "a sua missão e não devem ser interpretadas como uma afirmação de um estatuto "
                "legal específico (por exemplo, ONG registada) enquanto esse registo não existir "
                "formalmente."
            ),
        ]),
        _section("alojamento", "3. Alojamento", [
            _ul([
                "Interface (frontend): alojada na Vercel Inc.",
                "Servidor de backend: infraestrutura própria, com o tráfego protegido pela Cloudflare (rede de distribuição de conteúdo e segurança).",
            ]),
        ]),
        _section("propriedade-intelectual", "4. Propriedade intelectual", [
            _p(
                "O nome \"RootLink\", o logótipo, o design visual e o código-fonte da plataforma "
                "são protegidos pelas leis de propriedade intelectual aplicáveis. O conteúdo "
                "publicado por utilizadores permanece propriedade dos respetivos autores, nos "
                "termos descritos nos Termos de Utilização."
            ),
        ]),
        _section("links-terceiros", "5. Ligações a sites de terceiros", [
            _p(
                "O RootLink pode agregar ou apresentar ligações a conteúdo de terceiros (por "
                "exemplo, feeds RSS de fontes externas na secção de conteúdos). Não somos "
                "responsáveis pelo conteúdo, políticas de privacidade ou práticas de sites de "
                "terceiros a que possa aceder através da plataforma."
            ),
        ]),
        _section("reclamacoes", "6. Reclamações e resolução de litígios", [
            _p(
                "Para qualquer reclamação relacionada com o RootLink, contacte-nos primeiro "
                "através de rui.fc.silva@proton.me — teremos todo o gosto em tentar resolver a "
                "questão diretamente."
            ),
            _p(
                "Se for consumidor residente na União Europeia, pode também recorrer à plataforma "
                "europeia de Resolução de Litígios em Linha (ODR): ec.europa.eu/consumers/odr."
            ),
            _p(
                "Para questões relacionadas especificamente com proteção de dados pessoais, pode "
                "contactar a Comissão Nacional de Proteção de Dados (CNPD) — www.cnpd.pt."
            ),
        ]),
        _section("alteracoes", "7. Alterações a este aviso", [
            _p(
                "Este aviso pode ser atualizado à medida que o projeto evolui, nomeadamente se e "
                "quando for constituída uma entidade legal formal. Alterações materiais serão "
                "indicadas através de uma nova data de \"última atualização\" e de uma entrada no "
                "histórico de alterações no final desta página."
            ),
        ]),
    ],
    "version": "0.1",
    "effective_date": _TODAY,
    "changelog": [
        {"date": _TODAY, "version": "0.1", "summary": "Primeiro rascunho, para revisão interna e jurídica. Ainda não publicado."},
    ],
}

SEED_DOCS: dict[str, dict] = {
    "privacidade": _PRIVACIDADE,
    "termos": _TERMOS,
    "legal": _LEGAL,
}


async def seed_legal_documents(db: AsyncSession) -> None:
    for slug, data in SEED_DOCS.items():
        existing = await db.scalar(select(LegalDocument).where(LegalDocument.slug == slug))
        if existing:
            continue
        snapshot = {
            "title": data["title"],
            "description": data["description"],
            "intro": data["intro"],
            "sections": data["sections"],
            "version": data["version"],
            "effective_date": data["effective_date"],
        }
        db.add(LegalDocument(
            slug=slug,
            title=data["title"],
            description=data["description"],
            intro=data["intro"],
            sections=data["sections"],
            version=data["version"],
            effective_date=data["effective_date"],
            published_snapshot=snapshot,
            published_at=datetime.now(UTC),
            changelog=data["changelog"],
        ))
    await db.commit()
