// Janela "Ver metas anteriores" (decisão do dono, 04/11/2026): meses anteriores da unidade, meta → realizado.
// Meta Start: Nutri, Produto, Personal → "liberada" quando bate todas (sem valor em R$).
// Meta Mensal: Ativos, Nutri, Plus, Personal → R$ 50 por indicador batido (Personal só conta se o mês tinha meta).
// Só leitura: metas_unidades + vendas da unidade (contagem igual à aba Metas; Produtos com o limite de doses).
import React, { useEffect, useMemo, useState } from 'react';
import { X, Loader2, History } from 'lucide-react';
import { supabase } from '../../supabaseClient.js';
import { tx, localeAtual } from '../../i18n/traduzir.js';
import { contarPlanosDoCard, getCategoriaItem, safeIsoDate } from './utils.js';
import { aplicarLimiteDoses, qtdValidaProduto } from './limiteDoses.js';

const VALOR_INDICADOR = 50;
const nomeMes = (ano, mes) => new Date(Number(ano), Number(mes) - 1, 1).toLocaleDateString(localeAtual(), { month: 'short', year: 'numeric' });

const Celula = ({ meta, realizado }) => {
    if (!meta || Number(meta) <= 0) return <td className="px-3 py-2.5 text-center text-slate-400">—</td>;
    const bateu = realizado >= Number(meta);
    return (
        <td className="px-3 py-2.5 text-center whitespace-nowrap tabular-nums">
            <span className="text-[12px] font-bold text-slate-500 dark:text-slate-400">{meta} → </span>
            <span className={`text-[13px] font-black ${bateu ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-300'}`}>{realizado} {bateu ? '✅' : '❌'}</span>
        </td>
    );
};

