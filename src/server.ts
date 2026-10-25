import http from 'node:http';
import path from 'node:path';
import { identidadeDoGasto, montarGastoManual } from './dashboard/gasto-manual.js';
import { montarDashboard } from './dashboard/ler-mes.js';
import { gerarPlanilhaEntrada, nomeDoArquivo } from './dashboard/exportar.js';
import { abrirConferencia, confirmarConferencia } from './db/conferencias.js';
import {
  atualizarLancamento,
  contarGastosIguais,
  excluirLancamento,
  inserirLancamento,
  listarMesesNoBanco,
  lerMesNoBanco,
  responderLancamento,
} from './db/lancamentos.js';

const porta = 8787;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    if (req.method === 'GET' && url.pathname === '/api/meses') {
      const meses = await listarMesesNoBanco();
      res.end(JSON.stringify(meses));
      return;
    }

    const detalhe = /^\/api\/meses\/(\d{4}-\d{2})$/.exec(url.pathname);
    if (req.method === 'GET' && detalhe?.[1]) {
      const mes = await lerMesNoBanco(detalhe[1]);
      if (!mes) {
        responder(res, 404, { erro: 'Mês não encontrado no banco.' });
        return;
      }
      res.end(JSON.stringify(mes));
      return;
    }

    const planilha = /^\/api\/meses\/(\d{4}-\d{2})\/planilha$/.exec(url.pathname);
    if (req.method === 'GET' && planilha?.[1]) {
      const mes = await lerMesNoBanco(planilha[1]);
      if (!mes) {
        responder(res, 404, { erro: 'Mês não encontrado no banco.' });
        return;
      }
      const arquivo = await gerarPlanilhaEntrada(mes);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${nomeDoArquivo(mes.anoMes)}"`);
      res.end(arquivo);
      return;
    }

    const resposta = /^\/api\/meses\/(\d{4}-\d{2})\/lancamentos\/(\d+)$/.exec(url.pathname);
    if (req.method === 'DELETE' && resposta?.[1] && resposta[2]) {
      const apagou = await excluirLancamento(resposta[1], Number(resposta[2]));
      if (!apagou) {
        responder(res, 404, { erro: 'Lançamento não encontrado.' });
        return;
      }
      const mes = (await lerMesNoBanco(resposta[1])) ?? montarDashboard(resposta[1], []);
      res.end(JSON.stringify(mes));
      return;
    }

    if (req.method === 'PUT' && resposta?.[1] && resposta[2]) {
      let pedido: unknown;
      try {
        pedido = JSON.parse((await lerCorpo(req, 64 * 1024)).toString('utf8'));
      } catch {
        responder(res, 400, { erro: 'Não foi possível ler o gasto.' });
        return;
      }
      try {
        if (!pedido || typeof pedido !== 'object') throw new Error('Não foi possível ler o gasto.');
        const gasto = montarGastoManual(pedido);
        const gravou = await atualizarLancamento(resposta[1], Number(resposta[2]), gasto.lancamento, gasto.anoMes);
        if (!gravou) {
          responder(res, 404, { erro: 'Lançamento não encontrado.' });
          return;
        }
        const mes = (await lerMesNoBanco(gasto.anoMes)) ?? montarDashboard(gasto.anoMes, []);
        res.end(JSON.stringify(mes));
      } catch (erro) {
        const texto = erro instanceof Error ? erro.message : 'Não foi possível gravar o gasto.';
        if (texto.includes('ECONNREFUSED') || texto.includes('timeout') || texto.includes('ENOTFOUND')) throw erro;
        responder(res, 400, { erro: texto });
      }
      return;
    }

    if (req.method === 'PATCH' && resposta?.[1] && resposta[2]) {
      const pedido = JSON.parse((await lerCorpo(req, 64 * 1024)).toString('utf8')) as {
        motivo?: unknown;
        observacao?: unknown;
      };
      const campos: { motivo?: string; observacao?: string } = {};
      if (typeof pedido.motivo === 'string') campos.motivo = pedido.motivo;
      if (typeof pedido.observacao === 'string') campos.observacao = pedido.observacao;
      if (campos.motivo === undefined && campos.observacao === undefined) {
        responder(res, 400, { erro: 'Escreva o motivo ou a resposta.' });
        return;
      }
      if (campos.motivo !== undefined && campos.motivo.trim() === '') {
        responder(res, 400, { erro: 'Escreva o motivo.' });
        return;
      }
      if (campos.observacao !== undefined && campos.observacao.trim() === '') {
        responder(res, 400, { erro: 'Escreva a resposta.' });
        return;
      }
      const gravou = await responderLancamento(resposta[1], Number(resposta[2]), campos);
      if (!gravou) {
        responder(res, 404, { erro: 'Lançamento não encontrado.' });
        return;
      }
      const mes = await lerMesNoBanco(resposta[1]);
      res.end(JSON.stringify(mes));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/lancamentos/iguais') {
      try {
        const identidade = identidadeDoGasto({
          data: url.searchParams.get('data') ?? '',
          descricao: url.searchParams.get('descricao') ?? '',
          valor: url.searchParams.get('valor') ?? '',
          origem: url.searchParams.get('origem') ?? '',
        });
        const ignorarTexto = url.searchParams.get('ignorar');
        const ignorar = ignorarTexto ? Number(ignorarTexto) : undefined;
        const quantidade = await contarGastosIguais(
          identidade.data,
          identidade.descricao,
          identidade.valor,
          identidade.origem,
          ignorar !== undefined && Number.isInteger(ignorar) ? ignorar : undefined,
        );
        res.end(JSON.stringify({ quantidade }));
      } catch (erro) {
        const texto = erro instanceof Error ? erro.message : 'Não foi possível conferir o gasto.';
        if (texto.includes('ECONNREFUSED') || texto.includes('timeout') || texto.includes('ENOTFOUND')) throw erro;
        responder(res, 400, { erro: texto });
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/lancamentos') {
      let pedido: unknown;
      try {
        pedido = JSON.parse((await lerCorpo(req, 64 * 1024)).toString('utf8'));
      } catch {
        responder(res, 400, { erro: 'Não foi possível ler o gasto.' });
        return;
      }
      try {
        if (!pedido || typeof pedido !== 'object') throw new Error('Não foi possível ler o gasto.');
        const gasto = montarGastoManual(pedido);
        await inserirLancamento(gasto.anoMes, gasto.lancamento);
        const mes = await lerMesNoBanco(gasto.anoMes);
        res.end(JSON.stringify(mes));
      } catch (erro) {
        const texto = erro instanceof Error ? erro.message : 'Não foi possível gravar o gasto.';
        if (texto.includes('ECONNREFUSED') || texto.includes('timeout') || texto.includes('ENOTFOUND')) throw erro;
        responder(res, 400, { erro: texto });
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/planilhas') {
      const nome = path.basename(url.searchParams.get('nome') ?? '');
      if (!nome.toLowerCase().endsWith('.xlsx')) {
        responder(res, 400, { erro: 'Envie um arquivo .xlsx, no formato gastos-AAAA-MM.xlsx.' });
        return;
      }
      const corpo = await lerCorpo(req, 20 * 1024 * 1024);
      if (corpo.length === 0) {
        responder(res, 400, { erro: 'O arquivo está vazio.' });
        return;
      }
      const mes = await abrirConferencia(nome, corpo);
      res.end(JSON.stringify(mes));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/planilhas/confirmar') {
      const pedido = JSON.parse((await lerCorpo(req, 64 * 1024)).toString('utf8')) as {
        id?: string;
        acao?: string;
        incluirOutrosMeses?: boolean;
      };
      if (!pedido.id || (pedido.acao !== 'gravar' && pedido.acao !== 'substituir')) {
        responder(res, 400, { erro: 'Confirme a gravação ou a substituição do mês.' });
        return;
      }
      const mes = await confirmarConferencia(pedido.id, pedido.acao, pedido.incluirOutrosMeses === true);
      res.end(JSON.stringify(mes));
      return;
    }

    responder(res, 404, { erro: 'Rota não encontrada.' });
  } catch (erro) {
    if (erro instanceof SyntaxError) {
      responder(res, 400, { erro: 'Não foi possível ler a confirmação.' });
      return;
    }
    const texto = erro instanceof Error ? erro.message : 'Erro ao ler o banco.';
    const semBanco = texto.includes('ECONNREFUSED') || texto.includes('timeout') || texto.includes('ENOTFOUND');
    responder(res, 500, {
      erro: semBanco ? 'Não foi possível conectar ao banco. O Postgres precisa estar no ar.' : texto,
    });
  }
});

function lerCorpo(req: http.IncomingMessage, limite: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pedacos: Buffer[] = [];
    let total = 0;
    req.on('data', (pedaco: Buffer) => {
      total += pedaco.length;
      if (total > limite) {
        reject(new Error('A planilha passou de 20 MB.'));
        req.destroy();
        return;
      }
      pedacos.push(pedaco);
    });
    req.on('end', () => resolve(Buffer.concat(pedacos)));
    req.on('error', reject);
  });
}

function responder(res: http.ServerResponse, status: number, corpo: unknown): void {
  res.statusCode = status;
  res.end(JSON.stringify(corpo));
}

server.listen(porta, '127.0.0.1', () => {
  console.log(`API do dashboard em http://127.0.0.1:${porta}`);
});
