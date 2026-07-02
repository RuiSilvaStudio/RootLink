import { LegalDoc } from "./types";

export const legal: LegalDoc = {
  slug: "legal",
  title: "Aviso Legal",
  description:
    "Identificação do responsável pelo RootLink, alojamento e informação legal obrigatória.",
  version: "0.1",
  effectiveDate: "2026-07-02",
  lastUpdated: "2026-07-02",
  intro: [
    "Este Aviso Legal identifica quem está por detrás do RootLink e complementa a Política de Privacidade e os Termos de Utilização.",
    "Este documento é um rascunho em desenvolvimento (ver aviso no topo da página) e será revisto com apoio jurídico antes de ser publicado oficialmente.",
  ],
  sections: [
    {
      id: "identificacao",
      heading: "1. Identificação do responsável",
      blocks: [
        {
          type: "p",
          text: "O RootLink é, neste momento, um projeto independente, ainda não constituído como empresa, associação ou ONG. É responsável pelo projeto:",
        },
        {
          type: "ul",
          items: [
            "Responsável: Rui Silva",
            "Contacto: rui.fc.silva@proton.me",
            "Serviço disponibilizado atualmente em rootlink.ruisilvastudio.com (domínio provisório e sujeito a alteração; qualquer outro domínio associado ao projeto que não este é apenas para fins de teste/desenvolvimento)",
          ],
        },
        {
          type: "p",
          text: "Este aviso será atualizado com o nome, número de identificação fiscal/registo e morada de uma entidade legalmente constituída, caso e quando o RootLink venha a ser formalmente registado (por exemplo, como associação ou empresa).",
        },
      ],
    },
    {
      id: "natureza",
      heading: "2. Natureza do projeto",
      blocks: [
        {
          type: "p",
          text: "O RootLink encontra-se em fase inicial de desenvolvimento ativo. Referências informais ao RootLink como iniciativa \"comunitária\" ou de cariz social descrevem a sua missão e não devem ser interpretadas como uma afirmação de um estatuto legal específico (por exemplo, ONG registada) enquanto esse registo não existir formalmente.",
        },
      ],
    },
    {
      id: "alojamento",
      heading: "3. Alojamento",
      blocks: [
        {
          type: "ul",
          items: [
            "Interface (frontend): alojada na Vercel Inc.",
            "Servidor de backend: infraestrutura própria, com o tráfego protegido pela Cloudflare (rede de distribuição de conteúdo e segurança).",
          ],
        },
      ],
    },
    {
      id: "propriedade-intelectual",
      heading: "4. Propriedade intelectual",
      blocks: [
        {
          type: "p",
          text: "O nome \"RootLink\", o logótipo, o design visual e o código-fonte da plataforma são protegidos pelas leis de propriedade intelectual aplicáveis. O conteúdo publicado por utilizadores permanece propriedade dos respetivos autores, nos termos descritos nos Termos de Utilização.",
        },
      ],
    },
    {
      id: "links-terceiros",
      heading: "5. Ligações a sites de terceiros",
      blocks: [
        {
          type: "p",
          text: "O RootLink pode agregar ou apresentar ligações a conteúdo de terceiros (por exemplo, feeds RSS de fontes externas na secção de conteúdos). Não somos responsáveis pelo conteúdo, políticas de privacidade ou práticas de sites de terceiros a que possa aceder através da plataforma.",
        },
      ],
    },
    {
      id: "reclamacoes",
      heading: "6. Reclamações e resolução de litígios",
      blocks: [
        {
          type: "p",
          text: "Para qualquer reclamação relacionada com o RootLink, contacte-nos primeiro através de rui.fc.silva@proton.me — teremos todo o gosto em tentar resolver a questão diretamente.",
        },
        {
          type: "p",
          text: "Se for consumidor residente na União Europeia, pode também recorrer à plataforma europeia de Resolução de Litígios em Linha (ODR): ec.europa.eu/consumers/odr.",
        },
        {
          type: "p",
          text: "Para questões relacionadas especificamente com proteção de dados pessoais, pode contactar a Comissão Nacional de Proteção de Dados (CNPD) — www.cnpd.pt.",
        },
      ],
    },
    {
      id: "alteracoes",
      heading: "7. Alterações a este aviso",
      blocks: [
        {
          type: "p",
          text: "Este aviso pode ser atualizado à medida que o projeto evolui, nomeadamente se e quando for constituída uma entidade legal formal. Alterações materiais serão indicadas através de uma nova data de \"última atualização\" e de uma entrada no histórico de alterações no final desta página.",
        },
      ],
    },
  ],
  changelog: [
    {
      date: "2026-07-02",
      version: "0.1",
      summary: "Primeiro rascunho, para revisão interna e jurídica. Ainda não publicado.",
    },
  ],
};
