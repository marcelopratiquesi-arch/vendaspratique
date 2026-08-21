import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient.js';
import { getMeses, safeIsoDate } from './utils.js'; // 🔥 Usando nova função traduzida
import ModalTextoWhatsapp from './Modais.jsx';
import DashboardTab from './DashboardTab.jsx';
import MetasTab from './MetasTab.jsx';
import RelatorioTab from './RelatorioTab.jsx';
import { BarChart3, Target, FileText, Filter, RefreshCw, UserCheck, Bookmark, Package, Briefcase } from 'lucide-react';
import { SmartFilter } from '../../components/SmartFilter.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx'; // 🔥 i18n Injetado

const getLocalISODate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const AnaliseDashboard = ({ usuarioLogado, vendas = [], visitantes = [], avaliacoes = [], planos = [], produtos = [], colaboradores = [] }) => {
    const { t } = useI18n(); // 🔥 i18n
    const mesesTraduzidos = getMeses(t); // Puxa o array com as traduções reativas

    const [abaPrincipal, setAbaPrincipal] = useState('dashboard');
    const [tipoFiltro, setTipoFiltro] = useState('mes');
    const [filtroMes, setFiltroMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
    const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [diaEspecifico, setDiaEspecifico] = useState(getLocalISODate());
    const [filtroUnidade, setFiltroUnidade] = useState('TODOS');

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
            alert(t('analytics.alerts.selectUnitSave', { defaultValue: "Atenção: Selecione uma unidade específica no filtro acima para poder salvar as metas." }));
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
            alert(t('analytics.alerts.errorSave', { defaultValue: "Erro ao salvar as metas no banco de dados." }));
        } else {
            alert(t('analytics.alerts.successSave', { defaultValue: "Metas atualizadas com sucesso!" }));
        }
    };

    const vendasFiltradas = useMemo(() => {
        return vendas.filter(v => {
            if (temVisaoGlobal && filtroUnidade !== 'TODOS' && v.unidade !== filtroUnidade) return false;
            if (!temVisaoGlobal && v.unidade !== usuarioLogado?.unidade) return false;
            
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
            const nomeMes = mesesTraduzidos.find(m => m.val === filtroMes)?.label || filtroMes;
            return `${nomeMes}/${filtroAno}`;
        }
        if (tipoFiltro === 'dia') return diaEspecifico.split('-').reverse().join('/');
        return `${dataInicio || '...'} ${t('analytics.filters.dateUntil', { defaultValue: 'até' })} ${dataFim || '...'}`;
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

            <div className="bg-white rounded-[24px] border border-slate-200 p-4 flex flex-col md:flex-row justify-between items-center shadow-sm gap-4">
                <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full md:w-auto overflow-x-auto custom-scrollbar">
                    <button onClick={() => setAbaPrincipal('dashboard')} className={`flex-1 md:w-40 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${abaPrincipal === 'dashboard' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}>
                        <BarChart3 className="w-4 h-4" /> {t('analytics.tabs.dashboard', { defaultValue: 'Dashboard' })}
                    </button>
                    <button onClick={() => setAbaPrincipal('visaoGeral')} className={`flex-1 md:w-40 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${abaPrincipal === 'visaoGeral' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}>
                        <Target className="w-4 h-4" /> {t('analytics.tabs.unitGoals', { defaultValue: 'Metas Unidade' })}
                    </button>
                    <button onClick={() => setAbaPrincipal('relatorio')} className={`flex-1 md:w-40 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${abaPrincipal === 'relatorio' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}>
                        <FileText className="w-4 h-4" /> {t('analytics.tabs.report', { defaultValue: 'Relatório' })}
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-6 md:p-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6 border-b border-slate-100 pb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-inner">
                            <Filter className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">{t('analytics.filters.globalTitle', { defaultValue: 'Filtros Globais Avançados' })}</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{t('analytics.filters.globalSubtitle', { defaultValue: 'Controla os dados do Dashboard e Relatórios' })}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                        <button onClick={limparFiltros} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 transition-colors bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-200 hover:border-blue-200">
                            <RefreshCw className="w-4 h-4" /> {t('analytics.filters.clear', { defaultValue: 'Limpar Filtros' })}
                        </button>

                        <div className="flex bg-slate-100 p-1.5 rounded-xl border w-full md:w-auto overflow-x-auto custom-scrollbar">
                            <button onClick={() => setTipoFiltro('mes')} className={`flex-1 min-w-[80px] px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoFiltro === 'mes' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>{t('analytics.filters.month', { defaultValue: 'Mês' })}</button>
                            <button onClick={() => setTipoFiltro('periodo')} className={`flex-1 min-w-[80px] px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoFiltro === 'periodo' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>{t('analytics.filters.period', { defaultValue: 'Período' })}</button>
                            <button onClick={() => setTipoFiltro('dia')} className={`flex-1 min-w-[80px] px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoFiltro === 'dia' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>{t('analytics.filters.day', { defaultValue: 'Dia' })}</button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                        {tipoFiltro === 'mes' && (
                            <>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('analytics.filters.refMonth', { defaultValue: 'Mês Referência' })}</label>
                                    <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 h-[46px]">{mesesTraduzidos.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}</select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('analytics.filters.refYear', { defaultValue: 'Ano Referência' })}</label>
                                    <select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)} className="bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 h-[46px]">{anosUnicos.map(a => <option key={a} value={a}>{a}</option>)}</select>
                                </div>
                            </>
                        )}
                        {tipoFiltro === 'periodo' && (
                            <>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('analytics.filters.startDate', { defaultValue: 'Data Início' })}</label>
                                    <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 h-[46px]" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('analytics.filters.endDate', { defaultValue: 'Data Fim' })}</label>
                                    <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 h-[46px]" />
                                </div>
                            </>
                        )}
                        {tipoFiltro === 'dia' && (
                            <div className="flex flex-col gap-1.5 sm:col-span-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('analytics.filters.specificDay', { defaultValue: 'Dia Específico' })}</label>
                                <input type="date" value={diaEspecifico} onChange={(e) => setDiaEspecifico(e.target.value)} className="bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 w-full h-[46px]" />
                            </div>
                        )}

                        {temVisaoGlobal && (
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest ml-1">{t('analytics.filters.isolateUnit', { defaultValue: 'Isolar Unidade' })}</label>
                                <select value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)} className="bg-rose-50/30 border border-rose-100 text-rose-700 rounded-xl p-3 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-rose-500 h-[46px]">
                                    {unidadesUnicas.map(u => <option key={u} value={u}>{u === 'TODOS' ? t('analytics.filters.globalView', { defaultValue: 'VISÃO GLOBAL' }) : u}</option>)}
                                </select>
                            </div>
                        )}

                        <SmartFilter 
                            options={vendedoresUnicos} 
                            ocultos={vendedoresOcultos} 
                            setOcultos={setVendedoresOcultos} 
                            label={t('analytics.filters.consultants', { defaultValue: 'Consultores' })} 
                            Icone={UserCheck}
                            iconColor="text-slate-500" 
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row flex-wrap gap-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                        <SmartFilter 
                            options={planosVendidos} 
                            ocultos={planosOcultos} 
                            setOcultos={setPlanosOcultos} 
                            label={t('analytics.filters.filterPlans', { defaultValue: 'Filtrar Planos' })} 
                            Icone={Bookmark} 
                            iconColor="text-blue-600" 
                        />
                        <SmartFilter 
                            options={produtosVendidos} 
                            ocultos={produtosOcultos} 
                            setOcultos={setProdutosOcultos} 
                            label={t('analytics.filters.filterProducts', { defaultValue: 'Filtrar Produtos' })} 
                            Icone={Package} 
                            iconColor="text-emerald-600" 
                        />
                        <SmartFilter 
                            options={servicosVendidos} 
                            ocultos={servicosOcultos} 
                            setOcultos={setServicosOcultos} 
                            label={t('analytics.filters.filterServices', { defaultValue: 'Filtrar Serviços' })} 
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
                    usuarioLogado={usuarioLogado}
                />
            )}
        </div>
    );
};

export default AnaliseDashboard;