import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import HubSelecao from './HubSelecao.jsx';
import FormVenda from './FormVenda.jsx';
import FormVisitante from './FormVisitante.jsx';

const Lancamentos = ({ usuarioLogado, unidades = [], onAddMultiple, planos = [], produtos = [], servicos = [], colaboradores = [] }) => {
    const [modalidade, setModalidade] = useState('selecao');

    return (
        <div className="max-w-[1000px] mx-auto animate-[fadeIn_0.3s_ease-out] pb-12">
            
            {/* HEADER GERAL */}
            <div className="flex items-center gap-4 mb-8">
                {modalidade !== 'selecao' && (
                    <button 
                        onClick={() => setModalidade('selecao')} 
                        className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500 hover:text-slate-700 transition-colors shadow-sm"
                        title="Voltar"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                )}
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                        {modalidade === 'selecao' ? 'Central de Lançamentos' : modalidade === 'venda' ? 'Novo Lançamento Financeiro' : 'Cadastro de Lead (CRM)'}
                    </h1>
                    <p className="text-sm font-medium text-slate-500 mt-0.5">
                        {modalidade === 'selecao' ? 'O que vamos registrar agora?' : 'Preencha os dados abaixo com atenção.'}
                    </p>
                </div>
            </div>

            {/* ROTEADOR INTERNO */}
            {modalidade === 'selecao' && <HubSelecao setModalidade={setModalidade} />}
            
            {modalidade === 'venda' && (
                <FormVenda 
                    usuarioLogado={usuarioLogado} 
                    unidades={unidades} 
                    onAddMultiple={onAddMultiple} 
                    planos={planos} 
                    produtos={produtos} 
                    servicos={servicos} 
                    colaboradores={colaboradores} 
                    voltarHub={() => setModalidade('selecao')} 
                />
            )}
            
            {modalidade === 'visitante' && (
                <FormVisitante 
                    usuarioLogado={usuarioLogado} 
                    unidades={unidades} 
                    colaboradores={colaboradores} 
                    voltarHub={() => setModalidade('selecao')} 
                />
            )}

        </div>
    );
};

export default Lancamentos;