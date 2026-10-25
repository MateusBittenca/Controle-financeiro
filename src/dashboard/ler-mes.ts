import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { parseData, rotuloMes } from '../parsers/valores.js';
import { arredondarCentavos, somarCentavos } from '../rules/dinheiro.js';
import { contemPadrao, normalizar } from '../rules/texto.js';

export const CATEGORIAS_TELA = [
  'Mensalidades (assinaturas)',
  'Gasolina',
  'Gastos à parte (compras na hora, débito à vista)',
  'Demais',
] as const;

const ROTULO_CATEGORIA: Record<string, string> = {
  mensalidades: 'Mensalidades (assinaturas)',
  'mensalidades (assinaturas)': 'Mensalidades (assinaturas)',
  gasolina: 'Gasolina',
  'gastos a parte': 'Gastos à parte (compras na hora, débito à vista)',
  'gastos a parte (compras na hora, debito a vista)': 'Gastos à parte (compras na hora, débito à vista)',
  demais: 'Demais',
};

const ROTULO_ORIGEM_TELA: Record<string, string> = {
  credito: 'Crédito',
  debito: 'Débito',
  pix: 'Pix',
  boleto: 'Boleto',
};

const VALOR_BOLETO_FUNDACAO = 1865.25;
const EQUIVALENTE_BOLETO_FUNDACAO = 580;

export interface LancamentoTela {
  id?: number;
  data: string;
  descricao: string;
  valor: number;
  valorMensalEquivalente: number | null;
  valorConsiderado: number;
  origem: string;
  categoria: string;
  tipoDeItem: string;
  motivo: string;
  observacao: string;
}

export interface TotalCategoria {
  categoria: string;
  totalReal: number;
  totalEquivalente: number;
  quantidade: number;
}

export interface TotalTipo {
  tipo: string;
  totalEquivalente: number;
  quantidade: number;
}

export interface MesDisponivel {
  anoMes: string;
  rotulo: string;
}

export interface MesDashboard {
  anoMes: string;
  rotulo: string;
  totalReal: number;
  totalEquivalente: number;
  quantidade: number;
  categorias: TotalCategoria[];
  tipos: TotalTipo[];
  lancamentos: LancamentoTela[];
  pendenciasSodexo: LancamentoTela[];
  boletosFundacao: LancamentoTela[];
}

export function diretorioPlanilhas(): string {
  const aqui = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(aqui, '..', '..', 'data', 'planilhas');
}

export async function listarMeses(diretorio: string): Promise<MesDisponivel[]> {
  let nomes: string[];
  try {
    nomes = await fs.promises.readdir(diretorio);
  } catch (erro) {
    if (erro instanceof Error && 'code' in erro && erro.code === 'ENOENT') return [];
    throw erro;
  }

  return nomes
    .map((nome) => /^gastos-(\d{4}-\d{2})\.xlsx$/.exec(nome)?.[1])
    .filter((anoMesTexto): anoMesTexto is string => anoMesTexto !== undefined && ehAnoMes(anoMesTexto))
    .sort((a, b) => b.localeCompare(a))
    .map((anoMesTexto) => ({ anoMes: anoMesTexto, rotulo: rotuloMes(anoMesTexto) }));
}

export async function lerMes(diretorio: string, anoMesTexto: string): Promise<MesDashboard | null> {
  if (!ehAnoMes(anoMesTexto)) return null;
  const arquivo = path.join(diretorio, `gastos-${anoMesTexto}.xlsx`);
  if (!fs.existsSync(arquivo)) return null;
  return lerArquivoPlanilha(arquivo);
}

export async function lerArquivoPlanilha(caminho: string): Promise<MesDashboard> {
  if (!fs.existsSync(caminho)) throw new Error(`Arquivo não encontrado: ${caminho}`);
  return lerConteudoPlanilha(await fs.promises.readFile(caminho), path.basename(caminho));
}

export async function lerConteudoPlanilha(conteudo: Buffer, nomeArquivo: string): Promise<MesDashboard> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(conteudo as never);
  const sheet = workbook.getWorksheet('Lançamentos');
  if (!sheet) throw new Error('A planilha não tem a aba Lançamentos.');

  const lancamentos = lerLinhas(sheet).sort(
    (a, b) => a.data.localeCompare(b.data) || a.descricao.localeCompare(b.descricao, 'pt-BR'),
  );
  const peloNome = /^gastos-(\d{4}-\d{2})\.xlsx$/i.exec(path.basename(nomeArquivo))?.[1];
  const anoMesTexto = peloNome && ehAnoMes(peloNome) ? peloNome : lancamentos[0]?.data.slice(0, 7);
  if (!anoMesTexto || !ehAnoMes(anoMesTexto)) {
    throw new Error('Não foi possível identificar o mês. Nomeie o arquivo como gastos-AAAA-MM.xlsx.');
  }
  return montarDashboard(anoMesTexto, lancamentos);
}

