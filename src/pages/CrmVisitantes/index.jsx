import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../../supabaseClient.js';

import { formatarCPF, apenasDigitos, mesmoNome, podeApagarLeads, ehRecepcao, dataDoLead, normalizarStatus, classeTipoLead, tipoPeloStatusTecace, marcaFeitoPor, contatoCombinaComBusca, ACOES_QUE_TIRAM_DO_PARADO, situacaoProximoContato } from './utils';
import Metricas from './Metricas';
import Kanban from './Kanban';
import Lista from './Lista';
import Conversa from './Conversa';
import Modais from './Modais';
import RelatorioCrm from './RelatorioCrm'; // ✅ IMPORTAÇÃO DO NOVO RELATÓRIO
import PainelInicialCrm from './PainelInicialCrm';
import ContatosDeHoje from './ContatosDeHoje';
import AbaMigracao from './AbaMigracao';
import AbaResgate from './AbaResgate';
import AbaNaoContatar from './AbaNaoContatar';
import AbaHoje from './AbaHoje';
import PuxarDoCadastro from './PuxarDoCadastro';
import { buscarComprasDePlano, decidirPelasCompras, aplicarDecisoes } from './compraDePlano';
import { JanelaNaoContatar, JanelaMotivoPerda, JanelaProximoContato } from './JanelasContato';
import JanelaResultadoContato from './JanelaResultadoContato';
import { carregarNaoContatar, estaNaoContatar, incluirNaoContatar, carregarMensagensProntas } from './contatosFeitos';
import { FASE_ESPERA, estaEmEspera, ocupaVaga, DIAS_SEM_CAMINHO, diaISO, contarPessoasDaMeta, ehMudancaPorCompra, LIMITE_CARTEIRA, FASES_EM_ATENDIMENTO, ORDENS_CONTATOS, lerOrdemContatos, salvarOrdemContatos, ehVisitanteRecepcao, dataDaVisita, somarDiasISO, prioridadeContato, dataLocalISO } from './utils';
import { parseSmartPaste } from '../CadastroGeral/utilsAlunos.js';
import { Repeat, Ban, CalendarClock, Search, X, ChevronLeft, ChevronRight, Send, MessagesSquare, MoreHorizontal, ChevronDown, LifeBuoy, ArrowRight } from 'lucide-react';
import { Database, ClipboardPaste, Trash2, CheckCircle2, Info, AlertTriangle, Snowflake, RotateCcw, Table, Trophy, Target, LogOut, FileText, Kanban as KanbanIcon, List, PieChart, Loader2, CalendarCheck } from 'lucide-react';
import { avisar } from '../../components/avisar.js';
import { EVENTO_CONTATOS, EVENTO_CONTATOS_RECARREGAR } from '../../components/aoVivoContatos.js';
import { carregarListaCrm, listaGuardada, guardarLista, esquecerListas, ficaNaLista, contarContatos } from './listaContatosCrm.js';
import { tx, localeAtual } from '../../i18n/traduzir.js';
import { podeVer, podeFazer } from '../../permissoes/catalogoPermissoes.js';
import { avisarSubabaAtual, EVENTO_PEDIR_SUBABA } from '../../components/subAbas.js';

// Mudanças feitas por outras pessoas (tempo real) recarregam os números no máximo 1 vez por minuto
const INTERVALO_ATUALIZACAO = 60000;
// Ações que contam na meta diária (a meta soma PESSOAS diferentes que receberam alguma dessas ações) (puxar fila, capturar e importar não contam)
const ACOES_DA_META = ['WhatsApp', 'Ligação', 'Observação', 'Mudança de Fase'];

// Base (piscina): contatos por página
const POR_PAGINA_BASE = 50;
// Campos criados no Bloco 4 (SQL em sql/2026-10-29-crm-bloco4). Enquanto não existirem no banco, o CRM grava sem eles.
const CAMPOS_BLOCO4 = ['motivo_perda', 'proximo_contato'];
// Reciclagem: contato de lista enviado e não trabalhado volta para o Banco Bruto depois de X dias (decisão do dono, 04/11/2026)
const DIAS_RECICLAGEM = 7;
const faltaCampoBloco4 = (error) => CAMPOS_BLOCO4.some(c => String(error?.message || '').includes(c));


