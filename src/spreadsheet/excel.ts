import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { regrasValorMensal } from '../rules/boleto.js';
import { formatarReais, somarCentavos } from '../rules/dinheiro.js';
import { normalizar } from '../rules/texto.js';
import { anoMes, formatarDataBr, parseData, parseValorBrasileiro, rotuloMes } from '../parsers/valores.js';
import {
  CATEGORIAS_EM_DESTAQUE,
  CATEGORIAS_PRINCIPAIS,
  ROTULO_ORIGEM,
  TIPOS_DE_ITEM,
  ehCategoriaPrincipal,
  ehTipoDeItem,
  origemDoRotulo,
  type CategoriaPrincipal,
} from '../types/categorias.js';
import { valorConsiderado, type Lancamento } from '../types/lancamento.js';

const ABA_LANCAMENTOS = 'Lançamentos';
const ABA_RESUMO = 'Resumo';
const ABA_NOTAS = 'Notas';

const COR_CABECALHO = 'FF1F4E3D';
const COR_TEXTO_CABECALHO = 'FFFFFFFF';
const COR_DESTAQUE = 'FFF4E4C4';
const COR_PENDENCIA = 'FFF8D7DA';
const COR_BORDA = 'FFD0D5D2';
const FORMATO_REAL = '"R$" #,##0.00';

const COLUNAS = [
  { cabecalho: 'Data', largura: 14 },
  { cabecalho: 'Descrição', largura: 52 },
  { cabecalho: 'Valor', largura: 16 },
  { cabecalho: 'Valor mensal equivalente', largura: 28 },
  { cabecalho: 'Valor considerado', largura: 20 },
  { cabecalho: 'Origem', largura: 14 },
  { cabecalho: 'Categoria principal', largura: 24 },
  { cabecalho: 'Tipo de item', largura: 32 },
  { cabecalho: 'Motivo', largura: 36 },
  { cabecalho: 'Precisa motivo', largura: 18 },
] as const;

export interface AtualizacaoPlanilha {
  arquivo: string;
  adicionados: number;
  total: number;
  pendencias: Lancamento[];
}

function nomeArquivoMes(anoMesTexto: string): string {
  if (!/^\d{4}-\d{2}$/.test(anoMesTexto)) throw new Error(`Mês inválido: ${anoMesTexto}`);
  return `gastos-${anoMesTexto}.xlsx`;
}

function chaveLancamento(lancamento: Lancamento): string {
  return [
    lancamento.data,
    normalizar(lancamento.descricao),
    lancamento.valor.toFixed(2),
    lancamento.origem,
  ].join('|');
}

function bordaFina(): Partial<ExcelJS.Borders> {
  const lado: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: COR_BORDA } };
  return { top: lado, left: lado, bottom: lado, right: lado };
}

function pintarCabecalho(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: COR_TEXTO_CABECALHO } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_CABECALHO } };
  row.alignment = { vertical: 'middle' };
}

function destacar(row: ExcelJS.Row): void {
  row.font = { bold: true };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_DESTAQUE } };
}

function lerTexto(valor: ExcelJS.CellValue): string {
  if (valor == null) return '';
  if (valor instanceof Date) {
    const ano = valor.getFullYear();
    const mes = String(valor.getMonth() + 1).padStart(2, '0');
    const dia = String(valor.getDate()).padStart(2, '0');
    return `${dia}/${mes}/${ano}`;
  }
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  if (typeof valor === 'string') return valor.trim();
  if (typeof valor === 'object') {
    if ('text' in valor && typeof valor.text === 'string') return valor.text.trim();
    if ('result' in valor) return lerTexto(valor.result as ExcelJS.CellValue);
    if ('richText' in valor && Array.isArray(valor.richText)) {
      return valor.richText.map((parte) => parte.text).join('').trim();
    }
  }
  return String(valor).trim();
}

function lerNumero(valor: ExcelJS.CellValue): number | undefined {
  if (valor == null || valor === '') return undefined;
  if (typeof valor === 'number') return Number(valor.toFixed(2));
  if (typeof valor === 'object' && 'result' in valor && typeof valor.result === 'number') {
    return Number(valor.result.toFixed(2));
  }
  const texto = lerTexto(valor);
  if (!texto) return undefined;
  return parseValorBrasileiro(texto);
}

