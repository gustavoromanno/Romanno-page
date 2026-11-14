"""Regras de conferência. Tudo aqui é determinístico: nenhuma IA decide se há divergência."""
from collections import defaultdict
from decimal import Decimal

from .modelos import Divergencia, Nota, Pedido


def digito_verificador(chave43: str) -> int:
    """Módulo 11 da chave de acesso da NF-e (pesos 2 a 9, da direita para a esquerda)."""
    soma, peso = 0, 2
    for digito in reversed(chave43):
        soma += int(digito) * peso
        peso = 2 if peso == 9 else peso + 1
    resto = soma % 11
    return 0 if resto < 2 else 11 - resto


def chave_valida(chave: str) -> bool:
    return len(chave) == 44 and chave.isdigit() and digito_verificador(chave[:43]) == int(chave[43])


def conferir(pedidos: list[Pedido], notas: list[Nota]) -> list[Divergencia]:
    achados: list[tuple] = []
    por_pedido: dict[str, list[Nota]] = defaultdict(list)
    ids_pedidos = {p.pedido_id for p in pedidos}

    for nota in notas:
        if not chave_valida(nota.chave):
            achados.append(("CHAVE_INVALIDA", nota.pedido_id, [nota.chave], {"arquivo": nota.arquivo}))
        if nota.pedido_id in ids_pedidos:
            por_pedido[nota.pedido_id].append(nota)
        elif nota.situacao == "AUTORIZADA":
            achados.append(("NOTA_SEM_PEDIDO", nota.pedido_id, [nota.chave],
                            {"valor_nota": nota.valor, "texto_pedido_na_nota": nota.pedido_id}))

    for pedido in pedidos:
        notas_pedido = por_pedido.get(pedido.pedido_id, [])
        autorizadas = [n for n in notas_pedido if n.situacao == "AUTORIZADA"]
        canceladas = [n for n in notas_pedido if n.situacao == "CANCELADA"]

        if pedido.status == "CANCELADO":
            if autorizadas:
                achados.append(("NOTA_PEDIDO_CANCELADO", pedido.pedido_id, [n.chave for n in autorizadas],
                                {"valor_nota": autorizadas[0].valor}))
            continue

        if not autorizadas:
            tipo = "NOTA_CANCELADA" if canceladas else "PEDIDO_SEM_NOTA"
            achados.append((tipo, pedido.pedido_id, [n.chave for n in canceladas],
                            {"valor_pedido": pedido.valor_total}))
            continue

        if len(autorizadas) > 1:
            achados.append(("NOTA_DUPLICADA", pedido.pedido_id, [n.chave for n in autorizadas],
                            {"valor_pedido": pedido.valor_total, "qtd_notas": len(autorizadas)}))

        nota = autorizadas[0]
        diferenca = nota.valor - pedido.valor_total
        if abs(diferenca) >= Decimal("0.01"):
            achados.append(("VALOR_DIVERGENTE", pedido.pedido_id, [nota.chave], {
                "valor_pedido": pedido.valor_total,
                "valor_nota": nota.valor,
                "diferenca": diferenca,
                "desconto_pedido": pedido.desconto_loja,
                "desconto_nota": nota.desconto,
                "taxa_entrega_pedido": pedido.taxa_entrega,
                "frete_nota": nota.frete,
            }))

    return [Divergencia(id=f"D{i:02d}", tipo=t, pedido_id=p, chaves=c, fatos=f)
            for i, (t, p, c, f) in enumerate(achados, start=1)]
