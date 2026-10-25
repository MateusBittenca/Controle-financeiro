import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { lerMes, listarMeses } from '../src/dashboard/ler-mes.js';

async function gravar(
  diretorio: string,
  nome: string,
  cabecalhos: string[],
  linhas: ExcelJS.CellValue[][],
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Lançamentos');
  sheet.addRow(cabecalhos);
  for (const linha of linhas) sheet.addRow(linha);
  await workbook.xlsx.writeFile(path.join(diretorio, nome));
}

describe('dashboard', () => {
  it('lê a planilha gerada pelo projeto e mapeia os rótulos curtos', async () => {
    const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'controle-dashboard-'));
    try {
      await gravar(
        diretorio,
        'gastos-2026-10.xlsx',
        [
          'Data',
          'Descrição',
          'Valor',
          'Valor mensal equivalente',
          'Valor considerado',
          'Origem',
          'Categoria principal',
          'Tipo de item',
          'Motivo',
          'Precisa motivo',
        ],
        [
          ['03/10/2026', 'Apple.Com/Bill', 34.9, null, 34.9, 'crédito', 'Mensalidades', 'Software/assinaturas digitais', null, 'não'],
          ['15/10/2026', 'Boleto Fundação Valeparaibana de Ensino', 1865.25, 580, 580, 'boleto', 'Mensalidades', 'Educação', null, 'não'],
          ['09/10/2026', 'EXEMPLO FICTICIO - Sodexo', 36, null, 36, 'crédito', 'Demais', 'Alimentação Sodexo', null, 'sim'],
          ['10/10/2026', 'Sodexo com motivo', 10, null, 10, 'débito', 'Gastos à parte', 'Alimentação Sodexo', 'Almoço de exemplo', 'não'],
          ['07/10/2026', 'POSTO Exemplo', 220, null, 220, 'crédito', 'Gasolina', 'Transporte', null, 'não'],
        ],
      );
      await fs.promises.writeFile(path.join(diretorio, 'nota.txt'), 'ignorar');

      const meses = await listarMeses(diretorio);
      expect(meses).toEqual([{ anoMes: '2026-10', rotulo: 'outubro de 2026' }]);

      const mes = await lerMes(diretorio, '2026-10');
      expect(mes).not.toBeNull();
      if (!mes) return;

      expect(mes.categorias.map((item) => item.categoria)).toEqual([
        'Mensalidades (assinaturas)',
        'Gasolina',
        'Gastos à parte (compras na hora, débito à vista)',
        'Demais',
      ]);

      const mensalidades = mes.categorias[0];
      expect(mensalidades?.totalReal).toBeCloseTo(1900.15, 2);
      expect(mensalidades?.totalEquivalente).toBeCloseTo(614.9, 2);
      expect(mensalidades?.quantidade).toBe(2);
      expect(mes.categorias[1]?.totalEquivalente).toBe(220);
      expect(mes.totalReal).toBeCloseTo(2166.15, 2);
      expect(mes.totalEquivalente).toBeCloseTo(880.9, 2);

      const apple = mes.lancamentos.find((item) => item.descricao === 'Apple.Com/Bill');
      expect(apple?.categoria).toBe('Mensalidades (assinaturas)');
      expect(apple?.origem).toBe('Crédito');
      expect(apple?.valorMensalEquivalente).toBeNull();
      expect(apple?.valorConsiderado).toBeCloseTo(34.9, 2);

      expect(mes.pendenciasSodexo.map((item) => item.descricao)).toEqual(['EXEMPLO FICTICIO - Sodexo']);
      expect(mes.boletosFundacao).toHaveLength(1);
      expect(mes.boletosFundacao[0]?.valor).toBe(1865.25);
      expect(mes.boletosFundacao[0]?.valorMensalEquivalente).toBe(580);
      expect(mes.tipos.map((item) => item.tipo)).toContain('Transporte');
    } finally {
      fs.rmSync(diretorio, { recursive: true, force: true });
    }
  });

  it('lê a planilha de referência, ignora fórmula sem número e respeita o equivalente numérico', async () => {
    const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'controle-dashboard-'));
    try {
      await gravar(
        diretorio,
        'gastos-2026-10.xlsx',
        [
          'Data',
          'Descrição',
          'Valor (R$)',
          'Origem',
          'Categoria',
          'Tipo de item',
          'Valor mensal equivalente (R$)',
          'Motivo (perguntar ao usuário)',
          'Observação',
        ],
        [
          ['2026-10-09', 'POSTO Exemplo', 50, 'Débito', 'Gasolina', 'Combustível', { formula: 'C2' }, null, null],
          ['2026-10-10', 'Sodexo', 7, 'Crédito', 'Demais', 'Alimentação Sodexo', { formula: 'C3' }, null, null],
          [
            '2026-10-15',
            'Boleto Fundação Valeparaibana de Ensino',
            1865.25,
            'Boleto',
            'Demais',
            'Educação',
            580,
            null,
            'Equivale a R$ 580,00 por mês',
          ],
          [
            '2026-10-16',
            'Sodexo almoço',
            8,
            'Débito',
            'Gastos à parte (compras na hora, débito à vista)',
            'Alimentação Sodexo',
            { formula: 'C5' },
            'Almoço de exemplo',
            null,
          ],
          ['2026-10-20', 'Curso exemplo', 99, 'Crédito', 'Demais', 'Educação', { formula: 'C6', result: 12 }, null, null],
        ],
      );

      const mes = await lerMes(diretorio, '2026-10');
      expect(mes).not.toBeNull();
      if (!mes) return;

      const posto = mes.lancamentos.find((item) => item.descricao === 'POSTO Exemplo');
      expect(posto?.valorConsiderado).toBe(50);
      expect(posto?.valorMensalEquivalente).toBeNull();
      expect(posto?.origem).toBe('Débito');
      expect(posto?.tipoDeItem).toBe('Combustível');

      const curso = mes.lancamentos.find((item) => item.descricao === 'Curso exemplo');
      expect(curso?.valorConsiderado).toBe(12);
      expect(curso?.valor).toBe(99);

      expect(mes.pendenciasSodexo.map((item) => item.descricao)).toEqual(['Sodexo']);
      expect(mes.boletosFundacao).toHaveLength(1);

      const demais = mes.categorias.find((item) => item.categoria === 'Demais');
      expect(demais?.totalReal).toBeCloseTo(1971.25, 2);
      expect(demais?.totalEquivalente).toBeCloseTo(599, 2);

      const gastos = mes.categorias.find((item) => item.categoria.startsWith('Gastos à parte'));
      expect(gastos?.quantidade).toBe(1);
      expect(gastos?.totalEquivalente).toBe(8);

      expect(await lerMes(diretorio, '2026-13')).toBeNull();
      expect(await lerMes(diretorio, '2026-09')).toBeNull();
    } finally {
      fs.rmSync(diretorio, { recursive: true, force: true });
    }
  });
});
