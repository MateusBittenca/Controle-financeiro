import ExcelJS from 'exceljs';
import type { MesDashboard } from './ler-mes.js';

export async function gerarPlanilhaEntrada(mes: MesDashboard): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  escreverLancamentos(workbook.addWorksheet('Lançamentos'), mes);
  escreverResumo(workbook.addWorksheet('Resumo'), mes);
  escreverNotas(workbook.addWorksheet('Notas'), mes);
  const conteudo = await workbook.xlsx.writeBuffer();
  return Buffer.from(conteudo);
}

function escreverLancamentos(sheet: ExcelJS.Worksheet, mes: MesDashboard): void {
  sheet.addRow([
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
  sheet.getRow(1).font = { bold: true };
  const larguras = [14, 42, 16, 14, 48, 36, 32, 36, 42];
  larguras.forEach((largura, indice) => {
    sheet.getColumn(indice + 1).width = largura;
  });

  for (const item of mes.lancamentos) {
    const [ano, mesNumero, dia] = item.data.split('-').map(Number);
    const linha = sheet.addRow([
      new Date(ano ?? 0, (mesNumero ?? 1) - 1, dia ?? 1),
      item.descricao,
      item.valor,
      item.origem,
      item.categoria,
      item.tipoDeItem,
      item.valorMensalEquivalente,
      item.motivo,
      item.observacao,
    ]);
    linha.getCell(1).numFmt = 'dd/mm/yyyy';
    linha.getCell(3).numFmt = '#,##0.00';
    if (item.valorMensalEquivalente !== null) linha.getCell(7).numFmt = '#,##0.00';
  }
}

function escreverResumo(sheet: ExcelJS.Worksheet, mes: MesDashboard): void {
  sheet.addRow([`Resumo de gastos: ${mes.rotulo}`]);
  sheet.addRow([]);
  sheet.addRow(['Categoria principal', 'Total real (R$)', 'Total mensal equivalente (R$)', 'Qtd. lançamentos']);
  for (const categoria of mes.categorias) {
    sheet.addRow([categoria.categoria, categoria.totalReal, categoria.totalEquivalente, categoria.quantidade]);
  }
  sheet.addRow(['TOTAL GERAL', mes.totalReal, mes.totalEquivalente, mes.quantidade]);
  sheet.addRow([]);
  const linhaTipos = sheet.addRow(['Tipo de item', 'Total real (R$)', 'Total mensal equivalente (R$)', 'Qtd. lançamentos']);
  linhaTipos.font = { bold: true };
  for (const tipo of mes.tipos) {
    const real = mes.lancamentos
      .filter((item) => item.tipoDeItem === tipo.tipo)
      .reduce((total, item) => total + item.valor, 0);
    sheet.addRow([tipo.tipo, Number(real.toFixed(2)), tipo.totalEquivalente, tipo.quantidade]);
  }
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(3).font = { bold: true };
  [52, 22, 32, 18].forEach((largura, indice) => {
    sheet.getColumn(indice + 1).width = largura;
  });
}

function escreverNotas(sheet: ExcelJS.Worksheet, mes: MesDashboard): void {
  sheet.addRow([`Notas: gastos ${mes.rotulo}`]);
  sheet.addRow([]);
  sheet.addRow([
    'A aba Lançamentos segue o modelo de entrada: Data, Descrição, Valor (R$), Origem, Categoria, Tipo de item, Valor mensal equivalente (R$), Motivo (perguntar ao usuário) e Observação.',
  ]);
  sheet.addRow(['Compra na Sodexo sem texto na coluna Motivo continua pendente.']);
  sheet.addRow([
    'O boleto da Fundação Valeparaibana de R$ 1.865,25 entra no mês como R$ 580,00 quando o valor mensal equivalente está preenchido.',
  ]);
  sheet.getRow(1).font = { bold: true };
  sheet.getColumn(1).width = 120;
}

export function nomeDoArquivo(anoMes: string): string {
  return `gastos-${anoMes}.xlsx`;
}