function ehAnoMes(texto: string): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(texto);
  if (!match) return false;
  const mes = Number(match[2]);
  return mes >= 1 && mes <= 12;
}

export function montarDashboard(anoMesTexto: string, lancamentos: LancamentoTela[]): MesDashboard {
  const tiposMapa = new Map<string, LancamentoTela[]>();
  for (const lancamento of lancamentos) {
    const grupo = tiposMapa.get(lancamento.tipoDeItem) ?? [];
    grupo.push(lancamento);
    tiposMapa.set(lancamento.tipoDeItem, grupo);
  }

  const tipos = [...tiposMapa.entries()]
    .map(([tipo, itens]) => ({
      tipo,
      totalEquivalente: somarCentavos(itens.map((item) => item.valorConsiderado)),
      quantidade: itens.length,
    }))
    .sort((a, b) => a.tipo.localeCompare(b.tipo, 'pt-BR'));

  return {
    anoMes: anoMesTexto,
    rotulo: rotuloMes(anoMesTexto),
    totalReal: somarCentavos(lancamentos.map((item) => item.valor)),
    totalEquivalente: somarCentavos(lancamentos.map((item) => item.valorConsiderado)),
    quantidade: lancamentos.length,
    categorias: CATEGORIAS_TELA.map((categoria) => {
      const itens = lancamentos.filter((item) => item.categoria === categoria);
      return {
        categoria,
        totalReal: somarCentavos(itens.map((item) => item.valor)),
        totalEquivalente: somarCentavos(itens.map((item) => item.valorConsiderado)),
        quantidade: itens.length,
      };
    }),
    tipos,
    lancamentos,
    pendenciasSodexo: lancamentos.filter((item) => ehPendenciaSodexo(item)),
    boletosFundacao: lancamentos.filter((item) => ehBoletoFundacao(item)),
  };
}

function ehPendenciaSodexo(lancamento: LancamentoTela): boolean {
  return contemPadrao(lancamento.descricao, 'sodexo') && lancamento.motivo.trim() === '';
}

function ehBoletoFundacao(lancamento: LancamentoTela): boolean {
  if (!contemPadrao(lancamento.descricao, 'fundacao valeparaibana')) return false;
  if (Math.abs(lancamento.valor - VALOR_BOLETO_FUNDACAO) > 0.001) return false;
  if (lancamento.valorMensalEquivalente === null) return false;
  return Math.abs(lancamento.valorMensalEquivalente - EQUIVALENTE_BOLETO_FUNDACAO) <= 0.001;
}

function lerLinhas(sheet: ExcelJS.Worksheet): LancamentoTela[] {
  if (sheet.rowCount === 0) return [];
  const cabecalho = indices(sheet);
  const colunaData = exigir(cabecalho, ['Data'], 'Data');
  const colunaDescricao = exigir(cabecalho, ['Descrição'], 'Descrição');
  const colunaValor = exigir(cabecalho, ['Valor (R$)', 'Valor'], 'Valor');
  const colunaOrigem = exigir(cabecalho, ['Origem'], 'Origem');
  const colunaCategoria = exigir(cabecalho, ['Categoria principal', 'Categoria'], 'Categoria');
  const colunaTipo = exigir(cabecalho, ['Tipo de item'], 'Tipo de item');
  const colunaEquivalente = achar(cabecalho, ['Valor mensal equivalente (R$)', 'Valor mensal equivalente']);
  const colunaMotivo = achar(cabecalho, ['Motivo (perguntar ao usuário)', 'Motivo']);
  const colunaObservacao = achar(cabecalho, ['Observação', 'Observacao']);
  const lancamentos: LancamentoTela[] = [];

  sheet.eachRow((row, numero) => {
    if (numero === 1) return;
    const data = lerDataIso(row.getCell(colunaData).value);
    const descricao = lerTexto(row.getCell(colunaDescricao).value);
    if (!data && !descricao) return;
    if (!data) throw new Error(`Linha ${numero}: data inválida.`);
    if (!descricao) throw new Error(`Linha ${numero}: descrição vazia.`);

    const valor = lerNumero(row.getCell(colunaValor).value);
    if (valor === undefined) throw new Error(`Linha ${numero}: valor inválido.`);

    const equivalente = colunaEquivalente ? lerNumero(row.getCell(colunaEquivalente).value) : undefined;
    const motivo = colunaMotivo ? lerTexto(row.getCell(colunaMotivo).value) : '';
    const observacao = colunaObservacao ? lerTexto(row.getCell(colunaObservacao).value) : '';
    const origemBruta = lerTexto(row.getCell(colunaOrigem).value);
    const categoriaBruta = lerTexto(row.getCell(colunaCategoria).value);
    const tipo = lerTexto(row.getCell(colunaTipo).value);
    if (!origemBruta || !categoriaBruta || !tipo) {
      throw new Error(`Linha ${numero}: origem, categoria ou tipo de item vazio.`);
    }

    lancamentos.push({
      data,
      descricao,
      valor,
      valorMensalEquivalente: equivalente ?? null,
      valorConsiderado: equivalente ?? valor,
      origem: rotuloOrigem(origemBruta),
      categoria: rotuloCategoria(categoriaBruta),
      tipoDeItem: tipo,
      motivo,
      observacao,
    });
  });

  return lancamentos;
}

function indices(sheet: ExcelJS.Worksheet): Record<string, number> {
  const mapa: Record<string, number> = {};
  sheet.getRow(1).eachCell((cell, coluna) => {
    const nome = lerTexto(cell.value);
    if (nome) mapa[nome] = coluna;
  });
  return mapa;
}

function achar(mapa: Record<string, number>, nomes: string[]): number | undefined {
  for (const nome of nomes) {
    const coluna = mapa[nome];
    if (coluna) return coluna;
  }
  return undefined;
}

function exigir(mapa: Record<string, number>, nomes: string[], rotulo: string): number {
  const coluna = achar(mapa, nomes);
  if (!coluna) throw new Error(`A aba Lançamentos não tem a coluna "${rotulo}".`);
  return coluna;
}

function rotuloCategoria(texto: string): string {
  return ROTULO_CATEGORIA[normalizar(texto)] ?? texto.trim();
}

function rotuloOrigem(texto: string): string {
  return ROTULO_ORIGEM_TELA[normalizar(texto)] ?? texto.trim();
}

function lerTexto(valor: ExcelJS.CellValue): string {
  if (valor == null) return '';
  if (typeof valor === 'string') return valor.trim();
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor).trim();
  if (valor instanceof Date) return '';
  if (typeof valor === 'object') {
    if ('richText' in valor && Array.isArray(valor.richText)) {
      return valor.richText.map((parte) => parte.text).join('').trim();
    }
    if ('text' in valor && typeof valor.text === 'string') return valor.text.trim();
    if ('result' in valor && (typeof valor.result === 'string' || typeof valor.result === 'number')) {
      return String(valor.result).trim();
    }
  }
  return '';
}

function lerNumero(valor: ExcelJS.CellValue): number | undefined {
  if (valor == null || valor === '') return undefined;
  if (typeof valor === 'number' && Number.isFinite(valor)) return arredondarCentavos(valor);
  if (typeof valor === 'object') {
    if ('result' in valor && typeof valor.result === 'number' && Number.isFinite(valor.result)) {
      return arredondarCentavos(valor.result);
    }
    if ('formula' in valor) return undefined;
    const texto = lerTexto(valor);
    if (!texto) return undefined;
    return arredondarCentavos(numeroDeTexto(texto));
  }
  if (typeof valor === 'string') {
    if (!valor.trim()) return undefined;
    return arredondarCentavos(numeroDeTexto(valor));
  }
  return undefined;
}

function numeroDeTexto(texto: string): number {
  const limpo = texto.trim().replace(/\u00a0/g, '').replace(/\s/g, '').replace(/^r\$/i, '');
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  const valor = Number(normalizado);
  if (!Number.isFinite(valor)) throw new Error(`valor inválido "${texto}"`);
  return valor;
}

function lerDataIso(valor: ExcelJS.CellValue): string | undefined {
  if (valor instanceof Date) {
    const ano = String(valor.getFullYear());
    const mes = String(valor.getMonth() + 1).padStart(2, '0');
    const dia = String(valor.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
  const texto = typeof valor === 'string' ? valor.trim() : lerTexto(valor);
  if (!texto) return undefined;
  return parseData(texto);
}
