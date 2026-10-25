import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { classificarLancamento } from '../src/classify/classificar.js';
import { formatarReais } from '../src/rules/dinheiro.js';
import { atualizarPlanilhaDoMes } from '../src/spreadsheet/excel.js';
import type { Lancamento } from '../src/types/lancamento.js';

function gasto(parcial: {
  data: string;
  descricao: string;
  valor: number;
  origem?: Lancamento['origem'];
}): Lancamento {
  return classificarLancamento(parcial);
}

function textos(sheet: ExcelJS.Worksheet | undefined): string {
  if (!sheet) return '';
  const partes: string[] = [];
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (cell.value != null && typeof cell.value !== 'object') partes.push(String(cell.value));
    });
  });
  return partes.join('\n').replace(/\u00a0/g, ' ');
}

function numeroAoLado(sheet: ExcelJS.Worksheet, rotulo: string): number | undefined {
  let encontrado: number | undefined;
  sheet.eachRow((row) => {
    if (row.getCell(1).value === rotulo && typeof row.getCell(2).value === 'number') {
      encontrado = row.getCell(2).value as number;
    }
  });
  return encontrado;
}

describe('planilha do mês', () => {
  it('cria o arquivo, soma o equivalente de R$ 580 e não duplica lançamento', async () => {
    const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'controle-financeiro-'));
    try {
      const mes = '2026-10';
      const primeiros = [
        gasto({ data: '2026-10-03', descricao: 'Apple.Com/Bill', valor: 34.9, origem: 'credito' }),
        gasto({
          data: '2026-10-15',
          descricao: 'Boleto Fundação Valeparaibana de Ensino',
          valor: 1865.25,
          origem: 'boleto',
        }),
        gasto({ data: '2026-10-09', descricao: 'Sodexo', valor: 36, origem: 'credito' }),
      ];

      const criada = await atualizarPlanilhaDoMes(mes, primeiros, diretorio);
      expect(criada.adicionados).toBe(3);
      expect(criada.total).toBe(3);
      expect(criada.pendencias).toHaveLength(1);
      expect(path.basename(criada.arquivo)).toBe('gastos-2026-10.xlsx');

      const deNovo = await atualizarPlanilhaDoMes(mes, [
        ...primeiros,
        gasto({ data: '2026-10-07', descricao: 'POSTO Exemplo', valor: 100, origem: 'credito' }),
      ], diretorio);
      expect(deNovo.adicionados).toBe(1);
      expect(deNovo.total).toBe(4);

      const repetida = await atualizarPlanilhaDoMes(mes, primeiros, diretorio);
      expect(repetida.adicionados).toBe(0);
      expect(repetida.total).toBe(4);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(criada.arquivo);
      expect(workbook.worksheets.map((aba) => aba.name)).toEqual(['Lançamentos', 'Resumo', 'Notas']);

      const lancamentos = workbook.getWorksheet('Lançamentos');
      expect(lancamentos?.rowCount).toBe(5);

      const resumo = workbook.getWorksheet('Resumo');
      expect(resumo).toBeDefined();
      expect(numeroAoLado(resumo!, 'Mensalidades')).toBeCloseTo(614.9, 2);
      expect(numeroAoLado(resumo!, 'Gasolina')).toBeCloseTo(100, 2);
      expect(numeroAoLado(resumo!, 'Total geral')).toBeCloseTo(750.9, 2);

      const notas = textos(workbook.getWorksheet('Notas'));
      expect(notas).toContain(formatarReais(580).replace(/\u00a0/g, ' '));
      expect(notas).toContain('Sodexo');
    } finally {
      fs.rmSync(diretorio, { recursive: true, force: true });
    }
  });
});