function lerSim(valor: ExcelJS.CellValue): boolean {
  const texto = normalizar(lerTexto(valor));
  return texto === 'sim' || texto === 's' || texto === 'true';
}

function indices(sheet: ExcelJS.Worksheet): Record<string, number> {
  const mapa: Record<string, number> = {};
  sheet.getRow(1).eachCell((cell, coluna) => {
    const nome = lerTexto(cell.value);
    if (nome) mapa[nome] = coluna;
  });
  return mapa;
}

function exigirColuna(mapa: Record<string, number>, nome: string): number {
  const coluna = mapa[nome];
  if (!coluna) throw new Error(`A aba ${ABA_LANCAMENTOS} não tem a coluna "${nome}".`);
  return coluna;
}

function lerLancamentos(sheet: ExcelJS.Worksheet): Lancamento[] {
  if (sheet.rowCount === 0) return [];
  const mapa = indices(sheet);
  const colunaData = exigirColuna(mapa, 'Data');
  const colunaDescricao = exigirColuna(mapa, 'Descrição');
  const colunaValor = exigirColuna(mapa, 'Valor');
  const colunaOrigem = exigirColuna(mapa, 'Origem');
  const colunaCategoria = exigirColuna(mapa, 'Categoria principal');
  const colunaTipo = exigirColuna(mapa, 'Tipo de item');
  const colunaEquivalente = mapa['Valor mensal equivalente'];
  const colunaMotivo = mapa.Motivo;
  const colunaPrecisa = mapa['Precisa motivo'];
  const lancamentos: Lancamento[] = [];

  sheet.eachRow((row, numero) => {
    if (numero === 1) return;
    const dataBruta = lerTexto(row.getCell(colunaData).value);
    if (!dataBruta) return;

    const descricao = lerTexto(row.getCell(colunaDescricao).value);
    const valor = lerNumero(row.getCell(colunaValor).value);
    const origem = origemDoRotulo(lerTexto(row.getCell(colunaOrigem).value));
    const categoria = lerTexto(row.getCell(colunaCategoria).value);
    const tipo = lerTexto(row.getCell(colunaTipo).value);
    if (valor === undefined || !origem || !ehCategoriaPrincipal(categoria) || !ehTipoDeItem(tipo)) {
      throw new Error(`Linha ${numero} da aba ${ABA_LANCAMENTOS} está incompleta ou fora das categorias conhecidas.`);
    }

    const motivo = colunaMotivo ? lerTexto(row.getCell(colunaMotivo).value) : '';
    const marcado = colunaPrecisa ? lerSim(row.getCell(colunaPrecisa).value) : false;
    const lancamento: Lancamento = {
      data: parseData(dataBruta),
      descricao,
      valor,
      origem,
      categoriaPrincipal: categoria,
      tipoDeItem: tipo,
      precisaMotivo: marcado && motivo === '',
    };
    if (colunaEquivalente) {
      const equivalente = lerNumero(row.getCell(colunaEquivalente).value);
      if (equivalente !== undefined) lancamento.valorMensalEquivalente = equivalente;
    }
    if (motivo) lancamento.motivo = motivo;
    lancamentos.push(lancamento);
  });

  return lancamentos;
}

function linhaDoLancamento(lancamento: Lancamento): (string | number | null)[] {
  return [
    formatarDataBr(lancamento.data),
    lancamento.descricao,
    lancamento.valor,
    lancamento.valorMensalEquivalente ?? null,
    valorConsiderado(lancamento),
    ROTULO_ORIGEM[lancamento.origem],
    lancamento.categoriaPrincipal,
    lancamento.tipoDeItem,
    lancamento.motivo ?? null,
    lancamento.precisaMotivo ? 'sim' : 'não',
  ];
}

function formatarLinhaLancamento(row: ExcelJS.Row, lancamento: Lancamento): void {
  row.getCell(1).numFmt = '@';
  row.getCell(3).numFmt = FORMATO_REAL;
  row.getCell(4).numFmt = FORMATO_REAL;
  row.getCell(5).numFmt = FORMATO_REAL;
  if (lancamento.precisaMotivo) {
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_PENDENCIA } };
  }
}

function escreverCabecalhoLancamentos(sheet: ExcelJS.Worksheet): void {
  const row = sheet.addRow(COLUNAS.map((coluna) => coluna.cabecalho));
  pintarCabecalho(row);
  COLUNAS.forEach((coluna, indice) => {
    sheet.getColumn(indice + 1).width = coluna.largura;
  });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: COLUNAS.length },
  };
}

function atualizarFiltro(sheet: ExcelJS.Worksheet): void {
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(sheet.rowCount, 1), column: COLUNAS.length },
  };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

function somarCategoria(lancamentos: Lancamento[], categoria: CategoriaPrincipal): number {
  return somarCentavos(
    lancamentos
      .filter((lancamento) => lancamento.categoriaPrincipal === categoria)
      .map((lancamento) => valorConsiderado(lancamento)),
  );
}

function escreverResumo(sheet: ExcelJS.Worksheet, anoMesTexto: string, lancamentos: Lancamento[]): void {
  sheet.getColumn(1).width = 42;
  sheet.getColumn(2).width = 22;
  sheet.getColumn(3).width = 16;

  const titulo = sheet.addRow([`Resumo — ${rotuloMes(anoMesTexto)}`]);
  titulo.font = { bold: true, size: 16 };
  sheet.addRow(['Os totais usam o valor mensal equivalente quando a regra do boleto se aplica.']);
  sheet.addRow([]);

  const tituloDestaque = sheet.addRow(['Destaques']);
  tituloDestaque.font = { bold: true, size: 13 };

  for (const categoria of CATEGORIAS_EM_DESTAQUE) {
    const row = sheet.addRow([categoria, somarCategoria(lancamentos, categoria), 'em destaque']);
    row.getCell(2).numFmt = FORMATO_REAL;
    destacar(row);
  }

  sheet.addRow([]);
  const tituloCategorias = sheet.addRow(['Totais por categoria principal']);
  tituloCategorias.font = { bold: true, size: 13 };
  const cabecalhoCategoria = sheet.addRow(['Categoria', 'Total considerado', 'Destaque']);
  pintarCabecalho(cabecalhoCategoria);

  for (const categoria of CATEGORIAS_PRINCIPAIS) {
    const emDestaque = CATEGORIAS_EM_DESTAQUE.includes(categoria);
    const row = sheet.addRow([categoria, somarCategoria(lancamentos, categoria), emDestaque ? 'sim' : '']);
    row.getCell(2).numFmt = FORMATO_REAL;
    row.eachCell((cell) => {
      cell.border = bordaFina();
    });
    if (emDestaque) destacar(row);
  }

  const total = sheet.addRow([
    'Total geral',
    somarCentavos(lancamentos.map((lancamento) => valorConsiderado(lancamento))),
  ]);
  total.font = { bold: true };
  total.getCell(2).numFmt = FORMATO_REAL;

  sheet.addRow([]);
  const tituloTipos = sheet.addRow(['Totais por tipo de item']);
  tituloTipos.font = { bold: true, size: 13 };
  const cabecalhoTipo = sheet.addRow(['Tipo de item', 'Total considerado']);
  pintarCabecalho(cabecalhoTipo);

  for (const tipo of TIPOS_DE_ITEM) {
    const valor = somarCentavos(
      lancamentos
        .filter((lancamento) => lancamento.tipoDeItem === tipo)
        .map((lancamento) => valorConsiderado(lancamento)),
    );
    const row = sheet.addRow([tipo, valor]);
    row.getCell(2).numFmt = FORMATO_REAL;
    row.eachCell((cell) => {
      cell.border = bordaFina();
    });
  }
}

