import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js'; // 🔥 Conexão com o Banco!

const FechamentoCaixa = ({ vendas = [], setVendas, usuarioLogado }) => {
    // -----------------------------------------------------
    // 1. ESTADOS GLOBAIS DA PÁGINA
    // -----------------------------------------------------
    const [subAba, setSubAba] = useState('conferencia'); // 'conferencia' | 'comissoes'

    // Estados da Aba 1: Conferência
    const [confDataInicio, setConfDataInicio] = useState('');
    const [confDataFim, setConfDataFim] = useState('');
    const [confProduto, setConfProduto] = useState('TODOS');
    const [confVendedor, setConfVendedor] = useState('TODOS');
    const [confUnidade, setConfUnidade] = useState('TODOS'); // NOVO FILTRO DE UNIDADE

    // Estados da Aba 2: Comissões
    const [dataInicialInput, setDataInicialInput] = useState('2026-07-01');
    const [dataFinalInput, setDataFinalInput] = useState('2026-07-31');
    const [filtroUnidadeComissao, setFiltroUnidadeComissao] = useState('TODOS'); // NOVO FILTRO DE COMISSÃO
    const [filtroAtivo, setFiltroAtivo] = useState({ inicio: '2026-07-01', fim: '2026-07-31', unidade: 'TODOS' });

    // Verifica se o usuário logado possui permissão corporativa global
    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';

    // -----------------------------------------------------
    // 2. FUNÇÕES AUXILIARES
    // -----------------------------------------------------
    const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const parseCurrency = (str) => parseFloat(str?.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
    const parseDateToISO = (ptBRDate) => {
        if (!ptBRDate) return '';
        const [d, m, y] = ptBRDate.split('/');
        return `${y}-${m}-${d}`;
    };

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [subAba, vendas, confProduto, confVendedor, confUnidade, filtroAtivo, usuarioLogado]);

    // -----------------------------------------------------
    // 3. LÓGICA DA ABA: CONFERÊNCIA
    // -----------------------------------------------------
    const produtosUnicos = ['TODOS', ...new Set(vendas.map(v => v.produto))].filter(Boolean);
    const vendedoresUnicos = ['TODOS', ...new Set(vendas.map(v => v.vendedor))].filter(Boolean);
    const unidadesUnicas = ['TODOS', ...new Set(vendas.map(v => v.unidade))].filter(Boolean); // LISTA DE UNIDADES

    // Filtragem Master da Auditoria
    const vendasParaConferencia = vendas.filter(v => {
        // Filtro de Unidade (Ativo apenas se for Admin/Mentor)
        if (temVisaoGlobal && confUnidade !== 'TODOS' && v.unidade !== confUnidade) return false;

        const passProduto = confProduto === 'TODOS' || v.produto === confProduto;
        const passVendedor = confVendedor === 'TODOS' || v.vendedor === confVendedor;
        
        let passData = true;
        if (confDataInicio || confDataFim) {
            const isoData = parseDateToISO(v.data);
            if (confDataInicio && isoData < confDataInicio) passData = false;
            if (confDataFim && isoData > confDataFim) passData = false;
        }

        return passProduto && passVendedor && passData;
    });

    const valorTotalAConferir = vendasParaConferencia.reduce((acc, v) => acc + parseCurrency(v.valor), 0);

    const toggleConferido = async (id, statusAtual) => {
        const novoStatus = !statusAtual;
        setVendas(vendas.map(v => v.id === id ? { ...v, conferiu: novoStatus } : v));

        const { error } = await supabase
            .from('vendas')
            .update({ conferiu: novoStatus })
            .eq('id', id);

        if (error) {
            console.error("Erro ao atualizar conferência:", error);
            alert("Erro de conexão com o banco. Revertendo alteração.");
            setVendas(vendas.map(v => v.id === id ? { ...v, conferiu: statusAtual } : v));
        }
    };

    const handleObsLocalChange = (id, novaObs) => {
        setVendas(vendas.map(v => v.id === id ? { ...v, observacao: novaObs } : v));
    };

    const handleObsSaveDb = async (id, textoFinal) => {
        await supabase
            .from('vendas')
            .update({ observacao: textoFinal })
            .eq('id', id);
    };

    const marcarTodosConferidos = async () => {
        const idsFiltrados = vendasParaConferencia.map(v => v.id);
        if (idsFiltrados.length === 0) return;

        if (!window.confirm(`Tem certeza que deseja marcar os ${vendasParaConferencia.length} itens listados como CONFERIDOS?`)) return;
        
        setVendas(vendas.map(v => idsFiltrados.includes(v.id) ? { ...v, conferiu: true } : v));

        const { error } = await supabase
            .from('vendas')
            .update({ conferiu: true })
            .in('id', idsFiltrados);

        if (error) {
            console.error("Erro ao aprovar lote:", error);
            alert("Erro ao processar aprovação no servidor.");
        }
    };

    // -----------------------------------------------------
    // 4. LÓGICA DA ABA: COMISSÕES
    // -----------------------------------------------------
    const handleFiltrarComissao = (e) => {
        e.preventDefault();
        setFiltroAtivo({ inicio: dataInicialInput, fim: dataFinalInput, unidade: filtroUnidadeComissao });
    };

    // REGRA DE OURO OPERANDO: Só entra se conferiu for true e bater com os filtros ativos
    const vendasComissionadas = vendas.filter(v => {
        if (!v.conferiu) return false; 
        
        // Filtro de unidade na comissão para visão global
        if (temVisaoGlobal && filtroAtivo.unidade !== 'TODOS' && v.unidade !== filtroAtivo.unidade) return false;

        const isoDataVenda = parseDateToISO(v.data);
        return isoDataVenda >= filtroAtivo.inicio && isoDataVenda <= filtroAtivo.fim;
    });

    let comissaoTotalGeral = 0;
    const relatorioVendedores = {};

    vendasComissionadas.forEach(venda => {
        const valorComissao = parseCurrency(venda.comissao);
        comissaoTotalGeral += valorComissao;

        if (!relatorioVendedores[venda.vendedor]) {
            relatorioVendedores[venda.vendedor] = { vendedor: venda.vendedor, totalComissao: 0, itens: {} };
        }
        
        relatorioVendedores[venda.vendedor].totalComissao += valorComissao;
        const qty = parseInt(venda.quantidade) || 1;
        relatorioVendedores[venda.vendedor].itens[venda.produto] = (relatorioVendedores[venda.vendedor].itens[venda.produto] || 0) + qty;
    });

    const dadosTabelaComissoes = Object.values(relatorioVendedores).map(r => ({
        ...r,
        resumoItens: Object.entries(r.itens).map(([nome, qtd]) => `${qtd}x ${nome}`).join(' ; ')
    })).sort((a, b) => b.totalComissao - a.totalComissao);

    return (
        <div className="space-y-6 animate-[fadeIn_0.4s_ease-out] max-w-[1400px] mx-auto">
            
            {/* CABEÇALHO E SELETOR DE SUB-ABAS */}
            <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl shadow-inner border border-indigo-100">
                        <i data-lucide="wallet" className="w-6 h-6"></i>
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Fechamento / Caixa</h2>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Unidade {usuarioLogado?.unidade}</p>
                    </div>
                </div>

                <div className="flex bg-slate-100 p-1.5 rounded-xl w-full md:w-auto border border-slate-200">
                    <button onClick={() => setSubAba('conferencia')} className={`flex-1 md:w-48 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${subAba === 'conferencia' ? 'bg-white shadow-sm text-indigo-600 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                        <i data-lucide="clipboard-check" className="w-4 h-4"></i> Conferência
                    </button>
                    <button onClick={() => setSubAba('comissoes')} className={`flex-1 md:w-48 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${subAba === 'comissoes' ? 'bg-white shadow-sm text-emerald-600 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                        <i data-lucide="dollar-sign" className="w-4 h-4"></i> Comissões
                    </button>
                </div>
            </div>

            {/* SUB-ABA 1: CONFERÊNCIA DE VENDAS */}
            {subAba === 'conferencia' && (
                <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
                    
                    {/* PAINEL DE FILTROS E VALOR A CONFERIR */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <div className="flex flex-col xl:flex-row justify-between items-end gap-6">
                            
                            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 w-full xl:w-auto flex-1 ${temVisaoGlobal ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Data Início</label>
                                    <input type="date" value={confDataInicio} onChange={(e) => setConfDataInicio(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Data Fim</label>
                                    <input type="date" value={confDataFim} onChange={(e) => setConfDataFim(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Vendedor</label>
                                    <select value={confVendedor} onChange={(e) => setConfVendedor(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer uppercase">
                                        {vendedoresUnicos.map(v => <option key={v} value={v}>{v}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Produto / Plano</label>
                                    <select value={confProduto} onChange={(e) => setConfProduto(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer uppercase">
                                        {produtosUnicos.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>

                                {/* FILTRO EXTRA DE UNIDADE PARA ADMIN/MENTOR */}
                                {temVisaoGlobal && (
                                    <div className="animate-[fadeIn_0.3s_ease-out]">
                                        <label className="block text-xs font-bold text-rose-500 mb-1">Unidade Ref.</label>
                                        <select value={confUnidade} onChange={(e) => setConfUnidade(e.target.value)} className="w-full bg-rose-50/20 border border-rose-200 text-rose-800 rounded-lg px-3 py-2 text-sm font-black focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer uppercase">
                                            {unidadesUnicas.map(u => <option key={u} value={u}>{u === 'TODOS' ? 'TODAS AS 10' : u}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col items-end gap-3 w-full xl:w-auto">
                                <div className="bg-indigo-50 border border-indigo-100 px-6 py-4 rounded-xl flex flex-col items-end shadow-sm w-full sm:w-auto">
                                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Valor a ser conferido</span>
                                    <span className="text-3xl font-black text-indigo-700 tracking-tight leading-none mt-1">{formatMoney(valorTotalAConferir)}</span>
                                </div>
                                
                                {usuarioLogado?.role === 'ADMIN' && (
                                    <button onClick={marcarTodosConferidos} disabled={vendasParaConferencia.length === 0} className="w-full sm:w-auto bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest px-6 py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2">
                                        <i data-lucide="check-square" className="w-4 h-4"></i> Conferir Tudo da Lista
                                    </button>
                                )}
                            </div>

                        </div>
                    </div>
                    
                    {/* Tabela de Conferência */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-max">
                                <thead>
                                    <tr>
                                        <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 bg-slate-50/50">Data</th>
                                        {temVisaoGlobal && <th className="px-5 py-4 text-[10px] font-black text-rose-500 uppercase tracking-widest border-b border-slate-200 bg-rose-50/20">Unidade</th>}
                                        <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 bg-slate-50/50">Matrícula</th>
                                        <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 bg-slate-50/50">Aluno</th>
                                        <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 bg-slate-50/50">Produto</th>
                                        <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 bg-slate-50/50">Vendedor</th>
                                        <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 bg-slate-50/50 text-center">Qtd</th>
                                        <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 bg-slate-50/50 text-right">Valor</th>
                                        <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 bg-slate-50/50 w-48">Observação de Caixa</th>
                                        <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 bg-slate-50/50 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {vendasParaConferencia.length > 0 ? vendasParaConferencia.map((v) => (
                                        <tr key={v.id} className={`transition-colors ${v.conferiu ? 'bg-emerald-50/20' : 'hover:bg-slate-50'}`}>
                                            <td className="px-5 py-4 text-xs font-semibold text-slate-500 whitespace-nowrap">{v.data}</td>
                                            
                                            {/* COLUNA DE UNIDADE EXCLUSIVA DO ADMIN/MENTOR */}
                                            {temVisaoGlobal && (
                                                <td className="px-5 py-4 text-xs font-black text-rose-600 bg-rose-50/5 whitespace-nowrap uppercase">
                                                    {v.unidade || 'MATRIZ'}
                                                </td>
                                            )}

                                            <td className="px-5 py-4 text-xs font-bold text-slate-700">{v.matricula || '-'}</td>
                                            <td className="px-5 py-4 text-xs text-slate-800 font-black uppercase">{v.nome_aluno || v.nome}</td>
                                            <td className="px-5 py-4 text-xs font-bold text-indigo-600 uppercase">{v.produto}</td>
                                            <td className="px-5 py-4 text-xs font-bold text-slate-600 uppercase">{v.vendedor}</td>
                                            <td className="px-5 py-4 text-xs font-black text-slate-700 text-center">{v.quantidade}</td>
                                            <td className="px-5 py-4 text-xs font-black text-slate-800 text-right whitespace-nowrap">{v.valor}</td>
                                            
                                            <td className="px-5 py-2">
                                                <input 
                                                    type="text"
                                                    value={v.observacao || ''}
                                                    onChange={(e) => handleObsLocalChange(v.id, e.target.value)}
                                                    onBlur={(e) => handleObsSaveDb(v.id, e.target.value)}
                                                    placeholder="Digitar nota..."
                                                    className={`w-full text-xs font-medium px-3 py-2 rounded-lg outline-none transition-all ${v.observacao ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-transparent hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-indigo-500 border border-transparent focus:border-indigo-200'}`}
                                                />
                                            </td>
                                            
                                            <td className="px-5 py-4 text-center">
                                                <button 
                                                    onClick={() => toggleConferido(v.id, v.conferiu)}
                                                    className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-1.5 mx-auto ${
                                                        v.conferiu 
                                                        ? 'bg-emerald-500 text-white border border-emerald-600 hover:bg-emerald-600' 
                                                        : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-100 hover:text-slate-600'
                                                    }`}
                                                >
                                                    {v.conferiu ? <><i data-lucide="check" className="w-3.5 h-3.5"></i> Conferido</> : <><i data-lucide="clock" className="w-3.5 h-3.5"></i> Pendente</>}
                                                </button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={temVisaoGlobal ? "10" : "9"} className="text-center py-16 text-slate-400 text-xs font-bold uppercase tracking-widest">Nenhuma venda encontrada no filtro.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* SUB-ABA 2: COMISSÕES CONFERIDAS */}
            {subAba === 'comissoes' && (
                <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
                    
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col xl:flex-row justify-between items-center gap-6">
                        <form onSubmit={handleFiltrarComissao} className="flex flex-col sm:flex-row items-end gap-3 w-full xl:w-auto bg-slate-50 p-3 rounded-2xl border border-slate-100">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Data Inicial</label>
                                <input type="date" value={dataInicialInput} onChange={(e) => setDataInicialInput(e.target.value)} className="w-full sm:w-36 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer shadow-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Data Final</label>
                                <input type="date" value={dataFinalInput} onChange={(e) => setDataFinalInput(e.target.value)} className="w-full sm:w-36 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer shadow-sm" />
                            </div>

                            {/* FILTRO EXTRA DE UNIDADE NAS COMISSÕES PARA ADMIN/MENTOR */}
                            {temVisaoGlobal && (
                                <div className="animate-[fadeIn_0.3s_ease-out]">
                                    <label className="block text-xs font-black text-rose-500 mb-1">Isolar Unidade</label>
                                    <select value={filtroUnidadeComissao} onChange={(e) => setFiltroUnidadeComissao(e.target.value)} className="w-full sm:w-44 bg-white border border-rose-200 text-rose-700 rounded-lg px-3 py-2 text-xs font-black focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer uppercase shadow-sm">
                                        {unidadesUnicas.map(u => <option key={u} value={u}>{u === 'TODOS' ? 'TODAS AS UNIDADES' : u}</option>)}
                                    </select>
                                </div>
                            )}

                            <button type="submit" className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-2 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 h-[38px] text-xs uppercase tracking-widest">
                                <i data-lucide="search" className="w-4 h-4"></i> Filtrar
                            </button>
                        </form>

                        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-4 w-full xl:w-auto shadow-sm">
                            <div className="p-3 bg-emerald-500 text-white rounded-xl shadow-[0_4px_15px_rgba(16,185,129,0.4)]">
                                <i data-lucide="dollar-sign" className="w-6 h-6"></i>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">Comissão Aprovada</p>
                                <p className="text-3xl font-black text-emerald-700 tracking-tight leading-none">{formatMoney(comissaoTotalGeral)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-widest">
                                <i data-lucide="medal" className="w-5 h-5 text-emerald-500"></i> Relatório de Pagamentos
                            </h3>
                            <span className="text-[9px] font-bold text-slate-400 uppercase bg-white border border-slate-200 px-2 py-1 rounded-md">Exibindo apenas vendas conferidas</span>
                        </div>
                        
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white w-64">Vendedor</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 tracking-widest border-b border-slate-100 bg-white w-48 text-right">Comissão Total</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white">Itens Validados (Resumo)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {dadosTabelaComissoes.length > 0 ? dadosTabelaComissoes.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-8 py-5 text-sm font-black text-slate-800 uppercase flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">
                                                    {row.vendedor.charAt(0)}
                                                </div>
                                                {row.vendedor}
                                            </td>
                                            <td className="px-8 py-5 text-sm font-black text-emerald-600 text-right">
                                                {formatMoney(row.totalComissao)}
                                            </td>
                                            <td className="px-8 py-5 text-xs font-bold text-slate-500 uppercase leading-relaxed">
                                                {row.resumoItens}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="3" className="text-center py-16 text-slate-400 font-bold">
                                                <div className="flex flex-col items-center justify-center gap-3 opacity-60">
                                                    <i data-lucide="shield-alert" className="w-10 h-10 text-slate-400"></i>
                                                    <span className="text-xs font-black uppercase tracking-widest">Nenhuma comissão aprovada no período</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FechamentoCaixa;