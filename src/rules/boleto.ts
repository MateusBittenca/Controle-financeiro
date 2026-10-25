import type { CategoriaPrincipal, TipoDeItem } from '../types/categorias.js';
import { arredondarCentavos } from './dinheiro.js';
import { contemPadrao } from './texto.js';

/**
 * Troca o valor usado no resumo do mês sem apagar o valor real do lançamento.
 * O boleto de R$ 1.865,25 da Fundação Valeparaibana de Ensino conta como R$ 580,00.
 * Para incluir outro boleto, copie um item desta lista.
 */
export interface RegraValorMensal {
  id: string;
  descricaoContem: string[];
  valor: number;
  tolerancia: number;
  valorMensalEquivalente: number;
  categoriaPrincipal: CategoriaPrincipal;
  tipoDeItem: TipoDeItem;
}

export const regrasValorMensal: RegraValorMensal[] = [
  {
    id: 'fundacao-valeparaibana',
    descricaoContem: ['fundacao valeparaibana'],
    valor: 1865.25,
    tolerancia: 0.001,
    valorMensalEquivalente: 580,
    categoriaPrincipal: 'Mensalidades',
    tipoDeItem: 'Educação',
  },
];

export function encontrarRegraValorMensal(
  descricao: string,
  valor: number,
): RegraValorMensal | undefined {
  const valorPago = arredondarCentavos(valor);
  return regrasValorMensal.find((regra) => {
    const valorConfere = Math.abs(valorPago - regra.valor) <= regra.tolerancia;
    const textoConfere = regra.descricaoContem.every((trecho) => contemPadrao(descricao, trecho));
    return valorConfere && textoConfere;
  });
}
