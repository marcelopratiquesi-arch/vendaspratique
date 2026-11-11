import React, { useState } from 'react';
import { Lock, Zap, Timer } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { tx } from '../../i18n/traduzir.js';
import { recarregarNaVersaoMaisNova } from '../pausaSistema.js';

// Cortina de inatividade (decisão do dono, 07/11/2026): 30 min sem uso = sistema pausado (sem "ao vivo" nem
// releituras do banco). No último minuto aparece o cartão com contagem regressiva; mexer o mouse cancela.
// Voltar recarrega SEMPRE na versão mais nova publicada (recarregarNaVersaoMaisNova).
// modoSair (12/11/2026): Líder/Mentor/Admin com o login com Google ligado SAEM do sistema depois de 15 min parados;
// o cartão do último minuto avisa "Sua sessão vai expirar" com o botão Continuar.
export default function IdleCurtain({ isIdle, segundosParaPausar = null, modoSair = false }) {
    const { t } = useI18n();
    const [voltando, setVoltando] = useState(false);

    if (!isIdle) {
        if (segundosParaPausar === null) return null;
        return (
            <div role="alert" className="fixed top-4 left-1/2 -translate-x-1/2 z-[9998] w-[min(520px,calc(100%-32px))] flex items-center gap-4 bg-white dark:bg-slate-900 border-2 border-amber-400 dark:border-amber-500/60 rounded-2xl shadow-2xl px-5 py-4 animate-[fadeIn_0.3s_ease-out]">
                <div className="w-14 h-14 shrink-0 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex flex-col items-center justify-center">
                    <Timer className="w-4 h-4 text-amber-500" />
                    <span className="text-lg font-black text-amber-600 dark:text-amber-400 leading-none tabular-nums">{segundosParaPausar}</span>
                </div>
                {modoSair ? (
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white">{tx('Sua sessão vai expirar em {seg} s', { seg: segundosParaPausar })}</p>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">{tx('Sem uso há quase 15 minutos. Continuar?')}</p>
                        <button type="button" className="mt-2 h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest">{tx('Continuar')}</button>
                    </div>
                ) : (
                <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white">{tx('O sistema vai pausar em {seg} s', { seg: segundosParaPausar })}</p>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">{tx('Sem uso há quase 30 minutos. Mexa o mouse ou aperte qualquer tecla para continuar.')}</p>
                </div>
                )}
            </div>
        );
    }

    const voltar = () => { setVoltando(true); recarregarNaVersaoMaisNova(); };

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center animate-[fadeIn_0.3s_ease-out]">
            <div className="bg-white dark:bg-[#111827]/80 backdrop-blur-xl p-8 sm:p-10 rounded-[32px] shadow-2xl flex flex-col items-center max-w-md w-[90%] text-center border border-slate-200 dark:border-white/10 animate-[slideDown_0.4s_ease-out]">
                <div className="w-20 h-20 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <Lock className="w-10 h-10 text-rose-500" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">{t('idle.title')}</h2>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3 leading-relaxed px-4">{t('idle.description')}</p>
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-8 px-4">{tx('Ao continuar, o sistema abre já na versão mais nova.')}</p>
                <button
                    onClick={voltar}
                    disabled={voltando}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-500 hover:to-blue-500 disabled:opacity-70 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-[0_4px_20px_rgba(37,99,235,0.3)] dark:shadow-[0_4px_20px_rgba(37,99,235,0.4)] active:scale-95 flex items-center justify-center gap-2 border border-blue-400/20"
                >
                    <Zap className="w-4 h-4 fill-current text-amber-300" /> {voltando ? tx('Atualizando...') : t('idle.button')}
                </button>
            </div>
        </div>
    );
}
