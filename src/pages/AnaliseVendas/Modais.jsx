import React from 'react';
import { useI18n } from '../../i18n/I18nContext.jsx'; 

const CORES = {
    emerald: { badge: 'bg-emerald-500/20', icon: 'text-emerald-400' },
    blue: { badge: 'bg-blue-500/20', icon: 'text-blue-400' },
};

const ModalTextoWhatsapp = ({
    isOpen,
    titulo,
    icone = 'send',
    corIcone = 'emerald',
    texto,
    setTexto,
    copiado,
    onFechar,
    onCopiar,
    onEnviar
}) => {
    const { t } = useI18n(); 
    if (!isOpen) return null;
    const cores = CORES[corIcone] || CORES.emerald;

    const modalTitle = titulo || t('analytics.modals.whatsappTitle', { defaultValue: 'Mensagem para o WhatsApp' });

    return (
        // 🔥 Z-INDEX NO MÁXIMO (9999) PARA COBRIR MENU LATERAL E TOPBAR
        <div className="fixed inset-0 z-[9999] flex items-stretch md:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 md:p-4 animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-white rounded-none md:rounded-[24px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col h-[100dvh] md:h-[min(600px,calc(100dvh-2rem))] border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                <div className="shrink-0 px-4 py-3 md:p-6 bg-slate-900 text-white flex justify-between items-center gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 ${cores.badge} rounded-full flex items-center justify-center`}>
                            <i data-lucide={icone} className={`w-5 h-5 ${cores.icon}`}></i>
                        </div>
                        <h3 className="text-base md:text-lg font-black uppercase tracking-tighter break-words">{modalTitle}</h3>
                    </div>
                    <button type="button" onClick={onFechar} aria-label={t('analytics.modals.close', { defaultValue: 'Fechar' })} className="shrink-0 w-10 h-10 md:w-auto md:h-auto flex items-center justify-center rounded-xl hover:rotate-90 transition-transform"><i data-lucide="x" className="w-6 h-6"></i></button>
                </div>
                <div className="p-3 md:p-6 flex-1 min-h-0 bg-slate-50 dark:bg-slate-800/60">
                    <textarea
                        value={texto}
                        onChange={(e) => setTexto(e.target.value)}
                        className="w-full h-full p-3 md:p-5 bg-white border border-slate-200 rounded-2xl outline-none font-mono text-sm text-slate-700 resize-none shadow-inner focus:ring-2 focus:ring-emerald-500/20 transition-all dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200"
                    ></textarea>
                </div>
                <div className="shrink-0 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:p-6 border-t bg-white grid grid-cols-3 gap-2 md:gap-3 dark:bg-slate-900">
                    <button onClick={onFechar} className="h-12 md:h-auto px-2 md:px-4 py-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                        {t('analytics.modals.close', { defaultValue: 'Fechar' })}
                    </button>
                    <button onClick={onCopiar} className={`h-12 md:h-auto px-2 md:px-4 py-3 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2 ${copiado ? 'bg-emerald-500' : 'bg-blue-600 hover:bg-blue-700'}`}>
                        <i data-lucide={copiado ? "check" : "copy"} className="w-4 h-4"></i> {copiado ? t('analytics.modals.copied', { defaultValue: 'Copiado!' }) : t('analytics.modals.copy', { defaultValue: 'Copiar' })}
                    </button>
                    <button onClick={onEnviar} className="h-12 md:h-auto px-2 md:px-4 py-3 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-md flex items-center justify-center gap-2">
                        <i data-lucide="message-circle" className="w-4 h-4"></i> {t('analytics.modals.send', { defaultValue: 'Enviar' })}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModalTextoWhatsapp;