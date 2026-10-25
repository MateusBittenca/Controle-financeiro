import fs from 'node:fs';
import path from 'node:path';
import { diretorioPlanilhas } from './dashboard/ler-mes.js';
import { abrirConferencia, confirmarConferencia } from './db/conferencias.js';
import { pool } from './db/cliente.js';

async function arquivosDaEntrada(argumentos: string[]): Promise<string[]> {
  if (argumentos.length > 0) return argumentos.map((item) => path.resolve(item));

  const diretorio = diretorioPlanilhas();
  let nomes: string[] = [];
  try {
    nomes = await fs.promises.readdir(diretorio);
  } catch (erro) {
    if (erro instanceof Error && 'code' in erro && erro.code === 'ENOENT') return [];
    throw erro;
  }
  return nomes
    .filter((nome) => /^gastos-\d{4}-\d{2}\.xlsx$/i.test(nome))
    .sort()
    .map((nome) => path.join(diretorio, nome));
}

async function main(): Promise<void> {
  const arquivos = await arquivosDaEntrada(process.argv.slice(2));
  if (arquivos.length === 0) {
    console.error('Nenhuma planilha para importar. Use: npm run importar -- data/planilhas/gastos-AAAA-MM.xlsx');
    process.exitCode = 1;
    return;
  }

  for (const arquivo of arquivos) {
    const conferencia = await abrirConferencia(path.basename(arquivo), await fs.promises.readFile(arquivo));
    const novos = conferencia.novos.length;
    const atualizacoes = conferencia.alterados.length;
    console.log(
      `${conferencia.rotulo}: ${conferencia.quantidadePlanilha} na planilha, ${conferencia.iguais} já no banco, ${novos} novos, ${atualizacoes} atualizações.`,
    );
    if (conferencia.emOutroMes.length > 0) {
      console.log(`${conferencia.emOutroMes.length} já aparecem em outro mês e não foram gravados de novo.`);
    }
    if (conferencia.soNoBanco.length > 0) {
      console.log(`${conferencia.soNoBanco.length} estão só no banco e foram mantidos.`);
    }
    await confirmarConferencia(conferencia.id, 'gravar', false);
  }
}

main()
  .catch((erro: unknown) => {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    console.error(
      mensagem.includes('ECONNREFUSED') || mensagem.includes('timeout')
        ? 'Não foi possível conectar ao banco. Rode docker compose up -d na pasta do projeto.'
        : mensagem,
    );
    process.exitCode = 1;
  })
  .finally(() => pool.end());
