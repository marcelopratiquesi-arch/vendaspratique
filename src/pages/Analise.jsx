import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js';

const AnaliseDashboard = ({ usuarioLogado, vendas = [], planos = [] }) => {
    // ==========================================
    // 1. NAVEGAÇÃO DE ABAS DO DASHBOARD
    // ==========================================
    const [abaPrincipal, setAbaPrincipal] = useState('dashboard'); // 'dashboard' | 'visaoGeral'

    // ==========================================
    // 2. ESTADOS DO FILTRO INTELIGENTE (CONSERTO P0)
    // ==========================================
    const [tipoFiltro, setTipoFiltro] = useState('mes'); // 'mes', 'periodo', 'dia'
    const [filtroMes, setFiltroMes] = useState('07');
    const [filtroAno, setFiltroAno] = useState('2026');
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [diaEspecifico, setDiaEspecifico] = useState(''); // P0: Nome do setter padronizado
    const [filtroUnidade, setFiltroUnidade] = useState('TODOS');

    // ==========================================
    // NOVO: METAS PERSISTIDAS NO BANCO DE DADOS (P4)
    // ==========================================
    const [metaNutri, setMetaNutri] = useState(50);
    const [metaProdutos, setMetaProdutos] = useState(100);
    const [copiado, setCopiado] = useState(false); // P4: Controle reativo do botão de cópia

    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';
    const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

    // P4: Carrega as metas salvas no banco de dados quando os filtros mudam
    useEffect(() => {
        const fetchMetas = async () => {
            const unidadeAlvo = temVisaoGlobal ? filtroUnidade : usuarioLogado?.unidade;
            if (!unidadeAlvo || unidadeAlvo === 'TODOS') return;

            const { data, error } = await supabase
                .from('metas_unidades')
                .select('*')
                .eq('unidade', unidadeAlvo.toUpperCase())
                .eq('mes', filtroMes)
                .eq('ano', filtroAno)
                .single();

            if (data) {
                setMetaNutri(data.meta_nutri);
                setMetaProdutos(data.meta_produtos);
            } else {
                setMetaNutri(50);
                setMetaProdutos(100);
            }
        };

        if (tipoFiltro === 'mes') {
            fetchMetas();
        }
    }, [filtroMes, filtroAno, filtroUnidade, usuarioLogado, tipoFiltro, temVisaoGlobal]);

    // P4: Salva as alterações de meta dinamicamente no Supabase
    const atualizarMetaNuvem = async (campo, valor) => {
        const unidadeAlvo = temVisaoGlobal ? filtroUnidade : usuarioLogado?.unidade;
        if (!unidadeAlvo || unidadeAlvo === 'TODOS') return;

        const payload = {
            unidade: unidadeAlvo.toUpperCase(),
            mes: filtroMes,
            ano: filtroAno,
            meta_nutri: campo === 'meta_nutri' ? valor : metaNutri,
            meta_produtos: campo === 'meta_produtos' ? valor : metaProdutos
        };

        await supabase.from('metas_unidades').upsert(payload);
    };

    // ==========================================
    // 3. FUNÇÕES E LISTAS AUXILIARES
    // ==========================================
    const meses = [
        { val: 'TODOS', label: 'Todos os Meses' }, { val: '01', label: 'Janeiro' }, { val: '02', label: 'Fevereiro' },
        { val: '03', label: 'Março' }, { val: '04', label: 'Abril' }, { val: '05', label: 'Maio' },
        { val: '06', label: 'Junho' }, { val: '07', label: 'Julho' }, { val: '08', label: 'Agosto' },
        { val: '09', label: 'Setembro' }, { val: '10', label: 'Outubro' }, { val: '11', label: 'Novembro' },
        { val: '12', label: 'Dezembro' }
    ];

    // P1: Mapeamento de anos lê do formato de data nativo YYYY-MM-DD (índice 0)
    const anosUnicos = ['TODOS', ...new Set(vendas.map(v => v.data?.split('-')[0]))].filter(Boolean).sort((a,b) => b-a);
    if(anosUnicos.length === 1) anosUnicos.push(new Date().getFullYear().toString());

    const unidadesUnicas = ['TODOS', ...new Set(vendas.map(v => v.unidade))].filter(Boolean);

    // ==========================================
    // 4. MOTOR DE FILTRAGEM (DATA NATIVA P1)
    // ==========================================
    const vendasFiltradas = vendas.filter(v => {
        if (temVisaoGlobal && filtroUnidade !== 'TODOS' && v.unidade !== filtroUnidade) return false;
        if (!temVisaoGlobal && v.unidade !== usuarioLogado?.unidade) return false;
        if (!v.data) return false;
        
        // v.data já chega como YYYY-MM-DD direto do Postgres
        const [y, m, d] = v.data.split('-');

        if (tipoFiltro === 'mes') {
            const passMes = filtroMes === 'TODOS' || m === filtroMes;
            const passAno = filtroAno === 'TODOS' || y === filtroAno;
            return passMes && passAno;
        } else if (tipoFiltro === 'periodo') {
            const passInicio = !dataInicio || v.data >= dataInicio;
            const passFim = !dataFim || v.data <= dataFim;
            return passInicio && passFim;
        } else if (tipoFiltro === 'dia') {
            return !diaExplicit || v.data === diaEspecifico;
        }
        return true;
    });

    // P4: Função de checagem única e centralizada baseada no catálogo real do banco
    const verificarSeEhPlano = (produtoNome) => {
        if (!produtoNome) return false;
        return planos.some(p => p.nome?.toUpperCase() === produtoNome.toUpperCase());
    };

    // ==========================================
    // 5. PROCESSAMENTO DE DADOS (KPIs BRUTOS)
    // ==========================================
    const familias = { "NUTRI": 0, "PLUS": 0, "FIT": 0, "OUTROS": 0 };
    let totalPlanos = 0; 
    let totalProdutos = 0; 
    let faturamento = 0;
    const rankingProdutos = {}; 
    const rankingConsultores = {};

    vendasFiltradas.forEach(v => {
        const qtd = parseInt(v.quantidade) || 1;
        // P1: Consumo numérico direto da tabela sem replaces ou parsers vulneráveis
        const valorNum = Number(v.valor) || 0;
        faturamento += valorNum;

        if (verificarSeEhPlano(v.produto)) {
            totalPlanos += qtd;
            if (v.produto.includes("NUTRI")) familias["NUTRI"] += qtd;
            else if (v.produto.includes("PLUS")) familias["PLUS"] += qtd;
            else if (v.produto.includes("FIT")) familias["FIT"] += qtd;
            else familias["OUTROS"] += qtd;
        } else {
            totalProdutos += qtd;
            rankingProdutos[v.produto] = (rankingProdutos[v.produto] || 0) + qtd;
        }
        
        rankingConsultores[v.vendedor] = (rankingConsultores[v.vendedor] || 0) + qtd;
    });

    const topProdutos = Object.entries(rankingProdutos).sort((a, b) => b[1] - a[1]);
    const topConsultores = Object.entries(rankingConsultores).sort((a, b) => b[1] - a[1]);
    const totalFamilia = familias["NUTRI"] + familias["PLUS"] + familias["FIT"] + familias["OUTROS"];

    // ---- PROCESSAMENTO UNITÁRIO DE METAS ----
    const listaUnidadesMetas = unidadesUnicas.filter(u => u !== 'TODOS' && (temVisaoGlobal ? true : u === usuarioLogado?.unidade));

    const dadosMetasPorUnidade = listaUnidadesMetas.map(unidade => {
        const vendasDaUnidade = vendasFiltradas.filter(v => v.unidade === unidade);
        
        let nutriRealizado = 0;
        let produtosRealizado = 0;

        vendasDaUnidade.forEach(v => {
            const qtd = parseInt(v.quantidade) || 1;
            if (verificarSeEhPlano(v.produto) && v.produto.includes("NUTRI")) {
                nutriRealizado += qtd;
            } else if (!verificarSeEhPlano(v.produto)) {
                produtosRealizado += qtd;
            }
        });

        const faltaNutri = metaNutri - nutriRealizado;
        const faltaProdutos = metaProdutos - produtosRealizado;

        return {
            unidade,
            nutriRealizado,
            faltaNutri: faltaNutri > 0 ? faltaNutri : 0,
            produtosRealizado,
            faltaProdutos: faltaProdutos > 0 ? faltaProdutos : 0
        };
    });

    // ==========================================
    // 6. COMPARTILHAMENTO HIGIENIZADO (P4)
    // ==========================================
    const copiarParaWhatsApp = () => {
        let labelFiltro = "";
        if (tipoFiltro === 'mes') labelFiltro = `${filtroMes}/${filtroAno}`;
        else if (tipoFiltro === 'periodo') labelFiltro = `${dataInicio} ate ${dataFim}`;
        else if (tipoFiltro === 'dia') labelFiltro = diaEspecifico;

        const infoUnidade = (temVisaoGlobal && filtroUnidade !== 'TODOS') ? ` [${filtroUnidade}]` : '';

        // P4: Remoção total de Emojis para evitar corrupção de encoding no clipboard
        let texto = `--- RANKING DE VENDAS${infoUnidade} (${labelFiltro}) ---\n\n`;
        topConsultores.forEach((item, index) => {
            texto += `${index + 1} Lugar - ${item[0]}: ${item[1]} unidades\n`;
        });
        texto += `\nFaturamento: ${formatMoney(faturamento)}\n`;
        texto += `\nFoco total, equipe!`;
        
        navigator.clipboard.writeText(texto).then(() => {
            setCopiado(true);
            setTimeout(() => setCopiado(false), 3000);
        });
    };

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] max-w-[1400px] mx-auto">
            
            {/* NAVEGAÇÃO DE ABAS */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex justify-between items-center shadow-sm">
                <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full sm:w-auto shadow-inner">
                    <button onClick={() => setAbaPrincipal('dashboard')} className={`flex-1 sm:w-48 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${abaPrincipal === 'dashboard' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        <i data-lucide="layout" className="w-4 h-4"></i> Dashboard Geral
                    </button>
                    <button onClick={() => setAbaPrincipal('visaoGeral')} className={`flex-1 sm:w-48 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${abaPrincipal === 'visaoGeral' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        <i data-lucide="target" className="w-4 h-4"></i> Visão Geral (Metas)
                    </button>
                </div>
            </div>

            {/* ABA 1: DASHBOARD TRADICIONAL COM FILTROS */}
            {abaPrincipal === 'dashboard' && (
                <div className="space-y-6">
                    {/* FILTROS COM CORREÇÕES P0 */}
                    <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-6 md:p-8">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-inner">
                                    <i data-lucide="bar-chart-2" className="w-5 h-5"></i>
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-800 tracking-tight">Análise de Performance</h2>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Visão {temVisaoGlobal ? 'Corporativa' : 'da Unidade'}</p>
                                </div>
                            </div>
                            
                            <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full md:w-auto shadow-inner">
                                <button onClick={() => setTipoFiltro('mes')} className={`flex-1 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoFiltro === 'mes' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>Mês / Ano</button>
                                <button onClick={() => setTipoFiltro('periodo')} className={`flex-1 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoFiltro === 'periodo' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>Período</button>
                                <button onClick={() => setTipoFiltro('dia')} className={`flex-1 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoFiltro === 'dia' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>Dia Único</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            {tipoFiltro === 'mes' && (
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
                                            {anosUnicos.map(a => <option key={a} value={a}>{a}</option>)}
                                        </select>
                                    </div>
                                </>
                            )}

                            {tipoFiltro === 'periodo' && (
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

                            {tipoFiltro === 'dia' && (
                                <div className="sm:col-span-2">
                                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Selecione o Dia</label>
                                    <input type="date" value={diaEspecifico} onChange={(e) => setDiaEspecifico(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer" />
                                </div>
                            )}

                            {temVisaoGlobal && (
                                <div className="sm:col-span-2 lg:col-span-2 animate-[fadeIn_0.3s_ease-out]">
                                    <label className="block text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1.5 ml-1">Isolar Dashboard por Unidade</label>
                                    <select value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)} className="w-full bg-white border border-rose-200 rounded-xl px-3 py-2.5 text-xs font-black focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer uppercase">
                                        {unidadesUnicas.map(u => <option key={u} value={u}>{u === 'TODOS' ? 'VISÃO GLOBAL (TODAS AS UNIDADES)' : u}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* CARDS COM NUMÉRICOS REAIS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-2">Planos Vendidos</p>
                            <p className="text-4xl font-black tracking-tight">{totalPlanos}</p>
                        </div>
                        <div className="bg-gradient-to-br from-amber-500 to-amber-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-2">Produtos Físicos</p>
                            <p className="text-4xl font-black tracking-tight">{totalProdutos}</p>
                        </div>
                        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-2">Itens Totais</p>
                            <p className="text-4xl font-black tracking-tight">{totalPlanos + totalProdutos}</p>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-2">Faturamento Bruto</p>
                            <p className="text-3xl font-black tracking-tight mt-1">{formatMoney(faturamento)}</p>
                        </div>
                    </div>

                    {/* SEÇÕES DE ANÁLISE */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-8 flex flex-col min-h-[400px]">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                                <i data-lucide="pie-chart" className="w-5 h-5 text-blue-500"></i> Família de Planos
                            </h3>
                            <div className="space-y-6 flex-1 flex flex-col justify-center">
                                {Object.entries(familias).map(([nome, qtd]) => {
                                    const perc = totalFamilia > 0 ? (qtd / totalFamilia) * 100 : 0;
                                    let cor = "bg-slate-400";
                                    if(nome==="NUTRI") cor = "bg-emerald-500";
                                    if(nome==="PLUS") cor = "bg-blue-600";
                                    if(nome==="FIT") cor = "bg-indigo-500";
                                    return (
                                        <div key={nome}>
                                            <div className="flex justify-between items-end mb-2 text-xs font-black uppercase tracking-widest text-slate-700">
                                                <span>{nome}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-slate-400">{perc.toFixed(0)}%</span>
                                                    <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">{qtd} un</span>
                                                </div>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner">
                                                <div className={`h-full rounded-full ${cor} shadow-md transition-all duration-1000`} style={{ width: `${perc}%` }}></div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-8 flex flex-col min-h-[400px]">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                                <i data-lucide="package" className="w-5 h-5 text-amber-500"></i> Mix de Produtos
                            </h3>
                            <ul className="space-y-3 overflow-y-auto custom-scrollbar pr-2 flex-1 mt-2">
                                {topProdutos.map((item, idx) => (
                                    <li key={idx} className="flex justify-between items-center p-4 bg-slate-50/80 rounded-xl border border-slate-100">
                                        <span className="text-xs font-black text-slate-700 uppercase flex items-center gap-3">
                                            <span className="text-slate-400 font-bold w-4">{idx + 1}º</span>
                                            {item[0]}
                                        </span>
                                        <span className="bg-white border border-slate-200 text-slate-600 text-[10px] font-black tracking-widest px-3 py-1 rounded-md">{item[1]} un</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-8 flex flex-col min-h-[400px]">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                                <i data-lucide="medal" className="w-5 h-5 text-emerald-500"></i> Pódio da Equipe
                            </h3>
                            <ul className="space-y-3 overflow-y-auto custom-scrollbar pr-2 flex-1 mt-2">
                                {topConsultores.map((item, idx) => (
                                    <li key={idx} className="flex justify-between items-center p-4 bg-slate-50/80 rounded-xl border border-slate-100">
                                        <span className="text-xs font-black text-slate-800 uppercase flex items-center gap-3">
                                            <span className="text-slate-400 font-bold w-4">{idx + 1}º</span>
                                            {item[0]}
                                        </span>
                                        <span className="bg-blue-50 border border-blue-100 text-blue-700 text-xs font-black px-3 py-1 rounded-md">{item[1]} un</span>
                                    </li>
                                ))}
                            </ul>
                            
                            {/* P4: Manipulação reativa sem tocar no DOM */}
                            <button onClick={copiarParaWhatsApp} disabled={topConsultores.length === 0} className={`mt-4 w-full text-white text-xs font-black uppercase tracking-widest py-4 rounded-xl shadow-md transition-all flex justify-center items-center gap-2 ${copiado ? 'bg-emerald-600' : 'bg-slate-800 hover:bg-slate-900'}`}>
                                <i data-lucide={copiado ? "check" : "share-2"} className="w-4 h-4"></i> 
                                {copiado ? 'Copiado Limpo!' : 'Copiar Pódio Sem Emojis'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ABA 2: RELATÓRIO GERAL COM METAS REATIVAS E PERSISTIDAS */}
            {abaPrincipal === 'visaoGeral' && (
                <div className="space-y-6">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">Ajustar Metas do Período Atual</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Alvo: Consultas / Planos Nutri</label>
                                <input 
                                    type="number" 
                                    value={metaNutri} 
                                    onChange={(e) => { const val = parseInt(e.target.value) || 0; setMetaNutri(val); atualizarMetaNuvem('meta_nutri', val); }} 
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-slate-800"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Alvo: Mix de Produtos Físicos</label>
                                <input 
                                    type="number" 
                                    value={metaProdutos} 
                                    onChange={(e) => { const val = parseInt(e.target.value) || 0; setMetaProdutos(val); atualizarMetaNuvem('meta_produtos', val); }} 
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-slate-800"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-left border-collapse min-w-max">
                            <thead>
                                <tr className="bg-slate-50/50">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Unidade</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-emerald-600 uppercase tracking-widest border-b border-slate-200 text-center w-64">Planos Nutri</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-amber-600 uppercase tracking-widest border-b border-slate-200 text-center w-64">Produtos Físicos</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {dadosMetasPorUnidade.map((item, index) => (
                                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-5 text-sm font-black text-slate-800 uppercase">{item.unidade}</td>
                                        <td className="px-6 py-5 text-center text-xs font-bold bg-emerald-50/5">
                                            {item.nutriRealizado} / {metaNutri} un {item.faltaNutri === 0 ? <span className="text-emerald-600 font-black ml-2">[METAA BATIDA]</span> : <span className="text-slate-400 font-normal ml-2">(Faltam {item.faltaNutri})</span>}
                                        </td>
                                        <td className="px-6 py-5 text-center text-xs font-bold bg-amber-50/5">
                                            {item.produtosRealizado} / {metaProdutos} un {item.faltaProdutos === 0 ? <span className="text-emerald-600 font-black ml-2">[META BATIDA]</span> : <span className="text-slate-400 font-normal ml-2">(Faltam {item.faltaProdutos})</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnaliseDashboard;