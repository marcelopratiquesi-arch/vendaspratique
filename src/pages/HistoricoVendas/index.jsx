import React, { useState, useEffect, useMemo, useRef } from 'react';
import TabelaHistorico from './TabelaHistorico.jsx';
import { supabase } from '../../supabaseClient.js';
import { safeIsoDate, safeNumber, formatMoney, meses, toTitleCase, buildCatalogoMap, normalizeString } from './utils.js';
import { 
    Filter, Calendar, CalendarDays, Sun, UserCheck, Wallet, BarChart2, 
    Leaf, Star, Activity, Dumbbell, ShoppingBag, Receipt, Layers, 
    ChevronDown, ChevronUp, AlertCircle, RefreshCw, AlertTriangle, 
    Bookmark, Package, Briefcase, Info, Lightbulb, Users, Building2, CalendarRange 
} from 'lucide-react';
import { SmartFilter } from '../../components/SmartFilter.jsx';

// 🔥 CORREÇÃO DE FUSO HORÁRIO BRASILEIRO
const getLocalISODate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const AssinaturasPratique = ({ usuarioLogado, data = [], setData, colaboradores = [] }) => {
    const hojePadrao = getLocalISODate();
    const mesPadrao = String(new Date().getMonth() + 1).padStart(2, '0');
    const anoPadrao = new Date().getFullYear().toString();

    const [tipoFiltroData, setTipoFiltroData] = useState('dia'); 
    const [filtroMes, setFiltroMes] = useState(mesPadrao);
    const [filtroAno, setFiltroAno] = useState(anoPadrao);
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [diaEspecifico, setDiaEspecifico] = useState(hojePadrao);
    
    const [vendedoresOcultos, setVendedoresOcultos] = useState([]);
    const [planosOcultos, setPlanosOcultos] = useState([]);
    const [produtosOcultos, setProdutosOcultos] = useState([]);
    const [servicosOcultos, setServicosOcultos] = useState([]);
    
    const [filtroUnidade, setFiltroUnidade] = useState('TODOS'); 

    const [categoriaExpandida, setCategoriaExpandida] = useState(null);
    const [catalogoGeral, setCatalogoGeral] = useState([]); 

    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';
    const podeEditar = ['ADMIN', 'MENTOR', 'LIDER'].includes(usuarioLogado?.role);
    
    const unidadeAtual = temVisaoGlobal ? filtroUnidade : usuarioLogado?.unidade;

    useEffect(() => {
        const fetchCatalogo = async () => {
            const { data, error } = await supabase.from('catalogo').select('id, nome, tipo, valor');
            if (data && !error) setCatalogoGeral(data);
        };
        fetchCatalogo();
    }, []);

    // Utilizamos a função de utilitários oficial para construir o mapa otimizado do catálogo
    const mapCatalogo = useMemo(() => buildCatalogoMap(catalogoGeral), [catalogoGeral]);

    const limparFiltros = () => {
        setTipoFiltroData('dia');
        setFiltroMes(mesPadrao);
        setFiltroAno(anoPadrao);
        setDataInicio('');
        setDataFim('');
        setDiaEspecifico(hojePadrao);
        setVendedoresOcultos([]);
        setPlanosOcultos([]);
        setProdutosOcultos([]);
        setServicosOcultos([]);
        if (temVisaoGlobal) setFiltroUnidade('TODOS');
    };

    useEffect(() => {
        setVendedoresOcultos([]);
        setPlanosOcultos([]);
        setProdutosOcultos([]);
        setServicosOcultos([]);
    }, [filtroUnidade, filtroMes, filtroAno, diaEspecifico, dataInicio, dataFim, tipoFiltroData]);

    const unidadesUnicas = useMemo(() => ['TODOS', ...new Set(data.map(v => String(v.unidade || '').trim().toUpperCase()))].filter(Boolean), [data]); 
    
    const anosUnicos = useMemo(() => {
        const anos = [...new Set(data.map(v => {
            const dataRef = v.data || v.created_at;
            if (!dataRef) return null;
            const partes = safeIsoDate(dataRef).split('-');
            if (partes.length === 3) {
                return partes[2].length === 4 ? partes[2] : partes[0];
            }
            return null;
        }))].filter(Boolean).sort((a,b) => b-a); 
        if(anos.length === 0) anos.push(anoPadrao);
        return anos;
    }, [data, anoPadrao]);

    const vendasBase = useMemo(() => {
        return data.filter(venda => {
            const unidadeVenda = String(venda.unidade || '').trim().toUpperCase();
            const unidadeLogado = String(usuarioLogado?.unidade || '').trim().toUpperCase();
            const filtroUnidadeTrim = String(filtroUnidade || '').trim().toUpperCase();

            if (temVisaoGlobal && filtroUnidadeTrim !== 'TODOS' && unidadeVenda !== filtroUnidadeTrim) return false;
            if (!temVisaoGlobal && unidadeVenda !== unidadeLogado) return false;

            const dataReferencia = venda.data || venda.created_at;
            if (!dataReferencia) return false;
            
            const isoDate = safeIsoDate(dataReferencia);
            const partes = isoDate.split('-');
            if (partes.length !== 3) return false;
            
            let y = partes[0], m = partes[1], d = partes[2];
            if (partes[2].length === 4) { y = partes[2]; m = partes[1]; d = partes[0]; }
            const dataFormatada = `${y}-${m}-${d}`;

            if (tipoFiltroData === 'mes') {
                if (filtroMes !== 'TODOS' && m !== filtroMes) return false;
                if (filtroAno !== 'TODOS' && y !== filtroAno) return false;
            } else if (tipoFiltroData === 'periodo') {
                if (dataInicio && dataFormatada < dataInicio) return false;
                if (dataFim && dataFormatada > dataFim) return false;
            } else if (tipoFiltroData === 'dia') {
                if (diaEspecifico && dataFormatada !== diaEspecifico) return false;
            }

            return true;
        });
    }, [data, temVisaoGlobal, filtroUnidade, usuarioLogado, tipoFiltroData, filtroMes, filtroAno, dataInicio, dataFim, diaEspecifico]);

    // 🔥 CORREÇÃO DA CLASSIFICAÇÃO: Usando o normalizeString para cruzar perfeitamente com o Catálogo
    const { planosVendidos, produtosVendidos, servicosVendidos, vendedoresUnicos } = useMemo(() => {
        const arrPlanos = [];
        const arrProds = [];
        const arrServs = [];
        const vendSet = new Set();
        const itemSet = new Set();

        vendasBase.forEach(v => {
            if (v.vendedor) vendSet.add(v.vendedor.trim().toUpperCase());
            if (v.produto) itemSet.add(v.produto.trim().toUpperCase());
        });

        Array.from(itemSet).sort().forEach(item => {
            const cat = mapCatalogo.get(normalizeString(item));
            const tipo = cat && cat.tipo ? cat.tipo.toLowerCase().trim() : 'plano'; 

            if (tipo === 'produto') arrProds.push(item);
            else if (tipo === 'servico' || tipo === 'serviço') arrServs.push(item);
            else arrPlanos.push(item);
        });

        return { 
            planosVendidos: arrPlanos, 
            produtosVendidos: arrProds, 
            servicosVendidos: arrServs,
            vendedoresUnicos: Array.from(vendSet).sort()
        };
    }, [vendasBase, mapCatalogo]);

    const vendasFiltradas = useMemo(() => {
        return vendasBase.filter(venda => {
            const prodUpper = (venda.produto || '').trim().toUpperCase();
            const vendUpper = (venda.vendedor || '').trim().toUpperCase();

            if (vendedoresOcultos.includes(vendUpper)) return false;
            if (planosOcultos.includes(prodUpper)) return false;
            if (produtosOcultos.includes(prodUpper)) return false;
            if (servicosOcultos.includes(prodUpper)) return false;

            return true;
        });
    }, [vendasBase, vendedoresOcultos, planosOcultos, produtosOcultos, servicosOcultos]);

    const resumoVendedor = useMemo(() => {
        const resumo = {
            valorTotal: 0,
            qtdTotal: 0,
            grupos: {
                "NUTRI": { qtd: 0, valor: 0, itens: {}, icone: Leaf, cor: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-200' },
                "PLUS": { qtd: 0, valor: 0, itens: {}, icone: Star, cor: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' },
                "FIT": { qtd: 0, valor: 0, itens: {}, icone: Activity, cor: 'text-indigo-600', bg: 'bg-indigo-100', border: 'border-indigo-200' },
                "PERSONAL CLASS": { qtd: 0, valor: 0, itens: {}, icone: Dumbbell, cor: 'text-rose-600', bg: 'bg-rose-100', border: 'border-rose-200' },
                "OUTROS PLANOS": { qtd: 0, valor: 0, itens: {}, icone: Layers, cor: 'text-slate-600', bg: 'bg-slate-200', border: 'border-slate-300' },
                "PRODUTOS": { qtd: 0, valor: 0, itens: {}, icone: ShoppingBag, cor: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200' },
                "SERVIÇOS": { qtd: 0, valor: 0, itens: {}, icone: Receipt, cor: 'text-violet-600', bg: 'bg-violet-100', border: 'border-violet-200' },
                "NÃO CATALOGADO": { qtd: 0, valor: 0, itens: {}, icone: AlertTriangle, cor: 'text-red-600', bg: 'bg-red-100', border: 'border-red-400' }
            }
        };
        
        const transacoesUnicas = new Set();

        vendasFiltradas.forEach((v, index) => {
            let val = safeNumber(v.valor);
            let qtdReal = parseInt(v.quantidade) || 1;
            const nomeExato = (v.produto || 'ITEM NÃO IDENTIFICADO').trim().toUpperCase();
            
            const itemCat = mapCatalogo.get(normalizeString(nomeExato));
            const tipoCategoria = itemCat && itemCat.tipo ? itemCat.tipo.toLowerCase().trim() : 'outro';
            
            let chaveUnica = v.id || `${v.created_at || v.data}-${nomeExato}-${index}`; 
            
            if (tipoCategoria === 'plano' && v.matricula && String(v.matricula).trim() !== '') {
                const dataLimpa = safeIsoDate(v.data || v.created_at);
                chaveUnica = `${String(v.matricula).trim()}-${nomeExato}-${dataLimpa}`;
            }

            if (transacoesUnicas.has(chaveUnica)) {
                qtdReal = 0;
                val = 0; 
            } else {
                transacoesUnicas.add(chaveUnica);
            }

            resumo.valorTotal += val;
            resumo.qtdTotal += qtdReal;
            
            let grupoAlvo = 'OUTROS PLANOS';

            if (!itemCat) {
                grupoAlvo = 'NÃO CATALOGADO'; 
            } else {
                const categoriaDB = itemCat.tipo.toLowerCase().trim();
                if (categoriaDB === 'plano') {
                    if (nomeExato.includes('NUTRI')) grupoAlvo = 'NUTRI';
                    else if (nomeExato.includes('PLUS') || nomeExato.includes('AFL')) grupoAlvo = 'PLUS';
                    else if (nomeExato.includes('FIT')) grupoAlvo = 'FIT';
                    else if (nomeExato.includes('PERSONAL')) grupoAlvo = 'PERSONAL CLASS';
                    else grupoAlvo = 'OUTROS PLANOS';
                } else if (categoriaDB === 'produto') {
                    grupoAlvo = 'PRODUTOS';
                } else if (categoriaDB === 'servico' || categoriaDB === 'serviço') {
                    grupoAlvo = 'SERVIÇOS';
                }
            }

            resumo.grupos[grupoAlvo].qtd += qtdReal;
            resumo.grupos[grupoAlvo].valor += val;

            if (!resumo.grupos[grupoAlvo].itens[nomeExato]) {
                resumo.grupos[grupoAlvo].itens[nomeExato] = { qtd: 0, valor: 0 };
            }
            resumo.grupos[grupoAlvo].itens[nomeExato].qtd += qtdReal;
            resumo.grupos[grupoAlvo].itens[nomeExato].valor += val;
        });
        
        return resumo;
    }, [vendasFiltradas, mapCatalogo]);

    const toggleCategoria = (catNome) => {
        setCategoriaExpandida(prev => prev === catNome ? null : catNome);
    };

    const exibirDashboard = 
        vendedoresOcultos.length > 0 || 
        planosOcultos.length > 0 || 
        produtosOcultos.length > 0 || 
        servicosOcultos.length > 0 ||
        filtroUnidade !== 'TODOS' ||
        tipoFiltroData !== 'dia' ||
        diaEspecifico !== hojePadrao;

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] max-w-[1400px] mx-auto">
            
            {/* ========================================== */}
            {/* 🚀 FILTROS DE HISTÓRICO (REDESIGN PREMIUM 2026) */}
            {/* ========================================== */}
            <div className="bg-white rounded-[24px] border border-slate-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-6 md:p-8 relative z-20">
                
                {/* CABEÇALHO DOS FILTROS */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-blue-600 text-white rounded-[18px] flex items-center justify-center shrink-0 shadow-md">
                            <Filter className="w-6 h-6" />
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Filtros de Histórico</h2>
                            <p className="text-[13px] font-medium text-slate-500 mt-0.5">Base de dados sincronizada em tempo real</p>
                            <p className="text-[11px] font-medium text-slate-400 mt-0.5">Selecione os filtros abaixo para visualizar o histórico de performance.</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                        <button 
                            onClick={limparFiltros} 
                            title="Limpar Filtros" 
                            className="flex flex-col items-center justify-center w-14 h-14 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-500 rounded-[16px] transition-all shadow-sm shrink-0"
                        >
                            <RefreshCw className="w-4 h-4 mb-0.5" />
                            <span className="text-[8px] font-black uppercase tracking-widest leading-none text-center">Limpar<br/>Filtros</span>
                        </button>
                        
                        <div className="flex bg-slate-50 p-1.5 rounded-[20px] border border-slate-200 flex-1 md:flex-none overflow-x-auto custom-scrollbar shadow-inner">
                            <button onClick={() => setTipoFiltroData('mes')} className={`flex-1 md:w-32 px-4 py-3 rounded-[14px] text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${tipoFiltroData === 'mes' ? 'bg-white shadow-sm text-blue-700 border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
                                <CalendarDays className="w-4 h-4" /> Mês
                            </button>
                            <button onClick={() => setTipoFiltroData('periodo')} className={`flex-1 md:w-32 px-4 py-3 rounded-[14px] text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${tipoFiltroData === 'periodo' ? 'bg-white shadow-sm text-blue-700 border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
                                <CalendarRange className="w-4 h-4" /> Período
                            </button>
                            <button onClick={() => setTipoFiltroData('dia')} className={`flex-1 md:w-32 px-4 py-3 rounded-[14px] text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${tipoFiltroData === 'dia' ? 'bg-white shadow-sm text-blue-700 border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
                                <Sun className="w-4 h-4" /> Dia
                            </button>
                        </div>
                    </div>
                </div>

                {/* PRIMEIRA LINHA DE FILTROS (DADOS, UNIDADE, CONSULTORES) */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6 mb-6">
                    
                    {/* Renderização condicional baseada no Tipo de Filtro selecionado */}
                    {tipoFiltroData === 'mes' && (
                        <>
                            <div className="bg-slate-50/50 border border-slate-100 rounded-[20px] p-4 flex flex-col gap-3 transition-colors hover:bg-slate-50">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                        <CalendarDays className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Mês Referência</label>
                                        <span className="text-[10px] font-medium text-slate-400 leading-tight">Selecione o mês</span>
                                    </div>
                                </div>
                                <div className="relative">
                                    <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer hover:border-slate-300 transition-colors h-[48px] appearance-none shadow-sm">
                                        {meses.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                                    </select>
                                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                            </div>
                            
                            <div className="bg-slate-50/50 border border-slate-100 rounded-[20px] p-4 flex flex-col gap-3 transition-colors hover:bg-slate-50">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                        <Calendar className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Ano Referência</label>
                                        <span className="text-[10px] font-medium text-slate-400 leading-tight">Selecione o ano</span>
                                    </div>
                                </div>
                                <div className="relative">
                                    <select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer hover:border-slate-300 transition-colors h-[48px] appearance-none shadow-sm">
                                        <option value="TODOS">Todos os Anos</option>
                                        {anosUnicos.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                            </div>
                        </>
                    )}

                    {tipoFiltroData === 'periodo' && (
                        <>
                            <div className="bg-slate-50/50 border border-slate-100 rounded-[20px] p-4 flex flex-col gap-3 transition-colors hover:bg-slate-50">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                        <CalendarDays className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Data Início</label>
                                        <span className="text-[10px] font-medium text-slate-400 leading-tight">A partir de</span>
                                    </div>
                                </div>
                                <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm h-[48px]" />
                            </div>

                            <div className="bg-slate-50/50 border border-slate-100 rounded-[20px] p-4 flex flex-col gap-3 transition-colors hover:bg-slate-50">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                        <CalendarDays className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Data Fim</label>
                                        <span className="text-[10px] font-medium text-slate-400 leading-tight">Até</span>
                                    </div>
                                </div>
                                <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm h-[48px]" />
                            </div>
                        </>
                    )}

                    {tipoFiltroData === 'dia' && (
                        <div className="xl:col-span-2 bg-slate-50/50 border border-slate-100 rounded-[20px] p-4 flex flex-col gap-3 transition-colors hover:bg-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                    <CalendarDays className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Dia Específico</label>
                                    <span className="text-[10px] font-medium text-slate-400 leading-tight">Selecione a data para consultar</span>
                                </div>
                            </div>
                            <input type="date" value={diaEspecifico} onChange={(e) => setDiaEspecifico(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm h-[48px]" />
                        </div>
                    )}

                    {/* BLOCO: ISOLAR UNIDADE (SÓ APARECE PARA VISÃO GLOBAL) */}
                    {temVisaoGlobal && (
                        <div className="bg-rose-50/30 border border-rose-100 rounded-[20px] p-4 flex flex-col gap-3 transition-colors hover:bg-rose-50/50">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                                    <Building2 className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-[11px] font-black text-rose-700 uppercase tracking-widest">Isolar Unidade</label>
                                    <span className="text-[10px] font-medium text-rose-500 leading-tight">Visualize os dados de uma unidade</span>
                                </div>
                            </div>
                            <div className="relative">
                                <select value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)} className="w-full bg-white border border-rose-200 rounded-xl px-4 py-3 text-sm font-black text-rose-700 focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer uppercase hover:border-rose-300 transition-colors h-[48px] appearance-none shadow-sm">
                                    {unidadesUnicas.map(u => <option key={u} value={u}>{u === 'TODOS' ? 'TODAS AS UNIDADES' : u}</option>)}
                                </select>
                                <ChevronDown className="w-4 h-4 text-rose-500 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                        </div>
                    )}

                    {/* BLOCO: CONSULTORES */}
                    <div className="bg-slate-50/50 border border-slate-100 rounded-[20px] p-4 flex flex-col gap-3 transition-colors hover:bg-slate-50">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                                <Users className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Consultores</label>
                                <span className="text-[10px] font-medium text-slate-400 leading-tight">Filtre por consultor</span>
                            </div>
                        </div>
                        <div className="relative">
                            <SmartFilter 
                                options={vendedoresUnicos} 
                                ocultos={vendedoresOcultos} 
                                setOcultos={setVendedoresOcultos} 
                                label="TODOS" 
                                Icone={null} 
                            />
                            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    </div>

                </div>

                {/* SEGUNDA LINHA DE FILTROS (CATEGORIAS) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 relative z-0">
                    
                    <div className="bg-slate-50/50 border border-slate-100 rounded-[20px] p-4 flex flex-col gap-3 transition-colors hover:bg-slate-50">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                <Bookmark className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Planos</label>
                                <span className="text-[10px] font-medium text-slate-400 leading-tight">Filtre por tipo de plano</span>
                            </div>
                        </div>
                        <div className="relative">
                            <SmartFilter options={planosVendidos} ocultos={planosOcultos} setOcultos={setPlanosOcultos} label="TODOS" Icone={null} />
                            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    </div>

                    <div className="bg-emerald-50/30 border border-emerald-100/60 rounded-[20px] p-4 flex flex-col gap-3 transition-colors hover:bg-emerald-50/50">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                                <Package className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Produtos</label>
                                <span className="text-[10px] font-medium text-slate-400 leading-tight">Filtre por produtos</span>
                            </div>
                        </div>
                        <div className="relative">
                            <SmartFilter options={produtosVendidos} ocultos={produtosOcultos} setOcultos={setProdutosOcultos} label="TODOS" Icone={null} />
                            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    </div>

                    <div className="bg-violet-50/30 border border-violet-100/60 rounded-[20px] p-4 flex flex-col gap-3 transition-colors hover:bg-violet-50/50">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                                <Briefcase className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Serviços</label>
                                <span className="text-[10px] font-medium text-slate-400 leading-tight">Filtre por serviços</span>
                            </div>
                        </div>
                        <div className="relative">
                            <SmartFilter options={servicosVendidos} ocultos={servicosOcultos} setOcultos={setServicosOcultos} label="VAZIO" Icone={null} />
                            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    </div>

                </div>
            </div>

            {exibirDashboard && (
                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-6 md:p-8 animate-[slideDown_0.3s_ease-out]">
                    
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b border-slate-100">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-inner">
                                <UserCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                                    Desempenho: <span className="text-blue-600 capitalize">Seleção Personalizada</span>
                                </h2>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1 flex items-center gap-1.5">
                                    Resumo operacional
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 p-4 rounded-xl max-w-sm shadow-sm">
                            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-black text-amber-700 uppercase tracking-widest mb-1">Aviso de Fechamento</p>
                                <p className="text-xs font-semibold text-amber-600/80 leading-relaxed">
                                    Este painel exibe o <strong className="text-amber-600">faturamento a conferir</strong>. O valor real depende da auditoria no Caixa.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                        
                        <div className="md:col-span-12 lg:col-span-4 bg-slate-900 rounded-[24px] p-6 md:p-8 border border-slate-800 shadow-xl flex flex-col justify-center relative overflow-hidden h-full">
                            <div className="relative z-10">
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <Wallet className="w-4 h-4 text-slate-500" /> Faturamento a Conferir
                                </p>
                                <p className="text-4xl md:text-5xl font-black text-white tracking-tight">{formatMoney(resumoVendedor.valorTotal)}</p>
                                <div className="flex items-center gap-2 mt-4 bg-blue-500/10 text-blue-400 w-max px-3 py-1.5 rounded-lg border border-blue-500/20">
                                    <BarChart2 className="w-4 h-4" />
                                    <span className="text-xs font-bold uppercase tracking-wider">
                                        {resumoVendedor.qtdTotal} Procedimentos Únicos
                                    </span>
                                </div>
                            </div>
                            <div className="absolute right-[-5%] bottom-[-15%] text-white/5 pointer-events-none">
                                <Wallet className="w-48 h-48" />
                            </div>
                        </div>

                        <div className="md:col-span-12 lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
                            {Object.entries(resumoVendedor.grupos)
                                .filter(([_, info]) => info.qtd > 0)
                                .sort((a, b) => b[1].qtd - a[1].qtd) 
                                .map(([nomeGrupo, info]) => {
                                    const isExpanded = categoriaExpandida === nomeGrupo;
                                    const IconeCategoria = info.icone;

                                    return (
                                        <div key={nomeGrupo} className={`bg-white border rounded-2xl overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md ${isExpanded ? `ring-2 ring-offset-1 ${info.border.replace('border-', 'ring-')}` : 'border-slate-200 hover:border-slate-300'}`}>
                                            
                                            <button 
                                                onClick={() => toggleCategoria(nomeGrupo)} 
                                                aria-expanded={isExpanded}
                                                className="w-full text-left px-5 py-4 flex items-center justify-between bg-white"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${info.bg} ${info.cor}`}>
                                                        <IconeCategoria className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xl font-black text-slate-800 tracking-tight">{String(info.qtd).padStart(2, '0')}</h3>
                                                        <p className={`text-[10px] font-black uppercase tracking-widest ${info.cor}`}>{nomeGrupo}</p>
                                                    </div>
                                                </div>
                                                <div aria-hidden="true" className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isExpanded ? 'bg-slate-100 text-slate-800' : 'bg-slate-50 text-slate-400'}`}>
                                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </div>
                                            </button>

                                            <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[400px] opacity-100 overflow-y-auto custom-scrollbar' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                                                <div className="px-5 pb-5 pt-2 bg-slate-50/50 border-t border-slate-100">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Detalhamento dos Lançamentos</p>
                                                    <div className="space-y-3">
                                                        {Object.entries(info.itens)
                                                            .sort((a,b) => b[1].qtd - a[1].qtd)
                                                            .map(([nomeProduto, dadosProd]) => (
                                                                <div key={nomeProduto} className="flex items-start gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                                                    <div className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-[10px] font-black shrink-0 mt-0.5" title="Quantidade Deduplicada">
                                                                        {String(dadosProd.qtd).padStart(2, '0')}x
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs font-bold text-slate-700 leading-snug">{toTitleCase(nomeProduto)}</p>
                                                                        <p className="text-[10px] font-bold text-slate-400 mt-1">{formatMoney(dadosProd.valor)}</p>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        }
                                                    </div>
                                                </div>
                                            </div>

                                        </div>
                                    );
                                })
                            }
                        </div>
                    </div>
                </div>
            )}

            <TabelaHistorico 
                data={data}
                setData={setData}
                vendasFiltradas={vendasFiltradas}
                temVisaoGlobal={temVisaoGlobal}
                podeEditar={podeEditar}
                catalogoGeral={catalogoGeral} 
                usuarioLogado={usuarioLogado}
                colaboradores={colaboradores}
            />

        </div>
    );
};

export default AssinaturasPratique;