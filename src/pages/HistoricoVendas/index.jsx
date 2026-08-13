import React, { useState, useEffect, useMemo, useRef } from 'react';
import TabelaHistorico from './TabelaHistorico.jsx';
import { supabase } from '../../supabaseClient.js';
import { safeIsoDate, safeNumber, formatMoney, meses, toTitleCase, buildCatalogoMap } from './utils.js';
import { Filter, Calendar, CalendarDays, Sun, UserCheck, Wallet, BarChart2, Leaf, Star, Activity, Dumbbell, ShoppingBag, Receipt, Layers, ChevronDown, ChevronUp, AlertCircle, RefreshCw, AlertTriangle, Bookmark, Package, Briefcase } from 'lucide-react';
import { SmartFilter } from '../../components/SmartFilter.jsx';

const AssinaturasPratique = ({ usuarioLogado, data = [], setData, colaboradores = [] }) => {
    const hojePadrao = new Date().toISOString().split('T')[0];
    const mesPadrao = String(new Date().getMonth() + 1).padStart(2, '0');
    const anoPadrao = new Date().getFullYear().toString();

    const [tipoFiltroData, setTipoFiltroData] = useState('mes'); 
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

    useEffect(() => {
        const fetchCatalogo = async () => {
            const { data, error } = await supabase.from('catalogo').select('id, nome, tipo, valor');
            if (data && !error) setCatalogoGeral(data);
        };
        fetchCatalogo();
    }, []);

    const mapCatalogo = useMemo(() => buildCatalogoMap(catalogoGeral), [catalogoGeral]);

    const limparFiltros = () => {
        setTipoFiltroData('mes');
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

    const unidadesUnicas = useMemo(() => ['TODOS', ...new Set(data.map(v => v.unidade))].filter(Boolean), [data]); 
    
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
            if (temVisaoGlobal && filtroUnidade !== 'TODOS' && venda.unidade !== filtroUnidade) return false;
            if (!temVisaoGlobal && venda.unidade !== usuarioLogado?.unidade) return false;

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

    const { planosVendidos, produtosVendidos, servicosVendidos, vendedoresUnicos } = useMemo(() => {
        const arrPlanos = [];
        const arrProds = [];
        const arrServs = [];
        const vendSet = new Set();
        const itemSet = new Set();

        vendasBase.forEach(v => {
            if (v.vendedor) vendSet.add(v.vendedor.toUpperCase());
            if (v.produto) itemSet.add(v.produto.toUpperCase());
        });

        Array.from(itemSet).sort().forEach(item => {
            const cat = mapCatalogo.get(item);
            const tipo = cat ? cat.tipo.toLowerCase() : 'plano'; 

            if (tipo === 'plano') arrPlanos.push(item);
            else if (tipo === 'produto') arrProds.push(item);
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
            const prodUpper = (venda.produto || '').toUpperCase();
            const vendUpper = (venda.vendedor || '').toUpperCase();

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

        vendasFiltradas.forEach(v => {
            const val = safeNumber(v.valor);
            let qtdReal = parseInt(v.quantidade) || 1;
            const nomeExato = (v.produto || 'ITEM NÃO IDENTIFICADO').toUpperCase();
            
            let chaveUnica = v.id; 
            if (v.matricula && v.matricula.trim() !== '') {
                const dataLimpa = safeIsoDate(v.data || v.created_at);
                chaveUnica = `${v.matricula.trim()}-${nomeExato}-${dataLimpa}`;
            }

            if (transacoesUnicas.has(chaveUnica)) {
                qtdReal = 0;
            } else {
                transacoesUnicas.add(chaveUnica);
            }

            resumo.valorTotal += val;
            resumo.qtdTotal += qtdReal;

            const itemCat = mapCatalogo.get(nomeExato);
            
            let grupoAlvo = 'OUTROS PLANOS';

            if (!itemCat) {
                grupoAlvo = 'NÃO CATALOGADO'; 
            } else {
                const categoriaDB = itemCat.tipo.toLowerCase();
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

    const exibirDashboard = vendedoresOcultos.length > 0 || planosOcultos.length > 0 || produtosOcultos.length > 0 || servicosOcultos.length > 0;

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] max-w-[1400px] mx-auto">
            
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600 text-white rounded-xl shadow-md">
                            <Filter className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">Filtros de Histórico</h2>
                            <p className="text-xs font-semibold text-slate-500 mt-0.5">Base de dados sincronizada em tempo real</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                        <button onClick={limparFiltros} title="Limpar Filtros" aria-label="Limpar Filtros" className="w-11 h-11 flex items-center justify-center bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 rounded-xl transition-colors border border-slate-200 shrink-0">
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 flex-1 md:flex-none overflow-x-auto custom-scrollbar">
                            <button onClick={() => setTipoFiltroData('mes')} className={`flex-1 md:w-32 px-4 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${tipoFiltroData === 'mes' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                                <Calendar className="w-4 h-4" /> Mês
                            </button>
                            <button onClick={() => setTipoFiltroData('periodo')} className={`flex-1 md:w-32 px-4 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${tipoFiltroData === 'periodo' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                                <CalendarDays className="w-4 h-4" /> Período
                            </button>
                            <button onClick={() => setTipoFiltroData('dia')} className={`flex-1 md:w-32 px-4 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${tipoFiltroData === 'dia' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                                <Sun className="w-4 h-4" /> Dia
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 bg-slate-50/50 p-5 rounded-2xl border border-slate-200">
                    {tipoFiltroData === 'mes' && (
                        <>
                            <div>
                                <label htmlFor="filtro-mes" className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Mês Referência</label>
                                <select id="filtro-mes" value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer hover:border-blue-400 transition-colors h-[46px]">
                                    {meses.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="filtro-ano" className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Ano Referência</label>
                                <select id="filtro-ano" value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer hover:border-blue-400 transition-colors h-[46px]">
                                    <option value="TODOS">Todos os Anos</option>
                                    {anosUnicos.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>
                        </>
                    )}
                    
                    {tipoFiltroData === 'periodo' && (
                        <>
                            <div>
                                <label htmlFor="filtro-data-inicio" className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Data Início</label>
                                <input id="filtro-data-inicio" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer hover:border-blue-400 transition-colors h-[46px]" />
                            </div>
                            <div>
                                <label htmlFor="filtro-data-fim" className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Data Fim</label>
                                <input id="filtro-data-fim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer hover:border-blue-400 transition-colors h-[46px]" />
                            </div>
                        </>
                    )}

                    {tipoFiltroData === 'dia' && (
                        <div className="sm:col-span-2">
                            <label htmlFor="filtro-dia" className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Dia Específico</label>
                            <input id="filtro-dia" type="date" value={diaEspecifico} onChange={(e) => setDiaEspecifico(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer hover:border-blue-400 transition-colors h-[46px]" />
                        </div>
                    )}

                    {temVisaoGlobal && (
                        <div className="animate-[fadeIn_0.3s_ease-out]">
                            <label htmlFor="filtro-unidade" className="block text-[10px] font-black text-rose-500 uppercase tracking-widest mb-2 ml-1">Isolar Unidade</label>
                            <select id="filtro-unidade" value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)} className="w-full bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm font-black text-rose-700 focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer uppercase hover:border-rose-400 transition-colors h-[46px]">
                                {unidadesUnicas.map(u => <option key={u} value={u}>{u === 'TODOS' ? 'TODAS AS UNIDADES' : u}</option>)}
                            </select>
                        </div>
                    )}

                    {/* 🔥 UTILIZANDO O SMART FILTER GLOBAL */}
                    <SmartFilter 
                        options={vendedoresUnicos} 
                        ocultos={vendedoresOcultos} 
                        setOcultos={setVendedoresOcultos} 
                        label="Consultores" 
                        Icone={UserCheck}
                        iconColor="text-slate-500" 
                    />
                    
                    <SmartFilter 
                        options={planosVendidos} 
                        ocultos={planosOcultos} 
                        setOcultos={setPlanosOcultos} 
                        label="Planos" 
                        Icone={Bookmark} 
                        iconColor="text-blue-600" 
                    />
                    
                    <SmartFilter 
                        options={produtosVendidos} 
                        ocultos={produtosOcultos} 
                        setOcultos={setProdutosOcultos} 
                        label="Produtos" 
                        Icone={Package} 
                        iconColor="text-emerald-600" 
                    />
                    
                    <SmartFilter 
                        options={servicosVendidos} 
                        ocultos={servicosOcultos} 
                        setOcultos={setServicosOcultos} 
                        label="Serviços" 
                        Icone={Briefcase} 
                        iconColor="text-violet-600" 
                    />
                </div>
            </div>

            {exibirDashboard && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 animate-[slideDown_0.3s_ease-out]">
                    
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

                        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 p-4 rounded-xl max-w-sm">
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
                        
                        <div className="md:col-span-12 lg:col-span-4 bg-slate-900 rounded-2xl p-6 md:p-8 border border-slate-800 shadow-xl flex flex-col justify-center relative overflow-hidden">
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