/* =========================================================
   CONFIGURAÇÃO DO SITE — edite só este arquivo
   ========================================================= */
window.ROMANNO_CONFIG = {
  // URL do webhook (n8n, Make, Formspree…). Recebe um POST em JSON com os dados do orçamento.
  // Enquanto estiver vazio, o formulário abre o e-mail do visitante já preenchido (fallback).
  webhookUrl: "https://romanno.app.n8n.cloud/webhook/orcamento-romanno",

  // E-mail que recebe os pedidos (usado no fallback e no rodapé)
  email: "contato@romanno.com.br",

  // WhatsApp só com números, com DDI e DDD. Ex.: "5531999999999". Vazio = esconde o botão.
  whatsapp: "5531933015571",

  // Endereço do worker de propostas e pagamentos (Cloudflare). Ex.: "https://romanno-pagamentos.SEU-USUARIO.workers.dev"
  // Enquanto estiver vazio, a página de proposta avisa que os pagamentos estão em configuração.
  pagamentosApi: ""
};
