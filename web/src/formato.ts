export interface LancamentoTela {
  data: string;
  descricao: string;
  valor: number;
  valorMensalEquivalente: number | null;
  valorConsiderado: number;
  origem: string;
  categoria: string;
  tipoDeItem: string;
  motivo: string;
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

export function formatarReais(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

export function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}

export function textoQuantidade(quantidade: number): string {
  return quantidade === 1 ? '1 lançamento' : `${quantidade} lançamentos`;
}
