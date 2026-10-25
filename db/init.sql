CREATE TABLE IF NOT EXISTS lancamentos (
  id BIGSERIAL PRIMARY KEY,
  ano_mes CHAR(7) NOT NULL,
  data DATE NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(14, 2) NOT NULL,
  valor_mensal_equivalente NUMERIC(14, 2),
  origem TEXT NOT NULL,
  categoria TEXT NOT NULL,
  tipo_de_item TEXT NOT NULL,
  motivo TEXT NOT NULL DEFAULT '',
  observacao TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS lancamentos_ano_mes_idx ON lancamentos (ano_mes, data);
