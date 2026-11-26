import React, { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';

// ==========================================
// CARTÃO DO ALUNO NO CELULAR — Migração e Resgate (26/11/2026, projeto celular)
// Substitui a linha da tabela abaixo de 768px. Só desenho: quem decide quais botões aparecem é cada aba.
//   botoes: botões grandes, 2 por linha (WhatsApp, Ligar, Abrir no CRM, Pegar para mim...)
//   resultado: os botões "Não respondeu · Vai pensar · Interessado · Mais"
//   menu: ações pouco usadas, abertas pelo "⋯" ([{ chave, icone, rotulo, onClick, desabilitado, perigo }])
// ==========================================

export const BotaoCartaoFila = ({ icone: Icone, rotulo, onClick, desabilitado = false, cor = 'azul', girando = false }) => {
    const cores = {
        azul: 'border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300',
        azulCheio: 'border-blue-700 bg-blue-600 text-white',
        verde: 'border-emerald-700 bg-emerald-600 text-white',
    };
    return (
        <button type="button" onClick={onClick} disabled={desabilitado}
            className={`min-h-11 px-2 rounded-xl border text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 text-center leading-tight disabled:opacity-50 only:col-span-2 ${cores[cor] || cores.azul}`}>
            {Icone && <Icone className={`w-4 h-4 shrink-0 ${girando ? 'animate-spin' : ''}`} />}{rotulo}
        </button>
    );
};

const CartaoAlunoFila = ({ nome, onNome, info, telefone, semTelefone = false, andamento, detalhe, detalheAtrasado = false, naFila, avisos, botoes, resultado, menu = [] }) => {
    const [menuAberto, setMenuAberto] = useState(false);
    const itens = menu.filter(Boolean);
    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm space-y-2">
            <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                    <button type="button" onClick={onNome} className="text-left text-[13px] font-black uppercase break-words text-blue-700 dark:text-blue-400 underline underline-offset-2">{nome}</button>
                    {info && <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 break-words">{info}</p>}
                    <p className={`text-[13px] font-bold ${semTelefone ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200'}`}>{telefone}</p>
                </div>
                {itens.length > 0 && (
                    <button type="button" onClick={() => setMenuAberto(a => !a)} aria-expanded={menuAberto} aria-label={tx('Mais')}
                        className={`shrink-0 w-10 h-10 -mt-1 -mr-1 rounded-xl flex items-center justify-center ${menuAberto ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                        <MoreHorizontal className="w-5 h-5" />
                    </button>
                )}
            </div>

            {menuAberto && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                    {itens.map(m => {
                        const Icone = m.icone;
                        return (
                            <button key={m.chave} type="button" disabled={m.desabilitado} onClick={() => { setMenuAberto(false); m.onClick(); }}
                                className={`w-full min-h-11 px-3 flex items-center gap-2 text-left text-[11px] font-black uppercase tracking-widest disabled:opacity-50 ${m.perigo ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                <Icone className="w-4 h-4 shrink-0" />{m.rotulo}
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {andamento}
                {detalhe && <span className={`text-[11px] font-bold ${detalheAtrasado ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>{detalhe}</span>}
                {naFila && <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{naFila}</span>}
            </div>

            {avisos}
            {botoes && <div className="grid grid-cols-2 gap-2 empty:hidden">{botoes}</div>}
            {resultado && <div className="grid grid-cols-2 gap-2">{resultado}</div>}
        </div>
    );
};

export default CartaoAlunoFila;
