import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../supabaseClient.js';
import { meses, safeIsoDate } from './utils.js';
import ModalTextoWhatsapp from './Modais.jsx';
import DashboardTab from './DashboardTab.jsx';
import MetasTab from './MetasTab.jsx';
import RelatorioTab from './RelatorioTab.jsx';
import { BarChart3, Target, FileText, Filter, RefreshCw, UserCheck, Bookmark, Package, Briefcase, ChevronDown, ChevronUp, CheckSquare, Square } from 'lucide-react';

const getLocalISODate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const toTitleCase = (str) => {
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
};

// ==========================================
// 🧩 COMPONENTE EXCLUSIVO: MULTISELECT DINÂMICO
// ==========================================
const MultiSelect = ({ options, ocultos, setOcultos, label, Icone, iconColor = "text-slate-500" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (opt) => {
        if (ocultos.includes(opt)) {
            setOcultos(prev => prev.filter(i => i !== opt)); // Mostra novamente
        } else {
            setOcultos(prev => [...prev, opt]); // Oculta
        }
    };

    const toggleAll = () => {
        if (ocultos.length === 0) {
            // Se está tudo selecionado, o botão serve para DESMARCAR TODOS
            setOcultos([...options]); 
        } else {
            // Se tem algo desmarcado, o botão serve para SELECIONAR TODOS
            setOcultos([]); 
        }
    };

    const isTodosSelecionados = ocultos.length === 0;
    const qtdSelecionados = options.length - ocultos.length;
    
    // 🔥 Lógica visual que você pediu
    let textoResumo = `${qtdSelecionados} selecionado${qtdSelecionados !== 1 ? 's' : ''}`;
    if (qtdSelecionados === options.length) textoResumo = 'TODOS';
    if (qtdSelecionados === 0) textoResumo = 'NENHUM SELECIONADO';

    return (
        <div className="relative flex flex-col gap-1.5 min-w-[200px] flex-1" ref={containerRef}>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
               <Icone className={`w-3 h-3 ${iconColor}`} /> {label}
            </label>
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className="bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none cursor-pointer flex justify-between items-center hover:border-blue-400 transition-colors select-none shadow-sm h-[46px]"
            >
                <span className="truncate pr-2 uppercase">{textoResumo}</span>
                {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
            </div>
            {isOpen && (
                <div className="absolute top-[100%] left-0 right-0 mt-2 bg-white border border-slate-200 shadow-2xl rounded-xl z-50 flex flex-col py-1 overflow-hidden" style={{ maxHeight: '280px' }}>
                    
                    {/* BOTÃO MÁGICO: Alterna entre Marcar Todos e Desmarcar Todos */}
                    <div 
                        className={`px-4 py-3 border-b flex items-center gap-3 cursor-pointer select-none transition-colors ${isTodosSelecionados ? 'bg-rose-50/50 hover:bg-rose-50 border-rose-100' : 'bg-blue-50/50 hover:bg-blue-50 border-blue-100'}`}
                        onClick={toggleAll}
                    >
                        {isTodosSelecionados ? (
                            <>
                                <Square className="w-4 h-4 text-rose-500 shrink-0" />
                                <span className="text-[11px] font-black text-rose-600 uppercase tracking-wider">Desmarcar Todos</span>
                            </>
                        ) : (
                            <>
                                <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                                <span className="text-[11px] font-black text-blue-700 uppercase tracking-wider">Selecionar Todos</span>
                            </>
                        )}
                    </div>

                    <div className="overflow-y-auto custom-scrollbar">
                        {options.map(opt => {
                            const isChecked = !ocultos.includes(opt);
                            return (
                                <div 
                                    key={opt} 
                                    className="px-4 py-3 hover:bg-slate-50 flex items-center gap-3 cursor-pointer select-none border-b border-slate-50 last:border-0 transition-colors"
                                    onClick={() => toggleOption(opt)}
                                >
                                    {isChecked ? <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                                    <span className={`text-[11px] font-bold uppercase truncate tracking-wide ${isChecked ? 'text-slate-700' : 'text-slate-400'}`} title={opt}>{opt}</span>
                                </div>
                            );
                        })}
                        {options.length === 0 && <p className="px-4 py-6 text-xs font-bold text-slate-400 text-center uppercase tracking-widest">Nenhuma venda neste período</p>}
                    </div>
                </div>
            )}
        </div>
    );
};

// ==========================================
// MÓDULO PRINCIPAL
// ==========================================
const AnaliseDashboard = ({ usuarioLogado, vendas = [], visitantes = [], avaliacoes = [], planos = [], produtos = [], colaboradores = [] }) => {
    const [abaPrincipal, setAbaPrincipal] = useState('dashboard');
    const [tipoFiltro, setTipoFiltro] = useState('mes');
    const [filtroMes, setFiltroMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
    const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [diaEspecifico, setDiaEspecifico] = useState(getLocalISODate());
    const [filtroUnidade, setFiltroUnidade] = useState('TODOS');

    // ESTADOS DAS CAIXINHAS MULTISELECT
    const [vendedoresOcultos, setVendedoresOcultos] = useState([]);
    const [planosOcultos, setPlanosOcultos] = useState([]);
    const [produtosOcultos, setProdutosOcultos] = useState([]);
    const [servicosOcultos, setServicosOcultos] = useState([]);
    const [catalogoGeral, setCatalogoGeral] = useState([]);

    const [metaNutri, setMetaNutri] = useState(50);
    const [metaProdutos, setMetaProdutos] = useState(100);
    const [metaPersonal, setMetaPersonal] = useState(0);
    const [isSalvandoMetas, setIsSalvandoMetas] = useState(false);

    const [isModalTextoOpen, setIsModalTextoOpen] = useState(false);
    const [textoEditavel, setTextoEditavel] = useState('');
    const [copiadoSucesso, setCopiadoSucesso] = useState(false);
    const [modalConfig, setModalConfig] = useState({ titulo: '', icone: 'send', cor: 'emerald' });

    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';
    const unidadeAtual = temVisaoGlobal ? filtroUnidade : usuarioLogado?.unidade;

    const anosUnicos = ['TODOS', ...new Set(vendas.map(v => safeIsoDate(v.data).split('-')[0]))].filter(Boolean).sort((a,b) => b-a);
    if (anosUnicos.length === 1) anosUnicos.push(new Date().getFullYear().toString());

    const unidadesUnicas = ['TODOS', ...new Set(vendas.map(v => v.unidade))].filter(Boolean);

    useEffect(() => {
        const fetchCatalogo = async () => {
            const { data } = await supabase.from('catalogo').select('nome, tipo');
            if (data) setCatalogoGeral(data);
        };
        fetchCatalogo();
    }, []);

    const mapCatalogo = useMemo(() => {
        const map = new Map();
        catalogoGeral.forEach(c => map.set((c.nome || '').toUpperCase(), c));
        return map;
    }, [catalogoGeral]);

    // PREPARA AS LISTAS PARA OS CHECKBOXES (APENAS COM BASE NA UNIDADE/DATA)
    const { planosVendidos, produtosVendidos, servicosVendidos, vendedoresUnicos } = useMemo(() => {
        const arrPlanos = [];
        const arrProds = [];
        const arrServs = [];
        const vendSet = new Set();
        const itemSet = new Set();

        const vendasBase = vendas.filter(v => {
            if (temVisaoGlobal && filtroUnidade !== 'TODOS' && v.unidade !== filtroUnidade) return false;
            if (!temVisaoGlobal && v.unidade !== usuarioLogado?.unidade) return false;
            
            if (!v.data && !v.created_at) return false;

            const dataRef = v.data || v.created_at;
            const isoDate = safeIsoDate(dataRef);
            const partes = isoDate.split('-');
            if (partes.length !== 3) return false;
            
            let y = partes[0];
            let m = partes[1];
            let d = partes[2];
            if (partes[2].length === 4) { y = partes[2]; m = partes[1]; d = partes[0]; }
            const dataFormatada = `${y}-${m}-${d}`;

            if (tipoFiltro === 'mes') return (filtroMes === 'TODOS' || m === filtroMes) && (filtroAno === 'TODOS' || y === filtroAno);
            if (tipoFiltro === 'periodo') return (!dataInicio || dataFormatada >= dataInicio) && (!dataFim || dataFormatada <= dataFim);
            if (tipoFiltro === 'dia') return !diaEspecifico || dataFormatada === diaEspecifico;
            
            return true;
        });

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
    }, [vendas, mapCatalogo, temVisaoGlobal, filtroUnidade, usuarioLogado, tipoFiltro, filtroMes, filtroAno, dataInicio, dataFim, diaEspecifico]);

    const limparFiltros = () => {
        setTipoFiltro('mes');
        setFiltroMes(String(new Date().getMonth() + 1).padStart(2, '0'));
        setFiltroAno(new Date().getFullYear().toString());
        setDiaEspecifico(getLocalISODate());
        setDataInicio('');
        setDataFim('');
        if (temVisaoGlobal) setFiltroUnidade('TODOS');
        setVendedoresOcultos([]);
        setPlanosOcultos([]);
        setProdutosOcultos([]);
        setServicosOcultos([]);
    };

    // Reseta as caixinhas de multiselect quando muda a unidade ou o período
    useEffect(() => {
        setVendedoresOcultos([]);
        setPlanosOcultos([]);
        setProdutosOcultos([]);
        setServicosOcultos([]);
    }, [filtroUnidade, filtroMes, filtroAno, diaEspecifico, dataInicio, dataFim, tipoFiltro]);

    useEffect(() => {
        const hoje = new Date();
        if (abaPrincipal === 'relatorio') {
            setTipoFiltro('dia');
            setDiaEspecifico(getLocalISODate());
        } else {
            setTipoFiltro('mes');
            setFiltroMes(String(hoje.getMonth() + 1).padStart(2, '0'));
            setFiltroAno(hoje.getFullYear().toString());
        }
    }, [abaPrincipal]);

    useEffect(() => {
        const fetchMetas = async () => {
            const unidadeAlvo = temVisaoGlobal ? filtroUnidade : usuarioLogado?.unidade;
            if (!unidadeAlvo || unidadeAlvo === 'TODOS') return;

            const { data } = await supabase
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

    // A MÁGICA: FILTRAGEM COMPLETA DAS VENDAS
    const vendasFiltradas = useMemo(() => {
        return vendas.filter(v => {
            if (temVisaoGlobal && filtroUnidade !== 'TODOS' && v.unidade !== filtroUnidade) return false;
            if (!temVisaoGlobal && v.unidade !== usuarioLogado?.unidade) return false;
            
            // Verifica os Ocultos
            const prodUpper = (v.produto || '').toUpperCase();
            const vendUpper = (v.vendedor || '').toUpperCase();

            if (vendedoresOcultos.includes(vendUpper)) return false;
            if (planosOcultos.includes(prodUpper)) return false;
            if (produtosOcultos.includes(prodUpper)) return false;
            if (servicosOcultos.includes(prodUpper)) return false;

            if (!v.data && !v.created_at) return false;

            const dataRef = v.data || v.created_at;
            const isoDate = safeIsoDate(dataRef);
            const partes = isoDate.split('-');
            if (partes.length !== 3) return false;
            
            let y = partes[0];
            let m = partes[1];
            let d = partes[2];
            if (partes[2].length === 4) { y = partes[2]; m = partes[1]; d = partes[0]; }
            const dataFormatada = `${y}-${m}-${d}`;

            if (tipoFiltro === 'mes') return (filtroMes === 'TODOS' || m === filtroMes) && (filtroAno === 'TODOS' || y === filtroAno);
            if (tipoFiltro === 'periodo') return (!dataInicio || dataFormatada >= dataInicio) && (!dataFim || dataFormatada <= dataFim);
            if (tipoFiltro === 'dia') return !diaEspecifico || dataFormatada === diaEspecifico;
            return true;
        });
    }, [vendas, temVisaoGlobal, filtroUnidade, usuarioLogado, tipoFiltro, filtroMes, filtroAno, dataInicio, dataFim, diaEspecifico, vendedoresOcultos, planosOcultos, produtosOcultos, servicosOcultos]);

    const visitantesFiltrados = visitantes.filter(v => {
        if (v.origem === 'CRM' || v.origem === 'SMART_PAGE') return false;
        if (temVisaoGlobal && filtroUnidade !== 'TODOS' && v.unidade !== filtroUnidade) return false;
        if (!temVisaoGlobal && v.unidade !== usuarioLogado?.unidade) return false;
        
        const dataBase = v.data || v.criado_em;
        if (!dataBase) return false;

        const isoDate = safeIsoDate(dataBase);
        const partes = isoDate.split('-');
        if (partes.length !== 3) return false;
        
        let y = partes[0];
        let m = partes[1];
        let d = partes[2];
        if (partes[2].length === 4) { y = partes[2]; m = partes[1]; d = partes[0]; }
        const dataFormatada = `${y}-${m}-${d}`;

        if (tipoFiltro === 'mes') return (filtroMes === 'TODOS' || m === filtroMes) && (filtroAno === 'TODOS' || y === filtroAno);
        if (tipoFiltro === 'periodo') return (!dataInicio || dataFormatada >= dataInicio) && (!dataFim || dataFormatada <= dataFim);
        if (tipoFiltro === 'dia') return !diaEspecifico || dataFormatada === diaEspecifico;
        return true;
    });

    const avaliacoesFiltradas = avaliacoes.filter(a => {
        if (temVisaoGlobal && filtroUnidade !== 'TODOS' && a.unidade !== filtroUnidade) return false;
        if (!temVisaoGlobal && a.unidade !== usuarioLogado?.unidade) return false;
        
        const dataBase = a.data || a.created_at;
        if (!dataBase) return false;

        const isoDate = safeIsoDate(dataBase);
        const partes = isoDate.split('-');
        if (partes.length !== 3) return false;
        
        let y = partes[0];
        let m = partes[1];
        let d = partes[2];
        if (partes[2].length === 4) { y = partes[2]; m = partes[1]; d = partes[0]; }
        const dataFormatada = `${y}-${m}-${d}`;

        if (tipoFiltro === 'mes') return (filtroMes === 'TODOS' || m === filtroMes) && (filtroAno === 'TODOS' || y === filtroAno);
        if (tipoFiltro === 'periodo') return (!dataInicio || dataFormatada >= dataInicio) && (!dataFim || dataFormatada <= dataFim);
        if (tipoFiltro === 'dia') return !diaEspecifico || dataFormatada === diaEspecifico;
        return true;
    });

    const labelFiltroAtual = (() => {
        if (tipoFiltro === 'mes') {
            const nomeMes = meses.find(m => m.val === filtroMes)?.label || filtroMes;
            return `${nomeMes}/${filtroAno}`;
        }
        if (tipoFiltro === 'dia') return diaEspecifico.split('-').reverse().join('/');
        return `${dataInicio || '...'} até ${dataFim || '...'}`;
    })();

    const abrirModalWhatsapp = (texto, config = {}) => {
        setTextoEditavel(texto);
        setModalConfig({
            titulo: config.titulo || 'Mensagem para o WhatsApp',
            icone: config.icone || 'send',
            cor: config.cor || 'emerald'
        });
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
    }, [abaPrincipal, isModalTextoOpen, tipoFiltro, filtroUnidade, vendedoresOcultos, planosOcultos, produtosOcultos, servicosOcultos]);

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] max-w-[1400px] mx-auto">
            <ModalTextoWhatsapp
                isOpen={isModalTextoOpen}
                titulo={modalConfig.titulo}
                icone={modalConfig.icone}
                corIcone={modalConfig.cor}
                texto={textoEditavel}
                setTexto={setTextoEditavel}
                copiado={copiadoSucesso}
                onFechar={() => setIsModalTextoOpen(false)}
                onCopiar={copiarTextoFinalDoModal}
                onEnviar={enviarWhatsApp}
            />

            {/* BARRA DE NAVEGAÇÃO SUPERIOR */}
            <div className="bg-white rounded-[24px] border border-slate-200 p-4 flex flex-col md:flex-row justify-between items-center shadow-sm gap-4">
                <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full md:w-auto overflow-x-auto custom-scrollbar">
                    <button onClick={() => setAbaPrincipal('dashboard')} className={`flex-1 md:w-40 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${abaPrincipal === 'dashboard' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}>
                        <BarChart3 className="w-4 h-4" /> Dashboard
                    </button>
                    <button onClick={() => setAbaPrincipal('visaoGeral')} className={`flex-1 md:w-40 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${abaPrincipal === 'visaoGeral' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}>
                        <Target className="w-4 h-4" /> Metas Unidade
                    </button>
                    <button onClick={() => setAbaPrincipal('relatorio')} className={`flex-1 md:w-40 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${abaPrincipal === 'relatorio' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}>
                        <FileText className="w-4 h-4" /> Relatório
                    </button>
                </div>
            </div>

            {/* FILTROS GLOBAIS COM UX PREMIUM */}
            <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-6 md:p-8">
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6 border-b border-slate-100 pb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-inner">
                            <Filter className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">Filtros Globais Avançados</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Controla os dados do Dashboard e Relatórios</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                        <button onClick={limparFiltros} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 transition-colors bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-200 hover:border-blue-200">
                            <RefreshCw className="w-4 h-4" /> Limpar Filtros
                        </button>

                        <div className="flex bg-slate-100 p-1.5 rounded-xl border w-full md:w-auto overflow-x-auto custom-scrollbar">
                            <button onClick={() => setTipoFiltro('mes')} className={`flex-1 min-w-[80px] px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoFiltro === 'mes' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>Mês</button>
                            <button onClick={() => setTipoFiltro('periodo')} className={`flex-1 min-w-[80px] px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoFiltro === 'periodo' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>Período</button>
                            <button onClick={() => setTipoFiltro('dia')} className={`flex-1 min-w-[80px] px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoFiltro === 'dia' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>Dia</button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-5">
                    {/* LINHA 1: DATAS, UNIDADE E CONSULTOR */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                        {tipoFiltro === 'mes' && (
                            <>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Mês Referência</label>
                                    <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 h-[46px]">{meses.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}</select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ano Referência</label>
                                    <select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)} className="bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 h-[46px]">{anosUnicos.map(a => <option key={a} value={a}>{a}</option>)}</select>
                                </div>
                            </>
                        )}
                        {tipoFiltro === 'periodo' && (
                            <>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Data Início</label>
                                    <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 h-[46px]" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Data Fim</label>
                                    <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 h-[46px]" />
                                </div>
                            </>
                        )}
                        {tipoFiltro === 'dia' && (
                            <div className="flex flex-col gap-1.5 sm:col-span-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Dia Específico</label>
                                <input type="date" value={diaEspecifico} onChange={(e) => setDiaEspecifico(e.target.value)} className="bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 w-full h-[46px]" />
                            </div>
                        )}

                        {temVisaoGlobal && (
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest ml-1">Isolar Unidade</label>
                                <select value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)} className="bg-rose-50/30 border border-rose-100 text-rose-700 rounded-xl p-3 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-rose-500 h-[46px]">
                                    {unidadesUnicas.map(u => <option key={u} value={u}>{u === 'TODOS' ? 'VISÃO GLOBAL' : u}</option>)}
                                </select>
                            </div>
                        )}

                        <MultiSelect 
                            options={vendedoresUnicos} 
                            ocultos={vendedoresOcultos} 
                            setOcultos={setVendedoresOcultos} 
                            label="Consultores" 
                            Icone={UserCheck}
                            iconColor="text-slate-500" 
                        />
                    </div>

                    {/* LINHA 2: ISOLAMENTO DE CATÁLOGO (MULTISELECT) */}
                    <div className="flex flex-col sm:flex-row flex-wrap gap-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                        <MultiSelect 
                            options={planosVendidos} 
                            ocultos={planosOcultos} 
                            setOcultos={setPlanosOcultos} 
                            label="Filtrar Planos" 
                            Icone={Bookmark} 
                            iconColor="text-blue-600" 
                        />
                        <MultiSelect 
                            options={produtosVendidos} 
                            ocultos={produtosOcultos} 
                            setOcultos={setProdutosOcultos} 
                            label="Filtrar Produtos" 
                            Icone={Package} 
                            iconColor="text-emerald-600" 
                        />
                        <MultiSelect 
                            options={servicosVendidos} 
                            ocultos={servicosOcultos} 
                            setOcultos={setServicosOcultos} 
                            label="Filtrar Serviços" 
                            Icone={Briefcase} 
                            iconColor="text-violet-600" 
                        />
                    </div>
                </div>
            </div>

            {abaPrincipal === 'dashboard' && (
                <DashboardTab
                    vendasFiltradas={vendasFiltradas}
                    visitantesFiltrados={visitantesFiltrados}
                    avaliacoesFiltradas={avaliacoesFiltradas}
                    colaboradores={colaboradores}
                    unidadeAtual={unidadeAtual}
                    metaProdutos={metaProdutos}
                    planos={planos}
                    produtos={produtos}
                    abrirModalWhatsapp={abrirModalWhatsapp}
                />
            )}

            {abaPrincipal === 'visaoGeral' && (
                <MetasTab
                    temVisaoGlobal={temVisaoGlobal}
                    vendasFiltradas={vendasFiltradas}
                    unidadesUnicas={unidadesUnicas}
                    usuarioLogado={usuarioLogado}
                    metaNutri={metaNutri}
                    metaProdutos={metaProdutos}
                    metaPersonal={metaPersonal}
                    setMetaNutri={setMetaNutri}
                    setMetaProdutos={setMetaProdutos}
                    setMetaPersonal={setMetaPersonal}
                    salvarMetasNuvem={salvarMetasNuvem}
                    isSalvandoMetas={isSalvandoMetas}
                    planos={planos}
                    produtos={produtos}
                />
            )}

            {abaPrincipal === 'relatorio' && (
                <RelatorioTab
                    vendasFiltradas={vendasFiltradas}
                    visitantesFiltrados={visitantesFiltrados} 
                    avaliacoesFiltradas={avaliacoesFiltradas}
                    temVisaoGlobal={temVisaoGlobal}
                    labelFiltroAtual={labelFiltroAtual}
                    planos={planos}
                    produtos={produtos}
                    abrirModalWhatsapp={abrirModalWhatsapp}
                />
            )}
        </div>
    );
};

export default AnaliseDashboard;