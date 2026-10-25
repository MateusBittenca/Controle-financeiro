import type { LancamentoTela } from './ler-mes.js';

export interface AlteracaoConferencia {
  antes: LancamentoTela;
  depois: LancamentoTela;
  campos: string[];
}

export interface DuplicataOutroMes {
  lancamento: LancamentoTela;
  anoMes: string;
  rotulo: string;
}

export interface RepeticaoPlanilha {
  lancamento: LancamentoTela;
  vezes: number;
}

export interface Conferencia {
  anoMes: string;
  rotulo: string;
  nomeArquivo: string;
  quantidadePlanilha: number;
  quantidadeBanco: number;
  iguais: number;
  novos: LancamentoTela[];
  alterados: AlteracaoConferencia[];
  soNoBanco: LancamentoTela[];
  emOutroMes: DuplicataOutroMes[];
  repetidosNaPlanilha: RepeticaoPlanilha[];
  resultadoSeguro: LancamentoTela[];
  resultadoComOutrosMeses: LancamentoTela[];
  resultadoSubstituicao: LancamentoTela[];
}

interface MesExistente {
  anoMes: string;
  rotulo: string;
  lancamentos: LancamentoTela[];
}

const CAMPOS: { chave: keyof LancamentoTela; rotulo: string }[] = [
  { chave: 'categoria', rotulo: 'Categoria' },
  { chave: 'tipoDeItem', rotulo: 'Tipo de item' },
  { chave: 'motivo', rotulo: 'Motivo' },
  { chave: 'observacao', rotulo: 'Observação' },
  { chave: 'valorMensalEquivalente', rotulo: 'Valor mensal equivalente' },
];

export function conferirImportacao(
  nomeArquivo: string,
  anoMes: string,
  rotulo: string,
  planilha: LancamentoTela[],
  banco: LancamentoTela[],
  outros: MesExistente[],
): Conferencia {
  const restantes = banco.map((lancamento) => ({ lancamento, usado: false }));
  const iguais: LancamentoTela[] = [];
  const semExato: LancamentoTela[] = [];

  for (const item of planilha) {
    const achado = restantes.find((candidato) => !candidato.usado && chaveExata(candidato.lancamento) === chaveExata(item));
    if (!achado) {
      semExato.push(item);
      continue;
    }
    achado.usado = true;
    iguais.push(item);
  }

  const alterados: AlteracaoConferencia[] = [];
  const semGasto: LancamentoTela[] = [];
  for (const item of semExato) {
    const achado = restantes.find((candidato) => !candidato.usado && chaveGasto(candidato.lancamento) === chaveGasto(item));
    if (!achado) {
      semGasto.push(item);
      continue;
    }
    achado.usado = true;
    alterados.push({ antes: achado.lancamento, depois: item, campos: camposDiferentes(achado.lancamento, item) });
  }

  const outrosRestantes = outros.flatMap((mes) =>
    mes.lancamentos.map((lancamento) => ({ lancamento, anoMes: mes.anoMes, rotulo: mes.rotulo, usado: false })),
  );
  const emOutroMes: DuplicataOutroMes[] = [];
  const novos: LancamentoTela[] = [];
  for (const item of semGasto) {
    const achado = outrosRestantes.find((candidato) => !candidato.usado && chaveGasto(candidato.lancamento) === chaveGasto(item));
    if (!achado) {
      novos.push(item);
      continue;
    }
    achado.usado = true;
    emOutroMes.push({ lancamento: item, anoMes: achado.anoMes, rotulo: achado.rotulo });
  }

  const soNoBanco = restantes.filter((candidato) => !candidato.usado).map((candidato) => candidato.lancamento);
  const atualizados = banco.map((lancamento) => {
    const alteracao = alterados.find((item) => item.antes === lancamento);
    return alteracao ? alteracao.depois : lancamento;
  });
  const resultadoSeguro = ordenar([...atualizados, ...novos]);
  const resultadoComOutrosMeses = ordenar([...resultadoSeguro, ...emOutroMes.map((item) => item.lancamento)]);

  return {
    anoMes,
    rotulo,
    nomeArquivo,
    quantidadePlanilha: planilha.length,
    quantidadeBanco: banco.length,
    iguais: iguais.length,
    novos: ordenar(novos),
    alterados,
    soNoBanco: ordenar(soNoBanco),
    emOutroMes,
    repetidosNaPlanilha: repetidos(planilha),
    resultadoSeguro,
    resultadoComOutrosMeses,
    resultadoSubstituicao: ordenar(planilha),
  };
}

function repetidos(planilha: LancamentoTela[]): RepeticaoPlanilha[] {
  const grupos = new Map<string, LancamentoTela[]>();
  for (const item of planilha) {
    const chave = chaveExata(item);
    const grupo = grupos.get(chave) ?? [];
    grupo.push(item);
    grupos.set(chave, grupo);
  }
  return [...grupos.values()]
    .filter((grupo) => grupo.length > 1)
    .map((grupo) => ({ lancamento: grupo[0] as LancamentoTela, vezes: grupo.length }));
}

function camposDiferentes(antes: LancamentoTela, depois: LancamentoTela): string[] {
  return CAMPOS.filter((campo) => !mesmoCampo(antes[campo.chave], depois[campo.chave])).map((campo) => campo.rotulo);
}

function mesmoCampo(antes: LancamentoTela[keyof LancamentoTela], depois: LancamentoTela[keyof LancamentoTela]): boolean {
  if (typeof antes === 'number' || typeof depois === 'number') return textoValor(antes) === textoValor(depois);
  return antes === depois;
}

function textoValor(valor: LancamentoTela[keyof LancamentoTela]): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number') return valor.toFixed(2);
  return String(valor);
}

function chaveGasto(item: LancamentoTela): string {
  return [item.data, item.descricao, item.valor.toFixed(2), item.origem].join('\u001f');
}

function chaveExata(item: LancamentoTela): string {
  return [
    chaveGasto(item),
    item.categoria,
    item.tipoDeItem,
    item.motivo,
    item.observacao,
    item.valorMensalEquivalente === null ? '' : item.valorMensalEquivalente.toFixed(2),
  ].join('\u001f');
}

function ordenar(lancamentos: LancamentoTela[]): LancamentoTela[] {
  return [...lancamentos].sort(
    (a, b) => a.data.localeCompare(b.data) || a.descricao.localeCompare(b.descricao, 'pt-BR') || a.valor - b.valor,
  );
}
