import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js';

const AnaliseDashboard = ({ usuarioLogado, vendas = [], planos = [], produtos = [], colaboradores = [] }) => {
    // ==========================================
    // 1. ESTADOS DE NAVEGAÇÃO E MODAIS
    // ==========================================
    const [abaPrincipal, setAbaPrincipal] = useState('dashboard'); 
    const [tipoFiltro, setTipoFiltro] = useState('mes'); 
    const [filtroMes, setFiltroMes] = useState(new Date().getMonth() + 1 < 10 ? `0${new Date().getMonth() + 1}` : `${new Date().getMonth() + 1}`);
    const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [diaEspecifico, setDiaEspecifico] = useState(new Date().toISOString().split('T')[0]); 
    const [filtroUnidade, setFiltroUnidade] = useState('TODOS');

    // Estado para controlar qual grupo de planos está expandido na tela
    const [grupoExpandido, setGrupoExpandido] = useState(null);

    // Metas Persistidas na Nuvem
    const [metaNutri, setMetaNutri] = useState(50);
    const [metaProdutos, setMetaProdutos] = useState(100);
    const [metaPersonal, setMetaPersonal] = useState(0);
    const [isSalvandoMetas, setIsSalvandoMetas] = useState(false);

    // Controle de Modal de Edição de Texto para WhatsApp
    const [isModalTextoOpen, setIsModalTextoOpen] = useState(false);
    const [textoEditavel, setTextoEditavel] = useState('');
    const [copiadoSucesso, setCopiadoSucesso] = useState(false);

    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';
    const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

    // ==========================================
    // TRADUTORES UNIVERSAIS
    // ==========================================
    const safeNumber = (val) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        const str = String(val);
        if (str.includes(',')) return parseFloat(str.replace(/[^0-9,-]+/g, '').replace(',', '.')) || 0;
        return parseFloat(str.replace(/[^0-9.-]+/g, '')) || 0;
    };

    const safeIsoDate = (dStr) => {
        if (!dStr) return '';
        if (dStr.includes('-')) return dStr.split('T')[0]; 
        if (dStr.includes('/')) {
            const [d, m, y] = dStr.split('/');
            return `${y}-${m}-${d}`; 
        }
        return dStr;
    };

    const getValorRealDaVenda = (venda) => {
        const valorBanco = safeNumber(venda.valor);
        if (valorBanco > 0) return valorBanco; 

        let precoUnitario = 0;
        const planoMatch = planos.find(p => p.nome?.toUpperCase() === venda.produto?.toUpperCase());
        const produtoMatch = produtos.find(p => p.nome?.toUpperCase() === venda.produto?.toUpperCase());
        
        if (planoMatch) precoUnitario = safeNumber(planoMatch.valor);
        else if (produtoMatch) precoUnitario = safeNumber(produtoMatch.valor);
        
        const qtd = parseInt(venda.quantidade) || 1;
        return precoUnitario * qtd;
    };

    // ==========================================
    // LISTAS AUXILIARES
    // ==========================================
    const meses = [
        { val: 'TODOS', label: 'Todos os Meses' }, { val: '01', label: 'Janeiro' }, { val: '02', label: 'Fevereiro' },
        { val: '03', label: 'Março' }, { val: '04', label: 'Abril' }, { val: '05', label: 'Maio' },
        { val: '06', label: 'Junho' }, { val: '07', label: 'Julho' }, { val: '08', label: 'Agosto' },
        { val: '09', label: 'Setembro' }, { val: '10', label: 'Outubro' }, { val: '11', label: 'Novembro' },
        { val: '12', label: 'Dezembro' }
    ];

    const anosUnicos = ['TODOS', ...new Set(vendas.map(v => safeIsoDate(v.data).split('-')[0]))].filter(Boolean).sort((a,b) => b-a);
    if(anosUnicos.length === 1) anosUnicos.push(new Date().getFullYear().toString());

    const unidadesUnicas = ['TODOS', ...new Set(vendas.map(v => v.unidade))].filter(Boolean);

    // ==========================================
    // GESTÃO DE METAS NO BANCO
    // ==========================================
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
                .maybeSingle(); 

            if (data) {
                setMetaNutri(data.meta_nutri || 0);
                setMetaProdutos(data.meta_produtos || 0);
                setMetaPersonal(data.meta_personal || 0);
            } else {
                setMetaNutri(50); setMetaProdutos(100); setMetaPersonal(0);
            }
        };

        if (tipoFiltro === 'mes') fetchMetas();
    }, [filtroMes, filtroAno, filtroUnidade, usuarioLogado, tipoFiltro, temVisaoGlobal]);

    const salvarMetasNuvem = async () => {
        const unidadeAlvo = temVisaoGlobal ? filtroUnidade : usuarioLogado?.unidade;
        if (!unidadeAlvo || unidadeAlvo === 'TODOS') {
            alert("Atenção: Selecione uma unidade específica no filtro acima para poder salvar as metas.");
            return;
        }

        setIsSalvandoMetas(true);
        const payload = {
            unidade: unidadeAlvo.toUpperCase(),
            mes: filtroMes,
            ano: filtroAno,
            meta_nutri: metaNutri,
            meta_produtos: metaProdutos,
            meta_personal: metaPersonal
        };

        const { error } = await supabase.from('metas_unidades').upsert(payload, { onConflict: 'unidade,mes,ano' });
        setIsSalvandoMetas(false);

        if (error) {
            console.error("Erro no banco:", error);
            alert("Erro ao salvar as metas no banco de dados.");
        } else {
            alert("Metas atualizadas com sucesso!");
        }
    };

    // ==========================================
    // MOTOR DE FILTRAGEM E RANKING
    // ==========================================
    const vendasFiltradas = vendas.filter(v => {
        if (temVisaoGlobal && filtroUnidade !== 'TODOS' && v.unidade !== filtroUnidade) return false;
        if (!temVisaoGlobal && v.unidade !== usuarioLogado?.unidade) return false;
        if (!v.data) return false;
        
        const isoDate = safeIsoDate(v.data);
        const partes = isoDate.split('-');
        if (partes.length !== 3) return false;
        const [y, m, d] = partes;

        if (tipoFiltro === 'mes') {
            return (filtroMes === 'TODOS' || m === filtroMes) && (filtroAno === 'TODOS' || y === filtroAno);
        } else if (tipoFiltro === 'periodo') {
            return (!dataInicio || isoDate >= dataInicio) && (!dataFim || isoDate <= dataFim);
        } else if (tipoFiltro === 'dia') {
            return !diaEspecifico || isoDate === diaEspecifico;
        }
        return true;
    });

    const verificarSeEhPlano = (produtoNome) => {
        if (!produtoNome) return false;
        return planos.some(p => p.nome?.toUpperCase() === produtoNome.toUpperCase());
    };

    // Processamento de Métricas
    const rankingConsultoresFisicos = {};
    const unidadeAtual = temVisaoGlobal ? filtroUnidade : usuarioLogado?.unidade;
    
    const equipeLocal = colaboradores.filter(c => 
        unidadeAtual === 'TODOS' ? true : c.unidade?.toUpperCase() === unidadeAtual?.toUpperCase()
    );

    equipeLocal.forEach(colab => { rankingConsultoresFisicos[colab.nome.toUpperCase()] = 0; });

    let totalVendasProdutos = 0;
    let totalPlanos = 0;
    let faturamento = 0;
    const rankingProdutosFisicos = {};

    // Estrutura inteligente de Agrupamento: Nutri, Plus, Fit fixos. O resto entra solto.
    const gruposPlanos = {
        "NUTRI": { total: 0, detalhes: {}, cor: "bg-emerald-500", textCor: "text-emerald-600" },
        "PLUS": { total: 0, detalhes: {}, cor: "bg-blue-600", textCor: "text-blue-700" },
        "FIT": { total: 0, detalhes: {}, cor: "bg-indigo-500", textCor: "text-indigo-600" }
    };

    vendasFiltradas.forEach(v => {
        const qtd = parseInt(v.quantidade) || 1;
        faturamento += getValorRealDaVenda(v);
        const prodUpper = (v.produto || '').toUpperCase();

        if (verificarSeEhPlano(v.produto)) {
            totalPlanos += qtd;
            
            if (prodUpper.includes("NUTRI")) {
                gruposPlanos["NUTRI"].total += qtd;
                gruposPlanos["NUTRI"].detalhes[prodUpper] = (gruposPlanos["NUTRI"].detalhes[prodUpper] || 0) + qtd;
            } else if (prodUpper.includes("PLUS")) {
                gruposPlanos["PLUS"].total += qtd;
                gruposPlanos["PLUS"].detalhes[prodUpper] = (gruposPlanos["PLUS"].detalhes[prodUpper] || 0) + qtd;
            } else if (prodUpper.includes("FIT")) {
                gruposPlanos["FIT"].total += qtd;
                gruposPlanos["FIT"].detalhes[prodUpper] = (gruposPlanos["FIT"].detalhes[prodUpper] || 0) + qtd;
            } else {
                // Se não é Nutri, Plus ou Fit, vai direto solto pro objeto!
                if (!gruposPlanos[prodUpper]) {
                    gruposPlanos[prodUpper] = { total: 0, detalhes: {}, cor: "bg-slate-500", textCor: "text-slate-700" };
                }
                gruposPlanos[prodUpper].total += qtd;
                gruposPlanos[prodUpper].detalhes[prodUpper] = (gruposPlanos[prodUpper].detalhes[prodUpper] || 0) + qtd;
            }

        } else {
            totalVendasProdutos += qtd;
            rankingProdutosFisicos[prodUpper] = (rankingProdutosFisicos[prodUpper] || 0) + qtd;
            
            const vendUpper = (v.vendedor || '').toUpperCase();
            if (rankingConsultoresFisicos[vendUpper] !== undefined) {
                rankingConsultoresFisicos[vendUpper] += qtd;
            } else {
                rankingConsultoresFisicos[vendUpper] = qtd;
            }
        }
    });

    const topProdutosLista = Object.entries(rankingProdutosFisicos).sort((a, b) => b[1] - a[1]);
    const rankingOrdenado = Object.entries(rankingConsultoresFisicos).sort((a, b) => b[1] - a[1]);

    const toggleGrupoPlanos = (nomeGrupo) => {
        setGrupoExpandido(prev => prev === nomeGrupo ? null : nomeGrupo);
    };

    // Visão Geral - Lógica de Metas
    const listaUnidadesMetas = unidadesUnicas.filter(u => u !== 'TODOS' && (temVisaoGlobal ? true : u === usuarioLogado?.unidade));
    
    const dadosMetasPorUnidade = listaUnidadesMetas.map(unidade => {
        const vendasDaUnidade = vendasFiltradas.filter(v => v.unidade === unidade);
        let nutriRealizado = 0; 
        let produtosRealizado = 0;
        let personalRealizado = 0;

        vendasDaUnidade.forEach(v => {
            const qtd = parseInt(v.quantidade) || 1;
            const prodUpper = (v.produto || '').toUpperCase();

            if (verificarSeEhPlano(v.produto)) {
                if (prodUpper.includes("NUTRI")) nutriRealizado += qtd;
                if (prodUpper.includes("PERSONAL")) personalRealizado += qtd;
            } else {
                produtosRealizado += qtd;
            }
        });

        return {
            unidade, 
            nutriRealizado, 
            produtosRealizado, 
            personalRealizado,
            faltaNutri: Math.max(metaNutri - nutriRealizado, 0),
            faltaProdutos: Math.max(metaProdutos - produtosRealizado, 0),
            faltaPersonal: Math.max(metaPersonal - personalRealizado, 0)
        };
    });

    // ==========================================
    // LÓGICA DA MENSAGEM DO WHATSAPP
    // ==========================================
    const dispararModalCompartilhar = () => {
        let labelFiltro = tipoFiltro === 'mes' ? `${filtroMes}/${filtroAno}` : tipoFiltro === 'dia' ? diaEspecifico.split('-').reverse().join('/') : `${dataInicio} a ${dataFim}`;
        
        let txt = `*🏆 Ranking de Vendas de Produtos 🏆*\n`;
        txt += `*Total de Vendas:* ${String(totalVendasProdutos).padStart(2, '0')} / ${String(metaProdutos).padStart(2, '0')}\n\n`;

        const vendidos = rankingOrdenado.filter(item => item[1] > 0);
        const zerados = rankingOrdenado.filter(item => item[1] === 0);

        vendidos.forEach((item, idx) => {
            const nome = item[0].split(' ')[0]; 
            const qtd = item[1];
            let emoji = "🟢❌❌";
            if (qtd === 2) emoji = "🟢🟢❌";
            else if (qtd === 3) emoji = "✅✅✅";
            else if (qtd > 3) emoji = "🔝🔝🔝";
            
            txt += `${idx + 1} ${emoji} ${nome} ${String(qtd).padStart(2, '0')}\n`;
        });

        if (zerados.length > 0) {
            txt += `\n➖➖➖➖➖➖➖➖➖➖\n`;
            txt += `*🚨 BORA ACELERAR, GALERA! 🚀*\n`;
            txt += `_Todos abaixo ainda não pontuaram hoje._\n`;
            txt += `*SOCORRO, DEUS!!! 🙏*\n\n`;
            
            zerados.forEach((item, idx) => {
                txt += `${vendidos.length + idx + 1} ❌❌❌ ${item[0].split(' ')[0]} 00\n`;
            });
        }

        setTextoEditavel(txt);
        setIsModalTextoOpen(true);
    };

    const copiarTextoFinalDoModal = () => {
        navigator.clipboard.writeText(textoEditavel).then(() => {
            setCopiadoSucesso(true);
            setTimeout(() => {
                setCopiadoSucesso(false);
                setIsModalTextoOpen(false);
            }, 2000);
        });
    };

    const enviarWhatsApp = () => {
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(textoEditavel)}`;
        window.open(url, '_blank');
    };

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [vendas, tipoFiltro, filtroMes, filtroAno, dataInicio, dataFim, diaEspecifico, filtroUnidade, usuarioLogado, abaPrincipal, isModalTextoOpen, copiadoSucesso, grupoExpandido]);

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] max-w-[1400px] mx-auto">
            
            {/* MODAL EDITÁVEL DE TEXTO DO ZAP */}
            {isModalTextoOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col h-[600px] border border-slate-200">
                        <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
                                    <i data-lucide="send" className="w-5 h-5 text-emerald-400"></i>
                                </div>
                                <h3 className="text-lg font-black uppercase tracking-tighter">Ranking para Grupo</h3>
                            </div>
                            <button onClick={() => setIsModalTextoOpen(false)} className="hover:rotate-90 transition-transform"><i data-lucide="x" className="w-6 h-6"></i></button>
                        </div>
                        <div className="p-6 flex-1 bg-slate-50">
                            <textarea 
                                value={textoEditavel} 
                                onChange={(e) => setTextoEditavel(e.target.value)} 
                                className="w-full h-full p-5 bg-white border border-slate-200 rounded-2xl outline-none font-mono text-sm text-slate-700 resize-none shadow-inner focus:ring-2 focus:ring-emerald-500/20 transition-all"
                            ></textarea>
                        </div>
                        <div className="p-6 border-t bg-white grid grid-cols-3 gap-3">
                            <button onClick={() => setIsModalTextoOpen(false)} className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors">Fechar</button>
                            
                            <button onClick={copiarTextoFinalDoModal} 
                                className={`px-4 py-3 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2 ${copiadoSucesso ? 'bg-emerald-500' : 'bg-blue-600 hover:bg-blue-700'}`}>
                                <i data-lucide={copiadoSucesso ? "check" : "copy"} className="w-4 h-4"></i> {copiadoSucesso ? 'Copiado!' : 'Copiar'}
                            </button>

                            <button onClick={enviarWhatsApp} className="px-4 py-3 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-md flex items-center justify-center gap-2">
                                <i data-lucide="message-circle" className="w-4 h-4"></i> Enviar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SELETOR DE ABA */}
            <div className="bg-white rounded-[24px] border border-slate-200 p-4 flex justify-between items-center shadow-sm">
                <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full sm:w-auto">
                    <button onClick={() => setAbaPrincipal('dashboard')} className={`flex-1 sm:w-48 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${abaPrincipal === 'dashboard' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}>
                        <i data-lucide="bar-chart-3" className="w-4 h-4"></i> Dashboard
                    </button>
                    <button onClick={() => setAbaPrincipal('visaoGeral')} className={`flex-1 sm:w-48 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${abaPrincipal === 'visaoGeral' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}>
                        <i data-lucide="target" className="w-4 h-4"></i> Metas Unidade
                    </button>
                </div>
            </div>

            {abaPrincipal === 'dashboard' && (
                <div className="space-y-6">
                    {/* FILTROS */}
                    <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-6 md:p-8">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-inner">
                                    <i data-lucide="filter" className="w-5 h-5"></i>
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-800 tracking-tight">Filtros de Análise</h2>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Visão {temVisaoGlobal ? 'Corporativa' : 'da Unidade'}</p>
                                </div>
                            </div>
                            
                            <div className="flex bg-slate-100 p-1.5 rounded-xl border w-full md:w-auto">
                                <button onClick={() => setTipoFiltro('mes')} className={`flex-1 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoFiltro === 'mes' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500'}`}>Mês</button>
                                <button onClick={() => setTipoFiltro('periodo')} className={`flex-1 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoFiltro === 'periodo' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500'}`}>Período</button>
                                <button onClick={() => setTipoFiltro('dia')} className={`flex-1 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoFiltro === 'dia' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500'}`}>Dia</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            {tipoFiltro === 'mes' && (
                                <>
                                    <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500">{meses.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}</select>
                                    <select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)} className="bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500">{anosUnicos.map(a => <option key={a} value={a}>{a}</option>)}</select>
                                </>
                            )}
                            {tipoFiltro === 'periodo' && (
                                <>
                                    <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" />
                                    <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" />
                                </>
                            )}
                            {tipoFiltro === 'dia' && <input type="date" value={diaEspecifico} onChange={(e) => setDiaEspecifico(e.target.value)} className="bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 w-full sm:col-span-2" />}
                            
                            {temVisaoGlobal && (
                                <select value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)} className="bg-rose-50/30 border border-rose-100 text-rose-700 rounded-xl p-3 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-rose-500">
                                    {unidadesUnicas.map(u => <option key={u} value={u}>{u === 'TODOS' ? 'VISÃO GLOBAL' : u}</option>)}
                                </select>
                            )}
                        </div>
                    </div>

                    {/* CARDS COM MATEMÁTICA RECUPERADA */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-2">Planos Vendidos</p>
                            <p className="text-4xl font-black tracking-tight">{totalPlanos}</p>
                        </div>
                        <div className="bg-gradient-to-br from-amber-500 to-amber-700 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-2">Produtos Físicos</p>
                            <p className="text-4xl font-black tracking-tight">{totalVendasProdutos}</p>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-2">Faturamento Bruto</p>
                            <p className="text-3xl font-black tracking-tight mt-1">{formatMoney(faturamento)}</p>
                        </div>
                    </div>

                    {/* DASHBOARD GRIDS */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* NOVO ACORDEÃO HIERÁRQUICO DE PLANOS E LISTAGEM LIVRE */}
                        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-8 h-[450px] flex flex-col">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b pb-4">
                                <i data-lucide="layers" className="w-5 h-5 text-blue-500"></i> Planos
                            </h3>
                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                                {Object.entries(gruposPlanos).filter(([_, data]) => data.total > 0).map(([nomeGrupo, data]) => {
                                    const perc = totalPlanos > 0 ? (data.total / totalPlanos) * 100 : 0;
                                    
                                    // Regra: Se a gaveta só tem 1 item E o nome desse item é o mesmo nome do grupo, não precisa expandir. Mostra ele solto!
                                    const isSingleLooseItem = Object.keys(data.detalhes).length === 1 && Object.keys(data.detalhes)[0] === nomeGrupo;
                                    const isExpanded = grupoExpandido === nomeGrupo && !isSingleLooseItem;

                                    return (
                                        <div key={nomeGrupo} className="group flex flex-col gap-1 border border-slate-100 rounded-xl p-3 bg-slate-50 transition-all">
                                            <div 
                                                className={`flex justify-between items-center select-none ${!isSingleLooseItem ? 'cursor-pointer' : ''}`}
                                                onClick={() => !isSingleLooseItem && toggleGrupoPlanos(nomeGrupo)}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {!isSingleLooseItem ? (
                                                        <i data-lucide={isExpanded ? "chevron-up" : "chevron-down"} className="w-4 h-4 text-slate-400"></i>
                                                    ) : (
                                                        <div className="w-1 h-1 rounded-full bg-slate-400 ml-1.5 mr-1.5"></div>
                                                    )}
                                                    <span className={`text-[11px] font-black uppercase tracking-wider ${data.textCor}`}>{nomeGrupo}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-400 text-[10px] font-bold">{perc.toFixed(0)}%</span>
                                                    <span className="bg-white px-2 py-0.5 rounded text-[10px] border shadow-sm font-black">{data.total} un</span>
                                                </div>
                                            </div>
                                            
                                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                                                <div className={`h-full rounded-full transition-all duration-700 ease-out ${data.cor}`} style={{ width: `${perc}%` }}></div>
                                            </div>

                                            {/* Sub-lista Acordeão (apenas se for Nutri, Fit, Plus, etc.) */}
                                            {isExpanded && (
                                                <div className="mt-3 pt-3 border-t border-slate-200 space-y-2 animate-[fadeIn_0.2s_ease-out]">
                                                    {Object.entries(data.detalhes).sort((a,b)=>b[1]-a[1]).map(([nomePlano, qtdPlano]) => (
                                                        <div key={nomePlano} className="flex justify-between items-center text-[9px] font-bold text-slate-600 uppercase">
                                                            <span className="truncate max-w-[180px] pl-2 border-l-2 border-slate-300">{nomePlano}</span>
                                                            <span className="bg-white border border-slate-100 px-1.5 rounded shadow-sm">{qtdPlano} un</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                                {Object.keys(gruposPlanos).every(k => gruposPlanos[k].total === 0) && <p className="text-center text-xs font-bold text-slate-400 py-12">Nenhum plano vendido.</p>}
                            </div>
                        </div>

                        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-8 h-[450px] flex flex-col">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b pb-4">
                                <i data-lucide="box" className="w-5 h-5 text-amber-500"></i> Produtos / Complementos
                            </h3>
                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                                {topProdutosLista.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <span className="text-[10px] font-black text-slate-700 uppercase"><span className="text-slate-400 font-bold w-4 mr-2">{idx + 1}º</span>{item[0]}</span>
                                        <span className="bg-white px-3 py-1 rounded-lg border text-[10px] font-black text-amber-600">{item[1]} un</span>
                                    </div>
                                ))}
                                {topProdutosLista.length === 0 && <p className="text-center text-xs font-bold text-slate-400 py-12">Nenhum produto físico vendido.</p>}
                            </div>
                        </div>

                        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-8 h-[450px] flex flex-col">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b pb-4">
                                <i data-lucide="medal" className="w-5 h-5 text-emerald-500"></i> Pódio de Produtos
                            </h3>
                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                                {rankingOrdenado.map(([nome, qtd], idx) => (
                                    <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <span className="text-[10px] font-black text-slate-800 uppercase truncate max-w-[120px]">{idx+1}º {nome.split(' ')[0]}</span>
                                        <div className="flex items-center gap-2">
                                            <div className="flex gap-0.5">
                                                {[1,2,3].map(i => (
                                                    <div key={i} className={`w-2 h-2 rounded-full ${qtd >= i ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
                                                ))}
                                            </div>
                                            <span className="text-[10px] font-black text-emerald-600">{qtd} un</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button onClick={dispararModalCompartilhar} disabled={rankingOrdenado.length === 0} className="mt-4 w-full bg-slate-800 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-sm">
                                <i data-lucide="share-2" className="w-4 h-4"></i> Ranking WhatsApp
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ABA VISÃO GERAL DE METAS */}
            {abaPrincipal === 'visaoGeral' && (
                <div className="space-y-6">
                    <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                <i data-lucide="sliders" className="w-5 h-5 text-blue-600"></i> Painel de Metas Mensais
                            </h3>
                            {temVisaoGlobal && (
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-lg">Selecione uma unidade no filtro para editar</span>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-[20px] border border-slate-100 mb-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Meta: Planos Nutri</label>
                                <input type="number" min="0" value={metaNutri} onChange={(e) => setMetaNutri(parseInt(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded-xl p-4 font-black text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Meta: Produtos Físicos</label>
                                <input type="number" min="0" value={metaProdutos} onChange={(e) => setMetaProdutos(parseInt(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded-xl p-4 font-black text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Meta: Personal Class</label>
                                <input type="number" min="0" value={metaPersonal} onChange={(e) => setMetaPersonal(parseInt(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded-xl p-4 font-black text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button 
                                onClick={salvarMetasNuvem} 
                                disabled={isSalvandoMetas}
                                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {isSalvandoMetas ? <i data-lucide="loader-2" className="w-4 h-4 animate-spin"></i> : <i data-lucide="save" className="w-4 h-4"></i>}
                                Salvar Metas da Unidade
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-max">
                                <thead>
                                    <tr className="bg-slate-50">
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">Academia / Unidade</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-center border-b border-slate-100">Progresso Nutri</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-amber-600 uppercase tracking-widest text-center border-b border-slate-100">Progresso Produtos</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-indigo-600 uppercase tracking-widest text-center border-b border-slate-100">Progresso Personal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {dadosMetasPorUnidade.map((item, index) => (
                                        <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-8 py-6 text-sm font-black text-slate-800 uppercase">{item.unidade}</td>
                                            <td className="px-8 py-6 text-center text-[11px] font-black">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className={item.faltaNutri === 0 && metaNutri > 0 ? 'text-emerald-600' : 'text-slate-400'}>{item.nutriRealizado} / {metaNutri} un</span>
                                                    <div className="w-32 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                        <div className={`h-full ${item.faltaNutri === 0 && metaNutri > 0 ? 'bg-emerald-500' : 'bg-emerald-400'}`} style={{ width: metaNutri === 0 ? '0%' : `${Math.min((item.nutriRealizado/metaNutri)*100, 100)}%` }}></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-center text-[11px] font-black">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className={item.faltaProdutos === 0 && metaProdutos > 0 ? 'text-emerald-600' : 'text-slate-400'}>{item.produtosRealizado} / {metaProdutos} un</span>
                                                    <div className="w-32 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                        <div className={`h-full ${item.faltaProdutos === 0 && metaProdutos > 0 ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: metaProdutos === 0 ? '0%' : `${Math.min((item.produtosRealizado/metaProdutos)*100, 100)}%` }}></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-center text-[11px] font-black">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className={item.faltaPersonal === 0 && metaPersonal > 0 ? 'text-emerald-600' : 'text-slate-400'}>{item.personalRealizado} / {metaPersonal} un</span>
                                                    <div className="w-32 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                        <div className={`h-full ${item.faltaPersonal === 0 && metaPersonal > 0 ? 'bg-emerald-500' : 'bg-indigo-400'}`} style={{ width: metaPersonal === 0 ? '0%' : `${Math.min((item.personalRealizado/metaPersonal)*100, 100)}%` }}></div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnaliseDashboard;