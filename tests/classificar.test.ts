import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classificarLancamento } from '../src/classify/classificar.js';
import { agruparPorMes, processarRelatorio } from '../src/processar.js';

const DATA = '2026-10-06';

describe('classificação por palavras-chave', () => {
  it.each([
    'Apple.Com/Bill',
    'Microsoft*Subscription',
    'Cursor Ai Powered Ide',
    'IOF de compra internacional',
    'IOF - COMPRA INTERNACIONAL',
  ])('classifica %s como mensalidade de software', (descricao) => {
    const lancamento = classificarLancamento({
      data: DATA,
      descricao,
      valor: 20,
      origem: 'credito',
    });
    expect(lancamento.categoriaPrincipal).toBe('Mensalidades');
    expect(lancamento.tipoDeItem).toBe('Software/assinaturas digitais');
    expect(lancamento.precisaMotivo).toBe(false);
    expect(lancamento.valorMensalEquivalente).toBeUndefined();
  });

  it.each(['POSTO Exemplo', 'Combustível do carro', 'Gasolina aditivada'])(
    'classifica %s como gasolina',
    (descricao) => {
      const lancamento = classificarLancamento({
        data: DATA,
        descricao,
        valor: 200,
        origem: 'credito',
      });
      expect(lancamento.categoriaPrincipal).toBe('Gasolina');
      expect(lancamento.tipoDeItem).toBe('Transporte');
    },
  );

  it('mantém posto no débito como gasolina', () => {
    const lancamento = classificarLancamento({
      data: DATA,
      descricao: 'POSTO Exemplo',
      valor: 220,
      origem: 'debito',
    });
    expect(lancamento.categoriaPrincipal).toBe('Gasolina');
  });

  it('não trata depósito como gasolina', () => {
    const lancamento = classificarLancamento({
      data: DATA,
      descricao: 'Depósito em dinheiro',
      valor: 100,
      origem: 'credito',
    });
    expect(lancamento.categoriaPrincipal).toBe('Demais');
    expect(lancamento.tipoDeItem).toBe('Outras');
  });

  it('trata compra no débito como gasto à parte e infere o tipo', () => {
    const lancamento = classificarLancamento({
      data: DATA,
      descricao: 'iFood',
      valor: 42.5,
      origem: 'debito',
    });
    expect(lancamento.categoriaPrincipal).toBe('Gastos à parte');
    expect(lancamento.tipoDeItem).toBe('Fast food/delivery');
  });

  it('infere débito pelo título quando a coluna de origem falta', () => {
    const lancamento = classificarLancamento({
      data: DATA,
      descricao: 'Compra no débito iFood',
      valor: 42.5,
    });
    expect(lancamento.origem).toBe('debito');
    expect(lancamento.categoriaPrincipal).toBe('Gastos à parte');
  });

  it('deixa mercado no crédito em Demais', () => {
    const lancamento = classificarLancamento({
      data: DATA,
      descricao: 'Mercado Bairro',
      valor: 80,
      origem: 'credito',
    });
    expect(lancamento.categoriaPrincipal).toBe('Demais');
    expect(lancamento.tipoDeItem).toBe('Mercado');
  });

  it('infere pix e não promove assinatura fora da lista de mensalidades', () => {
    const pix = classificarLancamento({
      data: DATA,
      descricao: 'Pix para João Exemplo',
      valor: 150,
    });
    expect(pix.origem).toBe('pix');
    expect(pix.categoriaPrincipal).toBe('Demais');
    expect(pix.tipoDeItem).toBe('Transferências Pix');

    const netflix = classificarLancamento({
      data: '2026-09-30',
      descricao: 'Netflix.com',
      valor: 39.9,
      origem: 'credito',
    });
    expect(netflix.categoriaPrincipal).toBe('Demais');
    expect(netflix.tipoDeItem).toBe('Software/assinaturas digitais');
  });

  it('separa Uber Eats de uma corrida da Uber', () => {
    const eats = classificarLancamento({
      data: DATA,
      descricao: 'Uber Eats',
      valor: 30,
      origem: 'debito',
    });
    const trip = classificarLancamento({
      data: DATA,
      descricao: 'Uber Trip',
      valor: 20,
      origem: 'credito',
    });
    expect(eats.tipoDeItem).toBe('Fast food/delivery');
    expect(eats.categoriaPrincipal).toBe('Gastos à parte');
    expect(trip.tipoDeItem).toBe('Transporte');
    expect(trip.categoriaPrincipal).toBe('Demais');
  });
});

describe('processarRelatorio', () => {
  it('lê vírgula decimal, milhar, data brasileira e ignora pagamento de fatura', () => {
    const csv = [
      'date,title,amount,origem',
      '2026-09-30,Netflix.com,"39,90",credito',
      '2026-10-03,Apple.Com/Bill,"34,90",credito',
      '03/10/2026,POSTO Exemplo,"10,00",credito',
      '2026-10-24,Pagamento de fatura,"-3.500,00",credito',
      '2026-10-01,"Loja Exemplo, Centro","89,00",credito',
    ].join('\n');

    const resultado = processarRelatorio(csv);
    expect(resultado.ignorados).toBe(1);
    expect(resultado.lancamentos.map((item) => item.valor)).toEqual([39.9, 34.9, 10, 89]);
    expect(resultado.lancamentos[2]?.data).toBe('2026-10-03');
    expect(resultado.lancamentos[2]?.categoriaPrincipal).toBe('Gasolina');
    expect(resultado.lancamentos[3]?.descricao).toBe('Loja Exemplo, Centro');
    expect(resultado.lancamentos[3]?.tipoDeItem).toBe('Compras diversas');
    expect([...agruparPorMes(resultado.lancamentos).keys()]).toEqual(['2026-09', '2026-10']);
  });

  it('aceita CSV separado por ponto e vírgula', () => {
    const csv = 'date;title;amount;origem\n2026-10-08;iFood;42,50;debito\n';
    const resultado = processarRelatorio(csv);
    expect(resultado.lancamentos).toHaveLength(1);
    expect(resultado.lancamentos[0]?.valor).toBe(42.5);
    expect(resultado.lancamentos[0]?.categoriaPrincipal).toBe('Gastos à parte');
  });

  it('classifica o relatório fictício de exemplo', () => {
    const csv = fs.readFileSync(new URL('../data/entrada/exemplo-relatorio.csv', import.meta.url), 'utf8');
    const resultado = processarRelatorio(csv);
    expect(resultado.ignorados).toBe(1);
    expect(resultado.lancamentos).toHaveLength(16);
    expect(resultado.pendencias).toHaveLength(2);
    expect(resultado.lancamentos.some((item) => item.categoriaPrincipal === 'Mensalidades')).toBe(true);
    expect(resultado.lancamentos.some((item) => item.categoriaPrincipal === 'Gasolina')).toBe(true);
    expect(resultado.lancamentos.some((item) => item.categoriaPrincipal === 'Gastos à parte')).toBe(true);
  });
});
