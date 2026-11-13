import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase, definirLoginLembrado } from './supabaseClient.js';
import { useI18n } from './i18n/I18nContext.jsx'; 

import { 
    ShoppingCart, History, PieChart, Wallet, 
    Users, GraduationCap, Database, Settings, Dumbbell, Megaphone, Building2, BellRing, KeyRound
} from 'lucide-react';

import { SidebarDesktop, SidebarMobile } from './components/layout/Sidebar.jsx';
import TopBar from './components/layout/TopBar.jsx';
import IdleCurtain from './components/layout/IdleCurtain.jsx';
import { MINUTOS_PARA_PAUSAR, SEGUNDOS_DE_AVISO, pausarSistema, sistemaPausado, recarregarNaVersaoMaisNova } from './components/pausaSistema.js';
import { buscarPerfilDoLogin, lerLugarSalvo, salvarLugar, esquecerLugar, lerLocal, gravarLocal } from './components/sessaoLogin.js';
import ProtecaoTela from './components/ProtecaoTela.jsx';
import AvisoConexao from './components/AvisoConexao.jsx';
import { avisarContatos, pedirRecargaContatos, ehContatoDeLista, ORIGENS_DE_LISTA } from './components/aoVivoContatos.js';
import BlockingGate from './components/BlockingGate/index.jsx';

import LancamentoVendas from './pages/Lancamentos/index.jsx';
import AssinaturasPratique from './pages/HistoricoVendas/index.jsx'; 
import FechamentoCaixa from './pages/FechamentoCaixa';
import AnaliseDashboard from './pages/AnaliseVendas'; 
import CrmVisitantes from './pages/CrmVisitantes/index.jsx'; 
import ModuloAlunos360 from './pages/Alunos/index.jsx';
import CadastroGeral from './pages/CadastroGeral'; 
import Configuracoes from './pages/Configuracoes/index.jsx';
import Login from './pages/Login.jsx';
import AvaliacaoFisica from './pages/AvaliacaoFisica/index.jsx';
import CentralComunicados from './pages/Comunicados/index.jsx';
import { pedirAbaAnalise } from './pages/AnaliseVendas/movimentoDiario.js';
import { pedirSubaba } from './components/subAbas.js';
import { pedirConferencia } from './pages/FechamentoCaixa/cobrancaAuditoria.js';
import PaginaPendencias from './pages/Pendencias/index.jsx';
import JanelaPendencias from './pages/Pendencias/JanelaPendencias.jsx';
import CartaoPendencias from './pages/Pendencias/CartaoPendencias.jsx';
import JanelaConferirRelatorio from './pages/Pendencias/JanelaConferirRelatorio.jsx';
import CentralUnidadeGlobal from './pages/CadastroGeral/CentralUnidadeGlobal.jsx';
import { usePendencias } from './pages/Pendencias/pendencias.js';
import CobrancaRelatorioRecepcao from './pages/Pendencias/CobrancaRelatorioRecepcao.jsx';
import LembreteCrm from './pages/Pendencias/LembreteCrm.jsx';
import PopupTurnoRecepcao from './pages/Pendencias/PopupTurnoRecepcao.jsx';
import { JanelaCadastroEquipe, CartaoCadastroEquipe } from './pages/Pendencias/AvisoCadastroEquipe.jsx';
import { useCadastroEquipe } from './pages/Pendencias/useCadastroEquipe.js';
import CentralColaboradorGlobal from './pages/CadastroGeral/colaborador/CentralColaboradorGlobal.jsx';
import { pedirFiltroEquipe } from './pages/CadastroGeral/cadastroColaborador.js';
import { tx } from './i18n/traduzir.js';
import { usePermissoes } from './permissoes/usePermissoes.js';
import { carregarChavesLogin, situacaoDoAcesso, dadosDoLoginAtual, registrarLoginUmaVez, registrarEvento, baterAtividade, esquecerRegistroDoLogin } from './components/acesso/acessoBanco.js';
import { situacaoDaEntrada, senhaLiberada, precisaConfirmarDados, MINUTOS_SESSAO, MINUTOS_ENTRE_BATIDAS } from './components/acesso/regrasAcesso.js';
import { useAcessos } from './components/acesso/useAcessos.js';
import TelaAcesso from './components/acesso/TelaAcesso.jsx';
import JanelaConfirmarDados from './components/acesso/JanelaConfirmarDados.jsx';
import JanelaPedidosAcesso from './components/acesso/JanelaPedidosAcesso.jsx';
import MeusAcessos from './components/acesso/MeusAcessos.jsx';
import PaginaAcessos from './pages/Acessos/index.jsx';

// 📐 Tamanho geral da interface (veja o useEffect "Escala da interface").
// Desde 09/11/2026 cada computador escolhe na barra do topo (guardado no computador). Pequeno = 0.8, o tamanho
// que valia para todos desde 30/10/2026 (decisão do dono), continua sendo o padrão.
const TAMANHOS_INTERFACE = { pequeno: 0.8, medio: 0.9, grande: 1 };
const TAMANHO_PADRAO = 'pequeno';

// Link de "esqueci minha senha": entra com um login temporário que NÃO pode abrir o sistema direto
// (a tela de login precisa pedir a senha nova). Guardado ao abrir, antes de o Supabase limpar o endereço.
const VEIO_DO_LINK_DE_SENHA = typeof window !== 'undefined' && /type=recovery/.test(window.location.hash || '');

// As buscas aceitam "ainda vale?" como função (desistem se a tela trocou de unidade no meio) ou true/false
const aindaVale = (ativo) => (typeof ativo === 'function' ? ativo() : ativo !== false);

