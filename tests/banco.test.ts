import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import pg from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { lerArquivoPlanilha } from '../src/dashboard/ler-mes.js';
import { pool, urlDoBanco } from '../src/db/cliente.js';
import {
  atualizarLancamento,
  contarGastosIguais,
  excluirLancamento,
  inserirLancamento,
  lerMesNoBanco,
  responderLancamento,
  substituirMes,
} from '../src/db/lancamentos.js';

const MES_TESTE = '1999-01';

async function bancoDisponivel(): Promise<boolean> {
  const pool = new pg.Pool({ connectionString: urlDoBanco(), connectionTimeoutMillis: 1000 });
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await pool.end();
  }
}

const disponivel = await bancoDisponivel();

afterAll(async () => {
  await pool.end();
});

describe.skipIf(!disponivel)('banco', () => {
  it('grava a planilha do mês e lê os mesmos totais', async () => {
    const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'controle-banco-'));
    const arquivo = path.join(diretorio, `gastos-${MES_TESTE}.xlsx`);
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Lançamentos');
      sheet.addRow([
        'Data',
        'Descrição',
        'Valor (R$)',
        'Origem',
        'Categoria',
        'Tipo de item',
        'Valor mensal equivalente (R$)',
        'Motivo (perguntar ao usuário)',
        'Observação',
      ]);
      sheet.addRow(['1999-01-15', 'Boleto Fundação Valeparaibana de Ensino', 1865.25, 'Boleto', 'Demais', 'Educação', 580, null, 'Regra do mês']);
      sheet.addRow(['1999-01-10', 'Sodexo', 7, 'Débito', 'Gastos à parte (compras na hora, débito à vista)', 'Alimentação Sodexo', null, null, null]);
      await workbook.xlsx.writeFile(arquivo);

      const lido = await lerArquivoPlanilha(arquivo);
      expect(await substituirMes(MES_TESTE, lido.lancamentos)).toBe(2);

      const mes = await lerMesNoBanco(MES_TESTE);
      expect(mes?.quantidade).toBe(2);
      expect(mes?.totalReal).toBeCloseTo(1872.25, 2);
      expect(mes?.totalEquivalente).toBeCloseTo(587, 2);
      expect(mes?.pendenciasSodexo).toHaveLength(1);
      expect(mes?.boletosFundacao).toHaveLength(1);
      expect(mes?.boletosFundacao[0]?.observacao).toBe('Regra do mês');

      await substituirMes(MES_TESTE, lido.lancamentos);
      const deNovo = await lerMesNoBanco(MES_TESTE);
      expect(deNovo?.quantidade).toBe(2);
    } finally {
      await substituirMes(MES_TESTE, []);
      fs.rmSync(diretorio, { recursive: true, force: true });
    }
  });

  it('grava o motivo respondido no lançamento', async () => {
    const sodexo = {
      data: '1999-01-10',
      descricao: 'Sodexo',
      valor: 7,
      valorMensalEquivalente: null,
      valorConsiderado: 7,
      origem: 'Débito',
      categoria: 'Gastos à parte (compras na hora, débito à vista)',
      tipoDeItem: 'Alimentação Sodexo',
      motivo: '',
      observacao: '',
    };
    try {
      await substituirMes(MES_TESTE, [sodexo]);
      const antes = await lerMesNoBanco(MES_TESTE);
      const id = antes?.lancamentos[0]?.id;
      expect(id).toEqual(expect.any(Number));
      if (id === undefined) return;
      expect(antes?.pendenciasSodexo).toHaveLength(1);

      expect(await responderLancamento(MES_TESTE, id, { motivo: 'Almoço de teste' })).toBe(true);
      const depois = await lerMesNoBanco(MES_TESTE);
      expect(depois?.lancamentos[0]?.motivo).toBe('Almoço de teste');
      expect(depois?.pendenciasSodexo).toHaveLength(0);
    } finally {
      await substituirMes(MES_TESTE, []);
    }
  });

  it('atualiza, conta iguais e exclui o lançamento', async () => {
    const mes = '1999-06';
    const gasto = {
      data: '1999-06-03',
      descricao: 'Posto exemplo',
      valor: 12.5,
      valorMensalEquivalente: null,
      valorConsiderado: 12.5,
      origem: 'Débito',
      categoria: 'Gasolina',
      tipoDeItem: 'Combustível',
      motivo: '',
      observacao: '',
    };
    try {
      const id = await inserirLancamento(mes, gasto);
      const copia = await inserirLancamento(mes, gasto);
      expect(await contarGastosIguais(gasto.data, gasto.descricao, gasto.valor, gasto.origem)).toBe(2);
      expect(await contarGastosIguais(gasto.data, gasto.descricao, gasto.valor, gasto.origem, id)).toBe(1);

      const alterado = { ...gasto, descricao: 'Posto alterado', valor: 20, valorConsiderado: 20 };
      expect(await atualizarLancamento(mes, id, alterado, mes)).toBe(true);
      const depois = await lerMesNoBanco(mes);
      const gravado = depois?.lancamentos.find((item) => item.id === id);
      expect(gravado?.descricao).toBe('Posto alterado');
      expect(gravado?.valor).toBe(20);

      expect(await excluirLancamento(mes, id)).toBe(true);
      expect(await excluirLancamento(mes, copia)).toBe(true);
      expect(await lerMesNoBanco(mes)).toBeNull();
    } finally {
      await substituirMes(mes, []);
    }
  });
});
