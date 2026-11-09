import React from 'react';
import { X, Star, ClipboardCheck, Clock3, ThumbsDown, PhoneMissed, MessageSquareText, CheckCircle2 } from 'lucide-react';
import { somarDiasISO } from './utils';
import { tx } from '../../i18n/traduzir.js';
import { DIAS_VOLTA_PENSANDO, DIAS_VOLTA_SEM_RESPOSTA, DIAS_GELADEIRA, MAX_TENTATIVAS, dataBR } from './resultadoContato.js';

// Janela "Como foi o contato?" (Migração e Resgate). Abre depois do WhatsApp/Ligar ou pelo botão Resultado.
// textoInteressado / textoNaoQuer: o que acontece em cada aba.
// obrigatorio (funil, decisão do dono 09/11/2026): todo contato precisa de um caminho → sem "Decidir depois" e sem fechar.
// textoFechou: mostra a opção "Comprou / fechou" (só no funil).
const JanelaResultadoContato = ({ aluno, hoje, onEscolher, onFechar, textoInteressado, textoNaoQuer, obrigatorio = false, textoFechou }) => {
    const tentativas = Number(aluno.registro?.tentativas) || 0;
    const proxima = Math.min(tentativas + 1, MAX_TENTATIVAS);
    const vaiParaGeladeira = proxima >= MAX_TENTATIVAS;
    const opcoes = [
        { tipo: 'PENSANDO', icone: MessageSquareText, titulo: tx('Respondeu, vai pensar'), texto: tx('Volta para você em {dias} dias ({dia}).', { dias: DIAS_VOLTA_PENSANDO, dia: dataBR(somarDiasISO(hoje, DIAS_VOLTA_PENSANDO)) }), cor: 'border-blue-200 dark:border-blue-500/30 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-blue-700 dark:text-blue-300' },
        { tipo: 'SEM_RESPOSTA', icone: PhoneMissed, titulo: tx('Não respondeu / não atendeu'), texto: vaiParaGeladeira ? tx('{n}ª tentativa: vai para a geladeira e volta em {dias} dias.', { n: proxima, dias: DIAS_GELADEIRA }) : tx('Tentativa {n} de {max}. Volta em {dias} dias ({dia}).', { n: proxima, max: MAX_TENTATIVAS, dias: DIAS_VOLTA_SEM_RESPOSTA, dia: dataBR(somarDiasISO(hoje, DIAS_VOLTA_SEM_RESPOSTA)) }), cor: 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200' },
        { tipo: 'INTERESSADO', icone: Star, titulo: tx('Interessado'), texto: textoInteressado, cor: 'border-amber-200 dark:border-amber-500/30 hover:bg-amber-50 dark:hover:bg-amber-500/10 text-amber-700 dark:text-amber-300' },
        { tipo: 'NAO_QUER', icone: ThumbsDown, titulo: tx('Não quer'), texto: textoNaoQuer, cor: 'border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300' },
        textoFechou && { tipo: 'FECHOU', icone: CheckCircle2, titulo: tx('Comprou / fechou'), texto: textoFechou, cor: 'border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' }
    ].filter(Boolean);
    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-[min(460px,100%)] border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start gap-3">
                    <ClipboardCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">{tx('Como foi o contato?')}</h3>
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 truncate">{aluno.nome}</p>
                    </div>
                    {!obrigatorio && <button type="button" onClick={onFechar} aria-label={tx('Fechar')} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X className="w-5 h-5" /></button>}
                </div>
                <div className="p-4 space-y-2">
                    {opcoes.map(o => (
                        <button key={o.tipo} type="button" onClick={() => onEscolher(o.tipo)} className={`w-full text-left rounded-xl border px-4 py-3 flex items-start gap-3 transition-colors ${o.cor}`}>
                            <o.icone className="w-5 h-5 shrink-0 mt-0.5" />
                            <span className="min-w-0">
                                <span className="block text-xs font-black uppercase tracking-widest">{o.titulo}</span>
                                <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">{o.texto}</span>
                            </span>
                        </button>
                    ))}
                </div>
                {obrigatorio ? (
                    <p className="px-5 pb-4 text-[10px] font-bold text-slate-400">{tx('Escolha um caminho: todo contato precisa de um destino.')}</p>
                ) : (
                    <div className="px-4 pb-4">
                        <button type="button" onClick={onFechar} className="w-full h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center gap-1.5" title={tx('Fecha sem marcar o resultado (não conta tentativa)')}>
                            <Clock3 className="w-3.5 h-3.5" />{' '}{tx('Decidir depois')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default JanelaResultadoContato;
