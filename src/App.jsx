import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient.js';
import { useI18n } from './i18n/I18nContext.jsx'; 
import LanguageSwitcher from './components/LanguageSwitcher.jsx'; 

import { 
    Zap, ChevronDown, Menu, X, LogOut, 
    ShoppingCart, History, PieChart, Wallet, 
    Users, Database, Settings, Dumbbell, Lock,
    PanelLeftClose, PanelLeftOpen, Sun, Moon, Megaphone 
} from 'lucide-react';

import { SidebarDesktop, SidebarMobile } from './components/layout/Sidebar.jsx';
import Topbar from './components/layout/Topbar.jsx';
import IdleCurtain from './components/layout/IdleCurtain.jsx';
import BlockingGate from './components/BlockingGate/index.jsx';

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

// 🔥 FUNÇÃO BLINDADA: Remove acentos e espaços duplos
const normalizarNomeBusca = (nome) => {
    if (!nome) return '';
    return String(nome)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") 
        .replace(/\s+/g, ' ')            
        .trim()
        .toUpperCase();
};

export default function App() {
    const { t } = useI18n(); 

    const [usuarioLogado, setUsuarioLogado] = useState(null);
    const [activeTab, setActiveTab] = useState('lancamento');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); 
    const [unidadeGlobal, setUnidadeGlobal] = useState('TODAS');
    const [isIdle, setIsIdle] = useState(false); 
    
    const [triggerSync, setTriggerSync] = useState(0);
    
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

    // 🔥 DICIONÁRIO HÍBRIDO (Busca por Matrícula E por Nome)
    const [alunosMap, setAlunosMap] = useState({ porNome: new Map(), porMatricula: new Map() });

    const [comunicadosGlobais, setComunicadosGlobais] = useState({
        pendentesTotais: 0, 
        comunicadoBloqueante: null 
    });

    const [activeGateComm, setActiveGateComm] = useState(null); 
    const [isUserBusy, setIsUserBusy] = useState(false);
    const [targetTab, setTargetTab] = useState(null);

    useEffect(() => {
        const handleFocus = (e) => {
            const tag = e.target?.tagName?.toLowerCase();
            if (['input', 'textarea', 'select'].includes(tag)) {
                setIsUserBusy(true);
            }
        };
        const handleBlur = () => setIsUserBusy(false);
        
        document.addEventListener('focusin', handleFocus);
        document.addEventListener('focusout', handleBlur);
        return () => {
            document.removeEventListener('focusin', handleFocus);
            document.removeEventListener('focusout', handleBlur);
        };
    }, []);

    useEffect(() => {
        const bloqueante = comunicadosGlobais.comunicadoBloqueante;
        
        if (!bloqueante) {
            setActiveGateComm(null);
            if (targetTab) {
                setActiveTab(targetTab);
                setTargetTab(null);
            }
            return;
        }

        if (bloqueante && (!activeGateComm || activeGateComm.id !== bloqueante.id)) {
            if (!isUserBusy) {
                setActiveGateComm(bloqueante);
            } else {
                const forceTimer = setTimeout(() => {
                    setActiveGateComm(bloqueante);
                }, 45000);
                return () => clearTimeout(forceTimer);
            }
        }
    }, [comunicadosGlobais.comunicadoBloqueante, isUserBusy, activeGateComm, targetTab]);

    const handleNavigation = (tabId) => {
        const bloqueante = comunicadosGlobais.comunicadoBloqueante;
        if (bloqueante) {
            setTargetTab(tabId);
            setActiveGateComm(bloqueante);
        } else {
            setActiveTab(tabId);
        }
    };

    useEffect(() => { if (usuarioLogado) setUnidadeGlobal('TODAS'); }, [usuarioLogado]);
    useEffect(() => {
        localStorage.setItem('pratique_theme', theme);
        if (theme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    }, [theme]);
    useEffect(() => { localStorage.setItem('pratique_sidebar', isCollapsed); }, [isCollapsed]);
    const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

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

    useEffect(() => {
        if (!usuarioLogado) return;
        let isMounted = true;
        let timerAgenda = null;

        const syncComunicados = async () => {
            try {
                const { data: authData, error: authError } = await supabase.auth.getUser();
                if (authError || !authData?.user?.email || !isMounted) return;

                const { data, error } = await supabase
                    .from('comunicado_inbox')
                    .select(`
                        id, status_leitura,
                        comunicados!inner (*)
                    `)
                    .eq('email_usuario', authData.user.email)
                    .in('status_leitura', ['NAO_LIDO', 'PENDENTE'])
                    .eq('comunicados.status', 'ATIVO')
                    .is('comunicados.deleted_at', null);

                if (error) {
                    console.error("Erro Supabase App.jsx:", error);
                    return;
                }

                if (!isMounted) return;

                const agora = new Date();
                let ativosPendentes = 0;
                let maisAntigoBloqueante = null;
                let proximoAgendamento = null;

                data.forEach(item => {
                    const com = item.comunicados;
                    const inicio = new Date(com.inicio_em);

                    if (inicio <= agora) {
                        ativosPendentes++; 
                        if (com.obrigatorio && com.bloqueia_operacao) {
                            if (!maisAntigoBloqueante || inicio < new Date(maisAntigoBloqueante.inicio_em)) {
                                maisAntigoBloqueante = { inbox_id: item.id, ...com };
                            }
                        }
                    } else {
                        if (!proximoAgendamento || inicio < proximoAgendamento) {
                            proximoAgendamento = inicio;
                        }
                    }
                });

                setComunicadosGlobais({ pendentesTotais: ativosPendentes, comunicadoBloqueante: maisAntigoBloqueante });

                if (proximoAgendamento) {
                    const delay = proximoAgendamento.getTime() - Date.now() + 1000;
                    if (delay > 0 && delay < 2147483647) timerAgenda = setTimeout(syncComunicados, delay);
                }
            } catch (err) { console.error("Erro sync comunicados:", err); }
        };

        syncComunicados();
        const channel = supabase.channel('central-sync-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'comunicado_inbox' }, syncComunicados)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'comunicados' }, syncComunicados)
            .subscribe();

        return () => {
            isMounted = false;
            if (timerAgenda) clearTimeout(timerAgenda);
            supabase.removeChannel(channel);
        };
    }, [usuarioLogado, triggerSync]); 

    const ehChefe = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';
    const deveFiltrar = !ehChefe || (ehChefe && unidadeGlobal !== 'TODAS');
    const unidadeFiltro = ehChefe ? unidadeGlobal : usuarioLogado?.unidade;

    // 🔥 SMART FETCHING CIRÚRGICO: Dribla o limite da API do Supabase!
    const fetchAlunosEspecificos = useCallback(async (registrosArray, isMounted = true) => {
        if (!registrosArray || registrosArray.length === 0) return;

        const nomesBuscados = new Set();
        const matriculasBuscadas = new Set();

        registrosArray.forEach(reg => {
            // Se o CPF não existir na venda/avaliação, nós anotamos para buscar no banco!
            if (!reg.cpf) {
                if (reg.matricula && String(reg.matricula).trim() !== '') {
                    matriculasBuscadas.add(String(reg.matricula).trim());
                }
                if (reg.nome_aluno || reg.nome) {
                    nomesBuscados.add(normalizarNomeBusca(reg.nome_aluno || reg.nome));
                }
            }
        });

        if (nomesBuscados.size === 0 && matriculasBuscadas.size === 0) return;

        try {
            const arrNomes = Array.from(nomesBuscados);
            const arrMats = Array.from(matriculasBuscadas);
            
            // Separamos a requisição em lotes de 100 para a API nunca travar
            const chunkSize = 100;
            const dataResult = [];

            // Buscando por Nomes
            for (let i = 0; i < arrNomes.length; i += chunkSize) {
                const chunkNomes = arrNomes.slice(i, i + chunkSize);
                const { data } = await supabase.from('alunos').select('nome, cpf, matricula').in('nome', chunkNomes);
                if (data) dataResult.push(...data);
            }

            // Buscando por Matrículas
            for (let i = 0; i < arrMats.length; i += chunkSize) {
                const chunkMats = arrMats.slice(i, i + chunkSize);
                const { data } = await supabase.from('alunos').select('nome, cpf, matricula').in('matricula', chunkMats);
                if (data) dataResult.push(...data);
            }

            if (isMounted && dataResult.length > 0) {
                setAlunosMap(prev => {
                    const novoNomeMap = new Map(prev.porNome);
                    const novoMatMap = new Map(prev.porMatricula);
                    
                    dataResult.forEach(a => {
                        if (a.cpf) {
                            if (a.nome) novoNomeMap.set(normalizarNomeBusca(a.nome), a.cpf);
                            if (a.matricula && String(a.matricula).trim() !== '') novoMatMap.set(String(a.matricula).trim(), a.cpf);
                        }
                    });
                    return { porNome: novoNomeMap, porMatricula: novoMatMap };
                });
            }
        } catch (err) {
            console.error("Erro no Smart Fetching de alunos:", err);
        }
    }, []);

    const fetchUnidades = useCallback(async (isMounted = true) => { const { data } = await supabase.from('unidades').select('*').order('nome', { ascending: true }); if (isMounted && data) setUnidades(data); }, []);
    const fetchColaboradores = useCallback(async (isMounted = true) => { let query = supabase.from('colaboradores').select('*'); if (deveFiltrar) query = query.eq('unidade', unidadeFiltro); const { data } = await query; if (isMounted && data) setColaboradores(data); }, [deveFiltrar, unidadeFiltro]);
    const fetchCatalogo = useCallback(async (isMounted = true) => { const { data } = await supabase.from('catalogo').select('*'); if (isMounted && data) { setPlanos(data.filter(item => item.tipo === 'plano')); setProdutos(data.filter(item => item.tipo === 'produto')); setServicos(data.filter(item => item.tipo === 'servico')); } }, []);
    
    // 🔥 Modificado para chamar o Smart Fetching logo após carregar as Vendas
    const fetchVendas = useCallback(async (isMounted = true) => { 
        let query = supabase.from('vendas').select('*').order('id', { ascending: false }).limit(10000); 
        if (deveFiltrar) query = query.eq('unidade', unidadeFiltro); 
        const { data } = await query; 
        if (isMounted && data) {
            setDadosAssinaturas(data);
            fetchAlunosEspecificos(data, isMounted);
        }
    }, [deveFiltrar, unidadeFiltro, fetchAlunosEspecificos]);

    const fetchLeads = useCallback(async (isMounted = true) => { let query = supabase.from('leads').select('*').order('id', { ascending: false }).limit(10000); if (deveFiltrar) query = query.eq('unidade', unidadeFiltro); const { data } = await query; if (isMounted && data) setDadosVisitantes(data); }, [deveFiltrar, unidadeFiltro]);
    
    // 🔥 Modificado para chamar o Smart Fetching logo após carregar as Avaliações
    const fetchAvaliacoes = useCallback(async (isMounted = true) => { 
        let query = supabase.from('avaliacoes_realizadas').select('*').order('id', { ascending: false }).limit(10000); 
        if (deveFiltrar) query = query.eq('unidade', unidadeFiltro); 
        const { data } = await query; 
        if (isMounted && data) {
            setDadosAvaliacoes(data);
            fetchAlunosEspecificos(data, isMounted);
        }
    }, [deveFiltrar, unidadeFiltro, fetchAlunosEspecificos]);

    useEffect(() => {
        if (!usuarioLogado) return;
        let isMounted = true; 
        fetchUnidades(isMounted); fetchColaboradores(isMounted); fetchCatalogo(isMounted); fetchVendas(isMounted); fetchLeads(isMounted); fetchAvaliacoes(isMounted);

        const realtimeChannel = supabase.channel('sistema-pratique-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vendas' }, () => fetchVendas(isMounted))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchLeads(isMounted))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'avaliacoes_realizadas' }, () => fetchAvaliacoes(isMounted))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'colaboradores' }, () => fetchColaboradores(isMounted))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'catalogo' }, () => fetchCatalogo(isMounted))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'unidades' }, () => fetchUnidades(isMounted))
            .subscribe();

        return () => { isMounted = false; supabase.removeChannel(realtimeChannel); };
    }, [usuarioLogado, unidadeGlobal, fetchUnidades, fetchColaboradores, fetchCatalogo, fetchVendas, fetchLeads, fetchAvaliacoes]); 

    // 🔥 O "Frontend JOIN" Enriquecido: Busca 1º pela Matrícula e 2º pelo Nome Normalizado
    const vendasEnriquecidas = useMemo(() => {
        return dadosAssinaturas.map(v => {
            let cpfAchado = v.cpf || v.cpf_aluno || '';
            
            if (!cpfAchado && alunosMap) {
                if (v.matricula && alunosMap.porMatricula.has(String(v.matricula).trim())) {
                    cpfAchado = alunosMap.porMatricula.get(String(v.matricula).trim());
                } else {
                    const nomeBusca = normalizarNomeBusca(v.nome_aluno || v.nome);
                    cpfAchado = alunosMap.porNome.get(nomeBusca) || '';
                }
            }
            return { ...v, cpf: cpfAchado };
        });
    }, [dadosAssinaturas, alunosMap]);

    const avaliacoesEnriquecidas = useMemo(() => {
        return dadosAvaliacoes.map(a => {
            let cpfAchado = a.cpf || a.cpf_aluno || '';
            
            if (!cpfAchado && alunosMap) {
                if (a.matricula && alunosMap.porMatricula.has(String(a.matricula).trim())) {
                    cpfAchado = alunosMap.porMatricula.get(String(a.matricula).trim());
                } else {
                    const nomeBusca = normalizarNomeBusca(a.nome_aluno || a.nome);
                    cpfAchado = alunosMap.porNome.get(nomeBusca) || '';
                }
            }
            return { ...a, cpf: cpfAchado };
        });
    }, [dadosAvaliacoes, alunosMap]);

    const handleAddLancamentos = (novos) => setDadosAssinaturas([...novos, ...dadosAssinaturas]);
    const handleLogout = () => { setUsuarioLogado(null); setIsMobileMenuOpen(false); };

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
        { id: 'comunicados', label: t('navigation.communications', { defaultValue: 'Comunicados' }), icon: Megaphone, permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], badge: comunicadosGlobais.pendentesTotais > 0 ? comunicadosGlobais.pendentesTotais : null },
        { id: 'config', label: t('navigation.settings'), icon: Settings, permissoes: ['ADMIN'] }
    ];

    const abasPermitidas = todasAbas.filter(aba => aba.permissoes.includes(usuarioLogado.role));
    const tabAtual = todasAbas.find(t => t.id === activeTab) || todasAbas[0];
    const ActiveIcon = tabAtual.icon;

    return (
        <div className="flex h-dvh w-full bg-slate-50 dark:bg-[#0a0f1c] overflow-hidden font-sans text-slate-800 dark:text-slate-200 transition-colors duration-500">
            <div className="absolute top-[-25%] left-[-15%] w-[600px] h-[600px] bg-blue-500/5 dark:bg-blue-600/10 rounded-full blur-[140px] pointer-events-none z-0"></div>
            <div className="absolute bottom-[-25%] right-[-15%] w-[600px] h-[600px] bg-emerald-500/5 dark:bg-emerald-600/5 rounded-full blur-[140px] pointer-events-none z-0" style={{ animationDelay: '3s' }}></div>

            <IdleCurtain isIdle={isIdle} />

            <SidebarDesktop 
                isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} theme={theme} toggleTheme={toggleTheme}
                usuarioLogado={usuarioLogado} handleLogout={handleLogout}
                abasPermitidas={abasPermitidas} activeTab={activeTab} 
                setActiveTab={handleNavigation}
            />

            <SidebarMobile 
                isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} theme={theme} toggleTheme={toggleTheme}
                usuarioLogado={usuarioLogado} handleLogout={handleLogout}
                abasPermitidas={abasPermitidas} activeTab={activeTab} 
                setActiveTab={handleNavigation}
            />

            <div className="flex-1 flex flex-col h-full relative z-10 w-full min-w-0 overflow-hidden">
                
                <BlockingGate 
                    comunicadoBloqueante={activeGateComm} 
                    onConcluido={() => setTriggerSync(prev => prev + 1)}
                />

                <Topbar 
                    setIsMobileMenuOpen={setIsMobileMenuOpen} ActiveIcon={ActiveIcon} tabAtual={tabAtual}
                    ehChefe={ehChefe} unidadeGlobal={unidadeGlobal} setUnidadeGlobal={setUnidadeGlobal}
                    unidades={unidades} usuarioLogado={usuarioLogado}
                />

                <main key={unidadeGlobal} className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 lg:p-8 relative z-0">
                    {activeTab === 'lancamento' && <LancamentoVendas usuarioLogado={usuarioVirtual} unidades={unidades} onAddMultiple={handleAddLancamentos} planos={planos} produtos={produtos} servicos={servicos} colaboradores={colaboradores} />}
                    {activeTab === 'assinaturas' && <AssinaturasPratique usuarioLogado={usuarioVirtual} data={vendasEnriquecidas} setData={setDadosAssinaturas} colaboradores={colaboradores} />}
                    {activeTab === 'analise' && <AnaliseDashboard usuarioLogado={usuarioVirtual} vendas={vendasEnriquecidas} visitantes={dadosVisitantes} avaliacoes={avaliacoesEnriquecidas} planos={planos} produtos={produtos} colaboradores={colaboradores} />}
                    {activeTab === 'fechamento' && <FechamentoCaixa usuarioLogado={usuarioVirtual} vendas={vendasEnriquecidas} visitantes={dadosVisitantes} avaliacoes={avaliacoesEnriquecidas} setVendas={setDadosAssinaturas} colaboradores={colaboradores} />}
                    {activeTab === 'crm' && <CrmVisitantes usuarioLogado={usuarioVirtual} visitantes={dadosVisitantes} setVisitantes={setDadosVisitantes} colaboradores={colaboradores} />}
                    {activeTab === 'avaliacao' && <AvaliacaoFisica usuarioLogado={usuarioVirtual} avaliacoes={avaliacoesEnriquecidas} colaboradores={colaboradores} setAvaliacoes={setDadosAvaliacoes} />}
                    {activeTab === 'cadastros' && <CadastroGeral usuarioLogado={usuarioVirtual} planos={planos} setPlanos={setPlanos} produtos={produtos} setProdutos={setProdutos} servicos={servicos} setServicos={setServicos} colaboradores={colaboradores} setColaboradores={setColaboradores} unidades={unidades} />}
                    {activeTab === 'comunicados' && <CentralComunicados usuarioLogado={usuarioLogado} unidades={unidades} />}
                    {activeTab === 'config' && <Configuracoes unidades={unidades} setUnidades={setUnidades} />}
                </main>
            </div>
        </div>
    );
}