import React from 'react';
import { ShoppingCart, UserPlus, ClipboardSignature } from 'lucide-react';

const HubSelecao = ({ setModalidade }) => {
    return (
        // Mudamos para grid-cols-3 para caberem os 3 botões bonitinhos
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 animate-[fadeIn_0.2s_ease-out]">
            
            <button onClick={() => setModalidade('venda')} className="group text-left flex flex-col justify-between bg-white p-10 rounded-[24px] border border-slate-200 shadow-sm hover:shadow-xl hover:border-emerald-400 transition-all duration-300 min-h-[240px] relative overflow-hidden">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-300 border border-emerald-100 shadow-inner">
                    <ShoppingCart className="w-8 h-8" />
                </div>
                <div className="relative z-10">
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Venda Financeira</h2>
                    <p className="text-sm text-slate-500 leading-relaxed">Registrar venda de planos, produtos físicos, diárias ou taxas.</p>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-50 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            </button>

            <button onClick={() => setModalidade('visitante')} className="group text-left flex flex-col justify-between bg-white p-10 rounded-[24px] border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-400 transition-all duration-300 min-h-[240px] relative overflow-hidden">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-300 border border-blue-100 shadow-inner">
                    <UserPlus className="w-8 h-8" />
                </div>
                <div className="relative z-10">
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Novo Visitante</h2>
                    <p className="text-sm text-slate-500 leading-relaxed">Cadastrar uma pessoa que veio conhecer a academia. Vai pro CRM.</p>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-50 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            </button>

            {/* === NOVO BOTÃO DE AVALIAÇÃO FÍSICA === */}
            <button onClick={() => setModalidade('avaliacao')} className="group text-left flex flex-col justify-between bg-white p-10 rounded-[24px] border border-slate-200 shadow-sm hover:shadow-xl hover:border-orange-400 transition-all duration-300 min-h-[240px] relative overflow-hidden">
                <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-300 border border-orange-100 shadow-inner">
                    <ClipboardSignature className="w-8 h-8" />
                </div>
                <div className="relative z-10">
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Avaliação Física</h2>
                    <p className="text-sm text-slate-500 leading-relaxed">Confirmar a execução da avaliação e bioimpedância de um aluno.</p>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-orange-50 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            </button>

        </div>
    );
};

export default HubSelecao;