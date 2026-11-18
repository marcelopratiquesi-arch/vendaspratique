import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search, Send, Pencil, Check, X, Loader2, Building2, HelpCircle } from 'lucide-react';
import { supabase } from '../../../supabaseClient.js';
import { avisar } from '../../../components/avisar.js';
import { podeFazer } from '../../../permissoes/catalogoPermissoes.js';
import { useVendasDaFaixa } from '../comparativoMesAnterior.js';
import { useDosesValidas } from '../useDosesValidas.js';
import { tx, localeAtual } from '../../../i18n/traduzir.js';
import {
    META_PADRAO, PERIODOS_DIAS, hojeBrasil, faixaDosDias, mesesDaFaixa, montarGestao, filtrarLinhas,
    resumir, agruparPorUnidade, mensagemGestao, nomeCurto,
} from './regrasGestao.js';

// ==========================================================================================
// GESTÃO À VISTA — PRODUTOS (aba ao lado de "Ranking de produtos"; refeita em 18/11/2026 por pedido do dono:
// "bater o olho e saber o que aconteceu"). Sem pop-up: cada pessoa é uma linha com um gráfico pequeno por mês
// (verde = bateu a meta, vermelho = abaixo, cinza = ainda não tinha entrado / já tinha saído) e uma frase pronta.
// Só leitura das vendas; contas em regrasGestao.js. Quem é cobrado: Saver e Recepção ativos, meta mínima 3 por mês.
// ==========================================================================================

const dataBr = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');
const mesCurto = (mes) => {
    const n = new Date(`${mes}-15T12:00:00`).toLocaleDateString(localeAtual(), { month: 'short' }).replace('.', '');
    return n.charAt(0).toUpperCase() + n.slice(1);
};

