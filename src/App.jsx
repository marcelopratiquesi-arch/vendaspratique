import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient.js';
import { useI18n } from './i18n/I18nContext.jsx'; 
import LanguageSwitcher from './components/LanguageSwitcher.jsx'; 

import { 
    Zap, ChevronDown, Menu, X, LogOut, 
    ShoppingCart, History, PieChart, Wallet, 
    Users, Database, Settings, Dumbbell, Lock,
    PanelLeftClose, PanelLeftOpen, Sun, Moon, Megaphone 
} from 'lucide-react';

// 🔥 MÓDULOS DE LAYOUT (A Arquitetura Limpa)
import { SidebarDesktop, SidebarMobile } from './components/layout/Sidebar.jsx';
import Topbar from './components/layout/Topbar.jsx';
import IdleCurtain from './components/layout/IdleCurtain.jsx';
import BlockingGate from './components/BlockingGate/index.jsx'; // 🛡️ O Bloqueio Obrigatório!

// 🔥 MÓDULOS OPERACIONAIS (Páginas)
import LancamentoVendas from './pages/Lancamentos/index.jsx';
import AssinaturasPratique from './pages/HistoricoVendas/index.jsx'; 
import FechamentoCaixa from './pages/FechamentoCaixa';
import AnaliseDashboard from './pages/AnaliseVendas'; 
import CrmVisitantes from './pages/CrmVisitantes/index.jsx'; 
import CadastroGeral from './pages/CadastroGeral'; 
import Configuracoes from './pages/Configuracoes.jsx';
import Login from './pages/Login.jsx';
import AvaliacaoFisica from './pages/AvaliacaoFisica/index.jsx';
import CentralComunicados from './pages/Comunicados/index.jsx';

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
    const [unreadCount, setUnreadCount] = useState(0); // 🔴 Badge de Notificações
    
    // TEMA E SIDEBAR (Persistência Otimizada)
    const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('pratique_sidebar') === 'true');
    const [theme, setTheme] = useState(() => {
        const salvo = localStorage.getItem('pratique_theme');
        if (salvo) return salvo;
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

    // 🔥 MOTOR DA BADGE DE COMUNICADOS
    useEffect(() => {
        if (!usuarioLogado) return;
        let isMounted = true;

        const fetchBadgeCount = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !isMounted) return;
            
            const { count } = await supabase
                .from('comunicado_inbox')
                .select('id', { count: 'exact', head: true })
                .eq('email_usuario', user.email)
                .in('status_leitura', ['NAO_LIDO', 'PENDENTE']);
                
            if (isMounted) setUnreadCount(count || 0);
        };

        fetchBadgeCount();

        const badgeChannel = supabase.channel('badge-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'comunicado_inbox' }, fetchBadgeCount)
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(badgeChannel);
        };
    }, [usuarioLogado]);

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
    // 4. MAPA DE ROTAS E PERMISSÕES (NAV)
    // ==========================================
    const handleAddLancamentos = (novos) => setDadosAssinaturas([...novos, ...dadosAssinaturas]);
    const handleLogout = () => { setUsuarioLogado(null); setIsMobileMenuOpen(false); };

    if (!usuarioLogado) return <Login onLogin={setUsuarioLogado} />;

    const usuarioVirtual = {
        ...usuarioLogado,
        role: (ehChefe && unidadeGlobal !== 'TODAS') ? 'LIDER' : usuarioLogado.role,
        unidade: (ehChefe && unidadeGlobal !== 'TODAS') ? unidadeGlobal : usuarioLogado.unidade
    };

    // 🔥 O Menu com o Badge dinâmico na aba Comunicados
    const todasAbas = [
        { id: 'lancamento', label: t('navigation.newSale'), icon: ShoppingCart, permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'assinaturas', label: t('navigation.history'), icon: History, permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'analise', label: t('navigation.dashboard'), icon: PieChart, permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'fechamento', label: t('navigation.closing'), icon: Wallet, permissoes: ['ADMIN', 'MENTOR', 'LIDER'] },
        { id: 'crm', label: t('navigation.crm'), icon: Users, permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'avaliacao', label: t('navigation.assessment'), icon: Dumbbell, permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'cadastros', label: t('navigation.management'), icon: Database, permissoes: ['ADMIN', 'MENTOR', 'LIDER'] },
        { 
            id: 'comunicados', 
            label: t('navigation.communications', { defaultValue: 'Comunicados' }), 
            icon: Megaphone, 
            permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'],
            badge: unreadCount > 0 ? unreadCount : null // Adicionamos a propriedade badge
        },
        { id: 'config', label: t('navigation.settings'), icon: Settings, permissoes: ['ADMIN'] }
    ];

    const abasPermitidas = todasAbas.filter(aba => aba.permissoes.includes(usuarioLogado.role));
    const tabAtual = todasAbas.find(t => t.id === activeTab) || todasAbas[0];
    const ActiveIcon = tabAtual.icon;

    return (
        <div className="flex h-dvh w-full bg-slate-50 dark:bg-[#0a0f1c] overflow-hidden font-sans text-slate-800 dark:text-slate-200 transition-colors duration-500">
            
            {/* LUZES AMBIENTAIS */}
            <div className="absolute top-[-25%] left-[-15%] w-[600px] h-[600px] bg-blue-500/5 dark:bg-blue-600/10 rounded-full blur-[140px] pointer-events-none z-0"></div>
            <div className="absolute bottom-[-25%] right-[-15%] w-[600px] h-[600px] bg-emerald-500/5 dark:bg-emerald-600/5 rounded-full blur-[140px] pointer-events-none z-0" style={{ animationDelay: '3s' }}></div>

            <IdleCurtain isIdle={isIdle} />

            {/* Injetamos as abasPermitidas com a nova propriedade badge */}
            <SidebarDesktop 
                isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed}
                theme={theme} toggleTheme={toggleTheme}
                usuarioLogado={usuarioLogado} handleLogout={handleLogout}
                abasPermitidas={abasPermitidas} activeTab={activeTab} setActiveTab={setActiveTab}
            />

            <SidebarMobile 
                isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen}
                theme={theme} toggleTheme={toggleTheme}
                usuarioLogado={usuarioLogado} handleLogout={handleLogout}
                abasPermitidas={abasPermitidas} activeTab={activeTab} setActiveTab={setActiveTab}
            />

            <div className="flex-1 flex flex-col h-full relative z-10 w-full min-w-0 overflow-hidden">
                
                {/* 🛡️ A BARREIRA INESCAPÁVEL (Independente e sem receber props inúteis) */}
                <BlockingGate />

                <Topbar 
                    setIsMobileMenuOpen={setIsMobileMenuOpen} ActiveIcon={ActiveIcon} tabAtual={tabAtual}
                    ehChefe={ehChefe} unidadeGlobal={unidadeGlobal} setUnidadeGlobal={setUnidadeGlobal}
                    unidades={unidades} usuarioLogado={usuarioLogado}
                />

                <main key={unidadeGlobal} className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 lg:p-8 relative z-0">
                    {activeTab === 'lancamento' && <LancamentoVendas usuarioLogado={usuarioVirtual} unidades={unidades} onAddMultiple={handleAddLancamentos} planos={planos} produtos={produtos} servicos={servicos} colaboradores={colaboradores} />}
                    {activeTab === 'assinaturas' && <AssinaturasPratique usuarioLogado={usuarioVirtual} data={dadosAssinaturas} setData={setDadosAssinaturas} colaboradores={colaboradores} />}
                    {activeTab === 'analise' && <AnaliseDashboard usuarioLogado={usuarioVirtual} vendas={dadosAssinaturas} visitantes={dadosVisitantes} avaliacoes={dadosAvaliacoes} planos={planos} produtos={produtos} colaboradores={colaboradores} />}
                    {activeTab === 'fechamento' && <FechamentoCaixa usuarioLogado={usuarioVirtual} vendas={dadosAssinaturas} visitantes={dadosVisitantes} avaliacoes={dadosAvaliacoes} setVendas={setDadosAssinaturas} colaboradores={colaboradores} />}
                    {activeTab === 'crm' && <CrmVisitantes usuarioLogado={usuarioVirtual} visitantes={dadosVisitantes} setVisitantes={setDadosVisitantes} colaboradores={colaboradores} />}
                    {activeTab === 'avaliacao' && <AvaliacaoFisica usuarioLogado={usuarioVirtual} avaliacoes={dadosAvaliacoes} colaboradores={colaboradores} setAvaliacoes={setDadosAvaliacoes} />}
                    {activeTab === 'cadastros' && <CadastroGeral usuarioLogado={usuarioVirtual} planos={planos} setPlanos={setPlanos} produtos={produtos} setProdutos={setProdutos} servicos={servicos} setServicos={setServicos} colaboradores={colaboradores} setColaboradores={setColaboradores} unidades={unidades} />}
                    {activeTab === 'comunicados' && <CentralComunicados usuarioLogado={usuarioVirtual} unidades={unidades} />}
                    {activeTab === 'config' && <Configuracoes unidades={unidades} setUnidades={setUnidades} />}
                </main>
            </div>
        </div>
    );
}