import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import { meses, safeIsoDate } from './utils.js';
import ModalTextoWhatsapp from './Modais.jsx';
import DashboardTab from './DashboardTab.jsx';
import MetasTab from './MetasTab.jsx';
import RelatorioTab from './RelatorioTab.jsx';

// Função segura para pegar a data de Brasília exata e evitar bugs de fuso horário (UTC)
const getLocalISODate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Adicionado visitantes e avaliacoes nas props
const AnaliseDashboard = ({ usuarioLogado, vendas = [], visitantes = [], avaliacoes = [], planos = [], produtos = [], colaboradores = [] }) => {
    const [abaPrincipal, setAbaPrincipal] = useState('dashboard');
    const [tipoFiltro, setTipoFiltro] = useState('mes');
    const [filtroMes, setFiltroMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
    const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [diaEspecifico, setDiaEspecifico] = useState(getLocalISODate());
    const [filtroUnidade, setFiltroUnidade] = useState('TODOS');

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

    // --- FILTRAGEM DE VENDAS ---
    const vendasFiltradas = vendas.filter(v => {
        if (temVisaoGlobal && filtroUnidade !== 'TODOS' && v.unidade !== filtroUnidade) return false;
        if (!temVisaoGlobal && v.unidade !== usuarioLogado?.unidade) return false;
        if (!v.data) return false;

        const isoDate = safeIsoDate(v.data);
        const partes = isoDate.split('-');
        if (partes.length !== 3) return false;
        const [y, m] = partes;

        if (tipoFiltro === 'mes') return (filtroMes === 'TODOS' || m === filtroMes) && (filtroAno === 'TODOS' || y === filtroAno);
        if (tipoFiltro === 'periodo') return (!dataInicio || isoDate >= dataInicio) && (!dataFim || isoDate <= dataFim);
        if (tipoFiltro === 'dia') return !diaEspecifico || isoDate === diaEspecifico;
        return true;
    });

    // --- FILTRAGEM DE VISITANTES ---
    const visitantesFiltrados = visitantes.filter(v => {
        if (temVisaoGlobal && filtroUnidade !== 'TODOS' && v.unidade !== filtroUnidade) return false;
        if (!temVisaoGlobal && v.unidade !== usuarioLogado?.unidade) return false;
        
        // CRM usa data ou criado_em
        const dataBase = v.data || v.criado_em;
        if (!dataBase) return false;

        const isoDate = safeIsoDate(dataBase);
        const partes = isoDate.split('-');
        if (partes.length !== 3) return false;
        const [y, m] = partes;

        if (tipoFiltro === 'mes') return (filtroMes === 'TODOS' || m === filtroMes) && (filtroAno === 'TODOS' || y === filtroAno);
        if (tipoFiltro === 'periodo') return (!dataInicio || isoDate >= dataInicio) && (!dataFim || isoDate <= dataFim);
        if (tipoFiltro === 'dia') return !diaEspecifico || isoDate === diaEspecifico;
        return true;
    });

    // --- FILTRAGEM DE AVALIAÇÕES ---
    const avaliacoesFiltradas = avaliacoes.filter(a => {
        if (temVisaoGlobal && filtroUnidade !== 'TODOS' && a.unidade !== filtroUnidade) return false;
        if (!temVisaoGlobal && a.unidade !== usuarioLogado?.unidade) return false;
        if (!a.data) return false;

        const isoDate = safeIsoDate(a.data);
        const partes = isoDate.split('-');
        if (partes.length !== 3) return false;
        const [y, m] = partes;

        if (tipoFiltro === 'mes') return (filtroMes === 'TODOS' || m === filtroMes) && (filtroAno === 'TODOS' || y === filtroAno);
        if (tipoFiltro === 'periodo') return (!dataInicio || isoDate >= dataInicio) && (!dataFim || isoDate <= dataFim);
        if (tipoFiltro === 'dia') return !diaEspecifico || isoDate === diaEspecifico;
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
    }, [abaPrincipal, isModalTextoOpen, tipoFiltro, filtroUnidade]);

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
                        <i data-lucide="bar-chart-3" className="w-4 h-4"></i> Dashboard
                    </button>
                    <button onClick={() => setAbaPrincipal('visaoGeral')} className={`flex-1 md:w-40 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${abaPrincipal === 'visaoGeral' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}>
                        <i data-lucide="target" className="w-4 h-4"></i> Metas Unidade
                    </button>
                    <button onClick={() => setAbaPrincipal('relatorio')} className={`flex-1 md:w-40 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${abaPrincipal === 'relatorio' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}>
                        <i data-lucide="file-text" className="w-4 h-4"></i> Relatório
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-6 md:p-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-inner">
                            <i data-lucide="filter" className="w-5 h-5"></i>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">Filtros Globais</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Controla os dados de todas as abas</p>
                        </div>
                    </div>

                    <div className="flex bg-slate-100 p-1.5 rounded-xl border w-full md:w-auto overflow-x-auto custom-scrollbar">
                        <button onClick={() => setTipoFiltro('mes')} className={`flex-1 min-w-[80px] px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoFiltro === 'mes' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>Mês</button>
                        <button onClick={() => setTipoFiltro('periodo')} className={`flex-1 min-w-[80px] px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoFiltro === 'periodo' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>Período</button>
                        <button onClick={() => setTipoFiltro('dia')} className={`flex-1 min-w-[80px] px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoFiltro === 'dia' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>Dia</button>
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