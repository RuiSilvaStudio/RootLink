"""Authored anchor articles for the launch seed.

One "start here" piece per family (~15 total), written in Portuguese in
RootLink's own voice. These give each family section a platform-voice
anchor so the homepage isn't 100% external/crawled links on day 1.

RULE: no em-dashes. Use regular hyphens "-" or nothing. (The product owner
specifically asked to avoid em-dashes because they read as AI-generated.)

Each article has: title, summary, family, category, language, body (Editor.js
block JSON, same format as `services/template_seed.py`).
"""
from app.services.template_seed import _h, _list, _p

ANCHOR_ARTICLES: list[dict] = [
    # ── Agricultura (2) ──
    {
        "title": "Agricultura: por onde começar no RootLink",
        "summary": "Um guia de boas-vindas à secção de Agricultura. O que aqui "
                   "encontras, como participar e que temas cobrimos.",
        "family": "agricultura",
        "category": "horticultura",
        "language": "pt",
        "body": {"blocks": [
            _h("Bem-vindo à secção de Agricultura", 2),
            _p("Esta é a casa da horticultura, fruticultura, permacultura, "
               "agricultura regenerativa e biodinâmica. Reunimos artigos, "
               "guias e testemunhos de quem cultiva a terra em Portugal e "
               "no Mediterrâneo."),
            _h("O que aqui encontras", 2),
            _list([
                "Horticultura: culturas anuais, rotações, solos.",
                "Fruticultura: árvores e arbustos de fruto adaptados ao clima.",
                "Permacultura: princípios de design e sistemas integrados.",
                "Agricultura regenerativa: práticas que reconstruem o solo.",
                "Agricultura biodinâmica: calendário e preparados.",
            ]),
            _h("Como participar", 2),
            _p("Podes criar o teu próprio artigo, comentar e partilhar "
               "experiências. Antes de publicar pela primeira vez, lê o "
               "acordo de responsabilidade de autor. Para tópicos muito "
               "técnicos, começa por comentar artigos existentes e "
               "fazer perguntas."),
            _h("Por onde começar", 2),
            _p("Se tens um quintal pequeno, começa pela horticultura. "
               "Se já tens árvores, vai à fruticultura. Se queres "
               "pensar o sistema todo de uma vez, explora a permacultura."),
        ]},
    },
    {
        "title": "Cinco culturas para começar a horta em Portugal",
        "summary": "Cinco culturas robustas, adaptadas ao clima mediterrânico "
                   "e ao solo típico português. Ideais para principiantes.",
        "family": "agricultura",
        "category": "horticultura",
        "language": "pt",
        "body": {"blocks": [
            _h("Culturas que perdoam erros", 2),
            _p("Começar uma horta pode parecer complicado. Estas cinco "
               "culturas são tolerantes, dão colheitas rápidas e ensinam "
               "o básico sobre rega, solo e rotação."),
            _h("1. Favas", 2),
            _p("Leguminosa de Inverno. Fixa azoto no solo. Semeia-se em "
               "Outubro-Novembro no sul e em Fevereiro-Março no norte. "
               "Pouca rega, prefere solos profundos."),
            _h("2. Couve-portuguesa", 2),
            _p("Resistente ao frio e nativa. Creta colheitas ao longo de "
               "meses. Boa para aprender a fazer muda e transplantar."),
            _h("3. Tomate cherry", 2),
            _p("Ciclo completo num ano: sementeira, transplante, estaca, "
               "rega, poda. Ensina a ler a planta e a perceber as suas "
               "necessidades de água."),
            _h("4. Abóbora menina", 2),
            _p("Cobertura do solo, raízes profundas, colheita de Outono "
               "que se conserva durante meses. Introduz o conceito de "
               "culturas de armazenamento."),
            _h("5. Ervas aromáticas", 2),
            _p("Alecrim, tomilho, oregãos e salsa. Perenes, resistentes à "
               "seca, atraem polinizadores e repelam algumas pragas."),
            _h("O que aprender com estas cinco", 2),
            _list([
                "Diferença entre anual e bienal.",
                "Rotação de famílias botânicas.",
                "Cobertura do solo e mulching.",
                "Polinizadores e biodiversidade.",
                "Conservação de colheitas.",
            ]),
        ]},
    },
    # ── Pecuária (2) ──
    {
        "title": "Pecuária e criação animal: o que considerar antes de começar",
        "summary": "Um guia honesto sobre o que está em causa quando se cria "
                   "animais em pequena escala em Portugal.",
        "family": "pecuaria",
        "category": "avicultura",
        "language": "pt",
        "body": {"blocks": [
            _h("Antes de comprar o primeiro animal", 2),
            _p("Criar animais é diferente de ter animais de estimação. "
               "Exige presença diária, planeamento de alimentação, saúde, "
               "alojamento e destino final. Este artigo ajuda a pensar "
               "antes de decidir."),
            _h("Questões práticas", 2),
            _list([
                "Quem cuida dos animais quando estás de férias?",
                "Tens espaço e abrigo adequados ao clima local?",
                "O que vais fazer com os machos excedentes?",
                "Há veterinário na zona que conheça a espécie?",
                "Qual é o destino dos produtos (ovos, leite, carne)?",
            ]),
            _h("Espécies adequadas a pequenas escalas", 2),
            _p("Galinhas, patos, coelhos e abelhas são as entradas mais "
               "comuns em Portugal. Cada uma tem requisitos próprios e "
               "um mercado local consolidado para os produtos."),
            _h("Bem-estar e legislação", 2),
            _p("Portugal segue a legislação europeia sobre bem-estar "
               "animal. Mesmo em pequena escala, há regras sobre "
               "transporte, abate e registo. Informar-se antes é "
               "evitar problemas depois."),
        ]},
    },
    {
        "title": "Apicultura: introdução às abelhas em Portugal",
        "summary": "O que precisas de saber antes de instalar a primeira "
                   "colmeia. Clima, flora, equipamento e o calendário do ano.",
        "family": "pecuaria",
        "category": "apicultura",
        "language": "pt",
        "body": {"blocks": [
            _h("Porquê abelhas", 2),
            _p("As abelhas dão mel, cera e própolis, e polinizam hortas e "
               " árvores de fruto. São uma das criações com menor "
               "necessidade de espaço diário, mas exigem conhecimento."),
            _h("O que estudar antes", 2),
            _list([
                "Biologia da colmeia: rainha, obreiras, zangões.",
                "Doenças e pragas, em especial varroa.",
                "Calendário de floração da tua zona.",
                "Técnica de inspeção sem esmagar abelhas.",
            ]),
            _h("O ano do apicultor", 2),
            _p("Primavera: desenvolvimento da colmeia e prevenção de "
               "enxameação. Verão: colheita de mel. Outono: tratamento "
               "contra varroa e preparação para o Inverno. Inverno: "
               "intervenção mínima."),
            _h("Apoio local", 2),
            _p("A Federação Nacional dos Apicultores de Portugal (FNAP) "
               "reúne associações regionais. Vale a pena ligar à "
               "associação mais próxima antes de começar."),
        ]},
    },
    # ── Jardinagem (1) ──
    {
        "title": "Jardins em Portugal: princípios para um jardim vivo",
        "summary": "Como pensar um jardim que combine estética, biodiversidade "
                   "e baixa manutenção no clima mediterrânico.",
        "family": "jardinagem",
        "category": "jardinagem_sustentavel",
        "language": "pt",
        "body": {"blocks": [
            _h("Um jardim que trabalha sozinho", 2),
            _p("Em Portugal, com Verões longos e secos, um jardim "
               "sustentável escolhe plantas certas e deixa a natureza "
               "fazer grande parte do trabalho."),
            _h("Princípios", 2),
            _list([
                "Escolher plantas adaptadas ao clima e ao solo local.",
                "Agrupar plantas por necessidades de água.",
                "Manter cobertura morta no solo o ano todo.",
                "Criar refúgios para polinizadores e auxiliares.",
                "Reduzir a relva ao mínimo necessário.",
            ]),
            _h("Plantas que funcionam", 2),
            _p("Lavandas, alecrim, cistos, rosmaninho, estevas e "
               "gramíneas mediterrânicas. Resistem à seca, florescem "
               "longo tempo e exigem pouca manutenção."),
            _h("Irrigação inteligente", 2),
            _p("Prefere rega gota-a-gota ao regador. Rega à noite ou "
               "de manhã cedo para reduzir evaporação. Em pleno Verão "
               "poucas plantas precisam de água todos os dias."),
        ]},
    },
    # ── Carpintaria & Construção (1) ──
    {
        "title": "Carpintaria e construção: ferramentas para começar",
        "summary": "Um percurso sugerido para quem quer aprender a trabalhar "
                   "a madeira e a construir com as próprias mãos.",
        "family": "carpintaria_construcao",
        "category": "carpintaria",
        "language": "pt",
        "body": {"blocks": [
            _h("Ferramentas básicas", 2),
            _p("Não compres tudo de uma vez. Começa com o essencial e "
               "deixa que o trabalho te ensine o que falta."),
            _list([
                "Serrote de costa e serrote universal.",
                "Formão e martelo de unha.",
                "Régua, esquadro e fita métrica.",
                "Lima e lixa grossa e fina.",
                "Furadora manual ou eléctrica básica.",
            ]),
            _h("Madeiras acessíveis em Portugal", 2),
            _p("Pinheiro bravo é a madeira de entrada: barata, abundante "
               "e fácil de trabalhar. Sobreiro e castanho são mais "
               "robustos e exigem melhores ferramentas."),
            _h("Primeiros projetos", 2),
            _list([
                "Caixote para ferramentas.",
                "Cavalete de obra.",
                "Prateleira simples com encaixes.",
                "Banco de trabalho.",
            ]),
            _h("Segurança", 2),
            _p("Óculos, luvas e máscara para poeira. As ferramentas "
               "cortam madeira, mas também cortam dedos. Trabalha "
               "devagar até ganhares confiança."),
        ]},
    },
    # ── Artesanato & Ofícios (1) ──
    {
        "title": "Ofícios manuais: aprender com os mestres portugueses",
        "summary": "Cerâmica, cestaria, têxteis, couro e metalurgia. Onde "
                   "aprender e como começar em casa.",
        "family": "artesanato_oficios",
        "category": "ceramica",
        "language": "pt",
        "body": {"blocks": [
            _h("Tradição viva", 2),
            _p("Portugal tem uma tradição forte em cerâmica, cestaria e "
               "têxteis. As oficinas regionais ainda ensinam estas artes, "
               "e há uma nova geração a retomar os ofícios."),
            _h("Por onde entrar", 2),
            _list([
                "Cerâmica: começar com argila de secagem ao ar.",
                "Cestaria: palha, vime e junco são acessíveis.",
                "Têxteis: tecelagem em pequeno tear de mesa.",
                "Couro: costura à mão antes da máquina.",
                "Metalurgia: forja simples com gás para iniciantes.",
            ]),
            _h("Aprender em Portugal", 2),
            _p("Muitas câmaras e associações culturais mantêm oficinas "
               "de fim de semana. Vale a pena procurar por associação "
               "local antes de comprar equipamento caro."),
        ]},
    },
    # ── Auto-suficiência (2) ──
    {
        "title": "Auto-suficiência: um percurso realista para Portugal",
        "summary": "O que é possível produzir em casa, quanto tempo e dinheiro "
                   "exige, e onde está a fronteira realista.",
        "family": "auto_suficiencia",
        "category": "conservacao_alimentar",
        "language": "pt",
        "body": {"blocks": [
            _h("Não é viver sem nada, é produzir muito", 2),
            _p("Auto-suficiência não significa isolamento. Significa "
               "produzir uma parte significativa do que consumimos: "
               "comida, energia, água, conservas. O resto continua a "
               "vir de fora."),
            _h("O que é realista produzir", 2),
            _list([
                "Horta anual para uma família.",
                "Conservas, compotas e fermentados.",
                "Água quente solar.",
                "Pão e massas caseiras.",
                "Galinhas para ovos.",
            ]),
            _h("O que raramente compensa", 2),
            _list([
                "Trigo em pequena escala (comprar a farinha).",
                "Leite de vaca (exige demasiado tempo e espaço).",
                "Açúcar (processo industrial).",
                "Eletricidade total fora de rede (custo elevado).",
            ]),
            _h("O passo mais importante", 2),
            _p("Antes de comprar galinhas ou instalar painéis, reduz o "
               "desperdício. A primeira fonte de auto-suficiência é "
               " consumir menos."),
        ]},
    },
    {
        "title": "Conservação de alimentos: o básico em Portugal",
        "summary": "Compotas, pickle, secagem e fermentação. Quatro métodos "
                   "tradicionais para guardar a colheita.",
        "family": "auto_suficiencia",
        "category": "fermentacao",
        "language": "pt",
        "body": {"blocks": [
            _h("Guardar o que a horta dá", 2),
            _p("No pico da primavera e do verão a horta produz mais do "
               "que se consegue comer. Conservar é a forma de estender "
               "essa abundância pelo resto do ano."),
            _h("Compotas e doces", 2),
            _p("Fruta, açúcar e limão. A proporção clássica é um para "
               "um em peso. Ferver até atingir ponto de estrada. "
               "Enfrascar quente e virar o frasco ao contrário."),
            _h("Picles e conserva em sal", 2),
            _p("Sal, vinagre e água. Funciona com pepinos, cebolinhas, "
               "tomate verde e couve-flor. A fermentação láctica em "
               " salmoura é ainda mais simples e não precisa de vinagre."),
            _h("Secagem", 2),
            _p("Tomate, figo, alperce, cogumelos e ervas. O sol português "
               "faz grande parte do trabalho no Verão. Para o ano todo, "
               "um desidratador eléctrico simples resolve."),
            _h("Fermentação", 2),
            _p("Chucrute e kimchi são portas de entrada. Só precisam de "
               "repolho, sal e tempo. O resultado é mais duradouro do "
               "que a conserva em vinagre."),
        ]},
    },
    # ── Economia Circular (1) ──
    {
        "title": "Economia circular: o que é e como participar",
        "summary": "Reparar, reutilizar, partilhar e trocar. As práticas que "
                   "reduzem desperdício e criam valor local.",
        "family": "economia_circular",
        "category": "reparo_reuso",
        "language": "pt",
        "body": {"blocks": [
            _h("Para lá do reciclar", 2),
            _p("Reciclar é o último recurso. A economia circular começa "
               "antes: manter as coisas em uso o mais tempo possível, "
               "reparar em vez de deitar fora, partilhar em vez de "
               "comprar uma unidade por pessoa."),
            _h("Quatro práticas", 2),
            _list([
                "Reparar: cafés de reparação, oficinas comunitárias.",
                "Reutilizar: transformar o que existe em vez de comprar.",
                "Partilhar: ferramentas, equipamento, transportes.",
                "Trocar: bancos de tempo e mercados de escambo.",
            ]),
            _h("Em Portugal", 2),
            _p("Há redes de Repair Café em várias cidades, bibliotecas "
               "de ferramentas em Lisboa e Porto, e muitos grupos "
               "locais de partilha. Procurar na tua zona é o primeiro "
               "passo."),
            _h("Porque importa", 2),
            _p("Cada objeto que não compramos novo representa extração "
               "evitada, transporte evitado, desperdício evitado. Em "
               "conjunto, estas decisões têm peso real."),
        ]},
    },
    # ── Gestão de Resíduos (1) ──
    {
        "title": "Compostagem doméstica: o guia essencial",
        "summary": "Como transformar restos de comida em adubo. Métodos "
                   "adequados a apartamento, quintal e quintal grande.",
        "family": "gestao_residuos",
        "category": "residuos_organicos",
        "language": "pt",
        "body": {"blocks": [
            _h("Fechar o ciclo", 2),
            _p("Cerca de um terço do lixo doméstico é matéria orgânica "
               "que poderia virar adubo. Compostar reduz o lixo e dá-te "
               "terra fértil de graça."),
            _h("Três métodos", 2),
            _list([
                "Composteira térmica para quintal: equilíbrio verde/seco.",
                "Vermicompostagem para apartamento: minhocas em caixa.",
                "Bokashi: fermentação anaeróbia, sem espaço exterior.",
            ]),
            _h("O equilíbrio", 2),
            _p("Verdes (húmidos, ricos em azoto): restos de cozinha, "
               "corte de erva. Castanhos (secos, ricos em carbono): "
               "folhas secas, papelão, palha. Duas partes de castanho "
               "para uma de verde é um ponto de partida."),
            _h("O que não compostar", 2),
            _list([
                "Carne e peixe (atrai animais).",
                "Lacticínios e gorduras em grande quantidade.",
                "Cinzas de carvão.",
                "Plantas doentes.",
            ]),
            _h("Em Portugal", 2),
            _p("Várias câmaras oferecem composteira a preço reduzido. "
               "LIPOR no Porto e VALORLIS em Lisboa têm programas "
               "ativos de apoio à compostagem doméstica."),
        ]},
    },
    # ── Saúde & Bem-Estar (1) ──
    {
        "title": "Slow living: viver mais devagar em Portugal",
        "summary": "Uma reflexão sobre abrandar, o que isso significa na "
                   "prática e onde começar.",
        "family": "saude_bem_estar",
        "category": "slow_living",
        "language": "pt",
        "body": {"blocks": [
            _h("Não é preguiça", 2),
            _p("Viver devagar não é não fazer nada. É fazer menos coisas "
               "com mais atenção. É cozinhar em vez de aquecer, caminhar "
               "em vez de conduzir, conversar em vez de publicar."),
            _h("Pequenos passos", 2),
            _list([
                "Uma refeição por dia sem ecrãs.",
                "Uma caminhada sem destino.",
                "Um livro de papel por mês.",
                "Um dia por semana sem comprar nada.",
            ]),
            _h("O que isso tem a ver com sustentabilidade", 2),
            _p("Quase tudo o que reduz o ritmo de vida também reduz o "
               "consumo. Apressados, compramos mais, comemos pior e "
               "tratamos mal quem está perto. Abrandar é também uma "
               "resposta ecológica."),
            _h("Em Portugal", 2),
            _p("O clima, a cultura da refeição partilhada e o calendário "
               "de festas tradicionais facilitam um ritmo mais lento. "
               "Vale a pena repensar antes de importar hábitos de "
               "países mais acelerados."),
        ]},
    },
    # ── Energia Renovável (2) ──
    {
        "title": "Energia solar em casa: por onde começar",
        "summary": "Termossifão, painéis fotovoltaicos e autoconsumo. O que "
                   "faz sentido para uma casa em Portugal.",
        "family": "energia_renovavel",
        "category": "energia_solar",
        "language": "pt",
        "body": {"blocks": [
            _h("Três níveis", 2),
            _list([
                "Termossifão: água quente solar, o mais simples.",
                "Autoconsumo fotovoltaico: eletricidade para a casa.",
                "Autoconsumo com armazenamento: bateria para a noite.",
            ]),
            _h("O que compensa primeiro", 2),
            _p("Antes de investir em painéis, melhora o isolamento e "
               "troca eletrodomésticos antigos. Reduzir consumo é "
               "sempre mais barato do que produzir mais."),
            _h("Em Portugal", 2),
            _p("O regime de autoconsumo (UPAC) está regulado pela ERSE. "
               "Há apoios da ADENE e programas comunitários de energia "
               "renovável (CER) em várias regiões. Antes de assinar "
               "contrato, comparar três orçamentos."),
            _h("Orientação e sombra", 2),
            _p("Em Portugal, painéis virados a sul produzem mais no "
               "Inverno. Leste e oeste dão curvas mais planas ao longo "
               "do dia. Sombra parcial pode anular mais produção do que "
               "se espera - vale a pena medir antes de instalar."),
        ]},
    },
    {
        "title": "Comunidades de energia renovável: o que são",
        "summary": "As CER explicadas. Como um grupo de vizinhos pode "
                   "produzir, consumir e partilhar eletricidade.",
        "family": "energia_renovavel",
        "category": "cer_comunidade_energia",
        "language": "pt",
        "body": {"blocks": [
            _h("Uma vizinhança que produz eletricidade", 2),
            _p("Uma Comunidade de Energia Renovável (CER) é um grupo "
               "de pessoas que produz, consome e partilha eletricidade "
               "localmente. É um quadro legal europeu que Portugal "
               "transpôs em 2023."),
            _h("O que permite", 2),
            _list([
                "Partilhar excedentes entre participantes.",
                "Reduzir a fatura conjunta.",
                "Acelerar a transição energética local.",
                "Dar acesso a quem não tem telhado próprio.",
            ]),
            _h("Como funciona na prática", 2),
            _p("Há um operador responsável pela medição e pela "
               "distribuição dos excedentes. Os participantes mantêm o "
               "seu contrato com o comercializador, mas parte do que "
               "consomem vem da produção partilhada."),
            _h("Em Portugal", 2),
            _p("A APREN e a ADENE acompanham projetos-piloto em várias "
               "regiões. É um modelo em construção, mas com potencial "
               "real para freguesias rurais e urbanas."),
        ]},
    },
    # ── Economia Social (1) ──
    {
        "title": "Economia social: cooperar em vez de competir",
        "summary": "Cooperativas, ajuda mútua e projetos comunitários. Como "
                   "a economia social se organiza em Portugal.",
        "family": "economia_social",
        "category": "cooperativas",
        "language": "pt",
        "body": {"blocks": [
            _h("Outra forma de organizar", 2),
            _p("A economia social reúne cooperativas, mutualidades, "
               "associações e empresas sem fins lucrativos. Funciona com "
               "lógica diferente da empresa tradicional: o lucro, se "
               "existe, fica na comunidade."),
            _h("Formas principais", 2),
            _list([
                "Cooperativas: membros são donos e decidem.",
                "Mutualidades: ajuda mútua em risco ou doença.",
                "Associações: sem fins lucrativos, fim específico.",
                "Projetos comunitários: tempo e recursos partilhados.",
            ]),
            _h("Em Portugal", 2),
            _p("Há cooperativas de habitação, consumo, crédito e "
               "produção. CASEF é a entidade supervisora. O movimento "
               "cooperativo português tem tradição longa e está a "
               "renascer em novas formas."),
            _h("Porquê importar agora", 2),
            _p("Em contextos de incerteza económica, estruturas "
               "cooperativas dão resiliência. Partilham risco, "
               " diversificam rendimento e mantêm decisões perto de "
               "quem vive as consequências."),
        ]},
    },
]
