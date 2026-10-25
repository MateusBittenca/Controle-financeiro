import { useEffect, useState } from 'react';
import {
  formatarData,
  formatarReais,
  textoQuantidade,
  type ConferenciaVisivel,
  type LancamentoTela,
  type MesDashboard,
  type MesDisponivel,
  type TotalCategoria,
  type TotalTipo,
} from './formato';

const DESTAQUES = new Set(['Mensalidades (assinaturas)', 'Gasolina']);

const COR_CATEGORIA: Record<string, string> = {
  'Mensalidades (assinaturas)': 'cor-azul',
  Gasolina: 'cor-laranja',
  'Gastos à parte (compras na hora, débito à vista)': 'cor-verde',
  Demais: 'cor-roxo',
};

const COR_TIPO: Record<string, string> = {
  'Alimentação Sodexo': 'cor-laranja',
  'Barbearia/cuidados pessoais': 'cor-rosa',
  Combustível: 'cor-amarelo',
  'Compras diversas': 'cor-ciano',
  Educação: 'cor-azul',
  'Esporte/lazer': 'cor-verde',
  'Farmácia/saúde': 'cor-vermelho',
  'Fast food/delivery': 'cor-laranja',
  'Ingressos/eventos': 'cor-roxo',
  'Mercado/compras de alimentos': 'cor-verde',
  'Software/assinaturas digitais': 'cor-azul',
  'Transferências Pix a pessoas': 'cor-ciano',
  'Transporte (Uber/estacionamento)': 'cor-roxo',
};

const CORES = ['cor-ciano', 'cor-rosa', 'cor-amarelo', 'cor-verde', 'cor-azul', 'cor-laranja', 'cor-roxo', 'cor-vermelho'];

function corDaCategoria(categoria: string): string {
  return COR_CATEGORIA[categoria] ?? 'cor-roxo';
}

function corDoTipo(tipo: string): string {
  const conhecida = COR_TIPO[tipo];
  if (conhecida) return conhecida;
  const indice = [...tipo].reduce((total, letra) => total + letra.charCodeAt(0), 0);
  return CORES[indice % CORES.length] ?? 'cor-azul';
}

