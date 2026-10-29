import React from 'react';
import { Hourglass, CalendarClock } from 'lucide-react';
import { diasParado, nivelParado, situacaoProximoContato, formatarDiaCurto } from './utils';

// ==========================================
// ETIQUETAS DO KANBAN E DA LISTA (Bloco 4)
// - EtiquetaParado: "parado há X dias" (amarela de 5 a 9 dias, vermelha a partir de 10)
// - EtiquetaProximo: data do próximo contato (vermelha se atrasado, azul se for hoje)
// O "lead.ultima_acao_em" é preenchido pelo CRM a partir do histórico (não é campo do banco).
// ==========================================

export const EtiquetaParado = ({ lead }) => {
    const dias = diasParado(lead, lead?.ultima_acao_em);
    const nivel = nivelParado(dias);
    if (!nivel) return null;
    const cor = nivel === 'vermelho'
        ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30'
        : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30';
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[9px] font-black tracking-widest uppercase border ${cor}`} title="Dias sem nenhuma ação neste contato (WhatsApp, ligação, anotação, mudança de fase)">
            <Hourglass className="w-3 h-3" /> Parado há {dias} dias
        </span>
    );
};

export const EtiquetaProximo = ({ lead }) => {
    const situacao = situacaoProximoContato(lead);
    if (!situacao) return null;
    const cor = situacao === 'atrasado'
        ? 'bg-rose-600 text-white border-rose-600'
        : situacao === 'hoje'
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30';
    const texto = situacao === 'hoje' ? 'Contatar hoje' : `${situacao === 'atrasado' ? 'Atrasado · ' : 'Próximo: '}${formatarDiaCurto(lead.proximo_contato)}`;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[9px] font-black tracking-widest uppercase border ${cor}`} title="Data marcada para o próximo contato">
            <CalendarClock className="w-3 h-3" /> {texto}
        </span>
    );
};
