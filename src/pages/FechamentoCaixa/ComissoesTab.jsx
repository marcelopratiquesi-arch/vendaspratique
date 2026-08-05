import React, { useState, useEffect } from 'react';
import { formatMoney } from './utils.js';

const ComissoesTab = ({ dadosTabelaComissoes }) => {
    const [expandedRow, setExpandedRow] = useState(null);
    const [copiadoId, setCopiadoId] = useState(null);
    const [copiadoTudo, setCopiadoTudo] = useState(false);
    
    // Motor de Ordenação (Padrão: Maior comissão primeiro)
    const [sortConfig, setSortConfig] = useState({ key: 'totalComissao', direction: 'desc' });

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [dadosTabelaComissoes, sortConfig, expandedRow]);

    const toggleRow = (vendedor) => {
        setExpandedRow(prev => prev === vendedor ? null : vendedor);
    };

    const gerarStringItens = (itensObj) => {
        return Object.entries(itensObj)
            .map(([nome, qtd]) => `${qtd}x ${nome}`)
            .join(' ; ');
    };

    // Ordenação Dinâmica
    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <i data-lucide="chevrons-up-down" className="w-3 h-3 opacity-30"></i>;
        return sortConfig.direction === 'asc' 
            ? <i data-lucide="chevron-up" className="w-3 h-3 text-emerald-600"></i>
            : <i data-lucide="chevron-down" className="w-3 h-3 text-emerald-600"></i>;
    };

    const sortedData = [...dadosTabelaComissoes].sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        
        if (sortConfig.key === 'vendedor') {
            valA = String(valA || '').toLowerCase();
            valB = String(valB || '').toLowerCase();
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // COPIAR INDIVIDUAL (Valor + Descrição)
    const handleCopiarLinha = (vendedor, valorTotalComissao, itensObj, e) => {
        e.stopPropagation(); 
        const textoRaw = gerarStringItens(itensObj);
        const valorSemCifrao = formatMoney(valorTotalComissao).replace('R$', '').trim();
        const textoPlanilha = `${valorSemCifrao}\t${textoRaw}`;
        
        navigator.clipboard.writeText(textoPlanilha).then(() => {
            setCopiadoId(vendedor);
            setTimeout(() => setCopiadoId(null), 2000); 
        });
    };

    // COPIAR TUDO (Copia seguindo a ordem da tela, sem o nome, só Valor e Descrição)
    const handleCopiarTudoExcel = () => {
        let textoExcel = "";
        
        // Passa pelos dados ORDENADOS (se tiver em A-Z, vai em A-Z)
        sortedData.forEach(row => {
            const valorSemCifrao = formatMoney(row.totalComissao).replace('R$', '').trim(); 
            const itensString = gerarStringItens(row.itens);
            // Copia no formato exato que a sua planilha precisa: Valor [TAB] Descrição
            textoExcel += `${valorSemCifrao}\t${itensString}\n`;
        });

        navigator.clipboard.writeText(textoExcel).then(() => {
            setCopiadoTudo(true);
            setTimeout(() => setCopiadoTudo(false), 2000);
        });
    };

    const thClass = "px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50 cursor-pointer hover:bg-slate-100 transition-colors select-none whitespace-nowrap";

    return (
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden animate-[fadeIn_0.3s_ease-out]">
            
            <div className="p-6 border-b border-slate-100 bg-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-widest">
                    <i data-lucide="users" className="w-5 h-5 text-emerald-600"></i> Relatório de Vendedores
                </h3>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Apenas Conferidas</span>
                    </div>

                    {/* BOTÃO COPIAR TUDO EM MASSA */}
                    <button 
                        onClick={handleCopiarTudoExcel}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${copiadoTudo ? 'bg-emerald-500 text-white border border-emerald-600' : 'bg-slate-800 text-white hover:bg-slate-900 border border-slate-800'}`}
                    >
                        {copiadoTudo ? (
                            <><i data-lucide="check-check" className="w-3.5 h-3.5"></i> Tudo Copiado!</>
                        ) : (
                            <><i data-lucide="copy-check" className="w-3.5 h-3.5"></i> Copiar Tudo p/ Planilha</>
                        )}
                    </button>
                </div>
            </div>
            
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-max">
                    <thead>
                        <tr>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50 w-12"></th>
                            
                            {/* COLUNAS CLICÁVEIS PARA ORDENAÇÃO */}
                            <th onClick={() => requestSort('vendedor')} className={`${thClass} w-64`}>
                                <div className="flex items-center gap-2">Consultor {getSortIcon('vendedor')}</div>
                            </th>
                            <th onClick={() => requestSort('totalComissao')} className={`${thClass} w-48`}>
                                <div className="flex items-center justify-end gap-2">Comissão Total {getSortIcon('totalComissao')}</div>
                            </th>
                            
                            <th className="px-8 py-4 text-xs font-semibold text-slate-500 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50">Resumo e Ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {sortedData.length > 0 ? sortedData.map((row, idx) => {
                            const isExpanded = expandedRow === row.vendedor;
                            const stringItens = gerarStringItens(row.itens); 
                            
                            return (
                                <React.Fragment key={idx}>
                                    <tr 
                                        onClick={() => toggleRow(row.vendedor)}
                                        className={`transition-colors cursor-pointer group ${isExpanded ? 'bg-slate-50/80' : 'hover:bg-slate-50/80'}`}
                                    >
                                        <td className="px-6 py-5 align-middle">
                                            <i data-lucide={isExpanded ? "chevron-down" : "chevron-right"} className={`w-5 h-5 transition-colors ${isExpanded ? 'text-slate-600' : 'text-slate-300 group-hover:text-slate-500'}`}></i>
                                        </td>
                                        <td className="px-4 py-5 text-sm font-bold text-slate-800 flex items-center gap-4 align-middle uppercase">
                                            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center text-sm font-black border border-emerald-100 shrink-0">
                                                {row.vendedor.charAt(0)}
                                            </div>
                                            {row.vendedor}
                                        </td>
                                        <td className="px-4 py-5 text-lg font-bold text-emerald-700 text-right align-middle">
                                            {formatMoney(row.totalComissao)}
                                        </td>
                                        
                                        <td className="px-8 py-5 align-middle">
                                            <div className="flex items-center gap-4">
                                                <span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-md border border-slate-200 font-semibold text-sm shrink-0">
                                                    {row.totalItens} itens
                                                </span>
                                                
                                                <div className="flex items-center gap-4 flex-1 max-w-[600px]">
                                                    <span className="text-sm text-slate-500 font-mono truncate flex-1" title={stringItens}>
                                                        {stringItens}
                                                    </span>
                                                    
                                                    {/* BOTÃO DE COPIAR INDIVIDUAL */}
                                                    <button 
                                                        onClick={(e) => handleCopiarLinha(row.vendedor, row.totalComissao, row.itens, e)}
                                                        title="Copiar Valor e Descrição para planilha"
                                                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all border shrink-0 text-xs font-bold uppercase tracking-wider ${copiadoId === row.vendedor ? 'bg-slate-100 text-slate-500 border-slate-300 shadow-inner' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50 shadow-sm'}`}
                                                    >
                                                        {copiadoId === row.vendedor ? (
                                                            <><i data-lucide="check" className="w-4 h-4"></i> Copiado</>
                                                        ) : (
                                                            <><i data-lucide="copy" className="w-4 h-4"></i> Copiar</>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                    
                                    {isExpanded && (
                                        <tr className="bg-slate-50/50 border-b border-slate-100">
                                            <td colSpan="4" className="px-8 py-6">
                                                <div className="pl-14 animate-[fadeIn_0.2s_ease-out]">
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Detalhamento Visual (Sem itens de R$ 0,00)</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {Object.entries(row.itens).sort((a,b) => b[1] - a[1]).map(([nome, qtd]) => (
                                                            <div key={nome} className="flex items-center bg-white border border-slate-200 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
                                                                <span className="px-3 py-2 text-[13px] font-bold text-slate-700 uppercase bg-slate-100/50 border-r border-slate-200">
                                                                    {String(qtd).padStart(2, '0')}x
                                                                </span>
                                                                <span className="px-4 py-2 text-[13px] font-semibold text-slate-600 uppercase">
                                                                    {nome}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        }) : (
                            <tr>
                                <td colSpan="4" className="text-center py-20 text-slate-500 font-medium">
                                    <div className="flex flex-col items-center justify-center gap-3 opacity-60">
                                        <i data-lucide="inbox" className="w-10 h-10 text-slate-400"></i>
                                        <span className="text-xs font-bold uppercase tracking-widest">Nenhuma comissão aprovada neste filtro.</span>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ComissoesTab;