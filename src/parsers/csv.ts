import { origemDoRotulo } from '../types/categorias.js';
import type { ItemBruto } from '../types/lancamento.js';
import { parseData, parseValorBrasileiro } from './valores.js';

export interface ResultadoParser {
  itens: ItemBruto[];
  ignorados: number;
}

/** Contrato comum para o CSV de hoje e um futuro extrato em PDF. */
export type ParserRelatorio = (conteudo: string) => ResultadoParser;

const COLUNA_DATA = new Set(['date', 'data']);
const COLUNA_TITULO = new Set(['title', 'titulo', 'descricao', 'historico']);
const COLUNA_VALOR = new Set(['amount', 'valor']);
const COLUNA_ORIGEM = new Set(['origem', 'source']);
const COLUNA_MOTIVO = new Set(['motivo']);

interface MapaColunas {
  data: number;
  titulo: number;
  valor: number;
  origem?: number;
  motivo?: number;
}

function nomeColuna(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, '');
}

function contarForaDeAspas(linha: string, separador: ',' | ';'): number {
  let quantidade = 0;
  let aspas = false;
  for (let indice = 0; indice < linha.length; indice += 1) {
    const caractere = linha[indice];
    if (caractere === '"') {
      if (aspas && linha[indice + 1] === '"') {
        indice += 1;
      } else {
        aspas = !aspas;
      }
    } else if (caractere === separador && !aspas) {
      quantidade += 1;
    }
  }
  return quantidade;
}

function detectarSeparador(linha: string): ',' | ';' {
  return contarForaDeAspas(linha, ';') > contarForaDeAspas(linha, ',') ? ';' : ',';
}

function parseLinha(linha: string, separador: ',' | ';'): string[] {
  const campos: string[] = [];
  let atual = '';
  let aspas = false;

  for (let indice = 0; indice < linha.length; indice += 1) {
    const caractere = linha[indice];
    if (aspas) {
      if (caractere === '"') {
        if (linha[indice + 1] === '"') {
          atual += '"';
          indice += 1;
        } else {
          aspas = false;
        }
      } else {
        atual += caractere ?? '';
      }
    } else if (caractere === '"') {
      aspas = true;
    } else if (caractere === separador) {
      campos.push(atual.trim());
      atual = '';
    } else {
      atual += caractere ?? '';
    }
  }

  campos.push(atual.trim());
  return campos;
}

function mapearCabecalho(campos: string[]): MapaColunas {
  const mapa: MapaColunas = { data: -1, titulo: -1, valor: -1 };
  campos.forEach((campo, indice) => {
    const nome = nomeColuna(campo);
    if (COLUNA_DATA.has(nome)) mapa.data = indice;
    else if (COLUNA_TITULO.has(nome)) mapa.titulo = indice;
    else if (COLUNA_VALOR.has(nome)) mapa.valor = indice;
    else if (COLUNA_ORIGEM.has(nome)) mapa.origem = indice;
    else if (COLUNA_MOTIVO.has(nome)) mapa.motivo = indice;
  });

  if (mapa.data < 0 || mapa.titulo < 0 || mapa.valor < 0) {
    throw new Error('O CSV precisa das colunas date, title e amount.');
  }
  return mapa;
}

function campo(campos: string[], indice: number | undefined): string {
  if (indice === undefined || indice < 0) return '';
  return campos[indice] ?? '';
}

/**
 * Lê o relatório em CSV.
 * Valores negativos são pagamento de fatura e não viram gasto.
 * A vírgula é o decimal. Se o separador também for vírgula, o valor precisa ir entre aspas.
 * Um CSV do Excel em português, separado por `;`, também serve.
 */
export function parseRelatorioCsv(conteudo: string): ResultadoParser {
  const texto = conteudo.replace(/^\uFEFF/, '');
  const linhas = texto.split(/\r?\n/);
  const uteis: { numero: number; texto: string }[] = [];

  linhas.forEach((linha, indice) => {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith('#')) return;
    uteis.push({ numero: indice + 1, texto: limpa });
  });

  if (uteis.length === 0) throw new Error('O relatório está vazio.');

  const separador = detectarSeparador(uteis[0].texto);
  const cabecalho = parseLinha(uteis[0].texto, separador);
  const colunas = mapearCabecalho(cabecalho);
  const itens: ItemBruto[] = [];
  let ignorados = 0;

  for (const linha of uteis.slice(1)) {
    const campos = parseLinha(linha.texto, separador);
    if (campos.length < cabecalho.length) {
      throw new Error(`Linha ${linha.numero}: faltam colunas.`);
    }
    if (campos.length > cabecalho.length) {
      throw new Error(
        `Linha ${linha.numero}: colunas a mais. Se o valor usa vírgula decimal, coloque-o entre aspas ("34,90") ou separe o CSV por ponto e vírgula.`,
      );
    }

    let data: string;
    let valor: number;
    try {
      data = parseData(campo(campos, colunas.data));
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      throw new Error(`Linha ${linha.numero}: ${mensagem}`);
    }
    try {
      valor = parseValorBrasileiro(campo(campos, colunas.valor));
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      throw new Error(`Linha ${linha.numero}: ${mensagem}`);
    }

    if (valor < 0) {
      ignorados += 1;
      continue;
    }
    if (valor === 0) {
      throw new Error(`Linha ${linha.numero}: valor zero não é gasto nem pagamento de fatura.`);
    }

    const descricao = campo(campos, colunas.titulo);
    if (!descricao) throw new Error(`Linha ${linha.numero}: descrição vazia.`);

    const item: ItemBruto = { data, descricao, valor };
    const origemBruta = campo(campos, colunas.origem);
    if (origemBruta) {
      const origem = origemDoRotulo(origemBruta);
      if (!origem) {
        throw new Error(
          `Linha ${linha.numero}: origem "${origemBruta}" inválida. Use credito, debito, pix ou boleto.`,
        );
      }
      item.origem = origem;
    }
    const motivo = campo(campos, colunas.motivo);
    if (motivo) item.motivo = motivo;
    itens.push(item);
  }

  return { itens, ignorados };
}
