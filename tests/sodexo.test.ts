import { describe, expect, it } from 'vitest';
import { classificarLancamento } from '../src/classify/classificar.js';
import { processarRelatorio } from '../src/processar.js';

describe('regra da Sodexo', () => {
  it('pede o motivo de compra no crédito e deixa o campo vazio', () => {
    const lancamento = classificarLancamento({
      data: '2026-10-09',
      descricao: 'SODEXO',
      valor: 36,
      origem: 'credito',
    });
    expect(lancamento.precisaMotivo).toBe(true);
    expect(lancamento.motivo).toBeUndefined();
    expect(lancamento.tipoDeItem).toBe('Alimentação Sodexo');
    expect(lancamento.categoriaPrincipal).toBe('Demais');
  });

  it('pede o motivo também no débito e classifica como gasto à parte', () => {
    const lancamento = classificarLancamento({
      data: '2026-10-10',
      descricao: 'Débito à vista Sodexo',
      valor: 18.5,
      origem: 'debito',
    });
    expect(lancamento.precisaMotivo).toBe(true);
    expect(lancamento.motivo).toBeUndefined();
    expect(lancamento.tipoDeItem).toBe('Alimentação Sodexo');
    expect(lancamento.categoriaPrincipal).toBe('Gastos à parte');
    expect(lancamento.origem).toBe('debito');
  });

  it('não pede motivo quando ele já veio preenchido', () => {
    const lancamento = classificarLancamento({
      data: '2026-10-09',
      descricao: 'Sodexo',
      valor: 36,
      origem: 'credito',
      motivo: 'Almoço no escritório',
    });
    expect(lancamento.precisaMotivo).toBe(false);
    expect(lancamento.motivo).toBe('Almoço no escritório');
  });

  it('lista as pendências ao processar o relatório', () => {
    const csv = [
      'date,title,amount,origem',
      '2026-10-09,Sodexo,"36,00",credito',
      '2026-10-10,Sodexo,"18,50",debito',
      '2026-10-11,Mercado Bairro,"20,00",credito',
    ].join('\n');
    const resultado = processarRelatorio(csv);
    expect(resultado.pendencias.map((item) => item.descricao)).toEqual(['Sodexo', 'Sodexo']);
    expect(resultado.lancamentos[2]?.precisaMotivo).toBe(false);
  });
});
