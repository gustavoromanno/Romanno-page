"""Relatório em HTML para o dono do restaurante."""
from collections import Counter
from html import escape

from .modelos import TIPOS, Divergencia
from .explicacao import Explicacao

ORDEM = {"alta": 0, "media": 1, "baixa": 2}
ROTULO = {"alta": "Alta", "media": "Média", "baixa": "Baixa"}


def gerar_html(divergencias: list[Divergencia], explicacoes: list[Explicacao], origem: str,
               qtd_pedidos: int, qtd_notas: int) -> str:
    por_id = {d.id: d for d in divergencias}
    itens = sorted(explicacoes, key=lambda e: (ORDEM[e.prioridade], e.divergencia_id))
    contagem = Counter(e.prioridade for e in explicacoes)

    cartoes = []
    for e in itens:
        d = por_id[e.divergencia_id]
        chaves = "".join(f"<code>{escape(c)}</code>" for c in d.chaves)
        cartoes.append(f"""
      <article class="cartao {e.prioridade}">
        <div class="topo"><span class="selo {e.prioridade}">{ROTULO[e.prioridade]}</span>
          <span class="tipo">{escape(TIPOS[d.tipo])}</span><span class="id">{d.id}</span></div>
        <h3>{"Pedido " + escape(d.pedido_id) if d.pedido_id else "Nota sem pedido"}</h3>
        <p>{escape(e.explicacao)}</p>
        <p class="acao"><b>O que fazer:</b> {escape(e.acao)}</p>
        <div class="chaves">{chaves}</div>
      </article>""")

    return f"""<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Conferência de notas</title>
<link href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{{--papel:#F6F7F6;--tinta:#111;--tinta2:#4F4F4F;--tinta3:#6B6B6B;--linha:#E4E6E4;--verde:#1C3B2E;--alta:#B3261E;--altabg:#FCEBEA;--media:#9A6200;--mediabg:#FFF4DF;--baixa:#2F7A5C;--baixabg:#E7EDE9}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--papel);color:var(--tinta);font-family:"Jost",Arial,sans-serif;line-height:1.55}}
.wrap{{width:min(960px,calc(100% - 32px));margin:auto;padding:40px 0 56px}}
.aviso{{background:var(--verde);color:#DCE5E0;font-size:13px;text-align:center;padding:8px 16px}}
h1{{margin:0;font-size:clamp(28px,4vw,40px);letter-spacing:-.02em}}
.sub{{color:var(--tinta2);margin:8px 0 0}}
.resumo{{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:28px 0}}
.resumo div{{background:#fff;border:1px solid var(--linha);border-radius:14px;padding:16px}}
.resumo b{{display:block;font-size:26px;line-height:1.1}}.resumo span{{color:var(--tinta3);font-size:14px}}
.lista{{display:grid;gap:12px}}
.cartao{{background:#fff;border:1px solid var(--linha);border-left:4px solid var(--linha);border-radius:14px;padding:18px 20px}}
.cartao.alta{{border-left-color:var(--alta)}}.cartao.media{{border-left-color:var(--media)}}.cartao.baixa{{border-left-color:var(--baixa)}}
.topo{{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:13px}}
.selo{{font-weight:600;padding:2px 10px;border-radius:99px}}
.selo.alta{{color:var(--alta);background:var(--altabg)}}.selo.media{{color:var(--media);background:var(--mediabg)}}.selo.baixa{{color:var(--baixa);background:var(--baixabg)}}
.tipo{{color:var(--tinta2)}}.id{{margin-left:auto;color:var(--tinta3)}}
h3{{margin:10px 0 4px;font-size:18px}}p{{margin:4px 0;color:var(--tinta2)}}.acao b{{color:var(--tinta)}}
.chaves code{{display:inline-block;margin:8px 8px 0 0;font-size:11.5px;color:var(--tinta3);word-break:break-all}}
footer{{margin-top:28px;color:var(--tinta3);font-size:13px}}
@media (max-width:640px){{.resumo{{grid-template-columns:1fr 1fr}}}}
</style></head><body>
<div class="aviso">Demonstração com dados fictícios · projeto de Gustavo Romano</div>
<main class="wrap">
  <h1>Conferência de notas fiscais</h1>
  <p class="sub">{qtd_pedidos} pedidos e {qtd_notas} notas conferidos. Ordenado do mais urgente para o menos urgente.</p>
  <div class="resumo">
    <div><b>{len(divergencias)}</b><span>divergências</span></div>
    <div><b style="color:var(--alta)">{contagem['alta']}</b><span>prioridade alta</span></div>
    <div><b style="color:var(--media)">{contagem['media']}</b><span>prioridade média</span></div>
    <div><b style="color:var(--baixa)">{contagem['baixa']}</b><span>prioridade baixa</span></div>
  </div>
  <div class="lista">{"".join(cartoes)}
  </div>
  <footer>Divergências encontradas por regras em código. Explicações geradas por: {escape(origem)}.</footer>
</main></body></html>
"""
