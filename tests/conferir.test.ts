import { describe, expect, it } from 'vitest';
import { conferirImportacao } from '../src/dashboard/conferir.js';
import type { LancamentoTela } from '../src/dashboard/ler-mes.js';

function item(parcial: Partial<LancamentoTela> & Pick<LancamentoTela, 'data' | 'descricao' | 'valor'>): LancamentoTela {
  const equivalente = parcial.valorMensalEquivalente === undefined ? null : parcial.valorMensalEquivalente;
  return {
    data: parcial.data,
    descricao: parcial.descricao,
    valor: parcial.valor,
    valorMensalEquivalente: equivalente,
    valorConsiderado: parcial.valorConsiderado ?? equivalente ?? parcial.valor,
    origem: parcial.origem ?? 'Débito',
    categoria: parcial.categoria ?? 'Demais',
    tipoDeItem: parcial.tipoDeItem ?? 'Alimentação Sodexo',
    motivo: parcial.motivo ?? '',
    observacao: parcial.observacao ?? '',
  };
}

describe('conferência da planilha', () => {
  it('não duplica uma planilha que já está no banco', () => {
    const sodexo = item({ data: '2026-10-10', descricao: 'Sodexo', valor: 7 });
    const outro = item({ data: '2026-10-10', descricao: 'Sodexo', valor: 7 });
    const netflix = item({
      data: '2026-10-02',
      descricao: 'Netflix',
      valor: 39.9,
      origem: 'Crédito',
      tipoDeItem: 'Software/assinaturas digitais',
    });
    const conferencia = conferirImportacao('gastos-2026-10.xlsx', '2026-10', 'outubro de 2026', [sodexo, outro, netflix], [sodexo, outro, netflix], []);

    expect(conferencia.iguais).toBe(3);
    expect(conferencia.novos).toHaveLength(0);
    expect(conferencia.resultadoSeguro).toHaveLength(3);
  });

  it('entra só a compra repetida que ainda não está no banco', () => {
    const gravado = item({ data: '2026-10-10', descricao: 'Sodexo', valor: 7 });
    const repetido = item({ data: '2026-10-10', descricao: 'Sodexo', valor: 7 });
    const conferencia = conferirImportacao(
      'gastos-2026-10.xlsx',
      '2026-10',
      'outubro de 2026',
      [gravado, repetido],
      [gravado],
      [],
    );

    expect(conferencia.iguais).toBe(1);
    expect(conferencia.novos).toHaveLength(1);
    expect(conferencia.repetidosNaPlanilha).toEqual([{ lancamento: gravado, vezes: 2 }]);
    expect(conferencia.resultadoSeguro).toHaveLength(2);
  });

  it('atualiza motivo sem criar outro lançamento', () => {
    const antes = item({ data: '2026-10-10', descricao: 'Sodexo', valor: 7 });
    const depois = item({ data: '2026-10-10', descricao: 'Sodexo', valor: 7, motivo: 'Almoço' });
    const conferencia = conferirImportacao('gastos-2026-10.xlsx', '2026-10', 'outubro de 2026', [depois], [antes], []);

    expect(conferencia.novos).toHaveLength(0);
    expect(conferencia.alterados).toHaveLength(1);
    expect(conferencia.alterados[0]?.campos).toEqual(['Motivo']);
    expect(conferencia.resultadoSeguro).toEqual([depois]);
  });

  it('mantém o que está só no banco e segura duplicata de outro mês', () => {
    const noBanco = item({ data: '2026-10-03', descricao: 'Posto exemplo', valor: 50, tipoDeItem: 'Combustível' });
    const emSetembro = item({ data: '2026-09-02', descricao: 'Netflix', valor: 39.9, origem: 'Crédito' });
    const conferencia = conferirImportacao(
      'gastos-2026-10.xlsx',
      '2026-10',
      'outubro de 2026',
      [emSetembro],
      [noBanco],
      [{ anoMes: '2026-09', rotulo: 'setembro de 2026', lancamentos: [emSetembro] }],
    );

    expect(conferencia.soNoBanco).toEqual([noBanco]);
    expect(conferencia.emOutroMes).toEqual([
      { lancamento: emSetembro, anoMes: '2026-09', rotulo: 'setembro de 2026' },
    ]);
    expect(conferencia.resultadoSeguro).toEqual([noBanco]);
    expect(conferencia.resultadoComOutrosMeses).toEqual([emSetembro, noBanco]);
    expect(conferencia.resultadoSubstituicao).toEqual([emSetembro]);
  });
});
