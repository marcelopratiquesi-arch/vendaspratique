import React, { useState, useEffect } from 'react';
import { formatMoney } from './utils.js'; 
import { Check, Copy, Users, CheckCheck, Loader2, FileSpreadsheet, ChevronDown, ChevronRight, ChevronsUpDown, ChevronUp, Zap, Building, Inbox, CheckCircle2 } from 'lucide-react'; 

// ==========================================
// 🧠 COMPONENTE REUTILIZÁVEL: Botão de Cópia Individual
// ==========================================
const CopyButton = ({ textToCopy, label }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!textToCopy) return;

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(String(textToCopy).trim());
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = String(textToCopy).trim();
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                textArea.style.top = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                textArea.remove();
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Erro na cópia", err);
        }
    };

    if (!textToCopy) return null;

    return (
        <button
            type="button"
            onClick={handleCopy}
            onMouseDown={(e) => e.stopPropagation()} 
            onPointerDown={(e) => e.stopPropagation()} 
            className="p-1.5 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 focus:outline-none rounded-md transition-all flex-shrink-0"
            title={copied ? "Copiado!" : label}
            aria-label={label}
        >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
    );
};

const ComissoesTab = ({ dadosTabelaComissoes }) => {
    const [expandedRow, setExpandedRow] = useState(null);
    const [copiadoId, setCopiadoId] = useState(null);
    const [copiadoTudo, setCopiadoTudo] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    
    const [sortConfig, setSortConfig] = useState({ key: 'totalComissao', direction: 'desc' });

    const toggleRow = (vendedor) => {
        setExpandedRow(prev => prev === vendedor ? null : vendedor);
    };

    const gerarStringItens = (itensObj) => {
        return Object.entries(itensObj)
            .map(([nome, qtd]) => `${qtd}x ${nome}`)
            .join(' ; ');
    };

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <ChevronsUpDown className="w-3 h-3 opacity-30" />;
        return sortConfig.direction === 'asc' 
            ? <ChevronUp className="w-3 h-3 text-emerald-600" />
            : <ChevronDown className="w-3 h-3 text-emerald-600" />;
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

    const handleExportarCSV = () => {
        setIsExporting(true);
        try {
            const cabecalhos = ['Consultor', 'CPF', 'Forma Pagamento', 'Chave/Conta', 'Valor Comissao', 'Detalhes das Vendas'];
            
            const linhas = sortedData.map(row => {
                const itensString = gerarStringItens(row.itens).replace(/"/g, '""'); 
                const cpfFormatado = row.cpf || 'Nao informado';
                const formaPgto = row.tipo_conta === 'PIX_CPF' ? 'PIX' : (row.tipo_conta === 'INTER' ? 'BANCO INTER' : 'Nao informado');
                const conta = row.tipo_conta === 'INTER' ? row.conta_inter : (row.tipo_conta === 'PIX_CPF' ? cpfFormatado : 'Nao informada');
                const valorFormatado = formatMoney(row.totalComissao).replace('R$', '').trim(); 

                return `"${row.vendedor}","${cpfFormatado}","${formaPgto}","${conta}","${valorFormatado}","${itensString}"`;
            });

            // BOM (\uFEFF) para garantir que o Excel abra os acentos em português corretamente
            const csvContent = "\uFEFF" + cabecalhos.join(';') + '\n' + linhas.map(l => l.replace(/,/g, ';')).join('\n'); // Troca a vírgula central pelo ponto e vírgula para não bugar o excel
            
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

    const thClass = "px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50 cursor-pointer hover:bg-slate-100 transition-colors select-none whitespace-nowrap shadow-[0_4px_10px_rgba(0,0,0,0.01)]";

    return (
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden animate-[fadeIn_0.3s_ease-out]">
            
            {/* CABEÇALHO PREMIUM */}
            <div className="p-6 md:p-8 border-b border-slate-100 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-40 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                
                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-[16px] bg-white border border-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800 tracking-tight">
                            Relatório de Comissionamento
                        </h3>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                            Gestão de pagamentos aos consultores
                        </p>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto relative z-10">
                    <div className="flex items-center gap-2 bg-white/60 backdrop-blur-sm border border-emerald-200/50 px-4 py-2.5 rounded-xl shadow-inner">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Contas Aprovadas</span>
                    </div>

                    <button 
                        onClick={handleCopiarTudoExcel}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${copiadoTudo ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
                    >
                        {copiadoTudo ? <><CheckCheck className="w-3.5 h-3.5" /> Copiado!</> : <><Copy className="w-3.5 h-3.5" /> Copiar Valores</>}
                    </button>

                    <button 
                        onClick={handleExportarCSV}
                        disabled={isExporting}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-700 disabled:opacity-70"
                    >
                        {isExporting ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando Planilha...</>
                        ) : (
                            <><FileSpreadsheet className="w-3.5 h-3.5" /> Baixar Planilha</>
                        )}
                    </button>
                </div>
            </div>
            
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-max">
                    <thead>
                        <tr>
                            <th className="px-6 py-5 text-xs font-semibold text-slate-500 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50 w-12 shadow-[0_4px_10px_rgba(0,0,0,0.01)]"></th>
                            
                            <th onClick={() => requestSort('vendedor')} className={`${thClass} w-64`}>
                                <div className="flex items-center gap-2">Consultor Responsável {getSortIcon('vendedor')}</div>
                            </th>
                            
                            <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50 shadow-[0_4px_10px_rgba(0,0,0,0.01)]">
                                Documento / CPF
                            </th>

                            <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50 shadow-[0_4px_10px_rgba(0,0,0,0.01)]">
                                Dados Bancários
                            </th>

                            <th onClick={() => requestSort('totalComissao')} className={`${thClass} w-48`}>
                                <div className="flex items-center gap-2">Total a Pagar {getSortIcon('totalComissao')}</div>
                            </th>
                            
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50 shadow-[0_4px_10px_rgba(0,0,0,0.01)]">Resumo de Vendas</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {sortedData.length > 0 ? sortedData.map((row, idx) => {
                            const isExpanded = expandedRow === row.vendedor;
                            const stringItens = gerarStringItens(row.itens); 
                            
                            const cpfExibicao = row.cpf || '';
                            const temPixCpf = row.tipo_conta === 'PIX_CPF';
                            const temInter = row.tipo_conta === 'INTER';
                            const chaveContaExibicao = temInter ? row.conta_inter : (temPixCpf ? cpfExibicao : '');

                            return (
                                <React.Fragment key={idx}>
                                    <tr 
                                        onClick={() => toggleRow(row.vendedor)}
                                        className={`transition-colors cursor-pointer group ${isExpanded ? 'bg-slate-50/80' : 'hover:bg-slate-50/80'}`}
                                    >
                                        <td className="px-6 py-6 align-middle">
                                            <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${isExpanded ? 'bg-slate-200 text-slate-600' : 'bg-slate-100 text-slate-300 group-hover:text-slate-500'}`}>
                                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                            </div>
                                        </td>
                                        
                                        {/* COLUNA: CONSULTOR */}
                                        <td className="px-4 py-6 align-middle">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-inner">
                                                    {row.vendedor.charAt(0)}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{row.vendedor}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Time de Vendas</span>
                                                </div>
                                                <CopyButton textToCopy={row.vendedor} label={`Copiar nome de ${row.vendedor}`} />
                                            </div>
                                        </td>

                                        {/* COLUNA: CPF */}
                                        <td className="px-4 py-6 align-middle">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[11px] font-mono font-bold text-slate-600 tracking-wider bg-slate-100/80 px-2.5 py-1.5 rounded-md border border-slate-200">
                                                    {cpfExibicao || 'Não Cadastrado'}
                                                </span>
                                                {cpfExibicao && <CopyButton textToCopy={cpfExibicao} label={`Copiar CPF de ${row.vendedor}`} />}
                                            </div>
                                        </td>

                                        {/* COLUNA: CONTA / BANCO */}
                                        <td className="px-4 py-6 align-middle">
                                            {temPixCpf ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black uppercase tracking-widest shadow-sm">
                                                        <Zap className="w-3.5 h-3.5" /> PIX (CPF)
                                                    </span>
                                                    {chaveContaExibicao && <CopyButton textToCopy={chaveContaExibicao} label={`Copiar chave PIX de ${row.vendedor}`} />}
                                                </div>
                                            ) : temInter ? (
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 w-fit rounded bg-orange-50 text-orange-700 border border-orange-200 text-[8px] font-black uppercase tracking-widest">
                                                            <Building className="w-3 h-3" /> Banco Inter
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[11px] font-mono font-bold text-slate-700">
                                                            {chaveContaExibicao || 'Sem conta'}
                                                        </span>
                                                        {chaveContaExibicao && <CopyButton textToCopy={chaveContaExibicao} label={`Copiar dados bancários de ${row.vendedor}`} />}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded border border-slate-100">Não Definido</span>
                                            )}
                                        </td>

                                        {/* COLUNA: VALOR TOTAL */}
                                        <td className="px-4 py-6 align-middle bg-emerald-50/10 border-l border-r border-slate-50">
                                            <div className="flex items-center justify-start gap-2">
                                                <span className="text-xl font-black text-emerald-700 tracking-tight">
                                                    {formatMoney(row.totalComissao)}
                                                </span>
                                                <CopyButton textToCopy={formatMoney(row.totalComissao)} label={`Copiar comissão de ${row.vendedor}`} />
                                            </div>
                                        </td>
                                        
                                        {/* COLUNA: RESUMO & AÇÕES */}
                                        <td className="px-8 py-6 align-middle">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <span className="bg-white text-slate-600 px-2.5 py-1 rounded-md border border-slate-200 shadow-sm font-black text-[10px] uppercase tracking-wider shrink-0 flex items-center gap-1.5">
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> {row.totalItens} unid
                                                    </span>
                                                    <span className="text-xs text-slate-500 font-medium truncate max-w-[200px] xl:max-w-[300px]" title={stringItens}>
                                                        {stringItens}
                                                    </span>
                                                    <CopyButton textToCopy={stringItens} label={`Copiar resumo de vendas de ${row.vendedor}`} />
                                                </div>
                                                
                                                <button 
                                                    onClick={(e) => handleCopiarLinha(row.vendedor, row.totalComissao, row.itens, e)}
                                                    title="Copiar Relatório do Consultor para Enviar"
                                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all border shrink-0 text-[10px] font-black uppercase tracking-wider ${copiadoId === row.vendedor ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-inner' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50 shadow-sm'}`}
                                                >
                                                    {copiadoId === row.vendedor ? (
                                                        <><Check className="w-3.5 h-3.5" /> Copiado</>
                                                    ) : (
                                                        <><Copy className="w-3.5 h-3.5" /> Copiar Tudo</>
                                                    )}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    
                                    {/* LINHA EXPANDIDA (DETALHES) */}
                                    {isExpanded && (
                                        <tr className="bg-slate-50/50 border-b border-slate-100">
                                            <td colSpan="6" className="px-8 py-8">
                                                <div className="pl-14 animate-[fadeIn_0.2s_ease-out]">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                        <CheckCircle2 className="w-4 h-4 text-slate-300" /> Detalhamento Operacional da Venda
                                                    </p>
                                                    <div className="flex flex-wrap gap-3">
                                                        {Object.entries(row.itens).sort((a,b) => b[1] - a[1]).map(([nome, qtd]) => (
                                                            <div key={nome} className="flex items-center bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden hover:border-slate-300 transition-colors">
                                                                <span className="px-4 py-3 text-sm font-black text-slate-700 bg-slate-100/50 border-r border-slate-200">
                                                                    {String(qtd).padStart(2, '0')}x
                                                                </span>
                                                                <div className="px-4 py-2 flex flex-col justify-center">
                                                                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-wide">
                                                                        {nome}
                                                                    </span>
                                                                </div>
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
                                <td colSpan="6" className="text-center py-24 text-slate-500 font-medium">
                                    <div className="flex flex-col items-center justify-center gap-4 opacity-70">
                                        <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-200 border-dashed flex items-center justify-center">
                                            <Inbox className="w-6 h-6 text-slate-400" />
                                        </div>
                                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Nenhuma comissão aprovada neste filtro.</span>
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