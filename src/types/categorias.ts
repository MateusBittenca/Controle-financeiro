import { normalizar } from '../rules/texto.js';

export const CATEGORIAS_PRINCIPAIS = [
  'Mensalidades',
  'Gasolina',
  'Gastos à parte',
  'Demais',
] as const;

export type CategoriaPrincipal = (typeof CATEGORIAS_PRINCIPAIS)[number];

export const CATEGORIAS_EM_DESTAQUE: readonly CategoriaPrincipal[] = [
  'Mensalidades',
  'Gasolina',
];

export const TIPOS_DE_ITEM = [
  'Fast food/delivery',
  'Transporte',
  'Alimentação Sodexo',
  'Educação',
  'Mercado',
  'Farmácia/saúde',
  'Software/assinaturas digitais',
  'Compras diversas',
  'Transferências Pix',
  'Esporte/lazer',
  'Outras',
] as const;

export type TipoDeItem = (typeof TIPOS_DE_ITEM)[number];

export const ORIGENS = ['credito', 'debito', 'pix', 'boleto'] as const;

export type Origem = (typeof ORIGENS)[number];

export const ROTULO_ORIGEM: Record<Origem, string> = {
  credito: 'crédito',
  debito: 'débito',
  pix: 'pix',
  boleto: 'boleto',
};

export function origemDoRotulo(texto: string): Origem | undefined {
  const chave = normalizar(texto);
  if (chave === 'credito' || chave === 'debito' || chave === 'pix' || chave === 'boleto') {
    return chave;
  }
  return undefined;
}

export function ehCategoriaPrincipal(texto: string): texto is CategoriaPrincipal {
  return (CATEGORIAS_PRINCIPAIS as readonly string[]).includes(texto);
}

export function ehTipoDeItem(texto: string): texto is TipoDeItem {
  return (TIPOS_DE_ITEM as readonly string[]).includes(texto);
}
