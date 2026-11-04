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
const horaDe = (ts) => (ts ? new Date(ts).toLocaleTimeString(localeAtual(), { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '');
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

    // Último lançamento de cada unidade (últimos 60 dias, independente do período escolhido) e últimos ativos lançados
    const [ultimos, setUltimos] = useState({});
    const [ativosPorUnidade, setAtivosPorUnidade] = useState({});
    useEffect(() => {
        let ativo = true;
        const d = new Date(); d.setDate(d.getDate() - 60);
        const desde = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const consultar = (campos) => supabase.from('movimento_diario').select(campos).gte('data', desde).order('data', { ascending: false });
        (async () => {
            let { data, error } = await consultar('unidade, data, ativos, atualizado_por, atualizado_em');
            // Sem o campo "ativos" no banco (falta rodar 3_campo_ativos.sql): lê sem ele
            if (error && /ativos/i.test(error.message || '')) ({ data, error } = await consultar('unidade, data, atualizado_por, atualizado_em'));
            if (!ativo) return;
            if (error) { console.error('Monitoramento: erro ao ler', error); return; }
            const mapa = {};
            const atv = {}; // { UNIDADE: { valor, anterior } } = os dois últimos ativos lançados
            (data || []).forEach(l => {
                const u = String(l.unidade).toUpperCase();
                if (!mapa[u]) mapa[u] = l;
                if (l.ativos !== null && l.ativos !== undefined) {
                    if (!atv[u]) atv[u] = { valor: Number(l.ativos), anterior: null };
                    else if (atv[u].anterior === null) atv[u].anterior = Number(l.ativos);
                }
            });
            setUltimos(mapa);
            setAtivosPorUnidade(atv);
        })();
        return () => { ativo = false; };
    }, [derivados]);

    const linhas = useMemo(() => unidades.map(nome => {
        const u = String(nome).toUpperCase();
        const entradas = contarPlanosDoCard(vendasFiltradas.filter(v => String(v.unidade || '').toUpperCase() === u), planos, produtos).total;
        const mov = somarMovimentoNoPeriodo(derivados.filter(l => String(l.unidade).toUpperCase() === u), faixa);
        const ultimo = ultimos[u] || null;
        const atv = ativosPorUnidade[u] || null;
        return { nome: u, ativos: atv ? atv.valor : null, ativosVar: atv && atv.anterior !== null ? atv.valor - atv.anterior : null, entradas, saidas: mov.lancamentos || mov.cancelamentos ? mov.cancelamentos : null, faturamento: mov.lancamentos ? mov.faturamento : null, ultimo, situacao: situacaoDe(ultimo) };
    }).sort((a, b) => b.situacao.nivel - a.situacao.nivel || (a.ultimo?.data || '').localeCompare(b.ultimo?.data || '') || a.nome.localeCompare(b.nome)),
    [unidades, vendasFiltradas, planos, produtos, derivados, faixa, ultimos, ativosPorUnidade]);

    const total = linhas.reduce((t, l) => ({ ativos: t.ativos + (l.ativos || 0), entradas: t.entradas + l.entradas, saidas: t.saidas + (l.saidas || 0), faturamento: t.faturamento + (l.faturamento || 0) }), { ativos: 0, entradas: 0, saidas: 0, faturamento: 0 });
    const emDia = linhas.filter(l => l.situacao.nivel === 0).length;
    const atrasadas = linhas.filter(l => l.situacao.nivel >= 2).length;

    // Mensagem de COBRANÇA do dia (decisão do dono, 04/11/2026): "detalhado" ou "resumo". Sem números da rede e sem faturamento.
    const enviarWhatsApp = (tipo) => {
        const numero = (n) => Number(n).toLocaleString('pt-BR');
        const lancaram = linhas.filter(l => l.situacao.nivel === 0);
        const faltam = linhas.filter(l => l.situacao.nivel > 0);
        // Conferir: lançou sem ativos, ativos zerado ou pulo maior que 5%
        const conferir = (l) => l.ativos === null || l.ativos === 0 || (l.ativosVar !== null && l.ativos - l.ativosVar > 0 && Math.abs(l.ativosVar) / (l.ativos - l.ativosVar) > 0.05);
        // Positivos em cima (maior ganho primeiro), zerados no meio, negativos embaixo (maior perda por último), "conferir" no fim
        const grupo = (l) => (conferir(l) ? 3 : (l.ativosVar || 0) > 0 ? 0 : (l.ativosVar || 0) === 0 ? 1 : 2);
        const ordenados = [...lancaram].sort((a, b) => grupo(a) - grupo(b) || (b.ativosVar || 0) - (a.ativosVar || 0) || (b.ativos || 0) - (a.ativos || 0));
        const ultimoTexto = (l) => (!l.ultimo ? 'nunca' : l.ultimo.data === ontemIso() ? `ontem (${ddmm(l.ultimo.data)})` : `há ${diasDesde(l.ultimo.data)} dias (${ddmm(l.ultimo.data)})`);
        const linhaAtivos = (l) => {
            if (conferir(l)) return `⚠️ ${l.nome} — ${l.ativos === null ? 'ativos não informado' : `${numero(l.ativos)} ativos`} (conferir)`;
            const v = l.ativosVar || 0;
            const icone = v > 0 ? '🟢⬆️' : v < 0 ? '🔴⬇️' : '⚪➖';
            return `${icone} ${l.nome} — ${numero(l.ativos)} ativos (${v > 0 ? '+' : ''}${v})`;
        };
        const cobranca = faltam.length
            ? `⏰ *Por gentileza, façam agora o lançamento que ainda não foi feito:*\n${faltam.map(l => `👉 ${l.nome}`).join('\n')}`
            : '✅ Todas as unidades lançaram hoje. Obrigado!';

        let txt = `📊 *MOVIMENTAÇÃO – ${ddmm(hojeIso())}*\n\n`;
        if (tipo === 'resumo') {
            txt += `✅ *JÁ LANÇARAM HOJE (${lancaram.length})*\n`;
            txt += (lancaram.map(l => `${l.nome}${l.ultimo?.atualizado_em ? ` — ${horaDe(l.ultimo.atualizado_em).slice(0, 5)}` : ''}`).join('\n') || '—') + '\n\n';
            txt += `❌ *NÃO LANÇARAM (${faltam.length})*\n`;
            txt += (faltam.map(l => `${l.nome} — último lançamento: ${ultimoTexto(l)}`).join('\n') || '—') + '\n\n';
            txt += cobranca;
        } else {
            txt += `✅ *JÁ LANÇARAM HOJE (${lancaram.length})*\n${ordenados.map(linhaAtivos).join('\n') || '—'}\n\n`;
            txt += `❌ *NÃO LANÇARAM (${faltam.length})*\n${faltam.map(l => `${l.nome} — último lançamento: ${ultimoTexto(l)}`).join('\n') || '—'}\n\n`;
            // Entradas x saídas do período do topo (normalmente "Este mês"): ganhando aluno em verde, perdendo em vermelho
            const comSaldo = linhas.filter(l => l.saidas !== null).map(l => ({ nome: l.nome, saldo: l.entradas - l.saidas }));
            const mesAtual = faixa?.inicio === `${hojeIso().slice(0, 8)}01`;
            const titulo = mesAtual || !faixa?.inicio ? 'DO MÊS' : `DE ${ddmm(faixa.inicio)} A ${ddmm(faixa.fim > hojeIso() ? hojeIso() : faixa.fim)}`;
            const pos = comSaldo.filter(x => x.saldo >= 0).sort((a, b) => b.saldo - a.saldo);
            const neg = comSaldo.filter(x => x.saldo < 0).sort((a, b) => a.saldo - b.saldo);
            if (comSaldo.length) {
                txt += `📈 *ENTRADAS x SAÍDAS ${titulo}*\n`;
                if (pos.length) txt += `🟢 ${pos.map(x => `${x.nome} ${x.saldo > 0 ? '+' : ''}${x.saldo}`).join(' · ')}\n`;
                if (neg.length) txt += `🔴 ${neg.map(x => `${x.nome} ${x.saldo}`).join(' · ')}\n`;
                txt += '\n';
            }
            txt += cobranca;
        }
        abrirModalWhatsapp?.(txt, { titulo: tipo === 'resumo' ? 'Movimentação – resumo' : 'Movimentação – detalhado', icone: 'target', cor: 'blue' });
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
                <div className="flex items-center gap-2">
                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400"><Send className="w-3.5 h-3.5" />{tx('WhatsApp')}</span>
                    <button type="button" onClick={() => enviarWhatsApp('detalhado')} className="h-9 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest">{tx('Detalhado')}</button>
                    <button type="button" onClick={() => enviarWhatsApp('resumo')} className="h-9 px-3 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-black uppercase tracking-widest dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-300">{tx('Resumo')}</button>
                </div>
            </div>
            {semTabela ? (
                <p className="px-5 py-6 text-[12px] font-semibold text-amber-700 dark:text-amber-400">{tx('Falta criar a tabela no banco: rode o arquivo sql/2026-10-31-movimento-diario/1_tabela_movimento_diario.sql no SQL Editor do Supabase.')}</p>
            ) : (
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full min-w-[860px] text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-800/60">
                            <tr>
                                <th className={th}>{tx('Unidade')}</th>
                                <th className={th}>{tx('Situação')}</th>
                                <th className={`${th} text-right`}>{tx('Ativos')}</th>
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
                                        <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                                            <span className="text-[13px] font-black text-slate-800 dark:text-white">{l.ativos ?? <span className="text-slate-400">—</span>}</span>
                                            {l.ativosVar !== null && <span className={`ml-1.5 text-[11px] font-black ${l.ativosVar < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{l.ativosVar > 0 ? '+' : ''}{l.ativosVar}</span>}
                                        </td>
                                        <td className="px-3 py-3 text-[13px] font-black text-right tabular-nums text-emerald-700 dark:text-emerald-400">{l.entradas}</td>
                                        <td className="px-3 py-3 text-[13px] font-black text-right tabular-nums text-rose-700 dark:text-rose-300">{l.saidas ?? <span className="text-slate-400">—</span>}</td>
                                        <td className={`px-3 py-3 text-[13px] font-black text-right tabular-nums ${saldo === null ? 'text-slate-400' : saldo >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-300'}`}>{saldo === null ? '—' : `${saldo > 0 ? '+' : ''}${saldo}`}</td>
                                        <td className="px-3 py-3 text-[13px] font-black text-right tabular-nums text-slate-800 whitespace-nowrap dark:text-white">{l.faturamento === null ? <span className="text-slate-400">—</span> : dinheiro(l.faturamento)}</td>
                                        <td className="px-3 py-3">
                                            {l.ultimo ? (
                                                <>
                                                    <span className="block text-[12px] font-black text-slate-800 dark:text-white">{l.ultimo.data >= hojeIso() ? tx('hoje') : l.ultimo.data === ontemIso() ? tx('ontem') : tx('há {dias} dias', { dias: diasDesde(l.ultimo.data) })} · {ddmm(l.ultimo.data)}{l.ultimo.atualizado_em && <span className="text-slate-500 dark:text-slate-400"> · {horaDe(l.ultimo.atualizado_em)}</span>}</span>
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
                                <td className="px-3 py-3 text-[13px] font-black text-right tabular-nums text-slate-800 dark:text-white">{total.ativos || '—'}</td>
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