export function App() {
  const [meses, setMeses] = useState<MesDisponivel[]>([]);
  const [anoMes, setAnoMes] = useState('');
  const [mes, setMes] = useState<MesDashboard | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [tipo, setTipo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [conferencia, setConferencia] = useState<ConferenciaVisivel | null>(null);
  const [incluirOutros, setIncluirOutros] = useState(false);
  const [salvandoId, setSalvandoId] = useState<number | null>(null);

  useEffect(() => {
    let ativo = true;
    fetch('/api/meses')
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error('Não foi possível listar os meses.');
        return (await resposta.json()) as MesDisponivel[];
      })
      .then((lista) => {
        if (!ativo) return;
        setMeses(lista);
        setAnoMes((atual) => atual || lista[0]?.anoMes || '');
        setCarregando(false);
      })
      .catch((falha: unknown) => {
        if (!ativo) return;
        setErro(falha instanceof Error ? falha.message : 'Não foi possível listar os meses.');
        setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (!anoMes) return;
    let ativo = true;
    setMes(null);
    setErro('');
    setCategoria(null);
    setTipo(null);
    setCarregando(true);
    fetch(`/api/meses/${anoMes}`)
      .then(async (resposta) => {
        const corpo = (await resposta.json()) as MesDashboard & { erro?: string };
        if (!resposta.ok) throw new Error(corpo.erro ?? 'Não foi possível carregar o mês.');
        return corpo;
      })
      .then((dados) => {
        if (!ativo) return;
        setMes(dados);
        setCarregando(false);
      })
      .catch((falha: unknown) => {
        if (!ativo) return;
        setErro(falha instanceof Error ? falha.message : 'Não foi possível carregar o mês.');
        setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [anoMes]);

  async function enviarPlanilha(arquivo: File): Promise<void> {
    if (!arquivo.name.toLowerCase().endsWith('.xlsx')) {
      setErro('Envie um arquivo .xlsx, no formato gastos-AAAA-MM.xlsx.');
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      const resposta = await fetch(`/api/planilhas?nome=${encodeURIComponent(arquivo.name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: arquivo,
      });
      const corpo = (await resposta.json()) as ConferenciaVisivel & { erro?: string };
      if (!resposta.ok) throw new Error(corpo.erro ?? 'Não foi possível enviar a planilha.');
      setIncluirOutros(false);
      setConferencia(corpo);
    } catch (falha: unknown) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível enviar a planilha.');
    } finally {
      setEnviando(false);
    }
  }

  async function responder(id: number, campos: { motivo?: string; observacao?: string }): Promise<void> {
    if (!anoMes) return;
    setSalvandoId(id);
    setErro('');
    try {
      const resposta = await fetch(`/api/meses/${anoMes}/lancamentos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campos),
      });
      const corpo = (await resposta.json()) as MesDashboard & { erro?: string };
      if (!resposta.ok) throw new Error(corpo.erro ?? 'Não foi possível salvar a resposta.');
      setMes(corpo);
    } catch (falha: unknown) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível salvar a resposta.');
    } finally {
      setSalvandoId(null);
    }
  }

  async function confirmarPlanilha(acao: 'gravar' | 'substituir'): Promise<void> {
    if (!conferencia) return;
    setEnviando(true);
    setErro('');
    try {
      const resposta = await fetch('/api/planilhas/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: conferencia.id, acao, incluirOutrosMeses: incluirOutros }),
      });
      const corpo = (await resposta.json()) as MesDashboard & { erro?: string };
      if (!resposta.ok) throw new Error(corpo.erro ?? 'Não foi possível gravar a conferência.');
      const listaResposta = await fetch('/api/meses');
      if (!listaResposta.ok) throw new Error('A planilha entrou, mas a lista de meses não atualizou.');
      const lista = (await listaResposta.json()) as MesDisponivel[];
      setMeses(lista);
      setCategoria(null);
      setTipo(null);
      setConferencia(null);
      setMes(corpo);
      setAnoMes(corpo.anoMes);
      setCarregando(false);
    } catch (falha: unknown) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível gravar a conferência.');
    } finally {
      setEnviando(false);
    }
  }

  const temFiltro = categoria !== null || tipo !== null;
  const lista = (mes?.lancamentos ?? []).filter((item) => {
    if (categoria && item.categoria !== categoria) return false;
    if (tipo && item.tipoDeItem !== tipo) return false;
    return true;
  });

  return (
    <>
      <header className="nav">
        <p className="marca">Controle</p>
        <div className="nav-acoes">
          {meses.length > 0 ? (
            <label className="seletor">
              Mês
              <select
              aria-label="Mês"
              value={anoMes}
              onChange={(evento) => {
                setConferencia(null);
                setAnoMes(evento.target.value);
              }}
            >
              {meses.map((item) => (
                <option key={item.anoMes} value={item.anoMes}>
                  {item.rotulo}
                </option>
              ))}
            </select>
            </label>
          ) : null}
          <EnvioPlanilha
            enviando={enviando}
            rotulo={enviando ? (conferencia ? 'Gravando…' : 'Conferindo…') : 'Enviar planilha'}
            onArquivo={(arquivo) => void enviarPlanilha(arquivo)}
          />
          {anoMes ? (
            <a className="botao botao-contorno" href={`/api/meses/${anoMes}/planilha`}>
              Exportar planilha
            </a>
          ) : null}
        </div>
      </header>

      <main className="conteudo">
        {erro ? <p className="aviso">{erro}</p> : null}
        {conferencia ? (
          <ConferenciaPainel
            conferencia={conferencia}
            enviando={enviando}
            incluirOutros={incluirOutros}
            onIncluirOutros={setIncluirOutros}
            onConfirmar={(acao) => void confirmarPlanilha(acao)}
            onFechar={() => setConferencia(null)}
          />
        ) : null}
        {!conferencia && !erro && !carregando && meses.length === 0 ? (
          <section className="hero">
            <h1>Envie a planilha da semana</h1>
            <p className="apoio">Use o botão Enviar planilha, no topo. O arquivo é gastos-AAAA-MM.xlsx.</p>
          </section>
        ) : null}
        {!conferencia && mes ? (
          <Painel
            mes={mes}
            categoria={categoria}
            tipo={tipo}
            lista={lista}
            temFiltro={temFiltro}
            onCategoria={(nome) => setCategoria((atual) => (atual === nome ? null : nome))}
            onTipo={(nome) => setTipo((atual) => (atual === nome ? null : nome))}
            onLimpar={() => {
              setCategoria(null);
              setTipo(null);
            }}
            salvandoId={salvandoId}
            onResponder={(id, campos) => void responder(id, campos)}
          />
        ) : null}
        {carregando && !erro && !conferencia ? <p className="apoio">Carregando…</p> : null}
      </main>
    </>
  );
}

