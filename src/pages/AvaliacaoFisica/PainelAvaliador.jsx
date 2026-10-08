import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../supabaseClient.js';
import { 
    ArrowLeft, Building2, BarChart3, LogOut, PlusCircle, Filter, Calendar as CalendarIcon, 
    RefreshCw, FileDigit, TrendingUp, ArrowUpDown, CalendarDays, Trophy, MousePointerClick, 
    ClipboardSignature, ListChecks, Activity, Search, Download, Scale, Ruler, LineChart, 
    FileText, Eye, Edit3, Trash2, Send, Check, Copy, X, UserRoundPen
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext.jsx'; 
import { getMeses } from '../AnaliseVendas/utils.js';
import { mascaraCPF } from '../CadastroGeral/utilsAlunos.js';
import FormAvaliacao from './FormAvaliacao';

const getLocalISODate = () => {
    const d = new Date();
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
};

const getStatusDot = (status) => {
    if (!status) return 'bg-slate-300 dark:bg-slate-600';
    const s = status.toUpperCase();
    if (s.includes('ADEQUADO') || s.includes('ÓTIMO') || s.includes('NORMAL')) return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
    if (s.includes('ATENÇÃO') || s.includes('MODERADO')) return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]';
    if (s.includes('ALERTA') || s.includes('BAIXO') || s.includes('ALTO') || s.includes('RUIM') || s.includes('ACIMA')) return 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]';
    return 'bg-slate-300 dark:bg-slate-600';
};

