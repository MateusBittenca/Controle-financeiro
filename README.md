# Controle financeiro

Assistente local para a rotina de sexta-feira: você coloca o relatório de gastos num CSV e o programa atualiza a planilha daquele mês. Cada mês fica em um arquivo. O programa não envia e-mail.

## Instalar

Requer Node.js 20 ou superior.

```bash
npm install
npm run build
```

## Ver o dashboard

Com as planilhas do mês em `data/planilhas`:

```bash
npm run dev
```

Abre em http://127.0.0.1:5173. A tela só lê os arquivos `gastos-AAAA-MM.xlsx`. Para incluir gastos novos, continue colocando o CSV em `data/entrada` e rodando `npm run processar`.

## Toda sexta-feira

1. Exporte o relatório em CSV com as colunas `date`, `title` e `amount`.
2. A vírgula é o separador decimal (`34,90`). Se o arquivo for separado por vírgula, coloque o valor entre aspas (`"34,90"`). CSV separado por `;`, como o do Excel em português, também funciona.
3. Datas em `AAAA-MM-DD` ou `DD/MM/AAAA`.
4. Valores negativos são pagamento de fatura e não entram como gasto.
5. A coluna `origem` é opcional: `credito`, `debito`, `pix` ou `boleto`. Sem ela, o programa lê o título. Se nada indicar débito, pix ou boleto, trata como crédito. Compra no débito também pode trazer a palavra "débito" na descrição.
6. Copie o arquivo para `data/entrada/`.
7. Na pasta do projeto, depois do build:

```bash
npm run processar -- data/entrada/seu-relatorio.csv
```

8. Abra `data/planilhas/gastos-AAAA-MM.xlsx`.
9. Se o comando listar compras na Sodexo, preencha a coluna **Motivo** na planilha. Enquanto o motivo estiver vazio, a pendência continua na aba Notas e na próxima execução daquele mês.

O relatório de exemplo é fictício, sem dados bancários:

```bash
npm run processar -- data/entrada/exemplo-relatorio.csv
```

Rodar de novo o mesmo CSV não duplica lançamento. Também não reclassifica uma linha que já está na planilha: para isso, apague a linha e processe outra vez.

As planilhas geradas ficam na sua máquina e não entram no git.

## O que entra em cada categoria

- **Mensalidades** — `Apple.Com/Bill`, `Microsoft*Subscription`, `Cursor Ai Powered Ide` e IOF de compra internacional.
- **Gasolina** — descrição com posto, combustível ou gasolina.
- **Gastos à parte** — compras no débito à vista.
- **Demais** — o resto.

Cada item também ganha um tipo, como fast food, transporte, mercado ou farmácia. As listas ficam em `src/rules/palavras-chave.ts`.

Compra na **Sodexo**, no crédito ou no débito, fica com motivo vazio e `precisaMotivo`. A CLI lista essas pendências no final.

O boleto de **R$ 1.865,25** da Fundação Valeparaibana de Ensino guarda o valor real e entra nos resumos como **R$ 580,00**. A regra está em `src/rules/boleto.ts`.

## Testes

```bash
npm test
```

## Estrutura

```
src/types          lançamento e categorias
src/parsers        leitura do CSV; um extrato em PDF entra nesta camada
src/classify       categoria principal e tipo de item
src/rules          palavras-chave, Sodexo e boleto
src/spreadsheet    planilha mensal com exceljs
src/processar.ts   processarRelatorio
src/cli.ts         linha de comando
data/entrada       relatórios da semana
data/planilhas     gastos-AAAA-MM.xlsx
tests              testes unitários
```

A planilha tem as abas **Lançamentos**, **Resumo** e **Notas**. Mensalidades e Gasolina aparecem em destaque no resumo.
