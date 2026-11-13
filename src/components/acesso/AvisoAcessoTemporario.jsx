import React, { useMemo, useState } from 'react';
import { Timer, X } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';
import { diasParaVencer, marcoDoAviso, dataBr, hojeEmBrasilia } from './regrasAcesso.js';

// ==========================================
// AVISO DO ACESSO TEMPORÁRIO (13/11/2026, decisão do dono) — para quem está usando um acesso temporário.
// - Etiqueta pequena no canto de baixo à esquerda: "Acesso temporário · unidades · até dd/mm" (amarela a partir
//   de 7 dias, vermelha no último dia). Clicar esconde até recarregar.
// - Janela no meio da tela faltando 7, 3 e 1 dia e no último dia, uma vez por marco (guardado no computador).
// Quem liberou vê os mesmos prazos em Acessos → Temporários (amarelo a partir de 7 dias).
// O corte é feito pelo banco no fim do prazo; esta tela só avisa.
// ==========================================

const chaveMarco = (t, marco) => `pratique_aviso_temp_${t.id}_${t.vale_ate}_${marco}`;
const jaViu = (k) => { try { return localStorage.getItem(k) === '1'; } catch { return false; } };
const marcarVisto = (k) => { try { localStorage.setItem(k, '1'); } catch { /* sem armazenamento: só volta a avisar */ } };

const textoPrazo = (dias) => (dias <= 0 ? tx('vence hoje às 23:59') : dias === 1 ? tx('vence amanhã às 23:59') : tx('vence em {qtd} dias', { qtd: dias }));

const AvisoAcessoTemporario = ({ temporarios = [] }) => {
    const hoje = hojeEmBrasilia();
    const itens = useMemo(() => temporarios.map(t => ({ ...t, dias: diasParaVencer(t, hoje) })).sort((a, b) => a.dias - b.dias), [temporarios, hoje]);
    const [escondida, setEscondida] = useState(false);
    const pendentes = itens.filter(t => { const m = marcoDoAviso(t.dias); return m !== null && !jaViu(chaveMarco(t, m)); });
    const [janelaAberta, setJanelaAberta] = useState(pendentes.length > 0);
    if (!itens.length) return null;
    const maisPerto = itens[0];
    const cor = maisPerto.dias <= 1 ? 'bg-rose-600 text-white' : maisPerto.dias <= 7 ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white';

    const fecharJanela = () => { pendentes.forEach(t => marcarVisto(chaveMarco(t, marcoDoAviso(t.dias)))); setJanelaAberta(false); };

    return (
        <>
            {!escondida && (
                <button type="button" onClick={() => setEscondida(true)} title={tx('Clique para esconder')}
                    className={`fixed bottom-3 left-3 z-[150] max-w-[min(420px,calc(100%-24px))] px-3 py-2 rounded-xl shadow-lg text-left text-[11px] font-black uppercase tracking-wide flex items-start gap-2 ${cor}`}>
                    <Timer className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="min-w-0">
                        {itens.map(t => (
                            <span key={t.id} className="block truncate">
                                {tx('Acesso temporário')} · {t.tipo === 'MENTOR' ? tx('Mentor') : tx('Líder')} · {(t.unidades || []).join(', ')} · {tx('até {data}', { data: dataBr(t.vale_ate) })}
                                {t.dias <= 7 && ` · ${textoPrazo(t.dias)}`}
                            </span>
                        ))}
                    </span>
                </button>
            )}
            {janelaAberta && pendentes.length > 0 && (
                <div className="fixed inset-0 z-[300] bg-slate-900/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
                    <div className="w-[min(480px,100%)] bg-white rounded-2xl shadow-2xl p-6 dark:bg-slate-900">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center dark:bg-amber-500/10 dark:text-amber-400"><Timer className="w-6 h-6" /></div>
                                <h2 className="text-base font-black uppercase tracking-widest text-slate-800 dark:text-white">{tx('Seu acesso temporário vai acabar')}</h2>
                            </div>
                            <button type="button" onClick={fecharJanela} aria-label={tx('Fechar')} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button>
                        </div>
                        <ul className="mt-4 space-y-2">
                            {pendentes.map(t => (
                                <li key={t.id} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:bg-amber-500/10 dark:border-amber-500/30">
                                    <p className="text-[13px] font-black uppercase text-slate-800 dark:text-white">{t.tipo === 'MENTOR' ? tx('Mentor') : tx('Líder')} · {(t.unidades || []).join(', ')}</p>
                                    <p className="text-[14px] font-bold text-amber-800 dark:text-amber-200">{textoPrazo(t.dias)} ({dataBr(t.vale_ate)})</p>
                                    {t.liberado_por && <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">{tx('Liberado por {quem}', { quem: t.liberado_por })}</p>}
                                </li>
                            ))}
                        </ul>
                        <p className="mt-3 text-[13px] font-semibold text-slate-600 dark:text-slate-300">{tx('No fim do prazo o acesso é cortado sozinho. Se precisar continuar, peça a prorrogação a quem liberou.')}</p>
                        <button type="button" onClick={fecharJanela} className="mt-4 w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-black uppercase tracking-widest">{tx('Entendi')}</button>
                    </div>
                </div>
            )}
        </>
    );
};

export default AvisoAcessoTemporario;
