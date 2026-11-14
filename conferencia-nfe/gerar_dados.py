"""Gera dados FICTÍCIOS de um restaurante: pedidos.csv, XMLs de notas e o gabarito das divergências.

Os erros são inseridos de propósito e anotados em gabarito.csv, para medir se o
conferidor encontra todos (e só eles). Uso: python gerar_dados.py [pasta] [semente]
"""
import csv
import random
import shutil
import sys
from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path

from conferencia.cruzamento import digito_verificador

CNPJ = "11222333000181"          # CNPJ de exemplo, não pertence a nenhum restaurante real
NOME = "Cantina Exemplo Ltda (fictícia)"

XML = """<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe{chave}" versao="4.00">
      <ide><cUF>31</cUF><mod>65</mod><serie>1</serie><nNF>{numero}</nNF><dhEmi>{emissao}</dhEmi></ide>
      <emit><CNPJ>{cnpj}</CNPJ><xNome>{nome}</xNome></emit>
      <total><ICMSTot><vProd>{vprod}</vProd><vDesc>{vdesc}</vDesc><vFrete>{vfrete}</vFrete><vNF>{vnf}</vNF></ICMSTot></total>
      <infAdic><infCpl>{complemento}</infCpl></infAdic>
    </infNFe>
  </NFe>
  <protNFe versao="4.00"><infProt><chNFe>{chave}</chNFe><cStat>{cstat}</cStat></infProt></protNFe>
</nfeProc>
"""


def dinheiro(valor) -> Decimal:
    return Decimal(valor).quantize(Decimal("0.01"))


def montar_chave(numero: int, emissao: datetime, rnd: random.Random) -> str:
    base = (f"31{emissao:%y%m}{CNPJ}65001{numero:09d}1{rnd.randint(0, 99999999):08d}")
    return base + str(digito_verificador(base))


