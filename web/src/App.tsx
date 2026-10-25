import { useEffect, useRef, useState } from 'react';
import {
  formatarData,
  formatarPercentual,
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
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [editando, setEditando] = useState<LancamentoTela | null>(null);
  const [excluindo, setExcluindo] = useState<LancamentoTela | null>(null);
  const [apagando, setApagando] = useState(false);
  const [aba, setAba] = useState<'resumo' | 'graficos'>('resumo');

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

  async function salvarGasto(campos: GastoFormulario, id?: number): Promise<void> {
    setEnviando(true);
    setErro('');
    try {
      const resposta = await fetch(id ? `/api/meses/${anoMes}/lancamentos/${id}` : '/api/lancamentos', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campos),
      });
      const corpo = (await resposta.json()) as MesDashboard & { erro?: string };
      if (!resposta.ok) throw new Error(corpo.erro ?? 'Não foi possível gravar o gasto.');
      await aplicarMes(corpo);
      setFormularioAberto(false);
      setEditando(null);
    } catch (falha: unknown) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível gravar o gasto.');
    } finally {
      setEnviando(false);
    }
  }

  async function excluirGasto(item: LancamentoTela): Promise<void> {
    if (item.id === undefined || !anoMes) return;
    setApagando(true);
    setErro('');
    try {
      const resposta = await fetch(`/api/meses/${anoMes}/lancamentos/${item.id}`, { method: 'DELETE' });
      const corpo = (await resposta.json()) as MesDashboard & { erro?: string };
      if (!resposta.ok) throw new Error(corpo.erro ?? 'Não foi possível excluir o gasto.');
      setExcluindo(null);
      await aplicarMes(corpo);
    } catch (falha: unknown) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível excluir o gasto.');
    } finally {
      setApagando(false);
    }
  }

  async function aplicarMes(corpo: MesDashboard): Promise<void> {
    const listaResposta = await fetch('/api/meses');
    if (!listaResposta.ok) throw new Error('A lista de meses não atualizou.');
    const lista = (await listaResposta.json()) as MesDisponivel[];
    setMeses(lista);
    setCategoria(null);
    setTipo(null);
    setCarregando(false);
    if (corpo.quantidade === 0) {
      const proximo = lista[0]?.anoMes ?? '';
      setAnoMes(proximo);
      if (!proximo) setMes(null);
      return;
    }
    setMes(corpo);
    setAnoMes(corpo.anoMes);
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
          <button
            type="button"
            className="botao botao-contorno"
            onClick={() => {
              setConferencia(null);
              setEditando(null);
              setExcluindo(null);
              setErro('');
              setFormularioAberto(true);
            }}
          >
            Novo gasto
          </button>
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
        {erro && !formularioAberto && !excluindo ? <p className="aviso">{erro}</p> : null}
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
            aba={aba}
            onAba={setAba}
            onEditar={(item) => {
              setConferencia(null);
              setExcluindo(null);
              setErro('');
              setEditando(item);
              setFormularioAberto(true);
            }}
            onExcluir={(item) => {
              setErro('');
              setExcluindo(item);
            }}
          />
        ) : null}
        {carregando && !erro && !conferencia ? <p className="apoio">Carregando…</p> : null}
      </main>
      {formularioAberto ? (
        <FormularioGasto
          key={editando?.id ?? (anoMes || 'novo')}
          anoMes={anoMes}
          lancamento={editando}
          tipos={mes?.tipos.map((item) => item.tipo) ?? []}
          enviando={enviando}
          erro={erro}
          onCancelar={() => {
            setFormularioAberto(false);
            setEditando(null);
            setErro('');
          }}
          onSalvar={(campos) => void salvarGasto(campos, editando?.id)}
        />
      ) : null}
      {excluindo ? (
        <ConfirmarExclusao
          item={excluindo}
          apagando={apagando}
          erro={erro}
          onCancelar={() => {
            if (apagando) return;
            setExcluindo(null);
            setErro('');
          }}
          onConfirmar={() => void excluirGasto(excluindo)}
        />
      ) : null}
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
  aba,
  onAba,
  onEditar,
  onExcluir,
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
  aba: 'resumo' | 'graficos';
  onAba: (aba: 'resumo' | 'graficos') => void;
  onEditar: (item: LancamentoTela) => void;
  onExcluir: (item: LancamentoTela) => void;
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
        <Abas aba={aba} onAba={onAba} />
      </section>

      {aba === 'graficos' ? (
        <div role="tabpanel" id="painel-graficos" aria-labelledby="aba-graficos">
          {mes.quantidade > 0 ? <GraficoMes mes={mes} /> : <p className="vazio painel-aba">Nenhum lançamento neste mês.</p>}
        </div>
      ) : (
        <div role="tabpanel" id="painel-resumo" aria-labelledby="aba-resumo">
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
                  {item.id !== undefined ? (
                    <div className="item-acoes">
                      <button type="button" className="link" onClick={() => onEditar(item)}>
                        Editar
                      </button>
                      <button type="button" className="link link-perigo" onClick={() => onExcluir(item)}>
                        Excluir
                      </button>
                    </div>
                  ) : null}
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
        </div>
      )}
    </>
  );
}