// ---------- gráfico pequeno da pessoa: uma barra por mês ----------
const ALTURA_MAX = 36;
const MiniGrafico = ({ meses, mesAtual }) => {
    const topo = Math.max(1, ...meses.map(m => Math.max(m.realizado, m.obrigada ? m.meta : 0)));
    return (
        <div className="flex items-end gap-1.5" role="img" aria-label={meses.map(m => `${mesCurto(m.mes)}: ${m.realizado}`).join(', ')}>
            {meses.map(m => {
                const altura = Math.max(3, Math.round((m.realizado / topo) * ALTURA_MAX));
                const cor = m.status === 'atingida' ? 'bg-emerald-500' : m.status === 'abaixo' ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-600';
                const andamento = m.mes === mesAtual;
                const dica = `${mesCurto(m.mes)}: ${m.realizado}${m.obrigada ? ` de ${m.meta}` : ` (${tx('fora do vínculo')})`}${andamento ? ` · ${tx('mês em andamento')}` : ''}`;
                return (
                    <div key={m.mes} title={dica} className="flex flex-col items-center w-8">
                        <span className={`text-[11px] font-black tabular-nums leading-none mb-0.5 ${m.status === 'atingida' ? 'text-emerald-600 dark:text-emerald-400' : m.status === 'abaixo' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>{m.obrigada || m.realizado ? m.realizado : '–'}</span>
                        <div className="flex items-end" style={{ height: ALTURA_MAX }}>
                            <div className={`w-5 rounded-t ${cor} ${andamento ? 'opacity-70 ring-1 ring-offset-1 ring-slate-400 dark:ring-offset-slate-900' : ''}`} style={{ height: altura }} />
                        </div>
                        <span className={`text-[10px] font-bold uppercase leading-none mt-1 ${andamento ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>{mesCurto(m.mes)}</span>
                    </div>
                );
            })}
        </div>
    );
};

// Frase pronta: o que aconteceu com a pessoa
const fraseDaPessoa = (l, mesAtual, dias) => {
    const cobradosMeses = l.meses.filter(m => m.obrigada);
    if (!l.cobrado) return { tipo: 'neutro', texto: tx('Não é cobrado (vendeu como outro setor)') };
    if (cobradosMeses.length === 0) return { tipo: 'neutro', texto: tx('Fora do vínculo no período') };
    if (l.semVendas) return { tipo: 'alerta', texto: tx('Sem vendas nos últimos {dias} dias', { dias }) };
    const faltou = cobradosMeses.filter(m => m.status === 'abaixo' && m.mes !== mesAtual).map(m => mesCurto(m.mes));
    const atual = cobradosMeses.find(m => m.mes === mesAtual && m.status === 'abaixo');
    if (faltou.length === 0 && !atual) return { tipo: 'ok', texto: tx('Meta atingida em todos os meses') };
    const partes = [];
    if (faltou.length) partes.push(`${tx('Faltou bater meta em')}: ${faltou.join(', ')}`);
    if (atual) partes.push(`${mesCurto(atual.mes)} ${tx('em andamento')} (${atual.realizado}/${atual.meta})`);
    return { tipo: faltou.length ? 'ruim' : 'andamento', texto: partes.join(' · ') };
};
const COR_FRASE = {
    ok: 'text-emerald-700 dark:text-emerald-300',
    ruim: 'text-rose-700 dark:text-rose-300',
    andamento: 'text-rose-600 dark:text-rose-300',
    alerta: 'text-amber-700 dark:text-amber-300',
    neutro: 'text-slate-500 dark:text-slate-400',
};
const ICONE_FRASE = { ok: '✅', ruim: '❌', andamento: '⏳', alerta: '⚠️', neutro: '•' };

// ---------- meta por pessoa (botão de ajuste) ----------
const EditorMeta = ({ unidade, meta, usuario, onSalvou }) => {
    const [aberto, setAberto] = useState(false);
    const [valor, setValor] = useState(String(meta));
    const [salvando, setSalvando] = useState(false);
    useEffect(() => { setValor(String(meta)); }, [meta]);
    const salvar = async () => {
        const n = parseInt(valor, 10);
        if (!Number.isInteger(n) || n < 0 || n > 99) return avisar(tx('Digite um número de 0 a 99.'), 'erro');
        setSalvando(true);
        const { error } = await supabase.from('meta_produtos_pessoa').upsert({ unidade, meta: n, atualizado_por: usuario?.email || usuario?.nome || null, atualizado_em: new Date().toISOString() }, { onConflict: 'unidade' });
        setSalvando(false);
        if (error) {
            console.warn('Gestão à Vista: não gravou a meta por pessoa', error);
            return avisar(/meta_produtos_pessoa/i.test(error.message || '') ? tx('Falta criar a tabela da meta no banco (SQL da Gestão à Vista).') : tx('Erro ao salvar a meta: {message}', { message: error.message }), 'erro');
        }
        avisar(tx('Meta de {unidade} agora é {n} produtos por pessoa.', { unidade, n }), 'sucesso');
        setAberto(false);
        onSalvou?.(unidade, n);
    };
    if (!aberto) {
        return (
            <button type="button" onClick={(e) => { e.stopPropagation(); setAberto(true); }} className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-blue-200 text-blue-700 text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 dark:border-blue-500/30 dark:text-blue-300 dark:hover:bg-blue-500/10">
                <Pencil className="w-3 h-3" />{tx('Meta por pessoa')}: {meta}
            </button>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <input type="text" inputMode="numeric" autoFocus value={valor} onChange={(e) => setValor(e.target.value.replace(/\D/g, '').slice(0, 2))} onKeyDown={(e) => { if (e.key === 'Enter') salvar(); if (e.key === 'Escape') setAberto(false); }}
                className="w-14 h-8 px-2 rounded-lg border border-slate-300 bg-white text-sm font-black text-center dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
            <button type="button" onClick={salvar} disabled={salvando} className="h-8 w-8 rounded-lg bg-blue-600 text-white inline-flex items-center justify-center hover:bg-blue-700 disabled:opacity-50">
                {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </button>
            <button type="button" onClick={() => setAberto(false)} className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 inline-flex items-center justify-center dark:hover:bg-slate-800"><X className="w-3.5 h-3.5" /></button>
        </span>
    );
};

const Indicador = ({ rotulo, valor, tom }) => (
    <div className="rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{tx(rotulo)}</p>
        <p className={`text-lg font-black tabular-nums ${tom || 'text-slate-800 dark:text-white'}`}>{valor}</p>
    </div>
);

// Detalhe que abre embaixo da linha (sem pop-up)
const DetalhePessoa = ({ linha, faixa }) => {
    const hoje = hojeBrasil();
    const noPeriodo = linha.itens.filter(i => i.dia >= faixa.inicio && i.dia <= faixa.fim);
    const porProduto = useMemo(() => {
        const m = {};
        noPeriodo.forEach(i => {
            if (!m[i.produto]) m[i.produto] = { vendidos: 0, validos: 0, ultima: null };
            m[i.produto].vendidos += i.qtd; m[i.produto].validos += i.valida;
            if (i.valida > 0 && (!m[i.produto].ultima || i.dia > m[i.produto].ultima)) m[i.produto].ultima = i.dia;
        });
        return Object.entries(m).sort((a, b) => b[1].validos - a[1].validos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [linha, faixa]);
    const ultimas = [...noPeriodo].sort((a, b) => b.dia.localeCompare(a.dia)).slice(0, 10);
    const dias = (iso) => Math.max(0, Math.round((new Date(`${hoje}T12:00:00`) - new Date(`${iso}T12:00:00`)) / 86400000));
    return (
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/40 grid grid-cols-1 md:grid-cols-2 gap-4 text-[12px]">
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">{tx('Vínculo')}</p>
                <p className="font-semibold text-slate-700 dark:text-slate-200">
                    {tx('Início')}: <b>{linha.inicio ? dataBr(linha.inicio) : tx('sem data')}</b>
                    {linha.fim ? <> · {tx('Desligado em')} <b>{dataBr(linha.fim)}</b></> : null}
                    {linha.vinculoDias != null ? <> · {linha.vinculoDias} {tx('dias de vínculo')}</> : null}
                </p>
                <p className="font-semibold text-slate-500 dark:text-slate-400 mt-0.5">{tx('Período selecionado')}: {linha.diasPeriodo} {tx('dias')} · {tx('efetivo')}: {linha.diasEfetivos} {tx('dias')}</p>
                {linha.semDataInicio && <p className="mt-1 text-amber-700 dark:text-amber-300 font-semibold">{tx('Sem data de início no cadastro da Equipe: não dá para saber se o período anterior à entrada foi descontado.')}</p>}
                {linha.periodoCurto && <p className="mt-1 text-amber-700 dark:text-amber-300 font-semibold">{tx('Entrou depois do começo do período: o desempenho é o real, sem meta proporcional.')}</p>}
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mt-3 mb-1.5">{tx('Por produto no período')}</p>
                {porProduto.length === 0 ? <p className="font-semibold text-slate-500">{tx('Nenhuma venda registrada no período selecionado.')}</p> : (
                    <ul className="space-y-1">
                        {porProduto.map(([nome, d]) => (
                            <li key={nome} className="flex justify-between gap-3">
                                <span className="font-bold text-slate-800 dark:text-white truncate">{nome}</span>
                                <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap"><b className="text-slate-800 dark:text-white">{d.validos}</b>{d.vendidos > d.validos ? ` (+${d.vendidos - d.validos} ${tx('fora da meta')})` : ''}{d.ultima ? ` · ${tx('última')} ${dataBr(d.ultima)} (${dias(d.ultima)} ${tx('dias')})` : ''}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">{tx('Últimas vendas')}</p>
                {ultimas.length === 0 ? <p className="font-semibold text-slate-500">{tx('Nenhuma venda registrada no período selecionado.')}</p> : (
                    <ul className="space-y-1">
                        {ultimas.map((i, k) => (
                            <li key={k} className="flex justify-between gap-3">
                                <span className="font-bold text-slate-800 dark:text-white truncate">{dataBr(i.dia)} · {i.produto}</span>
                                <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">{i.qtd} un · {i.unidadeVenda}{i.valida < i.qtd ? ` · ${tx('não conta')}` : ''}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

// ---------- painel (aba) ----------
const GestaoAVistaProdutos = ({ usuario, colaboradores = [], vendasTodas = [], planos = [], produtos = [], unidadeAtual, unidades = [], abrirModalWhatsapp }) => {
    const [dias, setDias] = useState(120);
    const [unidadeFiltro, setUnidadeFiltro] = useState('TODOS');
    const [situacao, setSituacao] = useState('todos');
    const [busca, setBusca] = useState('');
    const [abertas, setAbertas] = useState({});
    const [detalhe, setDetalhe] = useState(null);
    const [metas, setMetas] = useState({});
    const [metaSemTabela, setMetaSemTabela] = useState(false);
    const visaoRede = unidadeAtual === 'TODOS';
    const hoje = hojeBrasil();

    useEffect(() => { setUnidadeFiltro('TODOS'); setAbertas({}); setDetalhe(null); }, [unidadeAtual]);

    // Metas por pessoa de cada unidade (padrão 3)
    useEffect(() => {
        let ativo = true;
        (async () => {
            const { data, error } = await supabase.from('meta_produtos_pessoa').select('unidade, meta');
            if (!ativo) return;
            if (error) { console.warn('Gestão à Vista: tabela meta_produtos_pessoa indisponível (usando 3)', error.message); setMetaSemTabela(true); return; }
            setMetaSemTabela(false);
            const m = {}; (data || []).forEach(r => { m[String(r.unidade).toUpperCase()] = r.meta; });
            setMetas(m);
        })();
        return () => { ativo = false; };
    }, []);

    // Vendas: período + começo do mês mais antigo (para a meta do mês não ficar pela metade)
    const faixa = useMemo(() => faixaDosDias(dias, hoje), [dias, hoje]);
    const faixaBusca = useMemo(() => ({ inicio: `${faixa.inicio.slice(0, 7)}-01`, fim: faixa.fim }), [faixa]);
    const { vendas, carregando, erro } = useVendasDaFaixa(faixaBusca, vendasTodas, unidadeAtual);
    const dosesValidas = useDosesValidas({ vendasCarregadas: vendasTodas, vendasDaTela: vendas, unidade: unidadeAtual, planos, produtos });

    const nomesUnidades = useMemo(() => (unidades || []).map(u => String(u.nome || u).toUpperCase()), [unidades]);
    const unidadesPermitidas = useMemo(() => (visaoRede ? (nomesUnidades.length ? nomesUnidades : null) : [String(unidadeAtual || '').toUpperCase()]), [visaoRede, nomesUnidades, unidadeAtual]);

    const meses = useMemo(() => mesesDaFaixa(faixa.inicio, faixa.fim), [faixa]);
    const mesAtual = meses[meses.length - 1];

    const { linhas } = useMemo(() => montarGestao({ colaboradores, vendas, planos, produtos, dosesValidas, metasPorUnidade: metas, faixa, hoje, mesMeta: mesAtual, unidadesPermitidas }),
        [colaboradores, vendas, planos, produtos, dosesValidas, metas, faixa, hoje, mesAtual, unidadesPermitidas]);

    const linhasUnidade = useMemo(() => filtrarLinhas(linhas, { unidade: unidadeFiltro }), [linhas, unidadeFiltro]);
    const resumo = useMemo(() => resumir(linhasUnidade), [linhasUnidade]);
    const visiveis = useMemo(() => filtrarLinhas(linhas, { situacao, busca, unidade: unidadeFiltro }), [linhas, situacao, busca, unidadeFiltro]);
    const grupos = useMemo(() => agruparPorUnidade(visiveis), [visiveis]);
    const listaUnidades = useMemo(() => [...new Set(linhas.map(l => l.unidade))].sort(), [linhas]);

    const podeAjustar = podeFazer(usuario, '307');
    const metaDe = (u) => metas[u] ?? META_PADRAO;
    const aoSalvarMeta = (u, n) => setMetas(m => ({ ...m, [u]: n }));

    const rotuloPeriodo = `${tx('ÚLTIMOS')} ${dias} ${tx('DIAS')}`;
    const enviarWhatsapp = () => {
        const metasUsadas = [...new Set(grupos.map(g => metaDe(g.unidade)))];
        const txt = mensagemGestao({ grupos, situacao, rotuloPeriodo, mesAtual, meta: metasUsadas.length === 1 ? metasUsadas[0] : META_PADRAO });
        abrirModalWhatsapp?.(txt, { titulo: 'Gestão à Vista — Produtos', icone: 'send', cor: 'emerald' });
    };
    const selectCls = 'h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200';

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-[16px] font-extrabold text-[#0F172A] dark:text-white">{tx('Gestão à Vista — Produtos')}</h3>
                    <p className="text-[13px] font-medium text-[#5B6478] dark:text-slate-400">{tx('Saver e Recepção · meta mínima de produtos por pessoa em cada mês')} · {rotuloPeriodo}</p>
                </div>
                <button type="button" onClick={enviarWhatsapp} disabled={visiveis.length === 0} className="h-11 px-4 rounded-xl bg-[#0F7A3E] text-white text-[14px] font-bold inline-flex items-center gap-2 hover:bg-[#0C6533] transition-colors disabled:opacity-50">
                    <Send className="w-4 h-4" />{tx('Enviar no WhatsApp')}
                </button>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-2">
                <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className={selectCls} aria-label={tx('Período')}>
                    {PERIODOS_DIAS.map(d => <option key={d} value={d}>{tx('Últimos')} {d} {tx('dias')}</option>)}
                </select>
                {visaoRede && (
                    <label className="relative inline-flex items-center">
                        <Building2 className="w-3.5 h-3.5 absolute left-2.5 text-blue-600 pointer-events-none" />
                        <select value={unidadeFiltro} onChange={(e) => setUnidadeFiltro(e.target.value)} className={`${selectCls} pl-8`} aria-label={tx('Unidade')}>
                            <option value="TODOS">{tx('Todas as unidades')}</option>
                            {listaUnidades.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </label>
                )}
                <select value={situacao} onChange={(e) => setSituacao(e.target.value)} className={selectCls} aria-label={tx('Situação')}>
                    <option value="todos">{tx('Todos')}</option>
                    <option value="atingida">{tx('Meta atingida (todos os meses)')}</option>
                    <option value="abaixo">{tx('Meta não atingida')}</option>
                </select>
                <label className="relative inline-flex items-center flex-1 min-w-[160px] max-w-xs">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 pointer-events-none" />
                    <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={tx('Buscar por nome...')} className={`${selectCls} w-full pl-8`} />
                </label>
                {visaoRede && grupos.length > 1 && (
                    <button type="button" onClick={() => setAbertas(grupos.every(g => abertas[g.unidade]) ? {} : Object.fromEntries(grupos.map(g => [g.unidade, true])))}
                        className="h-9 px-3 rounded-xl border border-slate-200 text-[11px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                        {grupos.every(g => abertas[g.unidade]) ? tx('Fechar todas') : tx('Abrir todas')}
                    </button>
                )}
                {!visaoRede && podeAjustar && <EditorMeta unidade={String(unidadeAtual).toUpperCase()} meta={metaDe(String(unidadeAtual).toUpperCase())} usuario={usuario} onSalvou={aoSalvarMeta} />}
            </div>

            {metaSemTabela && <p className="text-[12px] font-bold text-amber-700 bg-amber-50 rounded-xl px-3 py-2 dark:bg-amber-500/10 dark:text-amber-300">{tx('A meta por pessoa está valendo o padrão (3). Para ajustar por unidade, falta criar a tabela no banco (SQL da Gestão à Vista).')}</p>}
            {erro && <p className="text-[12px] font-bold text-rose-700 bg-rose-50 rounded-xl px-3 py-2 dark:bg-rose-500/10 dark:text-rose-300">{tx('Não foi possível carregar todas as vendas do período. Os números podem estar incompletos.')}</p>}

            {/* Faixa de números */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <Indicador rotulo="Cobrados" valor={resumo.cobrados} />
                <Indicador rotulo="Meta atingida" valor={resumo.atingiram} tom="text-emerald-600 dark:text-emerald-400" />
                <Indicador rotulo="Abaixo da meta" valor={resumo.abaixo} tom="text-rose-600 dark:text-rose-400" />
                <Indicador rotulo="Sem vendas" valor={resumo.semVendas} tom="text-amber-600 dark:text-amber-400" />
                <Indicador rotulo="Produtos vendidos" valor={resumo.total} />
            </div>

            {/* Legenda */}
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500" />{tx('bateu a meta do mês')}</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-rose-500" />{tx('abaixo da meta')}</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-300 dark:bg-slate-600" />{tx('ainda não tinha entrado / já tinha saído')}</span>
                <span className="inline-flex items-center gap-1.5"><HelpCircle className="w-3.5 h-3.5" />{tx('O número em cima de cada barra é quantos produtos vendeu no mês. O mês atual (com contorno) ainda está em andamento. Doses de Whey/Energy acima do limite da unidade não contam.')}</span>
            </p>

            {carregando && <p className="text-[12px] font-bold text-slate-500 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{tx('Carregando as vendas do período...')}</p>}

            {/* Unidades e pessoas */}
            {grupos.length === 0 ? (
                <p className="text-center text-[13px] font-semibold text-slate-500 py-10 dark:text-slate-400">{tx('Ninguém encontrado com esses filtros.')}</p>
            ) : grupos.map(g => {
                const aberta = !visaoRede || abertas[g.unidade] || situacao !== 'todos' || !!busca || grupos.length === 1;
                return (
                    <section key={g.unidade} className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60">
                            <button type="button" onClick={() => visaoRede && setAbertas(a => ({ ...a, [g.unidade]: !a[g.unidade] }))} className="flex items-center gap-2 text-left">
                                {visaoRede && (aberta ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />)}
                                <span className="text-[12px] font-black uppercase tracking-widest text-slate-800 dark:text-white">{g.unidade}</span>
                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{g.resumo.cobrados} {tx('cobrados')} · <b className="text-emerald-600 dark:text-emerald-400">{g.resumo.atingiram} {tx('bateram')}</b> · <b className="text-rose-600 dark:text-rose-400">{g.resumo.abaixo} {tx('abaixo')}</b> · <b className="text-amber-600 dark:text-amber-400">{g.resumo.semVendas} {tx('sem vendas')}</b></span>
                            </button>
                            {visaoRede && podeAjustar && <EditorMeta unidade={g.unidade} meta={metaDe(g.unidade)} usuario={usuario} onSalvou={aoSalvarMeta} />}
                        </div>
                        {aberta && (
                            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                {g.linhas.map(l => {
                                    const frase = fraseDaPessoa(l, mesAtual, dias);
                                    const aberto = detalhe === l.id;
                                    return (
                                        <li key={l.id}>
                                            <button type="button" onClick={() => setDetalhe(aberto ? null : l.id)} aria-expanded={aberto}
                                                className="w-full flex flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                                <span className="w-40 shrink-0 min-w-0">
                                                    <span className="block text-[13px] font-black text-slate-800 dark:text-white truncate">{nomeCurto(l.nome)}</span>
                                                    <span className="block text-[10px] font-semibold text-slate-400 uppercase truncate">{l.setor}{l.fim ? ` · ${tx('desligado')} ${dataBr(l.fim)}` : ''}</span>
                                                </span>
                                                <MiniGrafico meses={l.meses} mesAtual={mesAtual} />
                                                <span className="flex-1 min-w-[180px]">
                                                    <span className={`block text-[12px] font-bold ${COR_FRASE[frase.tipo]}`}>{ICONE_FRASE[frase.tipo]} {frase.texto}</span>
                                                    <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                                        {l.ultima ? `${tx('Última venda')}: ${dataBr(l.ultima)} · ${l.diasSemVender === 0 ? tx('hoje') : `${tx('há')} ${l.diasSemVender} ${tx('dias')}`}` : tx('Nenhuma venda registrada no período selecionado.')}
                                                        {l.semDataInicio && l.cobrado ? ` · ${tx('sem data de início')}` : ''}
                                                    </span>
                                                </span>
                                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${aberto ? 'rotate-180' : ''}`} />
                                            </button>
                                            {aberto && <DetalhePessoa linha={l} faixa={faixa} />}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>
                );
            })}
        </div>
    );
};

export default GestaoAVistaProdutos;
