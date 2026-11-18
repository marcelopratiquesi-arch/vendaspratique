import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine } from 'recharts';
import { X, ChevronDown, ChevronRight, Search, Send, Pencil, Check, Loader2, Building2, HelpCircle } from 'lucide-react';
import { supabase } from '../../../supabaseClient.js';
import { avisar } from '../../../components/avisar.js';
import { podeFazer } from '../../../permissoes/catalogoPermissoes.js';
import { useVendasDaFaixa } from '../comparativoMesAnterior.js';
import { useDosesValidas } from '../useDosesValidas.js';
import { tx, localeAtual } from '../../../i18n/traduzir.js';
import {
    META_PADRAO, PERIODOS_DIAS, hojeBrasil, faixaDosDias, mesesDaFaixa, montarGestao, filtrarLinhas,
    resumir, agruparPorUnidade, semanasDaPessoa, mensagemGestao, nomeCurto,
} from './regrasGestao.js';

// ==========================================================================================
// GESTÃO À VISTA — PRODUTOS (decisão do dono, 18/11/2026). Só leitura das vendas; contas em regrasGestao.js.
// Quem é cobrado: Saver e Recepção ativos, meta mínima de 3 produtos por pessoa por mês (ajustável por unidade).
// ==========================================================================================

const dataBr = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');
const rotuloMes = (mes) => new Date(`${mes}-15T12:00:00`).toLocaleDateString(localeAtual(), { month: 'short', year: '2-digit' }).replace('.', '');
const rotuloMesLongo = (mes) => new Date(`${mes}-15T12:00:00`).toLocaleDateString(localeAtual(), { month: 'long' }).toUpperCase();

const ETIQUETA = {
    atingida: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    abaixo: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    inativo: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    semvendas: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
};
const Etiqueta = ({ tipo, children }) => (
    <span className={`inline-flex items-center h-6 px-2 rounded-md text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${ETIQUETA[tipo]}`}>{children}</span>
);

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

// ---------- janela individual ----------
const JanelaPessoa = ({ linha, faixa, rotuloPeriodo, onFechar }) => {
    useEffect(() => {
        const aoTeclar = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onFechar(); } };
        window.addEventListener('keydown', aoTeclar, true);
        return () => window.removeEventListener('keydown', aoTeclar, true);
    }, [onFechar]);
    const semanas = useMemo(() => semanasDaPessoa(linha, faixa), [linha, faixa]);
    const ultimas = useMemo(() => [...linha.itens].filter(i => i.dia >= faixa.inicio && i.dia <= faixa.fim).sort((a, b) => b.dia.localeCompare(a.dia)).slice(0, 15), [linha, faixa]);
    const porProduto = useMemo(() => {
        const m = {};
        linha.itens.filter(i => i.dia >= faixa.inicio && i.dia <= faixa.fim).forEach(i => {
            if (!m[i.produto]) m[i.produto] = { vendidos: 0, validos: 0, ultima: null };
            m[i.produto].vendidos += i.qtd; m[i.produto].validos += i.valida;
            if (i.valida > 0 && (!m[i.produto].ultima || i.dia > m[i.produto].ultima)) m[i.produto].ultima = i.dia;
        });
        return Object.entries(m).sort((a, b) => b[1].validos - a[1].validos);
    }, [linha, faixa]);
    const hoje = hojeBrasil();
    const escuro = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

    return (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onFechar} />
            <div className="relative z-10 w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col rounded-[24px] bg-white shadow-2xl dark:bg-slate-900">
                <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-start justify-between gap-3 dark:border-slate-800 dark:bg-slate-800/60">
                    <div className="min-w-0">
                        <h3 className="text-lg font-black text-slate-800 dark:text-white truncate">{linha.nome}</h3>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mt-1">
                            {linha.unidade} · {linha.setor || '—'} · {linha.fim ? `${tx('Desligado em')} ${dataBr(linha.fim)}` : linha.desligadoSemData ? tx('Desligado (sem data)') : tx('Ativo')}
                        </p>
                    </div>
                    <button onClick={onFechar} className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 hover:bg-rose-100 hover:text-rose-600 inline-flex items-center justify-center dark:bg-slate-700 dark:text-slate-300"><X className="w-4 h-4" /></button>
                </div>

                <div className="overflow-y-auto p-5 space-y-5">
                    {/* Vínculo */}
                    <div className="rounded-xl border border-slate-200 p-3 text-[12px] font-semibold text-slate-600 grid grid-cols-2 sm:grid-cols-4 gap-3 dark:border-slate-800 dark:text-slate-300">
                        <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{tx('Início na equipe')}</p><p className="text-sm font-black text-slate-800 dark:text-white">{linha.inicio ? dataBr(linha.inicio) : tx('sem data')}</p></div>
                        <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{tx('Tempo de vínculo')}</p><p className="text-sm font-black text-slate-800 dark:text-white">{linha.vinculoDias != null ? `${linha.vinculoDias} ${tx('dias')}` : '—'}</p></div>
                        <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{tx('Período selecionado')}</p><p className="text-sm font-black text-slate-800 dark:text-white">{linha.diasPeriodo} {tx('dias')}</p></div>
                        <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{tx('Período efetivo')}</p><p className="text-sm font-black text-slate-800 dark:text-white">{linha.diasEfetivos} {tx('dias')}</p></div>
                        {linha.semDataInicio && <p className="col-span-full text-[11px] text-amber-700 dark:text-amber-300">{tx('Esta pessoa ainda não tem data de início no cadastro da Equipe. Sem ela, não dá para saber se o período anterior à entrada foi descontado.')}</p>}
                        {linha.periodoCurto && <p className="col-span-full text-[11px] text-amber-700 dark:text-amber-300">{tx('Entrou depois do começo do período: o desempenho mostrado é o real, sem meta proporcional. Validar a meta caso a caso.')}</p>}
                    </div>

                    {/* Mês a mês */}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{tx('Meta mês a mês')} ({linha.meta} {tx('produtos')})</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {linha.meses.map(m => (
                                <div key={m.mes} className="rounded-xl border border-slate-200 p-2.5 dark:border-slate-800">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{rotuloMes(m.mes)}</p>
                                    <p className="text-lg font-black text-slate-800 dark:text-white tabular-nums">{m.obrigada ? `${m.realizado}/${m.meta}` : m.realizado || '—'}</p>
                                    <Etiqueta tipo={m.status}>{tx(m.status === 'atingida' ? 'Atingida' : m.status === 'abaixo' ? 'Abaixo' : 'Inativo')}</Etiqueta>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Gráfico */}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{tx('Produtos vendidos por semana')} · {rotuloPeriodo}</p>
                        <div className="h-44">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={semanas} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={escuro ? '#1E293B' : '#EEF1F6'} />
                                    <XAxis dataKey="rotulo" tick={{ fontSize: 10, fill: escuro ? '#94A3B8' : '#5B6478' }} interval="preserveStartEnd" />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: escuro ? '#94A3B8' : '#5B6478' }} />
                                    <Tooltip formatter={(v) => [v, tx('produtos')]} labelFormatter={(r, p) => (p?.[0]?.payload?.ativa === false ? `${tx('Semana de')} ${r} · ${tx('inativo')}` : `${tx('Semana de')} ${r}`)}
                                        contentStyle={{ borderRadius: 12, fontSize: 12, background: escuro ? '#0F172A' : '#fff', border: `1px solid ${escuro ? '#334155' : '#E4E8F0'}` }} />
                                    <ReferenceLine y={Math.max(1, Math.round(linha.meta / 4))} stroke="#F59E0B" strokeDasharray="4 4" />
                                    <Bar dataKey="qtd" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                                        {semanas.map((s, i) => <Cell key={i} fill={!s.ativa ? (escuro ? '#334155' : '#CBD5E1') : '#1D4FD8'} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="text-[10px] font-semibold text-slate-400 mt-1">{tx('Barras cinza = semanas em que a pessoa ainda não tinha entrado ou já tinha saído. A linha laranja é o ritmo semanal da meta.')}</p>
                    </div>

                    {/* Por produto */}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{tx('Por produto no período')}</p>
                        {porProduto.length === 0 ? (
                            <p className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">{tx('Nenhuma venda registrada no período selecionado.')}</p>
                        ) : (
                            <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
                                {porProduto.map(([nome, d]) => (
                                    <li key={nome} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                                        <span className="font-bold text-slate-800 dark:text-white truncate">{nome}</span>
                                        <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                            <b className="text-slate-800 dark:text-white">{d.validos}</b>{d.vendidos > d.validos ? ` (+${d.vendidos - d.validos} ${tx('fora da meta')})` : ''} · {tx('última')} {dataBr(d.ultima)}
                                            {d.ultima ? ` (${Math.max(0, Math.round((new Date(`${hoje}T12:00:00`) - new Date(`${d.ultima}T12:00:00`)) / 86400000))} ${tx('dias')})` : ''}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Últimas vendas */}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{tx('Últimas vendas')}</p>
                        {ultimas.length === 0 ? (
                            <p className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">{tx('Nenhuma venda registrada no período selecionado.')}</p>
                        ) : (
                            <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
                                {ultimas.map((i, k) => (
                                    <li key={k} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                                        <span className="font-bold text-slate-800 dark:text-white truncate">{dataBr(i.dia)} · {i.produto}</span>
                                        <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">{i.qtd} un · {i.unidadeVenda}{i.valida < i.qtd ? ` · ${tx('não conta para a meta')}` : ''}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ---------- tela principal ----------
const Indicador = ({ rotulo, valor, tom }) => (
    <div className="rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{tx(rotulo)}</p>
        <p className={`text-lg font-black tabular-nums ${tom || 'text-slate-800 dark:text-white'}`}>{valor}</p>
    </div>
);

const GestaoAVistaProdutos = ({ aberto, onFechar, usuario, colaboradores = [], vendasTodas = [], planos = [], produtos = [], unidadeAtual, unidades = [], abrirModalWhatsapp }) => {
    const [dias, setDias] = useState(120);
    const [unidadeFiltro, setUnidadeFiltro] = useState('TODOS');
    const [situacao, setSituacao] = useState('todos');
    const [busca, setBusca] = useState('');
    const [mesMeta, setMesMeta] = useState('');
    const [abertas, setAbertas] = useState({});
    const [pessoa, setPessoa] = useState(null);
    const [metas, setMetas] = useState({});
    const [metaSemTabela, setMetaSemTabela] = useState(false);
    const visaoRede = unidadeAtual === 'TODOS';
    const hoje = hojeBrasil();

    useEffect(() => { if (aberto) { setUnidadeFiltro('TODOS'); setAbertas({}); setPessoa(null); } }, [aberto, unidadeAtual]);

    // Metas por pessoa de cada unidade (padrão 3)
    useEffect(() => {
        if (!aberto) return;
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
    }, [aberto]);

    // Vendas: período + começo do mês mais antigo (para a meta do mês não ficar pela metade)
    const faixa = useMemo(() => faixaDosDias(dias, hoje), [dias, hoje]);
    const faixaBusca = useMemo(() => ({ inicio: `${faixa.inicio.slice(0, 7)}-01`, fim: faixa.fim }), [faixa]);
    const { vendas, carregando, erro } = useVendasDaFaixa(aberto ? faixaBusca : null, vendasTodas, unidadeAtual);
    const dosesValidas = useDosesValidas({ vendasCarregadas: vendasTodas, vendasDaTela: vendas, unidade: unidadeAtual, planos, produtos });

    const nomesUnidades = useMemo(() => (unidades || []).map(u => String(u.nome || u).toUpperCase()), [unidades]);
    const unidadesPermitidas = useMemo(() => (visaoRede ? (nomesUnidades.length ? nomesUnidades : null) : [String(unidadeAtual || '').toUpperCase()]), [visaoRede, nomesUnidades, unidadeAtual]);

    const meses = useMemo(() => mesesDaFaixa(faixa.inicio, faixa.fim), [faixa]);
    const mesEscolhido = meses.includes(mesMeta) ? mesMeta : meses[meses.length - 1];

    const { linhas } = useMemo(() => montarGestao({ colaboradores, vendas, planos, produtos, dosesValidas, metasPorUnidade: metas, faixa, hoje, mesMeta: mesEscolhido, unidadesPermitidas }),
        [colaboradores, vendas, planos, produtos, dosesValidas, metas, faixa, hoje, mesEscolhido, unidadesPermitidas]);

    const linhasUnidade = useMemo(() => filtrarLinhas(linhas, { unidade: unidadeFiltro }), [linhas, unidadeFiltro]);
    const resumo = useMemo(() => resumir(linhasUnidade), [linhasUnidade]);
    const visiveis = useMemo(() => filtrarLinhas(linhas, { situacao, busca, unidade: unidadeFiltro }), [linhas, situacao, busca, unidadeFiltro]);
    const grupos = useMemo(() => agruparPorUnidade(visiveis), [visiveis]);
    const listaUnidades = useMemo(() => [...new Set(linhas.map(l => l.unidade))].sort(), [linhas]);

    const podeAjustar = podeFazer(usuario, '307');
    const metaDe = (u) => metas[u] ?? META_PADRAO;
    const aoSalvarMeta = (u, n) => setMetas(m => ({ ...m, [u]: n }));

    useEffect(() => {
        if (!aberto) return undefined;
        const aoTeclar = (e) => { if (e.key === 'Escape' && !pessoa) onFechar(); };
        window.addEventListener('keydown', aoTeclar);
        return () => window.removeEventListener('keydown', aoTeclar);
    }, [aberto, pessoa, onFechar]);

    if (!aberto) return null;

    const rotuloPeriodo = `${tx('ÚLTIMOS')} ${dias} ${tx('DIAS')}`;
    const enviarWhatsapp = () => {
        const metasUsadas = [...new Set(grupos.map(g => metaDe(g.unidade)))];
        const txt = mensagemGestao({ grupos, situacao, rotuloPeriodo, mesRotulo: rotuloMesLongo(mesEscolhido), meta: metasUsadas.length === 1 ? metasUsadas[0] : META_PADRAO });
        abrirModalWhatsapp?.(txt, { titulo: 'Gestão à Vista — Produtos', icone: 'send', cor: 'emerald' });
    };

    const selectCls = 'h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200';

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onFechar} />
            <div className="relative z-10 w-full max-w-5xl max-h-[94vh] overflow-hidden flex flex-col rounded-[24px] bg-white shadow-2xl dark:bg-slate-900">
                {/* Cabeçalho */}
                <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-black uppercase tracking-widest text-slate-800 dark:text-white">{tx('Gestão à Vista — Produtos')}</h2>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mt-1">
                                {rotuloPeriodo} · {visaoRede ? tx('Todas as unidades') : unidadeAtual} · {tx('Saver e Recepção')}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={enviarWhatsapp} disabled={visiveis.length === 0} className="h-9 px-3 rounded-xl bg-[#0F7A3E] text-white text-[12px] font-bold inline-flex items-center gap-2 hover:bg-[#0C6533] disabled:opacity-50">
                                <Send className="w-4 h-4" />{tx('Enviar no WhatsApp')}
                            </button>
                            <button onClick={onFechar} className="w-9 h-9 rounded-full bg-slate-200 text-slate-500 hover:bg-rose-100 hover:text-rose-600 inline-flex items-center justify-center dark:bg-slate-700 dark:text-slate-300"><X className="w-4 h-4" /></button>
                        </div>
                    </div>

                    {/* Filtros */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className={selectCls} aria-label={tx('Período')}>
                            {PERIODOS_DIAS.map(d => <option key={d} value={d}>{tx('Últimos')} {d} {tx('dias')}</option>)}
                        </select>
                        <select value={mesEscolhido} onChange={(e) => setMesMeta(e.target.value)} className={selectCls} aria-label={tx('Mês da meta')}>
                            {meses.map(m => <option key={m} value={m}>{tx('Meta de')} {rotuloMesLongo(m)}</option>)}
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
                            <option value="vendeu">{tx('Quem vendeu')}</option>
                            <option value="semvendas">{tx('Quem não vendeu')}</option>
                            <option value="atingida">{tx('Meta atingida')}</option>
                            <option value="abaixo">{tx('Meta não atingida')}</option>
                        </select>
                        <label className="relative inline-flex items-center flex-1 min-w-[160px] max-w-xs">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 pointer-events-none" />
                            <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={tx('Buscar por nome...')} className={`${selectCls} w-full pl-8`} />
                        </label>
                        {!visaoRede && podeAjustar && (
                            <EditorMeta unidade={String(unidadeAtual).toUpperCase()} meta={metaDe(String(unidadeAtual).toUpperCase())} usuario={usuario} onSalvou={aoSalvarMeta} />
                        )}
                    </div>
                </div>

                <div className="overflow-y-auto p-4 sm:p-5 space-y-4">
                    {metaSemTabela && <p className="text-[12px] font-bold text-amber-700 bg-amber-50 rounded-xl px-3 py-2 dark:bg-amber-500/10 dark:text-amber-300">{tx('A meta por pessoa está valendo o padrão (3). Para ajustar por unidade, falta criar a tabela no banco (SQL da Gestão à Vista).')}</p>}
                    {erro && <p className="text-[12px] font-bold text-rose-700 bg-rose-50 rounded-xl px-3 py-2 dark:bg-rose-500/10 dark:text-rose-300">{tx('Não foi possível carregar todas as vendas do período. Os números podem estar incompletos.')}</p>}

                    {/* Indicadores */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        <Indicador rotulo="Cobrados" valor={resumo.cobrados} />
                        <Indicador rotulo="Meta atingida" valor={resumo.atingiram} tom="text-emerald-600 dark:text-emerald-400" />
                        <Indicador rotulo="Abaixo da meta" valor={resumo.abaixo} tom="text-rose-600 dark:text-rose-400" />
                        <Indicador rotulo="Sem vendas" valor={resumo.semVendas} tom="text-amber-600 dark:text-amber-400" />
                        <Indicador rotulo="Produtos vendidos" valor={resumo.total} />
                    </div>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 inline-flex items-start gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        {tx('A meta é mensal: mínimo de produtos por pessoa em cada mês, no mês escolhido acima. "Sem vendas" = nenhuma venda no período inteiro; "Abaixo" = vendeu menos que a meta do mês. Doses de Whey/Energy acima do limite da unidade não contam.')}
                    </p>

                    {carregando && <p className="text-[12px] font-bold text-slate-500 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{tx('Carregando as vendas do período...')}</p>}

                    {/* Unidades */}
                    {grupos.length === 0 ? (
                        <p className="text-center text-[13px] font-semibold text-slate-500 py-10 dark:text-slate-400">{tx('Ninguém encontrado com esses filtros.')}</p>
                    ) : grupos.map(g => {
                        const aberta = !visaoRede || abertas[g.unidade] || situacao !== 'todos' || busca;
                        return (
                            <section key={g.unidade} className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60">
                                    <button type="button" onClick={() => visaoRede && setAbertas(a => ({ ...a, [g.unidade]: !a[g.unidade] }))} className="flex items-center gap-2 text-left">
                                        {visaoRede && (aberta ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />)}
                                        <span className="text-[12px] font-black uppercase tracking-widest text-slate-800 dark:text-white">{g.unidade}</span>
                                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{g.resumo.cobrados} {tx('cobrados')} · <b className="text-rose-600 dark:text-rose-400">{g.resumo.abaixo} {tx('abaixo')}</b> · <b className="text-amber-600 dark:text-amber-400">{g.resumo.semVendas} {tx('sem vendas')}</b></span>
                                    </button>
                                    {visaoRede && podeAjustar && <EditorMeta unidade={g.unidade} meta={metaDe(g.unidade)} usuario={usuario} onSalvou={aoSalvarMeta} />}
                                </div>
                                {aberta && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-[12px]">
                                            <thead>
                                                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                                    <th className="px-3 py-2">{tx('Colaborador')}</th>
                                                    <th className="px-3 py-2">{tx('Situação')}</th>
                                                    <th className="px-3 py-2 text-center">{tx('No mês')}</th>
                                                    <th className="px-3 py-2 text-center">{tx('No período')}</th>
                                                    <th className="px-3 py-2">{tx('Última venda')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {g.linhas.map(l => (
                                                    <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                                        <td className="px-3 py-2">
                                                            <button type="button" onClick={() => setPessoa(l)} className="font-bold text-blue-700 hover:underline text-left dark:text-blue-300">{nomeCurto(l.nome)}</button>
                                                            <span className="block text-[10px] font-semibold text-slate-400 uppercase">{l.setor}{l.fim ? ` · ${tx('desligado')} ${dataBr(l.fim)}` : ''}{l.semDataInicio ? ` · ${tx('sem data de início')}` : ''}</span>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <span className="inline-flex flex-wrap gap-1">
                                                                <Etiqueta tipo={l.statusMes}>{tx(l.statusMes === 'atingida' ? 'Meta atingida' : l.statusMes === 'abaixo' ? 'Abaixo da meta' : 'Inativo')}</Etiqueta>
                                                                {l.cobrado && l.semVendas && l.statusMes !== 'inativo' && <Etiqueta tipo="semvendas">{tx('Sem vendas')}</Etiqueta>}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-center font-black tabular-nums">{l.metaMes?.obrigada ? `${l.metaMes.realizado}/${l.metaMes.meta}` : '—'}</td>
                                                        <td className="px-3 py-2 text-center font-black tabular-nums">{l.totalPeriodo}</td>
                                                        <td className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                            {l.ultima ? `${dataBr(l.ultima)} · ${l.diasSemVender === 0 ? tx('hoje') : `${tx('há')} ${l.diasSemVender} ${tx('dias')}`}` : tx('Nenhuma venda registrada no período selecionado.')}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </section>
                        );
                    })}
                </div>
            </div>
            {pessoa && <JanelaPessoa linha={pessoa} faixa={faixa} rotuloPeriodo={rotuloPeriodo} onFechar={() => setPessoa(null)} />}
        </div>
    );
};

export default GestaoAVistaProdutos;