const PainelAvaliador = ({ 
    usuarioLogado, professorAtivo, setProfessorAtivo, 
    abaAtiva, setAbaAtiva, avaliacaoEditando, setAvaliacaoEditando, 
    handleVoltar, setAlunoEvolucaoModal, avaliacoes = [], colaboradores = []
}) => {
    const { t, locale, language } = useI18n(); 
    const langAtual = locale || language || 'pt-BR';
    const mesesTraduzidos = getMeses(t);

    const [modoExibicao, setModoExibicao] = useState('resumo');
    const [perguntasBase, setPerguntasBase] = useState([]);

    const [tipoFiltro, setTipoFiltro] = useState('dia');
    const [diaEspecifico, setDiaEspecifico] = useState(getLocalISODate());
    const [filtroMes, setFiltroMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
    const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [paginaAtual, setPaginaAtual] = useState(1);
    const ITENS_POR_PAGINA = 10;

    const [busca, setBusca] = useState('');
    const [filtroProfTabela, setFiltroProfTabela] = useState('TODOS');
    const [filtroUnidadeTabela, setFiltroUnidadeTabela] = useState('TODOS'); 
    const [filtroSexo, setFiltroSexo] = useState('TODOS');
    const [filtroAltura, setFiltroAltura] = useState({ min: '', max: '' });
    const [filtroPeso, setFiltroPeso] = useState({ min: '', max: '' });
    const [filtroSmi, setFiltroSmi] = useState({ min: '', max: '' });
    const [buscaAnamnese, setBuscaAnamnese] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'data', direction: 'desc' });

    const [modalRelatorioAberto, setModalRelatorioAberto] = useState(false);
    const [copiado, setCopiado] = useState(false);
    
    // 🔥 NOVO ESTADO: Controla qual linha está com o Avaliador em modo de edição
    const [editingAvaliadorId, setEditingAvaliadorId] = useState(null);

    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const [tableScrollWidth, setTableScrollWidth] = useState(0);

    const [dadosFiltrados, setDadosFiltrados] = useState([]);
    const [loading, setLoading] = useState(false);

    const podeEditar = ['ADMIN', 'MENTOR', 'LIDER'].includes(usuarioLogado?.role);
    const anosUnicos = ['TODOS', ...new Set(avaliacoes.map(v => (v.data || v.created_at || '').split('-')[0]))].filter(Boolean).sort((a,b) => b-a);
    if (anosUnicos.length === 1) anosUnicos.push(new Date().getFullYear().toString());

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setModalRelatorioAberto(false);
                setEditingAvaliadorId(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        const fetchPerguntas = async () => {
            const { data } = await supabase.from('avaliacao_perguntas').select('id, pergunta, ordem').order('ordem', { ascending: true });
            if (data) setPerguntasBase(data);
        };
        fetchPerguntas();
    }, []);

    useEffect(() => {
        if (abaAtiva === 'nova') return; 

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
        if (!podeEditar) return alert("Você não tem permissão.");
        if (window.confirm('🚨 ATENÇÃO: Tem certeza que deseja excluir esta avaliação?')) {
            try {
                const { error } = await supabase.from('avaliacoes_realizadas').delete().eq('id', id);
                if (error) throw error;
                setDadosFiltrados(prev => prev.filter(item => item.id !== id));
            } catch (err) { console.error(err); alert('Erro ao excluir avaliação.'); }
        }
    };

    const handleEditar = (avaliacao) => { setAvaliacaoEditando(avaliacao); setAbaAtiva('nova'); };

    // 🔥 NOVA FUNÇÃO: Salvar a edição inline do Avaliador
    const handleSalvarNovoAvaliador = async (avaliacaoId, novoAvaliadorNome) => {
        if (!novoAvaliadorNome) {
            setEditingAvaliadorId(null);
            return;
        }
        
        try {
            const { error } = await supabase
                .from('avaliacoes_realizadas')
                .update({ professor: novoAvaliadorNome })
                .eq('id', avaliacaoId);
            
            if (error) throw error;
            
            // Atualiza na tela instantaneamente
            setDadosFiltrados(prev => prev.map(item => 
                item.id === avaliacaoId ? { ...item, professor: novoAvaliadorNome } : item
            ));
        } catch (err) {
            console.error("Erro ao alterar avaliador:", err);
            alert("Erro ao alterar o avaliador. Verifique a conexão.");
        } finally {
            setEditingAvaliadorId(null);
        }
    };

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

    const textoRelatorioFormatado = useMemo(() => {
        const hoje = new Date();
        const horaStr = hoje.toLocaleTimeString(langAtual, { hour: '2-digit', minute: '2-digit' });
        const dataHojeStr = hoje.toLocaleDateString(langAtual, { day: '2-digit', month: '2-digit' });

        let filtroDesc = '';
        if (tipoFiltro === 'dia') {
            const [anoD, mesD, diaD] = diaEspecifico.split('-');
            filtroDesc = `${diaD}/${mesD}/${anoD}`;
        } else if (tipoFiltro === 'mes') {
            filtroDesc = `${filtroMes}/${filtroAno}`;
        } else {
            filtroDesc = `${dataInicio ? dataInicio.split('-').reverse().join('/') : ''} até ${dataFim ? dataFim.split('-').reverse().join('/') : ''}`;
        }

        let texto = `📊 *RESUMO EXECUTIVO - PRATIQUE FITNESS* 📊\n`;
        texto += `📅 *Filtro Ativo:* ${filtroDesc}\n`;
        texto += `🕒 *Gerado em:* ${dataHojeStr} às ${horaStr}\n\n`;

        if (metricas.ranking.length > 0) {
            metricas.ranking.forEach(item => {
                texto += `🏢 *${item.nome.toUpperCase()}:* ${item.qtd} avaliações\n`;
            });
        } else {
            texto += `Nenhuma avaliação registrada no período.\n`;
        }

        texto += `\n📈 *TOTAL GERAL:* ${metricas.total} avaliações`;
        return texto;
    }, [metricas, tipoFiltro, diaEspecifico, filtroMes, filtroAno, dataInicio, dataFim, langAtual]);

    const handleCopiarRelatorio = () => {
        navigator.clipboard.writeText(textoRelatorioFormatado);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
    };

    const handleEnviarWhatsApp = () => {
        const url = `https://wa.me/?text=${encodeURIComponent(textoRelatorioFormatado)}`;
        window.open(url, '_blank');
    };

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

    const metricasDashboard = useMemo(() => {
        let somaPeso = 0; let countPeso = 0;
        let somaAltura = 0; let countAltura = 0;
        let ultimaData = null;

        tabelaFiltrada.forEach(a => {
            const p = parseFloat(a.peso);
            if (!isNaN(p) && p > 0) { somaPeso += p; countPeso++; }
            const h = parseFloat(a.altura);
            if (!isNaN(h) && h > 0) { somaAltura += h; countAltura++; }
            
            const d = new Date(a.created_at || a.criado_em);
            if (!ultimaData || d > ultimaData) ultimaData = d;
        });

        const hoje = new Date();
        let diasAtras = null;
        if (ultimaData) {
            const diffTime = Math.abs(hoje - ultimaData);
            diasAtras = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        }

        return {
            total: tabelaFiltrada.length,
            pesoMedio: countPeso > 0 ? (somaPeso / countPeso).toFixed(1) : '-',
            alturaMedia: countAltura > 0 ? (somaAltura / countAltura).toFixed(2) : '-',
            ultimaAvaliacao: ultimaData,
            diasAtras: diasAtras
        };
    }, [tabelaFiltrada]);

    useEffect(() => {
        const updateScrollWidth = () => { if (tableScrollRef.current) setTableScrollWidth(tableScrollRef.current.scrollWidth); };
        updateScrollWidth();
        window.addEventListener('resize', updateScrollWidth);
        return () => window.removeEventListener('resize', updateScrollWidth);
    }, [dadosPaginados, modoExibicao, perguntasBase]);

    const handleTopScroll = () => { if (tableScrollRef.current && topScrollRef.current) { tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft; } };
    const handleBottomScroll = () => { if (topScrollRef.current && tableScrollRef.current) { topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft; } };

    return (
        <div className="max-w-[1500px] mx-auto space-y-4 relative z-10 animate-[fadeIn_0.3s_ease-out]">
            
            {/* MODAL PADRÃO EXECUTIVO PRATIQUE - RELATÓRIO DO WHATSAPP */}
            {modalRelatorioAberto && (
                <div className="fixed inset-0 z-[9999] bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]" onClick={(e) => { if (e.target === e.currentTarget) setModalRelatorioAberto(false); }}>
                    <div className="bg-white dark:bg-[#111827] rounded-[28px] shadow-2xl border border-slate-200 dark:border-white/10 w-full max-w-lg overflow-hidden flex flex-col animate-[slideDown_0.3s_ease-out]">
                        
                        <div className="bg-[#0f172a] dark:bg-[#090d16] px-6 py-5 flex items-center justify-between border-b border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-blue-600/20 text-blue-400 rounded-xl flex items-center justify-center border border-blue-500/20">
                                    <BarChart3 className="w-5 h-5" />
                                </div>
                                <h3 className="text-base font-black text-white uppercase tracking-wider">
                                    {professorAtivo.id === 'GLOBAL' ? 'RESUMO GLOBAL' : `RESUMO - ${professorAtivo.nome.toUpperCase()}`}
                                </h3>
                            </div>
                            <button onClick={() => setModalRelatorioAberto(false)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-6 bg-slate-50 dark:bg-[#0c101a]">
                            <div className="bg-white dark:bg-[#151c2e] p-5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-inner">
                                <pre className="font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed select-all">
                                    {textoRelatorioFormatado}
                                </pre>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-white dark:bg-[#111827] border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-3">
                            <button onClick={() => setModalRelatorioAberto(false)} className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                FECHAR
                            </button>
                            <button onClick={handleCopiarRelatorio} className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/20 transition-all flex items-center gap-1.5 active:scale-95">
                                {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                {copiado ? 'COPIADO!' : 'COPIAR'}
                            </button>
                            <button onClick={handleEnviarWhatsApp} className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-emerald-500 hover:bg-emerald-400 shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5 active:scale-95">
                                <Send className="w-3.5 h-3.5" />
                                ENVIAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CABEÇALHO DO AVALIADOR */}
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-slate-700/50 shadow-sm p-4 flex flex-col xl:flex-row items-center justify-between gap-4">
                <div className="flex items-center w-full xl:w-auto gap-4">
                    <button onClick={() => { setProfessorAtivo(null); handleVoltar(); }} className="px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1.5 shadow-sm transition-all shrink-0">
                        <ArrowLeft className="w-3.5 h-3.5"/> Voltar
                    </button>
                    
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/40 dark:to-indigo-900/40 text-blue-600 dark:text-blue-400 rounded-[14px] flex items-center justify-center text-lg font-black shrink-0 border border-blue-100 dark:border-blue-800/50 shadow-inner">
                        {professorAtivo.id === 'GLOBAL' ? <Building2 className="w-5 h-5"/> : professorAtivo.id === 'GERAL' ? <BarChart3 className="w-5 h-5"/> : professorAtivo.nome.charAt(0)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none truncate">
                            {professorAtivo.nome}
                        </h2>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1 truncate">
                            {professorAtivo.id === 'GLOBAL' ? 'Painel de Gestão da Rede' : `Painel de Avaliação Física • Unidade ${professorAtivo.unidade || usuarioLogado?.unidade}`}
                        </p>
                    </div>
                </div>

                <div className="flex w-full xl:w-auto items-center gap-3 justify-end shrink-0">
                    <button onClick={() => { setProfessorAtivo(null); handleVoltar(); }} className="px-4 py-2.5 text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest rounded-xl transition-colors flex items-center gap-1.5 bg-blue-50/80 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-100 dark:border-blue-800 shadow-sm whitespace-nowrap">
                        <LogOut className="w-3.5 h-3.5" /> Trocar Professor
                    </button>
                    
                    {abaAtiva !== 'nova' && professorAtivo.id !== 'GERAL' && professorAtivo.id !== 'GLOBAL' && (
                        <button onClick={() => { setAvaliacaoEditando(null); setAbaAtiva('nova'); }} className="px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_4px_15px_rgba(249,115,22,0.3)] flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:shadow-[0_6px_20px_rgba(249,115,22,0.4)] hover:-translate-y-0.5 border border-orange-400 dark:border-orange-500/50 whitespace-nowrap">
                            <PlusCircle className="w-4 h-4" /> Nova Avaliação
                        </button>
                    )}
                </div>
            </div>

            {abaAtiva === 'nova' ? (
                <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-sm border border-white/50 dark:border-slate-700/50 p-4 lg:p-6">
                    <FormAvaliacao avaliacaoEditando={avaliacaoEditando} professorAtivo={professorAtivo} usuarioLogado={usuarioLogado} voltar={handleVoltar} colaboradores={colaboradores} />
                </div>
            ) : (
                <div className="space-y-4">
                    {/* BARRA DE FILTROS */}
                    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-white/50 dark:border-slate-700/50 shadow-sm p-4 flex flex-col xl:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3 shrink-0">
                            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center border border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400">
                                <Filter className="w-4 h-4" />
                            </div>
                            <div>
                                <h2 className="text-base font-black text-slate-800 dark:text-white tracking-tight leading-none">Filtros de Histórico</h2>
                                <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">Ajuste a visualização dos dados</p>
                            </div>
                        </div>

                        <div className="flex flex-col lg:flex-row items-center gap-3 w-full xl:w-auto">
                            <div className="flex bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl w-full md:w-auto shadow-inner border border-slate-200/50 dark:border-slate-700/50">
                                <button onClick={() => setTipoFiltro('dia')} className={`flex-1 min-w-[70px] px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${tipoFiltro === 'dia' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>Dia</button>
                                <button onClick={() => setTipoFiltro('mes')} className={`flex-1 min-w-[70px] px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${tipoFiltro === 'mes' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>Mês</button>
                                <button onClick={() => setTipoFiltro('periodo')} className={`flex-1 min-w-[70px] px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${tipoFiltro === 'periodo' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>Período</button>
                            </div>

                            <div className="flex items-center gap-2 w-full md:w-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 shadow-sm focus-within:ring-1 focus-within:ring-blue-500/50">
                                {tipoFiltro === 'dia' && (
                                    <div className="flex items-center">
                                        <CalendarIcon className="w-3.5 h-3.5 text-blue-500 ml-2 mr-1" />
                                        <input type="date" value={diaEspecifico} onChange={(e) => setDiaEspecifico(e.target.value)} className="bg-transparent border-none px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none w-32" />
                                    </div>
                                )}
                                {tipoFiltro === 'mes' && (
                                    <div className="flex items-center gap-1.5 px-2">
                                        <CalendarIcon className="w-3.5 h-3.5 text-blue-500" />
                                        <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="bg-transparent border-none py-1 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none w-24">{mesesTraduzidos.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}</select>
                                        <select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)} className="bg-transparent border-none py-1 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none w-16">{anosUnicos.map(a => <option key={a} value={a}>{a}</option>)}</select>
                                    </div>
                                )}
                                {tipoFiltro === 'periodo' && (
                                    <div className="flex items-center gap-1 px-2">
                                        <CalendarIcon className="w-3.5 h-3.5 text-blue-500 mr-1" />
                                        <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="bg-transparent border-none py-1 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none w-28" />
                                        <span className="text-slate-400 font-bold text-[9px] px-1 uppercase">até</span>
                                        <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="bg-transparent border-none py-1 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none w-28" />
                                    </div>
                                )}
                                
                                <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                                <button onClick={limparFiltros} className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors" title="Limpar Filtros"><RefreshCw className="w-3.5 h-3.5" /></button>
                            </div>
                        </div>
                    </div>

                    {/* INDICADORES */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl p-5 shadow-sm border border-white/50 dark:border-slate-700/50 flex items-center justify-between relative overflow-hidden group hover:border-blue-200 dark:hover:border-blue-700 transition-colors">
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-800">
                                    <FileDigit className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-0.5">Total Avaliações</span>
                                    <span className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">{metricasDashboard.total}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl p-5 shadow-sm border border-white/50 dark:border-slate-700/50 flex items-center justify-between relative overflow-hidden group hover:border-emerald-200 dark:hover:border-emerald-700 transition-colors">
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500 dark:text-emerald-400 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-800">
                                    <TrendingUp className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-0.5">Peso Médio</span>
                                    <span className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none flex items-baseline gap-1">
                                        {metricasDashboard.pesoMedio} <span className="text-xs font-bold text-slate-400">kg</span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl p-5 shadow-sm border border-white/50 dark:border-slate-700/50 flex items-center justify-between relative overflow-hidden group hover:border-purple-200 dark:hover:border-purple-700 transition-colors">
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/30 text-purple-500 dark:text-purple-400 rounded-xl flex items-center justify-center shrink-0 border border-purple-100 dark:border-purple-800">
                                    <ArrowUpDown className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-0.5">Altura Média</span>
                                    <span className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none flex items-baseline gap-1">
                                        {metricasDashboard.alturaMedia} <span className="text-xs font-bold text-slate-400">m</span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl p-5 shadow-sm border border-white/50 dark:border-slate-700/50 flex items-center justify-between relative overflow-hidden group hover:border-orange-200 dark:hover:border-orange-700 transition-colors">
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/30 text-orange-500 dark:text-orange-400 rounded-xl flex items-center justify-center shrink-0 border border-orange-100 dark:border-orange-800">
                                    <CalendarDays className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-0.5">Última Avaliação</span>
                                    {metricasDashboard.ultimaAvaliacao ? (
                                        <>
                                            <span className="text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none mt-0.5">
                                                {metricasDashboard.ultimaAvaliacao.toLocaleDateString(langAtual, {day:'2-digit', month:'2-digit', year:'numeric'})}
                                            </span>
                                            {metricasDashboard.diasAtras !== null && (
                                                <span className="text-[9px] font-bold text-slate-400 mt-1">
                                                    {metricasDashboard.diasAtras === 0 ? 'Feita Hoje' : `${metricasDashboard.diasAtras} dias atrás`}
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <span className="text-lg font-black text-slate-400 mt-0.5">-</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RANKING GLOBAL */}
                    {(professorAtivo.id === 'GERAL' || professorAtivo.id === 'GLOBAL') && metricas.ranking.length > 0 && (
                        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-white/50 dark:border-slate-700/50 shadow-sm overflow-hidden">
                            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
                                <div>
                                    <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
                                        <Trophy className="w-3.5 h-3.5 text-orange-500" /> {professorAtivo.id === 'GLOBAL' ? 'Ranking de Unidades' : 'Ranking de Avaliadores'}
                                    </h3>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setModalRelatorioAberto(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-colors border border-emerald-200 dark:border-emerald-800 shadow-sm">
                                        <Send className="w-3 h-3" /> Relatório WPP
                                    </button>
                                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-white dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700 shadow-sm">{metricas.totalEntidades} Ativos</span>
                                </div>
                            </div>
                            <div className="p-4 flex gap-4 overflow-x-auto custom-scrollbar">
                                {metricas.ranking.map((item, index) => (
                                    <div key={item.nome} onClick={() => { if(professorAtivo.id === 'GLOBAL') { setFiltroUnidadeTabela(item.nome); setPaginaAtual(1); document.getElementById('tabela-historico')?.scrollIntoView({ behavior: 'smooth' }); } }}
                                         className={`min-w-[180px] flex items-center justify-between p-3 rounded-xl border transition-all ${professorAtivo.id === 'GLOBAL' ? 'cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 border-slate-200 dark:border-slate-700' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                                        <div className="flex items-center gap-3">
                                            <span className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-black border ${index === 0 ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-800' : index === 1 ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600' : index === 2 ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-800' : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                                                {index + 1}º
                                            </span>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 tracking-tight line-clamp-1 max-w-[90px]">{item.nome}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col text-right">
                                            <span className="text-lg font-black text-slate-800 dark:text-white leading-none">{item.qtd}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* HISTÓRICO E TABELA */}
                    <div id="tabela-historico" className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-white/50 dark:border-slate-700/50 shadow-sm overflow-hidden flex flex-col relative">
                        <div className="px-5 py-5 border-b border-slate-100 dark:border-slate-800/50 flex flex-col gap-5 shrink-0">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center border border-blue-100 dark:border-blue-800">
                                        <ClipboardSignature className="w-5 h-5"/>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight leading-none">Histórico de Avaliações</h3>
                                        <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">Acompanhe os registros deste avaliador.</p>
                                    </div>
                                </div>
                                <div className="flex items-center bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                                    <button onClick={() => setModoExibicao('resumo')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${modoExibicao === 'resumo' ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}><ListChecks className="w-3.5 h-3.5" /> Resumo</button>
                                    <button onClick={() => setModoExibicao('detalhado')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${modoExibicao === 'detalhado' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 shadow-sm border border-blue-200 dark:border-blue-800' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}><Activity className="w-3.5 h-3.5" /> Avançado</button>
                                </div>
                            </div>
                            <div className="flex flex-col lg:flex-row gap-3 items-center w-full">
                                <div className="relative w-full lg:flex-1">
                                    <Search className="w-4 h-4 text-blue-500 absolute left-4 top-1/2 -translate-y-1/2" />
                                    <input type="text" value={busca} onChange={(e) => {setBusca(e.target.value); setPaginaAtual(1);}} placeholder="Buscar: Nome, CPF..." className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                                </div>
                                <div className="flex gap-2 w-full lg:w-auto">
                                    <button className="flex-1 lg:flex-none px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"><Filter className="w-3.5 h-3.5" /> Filtros</button>
                                    <button className="flex-1 lg:flex-none px-4 py-2.5 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 rounded-xl flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"><Download className="w-3.5 h-3.5" /> Exportar</button>
                                </div>
                            </div>
                        </div>

                        <div ref={tableScrollRef} className="flex-1 overflow-x-auto custom-scrollbar relative min-h-[350px]">
                            {loading ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm z-10">
                                    <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-3" />
                                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Carregando...</p>
                                </div>
                            ) : (
                                <table className={`w-full text-left border-collapse ${modoExibicao === 'detalhado' ? 'min-w-[max-content]' : 'min-w-[900px]'}`}>
                                    <thead className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                                        <tr>
                                            <th onClick={() => handleSort('data')} className="cursor-pointer group px-4 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">Data <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === 'data' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'}`} /></div>
                                            </th>
                                            <th onClick={() => handleSort('aluno')} className="cursor-pointer group px-4 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">Aluno(a) <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === 'aluno' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'}`} /></div>
                                            </th>
                                            <th onClick={() => handleSort('estrutura')} className="cursor-pointer group px-4 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">Física <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === 'estrutura' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'}`} /></div>
                                            </th>
                                            
                                            {modoExibicao === 'detalhado' && (
                                                <>
                                                    <th className="px-4 py-4 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest whitespace-nowrap bg-blue-50/30 dark:bg-blue-900/10">Bioimpedância</th>
                                                    <th className="px-4 py-4 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest whitespace-nowrap bg-blue-50/30 dark:bg-blue-900/10">Gordura</th>
                                                    {perguntasBase.map(p => (
                                                        <th key={p.id} className="px-4 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest min-w-[150px] max-w-[250px]">{p.pergunta}</th>
                                                    ))}
                                                </>
                                            )}

                                            <th onClick={() => handleSort('indices')} className="cursor-pointer group px-4 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">Índices <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === 'indices' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'}`} /></div>
                                            </th>
                                            <th onClick={() => handleSort('avaliador')} className="cursor-pointer group px-4 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">Avaliador <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === 'avaliador' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'}`} /></div>
                                            </th>
                                            <th className="px-4 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap text-center">Exame</th>
                                            {podeEditar && <th className="px-4 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap text-center">Ações</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white dark:bg-slate-900">
                                        {dadosPaginados.length > 0 ? (
                                            dadosPaginados.map((a, idx) => {
                                                const d = new Date(a.created_at || a.criado_em);
                                                const dataStr = d.toLocaleDateString(langAtual);
                                                const horaStr = d.toLocaleTimeString(langAtual, { hour: '2-digit', minute: '2-digit' });
                                                
                                                return (
                                                    <tr key={a.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                                                        <td className="px-4 py-3 whitespace-nowrap align-middle">
                                                            <div className="flex flex-col">
                                                                <span className="text-[13px] font-black text-slate-900 dark:text-slate-100">{dataStr}</span>
                                                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">{horaStr}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap align-middle">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-full flex items-center justify-center font-black text-sm border border-pink-100 dark:border-pink-800 shrink-0">
                                                                    {(a.aluno || 'U').charAt(0)}
                                                                </div>
                                                                <div className="flex flex-col items-start gap-1">
                                                                    <span className="text-[13px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">{a.aluno || 'NÃO INFORMADO'}</span>
                                                                    <button onClick={() => setAlunoEvolucaoModal({ id: a.aluno_id, nome: a.aluno, cpf: a.cpf })} className="flex items-center gap-1 text-[9px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 transition-colors uppercase tracking-widest">
                                                                        <LineChart className="w-3 h-3" /> Evolução
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap align-middle">
                                                            <div className="flex flex-col gap-1.5">
                                                                <div className="flex items-center gap-2">
                                                                    <Scale className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                                                                    <span className="text-[13px] font-black text-slate-900 dark:text-slate-100">{a.peso ? `${a.peso} kg` : '-'}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Ruler className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                                                                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{a.altura ? `${a.altura} m` : '-'}</span>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {modoExibicao === 'detalhado' && (
                                                            <>
                                                                <td className="px-4 py-3 whitespace-nowrap align-middle bg-blue-50/10 dark:bg-blue-900/10 border-l border-r border-slate-50 dark:border-slate-800">
                                                                    <div className="flex flex-col gap-1.5">
                                                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between w-24">MME: <strong className="text-slate-900 dark:text-slate-100 text-xs">{a.mme ? `${a.mme} kg` : '-'}</strong></span>
                                                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between w-24">PGC: <strong className="text-slate-900 dark:text-slate-100 text-xs">{a.pgc ? `${a.pgc}%` : '-'}</strong></span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap align-middle bg-blue-50/10 dark:bg-blue-900/10 border-r border-slate-50 dark:border-slate-800">
                                                                     <div className="flex flex-col gap-1.5">
                                                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between w-16">RCQ: <strong className="text-slate-900 dark:text-slate-100 text-xs">{a.rcq || '-'}</strong></span>
                                                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between w-16">GV: <strong className="text-slate-900 dark:text-slate-100 text-xs">{a.gv || '-'}</strong></span>
                                                                    </div>
                                                                </td>
                                                                {perguntasBase.map(p => {
                                                                    const rawResp = a.respostas_dinamicas?.[p.id];
                                                                    const textoResposta = rawResp ? (Array.isArray(rawResp) ? rawResp.join(', ') : String(rawResp)) : '-';
                                                                    return (
                                                                        <td key={p.id} className="px-4 py-3 align-middle border-r border-slate-50 dark:border-slate-800">
                                                                            <span className={`text-[11px] font-semibold leading-snug ${textoResposta === '-' ? 'text-slate-300 dark:text-slate-600' : 'text-slate-800 dark:text-slate-200'}`}>
                                                                                {textoResposta}
                                                                            </span>
                                                                        </td>
                                                                    );
                                                                })}
                                                            </>
                                                        )}

                                                        <td className="px-4 py-3 whitespace-nowrap align-middle">
                                                            <div className="flex flex-col gap-2">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-2 h-2 rounded-full shrink-0 ${getStatusDot(a.smi_status)}`}></div>
                                                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest w-7">SMI</span>
                                                                    <span className="text-[13px] font-black text-slate-900 dark:text-slate-100">{a.smi_resultado || '-'}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-2 h-2 rounded-full shrink-0 ${getStatusDot(a.hidratacao_status)}`}></div>
                                                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest w-7">HID</span>
                                                                    <span className="text-[13px] font-black text-slate-900 dark:text-slate-100">{a.hidratacao_resultado ? `${a.hidratacao_resultado}%` : '-'}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        
                                                        {/* 🔥 COLUNA DO AVALIADOR COM EDIÇÃO INLINE */}
                                                        <td className="px-4 py-3 whitespace-nowrap align-middle">
                                                            {editingAvaliadorId === a.id ? (
                                                                <div className="flex flex-col animate-[fadeIn_0.2s_ease-out]">
                                                                    <select
                                                                        autoFocus
                                                                        onChange={(e) => handleSalvarNovoAvaliador(a.id, e.target.value)}
                                                                        defaultValue={a.professor}
                                                                        className="w-full min-w-[140px] bg-white dark:bg-slate-800 border border-blue-400 rounded-lg px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/30 shadow-sm cursor-pointer"
                                                                    >
                                                                        <option value="" disabled>Selecione...</option>
                                                                        {colaboradores.map(c => (
                                                                            <option key={c.id} value={c.nome}>{c.nome}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-2 group/edit">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">{a.professor || 'SISTEMA'}</span>
                                                                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5 uppercase">REG: {a.registrado_por_nome || 'SISTEMA'}</span>
                                                                    </div>
                                                                    {podeEditar && (
                                                                        <button 
                                                                            onClick={() => setEditingAvaliadorId(a.id)}
                                                                            className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-all opacity-0 group-hover/edit:opacity-100"
                                                                            title="Alterar Avaliador"
                                                                        >
                                                                            <UserRoundPen className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </td>
                                                        
                                                        <td className="px-4 py-3 text-center whitespace-nowrap align-middle">
                                                            {a.arquivo_inbody_url ? (
                                                                <a href={a.arquivo_inbody_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-600 transition-all shadow-sm border border-emerald-100 dark:border-emerald-800 hover:-translate-y-0.5" title="Visualizar Exame Original">
                                                                    <FileText className="w-4 h-4" />
                                                                </a>
                                                            ) : (
                                                                <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600">-</span>
                                                            )}
                                                        </td>
                                                        
                                                        {podeEditar && (
                                                            <td className="px-4 py-3 text-center whitespace-nowrap align-middle">
                                                                <div className="flex items-center justify-center gap-1.5 opacity-100 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity">
                                                                    <button className="p-2 text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-lg transition-colors border border-transparent hover:border-blue-200 dark:hover:border-blue-700" title="Visualizar Detalhes">
                                                                        <Eye className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button onClick={() => handleEditar(a)} className="p-2 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-lg transition-colors border border-transparent hover:border-indigo-200 dark:hover:border-indigo-700" title="Editar Avaliação">
                                                                        <Edit3 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button onClick={() => removerAvaliacao(a.id)} className="p-2 text-rose-400 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/40 hover:text-rose-600 dark:hover:text-rose-300 rounded-lg transition-colors border border-transparent hover:border-rose-200 dark:hover:border-rose-700" title="Excluir Permanentemente">
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        )}
                                                    </tr>
                                                )
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={modoExibicao === 'detalhado' ? (professorAtivo.id === 'GLOBAL' ? (10 + perguntasBase.length + (podeEditar?1:0)) : (9 + perguntasBase.length + (podeEditar?1:0))) : (professorAtivo.id === 'GLOBAL' ? (podeEditar ? "8" : "7") : (podeEditar ? "7" : "6"))} className="text-center py-16">
                                                    <div className="flex flex-col items-center">
                                                        <Search className="w-8 h-8 text-slate-200 dark:text-slate-600 mb-3" />
                                                        <p className="text-slate-500 dark:text-slate-400 font-bold text-xs">Nenhum registro encontrado neste período.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        
                        {totalPaginas > 0 && (
                            <div className="px-4 py-4 border-t border-slate-100 dark:border-slate-700/50 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Mostrando {(paginaAtual - 1) * ITENS_POR_PAGINA + 1} a {Math.min(paginaAtual * ITENS_POR_PAGINA, dadosOrdenados.length)} de {dadosOrdenados.length} avaliações</span>
                                
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => setPaginaAtual(p => Math.max(1, p - 1))} disabled={paginaAtual === 1} className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                            <ArrowLeft className="w-3.5 h-3.5" />
                                        </button>
                                        <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs shadow-md">
                                            {paginaAtual}
                                        </div>
                                        <button onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))} disabled={paginaAtual === totalPaginas} className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors transform rotate-180">
                                            <ArrowLeft className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PainelAvaliador;