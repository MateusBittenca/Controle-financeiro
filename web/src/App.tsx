import { useEffect, useState } from 'react';
import {
  formatarData,
  formatarReais,
  textoQuantidade,
  type LancamentoTela,
  type MesDashboard,
  type MesDisponivel,
  type TotalCategoria,
  type TotalTipo,
} from './formato';

const DESTAQUES = new Set(['Mensalidades (assinaturas)', 'Gasolina']);

export function App() {
  const [meses, setMeses] = useState<MesDisponivel[]>([]);
  const [anoMes, setAnoMes] = useState('');
  const [mes, setMes] = useState<MesDashboard | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [tipo, setTipo] = useState<string | null>(null);

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
        {meses.length > 0 ? (
          <label className="seletor">
            Mês
            <select aria-label="Mês" value={anoMes} onChange={(evento) => setAnoMes(evento.target.value)}>
              {meses.map((item) => (
                <option key={item.anoMes} value={item.anoMes}>
                  {item.rotulo}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </header>

      <main className="conteudo">
        {erro ? <p className="aviso">{erro}</p> : null}
        {!erro && !carregando && meses.length === 0 ? (
          <section className="hero">
            <h1>Nenhuma planilha ainda</h1>
            <p className="apoio">
              Coloque o CSV em data/entrada e rode npm run processar. O dashboard lê o arquivo do mês em
              data/planilhas.
            </p>
          </section>
        ) : null}
        {mes ? (
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
          />
        ) : null}
        {carregando && !erro ? <p className="apoio">Carregando…</p> : null}
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
}: {
  mes: MesDashboard;
  categoria: string | null;
  tipo: string | null;
  lista: LancamentoTela[];
  temFiltro: boolean;
  onCategoria: (nome: string) => void;
  onTipo: (nome: string) => void;
  onLimpar: () => void;
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
              Preencha a coluna Motivo na planilha.
            </p>
          ) : null}
          {mes.boletosFundacao.map((boleto) => (
            <p key={`${boleto.data}-${boleto.descricao}`}>
              {`Boleto da Fundação Valeparaibana: pagos ${formatarReais(boleto.valor)}, considerados no mês ${formatarReais(boleto.valorMensalEquivalente ?? boleto.valor)}.`}
            </p>
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
              <article key={`${item.data}-${item.descricao}-${item.valor}`} className="item">
                <time dateTime={item.data}>{formatarData(item.data)}</time>
                <div>
                  <h3>{item.descricao}</h3>
                  <p>
                    {item.origem} · {item.categoria} · {item.tipoDeItem}
                  </p>
                  {item.motivo ? <p>Motivo: {item.motivo}</p> : null}
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
      className={destaque ? 'cartao destaque' : 'cartao'}
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
    <button type="button" className="tipo" aria-pressed={ativo} onClick={() => onToggle(bloco.tipo)}>
      <span className="rotulo">{bloco.tipo}</span>
      <span className="numero numero-tipo">{formatarReais(bloco.totalEquivalente)}</span>
      <span className="detalhe">{textoQuantidade(bloco.quantidade)}</span>
    </button>
  );
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
