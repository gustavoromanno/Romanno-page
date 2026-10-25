/* Página de proposta: mostra a proposta, registra o aceite e abre o pagamento embutido do Stripe. */
(function () {
  "use strict";
  var CFG = window.ROMANNO_CONFIG || {};
  var API = String(CFG.pagamentosApi || "").replace(/\/+$/, "");
  var q = new URLSearchParams(location.search);
  var ID = q.get("id") || "";
  var TOKEN = q.get("t") || "";
  var SESSAO = q.get("sessao") || "";
  var proposta = null;
  var checkoutAtual = null;

  var $ = function (id) { return document.getElementById(id); };
  var reais = function (c) { return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); };
  var data = function (iso) {
    if (!iso) return "";
    var d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + "T12:00:00") : new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  };
  var STATUS = { enviada: "Aguardando aceite", aceita: "Aceita", paga: "Paga", cancelada: "Cancelada", vencida: "Vencida" };
  var ST_COB = { pendente: "A pagar", processando: "Confirmando", paga: "Paga", falhou: "Não concluído", reembolsada: "Reembolsada" };
  var METODO = { card: "cartão", pix: "Pix", boleto: "boleto", link: "Link" };

  function api(caminho, opcoes) {
    return fetch(API + caminho, opcoes).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) { var e = new Error(d.erro || "Não foi possível concluir agora."); e.status = r.status; throw e; }
        return d;
      });
    });
  }
  function post(caminho, corpo) {
    return api(caminho, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  }

  function whatsapp() {
    document.querySelectorAll("[data-whatsapp]").forEach(function (a) {
      if (!CFG.whatsapp) return;
      var txt = a.getAttribute("data-wa-text") || "";
      if (ID && txt) txt += " (" + ID + ")";
      a.href = "https://wa.me/" + CFG.whatsapp + (txt ? "?text=" + encodeURIComponent(txt) : "");
      a.target = "_blank"; a.rel = "noopener";
    });
  }

  function erro(msg) {
    $("carregando").hidden = true;
    $("proposta").hidden = true;
    $("erro").hidden = false;
    if (msg) $("erro-msg").textContent = msg;
  }

  function aviso(tipo, titulo, texto) {
    var el = $("aviso");
    el.className = "pp-aviso " + tipo;
    el.innerHTML = "";
    var b = document.createElement("b"); b.textContent = titulo; el.appendChild(b);
    if (texto) el.appendChild(document.createTextNode(texto));
    el.hidden = false;
  }

  function render(p) {
    proposta = p;
    var st = p.vencida ? "vencida" : p.status;
    $("p-id").textContent = "Proposta " + p.id;
    $("p-status").textContent = STATUS[st] || st;
    $("p-status").className = "pp-chip " + st;
    $("p-cliente").textContent = p.cliente.empresa ? p.cliente.nome + " · " + p.cliente.empresa : p.cliente.nome;
    $("p-titulo").textContent = p.titulo;
    $("p-resumo").textContent = p.resumo;
    $("p-data").textContent = data(p.criadaEm);
    $("p-prazo").textContent = p.prazo; $("m-prazo").hidden = !p.prazo;
    $("p-validade").textContent = data(p.validade); $("m-validade").hidden = !p.validade;
    document.title = "Proposta " + p.id + " · " + p.titulo + " — Romanno Tecnologia";

    var ol = $("p-escopo"); ol.innerHTML = "";
    p.escopo.forEach(function (item) { var li = document.createElement("li"); li.textContent = item; ol.appendChild(li); });
    $("p-obs").textContent = p.observacoes; $("p-obs-box").hidden = !p.observacoes;

    $("p-total").textContent = reais(p.valorTotal);
    var ul = $("p-cobrancas"); ul.innerHTML = "";
    p.cobrancas.forEach(function (c) {
      var li = document.createElement("li"); li.className = "pp-cob";
      var info = document.createElement("div"); info.className = "pp-cob-info";
      var b = document.createElement("b"); b.textContent = c.descricao; info.appendChild(b);
      var sub = document.createElement("span");
      if (c.status === "paga") sub.textContent = "Pago em " + data(c.pagoEm) + (METODO[c.metodo] ? " via " + METODO[c.metodo] : "");
      else if (c.parcelasMax > 1) sub.textContent = "Cartão em até " + c.parcelasMax + "x ou Pix";
      else sub.textContent = "Cartão ou Pix";
      info.appendChild(sub);
      var dir = document.createElement("div"); dir.className = "pp-cob-dir";
      var v = document.createElement("span"); v.className = "pp-cob-valor"; v.textContent = reais(c.valor); dir.appendChild(v);
      if (c.podePagar) {
        var btn = document.createElement("button");
        btn.type = "button"; btn.className = "btn primary";
        btn.innerHTML = "Pagar <span class=\"arr\">→</span>";
        btn.addEventListener("click", function () { abrirPagamento(c, btn); });
        dir.appendChild(btn);
      } else if (p.status !== "enviada" || c.status !== "pendente") {
        var s = document.createElement("span"); s.className = "pp-st " + c.status;
        s.textContent = c.status === "pendente" && p.status === "aceita" ? "Próxima etapa" : (ST_COB[c.status] || c.status);
        dir.appendChild(s);
      }
      li.appendChild(info); li.appendChild(dir); ul.appendChild(li);
    });

    var podeAceitar = p.status === "enviada" && !p.vencida;
    $("aceite").hidden = !podeAceitar;
    $("aceito").hidden = !p.aceite;
    if (p.aceite) {
      var pendente = p.cobrancas.filter(function (c) { return c.podePagar; })[0];
      $("aceito-txt").textContent = "Aceita por " + p.aceite.nome + " em " + data(p.aceite.em) + "." +
        (p.status === "paga" ? " Pagamento concluído. Obrigado pela confiança!" :
          pendente ? " Próximo passo: pagar \"" + pendente.descricao + "\"." : "");
    }
    if (p.vencida) aviso("falha", "Esta proposta passou da validade.", " Fale com a gente para receber uma versão atualizada.");
    if (p.status === "cancelada") aviso("falha", "Esta proposta foi cancelada.", " Se tiver alguma dúvida, fale com a gente.");

    $("carregando").hidden = true;
    $("proposta").hidden = false;
  }

  /* ---------- aceite ---------- */
  function aceitar(ev) {
    ev.preventDefault();
    var nome = $("aceite-nome").value.trim();
    var errEl = $("aceite-erro");
    errEl.hidden = true;
    if (nome.length < 3) { errEl.textContent = "Informe seu nome completo."; errEl.hidden = false; return; }
    if (!$("aceite-ok").checked) { errEl.textContent = "Marque que leu e concorda com a proposta."; errEl.hidden = false; return; }
    var btn = $("btn-aceite"); btn.disabled = true; btn.textContent = "Registrando…";
    post("/api/propostas/" + encodeURIComponent(ID) + "/aceite", { t: TOKEN, nome: nome, concordo: true })
      .then(function (p) {
        render(p);
        aviso("ok", "Proposta aceita. Obrigado!", " Você já pode pagar a primeira etapa logo abaixo.");
        var primeira = p.cobrancas.filter(function (c) { return c.podePagar; })[0];
        if (primeira) abrirPagamento(primeira);
      })
      .catch(function (e) { errEl.textContent = e.message; errEl.hidden = false; })
      .then(function () { btn.disabled = false; btn.innerHTML = "Aceitar proposta <span class=\"arr\">→</span>"; });
  }

  /* ---------- pagamento embutido ---------- */
  var stripeCarregado = {};
  function carregarStripe(uiMode) {
    var src = uiMode === "embedded_page" ? "https://js.stripe.com/endive/stripe.js" : "https://js.stripe.com/v3/";
    if (stripeCarregado[src]) return stripeCarregado[src];
    stripeCarregado[src] = new Promise(function (ok, falha) {
      var s = document.createElement("script");
      s.src = src; s.onload = ok;
      s.onerror = function () { falha(new Error("Não foi possível carregar o Stripe. Verifique sua conexão.")); };
      document.head.appendChild(s);
    });
    return stripeCarregado[src];
  }

  var chavePublica = null;
  function obterChave() {
    if (chavePublica) return Promise.resolve(chavePublica);
    return api("/api/config").then(function (d) {
      if (!d.publishableKey) throw new Error("Pagamentos ainda não estão configurados.");
      chavePublica = d.publishableKey; return chavePublica;
    });
  }

  function fecharPagamento() {
    if (checkoutAtual) { try { checkoutAtual.destroy(); } catch (e) { /* já destruído */ } checkoutAtual = null; }
    $("checkout").innerHTML = "";
    $("pagamento").hidden = true;
  }

  function abrirPagamento(c, btn) {
    fecharPagamento();
    $("pag-titulo").textContent = c.descricao + " · " + reais(c.valor);
    $("pagamento").hidden = false;
    $("checkout").innerHTML = "<span class=\"pp-spin\" aria-hidden=\"true\"></span>";
    $("pagamento").scrollIntoView({ behavior: "smooth", block: "start" });
    if (btn) btn.disabled = true;

    var sessao;
    Promise.all([
      obterChave(),
      post("/api/propostas/" + encodeURIComponent(ID) + "/cobrancas/" + c.id + "/checkout", { t: TOKEN }),
    ]).then(function (r) {
      sessao = r[1];
      return carregarStripe(sessao.uiMode).then(function () { return r[0]; });
    }).then(function (pk) {
      var stripe = window.Stripe(pk, { locale: "pt-BR" });
      var opcoes = { fetchClientSecret: function () { return Promise.resolve(sessao.clientSecret); } };
      var criar = typeof stripe.createEmbeddedCheckoutPage === "function" ? stripe.createEmbeddedCheckoutPage : stripe.initEmbeddedCheckout;
      return criar.call(stripe, opcoes);
    }).then(function (checkout) {
      $("checkout").innerHTML = "";
      checkoutAtual = checkout;
      checkout.mount("#checkout");
    }).catch(function (e) {
      $("checkout").innerHTML = "";
      var p = document.createElement("p"); p.className = "pp-erro"; p.textContent = e.message;
      $("checkout").appendChild(p);
    }).then(function () { if (btn) btn.disabled = false; });
  }

  /* ---------- volta do Stripe ---------- */
  function conferirRetorno() {
    return api("/api/propostas/" + encodeURIComponent(ID) + "/sessao/" + encodeURIComponent(SESSAO) + "?t=" + encodeURIComponent(TOKEN))
      .then(function (r) {
        render(r.proposta);
        if (r.status === "complete" && r.pagamento === "paid") {
          aviso("ok", "Pagamento recebido. Obrigado!", " Você recebe o comprovante por e-mail, e a confirmação aparece aqui em instantes.");
        } else if (r.status === "complete") {
          aviso("espera", "Pagamento em confirmação.", " Assim que o banco confirmar o Pix, esta página mostra a etapa como paga.");
        } else {
          aviso("falha", "O pagamento não foi concluído.", " Você pode tentar de novo pelo botão Pagar.");
        }
        history.replaceState(null, "", location.pathname + "?id=" + encodeURIComponent(ID) + "&t=" + encodeURIComponent(TOKEN));
        // O webhook pode levar alguns segundos: atualiza a página mais algumas vezes.
        var tentativas = 0;
        var timer = setInterval(function () {
          if (++tentativas > 6) return clearInterval(timer);
          carregar(true).then(function (p) {
            if (p && p.cobrancas.some(function (c) { return c.status === "paga"; }) && r.pagamento === "paid") clearInterval(timer);
          });
        }, 4000);
      });
  }

  function carregar(silencioso) {
    return api("/api/propostas/" + encodeURIComponent(ID) + "?t=" + encodeURIComponent(TOKEN))
      .then(function (p) { render(p); return p; })
      .catch(function (e) { if (!silencioso) erro(e.status === 404 ? null : e.message); });
  }

  function iniciar() {
    whatsapp();
    $("form-aceite").addEventListener("submit", aceitar);
    $("pag-fechar").addEventListener("click", fecharPagamento);
    if (!ID || !TOKEN) return erro();
    if (!API) return erro("Os pagamentos online estão em configuração. Fale com a gente pelo WhatsApp para concluir.");
    (SESSAO ? conferirRetorno().catch(function () { return carregar(); }) : carregar());
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
