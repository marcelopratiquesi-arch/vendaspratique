import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient.js';
import { useI18n } from './i18n/I18nContext.jsx'; 
import LanguageSwitcher from './components/LanguageSwitcher.jsx'; 

import { 
    Zap, ChevronDown, Menu, X, LogOut, 
    ShoppingCart, History, PieChart, Wallet, 
    Users, Database, Settings, Dumbbell, Lock,
    PanelLeftClose, PanelLeftOpen, Sun, Moon 
} from 'lucide-react';

import LancamentoVendas from './pages/Lancamentos/index.jsx';
import AssinaturasPratique from './pages/HistoricoVendas/index.jsx'; 
import FechamentoCaixa from './pages/FechamentoCaixa';
import AnaliseDashboard from './pages/AnaliseVendas'; 
import CrmVisitantes from './pages/CrmVisitantes/index.jsx'; 
import CadastroGeral from './pages/CadastroGeral'; 
import Configuracoes from './pages/Configuracoes.jsx';
import Login from './pages/Login.jsx';
import AvaliacaoFisica from './pages/AvaliacaoFisica/index.jsx';

export default function App() {
    const { t } = useI18n(); 

    // ==========================================
    // 1. ESTADOS GLOBAIS E CONFIGURAÇÕES DE TEMA
    // ==========================================
    const [usuarioLogado, setUsuarioLogado] = useState(null);
    const [activeTab, setActiveTab] = useState('lancamento');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); 
    const [unidadeGlobal, setUnidadeGlobal] = useState('TODAS');
    const [isIdle, setIsIdle] = useState(false); 
    
    // TEMA E SIDEBAR (Persistência Otimizada)
    const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('pratique_sidebar') === 'true');
    const [theme, setTheme] = useState(() => {
        const salvo = localStorage.getItem('pratique_theme');
        if (salvo) return salvo;
        // Se nunca foi escolhido, detecta o OS do cara.
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
        return 'light';
    });

    const [dadosAssinaturas, setDadosAssinaturas] = useState([]);
    const [dadosVisitantes, setDadosVisitantes] = useState([]);
    const [dadosAvaliacoes, setDadosAvaliacoes] = useState([]); 
    const [planos, setPlanos] = useState([]);
    const [produtos, setProdutos] = useState([]);
    const [servicos, setServicos] = useState([]); 
    const [colaboradores, setColaboradores] = useState([]);
    const [unidades, setUnidades] = useState([]);

    useEffect(() => { if (usuarioLogado) setUnidadeGlobal('TODAS'); }, [usuarioLogado]);

    // 🔥 APLICAÇÃO INSTANTÂNEA DE TEMA
    useEffect(() => {
        localStorage.setItem('pratique_theme', theme);
        if (theme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    }, [theme]);

    useEffect(() => {
        localStorage.setItem('pratique_sidebar', isCollapsed);
    }, [isCollapsed]);

    const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

    // ==========================================
    // 2. SEGURANÇA E INATIVIDADE
    // ==========================================
    useEffect(() => {
        let timeoutId;
        const resetTimer = () => {
            clearTimeout(timeoutId);
            if (!isIdle) timeoutId = setTimeout(() => setIsIdle(true), 15 * 60 * 1000);
        };
        const eventos = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
        eventos.forEach(evento => window.addEventListener(evento, resetTimer));
        resetTimer();
        return () => {
            clearTimeout(timeoutId);
            eventos.forEach(evento => window.removeEventListener(evento, resetTimer));
        };
    }, [isIdle]);

    // ==========================================
    // 3. FETCHING E MOTOR DO BANCO
    // ==========================================
    const ehChefe = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';
    const deveFiltrar = !ehChefe || (ehChefe && unidadeGlobal !== 'TODAS');
    const unidadeFiltro = ehChefe ? unidadeGlobal : usuarioLogado?.unidade;

    const fetchUnidades = useCallback(async (isMounted = true) => {
        const { data, error } = await supabase.from('unidades').select('*').order('nome', { ascending: true });
        if (!error && isMounted && data) setUnidades(data);
    }, []);

    const fetchColaboradores = useCallback(async (isMounted = true) => {
        let query = supabase.from('colaboradores').select('*');
        if (deveFiltrar) query = query.eq('unidade', unidadeFiltro);
        const { data, error } = await query;
        if (!error && isMounted && data) setColaboradores(data);
    }, [deveFiltrar, unidadeFiltro]);

    const fetchCatalogo = useCallback(async (isMounted = true) => {
        const { data, error } = await supabase.from('catalogo').select('*');
        if (!error && isMounted && data) {
            setPlanos(data.filter(item => item.tipo === 'plano'));
            setProdutos(data.filter(item => item.tipo === 'produto'));
            setServicos(data.filter(item => item.tipo === 'servico')); 
        }
    }, []);

    const fetchVendas = useCallback(async (isMounted = true) => {
        let query = supabase.from('vendas').select('*').order('id', { ascending: false }).limit(10000);
        if (deveFiltrar) query = query.eq('unidade', unidadeFiltro);
        const { data, error } = await query;
        if (!error && isMounted && data) setDadosAssinaturas(data);
    }, [deveFiltrar, unidadeFiltro]);

    const fetchLeads = useCallback(async (isMounted = true) => {
        let query = supabase.from('leads').select('*').order('id', { ascending: false }).limit(10000);
        if (deveFiltrar) query = query.eq('unidade', unidadeFiltro);
        const { data, error } = await query;
        if (!error && isMounted && data) setDadosVisitantes(data);
    }, [deveFiltrar, unidadeFiltro]);

    const fetchAvaliacoes = useCallback(async (isMounted = true) => {
        let query = supabase.from('avaliacoes_realizadas').select('*').order('id', { ascending: false }).limit(10000);
        if (deveFiltrar) query = query.eq('unidade', unidadeFiltro);
        const { data, error } = await query;
        if (!error && isMounted && data) setDadosAvaliacoes(data);
    }, [deveFiltrar, unidadeFiltro]);

    useEffect(() => {
        if (!usuarioLogado) return;
        let isMounted = true; 

        fetchUnidades(isMounted); fetchColaboradores(isMounted); fetchCatalogo(isMounted);
        fetchVendas(isMounted); fetchLeads(isMounted); fetchAvaliacoes(isMounted); 

        const realtimeChannel = supabase.channel('sistema-pratique-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vendas' }, (payload) => {
                if (!isMounted) return;
                setDadosAssinaturas(prev => {
                    if (prev.find(v => v.id === payload.new.id)) return prev; 
                    const isAdmin = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';
                    const filtroAtual = isAdmin ? unidadeGlobal : usuarioLogado?.unidade;
                    if (filtroAtual !== 'TODAS' && payload.new.unidade !== filtroAtual) return prev; 
                    return [payload.new, ...prev].sort((a,b) => b.id - a.id);
                });
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'vendas' }, (payload) => {
                if (!isMounted) return; setDadosAssinaturas(prev => prev.map(v => v.id === payload.new.id ? payload.new : v));
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'vendas' }, (payload) => {
                if (!isMounted) return; setDadosAssinaturas(prev => prev.filter(v => v.id !== payload.old.id));
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, (payload) => {
                if (!isMounted) return;
                setDadosVisitantes(prev => {
                    if (prev.find(l => l.id === payload.new.id)) return prev;
                    const isAdmin = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';
                    const filtroAtual = isAdmin ? unidadeGlobal : usuarioLogado?.unidade;
                    if (filtroAtual !== 'TODAS' && payload.new.unidade !== filtroAtual) return prev;
                    return [payload.new, ...prev].sort((a,b) => b.id - a.id);
                });
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, (payload) => {
                if (!isMounted) return; setDadosVisitantes(prev => prev.map(l => l.id === payload.new.id ? payload.new : l));
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'leads' }, (payload) => {
                if (!isMounted) return; setDadosVisitantes(prev => prev.filter(l => l.id !== payload.old.id));
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'avaliacoes_realizadas' }, (payload) => {
                if (!isMounted) return;
                setDadosAvaliacoes(prev => {
                    if (prev.find(a => a.id === payload.new.id)) return prev;
                    const isAdmin = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';
                    const filtroAtual = isAdmin ? unidadeGlobal : usuarioLogado?.unidade;
                    if (filtroAtual !== 'TODAS' && payload.new.unidade !== filtroAtual) return prev;
                    return [payload.new, ...prev].sort((a,b) => b.id - a.id);
                });
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'avaliacoes_realizadas' }, (payload) => {
                if (!isMounted) return; setDadosAvaliacoes(prev => prev.map(a => a.id === payload.new.id ? payload.new : a));
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'avaliacoes_realizadas' }, (payload) => {
                if (!isMounted) return; setDadosAvaliacoes(prev => prev.filter(a => a.id !== payload.old.id));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'colaboradores' }, () => fetchColaboradores(isMounted))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'catalogo' }, () => fetchCatalogo(isMounted))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'unidades' }, () => fetchUnidades(isMounted))
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(realtimeChannel);
        };
    }, [usuarioLogado, unidadeGlobal, fetchUnidades, fetchColaboradores, fetchCatalogo, fetchVendas, fetchLeads, fetchAvaliacoes]); 

    // ==========================================
    // 4. INTERAÇÃO E NAVEGAÇÃO
    // ==========================================
    const handleAddLancamentos = (novos) => setDadosAssinaturas([...novos, ...dadosAssinaturas]);
    const handleLogout = () => {
        setUsuarioLogado(null);
        setIsMobileMenuOpen(false); 
    };

    if (!usuarioLogado) return <Login onLogin={setUsuarioLogado} />;

    const usuarioVirtual = {
        ...usuarioLogado,
        role: (ehChefe && unidadeGlobal !== 'TODAS') ? 'LIDER' : usuarioLogado.role,
        unidade: (ehChefe && unidadeGlobal !== 'TODAS') ? unidadeGlobal : usuarioLogado.unidade
    };

    const todasAbas = [
        { id: 'lancamento', label: t('navigation.newSale'), icon: ShoppingCart, permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'assinaturas', label: t('navigation.history'), icon: History, permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'analise', label: t('navigation.dashboard'), icon: PieChart, permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'fechamento', label: t('navigation.closing'), icon: Wallet, permissoes: ['ADMIN', 'MENTOR', 'LIDER'] },
        { id: 'crm', label: t('navigation.crm'), icon: Users, permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'avaliacao', label: t('navigation.assessment'), icon: Dumbbell, permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'cadastros', label: t('navigation.management'), icon: Database, permissoes: ['ADMIN', 'MENTOR', 'LIDER'] },
        { id: 'config', label: t('navigation.settings'), icon: Settings, permissoes: ['ADMIN'] }
    ];

    const abasPermitidas = todasAbas.filter(aba => aba.permissoes.includes(usuarioLogado.role));
    const tabAtual = todasAbas.find(t => t.id === activeTab) || todasAbas[0];
    const ActiveIcon = tabAtual.icon;

    return (
        // 🔥 AQUI ESTÁ A CORREÇÃO! `dark:bg-[#0a0f1c]` aplicado na raiz do App!
        <div className="flex h-dvh w-full bg-slate-50 dark:bg-[#0a0f1c] overflow-hidden font-sans text-slate-800 dark:text-slate-200 transition-colors duration-500">
            
            {/* LUZES AMBIENTAIS MODERNAS (Premium SaaS) */}
            <div className="absolute top-[-25%] left-[-15%] w-[600px] h-[600px] bg-blue-500/5 dark:bg-blue-600/10 rounded-full blur-[140px] pointer-events-none z-0"></div>
            <div className="absolute bottom-[-25%] right-[-15%] w-[600px] h-[600px] bg-emerald-500/5 dark:bg-emerald-600/5 rounded-full blur-[140px] pointer-events-none z-0" style={{ animationDelay: '3s' }}></div>

            {/* ---------------------------------------------------- */}
            {/* 🖥️ SIDEBAR DESKTOP PREMIUM                           */}
            {/* ---------------------------------------------------- */}
            <aside className={`hidden xl:flex flex-col bg-white/60 dark:bg-[#0c101a]/70 backdrop-blur-3xl border-r border-slate-200/50 dark:border-white/5 h-full relative z-30 shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-2xl shrink-0 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-[80px]' : 'w-[260px]'}`}>
                
                {/* 1. BRANDING & TOGGLE */}
                <div className={`h-[88px] flex items-center ${isCollapsed ? 'justify-center flex-col pt-2 gap-2' : 'justify-between px-5'} shrink-0 transition-all`}>
                    {isCollapsed ? (
                        <>
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0 mt-3 mb-1">
                                <Zap className="w-5 h-5" strokeWidth={2.5} />
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
                                <Zap className="w-5 h-5" strokeWidth={2.5} />
                            </div>
                            <div className="flex flex-col pt-1">
                                <h1 className="text-[17px] font-black text-slate-900 dark:text-white tracking-tight leading-none">PRATIQUE</h1>
                                <h2 className="text-[11px] font-bold text-blue-600 dark:text-blue-500 tracking-[0.2em] mt-1">VENDAS</h2>
                            </div>
                        </div>
                    )}
                    
                    {!isCollapsed && (
                        <button onClick={() => setIsCollapsed(true)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" aria-label="Recolher menu lateral">
                            <PanelLeftClose className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* 2. IDIOMA NA SIDEBAR */}
                <div className={`pt-2 pb-5 border-b border-slate-200/50 dark:border-white/5 flex shrink-0 ${isCollapsed ? 'justify-center px-0' : 'px-5'}`}>
                    <LanguageSwitcher compact={isCollapsed} placement={isCollapsed ? 'right-top' : 'bottom-right'} />
                </div>

                {/* 3. NAVEGAÇÃO VERTICAL */}
                <nav className="flex-1 overflow-y-auto custom-scrollbar py-6 px-3 space-y-1.5">
                    
                    {isCollapsed && (
                         <div className="flex justify-center mb-4">
                            <button onClick={() => setIsCollapsed(false)} className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" aria-label="Expandir menu lateral" title="Expandir">
                                <PanelLeftOpen className="w-5 h-5" />
                            </button>
                         </div>
                    )}

                    {!isCollapsed && <p className="text-[10px] font-bold text-slate-500/80 dark:text-slate-500 uppercase tracking-widest mb-4 ml-3">Módulos</p>}
                    
                    {abasPermitidas.map(tab => {
                        const isActive = activeTab === tab.id;
                        const Icone = tab.icon;
                        const isConfig = tab.id === 'config';

                        return (
                            <React.Fragment key={tab.id}>
                                {isConfig && <div className="h-px bg-slate-200/50 dark:bg-white/5 my-4 mx-3"></div>}
                                <button 
                                    onClick={() => setActiveTab(tab.id)} 
                                    title={isCollapsed ? tab.label : ''}
                                    className={`flex items-center transition-all duration-200 group ${
                                        isCollapsed ? 'justify-center w-12 h-12 mx-auto rounded-xl' : 'gap-3.5 px-4 py-3.5 rounded-xl w-full text-left'
                                    } ${
                                        isActive 
                                        ? 'bg-white dark:bg-blue-600/10 shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:shadow-none border border-slate-200/50 dark:border-white/5 dark:border-l-2 dark:border-l-blue-500' 
                                        : 'hover:bg-slate-200/50 dark:hover:bg-white/[0.03] border border-transparent'
                                    }`}
                                >
                                    <Icone className={`w-[18px] h-[18px] shrink-0 transition-colors ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} strokeWidth={isActive ? 2.5 : 2} />
                                    {!isCollapsed && <span className={`text-[13px] font-bold tracking-wide truncate ${isActive ? 'text-blue-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200'}`}>{tab.label}</span>}
                                </button>
                            </React.Fragment>
                        );
                    })}
                </nav>

                {/* 4. FOOTER DA SIDEBAR (Usuário e Tema) */}
                <div className={`p-4 border-t border-slate-200/50 dark:border-white/5 bg-slate-100/50 dark:bg-black/10 shrink-0 flex flex-col gap-3 transition-all`}>
                    
                    {/* Botão de Tema (Sol/Lua) Liquid Glass */}
                    <div className="flex justify-center w-full">
                         <button 
                            onClick={toggleTheme} 
                            className={`flex items-center transition-all bg-white dark:bg-[#1a1c23] border border-slate-200 dark:border-white/5 shadow-sm rounded-xl overflow-hidden ${isCollapsed ? 'w-10 h-10 p-0 justify-center' : 'w-full p-1'}`}
                            title="Trocar tema"
                        >
                            {!isCollapsed && (
                                <div className="flex w-full relative z-0">
                                    <div className={`w-1/2 flex items-center justify-center py-1.5 rounded-lg z-10 transition-colors ${theme === 'light' ? 'bg-slate-100 text-slate-800 font-bold' : 'text-slate-500 hover:text-white'}`}>
                                        <Sun className="w-4 h-4 mr-1.5" /> <span className="text-[10px] uppercase tracking-wider">Claro</span>
                                    </div>
                                    <div className={`w-1/2 flex items-center justify-center py-1.5 rounded-lg z-10 transition-colors ${theme === 'dark' ? 'bg-slate-800 text-white font-bold' : 'text-slate-500 hover:text-slate-800'}`}>
                                        <Moon className="w-4 h-4 mr-1.5" /> <span className="text-[10px] uppercase tracking-wider">Escuro</span>
                                    </div>
                                </div>
                            )}
                            {isCollapsed && (
                                theme === 'light' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-blue-400" />
                            )}
                        </button>
                    </div>

                    <div className={`flex items-center gap-3 mt-1 ${isCollapsed ? 'justify-center flex-col' : 'justify-between'}`}>
                        <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-white/5 text-slate-600 dark:text-slate-300 flex items-center justify-center font-black text-sm border border-slate-300 dark:border-white/10 shrink-0 shadow-inner" title={isCollapsed ? usuarioLogado.nome : ''}>
                            {usuarioLogado.nome.charAt(0)}
                        </div>
                        
                        {!isCollapsed && (
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-black text-slate-900 dark:text-white truncate" title={usuarioLogado.nome}>{usuarioLogado.nome}</p>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">{usuarioLogado.role}</p>
                            </div>
                        )}
                        
                        <button 
                            onClick={handleLogout} 
                            className={`text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors p-2.5 rounded-xl shrink-0 ${isCollapsed ? 'bg-slate-200/50 dark:bg-white/5' : ''}`} 
                            title={t('header.signOut')}
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* ---------------------------------------------------- */}
            {/* 📱 MOBILE DRAWER (Glass)                             */}
            {/* ---------------------------------------------------- */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-[100] xl:hidden">
                    <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={() => setIsMobileMenuOpen(false)}></div>
                    <aside role="dialog" aria-modal="true" aria-label={t('header.mainMenu')} className="fixed top-0 left-0 w-[280px] h-full bg-white/90 dark:bg-[#111827]/90 backdrop-blur-2xl border-r border-slate-200 dark:border-white/10 shadow-2xl flex flex-col animate-[slideRight_0.3s_ease-out] z-10">
                        
                        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-[#090b11]/50">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-50 dark:bg-white/5 border border-blue-100 dark:border-white/10 rounded-lg flex items-center justify-center">
                                    <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                </div>
                                <h1 className="text-sm font-black text-slate-900 dark:text-white tracking-widest">PRATIQUE</h1>
                            </div>
                            <button onClick={() => setIsMobileMenuOpen(false)} className="w-8 h-8 flex items-center justify-center bg-slate-200 dark:bg-white/5 text-slate-500 dark:text-slate-400 rounded-full hover:bg-rose-100 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="px-4 pt-4 pb-2">
                            <LanguageSwitcher />
                        </div>

                        <nav className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-1.5">
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 ml-2">Menu</p>
                            {abasPermitidas.map(tab => {
                                const isActive = activeTab === tab.id;
                                const Icone = tab.icon;
                                return (
                                    <button 
                                        key={tab.id} 
                                        onClick={() => { setActiveTab(tab.id); setIsMobileMenuOpen(false); }} 
                                        className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                            isActive 
                                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-600/10 dark:text-white border-l-2 border-blue-500' 
                                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 border-l-2 border-transparent'
                                        }`}
                                    >
                                        <Icone className={`w-4 h-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
                                        {tab.label}
                                    </button>
                                )
                            })}
                        </nav>

                        <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-[#090b11]/50 flex items-center gap-3">
                            <button onClick={toggleTheme} className="p-3 bg-white dark:bg-[#1a1c23] border border-slate-200 dark:border-white/5 shadow-sm rounded-xl text-slate-500 hover:text-blue-500 transition-colors">
                                {theme === 'light' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                            </button>
                            <div className="flex-1 min-w-0 ml-2">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{usuarioLogado.nome}</p>
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{usuarioLogado.role}</p>
                            </div>
                            <button onClick={handleLogout} className="p-3 text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 bg-slate-200 dark:bg-white/5 rounded-xl">
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    </aside>
                </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* 🪟 ÁREA PRINCIPAL (TOPBAR E CONTEÚDO)                  */}
            {/* ---------------------------------------------------- */}
            <div className="flex-1 flex flex-col h-full relative z-10 w-full min-w-0 overflow-hidden">
                
                {/* 🔽 TOPBAR ENXUTA PREMIUM */}
                <header className="h-[88px] shrink-0 border-b border-slate-200/50 dark:border-white/5 bg-white/40 dark:bg-[#111827]/40 backdrop-blur-2xl flex items-center justify-between px-4 sm:px-8 z-20 shadow-[0_4px_30px_rgba(0,0,0,0.02)]">
                    
                    <div className="flex items-center gap-5">
                        <button onClick={() => setIsMobileMenuOpen(true)} className="xl:hidden p-2.5 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-300 shadow-sm">
                            <Menu className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-4">
                            <div className="hidden sm:flex w-12 h-12 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl items-center justify-center text-slate-400 dark:text-slate-300 shadow-sm shrink-0">
                                <ActiveIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 drop-shadow-sm" strokeWidth={2.5} />
                            </div>
                            <div className="flex flex-col">
                                <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-widest leading-none drop-shadow-sm">{tabAtual.label}</h2>
                                
                                {ehChefe ? (
                                    <div className="flex items-center gap-2 mt-2 bg-slate-100 dark:bg-[#0c101a] py-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 w-fit">
                                        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${unidadeGlobal === 'TODAS' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'}`}></span>
                                        <select 
                                            value={unidadeGlobal} 
                                            onChange={(e) => setUnidadeGlobal(e.target.value)}
                                            className="bg-transparent text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest outline-none cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                                        >
                                            <option value="TODAS" className="bg-white dark:bg-slate-900 font-bold">{t('header.globalView')}</option>
                                            {unidades.map(u => <option key={u.id} value={u.nome} className="bg-white dark:bg-slate-900">{u.nome}</option>)}
                                        </select>
                                    </div>
                                ) : (
                                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.8)]"></span>
                                        {usuarioLogado.unidade}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                {/* 🔽 CONTEÚDO ROLÁVEL (AS TELAS) */}
                <main key={unidadeGlobal} className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 lg:p-8 relative z-0">
                    {activeTab === 'lancamento' && <LancamentoVendas usuarioLogado={usuarioVirtual} unidades={unidades} onAddMultiple={handleAddLancamentos} planos={planos} produtos={produtos} servicos={servicos} colaboradores={colaboradores} />}
                    {activeTab === 'assinaturas' && <AssinaturasPratique usuarioLogado={usuarioVirtual} data={dadosAssinaturas} setData={setDadosAssinaturas} colaboradores={colaboradores} />}
                    {activeTab === 'analise' && <AnaliseDashboard usuarioLogado={usuarioVirtual} vendas={dadosAssinaturas} visitantes={dadosVisitantes} avaliacoes={dadosAvaliacoes} planos={planos} produtos={produtos} colaboradores={colaboradores} />}
                    {activeTab === 'fechamento' && <FechamentoCaixa usuarioLogado={usuarioVirtual} vendas={dadosAssinaturas} visitantes={dadosVisitantes} avaliacoes={dadosAvaliacoes} setVendas={setDadosAssinaturas} colaboradores={colaboradores} />}
                    {activeTab === 'crm' && <CrmVisitantes usuarioLogado={usuarioVirtual} visitantes={dadosVisitantes} setVisitantes={setDadosVisitantes} colaboradores={colaboradores} />}
                    {activeTab === 'avaliacao' && <AvaliacaoFisica usuarioLogado={usuarioVirtual} avaliacoes={dadosAvaliacoes} colaboradores={colaboradores} setAvaliacoes={setDadosAvaliacoes} />}
                    {activeTab === 'cadastros' && <CadastroGeral usuarioLogado={usuarioVirtual} planos={planos} setPlanos={setPlanos} produtos={produtos} setProdutos={setProdutos} servicos={servicos} setServicos={setServicos} colaboradores={colaboradores} setColaboradores={setColaboradores} unidades={unidades} />}
                    {activeTab === 'config' && <Configuracoes unidades={unidades} setUnidades={setUnidades} />}
                </main>

            </div>
        </div>
    );
}