import React, { useState, useEffect } from 'react';
import FormVenda from './FormVenda.jsx';
import FormVisitante from './FormVisitante.jsx';
import { ShoppingCart, UserPlus } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';

const LancamentoVendas = ({ 
    usuarioLogado, 
    unidades, 
    onAddMultiple, 
    planos, 
    produtos, 
    servicos, 
    colaboradores,
    alunoPreSelecionado,
    limparPreSelecao,
    onIrParaAluno // 🔥 Propriedade que recebe o comando do App.jsx para redirecionar
}) => {
    const [abaAtiva, setAbaAtiva] = useState('venda'); 

    useEffect(() => {
        if (alunoPreSelecionado) {
            setAbaAtiva('venda');
        }
    }, [alunoPreSelecionado]);

    const handleTrocarAba = (novaAba) => {
        if (novaAba !== 'venda' && limparPreSelecao) {
            limparPreSelecao();
        }
        setAbaAtiva(novaAba);
    };

    return (
        <div className="space-y-4 max-w-5xl mx-auto animate-[fadeIn_0.2s_ease-out]">
            
            <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl w-fit border border-slate-200 dark:border-slate-700/50 mb-6">
                <button
                    onClick={() => handleTrocarAba('venda')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-bold transition-all outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        abaAtiva === 'venda' 
                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                >
                    <ShoppingCart className="w-4 h-4" />
                    {tx("Lançar Venda")}
                </button>
                
                <button
                    onClick={() => handleTrocarAba('visitante')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-bold transition-all outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        abaAtiva === 'visitante' 
                        ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                >
                    <UserPlus className="w-4 h-4" />
                    {tx("Cadastrar Visitante")}
                </button>
            </div>

            {abaAtiva === 'venda' && (
                <div className="motion-safe:animate-[slideDown_0.2s_ease-out]">
                    <FormVenda 
                        usuarioLogado={usuarioLogado}
                        unidades={unidades}
                        onAddMultiple={onAddMultiple}
                        planos={planos}
                        produtos={produtos}
                        servicos={servicos}
                        colaboradores={colaboradores}
                        alunoPreSelecionado={alunoPreSelecionado} 
                        limparPreSelecao={limparPreSelecao}
                        onIrParaAluno={onIrParaAluno} // 🔥 Repassando o comando para o FormVenda disparar no final
                        voltarHub={() => {
                            if (limparPreSelecao) limparPreSelecao();
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                    />
                </div>
            )}

            {abaAtiva === 'visitante' && (
                <div className="motion-safe:animate-[slideDown_0.2s_ease-out]">
                    <FormVisitante 
                        usuarioLogado={usuarioLogado}
                        unidades={unidades}
                        colaboradores={colaboradores}
                        voltarHub={() => {
                            setAbaAtiva('venda');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default LancamentoVendas;