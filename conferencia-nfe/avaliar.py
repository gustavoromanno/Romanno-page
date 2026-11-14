"""Mede o conferidor contra o gabarito.

1. Detecção (código): das divergências plantadas, quantas foram encontradas (recall)
   e quantas das encontradas eram reais (precisão).
2. Explicação (IA ou regras): para as divergências encontradas, quantas causas prováveis
   batem com a causa real plantada.

Uso: python avaliar.py --dados dados --saida saida
"""
import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path

POR_CHAVE = {"CHAVE_INVALIDA", "NOTA_SEM_PEDIDO"}   # tipos identificados pela chave, não pelo pedido


def identificador(tipo: str, pedido_id: str | None, chave: str | None) -> tuple:
    return (tipo, chave) if tipo in POR_CHAVE else (tipo, pedido_id or "")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dados", type=Path, default=Path("dados"))
    ap.add_argument("--saida", type=Path, default=Path("saida"))
    args = ap.parse_args()

    with open(args.dados / "gabarito.csv", encoding="utf-8") as f:
        gabarito = {identificador(l["tipo"], l["pedido_id"], l["chave"]): l["causa"] for l in csv.DictReader(f)}

    resultado = json.loads((args.saida / "resultado.json").read_text(encoding="utf-8"))
    causas = {e["divergencia_id"]: e["causa_provavel"] for e in resultado["explicacoes"]}
    encontrados = {}
    for d in resultado["divergencias"]:
        encontrados[identificador(d["tipo"], d["pedido_id"], d["chaves"][0] if d["chaves"] else None)] = causas.get(d["id"])

    por_tipo = defaultdict(lambda: {"plantadas": 0, "achadas": 0, "acertos": 0, "falsos": 0})
    for ident in gabarito:
        por_tipo[ident[0]]["plantadas"] += 1
        if ident in encontrados:
            por_tipo[ident[0]]["achadas"] += 1
    for ident in encontrados:
        if ident not in gabarito:
            por_tipo[ident[0]]["falsos"] += 1
    certas = [i for i in gabarito if i in encontrados]
    causa_ok = sum(1 for i in certas if encontrados[i] == gabarito[i])
    for i in certas:
        if encontrados[i] == gabarito[i]:
            por_tipo[i[0]]["acertos"] += 1

    vp = len(certas)
    fp = sum(v["falsos"] for v in por_tipo.values())
    recall = vp / len(gabarito) if gabarito else 1.0
    precisao = vp / (vp + fp) if vp + fp else 1.0

    print(f"Explicações avaliadas: {resultado['origem_explicacoes']}\n")
    print(f"{'Tipo':<24}{'Plantadas':>10}{'Achadas':>9}{'Falsos +':>10}{'Causa certa':>13}")
    for tipo in sorted(por_tipo):
        v = por_tipo[tipo]
        print(f"{tipo:<24}{v['plantadas']:>10}{v['achadas']:>9}{v['falsos']:>10}{v['acertos']:>10}/{v['achadas']}")
    print(f"\nDetecção  → recall {recall:.0%} ({vp}/{len(gabarito)}), precisão {precisao:.0%} ({vp}/{vp + fp})")
    print(f"Explicação → causa certa em {causa_ok}/{vp} ({causa_ok / vp:.0%})" if vp else "")


if __name__ == "__main__":
    main()
