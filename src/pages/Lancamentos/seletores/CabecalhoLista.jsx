// Cabeçalho "← Voltar" das listas em tela cheia (só no celular)
import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { tx } from '../../../i18n/traduzir.js';

const CabecalhoLista = ({ titulo, onVoltar }) => (
    <div className="md:hidden shrink-0 flex items-center gap-2 px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] border-b border-[#EEF1F6] dark:border-slate-800">
        <button type="button" onClick={onVoltar} className="h-11 px-3 rounded-xl flex items-center gap-1.5 text-[13px] font-black uppercase tracking-widest text-blue-700 active:bg-blue-50 dark:text-blue-300 dark:active:bg-blue-500/10">
            <ArrowLeft className="w-4 h-4" />{tx('Voltar')}
        </button>
        <span className="flex-1 min-w-0 truncate text-right pr-2 text-[12px] font-black uppercase tracking-widest text-[#0F172A] dark:text-white">{titulo}</span>
    </div>
);

export default CabecalhoLista;
