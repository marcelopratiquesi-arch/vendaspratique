import React from 'react';
import { HelpCircle } from 'lucide-react';

// ==========================================
// DICA "?" ÚNICA (26/11/2026, projeto celular): abre ao passar o mouse E ao tocar (o `title` não aparece no toque).
// Mesmo desenho das dicas da Auditoria e da Movimentação. Área de toque de 32px sem mudar o tamanho do ícone.
// Use no lugar de `title=` quando o texto explica algo importante.
// <Dica texto="O que é esta coluna" alinhar="left" />   (alinhar: 'right' padrão | 'left')
// ==========================================
const Dica = ({ texto, alinhar = 'right', icone: Icone = HelpCircle, children }) => (
    <span className="group/dica relative inline-flex align-middle">
        <button type="button" aria-label={typeof texto === 'string' ? texto : undefined} onClick={(e) => e.stopPropagation()}
            className="-m-2 p-2 text-slate-400 hover:text-blue-600 focus:text-blue-600 outline-none dark:hover:text-blue-400 dark:focus:text-blue-400">
            {children || <Icone className="w-3.5 h-3.5" />}
        </button>
        <span role="tooltip" className={`pointer-events-none absolute top-full mt-2 z-40 w-[min(260px,75vw)] hidden group-hover/dica:block group-focus-within/dica:block bg-slate-800 text-white text-[11px] font-semibold normal-case tracking-normal text-left leading-snug px-3 py-2 rounded-lg shadow-lg dark:bg-slate-700 ${alinhar === 'left' ? 'left-0' : 'right-0'}`}>
            {texto}
        </span>
    </span>
);

export default Dica;
