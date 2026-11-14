"""Leitura do CSV de pedidos e dos XMLs das notas."""
import csv
import re
import xml.etree.ElementTree as ET
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from .modelos import Nota, Pedido

NS = {"nfe": "http://www.portalfiscal.inf.br/nfe"}


def ler_pedidos(caminho: Path) -> list[Pedido]:
    pedidos = []
    with open(caminho, newline="", encoding="utf-8") as f:
        for linha in csv.DictReader(f):
            pedidos.append(Pedido(
                pedido_id=linha["pedido_id"],
                data_hora=datetime.fromisoformat(linha["data_hora"]),
                subtotal=Decimal(linha["subtotal"]),
                desconto_loja=Decimal(linha["desconto_loja"]),
                taxa_entrega=Decimal(linha["taxa_entrega"]),
                valor_total=Decimal(linha["valor_total"]),
                status=linha["status"],
            ))
    return pedidos


def _texto(raiz, caminho: str, padrao: str = "") -> str:
    elem = raiz.find(caminho, NS)
    return elem.text.strip() if elem is not None and elem.text else padrao


def ler_nota(arquivo: Path) -> Nota:
    raiz = ET.parse(arquivo).getroot()
    inf = raiz.find(".//nfe:infNFe", NS)
    chave = inf.get("Id", "").removeprefix("NFe")
    complemento = _texto(inf, "nfe:infAdic/nfe:infCpl")
    achado = re.search(r"Pedido\s+#?(\w+)", complemento)
    status = _texto(raiz, ".//nfe:protNFe/nfe:infProt/nfe:cStat")
    return Nota(
        chave=chave,
        numero=int(_texto(inf, "nfe:ide/nfe:nNF", "0")),
        emissao=datetime.fromisoformat(_texto(inf, "nfe:ide/nfe:dhEmi")),
        valor=Decimal(_texto(inf, "nfe:total/nfe:ICMSTot/nfe:vNF", "0")),
        desconto=Decimal(_texto(inf, "nfe:total/nfe:ICMSTot/nfe:vDesc", "0")),
        frete=Decimal(_texto(inf, "nfe:total/nfe:ICMSTot/nfe:vFrete", "0")),
        pedido_id=achado.group(1) if achado else None,
        situacao="AUTORIZADA" if status == "100" else "CANCELADA" if status == "101" else f"OUTRA({status})",
        arquivo=arquivo.name,
    )


def ler_notas(pasta: Path) -> list[Nota]:
    return [ler_nota(arq) for arq in sorted(pasta.glob("*.xml"))]