const CrmVisitantes = ({ usuarioLogado, setVisitantes: setVisitantesRecentes, colaboradores = [] }) => {
    const unidadeTopo = usuarioLogado?.unidade && usuarioLogado.unidade !== 'TODAS' ? usuarioLogado.unidade : '';

    // "Versão" dos dados: sobe quando chegam mudanças em tempo real (no máximo 1 vez por minuto)
    // ou quando alguém clica em "Atualizar". As buscas dos números (planilha, Painel, Hoje) seguem ela.
    const [versaoDados, setVersaoDados] = useState(0);
    const ultimaAtualizacao = useRef(0);
    const timerVersao = useRef(null);
    const marcarMudancaDeFora = useCallback(() => {
        if (timerVersao.current) return; // já tem atualização marcada
        const espera = Math.max(1500, ultimaAtualizacao.current + INTERVALO_ATUALIZACAO - Date.now());
        timerVersao.current = setTimeout(() => { timerVersao.current = null; ultimaAtualizacao.current = Date.now(); setVersaoDados(v => v + 1); }, espera);
    }, []);
    useEffect(() => {
        ultimaAtualizacao.current = Date.now(); // abriu agora: a primeira atualização por mudanças de fora espera 1 minuto
        return () => clearTimeout(timerVersao.current);
    }, []);

    // ==========================================
    // LISTA DE CONTATOS DO CRM — carregar conforme a necessidade (decisão do dono, 10/11/2026; regras em listaContatosCrm.js)
    // 09/11/2026: o CRM passou a baixar a lista completa, sem o corte de 3.000 do App (16.623 contatos em aberto estavam
    // escondidos). 10/11/2026: baixar TUDO a cada entrada ficou lento (31.648 na Visão Global, 24 mil no Banco Bruto).
    // Agora:
    //   - Entrada do CRM (Equipe, Painel, Contatos): só o RESUMO (carteiras + visitantes dos últimos 90 dias); os
    //     números do topo são contados no banco (PainelInicialCrm).
    //   - Lista COMPLETA de UMA unidade só no CRM de uma recepcionista ou com o "Abastecer carteiras" aberto.
    //   - O que já foi baixado fica guardado na memória (sair e voltar não baixa de novo) e o tempo real mantém em dia.
    //   - As rotinas automáticas (reciclagem, carteira que se renova, limite de 300, quem comprou plano) só rodam com a
    //     lista COMPLETA da unidade (`listaCompleta`), nunca com o resumo nem com metade da lista.
    // ==========================================
    const [leadsCrm, setLeadsCrm] = useState([]);
    const [contatosCarregados, setContatosCarregados] = useState(false);
    const [carregandoLista, setCarregandoLista] = useState(true);
    const [versaoRecarga, setVersaoRecarga] = useState(0);
    const carregadoRef = useRef(false);
    // Qual lista está na tela agora: { tipo: 'resumo' | 'completa', unidade }
    const [listaPronta, setListaPronta] = useState({ tipo: '', unidade: '' });
    const listaProntaRef = useRef(listaPronta);
    useEffect(() => { listaProntaRef.current = listaPronta; }, [listaPronta]);
    // Barra de progresso da carga: quantos já chegaram de quantos (o total vem na 1ª página)
    const [progressoCarga, setProgressoCarga] = useState({ feitos: 0, total: null });
    const atualizarAgora = useCallback(() => {
        esquecerListas();
        ultimaAtualizacao.current = Date.now();
        setVersaoDados(v => v + 1);
        setVersaoRecarga(v => v + 1);
    }, []);

    // Mensagens prontas do WhatsApp (versões do embaralhador): carrega ao abrir o CRM para o Kanban/Lista/Hoje usarem
    useEffect(() => { carregarMensagensProntas(); }, [versaoDados]);

    // Avisos do tempo real (repassados pelo App): encaixa só o contato que mudou, com a mesma regra da lista na tela
    useEffect(() => {
        const aoAviso = (e) => {
            if (!carregadoRef.current) return; // a carga ainda vai trazer
            const eventos = Array.isArray(e?.detail) ? e.detail : [];
            if (!eventos.length) return;
            const { tipo, unidade } = listaProntaRef.current;
            if (!tipo) return;
            setLeadsCrm(lista => {
                const porId = new Map(lista.map(l => [l.id, l]));
                eventos.forEach(ev => {
                    if (ev?.eventType === 'DELETE') { if (ev.old?.id != null) porId.delete(ev.old.id); return; }
                    const linha = ev?.new;
                    if (!linha || linha.id == null) return;
                    if (ficaNaLista(tipo, unidade, linha)) porId.set(linha.id, { ...(porId.get(linha.id) || {}), ...linha });
                    else porId.delete(linha.id);
                });
                return [...porId.values()].sort((a, b) => (b.id > a.id ? 1 : b.id < a.id ? -1 : 0));
            });
            marcarMudancaDeFora();
        };
        const aoRecarregar = () => setVersaoRecarga(v => v + 1);
        window.addEventListener(EVENTO_CONTATOS, aoAviso);
        window.addEventListener(EVENTO_CONTATOS_RECARREGAR, aoRecarregar);
        return () => {
            window.removeEventListener(EVENTO_CONTATOS, aoAviso);
            window.removeEventListener(EVENTO_CONTATOS_RECARREGAR, aoRecarregar);
        };
    }, [marcarMudancaDeFora]);

    // Mudanças feitas aqui (mover fase, enviar para recepcionista...) ficam guardadas para a próxima entrada
    useEffect(() => {
        if (!carregadoRef.current || carregandoLista || !listaPronta.tipo) return;
        guardarLista(listaPronta.tipo, listaPronta.unidade, leadsCrm);
    }, [leadsCrm, listaPronta, carregandoLista]);

    // Lista única do CRM. Quem ainda estiver na fase antiga "Day Use (3 Dias)" aparece como "Em Contato".
    const visitantes = useMemo(() => leadsCrm
        .map(v => (normalizarStatus(v.status) !== v.status ? { ...v, status: normalizarStatus(v.status) } : v)), [leadsCrm]);

    // Atualiza a lista do CRM (e a do App, que guarda os visitantes para o Dashboard). Sempre recebe uma função (prev => ...).
    const setVisitantes = useCallback((atualizar) => {
        setLeadsCrm(atualizar);
        setVisitantesRecentes?.(atualizar);
    }, [setVisitantesRecentes]);
    // Contato novo entra na lista do CRM (o tempo real leva ao App os que forem visitantes); sem repetir o que já chegou
    const adicionarLeads = (novos) => setLeadsCrm(prev => { const ids = new Set(novos.map(n => n.id)); return [...novos, ...prev.filter(v => !ids.has(v.id))]; });

    const podeApagar = podeApagarLeads(usuarioLogado);

    // A última visão escolhida (Conversa, Kanban, Lista...) fica guardada neste computador (06/11/2026)
    const [visaoAtiva, setVisaoAtivaEstado] = useState(() => {
        try { return localStorage.getItem('crm_visao_recepcionista') || 'kanban'; } catch { return 'kanban'; }
    }); // a Base foi para a aba Equipe da entrada (04/11/2026)
    const setVisaoAtiva = (visao) => {
        setVisaoAtivaEstado(visao);
        try { localStorage.setItem('crm_visao_recepcionista', visao); } catch { /* navegador sem armazenamento: só não lembra */ }
    };
    // Abas do CRM da recepcionista pelas permissões (Configurações → Permissões, 06/11/2026; padrão = como era).
    // O Kanban é a visão principal (sempre).
    const visaoLiberada = {
        kanban: true,
        conversa: podeVer(usuarioLogado, '519'),
        lista: podeVer(usuarioLogado, '507'),
        hoje: podeVer(usuarioLogado, '508'),
        geladeira: podeVer(usuarioLogado, '509'),
        migracao: podeVer(usuarioLogado, '510'),
        resgate: podeVer(usuarioLogado, '521'),
        naocontatar: podeVer(usuarioLogado, '511'),
        dashboard: podeVer(usuarioLogado, '512'),
        relatorio: podeVer(usuarioLogado, '513'),
    };
    const visaoMostrada = visaoLiberada[visaoAtiva] ? visaoAtiva : 'kanban';

    // ==========================================
    // ESTADOS: SMART PASTE & SELEÇÃO NA BASE
    // ==========================================
    const [textoSmartPaste, setTextoSmartPaste] = useState('');
    const [previewLeads, setPreviewLeads] = useState([]);
    // AUTO = classifica cada linha pelo Status do TECACE (lista exportada do TECACE)
    const [tipoLeadSmartPaste, setTipoLeadSmartPaste] = useState('AUTO');
    const [processandoPaste, setProcessandoPaste] = useState(false);
    // Lista que não é do TECACE com o modo "Automático": precisa escolher o tipo do lote antes de salvar
    const [pasteSemTipo, setPasteSemTipo] = useState(false);
    const [estatisticasPaste, setEstatisticasPaste] = useState({ novos: 0, duplicados: 0 }); 
    
    const [selecionadosBase, setSelecionadosBase] = useState([]);
    // Distribuir / mover contatos da Base (entrada do CRM; Recepção, Líder, Mentor e Admin)
    const [recepEnvio, setRecepEnvio] = useState('');
    const [qtdEnvio, setQtdEnvio] = useState(10);
    const [moverDe, setMoverDe] = useState('');
    const [moverPara, setMoverPara] = useState('');
    const [moverQtd, setMoverQtd] = useState(10);
    const [buscaBase, setBuscaBase] = useState('');
    const [paginaBase, setPaginaBase] = useState(1);

    // Bloco 4: janela do motivo da perda ({ ids, nome, lote }) e do próximo contato ({ lead, posContato })
    const [perdaPendente, setPerdaPendente] = useState(null);
    const [proximoPendente, setProximoPendente] = useState(null);
    // "Como foi o contato?" no funil (07/11/2026): abre depois de WhatsApp/ligação e substitui a pergunta do próximo contato
    const [resultadoFunil, setResultadoFunil] = useState(null); // { lead, tentativas }
    const resultadoFunilRef = useRef(null);
    const camposBloco4Faltando = useRef(false);

    // MODAIS E HISTÓRICO
    const [modalWpp, setModalWpp] = useState({ show: false, lead: null, texto: '' });
    const [modalDetalhe, setModalDetalhe] = useState({ show: false, lead: null });
    const [historicoLead, setHistoricoLead] = useState([]);
    const [loadingHistorico, setLoadingHistorico] = useState(false);

    const [consultorAtivo, setConsultorAtivo] = useState(null);
    // Menu lateral (subabas, 10/11/2026): Equipe/Painel/Contatos ficam na entrada; no CRM da pessoa, nenhuma fica marcada
    useEffect(() => {
        const aoPedir = (e) => { if (e.detail?.tela === 'crm') setConsultorAtivo(null); };
        window.addEventListener(EVENTO_PEDIR_SUBABA, aoPedir);
        return () => window.removeEventListener(EVENTO_PEDIR_SUBABA, aoPedir);
    }, []);
    useEffect(() => { if (consultorAtivo) avisarSubabaAtual('crm', null); }, [consultorAtivo]);

    const META_DIARIA = 150; 
    const [progressoHoje, setProgressoHoje] = useState([]);
    const [mostrarRelatorio, setMostrarRelatorio] = useState(false);

    // ✅ Variável de segurança para o Relatório Global
    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';

    // Trocou a unidade no topo: volta para a tela de entrada (a recepcionista aberta pode ser de outra unidade)
    useEffect(() => {
        setConsultorAtivo(null);
        setSelecionadosBase([]);
    }, [unidadeTopo]);

    // Meta do dia contada pelo histórico do banco: o mesmo número em qualquer computador
    // (inclui o que o Líder fez no CRM da pessoa). Movimentos em lote não contam, como antes.
    useEffect(() => {
        if (!consultorAtivo) return;
        let cancelado = false;
        setProgressoHoje([]);
        const inicioDoDia = new Date();
        inicioDoDia.setHours(0, 0, 0, 0);
        Promise.all([
            supabase.from('historico_leads').select('lead_id, tipo_acao, observacao, data_registro')
                .eq('consultor', consultorAtivo.nome)
                .in('tipo_acao', ACOES_DA_META)
                .gte('data_registro', inicioDoDia.toISOString())
                .limit(5000),
            // Contatos de aniversário e migração (pop-up e aba Migração) também contam na meta.
            // Os de visitante 24h/48h já contam pelo histórico do funil (por isso só os sem contato no funil).
            supabase.from('crm_contatos_feitos').select('aluno_id, tipo, canal, criado_em')
                .eq('consultor', consultorAtivo.nome)
                .is('lead_id', null)
                .gte('criado_em', inicioDoDia.toISOString())
                .limit(5000)
        ]).then(([resHist, resFeitos]) => {
            if (cancelado) return;
            if (resHist.error) { console.error('Erro ao carregar a meta do dia:', resHist.error); return; }
            const doFunil = (resHist.data || [])
                .filter(h => !String(h.observacao || '').startsWith('Movido em lote') && !ehMudancaPorCompra(h.observacao))
                .map(h => ({ tipo: h.tipo_acao, observacao: h.observacao, data_contato: h.data_registro, pessoa: `lead:${h.lead_id}` }));
            const feitos = (resFeitos.data || [])
                .map(f => ({ tipo: 'Contato CRM', observacao: `${f.tipo} ${f.canal}`, data_contato: f.criado_em, pessoa: f.aluno_id ? `aluno:${f.aluno_id}` : null }));
            setProgressoHoje([...doFunil, ...feitos]);
        });
        return () => { cancelado = true; };
    }, [consultorAtivo]);

    // "Parado há X dias" (Bloco 4): data da última ação de cada contato da carteira (Novo/Em Contato), lida do histórico.
    // A lista de ids vira texto para só buscar de novo quando a carteira mudar (ou a cada atualização dos dados).
    const [ultimasAcoes, setUltimasAcoes] = useState({ carregado: false, mapa: {} });
    const idsCarteira = useMemo(() => (consultorAtivo
        ? visitantes.filter(v => v.puxado_em && mesmoNome(v.puxado_por, consultorAtivo.nome) && ['Novo', 'Em Contato'].includes(v.status)).map(v => String(v.id)).sort().join(',')
        : ''), [visitantes, consultorAtivo]);
    useEffect(() => {
        if (!idsCarteira) { setUltimasAcoes({ carregado: true, mapa: {} }); return; }
        let cancelado = false;
        (async () => {
            const ids = idsCarteira.split(',');
            const mapa = {};
            // De 100 em 100 contatos (cada um pode ter muitas ações no histórico)
            for (let i = 0; i < ids.length; i += 100) {
                const { data, error } = await supabase.from('historico_leads').select('lead_id, data_registro')
                    .in('lead_id', ids.slice(i, i + 100))
                    .in('tipo_acao', ACOES_QUE_TIRAM_DO_PARADO)
                    .order('data_registro', { ascending: false })
                    .limit(5000);
                if (cancelado) return;
                if (error) { console.error('Erro ao ler a última ação dos contatos (parado há X dias):', error); return; }
                (data || []).forEach(h => { if (!mapa[h.lead_id]) mapa[h.lead_id] = h.data_registro; });
            }
            if (!cancelado) setUltimasAcoes(prev => ({ carregado: true, mapa: { ...prev.mapa, ...mapa } }));
        })();
        return () => { cancelado = true; };
    }, [idsCarteira, versaoDados]);
    const marcarAcaoAgora = useCallback((leadIds) => {
        const agora = new Date().toISOString();
        setUltimasAcoes(prev => ({ ...prev, mapa: { ...prev.mapa, ...Object.fromEntries(leadIds.map(id => [String(id), agora])) } }));
    }, []);

    // Contato de aniversário ou migração feito agora: soma na meta na hora (sem esperar recarregar)
    const somarNaMeta = useCallback((observacao, pessoa = null) => {
        setProgressoHoje(prev => [...prev, { tipo: 'Contato CRM', observacao, data_contato: new Date().toISOString(), pessoa }]);
    }, []);



    // Quando o Líder/Admin/Mentor age no CRM de uma recepcionista, a ação conta para ela,
    // mas o histórico ganha a marca de quem fez de verdade
    const marcaDeQuemFez = () => {
        const marca = marcaFeitoPor(usuarioLogado, consultorAtivo?.nome);
        return marca ? ` [${marca}]` : '';
    };

    const registrarHistorico = async (leadId, tipoAcao, observacaoOriginal, ignorarMeta = false) => {
        if (!ignorarMeta && (tipoAcao === 'WhatsApp' || tipoAcao === 'Ligação')) abrirResultadoFunil(leadId);
        const consultorAtual = consultorAtivo ? consultorAtivo.nome : (usuarioLogado?.nome || 'Sistema');
        const observacao = `${observacaoOriginal || ''}${marcaDeQuemFez()}`;

        const novoRegistro = {
            id: Date.now().toString(),
            lead_id: String(leadId),
            tipo_acao: tipoAcao,
            consultor: consultorAtual,
            observacao: observacao,
            data_registro: new Date().toISOString()
        };

        if (modalDetalhe.show && modalDetalhe.lead?.id === leadId) {
            setHistoricoLead(prev => [novoRegistro, ...prev]);
        }

        if (!ignorarMeta) {
            setProgressoHoje(prev => [...prev, { tipo: tipoAcao, observacao: observacao, data_contato: novoRegistro.data_registro, pessoa: `lead:${leadId}` }]);
        }
        if (ACOES_QUE_TIRAM_DO_PARADO.includes(tipoAcao)) marcarAcaoAgora([leadId]);

        await supabase.from('historico_leads').insert([{
            lead_id: String(leadId),
            tipo_acao: tipoAcao,
            consultor: consultorAtual,
            observacao: observacao
        }]);

        // Mandou WhatsApp ou ligou para um contato em "Novo": vai sozinho para "Em Contato" (decisão do dono, 06/11/2026)
        if (tipoAcao === 'WhatsApp' || tipoAcao === 'Ligação') {
            const lead = visitantes.find(v => String(v.id) === String(leadId));
            if (lead && lead.status === 'Novo') await alterarStatus(lead.id, 'Em Contato', undefined, tipoAcao);
        }
    };

    // Mesmo registro para vários leads de uma vez (lotes): uma ida só ao banco, não conta na meta
    const registrarHistoricoLote = async (leadIds, tipoAcao, observacaoOriginal) => {
        if (!leadIds.length) return;
        const consultorAtual = consultorAtivo ? consultorAtivo.nome : (usuarioLogado?.nome || 'Sistema');
        const observacao = `${observacaoOriginal || ''}${marcaDeQuemFez()}`;
        if (ACOES_QUE_TIRAM_DO_PARADO.includes(tipoAcao)) marcarAcaoAgora(leadIds);
        const { error } = await supabase.from('historico_leads').insert(leadIds.map(id => ({
            lead_id: String(id), tipo_acao: tipoAcao, consultor: consultorAtual, observacao
        })));
        if (error) console.error('Erro ao registrar histórico em lote:', error);
    };

    // Unidade onde o contato novo é salvo: a de quem está operando; senão a do seletor do topo. Nunca "TODAS".
    const unidadeOperacao = String(consultorAtivo?.unidade || unidadeTopo || '').toUpperCase();
    // A Base (piscina) só mostra e só deixa puxar contatos da unidade de quem está operando
    const daUnidadeOperacao = (v) => !unidadeOperacao || String(v.unidade || '').toUpperCase() === unidadeOperacao;

    // "Não contatar": quem pediu para não receber contato some de Base, Kanban, Lista e Geladeira (rede inteira)
    const [naoContatar, setNaoContatar] = useState(new Set());
    const [versaoNaoContatar, setVersaoNaoContatar] = useState(0);
    const [naoContatarAlvo, setNaoContatarAlvo] = useState(null);
    useEffect(() => {
        let cancelado = false;
        carregarNaoContatar().then(lista => { if (!cancelado) setNaoContatar(lista); });
        return () => { cancelado = true; };
    }, [versaoDados, versaoNaoContatar]);
    const aoColocarNaoContatar = useCallback((pessoa) => {
        setNaoContatar(prev => incluirNaoContatar(prev, { cpf: pessoa?.cpf, leadId: pessoa?.lead_id || (pessoa?.id ? String(pessoa.id) : null), alunoId: pessoa?.aluno_id }));
        setVersaoNaoContatar(v => v + 1);
    }, []);
    const podeContatar = (v) => !estaNaoContatar(naoContatar, { cpf: v.cpf, leadId: String(v.id) });

    // "Contatos de hoje" (visitantes 24h/48h, atrasados e aniversariantes). Desde 06/11/2026 fica DENTRO da aba Hoje
    // (decisão do dono). A janela antiga só é usada por quem não tem a aba Hoje (permissão 508).
    const [contatosHojeAberto, setContatosHojeAberto] = useState(false);
    const [pendentesHoje, setPendentesHoje] = useState({ total: 0, carregando: true });
    const aoAtualizarPendentes = useCallback((total, carregando) => setPendentesHoje({ total, carregando }), []);
    // Base em 3 passos na aba Equipe: qual passo está aberto ('' = todos fechados)
    const [passoBase, setPassoBase] = useState('');

    // Qual lista o CRM precisa agora (10/11/2026): COMPLETA de uma unidade no CRM de uma recepcionista ou com um passo
    // do "Abastecer carteiras" aberto; senão o RESUMO (carteiras + visitantes) da unidade do topo (ou de todas).
    const unidadeCompleta = consultorAtivo
        ? String(consultorAtivo.unidade || unidadeTopo || '').toUpperCase().trim()
        : (passoBase && unidadeTopo ? String(unidadeTopo).toUpperCase().trim() : '');
    const tipoLista = unidadeCompleta ? 'completa' : 'resumo';
    const unidadeLista = unidadeCompleta || String(unidadeTopo || '').toUpperCase().trim();
    // Banco Bruto contado no banco, para o cabeçalho do "Abastecer carteiras" antes de a lista completa chegar
    const [contagemBase, setContagemBase] = useState(null);
    useEffect(() => {
        if (consultorAtivo || !unidadeTopo) { setContagemBase(null); return undefined; }
        let cancelado = false;
        contarContatos(unidadeTopo).then(c => { if (!cancelado) setContagemBase(c ? c.base : null); });
        return () => { cancelado = true; };
    }, [consultorAtivo, unidadeTopo, versaoDados]);
    // As rotinas automáticas só rodam com a lista COMPLETA da unidade de quem está operando
    const listaCompleta = !carregandoLista && listaPronta.tipo === 'completa' && Boolean(unidadeCompleta) && listaPronta.unidade === unidadeCompleta;
    useEffect(() => {
        let cancelado = false;
        const guardada = listaGuardada(tipoLista, unidadeLista);
        if (guardada) {
            setLeadsCrm(guardada);
            setListaPronta({ tipo: tipoLista, unidade: unidadeLista });
            carregadoRef.current = true;
            setContatosCarregados(true);
            setCarregandoLista(false);
            return undefined;
        }
        setCarregandoLista(true);
        setProgressoCarga({ feitos: 0, total: null });
        carregarListaCrm(tipoLista, unidadeLista, (feitos, total) => { if (!cancelado) setProgressoCarga({ feitos, total }); })
            .then(lista => {
                if (cancelado) return;
                setLeadsCrm(lista);
                setListaPronta({ tipo: tipoLista, unidade: unidadeLista });
                carregadoRef.current = true;
                setContatosCarregados(true);
                setCarregandoLista(false);
            })
            .catch(error => {
                if (cancelado) return;
                console.error('Erro ao carregar os contatos do CRM:', error);
                avisar(tx('Não foi possível carregar os contatos do CRM. Clique em "Atualizar" para tentar de novo.'), 'erro');
                // Não troca a lista que já estava na tela por uma pela metade
                carregadoRef.current = true;
                setContatosCarregados(true);
                setCarregandoLista(false);
            });
        return () => { cancelado = true; };
    }, [tipoLista, unidadeLista, versaoRecarga]);
    // Ordem dos contatos no Kanban: fila inteligente (padrão), mais antigos ou mais novos (07/11/2026)
    const [ordemContatos, setOrdemContatos] = useState(lerOrdemContatos);
    // Contatos do dia (24h, 48h, atrasados, aniversariantes; feitos e pendentes) para o botão "Hoje" da Conversa
    const [contatosDoDia, setContatosDoDia] = useState(null);
    // Menu "Mais" das abas (Geladeira, Não contatar, Métricas, Relatório)
    const [maisAberto, setMaisAberto] = useState(false);

    // CPFs que já estão no CRM em TODAS as unidades. Usa a consulta segura "crm_cpfs_existentes"
    // (a tabela leads é protegida por unidade: a busca direta só enxergaria a própria unidade).
    // Devolve null se a consulta segura não existir; aí quem chamou usa a busca direta.
    const buscarCpfsViaConsultaSegura = async (cpfs) => {
        const { data, error } = await supabase.rpc('crm_cpfs_existentes', { p_cpfs: cpfs });
        if (error) { console.warn('Consulta segura crm_cpfs_existentes indisponível; usando a busca direta:', error.message || error); return null; }
        return data || [];
    };



    const carregarHistoricoLead = async (leadId) => {
        setLoadingHistorico(true);
        const { data } = await supabase.from('historico_leads').select('*').eq('lead_id', String(leadId)).order('data_registro', { ascending: false });
        if (data) setHistoricoLead(data);
        setLoadingHistorico(false);
    };


    // ==========================================
    // O MOTOR DO SMART PASTE (COM IA DE DETECÇÃO DE COLUNAS)
    // ==========================================
    const processarColagem = (texto, tipoEscolhido = tipoLeadSmartPaste) => {
        setTextoSmartPaste(texto);
        if (!texto.trim()) { 
            setPreviewLeads([]); 
            setPasteSemTipo(false);
            setEstatisticasPaste({ novos: 0, duplicados: 0 });
            return; 
        }

        const linhas = texto.split('\n');
        const mapeados = [];
        let qtdNovos = 0;
        let qtdDuplicados = 0;

        // Lista exportada do TECACE (cabeçalho com NOME e DOCUMENTO/STATUS): lê pelas colunas e,
        // no modo "Automático", classifica cada linha pelo Status (CLASSIFICACAO_STATUS_TECACE em utils.js).
        const primeiraLinha = (linhas.find(l => l.trim()) || '').toUpperCase();
        const comCabecalhoTecace = primeiraLinha.includes('NOME') && (primeiraLinha.includes('DOCUMENTO') || primeiraLinha.includes('STATUS'));
        // Também sem o cabeçalho: linhas com matrícula na 1ª coluna e o Status do TECACE na 5ª (04/11/2026)
        const STATUS_TECACE = /^(ATIVO|INATIVO|VISITANTE|SUSPENSO|TRANCADO|FINALIZADO|CLIENTE|BLOQUEADO)$/;
        const linhasCheias = linhas.filter(l => l.trim());
        const semCabecalhoTecace = linhasCheias.length > 0 && linhasCheias.filter(l => { const c = l.split('\t').map(x => x.trim().toUpperCase()); return c.length >= 6 && /^\d+$/.test(c[0]) && STATUS_TECACE.test(c[4]); }).length >= Math.ceil(linhasCheias.length / 2);
        const ehListaTecace = comCabecalhoTecace || semCabecalhoTecace;
        const entradas = [];
        if (ehListaTecace) {
            parseSmartPaste(texto).forEach(p => {
                entradas.push({
                    nome: p.nome,
                    telefone: p.telefone || '',
                    cpfLimpo: p.status === 'CPF INVÁLIDO' ? '' : p.cpf,
                    statusTecace: p.status_tecace,
                    // Dados extras da exportação do TECACE (04/11/2026): ficam no contato para o cadastro do aluno depois
                    extras: { matricula: p.matricula || '', email: p.email || '', sexo: p.sexo || '', data_cadastro: p.data_cadastro || null }
                });
            });
        }

        linhas.forEach(linha => {
            if (ehListaTecace || !linha.trim()) return;
            const colunas = linha.split('\t').map(c => c.trim());
            let nome = '', telefone = '', cpf = '';
            
            let offset = 0;
            if (/^\d{3,8}$/.test(colunas[0])) {
                offset = 1;
            }

            nome = colunas[offset]?.toUpperCase() || '';
            const campo1 = colunas[offset + 1] || '';
            const campo2 = colunas[offset + 2] || '';

            const isCpfFormatado = (str) => /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(str);
            
            if (isCpfFormatado(campo1)) {
                cpf = campo1;
                telefone = campo2;
            } else if (isCpfFormatado(campo2)) {
                cpf = campo2;
                telefone = campo1;
            } else {
                const numerosCampo1 = campo1.replace(/\D/g, '').length;
                
                if (campo1 && !campo2 && (campo1.includes('(') || numerosCampo1 === 10 || numerosCampo1 === 11)) {
                    telefone = campo1;
                    cpf = '';
                } else {
                    cpf = campo1;
                    telefone = campo2;
                }
            }
            
            entradas.push({ nome, telefone, cpfLimpo: cpf.replace(/\D/g, ''), statusTecace: '', extras: null });
        });

        entradas.forEach(({ nome, telefone, cpfLimpo: cpfBruto, statusTecace, extras }) => {
            const cpfLimpo = cpfBruto.length === 11 ? cpfBruto : '';
            const cpfFormatado = cpfLimpo ? formatarCPF(cpfLimpo) : '';
            const telLimpo = String(telefone || '').replace(/\D/g, '');

            // Tipo da linha: escolhido no seletor, ou pelo Status do TECACE no modo "Automático"
            const tipoTecace = tipoPeloStatusTecace(statusTecace);
            let tipo = tipoEscolhido === 'AUTO' ? tipoTecace : tipoEscolhido;
            let motivoIgnorado = null;
            if (tipoTecace === 'ATIVO') motivoIgnorado = 'ALUNO ATIVO';
            else if (tipoEscolhido === 'AUTO' && !tipo && ehListaTecace) motivoIgnorado = `STATUS "${statusTecace || 'VAZIO'}" SEM CLASSIFICAÇÃO`;
            if (motivoIgnorado) tipo = '';

            if (nome) {
                let motivoDuplicidade = null;

                const jaExisteBanco = visitantes.some(v => {
                    const vCpfLimpo = v.cpf ? v.cpf.replace(/\D/g, '') : '';
                    const vTelLimpo = v.telefone ? v.telefone.replace(/\D/g, '') : '';

                    if (cpfLimpo && vCpfLimpo && cpfLimpo === vCpfLimpo) {
                        motivoDuplicidade = 'CPF CADASTRADO';
                        return true;
                    }
                    if (telLimpo && vTelLimpo && telLimpo === vTelLimpo && telLimpo.length >= 10) {
                        motivoDuplicidade = 'TELEFONE CADASTRADO';
                        return true;
                    }
                    return false;
                });

                const jaExisteLista = mapeados.some(m => {
                    const mTelLimpo = m.telefone.replace(/\D/g, '');
                    if (cpfLimpo && m.cpf.replace(/\D/g, '') === cpfLimpo) {
                         motivoDuplicidade = 'CPF DUPLICADO NA LISTA';
                         return true;
                    }
                    if (telLimpo && mTelLimpo === telLimpo && telLimpo.length >= 10) {
                         motivoDuplicidade = 'TELEFONE DUPLICADO NA LISTA';
                         return true;
                    }
                    return false;
                });

                if (motivoIgnorado) motivoDuplicidade = motivoIgnorado;
                const isDuplicado = Boolean(motivoIgnorado) || jaExisteBanco || jaExisteLista;

                if (isDuplicado) qtdDuplicados++; else qtdNovos++;

                mapeados.push({
                    id_temp: Math.random().toString(),
                    nome,
                    telefone: telefone || '',
                    cpf: cpfFormatado,
                    tipo,
                    extras,
                    isDuplicado,
                    motivo: motivoDuplicidade
                });
            }
        });

        setEstatisticasPaste({ novos: qtdNovos, duplicados: qtdDuplicados });
        setPreviewLeads(mapeados);
        setPasteSemTipo(!ehListaTecace && tipoEscolhido === 'AUTO' && mapeados.length > 0);
    };

    const confirmarSmartPaste = async () => {
        if (pasteSemTipo) return avisar(tx("Esta lista não é do TECACE (não tem a coluna Status). Escolha no seletor se o lote é VISITANTE, CANCELADO ou INATIVO."));
        const leadsValidos = previewLeads.filter(l => !l.isDuplicado);
        
        if (leadsValidos.length === 0) {
            avisar(tx("Nenhum lead novo para salvar. Todos os registros colados já existem na base."));
            setTextoSmartPaste('');
            setPreviewLeads([]);
            setEstatisticasPaste({ novos: 0, duplicados: 0 });
            return;
        }

        if (!unidadeOperacao) { avisar(tx("Não foi possível saber a unidade destes contatos. Escolha uma unidade no topo ou a recepcionista que está operando.")); return; }

        setProcessandoPaste(true);

        const agora = new Date().toISOString();
        const dataBR = new Date().toLocaleDateString('pt-BR');
        const recusados = [];

        // 1. Confere no banco inteiro os CPFs que não estão nos contatos carregados (de 200 em 200)
        const cpfsDoLote = [...new Set(leadsValidos.map(l => apenasDigitos(l.cpf)).filter(c => c.length === 11))];
        const cpfsNoBanco = new Set();
        for (let i = 0; i < cpfsDoLote.length; i += 200) {
            const fatia = cpfsDoLote.slice(i, i + 200);
            const viaConsulta = await buscarCpfsViaConsultaSegura(fatia);
            if (viaConsulta) { viaConsulta.forEach(a => cpfsNoBanco.add(apenasDigitos(a.cpf))); continue; }
            const { data: achados, error: erroBusca } = await supabase.from('leads').select('cpf').in('cpf', [...fatia, ...fatia.map(formatarCPF)]);
            if (erroBusca) { console.error('Erro ao conferir CPFs do lote:', erroBusca); continue; }
            (achados || []).forEach(a => cpfsNoBanco.add(apenasDigitos(a.cpf)));
        }

        const paraSalvar = leadsValidos.filter(lead => {
            const cpf = apenasDigitos(lead.cpf);
            if (cpf && cpfsNoBanco.has(cpf)) { recusados.push(`${lead.nome} — ${tx('CPF já está no CRM')}`); return false; }
            return true;
        });

        const montarLead = (lead) => ({
            unidade: unidadeOperacao,
            nome: lead.nome,
            telefone: lead.telefone,
            cpf: apenasDigitos(lead.cpf) || null,
            tipo_lead: lead.tipo || tipoLeadSmartPaste,
            origem: 'CRM',
            vendedor: 'Importação',
            status: 'Novo',
            data: dataBR,
            criado_em: agora,
            puxado_em: null,
            puxado_por: null,
            perdido_em: null,
            ...(lead.extras && camposExtrasOk ? {
                matricula: lead.extras.matricula || null,
                email: lead.extras.email || null,
                sexo: lead.extras.sexo || null,
                data_cadastro_tecace: lead.extras.data_cadastro || null,
            } : {})
        });

        // Campos extras (matrícula, e-mail, sexo, data de cadastro) só existem depois do SQL sql/2026-11-04-crm-smartpaste/1_campos_tecace.sql
        let camposExtrasOk = true;
        if (paraSalvar.some(l => l.extras)) {
            const { error: erroCampos } = await supabase.from('leads').select('matricula, email, sexo, data_cadastro_tecace').limit(1);
            if (erroCampos) { camposExtrasOk = false; console.warn('CRM: falta rodar sql/2026-11-04-crm-smartpaste/1_campos_tecace.sql; salvando sem matrícula/e-mail/sexo/data de cadastro.'); }
        }

        // 2. Tenta salvar tudo de uma vez; se o banco recusar, salva um por um para aproveitar os bons
        let salvos = [];
        if (paraSalvar.length > 0) {
            const { data, error } = await supabase.from('leads').insert(paraSalvar.map(montarLead)).select();
            if (!error) {
                salvos = data || [];
            } else {
                for (const lead of paraSalvar) {
                    const { data: um, error: erroUm } = await supabase.from('leads').insert([montarLead(lead)]).select();
                    if (erroUm) recusados.push(`${lead.nome} — ${erroUm.code === '23505' ? tx('CPF já está no CRM') : erroUm.message}`);
                    else if (um?.[0]) salvos.push(um[0]);
                }
            }
        }

        if (salvos.length > 0) {
            adicionarLeads(salvos);
            await registrarHistoricoLote(salvos.map(l => l.id), 'Importação em Lote', 'Inserido na Base via Smart Paste.');
        }

        let mensagem = tx('{qtd} leads inseridos na Base com sucesso!', { qtd: salvos.length });
        if (recusados.length > 0) {
            mensagem += '\n\n' + tx('{qtd} não foram salvos:', { qtd: recusados.length }) + '\n' + recusados.slice(0, 15).join('\n');
            if (recusados.length > 15) mensagem += '\n' + tx('...e mais {qtd}.', { qtd: recusados.length - 15 });
        }
        avisar(mensagem);

        setTextoSmartPaste('');
        setPreviewLeads([]);
        setEstatisticasPaste({ novos: 0, duplicados: 0 });
        setProcessandoPaste(false);
    };

    // ==========================================
    // EXCLUSÃO REAL E DEFINITIVA (HARD DELETE)
    // ==========================================
    // Volta os leads apagados para a tela quando o banco recusa a exclusão
    const restaurarLeads = (backup, ids) => {
        const voltar = backup.filter(v => ids.includes(v.id));
        setVisitantes(prev => [...voltar.filter(v => !prev.some(p => p.id === v.id)), ...prev]);
    };

    const excluirSelecionadosBase = async () => {
        if (selecionadosBase.length === 0 || !podeApagar) return;

        if(window.confirm(tx("ATENÇÃO DELETAR DADOS: Deseja EXCLUIR DEFINITIVAMENTE os {length} contatos da base bruta do Supabase?\n\nIsso apagará os dados do banco e liberará os CPFs. Esta ação NÃO pode ser desfeita.", { length: selecionadosBase.length }))) {
            const backupVisitantes = [...visitantes];
            const ids = [...selecionadosBase];
            setVisitantes(prev => prev.filter(v => !ids.includes(v.id)));

            const { error } = await supabase.from('leads').delete().in('id', ids);

            if (error) {
                restaurarLeads(backupVisitantes, ids);
                avisar(tx("Erro ao excluir os contatos no banco. Ação revertida."));
            } else {
                avisar(tx("{length} leads foram apagados definitivamente do sistema!", { length: selecionadosBase.length }));
                setSelecionadosBase([]);
            }
        }
    };

    const deletarLeadsEmLote = async (ids) => {
        if (!podeApagar || ids.length === 0) return;
        if(window.confirm(tx("ATENÇÃO LIXEIRA: Deseja EXCLUIR DEFINITIVAMENTE os {length} leads selecionados do banco de dados?\n\nEles sumirão do funil e os CPFs serão liberados. Esta ação NÃO pode ser desfeita.", { length: ids.length }))) {
            const backupVisitantes = [...visitantes];
            setVisitantes(prev => prev.filter(v => !ids.includes(v.id)));

            const { error } = await supabase.from('leads').delete().in('id', ids);

            if (error) {
                restaurarLeads(backupVisitantes, ids);
                avisar(tx("Erro ao excluir. Ação revertida."));
            } else {
                avisar(tx("{length} leads foram apagados permanentemente!", { length: ids.length }));
            }
        }
    };

    const deletarLead = async (id) => {
        if (!podeApagar) return;
        const lead = visitantes.find(v => v.id === id);
        if(window.confirm(tx("EXCLUIR DEFINITIVAMENTE {v1} do banco de dados?\nEle desaparecerá do funil e o CPF ficará livre para um novo cadastro no futuro. Esta ação NÃO pode ser desfeita.", { v1: lead?.nome ? `"${lead.nome}"` : 'este Lead' }))) {
            const backupVisitantes = [...visitantes];
            setVisitantes(prev => prev.filter(v => v.id !== id));

            const { error } = await supabase.from('leads').delete().eq('id', id);

            if (error) {
                restaurarLeads(backupVisitantes, [id]);
                avisar(tx("Erro ao excluir do banco de dados."));
            } else {
                if (modalDetalhe.show && modalDetalhe.lead?.id === id) setModalDetalhe({ show: false, lead: null });
            }
        }
    };

    // ==========================================
    // PUXAR FILA E ALTERAR STATUS
    // ==========================================



    // LIMITE DE CARTEIRA (07/11/2026): 300 contatos em atendimento (Novo + Em Contato) por recepcionista
    // Carteira = contatos que ocupam vaga: Novo/Em Contato que NÃO estão em espera (data de volta depois de hoje; 09/11/2026)
    const carteiraDe = (nome) => visitantes.filter(v => mesmoNome(v.puxado_por, nome) && ocupaVaga(v) && daUnidadeOperacao(v));
    const emEsperaDe = (nome) => visitantes.filter(v => mesmoNome(v.puxado_por, nome) && estaEmEspera(v) && daUnidadeOperacao(v)).length;
    const vagaDe = (nome) => Math.max(0, LIMITE_CARTEIRA - carteiraDe(nome).length);
    // Quem passou do limite e quais contatos voltam (só "Novo" de lista, os enviados há mais tempo primeiro)
    const excedentesCarteira = (ignorar = new Set()) => recepcionistas.filter(c => c.ativo !== false).map(c => {
        const cart = carteiraDe(c.nome).filter(v => !ignorar.has(v.id));
        const excesso = cart.length - LIMITE_CARTEIRA;
        // Voltam contatos de lista (não visitantes) sem próximo contato marcado: Novo e Em Contato, os mais parados primeiro
        const hojeLim = diaISO(-1);
        const ids = excesso > 0 ? cart.filter(v => String(v.origem || '').toUpperCase() !== 'RECEPCAO' && !(String(v.proximo_contato || '').slice(0, 10) >= hojeLim))
            .sort((a, b) => new Date(a.ultima_acao_em || a.puxado_em || 0).getTime() - new Date(b.ultima_acao_em || b.puxado_em || 0).getTime()).slice(0, excesso).map(v => v.id) : [];
        return { nome: c.nome, total: cart.length, excesso: Math.max(0, excesso), ids };
    }).filter(x => x.excesso > 0);
    const devolverExcedente = async (lista, perguntar = true) => {
        const ids = lista.flatMap(x => x.ids);
        if (!ids.length) return;
        if (perguntar && !window.confirm(tx("Devolver {qtd} contatos para o Banco Bruto?\n\n{resumo}\n\nSó voltam contatos de lista sem próximo contato marcado (os mais parados primeiro); visitantes ficam. Com muitos contatos, prefira fazer fora do horário de movimento.", { qtd: ids.length, resumo: lista.map(x => `${x.nome.split(' ')[0]}: ${x.ids.length}`).join(' · ') }))) return;
        for (let i = 0; i < ids.length; i += 500) {
            const lote = ids.slice(i, i + 500);
            const { error } = await supabase.from('leads').update({ status: 'Novo', puxado_em: null, puxado_por: null, vendedor: 'Importação', proximo_contato: null }).in('id', lote);
            if (error) { console.error('Limite de carteira: erro ao devolver', error); avisar(tx("Erro de conexão. Parte dos contatos não voltou para o Banco Bruto."), 'erro'); return; }
            setVisitantes(prev => prev.map(v => lote.includes(v.id) ? { ...v, status: 'Novo', puxado_em: null, puxado_por: null, vendedor: 'Importação', proximo_contato: null } : v));
            await registrarHistoricoLote(lote.map(String), 'Reciclagem', `Voltou para o Banco Bruto: carteira acima de ${LIMITE_CARTEIRA} contatos.`);
        }
        if (perguntar) avisar(tx("{qtd} contatos voltaram para o Banco Bruto.", { qtd: ids.length }), 'sucesso');
    };

    // Envia contatos da Base para uma recepcionista (vira fila dela, como se ela tivesse puxado), sem passar do limite
    const enviarPara = async (idsPedidos, nomeRecep) => {
        if (!idsPedidos.length || !nomeRecep) return;
        const vaga = vagaDe(nomeRecep);
        if (vaga <= 0) return avisar(tx("{nome} já está com {limite} contatos na carteira (o limite). Os contatos ficam no Banco Bruto.", { nome: nomeRecep.split(' ')[0], limite: LIMITE_CARTEIRA }));
        const ids = idsPedidos.slice(0, vaga);
        if (ids.length < idsPedidos.length) avisar(tx("{nome} só tinha vaga para {qtd} (limite de {limite} contatos).", { nome: nomeRecep.split(' ')[0], qtd: ids.length, limite: LIMITE_CARTEIRA }));
        const agora = new Date().toISOString();
        setVisitantes(prev => prev.map(v => ids.includes(v.id) ? { ...v, puxado_em: agora, puxado_por: nomeRecep, vendedor: nomeRecep } : v));
        const { error } = await supabase.from('leads').update({ puxado_em: agora, puxado_por: nomeRecep, vendedor: nomeRecep }).in('id', ids);
        if (error) { console.error('Base: erro ao enviar', error); avisar(tx("Erro de conexão. Os contatos não foram enviados.")); return; }
        registrarHistoricoLote(ids, 'Fila de Trabalho', `Enviado da Base para ${nomeRecep}.`);
        avisar(tx('{qtd} contatos enviados para {nome}.', { qtd: ids.length, nome: nomeRecep.split(' ')[0] }), 'sucesso');
        setSelecionadosBase([]);
    };
    const distribuirLote = () => {
        const ids = visitantes.filter(v => !v.puxado_em && v.status !== 'Arquivado' && daUnidadeOperacao(v) && podeContatar(v))
            .sort((a, b) => new Date(dataDoLead(a)).getTime() - new Date(dataDoLead(b)).getTime()).slice(0, qtdEnvio).map(l => l.id);
        if (!ids.length) return avisar(tx("A Base de Leads está vazia!"));
        enviarPara(ids, recepEnvio);
    };
    // Dividir igualmente (rodízio): reparte TODA a Base da unidade entre as recepcionistas ativas, os mais antigos primeiro
    const dividirIgualmente = async () => {
        const ativas = recepcionistasAtivas;
        const livres = visitantes.filter(v => !v.puxado_em && v.status !== 'Arquivado' && daUnidadeOperacao(v) && podeContatar(v))
            .sort((a, b) => new Date(dataDoLead(a)).getTime() - new Date(dataDoLead(b)).getTime());
        if (!livres.length) return avisar(tx("A Base de Leads está vazia!"));
        if (ativas.length < 2) return avisar(tx("É preciso ter pelo menos 2 recepcionistas ativas para dividir."));
        // Rodízio só entre quem ainda tem vaga (limite de carteira)
        const vagas = ativas.map(c => vagaDe(c.nome));
        const porPessoa = ativas.map(() => []);
        let i = 0;
        for (const l of livres) {
            if (!vagas.some(v => v > 0)) break;
            while (vagas[i % ativas.length] <= 0) i++;
            const k = i % ativas.length;
            porPessoa[k].push(l.id); vagas[k]--; i++;
        }
        if (!porPessoa.some(p => p.length)) return avisar(tx("Todas as recepcionistas já estão com {limite} contatos na carteira (o limite).", { limite: LIMITE_CARTEIRA }));
        const resumo = ativas.map((c, i) => `${c.nome.split(' ')[0]}: ${porPessoa[i].length}`).join(' · ');
        if (!window.confirm(tx("Dividir {qtd} contatos igualmente?\n\n{resumo}", { qtd: livres.length, resumo }))) return;
        for (let i = 0; i < ativas.length; i++) {
            if (porPessoa[i].length) await enviarPara(porPessoa[i], ativas[i].nome);
        }
    };

    // Reciclagem automática (decisão do dono, 04/11/2026): contato de lista (origem CRM) enviado/puxado há 7 dias ou mais,
    // ainda em "Novo" e sem nenhum contato (WhatsApp, ligação, nota ou mudança de fase) volta para o Banco Bruto.
    // Roda uma vez por dia por unidade, para quem abrir o CRM.
    useEffect(() => {
        if (!unidadeOperacao || !listaCompleta) return; // só com a lista COMPLETA da unidade (10/11/2026)
        const chave = `crm_reciclagem_${unidadeOperacao}_${new Date().toISOString().slice(0, 10)}`;
        try { if (sessionStorage.getItem(chave) === '1') return; } catch { /* sem armazenamento: roda assim mesmo */ }
        const limite = Date.now() - DIAS_RECICLAGEM * 86400000;
        const candidatos = visitantes.filter(v => v.puxado_em && new Date(v.puxado_em).getTime() < limite && normalizarStatus(v.status) === 'Novo'
            && String(v.origem || '').toUpperCase() === 'CRM' && daUnidadeOperacao(v));
        if (!candidatos.length) return;
        let cancelado = false;
        (async () => {
            const ids = candidatos.map(v => String(v.id));
            const trabalhados = new Set();
            for (let i = 0; i < ids.length; i += 100) {
                const { data, error } = await supabase.from('historico_leads').select('lead_id, data_registro')
                    .in('lead_id', ids.slice(i, i + 100)).in('tipo_acao', ['WhatsApp', 'Ligação', 'Observação', 'Mudança de Fase']).limit(5000);
                if (error) { console.error('Reciclagem: erro ao ler o histórico', error); return; }
                (data || []).forEach(h => {
                    const lead = candidatos.find(v => String(v.id) === String(h.lead_id));
                    if (lead && new Date(h.data_registro) >= new Date(lead.puxado_em)) trabalhados.add(String(h.lead_id));
                });
            }
            if (cancelado) return;
            const voltar = candidatos.filter(v => !trabalhados.has(String(v.id))).map(v => v.id);
            try { sessionStorage.setItem(chave, '1'); } catch { /* ignora */ }
            if (!voltar.length) return;
            const { error } = await supabase.from('leads').update({ puxado_em: null, puxado_por: null, vendedor: 'Importação' }).in('id', voltar);
            if (error) { console.error('Reciclagem: erro ao devolver para o Banco Bruto', error); return; }
            setVisitantes(prev => prev.map(v => voltar.includes(v.id) ? { ...v, puxado_em: null, puxado_por: null, vendedor: 'Importação' } : v));
            registrarHistoricoLote(voltar.map(String), 'Reciclagem', `Voltou para o Banco Bruto: ${DIAS_RECICLAGEM} dias sem contato.`);
        })();
        return () => { cancelado = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- roda quando os contatos chegam (uma vez por dia por unidade)
    }, [unidadeOperacao, visitantes.length, listaCompleta]);

    // CARTEIRA QUE SE RENOVA SOZINHA (decisão do dono, 07/11/2026; revisada em 09/11/2026 com a coluna "Em Espera").
    // Todo contato tem um caminho: data de volta (Em Espera, ou hoje = na vez), Fechado, Geladeira ou Banco Bruto.
    //   - Data de volta HOJE ou depois: fica como está (é o caminho dele).
    //   - SEM CAMINHO (sem data, ou com a data já vencida) e sem WhatsApp/ligação há DIAS_SEM_CAMINHO (3) dias →
    //     volta para o Banco Bruto (fase Novo, sem dona). Vale para lista E para visitante (decisão do dono, 09/11/2026:
    //     antes o visitante ganhava o "dia 9" e ia para a Geladeira). O visitante só fica protegido até o 48h.
    //   - Lista em "Em Contato" com 3 tentativas (WhatsApp/ligação), a última há 2+ dias → Geladeira ("Não respondeu").
    // Conta a partir do mais recente entre: último WhatsApp/ligação, data de volta vencida, entrada na carteira e visita.
    // Feito em nome de "Sistema": não conta na meta nem no "Perdido" de ninguém. Grava em lotes de 500.
    const ultimaCarteiraAuto = useRef({});
    const MAX_TENTATIVAS_FUNIL = 3;
    useEffect(() => {
        if (!unidadeOperacao || !visitantes.length || !listaCompleta) return; // só com a lista COMPLETA (10/11/2026)
        const agoraMs = Date.now();
        if (agoraMs - (ultimaCarteiraAuto.current[unidadeOperacao] || 0) < 120000) return;
        ultimaCarteiraAuto.current[unidadeOperacao] = agoraMs;
        (async () => {
            const hoje = diaISO(0);
            const limiteSemCaminho = diaISO(-DIAS_SEM_CAMINHO);
            const proxDe = (v) => String(v.proximo_contato || '').slice(0, 10);
            const abertos = visitantes.filter(v => {
                if (!daUnidadeOperacao(v) || !v.puxado_por || !FASES_EM_ATENDIMENTO.includes(normalizarStatus(v.status))) return false;
                if (proxDe(v) && proxDe(v) >= hoje) return false; // tem caminho (Em Espera ou na vez hoje)
                if (ehVisitanteRecepcao(v)) { const visita = dataDaVisita(v); if (visita && visita >= diaISO(-2)) return false; } // ainda no 24h/48h
                return true;
            });
            const paraGeladeira = [];
            const paraBanco = [];
            // Tentativas e último WhatsApp/ligação pelo histórico
            const info = new Map();
            for (let i = 0; i < abertos.length; i += 100) {
                const ids = abertos.slice(i, i + 100).map(v => String(v.id));
                const { data, error } = await supabase.from('historico_leads').select('lead_id, data_registro').in('lead_id', ids).in('tipo_acao', ['WhatsApp', 'Ligação']).limit(5000);
                if (error) { console.error('Carteira automática: erro ao ler o histórico', error); return; }
                (data || []).forEach(h => { const k = String(h.lead_id); const a = info.get(k) || { qtd: 0, ultima: '' }; a.qtd++; const d = dataLocalISO(h.data_registro); if (d > a.ultima) a.ultima = d; info.set(k, a); });
            }
            abertos.forEach(v => {
                const a = info.get(String(v.id)) || { qtd: 0, ultima: '' };
                const visitante = ehVisitanteRecepcao(v);
                const referencia = [a.ultima, proxDe(v), dataLocalISO(v.puxado_em), visitante ? dataDaVisita(v) : ''].filter(Boolean).sort().pop() || '';
                if (!visitante && normalizarStatus(v.status) === 'Em Contato' && a.qtd >= MAX_TENTATIVAS_FUNIL && a.ultima && a.ultima <= diaISO(-2)) paraGeladeira.push({ v, motivo: `${a.qtd} tentativas sem resposta` });
                else if (referencia && referencia <= limiteSemCaminho) paraBanco.push(v);
            });

            // Grava (em nome de "Sistema")
            const historicoSistema = async (linhas) => {
                for (let i = 0; i < linhas.length; i += 200) {
                    const { error } = await supabase.from('historico_leads').insert(linhas.slice(i, i + 200));
                    if (error) console.error('Carteira automática: erro no histórico', error);
                }
            };
            let qtdGeladeira = 0;
            let qtdBanco = 0;
            for (let g = 0; g < paraGeladeira.length; g += 500) {
                const gel = paraGeladeira.slice(g, g + 500);
                const ids = gel.map(x => x.v.id);
                const campos = { status: 'Perdido', perdido_em: new Date().toISOString(), motivo_perda: 'Não respondeu', proximo_contato: null };
                const { error } = await atualizarLeads(ids, campos);
                if (!error) {
                    setVisitantes(prev => prev.map(v => ids.includes(v.id) ? { ...v, ...campos } : v));
                    await historicoSistema(gel.map(x => ({ lead_id: String(x.v.id), tipo_acao: 'Mudança de Fase', consultor: 'Sistema', observacao: `Movido de "${normalizarStatus(x.v.status)}" para "Perdido" (automático: ${x.motivo}) · Motivo: Não respondeu` })));
                    qtdGeladeira += ids.length;
                } else { console.error('Carteira automática: erro ao mandar para a Geladeira', error); break; }
            }
            // Visitante volta mantendo o "vendedor" (quem atendeu a visita, usado nas colunas 24h/48h); lista volta como "Importação"
            const gruposBanco = [
                { itens: paraBanco.filter(v => !ehVisitanteRecepcao(v)), campos: { status: 'Novo', puxado_em: null, puxado_por: null, vendedor: 'Importação', proximo_contato: null } },
                { itens: paraBanco.filter(ehVisitanteRecepcao), campos: { status: 'Novo', puxado_em: null, puxado_por: null, proximo_contato: null } }
            ];
            for (const grupo of gruposBanco) {
                for (let b = 0; b < grupo.itens.length; b += 500) {
                    const banco = grupo.itens.slice(b, b + 500).map(v => v.id);
                    const { error } = await atualizarLeads(banco, grupo.campos);
                    if (!error) {
                        setVisitantes(prev => prev.map(v => banco.includes(v.id) ? { ...v, ...grupo.campos } : v));
                        await historicoSistema(banco.map(id => ({ lead_id: String(id), tipo_acao: 'Reciclagem', consultor: 'Sistema', observacao: `Voltou para o Banco Bruto: sem caminho há ${DIAS_SEM_CAMINHO}+ dias (sem data de volta e sem WhatsApp/ligação).` })));
                        qtdBanco += banco.length;
                    } else { console.error('Carteira automática: erro ao devolver para o Banco Bruto', error); break; }
                }
            }
            // Depois de arrumar os parados: o que ainda passar de 300 volta para o Banco Bruto (limite de carteira)
            const movidos = new Set([...paraBanco.map(v => v.id), ...paraGeladeira.map(x => x.v.id)]);
            const excedentes = excedentesCarteira(movidos);
            const qtdExcesso = excedentes.reduce((t, x) => t + x.ids.length, 0);
            if (qtdExcesso) { await devolverExcedente(excedentes, false); qtdBanco += qtdExcesso; }
            if (qtdBanco || qtdGeladeira) avisar(tx("Carteiras organizadas: {banco} contato(s) parado(s) voltaram para o Banco Bruto e {gel} foram para a Geladeira (sem resposta).", { banco: qtdBanco, gel: qtdGeladeira }), 'sucesso');
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- uma vez por dia por unidade, quando os contatos chegam
    }, [unidadeOperacao, visitantes.length > 0, listaCompleta]);

    // Contato que comprou plano (decisão do dono, 06/11/2026; regras em compraDePlano.js): na MESMA unidade vai
    // sozinho para "Fechado" (conta para a recepcionista); em OUTRA unidade sai do CRM ("Arquivado").
    // Confere ao abrir o CRM e de novo quando chegam mais contatos (no máximo a cada 2 minutos por unidade).
    const ultimaConferenciaCompras = useRef({});
    useEffect(() => {
        if (!unidadeOperacao || !listaCompleta) return; // só com a lista COMPLETA (10/11/2026)
        const agora = Date.now();
        if (agora - (ultimaConferenciaCompras.current[unidadeOperacao] || 0) < 120000) return;
        const candidatos = visitantes.filter(v => daUnidadeOperacao(v) && ['Novo', 'Em Contato', 'Perdido'].includes(normalizarStatus(v.status))
            && apenasDigitos(v.cpf).length === 11 && String(v.tipo_lead || '').toUpperCase() !== 'MIGRACAO');
        if (!candidatos.length) return;
        ultimaConferenciaCompras.current[unidadeOperacao] = agora;
        // Não cancela no meio: a gravação vale mesmo se a tela mudar (cada contato só muda uma vez)
        (async () => {
            const datas = candidatos.map(v => String(dataDoLead(v) || '')).map(d => (/^\d{2}\/\d{2}\/\d{4}/.test(d) ? d.slice(0, 10).split('/').reverse().join('-') : d.slice(0, 10))).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
            const compras = await buscarComprasDePlano(candidatos.map(v => v.cpf), datas[0] || null);
            if (!compras || !compras.length) return;
            const feitas = await aplicarDecisoes(decidirPelasCompras(candidatos, compras), 'conferido no CRM');
            if (!feitas.length) return;
            const campos = new Map(feitas.map(f => [f.lead.id, f.campos]));
            setVisitantes(prev => prev.map(v => campos.has(v.id) ? { ...v, ...campos.get(v.id) } : v));
            const fechou = feitas.filter(f => f.acao === 'FECHAR').length;
            const saiu = feitas.filter(f => f.acao === 'SAIR');
            if (fechou) avisar(tx("{qtd} contatos foram para \"Fechado\": compraram plano nesta unidade.", { qtd: fechou }), 'sucesso');
            if (saiu.length) avisar(tx("{qtd} contatos saíram do CRM: compraram plano em outra unidade ({unidades}).", { qtd: saiu.length, unidades: [...new Set(saiu.map(f => String(f.compra.unidade || '').toUpperCase()))].join(', ') }), 'atencao');
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- roda quando os contatos chegam (no máximo a cada 2 minutos)
    }, [unidadeOperacao, visitantes.length, listaCompleta]);

    // Mover: só contatos ainda não trabalhados (fase Novo) da recepcionista de origem
    const contatosParaMover = (nome) => visitantes.filter(v => v.puxado_em && mesmoNome(v.puxado_por, nome) && normalizarStatus(v.status) === 'Novo' && daUnidadeOperacao(v));
    const moverEntre = async () => {
        const vaga = vagaDe(moverPara);
        if (vaga <= 0) return avisar(tx("{nome} já está com {limite} contatos na carteira (o limite).", { nome: moverPara.split(' ')[0], limite: LIMITE_CARTEIRA }));
        const lista = contatosParaMover(moverDe).sort((a, b) => new Date(dataDoLead(a)).getTime() - new Date(dataDoLead(b)).getTime()).slice(0, Math.min(moverQtd, vaga));
        if (!lista.length) return avisar(tx("{nome} não tem contatos novos para mover.", { nome: moverDe.split(' ')[0] }));
        if (!window.confirm(tx("Mover {qtd} contatos de {de} para {para}?", { qtd: lista.length, de: moverDe.split(' ')[0], para: moverPara.split(' ')[0] }))) return;
        const ids = lista.map(l => l.id);
        setVisitantes(prev => prev.map(v => ids.includes(v.id) ? { ...v, puxado_por: moverPara, vendedor: moverPara } : v));
        const { error } = await supabase.from('leads').update({ puxado_por: moverPara, vendedor: moverPara }).in('id', ids);
        if (error) { console.error('Base: erro ao mover', error); avisar(tx("Erro de conexão. Os contatos não foram movidos.")); return; }
        registrarHistoricoLote(ids, 'Fila de Trabalho', `Movido de ${moverDe} para ${moverPara}.`);
        avisar(tx('{qtd} contatos movidos para {nome}.', { qtd: ids.length, nome: moverPara.split(' ')[0] }), 'sucesso');
    };

    // Grava campos dos contatos. Se o banco ainda não tiver os campos do Bloco 4 (motivo_perda, proximo_contato),
    // grava o resto sem eles e avisa no console (faltaCampo = true).
    const atualizarLeads = async (ids, campos) => {
        const semBloco4 = () => Object.fromEntries(Object.entries(campos).filter(([k]) => !CAMPOS_BLOCO4.includes(k)));
        let enviar = camposBloco4Faltando.current ? semBloco4() : campos;
        const tirouCampo = Object.keys(enviar).length < Object.keys(campos).length;
        if (Object.keys(enviar).length === 0) return { error: null, faltaCampo: true };
        const { error } = await supabase.from('leads').update(enviar).in('id', ids);
        if (error && !tirouCampo && faltaCampoBloco4(error)) {
            camposBloco4Faltando.current = true;
            console.warn('Os campos motivo_perda/proximo_contato ainda não existem na tabela leads. Rode o SQL do Bloco 4 (sql/2026-10-29-crm-bloco4).', error.message);
            enviar = semBloco4();
            if (Object.keys(enviar).length === 0) return { error: null, faltaCampo: true };
            const { error: erro2 } = await supabase.from('leads').update(enviar).in('id', ids);
            return { error: erro2, faltaCampo: true };
        }
        return { error, faltaCampo: tirouCampo };
    };

    // Campos que mudam junto com a fase. Perdido guarda a data e o motivo; Fechado e Perdido não têm próximo contato.
    const camposDaFase = (novoStatus, motivoPerda) => {
        const perdido = novoStatus === 'Perdido';
        const campos = { status: novoStatus, perdido_em: perdido ? new Date().toISOString() : null, motivo_perda: perdido ? (motivoPerda || null) : null };
        if (perdido || novoStatus === 'Fechado') campos.proximo_contato = null;
        return campos;
    };
    const textoMotivo = (motivoPerda) => (motivoPerda ? ` · Motivo: ${motivoPerda}` : '');

    // Mover para Perdido (sozinho ou em lote) abre antes a janela do motivo (motivoPerda ainda não informado)
    const alterarStatusEmLote = async (ids, novoStatus, motivoPerda) => {
        if (novoStatus === 'Perdido' && motivoPerda === undefined) { setPerdaPendente({ ids, lote: true }); return; }
        // Para Perdido, a janela do motivo já serviu de confirmação
        if (novoStatus !== 'Perdido' && !window.confirm(tx("Mover {length} contatos para a fase {novoStatus}?", { length: ids.length, novoStatus: novoStatus }))) return;

        const campos = camposDaFase(novoStatus, motivoPerda);
        const anteriores = new Map(visitantes.filter(v => ids.includes(v.id)).map(v => [v.id, { status: v.status, perdido_em: v.perdido_em, motivo_perda: v.motivo_perda ?? null, proximo_contato: v.proximo_contato ?? null }]));

        setVisitantes(prev => prev.map(v => ids.includes(v.id) ? { ...v, ...campos } : v));
        const { error } = await atualizarLeads(ids, campos);

        if (error) {
            setVisitantes(prev => prev.map(v => anteriores.has(v.id) ? { ...v, ...anteriores.get(v.id) } : v));
            avisar(tx("Erro de conexão. Ação revertida."));
        } else {
            registrarHistoricoLote(ids, 'Mudança de Fase', `Movido em lote para "${novoStatus}".${textoMotivo(motivoPerda)}`);
            avisar(tx("Operação em lote concluída com sucesso!"));
        }
    };

    // origem: o que moveu sozinho (ex.: 'WhatsApp', 'Ligação', 'copiou a mensagem'); fica no histórico como "(automático: ...)"
    const alterarStatus = async (id, novoStatus, motivoPerda, origem) => {
        const leadAtual = visitantes.find(v => v.id === id);
        const statusAntigo = leadAtual ? leadAtual.status : null;
        if (statusAntigo === novoStatus) return;
        if (novoStatus === 'Perdido' && motivoPerda === undefined) { setPerdaPendente({ ids: [id], nome: leadAtual?.nome }); return; }

        const campos = camposDaFase(novoStatus, motivoPerda);
        const anteriores = { status: statusAntigo, perdido_em: leadAtual?.perdido_em ?? null, motivo_perda: leadAtual?.motivo_perda ?? null, proximo_contato: leadAtual?.proximo_contato ?? null };

        setVisitantes(prev => prev.map(v => v.id === id ? { ...v, ...campos } : v));
        setModalDetalhe(m => (m.show && m.lead?.id === id ? { ...m, lead: { ...m.lead, ...campos } } : m));

        await registrarHistorico(id, 'Mudança de Fase', `Movido de "${statusAntigo}" para "${novoStatus}"${textoMotivo(motivoPerda)}${origem ? ` (automático: ${origem})` : ''}`);
        const { error } = await atualizarLeads([id], campos);

        if (error) {
            setVisitantes(prev => prev.map(v => v.id === id ? { ...v, ...anteriores } : v));
            avisar(tx("Erro de conexão. Revertendo ação."));
        }
    };

    // Fase escolhida na TELA (Kanban, Lista, Conversa, ficha do contato). "Em Espera" não é fase do banco (09/11/2026):
    // escolher "Em Espera" abre a janela da data de volta; tirar da espera (voltar para Novo/Em Contato) apaga a data.
    const moverFase = async (id, fase, ...resto) => {
        // Mudança automática (com motivo/origem, ex.: "copiou a mensagem"): segue direto, sem mexer na espera
        if (resto.length) return alterarStatus(id, fase, ...resto);
        const lead = visitantes.find(v => v.id === id);
        if (!lead) return;
        if (fase === FASE_ESPERA) {
            if (!estaEmEspera(lead)) setProximoPendente({ lead, posContato: false });
            return;
        }
        if (estaEmEspera(lead) && FASES_EM_ATENDIMENTO.includes(fase)) {
            const ok = await salvarProximoContato(lead, null);
            if (ok && normalizarStatus(lead.status) !== fase) await alterarStatus(id, fase);
            return;
        }
        return alterarStatus(id, fase);
    };

    // Migração: aluno marcado como "Interessado" vai para o funil da recepcionista em "Em Contato" (decisão do dono, 06/11/2026).
    // Se o CPF já tem um contato no CRM da unidade, reaproveita (passa para a carteira dela e para "Em Contato");
    // senão cria o contato (tipo MIGRACAO). Grava "Fila de Trabalho" no histórico: não soma de novo na meta
    // (o contato de migração já contou para o aluno).
    // Resgate (09/11/2026, decisão do dono): o Interessado do Resgate também vem para o funil (origem 'RESGATE':
    // tipo do contato = CANCELADO/INATIVO pela situação do cadastro).
    const levarAlunoParaFunil = async (aluno, origemAba = 'MIGRACAO') => {
        const operador = consultorAtivo?.nome;
        if (!operador || !unidadeOperacao || !aluno) return;
        const cpf = apenasDigitos(aluno.cpf);
        const agora = new Date().toISOString();
        const doResgate = origemAba === 'RESGATE';
        const obs = doResgate
            ? `Interessado em voltar a treinar (situação no cadastro: ${aluno.status_aluno || '—'}). Veio da aba Resgate.`
            : `Interessado na migração para plano com nutricionista (último plano: ${aluno.ultimo_plano || '—'}). Veio da aba Migração.`;
        const existente = cpf ? visitantes.find(v => apenasDigitos(v.cpf) === cpf && v.status !== 'Arquivado') : null;
        // Interessado = Em Espera, volta amanhã (09/11/2026): assim já entra com caminho e não volta para o Banco Bruto
        const amanha = somarDiasISO(diaISO(0), 1);
        if (existente) {
            const campos = {
                ...(existente.status === 'Em Contato' ? {} : camposDaFase('Em Contato')),
                puxado_por: operador,
                puxado_em: existente.puxado_em && mesmoNome(existente.puxado_por, operador) ? existente.puxado_em : agora,
                proximo_contato: amanha,
            };
            const anteriores = Object.fromEntries(Object.keys(campos).map(k => [k, existente[k] ?? null]));
            setVisitantes(prev => prev.map(v => v.id === existente.id ? { ...v, ...campos } : v));
            const { error } = await atualizarLeads([existente.id], campos);
            if (error) {
                setVisitantes(prev => prev.map(v => v.id === existente.id ? { ...v, ...anteriores } : v));
                avisar(tx("Não foi possível levar o aluno para o funil.\n\n{v1}", { v1: error.message || '' }), 'erro');
                return;
            }
            await registrarHistoricoLote([existente.id], 'Fila de Trabalho', existente.status === 'Em Contato' ? obs : `${obs} Movido de "${existente.status}" para "Em Contato" (automático).`);
            avisar(tx("{nome} foi para o seu funil (Em Espera, volta amanhã).", { nome: aluno.nome }), 'sucesso');
            return;
        }
        const novo = {
            unidade: unidadeOperacao,
            nome: aluno.nome,
            telefone: apenasDigitos(aluno.telefone) || aluno.telefone || null,
            cpf: cpf || null,
            tipo_lead: doResgate ? (aluno.tipo === 'INATIVO' ? 'INATIVO' : 'CANCELADO') : 'MIGRACAO',
            origem: 'CRM',
            vendedor: operador,
            status: 'Em Contato',
            data: new Date().toLocaleDateString('pt-BR'),
            criado_em: agora,
            puxado_em: agora,
            puxado_por: operador,
            perdido_em: null,
            proximo_contato: amanha,
        };
        let { data, error } = await supabase.from('leads').insert([novo]).select();
        // Se o banco tiver trava nos tipos, grava sem o tipo (o histórico diz que veio da Migração)
        if (error && error.code === '23514') ({ data, error } = await supabase.from('leads').insert([{ ...novo, tipo_lead: null }]).select());
        if (error || !data?.[0]) {
            avisar(error?.code === '23505'
                ? tx("Este aluno já está no CRM de outra unidade (CPF repetido). Ele não foi para o seu funil.")
                : tx("Não foi possível levar o aluno para o funil.\n\n{v1}", { v1: error?.message || '' }), 'erro');
            return;
        }
        adicionarLeads(data);
        await registrarHistoricoLote([data[0].id], 'Fila de Trabalho', obs);
        avisar(tx("{nome} foi para o seu funil (Em Espera, volta amanhã).", { nome: aluno.nome }), 'sucesso');
    };

    // Próximo contato (Bloco 4): data AAAA-MM-DD ou null para tirar. Não conta na meta nem tira do "parado".
    const salvarProximoContato = async (lead, data) => {
        const anterior = lead.proximo_contato ?? null;
        setVisitantes(prev => prev.map(v => v.id === lead.id ? { ...v, proximo_contato: data } : v));
        setModalDetalhe(m => (m.show && m.lead?.id === lead.id ? { ...m, lead: { ...m.lead, proximo_contato: data } } : m));
        const { error, faltaCampo } = await atualizarLeads([lead.id], { proximo_contato: data });
        if (error || faltaCampo) {
            setVisitantes(prev => prev.map(v => v.id === lead.id ? { ...v, proximo_contato: anterior } : v));
            setModalDetalhe(m => (m.show && m.lead?.id === lead.id ? { ...m, lead: { ...m.lead, proximo_contato: anterior } } : m));
            avisar(faltaCampo
                ? tx("O \"próximo contato\" ainda não foi criado no banco. Peça ao administrador para rodar o SQL do Bloco 4 no Supabase.")
                : tx("Erro de conexão. A data não foi salva."));
            return false;
        }
        await registrarHistorico(lead.id, 'Agendamento', data ? `Próximo contato marcado para ${data.split('-').reverse().join('/')}.` : 'Próximo contato desmarcado.', true);
        return true;
    };

    // ==========================================
    // CATRACA DE IDENTIFICAÇÃO E RENDERIZAÇÃO
    // ==========================================
    // Só o pessoal da recepção opera o CRM (Líder/Admin acompanham pelo cartão de cada uma)
    const recepcionistas = colaboradores
        .filter(ehRecepcao)
        .filter(c => !unidadeTopo || String(c.unidade || '').toUpperCase() === unidadeTopo.toUpperCase())
        .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
    const recepcionistasAtivas = recepcionistas.filter(c => c.ativo !== false);


    const consultorLogado = consultorAtivo?.nome || '';
    // Alguém abrindo o CRM de outra pessoa (Líder/Admin/Mentor, ou uma recepcionista no cartão da colega)
    const lideraOuAcompanha = !mesmoNome(usuarioLogado?.nome, consultorLogado);
    const leadsNaBase = visitantes.filter(v => !v.puxado_em && v.status !== 'Arquivado' && daUnidadeOperacao(v) && podeContatar(v)).sort((a,b) => new Date(dataDoLead(b)) - new Date(dataDoLead(a)));
    // Nome comparado sem ligar para maiúsculas/acentos (o Novo Visitante grava o consultor em MAIÚSCULAS)
    const meusLeads = visitantes.filter(v => mesmoNome(v.puxado_por, consultorLogado) && v.status !== 'Arquivado' && podeContatar(v));
    // ultima_acao_em: data da última ação (só existe depois de ler o histórico; antes disso a etiqueta "parado" não aparece)
    const comUltimaAcao = (v) => (ultimasAcoes.carregado ? { ...v, ultima_acao_em: ultimasAcoes.mapa[String(v.id)] || null } : v);
    const meusLeadsAtivos = meusLeads.filter(v => v.puxado_em && v.status !== 'Perdido').map(comUltimaAcao);
    // Aba "Hoje": próximo contato marcado para hoje ou atrasado
    const pendentesProximo = meusLeadsAtivos.filter(v => ['hoje', 'atrasado'].includes(situacaoProximoContato(v))).length;
    // Número vermelho da aba Hoje: agendados (hoje/atrasados) + visitantes 24h/48h, atrasados e aniversariantes
    const totalHoje = pendentesProximo + (visaoLiberada.hoje ? pendentesHoje.total : 0);

    // Uma vez por dia (por recepcionista e unidade, neste navegador), havendo pendentes, o CRM abre na aba Hoje
    // (antes abria a janela "Contatos de hoje"; quem não tem a aba Hoje continua vendo a janela)
    useEffect(() => {
        if (!consultorAtivo || !unidadeOperacao || pendentesHoje.carregando) return;
        if (pendentesHoje.total + pendentesProximo === 0) return;
        const chave = `crm_contatos_hoje_${unidadeOperacao}_${consultorAtivo.nome}_${diaISO(0)}`;
        let jaAbriu = false;
        try { jaAbriu = sessionStorage.getItem(chave) === '1'; } catch { jaAbriu = false; }
        if (jaAbriu) return;
        try { sessionStorage.setItem(chave, '1'); } catch { /* navegador sem armazenamento: só não lembra */ }
        if (visaoLiberada.hoje) setVisaoAtivaEstado('hoje');
        else if (pendentesHoje.total > 0) setContatosHojeAberto(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [consultorAtivo, unidadeOperacao, pendentesHoje, pendentesProximo]);

    const meusLeadsGeladeira = meusLeads.filter(v => v.status === 'Perdido');
    // Abas que ficam no menu "Mais" (pouco usadas no dia a dia; nada foi tirado)
    const abasMais = [
        visaoLiberada.geladeira && ['geladeira', Snowflake, `${tx("Geladeira")} (${meusLeadsGeladeira.length})`, tx("Perdidos: esperam 30 dias e podem voltar para o Kanban")],
        visaoLiberada.naocontatar && ['naocontatar', Ban, tx("Não contatar"), tx("Pediram para não receber mais contato")],
        visaoLiberada.dashboard && ['dashboard', PieChart, tx("Métricas"), tx("Números da carteira")],
        visaoLiberada.relatorio && ['relatorio', Table, tx("Relatório"), tx("Relatório de conversão")],
    ].filter(Boolean);
    const abaMaisAtiva = abasMais.find(a => a[0] === visaoMostrada) || null;

    // Base (piscina): busca por nome, CPF ou telefone e páginas de 50
    const leadsNaBaseFiltrados = buscaBase.trim() ? leadsNaBase.filter(v => contatoCombinaComBusca(v, buscaBase)) : leadsNaBase;
    const totalPaginasBase = Math.max(1, Math.ceil(leadsNaBaseFiltrados.length / POR_PAGINA_BASE));
    const paginaBaseAtual = Math.min(paginaBase, totalPaginasBase);
    const leadsDaPaginaBase = leadsNaBaseFiltrados.slice((paginaBaseAtual - 1) * POR_PAGINA_BASE, paginaBaseAtual * POR_PAGINA_BASE);
    const paginaBaseToda = leadsDaPaginaBase.length > 0 && leadsDaPaginaBase.every(l => selecionadosBase.includes(l.id));
    const todosFiltradosSelecionados = leadsNaBaseFiltrados.length > 0 && leadsNaBaseFiltrados.every(l => selecionadosBase.includes(l.id));
    const marcarPaginaBase = (marcar) => {
        const idsPagina = leadsDaPaginaBase.map(l => l.id);
        setSelecionadosBase(prev => (marcar ? [...new Set([...prev, ...idsPagina])] : prev.filter(id => !idsPagina.includes(id))));
    };
    const mudarBuscaBase = (texto) => { setBuscaBase(texto); setPaginaBase(1); setSelecionadosBase([]); };


    // Próximo contato: abrir a janela para marcar/mudar a data. Depois de um WhatsApp num contato que estava
    // marcado para hoje (ou atrasado), o CRM já pergunta a próxima data.
    const abrirProximoContato = (lead) => setProximoPendente({ lead, posContato: false });
    const perguntarProximoSeMarcado = (lead) => {
        if (resultadoFunilRef.current) return; // a janela "Como foi o contato?" já marca o próximo contato
        if (['hoje', 'atrasado'].includes(situacaoProximoContato(lead))) setProximoPendente({ lead, posContato: true });
    };

    // RESULTADO DO CONTATO NO FUNIL (decisão do dono, 07/11/2026):
    //   Respondeu, vai pensar → próximo contato em 3 dias · Não respondeu → em 2 dias; na 3ª vez → Geladeira ("Não respondeu")
    //   Interessado → próximo contato amanhã · Não quer → Geladeira ("Sem interesse / mudou de ideia") · Comprou → Fechado.
    // Com data de volta depois de hoje, o contato vai para a coluna "Em Espera" (09/11/2026). No funil a janela é
    // obrigatória (sem "Decidir depois", decisão do dono 09/11/2026): todo contato sai com um caminho.
    // O resultado fica no histórico como "Agendamento" ("Resultado: ..."), que não conta na meta.
    const TEXTO_SEM_RESPOSTA = 'Resultado: não respondeu';
    const abrirResultadoFunil = (leadId) => {
        const lead = visitantes.find(v => String(v.id) === String(leadId));
        if (!lead || !['Novo', 'Em Contato'].includes(normalizarStatus(lead.status))) return;
        resultadoFunilRef.current = lead;
        setProximoPendente(p => (p?.posContato ? null : p));
        setResultadoFunil({ lead, tentativas: 0 });
        supabase.from('historico_leads').select('id', { count: 'exact', head: true }).eq('lead_id', String(lead.id)).eq('tipo_acao', 'Agendamento').like('observacao', `${TEXTO_SEM_RESPOSTA}%`)
            .then(({ count }) => setResultadoFunil(r => (r && r.lead.id === lead.id ? { ...r, tentativas: count || 0 } : r)));
    };
    const fecharResultadoFunil = () => { resultadoFunilRef.current = null; setResultadoFunil(null); };
    const aplicarResultadoFunil = async (tipo) => {
        const atual = resultadoFunil;
        fecharResultadoFunil();
        if (!atual) return;
        const lead = visitantes.find(v => v.id === atual.lead.id) || atual.lead;
        const hoje = diaISO(0);
        if (tipo === 'FECHOU') {
            await registrarHistorico(lead.id, 'Agendamento', 'Resultado: comprou / fechou.', true);
            await alterarStatus(lead.id, 'Fechado');
            return;
        }
        if (tipo === 'NAO_QUER') {
            await registrarHistorico(lead.id, 'Agendamento', 'Resultado: não quer.', true);
            await alterarStatus(lead.id, 'Perdido', 'Sem interesse / mudou de ideia');
            return;
        }
        if (tipo === 'SEM_RESPOSTA') {
            const tentativa = (atual.tentativas || 0) + 1;
            await registrarHistorico(lead.id, 'Agendamento', `${TEXTO_SEM_RESPOSTA} (tentativa ${tentativa} de 3).`, true);
            if (tentativa >= 3) { await alterarStatus(lead.id, 'Perdido', 'Não respondeu'); return; }
            await salvarProximoContato(lead, somarDiasISO(hoje, 2));
            return;
        }
        if (tipo === 'PENSANDO') {
            await registrarHistorico(lead.id, 'Agendamento', 'Resultado: respondeu, vai pensar.', true);
            await salvarProximoContato(lead, somarDiasISO(hoje, 3));
            return;
        }
        await registrarHistorico(lead.id, 'Agendamento', 'Resultado: interessado.', true);
        await salvarProximoContato(lead, somarDiasISO(hoje, 1));
    };

    // Meta: pessoas diferentes contatadas hoje (mandar 5 mensagens para a mesma pessoa conta 1)
    const pessoasHoje = contarPessoasDaMeta(progressoHoje);
    const pctMeta = Math.min(100, Math.round((pessoasHoje / META_DIARIA) * 100));
    const metaBatida = pessoasHoje >= META_DIARIA;

    // ==========================================
    // BASE (piscina) — reaproveitada em dois lugares (decisão do dono, 04/11/2026):
    // entrada do CRM (aba "Base"): Smart Paste, inserção manual, "Enviar para..." e "Mover"; área da recepcionista: fila e lista.
    // ==========================================
    // ==========================================
    // BASE (piscina) na aba EQUIPE da entrada do CRM (decisão do dono, 04/11/2026):
    // Smart Paste (principal) → Distribuir / Mover → Banco Bruto (contatos ainda sem recepcionista).
    // ==========================================
    // Base em 3 passos (07/11/2026, decisão do dono): 1 Importar (Smart Paste / Puxar do cadastro) · 2 Banco Bruto ·
    // 3 Distribuir (Distribuir / Mover). Fechado por padrão: abre o passo clicado. Mostra as carteiras × limite.
    const cabecalhoBase = () => {
        const ativas = recepcionistas.filter(c => c.ativo !== false);
        const carteiras = ativas.map(c => ({ nome: c.nome, total: carteiraDe(c.nome).length }));
        const vagas = carteiras.reduce((t, c) => t + Math.max(0, LIMITE_CARTEIRA - c.total), 0);
        const excedentes = excedentesCarteira();
        const qtdExcedente = excedentes.reduce((t, x) => t + x.ids.length, 0);
        // Antes da lista completa (entrada do CRM), o Banco Bruto vem contado no banco (10/11/2026)
        const qtdNaBase = listaCompleta ? leadsNaBase.length : (contagemBase ?? 0);
        const passos = [
            { id: 'importar', n: 1, titulo: 'Importar', texto: tx('Smart Paste ou Puxar do cadastro'), destaque: qtdNaBase === 0 },
            { id: 'banco', n: 2, titulo: 'Banco Bruto', texto: tx('{qtd} contatos esperando', { qtd: qtdNaBase }), destaque: false },
            { id: 'distribuir', n: 3, titulo: 'Distribuir', texto: tx('{qtd} vagas nas carteiras', { qtd: vagas }), destaque: qtdNaBase > 0 && vagas > 0 }
        ];
        return (
            <div id="crm-abastecer-carteiras" className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-3 scroll-mt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 flex items-center gap-2"><Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />{tx('Abastecer carteiras')}</h3>
                    <span className="text-[10px] font-bold text-slate-400">{tx('Limite: {limite} contatos em atendimento por recepcionista', { limite: LIMITE_CARTEIRA })}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {passos.map(p => {
                        const aberto = passoBase === p.id;
                        return (
                            <button key={p.id} type="button" onClick={() => setPassoBase(aberto ? '' : p.id)} className={`text-left rounded-xl border px-3 py-2.5 flex items-center gap-3 transition-all ${aberto ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 ring-2 ring-blue-500/20' : p.destaque ? 'border-blue-300 dark:border-blue-500/40 hover:bg-blue-50/50 dark:hover:bg-blue-500/5' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}>
                                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-black shrink-0 ${aberto || p.destaque ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>{p.n}</span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[11px] font-black uppercase tracking-widest text-slate-800 dark:text-white">{tx(p.titulo)}</span>
                                    <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">{p.texto}</span>
                                </span>
                                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} />
                            </button>
                        );
                    })}
                </div>
                {/* Frase direta do que fazer (09/11/2026, decisão do dono) */}
                {qtdNaBase > 0 && vagas > 0 && passoBase !== 'distribuir' && (
                    <button type="button" onClick={() => setPassoBase('distribuir')} className="w-full text-left rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 px-3 py-2 text-[11px] font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5 transition-colors">
                        <ArrowRight className="w-4 h-4 shrink-0" />{tx('Tem {vagas} vagas nas carteiras e {qtd} contatos esperando: clique em Distribuir.', { vagas: vagas.toLocaleString(localeAtual()), qtd: qtdNaBase.toLocaleString(localeAtual()) })}
                    </button>
                )}
                {/* Carteira de cada uma × limite: só no passo Distribuir (os cartões da equipe já mostram; 09/11/2026) */}
                {carteiras.length > 0 && passoBase === 'distribuir' && (
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {carteiras.map(c => {
                            const acima = c.total > LIMITE_CARTEIRA;
                            return (
                                <span key={c.nome} className="flex items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-300" title={tx('Carteira: contatos em atendimento (Novo + Em Contato)')}>
                                    {c.nome.split(' ')[0]}
                                    <span className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><span className={`block h-full rounded-full ${acima ? 'bg-rose-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, (c.total / LIMITE_CARTEIRA) * 100)}%` }} /></span>
                                    <span className={`tabular-nums font-black ${acima ? 'text-rose-600 dark:text-rose-400' : ''}`}>{c.total.toLocaleString(localeAtual())}/{LIMITE_CARTEIRA}</span>
                                </span>
                            );
                        })}
                    </div>
                )}
                {qtdExcedente > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2">
                        <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0" />{tx('{qtd} contatos acima do limite de {limite} ({quem}).', { qtd: qtdExcedente.toLocaleString(localeAtual()), limite: LIMITE_CARTEIRA, quem: excedentes.map(x => x.nome.split(' ')[0]).join(', ') })}</span>
                        <button type="button" onClick={() => devolverExcedente(excedentes)} className="h-8 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-widest">{tx('Devolver excedente para o Banco Bruto')}</button>
                    </div>
                )}
            </div>
        );
    };

    const blocoBase = () => (
                <div className="space-y-4">
                    {cabecalhoBase()}
                    {/* Carga da lista completa da unidade (10/11/2026): só quando um passo é aberto */}
                    {passoBase && !listaCompleta && (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400 shrink-0" />
                            {tx('Carregando o Banco Bruto da unidade...')}
                            {progressoCarga.total ? <span className="tabular-nums">{tx('{feitos} de {total} contatos', { feitos: progressoCarga.feitos.toLocaleString(localeAtual()), total: progressoCarga.total.toLocaleString(localeAtual()) })}</span> : null}
                        </div>
                    )}
                    {passoBase === 'importar' && listaCompleta && (<>
<div className="bg-white dark:bg-slate-900 rounded-[24px] border-2 border-emerald-500/30 shadow-lg shadow-emerald-500/10 overflow-hidden animate-[slideUp_0.4s_ease-out] p-6 lg:p-8 flex flex-col h-full relative">
                        <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-bl-2xl shadow-sm">{tx("Mais Rápido ⚡")}</div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
                                <ClipboardPaste className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">{tx("Smart Paste")}</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tx("Injeção em Lote")}</p>
                            </div>
                        </div>

                        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 p-4 rounded-2xl mb-4 text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-start gap-3">
                            <Info className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                            <p>{tx("Exporte a lista no TECACE, copie as linhas (com o cabeçalho), dê")}{' '}<kbd className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/30 shadow-sm font-mono text-[10px]">{tx("Ctrl+C")}</kbd>{' '}{tx("e cole abaixo com")}{' '}<kbd className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/30 shadow-sm font-mono text-[10px]">{tx("Ctrl+V")}</kbd>.</p>
                        </div>

                        <select value={tipoLeadSmartPaste} onChange={(e) => { setTipoLeadSmartPaste(e.target.value); processarColagem(textoSmartPaste, e.target.value); }} className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs font-black text-slate-700 dark:text-slate-200 outline-none uppercase shadow-sm mb-4 cursor-pointer">
                            <option value="AUTO">{tx("Automático: pelo Status do TECACE")}</option>
                            <option value="VISITANTE">{tx("Classificar lote como: VISITANTE")}</option>
                            <option value="CANCELADO">{tx("Classificar lote como: CANCELADO")}</option>
                            <option value="INATIVO">{tx("Classificar lote como: INATIVO")}</option>
                        </select>

                        <textarea 
                            value={textoSmartPaste} onChange={(e) => processarColagem(e.target.value)} placeholder={tx("Cole aqui...")}
                            className="w-full flex-1 min-h-[180px] bg-slate-50 dark:bg-slate-800/60 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-5 text-sm font-mono text-slate-600 dark:text-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all resize-none custom-scrollbar whitespace-pre dark:focus:bg-slate-900"
                        />

                        {previewLeads.length > 0 && (
                            <div className="mt-4 animate-[zoomIn_0.2s_ease-out]">
                                {pasteSemTipo && (
                                    <div className="mb-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-xl px-4 py-3 flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>{tx("Esta lista não é do TECACE (não tem a coluna Status), então o modo \"Automático\" não sabe o tipo. Escolha acima se o lote é")}{' '}<strong>{tx("VISITANTE")}</strong>, <strong>{tx("CANCELADO")}</strong>{' '}{tx("ou")}{' '}<strong>{tx("INATIVO")}</strong>.</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 px-2 py-1 rounded-md">{estatisticasPaste.novos}{' '}{tx("Novos")}</span>
                                        {estatisticasPaste.duplicados > 0 && (
                                            <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 px-2 py-1 rounded-md flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3"/> {estatisticasPaste.duplicados}{' '}{tx("Ignorados")}
                                            </span>
                                        )}
                                    </div>
                                    <button onClick={() => {setTextoSmartPaste(''); setPreviewLeads([]); setEstatisticasPaste({novos:0, duplicados:0});}} className="text-[10px] font-black uppercase text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 flex items-center gap-1 transition-colors"><Trash2 className="w-3 h-3"/>{' '}{tx("Limpar")}</button>
                                </div>
                                
                                <div className="max-h-[140px] overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl mb-4">
                                    <table className="w-full text-left">
                                        <tbody>
                                            {previewLeads.slice(0,50).map((l) => (
                                                <tr key={l.id_temp} className={`border-b border-slate-100 dark:border-slate-800 last:border-0 text-[10px] uppercase font-bold transition-opacity ${l.isDuplicado ? 'text-slate-400 opacity-60 bg-slate-100/50 dark:bg-slate-800' : 'text-slate-700 dark:text-slate-200'}`}>
                                                    <td className="px-3 py-2 truncate max-w-[140px] flex items-center">
                                                        {l.isDuplicado && <span className="mr-2 text-[10px] bg-rose-100 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded shadow-sm font-black whitespace-nowrap">{l.motivo}</span>}
                                                        <span className="truncate">{l.nome}</span>
                                                    </td>
                                                    <td className="px-3 py-2">{l.telefone || 'S/N'}</td>
                                                    <td className="px-3 py-2 text-right">{l.tipo && <span className={`px-1.5 py-0.5 rounded border text-[10px] font-black tracking-widest ${classeTipoLead(l.tipo)}`}>{tx(l.tipo)}</span>}</td>
                                                </tr>
                                            ))}
                                            {previewLeads.length > 50 && (
                                                <tr><td colSpan="3" className="px-3 py-2 text-center text-[10px] font-bold text-slate-400">{tx("...e mais")}{' '}{previewLeads.length - 50}{' '}{tx("linhas")}</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                
                                <button onClick={confirmarSmartPaste} disabled={processandoPaste || estatisticasPaste.novos === 0 || pasteSemTipo} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:bg-slate-300 disabled:text-slate-500 text-white font-black py-4 rounded-xl shadow-[0_4px_15px_rgba(16,185,129,0.3)] transition-all uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 dark:disabled:text-slate-400">
                                    {processandoPaste ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" />{' '}{tx("Salvar")}{' '}{estatisticasPaste.novos}{' '}{tx("Novos no Banco")}</>}
                                </button>
                            </div>
                        )}
                    </div>
{podeFazer(usuarioLogado, '520') && (
                        <PuxarDoCadastro
                            unidade={unidadeOperacao}
                            onSalvos={(salvos, status) => {
                                adicionarLeads(salvos);
                                registrarHistoricoLote(salvos.map(l => l.id), 'Importação em Lote', `Inserido na Base pelo "Puxar do cadastro" (${status.join(', ')}).`);
                            }}
                        />
                    )}
                    </>)}
                    {passoBase === 'distribuir' && listaCompleta && (
<div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-5">
                            <div>
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2"><Send className="w-4 h-4" />{' '}{tx("Distribuir contatos")}</h3>
                                <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400"><strong className="text-blue-600 dark:text-blue-400">{leadsNaBase.length}{' '}{tx("leads")}</strong>{' '}{tx("na Base da unidade. Envie um lote para uma recepcionista (os mais antigos primeiro) ou marque na lista abaixo.")}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <select value={qtdEnvio} onChange={(e) => setQtdEnvio(Number(e.target.value))} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-3 text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 outline-none">
                                    {[10, 15, 20, 30, 50].map(n => <option key={n} value={n}>{tx("{qtd} contatos", { qtd: n })}</option>)}
                                </select>
                                <select value={recepEnvio} onChange={(e) => setRecepEnvio(e.target.value)} className="flex-1 min-w-[160px] bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-3 text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 outline-none">
                                    <option value="">{tx("Para quem?")}</option>
                                    {recepcionistasAtivas.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                                </select>
                                <button type="button" onClick={distribuirLote} disabled={!recepEnvio || leadsNaBase.length === 0} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black px-5 py-3 rounded-xl transition-all flex items-center gap-2 uppercase text-[10px] tracking-widest">
                                    <Send className="w-4 h-4" />{' '}{tx("Enviar")}
                                </button>
                                <button type="button" onClick={dividirIgualmente} disabled={leadsNaBase.length === 0 || recepcionistasAtivas.length < 2} title={tx("Reparte toda a Base entre as recepcionistas ativas, em rodízio")} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black px-5 py-3 rounded-xl transition-all flex items-center gap-2 uppercase text-[10px] tracking-widest">{tx("Dividir igualmente")}</button>
                            </div>
                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 lg:pt-0 lg:border-t-0 lg:border-l lg:pl-8 lg:row-span-2 lg:col-start-2 lg:row-start-1">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{tx("Mover de uma recepcionista para outra")}</h4>
                                <div className="flex flex-wrap items-center gap-2">
                                    <select value={moverDe} onChange={(e) => setMoverDe(e.target.value)} className="flex-1 min-w-[140px] bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-3 text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 outline-none">
                                        <option value="">{tx("De...")}</option>
                                        {recepcionistasAtivas.map(c => <option key={c.id} value={c.nome}>{c.nome} ({contatosParaMover(c.nome).length})</option>)}
                                    </select>
                                    <select value={moverPara} onChange={(e) => setMoverPara(e.target.value)} className="flex-1 min-w-[140px] bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-3 text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 outline-none">
                                        <option value="">{tx("Para...")}</option>
                                        {recepcionistasAtivas.filter(c => !mesmoNome(c.nome, moverDe)).map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                                    </select>
                                    <select value={moverQtd} onChange={(e) => setMoverQtd(Number(e.target.value))} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-3 text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 outline-none">
                                        {[10, 15, 20, 30, 50, 9999].map(n => <option key={n} value={n}>{n === 9999 ? tx("Todos") : n}</option>)}
                                    </select>
                                    <button type="button" onClick={moverEntre} disabled={!moverDe || !moverPara} className="bg-slate-800 hover:bg-black disabled:opacity-50 text-white font-black px-5 py-3 rounded-xl transition-all uppercase text-[10px] tracking-widest">{tx("Mover")}</button>
                                </div>
                                <p className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tx("Só move contatos ainda não trabalhados (fase Novo). O que já teve contato fica com quem fez.")}</p>
                            </div>
                        </div>
                    )}
                    {passoBase === 'banco' && listaCompleta && (
<div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm p-6 lg:p-8">
                        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2 tracking-tight">
                                    <Database className="w-5 h-5 text-blue-500"/>{' '}{tx("Banco Bruto")} 
                                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-2 border border-slate-200 dark:border-slate-800">{buscaBase.trim() ? tx("{length} de {length2}", { length: leadsNaBaseFiltrados.length, length2: leadsNaBase.length }) : leadsNaBase.length}{' '}{tx("Registros")}</span>
                                </h3>
                                <div className="relative mt-3">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    <input
                                        type="text"
                                        value={buscaBase}
                                        onChange={(e) => mudarBuscaBase(e.target.value)}
                                        placeholder={tx("Buscar por nome, CPF ou telefone")}
                                        className="w-72 max-w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 shadow-sm"
                                    />
                                    {buscaBase && (
                                        <button type="button" onClick={() => mudarBuscaBase('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white" title={tx("Limpar busca")}>
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            {selecionadosBase.length > 0 && (
                                <div className="flex items-center gap-3 animate-[fadeIn_0.2s_ease-out]">
                                    {podeApagar && (
                                        <button onClick={excluirSelecionadosBase} className="bg-rose-100 dark:bg-rose-500/20 hover:bg-rose-200 dark:hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 font-black px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 uppercase text-[10px] tracking-widest">
                                            <Trash2 className="w-4 h-4" />{' '}{tx("Apagar do Banco (")}{selecionadosBase.length})
                                        </button>
                                    )}
                                    <div className="flex items-center gap-2">
                                            <select value={recepEnvio} onChange={(e) => setRecepEnvio(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 outline-none">
                                                <option value="">{tx("Enviar para...")}</option>
                                                {recepcionistasAtivas.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                                            </select>
                                            <button type="button" onClick={() => enviarPara(selecionadosBase, recepEnvio)} disabled={!recepEnvio} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 uppercase text-[10px] tracking-widest">
                                                <Send className="w-4 h-4" />{' '}{tx("Enviar ({qtd})", { qtd: selecionadosBase.length })}
                                            </button>
                                        </div>
                                </div>
                            )}
                        </div>

                        <div className="overflow-x-auto custom-scrollbar border border-slate-200 dark:border-slate-800 rounded-xl max-h-[400px]">
                            <table className="w-full text-left border-collapse min-w-max relative">
                                <thead className="bg-slate-50 dark:bg-slate-800/60 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-3 text-center w-12 border-b border-slate-200 dark:border-slate-800">
                                            <input 
                                                type="checkbox" 
                                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-blue-600 dark:text-blue-400 focus:ring-blue-500 cursor-pointer"
                                                checked={paginaBaseToda}
                                                onChange={(e) => marcarPaginaBase(e.target.checked)}
                                                title={tx("Selecionar os contatos desta página")}
                                            />
                                        </th>
                                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">{tx("Aluno / Lead")}</th>
                                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">{tx("Contato (WhatsApp)")}</th>
                                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">{tx("Tipo")}</th>
                                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">{tx("Data Base")}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                    {leadsDaPaginaBase.length > 0 ? leadsDaPaginaBase.map(v => (
                                        <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer" onClick={() => {
                                            if (selecionadosBase.includes(v.id)) setSelecionadosBase(prev => prev.filter(id => id !== v.id));
                                            else setSelecionadosBase(prev => [...prev, v.id]);
                                        }}>
                                            <td className="px-4 py-3 text-center border-b border-slate-100 dark:border-slate-800">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-blue-600 dark:text-blue-400 focus:ring-blue-500 cursor-pointer"
                                                    checked={selecionadosBase.includes(v.id)}
                                                    onChange={() => {}}
                                                    onClick={(e) => e.stopPropagation()} 
                                                />
                                            </td>
                                            <td className="px-6 py-3 border-b border-slate-100 dark:border-slate-800">
                                                <p className="text-xs font-black text-slate-800 dark:text-white uppercase">{v.nome}</p>
                                                {v.cpf && <p className="text-[10px] font-bold text-slate-400 mt-0.5 tracking-wider">{tx("CPF:")}{' '}{v.cpf}</p>}
                                            </td>
                                            <td className="px-6 py-3 border-b border-slate-100 dark:border-slate-800">
                                                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{v.telefone}</p>
                                            </td>
                                            <td className="px-6 py-3 border-b border-slate-100 dark:border-slate-800">
                                                <span className={`px-2 py-1 rounded text-[10px] font-black tracking-widest uppercase border ${classeTipoLead(v.tipo_lead)}`}>
                                                    {tx(v.tipo_lead || 'N/A')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                                                {dataDoLead(v) ? new Date(dataDoLead(v)).toLocaleDateString(localeAtual()) : '—'}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="5" className="text-center py-10 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                                {leadsNaBase.length > 0 ? tx("Nenhum contato encontrado nesta busca.") : tx("A piscina de leads está vazia. Cole dados no Smart Paste para começar.")}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* PÁGINAS E SELEÇÃO DE TODOS OS ENCONTRADOS */}
                        {leadsNaBaseFiltrados.length > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-3">
                                    <span>{leadsNaBaseFiltrados.length}{' '}{tx("contatos")}{selecionadosBase.length > 0 ? " " + tx("· {length} selecionados", { length: selecionadosBase.length }) + "" : ''}</span>
                                    {paginaBaseToda && !todosFiltradosSelecionados && (
                                        <button type="button" onClick={() => setSelecionadosBase(leadsNaBaseFiltrados.map(l => l.id))} className="text-blue-600 dark:text-blue-400 hover:underline underline-offset-2">
                                            {tx("Selecionar todos os")}{' '}{leadsNaBaseFiltrados.length}{' '}{tx("encontrados")}
                                        </button>
                                    )}
                                    {selecionadosBase.length > 0 && (
                                        <button type="button" onClick={() => setSelecionadosBase([])} className="text-slate-400 hover:text-slate-700 dark:hover:text-white hover:underline underline-offset-2">
                                            {tx("Limpar seleção")}
                                        </button>
                                    )}
                                </div>
                                {totalPaginasBase > 1 && (
                                    <div className="flex items-center gap-2">
                                        <button type="button" onClick={() => setPaginaBase(Math.max(1, paginaBaseAtual - 1))} disabled={paginaBaseAtual <= 1} className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed">
                                            <ChevronLeft className="w-3.5 h-3.5" />{' '}{tx("Anterior")}
                                        </button>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{tx("Página")}{' '}{paginaBaseAtual}{' '}{tx("de")}{' '}{totalPaginasBase}</span>
                                        <button type="button" onClick={() => setPaginaBase(Math.min(totalPaginasBase, paginaBaseAtual + 1))} disabled={paginaBaseAtual >= totalPaginasBase} className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed">
                                            {tx("Próxima")}{' '}<ChevronRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    )}
                </div>
    );

    // Carga dos contatos: na entrada só na primeira vez (depois fica guardado); no CRM de uma recepcionista, enquanto
    // a lista completa da unidade dela não chega (10/11/2026)
    if (!contatosCarregados || (carregandoLista && consultorAtivo)) {
        const { feitos, total } = progressoCarga;
        const pct = total ? Math.min(100, Math.round((feitos / total) * 100)) : null;
        return (
            <div className="h-full flex items-center justify-center p-6">
                <div className="w-[min(420px,100%)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5">
                    <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                        <Loader2 className="w-5 h-5 shrink-0 animate-spin text-blue-600 dark:text-blue-400" />
                        <p className="text-xs font-black uppercase tracking-widest">{consultorAtivo ? tx('Carregando os contatos de {unidade}...', { unidade: unidadeLista }) : tx("Carregando os contatos do CRM...")}</p>
                    </div>
                    <div className="mt-4 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined}>
                        <div className={`h-full rounded-full bg-blue-600 dark:bg-blue-500 transition-all duration-300 ${pct === null ? 'w-1/4 animate-pulse' : ''}`} style={pct === null ? undefined : { width: `${Math.max(pct, 3)}%` }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                        <span>{total ? tx('{feitos} de {total} contatos', { feitos: feitos.toLocaleString(localeAtual()), total: total.toLocaleString(localeAtual()) }) : tx('Conferindo quantos contatos são...')}</span>
                        {pct !== null && <span className="text-blue-600 dark:text-blue-400 font-black">{pct}%</span>}
                    </div>
                </div>
            </div>
        );
    }

    if (!consultorAtivo) {
        return (
            <PainelInicialCrm
                usuarioLogado={usuarioLogado}
                recepcionistas={recepcionistas}
                leads={visitantes}
                colaboradores={colaboradores}
                versao={versaoDados}
                onAtualizar={atualizarAgora}
                onEscolher={(c) => { setConsultorAtivo(c); if (ehRecepcao(usuarioLogado) && visaoLiberada.hoje) setVisaoAtivaEstado('hoje'); }}
                conteudoBase={unidadeOperacao && podeFazer(usuarioLogado, '517') ? blocoBase() : null}
                onAbrirDistribuir={unidadeOperacao && podeFazer(usuarioLogado, '517') ? () => { setPassoBase('distribuir'); setTimeout(() => document.getElementById('crm-abastecer-carteiras')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } : null}
            />
        );
    }
    return (
        <div className="space-y-6 animate-[fadeIn_0.4s_ease-out] max-w-[1400px] mx-auto relative">

            {/* TOPO ENXUTO (decisão do dono, 06/11/2026): operador, meta, botões e abas numa faixa só */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="px-4 py-2.5 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-[260px]">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${metaBatida ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400'}`}>
                            {metaBatida ? <Trophy className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 max-w-xl min-w-0">
                            <div className="flex justify-between items-center gap-2 mb-1">
                                <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest flex items-center gap-1.5 min-w-0">
                                    <strong className="text-blue-600 dark:text-blue-400 truncate" title={consultorLogado}>{consultorLogado}</strong>
                                    {unidadeOperacao && <span className="shrink-0 px-1.5 py-px rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">{unidadeOperacao}</span>}
                                    {/* Quem está operando o CRM de outra pessoa: etiqueta pequena (antes era uma faixa azul inteira) */}
                                    {lideraOuAcompanha && (
                                        <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-px rounded bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 cursor-help"
                                            title={`${tx("Você está vendo o CRM de")} ${consultorLogado}${tx(". O que você fizer aqui conta para")} ${consultorLogado.split(' ')[0]}${tx(", com a marca \"feito por")} ${usuarioLogado?.nome?.split(' ')[0] || tx("você")}${tx("\" no histórico.")}`}>
                                            <Info className="w-3 h-3" />{tx("feito por")}{' '}{usuarioLogado?.nome?.split(' ')[0] || tx("você")}
                                        </span>
                                    )}
                                </span>
                                <span className={`shrink-0 text-[11px] font-black ${metaBatida ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>{pessoasHoje} / {META_DIARIA}{' '}{tx("Pessoas contatadas")}</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                <div className={`h-1.5 rounded-full transition-all duration-500 ease-out ${metaBatida ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{ width: `${pctMeta}%` }}></div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        {/* Sem a aba Hoje (permissão 508), os contatos de hoje continuam na janela de antes */}
                        {!visaoLiberada.hoje && (
                            <button onClick={() => setContatosHojeAberto(true)} className={`h-8 px-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-1.5 border ${pendentesHoje.total > 0 ? 'bg-blue-600 text-white hover:bg-blue-700 border-blue-700' : 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 border-slate-200 dark:border-slate-800'}`}>
                                <CalendarCheck className="w-3.5 h-3.5" />{' '}{tx("Contatos de hoje")}{pendentesHoje.total > 0 ? ` (${pendentesHoje.total})` : ''}
                            </button>
                        )}
                        <button onClick={() => setConsultorAtivo(null)} className="h-8 px-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800">
                            <LogOut className="w-3.5 h-3.5" /> {lideraOuAcompanha ? tx("Voltar ao Painel") : tx("Trocar")}
                        </button>
                        <button onClick={() => setMostrarRelatorio(true)} className={`h-8 px-4 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-1.5 ${metaBatida ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-slate-800 text-white hover:bg-black border border-slate-700'}`}>
                            <FileText className="w-3.5 h-3.5" />{' '}{tx("Fechar Turno")}
                        </button>
                    </div>
                </div>

                {/* ABAS: Conversa | Kanban | Lista · Hoje · Migração · Mais ▾ (Geladeira, Não contatar, Métricas, Relatório) */}
                <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 flex-wrap">
                    <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 gap-0.5">
                        {[
                            visaoLiberada.conversa && ['conversa', MessagesSquare, tx("Conversa")],
                            ['kanban', KanbanIcon, tx("Kanban")],
                            visaoLiberada.lista && ['lista', List, tx("Lista")],
                        ].filter(Boolean).map(([chave, Icone, rotulo]) => (
                            <button key={chave} onClick={() => setVisaoAtiva(chave)} className={`h-8 px-3 rounded-md text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${visaoMostrada === chave ? 'bg-blue-600 shadow-sm text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}>
                                <Icone className="w-3.5 h-3.5" />{rotulo}
                            </button>
                        ))}
                    </div>
                    {[
                        visaoLiberada.hoje && ['hoje', CalendarClock, tx("Hoje"), totalHoje, tx("Tudo para fazer hoje: agendados, visitantes 24h/48h, atrasados e aniversariantes")],
                        visaoLiberada.migracao && ['migracao', Repeat, tx("Migração"), 0, ''],
                        visaoLiberada.resgate && ['resgate', LifeBuoy, tx("Resgate"), 0, tx("Alunos finalizados e inativos para chamar de volta")],
                    ].filter(Boolean).map(([chave, Icone, rotulo, qtd, dica]) => (
                        <button key={chave} onClick={() => setVisaoAtiva(chave)} title={dica || undefined} className={`h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${visaoMostrada === chave ? 'bg-blue-600 shadow-sm text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-white'}`}>
                            <Icone className="w-3.5 h-3.5" />{rotulo}
                            {qtd > 0 && <span className={`min-w-[18px] px-1.5 py-px rounded-full text-[10px] font-black ${visaoMostrada === chave ? 'bg-white text-blue-700 dark:bg-slate-900 dark:text-blue-400' : 'bg-rose-600 text-white'}`}>{qtd}</span>}
                        </button>
                    ))}
                    {abasMais.length > 0 && (
                        <div className="relative">
                            <button onClick={() => setMaisAberto(a => !a)} className={`h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${abaMaisAtiva ? 'bg-blue-600 shadow-sm text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-white'}`}>
                                <MoreHorizontal className="w-3.5 h-3.5" />{abaMaisAtiva ? abaMaisAtiva[2] : tx("Mais")}<ChevronDown className="w-3 h-3" />
                            </button>
                            {maisAberto && (
                                <>
                                    <div className="fixed inset-0 z-30" onClick={() => setMaisAberto(false)} />
                                    <div className="absolute left-0 top-full mt-1 z-40 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg p-1">
                                        {abasMais.map(([chave, Icone, rotulo, dica]) => (
                                            <button key={chave} onClick={() => { setVisaoAtiva(chave); setMaisAberto(false); }} className={`w-full text-left px-3 py-2 rounded-lg flex items-start gap-2 transition-colors ${visaoMostrada === chave ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                                <Icone className="w-4 h-4 mt-0.5 shrink-0" />
                                                <span>
                                                    <span className="block text-[11px] font-black uppercase tracking-widest">{rotulo}</span>
                                                    <span className="block text-[10px] font-medium text-slate-400">{dica}</span>
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ABA GELADEIRA (RECUPERAÇÃO) */}
            {visaoMostrada === 'geladeira' && (
                <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-cyan-200 dark:border-cyan-500/30 shadow-sm p-6 lg:p-8 animate-[fadeIn_0.3s_ease-out]">
                    <div className="flex items-center gap-4 mb-8 border-b border-slate-100 dark:border-slate-800 pb-6">
                        <div className="w-14 h-14 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-500 rounded-2xl flex items-center justify-center shadow-inner">
                            <Snowflake className="w-7 h-7" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{tx("Geladeira de Contatos (30 Dias)")}</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{tx("Contatos que deram \"Perdido\". Aguarde o tempo de maturação para tentar resgatá-los para o Kanban.")}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {meusLeadsGeladeira.length === 0 ? (
                            <p className="text-slate-400 font-bold col-span-3 text-center py-10 uppercase tracking-widest text-xs">{tx("Sua geladeira está vazia.")}</p>
                        ) : (
                            meusLeadsGeladeira.map(v => {
                                const diasNaGeladeira = Math.floor((new Date() - new Date(v.perdido_em)) / (1000 * 60 * 60 * 24));
                                const liberado = diasNaGeladeira >= 30;

                                return (
                                    <div key={v.id} className={`p-5 rounded-2xl border ${liberado ? 'border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60'} relative flex flex-col`}>
                                        <h4 className="font-black text-slate-800 dark:text-white uppercase text-sm mb-1 pr-10">{v.nome}</h4>
                                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-4">{v.telefone}</p>
                                        {v.motivo_perda && (
                                            <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-lg px-2.5 py-1.5 mb-4 w-fit max-w-full truncate" title={v.motivo_perda}>
                                                {tx("Motivo:")}{' '}{tx(v.motivo_perda)}
                                            </p>
                                        )}

                                        <div className="mt-auto pt-4 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${liberado ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-200/50 dark:bg-emerald-500/25' : 'text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800'}`}>
                                                {diasNaGeladeira} / 30 Dias
                                            </span>
                                            
                                            <button 
                                                onClick={() => alterarStatus(v.id, 'Novo')}
                                                disabled={!liberado}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${liberado ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'}`}
                                                title={liberado ? tx("Resgatar para o Kanban") : tx("Ainda em maturação")}
                                            >
                                                <RotateCcw className="w-3.5 h-3.5" />{' '}{tx("Resgatar")}
                                            </button>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            )}

            {/* ABA BASE DE LEADS */}

            {/* MÓDULOS EXTERNOS */}
            {visaoMostrada === 'dashboard' && <Metricas visitantes={meusLeads} colaboradores={colaboradores} operador={consultorLogado} />}
            
            {/* ✅ ABA RELATÓRIO RENDERIZADA COM O COMPONENTE NOVO */}
            {visaoMostrada === 'relatorio' && (
                <RelatorioCrm 
                    visitantes={visitantes} 
                    temVisaoGlobal={temVisaoGlobal} 
                    usuarioLogado={usuarioLogado}
                />
            )}
            
            {visaoMostrada === 'kanban' && (
                <div className="relative z-20 flex items-center justify-end gap-2 mb-3">
                    <span className="mr-auto text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {tx('Em trabalho {qtd}/{limite} · Em espera {espera}', { qtd: carteiraDe(consultorAtivo?.nome || '').length, limite: LIMITE_CARTEIRA, espera: emEsperaDe(consultorAtivo?.nome || '') })}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{tx('Ordem')}</span>
                    <select value={ordemContatos} onChange={(e) => { setOrdemContatos(e.target.value); salvarOrdemContatos(e.target.value); }} className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 outline-none">
                        {ORDENS_CONTATOS.map(o => <option key={o.val} value={o.val}>{tx(o.label)}</option>)}
                    </select>
                </div>
            )}
            {visaoMostrada === 'kanban' && (
                <Kanban 
                    ordem={ordemContatos}
                    visitantes={meusLeadsAtivos} 
                    alterarStatus={moverFase} 
                    deletarLead={deletarLead} 
                    setModalWpp={setModalWpp} 
                    setModalDetalhe={setModalDetalhe} 
                    carregarHistoricoLead={carregarHistoricoLead} 
                    registrarHistorico={registrarHistorico}
                    usuarioLogado={usuarioLogado}
                    podeApagar={podeApagar}
                    onProximoContato={abrirProximoContato}
                />
            )}
            
            {/* PUXAR CONTATOS (07/11/2026): carteira acabando (menos de 30 para trabalhar) e Banco Bruto com contatos */}
            {consultorAtivo && (() => {
                const paraTrabalhar = meusLeadsAtivos.filter(v => prioridadeContato(v).nivel <= 4).length;
                const naBase = leadsNaBase.length;
                if (paraTrabalhar >= 30 || naBase === 0) return null;
                const vaga = vagaDe(consultorAtivo.nome);
                const puxar = (qtd) => enviarPara(leadsNaBase.slice().sort((a, b) => new Date(dataDoLead(a)).getTime() - new Date(dataDoLead(b)).getTime()).slice(0, qtd).map(l => l.id), consultorAtivo.nome);
                return (
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-4 py-3">
                        <span className="text-[12px] font-bold text-blue-800 dark:text-blue-300">
                            📥 {tx('Sua carteira está acabando: {qtd} contato(s) para trabalhar. Há {base} no Banco Bruto.', { qtd: paraTrabalhar, base: naBase })}
                            {vaga <= 0 && <span className="block text-rose-600 dark:text-rose-400">{tx('Carteira cheia ({limite} em trabalho). Responda "Como foi o contato?" ou coloque em Em Espera quem já foi contatado para liberar vagas.', { limite: LIMITE_CARTEIRA })}</span>}
                        </span>
                        <span className="flex items-center gap-2">
                            {[25, 50, 100].map(q => (
                                <button key={q} type="button" onClick={() => puxar(q)} disabled={vaga <= 0} className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest">{tx('Puxar {qtd}', { qtd: q })}</button>
                            ))}
                        </span>
                    </div>
                );
            })()}

            {visaoMostrada === 'conversa' && (
                <Conversa
                    visitantes={meusLeadsAtivos}
                    registrarHistorico={registrarHistorico}
                    alterarStatus={moverFase}
                    deletarLead={deletarLead}
                    podeApagar={podeApagar}
                    usuarioLogado={usuarioLogado}
                    onProximoContato={abrirProximoContato}
                    aoEnviarWhatsApp={perguntarProximoSeMarcado}
                    onNaoContatar={setNaoContatarAlvo}
                    abrirFicha={(lead) => { setModalDetalhe({ show: true, lead }); carregarHistoricoLead(lead.id); }}
                    versao={versaoDados}
                    todosLeads={visitantes}
                    contatosDoDia={contatosDoDia}
                    unidade={unidadeOperacao}
                />
            )}

            {visaoMostrada === 'lista' && (
                <Lista 
                    visitantes={meusLeadsAtivos} 
                    alterarStatus={moverFase} 
                    deletarLead={deletarLead} 
                    alterarStatusEmLote={alterarStatusEmLote}
                    deletarLeadsEmLote={deletarLeadsEmLote}
                    setModalWpp={setModalWpp} 
                    setModalDetalhe={setModalDetalhe} 
                    carregarHistoricoLead={carregarHistoricoLead}
                    registrarHistorico={registrarHistorico}
                    podeApagar={podeApagar}
                    usuarioLogado={usuarioLogado}
                    onNaoContatar={setNaoContatarAlvo}
                    onProximoContato={abrirProximoContato}
                />
            )}

            {visaoMostrada === 'hoje' && (
                <AbaHoje
                    visitantes={meusLeadsAtivos}
                    registrarHistorico={registrarHistorico}
                    abrirFicha={(lead) => { setModalDetalhe({ show: true, lead }); carregarHistoricoLead(lead.id); }}
                    onPedirProximo={(lead) => { if (!resultadoFunilRef.current) setProximoPendente({ lead, posContato: true }); }}
                    onRemarcar={abrirProximoContato}
                    onNaoContatar={setNaoContatarAlvo}
                />
            )}

            {visaoMostrada === 'migracao' && (
                <AbaMigracao
                    unidade={unidadeOperacao}
                    operador={consultorLogado}
                    usuarioLogado={usuarioLogado}
                    colaboradores={colaboradores}
                    naoContatar={naoContatar}
                    onNaoContatar={aoColocarNaoContatar}
                    onContatoFeito={somarNaMeta}
                    onInteressado={levarAlunoParaFunil}
                />
            )}

            {visaoMostrada === 'resgate' && (
                <AbaResgate
                    unidade={unidadeOperacao}
                    operador={consultorLogado}
                    usuarioLogado={usuarioLogado}
                    colaboradores={colaboradores}
                    naoContatar={naoContatar}
                    leads={visitantes}
                    onNaoContatar={aoColocarNaoContatar}
                    onContatoFeito={somarNaMeta}
                    onInteressado={(aluno) => levarAlunoParaFunil(aluno, 'RESGATE')}
                />
            )}

            {visaoMostrada === 'naocontatar' && (
                <AbaNaoContatar
                    unidade={unidadeOperacao}
                    operador={consultorLogado}
                    usuarioLogado={usuarioLogado}
                    versao={versaoNaoContatar}
                    onMudou={() => setVersaoNaoContatar(v => v + 1)}
                />
            )}

            <Modais
                modalWpp={modalWpp} setModalWpp={setModalWpp} modalDetalhe={modalDetalhe} setModalDetalhe={setModalDetalhe}
                historicoLead={historicoLead} loadingHistorico={loadingHistorico} registrarHistorico={registrarHistorico} alterarStatus={moverFase}
                mostrarRelatorio={mostrarRelatorio} setMostrarRelatorio={setMostrarRelatorio} progressoHoje={progressoHoje} consultorAtivo={consultorAtivo}
                usuarioLogado={usuarioLogado} META_DIARIA={META_DIARIA} visitantes={meusLeads.map(comUltimaAcao)} setConsultorAtivo={setConsultorAtivo}
                contatosDoDia={contatosDoDia}
                onNaoContatar={setNaoContatarAlvo}
                onProximoContato={abrirProximoContato}
                aoEnviarWhatsApp={perguntarProximoSeMarcado}
            />

            {perdaPendente && (
                <JanelaMotivoPerda
                    quantidade={perdaPendente.ids.length}
                    nome={perdaPendente.nome}
                    onFechar={() => setPerdaPendente(null)}
                    onConfirmar={(motivo) => (perdaPendente.lote
                        ? alterarStatusEmLote(perdaPendente.ids, 'Perdido', motivo)
                        : alterarStatus(perdaPendente.ids[0], 'Perdido', motivo))}
                />
            )}

            {resultadoFunil && (
                <JanelaResultadoContato
                    aluno={{ nome: resultadoFunil.lead.nome, registro: { tentativas: resultadoFunil.tentativas } }}
                    hoje={diaISO(0)}
                    textoInteressado={tx('Vai para Em Espera e volta para você amanhã.')}
                    textoNaoQuer={tx('Vai para a Geladeira (sem interesse) e volta em 30 dias. Não entra no "Não contatar".')}
                    textoFechou={tx('Vai para Fechado.')}
                    obrigatorio
                    onEscolher={aplicarResultadoFunil}
                    onFechar={fecharResultadoFunil}
                />
            )}

            {proximoPendente && (
                <JanelaProximoContato
                    nome={proximoPendente.lead.nome}
                    dataAtual={proximoPendente.lead.proximo_contato}
                    posContato={proximoPendente.posContato}
                    onFechar={() => setProximoPendente(null)}
                    onSalvar={(data) => salvarProximoContato(proximoPendente.lead, data)}
                />
            )}

            {naoContatarAlvo && (
                <JanelaNaoContatar
                    pessoa={{ ...naoContatarAlvo, lead_id: String(naoContatarAlvo.id) }}
                    unidade={naoContatarAlvo.unidade || unidadeOperacao}
                    quem={consultorLogado}
                    onFechar={() => setNaoContatarAlvo(null)}
                    onFeito={(p) => {
                        aoColocarNaoContatar(p);
                        if (modalDetalhe.show && modalDetalhe.lead?.id === naoContatarAlvo.id) setModalDetalhe({ show: false, lead: null });
                    }}
                />
            )}

            {/* Fica sempre montado (conta os pendentes); com a aba Hoje, aparece dentro dela, logo abaixo dos agendados */}
            <ContatosDeHoje
                embutido={visaoLiberada.hoje}
                unidade={unidadeOperacao}
                operador={consultorLogado}
                leads={visitantes}
                usuarioLogado={usuarioLogado}
                aberto={visaoLiberada.hoje ? visaoMostrada === 'hoje' : contatosHojeAberto}
                onFechar={() => setContatosHojeAberto(false)}
                onPendentes={aoAtualizarPendentes}
                registrarHistorico={registrarHistorico}
                onNaoContatar={aoColocarNaoContatar}
                onContatoFeito={somarNaMeta}
                versao={versaoDados + versaoNaoContatar}
                onDados={setContatosDoDia}
            />

        </div>
    );
};

export default CrmVisitantes;