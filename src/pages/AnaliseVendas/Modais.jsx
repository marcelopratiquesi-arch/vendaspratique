import React from 'react';
import { useI18n } from '../../i18n/I18nContext.jsx'; // 🔥 Injetado i18n

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
    const { t } = useI18n(); // 🔥 Pegando traduções
    if (!isOpen) return null;
    const cores = CORES[corIcone] || CORES.emerald;

    const modalTitle = titulo || t('analytics.modals.whatsappTitle', { defaultValue: 'Mensagem para o WhatsApp' });

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col h-[600px] border border-slate-200">
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 ${cores.badge} rounded-full flex items-center justify-center`}>
                            <i data-lucide={icone} className={`w-5 h-5 ${cores.icon}`}></i>
                        </div>
                        <h3 className="text-lg font-black uppercase tracking-tighter">{modalTitle}</h3>
                    </div>
                    <button onClick={onFechar} className="hover:rotate-90 transition-transform"><i data-lucide="x" className="w-6 h-6"></i></button>
                </div>
                <div className="p-6 flex-1 bg-slate-50">
                    <textarea
                        value={texto}
                        onChange={(e) => setTexto(e.target.value)}
                        className="w-full h-full p-5 bg-white border border-slate-200 rounded-2xl outline-none font-mono text-sm text-slate-700 resize-none shadow-inner focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    ></textarea>
                </div>
                <div className="p-6 border-t bg-white grid grid-cols-3 gap-3">
                    <button onClick={onFechar} className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors">
                        {t('analytics.modals.close', { defaultValue: 'Fechar' })}
                    </button>
                    <button onClick={onCopiar} className={`px-4 py-3 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2 ${copiado ? 'bg-emerald-500' : 'bg-blue-600 hover:bg-blue-700'}`}>
                        <i data-lucide={copiado ? "check" : "copy"} className="w-4 h-4"></i> {copiado ? t('analytics.modals.copied', { defaultValue: 'Copiado!' }) : t('analytics.modals.copy', { defaultValue: 'Copiar' })}
                    </button>
                    <button onClick={onEnviar} className="px-4 py-3 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-md flex items-center justify-center gap-2">
                        <i data-lucide="message-circle" className="w-4 h-4"></i> {t('analytics.modals.send', { defaultValue: 'Enviar' })}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModalTextoWhatsapp;