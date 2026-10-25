import { contemPadrao } from './texto.js';

/** Compra na Sodexo, no crédito ou no débito, pede o motivo ao usuário. */
export function ehSodexo(descricao: string): boolean {
  return contemPadrao(descricao, 'sodexo');
}
