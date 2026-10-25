import { describe, expect, it } from 'vitest';
import { identidadeDoGasto, montarGastoManual } from '../src/dashboard/gasto-manual.js';

describe('gasto manual', () => {
  it('monta o lançamento no mês da data', () => {
    const gasto = montarGastoManual({
      data: '25/10/2026',
      descricao: ' Posto exemplo ',
      valor: '50,00',
      origem: 'Débito',
      categoria: 'Gasolina',
      tipoDeItem: 'Combustível',
      motivo: '',
    });

    expect(gasto.anoMes).toBe('2026-10');
    expect(gasto.lancamento.valor).toBe(50);
    expect(gasto.lancamento.valorMensalEquivalente).toBeNull();
    expect(gasto.lancamento.valorConsiderado).toBe(50);
    expect(gasto.lancamento.descricao).toBe('Posto exemplo');
    expect(gasto.lancamento.origem).toBe('Débito');
  });

  it('aceita valor mensal equivalente e recusa valor zerado', () => {
    const gasto = montarGastoManual({
      data: '2026-10-15',
      descricao: 'Boleto exemplo',
      valor: 1865.25,
      valorMensalEquivalente: '580,00',
      origem: 'Boleto',
      categoria: 'Demais',
      tipoDeItem: 'Educação',
    });
    expect(gasto.lancamento.valorMensalEquivalente).toBe(580);
    expect(gasto.lancamento.valorConsiderado).toBe(580);

    expect(() =>
      montarGastoManual({
        data: '2026-10-15',
        descricao: 'Nada',
        valor: '0',
        origem: 'Pix',
        categoria: 'Demais',
        tipoDeItem: 'Outras',
      }),
    ).toThrow('maior que zero');
  });

  it('identifica o gasto pela data, descrição, valor e origem', () => {
    expect(
      identidadeDoGasto({
        data: '02/05/1999',
        descricao: ' Posto exemplo ',
        valor: '12,50',
        origem: 'Débito',
      }),
    ).toEqual({ data: '1999-05-02', descricao: 'Posto exemplo', valor: 12.5, origem: 'Débito' });
  });
});