function Abas({ aba, onAba }: { aba: 'resumo' | 'graficos'; onAba: (aba: 'resumo' | 'graficos') => void }) {
  return (
    <div
      className="abas"
      role="tablist"
      aria-label="Visão do mês"
      onKeyDown={(evento) => {
        if (evento.key !== 'ArrowRight' && evento.key !== 'ArrowLeft') return;
        evento.preventDefault();
        const proxima = aba === 'resumo' ? 'graficos' : 'resumo';
        onAba(proxima);
        const lista = evento.currentTarget;
        requestAnimationFrame(() => lista.querySelector<HTMLButtonElement>(`#aba-${proxima}`)?.focus());
      }}
    >
      <button
        type="button"
        role="tab"
        id="aba-resumo"
        aria-selected={aba === 'resumo'}
        aria-controls="painel-resumo"
        tabIndex={aba === 'resumo' ? 0 : -1}
        onClick={() => onAba('resumo')}
      >
        Resumo
      </button>
      <button
        type="button"
        role="tab"
        id="aba-graficos"
        aria-selected={aba === 'graficos'}
        aria-controls="painel-graficos"
        tabIndex={aba === 'graficos' ? 0 : -1}
        onClick={() => onAba('graficos')}
      >
        Gráficos
      </button>
    </div>
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

const CATEGORIAS_FORMULARIO = [
  'Mensalidades (assinaturas)',
  'Gasolina',
  'Gastos à parte (compras na hora, débito à vista)',
  'Demais',
];

const ORIGENS_FORMULARIO = ['Crédito', 'Débito', 'Pix', 'Boleto'];

const TIPOS_FORMULARIO = [
  'Alimentação Sodexo',
  'Combustível',
  'Educação',
  'Transporte (Uber/estacionamento)',
  'Fast food/delivery',
  'Mercado/compras de alimentos',
  'Farmácia/saúde',
  'Software/assinaturas digitais',
  'Compras diversas',
  'Transferências Pix a pessoas',
  'Esporte/lazer',
  'Barbearia/cuidados pessoais',
  'Ingressos/eventos',
];

interface GastoFormulario {
  data: string;
  descricao: string;
  valor: string;
  valorMensalEquivalente: string;
  origem: string;
  categoria: string;
  tipoDeItem: string;
  motivo: string;
  observacao: string;
}

function dataInicial(anoMes: string): string {
  const agora = new Date();
  const iso = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
  if (anoMes && iso.startsWith(anoMes)) return iso;
  if (anoMes) return `${anoMes}-01`;
  return iso;
}

function valorParaCampo(valor: number | null): string {
  if (valor === null) return '';
  return valor.toFixed(2).replace('.', ',');
}

function FormularioGasto({
  anoMes,
  lancamento,
  tipos,
  enviando,
  erro,
  onCancelar,
  onSalvar,
}: {
  anoMes: string;
  lancamento: LancamentoTela | null;
  tipos: string[];
  enviando: boolean;
  erro: string;
  onCancelar: () => void;
  onSalvar: (campos: GastoFormulario) => void;
}) {
  const dialogo = useRef<HTMLFormElement>(null);
  const cancelar = useRef(onCancelar);
  const ocupado = useRef(enviando);
  cancelar.current = onCancelar;
  const [data, setData] = useState(lancamento?.data ?? dataInicial(anoMes));
  const [descricao, setDescricao] = useState(lancamento?.descricao ?? '');
  const [valor, setValor] = useState(lancamento ? valorParaCampo(lancamento.valor) : '');
  const [equivalente, setEquivalente] = useState(lancamento ? valorParaCampo(lancamento.valorMensalEquivalente) : '');
  const [origem, setOrigem] = useState(lancamento?.origem ?? 'Débito');
  const [categoria, setCategoria] = useState(lancamento?.categoria ?? 'Demais');
  const [tipoDeItem, setTipoDeItem] = useState(lancamento?.tipoDeItem ?? '');
  const [motivo, setMotivo] = useState(lancamento?.motivo ?? '');
  const [observacao, setObservacao] = useState(lancamento?.observacao ?? '');
  const [avisoDuplicata, setAvisoDuplicata] = useState('');
  const [erroConferencia, setErroConferencia] = useState('');
  const [conferindo, setConferindo] = useState(false);
  const opcoesTipo = [...new Set([...tipos, ...TIPOS_FORMULARIO])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const ocupadoAgora = enviando || conferindo;
  ocupado.current = ocupadoAgora;

  function camposAtuais(): GastoFormulario {
    return {
      data,
      descricao,
      valor,
      valorMensalEquivalente: equivalente,
      origem,
      categoria,
      tipoDeItem,
      motivo,
      observacao,
    };
  }

  function limparDuplicata(): void {
    setAvisoDuplicata('');
  }

  async function conferirAntesDeSalvar(): Promise<void> {
    if (avisoDuplicata) {
      onSalvar(camposAtuais());
      return;
    }
    setConferindo(true);
    setErroConferencia('');
    try {
      const params = new URLSearchParams({ data, descricao, valor, origem });
      if (lancamento?.id !== undefined) params.set('ignorar', String(lancamento.id));
      const resposta = await fetch(`/api/lancamentos/iguais?${params}`);
      const corpo = (await resposta.json()) as { quantidade?: number; erro?: string };
      if (!resposta.ok) throw new Error(corpo.erro ?? 'Não foi possível conferir o gasto.');
      if ((corpo.quantidade ?? 0) > 0) {
        setAvisoDuplicata(textoDuplicata(corpo.quantidade ?? 0));
        return;
      }
      onSalvar(camposAtuais());
    } catch (falha: unknown) {
      setErroConferencia(falha instanceof Error ? falha.message : 'Não foi possível conferir o gasto.');
    } finally {
      setConferindo(false);
    }
  }

  useEffect(() => {
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const noDialogo = dialogo.current;
    noDialogo?.querySelector<HTMLElement>('input[name="descricao"]')?.focus();
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        if (ocupado.current) return;
        evento.preventDefault();
        cancelar.current();
        return;
      }
      if (evento.key !== 'Tab' || !noDialogo) return;
      const focaveis = [...noDialogo.querySelectorAll<HTMLElement>('button, input, select, textarea')].filter(
        (elemento) => !elemento.hasAttribute('disabled'),
      );
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (!primeiro || !ultimo) return;
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    }
    document.addEventListener('keydown', aoTeclar);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = overflow;
      anterior?.focus();
    };
  }, []);

  return (
    <div
      className="cortina"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget && !ocupadoAgora) onCancelar();
      }}
    >
      <form
        ref={dialogo}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-gasto"
        onSubmit={(evento) => {
          evento.preventDefault();
          void conferirAntesDeSalvar();
        }}
      >
        <header className="modal-cabeca">
          <div>
            <h2 id="titulo-gasto">{lancamento ? 'Editar gasto' : 'Novo gasto'}</h2>
            <p>{lancamento ? 'A data define o mês do lançamento.' : 'O lançamento entra no mês da data.'}</p>
          </div>
          <button type="button" className="fechar" aria-label="Fechar" onClick={onCancelar} disabled={ocupadoAgora}>
            ×
          </button>
        </header>
        <div className="modal-corpo">
          {erro || erroConferencia ? <p className="aviso-modal">{erro || erroConferencia}</p> : null}
          {avisoDuplicata ? <p className="aviso-duplicata">{avisoDuplicata}</p> : null}
          <div className="grade-form">
            <label className="campo">
              Data
              <input
                type="date"
                value={data}
                onChange={(evento) => {
                  setData(evento.target.value);
                  limparDuplicata();
                }}
                required
              />
            </label>
            <label className="campo">
              Valor
              <input
                value={valor}
                inputMode="decimal"
                placeholder="34,90"
                onChange={(evento) => {
                  setValor(evento.target.value);
                  limparDuplicata();
                }}
                required
              />
            </label>
            <label className="campo campo-largo">
              Descrição
              <input
                name="descricao"
                value={descricao}
                onChange={(evento) => {
                  setDescricao(evento.target.value);
                  limparDuplicata();
                }}
                required
              />
            </label>
            <label className="campo">
              Origem
              <select
                value={origem}
                onChange={(evento) => {
                  setOrigem(evento.target.value);
                  limparDuplicata();
                }}
              >
                {ORIGENS_FORMULARIO.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="campo">
              Categoria
              <select value={categoria} onChange={(evento) => setCategoria(evento.target.value)}>
                {CATEGORIAS_FORMULARIO.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="campo campo-largo">
              Tipo de item
              <input list="tipos-de-item" value={tipoDeItem} onChange={(evento) => setTipoDeItem(evento.target.value)} required />
              <datalist id="tipos-de-item">
                {opcoesTipo.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>
            <p className="grupo-form">Complemento</p>
            <label className="campo">
              Valor mensal equivalente
              <input
                value={equivalente}
                inputMode="decimal"
                placeholder="Opcional"
                onChange={(evento) => setEquivalente(evento.target.value)}
              />
            </label>
            <label className="campo">
              Motivo
              <input value={motivo} onChange={(evento) => setMotivo(evento.target.value)} />
            </label>
            <label className="campo campo-largo">
              Observação
              <input value={observacao} onChange={(evento) => setObservacao(evento.target.value)} />
            </label>
          </div>
        </div>
        <footer className="modal-rodape">
          <button type="button" className="botao botao-contorno" onClick={onCancelar} disabled={ocupadoAgora}>
            Cancelar
          </button>
          <button type="submit" className="botao botao-acao" disabled={ocupadoAgora}>
            {enviando
              ? 'Salvando…'
              : conferindo
                ? 'Conferindo…'
                : avisoDuplicata
                  ? 'Gravar mesmo assim'
                  : lancamento
                    ? 'Salvar'
                    : 'Gravar gasto'}
          </button>
        </footer>
      </form>
    </div>
  );
}

function textoDuplicata(quantidade: number): string {
  const inicio =
    quantidade === 1
      ? 'Já existe 1 lançamento com a mesma data, descrição, valor e origem.'
      : `Já existem ${quantidade} lançamentos com a mesma data, descrição, valor e origem.`;
  return `${inicio} Duas compras iguais no mesmo dia continuam separadas.`;
}

function ConfirmarExclusao({
  item,
  apagando,
  erro,
  onCancelar,
  onConfirmar,
}: {
  item: LancamentoTela;
  apagando: boolean;
  erro: string;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  const dialogo = useRef<HTMLFormElement>(null);
  const cancelar = useRef(onCancelar);
  const ocupado = useRef(apagando);
  cancelar.current = onCancelar;
  ocupado.current = apagando;

  useEffect(() => {
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const noDialogo = dialogo.current;
    noDialogo?.querySelector<HTMLElement>('button[name="cancelar"]')?.focus();
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        if (ocupado.current) return;
        evento.preventDefault();
        cancelar.current();
        return;
      }
      if (evento.key !== 'Tab' || !noDialogo) return;
      const focaveis = [...noDialogo.querySelectorAll<HTMLElement>('button')].filter((elemento) => !elemento.hasAttribute('disabled'));
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (!primeiro || !ultimo) return;
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    }
    document.addEventListener('keydown', aoTeclar);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = overflow;
      anterior?.focus();
    };
  }, []);

  return (
    <div
      className="cortina"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget && !apagando) onCancelar();
      }}
    >
      <form
        ref={dialogo}
        className="modal modal-curta"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-excluir"
        onSubmit={(evento) => {
          evento.preventDefault();
          onConfirmar();
        }}
      >
        <header className="modal-cabeca">
          <div>
            <h2 id="titulo-excluir">Excluir gasto?</h2>
            <p>
              {formatarData(item.data)} · {item.descricao}
            </p>
          </div>
          <button type="button" className="fechar" aria-label="Fechar" onClick={onCancelar} disabled={apagando}>
            ×
          </button>
        </header>
        <div className="modal-corpo">
          {erro ? <p className="aviso-modal">{erro}</p> : null}
          <p className="valor-exclusao">{formatarReais(item.valor)}</p>
          <p className="detalhe">O lançamento sai do mês e da exportação.</p>
        </div>
        <footer className="modal-rodape">
          <button type="button" name="cancelar" className="botao botao-contorno" onClick={onCancelar} disabled={apagando}>
            Cancelar
          </button>
          <button type="submit" className="botao botao-perigo" disabled={apagando}>
            {apagando ? 'Excluindo…' : 'Excluir'}
          </button>
        </footer>
      </form>
    </div>
  );
}

