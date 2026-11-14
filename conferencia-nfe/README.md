# Conferência de notas fiscais para restaurantes

Agente que cruza os **pedidos de delivery** de um restaurante com os **XMLs das notas fiscais (NFC-e)** emitidas, encontra o que não bate e explica cada problema em linguagem simples, com prioridade e próximo passo.

> Todos os dados são **fictícios**, gerados por `gerar_dados.py`.

## O problema

O restaurante precisa emitir nota de cada venda. Conferir pedido por pedido se toda venda tem nota, com o valor certo e sem duplicidade, é trabalho manual. Quando um erro passa, vira problema com o fisco ou com o contador.

## Como funciona

```
pedidos.csv ─┐
             ├─► cruzamento.py ─► divergências + fatos ─► explicacao.py ─► relatório HTML
notas/*.xml ─┘    (regras em código)   (números calculados)   (Claude ou regras)
```

1. **Leitura** (`leitura.py`): lê o CSV de pedidos e os XMLs no layout da NF-e 4.00 (chave de acesso, valores do `ICMSTot`, situação no `protNFe`, número do pedido no `infCpl`).
2. **Cruzamento** (`cruzamento.py`): regras determinísticas que encontram 7 tipos de divergência:

   | Tipo | Quando |
   |---|---|
   | `PEDIDO_SEM_NOTA` | pedido concluído sem nota autorizada |
   | `NOTA_CANCELADA` | a única nota do pedido está cancelada |
   | `VALOR_DIVERGENTE` | valor da nota ≠ valor pago (a partir de R$ 0,01) |
   | `NOTA_DUPLICADA` | duas ou mais notas autorizadas para o mesmo pedido |
   | `NOTA_SEM_PEDIDO` | nota autorizada que não aponta para nenhum pedido |
   | `NOTA_PEDIDO_CANCELADO` | pedido cancelado com nota ainda autorizada |
   | `CHAVE_INVALIDA` | dígito verificador da chave (módulo 11) não confere |

3. **Explicação** (`explicacao.py`): para cada divergência, o Claude devolve **causa provável, prioridade, explicação e ação**, em saída estruturada validada por Pydantic. Sem chave de API, um modo por regras gera a mesma estrutura.

### Onde a IA entra, e onde não entra

A IA **não decide** se existe divergência: isso é regra fiscal e precisa ser exato, então fica no código e tem testes. A IA entra onde texto e julgamento ajudam: explicar o problema para quem não é contador, sugerir a causa a partir dos números e dizer o que fazer.

Proteções:
- os números vão prontos para a IA, e o prompt proíbe inventar valores;
- uma única chamada para todas as divergências, com `effort: low` (tarefa simples, custo baixo);
- se a IA recusar, falhar ou pular alguma divergência, o código completa com as regras: o relatório nunca fica incompleto.

## Avaliação

`gerar_dados.py` planta erros conhecidos e grava o gabarito. `avaliar.py` mede:
- **detecção**: recall e precisão por tipo de divergência;
- **explicação**: em quantas divergências encontradas a causa provável bate com a causa plantada.

O gerador também cria **armadilhas** que não podem ser apontadas como erro: nota cancelada e substituída por outra, e pedido cancelado com nota também cancelada.

Resultado com as regras, 5 sementes diferentes (120 pedidos, cerca de 120 notas e 21 erros plantados em cada):

| | Resultado |
|---|---|
| Detecção (recall) | 100% em todas |
| Detecção (precisão) | 100% em todas |
| Causa provável (regras) | 21/21 |

**Limites, com honestidade:** os dados são sintéticos e foram gerados junto com as regras, então 100% aqui mostra que as regras fazem o que prometem, não que elas cobrem o mundo real. Próximos passos: testar com XMLs reais anonimizados, tratar cancelamento como evento separado (como a SEFAZ faz de fato) e medir as explicações da IA contra as das regras no mesmo gabarito.

## Como rodar

```bash
pip install -r requirements.txt
python gerar_dados.py dados          # cria dados fictícios
python conferir.py --dados dados     # explicações por regras
python avaliar.py                    # mede contra o gabarito
pytest                               # testes

# com o Claude
export ANTHROPIC_API_KEY=...
python conferir.py --dados dados --ia
python avaliar.py
```

O relatório fica em `saida/relatorio.html`.

## Simplificações

- XML reduzido aos campos usados na conferência, no namespace oficial da NF-e.
- Cancelamento representado pelo `cStat 101` no próprio arquivo. Na prática, ele vem num evento separado.
- O número do pedido é lido do campo de informações complementares (`infCpl`).

## Stack

Python 3.13 · SDK da Anthropic (Claude, saída estruturada) · Pydantic · pytest
