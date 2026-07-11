import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient.js';

// Importação Segura das Páginas
import LancamentoVendas from './pages/Lancamento.jsx';
import AssinaturasPratique from './pages/RegistroVendas.jsx';
import FechamentoCaixa from './pages/FechamentoCaixa.jsx';
import AnaliseDashboard from './pages/Analise.jsx';
import CrmVisitantes from './pages/CrmVisitantes.jsx'; 
import CadastroGeral from './pages/CadastroGeral.jsx';
import Configuracoes from './pages/Configuracoes.jsx';
import Login from './pages/Login.jsx';

export default function App() {
    // ==========================================
    // 1. TODOS OS ESTADOS GLOBAIS
    // ==========================================
    const [usuarioLogado, setUsuarioLogado] = useState(null);
    const [activeTab, setActiveTab] = useState('lancamento');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); 
    
    // Estados vazios aguardando a nuvem
    const [dadosAssinaturas, setDadosAssinaturas] = useState([]);
    const [dadosVisitantes, setDadosVisitantes] = useState([]);
    const [planos, setPlanos] = useState([]);
    const [produtos, setProdutos] = useState([]);
    const [colaboradores, setColaboradores] = useState([]);
    const [unidades, setUnidades] = useState([]);

    // ==========================================
    // 2. SINCRONIZAÇÃO COM SUPABASE (FILTRADA POR UNIDADE)
    // ==========================================
    useEffect(() => {
        if (!usuarioLogado) return;

        const carregarBancoDeDados = async () => {
            try {
                // A MÁGICA DA MULTITENÂNCIA: Verifica se tem visão global
                const temVisaoGlobal = usuarioLogado.role === 'ADMIN' || usuarioLogado.role === 'MENTOR';

                // 1. Puxar Equipe (Filtra por unidade se não for global)
                let queryColabs = supabase.from('colaboradores').select('*');
                if (!temVisaoGlobal) queryColabs = queryColabs.eq('unidade', usuarioLogado.unidade);
                const { data: colabs } = await queryColabs;
                if (colabs) setColaboradores(colabs);

                // 2. Puxar Catálogo (Sempre global, catálogo é o mesmo para todos)
                const { data: cat } = await supabase.from('catalogo').select('*');
                if (cat) {
                    setPlanos(cat.filter(item => item.tipo === 'plano'));
                    setProdutos(cat.filter(item => item.tipo === 'produto'));
                }

                // 3. Puxar Histórico de Vendas (Filtra por unidade se não for global)
                let queryVendas = supabase.from('vendas').select('*').order('id', { ascending: false });
                if (!temVisaoGlobal) queryVendas = queryVendas.eq('unidade', usuarioLogado.unidade);
                const { data: vends } = await queryVendas;
                if (vends) setDadosAssinaturas(vends);

                // 4. Puxar CRM de Leads (Filtra por unidade se não for global)
                let queryLeads = supabase.from('leads').select('*').order('id', { ascending: false });
                if (!temVisaoGlobal) queryLeads = queryLeads.eq('unidade', usuarioLogado.unidade);
                const { data: leds } = await queryLeads;
                if (leds) setDadosVisitantes(leds);

                // 5. Puxar Unidades cadastradas
                const { data: unids } = await supabase.from('unidades').select('*').order('nome', { ascending: true });
                if (unids) setUnidades(unids);
                
            } catch (error) {
                console.error("Erro ao puxar dados da nuvem:", error);
            }
        };

        carregarBancoDeDados();
    }, [usuarioLogado]);

    // ==========================================
    // 3. FUNÇÕES E EFEITOS DE INTERFACE
    // ==========================================
    const handleAddLancamentos = (novos) => setDadosAssinaturas([...novos, ...dadosAssinaturas]);
    const handleLogout = () => setUsuarioLogado(null);

    useEffect(() => { 
        if (window.lucide) window.lucide.createIcons(); 
    }, [activeTab, usuarioLogado, isMobileMenuOpen, dadosAssinaturas, dadosVisitantes]);

    // ==========================================
    // 4. TRAVA DE AUTENTICAÇÃO
    // ==========================================
    if (!usuarioLogado) {
        return <Login onLogin={setUsuarioLogado} />;
    }

    // ==========================================
    // 5. CONTROLE DE ACESSO
    // ==========================================
    const todasAbas = [
        { id: 'lancamento', label: 'Nova Venda', icon: 'shopping-cart', permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'assinaturas', label: 'Histórico', icon: 'history', permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'analise', label: 'Dashboard', icon: 'pie-chart', permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'fechamento', label: 'Fechamento', icon: 'wallet', permissoes: ['ADMIN', 'MENTOR', 'LIDER'] },
        { id: 'crm', label: 'CRM', icon: 'users', permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'cadastros', label: 'Cadastros', icon: 'database', permissoes: ['ADMIN', 'MENTOR'] },
        { id: 'config', label: 'Configurações', icon: 'settings', permissoes: ['ADMIN'] }
    ];

    const abasPermitidas = todasAbas.filter(aba => aba.permissoes.includes(usuarioLogado.role));

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans antialiased text-slate-600">
            
            {/* CABEÇALHO */}
            <header className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 shadow-sm border-b border-blue-500/20 sticky top-0 z-50 transition-all">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
                    
                    {/* Logotipo e Unidade */}
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/10 shadow-inner">
                            <i data-lucide="zap" className="text-white w-5 h-5"></i>
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-white tracking-wider leading-none">PRATIQUE VENDAS</h1>
                            <p className="text-[9px] font-bold text-blue-200 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> 
                                {/* LÓGICA DE NOME GLOBAL AQUI */}
                                {usuarioLogado.role === 'ADMIN' || usuarioLogado.role === 'MENTOR' ? 'VISÃO GLOBAL' : usuarioLogado.unidade}
                            </p>
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="md:hidden p-2 text-blue-100 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                    >
                        <i data-lucide={isMobileMenuOpen ? "x" : "menu"} className="w-6 h-6"></i>
                    </button>
                    
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
                        usuarioLogado={usuarioLogado}
                        onAddMultiple={handleAddLancamentos} 
                        planos={planos} 
                        produtos={produtos} 
                        colaboradores={colaboradores} 
                    />
                )}
                
                {activeTab === 'assinaturas' && (
                    <AssinaturasPratique 
                        usuarioLogado={usuarioLogado}
                        data={dadosAssinaturas} 
                        setData={setDadosAssinaturas} 
                    />
                )}

                {activeTab === 'analise' && (
                    <AnaliseDashboard 
                        usuarioLogado={usuarioLogado}
                        vendas={dadosAssinaturas} 
                        planos={planos} 
                    />
                )}

                {activeTab === 'fechamento' && (
                    <FechamentoCaixa 
                        usuarioLogado={usuarioLogado}
                        vendas={dadosAssinaturas} 
                        setVendas={setDadosAssinaturas} 
                    />
                )}
                
                {activeTab === 'crm' && (
                    <CrmVisitantes 
                        usuarioLogado={usuarioLogado}
                        visitantes={dadosVisitantes} 
                        setVisitantes={setDadosVisitantes} 
                        colaboradores={colaboradores} 
                    />
                )}

                {activeTab === 'cadastros' && (
                    <CadastroGeral 
                        usuarioLogado={usuarioLogado}
                        planos={planos} 
                        setPlanos={setPlanos} 
                        produtos={produtos} 
                        setProdutos={setProdutos} 
                        colaboradores={colaboradores} 
                        setColaboradores={setColaboradores} 
                        unidades={unidades} // ENVIANDO A LISTA DE UNIDADES PARA O CADASTRO!
                    />
                )}

                {activeTab === 'config' && (
                    <Configuracoes 
                        unidades={unidades} 
                        setUnidades={setUnidades} 
                    />
                )}
            </main>
        </div>
    );
}