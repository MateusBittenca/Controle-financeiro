import type { Origem } from '../types/categorias.js';
import { contemPadrao } from '../rules/texto.js';

/** Sem coluna de origem, o título decide. Na dúvida, o lançamento entra como crédito. */
export function inferirOrigem(descricao: string): Origem {
  if (contemPadrao(descricao, 'boleto')) return 'boleto';
  if (contemPadrao(descricao, 'pix')) return 'pix';
  if (contemPadrao(descricao, 'debito')) return 'debito';
  return 'credito';
}
