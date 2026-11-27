import React from 'react';
import { Hourglass, CalendarClock, Star, MessageSquareText } from 'lucide-react';
import { diasParado, nivelParado, situacaoProximoContato, formatarDiaCurto, normalizarStatus, FASES_EM_ATENDIMENTO } from './utils';
import { tx } from '../../i18n/traduzir.js';

// ==========================================
// ETIQUETAS DO KANBAN E DA LISTA (Bloco 4)
// - EtiquetaParado: "parado há X dias" (amarela de 5 a 9 dias, vermelha a partir de 10)
// - EtiquetaProximo: data do próximo contato (vermelha se atrasado, azul se for hoje, azul-claro "Em espera" se for depois)
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
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-black tracking-widest uppercase border ${cor}`} title={tx("Dias sem nenhuma ação neste contato (WhatsApp, ligação, anotação, mudança de fase)")}>
            <Hourglass className="w-3 h-3" />{' '}{tx("Parado há")}{' '}{dias}{' '}{tx("dias")}
        </span>
    );
};

// "Vai pensar" / "Interessado" (27/11/2026): o lead.resultado_contato é preenchido pelo CRM a partir do histórico
// (regra em tentativas.js). Só aparece enquanto o contato está em trabalho ou em espera.
export const EtiquetaResultado = ({ lead }) => {
    const r = lead?.resultado_contato;
    if (!r || !FASES_EM_ATENDIMENTO.includes(normalizarStatus(lead.status))) return null;
    const interessado = r.tipo === 'INTERESSADO';
    const cor = interessado
        ? 'bg-amber-500 text-white border-amber-600'
        : 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30';
    const Icone = interessado ? Star : MessageSquareText;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-black tracking-widest uppercase border ${cor}`} title={tx("Última resposta da pessoa em \"Como foi o contato?\"")}>
            <Icone className="w-3 h-3" />{' '}{interessado ? tx("Interessado") : tx("Vai pensar")}
            {r.semResposta > 0 && <span>{' '}· {tx("sem resposta {n}x", { n: r.semResposta })}</span>}
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
            : 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/30';
    // Futuro = Em Espera (09/11/2026): "Em espera · volta 12/11"
    const texto = situacao === 'hoje' ? tx('Contatar hoje') : `${situacao === 'atrasado' ? tx('Atrasado') + ' · ' : tx('Em espera · volta') + ' '}${formatarDiaCurto(lead.proximo_contato)}`;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-black tracking-widest uppercase border ${cor}`} title={situacao === 'futuro' ? tx("Em espera: já foi contatado e volta para a fila nesta data. Não ocupa vaga na carteira.") : tx("Data marcada para o próximo contato")}>
            <CalendarClock className="w-3 h-3" /> {texto}
        </span>
    );
};