function Painel({
  mes,
  categoria,
  tipo,
  lista,
  temFiltro,
  onCategoria,
  onTipo,
  onLimpar,
  salvandoId,
  onResponder,
}: {
  mes: MesDashboard;
  categoria: string | null;
  tipo: string | null;
  lista: LancamentoTela[];
  temFiltro: boolean;
  onCategoria: (nome: string) => void;
  onTipo: (nome: string) => void;
  onLimpar: () => void;
  salvandoId: number | null;
  onResponder: (id: number, campos: { motivo?: string; observacao?: string }) => void;
}) {
  const filtroTexto = [categoria, tipo].filter(Boolean).join(' · ');

  return (
    <>
      <section className="hero">
        <h1>{capitalizar(mes.rotulo)}</h1>
        <p className="total">{formatarReais(mes.totalEquivalente)}</p>
        <p className="apoio">
          Pago {formatarReais(mes.totalReal)} · {textoQuantidade(mes.quantidade)}
        </p>
      </section>

      <section className="secao" aria-label="Categorias">
        <h2>Categorias</h2>
        <div className="grade-categorias">
          {mes.categorias.map((bloco) => (
            <CartaoCategoria
              key={bloco.categoria}
              bloco={bloco}
              ativo={categoria === bloco.categoria}
              onToggle={onCategoria}
            />
          ))}
        </div>
      </section>

      {mes.tipos.length > 0 ? (
        <section className="secao" aria-label="Tipos de item">
          <h2>Tipos de item</h2>
          <div className="grade-tipos">
            {mes.tipos.map((bloco) => (
              <CartaoTipo key={bloco.tipo} bloco={bloco} ativo={tipo === bloco.tipo} onToggle={onTipo} />
            ))}
          </div>
        </section>
      ) : null}

      {mes.pendenciasSodexo.length > 0 || mes.boletosFundacao.length > 0 ? (
        <section className="atencao" aria-label="Atenção">
          {mes.pendenciasSodexo.length > 0 ? (
            <p>
              {mes.pendenciasSodexo.length === 1
                ? '1 compra na Sodexo está sem motivo.'
                : `${mes.pendenciasSodexo.length} compras na Sodexo estão sem motivo.`}{' '}
              Responda o motivo abaixo.
            </p>
          ) : null}
          {mes.pendenciasSodexo.map((item) => (
            <RespostaMotivo
              key={item.id ?? `${item.data}-${item.descricao}-${item.valor}`}
              item={item}
              salvando={salvandoId === item.id}
              onSalvar={(id, motivo) => onResponder(id, { motivo })}
            />
          ))}
          {mes.boletosFundacao.map((boleto) => (
            <RespostaBoleto
              key={boleto.id ?? `${boleto.data}-${boleto.descricao}`}
              item={boleto}
              salvando={salvandoId === boleto.id}
              onSalvar={(id, observacao) => onResponder(id, { observacao })}
            />
          ))}
        </section>
      ) : null}

      <section className="secao" aria-label="Lançamentos">
        <div className="cabeca-lista">
          <h2>Lançamentos</h2>
          {temFiltro ? (
            <button type="button" className="link" onClick={onLimpar}>
              Limpar filtro
            </button>
          ) : null}
        </div>
        <p className="filtro" aria-live="polite">
          {temFiltro ? `Filtro: ${filtroTexto}. ${textoQuantidade(lista.length)}.` : textoQuantidade(lista.length)}
        </p>
        {lista.length === 0 ? (
          <p className="vazio">{mes.quantidade === 0 ? 'Nenhum lançamento neste mês.' : 'Nenhum lançamento neste filtro.'}</p>
        ) : (
          <div className="lista">
            {lista.map((item) => (
              <article key={`${item.id ?? ''}-${item.data}-${item.descricao}-${item.valor}`} className={`item ${corDaCategoria(item.categoria)}`}>
                <time dateTime={item.data}>{formatarData(item.data)}</time>
                <div>
                  <h3>{item.descricao}</h3>
                  <p>
                    {item.origem} · {item.categoria} · {item.tipoDeItem}
                  </p>
                  {item.motivo ? <p>Motivo: {item.motivo}</p> : null}
                  {item.observacao ? <p>{item.observacao}</p> : null}
                </div>
                <div className="valores">
                  <span>{formatarReais(item.valor)}</span>
                  <span>{item.valorMensalEquivalente === null ? '—' : formatarReais(item.valorMensalEquivalente)}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function CartaoCategoria({
  bloco,
  ativo,
  onToggle,
}: {
  bloco: TotalCategoria;
  ativo: boolean;
  onToggle: (nome: string) => void;
}) {
  const destaque = DESTAQUES.has(bloco.categoria);
  return (
    <button
      type="button"
      className={destaque ? `cartao destaque ${corDaCategoria(bloco.categoria)}` : `cartao ${corDaCategoria(bloco.categoria)}`}
      aria-pressed={ativo}
      onClick={() => onToggle(bloco.categoria)}
    >
      <span className="rotulo">{bloco.categoria}</span>
      <span className="numero">{formatarReais(bloco.totalEquivalente)}</span>
      <span className="detalhe">Pago {formatarReais(bloco.totalReal)}</span>
      <span className="detalhe">{textoQuantidade(bloco.quantidade)}</span>
    </button>
  );
}

function CartaoTipo({
  bloco,
  ativo,
  onToggle,
}: {
  bloco: TotalTipo;
  ativo: boolean;
  onToggle: (nome: string) => void;
}) {
  return (
    <button type="button" className={`tipo ${corDoTipo(bloco.tipo)}`} aria-pressed={ativo} onClick={() => onToggle(bloco.tipo)}>
      <span className="rotulo">{bloco.tipo}</span>
      <span className="numero numero-tipo">{formatarReais(bloco.totalEquivalente)}</span>
      <span className="detalhe">{textoQuantidade(bloco.quantidade)}</span>
    </button>
  );
}

function EnvioPlanilha({
  enviando,
  rotulo,
  onArquivo,
}: {
  enviando: boolean;
  rotulo: string;
  onArquivo: (arquivo: File) => void;
}) {
  return (
    <label className="botao">
      {rotulo}
      <input
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        aria-label="Enviar planilha"
        disabled={enviando}
        onChange={(evento) => {
          const arquivo = evento.target.files?.[0];
          evento.target.value = '';
          if (arquivo) onArquivo(arquivo);
        }}
      />
    </label>
  );
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function RespostaMotivo({
  item,
  salvando,
  onSalvar,
}: {
  item: LancamentoTela;
  salvando: boolean;
  onSalvar: (id: number, motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState('');
  if (item.id === undefined) return null;
  const id = item.id;
  return (
    <form
      className="resposta"
      onSubmit={(evento) => {
        evento.preventDefault();
        onSalvar(id, motivo);
      }}
    >
      <p>
        {formatarData(item.data)} · {item.descricao} · {formatarReais(item.valor)}
      </p>
      <div className="resposta-linha">
        <input
          aria-label={`Motivo de ${item.descricao} em ${formatarData(item.data)}`}
          value={motivo}
          placeholder="Motivo"
          onChange={(evento) => setMotivo(evento.target.value)}
          required
        />
        <button type="submit" className="botao botao-acao" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Responder'}
        </button>
      </div>
    </form>
  );
}

function RespostaBoleto({
  item,
  salvando,
  onSalvar,
}: {
  item: LancamentoTela;
  salvando: boolean;
  onSalvar: (id: number, observacao: string) => void;
}) {
  const [texto, setTexto] = useState(item.observacao);
  if (item.id === undefined) return null;
  const id = item.id;
  return (
    <form
      className="resposta"
      onSubmit={(evento) => {
        evento.preventDefault();
        onSalvar(id, texto);
      }}
    >
      <p>
        {`Boleto da Fundação Valeparaibana: pagos ${formatarReais(item.valor)}, considerados no mês ${formatarReais(item.valorMensalEquivalente ?? item.valor)}.`}
      </p>
      <div className="resposta-linha">
        <input
          aria-label="Resposta do boleto da Fundação Valeparaibana"
          value={texto}
          placeholder="Resposta"
          onChange={(evento) => setTexto(evento.target.value)}
          required
        />
        <button type="submit" className="botao botao-acao" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Responder'}
        </button>
      </div>
    </form>
  );
}

function ConferenciaPainel({
  conferencia,
  enviando,
  incluirOutros,
  onIncluirOutros,
  onConfirmar,
  onFechar,
}: {
  conferencia: ConferenciaVisivel;
  enviando: boolean;
  incluirOutros: boolean;
  onIncluirOutros: (valor: boolean) => void;
  onConfirmar: (acao: 'gravar' | 'substituir') => void;
  onFechar: () => void;
}) {
  const temGravacao =
    conferencia.novos.length > 0 || conferencia.alterados.length > 0 || (incluirOutros && conferencia.emOutroMes.length > 0);

  return (
    <section className="conferencia" aria-label="Conferência da planilha">
      <p className="rotulo">Conferência</p>
      <h1>{capitalizar(conferencia.rotulo)}</h1>
      <p className="apoio">{resumoConferencia(conferencia)}</p>

      <div className="resumo-conferencia">
        <article className="cor-verde">
          <span className="rotulo">Novos</span>
          <span className="numero">{conferencia.novos.length}</span>
        </article>
        <article className="cor-azul">
          <span className="rotulo">Já no banco</span>
          <span className="numero">{conferencia.iguais}</span>
        </article>
        <article className="cor-laranja">
          <span className="rotulo">Atualizações</span>
          <span className="numero">{conferencia.alterados.length}</span>
        </article>
        <article className="cor-roxo">
          <span className="rotulo">Só no banco</span>
          <span className="numero">{conferencia.soNoBanco.length}</span>
        </article>
      </div>

      {conferencia.repetidosNaPlanilha.length > 0 ? (
        <p className="nota">
          A planilha repete linhas iguais. Duas compras iguais no mesmo dia continuam separadas. A cópia só é barrada
          quando essa mesma linha já está gravada.
        </p>
      ) : null}

      {conferencia.emOutroMes.length > 0 ? (
        <div className="atencao">
          <p>
            {conferencia.emOutroMes.length === 1
              ? '1 lançamento desta planilha já está em outro mês.'
              : `${conferencia.emOutroMes.length} lançamentos desta planilha já estão em outro mês.`}{' '}
            Eles ficam de fora para não duplicar.
          </p>
          <label className="marcar">
            <input
              type="checkbox"
              checked={incluirOutros}
              onChange={(evento) => onIncluirOutros(evento.target.checked)}
            />
            Incluir mesmo assim
          </label>
          <ListaConferencia
            titulo="Já em outro mês"
            itens={conferencia.emOutroMes.map((item) => ({
              lancamento: item.lancamento,
              detalhe: item.rotulo,
            }))}
          />
        </div>
      ) : null}

      {conferencia.novos.length > 0 ? <ListaConferencia titulo="Entram agora" itens={conferencia.novos.map(linha)} /> : null}
      {conferencia.alterados.length > 0 ? (
        <ListaConferencia
          titulo="Atualizações"
          itens={conferencia.alterados.map((item) => ({
            lancamento: item.depois,
            detalhe: item.campos.join(', '),
          }))}
        />
      ) : null}
      {conferencia.soNoBanco.length > 0 ? (
        <>
          <p className="nota">
            Estes lançamentos estão no banco e não vieram nesta planilha. Gravar sem duplicar mantém os dois lados.
            Substituir o mês apaga estes.
          </p>
          <ListaConferencia titulo="Só no banco" itens={conferencia.soNoBanco.map(linha)} />
        </>
      ) : null}

      <div className="acoes">
        {temGravacao ? (
          <button type="button" className="botao botao-acao" disabled={enviando} onClick={() => onConfirmar('gravar')}>
            Gravar sem duplicar
          </button>
        ) : (
          <button type="button" className="botao botao-acao" disabled={enviando} onClick={onFechar}>
            Fechar
          </button>
        )}
        {conferencia.soNoBanco.length > 0 ? (
          <button type="button" className="link" disabled={enviando} onClick={() => onConfirmar('substituir')}>
            Substituir o mês pela planilha
          </button>
        ) : null}
        {temGravacao ? (
          <button type="button" className="link" disabled={enviando} onClick={onFechar}>
            Cancelar
          </button>
        ) : null}
      </div>
    </section>
  );
}

function linha(lancamento: LancamentoTela): { lancamento: LancamentoTela; detalhe?: string } {
  return { lancamento };
}

function ListaConferencia({
  titulo,
  itens,
}: {
  titulo: string;
  itens: { lancamento: LancamentoTela; detalhe?: string }[];
}) {
  return (
    <div className="bloco-lista">
      <h2>{titulo}</h2>
      <div className="lista">
        {itens.map((item, indice) => (
          <article
            key={`${titulo}-${item.lancamento.data}-${item.lancamento.descricao}-${indice}`}
            className={`item ${corDaCategoria(item.lancamento.categoria)}`}
          >
            <time dateTime={item.lancamento.data}>{formatarData(item.lancamento.data)}</time>
            <div>
              <h3>{item.lancamento.descricao}</h3>
              <p>
                {item.lancamento.origem} · {item.lancamento.categoria} · {item.lancamento.tipoDeItem}
              </p>
              {item.detalhe ? <p>{item.detalhe}</p> : null}
            </div>
            <div className="valores">
              <span>{formatarReais(item.lancamento.valor)}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function resumoConferencia(conferencia: ConferenciaVisivel): string {
  const total =
    conferencia.quantidadePlanilha === 1
      ? '1 lançamento na planilha'
      : `${conferencia.quantidadePlanilha} lançamentos na planilha`;
  if (
    conferencia.iguais === conferencia.quantidadePlanilha &&
    conferencia.novos.length === 0 &&
    conferencia.alterados.length === 0 &&
    conferencia.emOutroMes.length === 0
  ) {
    return `${total}. Todos já estão no banco. Nada será duplicado.`;
  }
  const frases = [total];
  if (conferencia.iguais > 0) frases.push(`${conferencia.iguais} já estão no banco e não entram outra vez`);
  if (conferencia.novos.length > 0) {
    frases.push(conferencia.novos.length === 1 ? '1 entra agora' : `${conferencia.novos.length} entram agora`);
  }
  if (conferencia.alterados.length > 0) {
    frases.push(conferencia.alterados.length === 1 ? '1 será atualizado' : `${conferencia.alterados.length} serão atualizados`);
  }
  if (conferencia.emOutroMes.length > 0) {
    frases.push(
      conferencia.emOutroMes.length === 1
        ? '1 já aparece em outro mês e fica de fora'
        : `${conferencia.emOutroMes.length} já aparecem em outro mês e ficam de fora`,
    );
  }
  return `${frases.join('. ')}.`;
}
