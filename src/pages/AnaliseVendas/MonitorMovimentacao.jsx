// Monitoramento da Movimentação (decisão do dono, 31/10/2026): Admin/Mentor na visão de todas as unidades,
// aba Metas. Uma linha por unidade, no modelo do "Desempenho de conferência por unidade" do Fechamento:
// situação do lançamento, Entradas (automático), Saídas (cancelamentos), Saldo, Faturamento e último lançamento.
// Só leitura (tabela movimento_diario). Regras em movimentoDiario.js.
import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Send, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient.js';
import { tx, localeAtual } from '../../i18n/traduzir.js';
import { contarPlanosDoCard } from './utils.js';
import { useMovimentoDiario, somarMovimentoNoPeriodo, hojeIso, ontemIso, ehDomingo, diaDeLancamentoAtual, diaDeLancamentoAnterior, diasDeLancamentoEntre } from './movimentoDiario.js';
import BotaoCentralUnidade from '../../components/BotaoCentralUnidade.jsx';

const dinheiro = (v) => new Intl.NumberFormat(localeAtual(), { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const horaDe = (ts) => (ts ? new Date(ts).toLocaleTimeString(localeAtual(), { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '');
const diasDesde = (iso) => Math.round((new Date(`${hojeIso()}T12:00:00`) - new Date(`${iso}T12:00:00`)) / 86400000);

// "A, B e C"
const juntar = (lista) => (lista.length > 1 ? `${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]}` : lista[0] || '');
// Campos que faltam no lançamento de HOJE (decisão do dono, 05/11/2026): completo = Ativos + Cancelamentos + Faturamento.
// Zero digitado vale como preenchido; vazio (null) é falta. Entradas é automático e não conta.
const camposFaltando = (linha, temCampoAtivos) => {
    const falta = [];
    if (temCampoAtivos && (linha.ativos === null || linha.ativos === undefined)) falta.push('Ativos');
    if (linha.cancelamentos === null || linha.cancelamentos === undefined) falta.push('Cancelamentos');
    if (linha.faturamento === null || linha.faturamento === undefined) falta.push('Faturamento');
    return falta;
};
// Situação: hoje completo = em dia; hoje com falta = incompleto; dia de lançamento anterior = atenção; mais ou nunca = atrasada.
// Domingo não tem lançamento (decisão do dono, 09/11/2026): no domingo vale o sábado; na segunda, quem lançou no sábado
// está no dia anterior (não 'atrasada'); os dias de atraso não contam o domingo.
const situacaoDe = (ultimo, temCampoAtivos) => {
    if (!ultimo) return { nivel: 4, rotulo: tx('Sem lançamento'), cor: 'rose', falta: [] };
    const ref = diaDeLancamentoAtual(hojeIso());
    if (ultimo.data >= ref) {
        const falta = camposFaltando(ultimo, temCampoAtivos);
        return falta.length ? { nivel: 1, rotulo: tx('Incompleto'), cor: 'amber', falta } : { nivel: 0, rotulo: tx('Em dia'), cor: 'emerald', falta: [] };
    }
    if (ultimo.data === diaDeLancamentoAnterior(ref)) return { nivel: 2, rotulo: ultimo.data === ontemIso() ? tx('Ontem') : tx('Sábado'), cor: 'amber', falta: [] };
    return { nivel: 3, rotulo: tx('Atrasada ({dias} d)', { dias: diasDeLancamentoEntre(ultimo.data, ref) }), cor: 'rose', falta: [] };
};
const CORES = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
    amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
    rose: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
};

const MonitorMovimentacao = ({ unidades = [], faixa, vendasFiltradas = [], planos = [], produtos = [], abrirModalWhatsapp, usuario = null }) => {
    const { derivados, carregando, semTabela } = useMovimentoDiario({ unidade: 'TODOS', faixa });

    // Último lançamento de cada unidade (últimos 60 dias, independente do período escolhido) e últimos ativos lançados
    const [ultimos, setUltimos] = useState({});
    const [ativosPorUnidade, setAtivosPorUnidade] = useState({});
    const [temCampoAtivos, setTemCampoAtivos] = useState(true);
    useEffect(() => {
        let ativo = true;
        const d = new Date(); d.setDate(d.getDate() - 60);
        const desde = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const consultar = (campos) => supabase.from('movimento_diario').select(campos).gte('data', desde).order('data', { ascending: false });
        (async () => {
            let { data, error } = await consultar('unidade, data, ativos, cancelamentos, faturamento, atualizado_por, atualizado_em');
            let comAtivos = true;
            // Sem o campo "ativos" no banco (falta rodar 3_campo_ativos.sql): lê sem ele
            if (error && /ativos/i.test(error.message || '')) { comAtivos = false; ({ data, error } = await consultar('unidade, data, cancelamentos, faturamento, atualizado_por, atualizado_em')); }
            if (!ativo) return;
            setTemCampoAtivos(comAtivos);
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
        return { nome: u, ativos: atv ? atv.valor : null, ativosVar: atv && atv.anterior !== null ? atv.valor - atv.anterior : null, entradas, saidas: mov.lancamentos || mov.cancelamentos ? mov.cancelamentos : null, faturamento: mov.lancamentos ? mov.faturamento : null, ultimo, situacao: situacaoDe(ultimo, temCampoAtivos) };
    }).sort((a, b) => b.situacao.nivel - a.situacao.nivel || (a.ultimo?.data || '').localeCompare(b.ultimo?.data || '') || a.nome.localeCompare(b.nome)),
    [unidades, vendasFiltradas, planos, produtos, derivados, faixa, ultimos, ativosPorUnidade, temCampoAtivos]);

    const total = linhas.reduce((t, l) => ({ ativos: t.ativos + (l.ativos || 0), entradas: t.entradas + l.entradas, saidas: t.saidas + (l.saidas || 0), faturamento: t.faturamento + (l.faturamento || 0) }), { ativos: 0, entradas: 0, saidas: 0, faturamento: 0 });
    const emDia = linhas.filter(l => l.situacao.nivel === 0).length;
    const incompletas = linhas.filter(l => l.situacao.nivel === 1).length;
    const atrasadas = linhas.filter(l => l.situacao.nivel >= 3).length;

    // Mensagem de COBRANÇA do dia (decisão do dono, 04/11/2026): "detalhado" ou "resumo". Sem números da rede e sem faturamento.
    const enviarWhatsApp = (tipo) => {
        // Domingo não tem lançamento nem cobrança (decisão do dono, 09/11/2026)
        if (ehDomingo(hojeIso())) {
            abrirModalWhatsapp?.(`📊 *MOVIMENTAÇÃO – ${ddmm(hojeIso())}*\n\nDomingo não tem lançamento de movimentação. A cobrança volta na segunda-feira.`, { titulo: tipo === 'resumo' ? 'Movimentação – resumo' : 'Movimentação – detalhado', icone: 'target', cor: 'blue' });
            return;
        }
        const numero = (n) => Number(n).toLocaleString('pt-BR');
        const lancaram = linhas.filter(l => l.situacao.nivel === 0);
        const incompletos = linhas.filter(l => l.situacao.nivel === 1);
        const faltam = linhas.filter(l => l.situacao.nivel > 1);
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
        // Cobrança: o que falta completar (incompletos) e o lançamento do dia inteiro (quem não lançou)
        const todosCampos = juntar(temCampoAtivos ? ['Ativos', 'Cancelamentos', 'Faturamento'] : ['Cancelamentos', 'Faturamento']);
        const pendentes = [
            ...incompletos.map(l => `👉 ${l.nome} — ${juntar(l.situacao.falta)}`),
            ...faltam.map(l => `👉 ${l.nome} — lançamento do dia (${todosCampos})`),
        ];
        const cobranca = pendentes.length
            ? `⏰ *Por gentileza, completem agora o que falta:*\n${pendentes.join('\n')}`
            : '✅ Todas as unidades lançaram completo hoje. Obrigado!';
        // Incompletos: ativos de hoje (se foi preenchido) e o que faltou
        const linhaIncompleto = (l) => `${l.nome} — ${l.ultimo?.ativos !== null && l.ultimo?.ativos !== undefined ? `${numero(l.ultimo.ativos)} ativos · ` : ''}faltou preencher: ${juntar(l.situacao.falta)}`;
        const blocoIncompletos = incompletos.length ? `⚠️ *LANÇAMENTO INCOMPLETO (${incompletos.length})*\n${incompletos.map(linhaIncompleto).join('\n')}\n\n` : '';

        let txt = `📊 *MOVIMENTAÇÃO – ${ddmm(hojeIso())}*\n\n`;
        if (tipo === 'resumo') {
            txt += `✅ *LANÇAMENTO COMPLETO (${lancaram.length})*\n`;
            txt += (lancaram.map(l => `${l.nome}${l.ultimo?.atualizado_em ? ` — ${horaDe(l.ultimo.atualizado_em).slice(0, 5)}` : ''}`).join('\n') || '—') + '\n\n';
            txt += blocoIncompletos;
            txt += `❌ *NÃO LANÇARAM (${faltam.length})*\n`;
            txt += (faltam.map(l => `${l.nome} — último lançamento: ${ultimoTexto(l)}`).join('\n') || '—') + '\n\n';
            txt += cobranca;
        } else {
            txt += `✅ *LANÇAMENTO COMPLETO (${lancaram.length})*\n${ordenados.map(linhaAtivos).join('\n') || '—'}\n\n`;
            txt += blocoIncompletos;
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
                            {tx('{ok} de {total} unidades completas hoje · {incompletas} incompletas · {atrasadas} atrasadas', { ok: emDia, total: linhas.length, incompletas, atrasadas })}
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
                                        <td className="px-3 py-3 text-[12px] font-black text-slate-800 dark:text-white"><span className="inline-flex items-center gap-2">{l.nome}<BotaoCentralUnidade unidade={l.nome} usuario={usuario} /></span></td>
                                        <td className="px-3 py-3">
                                            <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider ${CORES[l.situacao.cor]}`}>{l.situacao.rotulo}</span>
                                            {l.situacao.falta.length > 0 && (
                                                <span className="block mt-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">{tx('Falta: {campos}', { campos: l.situacao.falta.map(c => tx(c)).join(', ') })}</span>
                                            )}
                                        </td>
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
