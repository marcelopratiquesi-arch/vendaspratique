import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import { Dumbbell, Building2, ChevronRight, BarChart3, ListChecks, Users, BarChart2, CalendarDays } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext.jsx'; 

const colorThemes = [
    { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-50/70 dark:bg-blue-900/50', border: 'hover:border-blue-400 dark:hover:border-blue-600', shadow: 'hover:shadow-[0_8px_25px_rgba(59,130,246,0.12)]' },
    { bg: 'bg-indigo-50 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-400', iconBg: 'bg-indigo-50/70 dark:bg-indigo-900/50', border: 'hover:border-indigo-400 dark:hover:border-indigo-600', shadow: 'hover:shadow-[0_8px_25px_rgba(99,102,241,0.12)]' },
    { bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', iconBg: 'bg-orange-50/70 dark:bg-orange-900/50', border: 'hover:border-orange-400 dark:hover:border-orange-600', shadow: 'hover:shadow-[0_8px_25px_rgba(249,115,22,0.12)]' },
    { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-50/70 dark:bg-emerald-900/50', border: 'hover:border-emerald-400 dark:hover:border-emerald-600', shadow: 'hover:shadow-[0_8px_25px_rgba(16,185,129,0.12)]' },
    { bg: 'bg-rose-50 dark:bg-rose-900/30', text: 'text-rose-600 dark:text-rose-400', iconBg: 'bg-rose-50/70 dark:bg-rose-900/50', border: 'hover:border-rose-400 dark:hover:border-rose-600', shadow: 'hover:shadow-[0_8px_25px_rgba(244,63,94,0.12)]' }
];

const PainelInicial = ({ usuarioLogado, colaboradores, setProfessorAtivo, setAbaAtiva }) => {
    const { locale, language } = useI18n(); 
    const langAtual = locale || language || 'pt-BR';
    const [metricasCards, setMetricasCards] = useState({});

    const isAdmin = usuarioLogado?.role === 'ADMIN';
    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';
    const podeEditar = ['ADMIN', 'MENTOR', 'LIDER'].includes(usuarioLogado?.role);

    // 🔥 CORREÇÃO CIRÚRGICA AQUI:
    // Removemos o "filtro fantasma" que procurava a palavra na coluna errada.
    // O arquivo 'index.jsx' pai já envia a propriedade 'colaboradores' apenas com os ativos e savers/líderes.
    // Aqui só precisamos filtrar para exibir apenas os profissionais da unidade selecionada.
    const profsDaUnidade = colaboradores.filter(c => c.unidade === usuarioLogado?.unidade);

    useEffect(() => {
        const fetchMetricasCards = async () => {
            try {
                const { data, error } = await supabase.from('avaliacoes_realizadas').select('professor, created_at, data').eq('unidade', usuarioLogado?.unidade);
                if (error) throw error;
                const now = new Date();
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();
                const agroupado = {};
                (data || []).forEach(aval => {
                    const prof = aval.professor;
                    if (!prof) return;
                    if (!agroupado[prof]) agroupado[prof] = { mes: 0, ultima: null };
                    const dateObj = new Date(aval.created_at || aval.data);
                    if (!agroupado[prof].ultima || dateObj > agroupado[prof].ultima) agroupado[prof].ultima = dateObj;
                    if (dateObj.getMonth() === currentMonth && dateObj.getFullYear() === currentYear) agroupado[prof].mes += 1;
                });
                setMetricasCards(agroupado);
            } catch (err) { console.error("Erro ao buscar métricas dos cartões:", err); }
        };
        fetchMetricasCards();
    }, [usuarioLogado?.unidade]);

    return (
        <div className="w-full relative pb-20 animate-[fadeIn_0.5s_ease-out]">
            <div className="relative w-full max-w-[1440px] mx-auto pt-10 md:pt-16 pb-10 px-4 flex flex-col items-center z-10">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-[20px] flex items-center justify-center mb-5 shadow-[0_8px_25px_rgba(37,99,235,0.4)] border border-blue-400/50 dark:border-blue-500/20">
                    <Dumbbell className="w-10 h-10" />
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white tracking-tight text-center max-w-2xl leading-tight">
                    Painel de <span className="text-blue-600 dark:text-blue-400 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">Avaliação Física</span>
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-3 font-medium text-center text-sm max-w-lg mb-8">
                    Acesse a gestão estratégica ou selecione o perfil de um avaliador.
                </p>
                
                <div className="w-full flex flex-col md:flex-row justify-center gap-4 max-w-3xl mx-auto">
                    {temVisaoGlobal && (
                        <button onClick={() => setProfessorAtivo({ id: 'GLOBAL', nome: 'VISÃO GLOBAL DA REDE' })} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 p-5 rounded-[20px] shadow-[0_8px_30px_rgba(59,130,246,0.25)] flex items-center justify-between transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(59,130,246,0.35)] border border-blue-400 dark:border-blue-500/30 group">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/20">
                                    <Building2 className="w-6 h-6 text-white" />
                                </div>
                                <div className="text-left">
                                    <span className="font-black uppercase tracking-widest text-xs text-white block mb-0.5">Dashboard Global</span>
                                    <span className="text-[9px] text-blue-100 font-bold uppercase tracking-widest block">Desempenho de todas as unidades</span>
                                </div>
                            </div>
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                                <ChevronRight className="w-5 h-5 text-white" />
                            </div>
                        </button>
                    )}

                    {podeEditar && (
                        <button onClick={() => setProfessorAtivo({ id: 'GERAL', nome: `DASHBOARD - ${usuarioLogado?.unidade}`, unidade: usuarioLogado?.unidade })} className="flex-1 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 p-5 rounded-[20px] shadow-[0_8px_30px_rgba(15,23,42,0.25)] flex items-center justify-between transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(15,23,42,0.35)] border border-slate-700 dark:border-slate-700/50 group relative overflow-hidden">
                            <div className="absolute right-0 top-0 w-32 h-full bg-gradient-to-l from-orange-500/20 to-transparent pointer-events-none"></div>
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-orange-500/30">
                                    <BarChart3 className="w-6 h-6 text-orange-400" />
                                </div>
                                <div className="text-left">
                                    <span className="font-black uppercase tracking-widest text-xs text-white block mb-0.5">Dashboard da Unidade</span>
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block">Métricas da Unidade {usuarioLogado?.unidade}</span>
                                </div>
                            </div>
                            <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30 group-hover:bg-orange-400 transition-colors relative z-10">
                                <ChevronRight className="w-5 h-5 text-white" />
                            </div>
                        </button>
                    )}
                </div>

                {isAdmin && (
                    <button onClick={() => setAbaAtiva('construtor')} className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md px-5 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:bg-white dark:hover:bg-slate-800 hover:border-blue-200 dark:hover:border-blue-800">
                        <ListChecks className="w-3.5 h-3.5" /> Configurar Formulário
                    </button>
                )}
            </div>

            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 relative z-20">
                <div className="w-full flex items-center gap-4 mb-8">
                    <div className="h-px bg-slate-300/40 dark:bg-slate-700/50 flex-1"></div>
                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm px-4 py-1.5 rounded-full border border-slate-200/50 dark:border-slate-700/50">
                        <Users className="w-4 h-4 text-blue-500 dark:text-blue-400"/> Avaliadores - Unidade {usuarioLogado?.unidade}
                    </span>
                    <div className="h-px bg-slate-300/40 dark:bg-slate-700/50 flex-1"></div>
                </div>

                {profsDaUnidade.length === 0 ? (
                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/50 dark:border-slate-800 p-6 rounded-[24px] text-center w-full max-w-sm mx-auto shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
                        <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">Nenhum avaliador cadastrado nesta unidade.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-5 w-full">
                        {profsDaUnidade.map((c, index) => {
                            const theme = colorThemes[index % colorThemes.length];
                            const metrica = metricasCards[c.nome] || { mes: 0, ultima: null };
                            
                            return (
                                <button 
                                    key={c.id} 
                                    onClick={() => setProfessorAtivo({ ...c, unidade: usuarioLogado?.unidade })} 
                                    className={`bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-white/60 dark:border-slate-800 p-5 rounded-[24px] shadow-[0_4px_15px_rgba(0,0,0,0.03)] transition-all group flex flex-col justify-between min-h-[150px] relative overflow-hidden ${theme.border} ${theme.shadow} hover:-translate-y-1 outline-none text-left`}
                                >
                                    <div className="flex items-center gap-3 w-full pr-6">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl transition-colors shadow-inner shrink-0 border border-white/50 dark:border-white/10 ${theme.bg} ${theme.text}`}>
                                            {c.nome.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="font-extrabold text-slate-800 dark:text-white block leading-tight text-sm truncate" title={c.nome}>
                                                {c.nome.split(' ')[0]}
                                            </span>
                                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5 block truncate" title={c.nome.split(' ').slice(1).join(' ')}>
                                                {c.nome.split(' ').slice(1).join(' ') || 'Avaliador'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="absolute top-5 right-4 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/40 group-hover:text-blue-500 dark:group-hover:text-blue-400">
                                        <ChevronRight className="w-4 h-4" />
                                    </div>
                                    
                                    <div className="mt-4 pt-3 border-t border-slate-100/60 dark:border-slate-800 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${theme.iconBg} ${theme.text}`}>
                                                <BarChart2 className="w-4 h-4" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-slate-800 dark:text-white leading-none">{metrica.mes}</span>
                                                <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Avaliações</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 text-right">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-black text-slate-800 dark:text-white leading-none">
                                                    {metrica.ultima ? new Date(metrica.ultima).toLocaleDateString(langAtual, {day:'2-digit', month:'2-digit', year:'2-digit'}) : '-'}
                                                </span>
                                                <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Última</span>
                                            </div>
                                            <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-400 dark:text-slate-500 group-hover:bg-slate-100 dark:group-hover:bg-slate-700 transition-colors">
                                                <CalendarDays className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PainelInicial;