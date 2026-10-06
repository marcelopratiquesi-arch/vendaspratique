import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../supabaseClient.js';
import { Dumbbell, LogOut, BarChart3, ClipboardSignature, Search, PlusCircle, Filter, RefreshCw, Trophy, Users, Activity, ListChecks, Edit3, Trash2, FileText, Eye, Building2, MousePointerClick, User, ArrowUpDown } from 'lucide-react';
import FormAvaliacao from './FormAvaliacao'; 
import TabPerguntasAvaliacao from './TabPerguntasAvaliacao.jsx';
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
    const [avaliacaoEditando, setAvaliacaoEditando] = useState(null);
    const [modoExibicao, setModoExibicao] = useState('resumo');

    const [perguntasBase, setPerguntasBase] = useState([]);

    const [tipoFiltro, setTipoFiltro] = useState('dia');
    const [diaEspecifico, setDiaEspecifico] = useState(getLocalISODate());
    const [filtroMes, setFiltroMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
    const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [paginaAtual, setPaginaAtual] = useState(1);
    const ITENS_POR_PAGINA = 15;

    const [busca, setBusca] = useState('');
    const [filtroProfTabela, setFiltroProfTabela] = useState('TODOS');
    const [filtroUnidadeTabela, setFiltroUnidadeTabela] = useState('TODOS'); 
    const [filtroSexo, setFiltroSexo] = useState('TODOS');
    const [filtroAltura, setFiltroAltura] = useState({ min: '', max: '' });
    const [filtroPeso, setFiltroPeso] = useState({ min: '', max: '' });
    const [filtroSmi, setFiltroSmi] = useState({ min: '', max: '' });
    const [buscaAnamnese, setBuscaAnamnese] = useState('');

    const [sortConfig, setSortConfig] = useState({ key: 'data', direction: 'desc' });

    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const [tableScrollWidth, setTableScrollWidth] = useState(0);

    const [dadosFiltrados, setDadosFiltrados] = useState([]);
    const [loading, setLoading] = useState(false);

    const isAdmin = usuarioLogado?.role === 'ADMIN';
    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR' || usuarioLogado?.role === 'LIDER';
    const podeEditar = ['ADMIN', 'MENTOR', 'LIDER'].includes(usuarioLogado?.role);
    
    const anosUnicos = ['TODOS', ...new Set(avaliacoes.map(v => (v.data || v.created_at || '').split('-')[0]))].filter(Boolean).sort((a,b) => b-a);
    if (anosUnicos.length === 1) anosUnicos.push(new Date().getFullYear().toString());

    useEffect(() => {
        const fetchPerguntas = async () => {
            const { data } = await supabase.from('avaliacao_perguntas').select('id, pergunta, ordem').order('ordem', { ascending: true });
            if (data) setPerguntasBase(data);
        };
        fetchPerguntas();
    }, []);

    useEffect(() => {
        if (abaAtiva === 'nova' || abaAtiva === 'construtor') return; 

        const fetchDados = async () => {
            setLoading(true);
            try {
                let query = supabase.from('avaliacoes_realizadas').select('*').order('created_at', { ascending: false });

                if (professorAtivo?.id !== 'GLOBAL') {
                    query = query.eq('unidade', professorAtivo?.unidade || usuarioLogado?.unidade);
                }
                if (professorAtivo && professorAtivo.id !== 'GERAL' && professorAtivo.id !== 'GLOBAL') {
                    query = query.eq('professor', professorAtivo.nome);
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
                
                const dadosLimpos = (data || []).filter(a => a.professor !== 'VISÃO GERAL DA UNIDADE' && a.professor !== 'VISÃO GLOBAL DA REDE');
                setDadosFiltrados(dadosLimpos);
                setPaginaAtual(1); 
            } catch (error) {
                console.error("Erro ao buscar avaliações:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchDados();
    }, [tipoFiltro, diaEspecifico, filtroMes, filtroAno, dataInicio, dataFim, abaAtiva, professorAtivo, usuarioLogado?.unidade]);

    const limparFiltros = () => {
        setTipoFiltro('dia'); setDiaEspecifico(getLocalISODate()); setFiltroMes(String(new Date().getMonth() + 1).padStart(2, '0')); setFiltroAno(new Date().getFullYear().toString()); setDataInicio(''); setDataFim(''); setBusca('');
        setFiltroSexo('TODOS'); setFiltroAltura({min:'', max:''}); setFiltroPeso({min:'', max:''}); setFiltroSmi({min:'', max:''}); setBuscaAnamnese(''); setFiltroProfTabela('TODOS'); setFiltroUnidadeTabela('TODOS');
    };

    const removerAvaliacao = async (id) => {
        if (!podeEditar) return alert("Você não tem permissão para excluir avaliações.");
        if (window.confirm('🚨 ATENÇÃO: Tem certeza que deseja excluir esta avaliação?\n\nEsta ação banirá o registro permanentemente do banco de dados e não poderá ser desfeita.')) {
            try {
                const { error } = await supabase.from('avaliacoes_realizadas').delete().eq('id', id);
                if (error) throw error;
                setDadosFiltrados(prev => prev.filter(item => item.id !== id));
            } catch (err) { console.error(err); alert('Erro ao excluir avaliação. Verifique sua conexão.'); }
        }
    };

    const handleEditar = (avaliacao) => { setAvaliacaoEditando(avaliacao); setAbaAtiva('nova'); };
    const handleVoltar = () => { setAvaliacaoEditando(null); setAbaAtiva('relatorio'); };

    const metricas = useMemo(() => {
        const ranking = {}; let total = 0;
        dadosFiltrados.forEach(aval => {
            const chave = professorAtivo?.id === 'GLOBAL' ? (aval.unidade || 'DESCONHECIDA') : (aval.professor || 'SISTEMA');
            ranking[chave] = (ranking[chave] || 0) + 1;
            total++;
        });
        const rankingOrdenado = Object.entries(ranking).sort((a, b) => b[1] - a[1]).map(([nome, qtd]) => ({ nome, qtd, percentual: total > 0 ? ((qtd / total) * 100).toFixed(1) : 0 }));
        return { total, ranking: rankingOrdenado, totalEntidades: rankingOrdenado.length };
    }, [dadosFiltrados, professorAtivo]);

    const tabelaFiltrada = useMemo(() => {
        let filtrados = dadosFiltrados;

        if (filtroUnidadeTabela !== 'TODOS') filtrados = filtrados.filter(a => a.unidade === filtroUnidadeTabela);
        if (filtroProfTabela !== 'TODOS') filtrados = filtrados.filter(a => a.professor === filtroProfTabela);

        if (busca) {
            const b = busca.toLowerCase();
            const bNumeros = busca.replace(/\D/g, ''); 
            filtrados = filtrados.filter(a => (a.aluno || '').toLowerCase().includes(b) || (a.professor || '').toLowerCase().includes(b) || (a.cpf && a.cpf.includes(bNumeros)));
        }

        if (modoExibicao === 'detalhado') {
            if (filtroSexo !== 'TODOS') filtrados = filtrados.filter(a => a.sexo === filtroSexo);
            if (filtroAltura.min) filtrados = filtrados.filter(a => parseFloat(a.altura || 0) >= parseFloat(filtroAltura.min));
            if (filtroAltura.max) filtrados = filtrados.filter(a => parseFloat(a.altura || 0) <= parseFloat(filtroAltura.max));
            if (filtroPeso.min) filtrados = filtrados.filter(a => parseFloat(a.peso || 0) >= parseFloat(filtroPeso.min));
            if (filtroPeso.max) filtrados = filtrados.filter(a => parseFloat(a.peso || 0) <= parseFloat(filtroPeso.max));
            if (filtroSmi.min) filtrados = filtrados.filter(a => parseFloat(a.smi_resultado || 0) >= parseFloat(filtroSmi.min));
            if (filtroSmi.max) filtrados = filtrados.filter(a => parseFloat(a.smi_resultado || 0) <= parseFloat(filtroSmi.max));
            
            if (buscaAnamnese) {
                const bA = buscaAnamnese.toLowerCase();
                filtrados = filtrados.filter(a => {
                    if (!a.respostas_dinamicas) return false;
                    return Object.entries(a.respostas_dinamicas).some(([id, val]) => {
                        const p = perguntasBase.find(x => x.id === id);
                        const perguntaTxt = p ? p.pergunta.toLowerCase() : '';
                        const respostaTxt = String(val).toLowerCase();
                        return perguntaTxt.includes(bA) || respostaTxt.includes(bA);
                    });
                });
            }
        }
        return filtrados;
    }, [dadosFiltrados, busca, modoExibicao, filtroUnidadeTabela, filtroProfTabela, filtroSexo, filtroAltura, filtroPeso, filtroSmi, buscaAnamnese, perguntasBase]);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const dadosOrdenados = useMemo(() => {
        let itemsSort = [...tabelaFiltrada];
        itemsSort.sort((a, b) => {
            let valA, valB;
            switch (sortConfig.key) {
                case 'data': valA = new Date(a.created_at || a.criado_em).getTime(); valB = new Date(b.created_at || b.criado_em).getTime(); break;
                case 'aluno': valA = (a.aluno || '').toLowerCase(); valB = (b.aluno || '').toLowerCase(); break;
                case 'unidade': valA = (a.unidade || '').toLowerCase(); valB = (b.unidade || '').toLowerCase(); break;
                case 'estrutura': valA = parseFloat(a.peso || 0); valB = parseFloat(b.peso || 0); break; 
                case 'indices': valA = parseFloat(a.smi_resultado || 0); valB = parseFloat(b.smi_resultado || 0); break;
                case 'avaliador': valA = (a.professor || '').toLowerCase(); valB = (b.professor || '').toLowerCase(); break;
                default: return 0;
            }
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return itemsSort;
    }, [tabelaFiltrada, sortConfig]);

    const totalPaginas = Math.ceil(dadosOrdenados.length / ITENS_POR_PAGINA);
    const dadosPaginados = dadosOrdenados.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA);

    useEffect(() => {
        const updateScrollWidth = () => {
            if (tableScrollRef.current) setTableScrollWidth(tableScrollRef.current.scrollWidth);
        };
        updateScrollWidth();
        window.addEventListener('resize', updateScrollWidth);
        return () => window.removeEventListener('resize', updateScrollWidth);
    }, [dadosPaginados, modoExibicao, perguntasBase]);

    const handleTopScroll = () => { 
        if (tableScrollRef.current && topScrollRef.current) {
            tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
        }
    };
    const handleBottomScroll = () => { 
        if (topScrollRef.current && tableScrollRef.current) {
            topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
        }
    };

    useEffect(() => { if (window.lucide) window.lucide.createIcons(); }, [professorAtivo, abaAtiva, dadosPaginados, modoExibicao]);

    if (!professorAtivo && abaAtiva !== 'construtor') {
        const profsDaUnidade = colaboradores.filter(c => c.unidade === usuarioLogado?.unidade);

        return (
            <div className="flex flex-col items-center justify-start min-h-[75vh] animate-[fadeIn_0.3s_ease-out] px-4 relative max-w-6xl mx-auto pt-10">
                <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-inner border border-blue-200">
                    <Dumbbell className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tight text-center">Painel de Avaliação Física</h2>
                <p className="text-slate-500 mb-10 font-medium text-center">Acesse a gestão estratégica ou selecione o perfil de avaliador.</p>
                
                <div className="w-full flex flex-col lg:flex-row justify-center gap-6 mb-12">
                    {temVisaoGlobal && (
                        <button onClick={() => setProfessorAtivo({ id: 'GLOBAL', nome: 'VISÃO GLOBAL DA REDE' })} className="bg-indigo-900 hover:bg-indigo-800 text-white p-6 rounded-[24px] shadow-[0_4px_20px_rgba(49,46,129,0.3)] flex items-center justify-center gap-4 transition-all hover:-translate-y-1 group flex-1 max-w-[400px]">
                            <div className="bg-indigo-800/50 p-3 rounded-xl"><Building2 className="w-8 h-8 text-indigo-300 group-hover:scale-110 transition-transform" /></div>
                            <div className="text-left">
                                <span className="font-black uppercase tracking-widest text-sm block leading-tight">Dashboard Global</span>
                                <span className="text-[9px] text-indigo-300 font-bold uppercase tracking-widest">Desempenho de todas as unidades</span>
                            </div>
                        </button>
                    )}

                    {podeEditar && (
                        <button onClick={() => setProfessorAtivo({ id: 'GERAL', nome: `DASHBOARD - ${usuarioLogado?.unidade}`, unidade: usuarioLogado?.unidade })} className="bg-slate-900 hover:bg-slate-800 text-white p-6 rounded-[24px] shadow-[0_4px_20px_rgba(15,23,42,0.3)] flex items-center justify-center gap-4 transition-all hover:-translate-y-1 group flex-1 max-w-[400px]">
                            <div className="bg-slate-800/50 p-3 rounded-xl"><BarChart3 className="w-8 h-8 text-blue-400 group-hover:scale-110 transition-transform" /></div>
                            <div className="text-left">
                                <span className="font-black uppercase tracking-widest text-sm block leading-tight">Dashboard da Unidade</span>
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Métricas da Unidade {usuarioLogado?.unidade}</span>
                            </div>
                        </button>
                    )}
                    
                    {isAdmin && (
                        <button onClick={() => setAbaAtiva('construtor')} className="bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-200 p-6 rounded-[24px] shadow-sm flex items-center justify-center gap-4 transition-all hover:-translate-y-1 hover:border-blue-200 group flex-1 max-w-[400px]">
                            <div className="bg-slate-100 p-3 rounded-xl"><ListChecks className="w-8 h-8 text-blue-500 group-hover:scale-110 transition-transform" /></div>
                            <div className="text-left">
                                <span className="font-black uppercase tracking-widest text-sm block leading-tight">Configurar Formulário</span>
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Editar perguntas da anamnese</span>
                            </div>
                        </button>
                    )}
                </div>

                <div className="w-full flex items-center gap-4 mb-6">
                    <div className="h-px bg-slate-200 flex-1"></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><User className="w-3.5 h-3.5"/> Avaliadores - Unidade {usuarioLogado?.unidade}</span>
                    <div className="h-px bg-slate-200 flex-1"></div>
                </div>

                {profsDaUnidade.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl text-center w-full max-w-md">
                        <p className="text-amber-700 font-bold">Nenhum avaliador cadastrado nesta unidade.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 w-full">
                        {profsDaUnidade.map(c => (
                            <button key={c.id} onClick={() => setProfessorAtivo({ ...c, unidade: usuarioLogado?.unidade })} className="bg-white border border-slate-200 p-5 rounded-[24px] shadow-sm hover:border-blue-500 hover:shadow-lg hover:-translate-y-1 transition-all group flex flex-col items-center gap-4">
                                <div className="w-14 h-14 bg-slate-100 text-slate-500 group-hover:bg-blue-500 group-hover:text-white rounded-full flex items-center justify-center font-black text-xl transition-colors shadow-inner">
                                    {c.nome.charAt(0)}
                                </div>
                                <div className="text-center">
                                    <span className="font-black text-slate-700 group-hover:text-blue-700 block leading-tight text-sm">{c.nome.split(' ')[0]}</span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 block line-clamp-1">{c.nome.split(' ').slice(1).join(' ')}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    if (abaAtiva === 'construtor') {
        return (
            <div className="space-y-6 animate-[fadeIn_0.4s_ease-out] max-w-[1400px] mx-auto relative pb-10">
                <div className="flex items-center justify-between bg-slate-900 rounded-[24px] p-6 shadow-md">
                    <div>
                        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
                            <ListChecks className="w-6 h-6 text-blue-500" /> Construtor de Anamnese Dinâmica
                        </h2>
                    </div>
                    <button type="button" onClick={() => setAbaAtiva('relatorio')} className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors">Voltar para o Painel</button>
                </div>
                <TabPerguntasAvaliacao usuarioLogado={usuarioLogado} />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-[fadeIn_0.4s_ease-out] max-w-[1600px] mx-auto relative pb-10">
            
            <div className="bg-white rounded-[24px] border border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm flex-wrap gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-[300px]">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors shrink-0 shadow-inner ${professorAtivo.id === 'GLOBAL' ? 'bg-indigo-100 text-indigo-600' : professorAtivo.id === 'GERAL' ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-600'}`}>
                        {professorAtivo.id === 'GLOBAL' ? <Building2 className="w-6 h-6" /> : professorAtivo.id === 'GERAL' ? <BarChart3 className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
                    </div>
                    <div className="flex-1 max-w-xl">
                        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight leading-none mb-1">
                            {professorAtivo.nome}
                        </h2>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            {professorAtivo.id === 'GLOBAL' ? 'Painel de Gestão da Rede' : `Painel de Avaliação Física • Unidade ${professorAtivo.unidade || usuarioLogado?.unidade}`}
                        </span>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    {abaAtiva !== 'nova' && professorAtivo.id !== 'GERAL' && professorAtivo.id !== 'GLOBAL' && (
                        <button onClick={() => { setAvaliacaoEditando(null); setAbaAtiva('nova'); }} className="px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_4px_15px_rgba(249,115,22,0.3)] flex items-center gap-2 bg-orange-500 text-white hover:bg-orange-600">
                            <PlusCircle className="w-4 h-4" /> Nova Avaliação
                        </button>
                    )}
                    <button onClick={() => { setProfessorAtivo(null); handleVoltar(); }} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center gap-2 bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200">
                        <LogOut className="w-4 h-4" /> Voltar ao Início
                    </button>
                </div>
            </div>

            {abaAtiva === 'nova' ? (
                <FormAvaliacao usuarioLogado={usuarioLogado} professorAtivo={professorAtivo} voltar={handleVoltar} avaliacaoEditando={avaliacaoEditando} />
            ) : (
                <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
                    
                    <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-6">
                        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-inner">
                                    <Filter className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-slate-800 tracking-tight leading-tight">Período de Análise</h2>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Selecione a data para atualizar o dashboard</p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
                                <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full md:w-auto overflow-x-auto custom-scrollbar">
                                    <button onClick={() => setTipoFiltro('dia')} className={`flex-1 min-w-[80px] px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoFiltro === 'dia' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Dia</button>
                                    <button onClick={() => setTipoFiltro('mes')} className={`flex-1 min-w-[80px] px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoFiltro === 'mes' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Mês</button>
                                    <button onClick={() => setTipoFiltro('periodo')} className={`flex-1 min-w-[80px] px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoFiltro === 'periodo' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Período</button>
                                </div>

                                {tipoFiltro === 'dia' && (
                                    <input type="date" value={diaEspecifico} onChange={(e) => setDiaEspecifico(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" />
                                )}
                                {tipoFiltro === 'mes' && (
                                    <>
                                        <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm">{mesesTraduzidos.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}</select>
                                        <select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm">{anosUnicos.map(a => <option key={a} value={a}>{a}</option>)}</select>
                                    </>
                                )}
                                {tipoFiltro === 'periodo' && (
                                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-2 py-1 shadow-sm">
                                        <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="bg-transparent border-none p-1.5 text-xs font-bold text-slate-700 outline-none" />
                                        <span className="text-slate-300 font-bold">até</span>
                                        <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="bg-transparent border-none p-1.5 text-xs font-bold text-slate-700 outline-none" />
                                    </div>
                                )}
                                <button onClick={limparFiltros} className="p-2.5 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-xl transition-colors border border-slate-200" title="Limpar Filtros"><RefreshCw className="w-4 h-4" /></button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                        <div className="xl:col-span-1 flex flex-col gap-4">
                            <div className="bg-white border border-slate-200 p-6 rounded-[24px] shadow-sm flex flex-col justify-center relative overflow-hidden group hover:border-blue-300 transition-colors h-full min-h-[140px]">
                                <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-blue-50 rounded-full group-hover:scale-[2] transition-transform duration-500"></div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">Total Avaliações</span>
                                <span className="text-5xl font-black text-slate-800 relative z-10">{metricas.total}</span>
                            </div>
                            
                            {(professorAtivo.id === 'GERAL' || professorAtivo.id === 'GLOBAL') && (
                                <div className="bg-white border border-slate-200 p-6 rounded-[24px] shadow-sm flex flex-col justify-center relative overflow-hidden group hover:border-emerald-300 transition-colors h-full min-h-[140px]">
                                    <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-emerald-50 rounded-full group-hover:scale-[2] transition-transform duration-500"></div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">
                                        {professorAtivo.id === 'GLOBAL' ? 'Média / Unidade' : 'Média / Avaliador'}
                                    </span>
                                    <span className="text-5xl font-black text-slate-800 relative z-10">{metricas.totalEntidades > 0 ? (metricas.total / metricas.totalEntidades).toFixed(1) : 0}</span>
                                </div>
                            )}
                        </div>

                        {(professorAtivo.id === 'GERAL' || professorAtivo.id === 'GLOBAL') && (
                            <div className="xl:col-span-3 bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[300px]">
                                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                            <Trophy className="w-4 h-4 text-orange-500" /> {professorAtivo.id === 'GLOBAL' ? 'Ranking de Unidades' : 'Ranking de Avaliadores'}
                                        </h3>
                                        {professorAtivo.id === 'GLOBAL' && <p className="text-[9px] font-bold text-slate-500 mt-1">💡 Dica: Clique em uma unidade para filtrar a tabela.</p>}
                                    </div>
                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-white px-2 py-1 rounded border shadow-sm">{metricas.totalEntidades} Ativos</span>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                                    {metricas.ranking.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full text-center">
                                            <Users className="w-8 h-8 text-slate-300 mb-2" />
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sem dados no período.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                                            {metricas.ranking.map((item, index) => (
                                                <div 
                                                    key={item.nome} 
                                                    onClick={() => {
                                                        if (professorAtivo.id === 'GLOBAL') {
                                                            setFiltroUnidadeTabela(item.nome);
                                                            setPaginaAtual(1);
                                                            document.getElementById('tabela-historico')?.scrollIntoView({ behavior: 'smooth' });
                                                        }
                                                    }}
                                                    className={`flex items-center justify-between p-3 rounded-xl border border-transparent transition-all ${professorAtivo.id === 'GLOBAL' ? 'cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm' : 'hover:bg-slate-50 hover:border-slate-100'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-black ${index === 0 ? 'bg-orange-100 text-orange-600' : index === 1 ? 'bg-slate-200 text-slate-600' : index === 2 ? 'bg-amber-100 text-amber-700' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
                                                            {index + 1}º
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-black text-slate-700 uppercase tracking-tight line-clamp-1">{item.nome}</span>
                                                            {professorAtivo.id === 'GLOBAL' && <MousePointerClick className="w-3 h-3 text-slate-300" />}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-right">
                                                        <span className="text-[10px] font-bold text-slate-400">{item.percentual}%</span>
                                                        <span className="text-sm font-black text-slate-800">{item.qtd}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div id="tabela-historico" className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        
                        <div className="px-6 py-5 border-b border-slate-100 flex flex-col gap-4 bg-slate-50 shrink-0">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
                                    <ClipboardSignature className="w-6 h-6 text-blue-500"/> Histórico de Avaliações
                                </h3>
                                
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-full sm:w-auto">
                                        <button onClick={() => setModoExibicao('resumo')} className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${modoExibicao === 'resumo' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Resumo</button>
                                        <button onClick={() => setModoExibicao('detalhado')} className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${modoExibicao === 'detalhado' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}><Eye className="w-3.5 h-3.5"/> Detalhado</button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col lg:flex-row gap-4 items-center w-full">
                                <div className="relative w-full lg:flex-1">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                    <input type="text" value={busca} onChange={(e) => {setBusca(e.target.value); setPaginaAtual(1);}} placeholder="Busca rápida: Nome do aluno, CPF ou Avaliador..." className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all" />
                                </div>

                                {professorAtivo.id === 'GLOBAL' && (
                                    <div className="w-full lg:w-64">
                                        <select value={filtroUnidadeTabela} onChange={(e) => {setFiltroUnidadeTabela(e.target.value); setPaginaAtual(1);}} className="w-full bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 text-sm font-black text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm">
                                            <option value="TODOS">Todas as Unidades</option>
                                            {metricas.ranking.map(u => <option key={u.nome} value={u.nome}>{u.nome}</option>)}
                                        </select>
                                    </div>
                                )}

                                {professorAtivo.id === 'GERAL' && (
                                    <div className="w-full lg:w-72">
                                        <select value={filtroProfTabela} onChange={(e) => {setFiltroProfTabela(e.target.value); setPaginaAtual(1);}} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm">
                                            <option value="TODOS">Todos os Avaliadores</option>
                                            {metricas.ranking.map(p => <option key={p.nome} value={p.nome}>{p.nome}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {modoExibicao === 'detalhado' && (
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-2 p-5 bg-white rounded-2xl border border-slate-200 shadow-[inset_0_2px_15px_rgba(0,0,0,0.02)] animate-[slideDown_0.2s_ease-out]">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Gênero</label>
                                        <select value={filtroSexo} onChange={(e) => setFiltroSexo(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500">
                                            <option value="TODOS">Todos</option><option value="M">Masculino</option><option value="F">Feminino</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Altura (m)</label>
                                        <div className="flex gap-2">
                                            <input type="number" step="0.01" value={filtroAltura.min} onChange={(e) => setFiltroAltura({...filtroAltura, min: e.target.value})} placeholder="Mín" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500" />
                                            <input type="number" step="0.01" value={filtroAltura.max} onChange={(e) => setFiltroAltura({...filtroAltura, max: e.target.value})} placeholder="Máx" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500" />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Peso (Kg)</label>
                                        <div className="flex gap-2">
                                            <input type="number" step="0.1" value={filtroPeso.min} onChange={(e) => setFiltroPeso({...filtroPeso, min: e.target.value})} placeholder="Mín" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500" />
                                            <input type="number" step="0.1" value={filtroPeso.max} onChange={(e) => setFiltroPeso({...filtroPeso, max: e.target.value})} placeholder="Máx" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500" />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">SMI</label>
                                        <div className="flex gap-2">
                                            <input type="number" step="0.1" value={filtroSmi.min} onChange={(e) => setFiltroSmi({...filtroSmi, min: e.target.value})} placeholder="Mín" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500" />
                                            <input type="number" step="0.1" value={filtroSmi.max} onChange={(e) => setFiltroSmi({...filtroSmi, max: e.target.value})} placeholder="Máx" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500" />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Busca na Anamnese</label>
                                        <input type="text" value={buscaAnamnese} onChange={(e) => setBuscaAnamnese(e.target.value)} placeholder="Ex: NPS, Musculação..." className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500" />
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div ref={topScrollRef} onScroll={handleTopScroll} className="w-full overflow-x-auto custom-scrollbar bg-slate-50/80 border-b border-slate-200" style={{ height: '14px' }}>
                            <div style={{ width: tableScrollWidth > 0 ? `${tableScrollWidth}px` : '100%', height: '1px' }}></div>
                        </div>

                        <div ref={tableScrollRef} onScroll={handleBottomScroll} className="flex-1 overflow-x-auto custom-scrollbar relative min-h-[400px]">
                            {loading ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
                                    <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Carregando BI...</p>
                                </div>
                            ) : (
                                <table className={`w-full text-left border-collapse ${modoExibicao === 'detalhado' ? 'min-w-[max-content]' : 'min-w-[1000px]'}`}>
                                    <thead className="bg-white sticky top-0 z-10 shadow-sm border-b-2 border-slate-200">
                                        <tr>
                                            <th onClick={() => handleSort('data')} className="cursor-pointer hover:bg-slate-50 group px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">Data <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortConfig.key === 'data' ? 'text-blue-500' : 'text-slate-300 group-hover:text-blue-400'}`} /></div>
                                            </th>
                                            <th onClick={() => handleSort('aluno')} className="cursor-pointer hover:bg-slate-50 group px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">Aluno(a) <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortConfig.key === 'aluno' ? 'text-blue-500' : 'text-slate-300 group-hover:text-blue-400'}`} /></div>
                                            </th>
                                            {professorAtivo.id === 'GLOBAL' && (
                                                <th onClick={() => handleSort('unidade')} className="cursor-pointer hover:bg-slate-50 group px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">Unidade <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortConfig.key === 'unidade' ? 'text-blue-500' : 'text-slate-300 group-hover:text-blue-400'}`} /></div>
                                                </th>
                                            )}
                                            <th onClick={() => handleSort('estrutura')} className="cursor-pointer hover:bg-slate-50 group px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">Estrutura Física <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortConfig.key === 'estrutura' ? 'text-blue-500' : 'text-slate-300 group-hover:text-blue-400'}`} /></div>
                                            </th>
                                            
                                            {modoExibicao === 'detalhado' && (
                                                <>
                                                    <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap bg-blue-50/50">Bioimpedância</th>
                                                    <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap bg-blue-50/50">Gordura (RCQ/GV)</th>
                                                    {perguntasBase.map(p => (
                                                        <th key={p.id} className="px-5 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest min-w-[200px] max-w-[300px] bg-slate-50 border-l border-slate-200/50">
                                                            {p.pergunta}
                                                        </th>
                                                    ))}
                                                </>
                                            )}

                                            <th onClick={() => handleSort('indices')} className="cursor-pointer hover:bg-slate-50 group px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">Índices (SMI/HID) <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortConfig.key === 'indices' ? 'text-blue-500' : 'text-slate-300 group-hover:text-blue-400'}`} /></div>
                                            </th>
                                            <th onClick={() => handleSort('avaliador')} className="cursor-pointer hover:bg-slate-50 group px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">Avaliador <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortConfig.key === 'avaliador' ? 'text-blue-500' : 'text-slate-300 group-hover:text-blue-400'}`} /></div>
                                            </th>
                                            <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap sticky right-0 bg-white shadow-[-5px_0_10px_rgba(0,0,0,0.02)]">Anexo IA</th>
                                            {podeEditar && <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">Ações</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {dadosPaginados.length > 0 ? (
                                            dadosPaginados.map((a, idx) => {
                                                const d = new Date(a.created_at || a.criado_em);
                                                const dataStr = d.toLocaleDateString(langAtual);
                                                const horaStr = d.toLocaleTimeString(langAtual, { hour: '2-digit', minute: '2-digit' });
                                                
                                                return (
                                                    <tr key={a.id || idx} className="hover:bg-slate-50 transition-colors group">
                                                        <td className="px-5 py-4 whitespace-nowrap align-top">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-black text-slate-700">{dataStr}</span>
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{horaStr}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-4 whitespace-nowrap align-top">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{a.aluno || 'NÃO INFORMADO'}</span>
                                                                {a.cpf && <span className="text-[10px] font-bold text-slate-500 tracking-widest mt-1 font-mono">CPF: {mascaraCPF(a.cpf)}</span>}
                                                            </div>
                                                        </td>
                                                        {professorAtivo.id === 'GLOBAL' && (
                                                            <td className="px-5 py-4 whitespace-nowrap align-top">
                                                                <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">{a.unidade || 'N/I'}</span>
                                                            </td>
                                                        )}
                                                        <td className="px-5 py-4 whitespace-nowrap align-top">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-black text-slate-700">{a.peso ? `${a.peso} kg` : '-'}</span>
                                                                <span className="text-[11px] font-bold text-slate-400 mt-0.5">{a.altura ? `${a.altura} m` : '-'}</span>
                                                            </div>
                                                        </td>

                                                        {modoExibicao === 'detalhado' && (
                                                            <>
                                                                <td className="px-5 py-4 whitespace-nowrap align-top bg-blue-50/20">
                                                                    <div className="flex flex-col gap-1">
                                                                        <span className="text-[10px] font-bold text-slate-500">MME: <strong className="text-slate-700 text-xs">{a.mme ? `${a.mme} kg` : '-'}</strong></span>
                                                                        <span className="text-[10px] font-bold text-slate-500">PGC: <strong className="text-slate-700 text-xs">{a.pgc ? `${a.pgc}%` : '-'}</strong></span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-5 py-4 whitespace-nowrap align-top bg-blue-50/20">
                                                                     <div className="flex flex-col gap-1">
                                                                        <span className="text-[10px] font-bold text-slate-500">RCQ: <strong className="text-slate-700 text-xs">{a.rcq || '-'}</strong></span>
                                                                        <span className="text-[10px] font-bold text-slate-500">GV: <strong className="text-slate-700 text-xs">{a.gv || '-'}</strong></span>
                                                                    </div>
                                                                </td>
                                                                
                                                                {perguntasBase.map(p => {
                                                                    const rawResp = a.respostas_dinamicas?.[p.id];
                                                                    const textoResposta = rawResp ? (Array.isArray(rawResp) ? rawResp.join(', ') : String(rawResp)) : '-';
                                                                    return (
                                                                        <td key={p.id} className="px-5 py-4 align-top bg-slate-50/30 border-l border-slate-200/50">
                                                                            <span className={`text-[11px] font-medium leading-snug ${textoResposta === '-' ? 'text-slate-300' : 'text-blue-700 bg-white border border-slate-200 px-2 py-1 rounded inline-block shadow-sm'}`}>
                                                                                {textoResposta}
                                                                            </span>
                                                                        </td>
                                                                    );
                                                                })}
                                                            </>
                                                        )}

                                                        <td className="px-5 py-4 whitespace-nowrap align-top">
                                                            <div className="flex flex-col gap-1.5">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest w-8">SMI</span>
                                                                    <span className="text-sm font-black text-slate-700">{a.smi_resultado || '-'}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest w-8">HID</span>
                                                                    <span className="text-sm font-black text-slate-700">{a.hidratacao_resultado ? `${a.hidratacao_resultado}%` : '-'}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-4 whitespace-nowrap align-top">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{a.professor || 'SISTEMA'}</span>
                                                                <span className="text-[9px] font-bold text-slate-400 mt-1">Lançado: {a.registrado_por_nome || '-'}</span>
                                                            </div>
                                                        </td>
                                                        
                                                        <td className="px-5 py-4 text-center whitespace-nowrap align-top sticky right-0 bg-white shadow-[-5px_0_10px_rgba(0,0,0,0.02)]">
                                                            {a.arquivo_inbody_url ? (
                                                                <a href={a.arquivo_inbody_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 hover:text-emerald-700 transition-colors shadow-sm border border-emerald-100 hover:-translate-y-0.5" title="Visualizar Exame Original">
                                                                    <FileText className="w-5 h-5" />
                                                                </a>
                                                            ) : (
                                                                <span className="text-xs font-bold text-slate-300">-</span>
                                                            )}
                                                        </td>
                                                        
                                                        {podeEditar && (
                                                            <td className="px-5 py-4 text-center whitespace-nowrap align-top">
                                                                <div className="flex items-center justify-center gap-2 opacity-100 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity">
                                                                    <button onClick={() => handleEditar(a)} className="p-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 rounded-xl transition-colors border border-blue-100 shadow-sm" title="Editar Avaliação">
                                                                        <Edit3 className="w-4 h-4" />
                                                                    </button>
                                                                    <button onClick={() => removerAvaliacao(a.id)} className="p-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 rounded-xl transition-colors border border-rose-100 shadow-sm" title="Excluir Permanentemente">
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        )}
                                                    </tr>
                                                )
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={modoExibicao === 'detalhado' ? (professorAtivo.id === 'GLOBAL' ? (10 + perguntasBase.length + (podeEditar?1:0)) : (9 + perguntasBase.length + (podeEditar?1:0))) : (professorAtivo.id === 'GLOBAL' ? (podeEditar ? "8" : "7") : (podeEditar ? "7" : "6"))} className="text-center py-24">
                                                    <div className="flex flex-col items-center">
                                                        <Search className="w-10 h-10 text-slate-200 mb-3" />
                                                        <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Nenhum registro encontrado.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        
                        {totalPaginas > 1 && (
                            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Página {paginaAtual} de {totalPaginas}</span>
                                <div className="flex gap-2">
                                    <button onClick={() => setPaginaAtual(p => Math.max(1, p - 1))} disabled={paginaAtual === 1} className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 disabled:opacity-50 hover:bg-slate-100 text-[10px] font-black uppercase tracking-widest transition-colors shadow-sm">Anterior</button>
                                    <button onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))} disabled={paginaAtual === totalPaginas} className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 disabled:opacity-50 hover:bg-slate-100 text-[10px] font-black uppercase tracking-widest transition-colors shadow-sm">Próxima</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AvaliacaoFisica;