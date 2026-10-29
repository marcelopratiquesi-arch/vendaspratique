import React from 'react';
import { MessageCircle, Phone, FileText } from 'lucide-react';
import { formatarDataBR } from '../utils.js';

const TabContatosCrm = ({ historico }) => {
    if (!historico || historico.length === 0) {
        return (
            <div className="py-16 flex flex-col items-center justify-center text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                <MessageCircle className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
                <h4 className="text-sm font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">Nenhum contato no CRM</h4>
                <p className="text-xs font-medium text-slate-400 mt-1">Este aluno ainda não recebeu nenhum contato pelo CRM.</p>
            </div>
        );
    }

    return (
        <div className="animate-[fadeIn_0.2s_ease-out] relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 pl-6 space-y-6">
            {historico.map((h) => {
                // O histórico grava "WhatsApp"/"Ligação"; compara sem ligar para maiúsculas.
                // Contato marcado SEM WhatsApp (pop-up/Migração) vem com "alerta" e fica em vermelho.
                const tipo = String(h.tipo_acao || '').toUpperCase();
                const isChamada = tipo.includes('LIGAÇÃO') || tipo.includes('LIGACAO') || tipo.includes('CHAMADA');
                const isWhatsApp = tipo.includes('WHATSAPP') && !h.alerta;
                const Icone = isChamada ? Phone : (isWhatsApp || h.alerta ? MessageCircle : FileText);
                const bgIcone = h.alerta ? 'bg-rose-500' : isChamada ? 'bg-blue-500' : (isWhatsApp ? 'bg-emerald-500' : 'bg-slate-400');

                return (
                    <div key={h.id} className="relative">
                        <div className={`absolute -left-[35px] w-8 h-8 rounded-full ${bgIcone} text-white flex items-center justify-center shadow-sm border-[3px] border-white dark:border-slate-900`}>
                            <Icone className="w-3.5 h-3.5" />
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-2">
                                <span className={`text-[10px] font-black uppercase tracking-widest ${h.alerta ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>{h.tipo_acao || 'Anotação'}</span>
                                <span className="text-[10px] font-bold text-slate-400">{formatarDataBR(h.created_at)} às {new Date(h.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</span>
                            </div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed mt-2">{h.descricao}</p>
                            <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">— Por: {h.autor || 'Sistema'}</div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
export default TabContatosCrm;