function GraficoMes({ mes }: { mes: MesDashboard }) {
  const raio = 54;
  const circunferencia = 2 * Math.PI * raio;
  let percorrido = 0;
  const fatias = mes.categorias.filter((item) => item.totalEquivalente > 0);
  const dias = diasDoMes(mes.lancamentos);
  const maximoDia = Math.max(...dias.map((item) => item.valor), 1);
  const maximoCategoria = Math.max(...mes.categorias.map((item) => item.totalEquivalente), 1);
  const maximoTipo = Math.max(...mes.tipos.map((item) => item.totalEquivalente), 1);
  const maximoPago = Math.max(mes.totalReal, mes.totalEquivalente, 1);

  return (
    <div className="grade-graficos">
      <article className="cartao-grafico">
        <h2>Por categoria</h2>
        <p className="detalhe">Valor considerado no mês</p>
        <div className="painel-grafico">
          <svg className="rosca" viewBox="0 0 160 160" role="img" aria-label={`Distribuição por categoria, ${textoQuantidade(mes.quantidade)}`}>
            <circle cx="80" cy="80" r={raio} fill="none" stroke="#e8e8ed" strokeWidth="18" />
            {fatias.map((item) => {
              const trecho = mes.totalEquivalente === 0 ? 0 : (item.totalEquivalente / mes.totalEquivalente) * circunferencia;
              const circulo = (
                <circle
                  key={item.categoria}
                  className={corDaCategoria(item.categoria)}
                  cx="80"
                  cy="80"
                  r={raio}
                  fill="none"
                  stroke="var(--acento)"
                  strokeWidth="18"
                  strokeDasharray={`${trecho} ${circunferencia - trecho}`}
                  strokeDashoffset={-percorrido}
                  transform="rotate(-90 80 80)"
                />
              );
              percorrido += trecho;
              return circulo;
            })}
            <text x="80" y="78" textAnchor="middle" fill="#1d1d1f" fontSize="28" fontFamily="inherit">
              {mes.quantidade}
            </text>
            <text x="80" y="96" textAnchor="middle" fill="#6e6e73" fontSize="11" fontFamily="inherit">
              lançamentos
            </text>
          </svg>
          <div>
            {mes.categorias.map((item) => (
              <Barra
                key={item.categoria}
                rotulo={item.categoria}
                valor={item.totalEquivalente}
                maximo={maximoCategoria}
                total={mes.totalEquivalente}
                cor={corDaCategoria(item.categoria)}
              />
            ))}
          </div>
        </div>
      </article>

      {mes.totalReal !== mes.totalEquivalente ? (
        <article className="cartao-grafico">
          <h2>Pago e considerado</h2>
          <p className="detalhe">O considerado usa o valor mensal equivalente, quando ele existe.</p>
          <Barra rotulo="Considerado no mês" valor={mes.totalEquivalente} maximo={maximoPago} total={mes.totalReal} cor="cor-azul" />
          <Barra rotulo="Pago" valor={mes.totalReal} maximo={maximoPago} total={mes.totalReal} cor="cor-laranja" />
        </article>
      ) : null}

      {dias.length > 0 ? (
        <article className="cartao-grafico">
          <h2>Por dia</h2>
          <p className="detalhe">Valor considerado em cada data com lançamento.</p>
          <div className="dias" aria-label="Gastos por dia">
            {dias.map((item) => (
              <div key={item.data} className="dia">
                <div
                  className="coluna cor-azul"
                  style={{ height: `${Math.max(8, (item.valor / maximoDia) * 100)}%` }}
                  title={`${formatarData(item.data)} · ${formatarReais(item.valor)}`}
                />
                <span>{item.data.slice(8)}</span>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {mes.tipos.length > 0 ? (
        <article className="cartao-grafico">
          <h2>Por tipo</h2>
          <p className="detalhe">Valor considerado no mês</p>
          {mes.tipos.map((item) => (
            <Barra
              key={item.tipo}
              rotulo={item.tipo}
              valor={item.totalEquivalente}
              maximo={maximoTipo}
              total={mes.totalEquivalente}
              cor={corDoTipo(item.tipo)}
            />
          ))}
        </article>
      ) : null}
    </div>
  );
}

function Barra({
  rotulo,
  valor,
  maximo,
  total,
  cor,
}: {
  rotulo: string;
  valor: number;
  maximo: number;
  total?: number;
  cor: string;
}) {
  const largura = maximo <= 0 ? 0 : (valor / maximo) * 100;
  const percentual = total === undefined ? '' : formatarPercentual(valor, total);
  return (
    <div className="barra-linha">
      <span className="rotulo">{rotulo}</span>
      <div className="trilho" role="img" aria-label={`${rotulo}: ${formatarReais(valor)}${percentual ? `, ${percentual} do mês` : ''}`}>
        <div className={`preenchimento ${cor}`} style={{ width: `${valor > 0 ? Math.max(2, largura) : 0}%` }} />
      </div>
      <span className="valor-barra">
        {formatarReais(valor)}
        {percentual ? <span className="percentual">{percentual}</span> : null}
      </span>
    </div>
  );
}

function diasDoMes(lancamentos: LancamentoTela[]): { data: string; valor: number }[] {
  const mapa = new Map<string, number>();
  for (const item of lancamentos) {
    mapa.set(item.data, (mapa.get(item.data) ?? 0) + item.valorConsiderado);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, valor]) => ({ data, valor: Math.round(valor * 100) / 100 }));
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
