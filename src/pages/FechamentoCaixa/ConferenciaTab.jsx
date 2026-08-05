import React, { useState, useRef, useEffect } from 'react';
import { formatMoney, formatDataBR, formatarDataHora } from './utils.js';

const ConferenciaTab = ({
    vendasParaConferencia, temVisaoGlobal, colunasVisiveis,
    confVendedor, setConfVendedor, vendedoresUnicos,
    confProduto, setConfProduto, produtosUnicos,
    valorTotalAConferir, marcarTodosConferidos, usuarioLogado,
    toggleConferido, handleObsLocalChange, handleObsSaveDb
}) => {
    // 1. MOTOR DE ORDENAÇÃO (A-Z, Z-A, Crescente, Decrescente)
    const [sortConfig, setSortConfig] = useState({ key: 'data', direction: 'desc' });

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <i data-lucide="chevrons-up-down" className="w-3 h-3 opacity-30"></i>;
        return sortConfig.direction === 'asc' 
            ? <i data-lucide="chevron-up" className="w-3 h-3 text-indigo-600"></i>
            : <i data-lucide="chevron-down" className="w-3 h-3 text-indigo-600"></i>;
    };

    const sortedVendas = [...vendasParaConferencia].sort((a, b) => {
        if (!sortConfig.key) return 0;
        
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];

        // Normalização matemática/textual para ordenação perfeita
        if (sortConfig.key === 'data') {
            valA = new Date(valA).getTime() || 0;
            valB = new Date(valB).getTime() || 0;
        } else if (sortConfig.key === 'valor') {
            valA = Number(valA) || 0;
            valB = Number(valB) || 0;
        } else if (sortConfig.key === 'quantidade') {
            valA = Number(valA) || 0;
            valB = Number(valB) || 0;
        } else if (sortConfig.key === 'nome') {
            valA = String(a.nome_aluno || a.nome || '').toLowerCase();
            valB = String(b.nome_aluno || b.nome || '').toLowerCase();
        } else if (sortConfig.key === 'conferiu') {
            valA = a.conferiu ? 1 : 0;
            valB = b.conferiu ? 1 : 0;
        } else if (sortConfig.key === 'conferido_em') {
            valA = new Date(a.conferido_em).getTime() || 0;
            valB = new Date(b.conferido_em).getTime() || 0;
        } else {
            valA = String(valA || '').toLowerCase();
            valB = String(valB || '').toLowerCase();
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // 2. MOTOR DE DRAG-TO-SCROLL (MÃOZINHA)
    const scrollRef = useRef(null);
    const isDragging = useRef(false);
    const startX = useRef(0);
    const scrollLeft = useRef(0);

    const onMouseDown = (e) => {
        // Ignora o arraste se clicar em inputs ou botões
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.no-drag')) return;
        isDragging.current = true;
        scrollRef.current.classList.add('cursor-grabbing');
        scrollRef.current.classList.remove('cursor-grab');
        startX.current = e.pageX - scrollRef.current.offsetLeft;
        scrollLeft.current = scrollRef.current.scrollLeft;
    };

    const onMouseLeaveOrUp = () => {
        isDragging.current = false;
        if (scrollRef.current) {
            scrollRef.current.classList.remove('cursor-grabbing');
            scrollRef.current.classList.add('cursor-grab');
        }
    };

    const onMouseMove = (e) => {
        if (!isDragging.current) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - startX.current) * 1.5; // Velocidade do arraste
        scrollRef.current.scrollLeft = scrollLeft.current - walk;
    };

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [sortedVendas, sortConfig]);

    const thClass = "px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-100 transition-colors select-none group whitespace-nowrap";

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
            
            {/* FILTROS ESPECÍFICOS DE VENDEDOR E PRODUTO */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex flex-col xl:flex-row justify-between items-end gap-6">
                    <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto flex-1">
                        <div className="flex-1 max-w-sm">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Vendedor Específico</label>
                            <select value={confVendedor} onChange={(e) => setConfVendedor(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer uppercase">
                                {vendedoresUnicos.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </div>
                        <div className="flex-1 max-w-sm">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Produto / Plano Específico</label>
                            <select value={confProduto} onChange={(e) => setConfProduto(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer uppercase">
                                {produtosUnicos.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-3 w-full xl:w-auto">
                        <div className="bg-indigo-50 border border-indigo-100 px-6 py-4 rounded-2xl flex flex-col items-end shadow-sm w-full sm:w-auto">
                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Valor a ser conferido</span>
                            <span className="text-3xl font-black text-indigo-700 tracking-tight leading-none mt-1">{formatMoney(valorTotalAConferir)}</span>
                        </div>
                        {usuarioLogado?.role === 'ADMIN' && (
                            <button onClick={marcarTodosConferidos} disabled={vendasParaConferencia.length === 0} className="w-full sm:w-auto bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest px-6 py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2">
                                <i data-lucide="check-square" className="w-4 h-4"></i> Conferir Tudo
                            </button>
                        )}
                    </div>
                </div>
            </div>
            
            {/* TABELA COM MÃOZINHA E ORDENAÇÃO */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div 
                    className="overflow-x-auto custom-scrollbar cursor-grab"
                    ref={scrollRef}
                    onMouseDown={onMouseDown}
                    onMouseLeave={onMouseLeaveOrUp}
                    onMouseUp={onMouseLeaveOrUp}
                    onMouseMove={onMouseMove}
                >
                    <table className="w-full text-left border-collapse min-w-max">
                        <thead>
                            <tr>
                                <th onClick={() => requestSort('data')} className={thClass}>
                                    <div className="flex items-center gap-1.5">Data {getSortIcon('data')}</div>
                                </th>
                                {temVisaoGlobal && (
                                    <th onClick={() => requestSort('unidade')} className={`${thClass} !bg-rose-50/20 !text-rose-500`}>
                                        <div className="flex items-center gap-1.5">Unidade {getSortIcon('unidade')}</div>
                                    </th>
                                )}
                                <th onClick={() => requestSort('matricula')} className={thClass}>
                                    <div className="flex items-center gap-1.5">Matrícula {getSortIcon('matricula')}</div>
                                </th>
                                <th onClick={() => requestSort('nome')} className={thClass}>
                                    <div className="flex items-center gap-1.5">Aluno {getSortIcon('nome')}</div>
                                </th>
                                <th onClick={() => requestSort('produto')} className={thClass}>
                                    <div className="flex items-center gap-1.5">Produto {getSortIcon('produto')}</div>
                                </th>
                                <th onClick={() => requestSort('vendedor')} className={thClass}>
                                    <div className="flex items-center gap-1.5">Vendedor {getSortIcon('vendedor')}</div>
                                </th>
                                <th onClick={() => requestSort('quantidade')} className={`${thClass} text-center`}>
                                    <div className="flex items-center justify-center gap-1.5">Qtd {getSortIcon('quantidade')}</div>
                                </th>
                                <th onClick={() => requestSort('valor')} className={`${thClass} text-right`}>
                                    <div className="flex items-center justify-end gap-1.5">Valor {getSortIcon('valor')}</div>
                                </th>
                                {/* Coluna sem ordenação (texto livre) */}
                                <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 bg-slate-50/50 w-48 whitespace-nowrap">
                                    Observação de Caixa
                                </th>
                                <th onClick={() => requestSort('conferiu')} className={`${thClass} text-center`}>
                                    <div className="flex items-center justify-center gap-1.5">Status {getSortIcon('conferiu')}</div>
                                </th>
                                <th onClick={() => requestSort('conferido_em')} className={`${thClass} !bg-indigo-50/30 !text-indigo-500 text-center`}>
                                    <div className="flex items-center justify-center gap-1.5">Auditoria {getSortIcon('conferido_em')}</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {sortedVendas.length > 0 ? sortedVendas.map((v) => (
                                <tr key={v.id} className={`transition-colors ${v.conferiu ? 'bg-emerald-50/20' : 'hover:bg-slate-50'}`}>
                                    <td className="px-5 py-4 text-xs font-semibold text-slate-500 whitespace-nowrap align-middle">{formatDataBR(v.data)}</td>
                                    {temVisaoGlobal && <td className="px-5 py-4 text-xs font-black text-rose-600 bg-rose-50/5 whitespace-nowrap uppercase align-middle">{v.unidade || 'MATRIZ'}</td>}
                                    <td className="px-5 py-4 text-xs font-bold text-slate-700 align-middle">{v.matricula || '-'}</td>
                                    <td className="px-5 py-4 text-xs text-slate-800 font-black uppercase align-middle max-w-[150px] truncate" title={v.nome_aluno || v.nome}>{v.nome_aluno || v.nome}</td>
                                    <td className="px-5 py-4 text-xs font-bold text-indigo-600 uppercase align-middle whitespace-nowrap">{v.produto}</td>
                                    <td className="px-5 py-4 text-xs font-bold text-slate-600 uppercase align-middle whitespace-nowrap">{v.vendedor}</td>
                                    <td className="px-5 py-4 text-xs font-black text-slate-700 text-center align-middle">{v.quantidade}</td>
                                    <td className="px-5 py-4 text-xs font-black text-slate-800 text-right whitespace-nowrap align-middle">{formatMoney(v.valor)}</td>
                                    
                                    <td className="px-5 py-2 align-middle no-drag">
                                        <input 
                                            type="text"
                                            value={v.observacao || ''}
                                            onChange={(e) => handleObsLocalChange(v.id, e.target.value)}
                                            onBlur={(e) => handleObsSaveDb(v.id, e.target.value)}
                                            placeholder="Digitar nota..."
                                            className={`w-full text-xs font-medium px-3 py-2 rounded-lg outline-none transition-all ${v.observacao ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-transparent hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-indigo-500 border border-transparent focus:border-indigo-200'}`}
                                        />
                                    </td>
                                    
                                    <td className="px-5 py-4 text-center align-middle no-drag">
                                        <button 
                                            onClick={() => toggleConferido(v.id, v.conferiu)}
                                            className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-1.5 w-24 mx-auto ${v.conferiu ? 'bg-emerald-500 text-white border border-emerald-600 hover:bg-emerald-600' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-100 hover:text-slate-600'}`}
                                        >
                                            {v.conferiu ? <><i data-lucide="check" className="w-3 h-3"></i> OK</> : <><i data-lucide="clock" className="w-3 h-3"></i> Pendente</>}
                                        </button>
                                    </td>
                                    
                                    <td className="px-5 py-4 text-center align-middle">
                                        {v.conferiu && v.conferido_por ? (
                                            <div className="flex flex-col items-center justify-center bg-white border border-indigo-100 px-2 py-1.5 rounded-lg shadow-sm min-w-[100px]">
                                                <span className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-1"><i data-lucide="shield-check" className="w-3 h-3"></i> {v.conferido_por.split(' ')[0]}</span>
                                                <span className="text-[9px] font-bold text-slate-400 mt-0.5 whitespace-nowrap">{formatarDataHora(v.conferido_em)}</span>
                                            </div>
                                        ) : <span className="text-slate-300">-</span>}
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={colunasVisiveis} className="text-center py-16 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Nenhuma venda encontrada no filtro.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ConferenciaTab;