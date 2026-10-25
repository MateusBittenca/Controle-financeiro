import type { Origem, TipoDeItem } from '../types/categorias.js';
import { contemPadrao } from './texto.js';

/**
 * Lista fácil de editar. A comparação ignora acentos e maiúsculas.
 * Um padrão entra se aparecer como palavra ou frase inteira na descrição.
 *
 * Assinaturas fora desta lista (Netflix, por exemplo) ficam em Demais,
 * com o tipo Software/assinaturas digitais. Para contá-las como mensalidade,
 * copie o padrão para cá.
 */
export const padroesMensalidades: { padroes: string[]; tipoDeItem: TipoDeItem }[] = [
  {
    padroes: ['apple.com/bill'],
    tipoDeItem: 'Software/assinaturas digitais',
  },
  {
    padroes: ['microsoft*subscription'],
    tipoDeItem: 'Software/assinaturas digitais',
  },
  {
    padroes: ['cursor ai powered ide'],
    tipoDeItem: 'Software/assinaturas digitais',
  },
];

/** IOF de compra internacional também é mensalidade, em qualquer ordem dessas palavras. */
export function ehIofDeCompraInternacional(descricao: string): boolean {
  return contemPadrao(descricao, 'iof') && contemPadrao(descricao, 'internacional');
}

export function ehMensalidade(descricao: string): { tipoDeItem: TipoDeItem } | undefined {
  if (ehIofDeCompraInternacional(descricao)) {
    return { tipoDeItem: 'Software/assinaturas digitais' };
  }
  for (const regra of padroesMensalidades) {
    if (regra.padroes.some((padrao) => contemPadrao(descricao, padrao))) {
      return { tipoDeItem: regra.tipoDeItem };
    }
  }
  return undefined;
}

/** Posto, combustível ou a própria palavra gasolina. */
export const padroesGasolina: string[] = ['posto', 'combustivel', 'gasolina'];

export function ehGasolina(descricao: string): boolean {
  return padroesGasolina.some((padrao) => contemPadrao(descricao, padrao));
}

/**
 * Ordem importa: o primeiro padrão que casar define o tipo.
 * "Uber Eats" precisa vir antes de "Uber".
 */
export const padroesTipoDeItem: { tipoDeItem: TipoDeItem; padroes: string[] }[] = [
  { tipoDeItem: 'Alimentação Sodexo', padroes: ['sodexo'] },
  {
    tipoDeItem: 'Fast food/delivery',
    padroes: ['ifood', 'rappi', 'mcdonald', 'burger king', 'uber eats', 'ubereats', 'habibs', 'subway'],
  },
  {
    tipoDeItem: 'Educação',
    padroes: ['fundacao valeparaibana', 'escola', 'faculdade', 'universidade', 'curso'],
  },
  {
    tipoDeItem: 'Farmácia/saúde',
    padroes: ['farmacia', 'drogaria', 'droga raia', 'drogasil', 'drogaraia'],
  },
  {
    tipoDeItem: 'Compras diversas',
    padroes: ['amazon', 'magazine luiza', 'magalu', 'americanas', 'mercado livre', 'shopee', 'loja', 'shopping'],
  },
  {
    tipoDeItem: 'Mercado',
    padroes: ['supermercado', 'mercado', 'carrefour', 'assai', 'pao de acucar', 'hortifruti'],
  },
  {
    tipoDeItem: 'Software/assinaturas digitais',
    padroes: ['apple.com/bill', 'microsoft', 'cursor ai powered ide', 'netflix', 'spotify', 'subscription', 'iof'],
  },
  {
    tipoDeItem: 'Transporte',
    padroes: ['uber', 'cabify', '99app', 'posto', 'combustivel', 'gasolina', 'metro', 'onibus'],
  },
  {
    tipoDeItem: 'Esporte/lazer',
    padroes: ['smart fit', 'academia', 'cinema', 'ingresso', 'decathlon'],
  },
  { tipoDeItem: 'Transferências Pix', padroes: ['pix'] },
];

export function classificarTipoDeItem(descricao: string, origem: Origem): TipoDeItem {
  for (const regra of padroesTipoDeItem) {
    if (regra.padroes.some((padrao) => contemPadrao(descricao, padrao))) {
      return regra.tipoDeItem;
    }
  }
  if (origem === 'pix') return 'Transferências Pix';
  return 'Outras';
}
