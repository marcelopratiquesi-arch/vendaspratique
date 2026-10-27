import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';

const normalizar = (u) => String(u || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

// Etiqueta com a(s) unidade(s) de origem do aluno.
// Azul = unidade de quem está usando o sistema | cinza = outra unidade da rede.
// Ligado a mais de uma unidade: mostra todas e um aviso para conferir/unificar o cadastro.
export default function EtiquetasUnidade({ unidades = [], unidadeMinha = '', semVinculo = 'SEM VÍNCULO', className = '' }) {
    const { t } = useI18n();
    const tr = (chave, padrao) => {
        const res = t(chave);
        return res && res !== chave ? res : padrao;
    };

    const lista = [...new Set((unidades || []).map(u => String(u || '').toUpperCase().trim()).filter(Boolean))];
    const minha = normalizar(unidadeMinha);

    if (lista.length === 0) {
        return <span className={`inline-flex px-1.5 py-px rounded text-[10px] font-semibold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 ${className}`}>{semVinculo}</span>;
    }

    return (
        <span className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
            {lista.map(u => {
                const ehMinha = minha && normalizar(u) === minha;
                return (
                    <span
                        key={u}
                        title={ehMinha ? tr('search.ownUnit', 'Sua unidade') : tr('search.otherUnit', 'Outra unidade da rede')}
                        className={`px-1.5 py-px rounded text-[10px] font-bold uppercase tracking-wider border ${ehMinha
                            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30'
                            : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'}`}
                    >
                        {u}
                    </span>
                );
            })}
            {lista.length > 1 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400" title={tr('search.multiUnitHint', 'Peça para alguém conferir e unificar o cadastro deste aluno.')}>
                    <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
                    {tr('search.multiUnit', 'Ligado a mais de uma unidade, conferir')}
                </span>
            )}
        </span>
    );
}
