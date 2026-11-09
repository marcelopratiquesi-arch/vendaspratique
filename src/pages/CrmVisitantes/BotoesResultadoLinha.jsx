import React from 'react';
import { PhoneMissed, MessageSquareText, Star, ClipboardCheck } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';

// ==========================================
// RESULTADO DIRETO NA LINHA — Migração e Resgate (decisão do dono, 09/11/2026)
// Três botões para marcar o resultado sem abrir a janela: Não respondeu · Vai pensar · Interessado.
// "Mais" abre a janela "Como foi o contato?" (onde fica o "Não quer").
// Interessado já marcado: clicar de novo desmarca (volta para "Contatado"), como antes na Migração.
// ==========================================
const base = 'px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest flex items-center gap-1 disabled:opacity-60 transition-colors';

const BotoesResultadoLinha = ({ linha, ocupado, onEscolher, onMais, onDesmarcarInteressado }) => {
    const interessado = linha.situacao === 'INTERESSADO';
    return (
        <>
            <button type="button" onClick={() => onEscolher('SEM_RESPOSTA')} disabled={ocupado}
                className={`${base} border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800`}
                title={tx("Não respondeu / não atendeu: volta em 2 dias (na 3ª tentativa vai para a geladeira)")}>
                <PhoneMissed className="w-3.5 h-3.5" />{' '}{tx("Não respondeu")}
            </button>
            <button type="button" onClick={() => onEscolher('PENSANDO')} disabled={ocupado}
                className={`${base} border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/10`}
                title={tx("Respondeu, vai pensar: volta em 3 dias")}>
                <MessageSquareText className="w-3.5 h-3.5" />{' '}{tx("Vai pensar")}
            </button>
            <button type="button" onClick={() => (interessado ? onDesmarcarInteressado?.() : onEscolher('INTERESSADO'))} disabled={ocupado}
                className={`${base} ${interessado ? 'bg-amber-500 text-white border-amber-600' : 'border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/10'}`}
                title={interessado ? tx("Já está como interessado. Clique para desmarcar.") : tx("Interessado: o aluno vai para o seu funil (Em Espera, volta amanhã) para continuar a conversa")}>
                <Star className="w-3.5 h-3.5" />{' '}{tx("Interessado")}
            </button>
            <button type="button" onClick={onMais} disabled={ocupado}
                className={`${base} border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800`}
                title={tx("Outras opções (Não quer)")}>
                <ClipboardCheck className="w-3.5 h-3.5" />{' '}{tx("Mais")}
            </button>
        </>
    );
};

export default BotoesResultadoLinha;
