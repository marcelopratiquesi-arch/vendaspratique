import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { tx } from '../i18n/traduzir.js';

// Título de coluna que ordena ao clicar (regras em components/ordenacao.js). "dica" = "?" com explicação ao lado.
const TituloOrdenavel = ({ coluna, ordem, onOrdenar, texto = false, className = '', alinhar = 'left', dica, children }) => {
    const ativa = ordem?.coluna === coluna;
    const Icone = !ativa ? ArrowUpDown : ordem.direcao === 'asc' ? ArrowUp : ArrowDown;
    const titulo = !ativa
        ? (texto ? tx('Clique para ordenar de A a Z') : tx('Clique para ordenar do maior para o menor'))
        : tx('Clique de novo para inverter (3º clique volta à ordem normal)');
    const lado = alinhar === 'center' ? 'justify-center' : alinhar === 'right' ? 'justify-end' : 'justify-start';
    return (
        <th className={className} aria-sort={ativa ? (ordem.direcao === 'asc' ? 'ascending' : 'descending') : 'none'}>
            <span className={`flex items-center gap-1 ${lado}`}>
                <button type="button" onClick={() => onOrdenar(coluna, texto)} title={titulo}
                    className={`inline-flex items-center gap-1 uppercase tracking-widest font-black outline-none rounded focus-visible:ring-2 focus-visible:ring-blue-500 hover:text-blue-600 dark:hover:text-blue-400 ${ativa ? 'text-blue-700 dark:text-blue-400' : ''}`}>
                    {children}
                    <Icone className={`w-3 h-3 ${ativa ? '' : 'opacity-40'}`} aria-hidden="true" />
                </button>
                {dica && <span title={dica} className="text-slate-400 cursor-help">?</span>}
            </span>
        </th>
    );
};

export default TituloOrdenavel;
