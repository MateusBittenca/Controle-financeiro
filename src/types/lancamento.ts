import type { CategoriaPrincipal, Origem, TipoDeItem } from './categorias.js';

/** Gasto já classificado, pronto para a planilha do mês. */
export interface Lancamento {
  /** Data no formato AAAA-MM-DD. */
  data: string;
  descricao: string;
  /** Valor real do lançamento, sempre positivo. */
  valor: number;
  origem: Origem;
  categoriaPrincipal: CategoriaPrincipal;
  tipoDeItem: TipoDeItem;
  /** Usado nos resumos quando uma regra troca o valor do mês, como o boleto da fundação. */
  valorMensalEquivalente?: number;
  motivo?: string;
  precisaMotivo: boolean;
}

/** Linha crua que sai do parser, antes da classificação. */
export interface ItemBruto {
  data: string;
  descricao: string;
  valor: number;
  origem?: Origem;
  motivo?: string;
}

export function valorConsiderado(lancamento: Lancamento): number {
  return lancamento.valorMensalEquivalente ?? lancamento.valor;
}
