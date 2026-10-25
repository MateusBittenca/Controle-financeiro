import { montarDashboard, type LancamentoTela, type MesDashboard, type MesDisponivel } from '../dashboard/ler-mes.js';
import { rotuloMes } from '../parsers/valores.js';
import { numeroDoBanco, pool } from './cliente.js';

export async function listarTodosLancamentos(): Promise<{ anoMes: string; lancamento: LancamentoTela }[]> {
  const resultado = await pool.query<LinhaLancamento & { ano_mes: string }>(
    `SELECT id, ano_mes, data, descricao, valor, valor_mensal_equivalente, origem, categoria, tipo_de_item, motivo, observacao
     FROM lancamentos
     ORDER BY ano_mes, data, descricao`,
  );
  return resultado.rows.map((linha) => ({
    anoMes: linha.ano_mes.trim(),
    lancamento: paraTela(linha),
  }));
}

export async function listarMesesNoBanco(): Promise<MesDisponivel[]> {
  const resultado = await pool.query<{ ano_mes: string }>(
    'SELECT DISTINCT ano_mes FROM lancamentos ORDER BY ano_mes DESC',
  );
  return resultado.rows.map((linha) => ({
    anoMes: linha.ano_mes.trim(),
    rotulo: rotuloMes(linha.ano_mes.trim()),
  }));
}

export async function lerMesNoBanco(anoMes: string): Promise<MesDashboard | null> {
  const resultado = await pool.query<LinhaLancamento>(
    `SELECT id, data, descricao, valor, valor_mensal_equivalente, origem, categoria, tipo_de_item, motivo, observacao
     FROM lancamentos
     WHERE ano_mes = $1
     ORDER BY data, descricao`,
    [anoMes],
  );
  if (resultado.rows.length === 0) return null;
  return montarDashboard(anoMes, resultado.rows.map(paraTela));
}

export async function substituirMes(anoMes: string, lancamentos: LancamentoTela[]): Promise<number> {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('DELETE FROM lancamentos WHERE ano_mes = $1', [anoMes]);
    for (const item of lancamentos) {
      await cliente.query(
        `INSERT INTO lancamentos
          (ano_mes, data, descricao, valor, valor_mensal_equivalente, origem, categoria, tipo_de_item, motivo, observacao)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          anoMes,
          item.data,
          item.descricao,
          item.valor,
          item.valorMensalEquivalente,
          item.origem,
          item.categoria,
          item.tipoDeItem,
          item.motivo,
          item.observacao,
        ],
      );
    }
    await cliente.query('COMMIT');
    return lancamentos.length;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

export async function responderLancamento(
  anoMes: string,
  id: number,
  campos: { motivo?: string; observacao?: string },
): Promise<boolean> {
  const atribuicoes: string[] = [];
  const valores: unknown[] = [];
  if (campos.motivo !== undefined) {
    valores.push(campos.motivo.trim());
    atribuicoes.push(`motivo = $${valores.length}`);
  }
  if (campos.observacao !== undefined) {
    valores.push(campos.observacao.trim());
    atribuicoes.push(`observacao = $${valores.length}`);
  }
  if (atribuicoes.length === 0) return false;
  valores.push(id, anoMes);
  const resultado = await pool.query(
    `UPDATE lancamentos SET ${atribuicoes.join(', ')} WHERE id = $${valores.length - 1} AND ano_mes = $${valores.length}`,
    valores,
  );
  return (resultado.rowCount ?? 0) > 0;
}

export async function atualizarLancamento(
  anoMes: string,
  id: number,
  item: LancamentoTela,
  anoMesNovo: string,
): Promise<boolean> {
  const resultado = await pool.query(
    `UPDATE lancamentos SET
      ano_mes = $1, data = $2, descricao = $3, valor = $4, valor_mensal_equivalente = $5,
      origem = $6, categoria = $7, tipo_de_item = $8, motivo = $9, observacao = $10
     WHERE id = $11 AND ano_mes = $12`,
    [
      anoMesNovo,
      item.data,
      item.descricao,
      item.valor,
      item.valorMensalEquivalente,
      item.origem,
      item.categoria,
      item.tipoDeItem,
      item.motivo,
      item.observacao,
      id,
      anoMes,
    ],
  );
  return (resultado.rowCount ?? 0) > 0;
}

export async function excluirLancamento(anoMes: string, id: number): Promise<boolean> {
  const resultado = await pool.query('DELETE FROM lancamentos WHERE id = $1 AND ano_mes = $2', [id, anoMes]);
  return (resultado.rowCount ?? 0) > 0;
}

export async function contarGastosIguais(
  data: string,
  descricao: string,
  valor: number,
  origem: string,
  ignorarId?: number,
): Promise<number> {
  const resultado = await pool.query<{ quantidade: number }>(
    `SELECT COUNT(*)::int AS quantidade
     FROM lancamentos
     WHERE data = $1 AND descricao = $2 AND valor = $3 AND origem = $4
       AND ($5::bigint IS NULL OR id <> $5)`,
    [data, descricao, valor, origem, ignorarId ?? null],
  );
  return resultado.rows[0]?.quantidade ?? 0;
}

export async function inserirLancamento(anoMes: string, item: LancamentoTela): Promise<number> {
  const resultado = await pool.query<{ id: string }>(
    `INSERT INTO lancamentos
      (ano_mes, data, descricao, valor, valor_mensal_equivalente, origem, categoria, tipo_de_item, motivo, observacao)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      anoMes,
      item.data,
      item.descricao,
      item.valor,
      item.valorMensalEquivalente,
      item.origem,
      item.categoria,
      item.tipoDeItem,
      item.motivo,
      item.observacao,
    ],
  );
  const id = resultado.rows[0]?.id;
  if (id === undefined) throw new Error('Não foi possível gravar o gasto.');
  return Number(id);
}

interface LinhaLancamento {
  id?: string | number;
  data: string;
  descricao: string;
  valor: string;
  valor_mensal_equivalente: string | null;
  origem: string;
  categoria: string;
  tipo_de_item: string;
  motivo: string;
  observacao: string;
}

function paraTela(linha: LinhaLancamento): LancamentoTela {
  const valor = numeroDoBanco(linha.valor);
  const equivalente = linha.valor_mensal_equivalente === null ? null : numeroDoBanco(linha.valor_mensal_equivalente);
  return {
    id: linha.id === undefined ? undefined : Number(linha.id),
    data: linha.data,
    descricao: linha.descricao,
    valor,
    valorMensalEquivalente: equivalente,
    valorConsiderado: equivalente ?? valor,
    origem: linha.origem,
    categoria: linha.categoria,
    tipoDeItem: linha.tipo_de_item,
    motivo: linha.motivo,
    observacao: linha.observacao,
  };
}
