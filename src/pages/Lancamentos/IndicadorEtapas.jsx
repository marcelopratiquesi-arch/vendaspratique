// Indicador "Cliente → Itens → Finalizar" da tela Lançar venda (reflete o estado real do formulário)
import React from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';

const IndicadorEtapas = ({ cliente = false, itens = false, finalizado = false }) => {
    const etapas = [
        { rotulo: 'Cliente', feita: cliente },
        { rotulo: 'Itens', feita: cliente && itens },
        { rotulo: 'Finalizar', feita: finalizado },
    ];
    const atual = etapas.findIndex(e => !e.feita);
    return (
        <ol className="flex items-center gap-1.5 sm:gap-2" aria-label={tx('Etapas da venda')}>
            {etapas.map((e, i) => {
                const ehAtual = i === atual;
                return (
                    <li key={e.rotulo} className="flex items-center gap-1.5 sm:gap-2" aria-current={ehAtual ? 'step' : undefined}>
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 ${e.feita ? 'bg-[#0E9F6E] text-white' : ehAtual ? 'bg-[#0B1F4B] text-white dark:bg-blue-600' : 'bg-[#E4E8F0] text-[#5B6478] dark:bg-slate-700 dark:text-slate-300'}`}>
                            {e.feita ? <Check className="w-4 h-4" strokeWidth={3} /> : i + 1}
                        </span>
                        <span className={`text-[13px] font-semibold ${e.feita || ehAtual ? 'text-[#0F172A] dark:text-white' : 'text-[#5B6478] dark:text-slate-400'}`}>{tx(e.rotulo)}</span>
                        {i < etapas.length - 1 && <ChevronRight className="w-4 h-4 text-[#94A3B8]" aria-hidden="true" />}
                    </li>
                );
            })}
        </ol>
    );
};

export default IndicadorEtapas;
