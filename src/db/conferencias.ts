import crypto from 'node:crypto';
import { conferirImportacao, type Conferencia } from '../dashboard/conferir.js';
import { lerConteudoPlanilha, montarDashboard, type MesDashboard } from '../dashboard/ler-mes.js';
import { rotuloMes } from '../parsers/valores.js';
import { listarTodosLancamentos, lerMesNoBanco, substituirMes } from './lancamentos.js';

const PRAZO_MS = 30 * 60 * 1000;

interface Pendente {
  criadoEm: number;
  anoMes: string;
  resultadoSeguro: Conferencia['resultadoSeguro'];
  resultadoComOutrosMeses: Conferencia['resultadoComOutrosMeses'];
  resultadoSubstituicao: Conferencia['resultadoSubstituicao'];
}

const pendentes = new Map<string, Pendente>();

export type ConferenciaVisivel = { id: string } & Omit<
  Conferencia,
  'resultadoSeguro' | 'resultadoComOutrosMeses' | 'resultadoSubstituicao'
>;

export async function abrirConferencia(nomeArquivo: string, conteudo: Buffer): Promise<ConferenciaVisivel> {
  const mes = await lerConteudoPlanilha(conteudo, nomeArquivo);
  const todos = await listarTodosLancamentos();
  const doMes = todos.filter((item) => item.anoMes === mes.anoMes).map((item) => item.lancamento);
  const grupos = new Map<string, { anoMes: string; rotulo: string; lancamentos: typeof doMes }>();
  for (const item of todos) {
    if (item.anoMes === mes.anoMes) continue;
    const grupo = grupos.get(item.anoMes) ?? { anoMes: item.anoMes, rotulo: rotuloMes(item.anoMes), lancamentos: [] };
    grupo.lancamentos.push(item.lancamento);
    grupos.set(item.anoMes, grupo);
  }

  const conferencia = conferirImportacao(nomeArquivo, mes.anoMes, mes.rotulo, mes.lancamentos, doMes, [...grupos.values()]);
  const id = crypto.randomBytes(16).toString('hex');
  pendentes.set(id, {
    criadoEm: Date.now(),
    anoMes: conferencia.anoMes,
    resultadoSeguro: conferencia.resultadoSeguro,
    resultadoComOutrosMeses: conferencia.resultadoComOutrosMeses,
    resultadoSubstituicao: conferencia.resultadoSubstituicao,
  });

  return {
    id,
    anoMes: conferencia.anoMes,
    rotulo: conferencia.rotulo,
    nomeArquivo: conferencia.nomeArquivo,
    quantidadePlanilha: conferencia.quantidadePlanilha,
    quantidadeBanco: conferencia.quantidadeBanco,
    iguais: conferencia.iguais,
    novos: conferencia.novos,
    alterados: conferencia.alterados,
    soNoBanco: conferencia.soNoBanco,
    emOutroMes: conferencia.emOutroMes,
    repetidosNaPlanilha: conferencia.repetidosNaPlanilha,
  };
}

export async function confirmarConferencia(
  id: string,
  acao: 'gravar' | 'substituir',
  incluirOutrosMeses: boolean,
): Promise<MesDashboard> {
  const pendente = pegar(id);
  const lancamentos =
    acao === 'substituir'
      ? pendente.resultadoSubstituicao
      : incluirOutrosMeses
        ? pendente.resultadoComOutrosMeses
        : pendente.resultadoSeguro;
  await substituirMes(pendente.anoMes, lancamentos);
  pendentes.delete(id);
  return (await lerMesNoBanco(pendente.anoMes)) ?? montarDashboard(pendente.anoMes, []);
}

function pegar(id: string): Pendente {
  limparVencidas();
  const pendente = pendentes.get(id);
  if (!pendente) throw new Error('Essa conferência expirou. Envie a planilha de novo.');
  return pendente;
}

function limparVencidas(): void {
  const agora = Date.now();
  for (const [id, pendente] of pendentes) {
    if (agora - pendente.criadoEm > PRAZO_MS) pendentes.delete(id);
  }
}

