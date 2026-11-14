"""Estruturas de dados usadas em todo o projeto."""
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal


@dataclass
class Pedido:
    pedido_id: str
    data_hora: datetime
    subtotal: Decimal          # soma dos itens
    desconto_loja: Decimal     # desconto bancado pelo restaurante
    taxa_entrega: Decimal
    valor_total: Decimal       # o que o cliente pagou
    status: str                # CONCLUIDO ou CANCELADO


@dataclass
class Nota:
    chave: str                 # chave de acesso de 44 dígitos
    numero: int
    emissao: datetime
    valor: Decimal             # vNF: valor total da nota
    desconto: Decimal          # vDesc
    frete: Decimal             # vFrete (taxa de entrega)
    pedido_id: str | None      # lido do campo de informações complementares
    situacao: str              # AUTORIZADA ou CANCELADA
    arquivo: str


@dataclass
class Divergencia:
    id: str                    # identificador estável, ex.: "D03"
    tipo: str                  # ver TIPOS abaixo
    pedido_id: str | None
    chaves: list[str]
    fatos: dict = field(default_factory=dict)   # números calculados pelo código


TIPOS = {
    "PEDIDO_SEM_NOTA": "Pedido concluído sem nota autorizada",
    "NOTA_CANCELADA": "Pedido concluído, mas a única nota está cancelada",
    "VALOR_DIVERGENTE": "Valor da nota diferente do valor do pedido",
    "NOTA_DUPLICADA": "Mais de uma nota autorizada para o mesmo pedido",
    "NOTA_SEM_PEDIDO": "Nota que não corresponde a nenhum pedido",
    "NOTA_PEDIDO_CANCELADO": "Nota autorizada para um pedido cancelado",
    "CHAVE_INVALIDA": "Chave de acesso com dígito verificador errado",
}
