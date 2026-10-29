import React from 'react';
import { AlertTriangle, UserRoundPen } from 'lucide-react';
import { tx } from '../i18n/traduzir.js';

// Etiqueta "CADASTRO INCOMPLETO": mostra o que falta e o botão para completar.
// Na Nova Venda e na Avaliação ela também trava o lançamento até o cadastro ficar completo.
const AvisoCadastroIncompleto = ({ pendencias = [], onCompletar, liberar = '' }) => {
    if (pendencias.length === 0) return null;
    return (
        <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-[fadeIn_0.2s_ease-out]">
            <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                    <p className="text-xs font-black text-rose-800 dark:text-rose-300 uppercase tracking-widest">{tx("Cadastro incompleto")}</p>
                    <p className="text-xs font-bold text-rose-700/80 dark:text-rose-300/80 mt-0.5">
                        {tx("Falta:")}{' '}{pendencias.join(', ')}.{liberar ? " " + tx("Complete o cadastro para liberar {liberar}.", { liberar: liberar }) + "" : ''}
                    </p>
                </div>
            </div>
            {onCompletar && (
                <button type="button" onClick={onCompletar} className="shrink-0 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-colors flex items-center justify-center gap-2">
                    <UserRoundPen className="w-4 h-4" />{' '}{tx("Completar cadastro")}
                </button>
            )}
        </div>
    );
};

export default AvisoCadastroIncompleto;
