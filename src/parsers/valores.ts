import { arredondarCentavos } from '../rules/dinheiro.js';

const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATA_BR = /^(\d{2})\/(\d{2})\/(\d{4})$/;

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export function parseData(texto: string): string {
  const limpo = texto.trim();
  const iso = DATA_ISO.exec(limpo);
  if (iso) return validarData(iso[1], iso[2], iso[3]);
  const br = DATA_BR.exec(limpo);
  if (br) return validarData(br[3], br[2], br[1]);
  throw new Error(`data inválida "${texto}". Use AAAA-MM-DD ou DD/MM/AAAA.`);
}

function validarData(ano: string, mes: string, dia: string): string {
  const iso = `${ano}-${mes}-${dia}`;
  const data = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== iso) {
    throw new Error(`data inválida "${iso}".`);
  }
  return iso;
}

export function formatarDataBr(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function anoMes(dataIso: string): string {
  return dataIso.slice(0, 7);
}

export function rotuloMes(anoMesTexto: string): string {
  const [ano, mes] = anoMesTexto.split('-');
  const nome = MESES[Number(mes) - 1];
  if (!nome || !ano) throw new Error(`Mês inválido: ${anoMesTexto}`);
  return `${nome} de ${ano}`;
}

export function parseValorBrasileiro(texto: string): number {
  const limpo = texto
    .trim()
    .replace(/\u00a0/g, '')
    .replace(/\s/g, '')
    .replace(/^r\$/i, '');
  if (!limpo) throw new Error('valor vazio');

  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  if (!/^[+-]?\d+(\.\d+)?$/.test(normalizado)) {
    throw new Error(`valor inválido "${texto}"`);
  }
  return arredondarCentavos(Number(normalizado));
}
