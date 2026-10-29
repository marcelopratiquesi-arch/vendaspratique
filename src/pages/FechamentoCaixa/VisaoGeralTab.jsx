import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient.js';
import { formatMoney } from './utils.js';
import { isoLocal } from '../HistoricoVendas/FiltrosCompactos.jsx';
import { BarChart2, Building2, MapPin, TrendingUp, TrendingDown, Minus, AlertCircle, Loader2, Info, ArrowUpDown, ArrowDown, ArrowUp, Clock, HelpCircle } from 'lucide-react';
import { tx, localeAtual } from '../../i18n/traduzir.js';

// ==========================================
// VISÃO GERAL DO FECHAMENTO: comissões CONFERIDAS dos 6 meses que terminam no mês de referência.
// O mês de referência é o último mês do período escolhido no filtro do topo (sem fim = mês de hoje).
// O App só carrega as vendas lançadas nos últimos 90 dias; as mais antigas vêm do banco aqui (só leitura).
// Tudo é COMISSÃO (regra 5), nunca faturamento.
// ==========================================

const TAMANHO_PAGINA = 1000;

const chaveMes = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const nomeMes = (d, longo = false) => {
    const txt = d.toLocaleDateString(localeAtual(), longo ? { month: 'long', year: 'numeric' } : { month: 'short' }).replace('.', '');
    return txt.charAt(0).toUpperCase() + txt.slice(1);
};
const variacao = (atual, base) => (base > 0 ? (atual - base) / base : null);
const textoPct = (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;

// Etiqueta de variação: ▲ verde, ▼ vermelho, — sem base para comparar
const Variacao = ({ valor, pequeno = false }) => {
    if (valor === null) return <span className="text-[11px] font-bold text-slate-400">—</span>;
    const sobe = valor > 0.005, desce = valor < -0.005;
    const Icone = sobe ? TrendingUp : desce ? TrendingDown : Minus;
    const cor = sobe ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/30'
        : desce ? 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-500/10 dark:border-rose-500/30'
            : 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-800/60 dark:border-slate-800';
    return (
        <span className={`inline-flex items-center gap-1 border rounded-lg font-black ${pequeno ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'} ${cor}`}>
            <Icone className={pequeno ? 'w-3 h-3' : 'w-3.5 h-3.5'} />{textoPct(valor)}
        </span>
    );
};

// "?" ao lado do título: explica o número ao passar o mouse ou tocar (no celular)
const Dica = ({ texto, alinhar = 'right' }) => (
    <span className="group/dica relative inline-flex align-middle">
        <button type="button" aria-label={texto} onClick={(e) => e.stopPropagation()} className="text-slate-400 hover:text-blue-600 focus:text-blue-600 outline-none dark:hover:text-blue-400 dark:focus:text-blue-400">
            <HelpCircle className="w-3.5 h-3.5" />
        </button>
        <span role="tooltip" className={`pointer-events-none absolute top-full mt-2 z-40 w-[min(240px,70vw)] hidden group-hover/dica:block group-focus-within/dica:block bg-slate-800 text-white text-[11px] font-semibold normal-case tracking-normal text-left leading-snug px-3 py-2 rounded-lg shadow-lg dark:bg-slate-700 ${alinhar === 'left' ? 'left-0' : 'right-0'}`}>
            {texto}
        </span>
    </span>
);

// Linha pequena dos 6 meses (mesma escala para todas as unidades)
const MiniBarras = ({ meses, maximo }) => (
    <div className="flex items-end gap-1 h-9">
        {meses.map((m) => {
            const altura = maximo > 0 ? (m.total / maximo) * 100 : 0;
            return (
                <div key={m.chave} className="group/barra relative flex-1 min-w-[10px] h-full flex items-end">
                    {m.total > 0
                        ? <div className={`w-full rounded-t-[3px] ${m.emAndamento ? 'bg-blue-300 dark:bg-blue-500/50' : 'bg-blue-600 dark:bg-blue-500'}`} style={{ height: `${Math.max(altura, 4)}%` }} />
                        : <div className="w-full h-[2px] bg-slate-200 dark:bg-slate-700" />}
                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/barra:block z-30 whitespace-nowrap bg-slate-800 text-white text-[10px] font-black px-2 py-1 rounded-md shadow-lg dark:bg-slate-700">
                        {m.rotulo}: {formatMoney(m.total)}
                    </div>
                </div>
            );
        })}
    </div>
);

// Um número da faixa de resumo
const Item = ({ rotulo, valor, cor = 'text-slate-800 dark:text-white', children }) => (
    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">{rotulo}</span>
        <span className={`text-base font-black tabular-nums ${cor}`}>{valor}</span>
        {children}
    </div>
);

const VisaoGeralTab = ({ vendas = [], unidadesPermitidas = [], filtroUnidade = 'TODOS', mesReferencia, temVisaoGlobal, unidadeUsuario }) => {
    const ref = mesReferencia || new Date();
    const hoje = new Date();
    const emAndamento = chaveMes(ref) === chaveMes(hoje);

    // Os 6 meses: do mais antigo ao de referência
    const meses = useMemo(() => Array.from({ length: 6 }, (_, i) => {
        const d = new Date(ref.getFullYear(), ref.getMonth() - 5 + i, 1);
        return { chave: chaveMes(d), rotulo: nomeMes(d), rotuloLongo: nomeMes(d, true), data: d };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- muda só quando o mês de referência muda
    }), [chaveMes(ref), localeAtual()]);

    const inicioIso = isoLocal(meses[0].data);
    const fimIso = isoLocal(new Date(ref.getFullYear(), ref.getMonth() + 1, 1));

    // Vendas antigas (lançadas há mais de 90 dias) que o App não carrega
    const [antigas, setAntigas] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState(false);
    useEffect(() => {
        let ativo = true;
        (async () => {
            setCarregando(true); setErro(false);
            const corte = new Date(); corte.setDate(corte.getDate() - 90);
            let todas = [];
            for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
                let q = supabase.from('vendas').select('id, unidade, data, valor, conferiu')
                    .gte('data', inicioIso).lt('data', fimIso).lt('created_at', corte.toISOString())
                    .order('id', { ascending: true }).range(inicio, inicio + TAMANHO_PAGINA - 1);
                if (!temVisaoGlobal && unidadeUsuario) q = q.eq('unidade', unidadeUsuario);
                const { data, error } = await q;
                if (error) { console.error('Visão Geral: erro ao buscar vendas antigas', error); if (ativo) setErro(true); break; }
                todas = todas.concat(data || []);
                if (!data || data.length < TAMANHO_PAGINA) break;
            }
            if (ativo) { setAntigas(todas); setCarregando(false); }
        })();
        return () => { ativo = false; };
    }, [inicioIso, fimIso, temVisaoGlobal, unidadeUsuario]);

    const dados = useMemo(() => {
        // Junta as duas fontes sem repetir (a da tela vale mais, por estar atualizada em tempo real)
        const porId = new Map();
        antigas.forEach(v => porId.set(v.id, v));
        vendas.forEach(v => { if (v.data && v.data >= inicioIso && v.data < fimIso) porId.set(v.id, v); });

        const permitidas = new Set(unidadesPermitidas);
        const indiceMes = Object.fromEntries(meses.map((m, i) => [m.chave, i]));
        const ultimo = meses.length - 1;
        // Para o mês em andamento, a comparação justa é com o mês passado ATÉ O MESMO DIA
        const diaCorte = hoje.getDate();

        const porUnidade = {};
        const novaLinha = (unidade) => ({ unidade, meses: meses.map(m => ({ ...m, total: 0, qtd: 0, emAndamento: emAndamento && m.chave === meses[ultimo].chave })), aConferir: 0, qtdAConferir: 0, anteriorMesmoDia: 0 });

        porId.forEach(v => {
            const unidade = v.unidade || 'MATRIZ';
            if (temVisaoGlobal ? !permitidas.has(unidade) : unidade !== unidadeUsuario) return;
            if (filtroUnidade !== 'TODOS' && unidade !== filtroUnidade) return;
            const i = indiceMes[String(v.data).slice(0, 7)];
            if (i === undefined) return;
            const valor = Number(v.valor) || 0;
            const linha = porUnidade[unidade] || (porUnidade[unidade] = novaLinha(unidade));
            if (v.conferiu) {
                linha.meses[i].total += valor;
                linha.meses[i].qtd += 1;
                if (i === ultimo - 1 && Number(String(v.data).slice(8, 10)) <= diaCorte) linha.anteriorMesmoDia += valor;
            } else if (i === ultimo) {
                linha.aConferir += valor;
                linha.qtdAConferir += 1;
            }
        });

        const linhas = Object.values(porUnidade).map(l => {
            const atual = l.meses[ultimo].total;
            const anterior = l.meses[ultimo - 1].total;
            const base = emAndamento ? l.anteriorMesmoDia : anterior;
            return { ...l, atual, anterior, base, variacao: variacao(atual, base) };
        });

        const rede = meses.map((m, i) => ({
            ...m,
            total: linhas.reduce((s, l) => s + l.meses[i].total, 0),
            qtd: linhas.reduce((s, l) => s + l.meses[i].qtd, 0),
            emAndamento: emAndamento && i === ultimo
        }));
        const totalAtual = rede[ultimo].total;
        const baseRede = linhas.reduce((s, l) => s + l.base, 0);
        const anteriores = rede.slice(0, ultimo);
        const mediaAnteriores = anteriores.reduce((s, m) => s + m.total, 0) / anteriores.length;
        const maximoMini = Math.max(0, ...linhas.flatMap(l => l.meses.map(m => m.total)));

        return {
            linhas, rede, totalAtual, baseRede, mediaAnteriores, maximoMini,
            variacaoRede: variacao(totalAtual, baseRede),
            aConferir: linhas.reduce((s, l) => s + l.aConferir, 0),
            qtdAConferir: linhas.reduce((s, l) => s + l.qtdAConferir, 0),
            anteriorRede: rede[ultimo - 1].total
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- "hoje" só serve para o dia de corte
    }, [antigas, vendas, unidadesPermitidas, filtroUnidade, meses, inicioIso, fimIso, emAndamento, temVisaoGlobal, unidadeUsuario]);

    // Ordenação da tabela (clicando no título da coluna)
    const [ordem, setOrdem] = useState({ campo: 'atual', desc: true });
    const linhasOrdenadas = useMemo(() => {
        const valorDe = (l) => (ordem.campo === 'unidade' ? l.unidade : ordem.campo === 'variacao' ? (l.variacao ?? -Infinity) : l[ordem.campo]);
        return [...dados.linhas].sort((a, b) => {
            const x = valorDe(a), y = valorDe(b);
            const c = typeof x === 'string' ? x.localeCompare(y) : x - y;
            return ordem.desc ? -c : c;
        });
    }, [dados.linhas, ordem]);
    const ordenar = (campo) => setOrdem(o => ({ campo, desc: o.campo === campo ? !o.desc : campo !== 'unidade' }));

    const mesRef = meses[meses.length - 1];
    const mesAnt = meses[meses.length - 2];
    const textoComparacao = emAndamento
        ? tx('vs {mes} até o dia {dia}', { mes: mesAnt.rotulo.toLowerCase(), dia: hoje.getDate() })
        : tx('vs {mes}', { mes: mesAnt.rotulo.toLowerCase() });
    const pctRede = (v) => (dados.totalAtual > 0 ? Math.round((v / dados.totalAtual) * 100) : 0);

    const Titulo = ({ campo, children, alinhar = 'right', dica }) => {
        const ativo = ordem.campo === campo;
        const Seta = !ativo ? ArrowUpDown : ordem.desc ? ArrowDown : ArrowUp;
        return (
            <th className={`px-4 py-3 border-b border-slate-200 dark:border-slate-800 text-${alinhar}`}>
                <span className="inline-flex items-center gap-1">
                    <button type="button" onClick={() => ordenar(campo)} className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest transition-colors ${ativo ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}>
                        {children}<Seta className="w-3 h-3" />
                    </button>
                    {dica && <Dica texto={dica} alinhar={alinhar === 'left' ? 'left' : 'right'} />}
                </span>
            </th>
        );
    };

    return (
        <div className="space-y-6 animate-[fadeIn_0.4s_ease-out] max-w-[1400px] mx-auto pb-10">

            {/* RESUMO EM UMA FAIXA */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-3 dark:bg-slate-900 dark:border-slate-800">
                <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{tx('Comissões conferidas')} · {mesRef.rotuloLongo}</span>
                    <span className="text-lg font-black text-slate-800 tabular-nums dark:text-white">{formatMoney(dados.totalAtual)}</span>
                    <Variacao valor={dados.variacaoRede} pequeno />
                    <span className="text-[11px] font-semibold text-slate-400">{textoComparacao}</span>
                    {emAndamento && <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/30"><Clock className="w-3 h-3" />{tx('Mês em andamento')}</span>}
                </div>
                <div className="h-5 w-px bg-slate-200 hidden lg:block dark:bg-slate-700" />
                <Item rotulo={mesAnt.rotuloLongo} valor={formatMoney(dados.anteriorRede)} cor="text-slate-600 dark:text-slate-300" />
                <Item rotulo={tx('Média 5 meses')} valor={formatMoney(dados.mediaAnteriores)} cor="text-slate-600 dark:text-slate-300" />
                <Item rotulo={tx('A conferir')} valor={formatMoney(dados.aConferir)} cor={dados.aConferir > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'} />
                <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                    {carregando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span className="cursor-help inline-flex" title={tx('Soma só os lançamentos conferidos. Mês de referência: o último mês do período escolhido no filtro.')}><Info className="w-3.5 h-3.5" /></span>
                </span>
            </div>

            {erro && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-xs font-bold dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {tx('Não foi possível buscar as vendas com mais de 90 dias. Os meses mais antigos podem aparecer menores do que foram.')}
                </div>
            )}

            {/* TABELA POR UNIDADE */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-800">
                <div className="px-6 py-5 border-b border-slate-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest dark:text-white">{tx('Comparativo por unidade')}</h3>
                            <p className="text-[11px] font-bold text-slate-400 mt-0.5">{tx('Clique no título de uma coluna para ordenar. As mini barras usam a mesma escala para todas as unidades.')}</p>
                        </div>
                    </div>
                    <div className="bg-slate-50 text-slate-500 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200 flex items-center gap-2 self-start dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-800">
                        <BarChart2 className="w-3.5 h-3.5" />
                        {tx('{qtd} unidades', { qtd: dados.linhas.length })}
                    </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar pb-1">
                    <table className="w-full text-left border-collapse min-w-[860px]">
                        <thead className="bg-slate-50 dark:bg-slate-800/60">
                            <tr>
                                <Titulo campo="unidade" alinhar="left" dica={tx('Unidade da rede. Só entram as unidades que você pode ver.')}>{tx('Unidade')}</Titulo>
                                <Titulo campo="atual" dica={tx('Comissão conferida da unidade em {mes}.', { mes: mesRef.rotuloLongo })}>{mesRef.rotulo}</Titulo>
                                <Titulo campo="anterior" dica={tx('Comissão conferida da unidade no mês anterior inteiro ({mes}).', { mes: mesAnt.rotuloLongo })}>{mesAnt.rotulo}</Titulo>
                                <Titulo campo="variacao" dica={emAndamento ? tx('Quanto a comissão conferida subiu (▲) ou caiu (▼) em relação ao mês passado até o mesmo dia de hoje.') : tx('Quanto a comissão conferida subiu (▲) ou caiu (▼) em relação ao mês anterior.')}>{tx('Variação')}</Titulo>
                                <Titulo campo="atual" dica={tx('Pedaço da comissão da rede que veio desta unidade. Ex.: rede R$ 10.000 e unidade R$ 2.500 = 25%.')}>{tx('% da rede')}</Titulo>
                                <th className="px-4 py-3 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 w-48 dark:border-slate-800 dark:text-slate-400"><span className="inline-flex items-center gap-1">{tx('6 meses')}<Dica texto={tx('Comissão conferida de cada um dos últimos 6 meses. Passe o mouse numa barrinha para ver o valor. Barra clara = mês em andamento.')} /></span></th>
                                <Titulo campo="aConferir" dica={tx('Comissão de lançamentos deste mês que ainda não foram conferidos. Não entra no total até alguém conferir.')}>{tx('A conferir')}</Titulo>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {linhasOrdenadas.length > 0 ? linhasOrdenadas.map(l => (
                                <tr key={l.unidade} className="hover:bg-slate-50 transition-colors dark:hover:bg-slate-800/40">
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-800"><MapPin className="w-4 h-4" /></div>
                                            <span className="text-sm font-black text-slate-800 uppercase tracking-tight dark:text-white">{l.unidade}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right text-sm font-black text-slate-800 tabular-nums dark:text-white">{formatMoney(l.atual)}</td>
                                    <td className="px-4 py-4 text-right text-sm font-bold text-slate-500 tabular-nums dark:text-slate-400">{formatMoney(l.anterior)}</td>
                                    <td className="px-4 py-4 text-right"><Variacao valor={l.variacao} pequeno /></td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden dark:bg-slate-800"><div className="h-full bg-blue-600 rounded-full dark:bg-blue-500" style={{ width: `${pctRede(l.atual)}%` }} /></div>
                                            <span className="text-xs font-black text-slate-600 tabular-nums w-9 text-right dark:text-slate-300">{pctRede(l.atual)}%</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4"><MiniBarras meses={l.meses} maximo={dados.maximoMini} /></td>
                                    <td className="px-4 py-4 text-right">
                                        {l.aConferir > 0
                                            ? <span className="text-xs font-black text-amber-600 tabular-nums dark:text-amber-400" title={tx('{qtd} lançamentos', { qtd: l.qtdAConferir })}>{formatMoney(l.aConferir)}</span>
                                            : <span className="text-[11px] font-bold text-slate-400">—</span>}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="7" className="py-20">
                                        <div className="flex flex-col items-center justify-center text-center">
                                            <div className="w-14 h-14 bg-slate-50 border border-slate-200 border-dashed rounded-full flex items-center justify-center mb-4 dark:bg-slate-800/60 dark:border-slate-800">
                                                {carregando ? <Loader2 className="w-6 h-6 text-slate-300 animate-spin" /> : <AlertCircle className="w-6 h-6 text-slate-300" />}
                                            </div>
                                            <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest dark:text-slate-200">{tx('Sem Dados Financeiros')}</h4>
                                            <p className="text-xs font-bold text-slate-400 mt-1 max-w-sm">{tx('Não há comissões processadas ou auditadas para as unidades no período selecionado.')}</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {linhasOrdenadas.length > 1 && (
                            <tfoot className="bg-slate-50 border-t-2 border-slate-200 dark:bg-slate-800/60 dark:border-slate-700">
                                <tr>
                                    <td className="px-4 py-4 text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">{tx('Total')}</td>
                                    <td className="px-4 py-4 text-right text-sm font-black text-slate-800 tabular-nums dark:text-white">{formatMoney(dados.totalAtual)}</td>
                                    <td className="px-4 py-4 text-right text-sm font-bold text-slate-500 tabular-nums dark:text-slate-400">{formatMoney(dados.anteriorRede)}</td>
                                    <td className="px-4 py-4 text-right"><Variacao valor={dados.variacaoRede} pequeno /></td>
                                    <td className="px-4 py-4 text-right text-xs font-black text-slate-600 dark:text-slate-300">100%</td>
                                    <td className="px-4 py-4"><MiniBarras meses={dados.rede} maximo={Math.max(0, ...dados.rede.map(m => m.total))} /></td>
                                    <td className="px-4 py-4 text-right text-xs font-black text-amber-600 tabular-nums dark:text-amber-400">{dados.aConferir > 0 ? formatMoney(dados.aConferir) : '—'}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
                {emAndamento && (
                    <p className="px-6 py-3 border-t border-slate-100 text-[11px] font-bold text-slate-400 dark:border-slate-800">
                        {tx('Variação do mês em andamento: comparada com o mês passado até o mesmo dia, para não parecer queda.')}
                    </p>
                )}
            </div>
        </div>
    );
};

export default VisaoGeralTab;
