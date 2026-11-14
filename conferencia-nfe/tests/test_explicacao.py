"""Testa a integração com o Claude sem chamar a API (cliente falso)."""
from decimal import Decimal as D
from types import SimpleNamespace

import anthropic

from conferencia import explicacao
from conferencia.explicacao import Explicacao, Resposta, explicar, explicar_por_regras
from conferencia.modelos import Divergencia

DIVS = [
    Divergencia("D01", "PEDIDO_SEM_NOTA", "48100", [], {"valor_pedido": D("50.00")}),
    Divergencia("D02", "VALOR_DIVERGENTE", "48101", ["1" * 44], {
        "valor_pedido": D("45.00"), "valor_nota": D("50.00"), "diferenca": D("5.00"),
        "desconto_pedido": D("5.00"), "desconto_nota": D("0"), "taxa_entrega_pedido": D("0"), "frete_nota": D("0")}),
]


class ClienteFalso:
    def __init__(self, resposta):
        self.chamadas = []
        self.messages = SimpleNamespace(parse=self._parse)
        self._resposta = resposta

    def _parse(self, **kwargs):
        self.chamadas.append(kwargs)
        return self._resposta


def test_regras_identificam_desconto_fora_da_nota():
    assert explicar_por_regras(DIVS[1]).causa_provavel == "desconto_fora_da_nota"


def test_ia_completa_divergencias_que_ela_pulou(monkeypatch):
    so_uma = Resposta(explicacoes=[Explicacao(divergencia_id="D02", prioridade="alta",
                                              causa_provavel="desconto_fora_da_nota",
                                              explicacao="x", acao="y")])
    falso = ClienteFalso(SimpleNamespace(stop_reason="end_turn", parsed_output=so_uma))
    monkeypatch.setattr(anthropic, "Anthropic", lambda: falso)

    resultado, origem = explicar(DIVS, usar_ia=True)

    assert [e.divergencia_id for e in resultado] == ["D01", "D02"]
    assert resultado[0].causa_provavel == "nota_nao_emitida"      # veio das regras
    assert "1 completadas por regras" in origem
    chamada = falso.chamadas[0]
    assert chamada["output_format"] is Resposta
    assert chamada["model"] == explicacao.MODELO
    assert '"diferenca": "5.00"' in chamada["messages"][0]["content"]


def test_recusa_volta_para_regras(monkeypatch):
    falso = ClienteFalso(SimpleNamespace(stop_reason="refusal", parsed_output=None))
    monkeypatch.setattr(anthropic, "Anthropic", lambda: falso)
    resultado, origem = explicar(DIVS, usar_ia=True)
    assert origem.startswith("regras")
    assert len(resultado) == 2
