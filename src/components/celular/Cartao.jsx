import React from 'react';
import { tx } from '../../i18n/traduzir.js';

// ==========================================
// CARTÃO DO CELULAR (26/11/2026, projeto celular; decisão do dono: telas do dia a dia trocam a tabela por cartões)
// Padrão de uso numa tela com tabela:
//   <div className="hidden md:block"> ...a <table> de hoje, sem mudar... </div>
//   <div className="md:hidden space-y-2"> {linhas.map(l => <CartaoCelular ...>)} </div>
// Corpo do cartão no modelo da aba Metas: rótulo à esquerda, número à direita (LinhaCartao)
// ou uma grade de números pequenos (GradeCartao + NumeroCartao).
// ==========================================

export const CartaoCelular = ({ titulo, subtitulo, direita, children, onClick, destaque = '', className = '' }) => {
    const Tag = onClick ? 'button' : 'div';
    return (
        <Tag type={onClick ? 'button' : undefined} onClick={onClick}
            className={`w-full text-left block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm ${onClick ? 'active:bg-slate-50 dark:active:bg-slate-800/60' : ''} ${destaque} ${className}`}>
            {(titulo || direita) && (
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        {titulo && <div className="text-[13px] font-black text-slate-800 dark:text-white break-words">{titulo}</div>}
                        {subtitulo && <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 break-words">{subtitulo}</div>}
                    </div>
                    {direita && <div className="shrink-0 text-right">{direita}</div>}
                </div>
            )}
            {children && <div className={titulo || direita ? 'mt-2' : ''}>{children}</div>}
        </Tag>
    );
};

// Linha "rótulo ........ valor" (a mesma ideia do LinhaMov da Movimentação)
export const LinhaCartao = ({ rotulo, valor, cor = 'text-slate-800 dark:text-white' }) => (
    <div className="flex items-center justify-between gap-3 py-1">
        <span className="min-w-0 flex-1 truncate text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{rotulo}</span>
        <span className={`shrink-0 text-sm font-black tabular-nums ${cor}`}>{valor}</span>
    </div>
);

// Grade de números pequenos (3 por linha por padrão)
export const GradeCartao = ({ children, colunas = 3 }) => (
    <div className={`grid gap-2 ${colunas === 2 ? 'grid-cols-2' : colunas === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>{children}</div>
);

export const NumeroCartao = ({ rotulo, valor, cor = 'text-slate-800 dark:text-white', extra }) => (
    <div className="min-w-0 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-2 py-1.5">
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 truncate">{rotulo}</div>
        <div className={`text-sm font-black tabular-nums ${cor} break-words`}>{valor}</div>
        {extra && <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{extra}</div>}
    </div>
);

// Select "Ordenar por" só do celular (substitui o clique no título da coluna)
export const OrdenarCelular = ({ valor, opcoes = [], onChange, rotulo = 'Ordenar por' }) => (
    <label className="md:hidden flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
        <span className="shrink-0">{tx(rotulo)}</span>
        <select value={valor} onChange={(e) => onChange(e.target.value)}
            className="flex-1 h-10 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 font-bold normal-case tracking-normal dark:bg-slate-900 dark:border-slate-800 dark:text-white">
            {opcoes.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </select>
    </label>
);
