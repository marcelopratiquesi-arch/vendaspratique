import React from 'react';
import { MapPin, CheckCircle2, Clock, AlertCircle, Check, ChevronRight, Info, UserCheck } from 'lucide-react';
import { formatMoney } from './utils.js';
import { tx, localeAtual } from '../../i18n/traduzir.js';

// ==========================================
// AUDITORIA: quanto de cada unidade já foi CONFERIDO no período do filtro.
// "Conferido" = alguém da gestão marcou o lançamento na aba Conferência (só conferidos entram no Fechamento).
// Clicar numa unidade abre a Conferência já filtrada por ela.
// ==========================================

// Faixa de situação: menos de 50% crítico, até 99% em andamento, 100% concluído
const situacao = (pct, registrados) => {
    if (registrados === 0 || pct === 100) return { rotulo: 'CONCLUÍDO', Icone: CheckCircle2, barra: 'bg-emerald-500', texto: 'text-emerald-700 dark:text-emerald-400', etiqueta: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30' };
    if (pct >= 50) return { rotulo: 'EM ANDAMENTO', Icone: Clock, barra: 'bg-amber-500', texto: 'text-amber-700 dark:text-amber-400', etiqueta: 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30' };
    return { rotulo: 'CRÍTICO', Icone: AlertCircle, barra: 'bg-rose-500', texto: 'text-rose-700 dark:text-rose-400', etiqueta: 'bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30' };
};

const pctDe = (conferidos, registrados) => (registrados === 0 ? 100 : Math.floor((conferidos / registrados) * 100));

// "hoje", "ontem", "há 3 dias" ou a data
const quando = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0);
    const dias = Math.round((inicioHoje - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
    if (dias <= 0) return tx('hoje às {hora}', { hora: d.toLocaleTimeString(localeAtual(), { hour: '2-digit', minute: '2-digit' }) });
    if (dias === 1) return tx('ontem');
    if (dias < 30) return tx('há {qtd} dias', { qtd: dias });
    return d.toLocaleDateString(localeAtual());
};

// Um número da faixa de resumo: valor forte + legenda pequena
const Item = ({ valor, rotulo, cor = 'text-slate-800 dark:text-white', children }) => (
    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
        <span className={`text-base font-black tabular-nums ${cor}`}>{valor}</span>
        <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">{rotulo}</span>
        {children}
    </div>
);

const AuditoriaTab = ({ dadosTabelaAuditoria = [], totais, rotuloPeriodo, onAbrirUnidade }) => {
    const t = totais || { registrados: 0, conferidos: 0, pendentes: 0, valorPendente: 0 };
    const pctGeral = pctDe(t.conferidos, t.registrados);
    const sitGeral = situacao(pctGeral, t.registrados);
    const unidadesPendentes = dadosTabelaAuditoria.filter(l => l.pendentes > 0).length;

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">

            {/* RESUMO EM UMA FAIXA */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-3 dark:bg-slate-900 dark:border-slate-800">
                <div className="flex items-center gap-3 min-w-[min(260px,100%)]">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap dark:text-slate-400">{tx('Progresso da rede')}</span>
                    <div className="flex-1 min-w-[80px] h-2 bg-slate-100 rounded-full overflow-hidden dark:bg-slate-800" role="progressbar" aria-valuenow={pctGeral} aria-valuemin={0} aria-valuemax={100}>
                        <div className={`h-full rounded-full ${sitGeral.barra} transition-all duration-700`} style={{ width: `${pctGeral}%` }} />
                    </div>
                    <span className={`text-base font-black tabular-nums ${sitGeral.texto}`}>{pctGeral}%</span>
                </div>
                <span className={`inline-flex items-center gap-1 border px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest ${sitGeral.etiqueta} ${sitGeral.texto}`}>
                    <sitGeral.Icone className="w-3 h-3" />{tx(sitGeral.rotulo)}
                </span>
                <div className="h-5 w-px bg-slate-200 hidden md:block dark:bg-slate-700" />
                <Item valor={t.registrados} rotulo={tx('registrados')} />
                <Item valor={t.conferidos} rotulo={tx('conferidos')} cor="text-emerald-600 dark:text-emerald-400" />
                <Item valor={t.pendentes} rotulo={tx('pendentes')} cor={t.pendentes > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}>
                    {t.pendentes > 0 && <span className="text-[12px] font-semibold text-slate-400">({tx('{valor} em comissão · {qtd} unidade(s)', { valor: formatMoney(t.valorPendente), qtd: unidadesPendentes })})</span>}
                </Item>
                <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 cursor-help" title={tx('Conferido = lançamento marcado na aba Conferência. Só os conferidos entram nas comissões do Fechamento.')}>
                    <Info className="w-3.5 h-3.5" />{rotuloPeriodo ? tx(rotuloPeriodo) : ''}
                </span>
            </div>

            {/* TABELA POR UNIDADE */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-800">
                <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 dark:border-slate-800">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest dark:text-white">{tx('Desempenho de Conferência por Unidade')}</h3>
                    <p className="text-[11px] font-bold text-slate-400">{tx('Mais pendências primeiro. Clique numa unidade para conferir.')}</p>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[860px]">
                        <thead className="bg-slate-50 dark:bg-slate-800/60">
                            <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">
                                <th className="px-5 py-3 border-b border-slate-200 dark:border-slate-800">{tx('Unidade Operacional')}</th>
                                <th className="px-5 py-3 border-b border-slate-200 w-64 dark:border-slate-800">{tx('Progresso de Auditoria')}</th>
                                <th className="px-5 py-3 border-b border-slate-200 text-right dark:border-slate-800">{tx('Registros')}</th>
                                <th className="px-5 py-3 border-b border-slate-200 text-right dark:border-slate-800">{tx('Conferidos (OK)')}</th>
                                <th className="px-5 py-3 border-b border-slate-200 text-right dark:border-slate-800">{tx('Pendentes')}</th>
                                <th className="px-5 py-3 border-b border-slate-200 dark:border-slate-800">{tx('Última conferência')}</th>
                                <th className="px-3 py-3 border-b border-slate-200 w-10 dark:border-slate-800"><span className="sr-only">{tx('Abrir')}</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {dadosTabelaAuditoria.length > 0 ? dadosTabelaAuditoria.map(row => {
                                const pct = pctDe(row.conferidos, row.registrados);
                                const sit = situacao(pct, row.registrados);
                                const concluido = row.pendentes === 0;
                                return (
                                    <tr key={row.unidade} onClick={() => onAbrirUnidade?.(row.unidade)} title={tx('Abrir a Conferência desta unidade')}
                                        className="group cursor-pointer hover:bg-blue-50/50 transition-colors dark:hover:bg-blue-500/10">
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${concluido ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-800'}`}>
                                                    {concluido ? <Check className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-slate-800 uppercase tracking-tight dark:text-white">{row.unidade}</span>
                                                    <span className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${concluido ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                                        {concluido ? tx('Auditoria Finalizada') : tx('Auditoria Pendente')}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${sit.texto}`}><sit.Icone className="w-3 h-3" />{tx(sit.rotulo)}</span>
                                                <span className={`text-sm font-black tabular-nums ${sit.texto}`}>{pct}%</span>
                                            </div>
                                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden dark:bg-slate-800">
                                                <div className={`h-full rounded-full ${sit.barra}`} style={{ width: `${pct}%` }} />
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-right text-sm font-black text-slate-700 tabular-nums dark:text-slate-200">{row.registrados}</td>
                                        <td className="px-5 py-4 text-right text-sm font-black text-emerald-600 tabular-nums dark:text-emerald-400">{row.conferidos}</td>
                                        <td className="px-5 py-4 text-right">
                                            {row.pendentes > 0 ? (
                                                <div className="flex flex-col items-end">
                                                    <span className="text-sm font-black text-rose-600 tabular-nums dark:text-rose-400">{row.pendentes}</span>
                                                    <span className="text-[11px] font-bold text-slate-400 tabular-nums">{formatMoney(row.valorPendente)}</span>
                                                </div>
                                            ) : <span className="text-[11px] font-bold text-slate-400">—</span>}
                                        </td>
                                        <td className="px-5 py-4">
                                            {row.ultimaEm ? (
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-slate-700 dark:text-slate-200">{quando(row.ultimaEm)}</span>
                                                    {row.ultimaPor && <span className="text-[11px] font-bold text-slate-400 inline-flex items-center gap-1"><UserCheck className="w-3 h-3" />{row.ultimaPor}</span>}
                                                </div>
                                            ) : <span className="text-[11px] font-bold text-slate-400">{tx('Nenhuma ainda')}</span>}
                                        </td>
                                        <td className="px-3 py-4 text-slate-300 group-hover:text-blue-600 dark:text-slate-600 dark:group-hover:text-blue-400"><ChevronRight className="w-4 h-4" /></td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan="7" className="py-20">
                                        <div className="flex flex-col items-center justify-center text-center">
                                            <div className="w-14 h-14 bg-slate-50 border border-slate-200 border-dashed rounded-full flex items-center justify-center mb-4 dark:bg-slate-800/60 dark:border-slate-800">
                                                <AlertCircle className="w-6 h-6 text-slate-300" />
                                            </div>
                                            <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest dark:text-slate-200">{tx('Sem Auditorias Pendentes')}</h4>
                                            <p className="text-xs font-bold text-slate-400 mt-1 max-w-sm">{tx('Nenhum lançamento encontrado para auditar nas unidades no período selecionado.')}</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {dadosTabelaAuditoria.length > 1 && (
                            <tfoot className="bg-slate-50 border-t-2 border-slate-200 dark:bg-slate-800/60 dark:border-slate-700">
                                <tr>
                                    <td className="px-5 py-4 text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">{tx('Total')}</td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden dark:bg-slate-700"><div className={`h-full rounded-full ${sitGeral.barra}`} style={{ width: `${pctGeral}%` }} /></div>
                                            <span className={`text-sm font-black tabular-nums ${sitGeral.texto}`}>{pctGeral}%</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 text-right text-sm font-black text-slate-800 tabular-nums dark:text-white">{t.registrados}</td>
                                    <td className="px-5 py-4 text-right text-sm font-black text-emerald-600 tabular-nums dark:text-emerald-400">{t.conferidos}</td>
                                    <td className="px-5 py-4 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-sm font-black text-rose-600 tabular-nums dark:text-rose-400">{t.pendentes}</span>
                                            {t.pendentes > 0 && <span className="text-[11px] font-bold text-slate-400 tabular-nums">{formatMoney(t.valorPendente)}</span>}
                                        </div>
                                    </td>
                                    <td colSpan="2" />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AuditoriaTab;
