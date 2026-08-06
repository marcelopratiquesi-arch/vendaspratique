import React, { useState } from 'react';
import HubSelecao from './HubSelecao.jsx';
import FormVenda from './FormVenda.jsx';
import FormVisitante from './FormVisitante.jsx';
import FormAvaliacao from './FormAvaliacao.jsx';
import { ArrowLeft } from 'lucide-react';

const Lancamentos = ({ usuarioLogado, unidades, onAddMultiple, planos, produtos, servicos, colaboradores }) => {
    // Estado que controla qual tela está aparecendo. Padrão é o hub de seleção.
    const [modalidade, setModalidade] = useState('selecao');

    return (
        <div className="w-full max-w-6xl mx-auto">
            
            {/* Botão de voltar (só aparece se não estiver na tela inicial do Hub) */}
            {modalidade !== 'selecao' && (
                <button 
                    onClick={() => setModalidade('selecao')}
                    className="mb-6 flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold uppercase tracking-widest text-[10px] transition-colors bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm w-fit"
                >
                    <ArrowLeft className="w-4 h-4" /> Voltar para Seleção
                </button>
            )}

            {/* ROTEADOR DE TELAS */}
            {modalidade === 'selecao' && (
                <HubSelecao setModalidade={setModalidade} />
            )}

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

            {modalidade === 'avaliacao' && (
                <FormAvaliacao 
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