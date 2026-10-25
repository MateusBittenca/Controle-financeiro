export interface LancamentoTela {
  id?: number;
  data: string;
  descricao: string;
  valor: number;
  valorMensalEquivalente: number | null;
  valorConsiderado: number;
  origem: string;
  categoria: string;
  tipoDeItem: string;
  motivo: string;
  observacao: string;
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

export interface AlteracaoConferencia {
  antes: LancamentoTela;
  depois: LancamentoTela;
  campos: string[];
}

export interface ConferenciaVisivel {
  id: string;
  anoMes: string;
  rotulo: string;
  nomeArquivo: string;
  quantidadePlanilha: number;
  quantidadeBanco: number;
  iguais: number;
  novos: LancamentoTela[];
  alterados: AlteracaoConferencia[];
  soNoBanco: LancamentoTela[];
  emOutroMes: { lancamento: LancamentoTela; anoMes: string; rotulo: string }[];
  repetidosNaPlanilha: { lancamento: LancamentoTela; vezes: number }[];
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
