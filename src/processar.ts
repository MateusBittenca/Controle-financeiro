import { classificarLancamento } from './classify/classificar.js';
import { parseRelatorioCsv, type ParserRelatorio } from './parsers/csv.js';
import { anoMes } from './parsers/valores.js';
import type { Lancamento } from './types/lancamento.js';

export interface ResultadoProcessamento {
  lancamentos: Lancamento[];
  ignorados: number;
  pendencias: Lancamento[];
}

/** Lê um relatório de gastos e classifica cada lançamento. */
export function processarRelatorio(
  conteudo: string,
  parser: ParserRelatorio = parseRelatorioCsv,
): ResultadoProcessamento {
  const { itens, ignorados } = parser(conteudo);
  const lancamentos = itens.map((item) => classificarLancamento(item));
  const pendencias = lancamentos.filter((lancamento) => lancamento.precisaMotivo);
  return { lancamentos, ignorados, pendencias };
}

export function agruparPorMes(lancamentos: Lancamento[]): Map<string, Lancamento[]> {
  const grupos = new Map<string, Lancamento[]>();
  for (const lancamento of lancamentos) {
    const mes = anoMes(lancamento.data);
    const lista = grupos.get(mes);
    if (lista) lista.push(lancamento);
    else grupos.set(mes, [lancamento]);
  }
  return new Map([...grupos.entries()].sort(([esquerda], [direita]) => esquerda.localeCompare(direita)));
}
