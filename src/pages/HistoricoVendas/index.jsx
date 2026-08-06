import React, { useState, useEffect, useMemo } from 'react';
import TabelaHistorico from './TabelaHistorico.jsx';
import { supabase } from '../../supabaseClient.js'; // NOVO: Conexão para ler o catálogo real
import { safeIsoDate, safeNumber, formatMoney, meses, toTitleCase } from './utils.js';
import { Filter, Calendar, CalendarDays, Sun, UserCheck, Wallet, BarChart2, Leaf, Star, Activity, Dumbbell, ShoppingBag, Receipt, Layers, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

const AssinaturasPratique = ({ usuarioLogado, data = [], setData }) => {
    // 1. FILTROS INTELIGENTES (PRÉ-PREENCHIDOS CORRETAMENTE)
    const [tipoFiltroData, setTipoFiltroData] = useState('mes'); 
    const [filtroMes, setFiltroMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
    const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [diaEspecifico, setDiaEspecifico] = useState(new Date().toISOString().split('T')[0]);
    
    const [filtroProduto, setFiltroProduto] = useState('TODOS');
    const [filtroVendedor, setFiltroVendedor] = useState('TODOS');
    const [filtroUnidade, setFiltroUnidade] = useState('TODOS'); 

    const [categoriaExpandida, setCategoriaExpandida] = useState(null);
    const [catalogoGeral, setCatalogoGeral] = useState([]); // NOVO: Armazena o catálogo

    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';
    const podeEditar = ['ADMIN', 'MENTOR', 'LIDER'].includes(usuarioLogado?.role);

    // Busca o catálogo oficial do Supabase uma única vez para classificar corretamente
    useEffect(() => {
        const fetchCatalogo = async () => {
            const { data } = await supabase.from('catalogo').select('*');
            if (data) setCatalogoGeral(data);
        };
        fetchCatalogo();
    }, []);

    const produtosUnicos = useMemo(() => ['TODOS', ...new Set(data.map(v => v.produto))].filter(Boolean), [data]);
    const vendedoresUnicos = useMemo(() => ['TODOS', ...new Set(data.map(v => v.vendedor))].filter(Boolean), [data]);
    const unidadesUnicas = useMemo(() => ['TODOS', ...new Set(data.map(v => v.unidade))].filter(Boolean), [data]); 
    const anosUnicos = useMemo(() => {
        const anos = [...new Set(data.map(v => safeIsoDate(v.data).split('-')[0]))].filter(Boolean).sort((a,b) => b-a); 
        if(anos.length === 0) anos.push(new Date().getFullYear().toString());
        return anos;
    }, [data]);

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

    // 2. AGRUPAMENTO INTELIGENTE USANDO A REGRA DE OURO DO DASHBOARD
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
                "SERVIÇOS": { qtd: 0, valor: 0, itens: {}, icone: Receipt, cor: 'text-violet-600', bg: 'bg-violet-100', border: 'border-violet-200' }
            }
        };
        
        if (filtroVendedor !== 'TODOS') {
            vendasFiltradas.forEach(v => {
                const val = safeNumber(v.valor);
                const qtd = parseInt(v.quantidade) || 1;
                resumo.valorTotal += val;
                resumo.qtdTotal += qtd;

                const nomeExato = (v.produto || 'ITEM NÃO IDENTIFICADO').toUpperCase();
                
                // INTELIGÊNCIA EXATA: Consulta o catálogo para saber a categoria real
                const itemCat = catalogoGeral.find(c => c.nome.toUpperCase() === nomeExato);
                const categoriaDB = itemCat ? itemCat.tipo.toLowerCase() : 'plano';

                let grupoAlvo = 'OUTROS PLANOS';

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

                resumo.grupos[grupoAlvo].qtd += qtd;
                resumo.grupos[grupoAlvo].valor += val;

                if (!resumo.grupos[grupoAlvo].itens[nomeExato]) {
                    resumo.grupos[grupoAlvo].itens[nomeExato] = { qtd: 0, valor: 0 };
                }
                resumo.grupos[grupoAlvo].itens[nomeExato].qtd += qtd;
                resumo.grupos[grupoAlvo].itens[nomeExato].valor += val;
            });
        }
        return resumo;
    }, [vendasFiltradas, filtroVendedor, catalogoGeral]); // Adicionado o catalogo como dependência

    const toggleCategoria = (catNome) => {
        setCategoriaExpandida(prev => prev === catNome ? null : catNome);
    };

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] max-w-[1400px] mx-auto">
            
            {/* CABEÇALHO DE FILTROS */}
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
                    
                    <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full md:w-auto overflow-x-auto custom-scrollbar">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5 bg-slate-50/50 p-5 rounded-2xl border border-slate-200">
                    {tipoFiltroData === 'mes' && (
                        <>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-2 ml-1">Mês Referência</label>
                                <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer hover:border-blue-400 transition-colors">
                                    {meses.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-2 ml-1">Ano Referência</label>
                                <select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer hover:border-blue-400 transition-colors">
                                    <option value="TODOS">Todos os Anos</option>
                                    {anosUnicos.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>
                        </>
                    )}
                    
                    {tipoFiltroData === 'periodo' && (
                        <>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-2 ml-1">Data Início</label>
                                <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer hover:border-blue-400 transition-colors" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-2 ml-1">Data Fim</label>
                                <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer hover:border-blue-400 transition-colors" />
                            </div>
                        </>
                    )}

                    {tipoFiltroData === 'dia' && (
                        <div className="sm:col-span-2 lg:col-span-2">
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-2 ml-1">Dia Específico</label>
                            <input type="date" value={diaEspecifico} onChange={(e) => setDiaEspecifico(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer hover:border-blue-400 transition-colors" />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-2 ml-1">Consultor</label>
                        <select value={filtroVendedor} onChange={(e) => setFiltroVendedor(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer capitalize hover:border-blue-400 transition-colors">
                            {vendedoresUnicos.map(v => <option key={v} value={v}>{v === 'TODOS' ? 'TODOS' : toTitleCase(v)}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-2 ml-1">Plano / Produto</label>
                        <select value={filtroProduto} onChange={(e) => setFiltroProduto(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer hover:border-blue-400 transition-colors">
                            {produtosUnicos.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>

                    {temVisaoGlobal && (
                        <div className="animate-[fadeIn_0.3s_ease-out]">
                            <label className="block text-xs font-bold text-rose-600 uppercase tracking-widest mb-2 ml-1">Isolar Unidade</label>
                            <select value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)} className="w-full bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm font-black text-rose-700 focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer uppercase hover:border-rose-400 transition-colors">
                                {unidadesUnicas.map(u => <option key={u} value={u}>{u === 'TODOS' ? 'TODAS AS UNIDADES' : u}</option>)}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* EXTRATO DO CONSULTOR COM DESIGN EXPANDÍVEL */}
            {filtroVendedor !== 'TODOS' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 animate-[slideDown_0.3s_ease-out]">
                    
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b border-slate-100">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-inner">
                                <UserCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                                    Desempenho: <span className="text-blue-600 capitalize">{toTitleCase(filtroVendedor)}</span>
                                </h2>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
                                    Resumo operacional do período
                                </p>
                            </div>
                        </div>

                        {/* LEMBRETE IMPORTANTE DE AUDITORIA */}
                        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 p-4 rounded-xl max-w-sm">
                            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-black text-amber-700 uppercase tracking-widest mb-1">Aviso de Fechamento</p>
                                <p className="text-xs font-semibold text-amber-600/80 leading-relaxed">
                                    Este painel exibe o <strong className="text-amber-600">faturamento a conferir</strong>. O valor real depende da auditoria de pagamentos no Caixa.
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
                                        {resumoVendedor.qtdTotal} Procedimentos Realizados
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
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isExpanded ? 'bg-slate-100 text-slate-800' : 'bg-slate-50 text-slate-400'}`}>
                                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </div>
                                            </button>

                                            <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                                <div className="px-5 pb-5 pt-2 bg-slate-50/50 border-t border-slate-100">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Detalhamento dos Lançamentos</p>
                                                    <div className="space-y-3">
                                                        {Object.entries(info.itens)
                                                            .sort((a,b) => b[1].qtd - a[1].qtd)
                                                            .map(([nomeProduto, dadosProd]) => (
                                                                <div key={nomeProduto} className="flex items-start gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                                                    <div className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-[10px] font-black shrink-0 mt-0.5">
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
                filtroVendedor={filtroVendedor}
                catalogoGeral={catalogoGeral} // NOVO: Passando a inteligência para a tabela 
            />

        </div>
    );
};

export default AssinaturasPratique;