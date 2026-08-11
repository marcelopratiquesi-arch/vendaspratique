import React, { useState, useEffect } from 'react';
import { formatMoney } from './utils.js'; // Ajuste o caminho se necessário

const ComissoesTab = ({ dadosTabelaComissoes }) => {
    const [expandedRow, setExpandedRow] = useState(null);
    const [copiadoId, setCopiadoId] = useState(null);
    const [copiadoTudo, setCopiadoTudo] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    
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

    // ==========================================
    // EXPORTAÇÃO NÍVEL ENTERPRISE (Google Sheets / Excel)
    // ==========================================
    const handleExportarCSV = () => {
        setIsExporting(true);
        try {
            // Cabeçalhos padronizados
            const cabecalhos = ['Consultor', 'CPF', 'Forma Pagamento', 'Chave/Conta', 'Valor Comissao', 'Detalhes das Vendas'];
            
            // Montagem das Linhas
            const linhas = sortedData.map(row => {
                const itensString = gerarStringItens(row.itens).replace(/"/g, '""'); // Escapa aspas
                const cpfFormatado = row.cpf || 'Nao informado';
                const formaPgto = row.tipo_conta === 'PIX_CPF' ? 'PIX' : (row.tipo_conta === 'INTER' ? 'BANCO INTER' : 'Nao informado');
                const conta = row.tipo_conta === 'INTER' ? row.conta_inter : (row.tipo_conta === 'PIX_CPF' ? cpfFormatado : 'Nao informada');
                const valorFormatado = formatMoney(row.totalComissao).replace('R$', '').trim(); // Deixa o valor limpo

                // Envolve cada campo em aspas duplas para o Excel não quebrar em vírgulas
                return `"${row.vendedor}","${cpfFormatado}","${formaPgto}","${conta}","${valorFormatado}","${itensString}"`;
            });

            // \uFEFF força o Excel a ler em UTF-8 (Preserva acentos como ã, ç)
            const csvContent = "\uFEFF" + cabecalhos.join(',') + '\n' + linhas.join('\n');
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Pagamentos_Comissoes_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Erro ao exportar:", error);
            alert("Erro ao gerar arquivo.");
        } finally {
            setTimeout(() => setIsExporting(false), 1000);
        }
    };

    // COPIAR INDIVIDUAL
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

    // COPIAR TUDO
    const handleCopiarTudoExcel = () => {
        let textoExcel = "";
        sortedData.forEach(row => {
            const valorSemCifrao = formatMoney(row.totalComissao).replace('R$', '').trim(); 
            const itensString = gerarStringItens(row.itens);
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
            
            {/* CABEÇALHO COM BOTÕES DE EXPORTAÇÃO */}
            <div className="p-6 border-b border-slate-100 bg-white flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-widest">
                    <i data-lucide="users" className="w-5 h-5 text-emerald-600"></i> Relatório Financeiro (Fechamento)
                </h3>
                
                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Aprovadas</span>
                    </div>

                    <button 
                        onClick={handleCopiarTudoExcel}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${copiadoTudo ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
                    >
                        {copiadoTudo ? <><i data-lucide="check-check" className="w-3.5 h-3.5"></i> Copiado!</> : <><i data-lucide="copy" className="w-3.5 h-3.5"></i> Copiar Valores</>}
                    </button>

                    {/* ✅ BOTÃO NOVO: EXPORTAR GOOGLE SHEETS / EXCEL */}
                    <button 
                        onClick={handleExportarCSV}
                        disabled={isExporting}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-700 disabled:opacity-70"
                    >
                        {isExporting ? (
                            <><i data-lucide="loader-2" className="w-3.5 h-3.5 animate-spin"></i> Gerando Planilha...</>
                        ) : (
                            <><i data-lucide="file-spreadsheet" className="w-3.5 h-3.5"></i> Baixar Planilha (Sheets/Excel)</>
                        )}
                    </button>
                </div>
            </div>
            
            {/* TABELA PRINCIPAL DE FECHAMENTO */}
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-max">
                    <thead>
                        <tr>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50 w-12"></th>
                            
                            <th onClick={() => requestSort('vendedor')} className={`${thClass} w-56`}>
                                <div className="flex items-center gap-2">Consultor {getSortIcon('vendedor')}</div>
                            </th>
                            
                            <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50">
                                CPF / Documento
                            </th>

                            <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50">
                                Dados Bancários
                            </th>

                            <th onClick={() => requestSort('totalComissao')} className={`${thClass} w-40`}>
                                <div className="flex items-center gap-2">Total a Pagar {getSortIcon('totalComissao')}</div>
                            </th>
                            
                            <th className="px-8 py-4 text-xs font-semibold text-slate-500 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50">Resumo de Vendas</th>
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
                                        
                                        {/* COLUNA: CONSULTOR */}
                                        <td className="px-4 py-5 align-middle">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-black shrink-0">
                                                    {row.vendedor.charAt(0)}
                                                </div>
                                                <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{row.vendedor}</span>
                                            </div>
                                        </td>

                                        {/* COLUNA: CPF */}
                                        <td className="px-4 py-5 align-middle">
                                            <span className="text-[11px] font-mono font-bold text-slate-500 tracking-wider bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                                                {row.cpf || 'Não Cadastrado'}
                                            </span>
                                        </td>

                                        {/* COLUNA: CONTA / BANCO */}
                                        <td className="px-4 py-5 align-middle">
                                            {row.tipo_conta === 'PIX_CPF' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black uppercase tracking-widest shadow-sm">
                                                    <i data-lucide="zap" className="w-3.5 h-3.5"></i> PIX (CPF)
                                                </span>
                                            ) : row.tipo_conta === 'INTER' ? (
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 w-fit rounded bg-orange-50 text-orange-700 border border-orange-200 text-[8px] font-black uppercase tracking-widest">
                                                        <i data-lucide="building" className="w-3 h-3"></i> Banco Inter
                                                    </span>
                                                    <span className="text-[11px] font-mono font-bold text-slate-700">
                                                        {row.conta_inter || 'Sem conta'}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Não Definido</span>
                                            )}
                                        </td>

                                        {/* COLUNA: VALOR TOTAL */}
                                        <td className="px-4 py-5 align-middle">
                                            <span className="text-base font-black text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 shadow-sm">
                                                {formatMoney(row.totalComissao)}
                                            </span>
                                        </td>
                                        
                                        {/* COLUNA: RESUMO & AÇÕES */}
                                        <td className="px-8 py-5 align-middle">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md border border-slate-200 font-bold text-[10px] uppercase tracking-wider shrink-0">
                                                        {row.totalItens} unid
                                                    </span>
                                                    <span className="text-xs text-slate-500 font-medium truncate max-w-[200px] xl:max-w-[300px]" title={stringItens}>
                                                        {stringItens}
                                                    </span>
                                                </div>
                                                
                                                {/* BOTÃO DE COPIAR INDIVIDUAL */}
                                                <button 
                                                    onClick={(e) => handleCopiarLinha(row.vendedor, row.totalComissao, row.itens, e)}
                                                    title="Copiar Valor e Descrição"
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all border shrink-0 text-[10px] font-black uppercase tracking-wider ${copiadoId === row.vendedor ? 'bg-slate-100 text-slate-500 border-slate-300 shadow-inner' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50 shadow-sm'}`}
                                                >
                                                    {copiadoId === row.vendedor ? (
                                                        <><i data-lucide="check" className="w-3.5 h-3.5"></i> Copiado</>
                                                    ) : (
                                                        <><i data-lucide="copy" className="w-3.5 h-3.5"></i> Copiar</>
                                                    )}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    
                                    {/* LINHA EXPANDIDA (DETALHES) */}
                                    {isExpanded && (
                                        <tr className="bg-slate-50/50 border-b border-slate-100">
                                            <td colSpan="6" className="px-8 py-6">
                                                <div className="pl-14 animate-[fadeIn_0.2s_ease-out]">
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Detalhamento Visual</p>
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
                                <td colSpan="6" className="text-center py-20 text-slate-500 font-medium">
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