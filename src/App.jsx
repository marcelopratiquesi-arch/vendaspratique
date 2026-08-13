import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient.js';

// Ícones via Lucide-React 
import { 
    Zap, ChevronDown, Menu, X, LogOut, 
    ShoppingCart, History, PieChart, Wallet, 
    Users, Database, Settings, Dumbbell, Lock 
} from 'lucide-react';

// Importação Segura das Páginas (Padrão Modular)
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
    // ==========================================
    // 1. TODOS OS ESTADOS GLOBAIS E SEGURANÇA
    // ==========================================
    const [usuarioLogado, setUsuarioLogado] = useState(null);
    const [activeTab, setActiveTab] = useState('lancamento');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); 
    const [unidadeGlobal, setUnidadeGlobal] = useState('TODAS');
    const [isIdle, setIsIdle] = useState(false); // 🔥 Estado da Cortina de Inatividade

    // Estados aguardando a nuvem
    const [dadosAssinaturas, setDadosAssinaturas] = useState([]);
    const [dadosVisitantes, setDadosVisitantes] = useState([]);
    const [dadosAvaliacoes, setDadosAvaliacoes] = useState([]); 
    
    const [planos, setPlanos] = useState([]);
    const [produtos, setProdutos] = useState([]);
    const [servicos, setServicos] = useState([]); 
    const [colaboradores, setColaboradores] = useState([]);
    const [unidades, setUnidades] = useState([]);

    useEffect(() => {
        if (usuarioLogado) setUnidadeGlobal('TODAS');
    }, [usuarioLogado]);

    // ==========================================
    // 2. SISTEMA DE SEGURANÇA CONTRA INATIVIDADE (15 MINUTOS)
    // ==========================================
    useEffect(() => {
        let timeoutId;
        const TEMPO_LIMITE = 15 * 60 * 1000; // 15 minutos em milissegundos

        const resetTimer = () => {
            clearTimeout(timeoutId);
            // Se a tela já bloqueou, não adianta só mexer o mouse, tem que clicar em Atualizar
            if (!isIdle) {
                timeoutId = setTimeout(() => setIsIdle(true), TEMPO_LIMITE);
            }
        };

        // Escuta qualquer sinal de vida do usuário na máquina
        const eventos = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
        eventos.forEach(evento => window.addEventListener(evento, resetTimer));

        // Inicia o cronômetro assim que o sistema abre
        resetTimer();

        return () => {
            clearTimeout(timeoutId);
            eventos.forEach(evento => window.removeEventListener(evento, resetTimer));
        };
    }, [isIdle]);

    // ==========================================
    // 3. ACESSIBILIDADE E UX (MOBILE MENU)
    // ==========================================
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isMobileMenuOpen) {
                setIsMobileMenuOpen(false);
            }
        };

        if (isMobileMenuOpen || isIdle) {
            document.body.style.overflow = 'hidden'; 
            window.addEventListener('keydown', handleKeyDown);
        } else {
            document.body.style.overflow = 'auto'; 
        }

        return () => {
            document.body.style.overflow = 'auto';
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isMobileMenuOpen, isIdle]);

    // ==========================================
    // 4. SINCRONIZAÇÃO OTIMIZADA COM SUPABASE
    // ==========================================
    const ehChefe = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';
    const deveFiltrar = !ehChefe || (ehChefe && unidadeGlobal !== 'TODAS');
    const unidadeFiltro = ehChefe ? unidadeGlobal : usuarioLogado?.unidade;

    const fetchUnidades = useCallback(async (isMounted = true) => {
        const { data, error } = await supabase.from('unidades').select('*').order('nome', { ascending: true });
        if (error) console.error("Erro ao buscar unidades:", error);
        else if (isMounted && data) setUnidades(data);
    }, []);

    const fetchColaboradores = useCallback(async (isMounted = true) => {
        let query = supabase.from('colaboradores').select('*');
        if (deveFiltrar) query = query.eq('unidade', unidadeFiltro);
        const { data, error } = await query;
        if (error) console.error("Erro ao buscar colaboradores:", error);
        else if (isMounted && data) setColaboradores(data);
    }, [deveFiltrar, unidadeFiltro]);

    const fetchCatalogo = useCallback(async (isMounted = true) => {
        const { data, error } = await supabase.from('catalogo').select('*');
        if (error) console.error("Erro ao buscar catálogo:", error);
        else if (isMounted && data) {
            setPlanos(data.filter(item => item.tipo === 'plano'));
            setProdutos(data.filter(item => item.tipo === 'produto'));
            setServicos(data.filter(item => item.tipo === 'servico')); 
        }
    }, []);

    const fetchVendas = useCallback(async (isMounted = true) => {
        let query = supabase.from('vendas').select('*').order('id', { ascending: false }).limit(10000);
        if (deveFiltrar) query = query.eq('unidade', unidadeFiltro);
        const { data, error } = await query;
        if (error) console.error("Erro ao buscar vendas:", error);
        else if (isMounted && data) setDadosAssinaturas(data);
    }, [deveFiltrar, unidadeFiltro]);

    const fetchLeads = useCallback(async (isMounted = true) => {
        let query = supabase.from('leads').select('*').order('id', { ascending: false }).limit(10000);
        if (deveFiltrar) query = query.eq('unidade', unidadeFiltro);
        const { data, error } = await query;
        if (error) console.error("Erro ao buscar leads:", error);
        else if (isMounted && data) setDadosVisitantes(data);
    }, [deveFiltrar, unidadeFiltro]);

    const fetchAvaliacoes = useCallback(async (isMounted = true) => {
        let query = supabase.from('avaliacoes_realizadas').select('*').order('id', { ascending: false }).limit(10000);
        if (deveFiltrar) query = query.eq('unidade', unidadeFiltro);
        const { data, error } = await query;
        if (error) console.error("Erro ao buscar avaliações:", error);
        else if (isMounted && data) setDadosAvaliacoes(data);
    }, [deveFiltrar, unidadeFiltro]);

    // Disparo Inicial Múltiplo e Realtime Turbo
    useEffect(() => {
        if (!usuarioLogado) return;
        let isMounted = true; 

        fetchUnidades(isMounted);
        fetchColaboradores(isMounted);
        fetchCatalogo(isMounted);
        fetchVendas(isMounted);
        fetchLeads(isMounted);
        fetchAvaliacoes(isMounted); 

        const realtimeChannel = supabase.channel('sistema-pratique-realtime')
            
            // --- EVENTOS DE VENDAS ---
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
                if (!isMounted) return;
                setDadosAssinaturas(prev => prev.map(v => v.id === payload.new.id ? payload.new : v));
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'vendas' }, (payload) => {
                if (!isMounted) return;
                setDadosAssinaturas(prev => prev.filter(v => v.id !== payload.old.id));
            })

            // --- EVENTOS DE LEADS (CRM) ---
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
                if (!isMounted) return;
                setDadosVisitantes(prev => prev.map(l => l.id === payload.new.id ? payload.new : l));
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'leads' }, (payload) => {
                if (!isMounted) return;
                setDadosVisitantes(prev => prev.filter(l => l.id !== payload.old.id));
            })

            // --- EVENTOS DE AVALIAÇÕES FÍSICAS ---
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
                if (!isMounted) return;
                setDadosAvaliacoes(prev => prev.map(a => a.id === payload.new.id ? payload.new : a));
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'avaliacoes_realizadas' }, (payload) => {
                if (!isMounted) return;
                setDadosAvaliacoes(prev => prev.filter(a => a.id !== payload.old.id));
            })

            // Tabelas menores
            .on('postgres_changes', { event: '*', schema: 'public', table: 'colaboradores' }, () => fetchColaboradores(isMounted))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'catalogo' }, () => fetchCatalogo(isMounted))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'unidades' }, () => fetchUnidades(isMounted))
            
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Motor Realtime Turbo Conectado na Pratique!');
                }
            });

        return () => {
            isMounted = false;
            supabase.removeChannel(realtimeChannel);
        };
        
    }, [usuarioLogado, unidadeGlobal, fetchUnidades, fetchColaboradores, fetchCatalogo, fetchVendas, fetchLeads, fetchAvaliacoes]); 

    // ==========================================
    // 5. FUNÇÕES DE INTERFACE
    // ==========================================
    const handleAddLancamentos = (novos) => setDadosAssinaturas([...novos, ...dadosAssinaturas]);
    const handleLogout = () => {
        setUsuarioLogado(null);
        setIsMobileMenuOpen(false); 
    };

    if (!usuarioLogado) {
        return <Login onLogin={setUsuarioLogado} />;
    }

    const usuarioVirtual = {
        ...usuarioLogado,
        role: (ehChefe && unidadeGlobal !== 'TODAS') ? 'LIDER' : usuarioLogado.role,
        unidade: (ehChefe && unidadeGlobal !== 'TODAS') ? unidadeGlobal : usuarioLogado.unidade
    };

    const todasAbas = [
        { id: 'lancamento', label: 'Nova Venda', icon: ShoppingCart, permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'assinaturas', label: 'Histórico', icon: History, permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'analise', label: 'Dashboard', icon: PieChart, permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'fechamento', label: 'Fechamento', icon: Wallet, permissoes: ['ADMIN', 'MENTOR', 'LIDER'] },
        { id: 'crm', label: 'CRM', icon: Users, permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'avaliacao', label: 'Avaliação', icon: Dumbbell, permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'cadastros', label: 'Cadastros', icon: Database, permissoes: ['ADMIN', 'MENTOR', 'LIDER'] },
        { id: 'config', label: 'Configurações', icon: Settings, permissoes: ['ADMIN'] }
    ];

    const abasPermitidas = todasAbas.filter(aba => aba.permissoes.includes(usuarioLogado.role));

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans antialiased text-slate-600">
            
            {/* 🛡️ TELA DE BLOQUEIO POR INATIVIDADE (CORTINA) */}
            {isIdle && (
                <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-md flex items-center justify-center animate-[fadeIn_0.3s_ease-out]">
                    <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-2xl flex flex-col items-center max-w-md w-[90%] text-center border border-slate-200 animate-[slideDown_0.4s_ease-out]">
                        
                        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6 border border-rose-100 shadow-inner">
                            <Lock className="w-10 h-10 text-rose-600" />
                        </div>
                        
                        <h2 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">
                            Sessão Inativa
                        </h2>
                        
                        <p className="text-sm font-semibold text-slate-500 mb-8 leading-relaxed px-4">
                            Por motivos de segurança e para garantir a sincronização em tempo real do banco de dados, o sistema foi pausado após 15 minutos sem uso.
                        </p>
                        
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase tracking-widest text-sm transition-all shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.23)] hover:-translate-y-0.5 flex items-center justify-center gap-2"
                        >
                            <Zap className="w-5 h-5 fill-current text-amber-300" /> Atualizar Sistema Agora
                        </button>

                    </div>
                </div>
            )}

            <header className="bg-slate-900 shadow-lg border-b border-slate-800 sticky top-0 z-40 transition-all">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
                    
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 bg-emerald-500 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)] border border-emerald-400 shrink-0">
                            <Zap className="text-slate-900 w-6 h-6 fill-current" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-white tracking-wider leading-none">PRATIQUE VENDAS</h1>
                            
                            {ehChefe ? (
                                <div className="mt-1.5 relative flex items-center bg-slate-800 rounded-lg border border-slate-700 px-2 py-0.5 w-fit hover:bg-slate-700 transition-colors">
                                    <span className={`w-1.5 h-1.5 rounded-full mr-2 shadow-sm animate-pulse ${unidadeGlobal === 'TODAS' ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                                    <select 
                                        value={unidadeGlobal} 
                                        onChange={(e) => setUnidadeGlobal(e.target.value)}
                                        className="bg-transparent text-[10px] font-bold text-slate-300 uppercase tracking-widest outline-none cursor-pointer appearance-none pr-5 z-10"
                                    >
                                        <option value="TODAS" className="bg-slate-800 text-white">VISÃO GLOBAL (TODAS)</option>
                                        {unidades.map(u => (
                                            <option key={u.id} value={u.nome} className="bg-slate-800 text-white">{u.nome}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2 pointer-events-none" />
                                </div>
                            ) : (
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> 
                                    {usuarioLogado.unidade}
                                </p>
                            )}
                        </div>
                    </div>
                    
                    <button onClick={() => setIsMobileMenuOpen(true)} className="xl:hidden p-2.5 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded-xl transition-all border border-slate-700">
                        <Menu className="w-6 h-6" />
                    </button>
                    
                    <div className="hidden xl:flex items-center gap-6">
                        <nav className="flex items-center gap-1.5 bg-slate-800/50 p-1.5 rounded-2xl border border-slate-700/50">
                            {abasPermitidas.map(tab => {
                                const isActive = activeTab === tab.id;
                                const Icone = tab.icon;
                                return (
                                    <button 
                                        key={tab.id} 
                                        onClick={() => setActiveTab(tab.id)} 
                                        className={`px-4 py-2.5 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-wider transition-all duration-200 whitespace-nowrap ${
                                            isActive 
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                        }`}
                                    >
                                        <Icone className="w-3.5 h-3.5" /> {tab.label}
                                    </button>
                                )
                            })}
                        </nav>

                        <div className="flex items-center gap-4 pl-5 border-l border-slate-800">
                            <div className="text-right">
                                <p className="text-xs font-black text-white tracking-tight">{usuarioLogado.nome}</p>
                                <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mt-0.5">{usuarioLogado.role}</p>
                            </div>
                            <button 
                                onClick={handleLogout} 
                                className="w-10 h-10 bg-rose-500/10 hover:bg-rose-600 text-rose-500 hover:text-white rounded-xl flex items-center justify-center transition-all border border-rose-500/20 hover:border-transparent shadow-sm" 
                                title="Sair do Sistema"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-[100] xl:hidden">
                    <div 
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" 
                        onClick={() => setIsMobileMenuOpen(false)}
                    ></div>

                    <div 
                        role="dialog"
                        aria-modal="true"
                        aria-label="Menu Principal"
                        className="fixed top-0 right-0 w-[280px] sm:w-[320px] h-full bg-white shadow-2xl flex flex-col animate-[slideLeft_0.3s_ease-out] z-10"
                    >
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-sm">
                                    {usuarioLogado.nome.charAt(0)}
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-800 truncate max-w-[140px] uppercase">{usuarioLogado.nome}</p>
                                    <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{usuarioLogado.role}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsMobileMenuOpen(false)} 
                                aria-label="Fechar Menu"
                                className="w-8 h-8 flex items-center justify-center bg-slate-200 text-slate-500 rounded-full hover:bg-rose-100 hover:text-rose-600 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 ml-2">Menu Principal</p>
                            {abasPermitidas.map(tab => {
                                const isActive = activeTab === tab.id;
                                const Icone = tab.icon;
                                return (
                                    <button 
                                        key={tab.id} 
                                        onClick={() => {
                                            setActiveTab(tab.id);
                                            setIsMobileMenuOpen(false); 
                                        }} 
                                        className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                            isActive 
                                            ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100' 
                                            : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                                        }`}
                                    >
                                        <Icone className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                                        {tab.label}
                                    </button>
                                )
                            })}
                        </div>

                        <div className="p-5 border-t border-slate-100 bg-slate-50">
                            <button 
                                onClick={handleLogout} 
                                className="w-full flex items-center justify-center gap-2 bg-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm"
                            >
                                <LogOut className="w-4 h-4" /> Sair do Sistema
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <main key={unidadeGlobal} className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-8">
                {activeTab === 'lancamento' && <LancamentoVendas usuarioLogado={usuarioVirtual} unidades={unidades} onAddMultiple={handleAddLancamentos} planos={planos} produtos={produtos} servicos={servicos} colaboradores={colaboradores} />}
                
                {activeTab === 'assinaturas' && <AssinaturasPratique usuarioLogado={usuarioVirtual} data={dadosAssinaturas} setData={setDadosAssinaturas} colaboradores={colaboradores} />}
                
                {activeTab === 'analise' && <AnaliseDashboard usuarioLogado={usuarioVirtual} vendas={dadosAssinaturas} visitantes={dadosVisitantes} avaliacoes={dadosAvaliacoes} planos={planos} produtos={produtos} colaboradores={colaboradores} />}
                
                {activeTab === 'fechamento' && <FechamentoCaixa usuarioLogado={usuarioVirtual} vendas={dadosAssinaturas} visitantes={dadosVisitantes} avaliacoes={dadosAvaliacoes} setVendas={setDadosAssinaturas} colaboradores={colaboradores} />}
                
                {activeTab === 'crm' && <CrmVisitantes usuarioLogado={usuarioVirtual} visitantes={dadosVisitantes} setVisitantes={setDadosVisitantes} colaboradores={colaboradores} />}
                
                {activeTab === 'avaliacao' && (
                    <AvaliacaoFisica 
                        usuarioLogado={usuarioVirtual} 
                        avaliacoes={dadosAvaliacoes} 
                        colaboradores={colaboradores}
                        setAvaliacoes={setDadosAvaliacoes}
                    />
                )}
                
                {activeTab === 'cadastros' && <CadastroGeral usuarioLogado={usuarioVirtual} planos={planos} setPlanos={setPlanos} produtos={produtos} setProdutos={setProdutos} servicos={servicos} setServicos={setServicos} colaboradores={colaboradores} setColaboradores={setColaboradores} unidades={unidades} />}
                
                {activeTab === 'config' && <Configuracoes unidades={unidades} setUnidades={setUnidades} />}
            </main>
        </div>
    );
}