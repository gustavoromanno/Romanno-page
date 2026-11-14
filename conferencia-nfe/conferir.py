"""Confere pedidos x notas e gera o relatório.

Uso:
  python conferir.py --dados dados            # explicações por regras (não precisa de chave)
  python conferir.py --dados dados --ia       # explicações pelo Claude (precisa de ANTHROPIC_API_KEY)
"""
import argparse
import json
from dataclasses import asdict
from decimal import Decimal
from pathlib import Path

from conferencia.cruzamento import conferir
from conferencia.explicacao import explicar
from conferencia.leitura import ler_notas, ler_pedidos
from conferencia.relatorio import gerar_html


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dados", type=Path, default=Path("dados"), help="pasta com pedidos.csv e notas/")
    ap.add_argument("--ia", action="store_true", help="usar o Claude para explicar as divergências")
    ap.add_argument("--saida", type=Path, default=Path("saida"), help="pasta para relatorio.html e resultado.json")
    args = ap.parse_args()

    pedidos = ler_pedidos(args.dados / "pedidos.csv")
    notas = ler_notas(args.dados / "notas")
    divergencias = conferir(pedidos, notas)
    explicacoes, origem = explicar(divergencias, usar_ia=args.ia)

    args.saida.mkdir(parents=True, exist_ok=True)
    (args.saida / "relatorio.html").write_text(
        gerar_html(divergencias, explicacoes, origem, len(pedidos), len(notas)), encoding="utf-8")
    resultado = {
        "origem_explicacoes": origem,
        "divergencias": [asdict(d) for d in divergencias],
        "explicacoes": [e.model_dump() for e in explicacoes],
    }
    (args.saida / "resultado.json").write_text(
        json.dumps(resultado, ensure_ascii=False, indent=1, default=lambda v: str(v) if isinstance(v, Decimal) else v),
        encoding="utf-8")

    print(f"{len(pedidos)} pedidos, {len(notas)} notas, {len(divergencias)} divergências.")
    print(f"Explicações: {origem}")
    print(f"Relatório: {args.saida / 'relatorio.html'}")


if __name__ == "__main__":
    main()
