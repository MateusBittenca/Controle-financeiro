import { parseData, parseValorBrasileiro, anoMes } from '../parsers/valores.js';
import { arredondarCentavos } from '../rules/dinheiro.js';
import { CATEGORIAS_TELA, type LancamentoTela } from './ler-mes.js';

const ORIGENS = ['Crédito', 'Débito', 'Pix', 'Boleto'] as const;

export interface GastoInformado {
  data?: unknown;
  descricao?: unknown;
  valor?: unknown;
  valorMensalEquivalente?: unknown;
  origem?: unknown;
  categoria?: unknown;
  tipoDeItem?: unknown;
  motivo?: unknown;
  observacao?: unknown;
}

export function identidadeDoGasto(entrada: GastoInformado): { data: string; descricao: string; valor: number; origem: string } {
  if (typeof entrada.data !== 'string' || !entrada.data.trim()) throw new Error('Informe a data.');
  const data = parseData(entrada.data.trim());
  if (typeof entrada.descricao !== 'string' || !entrada.descricao.trim()) throw new Error('Informe a descrição.');
  const valor = lerValor(entrada.valor, 'Informe o valor.');
  if (valor <= 0) throw new Error('O valor precisa ser maior que zero.');
  if (typeof entrada.origem !== 'string' || !(ORIGENS as readonly string[]).includes(entrada.origem)) {
    throw new Error('Escolha a origem.');
  }
  return { data, descricao: entrada.descricao.trim(), valor, origem: entrada.origem };
}

export function montarGastoManual(entrada: GastoInformado): { anoMes: string; lancamento: LancamentoTela } {
  const identidade = identidadeDoGasto(entrada);
  const equivalente = lerValorOpcional(entrada.valorMensalEquivalente);
  if (equivalente !== null && equivalente < 0) throw new Error('O valor mensal equivalente não pode ser negativo.');

  if (typeof entrada.categoria !== 'string' || !(CATEGORIAS_TELA as readonly string[]).includes(entrada.categoria)) {
    throw new Error('Escolha a categoria.');
  }
  if (typeof entrada.tipoDeItem !== 'string' || !entrada.tipoDeItem.trim()) throw new Error('Informe o tipo de item.');

  return {
    anoMes: anoMes(identidade.data),
    lancamento: {
      data: identidade.data,
      descricao: identidade.descricao,
      valor: identidade.valor,
      valorMensalEquivalente: equivalente,
      valorConsiderado: equivalente ?? identidade.valor,
      origem: identidade.origem,
      categoria: entrada.categoria,
      tipoDeItem: entrada.tipoDeItem.trim(),
      motivo: textoOpcional(entrada.motivo),
      observacao: textoOpcional(entrada.observacao),
    },
  };
}

function lerValor(valor: unknown, mensagem: string): number {
  if (typeof valor === 'number' && Number.isFinite(valor)) return arredondarCentavos(valor);
  if (typeof valor === 'string' && valor.trim()) {
    try {
      return parseValorBrasileiro(valor);
    } catch {
      throw new Error('Valor inválido. Use 34,90.');
    }
  }
  throw new Error(mensagem);
}

function lerValorOpcional(valor: unknown): number | null {
  if (valor === undefined || valor === null || valor === '') return null;
  return lerValor(valor, 'Valor mensal equivalente inválido.');
}

function textoOpcional(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}
