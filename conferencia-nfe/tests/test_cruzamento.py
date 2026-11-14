from datetime import datetime
from decimal import Decimal as D

from conferencia.cruzamento import chave_valida, conferir, digito_verificador
from conferencia.modelos import Nota, Pedido

AGORA = datetime(2026, 11, 2, 12, 0)


def pedido(pid="1", total="50.00", desconto="0", taxa="0", status="CONCLUIDO"):
    total, desconto, taxa = D(total), D(desconto), D(taxa)
    return Pedido(pid, AGORA, total + desconto - taxa, desconto, taxa, total, status)


def chave(n=1):
    base = f"3126111122233300018165001{n:09d}1{12345678:08d}"
    return base + str(digito_verificador(base))


def nota(pid="1", valor="50.00", situacao="AUTORIZADA", n=1, chave_=None):
    return Nota(chave_ or chave(n), n, AGORA, D(valor), D("0"), D("0"), pid, situacao, f"{n}.xml")


def tipos(divergencias):
    return sorted(d.tipo for d in divergencias)


def test_chave_valida_e_invalida():
    c = chave()
    assert chave_valida(c)
    assert not chave_valida(c[:43] + str((int(c[43]) + 1) % 10))
    assert not chave_valida("123")


def test_tudo_certo_nao_gera_divergencia():
    assert conferir([pedido()], [nota()]) == []


def test_pedido_sem_nota():
    assert tipos(conferir([pedido()], [])) == ["PEDIDO_SEM_NOTA"]


def test_nota_cancelada_sem_substituta():
    assert tipos(conferir([pedido()], [nota(situacao="CANCELADA")])) == ["NOTA_CANCELADA"]


def test_nota_cancelada_com_substituta_esta_correto():
    assert conferir([pedido()], [nota(situacao="CANCELADA", n=1), nota(n=2)]) == []


def test_valor_divergente_guarda_os_fatos():
    [d] = conferir([pedido(total="45.00", desconto="5.00")], [nota(valor="50.00")])
    assert d.tipo == "VALOR_DIVERGENTE"
    assert d.fatos["diferenca"] == D("5.00")
    assert d.fatos["desconto_pedido"] == D("5.00")


def test_centavo_de_diferenca_conta():
    assert tipos(conferir([pedido(total="50.00")], [nota(valor="50.01")])) == ["VALOR_DIVERGENTE"]


def test_nota_duplicada():
    assert tipos(conferir([pedido()], [nota(n=1), nota(n=2)])) == ["NOTA_DUPLICADA"]


def test_nota_sem_pedido():
    assert tipos(conferir([], [nota(pid=None)])) == ["NOTA_SEM_PEDIDO"]


def test_pedido_cancelado():
    assert tipos(conferir([pedido(status="CANCELADO")], [nota()])) == ["NOTA_PEDIDO_CANCELADO"]
    assert conferir([pedido(status="CANCELADO")], [nota(situacao="CANCELADA")]) == []
    assert conferir([pedido(status="CANCELADO")], []) == []
