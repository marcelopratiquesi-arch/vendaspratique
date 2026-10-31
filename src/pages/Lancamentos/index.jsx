import React, { useState, useEffect } from 'react';
import FormVenda from './FormVenda.jsx';
import FormVisitante from './FormVisitante.jsx';
import { ShoppingCart, UserPlus } from 'lucide-react';
import IndicadorEtapas from './IndicadorEtapas.jsx';
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
    onIrParaAluno, // 🔥 Propriedade que recebe o comando do App.jsx para redirecionar
    vendas = [] // vendas já carregadas (só leitura), para o aviso do limite de doses únicas
}) => {
    const [abaAtiva, setAbaAtiva] = useState('venda'); 
    // Etapas da venda (Cliente → Itens → Finalizar), informadas pelo FormVenda
    const [etapasVenda, setEtapasVenda] = useState({ cliente: false, itens: false, finalizado: false });

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

    // Lançar venda um pouco mais larga para os itens caberem numa linha só; o visitante fica como estava
    return (
        <div className={`space-y-4 ${abaAtiva === 'venda' ? 'max-w-6xl' : 'max-w-5xl'} mx-auto animate-[fadeIn_0.2s_ease-out]`}>
            
            {/* Topo: abas à esquerda e etapas da venda à direita (desenho aprovado, 30/10/2026) */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-1 p-1.5 bg-white rounded-2xl border border-[#E4E8F0] w-fit dark:bg-slate-900 dark:border-slate-800" role="tablist">
                    {[
                        ['venda', 'Lançar Venda', ShoppingCart],
                        ['visitante', 'Cadastrar Visitante', UserPlus],
                    ].map(([id, rotulo, Icone]) => {
                        const ativa = abaAtiva === id;
                        return (
                            <button key={id} type="button" role="tab" aria-selected={ativa} onClick={() => handleTrocarAba(id)}
                                className={`h-11 px-4 rounded-xl text-[14px] font-semibold flex items-center gap-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1D4FD8] ${ativa ? 'bg-[#0B1F4B] text-white dark:bg-blue-600' : 'text-[#3B4458] hover:bg-[#F3F5FA] hover:text-[#0F172A] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'}`}>
                                <Icone className="w-4 h-4" />{tx(rotulo)}
                            </button>
                        );
                    })}
                </div>
                {abaAtiva === 'venda' && <IndicadorEtapas {...etapasVenda} />}
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
                        onEtapas={setEtapasVenda}
                        vendas={vendas}
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