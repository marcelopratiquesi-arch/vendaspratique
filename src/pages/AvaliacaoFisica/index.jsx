import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient.js';
import { Dumbbell, LogOut, BarChart3, ClipboardSignature, Search, PlusCircle, Filter, RefreshCw, Trophy, Users, Activity, ListChecks } from 'lucide-react';
import FormAvaliacao from './FormAvaliacao'; 
import TabPerguntasAvaliacao from './TabPerguntasAvaliacao.jsx'; // 🔥 IMPORT DO CONSTRUTOR
import { useI18n } from '../../i18n/I18nContext.jsx'; 
import { getMeses } from '../AnaliseVendas/utils.js';
import { mascaraCPF } from '../CadastroGeral/utilsAlunos.js';

const getLocalISODate = () => {
    const d = new Date();
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
};

const AvaliacaoFisica = ({ usuarioLogado, avaliacoes = [], colaboradores = [] }) => {
    const { t, locale, language } = useI18n(); 
    const langAtual = locale || language || 'pt-BR';
    const mesesTraduzidos = getMeses(t);

    const [professorAtivo, setProfessorAtivo] = useState(null);
    const [abaAtiva, setAbaAtiva] = useState('relatorio');
    
    // ESTADOS DE FILTRO (Padrão Global)
    const [tipoFiltro, setTipoFiltro] = useState('dia');
    const [diaEspecifico, setDiaEspecifico] = useState(getLocalISODate());
    const [filtroMes, setFiltroMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
    const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [busca, setBusca] = useState('');
    const [paginaAtual, setPaginaAtual] = useState(1);
    const ITENS_POR_PAGINA = 15;

    // ESTADO LOCAL DE DADOS (Busca do Supabase Realtime)
    const [dadosFiltrados, setDadosFiltrados] = useState([]);
    const [loading, setLoading] = useState(false);

    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';
    const anosUnicos = ['TODOS', ...new Set(avaliacoes.map(v => (v.data || v.created_at || '').split('-')[0]))].filter(Boolean).sort((a,b) => b-a);
    if (anosUnicos.length === 1) anosUnicos.push(new Date().getFullYear().toString());

    // ==========================================
    // BUSCA DE DADOS DO BANCO COM BASE NOS FILTROS
    // ==========================================
    useEffect(() => {
        if (abaAtiva === 'nova' || abaAtiva === 'construtor') return; 

        const fetchDados = async () => {
            setLoading(true);
            try {
                let query = supabase.from('avaliacoes_realizadas').select('*').order('created_at', { ascending: false });

                // Escopo de Unidade
                if (!temVisaoGlobal) {
                    query = query.eq('unidade', usuarioLogado?.unidade);
                }

                if (tipoFiltro === 'dia' && diaEspecifico) {
                    const start = new Date(`${diaEspecifico}T00:00:00-03:00`).toISOString();
                    const end = new Date(`${diaEspecifico}T23:59:59-03:00`).toISOString();
                    query = query.gte('created_at', start).lte('created_at', end);
                } 
                else if (tipoFiltro === 'periodo' && dataInicio && dataFim) {
                    const start = new Date(`${dataInicio}T00:00:00-03:00`).toISOString();
                    const end = new Date(`${dataFim}T23:59:59-03:00`).toISOString();
                    query = query.gte('created_at', start).lte('created_at', end);
                }
                else if (tipoFiltro === 'mes' && filtroMes !== 'TODOS' && filtroAno !== 'TODOS') {
                    const start = new Date(`${filtroAno}-${filtroMes}-01T00:00:00-03:00`).toISOString();
                    const ultimoDia = new Date(parseInt(filtroAno, 10), parseInt(filtroMes, 10), 0).getDate();
                    const end = new Date(`${filtroAno}-${filtroMes}-${ultimoDia}T23:59:59-03:00`).toISOString();
                    query = query.gte('created_at', start).lte('created_at', end);
                }

                const { data, error } = await query;
                if (error) throw error;

                setDadosFiltrados(data || []);
                setPaginaAtual(1); 

            } catch (error) {
                console.error("Erro ao buscar avaliações:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDados();
    }, [tipoFiltro, diaEspecifico, filtroMes, filtroAno, dataInicio, dataFim, abaAtiva, temVisaoGlobal, usuarioLogado?.unidade]);

    const limparFiltros = () => {
        setTipoFiltro('dia');
        setDiaEspecifico(getLocalISODate());
        setFiltroMes(String(new Date().getMonth() + 1).padStart(2, '0'));
        setFiltroAno(new Date().getFullYear().toString());
        setDataInicio('');
        setDataFim('');
        setBusca('');
    };

    // ==========================================
    // CÁLCULO DE KPIs E DESEMPENHO (RANKING)
    // ==========================================
    const metricas = useMemo(() => {
        const ranking = {};
        let total = 0;

        dadosFiltrados.forEach(aval => {
            const prof = aval.professor || 'SISTEMA';
            ranking[prof] = (ranking[prof] || 0) + 1;
            total++;
        });

        const rankingOrdenado = Object.entries(ranking)
            .sort((a, b) => b[1] - a[1])
            .map(([nome, qtd]) => ({
                nome,
                qtd,
                percentual: total > 0 ? ((qtd / total) * 100).toFixed(1) : 0
            }));

        return { total, ranking: rankingOrdenado, totalProfs: rankingOrdenado.length };
    }, [dadosFiltrados]);

    // ==========================================
    // HISTÓRICO E BUSCA INTERNA
    // ==========================================
    const tabelaFiltrada = useMemo(() => {
        if (!busca) return dadosFiltrados;
        const b = busca.toLowerCase();
        const bNumeros = busca.replace(/\D/g, ''); 
        return dadosFiltrados.filter(a => 
            (a.aluno || '').toLowerCase().includes(b) || 
            (a.professor || '').toLowerCase().includes(b) ||
            (a.registrado_por_nome || '').toLowerCase().includes(b) ||
            (a.cpf && a.cpf.includes(bNumeros))
        );
    }, [dadosFiltrados, busca]);

    const totalPaginas = Math.ceil(tabelaFiltrada.length / ITENS_POR_PAGINA);
    const dadosPaginados = tabelaFiltrada.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA);

    useEffect(() => { if (window.lucide) window.lucide.createIcons(); }, [professorAtivo, abaAtiva, dadosPaginados]);

    // 🔥 RENDERIZAÇÃO: MODO CONSTRUTOR DE FORMULÁRIO (ADMIN)
    if (abaAtiva === 'construtor') {
        return (
            <div className="space-y-6 animate-[fadeIn_0.4s_ease-out] max-w-[1400px] mx-auto relative pb-10">
                <div className="flex items-center justify-between bg-slate-900 rounded-[24px] p-6 shadow-md">
                    <div>
                        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
                            <ListChecks className="w-6 h-6 text-orange-500" /> Construtor de Anamnese Dinâmica
                        </h2>
                        <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Acesso restrito: Administradores e Mentores</p>
                    </div>
                    <button type="button" onClick={() => setAbaAtiva('relatorio')} className="bg-white/10 hover:bg-white/20 text-white border border-white/10 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors shadow-sm">
                        Voltar para o Painel
                    </button>
                </div>
                <TabPerguntasAvaliacao usuarioLogado={usuarioLogado} />
            </div>
        );
    }

    // 🔥 RENDERIZAÇÃO: SELEÇÃO DE PROFESSOR (COM BOTÃO DO CONSTRUTOR)
    if (!professorAtivo) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] animate-[fadeIn_0.3s_ease-out] px-4 relative">
                
                <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-6 shadow-inner border border-orange-200">
                    <Dumbbell className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tight text-center">{t('assessment.sectorTitle', {defaultValue: 'Setor de Avaliação Física'})}</h2>
                <p className="text-slate-500 mb-10 font-medium text-center">{t('assessment.sectorSubtitle', {defaultValue: 'Selecione seu nome para acessar o painel técnico.'})}</p>
                
                {colaboradores.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl text-center max-w-md">
                        <p className="text-amber-700 font-bold">{t('assessment.noProf', {defaultValue: 'Nenhum profissional cadastrado nesta unidade.'})}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 w-full max-w-4xl">
                        {colaboradores.map(c => (
                            <button key={c.id} onClick={() => setProfessorAtivo(c)} className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm hover:border-orange-500 hover:shadow-lg hover:-translate-y-1 transition-all group flex flex-col items-center gap-4">
                                <div className="w-14 h-14 bg-slate-100 text-slate-500 group-hover:bg-orange-500 group-hover:text-white rounded-full flex items-center justify-center font-black text-xl transition-colors shadow-inner">
                                    {c.nome.charAt(0)}
                                </div>
                                <div className="text-center">
                                    <span className="font-black text-slate-700 group-hover:text-orange-700 block leading-tight">{c.nome.split(' ')[0]}</span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 block">{c.nome.split(' ').slice(1).join(' ')}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* 🔥 BOTÃO DO CONSTRUTOR APENAS PARA ADMINS/MENTORES */}
                {temVisaoGlobal && (
                    <div className="mt-16 pt-8 border-t border-slate-200 w-full max-w-md flex flex-col items-center animate-[fadeIn_0.5s_ease-out]">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Acesso Administrativo</p>
                        <button onClick={() => setAbaAtiva('construtor')} className="flex items-center justify-center gap-2 w-full bg-slate-900 hover:bg-slate-800 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_4px_15px_rgba(15,23,42,0.2)]">
                            <ListChecks className="w-5 h-5 text-orange-500" /> Configurar Formulário da Anamnese
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-[fadeIn_0.4s_ease-out] max-w-[1400px] mx-auto relative">
            
            <div className="bg-white rounded-[24px] border border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm flex-wrap gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-[300px]">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-colors shrink-0 bg-orange-100 text-orange-600 shadow-inner">
                        <Activity className="w-6 h-6" />
                    </div>
                    <div className="flex-1 max-w-xl">
                        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight leading-none mb-1">
                            {professorAtivo.nome}
                        </h2>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            {t('assessment.sectorTitle', {defaultValue: 'Setor de Avaliação Física'})} • Unidade {usuarioLogado?.unidade}
                        </span>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    {abaAtiva !== 'nova' && (
                        <button onClick={() => setAbaAtiva('nova')} className="px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_4px_15px_rgba(249,115,22,0.3)] flex items-center gap-2 bg-orange-500 text-white hover:bg-orange-600">
                            <PlusCircle className="w-4 h-4" /> {t('assessment.newAssessment', {defaultValue: 'Nova Avaliação'})}
                        </button>
                    )}
                    <button onClick={() => { setProfessorAtivo(null); setAbaAtiva('relatorio'); }} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center gap-2 bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200">
                        <LogOut className="w-4 h-4" /> {t('assessment.changeProf', {defaultValue: 'Trocar Prof.'})}
                    </button>
                </div>
            </div>

            {abaAtiva === 'nova' && (
                <FormAvaliacao 
                    usuarioLogado={usuarioLogado}
                    professorAtivo={professorAtivo}
                    voltar={() => setAbaAtiva('relatorio')}
                    setAvaliacoes={null}
                />
            )}

            {abaAtiva === 'relatorio' && (
                <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] pb-10">
                    
                    <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-6 md:p-8">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6 border-b border-slate-100 pb-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-orange-50 text-orange-600 rounded-xl border border-orange-100 shadow-inner">
                                    <Filter className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-800 tracking-tight">Filtros de Desempenho</h2>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Acompanhamento e Produção Técnica</p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                                <button onClick={limparFiltros} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-orange-600 transition-colors bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-200 hover:border-orange-200">
                                    <RefreshCw className="w-4 h-4" /> Limpar Filtros
                                </button>

                                <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full md:w-auto overflow-x-auto custom-scrollbar">
                                    <button onClick={() => setTipoFiltro('dia')} className={`flex-1 min-w-[80px] px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoFiltro === 'dia' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}>Dia Único</button>
                                    <button onClick={() => setTipoFiltro('mes')} className={`flex-1 min-w-[80px] px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoFiltro === 'mes' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}>Mês</button>
                                    <button onClick={() => setTipoFiltro('periodo')} className={`flex-1 min-w-[80px] px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoFiltro === 'periodo' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}>Período</button>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                            {tipoFiltro === 'mes' && (
                                <>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Mês Referência</label>
                                        <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-500 h-[46px]">{mesesTraduzidos.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}</select>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ano Referência</label>
                                        <select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)} className="bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-500 h-[46px]">{anosUnicos.map(a => <option key={a} value={a}>{a}</option>)}</select>
                                    </div>
                                </>
                            )}
                            {tipoFiltro === 'periodo' && (
                                <>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Data Início</label>
                                        <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-500 h-[46px]" />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Data Fim</label>
                                        <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-500 h-[46px]" />
                                    </div>
                                </>
                            )}
                            {tipoFiltro === 'dia' && (
                                <div className="flex flex-col gap-1.5 sm:col-span-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Dia Específico</label>
                                    <input type="date" value={diaEspecifico} onChange={(e) => setDiaEspecifico(e.target.value)} className="bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-500 w-full h-[46px]" />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        <div className="lg:col-span-1 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col justify-center relative overflow-hidden group hover:border-orange-300 transition-colors">
                                    <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-orange-50 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">Total Realizado</span>
                                    <span className="text-4xl font-black text-slate-800 relative z-10">{metricas.total}</span>
                                </div>
                                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col justify-center relative overflow-hidden group hover:border-blue-300 transition-colors">
                                    <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-blue-50 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">Média / Prof</span>
                                    <span className="text-4xl font-black text-slate-800 relative z-10">{metricas.totalProfs > 0 ? (metricas.total / metricas.totalProfs).toFixed(1) : 0}</span>
                                </div>
                            </div>

                            <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[300px]">
                                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                        <Trophy className="w-4 h-4 text-orange-500" /> Desempenho
                                    </h3>
                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-white px-2 py-1 rounded border shadow-sm">{metricas.totalProfs} Ativos</span>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                                    {metricas.ranking.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                                            <Users className="w-8 h-8 text-slate-300 mb-2" />
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nenhuma avaliação no período.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            {metricas.ranking.map((prof, index) => (
                                                <div key={prof.nome} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`w-6 h-6 flex items-center justify-center rounded-md text-[10px] font-black ${index === 0 ? 'bg-orange-100 text-orange-600' : index === 1 ? 'bg-slate-200 text-slate-600' : index === 2 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
                                                            {index + 1}º
                                                        </span>
                                                        <span className="text-xs font-black text-slate-700 uppercase tracking-tight line-clamp-1">{prof.nome}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-right">
                                                        <span className="text-[10px] font-bold text-slate-400">{prof.percentual}%</span>
                                                        <span className="text-xs font-black bg-white border px-2 py-0.5 rounded-lg shadow-sm text-slate-800">{prof.qtd}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-2 bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[550px]">
                            <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 shrink-0">
                                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 tracking-tight">
                                    <ClipboardSignature className="w-5 h-5 text-blue-500"/> Histórico Completo
                                </h3>
                                <div className="relative w-full sm:w-64">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input type="text" value={busca} onChange={(e) => {setBusca(e.target.value); setPaginaAtual(1);}} placeholder="Buscar aluno, professor, auditoria..." className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all" />
                                </div>
                            </div>
                            
                            <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative">
                                {loading ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm z-10">
                                        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Buscando registros...</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-left border-collapse min-w-[800px]">
                                        <thead className="bg-white sticky top-0 z-10 shadow-sm">
                                            <tr>
                                                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Data e Hora</th>
                                                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Aluno(a)</th>
                                                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Professor (Avaliador)</th>
                                                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Unidade</th>
                                                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-right">Lançado Por (Auditoria)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {dadosPaginados.length > 0 ? (
                                                dadosPaginados.map((a, idx) => {
                                                    const d = new Date(a.created_at || a.criado_em);
                                                    const dataStr = d.toLocaleDateString(langAtual);
                                                    const horaStr = d.toLocaleTimeString(langAtual, { hour: '2-digit', minute: '2-digit' });
                                                    
                                                    return (
                                                        <tr key={a.id || idx} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-6 py-4">
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-black text-slate-700">{dataStr}</span>
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">{horaStr}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-black text-slate-800 uppercase line-clamp-1" title={a.aluno}>{a.aluno || 'NÃO INFORMADO'}</span>
                                                                    {a.cpf && <span className="text-[9px] font-bold text-slate-400 tracking-widest mt-0.5 font-mono">CPF: {mascaraCPF(a.cpf)}</span>}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border bg-slate-100 text-slate-600 border-slate-200">
                                                                    {a.professor || 'SISTEMA'}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className="text-xs font-bold text-slate-600 uppercase">{a.unidade}</span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex flex-col items-end">
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase line-clamp-1">{a.registrado_por_nome || 'SISTEMA'}</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                                        Nenhum registro encontrado para este filtro.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            
                            {totalPaginas > 1 && (
                                <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Página {paginaAtual} de {totalPaginas}</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => setPaginaAtual(p => Math.max(1, p - 1))} disabled={paginaAtual === 1} className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 disabled:opacity-50 hover:bg-slate-100 text-[10px] font-black uppercase tracking-widest transition-colors">Anterior</button>
                                        <button onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))} disabled={paginaAtual === totalPaginas} className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 disabled:opacity-50 hover:bg-slate-100 text-[10px] font-black uppercase tracking-widest transition-colors">Próxima</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AvaliacaoFisica;