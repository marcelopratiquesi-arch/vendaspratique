import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient.js';
import { useI18n } from './i18n/I18nContext.jsx'; 

import { 
    ShoppingCart, History, PieChart, Wallet, 
    Users, GraduationCap, Database, Settings, Dumbbell, Megaphone 
} from 'lucide-react';

import { SidebarDesktop, SidebarMobile } from './components/layout/Sidebar.jsx';
import TopBar from './components/layout/TopBar.jsx';
import IdleCurtain from './components/layout/IdleCurtain.jsx';
import BlockingGate from './components/BlockingGate/index.jsx';

import LancamentoVendas from './pages/Lancamentos/index.jsx';
import AssinaturasPratique from './pages/HistoricoVendas/index.jsx'; 
import FechamentoCaixa from './pages/FechamentoCaixa';
import AnaliseDashboard from './pages/AnaliseVendas'; 
import CrmVisitantes from './pages/CrmVisitantes/index.jsx'; 
import ModuloAlunos360 from './pages/Alunos/index.jsx';
import CadastroGeral from './pages/CadastroGeral'; 
import Configuracoes from './pages/Configuracoes.jsx';
import Login from './pages/Login.jsx';
import AvaliacaoFisica from './pages/AvaliacaoFisica/index.jsx';
import CentralComunicados from './pages/Comunicados/index.jsx';

// 📐 Tamanho geral da interface (veja o useEffect "Escala da interface")
const ESCALA_INTERFACE = 0.9;

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
    
    // Estados de Seleção de Aluno
    const [alunoPreSelecionado, setAlunoPreSelecionado] = useState(null);
    const [alunoGlobalPreSelecionado, setAlunoGlobalPreSelecionado] = useState(null);
    
    const [triggerSync, setTriggerSync] = useState(0);
    const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('pratique_sidebar') === 'true');
    const [theme, setTheme] = useState(() => {
        const salvo = localStorage.getItem('pratique_theme');
        if (salvo) return salvo;
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
        return 'light';
    });

    const [statusConexao, setStatusConexao] = useState('conectando');

    const [dadosAssinaturas, setDadosAssinaturas] = useState([]);
    const [dadosVisitantes, setDadosVisitantes] = useState([]);
    const [dadosAvaliacoes, setDadosAvaliacoes] = useState([]); 
    const [planos, setPlanos] = useState([]);
    const [produtos, setProdutos] = useState([]);
    const [servicos, setServicos] = useState([]); 
    const [colaboradores, setColaboradores] = useState([]);
    const [unidades, setUnidades] = useState([]);

    const [alunosMap, setAlunosMap] = useState({ porNome: new Map(), porMatricula: new Map() });

    const [comunicadosGlobais, setComunicadosGlobais] = useState({
        pendentesTotais: 0, 
        comunicadoBloqueante: null 
    });

    const [activeGateComm, setActiveGateComm] = useState(null); 
    const [isUserBusy, setIsUserBusy] = useState(false);
    const [targetTab, setTargetTab] = useState(null);

    // Motor de Status de Conexão
    useEffect(() => {
        const updateOnlineStatus = () => {
            if (navigator.onLine) setStatusConexao('conectando');
            else setStatusConexao('offline');
        };
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        updateOnlineStatus();

        return () => {
            window.removeEventListener('online', updateOnlineStatus);
            window.removeEventListener('offline', updateOnlineStatus);
        };
    }, []);

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

    const handleSelecionarAlunoGlobal = (aluno) => {
        setAlunoGlobalPreSelecionado(aluno);
        setOrigemFichaAluno(null);
        handleNavigation('alunos');
    };

    // Abre a ficha lembrando de qual tela veio (o "Voltar" da ficha leva de volta para ela)
    const [origemFichaAluno, setOrigemFichaAluno] = useState(null);
    const abrirAlunoVindoDe = (aluno, abaOrigem) => {
        setAlunoGlobalPreSelecionado(aluno);
        setOrigemFichaAluno(abaOrigem);
        handleNavigation('alunos');
    };

    useEffect(() => { if (usuarioLogado) setUnidadeGlobal('TODAS'); }, [usuarioLogado]);
    
    useEffect(() => {
        localStorage.setItem('pratique_theme', theme);
        const applyTheme = (mode) => {
            if (mode === 'dark') document.documentElement.classList.add('dark');
            else document.documentElement.classList.remove('dark');
        };
        if (theme === 'system') {
            const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            applyTheme(isDark ? 'dark' : 'light');
            const listener = (e) => applyTheme(e.matches ? 'dark' : 'light');
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', listener);
            return () => window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', listener);
        } else {
            applyTheme(theme);
        }
    }, [theme]);
    
    useEffect(() => { localStorage.setItem('pratique_sidebar', isCollapsed); }, [isCollapsed]);

    // 📐 Escala da interface: deixa o sistema inteiro um pouco menor, como um "zoom" fixo.
    // 1 = tamanho original | 0.9 = 10% menor | 0.85 = 15% menor
    // Só vale com alguém logado: a tela de login fica no tamanho normal e ocupa a tela inteira
    // (com a escala ligada, telas de altura "100% da tela" deixavam uma faixa branca embaixo).
    useEffect(() => {
        const raiz = document.documentElement;
        if (!usuarioLogado) {
            raiz.style.zoom = '';
            return undefined;
        }
        raiz.style.zoom = String(ESCALA_INTERFACE);
        return () => { raiz.style.zoom = ''; };
    }, [usuarioLogado]);

    useEffect(() => {
        let timeoutId;
        const resetTimer = () => {
            clearTimeout(timeoutId);
            if (!isIdle) timeoutId = setTimeout(() => setIsIdle(true), 30 * 60 * 1000);
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

                if (error) return;
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
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') setStatusConexao('online');
                if (status === 'CHANNEL_ERROR' || status === 'CLOSED') setStatusConexao('offline');
            });

        return () => {
            isMounted = false;
            if (timerAgenda) clearTimeout(timerAgenda);
            supabase.removeChannel(channel);
        };
    }, [usuarioLogado, triggerSync]); 

    const ehChefe = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';
    const deveFiltrar = !ehChefe || (ehChefe && unidadeGlobal !== 'TODAS');
    const unidadeFiltro = ehChefe ? unidadeGlobal : usuarioLogado?.unidade;

    const fetchAlunosEspecificos = useCallback(async (registrosArray, isMounted = true) => {
        if (!registrosArray || registrosArray.length === 0) return;

        const nomesBuscados = new Set();
        const matriculasBuscadas = new Set();

        registrosArray.forEach(reg => {
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
            const chunkSize = 100;
            const dataResult = [];

            for (let i = 0; i < arrNomes.length; i += chunkSize) {
                const chunkNomes = arrNomes.slice(i, i + chunkSize);
                const { data } = await supabase.from('alunos').select('nome, cpf, matricula').in('nome', chunkNomes);
                if (data) dataResult.push(...data);
            }

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
    
    const getDataCorte = () => {
        const d = new Date();
        d.setDate(d.getDate() - 90); 
        return d.toISOString();
    };

    const fetchVendas = useCallback(async (isMounted = true) => { 
        let query = supabase.from('vendas').select('*')
            .gte('created_at', getDataCorte())
            .order('id', { ascending: false })
            .limit(3000); 
        if (deveFiltrar) query = query.eq('unidade', unidadeFiltro); 
        const { data } = await query; 
        if (isMounted && data) {
            setDadosAssinaturas(data);
            fetchAlunosEspecificos(data, isMounted);
        }
    }, [deveFiltrar, unidadeFiltro, fetchAlunosEspecificos]);

    const fetchLeads = useCallback(async (isMounted = true) => { 
        let query = supabase.from('leads').select('*')
            .gte('created_at', getDataCorte())
            .order('id', { ascending: false })
            .limit(3000); 
        if (deveFiltrar) query = query.eq('unidade', unidadeFiltro); 
        const { data } = await query; 
        if (isMounted && data) setDadosVisitantes(data); 
    }, [deveFiltrar, unidadeFiltro]);
    
    const fetchAvaliacoes = useCallback(async (isMounted = true) => { 
        let query = supabase.from('avaliacoes_realizadas').select('*')
            .gte('created_at', getDataCorte())
            .order('id', { ascending: false })
            .limit(3000); 
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
    const handleLogout = async () => { 
        try { await supabase.auth.signOut(); } catch(e) {}
        setUsuarioLogado(null); 
        setIsMobileMenuOpen(false); 
    };

    if (!usuarioLogado) return <Login onLogin={setUsuarioLogado} />;

    // 🔥 CORREÇÃO DA VISÃO GLOBAL APLICADA AQUI
    const usuarioVirtual = {
        ...usuarioLogado,
        role: (ehChefe && unidadeGlobal !== 'TODAS') ? 'LIDER' : usuarioLogado.role,
        roleReal: usuarioLogado.role, // papel verdadeiro (o "role" acima vira LIDER quando ADMIN/MENTOR escolhe uma unidade)
        unidade: ehChefe ? unidadeGlobal : usuarioLogado.unidade 
    };

    const todasAbas = [
        { id: 'lancamento', label: t('navigation.newSale'), icon: ShoppingCart, permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'assinaturas', label: t('navigation.history'), icon: History, permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'analise', label: t('navigation.dashboard'), icon: PieChart, permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'fechamento', label: t('navigation.closing'), icon: Wallet, permissoes: ['ADMIN', 'MENTOR', 'LIDER'] },
        { id: 'crm', label: t('navigation.crm'), icon: Users, permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'alunos', label: t('navigation.students', { defaultValue: 'Alunos' }), icon: GraduationCap, permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'avaliacao', label: t('navigation.assessment'), icon: Dumbbell, permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'] },
        { id: 'cadastros', label: t('navigation.management'), icon: Database, permissoes: ['ADMIN', 'MENTOR', 'LIDER'] },
        { id: 'comunicados', label: t('navigation.communications', { defaultValue: 'Comunicados' }), icon: Megaphone, permissoes: ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], badge: comunicadosGlobais.pendentesTotais > 0 ? comunicadosGlobais.pendentesTotais : null },
        { id: 'config', label: t('navigation.settings'), icon: Settings, permissoes: ['ADMIN'] }
    ];

    const abasPermitidas = todasAbas.filter(aba => aba.permissoes.includes(usuarioLogado.role));

    return (
        <div className="fixed inset-0 flex bg-slate-50 dark:bg-[#0a0f1c] overflow-hidden font-sans text-slate-800 dark:text-slate-200 transition-colors duration-500">
            
            <IdleCurtain isIdle={isIdle} />

            <SidebarDesktop 
                isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} 
                abasPermitidas={abasPermitidas} activeTab={activeTab} setActiveTab={handleNavigation}
                ehChefe={ehChefe} unidadeGlobal={unidadeGlobal} setUnidadeGlobal={setUnidadeGlobal} unidades={unidades}
                usuarioLogado={usuarioLogado} handleLogout={handleLogout}
            />

            <SidebarMobile 
                isMobileMenuOpen={isMobileMenuOpen} fecharMobile={() => setIsMobileMenuOpen(false)}
                abasPermitidas={abasPermitidas} activeTab={activeTab} setActiveTab={handleNavigation}
                ehChefe={ehChefe} unidadeGlobal={unidadeGlobal} setUnidadeGlobal={setUnidadeGlobal} unidades={unidades}
                usuarioLogado={usuarioLogado} handleLogout={handleLogout}
            />

            <div className="flex-1 flex flex-col h-full relative z-10 w-full min-w-0 overflow-hidden">
                <TopBar 
                    activeTab={activeTab}
                    usuarioLogado={usuarioVirtual}
                    theme={theme}
                    setTheme={setTheme}
                    onAbrirMenuMobile={() => setIsMobileMenuOpen(true)}
                    onSelecionarAlunoGlobal={handleSelecionarAlunoGlobal}
                    pendentesTotais={comunicadosGlobais.pendentesTotais}
                    onNavigate={handleNavigation}
                    podeTrocarUnidade={ehChefe}
                    unidadeGlobal={unidadeGlobal}
                    setUnidadeGlobal={setUnidadeGlobal}
                    unidades={unidades}
                />

                <BlockingGate 
                    comunicadoBloqueante={activeGateComm} 
                    onConcluido={() => setTriggerSync(prev => prev + 1)}
                />

                <main key={unidadeGlobal} className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 lg:p-5 relative z-0 h-full w-full">
                    {activeTab === 'lancamento' && (
                        <LancamentoVendas 
                            usuarioLogado={usuarioVirtual} 
                            unidades={unidades} 
                            onAddMultiple={handleAddLancamentos} 
                            planos={planos} 
                            produtos={produtos} 
                            servicos={servicos} 
                            colaboradores={colaboradores} 
                            alunoPreSelecionado={alunoPreSelecionado} 
                            limparPreSelecao={() => setAlunoPreSelecionado(null)}
                            onIrParaAluno={handleSelecionarAlunoGlobal}
                        />
                    )}
                    {activeTab === 'assinaturas' && <AssinaturasPratique usuarioLogado={usuarioVirtual} data={vendasEnriquecidas} setData={setDadosAssinaturas} colaboradores={colaboradores} onAbrirAluno={(aluno) => abrirAlunoVindoDe(aluno, 'assinaturas')} />}
                    {activeTab === 'analise' && <AnaliseDashboard usuarioLogado={usuarioVirtual} vendas={vendasEnriquecidas} visitantes={dadosVisitantes} avaliacoes={avaliacoesEnriquecidas} planos={planos} produtos={produtos} colaboradores={colaboradores} />}
                    {activeTab === 'fechamento' && <FechamentoCaixa usuarioLogado={usuarioVirtual} vendas={vendasEnriquecidas} visitantes={dadosVisitantes} avaliacoes={avaliacoesEnriquecidas} setVendas={setDadosAssinaturas} colaboradores={colaboradores} />}
                    {activeTab === 'crm' && <CrmVisitantes usuarioLogado={usuarioVirtual} visitantes={dadosVisitantes} setVisitantes={setDadosVisitantes} colaboradores={colaboradores} />}
                    {activeTab === 'alunos' && (
                        <ModuloAlunos360
                            usuarioLogado={usuarioVirtual}
                            usuarioReal={usuarioLogado}
                            unidadeGlobal={unidadeGlobal}
                            setUnidadeGlobal={setUnidadeGlobal}
                            unidades={unidades}
                            planos={planos}
                            vendas={vendasEnriquecidas}
                            avaliacoes={avaliacoesEnriquecidas}
                            visitantes={dadosVisitantes}
                            onIniciarVendaAluno={(aluno) => {
                                setAlunoPreSelecionado(aluno);
                                handleNavigation('lancamento');
                            }}
                            onIniciarAvaliacaoAluno={(aluno) => {
                                setAlunoPreSelecionado(aluno);
                                handleNavigation('avaliacao');
                            }}
                            alunoParaAbrir={alunoGlobalPreSelecionado}
                            origemAlunoParaAbrir={origemFichaAluno}
                            limparAlunoParaAbrir={() => { setAlunoGlobalPreSelecionado(null); setOrigemFichaAluno(null); }}
                            onVoltarParaOrigem={handleNavigation}
                        />
                    )}
                    {activeTab === 'avaliacao' && (
                        <AvaliacaoFisica 
                            usuarioLogado={usuarioVirtual} 
                            avaliacoes={avaliacoesEnriquecidas} 
                            colaboradores={colaboradores} 
                            setAvaliacoes={setDadosAvaliacoes} 
                            alunoPreSelecionado={alunoPreSelecionado} 
                            limparPreSelecao={() => setAlunoPreSelecionado(null)}
                            onVoltarParaAluno={handleSelecionarAlunoGlobal}
                        />
                    )}
                    {activeTab === 'cadastros' && <CadastroGeral usuarioLogado={usuarioVirtual} planos={planos} setPlanos={setPlanos} produtos={produtos} setProdutos={setProdutos} servicos={servicos} setServicos={setServicos} colaboradores={colaboradores} setColaboradores={setColaboradores} unidades={unidades} />}
                    {activeTab === 'comunicados' && <CentralComunicados usuarioLogado={usuarioLogado} unidades={unidades} />}
                    {activeTab === 'config' && <Configuracoes unidades={unidades} setUnidades={setUnidades} />}
                </main>
            </div>
        </div>
    );
}