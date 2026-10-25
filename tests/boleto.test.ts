import { describe, expect, it } from 'vitest';
import { classificarLancamento } from '../src/classify/classificar.js';
import { processarRelatorio } from '../src/processar.js';
import { valorConsiderado } from '../src/types/lancamento.js';

describe('boleto da Fundação Valeparaibana', () => {
  it('guarda o valor real e usa R$ 580 no mês', () => {
    const lancamento = classificarLancamento({
      data: '2026-10-15',
      descricao: 'Boleto Fundação Valeparaibana de Ensino',
      valor: 1865.25,
      origem: 'boleto',
    });
    expect(lancamento.valor).toBe(1865.25);
    expect(lancamento.valorMensalEquivalente).toBe(580);
    expect(valorConsiderado(lancamento)).toBe(580);
    expect(lancamento.categoriaPrincipal).toBe('Mensalidades');
    expect(lancamento.tipoDeItem).toBe('Educação');
    expect(lancamento.origem).toBe('boleto');
    expect(lancamento.precisaMotivo).toBe(false);
  });

  it('reconhece o nome sem acento e sem a origem informada', () => {
    const lancamento = classificarLancamento({
      data: '2026-10-15',
      descricao: 'FUNDACAO VALEPARAIBANA DE ENSINO',
      valor: 1865.25,
    });
    expect(lancamento.valorMensalEquivalente).toBe(580);
    expect(lancamento.origem).toBe('boleto');
  });

  it('não aplica a regra se o valor for outro', () => {
    const lancamento = classificarLancamento({
      data: '2026-10-15',
      descricao: 'Boleto Fundação Valeparaibana de Ensino',
      valor: 100,
      origem: 'boleto',
    });
    expect(lancamento.valorMensalEquivalente).toBeUndefined();
    expect(valorConsiderado(lancamento)).toBe(100);
    expect(lancamento.categoriaPrincipal).toBe('Demais');
    expect(lancamento.tipoDeItem).toBe('Educação');
  });

  it('não aplica a regra a outro boleto do mesmo valor', () => {
    const lancamento = classificarLancamento({
      data: '2026-10-15',
      descricao: 'Boleto Escola Exemplo',
      valor: 1865.25,
      origem: 'boleto',
    });
    expect(lancamento.valorMensalEquivalente).toBeUndefined();
    expect(lancamento.categoriaPrincipal).toBe('Demais');
  });

  it('lê o valor com milhar no CSV', () => {
    const csv = [
      'date,title,amount,origem',
      '2026-10-15,Boleto Fundação Valeparaibana de Ensino,"1.865,25",boleto',
    ].join('\n');
    const resultado = processarRelatorio(csv);
    expect(resultado.lancamentos[0]?.valor).toBe(1865.25);
    expect(resultado.lancamentos[0]?.valorMensalEquivalente).toBe(580);
  });
});
