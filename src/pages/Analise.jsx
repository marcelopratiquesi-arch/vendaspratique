import React, { useState, useEffect } from 'react';

// ATENÇÃO: Recebendo a prop usuarioLogado aqui!
const AnaliseDashboard = ({ usuarioLogado, vendas = [], planos = [] }) => {
    // ==========================================
    // 1. ESTADOS DO FILTRO INTELIGENTE
    // ==========================================
    const [tipoFiltro, setTipoFiltro] = useState('mes'); // 'mes', 'periodo', 'dia'

    // Filtro Mês/Ano
    const [filtroMes, setFiltroMes] = useState('07');
    const [filtroAno, setFiltroAno] = useState('2026');

    // Filtro Período
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');

    // Filtro Dia Específico
    const [diaEspecifico, setDiaEspecifico] = useState('');
    
    // NOVO: Filtro de Unidade para a Diretoria
    const [filtroUnidade, setFiltroUnidade] = useState('TODOS');

    // Verifica se o usuário atual possui cargo de gestão corporativa
    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [vendas, tipoFiltro, filtroMes, filtroAno, dataInicio, dataFim, diaEspecifico, filtroUnidade, usuarioLogado]);

    // ==========================================
    // 2. FUNÇÕES E LISTAS AUXILIARES
    // ==========================================
    const meses = [
        { val: 'TODOS', label: 'Todos os Meses' }, { val: '01', label: 'Janeiro' }, { val: '02', label: 'Fevereiro' },
        { val: '03', label: 'Março' }, { val: '04', label: 'Abril' }, { val: '05', label: 'Maio' },
        { val: '06', label: 'Junho' }, { val: '07', label: 'Julho' }, { val: '08', label: 'Agosto' },
        { val: '09', label: 'Setembro' }, { val: '10', label: 'Outubro' }, { val: '11', label: 'Novembro' },
        { val: '12', label: 'Dezembro' }
    ];

    const anosUnicos = ['TODOS', ...new Set(vendas.map(v => v.data?.split('/')[2]))].filter(Boolean).sort((a,b) => b-a);
    if(anosUnicos.length === 1) anosUnicos.push(new Date().getFullYear().toString());

    // Lista de unidades dinâmicas para o filtro
    const unidadesUnicas = ['TODOS', ...new Set(vendas.map(v => v.unidade))].filter(Boolean);

    // ==========================================
    // 3. MOTOR DE FILTRAGEM
    // ==========================================
    const vendasFiltradas = vendas.filter(v => {
        // NOVO: Filtro de Unidade (Ativo apenas se for Admin/Mentor)
        if (temVisaoGlobal && filtroUnidade !== 'TODOS' && v.unidade !== filtroUnidade) return false;

        if (!v.data) return false;
        
        const [d, m, y] = v.data.split('/');
        const isoDate = `${y}-${m}-${d}`;

        if (tipoFiltro === 'mes') {
            const passMes = filtroMes === 'TODOS' || m === filtroMes;
            const passAno = filtroAno === 'TODOS' || y === filtroAno;
            return passMes && passAno;
        } else if (tipoFiltro === 'periodo') {
            const passInicio = !dataInicio || isoDate >= dataInicio;
            const passFim = !dataFim || isoDate <= dataFim;
            return passInicio && passFim;
        } else if (tipoFiltro === 'dia') {
            return !diaEspecifico || isoDate === diaEspecifico;
        }
        return true;
    });

    // ==========================================
    // 4. PROCESSAMENTO DE DADOS (KPIs)
    // ==========================================
    const familias = { "NUTRI": 0, "PLUS": 0, "FIT": 0, "OUTROS": 0 };
    let totalPlanos = 0; 
    let totalProdutos = 0; 
    let faturamento = 0;
    const rankingProdutos = {}; 
    const rankingConsultores = {};

    vendasFiltradas.forEach(v => {
        const qtd = parseInt(v.quantidade) || 1;
        const valorNum = parseFloat(v.valor?.replace('R$', '').replace(/\./g, '').replace(',', '.')) || 0;
        faturamento += valorNum;

        const isPlano = (planos && planos.some(p => p.nome === v.produto)) || v.produto?.includes("FIT") || v.produto?.includes("PLUS") || v.produto?.includes("NUTRI");

        if (isPlano) {
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

    // ==========================================
    // 5. FUNÇÃO DO WHATSAPP
    // ==========================================
    const copiarParaWhatsApp = () => {
        let labelFiltro = "";
        if (tipoFiltro === 'mes') labelFiltro = `${filtroMes}/${filtroAno}`;
        else if (tipoFiltro === 'periodo') labelFiltro = `${dataInicio.split('-').reverse().join('/')} a ${dataFim.split('-').reverse().join('/')}`;
        else if (tipoFiltro === 'dia') labelFiltro = diaEspecifico.split('-').reverse().join('/');

        // Adiciona a unidade no texto do WhatsApp se for global e tiver filtrado
        const infoUnidade = (temVisaoGlobal && filtroUnidade !== 'TODOS') ? ` [${filtroUnidade}]` : '';

        let texto = `*🏆 PÓDIO DE VENDAS${infoUnidade} (${labelFiltro}) 🏆*\n\n`;
        topConsultores.forEach((item, index) => {
            const medalha = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🏅";
            texto += `${medalha} *${item[0]}*: ${item[1]} unidades\n`;
        });
        texto += `\nFaturamento: *${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(faturamento)}*\n`;
        texto += `\n💪 Bora pra cima equipe!`;
        
        navigator.clipboard.writeText(texto).then(() => {
            const btn = document.getElementById('btn-copy');
            const textoOriginal = btn.innerHTML;
            btn.innerHTML = '<i data-lucide="check" class="w-5 h-5 inline mr-2"></i> Copiado!';
            btn.classList.replace('bg-slate-800', 'bg-emerald-600');
            if(window.lucide) window.lucide.createIcons();
            setTimeout(() => {
                btn.innerHTML = textoOriginal;
                btn.classList.replace('bg-emerald-600', 'bg-slate-800');
                if(window.lucide) window.lucide.createIcons();
            }, 3000);
        });
    };

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] max-w-[1400px] mx-auto">
            
            {/* ========================================== */}
            {/* BLOCO 1: FILTRO INTELIGENTE E EXECUTIVO */}
            {/* ========================================== */}
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
                    
                    {/* Seletor de Tipo de Data */}
                    <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full md:w-auto shadow-inner">
                        <button onClick={() => setTipoFiltro('mes')} className={`flex-1 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoFiltro === 'mes' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                            Mês / Ano
                        </button>
                        <button onClick={() => setTipoFiltro('periodo')} className={`flex-1 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoFiltro === 'periodo' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                            Período
                        </button>
                        <button onClick={() => setTipoFiltro('dia')} className={`flex-1 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoFiltro === 'dia' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                            Dia Único
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    
                    {/* Inputs de Data Dinâmicos */}
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

                    {/* FILTRO EXTRA DE UNIDADE PARA A DIRETORIA */}
                    {temVisaoGlobal && (
                        <div className="sm:col-span-2 lg:col-span-2 animate-[fadeIn_0.3s_ease-out]">
                            <label className="block text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1.5 ml-1">Isolar Dashboard por Unidade</label>
                            <select value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)} className="w-full bg-rose-50/20 border border-rose-200 text-rose-800 rounded-xl px-3 py-2.5 text-xs font-black focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer uppercase">
                                {unidadesUnicas.map(u => <option key={u} value={u}>{u === 'TODOS' ? 'VISÃO GLOBAL (TODAS AS UNIDADES)' : u}</option>)}
                            </select>
                        </div>
                    )}

                </div>
            </div>

            {/* ========================================== */}
            {/* BLOCO 2: CARDS DE KPI (Diretos e Claros) */}
            {/* ========================================== */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-transform">
                    <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform"><i data-lucide="clipboard-check" className="w-32 h-32"></i></div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-2">Planos Vendidos</p>
                    <p className="text-4xl font-black tracking-tight">{totalPlanos}</p>
                </div>

                <div className="bg-gradient-to-br from-amber-500 to-amber-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-transform">
                    <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform"><i data-lucide="package" className="w-32 h-32"></i></div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-2">Produtos Físicos</p>
                    <p className="text-4xl font-black tracking-tight">{totalProdutos}</p>
                </div>

                <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-transform">
                    <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform"><i data-lucide="shopping-bag" className="w-32 h-32"></i></div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-2">Itens Totais</p>
                    <p className="text-4xl font-black tracking-tight">{totalPlanos + totalProdutos}</p>
                </div>

                <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-transform">
                    <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform"><i data-lucide="dollar-sign" className="w-32 h-32"></i></div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-2">Faturamento Bruto</p>
                    <p className="text-3xl font-black tracking-tight mt-1">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(faturamento)}</p>
                </div>

            </div>

            {/* ========================================== */}
            {/* BLOCO 3: ANÁLISES DETALHADAS */}
            {/* ========================================== */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* Família de Planos */}
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

                {/* Mix de Produtos */}
                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-8 flex flex-col min-h-[400px]">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                        <i data-lucide="package" className="w-5 h-5 text-amber-500"></i> Mix de Produtos
                    </h3>
                    <ul className="space-y-3 overflow-y-auto custom-scrollbar pr-2 flex-1 mt-2">
                        {topProdutos.length > 0 ? topProdutos.map((item, idx) => (
                            <li key={idx} className="flex justify-between items-center p-4 bg-slate-50/80 rounded-xl border border-slate-100 transition-colors hover:bg-slate-100">
                                <span className="text-xs font-black text-slate-700 uppercase flex items-center gap-3">
                                    <span className="text-slate-400 font-bold w-4">{idx + 1}º</span>
                                    {item[0]}
                                </span>
                                <span className="bg-white border border-slate-200 text-slate-600 text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-md shadow-sm">{item[1]} un</span>
                            </li>
                        )) : <li className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center py-16 opacity-60">Nenhum produto físico vendido</li>}
                    </ul>
                </div>

                {/* Pódio de Vendas */}
                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-8 flex flex-col min-h-[400px]">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                        <i data-lucide="medal" className="w-5 h-5 text-emerald-500"></i> Pódio da Equipe
                    </h3>
                    <ul className="space-y-3 overflow-y-auto custom-scrollbar pr-2 flex-1 mt-2">
                        {topConsultores.length > 0 ? topConsultores.map((item, idx) => {
                            let icon = <span className="text-slate-400 font-bold text-sm w-4">{idx + 1}º</span>;
                            if(idx === 0) icon = <span className="text-2xl drop-shadow-sm" title="1º Lugar">🥇</span>;
                            else if(idx === 1) icon = <span className="text-2xl drop-shadow-sm" title="2º Lugar">🥈</span>;
                            else if(idx === 2) icon = <span className="text-2xl drop-shadow-sm" title="3º Lugar">🥉</span>;

                            return (
                                <li key={idx} className="flex justify-between items-center p-4 bg-slate-50/80 rounded-xl border border-slate-100 transition-colors hover:bg-slate-100">
                                    <span className="text-xs font-black text-slate-800 uppercase flex items-center gap-3">
                                        {icon}
                                        {item[0]}
                                    </span>
                                    <span className="bg-blue-50 border border-blue-100 text-blue-700 text-xs font-black px-3 py-1 rounded-md shadow-sm">{item[1]} un</span>
                                </li>
                            )
                        }) : <li className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center py-16 opacity-60">Sem vendas processadas</li>}
                    </ul>
                    
                    <button id="btn-copy" onClick={copiarParaWhatsApp} disabled={topConsultores.length === 0} className="mt-4 w-full bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest py-4 px-4 rounded-xl shadow-md transition-all flex justify-center items-center gap-2">
                        <i data-lucide="share-2" className="w-4 h-4"></i> Copiar Pódio (WhatsApp)
                    </button>
                </div>

            </div>
        </div>
    );
};

export default AnaliseDashboard;