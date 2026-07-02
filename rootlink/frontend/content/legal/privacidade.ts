import { LegalDoc } from "./types";

export const privacidade: LegalDoc = {
  slug: "privacidade",
  title: "Política de Privacidade",
  description:
    "Como o RootLink recolhe, usa, partilha e protege os seus dados pessoais.",
  version: "0.1",
  effectiveDate: "2026-07-02",
  lastUpdated: "2026-07-02",
  intro: [
    "O RootLink é uma plataforma de comunidade para jardineiros, produtores, artesãos, profissionais e famílias. Esta política explica, de forma simples e honesta, que dados pessoais recolhemos, para quê, com quem os partilhamos e quais os seus direitos.",
    "Este documento é um rascunho em desenvolvimento (ver aviso no topo da página) e reflete o funcionamento real da plataforma tal como existe hoje — não promessas futuras.",
  ],
  sections: [
    {
      id: "responsavel",
      heading: "1. Quem é o responsável pelo tratamento dos seus dados",
      blocks: [
        {
          type: "p",
          text: "O RootLink é, neste momento, um projeto independente ainda não constituído como empresa, associação ou ONG. O responsável pelo tratamento dos seus dados pessoais é Rui Silva, através do contacto abaixo.",
        },
        {
          type: "ul",
          items: [
            "Contacto: rui.fc.silva@proton.me",
            "Serviço disponibilizado atualmente em rootlink.ruisilvastudio.com (domínio provisório, sujeito a alteração)",
          ],
        },
      ],
    },
    {
      id: "dados-recolhidos",
      heading: "2. Que dados pessoais recolhemos",
      blocks: [
        {
          type: "p",
          text: "Recolhemos apenas os dados necessários para o funcionamento da plataforma:",
        },
        {
          type: "ul",
          items: [
            "Conta e perfil: nome, email, palavra-passe (armazenada de forma cifrada, nunca em texto simples), biografia, idioma preferido, fotografia de perfil.",
            "Localização: a sua localização aproximada (cidade/região) pode ser visível a outros utilizadores caso ative essa opção; as suas coordenadas exatas são privadas e nunca mostradas a terceiros, apenas usadas para funcionalidades como \"perto de mim\".",
            "Contas profissionais e de organização: dados adicionais fornecidos voluntariamente, como tipo de entidade, número de registo/NIF, área de serviço, certificações.",
            "Conteúdo que publica: artigos, comentários, avaliações, anúncios de mercado, eventos, projetos de reaproveitamento, e as imagens que carrega para esse conteúdo.",
            "Mensagens privadas trocadas com outros utilizadores através do sistema de mensagens do RootLink.",
            "Dados de transações: ao usar o mercado, doações ou bilhetes de eventos, guardamos identificadores de transação e estado do pagamento (ex.: pago/pendente/reembolsado). Não guardamos números de cartão — os pagamentos são processados diretamente pelo Stripe (e, futuramente, pela Liberapay).",
            "Dados técnicos mínimos: um token de sessão (JWT) guardado localmente no seu dispositivo (localStorage) para o manter autenticado. Não usamos cookies de rastreio nem ferramentas de análise/publicidade de terceiros.",
          ],
        },
      ],
    },
    {
      id: "nao-recolhemos",
      heading: "3. O que não recolhemos",
      blocks: [
        {
          type: "p",
          text: "É tão importante dizer o que não fazemos como o que fazemos:",
        },
        {
          type: "ul",
          items: [
            "Não usamos cookies de rastreio, pixels publicitários ou ferramentas de análise de comportamento (ex.: Google Analytics).",
            "Não pedimos nem guardamos documentos de identificação, dados biométricos ou dados de saúde.",
            "Não recolhemos o seu número de telefone pessoal (apenas contactos opcionais fornecidos por organizadores de eventos, indicados por eles próprios).",
            "Removemos automaticamente os metadados de localização (EXIF/GPS) de todas as fotografias que carrega, para evitar revelar acidentalmente a localização da sua casa.",
            "Não vendemos nem partilhamos os seus dados para efeitos de publicidade.",
          ],
        },
      ],
    },
    {
      id: "finalidades",
      heading: "4. Para que usamos os seus dados",
      blocks: [
        {
          type: "ul",
          items: [
            "Para criar e gerir a sua conta e autenticação.",
            "Para lhe mostrar conteúdo, pessoas e iniciativas relevantes perto de si.",
            "Para processar pagamentos, doações e bilhetes através dos nossos parceiros de pagamento.",
            "Para moderar conteúdo e manter a comunidade segura (incluindo um registo de auditoria das ações de moderação).",
            "Para cumprir obrigações legais quando aplicável.",
          ],
        },
        {
          type: "p",
          text: "O fundamento legal para estes tratamentos é, consoante o caso, a execução do contrato consigo (os Termos de Utilização), o nosso interesse legítimo em manter a plataforma funcional e segura, ou o seu consentimento explícito (por exemplo, ao tornar a sua localização pública).",
        },
      ],
    },
    {
      id: "partilha",
      heading: "5. Com quem partilhamos os seus dados",
      blocks: [
        {
          type: "p",
          text: "Não vendemos os seus dados. Partilhamos apenas o estritamente necessário com os seguintes prestadores de serviço, que atuam como subcontratantes:",
        },
        {
          type: "ul",
          items: [
            "Stripe — processamento de pagamentos, doações e subcontas de vendedores do mercado. O Stripe nunca nos dá acesso aos dados completos do seu cartão.",
            "Liberapay — meio de doação recorrente em preparação; ainda não está ativo em produção.",
            "Cloudflare — rede de distribuição de conteúdo (CDN) e proteção usada à frente do nosso servidor, para acelerar e proteger o acesso à plataforma.",
            "Vercel — aloja a interface (frontend) do RootLink.",
          ],
        },
        {
          type: "p",
          text: "Podemos também divulgar dados quando exigido por lei ou para proteger os direitos, segurança e propriedade do RootLink e dos seus utilizadores.",
        },
      ],
    },
    {
      id: "armazenamento",
      heading: "6. Onde e como guardamos os seus dados",
      blocks: [
        {
          type: "p",
          text: "O backend do RootLink corre num servidor próprio, com a interface alojada na Vercel e o tráfego protegido pela Cloudflare. Alguns destes prestadores podem processar dados fora do Espaço Económico Europeu, sujeitos às garantias contratuais exigidas pelo RGPD (ex.: cláusulas contratuais-tipo). Esta secção será revista e detalhada com apoio jurídico antes da publicação final desta política.",
        },
      ],
    },
    {
      id: "conservacao",
      heading: "7. Durante quanto tempo guardamos os seus dados",
      blocks: [
        {
          type: "p",
          text: "Ainda não temos prazos de conservação fixos definidos para cada tipo de dado — este é um ponto identificado como pendente e que será resolvido antes da publicação oficial desta política. Hoje, a prática é a seguinte:",
        },
        {
          type: "ul",
          items: [
            "Os dados da sua conta e do conteúdo que publica são mantidos enquanto a sua conta estiver ativa.",
            "Quando elimina a sua conta, dados de envolvimento pessoal (comentários, avaliações, marcadores, notificações, participação em grupos) são apagados de forma definitiva.",
            "O conteúdo que autorou (artigos, anúncios, eventos) é mantido mas desassociado da sua identidade (anonimizado), para preservar o valor coletivo desse conteúdo para a comunidade.",
            "Mantemos um registo de auditoria de ações de moderação por motivos de responsabilização e conformidade legal.",
          ],
        },
      ],
    },
    {
      id: "direitos",
      heading: "8. Os seus direitos (RGPD)",
      blocks: [
        {
          type: "p",
          text: "Ao abrigo do Regulamento Geral sobre a Proteção de Dados, tem direito a:",
        },
        {
          type: "ul",
          items: [
            "Aceder e exportar os seus dados — disponível diretamente na plataforma, no seu perfil, incluindo o seu perfil, conteúdo publicado, comentários e avaliações. (Nota: esta exportação ainda não inclui mensagens, encomendas do mercado ou bilhetes/doações de eventos — estamos a trabalhar para alargar este âmbito.)",
            "Retificar os seus dados — pode editar o seu perfil a qualquer momento.",
            "Apagar a sua conta — disponível no seu perfil; ver secção 7 sobre o que acontece a conteúdo autorado.",
            "Opor-se ou limitar certos tratamentos, e retirar consentimentos dados anteriormente.",
            "Apresentar reclamação junto da Comissão Nacional de Proteção de Dados (CNPD), a autoridade de controlo em Portugal — www.cnpd.pt.",
          ],
        },
        {
          type: "p",
          text: "Para exercer qualquer um destes direitos que não esteja disponível diretamente na plataforma, contacte-nos através de rui.fc.silva@proton.me.",
        },
      ],
    },
    {
      id: "seguranca",
      heading: "9. Segurança",
      blocks: [
        {
          type: "ul",
          items: [
            "As palavras-passe são guardadas de forma cifrada, nunca em texto simples.",
            "As comunicações com a plataforma são feitas via HTTPS.",
            "Os metadados de localização são removidos das fotografias carregadas.",
            "Nenhum sistema é 100% seguro; se identificar uma vulnerabilidade, agradecemos que nos contacte de forma responsável (ver SECURITY.md do projeto).",
          ],
        },
      ],
    },
    {
      id: "menores",
      heading: "10. Menores de idade",
      blocks: [
        {
          type: "p",
          text: "O RootLink destina-se a pessoas com 16 anos ou mais. Não recolhemos intencionalmente dados de pessoas com menos de 16 anos. Se tomarmos conhecimento de que recolhemos dados de um menor de 16 anos sem o devido consentimento, iremos eliminá-los assim que possível.",
        },
      ],
    },
    {
      id: "alteracoes",
      heading: "11. Alterações a esta política",
      blocks: [
        {
          type: "p",
          text: "Podemos atualizar esta política à medida que a plataforma evolui. Alterações materiais serão indicadas através de uma nova data de \"última atualização\" e de uma entrada no histórico de alterações no final desta página. Sempre que razoavelmente possível, avisaremos com antecedência antes de alterações significativas entrarem em vigor.",
        },
      ],
    },
    {
      id: "contacto",
      heading: "12. Contacto",
      blocks: [
        {
          type: "p",
          text: "Para qualquer questão sobre esta política ou sobre os seus dados pessoais, contacte-nos em rui.fc.silva@proton.me.",
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
