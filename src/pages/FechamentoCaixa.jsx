import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js'; 

const FechamentoCaixa = ({ vendas = [], setVendas, usuarioLogado }) => {
    // -----------------------------------------------------
    // 1. ESTADOS GLOBAIS DA PÁGINA
    // -----------------------------------------------------
    const [subAba, setSubAba] = useState('conferencia'); // 'conferencia' | 'comissoes' | 'geral' | 'auditoria'

    // Estados da Aba 1: Conferência
    const [confDataInicio, setConfDataInicio] = useState('');
    const [confDataFim, setConfDataFim] = useState('');
    const [confProduto, setConfProduto] = useState('TODOS');
    const [confVendedor, setConfVendedor] = useState('TODOS');
    const [confUnidade, setConfUnidade] = useState('TODOS'); 

    // Estados da Aba 2 (Comissões) e Aba 4 (Auditoria) - Filtros de Data Compartilhados/Clonados
    const [tipoFiltroAvancado, setTipoFiltroAvancado] = useState('mes'); // 'mes', 'periodo', 'dia'
    const [filtroMes, setFiltroMes] = useState(new Date().getMonth() + 1 < 10 ? `0${new Date().getMonth() + 1}` : `${new Date().getMonth() + 1}`);
    const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
    const [dataInicialInput, setDataInicialInput] = useState('');
    const [dataFinalInput, setDataFinalInput] = useState('');
    const [filtroDia, setFiltroDia] = useState(new Date().toISOString().split('T')[0]);
    const [filtroUnidadeIsolada, setFiltroUnidadeIsolada] = useState('TODOS'); 

    // Controle de Acesso
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

    const formatarDataHora = (isoString) => {
        if (!isoString) return '';
        const data = new Date(isoString);
        return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' às ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [subAba, vendas, confProduto, confVendedor, confUnidade, tipoFiltroAvancado, usuarioLogado]);

    // Listas Universais
    const produtosUnicos = ['TODOS', ...new Set(vendas.map(v => v.produto))].filter(Boolean);
    const vendedoresUnicos = ['TODOS', ...new Set(vendas.map(v => v.vendedor))].filter(Boolean);
    const unidadesUnicas = ['TODOS', ...new Set(vendas.map(v => v.unidade))].filter(Boolean); 
    const anosUnicos = [...new Set(vendas.map(v => v.data?.split('/')[2]))].filter(Boolean).sort((a,b) => b-a);
    if(anosUnicos.length === 0) anosUnicos.push(new Date().getFullYear().toString());

    const mesesLista = [
        { val: '01', label: '01 - Janeiro' }, { val: '02', label: '02 - Fevereiro' },
        { val: '03', label: '03 - Março' }, { val: '04', label: '04 - Abril' }, { val: '05', label: '05 - Maio' },
        { val: '06', label: '06 - Junho' }, { val: '07', label: '07 - Julho' }, { val: '08', label: '08 - Agosto' },
        { val: '09', label: '09 - Setembro' }, { val: '10', label: '10 - Outubro' }, { val: '11', label: '11 - Novembro' },
        { val: '12', label: '12 - Dezembro' }
    ];

    // -----------------------------------------------------
    // 3. LÓGICA DA ABA 1: CONFERÊNCIA
    // -----------------------------------------------------
    const vendasParaConferencia = vendas.filter(v => {
        if (temVisaoGlobal && confUnidade !== 'TODOS' && v.unidade !== confUnidade) return false;
        if (!temVisaoGlobal && v.unidade !== usuarioLogado?.unidade) return false;

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
        const validadorNome = novoStatus ? usuarioLogado.nome : null;
        const validadorData = novoStatus ? new Date().toISOString() : null;

        setVendas(vendas.map(v => v.id === id ? { ...v, conferiu: novoStatus, conferido_por: validadorNome, conferido_em: validadorData } : v));

        const { error } = await supabase.from('vendas').update({ conferiu: novoStatus, conferido_por: validadorNome, conferido_em: validadorData }).eq('id', id);

        if (error) {
            console.error("Erro ao atualizar:", error);
            alert("Erro de conexão. Revertendo alteração.");
            setVendas(vendas.map(v => v.id === id ? { ...v, conferiu: statusAtual } : v));
        }
    };

    const handleObsLocalChange = (id, novaObs) => setVendas(vendas.map(v => v.id === id ? { ...v, observacao: novaObs } : v));
    const handleObsSaveDb = async (id, textoFinal) => await supabase.from('vendas').update({ observacao: textoFinal }).eq('id', id);

    const marcarTodosConferidos = async () => {
        const idsFiltrados = vendasParaConferencia.map(v => v.id);
        if (idsFiltrados.length === 0) return;
        if (!window.confirm(`Marcar os ${vendasParaConferencia.length} itens como CONFERIDOS?`)) return;
        
        const validadorNome = usuarioLogado.nome;
        const validadorData = new Date().toISOString();

        setVendas(vendas.map(v => idsFiltrados.includes(v.id) ? { ...v, conferiu: true, conferido_por: validadorNome, conferido_em: validadorData } : v));

        await supabase.from('vendas').update({ conferiu: true, conferido_por: validadorNome, conferido_em: validadorData }).in('id', idsFiltrados);
    };

    // -----------------------------------------------------
    // 4. LÓGICA DA ABA 2: COMISSÕES E ABA 4: AUDITORIA (MOTOR DE DATA)
    // -----------------------------------------------------
    const getVendasFiltradasDataAvancada = () => {
        return vendas.filter(v => {
            if (!v.data) return false;
            const isoDataVenda = parseDateToISO(v.data);

            if (tipoFiltroAvancado === 'dia') {
                return isoDataVenda === filtroDia;
            } else if (tipoFiltroAvancado === 'mes') {
                return v.data.endsWith(`${filtroMes}/${filtroAno}`);
            } else {
                if (dataInicialInput && isoDataVenda < dataInicialInput) return false;
                if (dataFinalInput && isoDataVenda > dataFinalInput) return false;
                return true;
            }
        });
    };

    const vendasDataAvancada = getVendasFiltradasDataAvancada();

    // ---- PROCESSAMENTO DAS COMISSÕES (ABA 2) ----
    const vendasComissionadas = vendasDataAvancada.filter(v => {
        if (!v.conferiu) return false; 
        if (temVisaoGlobal && filtroUnidadeIsolada !== 'TODOS' && v.unidade !== filtroUnidadeIsolada) return false;
        if (!temVisaoGlobal && v.unidade !== usuarioLogado?.unidade) return false;
        return true;
    });

    let comissaoTotalGeral = 0;
    const relatorioVendedores = {};

    vendasComissionadas.forEach(venda => {
        const valorComissao = parseCurrency(venda.valor);
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


    // ---- PROCESSAMENTO DA AUDITORIA (ABA 4) ----
    const relatorioAuditoria = {};
    let totalAuditoriaRegistrados = 0;
    let totalAuditoriaConferidos = 0;
    let totalAuditoriaPendentes = 0;

    vendasDataAvancada.forEach(v => {
        const unid = v.unidade || 'MATRIZ';
        // Se houver filtro de unidade isolada, aplica. Caso contrário, mostra todas.
        if (filtroUnidadeIsolada !== 'TODOS' && unid !== filtroUnidadeIsolada) return;

        if (!relatorioAuditoria[unid]) {
            relatorioAuditoria[unid] = { unidade: unid, registrados: 0, conferidos: 0, pendentes: 0 };
        }
        
        relatorioAuditoria[unid].registrados++;
        totalAuditoriaRegistrados++;

        if (v.conferiu) {
            relatorioAuditoria[unid].conferidos++;
            totalAuditoriaConferidos++;
        } else {
            relatorioAuditoria[unid].pendentes++;
            totalAuditoriaPendentes++;
        }
    });

    // Ordena mostrando primeiro quem tem mais pendências
    const dadosTabelaAuditoria = Object.values(relatorioAuditoria).sort((a, b) => b.pendentes - a.pendentes);


    // -----------------------------------------------------
    // 5. LÓGICA DA ABA 3: GERAL DE COMISSÕES (C-LEVEL DASHBOARD)
    // -----------------------------------------------------
    const getUltimos6Meses = () => {
        const mesesH = [];
        const hoje = new Date();
        for(let i=0; i<6; i++) {
            const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
            const mesStr = String(d.getMonth() + 1).padStart(2, '0');
            const anoStr = d.getFullYear();
            mesesH.push({ label: `${mesStr}/${anoStr}`, mes: mesStr, ano: anoStr.toString() });
        }
        return mesesH; 
    };
    const ultimos6Meses = getUltimos6Meses();
    const mesAtualLabel = ultimos6Meses[0].label; 

    const unidadesParaAnalisar = temVisaoGlobal 
        ? unidadesUnicas.filter(u => u !== 'TODOS') 
        : [usuarioLogado?.unidade].filter(Boolean);

    const visaoGeralUnidades = unidadesParaAnalisar.map(unidade => {
        const vendasDaUnidade = vendas.filter(v => v.unidade === unidade && v.conferiu);
        const historico = ultimos6Meses.map(m => {
            const totalDoMes = vendasDaUnidade
                .filter(v => v.data?.endsWith(m.label))
                .reduce((acc, v) => acc + parseCurrency(v.valor), 0);
            return { label: m.label, total: totalDoMes };
        }).reverse(); 

        const totalAtual = historico[historico.length - 1].total; 
        return { unidade, totalAtual, historico };
    }).sort((a, b) => b.totalAtual - a.totalAtual);

    const totalGeralRedeAtual = visaoGeralUnidades.reduce((acc, u) => acc + u.totalAtual, 0);


    // =========================================================================
    // COMPONENTE VISUAL - RENDER
    // =========================================================================
    return (
        <div className="space-y-6 animate-[fadeIn_0.4s_ease-out] max-w-[1400px] mx-auto">
            
            {/* CABEÇALHO E SELETOR DE SUB-ABAS */}
            <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-2xl shadow-inner border ${subAba === 'geral' ? 'bg-violet-50 text-violet-600 border-violet-100' : subAba === 'auditoria' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                        <i data-lucide={subAba === 'geral' ? "pie-chart" : subAba === 'auditoria' ? "shield-alert" : "wallet"} className="w-6 h-6"></i>
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Fechamento & Auditoria</h2>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Unidade {usuarioLogado?.unidade}</p>
                    </div>
                </div>

                <div className="flex bg-slate-100 p-1.5 rounded-xl w-full md:w-auto border border-slate-200 overflow-x-auto custom-scrollbar">
                    <button onClick={() => setSubAba('conferencia')} className={`flex-1 md:w-36 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${subAba === 'conferencia' ? 'bg-white shadow-sm text-indigo-600 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                        <i data-lucide="clipboard-check" className="w-3.5 h-3.5"></i> Conferência
                    </button>
                    <button onClick={() => setSubAba('comissoes')} className={`flex-1 md:w-36 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${subAba === 'comissoes' ? 'bg-white shadow-sm text-emerald-600 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                        <i data-lucide="users" className="w-3.5 h-3.5"></i> Comissões
                    </button>
                    <button onClick={() => setSubAba('geral')} className={`flex-1 md:w-36 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${subAba === 'geral' ? 'bg-white shadow-sm text-violet-600 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                        <i data-lucide="bar-chart-2" className="w-3.5 h-3.5"></i> Visão Geral
                    </button>
                    
                    {temVisaoGlobal && (
                        <button onClick={() => setSubAba('auditoria')} className={`flex-1 md:w-36 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${subAba === 'auditoria' ? 'bg-white shadow-sm text-rose-600 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                            <i data-lucide="shield-alert" className="w-3.5 h-3.5"></i> Auditoria
                        </button>
                    )}
                </div>
            </div>

            {/* ========================================================================= */}
            {/* SUB-ABA 1: CONFERÊNCIA DE VENDAS */}
            {/* ========================================================================= */}
            {subAba === 'conferencia' && (
                <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
                    
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <div className="flex flex-col xl:flex-row justify-between items-end gap-6">
                            
                            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 w-full xl:w-auto flex-1 ${temVisaoGlobal ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Data Início</label>
                                    <input type="date" value={confDataInicio} onChange={(e) => setConfDataInicio(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Data Fim</label>
                                    <input type="date" value={confDataFim} onChange={(e) => setConfDataFim(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Vendedor</label>
                                    <select value={confVendedor} onChange={(e) => setConfVendedor(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer uppercase">
                                        {vendedoresUnicos.map(v => <option key={v} value={v}>{v}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Produto / Plano</label>
                                    <select value={confProduto} onChange={(e) => setConfProduto(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer uppercase">
                                        {produtosUnicos.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>

                                {temVisaoGlobal && (
                                    <div className="animate-[fadeIn_0.3s_ease-out]">
                                        <label className="block text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1.5 ml-1">Unidade Ref.</label>
                                        <select value={confUnidade} onChange={(e) => setConfUnidade(e.target.value)} className="w-full bg-rose-50/20 border border-rose-200 text-rose-800 rounded-xl px-3 py-2 text-xs font-black focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer uppercase">
                                            {unidadesUnicas.map(u => <option key={u} value={u}>{u === 'TODOS' ? 'TODAS AS 10' : u}</option>)}
                                        </select>
                                    </div>
                                )}
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
                    
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
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
                                        <th className="px-5 py-4 text-[10px] font-black text-indigo-500 uppercase tracking-widest border-b border-slate-200 bg-indigo-50/30 text-center">Auditoria</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {vendasParaConferencia.length > 0 ? vendasParaConferencia.map((v) => (
                                        <tr key={v.id} className={`transition-colors ${v.conferiu ? 'bg-emerald-50/20' : 'hover:bg-slate-50'}`}>
                                            <td className="px-5 py-4 text-xs font-semibold text-slate-500 whitespace-nowrap align-middle">{v.data}</td>
                                            {temVisaoGlobal && <td className="px-5 py-4 text-xs font-black text-rose-600 bg-rose-50/5 whitespace-nowrap uppercase align-middle">{v.unidade || 'MATRIZ'}</td>}
                                            <td className="px-5 py-4 text-xs font-bold text-slate-700 align-middle">{v.matricula || '-'}</td>
                                            <td className="px-5 py-4 text-xs text-slate-800 font-black uppercase align-middle max-w-[150px] truncate" title={v.nome_aluno || v.nome}>{v.nome_aluno || v.nome}</td>
                                            <td className="px-5 py-4 text-xs font-bold text-indigo-600 uppercase align-middle">{v.produto}</td>
                                            <td className="px-5 py-4 text-xs font-bold text-slate-600 uppercase align-middle">{v.vendedor}</td>
                                            <td className="px-5 py-4 text-xs font-black text-slate-700 text-center align-middle">{v.quantidade}</td>
                                            <td className="px-5 py-4 text-xs font-black text-slate-800 text-right whitespace-nowrap align-middle">{v.valor}</td>
                                            <td className="px-5 py-2 align-middle">
                                                <input 
                                                    type="text"
                                                    value={v.observacao || ''}
                                                    onChange={(e) => handleObsLocalChange(v.id, e.target.value)}
                                                    onBlur={(e) => handleObsSaveDb(v.id, e.target.value)}
                                                    placeholder="Digitar nota..."
                                                    className={`w-full text-xs font-medium px-3 py-2 rounded-lg outline-none transition-all ${v.observacao ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-transparent hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-indigo-500 border border-transparent focus:border-indigo-200'}`}
                                                />
                                            </td>
                                            <td className="px-5 py-4 text-center align-middle">
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
                                        <tr><td colSpan={temVisaoGlobal ? "11" : "10"} className="text-center py-16 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Nenhuma venda encontrada no filtro.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}


            {/* ========================================================================= */}
            {/* COMPARTILHADO: FILTROS DE DATA AVANÇADOS (P/ COMISSÃO E AUDITORIA) */}
            {/* ========================================================================= */}
            {(subAba === 'comissoes' || subAba === 'auditoria') && (
                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-6 md:p-8 animate-[fadeIn_0.3s_ease-out]">
                    <div className="flex flex-col xl:flex-row justify-between items-start gap-8">
                        
                        <div className="flex-1 w-full">
                            <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-inner w-fit mb-6">
                                <button onClick={() => setTipoFiltroAvancado('mes')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${tipoFiltroAvancado === 'mes' ? 'bg-white shadow-sm text-slate-800 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                                    <i data-lucide="calendar" className="w-3.5 h-3.5"></i> Mês
                                </button>
                                <button onClick={() => setTipoFiltroAvancado('periodo')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${tipoFiltroAvancado === 'periodo' ? 'bg-white shadow-sm text-slate-800 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                                    <i data-lucide="calendar-days" className="w-3.5 h-3.5"></i> Período
                                </button>
                                <button onClick={() => setTipoFiltroAvancado('dia')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${tipoFiltroAvancado === 'dia' ? 'bg-white shadow-sm text-slate-800 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                                    <i data-lucide="sun" className="w-3.5 h-3.5"></i> Dia Único
                                </button>
                            </div>

                            <div className="flex flex-col sm:flex-row items-end gap-4 w-full">
                                {tipoFiltroAvancado === 'mes' && (
                                    <>
                                        <div className="w-full sm:w-auto flex-1">
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Mês Ref.</label>
                                            <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-slate-500 outline-none cursor-pointer">
                                                {mesesLista.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                                            </select>
                                        </div>
                                        <div className="w-full sm:w-auto flex-1">
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Ano Ref.</label>
                                            <select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-slate-500 outline-none cursor-pointer">
                                                {anosUnicos.map(a => <option key={a} value={a}>{a}</option>)}
                                            </select>
                                        </div>
                                    </>
                                )}

                                {tipoFiltroAvancado === 'periodo' && (
                                    <>
                                        <div className="w-full sm:w-auto flex-1">
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">De (Início)</label>
                                            <input type="date" value={dataInicialInput} onChange={(e) => setDataInicialInput(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-slate-500 outline-none cursor-pointer" />
                                        </div>
                                        <div className="w-full sm:w-auto flex-1">
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Até (Fim)</label>
                                            <input type="date" value={dataFinalInput} onChange={(e) => setDataFinalInput(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-slate-500 outline-none cursor-pointer" />
                                        </div>
                                    </>
                                )}

                                {tipoFiltroAvancado === 'dia' && (
                                    <div className="w-full sm:w-auto flex-1">
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Dia Específico</label>
                                        <input type="date" value={filtroDia} onChange={(e) => setFiltroDia(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-slate-500 outline-none cursor-pointer" />
                                    </div>
                                )}

                                {temVisaoGlobal && (
                                    <div className="w-full sm:w-auto flex-1 animate-[fadeIn_0.3s_ease-out]">
                                        <label className="block text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1.5 ml-1">Isolar Unidade</label>
                                        <select value={filtroUnidadeIsolada} onChange={(e) => setFiltroUnidadeIsolada(e.target.value)} className="w-full bg-rose-50/20 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-xs font-black focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer uppercase">
                                            {unidadesUnicas.map(u => <option key={u} value={u}>{u === 'TODOS' ? 'TODAS AS UNIDADES' : u}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* WIDGETS DINÂMICOS DEPENDENDO DA ABA */}
                        {subAba === 'comissoes' && (
                            <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl flex flex-col items-end w-full xl:w-auto shadow-sm">
                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5"><i data-lucide="check-circle" className="w-3.5 h-3.5"></i> Pagamento Aprovado</span>
                                <span className="text-4xl font-black text-emerald-700 tracking-tight leading-none mt-1">{formatMoney(comissaoTotalGeral)}</span>
                            </div>
                        )}

                        {subAba === 'auditoria' && (
                            <div className="flex gap-4 w-full xl:w-auto flex-wrap sm:flex-nowrap">
                                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col items-end flex-1 shadow-sm">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Registrado</span>
                                    <span className="text-3xl font-black text-slate-800 tracking-tight leading-none mt-1">{totalAuditoriaRegistrados}</span>
                                </div>
                                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex flex-col items-end flex-1 shadow-sm">
                                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Conferidos</span>
                                    <span className="text-3xl font-black text-emerald-700 tracking-tight leading-none mt-1">{totalAuditoriaConferidos}</span>
                                </div>
                                <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex flex-col items-end flex-1 shadow-sm">
                                    <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Pendentes</span>
                                    <span className="text-3xl font-black text-rose-700 tracking-tight leading-none mt-1">{totalAuditoriaPendentes}</span>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            )}


            {/* ========================================================================= */}
            {/* SUB-ABA 2: COMISSÕES CONFERIDAS (TABELA) */}
            {/* ========================================================================= */}
            {subAba === 'comissoes' && (
                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden animate-[fadeIn_0.3s_ease-out]">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest">
                            <i data-lucide="users" className="w-5 h-5 text-emerald-500"></i> Relatório de Vendedores
                        </h3>
                        <span className="text-[9px] font-bold text-slate-400 uppercase bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">Apenas Conferidas</span>
                    </div>
                    
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-max">
                            <thead>
                                <tr>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white w-64">Vendedor Equipe</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white w-48 text-right">Comissão Total</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white">Resumo dos Itens Validados</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {dadosTabelaComissoes.length > 0 ? dadosTabelaComissoes.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="px-8 py-5 text-sm font-black text-slate-800 uppercase flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm font-black border border-emerald-200">
                                                {row.vendedor.charAt(0)}
                                            </div>
                                            {row.vendedor}
                                        </td>
                                        <td className="px-8 py-5 text-base font-black text-emerald-600 text-right">
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
                                                <span className="text-[10px] font-black uppercase tracking-widest">Nenhuma comissão aprovada neste filtro</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}


            {/* ========================================================================= */}
            {/* SUB-ABA 4: AUDITORIA (C-LEVEL / MENTORES) */}
            {/* ========================================================================= */}
            {subAba === 'auditoria' && temVisaoGlobal && (
                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden animate-[fadeIn_0.3s_ease-out]">
                    <div className="p-6 border-b border-slate-100 bg-rose-50/30 flex justify-between items-center">
                        <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest">
                            <i data-lucide="activity" className="w-5 h-5 text-rose-500"></i> Desempenho de Conferência por Unidade
                        </h3>
                    </div>
                    
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-max">
                            <thead>
                                <tr>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white w-64">Unidade</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white text-center w-32">Total Registros</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-emerald-500 uppercase tracking-widest border-b border-slate-100 bg-emerald-50/30 text-center w-32">Conferidos (OK)</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-rose-500 uppercase tracking-widest border-b border-slate-100 bg-rose-50/30 text-center w-32">Pendentes</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white">Progresso de Auditoria</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {dadosTabelaAuditoria.length > 0 ? dadosTabelaAuditoria.map((row, idx) => {
                                    const percentual = row.registrados === 0 ? 0 : Math.round((row.conferidos / row.registrados) * 100);
                                    let corBarra = 'bg-rose-500';
                                    if (percentual >= 50) corBarra = 'bg-amber-400';
                                    if (percentual === 100) corBarra = 'bg-emerald-500';

                                    return (
                                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-8 py-5 text-sm font-black text-slate-800 uppercase flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center border border-slate-200">
                                                    <i data-lucide="map-pin" className="w-3.5 h-3.5"></i>
                                                </div>
                                                {row.unidade}
                                            </td>
                                            <td className="px-8 py-5 text-sm font-black text-slate-600 text-center">
                                                {row.registrados}
                                            </td>
                                            <td className="px-8 py-5 text-sm font-black text-emerald-600 bg-emerald-50/10 text-center">
                                                {row.conferidos}
                                            </td>
                                            <td className="px-8 py-5 text-sm font-black text-rose-600 bg-rose-50/10 text-center">
                                                {row.pendentes}
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-full bg-slate-100 rounded-full h-2.5 shadow-inner overflow-hidden flex">
                                                        <div className={`${corBarra} h-2.5 rounded-full transition-all duration-1000 ease-out`} style={{ width: `${percentual}%` }}></div>
                                                    </div>
                                                    <span className={`text-xs font-black w-10 text-right ${percentual === 100 ? 'text-emerald-600' : 'text-slate-600'}`}>{percentual}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan="5" className="text-center py-16 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                            Nenhum lançamento encontrado para auditar neste período.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}


            {/* ========================================================================= */}
            {/* SUB-ABA 3: GERAL DE COMISSÕES (C-LEVEL DASHBOARD) */}
            {/* ========================================================================= */}
            {subAba === 'geral' && (
                <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
                    
                    <div className="bg-violet-600 rounded-[24px] shadow-lg p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                        <div className="absolute bottom-0 right-32 w-40 h-40 bg-black opacity-10 rounded-full blur-2xl -mb-10 pointer-events-none"></div>
                        
                        <div className="relative z-10 text-white">
                            <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
                                <i data-lucide="bar-chart-2" className="w-7 h-7 text-violet-300"></i> Visão Geral de Custos
                            </h2>
                            <p className="text-xs font-bold text-violet-200 uppercase tracking-widest mt-1.5 opacity-90">Análise de comissões pagas nos últimos 6 meses</p>
                        </div>

                        <div className="relative z-10 bg-white/10 backdrop-blur-md border border-white/20 px-6 py-4 rounded-2xl flex flex-col items-end">
                            <span className="text-[10px] font-black text-violet-200 uppercase tracking-widest mb-0.5">Total Rede ({mesAtualLabel})</span>
                            <span className="text-4xl font-black text-white tracking-tight leading-none">{formatMoney(totalGeralRedeAtual)}</span>
                        </div>
                    </div>

                    <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest">
                                <i data-lucide="building-2" className="w-5 h-5 text-violet-500"></i> Mapa Gráfico de Unidades
                            </h3>
                        </div>

                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-max">
                                <thead>
                                    <tr>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white">Unidade</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-violet-600 uppercase tracking-widest border-b border-slate-100 bg-violet-50/30 text-right w-48">Mês Atual ({mesAtualLabel})</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white text-center w-72">Tendência (Últimos 6 Meses)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {visaoGeralUnidades.length > 0 ? visaoGeralUnidades.map((row, idx) => {
                                        const maxValor = Math.max(...row.historico.map(h => h.total));
                                        
                                        return (
                                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                                                <td className="px-8 py-6 text-sm font-black text-slate-800 uppercase flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
                                                        <i data-lucide="map-pin" className="w-4 h-4"></i>
                                                    </div>
                                                    {row.unidade}
                                                </td>
                                                <td className="px-8 py-6 text-lg font-black text-violet-700 text-right bg-violet-50/10">
                                                    {formatMoney(row.totalAtual)}
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex items-end justify-center gap-2 h-12">
                                                        {row.historico.map((mesHist, i) => {
                                                            const alturaPercentual = maxValor === 0 ? 5 : (mesHist.total / maxValor) * 100;
                                                            const isMesAtual = i === row.historico.length - 1;

                                                            return (
                                                                <div 
                                                                    key={i} 
                                                                    title={`${mesHist.label}: ${formatMoney(mesHist.total)}`}
                                                                    className={`w-8 rounded-t-sm transition-all duration-500 group-hover:opacity-100 ${isMesAtual ? 'bg-violet-500' : 'bg-slate-200 opacity-60'}`}
                                                                    style={{ height: `${Math.max(alturaPercentual, 5)}%` }} 
                                                                ></div>
                                                            );
                                                        })}
                                                    </div>
                                                    <div className="flex items-center justify-center gap-2 mt-2">
                                                        {row.historico.map((mesHist, i) => (
                                                            <div key={i} className={`w-8 text-center text-[8px] font-bold ${i === row.historico.length - 1 ? 'text-violet-600' : 'text-slate-400'}`}>
                                                                {mesHist.label.split('/')[0]}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr>
                                            <td colSpan="3" className="text-center py-16 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                                Nenhum dado financeiro processado para as unidades.
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