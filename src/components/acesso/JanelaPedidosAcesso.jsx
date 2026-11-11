import React from 'react';
import { UserPlus, X, ShieldAlert } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';
import PedidosAcesso from './PedidosAcesso.jsx';

// ==========================================
// JANELA AO ENTRAR — Admin e Mentor (12/11/2026, decisão do dono): pedidos de acesso e trocas de líder do escopo
// dele, para aprovar ali mesmo; para o Admin também o alerta de quem está 7 dias ou mais sem entrar.
// Fecha com "Depois"; tudo continua na aba Pendências → Acessos.
// ==========================================

const JanelaPedidosAcesso = ({ contas, ehAdmin, unidades = [], onDecidido, onFechar, onVerPendencias }) => {
    if (!contas) return null;
    const pedidos = contas.pedidos || [];
    const graves = ehAdmin ? contas.graves : 0;
    if (!pedidos.length && !graves) return null;
    return (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-pedidos-acesso">
            <div className="bg-white rounded-2xl shadow-2xl w-[min(680px,100%)] max-h-[90vh] overflow-hidden flex flex-col dark:bg-slate-900">
                <div className="px-6 py-4 bg-blue-600 text-white flex items-start gap-3">
                    <UserPlus className="w-6 h-6 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <h2 id="titulo-pedidos-acesso" className="text-sm font-black uppercase tracking-widest">{tx('Acessos para resolver')}</h2>
                        <p className="text-[12px] font-semibold opacity-90">{pedidos.length === 1 ? tx('1 pedido aguardando você') : tx('{qtd} pedidos aguardando você', { qtd: pedidos.length })}</p>
                    </div>
                    <button type="button" onClick={onFechar} aria-label={tx('Fechar')}><X className="w-5 h-5" /></button>
                </div>
                <div className="px-6 py-5 overflow-y-auto custom-scrollbar space-y-4">
                    {graves > 0 && (
                        <button type="button" onClick={onVerPendencias} className="w-full text-left rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 flex items-start gap-2 hover:bg-rose-100 dark:bg-rose-500/10 dark:border-rose-500/30">
                            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                            <span className="text-[12px] font-bold text-rose-800 dark:text-rose-200">{graves === 1 ? tx('1 pessoa está há 7 dias ou mais sem entrar no sistema (ou nunca entrou). Ver em Pendências.') : tx('{qtd} pessoas estão há 7 dias ou mais sem entrar no sistema (ou nunca entraram). Ver em Pendências.', { qtd: graves })}</span>
                        </button>
                    )}
                    <PedidosAcesso pedidos={pedidos} ehAdmin={ehAdmin} unidades={unidades} onDecidido={onDecidido} />
                </div>
                <div className="px-6 py-4 border-t border-slate-200 grid grid-cols-2 gap-3 dark:border-slate-800">
                    <button type="button" onClick={onFechar} className="h-11 rounded-xl bg-slate-100 text-slate-600 text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300">{tx('Depois')}</button>
                    <button type="button" onClick={onVerPendencias} className="h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest">{tx('Abrir Pendências')}</button>
                </div>
            </div>
        </div>
    );
};

export default JanelaPedidosAcesso;
