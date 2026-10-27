// src/pages/AnaliseVendas/index.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient.js';
import { getMeses, safeIsoDate } from './utils.js';
import ModalTextoWhatsapp from './Modais.jsx';
import DashboardTab from './DashboardTab.jsx';
import MetasTab from './MetasTab.jsx';
import RelatorioTab from './RelatorioTab.jsx';
import RankingGlobalTab from './RankingGlobalTab.jsx';
import { 
    BarChart3, Target, FileText, Trophy, RefreshCw,
    Bookmark, Package, Briefcase, Users, X
} from 'lucide-react';
import { SeletorPeriodo, FiltroMultiplo, calcularPreset, ROTULO_ATALHO } from '../HistoricoVendas/FiltrosCompactos.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx'; 

const getLocalISODate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const AnaliseDashboard = ({ usuarioLogado, vendas = [], visitantes = [], avaliacoes = [], planos = [], produtos = [], colaboradores = [] }) => {
    const { t } = useI18n(); 
    const mesesTraduzidos = getMeses(t); 

    const [abaPrincipal, setAbaPrincipal] = useState('dashboard');
    const [tipoFiltro, setTipoFiltro] = useState('mes');
    const [filtroMes, setFiltroMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
    const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [diaEspecifico, setDiaEspecifico] = useState(getLocalISODate());
    const [filtroUnidade, setFiltroUnidade] = useState('TODOS');
    // Atalho escolhido no menu de período (este_mes, hoje, 7d, mes, dia, personalizado...)
    const [presetPeriodo, setPresetPeriodo] = useState('este_mes');

    const [vendedoresOcultos, setVendedoresOcultos] = useState([]);
    const [planosOcultos, setPlanosOcultos] = useState([]);
    const [produtosOcultos, setProdutosOcultos] = useState([]);
    const [servicosOcultos, setServicosOcultos] = useState([]);
    const [catalogoGeral, setCatalogoGeral] = useState([]);

    const [metaNutri, setMetaNutri] = useState(0);
    const [metaProdutos, setMetaProdutos] = useState(0);
    const [metaPersonal, setMetaPersonal] = useState(0);
    const [metaAtivosMensal, setMetaAtivosMensal] = useState(0);
    const [metaNutriMensal, setMetaNutriMensal] = useState(0);
    const [metaPlusMensal, setMetaPlusMensal] = useState(0);
    const [metaPersMensal, setMetaPersMensal] = useState(0);
    const [ativosAtual, setAtivosAtual] = useState(0);

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
        setPresetPeriodo('este_mes');
    };

    // Menu de período → filtros que esta tela já usa (mes / periodo / dia).
    // "Este mês" e "Mês passado" usam o modo mês, para as metas mensais continuarem funcionando.
    const aplicarPeriodo = (p) => {
        if (!p) return;
        if (p.preset === 'este_mes' || p.preset === 'mes_passado') {
            const ref = new Date();
            if (p.preset === 'mes_passado') ref.setMonth(ref.getMonth() - 1, 1);
            setPresetPeriodo(p.preset);
            setTipoFiltro('mes');
            setFiltroMes(String(ref.getMonth() + 1).padStart(2, '0'));
            setFiltroAno(String(ref.getFullYear()));
            return;
        }
        setPresetPeriodo(p.preset);
        setTipoFiltro(p.tipo);
        if (p.tipo === 'dia') setDiaEspecifico(p.dia || '');
        if (p.tipo === 'periodo') { setDataInicio(p.inicio || ''); setDataFim(p.fim || ''); }
        if (p.tipo === 'mes') { setFiltroMes(p.mes || 'TODOS'); setFiltroAno(p.ano || 'TODOS'); }
    };

    useEffect(() => {
        setVendedoresOcultos([]);
        setPlanosOcultos([]);
        setProdutosOcultos([]);
        setServicosOcultos([]);
    }, [filtroUnidade, filtroMes, filtroAno, diaEspecifico, dataInicio, dataFim, tipoFiltro]);

    useEffect(() => {
        const hoje = new Date();
        if (abaPrincipal === 'relatorio' || abaPrincipal === 'rankingGlobal') {
            setPresetPeriodo('hoje');
            setTipoFiltro('dia');
            setDiaEspecifico(getLocalISODate());
        } else {
            setPresetPeriodo('este_mes');
            setTipoFiltro('mes');
            setFiltroMes(String(hoje.getMonth() + 1).padStart(2, '0'));
            setFiltroAno(hoje.getFullYear().toString());
        }
    }, [abaPrincipal]);

    // Segurança extra: se o utilizador perder visão global e estiver na aba rankingGlobal, volta ao dashboard
    useEffect(() => {
        if (!temVisaoGlobal && abaPrincipal === 'rankingGlobal') {
            setAbaPrincipal('dashboard');
        }
    }, [temVisaoGlobal, abaPrincipal]);

    useEffect(() => {
        const fetchMetas = async () => {
            const unidadeAlvo = temVisaoGlobal ? filtroUnidade : usuarioLogado?.unidade;
            if (!unidadeAlvo || unidadeAlvo === 'TODOS') {
                setMetaNutri(0); setMetaProdutos(0); setMetaPersonal(0);
                setMetaAtivosMensal(0); setMetaNutriMensal(0); setMetaPlusMensal(0); setMetaPersMensal(0);
                setAtivosAtual(0);
                return;
            }

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
                setMetaAtivosMensal(data.meta_ativos_mensal || 0);
                setMetaNutriMensal(data.meta_nutri_mensal || 0);
                setMetaPlusMensal(data.meta_plus_mensal || 0);
                setMetaPersMensal(data.meta_pers_mensal || 0);
                setAtivosAtual(data.ativos_atual || 0);
            } else {
                setMetaNutri(0); setMetaProdutos(0); setMetaPersonal(0);
                setMetaAtivosMensal(0); setMetaNutriMensal(0); setMetaPlusMensal(0); setMetaPersMensal(0);
                setAtivosAtual(0);
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
            meta_personal: metaPersonal,
            meta_ativos_mensal: metaAtivosMensal,
            meta_nutri_mensal: metaNutriMensal,
            meta_plus_mensal: metaPlusMensal,
            meta_pers_mensal: metaPersMensal,
            ativos_atual: ativosAtual
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
            return `${nomeMes} de ${filtroAno}`;
        }
        if (tipoFiltro === 'dia') return diaEspecifico.split('-').reverse().join('/');
        return `${dataInicio ? dataInicio.split('-').reverse().join('/') : '...'} até ${dataFim ? dataFim.split('-').reverse().join('/') : '...'}`;
    })();

    // ---------- Textos do período ----------
    const dataBR = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
    const nomeMesSel = mesesTraduzidos.find(m => m.val === filtroMes)?.label || filtroMes;
    const rotuloPeriodo = (() => {
        if (presetPeriodo === 'este_mes') return 'Este mês';
        if (presetPeriodo === 'mes_passado') return 'Mês passado';
        if (presetPeriodo === 'mes') return filtroMes === 'TODOS' ? `Ano ${filtroAno === 'TODOS' ? 'todos' : filtroAno}` : `${nomeMesSel}${filtroAno !== 'TODOS' ? ` ${filtroAno}` : ''}`;
        if (presetPeriodo === 'dia') return dataBR(diaEspecifico) || 'Escolher dia';
        if (presetPeriodo === 'personalizado') return `${dataBR(dataInicio)} – ${dataBR(dataFim)}`;
        return ROTULO_ATALHO[presetPeriodo] || 'Período';
    })();
    const descricaoPeriodo = (() => {
        if (tipoFiltro === 'dia') return presetPeriodo === 'hoje' ? `Hoje, ${dataBR(diaEspecifico)}` : presetPeriodo === 'ontem' ? `Ontem, ${dataBR(diaEspecifico)}` : dataBR(diaEspecifico);
        if (tipoFiltro === 'periodo') return dataInicio || dataFim ? `${dataBR(dataInicio)} a ${dataBR(dataFim)}` : 'Todo o período';
        return labelFiltroAtual;
    })();

    // ---------- Filtros ativos (chips com X) ----------
    const filtrosAtivos = [];
    [
        ['consultores', 'Consultores', vendedoresUnicos, vendedoresOcultos, setVendedoresOcultos],
        ['planos', 'Planos', planosVendidos, planosOcultos, setPlanosOcultos],
        ['produtos', 'Produtos', produtosVendidos, produtosOcultos, setProdutosOcultos],
        ['servicos', 'Serviços', servicosVendidos, servicosOcultos, setServicosOcultos],
    ].forEach(([id, nome, opcoes, ocultos, setOcultos]) => {
        if (ocultos.some(o => opcoes.includes(o))) {
            const visiveis = opcoes.filter(o => !ocultos.includes(o));
            filtrosAtivos.push({ id, texto: `${nome}: ${visiveis.length} de ${opcoes.length}`, remover: () => setOcultos([]) });
        }
    });
    const presetPadrao = (abaPrincipal === 'relatorio' || abaPrincipal === 'rankingGlobal') ? 'hoje' : 'este_mes';
    const temFiltroAtivo = filtrosAtivos.length > 0 || presetPeriodo !== presetPadrao;

    const abrirModalWhatsapp = (texto, config = {}) => {
        setTextoEditavel(texto);
        setModalConfig({ titulo: config.titulo || 'Mensagem', icone: config.icone || 'send', cor: config.cor || 'emerald' });
        setIsModalTextoOpen(true);
    };

    const copiarTextoFinalDoModal = () => {
        navigator.clipboard.writeText(textoEditavel).then(() => {
            setCopiadoSucesso(true);
            setTimeout(() => { setCopiadoSucesso(false); setIsModalTextoOpen(false); }, 2000);
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

            {/* ========================================== */}
            {/* 🚀 ABAS + FILTROS (versão compacta, mesmo padrão do Histórico) */}
            {/* ========================================== */}
            <div className="bg-white rounded-[20px] border border-slate-200 shadow-sm p-4 md:p-5 relative z-20 flex flex-col gap-4">

                {/* Abas | o que está sendo exibido + período */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto custom-scrollbar gap-1" role="tablist" aria-label="Seções">
                        {[
                            ['dashboard', 'Dashboard', BarChart3],
                            ['visaoGeral', 'Metas da unidade', Target],
                            ['relatorio', 'Relatórios', FileText],
                            ...(temVisaoGlobal ? [['rankingGlobal', 'Ranking global', Trophy]] : []),
                        ].map(([id, rotulo, Icone]) => {
                            const ativa = abaPrincipal === id;
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    role="tab"
                                    aria-selected={ativa}
                                    onClick={() => setAbaPrincipal(id)}
                                    className={`h-9 px-3.5 rounded-lg text-[12px] whitespace-nowrap flex items-center gap-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${ativa ? 'bg-white shadow-sm text-blue-700 font-extrabold' : 'text-slate-500 hover:text-slate-800 font-bold'}`}
                                >
                                    <Icone className={`w-4 h-4 ${id === 'rankingGlobal' ? 'text-amber-500' : ''}`} /> {rotulo}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[12px] font-semibold text-slate-500">
                            {descricaoPeriodo} · {temVisaoGlobal ? (filtroUnidade === 'TODOS' ? 'Todas as unidades' : filtroUnidade) : (usuarioLogado?.unidade || '')}
                        </span>
                        <SeletorPeriodo
                            rotulo={rotuloPeriodo}
                            preset={presetPeriodo}
                            tipo={tipoFiltro}
                            dia={diaEspecifico}
                            inicio={dataInicio}
                            fim={dataFim}
                            mes={filtroMes}
                            ano={filtroAno}
                            meses={mesesTraduzidos}
                            anos={anosUnicos.filter(a => a !== 'TODOS')}
                            onAplicar={aplicarPeriodo}
                        />
                    </div>
                </div>

                {/* Filtros lado a lado */}
                <div className="flex flex-wrap gap-2.5">
                    <FiltroMultiplo rotulo="Consultores" icone={Users} options={vendedoresUnicos} ocultos={vendedoresOcultos} setOcultos={setVendedoresOcultos} />
                    <FiltroMultiplo rotulo="Planos" icone={Bookmark} options={planosVendidos} ocultos={planosOcultos} setOcultos={setPlanosOcultos} />
                    <FiltroMultiplo rotulo="Produtos" icone={Package} options={produtosVendidos} ocultos={produtosOcultos} setOcultos={setProdutosOcultos} alinhar="right" />
                    <FiltroMultiplo rotulo="Serviços" icone={Briefcase} options={servicosVendidos} ocultos={servicosOcultos} setOcultos={setServicosOcultos} alinhar="right" />
                </div>

                {/* Filtros ativos */}
                {(filtrosAtivos.length > 0 || temFiltroAtivo) && (
                    <div className="flex flex-wrap items-center gap-2">
                        {filtrosAtivos.length > 0 && <span className="text-[11px] font-bold text-slate-500">Filtros ativos:</span>}
                        {filtrosAtivos.map(f => (
                            <span key={f.id} className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1 rounded-full bg-slate-100 text-[12px] font-semibold text-slate-700">
                                {f.texto}
                                <button type="button" onClick={f.remover} aria-label={`Remover filtro: ${f.texto}`} className="w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors">
                                    <X className="w-3 h-3" strokeWidth={3} />
                                </button>
                            </span>
                        ))}
                        <button type="button" onClick={limparFiltros} className="h-7 px-2.5 rounded-lg text-[12px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center gap-1.5 transition-colors">
                            <RefreshCw className="w-3.5 h-3.5" /> Limpar filtros
                        </button>
                    </div>
                )}
            </div>

            {/* ========================================== */}
            {/* RENDERIZAÇÃO DAS 4 ABAS */}
            {/* ========================================== */}
            {abaPrincipal === 'dashboard' && (
                <DashboardTab
                    vendasFiltradas={vendasFiltradas}
                    visitantesFiltrados={visitantesFiltrados}
                    avaliacoesFiltradas={avaliacoesFiltradas}
                    colaboradores={colaboradores}
                    unidadeAtual={unidadeAtual}
                    metaProdutos={metaProdutos}
                    metaNutri={metaNutri}       
                    metaPersonal={metaPersonal} 
                    filtroMes={filtroMes}
                    filtroAno={filtroAno}
                    planos={planos}
                    produtos={produtos}
                    abrirModalWhatsapp={abrirModalWhatsapp}
                />
            )}

            {abaPrincipal === 'visaoGeral' && (
                <MetasTab
                    temVisaoGlobal={temVisaoGlobal}
                    filtroUnidade={filtroUnidade}
                    filtroMes={filtroMes}
                    filtroAno={filtroAno}
                    vendasFiltradas={vendasFiltradas}
                    unidadesUnicas={unidadesUnicas}
                    usuarioLogado={usuarioLogado}
                    metaNutri={metaNutri} setMetaNutri={setMetaNutri}
                    metaProdutos={metaProdutos} setMetaProdutos={setMetaProdutos}
                    metaPersonal={metaPersonal} setMetaPersonal={setMetaPersonal}
                    metaAtivosMensal={metaAtivosMensal} setMetaAtivosMensal={setMetaAtivosMensal}
                    metaNutriMensal={metaNutriMensal} setMetaNutriMensal={setMetaNutriMensal}
                    metaPlusMensal={metaPlusMensal} setMetaPlusMensal={setMetaPlusMensal}
                    metaPersMensal={metaPersMensal} setMetaPersMensal={setMetaPersMensal}
                    ativosAtual={ativosAtual} setAtivosAtual={setAtivosAtual}
                    salvarMetasNuvem={salvarMetasNuvem}
                    isSalvandoMetas={isSalvandoMetas}
                    planos={planos}
                    produtos={produtos}
                    abrirModalWhatsapp={abrirModalWhatsapp}
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

            {abaPrincipal === 'rankingGlobal' && temVisaoGlobal && (
                <RankingGlobalTab
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