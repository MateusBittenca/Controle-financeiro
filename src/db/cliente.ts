import pg from 'pg';
import { arredondarCentavos } from '../rules/dinheiro.js';

const OID_DATA = 1082;

pg.types.setTypeParser(OID_DATA, (valor) => valor);

export function urlDoBanco(): string {
  return process.env.DATABASE_URL ?? 'postgres://controle:controle@127.0.0.1:5432/controle_financeiro';
}

export const pool = new pg.Pool({
  connectionString: urlDoBanco(),
  connectionTimeoutMillis: 3000,
});

export function numeroDoBanco(valor: unknown): number {
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(numero)) throw new Error('Valor inválido vindo do banco.');
  return arredondarCentavos(numero);
}
