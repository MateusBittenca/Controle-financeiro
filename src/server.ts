import http from 'node:http';
import { diretorioPlanilhas, lerMes, listarMeses } from './dashboard/ler-mes.js';

const porta = 8787;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    if (req.method === 'GET' && url.pathname === '/api/meses') {
      const meses = await listarMeses(diretorioPlanilhas());
      res.end(JSON.stringify(meses));
      return;
    }

    const detalhe = /^\/api\/meses\/(\d{4}-\d{2})$/.exec(url.pathname);
    if (req.method === 'GET' && detalhe?.[1]) {
      const mes = await lerMes(diretorioPlanilhas(), detalhe[1]);
      if (!mes) {
        responder(res, 404, { erro: 'Planilha deste mês não encontrada.' });
        return;
      }
      res.end(JSON.stringify(mes));
      return;
    }

    responder(res, 404, { erro: 'Rota não encontrada.' });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro ao ler a planilha.';
    responder(res, 500, { erro: mensagem });
  }
});

function responder(res: http.ServerResponse, status: number, corpo: unknown): void {
  res.statusCode = status;
  res.end(JSON.stringify(corpo));
}

server.listen(porta, '127.0.0.1', () => {
  console.log(`API do dashboard em http://127.0.0.1:${porta}`);
});
