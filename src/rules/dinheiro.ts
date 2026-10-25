export function arredondarCentavos(valor: number): number {
  return Number(valor.toFixed(2));
}

export function formatarReais(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(arredondarCentavos(valor));
}

export function somarCentavos(valores: number[]): number {
  const total = valores.reduce((acumulado, valor) => acumulado + valor, 0);
  return arredondarCentavos(total);
}
