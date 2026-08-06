import React, { useState, useEffect, useMemo } from 'react';
import TabelaHistorico from './TabelaHistorico.jsx';
import { safeIsoDate, safeNumber, formatMoney, meses } from './utils.js';

const AssinaturasPratique = ({ usuarioLogado, data = [], setData }) => {
    // ESTADOS DE FILTRO
    const [tipoFiltroData, setTipoFiltroData] = useState('mes'); 
    const [filtroMes, setFiltroMes] = useState('TODOS');
    const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [diaEspecifico, setDiaEspecifico] = useState(new Date().toISOString().split('T')[0]);
    
    const [filtroProduto, setFiltroProduto] = useState('TODOS');
    const [filtroVendedor, setFiltroVendedor] = useState('TODOS');
    const [filtroUnidade, setFiltroUnidade] = useState('TODOS'); 

    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';
    const podeEditar = ['ADMIN', 'MENTOR', 'LIDER'].includes(usuarioLogado?.role);

    // ==========================================
    // LISTAS ÚNICAS OTIMIZADAS (USEMEMO)
    // ==========================================
    const produtosUnicos = useMemo(() => ['TODOS', ...new Set(data.map(v => v.produto))].filter(Boolean), [data]);
    const vendedoresUnicos = useMemo(() => ['TODOS', ...new Set(data.map(v => v.vendedor))].filter(Boolean), [data]);
    const unidadesUnicas = useMemo(() => ['TODOS', ...new Set(data.map(v => v.unidade))].filter(Boolean), [data]); 
    const anosUnicos = useMemo(() => {
        const anos = [...new Set(data.map(v => safeIsoDate(v.data).split('-')[0]))].filter(Boolean).sort((a,b) => b-a); 
        if(anos.length === 0) anos.push(new Date().getFullYear().toString());
        return anos;
    }, [data]);

    // ==========================================
    // MOTOR DE FILTRAGEM OTIMIZADO
    // ==========================================
    const vendasFiltradas = useMemo(() => {
        return data.filter(venda => {
            if (temVisaoGlobal && filtroUnidade !== 'TODOS' && venda.unidade !== filtroUnidade) return false;
            if (filtroProduto !== 'TODOS' && venda.produto !== filtroProduto) return false;
            if (filtroVendedor !== 'TODOS' && venda.vendedor !== filtroVendedor) return false;

            if (!venda.data) return false;
            
            const isoDate = safeIsoDate(venda.data);
            const partes = isoDate.split('-');
            if (partes.length !== 3) return false;
            const [y, m, d] = partes;

            if (tipoFiltroData === 'mes') {
                if (filtroMes !== 'TODOS' && m !== filtroMes) return false;
                if (filtroAno !== 'TODOS' && y !== filtroAno) return false;
            } else if (tipoFiltroData === 'periodo') {
                if (dataInicio && isoDate < dataInicio) return false;
                if (dataFim && isoDate > dataFim) return false;
            } else if (tipoFiltroData === 'dia') {
                if (diaEspecifico && isoDate !== diaEspecifico) return false;
            }

            return true;
        });
    }, [data, temVisaoGlobal, filtroUnidade, filtroProduto, filtroVendedor, tipoFiltroData, filtroMes, filtroAno, dataInicio, dataFim, diaEspecifico]);

    // ==========================================
    // EXTRATO DO VENDEDOR (DISCRIMINADO EXACT MATCH)
    // ==========================================
    const resumoVendedor = useMemo(() => {
        const resumo = { valorTotal: 0, qtdTotal: 0, itens: {} };
        
        if (filtroVendedor !== 'TODOS') {
            vendasFiltradas.forEach(v => {
                const val = safeNumber(v.valor);
                const qtd = parseInt(v.quantidade) || 1;
                resumo.valorTotal += val;
                resumo.qtdTotal += qtd;

                // Pega o nome EXATO do plano/produto vendido
                const nomeExato = (v.produto || 'ITEM NÃO IDENTIFICADO').toUpperCase();
                
                if (!resumo.itens[nomeExato]) {
                    resumo.itens[nomeExato] = 0;
                }
                resumo.itens[nomeExato] += qtd;
            });
        }
        return resumo;
    }, [vendasFiltradas, filtroVendedor]);

    // Renderiza ícones do Lucide sempre que os filtros ou os cards dinâmicos mudarem
    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [tipoFiltroData, filtroVendedor, resumoVendedor]);

    return (
        <div className="space-y-6 animate-[fadeIn_0.4s_ease-out] max-w-[1400px] mx-auto">
            
            {/* CABEÇALHO DE FILTROS */}
            <div className="bg-white rounded-[24px] border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.01)] p-6 md:p-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-inner">
                            <i data-lucide="filter" className="w-5 h-5"></i>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">Filtros de Histórico</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Sincronizado em tempo real</p>
                        </div>
                    </div>
                    
                    <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full md:w-auto overflow-x-auto custom-scrollbar">
                        <button onClick={() => setTipoFiltroData('mes')} className={`flex-1 md:w-32 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${tipoFiltroData === 'mes' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                            <i data-lucide="calendar" className="w-3.5 h-3.5"></i> Mês
                        </button>
                        <button onClick={() => setTipoFiltroData('periodo')} className={`flex-1 md:w-32 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${tipoFiltroData === 'periodo' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                            <i data-lucide="calendar-days" className="w-3.5 h-3.5"></i> Período
                        </button>
                        <button onClick={() => setTipoFiltroData('dia')} className={`flex-1 md:w-32 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${tipoFiltroData === 'dia' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                            <i data-lucide="sun" className="w-3.5 h-3.5"></i> Dia
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    {tipoFiltroData === 'mes' && (
                        <>
                            <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Mês Ref.</label>
                                <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer">
                                    {meses.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Ano Ref.</label>
                                <select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer">
                                    <option value="TODOS">Todos os Anos</option>
                                    {anosUnicos.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>
                        </>
                    )}
                    
                    {tipoFiltroData === 'periodo' && (
                        <>
                            <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Data Início</label>
                                <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer" />
                            </div>
                            <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Data Fim</label>
                                <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer" />
                            </div>
                        </>
                    )}

                    {tipoFiltroData === 'dia' && (
                        <div className="sm:col-span-2 lg:col-span-2">
                            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Dia Específico</label>
                            <input type="date" value={diaEspecifico} onChange={(e) => setDiaEspecifico(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer" />
                        </div>
                    )}

                    <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">SDR / Vendedor</label>
                        <select value={filtroVendedor} onChange={(e) => setFiltroVendedor(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer uppercase">
                            {vendedoresUnicos.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Produto / Plano</label>
                        <select value={filtroProduto} onChange={(e) => setFiltroProduto(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer uppercase">
                            {produtosUnicos.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>

                    {temVisaoGlobal && (
                        <div className="animate-[fadeIn_0.3s_ease-out]">
                            <label className="block text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1.5 ml-1">Isolar Unidade</label>
                            <select value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)} className="w-full bg-white border border-rose-200 rounded-xl px-3 py-2.5 text-xs font-black text-rose-700 focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer uppercase">
                                {unidadesUnicas.map(u => <option key={u} value={u}>{u === 'TODOS' ? 'TODAS AS UNIDADES' : u}</option>)}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* ========================================== */}
            {/* EXTRATO DO CONSULTOR DINÂMICO E PROFISSIONAL */}
            {/* ========================================== */}
            {filtroVendedor !== 'TODOS' && (
                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-6 md:p-8 animate-[slideDown_0.3s_ease-out]">
                    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
                        <div className="p-3 bg-slate-100 text-slate-600 rounded-xl border border-slate-200 shadow-inner">
                            <i data-lucide="user-check" className="w-5 h-5"></i>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">
                                Performance Individual: <span className="text-blue-600 uppercase">{filtroVendedor}</span>
                            </h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                Dados discriminados baseados no filtro de período selecionado
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                        
                        {/* CARD FINANCEIRO MASTER */}
                        <div className="col-span-2 md:col-span-4 lg:col-span-2 xl:col-span-2 bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-md flex flex-col justify-center relative overflow-hidden">
                            <div className="relative z-10">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Faturamento Total</p>
                                <p className="text-2xl font-black text-white">{formatMoney(resumoVendedor.valorTotal)}</p>
                                <div className="flex items-center gap-1.5 mt-2 bg-blue-500/10 text-blue-400 w-max px-2.5 py-1 rounded-lg border border-blue-500/20">
                                    <i data-lucide="bar-chart-2" className="w-3 h-3"></i>
                                    <span className="text-[9px] font-bold uppercase tracking-wider">
                                        {resumoVendedor.qtdTotal} Itens Registrados
                                    </span>
                                </div>
                            </div>
                            <div className="absolute right-[-10%] bottom-[-20%] text-white/5 pointer-events-none">
                                <i data-lucide="wallet" className="w-32 h-32"></i>
                            </div>
                        </div>

                        {/* CARDS DINÂMICOS (EXACT MATCH DOS NOMES DOS PLANOS) */}
                        {Object.entries(resumoVendedor.itens)
                            .sort((a, b) => b[1] - a[1]) // Organiza do mais vendido para o menos vendido
                            .map(([nomeExato, qtd]) => (
                                <div key={nomeExato} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-blue-400 hover:shadow-md transition-all duration-300">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-100 transition-colors">
                                            <i data-lucide="shopping-bag" className="w-4 h-4"></i>
                                        </div>
                                        <p className="text-2xl font-black text-slate-800 tracking-tight">{String(qtd).padStart(2, '0')}</p>
                                    </div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 leading-tight line-clamp-2" title={nomeExato}>
                                        {nomeExato}
                                    </p>
                                </div>
                            ))
                        }
                    </div>
                </div>
            )}

            {/* COMPONENTE DA TABELA ISOLADO */}
            <TabelaHistorico 
                data={data}
                setData={setData}
                vendasFiltradas={vendasFiltradas}
                temVisaoGlobal={temVisaoGlobal}
                podeEditar={podeEditar}
            />

        </div>
    );
};

export default AssinaturasPratique;