const HistoricoMetas = ({ unidade, tipo, planos = [], produtos = [], fechar }) => {
    const [metas, setMetas] = useState([]);
    const [vendas, setVendas] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const u = String(unidade || '').toUpperCase();

    useEffect(() => {
        let ativo = true;
        (async () => {
            setCarregando(true);
            const hoje = new Date();
            const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
            const { data: linhas, error } = await supabase.from('metas_unidades').select('*').eq('unidade', u);
            if (error) console.error('Metas anteriores: erro ao ler as metas', error);
            const anteriores = (linhas || [])
                .map(m => ({ ...m, chave: `${m.ano}-${String(m.mes).padStart(2, '0')}` }))
                .filter(m => /^\d{4}-\d{2}$/.test(m.chave) && m.chave < mesAtual)
                .sort((a, b) => b.chave.localeCompare(a.chave))
                .slice(0, 12);
            let todas = [];
            if (anteriores.length) {
                const inicio = `${anteriores[anteriores.length - 1].chave}-01`;
                const fim = `${mesAtual}-01`;
                for (let de = 0; ; de += 1000) {
                    const { data, error: e2 } = await supabase.from('vendas').select('id, unidade, data, created_at, produto, quantidade, vendedor, matricula').eq('unidade', u).gte('data', inicio).lt('data', fim).order('id', { ascending: true }).range(de, de + 999);
                    if (e2) { console.error('Metas anteriores: erro ao ler as vendas', e2); break; }
                    todas = todas.concat(data || []);
                    if (!data || data.length < 1000) break;
                }
            }
            if (!ativo) return;
            setMetas(anteriores);
            setVendas(todas);
            setCarregando(false);
        })();
        return () => { ativo = false; };
    }, [u]);

    const linhas = useMemo(() => {
        const doses = aplicarLimiteDoses(vendas, planos, produtos);
        return metas.map(m => {
            const doMes = vendas.filter(v => safeIsoDate(v.data || v.created_at).slice(0, 7) === m.chave);
            const contagem = contarPlanosDoCard(doMes, planos, produtos);
            let prod = 0;
            doMes.forEach(v => { if (getCategoriaItem(v.produto, planos, produtos) === 'PRODUTO') prod += qtdValidaProduto(v, doses); });
            const r = { nutri: contagem.nutri.total, plus: contagem.grupos.PLUS?.total || 0, personal: contagem.grupos['PERSONAL CLASS']?.total || 0, produto: prod, ativos: Number(m.ativos_atual) || 0 };
            const bate = (meta, real) => Number(meta) > 0 && real >= Number(meta);
            const start = [['meta_nutri', r.nutri], ['meta_produtos', r.produto], ['meta_personal', r.personal]].filter(([c]) => Number(m[c]) > 0);
            const mensal = [['meta_ativos_mensal', r.ativos], ['meta_nutri_mensal', r.nutri], ['meta_plus_mensal', r.plus], ['meta_pers_mensal', r.personal]].filter(([c]) => Number(m[c]) > 0);
            return {
                m, r,
                semMetas: tipo === 'start' ? start.length === 0 : mensal.length === 0,
                liberada: start.length > 0 && start.every(([c, real]) => bate(m[c], real)),
                batidas: mensal.filter(([c, real]) => bate(m[c], real)).length,
                indicadores: mensal.length,
            };
        });
    }, [metas, vendas, planos, produtos, tipo]);

    const th = 'px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center dark:text-slate-400';
    return (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={fechar}>
            <div className="bg-white rounded-2xl shadow-xl w-[min(860px,100%)] max-h-[85vh] flex flex-col dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <History className={`w-5 h-5 ${tipo === 'start' ? 'text-blue-600' : 'text-amber-500'}`} />
                        <div>
                            <h3 className="text-[13px] font-black uppercase tracking-widest text-slate-800 dark:text-white">{tipo === 'start' ? tx('Meta Start — meses anteriores') : tx('Meta Mensal — meses anteriores')}</h3>
                            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{u} · {tx('meta → realizado')}</p>
                        </div>
                    </div>
                    <button type="button" onClick={fechar} aria-label={tx('Fechar')} className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>
                </div>
                <div className="overflow-auto custom-scrollbar">
                    {carregando ? (
                        <p className="py-10 text-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin inline" /></p>
                    ) : linhas.length === 0 ? (
                        <p className="py-10 text-center text-[13px] font-semibold text-slate-500 dark:text-slate-400">{tx('Nenhuma meta cadastrada nos meses anteriores.')}</p>
                    ) : (
                        <table className="w-full min-w-[640px] border-collapse">
                            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                                <tr>
                                    <th className={`${th} !text-left`}>{tx('Mês')}</th>
                                    {tipo === 'start'
                                        ? <><th className={th}>{tx('Nutri')}</th><th className={th}>{tx('Produto')}</th><th className={th}>{tx('Personal Class')}</th></>
                                        : <><th className={th}>{tx('Ativos')}</th><th className={th}>{tx('Nutri')}</th><th className={th}>{tx('Plus')}</th><th className={th}>{tx('Personal Class')}</th></>}
                                    <th className={th}>{tx('Gratificação')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {linhas.map(({ m, r, semMetas, liberada, batidas, indicadores }) => (
                                    <tr key={m.chave} className="border-t border-slate-100 dark:border-slate-800">
                                        <td className="px-3 py-2.5 text-[12px] font-black text-slate-800 capitalize whitespace-nowrap dark:text-white">{nomeMes(m.ano, m.mes)}</td>
                                        {semMetas ? (
                                            <td colSpan={tipo === 'start' ? 4 : 5} className="px-3 py-2.5 text-center text-[12px] font-bold text-rose-600 dark:text-rose-400">{tx('Sem metas cadastradas')}</td>
                                        ) : (
                                            <>
                                                {tipo === 'start'
                                                    ? <><Celula meta={m.meta_nutri} realizado={r.nutri} /><Celula meta={m.meta_produtos} realizado={r.produto} /><Celula meta={m.meta_personal} realizado={r.personal} /></>
                                                    : <><Celula meta={m.meta_ativos_mensal} realizado={r.ativos} /><Celula meta={m.meta_nutri_mensal} realizado={r.nutri} /><Celula meta={m.meta_plus_mensal} realizado={r.plus} /><Celula meta={m.meta_pers_mensal} realizado={r.personal} /></>}
                                                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                                    {tipo === 'start'
                                                        ? <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider ${liberada ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30' : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30'}`}>{liberada ? tx('Liberada') : tx('Não liberada')}</span>
                                                        : <span className="text-[12px] font-black text-slate-800 dark:text-white">{tx('{b} de {n}', { b: batidas, n: indicadores })} · <span className="text-emerald-700 dark:text-emerald-400">R$ {batidas * VALOR_INDICADOR}</span></span>}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                <p className="px-5 py-3 border-t border-slate-100 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    {tipo === 'start' ? tx('Liberada = bateu todas as metas do mês. Personal Class só conta quando o mês tinha meta.') : tx('R$ 50 por indicador batido. Personal Class só conta quando o mês tinha meta. Ativos = número digitado naquele mês.')}
                </p>
            </div>
        </div>
    );
};

export default HistoricoMetas;
