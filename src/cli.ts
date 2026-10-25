import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { agruparPorMes, processarRelatorio } from './processar.js';
import { formatarDataBr, rotuloMes } from './parsers/valores.js';
import { formatarReais } from './rules/dinheiro.js';
import { atualizarPlanilhaDoMes } from './spreadsheet/excel.js';
import { ROTULO_ORIGEM, type Origem } from './types/categorias.js';
import type { Lancamento } from './types/lancamento.js';

function raizDoProjeto(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function linhaPendencia(item: Lancamento): string {
  const origem: Origem = item.origem;
  return `  ${formatarDataBr(item.data)}  ${ROTULO_ORIGEM[origem]}  ${formatarReais(item.valor)}  ${item.descricao}`;
}

async function main(): Promise<void> {
  const argumento = process.argv[2];
  if (!argumento) {
    console.error('Uso: npm run processar -- data/entrada/arquivo.csv');
    process.exitCode = 1;
    return;
  }

  const caminho = path.resolve(process.cwd(), argumento);
  if (!fs.existsSync(caminho)) {
    console.error(`Arquivo não encontrado: ${caminho}`);
    process.exitCode = 1;
    return;
  }

  const conteudo = fs.readFileSync(caminho, 'utf8');
  const resultado = processarRelatorio(conteudo);
  const diretorio = path.join(raizDoProjeto(), 'data', 'planilhas');
  const grupos = agruparPorMes(resultado.lancamentos);

  if (grupos.size === 0) {
    console.log('Nenhum gasto para lançar.');
    console.log(`Pagamentos de fatura ignorados: ${resultado.ignorados}.`);
    return;
  }

  const pendencias: { mes: string; itens: Lancamento[] }[] = [];
  for (const [mes, lancamentos] of grupos) {
    const atualizacao = await atualizarPlanilhaDoMes(mes, lancamentos, diretorio);
    const novos = atualizacao.adicionados === 1 ? 'lançamento novo' : 'lançamentos novos';
    console.log(
      `${rotuloMes(mes)}: ${atualizacao.arquivo} — ${atualizacao.adicionados} ${novos} (${atualizacao.total} no mês).`,
    );
    if (atualizacao.pendencias.length > 0) pendencias.push({ mes, itens: atualizacao.pendencias });
  }

  console.log(`Pagamentos de fatura ignorados: ${resultado.ignorados}.`);

  if (pendencias.length === 0) {
    console.log('Nenhuma compra na Sodexo pendente de motivo.');
    return;
  }

  console.log('');
  console.log('Pendências — por que você fez estas compras na Sodexo?');
  for (const grupo of pendencias) {
    console.log(rotuloMes(grupo.mes));
    for (const item of grupo.itens) console.log(linhaPendencia(item));
  }
  console.log('Preencha a coluna Motivo na planilha do mês.');
}

main().catch((erro: unknown) => {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  console.error(mensagem);
  process.exitCode = 1;
});
