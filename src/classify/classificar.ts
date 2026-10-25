import { arredondarCentavos } from '../rules/dinheiro.js';
import { encontrarRegraValorMensal } from '../rules/boleto.js';
import { classificarTipoDeItem, ehGasolina, ehMensalidade } from '../rules/palavras-chave.js';
import { ehSodexo } from '../rules/sodexo.js';
import type { CategoriaPrincipal, TipoDeItem } from '../types/categorias.js';
import type { ItemBruto, Lancamento } from '../types/lancamento.js';
import { inferirOrigem } from './origem.js';

interface PartesLancamento {
  item: ItemBruto;
  descricao: string;
  valor: number;
  origem: Lancamento['origem'];
  motivo?: string;
  categoriaPrincipal: CategoriaPrincipal;
  tipoDeItem: TipoDeItem;
  valorMensalEquivalente?: number;
  precisaMotivo: boolean;
}

function limparMotivo(motivo: string | undefined): string | undefined {
  const texto = motivo?.trim();
  return texto ? texto : undefined;
}

function montar(partes: PartesLancamento): Lancamento {
  const lancamento: Lancamento = {
    data: partes.item.data,
    descricao: partes.descricao,
    valor: partes.valor,
    origem: partes.origem,
    categoriaPrincipal: partes.categoriaPrincipal,
    tipoDeItem: partes.tipoDeItem,
    precisaMotivo: partes.precisaMotivo,
  };
  if (partes.valorMensalEquivalente !== undefined) {
    lancamento.valorMensalEquivalente = partes.valorMensalEquivalente;
  }
  if (partes.motivo !== undefined) {
    lancamento.motivo = partes.motivo;
  }
  return lancamento;
}

/**
 * Define a categoria principal e o tipo do item.
 * A ordem é a prioridade: boleto configurado, Sodexo, mensalidade, gasolina,
 * débito à vista e, por último, demais.
 */
export function classificarLancamento(item: ItemBruto): Lancamento {
  const descricao = item.descricao.trim();
  const motivo = limparMotivo(item.motivo);
  const valor = arredondarCentavos(item.valor);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.data)) {
    throw new Error(`Data inválida no lançamento: "${item.data}".`);
  }
  if (!descricao) throw new Error('Lançamento sem descrição.');
  if (!(valor > 0)) throw new Error(`Valor inválido no lançamento "${descricao}".`);

  let origem = item.origem ?? inferirOrigem(descricao);
  const regraMensal = encontrarRegraValorMensal(descricao, valor);
  if (regraMensal) {
    if (item.origem === undefined && origem === 'credito') origem = 'boleto';
    return montar({
      item,
      descricao,
      valor,
      origem,
      motivo,
      categoriaPrincipal: regraMensal.categoriaPrincipal,
      tipoDeItem: regraMensal.tipoDeItem,
      valorMensalEquivalente: regraMensal.valorMensalEquivalente,
      precisaMotivo: false,
    });
  }

  if (ehSodexo(descricao)) {
    return montar({
      item,
      descricao,
      valor,
      origem,
      motivo,
      categoriaPrincipal: origem === 'debito' ? 'Gastos à parte' : 'Demais',
      tipoDeItem: 'Alimentação Sodexo',
      precisaMotivo: motivo === undefined,
    });
  }

  const mensalidade = ehMensalidade(descricao);
  if (mensalidade) {
    return montar({
      item,
      descricao,
      valor,
      origem,
      motivo,
      categoriaPrincipal: 'Mensalidades',
      tipoDeItem: mensalidade.tipoDeItem,
      precisaMotivo: false,
    });
  }

  if (ehGasolina(descricao)) {
    return montar({
      item,
      descricao,
      valor,
      origem,
      motivo,
      categoriaPrincipal: 'Gasolina',
      tipoDeItem: 'Transporte',
      precisaMotivo: false,
    });
  }

  const tipoDeItem = classificarTipoDeItem(descricao, origem);
  return montar({
    item,
    descricao,
    valor,
    origem,
    motivo,
    categoriaPrincipal: origem === 'debito' ? 'Gastos à parte' : 'Demais',
    tipoDeItem,
    precisaMotivo: false,
  });
}
