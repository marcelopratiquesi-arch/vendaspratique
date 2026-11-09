import React from 'react';
import { Building2 } from 'lucide-react';
import { tx } from '../i18n/traduzir.js';
import { podeVer } from '../permissoes/catalogoPermissoes.js';
import { abrirCentralUnidade, CODIGO_PERMISSAO_CENTRAL } from './centralUnidade.js';

// Botãozinho "Central" ao lado do nome da unidade (Dashboard, Metas, Relatórios, Ranking; 09/11/2026).
// Não atrapalha o clique da linha (stopPropagation). Some para quem não tem a permissão 314.
// comTexto = mostra "Central" ao lado do ícone (nos títulos); sem texto = só o ícone (nas tabelas).
const BotaoCentralUnidade = ({ unidade, usuario, comTexto = false, className = '' }) => {
    if (!unidade || !podeVer(usuario, CODIGO_PERMISSAO_CENTRAL)) return null;
    const rotulo = tx('Abrir a Central da unidade {nome}', { nome: unidade });
    return (
        <button type="button" title={rotulo} aria-label={rotulo}
            onClick={(e) => { e.stopPropagation(); abrirCentralUnidade(unidade); }}
            className={`shrink-0 inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-300 dark:hover:bg-blue-500/20 ${comTexto ? 'h-6 px-2 text-[10px] font-bold uppercase tracking-wider' : 'w-6 h-6 justify-center'} ${className}`}>
            <Building2 className="w-3.5 h-3.5" />{comTexto && tx('Central')}
        </button>
    );
};

export default BotaoCentralUnidade;
