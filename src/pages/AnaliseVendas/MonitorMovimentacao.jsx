// Monitoramento da Movimentação (decisão do dono, 31/10/2026): Admin/Mentor na visão de todas as unidades,
// aba Metas. Uma linha por unidade, no modelo do "Desempenho de conferência por unidade" do Fechamento:
// situação do lançamento, Entradas (automático), Saídas (cancelamentos), Saldo, Faturamento e último lançamento.
// Só leitura (tabela movimento_diario). Regras em movimentoDiario.js.
import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Send, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient.js';
import { tx, localeAtual } from '../../i18n/traduzir.js';
import { contarPlanosDoCard } from './utils.js';
import { useMovimentoDiario, somarMovimentoNoPeriodo, hojeIso, ontemIso } from './movimentoDiario.js';

const dinheiro = (v) => new Intl.NumberFormat(localeAtual(), { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const diasDesde = (iso) => Math.round((new Date(`${hojeIso()}T12:00:00`) - new Date(`${iso}T12:00:00`)) / 86400000);

// Situação pelo último dia lançado: hoje = em dia; ontem = atenção; 2+ dias ou nunca = atrasada
const situacaoDe = (ultimo) => {
    if (!ultimo) return { nivel: 3, rotulo: tx('Sem lançamento'), cor: 'rose' };
    if (ultimo.data >= hojeIso()) return { nivel: 0, rotulo: tx('Em dia'), cor: 'emerald' };
    if (ultimo.data === ontemIso()) return { nivel: 1, rotulo: tx('Ontem'), cor: 'amber' };
    return { nivel: 2, rotulo: tx('Atrasada ({dias} d)', { dias: diasDesde(ultimo.data) }), cor: 'rose' };
};
const CORES = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
    amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
    rose: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
};

const MonitorMovimentacao = ({ unidades = [], faixa, vendasFiltradas = [], planos = [], produtos = [], abrirModalWhatsapp }) => {
    const { derivados, carregando, semTabela } = useMovimentoDiario({ unidade: 'TODOS', faixa });

    // Último lançamento de cada unidade (últimos 60 dias, independente do período escolhido)
    const [ultimos, setUltimos] = useState({});
    useEffect(() => {
        let ativo = true;
        const d = new Date(); d.setDate(d.getDate() - 60);
        const desde = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        supabase.from('movimento_diario').select('unidade, data, atualizado_por, atualizado_em').gte('data', desde).order('data', { ascending: false })
            .then(({ data, error }) => {
                if (!ativo) return;
                if (error) { console.error('Monitoramento: erro ao ler', error); return; }
                const mapa = {};
                (data || []).forEach(l => { const u = String(l.unidade).toUpperCase(); if (!mapa[u]) mapa[u] = l; });
                setUltimos(mapa);
            });
        return () => { ativo = false; };
    }, [derivados]);

    const linhas = useMemo(() => unidades.map(nome => {
        const u = String(nome).toUpperCase();
        const entradas = contarPlanosDoCard(vendasFiltradas.filter(v => String(v.unidade || '').toUpperCase() === u), planos, produtos).total;
        const mov = somarMovimentoNoPeriodo(derivados.filter(l => String(l.unidade).toUpperCase() === u), faixa);
        const ultimo = ultimos[u] || null;
        return { nome: u, entradas, saidas: mov.lancamentos || mov.cancelamentos ? mov.cancelamentos : null, faturamento: mov.lancamentos ? mov.faturamento : null, ultimo, situacao: situacaoDe(ultimo) };
    }).sort((a, b) => b.situacao.nivel - a.situacao.nivel || (a.ultimo?.data || '').localeCompare(b.ultimo?.data || '') || a.nome.localeCompare(b.nome)),
    [unidades, vendasFiltradas, planos, produtos, derivados, faixa, ultimos]);

    const total = linhas.reduce((t, l) => ({ entradas: t.entradas + l.entradas, saidas: t.saidas + (l.saidas || 0), faturamento: t.faturamento + (l.faturamento || 0) }), { entradas: 0, saidas: 0, faturamento: 0 });
    const emDia = linhas.filter(l => l.situacao.nivel === 0).length;
    const atrasadas = linhas.filter(l => l.situacao.nivel >= 2).length;

    const enviarWhatsApp = () => {
        const nomes = (n) => linhas.filter(l => l.situacao.nivel === n).map(l => l.nome);
        const atras = linhas.filter(l => l.situacao.nivel >= 2).map(l => (l.ultimo ? `${l.nome} (${diasDesde(l.ultimo.data)} dias)` : `${l.nome} (nunca lançou)`));
        let txt = `📊 *Movimentação – ${ddmm(hojeIso())}*\n\n`;
        txt += `✅ *Lançaram hoje:* ${nomes(0).join(', ') || '—'}\n`;
        txt += `⚠️ *Lançaram ontem:* ${nomes(1).join(', ') || '—'}\n`;
        txt += `❌ *Atrasadas:* ${atras.join(', ') || '—'}\n`;
        abrirModalWhatsapp?.(txt, { titulo: 'Movimentação das unidades', icone: 'target', cor: 'blue' });
    };

    const th = 'px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400';
    return (
        <section className="bg-white rounded-[24px] border border-slate-200 shadow-sm mb-8 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <div>
                        <h3 className="text-[13px] font-black uppercase tracking-widest text-slate-800 dark:text-white">{tx('Monitoramento da Movimentação')}</h3>
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            {tx('{ok} de {total} unidades lançaram hoje · {atrasadas} atrasadas', { ok: emDia, total: linhas.length, atrasadas })}
                            {carregando && <Loader2 className="inline w-3 h-3 ml-1 animate-spin" />}
                        </p>
                    </div>
                </div>
                <button type="button" onClick={enviarWhatsApp} className="h-9 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                    <Send className="w-4 h-4" />{tx('Enviar no WhatsApp')}
                </button>
            </div>
            {semTabela ? (
                <p className="px-5 py-6 text-[12px] font-semibold text-amber-700 dark:text-amber-400">{tx('Falta criar a tabela no banco: rode o arquivo sql/2026-10-31-movimento-diario/1_tabela_movimento_diario.sql no SQL Editor do Supabase.')}</p>
            ) : (
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full min-w-[760px] text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-800/60">
                            <tr>
                                <th className={th}>{tx('Unidade')}</th>
                                <th className={th}>{tx('Situação')}</th>
                                <th className={`${th} text-right`}>{tx('Entradas')}</th>
                                <th className={`${th} text-right`}>{tx('Saídas')}</th>
                                <th className={`${th} text-right`}>{tx('Saldo')}</th>
                                <th className={`${th} text-right`}>{tx('Faturamento')}</th>
                                <th className={th}>{tx('Último lançamento')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {linhas.map(l => {
                                const saldo = l.saidas === null ? null : l.entradas - l.saidas;
                                return (
                                    <tr key={l.nome} className="border-t border-slate-100 dark:border-slate-800">
                                        <td className="px-3 py-3 text-[12px] font-black text-slate-800 dark:text-white">{l.nome}</td>
                                        <td className="px-3 py-3"><span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider ${CORES[l.situacao.cor]}`}>{l.situacao.rotulo}</span></td>
                                        <td className="px-3 py-3 text-[13px] font-black text-right tabular-nums text-emerald-700 dark:text-emerald-400">{l.entradas}</td>
                                        <td className="px-3 py-3 text-[13px] font-black text-right tabular-nums text-rose-700 dark:text-rose-300">{l.saidas ?? <span className="text-slate-400">—</span>}</td>
                                        <td className={`px-3 py-3 text-[13px] font-black text-right tabular-nums ${saldo === null ? 'text-slate-400' : saldo >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-300'}`}>{saldo === null ? '—' : `${saldo > 0 ? '+' : ''}${saldo}`}</td>
                                        <td className="px-3 py-3 text-[13px] font-black text-right tabular-nums text-slate-800 whitespace-nowrap dark:text-white">{l.faturamento === null ? <span className="text-slate-400">—</span> : dinheiro(l.faturamento)}</td>
                                        <td className="px-3 py-3">
                                            {l.ultimo ? (
                                                <>
                                                    <span className="block text-[12px] font-black text-slate-800 dark:text-white">{l.ultimo.data >= hojeIso() ? tx('hoje') : l.ultimo.data === ontemIso() ? tx('ontem') : tx('há {dias} dias', { dias: diasDesde(l.ultimo.data) })} · {ddmm(l.ultimo.data)}</span>
                                                    {l.ultimo.atualizado_por && <span className="block text-[10px] font-bold text-slate-500 uppercase dark:text-slate-400">{l.ultimo.atualizado_por}</span>}
                                                </>
                                            ) : <span className="text-[12px] font-bold text-rose-600 dark:text-rose-400">{tx('nunca lançou')}</span>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
                                <td className="px-3 py-3 text-[11px] font-black uppercase tracking-widest text-slate-800 dark:text-white" colSpan={2}>{tx('Total')}</td>
                                <td className="px-3 py-3 text-[13px] font-black text-right tabular-nums text-emerald-700 dark:text-emerald-400">{total.entradas}</td>
                                <td className="px-3 py-3 text-[13px] font-black text-right tabular-nums text-rose-700 dark:text-rose-300">{total.saidas}</td>
                                <td className="px-3 py-3 text-[13px] font-black text-right tabular-nums text-slate-800 dark:text-white">{total.entradas - total.saidas > 0 ? '+' : ''}{total.entradas - total.saidas}</td>
                                <td className="px-3 py-3 text-[13px] font-black text-right tabular-nums text-slate-800 whitespace-nowrap dark:text-white">{dinheiro(total.faturamento)}</td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </section>
    );
};

export default MonitorMovimentacao;