def main(pasta: Path, semente: int = 7) -> None:
    rnd = random.Random(semente)
    if pasta.exists():
        shutil.rmtree(pasta)
    (pasta / "notas").mkdir(parents=True)

    pedidos, gabarito = [], []
    numero_nota = 1000
    inicio = datetime(2026, 11, 2, 11, 0)

    def emitir(pedido, *, vprod, vdesc, vfrete, vnf, cstat="100", complemento=None, chave_errada=False):
        nonlocal numero_nota
        numero_nota += 1
        emissao = pedido["data_hora"] + timedelta(minutes=rnd.randint(1, 20))
        chave = montar_chave(numero_nota, emissao, rnd)
        if chave_errada:
            chave = chave[:43] + str((int(chave[43]) + 1) % 10)
        texto = complemento if complemento is not None else f"Pedido #{pedido['pedido_id']} - venda por aplicativo"
        (pasta / "notas" / f"nfce_{numero_nota}.xml").write_text(XML.format(
            chave=chave, numero=numero_nota, emissao=emissao.isoformat(), cnpj=CNPJ, nome=NOME,
            vprod=vprod, vdesc=vdesc, vfrete=vfrete, vnf=vnf, complemento=texto, cstat=cstat), encoding="utf-8")
        return chave

    def nota_correta(p, **extra):
        return emitir(p, vprod=p["subtotal"], vdesc=p["desconto_loja"], vfrete=p["taxa_entrega"], vnf=p["valor_total"], **extra)

    # Plano: o que acontece com cada pedido. A maioria é normal; alguns recebem um erro conhecido.
    plano = (["ok"] * 96 + ["sem_nota"] * 4 + ["cancelada"] * 2 + ["desconto"] * 3 + ["taxa"] * 3
             + ["outra"] * 1 + ["duplicada"] * 2 + ["pedido_cancelado_com_nota"] * 2 + ["chave_errada"] * 2
             + ["substituida"] * 2 + ["pedido_cancelado_ok"] * 3)
    rnd.shuffle(plano)

    for i, caso in enumerate(plano):
        subtotal = dinheiro(rnd.uniform(28, 160))
        desconto = dinheiro(rnd.choice([0, 0, 0, 5, 8, 10, 12.5])) if caso != "desconto" else dinheiro(rnd.choice([5, 10, 15]))
        taxa = dinheiro(rnd.choice([0, 4.99, 6.99, 7.5, 9.9])) if caso != "taxa" else dinheiro(rnd.choice([5.99, 7.99, 8.5]))
        p = {
            "pedido_id": f"{48100 + i}",
            "data_hora": inicio + timedelta(days=i // 18, minutes=(i % 18) * 37),
            "subtotal": subtotal, "desconto_loja": desconto, "taxa_entrega": taxa,
            "valor_total": subtotal - desconto + taxa,
            "status": "CANCELADO" if caso.startswith("pedido_cancelado") else "CONCLUIDO",
        }
        pedidos.append(p)
        pid = p["pedido_id"]

        if caso == "ok":
            nota_correta(p)
        elif caso == "sem_nota":
            gabarito.append(("PEDIDO_SEM_NOTA", pid, "", "nota_nao_emitida"))
        elif caso == "cancelada":
            nota_correta(p, cstat="101")
            gabarito.append(("NOTA_CANCELADA", pid, "", "nota_cancelada_sem_substituta"))
        elif caso == "substituida":          # armadilha: cancelou e emitiu outra. Está correto.
            nota_correta(p, cstat="101")
            nota_correta(p)
        elif caso == "desconto":             # nota ignorou o desconto: sai mais cara
            emitir(p, vprod=subtotal, vdesc=dinheiro(0), vfrete=taxa, vnf=subtotal + taxa)
            gabarito.append(("VALOR_DIVERGENTE", pid, "", "desconto_fora_da_nota"))
        elif caso == "taxa":                 # nota sem a taxa de entrega: sai mais barata
            emitir(p, vprod=subtotal, vdesc=desconto, vfrete=dinheiro(0), vnf=subtotal - desconto)
            gabarito.append(("VALOR_DIVERGENTE", pid, "", "taxa_entrega_fora_da_nota"))
        elif caso == "outra":                # item a mais digitado no emissor
            extra = dinheiro(3.5)
            emitir(p, vprod=subtotal + extra, vdesc=desconto, vfrete=taxa, vnf=p["valor_total"] + extra)
            gabarito.append(("VALOR_DIVERGENTE", pid, "", "outra"))
        elif caso == "duplicada":
            nota_correta(p)
            nota_correta(p)
            gabarito.append(("NOTA_DUPLICADA", pid, "", "emissao_em_duplicidade"))
        elif caso == "pedido_cancelado_com_nota":
            nota_correta(p)
            gabarito.append(("NOTA_PEDIDO_CANCELADO", pid, "", "pedido_cancelado_apos_emissao"))
        elif caso == "pedido_cancelado_ok":  # armadilha: pedido e nota cancelados. Está correto.
            if rnd.random() < 0.5:
                nota_correta(p, cstat="101")
        elif caso == "chave_errada":
            chave = nota_correta(p, chave_errada=True)
            gabarito.append(("CHAVE_INVALIDA", pid, chave, "chave_digitada_ou_gerada_errada"))

    # Duas notas avulsas sem pedido correspondente.
    for _ in range(2):
        falso = {"pedido_id": "", "data_hora": inicio + timedelta(days=rnd.randint(0, 5), hours=3)}
        valor = dinheiro(rnd.uniform(30, 90))
        chave = emitir(falso, vprod=valor, vdesc=dinheiro(0), vfrete=dinheiro(0), vnf=valor, complemento="Venda balcão")
        gabarito.append(("NOTA_SEM_PEDIDO", "", chave, "nota_sem_vinculo_com_pedido"))

    with open(pasta / "pedidos.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["pedido_id", "data_hora", "subtotal", "desconto_loja", "taxa_entrega", "valor_total", "status"])
        for p in pedidos:
            w.writerow([p["pedido_id"], p["data_hora"].isoformat(), p["subtotal"], p["desconto_loja"],
                        p["taxa_entrega"], p["valor_total"], p["status"]])

    with open(pasta / "gabarito.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["tipo", "pedido_id", "chave", "causa"])
        w.writerows(gabarito)

    print(f"{len(pedidos)} pedidos, {numero_nota - 1000} notas e {len(gabarito)} divergências plantadas em {pasta}/")


if __name__ == "__main__":
    main(Path(sys.argv[1] if len(sys.argv) > 1 else "dados"), int(sys.argv[2]) if len(sys.argv) > 2 else 7)
