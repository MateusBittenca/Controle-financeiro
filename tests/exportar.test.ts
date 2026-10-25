import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { gerarPlanilhaEntrada } from '../src/dashboard/exportar.js';
import { lerConteudoPlanilha, montarDashboard, type LancamentoTela } from '../src/dashboard/ler-mes.js';

function item(parcial: Partial<LancamentoTela> & Pick<LancamentoTela, 'data' | 'descricao' | 'valor'>): LancamentoTela {
  const equivalente = parcial.valorMensalEquivalente === undefined ? null : parcial.valorMensalEquivalente;
  return {
    data: parcial.data,
    descricao: parcial.descricao,
    valor: parcial.valor,
    valorMensalEquivalente: equivalente,
    valorConsiderado: equivalente ?? parcial.valor,
    origem: parcial.origem ?? 'Débito',
    categoria: parcial.categoria ?? 'Demais',
    tipoDeItem: parcial.tipoDeItem ?? 'Alimentação Sodexo',
    motivo: parcial.motivo ?? '',
    observacao: parcial.observacao ?? '',
  };
}

describe('exportação da planilha', () => {
  it('grava o modelo de entrada e a leitura devolve os mesmos lançamentos', async () => {
    const lancamentos = [
      item({ data: '2026-10-10', descricao: 'Sodexo', valor: 7, motivo: 'Almoço' }),
      item({
        data: '2026-10-15',
        descricao: 'Boleto Fundação Valeparaibana de Ensino',
        valor: 1865.25,
        origem: 'Boleto',
        tipoDeItem: 'Educação',
        valorMensalEquivalente: 580,
        observacao: 'Pago neste mês',
      }),
    ];
    const mes = montarDashboard('2026-10', lancamentos);
    const conteudo = await gerarPlanilhaEntrada(mes);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(conteudo as never);
    const cabecalhos: string[] = [];
    workbook.getWorksheet('Lançamentos')?.getRow(1).eachCell((cell) => cabecalhos.push(String(cell.value)));
    expect(cabecalhos).toEqual([
      'Data',
      'Descrição',
      'Valor (R$)',
      'Origem',
      'Categoria',
      'Tipo de item',
      'Valor mensal equivalente (R$)',
      'Motivo (perguntar ao usuário)',
      'Observação',
    ]);
    expect(workbook.getWorksheet('Resumo')).toBeDefined();
    expect(workbook.getWorksheet('Notas')).toBeDefined();

    const lido = await lerConteudoPlanilha(conteudo, 'gastos-2026-10.xlsx');
    expect(lido.lancamentos.map((linha) => linha.data)).toEqual(['2026-10-10', '2026-10-15']);
    expect(lido.lancamentos[0]?.motivo).toBe('Almoço');
    expect(lido.lancamentos[0]?.valorMensalEquivalente).toBeNull();
    expect(lido.lancamentos[1]?.valor).toBe(1865.25);
    expect(lido.lancamentos[1]?.valorMensalEquivalente).toBe(580);
    expect(lido.lancamentos[1]?.observacao).toBe('Pago neste mês');
    expect(lido.boletosFundacao).toHaveLength(1);
    expect(lido.pendenciasSodexo).toHaveLength(0);
  });
});