// Muitos avisos seguidos do tempo real viram UMA recarga: espera 3 s sem aviso novo (no máximo 10 s desde o
// primeiro). Proteção de 29/10/2026 (correção em massa no banco entupiu o login); não tirar.
const criarAgendador = (estaAtivo) => {
    const pendentes = {};
    const agendar = (nome, recarregar) => () => {
        const p = pendentes[nome] || (pendentes[nome] = { primeiro: Date.now(), timer: null });
        clearTimeout(p.timer);
        const espera = Math.max(0, Math.min(3000, p.primeiro + 10000 - Date.now()));
        p.timer = setTimeout(() => { delete pendentes[nome]; if (estaAtivo()) recarregar(estaAtivo); }, espera);
    };
    agendar.parar = () => Object.values(pendentes).forEach(p => clearTimeout(p.timer));
    return agendar;
};

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
    const [verificandoLogin, setVerificandoLogin] = useState(!VEIO_DO_LINK_DE_SENHA); // conferindo o login guardado
    const [activeTab, setActiveTab] = useState('lancamento');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); 
    const [unidadeGlobal, setUnidadeGlobal] = useState('TODAS');
    const [isIdle, setIsIdle] = useState(false); 
    const [segundosParaPausar, setSegundosParaPausar] = useState(null); // null = sem aviso de pausa
    
    // Estados de Seleção de Aluno
    const [alunoPreSelecionado, setAlunoPreSelecionado] = useState(null);
    const [alunoGlobalPreSelecionado, setAlunoGlobalPreSelecionado] = useState(null);
    
    const [triggerSync, setTriggerSync] = useState(0);
    const [isCollapsed, setIsCollapsed] = useState(() => lerLocal('pratique_sidebar') === 'true');
    const [tamanhoTela, setTamanhoTela] = useState(() => {
        const salvo = lerLocal('pratique_tamanho');
        return TAMANHOS_INTERFACE[salvo] ? salvo : TAMANHO_PADRAO;
    });
    const [theme, setTheme] = useState(() => {
        const salvo = lerLocal('pratique_theme');
        if (salvo) return salvo;
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
        return 'light';
    });

    // Conexão (aviso no topo, AvisoConexao.jsx; 09/11/2026): sem internet pelo navegador; "ao vivo" pelo canal de dados
    const [semInternet, setSemInternet] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
    const [aoVivoOk, setAoVivoOk] = useState(true);

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
        const updateOnlineStatus = () => setSemInternet(navigator.onLine === false);
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

    // ENTRAR (pela senha ou pelo login guardado, 09/11/2026): volta para a tela e a unidade em que a pessoa
    // estava nesta aba (sessionStorage); sem lugar guardado, abre como antes (Nova Venda e "Todas").
    // Só Admin/Mentor trocam de unidade; unidade que não existe mais ou foi desativada volta para "Todas" (efeitos abaixo).
    const entrar = useCallback((perfil) => {
        const lugar = lerLugarSalvo(perfil?.email);
        const podeTrocar = perfil?.role === 'ADMIN' || perfil?.role === 'MENTOR';
        setUnidadeGlobal(podeTrocar && lugar?.unidade ? lugar.unidade : 'TODAS');
        if (lugar?.tela) setActiveTab(lugar.tela);
        setUsuarioLogado(perfil);
    }, []);

    // ACESSO PESSOAL COM GOOGLE (12/11/2026, decisão do dono; components/acesso/). Depois de qualquer login (Google,
    // senha ou login guardado) o banco diz a situação: ativo entra; sem acesso vai para a TelaAcesso (pedir acesso,
    // aguardando, rejeitado, inativo). Senha depois da virada: só Admin ou liberação de emergência de 24 h.
    // Recepção (e todos, enquanto o Google não está ligado) continua com o login lembrado no computador.
    // Sem o SQL de 12/11/2026, tudo fica como antes.
    const [acessoPendente, setAcessoPendente] = useState(null); // { email, situacao }
    const [chavesLogin, setChavesLogin] = useState(null);
    const sairComAviso = useCallback(async (mensagem) => {
        try { if (mensagem) sessionStorage.setItem('pratique_aviso_login', mensagem); } catch { /* sem armazenamento */ }
        esquecerLugar();
        esquecerRegistroDoLogin();
        try { await supabase.auth.signOut(); } catch (err) { console.error('Erro ao sair:', err); }
        recarregarNaVersaoMaisNova();
    }, []);
    const conferirEEntrar = useCallback(async (perfilDoLogin) => {
        const chaves = await carregarChavesLogin();
        setChavesLogin(chaves);
        const situacao = await situacaoDoAcesso();
        const { data } = await supabase.auth.getSession();
        const email = perfilDoLogin?.email || data?.session?.user?.email || '';
        if (!situacao) {
            // Banco ainda sem o SQL de 12/11/2026: como antes
            const perfil = perfilDoLogin?.role ? perfilDoLogin : (await buscarPerfilDoLogin(email)).perfil;
            if (perfil) entrar(perfil); else await supabase.auth.signOut();
            return;
        }
        if (situacaoDaEntrada(situacao) !== 'ativo') { setAcessoPendente({ email, situacao }); return; }
        const p = situacao.perfil;
        const { metodo } = await dadosDoLoginAtual();
        if (metodo === 'senha' && !senhaLiberada({ perfil: p, senhaParaTodos: chaves.login_senha_todos })) {
            await registrarEvento('NEGADO', 'entrada com senha depois da virada');
            await sairComAviso(tx('Entre com o Google. A entrada com senha é só para emergência: peça a liberação à diretoria.'));
            return;
        }
        definirLoginLembrado(!chaves.login_google || String(p.role).toUpperCase() === 'RECEPCAO');
        await registrarLoginUmaVez();
        entrar({ ...p, email: p.email || email, unidade: p.unidade || 'MATRIZ' });
    }, [entrar, sairComAviso]);
    const atualizarAcessoPendente = useCallback(async () => {
        const situacao = await situacaoDoAcesso();
        if (situacao && situacaoDaEntrada(situacao) === 'ativo') { setAcessoPendente(null); await conferirEEntrar(null); return; }
        setAcessoPendente(a => (a ? { ...a, situacao: situacao || a.situacao } : a));
    }, [conferirEEntrar]);

    // Ao abrir/recarregar: se o navegador ainda tem o login (só "Sair" apaga), entra direto, sem pedir a senha
    useEffect(() => {
        if (VEIO_DO_LINK_DE_SENHA) return undefined;
        let ativo = true;
        (async () => {
            try {
                const { data } = await supabase.auth.getSession();
                const email = data?.session?.user?.email;
                if (!email) return;
                if (!ativo) return;
                await conferirEEntrar({ email });
            } catch (err) {
                console.error('Não foi possível reabrir o login guardado:', err);
            } finally {
                if (ativo) setVerificandoLogin(false);
            }
        })();
        return () => { ativo = false; };
    }, [conferirEEntrar]);

    // Login encerrado em outra aba ("Sair") ou expirado: recarrega e mostra a tela de login
    useEffect(() => {
        if (!usuarioLogado) return undefined;
        const { data } = supabase.auth.onAuthStateChange((evento) => {
            if (evento === 'SIGNED_OUT') { esquecerLugar(); recarregarNaVersaoMaisNova(); }
        });
        return () => data?.subscription?.unsubscribe();
    }, [usuarioLogado]);

    // Guarda a tela e a unidade desta aba para voltar nelas depois de recarregar
    useEffect(() => {
        if (usuarioLogado?.email) salvarLugar(usuarioLogado.email, activeTab, unidadeGlobal);
    }, [usuarioLogado, activeTab, unidadeGlobal]);

    useEffect(() => {
        gravarLocal('pratique_theme', theme);
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
    
    useEffect(() => { gravarLocal('pratique_sidebar', isCollapsed); }, [isCollapsed]);
    useEffect(() => { gravarLocal('pratique_tamanho', tamanhoTela); }, [tamanhoTela]);

    // 📐 Escala da interface: deixa o sistema inteiro menor, como um "zoom" (Pequeno 0.8 · Médio 0.9 · Grande 1).
    // Só vale com alguém logado: a tela de login fica no tamanho normal e ocupa a tela inteira
    // (com a escala ligada, telas de altura "100% da tela" deixavam uma faixa branca embaixo).
    // A variável --escala-interface deixa as telas calcularem a altura da janela (ex.: lista de Alunos).
    useEffect(() => {
        const raiz = document.documentElement;
        if (!usuarioLogado) {
            raiz.style.zoom = '';
            raiz.style.setProperty('--escala-interface', '1');
            return undefined;
        }
        const escala = TAMANHOS_INTERFACE[tamanhoTela] || TAMANHOS_INTERFACE[TAMANHO_PADRAO];
        raiz.style.zoom = String(escala);
        raiz.style.setProperty('--escala-interface', String(escala));
        return () => { raiz.style.zoom = ''; raiz.style.setProperty('--escala-interface', '1'); };
    }, [usuarioLogado, tamanhoTela]);

    // Inatividade (decisão do dono, 07/11/2026): 30 min sem uso = PAUSA de verdade (desliga o "ao vivo" e as
    // releituras do banco). No último minuto aparece o cartão com contagem regressiva; mexer cancela.
    // Conta pelo relógio (e confere ao voltar para a aba), porque aba minimizada atrasa os temporizadores.
    // Só conta com alguém logado: a tela de login esquecida aberta não pausa o sistema de quem entrar depois.
    // Login com Google ligado (12/11/2026, decisão do dono): Líder, Mentor e Admin SAEM do sistema depois de 15 min
    // parados (aviso 1 min antes) e marcam "estou ativo" no banco no máximo a cada 5 min. A Recepção continua com a
    // cortina de 30 min.
    const temLogin = Boolean(usuarioLogado);
    const sessaoCurta = Boolean(chavesLogin?.login_google) && temLogin && String(usuarioLogado?.role || '').toUpperCase() !== 'RECEPCAO';
    useEffect(() => {
        if (isIdle || !temLogin) return undefined;
        const LIMITE = (sessaoCurta ? MINUTOS_SESSAO : MINUTOS_PARA_PAUSAR) * 60 * 1000;
        const AVISO = SEGUNDOS_DE_AVISO * 1000;
        let ultimaAtividade = Date.now();
        let saindo = false;
        const conferir = () => {
            const parado = Date.now() - ultimaAtividade;
            if (parado >= LIMITE) {
                if (sessaoCurta) {
                    if (saindo) return;
                    saindo = true;
                    setSegundosParaPausar(null);
                    registrarEvento('EXPIROU', `${MINUTOS_SESSAO} min sem uso`).finally(() => sairComAviso(tx('Sua sessão expirou depois de {min} minutos sem uso. Entre de novo.', { min: MINUTOS_SESSAO })));
                    return;
                }
                pausarSistema();
                setSegundosParaPausar(null);
                setIsIdle(true);
                return;
            }
            const falta = LIMITE - parado;
            setSegundosParaPausar(falta <= AVISO ? Math.ceil(falta / 1000) : null);
        };
        const marcarAtividade = () => {
            if (document.hidden) return;
            // Voltou depois do limite (ex.: aba minimizada): pausa em vez de contar como uso
            if (Date.now() - ultimaAtividade >= LIMITE) { conferir(); return; }
            ultimaAtividade = Date.now();
            setSegundosParaPausar(null);
            if (sessaoCurta) baterAtividade(MINUTOS_ENTRE_BATIDAS);
        };
        const eventos = ['mousemove', 'mousedown', 'keydown', 'scroll', 'wheel', 'touchstart', 'click'];
        eventos.forEach(evento => window.addEventListener(evento, marcarAtividade, { passive: true }));
        document.addEventListener('visibilitychange', conferir);
        const relogio = setInterval(conferir, 1000);
        return () => {
            clearInterval(relogio);
            document.removeEventListener('visibilitychange', conferir);
            eventos.forEach(evento => window.removeEventListener(evento, marcarAtividade));
        };
    }, [isIdle, temLogin, sessaoCurta, sairComAviso]);

    // Comunicados (revisado em 09/11/2026 para gastar menos banco): usa o e-mail do login que já está na memória
    // (antes perguntava ao servidor de login a cada aviso), escuta só a caixa de entrada desta pessoa, junta os
    // avisos seguidos numa leitura só (1 s) e mantém um único "despertador" para o próximo comunicado agendado.
    const emailLogado = usuarioLogado?.email || '';
    useEffect(() => {
        if (!usuarioLogado) return;
        let isMounted = true;
        let timerAgenda = null;
        let timerAviso = null;

        const syncComunicados = async () => {
            if (sistemaPausado()) return; // pausado por inatividade: não vai ao banco
            try {
                let email = emailLogado;
                if (!email) {
                    const { data: sessao } = await supabase.auth.getSession();
                    email = sessao?.session?.user?.email || '';
                }
                if (!email || !isMounted) return;

                const { data, error } = await supabase
                    .from('comunicado_inbox')
                    .select(`
                        id, status_leitura,
                        comunicados!inner (*)
                    `)
                    .eq('email_usuario', email)
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

                clearTimeout(timerAgenda); // um despertador só (antes cada leitura criava mais um)
                timerAgenda = null;
                if (proximoAgendamento) {
                    const delay = proximoAgendamento.getTime() - Date.now() + 1000;
                    if (delay > 0 && delay < 2147483647) timerAgenda = setTimeout(syncComunicados, delay);
                }
            } catch (err) { console.error("Erro sync comunicados:", err); }
        };

        const aoAviso = () => { clearTimeout(timerAviso); timerAviso = setTimeout(syncComunicados, 1000); };
        syncComunicados();
        const filtroInbox = emailLogado ? { filter: `email_usuario=eq.${emailLogado}` } : {};
        const channel = supabase.channel('central-sync-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'comunicado_inbox', ...filtroInbox }, aoAviso)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'comunicados' }, aoAviso)
            .subscribe();

        return () => {
            isMounted = false;
            clearTimeout(timerAgenda);
            clearTimeout(timerAviso);
            supabase.removeChannel(channel);
        };
    }, [usuarioLogado, emailLogado, triggerSync]);

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

            if (aindaVale(isMounted) && dataResult.length > 0) {
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

    const fetchUnidades = useCallback(async (isMounted = true) => { const { data } = await supabase.from('unidades').select('*').order('nome', { ascending: true }); if (aindaVale(isMounted) && data) setUnidades(data); }, []);
    const fetchColaboradores = useCallback(async (isMounted = true) => { let query = supabase.from('colaboradores').select('*'); if (deveFiltrar) query = query.eq('unidade', unidadeFiltro); const { data } = await query; if (aindaVale(isMounted) && data) setColaboradores(data); }, [deveFiltrar, unidadeFiltro]);
    const fetchCatalogo = useCallback(async (isMounted = true) => { const { data } = await supabase.from('catalogo').select('*'); if (aindaVale(isMounted) && data) { setPlanos(data.filter(item => item.tipo === 'plano')); setProdutos(data.filter(item => item.tipo === 'produto')); setServicos(data.filter(item => item.tipo === 'servico')); } }, []);
    
    const getDataCorte = () => {
        const d = new Date();
        d.setDate(d.getDate() - 90); 
        return d.toISOString();
    };

    // Vendas dos últimos 90 dias SEM corte de quantidade: busca de 1.000 em 1.000 até acabar
    // (antes parava em 3.000 e a visão "TODAS" escondia as vendas mais antigas desse período).
    // Se alguma parte falhar, não troca a lista (mantém a que já estava na tela).
    const fetchVendas = useCallback(async (isMounted = true) => { 
        const corte = getDataCorte();
        const TAMANHO_PAGINA = 1000;
        let data = [];
        for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
            let query = supabase.from('vendas').select('*')
                .gte('created_at', corte)
                .order('id', { ascending: false })
                .range(inicio, inicio + TAMANHO_PAGINA - 1);
            if (deveFiltrar) query = query.eq('unidade', unidadeFiltro);
            const { data: pagina, error } = await query;
            if (!aindaVale(isMounted)) return; // trocou de unidade no meio: não continua baixando
            if (error) { console.error('Erro ao carregar vendas:', error); data = null; break; }
            data = data.concat(pagina || []);
            if (!pagina || pagina.length < TAMANHO_PAGINA) break;
        }
        if (aindaVale(isMounted) && data) {
            setDadosAssinaturas(data);
            fetchAlunosEspecificos(data, isMounted);
        }
    }, [deveFiltrar, unidadeFiltro, fetchAlunosEspecificos]);

    // Contatos: desde 09/11/2026 o App baixa só os que NÃO são de lista (visitantes e afins), que é o que as telas
    // fora do CRM usam (o Dashboard já descartava os de lista). Antes baixava até 3.000 contatos de qualquer tipo
    // para todo mundo; a rede tinha 26.890 em 90 dias, quase todos de lista. O CRM carrega a lista completa dele.
    const fetchLeads = useCallback(async (isMounted = true) => {
        let query = supabase.from('leads').select('*')
            .or(`origem.is.null,origem.not.in.(${ORIGENS_DE_LISTA.join(',')})`)
            .gte('created_at', getDataCorte())
            .order('id', { ascending: false })
            .limit(3000); 
        if (deveFiltrar) query = query.eq('unidade', unidadeFiltro); 
        const { data } = await query; 
        if (aindaVale(isMounted) && data) setDadosVisitantes(data); 
    }, [deveFiltrar, unidadeFiltro]);
    
    const fetchAvaliacoes = useCallback(async (isMounted = true) => { 
        let query = supabase.from('avaliacoes_realizadas').select('*')
            .gte('created_at', getDataCorte())
            .order('id', { ascending: false })
            .limit(3000); 
        if (deveFiltrar) query = query.eq('unidade', unidadeFiltro); 
        const { data } = await query; 
        if (aindaVale(isMounted) && data) {
            setDadosAvaliacoes(data);
            fetchAlunosEspecificos(data, isMounted);
        }
    }, [deveFiltrar, unidadeFiltro, fetchAlunosEspecificos]);

    // Unidades e catálogo não dependem da unidade do topo: carregam ao entrar e só recarregam quando mudam no banco
    // (antes recarregavam a cada troca de unidade; separado em 09/11/2026).
    useEffect(() => {
        if (!usuarioLogado) return undefined;
        let ativo = true;
        const estaAtivo = () => ativo;
        fetchUnidades(estaAtivo); fetchCatalogo(estaAtivo);
        const agendar = criarAgendador(estaAtivo);
        const canal = supabase.channel('sistema-pratique-cadastros')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'catalogo' }, agendar('catalogo', fetchCatalogo))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'unidades' }, agendar('unidades', fetchUnidades))
            .subscribe();
        return () => { ativo = false; agendar.parar(); supabase.removeChannel(canal); };
    }, [usuarioLogado, fetchUnidades, fetchCatalogo]);

    // Dados que dependem da unidade do topo (equipe, vendas, contatos, avaliações): recarregam ao trocar de unidade.
    // Busca que ainda estava a caminho da unidade anterior é descartada (estaAtivo), para não trocar a lista errada.
    useEffect(() => {
        if (!usuarioLogado) return;
        let isMounted = true;
        const estaAtivo = () => isMounted;
        fetchColaboradores(estaAtivo); fetchVendas(estaAtivo); fetchLeads(estaAtivo); fetchAvaliacoes(estaAtivo);

        // Muitos avisos seguidos (ex.: correção de milhares de vendas no banco) viram UMA recarga só:
        // espera 3 s sem aviso novo (no máximo 10 s desde o primeiro) e recarrega uma vez.
        // Sem isso, cada tela aberta recarregava tudo a cada aviso e entupia o banco (29/10/2026).
        const agendar = criarAgendador(estaAtivo);

        // ECONOMIA DE BANCO (decisão do dono, 09/11/2026): vendas, contatos do CRM e avaliações NÃO baixam mais a
        // lista inteira (90 dias) a cada mudança. O aviso do tempo real já traz a linha que mudou: ela é encaixada
        // na lista (entra, troca ou sai). Avisos de 300 ms são aplicados de uma vez. Segurança: muitos avisos
        // seguidos (correção em massa), aviso sem a linha ou reconexão depois de queda = recarga inteira, como antes.
        const corteMs = Date.parse(getDataCorte());
        const dentroDoFiltro = (linha) => {
            if (!linha) return false;
            if (deveFiltrar && linha.unidade !== unidadeFiltro) return false;
            const criada = Date.parse(linha.created_at || '');
            return !Number.isFinite(criada) || criada >= corteMs;
        };
        const LIMITE_AVISOS_SEGUIDOS = 100;
        const filas = {};
        // filtroExtra: quais linhas esta lista guarda (contatos: só os que não são de lista)
        // aoLote: recebe TODOS os avisos do lote, antes do filtro (contatos: repassa ao CRM)
        const encaixar = (nome, setLista, recarregar, aoEntrar, filtroExtra, aoLote) => (aviso) => {
            const f = filas[nome] || (filas[nome] = { eventos: [], timer: null, cheia: false });
            if (f.cheia) return; // já vai recarregar tudo
            const semLinha = aviso?.errors || (aviso?.eventType !== 'DELETE' && !aviso?.new?.id) || (aviso?.eventType === 'DELETE' && !aviso?.old?.id);
            f.eventos.push(aviso);
            if (semLinha || f.eventos.length > LIMITE_AVISOS_SEGUIDOS) {
                f.cheia = true; clearTimeout(f.timer); delete filas[nome];
                agendar(nome, recarregar)();
                return;
            }
            clearTimeout(f.timer);
            f.timer = setTimeout(() => {
                delete filas[nome];
                if (!isMounted) return;
                // Linhas que entram/mudam (calculadas fora da atualização da lista, para nunca chegarem vazias)
                const guarda = (linha) => dentroDoFiltro(linha) && (!filtroExtra || filtroExtra(linha));
                const entraram = f.eventos.filter(ev => ev.eventType !== 'DELETE' && guarda(ev.new)).map(ev => ev.new);
                setLista(lista => {
                    const porId = new Map(lista.map(l => [l.id, l]));
                    f.eventos.forEach(ev => {
                        if (ev.eventType === 'DELETE') { porId.delete(ev.old.id); return; }
                        const linha = ev.new;
                        if (guarda(linha)) porId.set(linha.id, { ...(porId.get(linha.id) || {}), ...linha });
                        else porId.delete(linha.id);
                    });
                    return [...porId.values()].sort((a, b) => (b.id > a.id ? 1 : b.id < a.id ? -1 : 0));
                });
                if (aoEntrar && entraram.length) aoEntrar(entraram, estaAtivo); // completa o CPF de venda antiga sem CPF
                if (aoLote) aoLote(f.eventos);
            }, 300);
        };
        let jaConectou = false;
        // Contatos: recarregar tudo = a lista do App e a do CRM (aoVivoContatos.js)
        const recarregarLeads = (ativo) => { fetchLeads(ativo); pedirRecargaContatos(); };

        const realtimeChannel = supabase.channel('sistema-pratique-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vendas' }, encaixar('vendas', setDadosAssinaturas, fetchVendas, fetchAlunosEspecificos))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, encaixar('leads', setDadosVisitantes, recarregarLeads, null, (l) => !ehContatoDeLista(l), avisarContatos))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'avaliacoes_realizadas' }, encaixar('avaliacoes', setDadosAvaliacoes, fetchAvaliacoes, fetchAlunosEspecificos))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'colaboradores' }, agendar('colaboradores', fetchColaboradores))
            .subscribe((status) => {
                // Aviso de conexão: o "ao vivo" caiu (o Supabase tenta voltar sozinho). CLOSED não conta: é a própria
                // tela fechando o canal (troca de unidade, pausa).
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { setAoVivoOk(false); return; }
                if (status !== 'SUBSCRIBED') return;
                setAoVivoOk(true);
                // Reconectou depois de uma queda: pode ter perdido avisos, então recarrega uma vez
                if (jaConectou) { agendar('vendas', fetchVendas)(); agendar('leads', recarregarLeads)(); agendar('avaliacoes', fetchAvaliacoes)(); }
                jaConectou = true;
            });

        return () => {
            isMounted = false;
            agendar.parar();
            Object.values(filas).forEach(f => clearTimeout(f.timer));
            supabase.removeChannel(realtimeChannel);
        };
    }, [usuarioLogado, fetchColaboradores, fetchVendas, fetchLeads, fetchAvaliacoes, fetchAlunosEspecificos, deveFiltrar, unidadeFiltro]);

    // Recarregar tudo (usado quando o Admin muda as unidades do Mentor). Guardado numa referência para a escuta
    // do Mentor não reiniciar a cada troca de unidade (antes reiniciava e piscava "Carregando suas unidades...").
    const recarregarTudoRef = useRef(null);
    useEffect(() => {
        recarregarTudoRef.current = () => { fetchUnidades(); fetchVendas(); fetchLeads(); fetchAvaliacoes(); fetchColaboradores(); };
    });

    // ==========================================
    // MENTOR ↔ UNIDADES: o Mentor só vê as unidades que o Admin marcou para ele (Configurações → Acessos).
    // Sem nenhuma marcada, não vê nada. Quem garante é o banco (seg_minhas_unidades); aqui a tela acompanha:
    // carrega a lista uma vez e recarrega sozinha quando o Admin muda (tempo real, juntando os avisos).
    // ==========================================
    const ehMentor = usuarioLogado?.role === 'MENTOR';
    const [unidadesMentor, setUnidadesMentor] = useState(null); // null = carregando (ou não é Mentor)

    useEffect(() => {
        if (!ehMentor) return;
        let ativo = true;
        let timer = null;
        const carregar = async () => {
            const { data, error } = await supabase.from('mentor_unidades').select('unidade');
            if (!ativo) return;
            if (error) {
                console.error('Não foi possível carregar as unidades do Mentor:', error);
                setUnidadesMentor([]);
                return;
            }
            setUnidadesMentor([...new Set((data || []).map(l => normalizarNomeBusca(l.unidade)))]);
        };
        carregar();

        const canal = supabase.channel('mentor-unidades')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'mentor_unidades' }, () => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    if (!ativo) return;
                    carregar();
                    recarregarTudoRef.current?.();
                }, 1500);
            })
            .subscribe();

        return () => { ativo = false; clearTimeout(timer); supabase.removeChannel(canal); setUnidadesMentor(null); };
    }, [ehMentor]);

    // Lista de unidades que as telas mostram (seletor, filtros, cadastros): para o Mentor, só as dele.
    // Unidade DESATIVADA (Configurações, 04/11/2026) não aparece; os dados dela continuam no banco.
    const unidadesVisiveis = useMemo(() => {
        const ativas = unidades.filter(u => u.ativa !== false);
        if (!ehMentor) return ativas;
        const minhas = new Set(unidadesMentor || []);
        return ativas.filter(u => minhas.has(normalizarNomeBusca(u.nome)));
    }, [ehMentor, unidades, unidadesMentor]);

    // Central de cobranças (decisão do dono, 05/11/2026): Líder = a unidade dele; Mentor = as dele; Admin = todas.
    // Um carregamento só, usado pela janela do login, pelo cartão do canto e pela aba Pendências (com o número vermelho).
    const papelCobranca = usuarioLogado?.role;
    const unidadesCobradas = useMemo(() => {
        if (papelCobranca === 'LIDER') return usuarioLogado?.unidade ? [usuarioLogado.unidade] : [];
        if (papelCobranca === 'MENTOR' || papelCobranca === 'ADMIN') return unidadesVisiveis.map(u => u.nome).filter(Boolean);
        return [];
    }, [papelCobranca, usuarioLogado?.unidade, unidadesVisiveis]);
    const pendencias = usePendencias({ ativo: ['LIDER', 'MENTOR', 'ADMIN'].includes(papelCobranca), unidades: unidadesCobradas, colaboradores });
    // Acessos (12/11/2026): pedidos, trocas de líder, sem acesso há 7+ dias... para Admin e Mentor (aba Pendências
    // → Acessos e janela ao entrar). "Meus acessos" para todos. Confirmação dos dados para Líder/Mentor/Admin.
    const acessos = useAcessos({ ativo: papelCobranca === 'ADMIN' || papelCobranca === 'MENTOR', unidades: unidadesVisiveis });
    const [janelaAcessosFechada, setJanelaAcessosFechada] = useState(false);
    useEffect(() => { setJanelaAcessosFechada(false); }, [usuarioLogado?.email]);
    const [meusAcessosAberto, setMeusAcessosAberto] = useState(false);
    useEffect(() => {
        const abrir = () => setMeusAcessosAberto(true);
        window.addEventListener('abrir-meus-acessos', abrir);
        return () => window.removeEventListener('abrir-meus-acessos', abrir);
    }, []);
    const confirmarDadosAgora = precisaConfirmarDados(usuarioLogado);
    const aoConfirmarDados = useCallback(({ nome, telefone }) => {
        setUsuarioLogado(u => (u ? { ...u, nome, telefone, dados_confirmados_em: new Date().toISOString() } : u));
    }, []);
    // Permissões (Configurações → Permissões, 06/11/2026): pode('004') etc.; sem mudança do Admin vale o padrão de antes
    const pode = usePermissoes(usuarioLogado);
    // O usuário de verdade (sem a troca de unidade do topo), já com as permissões, para as telas que usam o login real
    const usuarioComPode = useMemo(() => (usuarioLogado ? { ...usuarioLogado, pode } : usuarioLogado), [usuarioLogado, pode]);
    // Janela e cartão de cobranças: permissão 902 (padrão: Líder e Mentor; o Admin acompanha pela aba Pendências)
    const cobradoNaTela = (papelCobranca === 'LIDER' || papelCobranca === 'MENTOR') && pode('902');
    const [janelaPendenciasFechada, setJanelaPendenciasFechada] = useState(false);
    const aoFecharJanelaPendencias = useCallback(() => setJanelaPendenciasFechada(true), []);
    useEffect(() => { setJanelaPendenciasFechada(false); }, [usuarioLogado?.email]);
    // Cadastro da equipe incompleto (decisão do dono, 11/11/2026): PIX → Banco Inter, CPF, telefone, setor.
    // Líder (a unidade dele) e Mentor (as dele), permissão 910. Janela TODA VEZ que entra; cartão no canto até resolver.
    const avisoEquipeAtivo = (papelCobranca === 'LIDER' || papelCobranca === 'MENTOR') && pode('910');
    const cadastroEquipe = useCadastroEquipe({ ativo: avisoEquipeAtivo, unidades: unidadesCobradas, colaboradoresApp: colaboradores, setColaboradoresApp: setColaboradores });
    const [janelaEquipeAberta, setJanelaEquipeAberta] = useState(true);
    useEffect(() => { setJanelaEquipeAberta(true); }, [usuarioLogado?.email]);
    const fecharJanelaEquipe = useCallback(() => setJanelaEquipeAberta(false), []);
    const abrirEquipeComFiltro = () => {
        setJanelaEquipeAberta(false);
        pedirFiltroEquipe('incompleto');
        pedirSubaba('cadastros', 'equipe');
        handleNavigation('cadastros');
    };
    // Botões das pendências: Mentor/Admin passam a olhar a unidade da pendência (seletor do topo) e a tela certa abre
    // Panorama da unidade (Cadastros → Unidades → Central): "Abrir a tela completa" troca o topo para a unidade e abre a tela
    const abrirTelaDaUnidade = (unidade, tela, opcoes = {}) => {
        if (ehChefe && unidade) setUnidadeGlobal(unidade);
        if (opcoes.aba) pedirAbaAnalise(opcoes.aba);
        handleNavigation(tela);
    };
    const irParaPendencia = (tipo, u) => {
        if (ehChefe && u?.unidade) setUnidadeGlobal(u.unidade);
        if (tipo === 'conferencia') {
            if (u?.conferencia?.periodo) pedirConferencia(u.conferencia.periodo);
            handleNavigation('fechamento');
        } else {
            pedirAbaAnalise('visaoGeral'); // aba Metas, card Movimentação (os cards das metas ficam na mesma linha)
            handleNavigation('analise');
        }
    };

    // Se a unidade escolhida no topo foi desativada (ou não existe mais, ex.: lembrada de antes de recarregar),
    // volta para a visão de todas
    useEffect(() => {
        if (unidadeGlobal === 'TODAS' || unidades.length === 0) return;
        const escolhida = unidades.find(u => normalizarNomeBusca(u.nome) === normalizarNomeBusca(unidadeGlobal));
        if (!escolhida || escolhida.ativa === false) setUnidadeGlobal('TODAS');
    }, [unidades, unidadeGlobal]);

    // Se o Admin tirou a unidade que o Mentor estava vendo, volta para "Todas as minhas unidades"
    useEffect(() => {
        if (!ehMentor || !unidadesMentor || unidadeGlobal === 'TODAS') return;
        if (!unidadesMentor.includes(normalizarNomeBusca(unidadeGlobal))) setUnidadeGlobal('TODAS');
    }, [ehMentor, unidadesMentor, unidadeGlobal]); 

    const vendasEnriquecidas = useMemo(() => {
        return dadosAssinaturas.map(v => {
            if (v.cpf) return v; // já tem CPF: usa a mesma linha (não copia milhares de vendas a cada mudança)
            let cpfAchado = v.cpf_aluno || '';
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
            if (a.cpf) return a; // já tem CPF: usa a mesma linha
            let cpfAchado = a.cpf_aluno || '';
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

    // Venda nova da própria tela: entra na lista sem repetir a que já chegou pelo tempo real (mesmo número)
    const handleAddLancamentos = (novos) => setDadosAssinaturas(lista => {
        const ids = new Set((novos || []).map(n => n.id));
        return [...(novos || []), ...lista.filter(v => !ids.has(v.id))];
    });
    // SAIR (09/11/2026): encerra o login e RECARREGA a página. Assim nada do login anterior fica na memória
    // (antes, quem entrava em seguida no mesmo computador via por um instante os dados de quem saiu) e o
    // sistema já abre na versão mais nova. Esquece a tela/unidade guardadas desta aba.
    const handleLogout = async () => {
        esquecerLugar();
        setIsMobileMenuOpen(false);
        await registrarEvento('LOGOUT'); // histórico de acessos (12/11/2026); sem o SQL só avisa no console
        esquecerRegistroDoLogin();
        try { await supabase.auth.signOut(); } catch (err) { console.error('Erro ao sair:', err); }
        recarregarNaVersaoMaisNova();
    };

    // 🔥 CORREÇÃO DA VISÃO GLOBAL APLICADA AQUI
    // Guardado (useMemo): o mesmo usuário enquanto nada muda de verdade. Antes era recriado a cada atualização
    // (cada venda que chegava, cada segundo da contagem da pausa) e as telas que dependem do usuário iam ao banco à toa.
    const usuarioVirtual = useMemo(() => (usuarioLogado ? {
        ...usuarioLogado,
        role: (ehChefe && unidadeGlobal !== 'TODAS') ? 'LIDER' : usuarioLogado.role,
        roleReal: usuarioLogado.role, // papel verdadeiro (o "role" acima vira LIDER quando ADMIN/MENTOR escolhe uma unidade)
        unidade: ehChefe ? unidadeGlobal : usuarioLogado.unidade,
        pode, // permissões (catalogoPermissoes.js): as telas usam podeVer(usuario, 'codigo')
    } : null), [usuarioLogado, ehChefe, unidadeGlobal, pode]);

    if (!usuarioLogado) {
        if (verificandoLogin) {
            return (
                <div className="fixed inset-0 flex items-center justify-center bg-slate-50 dark:bg-[#0a0f1c]">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">{tx('Abrindo o sistema...')}</p>
                </div>
            );
        }
        // Entrou com o Google mas ainda não tem acesso ativo: pedir acesso / aguardando / rejeitado / inativo
        if (acessoPendente) {
            return <TelaAcesso email={acessoPendente.email} situacao={acessoPendente.situacao} onAtualizar={atualizarAcessoPendente}
                onSair={() => { setAcessoPendente(null); sairComAviso(null); }} />;
        }
        return <Login onLogin={conferirEEntrar} />;
    }

    // Cada item do menu tem o número da permissão (Configurações → Permissões; padrão = como era antes)
    const todasAbas = [
        { id: 'lancamento', label: t('navigation.newSale'), icon: ShoppingCart, codigo: '001' },
        { id: 'assinaturas', label: t('navigation.history'), icon: History, codigo: '002' },
        { id: 'analise', label: t('navigation.dashboard'), icon: PieChart, codigo: '003' },
        { id: 'fechamento', label: t('navigation.closing'), icon: Wallet, codigo: '004' },
        { id: 'crm', label: t('navigation.crm'), icon: Users, codigo: '005' },
        { id: 'alunos', label: t('navigation.students', { defaultValue: 'Alunos' }), icon: GraduationCap, codigo: '006' },
        { id: 'avaliacao', label: t('navigation.assessment'), icon: Dumbbell, codigo: '007' },
        { id: 'cadastros', label: t('navigation.management'), icon: Database, codigo: '008' },
        { id: 'comunicados', label: t('navigation.communications', { defaultValue: 'Comunicados' }), icon: Megaphone, codigo: '009', badge: comunicadosGlobais.pendentesTotais > 0 ? comunicadosGlobais.pendentesTotais : null },
        { id: 'pendencias', label: tx('Pendências'), icon: BellRing, codigo: '010', badge: pendencias.totalDia > 0 ? pendencias.totalDia : null }, // movimentação só do dia atual (09/11/2026)
        // Acessos (12/11/2026, decisão do dono: aba própria no menu): número vermelho = pedidos esperando
        { id: 'acessos', label: tx('Acessos'), icon: KeyRound, codigo: '013', badge: acessos.contas?.pedidos.length ? acessos.contas.pedidos.length : null },
        { id: 'config', label: t('navigation.settings'), icon: Settings, codigo: '011' }
    ];

    // Subabas no menu lateral (09/11/2026, decisão do dono): Dashboard e Cadastros, com as mesmas regras das telas
    // (permissão de cada aba; Ranking global só na visão de várias unidades; Unidades só o Admin de verdade)
    const visaoDaRede = usuarioVirtual?.role === 'ADMIN' || usuarioVirtual?.role === 'MENTOR';
    const SUBABAS = {
        analise: [
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'visaoGeral', label: 'Metas da unidade', codigo: '302' },
            { id: 'relatorio', label: 'Relatórios', codigo: '303' },
            { id: 'rankingGlobal', label: 'Ranking global', codigo: '304', soRede: true },
            { id: 'saude', label: 'Saúde da unidade', codigo: '305' },
        ],
        // Subabas de 10/11/2026 (decisão do dono): Histórico, Fechamento, CRM e Avaliação
        assinaturas: [
            { id: 'registros', label: 'Registros' },
            { id: 'duplicidades', label: 'Duplicidades', codigo: '202' },
            { id: 'lixeira', label: 'Lixeira', codigo: '203' },
        ],
        fechamento: [
            { id: 'conferencia', label: 'Conferência' },
            { id: 'comissoes', label: 'Comissões', codigo: '402' },
            { id: 'geral', label: 'Visão Geral', codigo: '403' },
            { id: 'auditoria', label: 'Auditoria', codigo: '404' },
        ],
        crm: [
            { id: 'equipe', label: 'Equipe' },
            { id: 'painel', label: 'Painel', codigo: '502' },
            { id: 'contatos', label: 'Contatos', codigo: '504' },
        ],
        avaliacao: [
            { id: 'avaliadores', label: 'Avaliadores' },
            { id: 'unidade', label: 'Dashboard da Unidade', codigo: '703' },
            { id: 'global', label: 'Dashboard Global', codigo: '702', soRede: true },
            { id: 'lixeira', label: 'Lixeira', codigo: '707' },
        ],
        cadastros: [
            { id: 'alunos', label: 'Alunos', codigo: '801' },
            { id: 'equipe', label: 'Equipe', codigo: '802' },
            { id: 'catalogo', label: 'Catálogo Geral', codigo: '803' },
            { id: 'setores', label: 'Setores', codigo: '804' },
            { id: 'unidades', label: 'Unidades', codigo: '808', soAdmin: true },
        ],
    };
    const subabasDe = (tela) => (SUBABAS[tela] || []).filter(s => (!s.codigo || pode(s.codigo)) && (!s.soRede || visaoDaRede) && (!s.soAdmin || usuarioLogado?.role === 'ADMIN'));
    const abrirSubaba = (tela, aba) => {
        if (tela === 'analise') pedirAbaAnalise(aba, { rolar: false });
        else pedirSubaba(tela, aba);
        handleNavigation(tela);
    };
    const abasPermitidas = todasAbas.filter(aba => pode(aba.codigo)).map(aba => (SUBABAS[aba.id] ? { ...aba, subabas: subabasDe(aba.id) } : aba));
    // A tela aberta foi desligada para este login (ex.: o Admin mudou agora): mostra a primeira permitida
    const telaAtual = abasPermitidas.some(a => a.id === activeTab) ? activeTab : (abasPermitidas[0]?.id || null);

    // Mentor: "Todas as minhas unidades" no seletor; sem unidade marcada, as telas ficam bloqueadas
    const rotuloTodas = ehMentor ? 'Todas as minhas unidades' : undefined;
    const mentorCarregando = ehMentor && unidadesMentor === null;
    const mentorSemUnidade = ehMentor && Array.isArray(unidadesMentor) && unidadesMentor.length === 0;

    return (
        <div className="fixed inset-0 flex bg-slate-50 dark:bg-[#0a0f1c] overflow-hidden font-sans text-slate-800 dark:text-slate-200 transition-colors duration-500">
            
            <IdleCurtain isIdle={isIdle} segundosParaPausar={segundosParaPausar} modoSair={sessaoCurta} />
            <AvisoConexao semInternet={semInternet} aoVivoOk={aoVivoOk} pausado={isIdle} />

            {/* Acesso pessoal (12/11/2026): confirmar os dados (Líder/Mentor/Admin; obrigatória), pedidos de acesso para
                quem aprova (Admin/Mentor, uma vez por entrada) e "Meus acessos" (botão no menu, ao lado de Sair) */}
            {confirmarDadosAgora && <JanelaConfirmarDados perfil={usuarioLogado} onConfirmado={aoConfirmarDados} />}
            {!confirmarDadosAgora && !janelaAcessosFechada && (
                <JanelaPedidosAcesso contas={acessos.contas} ehAdmin={papelCobranca === 'ADMIN'} unidades={unidadesVisiveis.map(u => u.nome)}
                    onDecidido={acessos.recarregar} onFechar={() => setJanelaAcessosFechada(true)}
                    onVerPendencias={() => { setJanelaAcessosFechada(true); handleNavigation('acessos'); }} />
            )}
            {meusAcessosAberto && <MeusAcessos onFechar={() => setMeusAcessosAberto(false)} />}

            {/* Central de cobranças (decisão do dono, 05/11/2026): Líder e Mentor ganham a janela ao entrar e o cartão
                do canto (Conferência, Movimentação e Metas). O Admin cobra pela aba Pendências. */}
            {cobradoNaTela && (
                <>
                    <JanelaPendencias lista={pendencias.lista} carregado={pendencias.carregado && unidadesCobradas.length > 0} ehMentor={ehMentor} podeConferirRelatorio={pode('313')}
                        aoIr={irParaPendencia} aoVerTodas={() => handleNavigation('pendencias')} onFechar={aoFecharJanelaPendencias} />
                </>
            )}

            {/* Cadastro da equipe incompleto (11/11/2026): janela ao entrar (fica por baixo da janela do turno) */}
            {avisoEquipeAtivo && janelaEquipeAberta && (
                <JanelaCadastroEquipe itens={cadastroEquipe.itens} setores={cadastroEquipe.setores} ehMentor={ehMentor} unidadeTitulo={usuarioLogado?.unidade}
                    podeEditar={pode('807')} salvar={cadastroEquipe.salvar} onFechar={fecharJanelaEquipe} aoAbrirEquipe={abrirEquipeComFiltro} />
            )}

            {/* Cartões do canto direito (lado oposto ao menu), um em cima do outro: cobranças e cadastro da equipe */}
            <div className="fixed bottom-4 right-4 z-[70] w-[min(360px,calc(100%-32px))] flex flex-col gap-3 pointer-events-none">
                {cobradoNaTela && (
                    <CartaoPendencias lista={pendencias.lista} ehMentor={ehMentor} escondido={!janelaPendenciasFechada} podeConferirRelatorio={pode('313')}
                        aoIr={irParaPendencia} aoVerTodas={() => handleNavigation('pendencias')} />
                )}
                {avisoEquipeAtivo && !janelaEquipeAberta && (
                    <CartaoCadastroEquipe itens={cadastroEquipe.itens} ehMentor={ehMentor} aoAbrir={() => setJanelaEquipeAberta(true)} />
                )}
            </div>

            {/* Recepção: cobrança do relatório de fechamento do turno (14h30 manhã, 22h30 noite, 12h30 sáb/dom/feriado; horários de 06/11/2026) */}
            {/* Líder: marcar o turno das recepcionistas da unidade (enquanto faltar alguém; 05/11/2026) */}
            <PopupTurnoRecepcao key={usuarioLogado?.email || "sem-login"} usuario={usuarioComPode} colaboradores={colaboradores} setColaboradores={setColaboradores} />

            {/* Líder/Mentor/Admin: "Conferiu no grupo?" do relatório de fechamento (permissão 313; 06/11/2026) */}
            <JanelaConferirRelatorio usuario={usuarioComPode} />
            {/* Central da Unidade aberta pelo botão "Central" do Dashboard, Metas, Relatórios e Ranking (09/11/2026):
                Admin todas as unidades; Mentor as dele; Líder a própria (permissão 314) */}
            <CentralUnidadeGlobal usuario={usuarioComPode} unidades={unidades} setUnidades={setUnidades}
                unidadesPermitidas={usuarioLogado?.role === 'ADMIN' ? null : usuarioLogado?.role === 'MENTOR' ? unidadesVisiveis.map(u => u.nome) : (usuarioLogado?.unidade ? [usuarioLogado.unidade] : [])}
                planos={planos} produtos={produtos} pendencias={pendencias.lista} pendenciasCarregadas={pendencias.carregado} abrirTela={abrirTelaDaUnidade} />
            {/* Central do Colaborador (11/11/2026): clicar no nome na Equipe ou nas Comissões. Admin todas; Mentor as dele;
                Líder a própria; Recepção não abre (permissão 809) */}
            <CentralColaboradorGlobal usuario={usuarioComPode}
                unidadesPermitidas={usuarioLogado?.role === 'ADMIN' ? null : usuarioLogado?.role === 'MENTOR' ? unidadesVisiveis.map(u => u.nome) : (usuarioLogado?.unidade ? [usuarioLogado.unidade] : [])}
                planos={planos} produtos={produtos} />

            <CobrancaRelatorioRecepcao usuario={usuarioComPode} colaboradores={colaboradores}
                aoIrRelatorio={() => { pedirAbaAnalise('relatorio'); handleNavigation('analise'); }} />

            {/* Recepção: lembrete para fazer o CRM (seg-sex 8h, 10h, 12h, 14h30, 15h30, 17h30, 19h30; sáb/dom/feriado 9h e 11h; permissão 909; 06/11/2026) */}
            <LembreteCrm usuario={usuarioComPode} aoIrCrm={() => handleNavigation('crm')} />

            <SidebarDesktop 
                isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} 
                abasPermitidas={abasPermitidas} activeTab={telaAtual} setActiveTab={handleNavigation} abrirSubaba={abrirSubaba}
                ehChefe={ehChefe} unidadeGlobal={unidadeGlobal} setUnidadeGlobal={setUnidadeGlobal} unidades={unidadesVisiveis} rotuloTodas={rotuloTodas}
                usuarioLogado={usuarioLogado} handleLogout={handleLogout}
            />

            <SidebarMobile 
                isMobileMenuOpen={isMobileMenuOpen} fecharMobile={() => setIsMobileMenuOpen(false)}
                abasPermitidas={abasPermitidas} activeTab={telaAtual} setActiveTab={handleNavigation} abrirSubaba={abrirSubaba}
                ehChefe={ehChefe} unidadeGlobal={unidadeGlobal} setUnidadeGlobal={setUnidadeGlobal} unidades={unidadesVisiveis} rotuloTodas={rotuloTodas}
                usuarioLogado={usuarioLogado} handleLogout={handleLogout}
            />

            <div className="flex-1 flex flex-col h-full relative z-10 w-full min-w-0 overflow-hidden">
                <TopBar 
                    activeTab={telaAtual}
                    usuarioLogado={usuarioVirtual}
                    theme={theme}
                    setTheme={setTheme}
                    tamanhoTela={tamanhoTela}
                    setTamanhoTela={setTamanhoTela}
                    onAbrirMenuMobile={() => setIsMobileMenuOpen(true)}
                    onSelecionarAlunoGlobal={handleSelecionarAlunoGlobal}
                    pendentesTotais={comunicadosGlobais.pendentesTotais}
                    onNavigate={handleNavigation}
                    podeTrocarUnidade={ehChefe}
                    unidadeGlobal={unidadeGlobal}
                    setUnidadeGlobal={setUnidadeGlobal}
                    unidades={unidadesVisiveis}
                    rotuloTodas={rotuloTodas}
                />

                <BlockingGate 
                    comunicadoBloqueante={activeGateComm} 
                    onConcluido={() => setTriggerSync(prev => prev + 1)}
                />

                <main key={unidadeGlobal} className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 lg:p-5 relative z-0 h-full w-full">
                    {/* Rede de segurança: erro numa tela mostra o aviso só nela; o menu continua (zera ao trocar de tela) */}
                    <ProtecaoTela key={telaAtual || 'nenhuma'}>
                    {(mentorCarregando || mentorSemUnidade) ? (
                        <div className="h-full flex items-center justify-center p-4">
                            {mentorCarregando ? (
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{tx("Carregando suas unidades...")}</p>
                            ) : (
                                <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-8 text-center">
                                    <Building2 className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                                    <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">{tx("Sem unidades")}</h2>
                                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                                        {tx("Nenhuma unidade vinculada ao seu acesso. Fale com o administrador.")}
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (<>
                    {telaAtual === 'lancamento' && (
                        <LancamentoVendas 
                            usuarioLogado={usuarioVirtual} 
                            unidades={unidadesVisiveis} 
                            onAddMultiple={handleAddLancamentos} 
                            planos={planos} 
                            produtos={produtos} 
                            servicos={servicos} 
                            colaboradores={colaboradores} 
                            alunoPreSelecionado={alunoPreSelecionado} 
                            limparPreSelecao={() => setAlunoPreSelecionado(null)}
                            onIrParaAluno={handleSelecionarAlunoGlobal}
                            vendas={dadosAssinaturas} // só leitura: aviso do limite de doses únicas
                        />
                    )}
                    {telaAtual === 'assinaturas' && <AssinaturasPratique usuarioLogado={usuarioVirtual} data={vendasEnriquecidas} setData={setDadosAssinaturas} colaboradores={colaboradores} onAbrirAluno={(aluno) => abrirAlunoVindoDe(aluno, 'assinaturas')} />}
                    {telaAtual === 'analise' && <AnaliseDashboard usuarioLogado={usuarioVirtual} vendas={vendasEnriquecidas} visitantes={dadosVisitantes} avaliacoes={avaliacoesEnriquecidas} planos={planos} produtos={produtos} colaboradores={colaboradores} unidades={unidadesVisiveis} setUnidadeGlobal={ehChefe ? setUnidadeGlobal : undefined} />}
                    {telaAtual === 'fechamento' && <FechamentoCaixa usuarioLogado={usuarioVirtual} vendas={vendasEnriquecidas} visitantes={dadosVisitantes} avaliacoes={avaliacoesEnriquecidas} setVendas={setDadosAssinaturas} colaboradores={colaboradores} />}
                    {telaAtual === 'crm' && <CrmVisitantes usuarioLogado={usuarioVirtual} setVisitantes={setDadosVisitantes} colaboradores={colaboradores} />}
                    {telaAtual === 'alunos' && (
                        <ModuloAlunos360
                            usuarioLogado={usuarioVirtual}
                            usuarioReal={usuarioComPode}
                            unidadeGlobal={unidadeGlobal}
                            setUnidadeGlobal={setUnidadeGlobal}
                            unidades={unidadesVisiveis}
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
                    {telaAtual === 'avaliacao' && (
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
                    {telaAtual === 'cadastros' && <CadastroGeral usuarioLogado={usuarioVirtual} planos={planos} setPlanos={setPlanos} produtos={produtos} setProdutos={setProdutos} servicos={servicos} setServicos={setServicos} colaboradores={colaboradores} setColaboradores={setColaboradores} unidades={unidadesVisiveis} todasUnidades={unidades} setUnidades={setUnidades}
                        pendencias={pendencias.lista} pendenciasCarregadas={pendencias.carregado} abrirTela={abrirTelaDaUnidade} />}
                    {telaAtual === 'comunicados' && <CentralComunicados usuarioLogado={usuarioComPode} unidades={unidadesVisiveis} />}
                    {telaAtual === 'pendencias' && ehChefe && <PaginaPendencias pendencias={pendencias} colaboradores={colaboradores} unidadeGlobal={unidadeGlobal} ehMentor={ehMentor} lideresAcesso={acessos.contas?.lideres} />}
                    {telaAtual === 'acessos' && (papelCobranca === 'ADMIN' || papelCobranca === 'MENTOR') && <PaginaAcessos acessos={acessos} esconderAbas={papelCobranca === 'ADMIN' ? ['logins'] : []} ehAdmin={papelCobranca === 'ADMIN'} unidades={unidadesVisiveis.map(u => u.nome)} />}
                    {telaAtual === 'config' && <Configuracoes unidades={unidades} emailLogado={usuarioLogado?.email} acessos={acessos} unidadesAcesso={unidadesVisiveis.map(u => u.nome)} />}
                    </>)}
                    </ProtecaoTela>
                </main>
            </div>
        </div>
    );
}