import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';

import { ouvintesDeAvisos } from './avisar.js';

// Central que desenha os avisos de avisar() no canto da tela (montada uma vez só, no main.jsx)
const ESTILO = {
    sucesso: { icone: CheckCircle2, caixa: 'border-emerald-200 dark:border-emerald-500/30', faixa: 'bg-emerald-500', cor: 'text-emerald-600 dark:text-emerald-400', titulo: 'Tudo certo' },
    erro: { icone: XCircle, caixa: 'border-rose-200 dark:border-rose-500/30', faixa: 'bg-rose-500', cor: 'text-rose-600 dark:text-rose-400', titulo: 'Atenção: erro' },
    atencao: { icone: AlertTriangle, caixa: 'border-amber-200 dark:border-amber-500/30', faixa: 'bg-amber-500', cor: 'text-amber-600 dark:text-amber-400', titulo: 'Aviso' }
};

// Tempo na tela: erro fica mais; texto longo fica mais (no máximo 20 s)
const duracao = (aviso) => Math.min(20000, ({ sucesso: 4000, atencao: 7000, erro: 10000 }[aviso.tipo] || 7000) + Math.max(0, aviso.texto.length - 80) * 40);
const MAX_NA_TELA = 4;

export const CentralDeAvisos = () => {
    const [avisos, setAvisos] = useState([]);
    const fechar = useCallback((id) => setAvisos(prev => prev.filter(a => a.id !== id)), []);

    useEffect(() => {
        const receber = (aviso) => {
            setAvisos(prev => [...prev, aviso].slice(-MAX_NA_TELA));
            setTimeout(() => fechar(aviso.id), duracao(aviso));
        };
        ouvintesDeAvisos.add(receber);
        return () => { ouvintesDeAvisos.delete(receber); };
    }, [fechar]);

    if (avisos.length === 0) return null;

    return (
        <div className="fixed z-[9999] top-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-[400px] flex flex-col gap-2 pointer-events-none" role="status" aria-live="polite">
            {avisos.map(a => {
                const e = ESTILO[a.tipo] || ESTILO.atencao;
                const Icone = e.icone;
                return (
                    <div key={a.id} className={`pointer-events-auto relative overflow-hidden bg-white dark:bg-slate-900 border ${e.caixa} rounded-2xl shadow-2xl animate-[fadeIn_0.2s_ease-out]`}>
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${e.faixa}`} />
                        <div className="flex items-start gap-3 pl-5 pr-3 py-3.5">
                            <Icone className={`w-5 h-5 shrink-0 mt-0.5 ${e.cor}`} />
                            <div className="flex-1 min-w-0">
                                <p className={`text-[10px] font-black uppercase tracking-widest ${e.cor}`}>{e.titulo}</p>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 whitespace-pre-line break-words max-h-60 overflow-y-auto custom-scrollbar mt-0.5">{a.texto}</p>
                            </div>
                            <button type="button" onClick={() => fechar(a.id)} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar aviso">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