function escreverNotas(sheet: ExcelJS.Worksheet, lancamentos: Lancamento[]): void {
  sheet.getColumn(1).width = 120;
  const titulo = sheet.addRow(['Notas']);
  titulo.font = { bold: true, size: 16 };
  sheet.addRow([]);
  sheet.addRow([
    'Lançamentos guarda cada gasto. O resumo soma o valor considerado: o equivalente mensal, quando existir; senão, o valor real.',
  ]);
  sheet.addRow([
    'Rodar o mesmo relatório de novo não duplica linha e também não reclassifica o que já foi importado. Para aplicar uma regra nova, apague a linha e processe outra vez.',
  ]);
  sheet.addRow([]);
  sheet.addRow(['Regras de valor mensal']);
  if (regrasValorMensal.length === 0) {
    sheet.addRow(['Nenhuma regra configurada em src/rules/boleto.ts.']);
  }
  for (const regra of regrasValorMensal) {
    sheet.addRow([
      `${regra.id}: descrições com "${regra.descricaoContem.join('", "')}" e valor ${formatarReais(regra.valor)} entram nos resumos como ${formatarReais(regra.valorMensalEquivalente)} por mês.`,
    ]);
  }

  const ajustados = lancamentos.filter((lancamento) => lancamento.valorMensalEquivalente !== undefined);
  sheet.addRow([]);
  sheet.addRow(['Ajustes deste mês']);
  if (ajustados.length === 0) {
    sheet.addRow(['Nenhum lançamento com valor mensal equivalente.']);
  }
  for (const lancamento of ajustados) {
    sheet.addRow([
      `${formatarDataBr(lancamento.data)} — ${lancamento.descricao}: pago ${formatarReais(lancamento.valor)}, considerado ${formatarReais(lancamento.valorMensalEquivalente ?? lancamento.valor)}.`,
    ]);
  }

  const pendencias = lancamentos.filter((lancamento) => lancamento.precisaMotivo);
  sheet.addRow([]);
  sheet.addRow(['Compras na Sodexo — preencha a coluna Motivo']);
  if (pendencias.length === 0) {
    sheet.addRow(['Nenhuma compra na Sodexo pendente de motivo.']);
    return;
  }
  for (const lancamento of pendencias) {
    sheet.addRow([
      `${formatarDataBr(lancamento.data)} — ${ROTULO_ORIGEM[lancamento.origem]} — ${formatarReais(lancamento.valor)} — ${lancamento.descricao}`,
    ]);
  }
}

function removerAba(workbook: ExcelJS.Workbook, nome: string): void {
  if (workbook.getWorksheet(nome)) workbook.removeWorksheet(nome);
}

/**
 * Cria a planilha do mês ou acrescenta só os lançamentos que ainda não estão nela.
 * Resumo e Notas são refeitos a partir da lista completa.
 */
export async function atualizarPlanilhaDoMes(
  anoMesTexto: string,
  recebidos: Lancamento[],
  diretorio: string,
): Promise<AtualizacaoPlanilha> {
  const arquivo = path.join(diretorio, nomeArquivoMes(anoMesTexto));
  await fs.promises.mkdir(diretorio, { recursive: true });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'controle-financeiro';
  const jaExistia = fs.existsSync(arquivo);
  if (jaExistia) await workbook.xlsx.readFile(arquivo);

  let sheet = workbook.getWorksheet(ABA_LANCAMENTOS);
  if (!sheet) sheet = workbook.addWorksheet(ABA_LANCAMENTOS);
  if (sheet.rowCount === 0) escreverCabecalhoLancamentos(sheet);
  else if (lerTexto(sheet.getRow(1).getCell(1).value) !== 'Data') {
    throw new Error(`A aba ${ABA_LANCAMENTOS} não tem o cabeçalho esperado.`);
  }

  const existentes = lerLancamentos(sheet);
  const chaves = new Set(existentes.map((lancamento) => chaveLancamento(lancamento)));
  const novos: Lancamento[] = [];
  for (const lancamento of recebidos) {
    if (anoMes(lancamento.data) !== anoMesTexto) {
      throw new Error(`Lançamento de ${lancamento.data} não pertence a ${anoMesTexto}.`);
    }
    const chave = chaveLancamento(lancamento);
    if (chaves.has(chave)) continue;
    chaves.add(chave);
    novos.push(lancamento);
  }

  for (const lancamento of novos) {
    const row = sheet.addRow(linhaDoLancamento(lancamento));
    formatarLinhaLancamento(row, lancamento);
  }
  atualizarFiltro(sheet);

  const todos = [...existentes, ...novos];
  removerAba(workbook, ABA_RESUMO);
  removerAba(workbook, ABA_NOTAS);
  escreverResumo(workbook.addWorksheet(ABA_RESUMO), anoMesTexto, todos);
  escreverNotas(workbook.addWorksheet(ABA_NOTAS), todos);

  await workbook.xlsx.writeFile(arquivo);
  const pendencias = todos
    .filter((lancamento) => lancamento.precisaMotivo)
    .sort((a, b) => a.data.localeCompare(b.data) || a.descricao.localeCompare(b.descricao, 'pt-BR'));

  return {
    arquivo,
    adicionados: novos.length,
    total: todos.length,
    pendencias,
  };
}
