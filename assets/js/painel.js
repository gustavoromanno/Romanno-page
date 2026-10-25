/* Painel de propostas: cria propostas e acompanha pagamentos. A senha fica só neste navegador. */
(function () {
  "use strict";
  var CFG = window.ROMANNO_CONFIG || {};
  var API = String(CFG.pagamentosApi || "").replace(/\/+$/, "");
  var CHAVE = "romanno_painel_token";
  var token = "";
  var modelo = "integral";
  var $ = function (id) { return document.getElementById(id); };
  var reais = function (c) { return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); };
  var STATUS = { enviada: "Aguardando aceite", aceita: "Aceita", paga: "Paga", cancelada: "Cancelada" };
  var ST_COB = { pendente: "a pagar", processando: "confirmando", paga: "paga", falhou: "não concluído", reembolsada: "reembolsada" };

  function guardar(v) { try { v ? localStorage.setItem(CHAVE, v) : localStorage.removeItem(CHAVE); } catch (e) { /* navegador sem armazenamento */ } }
  function lido() { try { return localStorage.getItem(CHAVE) || ""; } catch (e) { return ""; } }

  /** "3.000,50" ou "3000.50" → centavos */
  function centavos(txt) {
    var s = String(txt || "").trim().replace(/[^\d.,]/g, "");
    if (!s) return NaN;
    if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
    else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
    return Math.round(parseFloat(s) * 100);
  }
  var emReais = function (c) { return (c / 100).toFixed(2).replace(".", ","); };

  function api(caminho, metodo, corpo) {
    var op = { method: metodo || "GET", headers: { Authorization: "Bearer " + token } };
    if (corpo !== undefined) { op.headers["Content-Type"] = "application/json"; op.body = JSON.stringify(corpo); }
    return fetch(API + caminho, op).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) { var e = new Error(d.erro || "Erro " + r.status); e.status = r.status; throw e; }
        return d;
      });
    });
  }

  /* ---------- etapas de cobrança ---------- */
  function linhaCob(desc, valor, parcelas) {
    var div = document.createElement("div"); div.className = "adm-cob";
    div.innerHTML =
      '<label class="pp-field"><span>Etapa</span><input class="c-desc"></label>' +
      '<label class="pp-field"><span>Valor (R$)</span><input class="c-valor" inputmode="decimal"></label>' +
      '<label class="pp-field"><span>Cartão em até</span><select class="c-parc"></select></label>' +
      '<button type="button" class="adm-x" title="Remover etapa">×</button>';
    var sel = div.querySelector(".c-parc");
    for (var i = 1; i <= 12; i++) { var o = document.createElement("option"); o.value = i; o.textContent = i === 1 ? "1x (à vista)" : i + "x"; sel.appendChild(o); }
    div.querySelector(".c-desc").value = desc;
    div.querySelector(".c-valor").value = valor;
    sel.value = String(parcelas || 1);
    div.querySelector(".adm-x").addEventListener("click", function () { div.remove(); soma(); });
    div.querySelector(".adm-x").hidden = modelo !== "livre";
    div.addEventListener("input", soma);
    return div;
  }

  function aplicarModelo() {
    var total = centavos($("form-nova").valor_total.value);
    var box = $("cobs"); box.innerHTML = "";
    document.querySelectorAll("#modelos button").forEach(function (b) { b.classList.toggle("on", b.dataset.modelo === modelo); });
    $("add-cob").hidden = modelo !== "livre";
    var t = isNaN(total) ? 0 : total;
    if (modelo === "integral") box.appendChild(linhaCob("Valor integral", t ? emReais(t) : "", 6));
    else if (modelo === "50") {
      var metade = Math.round(t / 2);
      box.appendChild(linhaCob("Entrada (50%)", t ? emReais(metade) : "", 3));
      box.appendChild(linhaCob("Entrega (50%)", t ? emReais(t - metade) : "", 3));
    } else {
      box.appendChild(linhaCob("Entrada", "", 1));
      box.appendChild(linhaCob("Entrega", "", 1));
    }
    soma();
  }

  function cobrancas() {
    return [].map.call(document.querySelectorAll("#cobs .adm-cob"), function (d) {
      return { descricao: d.querySelector(".c-desc").value.trim(), valor: centavos(d.querySelector(".c-valor").value), parcelas_max: Number(d.querySelector(".c-parc").value) };
    });
  }

  function soma() {
    var total = centavos($("form-nova").valor_total.value);
    var s = cobrancas().reduce(function (a, c) { return a + (isNaN(c.valor) ? 0 : c.valor); }, 0);
    var el = $("soma");
    if (isNaN(total)) { el.textContent = ""; return; }
    var ok = s === total;
    el.className = "adm-soma" + (ok ? "" : " ruim");
    el.textContent = ok ? "Etapas somam " + reais(s) + ". Tudo certo." : "Etapas somam " + reais(s) + " (o total é " + reais(total) + ").";
  }

  /* ---------- criar ---------- */
  function criar(ev) {
    ev.preventDefault();
    var f = ev.target; var err = $("nova-erro"); err.hidden = true; $("novo-link").hidden = true;
    var corpo = {
      cliente_nome: f.cliente_nome.value, cliente_empresa: f.cliente_empresa.value, cliente_email: f.cliente_email.value,
      titulo: f.titulo.value, resumo: f.resumo.value, escopo: f.escopo.value, prazo: f.prazo.value,
      validade: f.validade.value, observacoes: f.observacoes.value,
      valor_total: centavos(f.valor_total.value), cobrancas: cobrancas(),
    };
    var btn = $("btn-criar"); btn.disabled = true;
    api("/api/admin/propostas", "POST", corpo).then(function (r) {
      var box = $("novo-link"); box.innerHTML = "";
      var b = document.createElement("b"); b.textContent = "Proposta " + r.id + " criada. Envie este link ao cliente:"; box.appendChild(b);
      var p = document.createElement("p"); p.textContent = r.link; box.appendChild(p);
      box.appendChild(acoesLink(r.link, corpo.cliente_nome, r.id));
      box.hidden = false;
      f.reset(); validadePadrao(); modelo = "integral"; aplicarModelo(); listar();
    }).catch(function (e) { err.textContent = e.message; err.hidden = false; })
      .then(function () { btn.disabled = false; });
  }

  function acoesLink(link, nome, id) {
    var div = document.createElement("div"); div.className = "adm-acoes";
    var copiar = document.createElement("button"); copiar.type = "button"; copiar.textContent = "Copiar link";
    copiar.addEventListener("click", function () {
      (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { copiar.textContent = "Copiado ✓"; })
        .catch(function () { window.prompt("Copie o link:", link); });
    });
    var wa = document.createElement("a"); wa.target = "_blank"; wa.rel = "noopener"; wa.textContent = "Enviar no WhatsApp";
    var primeiro = String(nome || "").trim().split(/\s+/)[0];
    wa.href = "https://wa.me/?text=" + encodeURIComponent("Olá" + (primeiro ? ", " + primeiro : "") + "! Segue a proposta " + id + " da Romanno Tecnologia. Por ela você confere o escopo, aceita e já faz o pagamento com segurança: " + link);
    var abrir = document.createElement("a"); abrir.href = link; abrir.target = "_blank"; abrir.rel = "noopener"; abrir.textContent = "Abrir";
    div.appendChild(copiar); div.appendChild(wa); div.appendChild(abrir);
    return div;
  }

  /* ---------- listar ---------- */
  function listar() {
    return api("/api/admin/propostas").then(function (r) {
      var box = $("lista"); box.innerHTML = "";
      if (!r.propostas.length) { box.innerHTML = '<p class="pp-nota">Nenhuma proposta ainda.</p>'; return; }
      r.propostas.forEach(function (p) {
        var it = document.createElement("div"); it.className = "adm-item";
        var top = document.createElement("div"); top.className = "adm-item-top";
        var t = document.createElement("div");
        var b = document.createElement("b"); b.textContent = p.id + " · " + p.titulo; t.appendChild(b);
        var sm = document.createElement("small"); sm.textContent = " " + p.cliente_nome + (p.cliente_empresa ? " (" + p.cliente_empresa + ")" : ""); t.appendChild(sm);
        var st = document.createElement("span"); st.className = "pp-st " + (p.status === "paga" ? "paga" : p.status === "cancelada" ? "falhou" : "");
        st.textContent = (STATUS[p.status] || p.status) + " · " + reais(p.valor_total);
        top.appendChild(t); top.appendChild(st); it.appendChild(top);

        p.cobrancas.forEach(function (c) {
          var l = document.createElement("div"); l.className = "adm-cob-lin";
          var txt = document.createElement("span");
          txt.textContent = c.descricao + ": " + reais(c.valor) + " · " + (ST_COB[c.status] || c.status) + (c.liberada ? "" : " · bloqueada");
          l.appendChild(txt);
          if (!c.liberada && p.status === "aceita") {
            var lib = document.createElement("button"); lib.type = "button"; lib.className = "pp-link"; lib.textContent = "Liberar para pagamento";
            lib.addEventListener("click", function () {
              if (!confirm("Liberar \"" + c.descricao + "\" para o cliente pagar?")) return;
              api("/api/admin/propostas/" + p.id + "/cobrancas/" + c.id + "/liberar", "POST", {}).then(listar).catch(function (e) { alert(e.message); });
            });
            l.appendChild(lib);
          }
          it.appendChild(l);
        });

        var acoes = acoesLink(p.link, p.cliente_nome, p.id);
        if (p.status === "enviada" || p.status === "aceita") {
          var canc = document.createElement("button"); canc.type = "button"; canc.textContent = "Cancelar proposta";
          canc.addEventListener("click", function () {
            if (!confirm("Cancelar a proposta " + p.id + "? O cliente não poderá mais aceitar nem pagar.")) return;
            api("/api/admin/propostas/" + p.id + "/cancelar", "POST", {}).then(listar).catch(function (e) { alert(e.message); });
          });
          acoes.appendChild(canc);
        }
        it.appendChild(acoes);
        box.appendChild(it);
      });
    });
  }

  function validadePadrao() {
    var d = new Date(); d.setDate(d.getDate() + 15);
    $("form-nova").validade.value = d.toISOString().slice(0, 10);
  }

  /* ---------- sessão ---------- */
  function entrar(t) {
    token = t;
    return listar().then(function () {
      guardar(t); $("login").hidden = true; $("painel").hidden = false;
    }).catch(function (e) {
      token = ""; guardar("");
      $("login").hidden = false; $("painel").hidden = true;
      var el = $("login-erro"); el.textContent = e.status === 401 ? "Senha incorreta." : e.message; el.hidden = false;
    });
  }

  function iniciar() {
    if (!API) {
      var el = $("login-erro"); el.textContent = "Configure pagamentosApi em assets/js/config.js."; el.hidden = false;
    }
    $("form-login").addEventListener("submit", function (ev) { ev.preventDefault(); entrar($("token").value.trim()); });
    $("sair").addEventListener("click", function () { guardar(""); token = ""; $("painel").hidden = true; $("login").hidden = false; });
    $("atualizar").addEventListener("click", function () { listar().catch(function (e) { alert(e.message); }); });
    $("form-nova").addEventListener("submit", criar);
    $("form-nova").valor_total.addEventListener("change", function () { if (modelo !== "livre") aplicarModelo(); else soma(); });
    $("add-cob").addEventListener("click", function () { $("cobs").appendChild(linhaCob("Etapa " + ($("cobs").children.length + 1), "", 1)); soma(); });
    document.querySelectorAll("#modelos button").forEach(function (b) {
      b.addEventListener("click", function () { modelo = b.dataset.modelo; aplicarModelo(); });
    });
    validadePadrao();
    aplicarModelo();
    var salvo = lido();
    if (salvo && API) entrar(salvo);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
