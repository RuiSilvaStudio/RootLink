import { LegalDoc } from "./types";

export const termos: LegalDoc = {
  slug: "termos",
  title: "Termos de Utilização",
  description:
    "As regras que regem o uso do RootLink por si e por todos os membros da comunidade.",
  version: "0.1",
  effectiveDate: "2026-07-02",
  lastUpdated: "2026-07-02",
  intro: [
    "Estes Termos de Utilização regulam o acesso e uso do RootLink. Ao criar uma conta ou usar a plataforma, está a concordar com estes termos.",
    "Este documento é um rascunho em desenvolvimento (ver aviso no topo da página) e será revisto com apoio jurídico antes de ser publicado oficialmente.",
  ],
  sections: [
    {
      id: "aceitacao",
      heading: "1. Aceitação dos termos",
      blocks: [
        {
          type: "p",
          text: "Ao aceder ou usar o RootLink, concorda em ficar vinculado a estes Termos de Utilização e à nossa Política de Privacidade. Se não concordar, não deve usar a plataforma.",
        },
      ],
    },
    {
      id: "quem-pode-usar",
      heading: "2. Quem pode usar o RootLink",
      blocks: [
        {
          type: "p",
          text: "Tem de ter pelo menos 16 anos para criar uma conta no RootLink. Ao criar uma conta, declara e garante que cumpre este requisito de idade.",
        },
        {
          type: "p",
          text: "O RootLink suporta diferentes tipos de conta: utilizadores individuais, profissionais e organizações. Cada tipo de conta pode ter campos e funcionalidades adicionais, mas todos estão sujeitos a estes Termos.",
        },
      ],
    },
    {
      id: "conta",
      heading: "3. A sua conta",
      blocks: [
        {
          type: "ul",
          items: [
            "É responsável por manter a confidencialidade da sua palavra-passe e por toda a atividade realizada através da sua conta.",
            "Deve fornecer informação verdadeira e mantê-la atualizada.",
            "Deve notificar-nos imediatamente se suspeitar de uso não autorizado da sua conta.",
          ],
        },
      ],
    },
    {
      id: "conteudo",
      heading: "4. Conteúdo que publica",
      blocks: [
        {
          type: "p",
          text: "Mantém a propriedade sobre o conteúdo que publica no RootLink (artigos, comentários, avaliações, anúncios, imagens, eventos, projetos). Ao publicar, concede ao RootLink uma licença não exclusiva, mundial e gratuita para armazenar, apresentar e distribuir esse conteúdo dentro da plataforma, com o único propósito de operar o serviço.",
        },
        {
          type: "p",
          text: "É inteiramente responsável pelo conteúdo que publica, incluindo a sua legalidade, veracidade e o facto de não infringir direitos de terceiros.",
        },
      ],
    },
    {
      id: "regras-comunidade",
      heading: "5. Regras da comunidade e moderação",
      blocks: [
        {
          type: "p",
          text: "Espera-se que todos os membros sigam o nosso Código de Conduta. Não é permitido publicar conteúdo ilegal, assediador, discriminatório, enganoso ou que viole direitos de terceiros.",
        },
        {
          type: "p",
          text: "Reservamo-nos o direito de rever, rejeitar ou remover conteúdo, e de suspender ou banir contas que violem estas regras. As decisões de moderação ficam registadas para efeitos de responsabilização, e pode pedir revisão de uma decisão de moderação através do contacto indicado abaixo.",
        },
      ],
    },
    {
      id: "mercado-doacoes",
      heading: "6. Mercado, eventos, doações e pagamentos",
      blocks: [
        {
          type: "p",
          text: "O RootLink disponibiliza funcionalidades de mercado (venda de produtos e serviços entre membros), bilhetes de eventos e doações. Os pagamentos são processados por prestadores externos (atualmente Stripe; futuramente também Liberapay) — o RootLink nunca tem acesso aos dados completos do seu cartão.",
        },
        {
          type: "p",
          text: "Nas transações entre membros (por exemplo, compra e venda no mercado), o RootLink atua como intermediário técnico e não é parte no contrato entre comprador e vendedor, salvo indicação em contrário.",
        },
        {
          type: "p",
          text: "Para usar a funcionalidade de doações associada a iniciativas, eventos ou organizações, a entidade responsável deve ser identificável e aceitar responsabilidade pela utilização correta dos fundos recebidos, e concordar expressamente com estas regras.",
        },
      ],
    },
    {
      id: "propriedade-intelectual",
      heading: "7. Propriedade intelectual do RootLink",
      blocks: [
        {
          type: "p",
          text: "O nome, logótipo, design e código do RootLink pertencem ao RootLink (ou aos seus licenciadores) e são protegidos pelas leis de propriedade intelectual aplicáveis. Estes Termos não lhe concedem qualquer direito sobre essa propriedade, salvo o necessário para usar a plataforma normalmente.",
        },
      ],
    },
    {
      id: "isencao-garantias",
      heading: "8. Isenção de garantias e limitação de responsabilidade",
      blocks: [
        {
          type: "p",
          text: "O RootLink é um projeto em desenvolvimento ativo (fase beta), disponibilizado \"tal como está\" e \"conforme disponível\", sem garantias de qualquer tipo, expressas ou implícitas, quanto à disponibilidade contínua, ausência de erros ou adequação a um fim específico.",
        },
        {
          type: "p",
          text: "Na máxima medida permitida por lei, o RootLink não será responsável por danos indiretos, incidentais ou consequenciais resultantes do uso ou impossibilidade de uso da plataforma, incluindo perdas decorrentes de transações entre utilizadores.",
        },
      ],
    },
    {
      id: "suspensao",
      heading: "9. Suspensão e cessação",
      blocks: [
        {
          type: "p",
          text: "Pode eliminar a sua conta a qualquer momento através do seu perfil. Podemos suspender ou terminar o seu acesso caso viole estes Termos ou o Código de Conduta, tentando sempre, sempre que razoável, notificá-lo e permitir-lhe recurso da decisão.",
        },
      ],
    },
    {
      id: "alteracoes",
      heading: "10. Alterações a estes termos",
      blocks: [
        {
          type: "p",
          text: "Podemos atualizar estes Termos à medida que a plataforma evolui. Alterações materiais serão indicadas através de uma nova data de \"última atualização\" e de uma entrada no histórico de alterações no final desta página. Sempre que razoavelmente possível, avisaremos com antecedência antes de alterações significativas entrarem em vigor, e o uso continuado da plataforma após essa data constitui aceitação dos novos termos.",
        },
      ],
    },
    {
      id: "lei-aplicavel",
      heading: "11. Lei aplicável e resolução de litígios",
      blocks: [
        {
          type: "p",
          text: "Estes Termos regem-se pela lei portuguesa e pelo Regulamento Geral sobre a Proteção de Dados (RGPD), sem prejuízo de normas de proteção do consumidor que lhe sejam aplicáveis no seu país de residência.",
        },
        {
          type: "p",
          text: "Se for consumidor residente na União Europeia, pode também recorrer à plataforma europeia de Resolução de Litígios em Linha (ODR): ec.europa.eu/consumers/odr.",
        },
      ],
    },
    {
      id: "contacto",
      heading: "12. Contacto",
      blocks: [
        {
          type: "p",
          text: "Para qualquer questão sobre estes Termos, contacte-nos em rui.fc.silva@proton.me.",
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
