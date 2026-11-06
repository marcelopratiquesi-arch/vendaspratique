// ==========================================
// JANELA DE PENDÊNCIAS AO ENTRAR (decisão do dono, 05/11/2026) — Líder (a unidade dele) e Mentor (as dele).
// Abre UMA vez por entrada no sistema, no meio da tela, se houver pendência (ou o lembrete da sexta).
// Blocos: Conferência (prazo toda sexta), Movimentação (todo dia a partir das 7h) e Metas do mês (até o dia 03).
// Não trava: "Lembrar depois" fecha (volta no próximo login) e o cartão do canto continua mostrando o que falta.
// Regras em pendencias.js.
// ==========================================
import React, { useEffect, useState } from 'react';
import { AlertTriangle, CalendarCheck, ClipboardCheck, BarChart3, Target, Send, X } from 'lucide-react';
import { tx, localeAtual } from '../../i18n/traduzir.js';
import { DIA_PRAZO_METAS } from './pendencias.js';

const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const dinheiro = (v) => new Intl.NumberFormat(localeAtual(), { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
const MAX_UNIDADES = 6;
const MAX_SEMANAS = 6;
const juntarCampos = (lista) => lista.map(c => tx(c)).join(', ');

const Botao = ({ onClick, children }) => (
    <button type="button" onClick={onClick} className="shrink-0 h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest">{children}</button>
);

// Blocos de uma unidade (Conferência, Movimentação, Metas), cada um com o botão que leva à tela certa
export const BlocosDaUnidade = ({ u, aoIr }) => {
    const c = u.conferencia;
    return (
        <div className="space-y-2">
            {c && (
                <div className={`rounded-xl border px-3 py-2.5 ${c.atrasado ? 'border-rose-200 bg-rose-50 dark:bg-rose-500/10 dark:border-rose-500/30' : 'border-blue-200 bg-blue-50 dark:bg-blue-500/10 dark:border-blue-500/30'}`}>
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 ${c.atrasado ? 'text-rose-700 dark:text-rose-300' : 'text-blue-700 dark:text-blue-300'}`}>
                                <ClipboardCheck className="w-3.5 h-3.5" />{c.atrasado ? tx('Conferência atrasada') : tx('Hoje é dia de conferência')}
                            </p>
                            {c.atrasado && (
                                <ul className="mt-1 space-y-0.5">
                                    {c.atrasadas.slice(0, MAX_SEMANAS).map(s => (
                                        <li key={s.fim} className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                                            {tx('Semana {inicio} a {fim}', { inicio: ddmm(s.inicio), fim: ddmm(s.fim) })}: <b className="text-rose-700 dark:text-rose-300">{tx('{qtd} sem conferir', { qtd: s.qtd })}</b>
                                        </li>
                                    ))}
                                    {c.atrasadas.length > MAX_SEMANAS && <li className="text-[11px] font-bold text-rose-700 dark:text-rose-300">{tx('+ {qtd} semanas mais antigas', { qtd: c.atrasadas.length - MAX_SEMANAS })}</li>}
                                    <li className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{tx('{qtd} vendas · {valor} em comissão', { qtd: c.qtd, valor: dinheiro(c.valor) })}</li>
                                </ul>
                            )}
                            {c.semanaAtual && (
                                <p className="mt-1 text-[12px] font-semibold text-blue-800 dark:text-blue-300">
                                    {tx('Hoje (sexta) vence a semana {inicio} a {fim}: {qtd} vendas sem conferir.', { inicio: ddmm(c.semanaAtual.inicio), fim: ddmm(c.semanaAtual.fim), qtd: c.semanaAtual.qtd })}
                                </p>
                            )}
                        </div>
                        <Botao onClick={() => aoIr('conferencia', u)}>{tx('Conferir')}</Botao>
                    </div>
                </div>
            )}
            {u.movimento.length > 0 && (
                <div className={`rounded-xl border px-3 py-2.5 ${u.movimento.some(d => !d.hoje) ? 'border-rose-200 bg-rose-50 dark:bg-rose-500/10 dark:border-rose-500/30' : 'border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30'}`}>
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 ${u.movimento.some(d => !d.hoje) ? 'text-rose-700 dark:text-rose-300' : 'text-amber-800 dark:text-amber-300'}`}>
                                <BarChart3 className="w-3.5 h-3.5" />{tx('Movimentação do dia')}
                            </p>
                            <ul className="mt-1 space-y-0.5">
                                {u.movimento.map(d => (
                                    <li key={d.data} className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                                        <b>{d.hoje ? tx('Hoje ({data})', { data: ddmm(d.data) }) : ddmm(d.data)}</b>: {d.semLancamento ? tx('não lançou') : tx('falta {campos}', { campos: juntarCampos(d.falta) })}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <Botao onClick={() => aoIr('movimento', u)}>{tx('Lançar')}</Botao>
                    </div>
                </div>
            )}
            {u.metas && (
                <div className={`rounded-xl border px-3 py-2.5 ${u.metas.atrasado ? 'border-rose-200 bg-rose-50 dark:bg-rose-500/10 dark:border-rose-500/30' : 'border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30'}`}>
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 ${u.metas.atrasado ? 'text-rose-700 dark:text-rose-300' : 'text-amber-800 dark:text-amber-300'}`}>
                                <Target className="w-3.5 h-3.5" />{tx('Metas de {mes}', { mes: tx(u.metas.mes) })}
                                <span className="normal-case tracking-normal font-bold">· {u.metas.atrasado ? tx('prazo dia {dia} vencido', { dia: String(DIA_PRAZO_METAS).padStart(2, '0') }) : tx('prazo até dia {dia}', { dia: String(DIA_PRAZO_METAS).padStart(2, '0') })}</span>
                            </p>
                            <ul className="mt-1 space-y-0.5">
                                {u.metas.start && <li className="text-[12px] font-semibold text-slate-700 dark:text-slate-200"><b>{tx('Meta Start')}</b>: {u.metas.start.naoPreenchida ? tx('não preenchida') : tx('falta {campos}', { campos: juntarCampos(u.metas.start.falta) })}</li>}
                                {u.metas.mensal && <li className="text-[12px] font-semibold text-slate-700 dark:text-slate-200"><b>{tx('Meta Mensal')}</b>: {u.metas.mensal.naoPreenchida ? tx('não preenchida') : tx('falta {campos}', { campos: juntarCampos(u.metas.mensal.falta) })}</li>}
                            </ul>
                        </div>
                        <Botao onClick={() => aoIr('metas', u)}>{tx('Preencher')}</Botao>
                    </div>
                </div>
            )}
            {u.relatorio?.length > 0 && (
                <div className={`rounded-xl border px-3 py-2.5 ${u.relatorio.some(r => r.situacao !== 'cobrando') ? 'border-rose-200 bg-rose-50 dark:bg-rose-500/10 dark:border-rose-500/30' : 'border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30'}`}>
                    <p className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 ${u.relatorio.some(r => r.situacao !== 'cobrando') ? 'text-rose-700 dark:text-rose-300' : 'text-amber-800 dark:text-amber-300'}`}>
                        <Send className="w-3.5 h-3.5" />{tx('Relatório de fechamento da recepção')}
                    </p>
                    <ul className="mt-1 space-y-0.5">
                        {u.relatorio.map(r => (
                            <li key={`${r.data}-${r.turno}`} className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                                <b>{r.hoje ? tx('Hoje') : ddmm(r.data)} · {tx(r.rotulo)}</b>: {r.situacao === 'cobrando' ? tx('ainda não enviado (prazo {hora})', { hora: r.atrasaTexto }) : tx('não enviado')}
                                {r.nomes?.length > 0 && <span className="text-slate-500 dark:text-slate-400"> — {r.nomes.join(' / ')}</span>}
                            </li>
                        ))}
                    </ul>
                    <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tx('Quem envia é o login da Recepção: Relatórios → WhatsApp Fechamento.')}</p>
                </div>
            )}
        </div>
    );
};

const JanelaPendencias = ({ lista = [], carregado, ehMentor, aoIr, aoVerTodas, onFechar }) => {
    // Decide UMA vez, quando os dados chegam (entrada no sistema). Depois quem acompanha é o cartão do canto.
    const [aberta, setAberta] = useState(null); // null = ainda não decidiu
    const comAlgo = lista.filter(u => u.total > 0 || u.lembretes > 0);
    useEffect(() => {
        if (aberta !== null || !carregado) return;
        setAberta(comAlgo.length > 0);
        if (!comAlgo.length) onFechar?.();
    }, [carregado, aberta, comAlgo.length, onFechar]);

    if (!aberta || !comAlgo.length) return null;
    const fechar = () => { setAberta(false); onFechar?.(); };
    const ir = (tipo, u) => { fechar(); aoIr?.(tipo, u); };
    const temAtraso = comAlgo.some(u => u.atrasado);
    const visiveis = comAlgo.slice(0, MAX_UNIDADES);
    const resto = comAlgo.length - visiveis.length;
    const titulo = temAtraso ? tx('Pendências da unidade') : tx('Lembretes da unidade');

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]" role="dialog" aria-modal="true" aria-labelledby="janela-pendencias-titulo">
            <div className="bg-white rounded-2xl shadow-2xl w-[min(560px,100%)] max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                <div className={`px-6 py-5 flex items-start gap-3 ${temAtraso ? 'bg-rose-600' : 'bg-amber-500'} text-white`}>
                    {temAtraso ? <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" /> : <CalendarCheck className="w-6 h-6 shrink-0 mt-0.5" />}
                    <div className="min-w-0 flex-1">
                        <h2 id="janela-pendencias-titulo" className="text-base font-black uppercase tracking-widest leading-tight">
                            {ehMentor ? (temAtraso ? tx('Pendências das suas unidades') : tx('Lembretes das suas unidades')) : titulo}
                        </h2>
                        <p className="text-[12px] font-bold uppercase tracking-widest opacity-90 mt-1">
                            {ehMentor ? tx('{qtd} unidade(s) com pendência', { qtd: comAlgo.length }) : comAlgo[0].unidade}
                        </p>
                    </div>
                    <button type="button" onClick={fechar} aria-label={tx('Fechar')} className="opacity-80 hover:opacity-100"><X className="w-5 h-5" /></button>
                </div>

                <div className="px-6 py-5 overflow-y-auto custom-scrollbar space-y-4">
                    <p className="text-sm font-bold text-slate-700 leading-snug dark:text-slate-200">
                        {ehMentor
                            ? tx('Estas unidades estão com informações sem preencher. Cobre o Líder de cada uma.')
                            : tx('Preencha o que está faltando. Este aviso aparece toda vez que você entrar no sistema até tudo ficar em dia.')}
                    </p>
                    {visiveis.map(u => (
                        <div key={u.unidade}>
                            {ehMentor && <p className="text-[12px] font-black uppercase tracking-widest text-slate-800 mb-1.5 dark:text-white">{u.unidade}</p>}
                            <BlocosDaUnidade u={u} aoIr={ir} />
                        </div>
                    ))}
                    {resto > 0 && (
                        <button type="button" onClick={() => { fechar(); aoVerTodas?.(); }} className="text-[12px] font-black text-blue-700 hover:underline dark:text-blue-400">
                            {tx('+ {qtd} unidades — ver todas em Pendências', { qtd: resto })}
                        </button>
                    )}
                    <p className="text-[11px] font-semibold text-slate-500 leading-snug dark:text-slate-400">
                        {tx('Movimentação: todo dia a partir das 7h. Conferência: toda sexta-feira. Metas: até o dia 03 de cada mês. Relatório da recepção: manhã até 14h30, noite até 23h, sábado e domingo até 13h.')}
                    </p>
                </div>

                <div className="px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row gap-3 dark:border-slate-800">
                    <button type="button" onClick={fechar} className="flex-1 h-11 px-4 rounded-xl bg-slate-100 text-slate-600 text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                        {tx('Lembrar depois')}
                    </button>
                    {ehMentor && (
                        <button type="button" onClick={() => { fechar(); aoVerTodas?.(); }} className="flex-1 h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest shadow-md">
                            {tx('Abrir Pendências e cobrar')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default JanelaPendencias;
