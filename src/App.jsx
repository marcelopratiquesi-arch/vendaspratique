import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient.js'; // 🔥 O CORAÇÃO DA NUVEM AQUI

// Importação Segura das Páginas
import LancamentoVendas from './pages/Lancamento.jsx';
import AssinaturasPratique from './pages/RegistroVendas.jsx';
import FechamentoCaixa from './pages/FechamentoCaixa.jsx';
import AnaliseDashboard from './pages/Analise.jsx';
import CrmVisitantes from './pages/CrmVisitantes.jsx'; 
import CadastroGeral from './pages/CadastroGeral.jsx';
import Login from './pages/Login.jsx';

export default function App() {
    // ==========================================
    // 1. TODOS OS ESTADOS GLOBAIS
    // ==========================================
    const [usuarioLogado, setUsuarioLogado] = useState(null);
    const [activeTab, setActiveTab] = useState('lancamento');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); 
    
    // ATENÇÃO: Os estados agora começam 100% VAZIOS, aguardando a nuvem!
    const [dadosAssinaturas, setDadosAssinaturas] = useState([]);
    const [dadosVisitantes, setDadosVisitantes] = useState([]);
    const [planos, setPlanos] = useState([]);
    const [produtos, setProdutos] = useState([]);
    const [colaboradores, setColaboradores] = useState([]);

    // ==========================================
    // 2. SINCRONIZAÇÃO COM SUPABASE (Magia acontece aqui)
    // ==========================================
    useEffect(() => {
        // Só busca os dados SE tiver alguém logado
        if (!usuarioLogado) return;

        const carregarBancoDeDados = async () => {
            try {
                // 1. Puxar Equipe (Colaboradores)
                const { data: colabs } = await supabase.from('colaboradores').select('*');
                if (colabs) setColaboradores(colabs);

                // 2. Puxar Catálogo (Planos e Produtos)
                const { data: cat } = await supabase.from('catalogo').select('*');
                if (cat) {
                    setPlanos(cat.filter(item => item.tipo === 'plano'));
                    setProdutos(cat.filter(item => item.tipo === 'produto'));
                }

                // 3. Puxar Histórico de Vendas (Do mais recente pro mais antigo)
                const { data: vends } = await supabase.from('vendas').select('*').order('id', { ascending: false });
                if (vends) setDadosAssinaturas(vends);

                // 4. Puxar CRM de Leads
                const { data: leds } = await supabase.from('leads').select('*').order('id', { ascending: false });
                if (leds) setDadosVisitantes(leds);
                
            } catch (error) {
                console.error("Erro ao puxar dados da nuvem:", error);
            }
        };

        carregarBancoDeDados();
    }, [usuarioLogado]); // Esse gatilho roda toda vez que alguém faz login

    // ==========================================
    // 3. FUNÇÕES E EFEITOS DE INTERFACE
    // ==========================================
    const handleAddLancamentos = (novos) => setDadosAssinaturas([...novos, ...dadosAssinaturas]);
    const handleLogout = () => setUsuarioLogado(null);

    useEffect(() => { 
        if (window.lucide) window.lucide.createIcons(); 
    }, [activeTab, usuarioLogado, isMobileMenuOpen, dadosAssinaturas, dadosVisitantes]);

    // ==========================================
    // 4. TRAVA DE AUTENTICAÇÃO (Login)
    // ==========================================
    if (!usuarioLogado) {
        return <Login onLogin={setUsuarioLogado} />;
    }

    // ==========================================
    // 5. CONTROLE DE ACESSO (RBAC)
    // ==========================================
    const todasAbas = [
        { id: 'lancamento', label: 'Nova Venda', icon: 'shopping-cart', permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'assinaturas', label: 'Histórico', icon: 'history', permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'crm', label: 'CRM Leads', icon: 'users', permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'analise', label: 'Dashboard', icon: 'pie-chart', permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'fechamento', label: 'Fechamento', icon: 'wallet', permissoes: ['ADMIN', 'MENTOR', 'LIDER'] },
        { id: 'cadastros', label: 'Cadastros', icon: 'database', permissoes: ['ADMIN', 'MENTOR'] }
    ];

    const abasPermitidas = todasAbas.filter(aba => aba.permissoes.includes(usuarioLogado.role));

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans antialiased text-slate-600">
            
            {/* CABEÇALHO DESIGN MINIMALISTA SAAS */}
            <header className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 shadow-sm border-b border-blue-500/20 sticky top-0 z-50 transition-all">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
                    
                    {/* Logotipo e Unidade */}
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/10 shadow-inner">
                            <i data-lucide="zap" className="text-white w-5 h-5"></i>
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-white tracking-wider leading-none">PRATIQUE OS</h1>
                            <p className="text-[9px] font-bold text-blue-200 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> {usuarioLogado.unidade}
                            </p>
                        </div>
                    </div>
                    
                    {/* Botão Hamburger (Mobile) */}
                    <button 
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="md:hidden p-2 text-blue-100 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                    >
                        <i data-lucide={isMobileMenuOpen ? "x" : "menu"} className="w-6 h-6"></i>
                    </button>
                    
                    {/* Navegação Desktop */}
                    <div className="hidden md:flex items-center gap-6">
                        <nav className="flex items-center gap-1 bg-black/10 p-1 rounded-xl border border-white/5">
                            {abasPermitidas.map(tab => {
                                const isActive = activeTab === tab.id;
                                return (
                                    <button 
                                        key={tab.id} 
                                        onClick={() => setActiveTab(tab.id)} 
                                        className={`px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-black uppercase tracking-wider transition-all duration-200 whitespace-nowrap ${
                                            isActive 
                                            ? 'bg-white text-blue-700 shadow-sm font-black' 
                                            : 'text-blue-100 hover:text-white hover:bg-white/5'
                                        }`}
                                    >
                                        <i data-lucide={tab.icon} className="w-3.5 h-3.5"></i> {tab.label}
                                    </button>
                                )
                            })}
                        </nav>

                        {/* Perfil e Logout */}
                        <div className="flex items-center gap-4 pl-4 border-l border-white/10">
                            <div className="text-right">
                                <p className="text-xs font-black text-white tracking-tight">{usuarioLogado.nome}</p>
                                <p className="text-[9px] font-black text-blue-200 uppercase tracking-widest mt-0.5 bg-black/20 px-2 py-0.5 rounded-md border border-white/5">{usuarioLogado.role}</p>
                            </div>
                            <button 
                                onClick={handleLogout} 
                                className="w-9 h-10 bg-white/10 hover:bg-rose-500/90 text-blue-100 hover:text-white rounded-xl flex items-center justify-center transition-all border border-white/10 hover:border-transparent shadow-sm" 
                                title="Sair do Sistema"
                            >
                                <i data-lucide="log-out" className="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                </div>

                {/* MENU MOBILE INTERATIVO */}
                {isMobileMenuOpen && (
                    <div className="md:hidden bg-blue-800 border-t border-blue-600/60 shadow-xl overflow-hidden animate-[fadeIn_0.15s_ease-out]">
                        <div className="px-3 pt-2 pb-4 space-y-1">
                            {abasPermitidas.map(tab => {
                                const isActive = activeTab === tab.id;
                                return (
                                    <button 
                                        key={tab.id} 
                                        onClick={() => {
                                            setActiveTab(tab.id);
                                            setIsMobileMenuOpen(false); 
                                        }} 
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                            isActive 
                                            ? 'bg-white text-blue-700 shadow-md' 
                                            : 'text-blue-100 hover:bg-blue-700/50 hover:text-white'
                                        }`}
                                    >
                                        <i data-lucide={tab.icon} className="w-4 h-4"></i> {tab.label}
                                    </button>
                                )
                            })}
                            
                            <div className="h-px bg-white/10 my-3"></div>
                            
                            {/* Perfil Mobile */}
                            <div className="flex items-center justify-between px-3 py-2 bg-black/10 rounded-xl border border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center font-black text-white text-xs border border-white/10">
                                        {usuarioLogado.nome.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-white">{usuarioLogado.nome}</p>
                                        <p className="text-[9px] font-bold text-blue-200 uppercase tracking-widest">{usuarioLogado.role}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={handleLogout} 
                                    className="p-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-colors shadow-sm"
                                    title="Sair"
                                >
                                    <i data-lucide="log-out" className="w-4 h-4"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </header>

            {/* ESPAÇO DE TRABALHO GERAL (ZONA DE CONTEÚDO) */}
            <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-8">
                {activeTab === 'lancamento' && (
                    <LancamentoVendas 
                        onAddMultiple={handleAddLancamentos} 
                        planos={planos} 
                        produtos={produtos} 
                        colaboradores={colaboradores} 
                    />
                )}
                
                {activeTab === 'assinaturas' && (
                    <AssinaturasPratique 
                        data={dadosAssinaturas} 
                        setData={setDadosAssinaturas} 
                    />
                )}

                {activeTab === 'fechamento' && (
                    <FechamentoCaixa 
                        vendas={dadosAssinaturas} 
                        setVendas={setDadosAssinaturas} 
                        usuarioLogado={usuarioLogado} 
                    />
                )}
                
                {activeTab === 'analise' && (
                    <AnaliseDashboard 
                        vendas={dadosAssinaturas} 
                        planos={planos} 
                    />
                )}
                
                {activeTab === 'crm' && (
                    <CrmVisitantes 
                        visitantes={dadosVisitantes} 
                        setVisitantes={setDadosVisitantes} 
                        colaboradores={colaboradores} 
                    />
                )}

                {activeTab === 'cadastros' && (
                    <CadastroGeral 
                        planos={planos} 
                        setPlanos={setPlanos} 
                        produtos={produtos} 
                        setProdutos={setProdutos} 
                        colaboradores={colaboradores} 
                        setColaboradores={setColaboradores} 
                    />
                )}
            </main>
        </div>
    );
}