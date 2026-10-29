import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../../supabaseClient.js';

import { formatarCPF, cpfValido, apenasDigitos, mesmoNome, podeApagarLeads, ehRecepcao, dataDoLead, normalizarStatus, classeTipoLead, tipoPeloStatusTecace, marcaFeitoPor } from './utils';
import Metricas from './Metricas';
import Kanban from './Kanban';
import Lista from './Lista';
import Modais from './Modais';
import RelatorioCrm from './RelatorioCrm'; // ✅ IMPORTAÇÃO DO NOVO RELATÓRIO
import PainelInicialCrm from './PainelInicialCrm';
import ContatosDeHoje from './ContatosDeHoje';
import AbaMigracao from './AbaMigracao';
import AbaNaoContatar from './AbaNaoContatar';
import { JanelaNaoContatar } from './JanelasContato';
import { carregarNaoContatar, estaNaoContatar, incluirNaoContatar } from './contatosFeitos';
import { diaISO, contarPessoasDaMeta } from './utils';
import { parseSmartPaste } from '../CadastroGeral/utilsAlunos.js';
import { Repeat, Ban } from 'lucide-react';
import { Database, Users, ArrowRightCircle, ClipboardPaste, Trash2, CheckCircle2, Info, CheckSquare, AlertTriangle, Snowflake, RotateCcw, Table, Trophy, Target, LogOut, FileText, Kanban as KanbanIcon, List, PieChart, UserPlus, Loader2, CalendarCheck } from 'lucide-react';

// O App só carrega leads dos últimos 90 dias. O CRM busca à parte os leads mais antigos que ainda estão em aberto
// (Base, Kanban e Geladeira) para nenhum contato sumir. Fechados antigos não precisam ser trabalhados.
const DIAS_CORTE_APP = 90;
const STATUS_ENCERRADOS = ['Fechado', 'Arquivado'];
// Mudanças feitas por outras pessoas (tempo real) recarregam os números no máximo 1 vez por minuto
const INTERVALO_ATUALIZACAO = 60000;
// Ações que contam na meta diária (a meta soma PESSOAS diferentes que receberam alguma dessas ações) (puxar fila, capturar e importar não contam)
const ACOES_DA_META = ['WhatsApp', 'Ligação', 'Observação', 'Mudança de Fase'];

const montarFiltroCpf = (digitos) => `cpf.eq.${digitos},cpf.eq.${formatarCPF(digitos)}`;

const CrmVisitantes = ({ usuarioLogado, visitantes: visitantesRecentes = [], setVisitantes: setVisitantesRecentes, colaboradores = [] }) => {
    const [leadsAntigos, setLeadsAntigos] = useState([]);
    const unidadeTopo = usuarioLogado?.unidade && usuarioLogado.unidade !== 'TODAS' ? usuarioLogado.unidade : '';

    // "Versão" dos dados: sobe quando chegam mudanças em tempo real (no máximo 1 vez por minuto)
    // ou quando alguém clica em "Atualizar". As buscas pesadas (antigos, planilha, Painel da Rede) seguem ela.
    const [versaoDados, setVersaoDados] = useState(0);
    const ultimaAtualizacao = useRef(0);
    const primeiraCarga = useRef(true);
    useEffect(() => {
        if (primeiraCarga.current) { primeiraCarga.current = false; ultimaAtualizacao.current = Date.now(); return; }
        // Espera pelo menos 1,5s (para o banco terminar de gravar) e respeita o intervalo de 1 minuto
        const espera = Math.max(1500, ultimaAtualizacao.current + INTERVALO_ATUALIZACAO - Date.now());
        const timer = setTimeout(() => { ultimaAtualizacao.current = Date.now(); setVersaoDados(v => v + 1); }, espera);
        return () => clearTimeout(timer);
    }, [visitantesRecentes]);
    const atualizarAgora = useCallback(() => { ultimaAtualizacao.current = Date.now(); setVersaoDados(v => v + 1); }, []);

    useEffect(() => {
        let cancelado = false;
        const buscarAntigos = async () => {
            const corte = new Date();
            corte.setDate(corte.getDate() - DIAS_CORTE_APP);
            const encontrados = [];
            // Busca em páginas de 1000 (limite do Supabase), até 10 mil contatos antigos em aberto
            for (let pagina = 0; pagina < 10; pagina++) {
                let query = supabase.from('leads').select('*')
                    .lt('created_at', corte.toISOString())
                    .not('status', 'in', `(${STATUS_ENCERRADOS.map(s => `"${s}"`).join(',')})`)
                    .order('id', { ascending: false })
                    .range(pagina * 1000, pagina * 1000 + 999);
                if (unidadeTopo) query = query.eq('unidade', unidadeTopo);
                const { data, error } = await query;
                if (cancelado) return;
                if (error) { console.error('Erro ao buscar contatos antigos em aberto do CRM:', error); break; }
                encontrados.push(...(data || []));
                if (!data || data.length < 1000) break;
            }
            if (!cancelado) setLeadsAntigos(encontrados);
        };
        buscarAntigos();
        return () => { cancelado = true; };
    }, [unidadeTopo, versaoDados]);

    // Lista única: recentes (do App) + antigos em aberto, sem repetir.
    // Quem ainda estiver na fase antiga "Day Use (3 Dias)" aparece como "Em Contato".
    const visitantes = useMemo(() => {
        const ids = new Set(visitantesRecentes.map(v => v.id));
        return [...visitantesRecentes, ...leadsAntigos.filter(v => !ids.has(v.id))]
            .map(v => (normalizarStatus(v.status) !== v.status ? { ...v, status: normalizarStatus(v.status) } : v));
    }, [visitantesRecentes, leadsAntigos]);

    // Atualiza nas duas listas (o lead pode estar em qualquer uma). Sempre recebe uma função (prev => ...).
    const setVisitantes = useCallback((atualizar) => {
        setVisitantesRecentes(atualizar);
        setLeadsAntigos(atualizar);
    }, [setVisitantesRecentes]);
    // Contato novo entra só na lista de recentes
    const adicionarLeads = (novos) => setVisitantesRecentes(prev => [...novos, ...prev]);

    const podeApagar = podeApagarLeads(usuarioLogado);

    const [formData, setFormData] = useState({ nome: '', cpf: '', telefone: '', email: '', tipo_lead: '', vendedor: '', observacao: '' });
    const [visaoAtiva, setVisaoAtiva] = useState('base'); 
    const [sucesso, setSucesso] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    // MODAIS E HISTÓRICO
    const [modalWpp, setModalWpp] = useState({ show: false, lead: null, texto: '' });
    const [modalDetalhe, setModalDetalhe] = useState({ show: false, lead: null });
    const [historicoLead, setHistoricoLead] = useState([]);
    const [loadingHistorico, setLoadingHistorico] = useState(false);

    const [consultorAtivo, setConsultorAtivo] = useState(null);

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
                .filter(h => !String(h.observacao || '').startsWith('Movido em lote'))
                .map(h => ({ tipo: h.tipo_acao, observacao: h.observacao, data_contato: h.data_registro, pessoa: `lead:${h.lead_id}` }));
            const feitos = (resFeitos.data || [])
                .map(f => ({ tipo: 'Contato CRM', observacao: `${f.tipo} ${f.canal}`, data_contato: f.criado_em, pessoa: f.aluno_id ? `aluno:${f.aluno_id}` : null }));
            setProgressoHoje([...doFunil, ...feitos]);
        });
        return () => { cancelado = true; };
    }, [consultorAtivo]);

    // Contato de aniversário ou migração feito agora: soma na meta na hora (sem esperar recarregar)
    const somarNaMeta = useCallback((observacao, pessoa = null) => {
        setProgressoHoje(prev => [...prev, { tipo: 'Contato CRM', observacao, data_contato: new Date().toISOString(), pessoa }]);
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'cpf') setFormData({ ...formData, cpf: formatarCPF(value) });
        else setFormData({ ...formData, [name]: value });
    };

    // AUDITORIA EM TEMPO REAL
    const cpfDigitadoLimpo = formData.cpf.replace(/\D/g, '');
    const leadDuplicadoManual = cpfDigitadoLimpo.length === 11 
        ? visitantes.find(v => v.cpf && v.cpf.replace(/\D/g, '') === cpfDigitadoLimpo) 
        : null;

    // Quando o Líder/Admin/Mentor age no CRM de uma recepcionista, a ação conta para ela,
    // mas o histórico ganha a marca de quem fez de verdade
    const marcaDeQuemFez = () => {
        const marca = marcaFeitoPor(usuarioLogado, consultorAtivo?.nome);
        return marca ? ` [${marca}]` : '';
    };

    const registrarHistorico = async (leadId, tipoAcao, observacaoOriginal, ignorarMeta = false) => {
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

        await supabase.from('historico_leads').insert([{
            lead_id: String(leadId),
            tipo_acao: tipoAcao,
            consultor: consultorAtual,
            observacao: observacao
        }]);
    };

    // Mesmo registro para vários leads de uma vez (lotes): uma ida só ao banco, não conta na meta
    const registrarHistoricoLote = async (leadIds, tipoAcao, observacaoOriginal) => {
        if (!leadIds.length) return;
        const consultorAtual = consultorAtivo ? consultorAtivo.nome : (usuarioLogado?.nome || 'Sistema');
        const observacao = `${observacaoOriginal || ''}${marcaDeQuemFez()}`;
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

    // Pop-up "Contatos de hoje" (visitantes 24h/48h e aniversariantes). Abre sozinho uma vez por dia
    // (por pessoa e unidade, neste navegador) quando há pendentes; depois, pelo botão no topo do CRM.
    const [contatosHojeAberto, setContatosHojeAberto] = useState(false);
    const [pendentesHoje, setPendentesHoje] = useState({ total: 0, carregando: true });
    const aoAtualizarPendentes = useCallback((total, carregando) => setPendentesHoje({ total, carregando }), []);
    useEffect(() => {
        if (!consultorAtivo || !unidadeOperacao || pendentesHoje.carregando || pendentesHoje.total === 0) return;
        const chave = `crm_contatos_hoje_${unidadeOperacao}_${consultorAtivo.nome}_${diaISO(0)}`;
        let jaAbriu = false;
        try { jaAbriu = sessionStorage.getItem(chave) === '1'; } catch { jaAbriu = false; }
        if (jaAbriu) return;
        try { sessionStorage.setItem(chave, '1'); } catch { /* navegador sem armazenamento: só não lembra */ }
        setContatosHojeAberto(true);
    }, [consultorAtivo, unidadeOperacao, pendentesHoje]);

    // CPFs que já estão no CRM em TODAS as unidades. Usa a consulta segura "crm_cpfs_existentes"
    // (a tabela leads é protegida por unidade: a busca direta só enxergaria a própria unidade).
    // Devolve null se a consulta segura não existir; aí quem chamou usa a busca direta.
    const buscarCpfsViaConsultaSegura = async (cpfs) => {
        const { data, error } = await supabase.rpc('crm_cpfs_existentes', { p_cpfs: cpfs });
        if (error) { console.warn('Consulta segura crm_cpfs_existentes indisponível; usando a busca direta:', error.message || error); return null; }
        return data || [];
    };

    // Procura o CPF no banco inteiro (não só nos contatos carregados)
    const buscarCpfNoBanco = async (cpfDigitos) => {
        const viaConsulta = await buscarCpfsViaConsultaSegura([cpfDigitos]);
        if (viaConsulta) return viaConsulta[0] || null;
        const { data, error } = await supabase.from('leads').select('id, nome, status, unidade').or(montarFiltroCpf(cpfDigitos)).limit(1);
        if (error) { console.error('Erro ao conferir CPF no banco:', error); return null; }
        return data?.[0] || null;
    };

    const carregarHistoricoLead = async (leadId) => {
        setLoadingHistorico(true);
        const { data } = await supabase.from('historico_leads').select('*').eq('lead_id', String(leadId)).order('data_registro', { ascending: false });
        if (data) setHistoricoLead(data);
        setLoadingHistorico(false);
    };

    // ==========================================
    // CAPTURA MANUAL BLINDADA
    // ==========================================
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (leadDuplicadoManual) {
            alert(`🚨 BLOQUEADO: Este CPF já está registrado no sistema para o aluno ${leadDuplicadoManual.nome}.`);
            return;
        }

        if (!formData.nome.trim() || !cpfValido(formData.cpf) || !formData.telefone.trim() || !formData.tipo_lead || !formData.vendedor) {
            alert('Preencha todos os campos corretamente.'); return;
        }
        if (!unidadeOperacao) { alert('Não foi possível saber a unidade deste contato. Escolha uma unidade no topo ou a recepcionista que está operando.'); return; }

        setIsSubmitting(true);

        const cpfDigitos = apenasDigitos(formData.cpf);
        const existente = await buscarCpfNoBanco(cpfDigitos);
        if (existente) {
            alert(`🚨 BLOQUEADO: Este CPF já está no CRM para ${existente.nome} (${existente.status}${existente.unidade ? ` · ${existente.unidade}` : ''}).`);
            setIsSubmitting(false);
            return;
        }

        const novoLead = {
            unidade: unidadeOperacao,
            nome: formData.nome.toUpperCase(),
            cpf: cpfDigitos,
            telefone: formData.telefone,
            email: formData.email.trim() || null, 
            tipo_lead: formData.tipo_lead, 
            vendedor: formData.vendedor,
            observacao: formData.observacao,
            origem: 'CRM',
            data: new Date().toLocaleDateString('pt-BR'), 
            criado_em: new Date().toISOString(), 
            status: 'Novo',
            puxado_em: null,
            puxado_por: null,
            perdido_em: null
        };

        const { data, error } = await supabase.from('leads').insert([novoLead]).select();

        if (error) {
            if (error.code === '23505') alert("Erro do Banco de Dados: Este CPF já está registrado na nuvem de forma definitiva.");
            else alert("Erro ao salvar o contato: " + error.message);
        } else if (data && data[0]) {
            adicionarLeads([data[0]]);
            setSucesso(true);
            
            await registrarHistorico(data[0].id, 'Captura', `Lead inserido na Base como ${formData.tipo_lead}.`, true);
            if(formData.observacao) await registrarHistorico(data[0].id, 'Observação', formData.observacao, true);

            setTimeout(() => setSucesso(false), 3000);
            setFormData({ nome: '', cpf: '', telefone: '', email: '', tipo_lead: '', vendedor: '', observacao: '' });
        }
        setIsSubmitting(false);
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
        const ehListaTecace = primeiraLinha.includes('NOME') && (primeiraLinha.includes('DOCUMENTO') || primeiraLinha.includes('STATUS'));
        const entradas = [];
        if (ehListaTecace) {
            parseSmartPaste(texto).forEach(p => {
                entradas.push({
                    nome: p.nome,
                    telefone: p.telefone || '',
                    cpfLimpo: p.status === 'CPF INVÁLIDO' ? '' : p.cpf,
                    statusTecace: p.status_tecace
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
            
            entradas.push({ nome, telefone, cpfLimpo: cpf.replace(/\D/g, ''), statusTecace: '' });
        });

        entradas.forEach(({ nome, telefone, cpfLimpo: cpfBruto, statusTecace }) => {
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
        if (pasteSemTipo) return alert('Esta lista não é do TECACE (não tem a coluna Status). Escolha no seletor se o lote é VISITANTE, CANCELADO ou INATIVO.');
        const leadsValidos = previewLeads.filter(l => !l.isDuplicado);
        
        if (leadsValidos.length === 0) {
            alert("Nenhum lead novo para salvar. Todos os registros colados já existem na base.");
            setTextoSmartPaste('');
            setPreviewLeads([]);
            setEstatisticasPaste({ novos: 0, duplicados: 0 });
            return;
        }

        if (!unidadeOperacao) { alert('Não foi possível saber a unidade destes contatos. Escolha uma unidade no topo ou a recepcionista que está operando.'); return; }

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
            if (cpf && cpfsNoBanco.has(cpf)) { recusados.push(`${lead.nome} — CPF já está no CRM`); return false; }
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
            perdido_em: null
        });

        // 2. Tenta salvar tudo de uma vez; se o banco recusar, salva um por um para aproveitar os bons
        let salvos = [];
        if (paraSalvar.length > 0) {
            const { data, error } = await supabase.from('leads').insert(paraSalvar.map(montarLead)).select();
            if (!error) {
                salvos = data || [];
            } else {
                for (const lead of paraSalvar) {
                    const { data: um, error: erroUm } = await supabase.from('leads').insert([montarLead(lead)]).select();
                    if (erroUm) recusados.push(`${lead.nome} — ${erroUm.code === '23505' ? 'CPF já está no CRM' : erroUm.message}`);
                    else if (um?.[0]) salvos.push(um[0]);
                }
            }
        }

        if (salvos.length > 0) {
            adicionarLeads(salvos);
            await registrarHistoricoLote(salvos.map(l => l.id), 'Importação em Lote', 'Inserido na Base via Smart Paste.');
        }

        let mensagem = `${salvos.length} leads inseridos na Base com sucesso!`;
        if (recusados.length > 0) {
            mensagem += `\n\n${recusados.length} não foram salvos:\n` + recusados.slice(0, 15).join('\n');
            if (recusados.length > 15) mensagem += `\n...e mais ${recusados.length - 15}.`;
        }
        alert(mensagem);

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

        if(window.confirm(`ATENÇÃO DELETAR DADOS: Deseja EXCLUIR DEFINITIVAMENTE os ${selecionadosBase.length} contatos da base bruta do Supabase?\n\nIsso apagará os dados do banco e liberará os CPFs. Esta ação NÃO pode ser desfeita.`)) {
            const backupVisitantes = [...visitantes];
            const ids = [...selecionadosBase];
            setVisitantes(prev => prev.filter(v => !ids.includes(v.id)));

            const { error } = await supabase.from('leads').delete().in('id', ids);

            if (error) {
                restaurarLeads(backupVisitantes, ids);
                alert("Erro ao excluir os contatos no banco. Ação revertida.");
            } else {
                alert(`${selecionadosBase.length} leads foram apagados definitivamente do sistema!`);
                setSelecionadosBase([]);
            }
        }
    };

    const deletarLeadsEmLote = async (ids) => {
        if (!podeApagar || ids.length === 0) return;
        if(window.confirm(`ATENÇÃO LIXEIRA: Deseja EXCLUIR DEFINITIVAMENTE os ${ids.length} leads selecionados do banco de dados?\n\nEles sumirão do funil e os CPFs serão liberados. Esta ação NÃO pode ser desfeita.`)) {
            const backupVisitantes = [...visitantes];
            setVisitantes(prev => prev.filter(v => !ids.includes(v.id)));

            const { error } = await supabase.from('leads').delete().in('id', ids);

            if (error) {
                restaurarLeads(backupVisitantes, ids);
                alert("Erro ao excluir. Ação revertida.");
            } else {
                alert(`${ids.length} leads foram apagados permanentemente!`);
            }
        }
    };

    const deletarLead = async (id) => {
        if (!podeApagar) return;
        const lead = visitantes.find(v => v.id === id);
        if(window.confirm(`EXCLUIR DEFINITIVAMENTE ${lead?.nome ? `"${lead.nome}"` : 'este Lead'} do banco de dados?\nEle desaparecerá do funil e o CPF ficará livre para um novo cadastro no futuro. Esta ação NÃO pode ser desfeita.`)) {
            const backupVisitantes = [...visitantes];
            setVisitantes(prev => prev.filter(v => v.id !== id));

            const { error } = await supabase.from('leads').delete().eq('id', id);

            if (error) {
                restaurarLeads(backupVisitantes, [id]);
                alert("Erro ao excluir do banco de dados.");
            } else {
                if (modalDetalhe.show && modalDetalhe.lead?.id === id) setModalDetalhe({ show: false, lead: null });
            }
        }
    };

    // ==========================================
    // PUXAR FILA E ALTERAR STATUS
    // ==========================================
    const executarPuxada = async (idsParaPuxar, msgSucesso) => {
        const consultorAtual = consultorAtivo ? consultorAtivo.nome : usuarioLogado?.nome;
        if (!consultorAtual) return alert("Selecione um operador primeiro!");

        const agora = new Date().toISOString();
        setVisitantes(prev => prev.map(v => idsParaPuxar.includes(v.id) ? { ...v, puxado_em: agora, puxado_por: consultorAtual, vendedor: consultorAtual } : v));

        const { error } = await supabase.from('leads').update({ puxado_em: agora, puxado_por: consultorAtual, vendedor: consultorAtual }).in('id', idsParaPuxar);

        if (error) {
            alert("Erro de conexão. A fila não foi puxada corretamente.");
        } else {
            registrarHistoricoLote(idsParaPuxar, 'Fila de Trabalho', 'Lead puxado da base para atendimento.');
            alert(msgSucesso);
            setSelecionadosBase([]); 
            setVisaoAtiva('kanban'); 
        }
    };

    const puxarLote = async (quantidade) => {
        const leadsLivres = visitantes.filter(v => !v.puxado_em && v.status !== 'Arquivado' && daUnidadeOperacao(v)).sort((a, b) => new Date(dataDoLead(a)).getTime() - new Date(dataDoLead(b)).getTime()).slice(0, quantidade);
        if (leadsLivres.length === 0) return alert("A Base de Leads está vazia!");
        const ids = leadsLivres.map(l => l.id);
        executarPuxada(ids, `${leadsLivres.length} leads foram enviados para o seu Kanban!`);
    };

    const puxarSelecionados = async () => {
        if (selecionadosBase.length === 0) return;
        executarPuxada(selecionadosBase, `${selecionadosBase.length} leads selecionados foram para o Kanban!`);
    };

    const alterarStatusEmLote = async (ids, novoStatus) => {
        const confirmacao = novoStatus === 'Perdido' ? `Enviar ${ids.length} contatos para a Geladeira (Espera de 30 dias)?` : `Mover ${ids.length} contatos para a fase ${novoStatus}?`;

        if(window.confirm(confirmacao)) {
            const dataPerdido = novoStatus === 'Perdido' ? new Date().toISOString() : null;
            const anteriores = new Map(visitantes.filter(v => ids.includes(v.id)).map(v => [v.id, { status: v.status, perdido_em: v.perdido_em }]));

            setVisitantes(prev => prev.map(v => ids.includes(v.id) ? { ...v, status: novoStatus, perdido_em: dataPerdido } : v));
            const { error } = await supabase.from('leads').update({ status: novoStatus, perdido_em: dataPerdido }).in('id', ids);

            if (error) {
                setVisitantes(prev => prev.map(v => anteriores.has(v.id) ? { ...v, ...anteriores.get(v.id) } : v));
                alert("Erro de conexão. Ação revertida.");
            } else {
                registrarHistoricoLote(ids, 'Mudança de Fase', `Movido em lote para "${novoStatus}".`);
                alert("Operação em lote concluída com sucesso!");
            }
        }
    };

    const alterarStatus = async (id, novoStatus) => {
        const leadAtual = visitantes.find(v => v.id === id);
        const statusAntigo = leadAtual ? leadAtual.status : null;
        if (statusAntigo === novoStatus) return;

        const dataPerdido = novoStatus === 'Perdido' ? new Date().toISOString() : null;

        setVisitantes(prev => prev.map(v => v.id === id ? { ...v, status: novoStatus, perdido_em: dataPerdido } : v));
        if (modalDetalhe.show && modalDetalhe.lead?.id === id) setModalDetalhe({ ...modalDetalhe, lead: { ...modalDetalhe.lead, status: novoStatus, perdido_em: dataPerdido } });

        await registrarHistorico(id, 'Mudança de Fase', `Movido de "${statusAntigo}" para "${novoStatus}"`);
        const { error } = await supabase.from('leads').update({ status: novoStatus, perdido_em: dataPerdido }).eq('id', id);

        if (error) {
            setVisitantes(prev => prev.map(v => v.id === id ? { ...v, status: statusAntigo, perdido_em: leadAtual?.perdido_em ?? null } : v));
            alert("Erro de conexão. Revertendo ação.");
        }
    };

    // ==========================================
    // CATRACA DE IDENTIFICAÇÃO E RENDERIZAÇÃO
    // ==========================================
    // Só o pessoal da recepção opera o CRM (Líder/Admin acompanham pelo cartão de cada uma)
    const recepcionistas = colaboradores
        .filter(ehRecepcao)
        .filter(c => !unidadeTopo || String(c.unidade || '').toUpperCase() === unidadeTopo.toUpperCase())
        .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));

    if (!consultorAtivo) {
        return (
            <PainelInicialCrm
                usuarioLogado={usuarioLogado}
                recepcionistas={recepcionistas}
                leads={visitantes}
                colaboradores={colaboradores}
                versao={versaoDados}
                onAtualizar={atualizarAgora}
                onEscolher={setConsultorAtivo}
            />
        );
    }

    const consultorLogado = consultorAtivo.nome;
    // Alguém abrindo o CRM de outra pessoa (Líder/Admin/Mentor, ou uma recepcionista no cartão da colega)
    const lideraOuAcompanha = !mesmoNome(usuarioLogado?.nome, consultorLogado);
    const leadsNaBase = visitantes.filter(v => !v.puxado_em && v.status !== 'Arquivado' && daUnidadeOperacao(v) && podeContatar(v)).sort((a,b) => new Date(dataDoLead(b)) - new Date(dataDoLead(a)));
    // Nome comparado sem ligar para maiúsculas/acentos (o Novo Visitante grava o consultor em MAIÚSCULAS)
    const meusLeads = visitantes.filter(v => mesmoNome(v.puxado_por, consultorLogado) && v.status !== 'Arquivado' && podeContatar(v));
    const meusLeadsAtivos = meusLeads.filter(v => v.puxado_em && v.status !== 'Perdido');
    const meusLeadsGeladeira = meusLeads.filter(v => v.status === 'Perdido');

    // Consultor do cadastro manual: só a recepção da unidade de quem opera (igual aos cartões).
    // Se não houver ninguém da recepção cadastrado, cai para a lista antiga (Líder + Recepção).
    const recepcaoDaUnidade = colaboradores.filter(c => ehRecepcao(c) && (!unidadeOperacao || String(c.unidade || '').toUpperCase() === unidadeOperacao));
    // Quem foi desativado no Cadastro Geral (ativo = false) nunca aparece no CRM
    const colaboradoresAtivos = colaboradores.filter(c => c.ativo !== false);
    const vendedoresPermitidos = colaboradoresAtivos.filter(c => {
        const role = String(c.role || c.cargo || '').toUpperCase();
        return role.includes('LIDER') || role.includes('LÍDER') || role.includes('RECEP');
    });
    const opcoesVendedor = recepcaoDaUnidade.length > 0 ? recepcaoDaUnidade : (vendedoresPermitidos.length > 0 ? vendedoresPermitidos : colaboradoresAtivos);

    // Meta: pessoas diferentes contatadas hoje (mandar 5 mensagens para a mesma pessoa conta 1)
    const pessoasHoje = contarPessoasDaMeta(progressoHoje);
    const pctMeta = Math.min(100, Math.round((pessoasHoje / META_DIARIA) * 100));
    const metaBatida = pessoasHoje >= META_DIARIA;

    return (
        <div className="space-y-6 animate-[fadeIn_0.4s_ease-out] max-w-[1400px] mx-auto relative">

            {/* HEADER DE PRODUTIVIDADE */}
            <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between shadow-sm flex-wrap gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-[300px]">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors shrink-0 ${metaBatida ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-inner' : 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 shadow-inner'}`}>
                        {metaBatida ? <Trophy className="w-6 h-6" /> : <Target className="w-6 h-6 animate-pulse" />}
                    </div>
                    <div className="flex-1 max-w-xl">
                        <div className="flex justify-between items-end mb-1.5">
                            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest">
                                Operador: <strong className="text-blue-600 dark:text-blue-400">{consultorLogado}</strong>
                                {unidadeOperacao && <span className="ml-2 px-1.5 py-px rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">{unidadeOperacao}</span>}
                            </span>
                            <span className={`text-xs font-black transition-colors ${metaBatida ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>{pessoasHoje} / {META_DIARIA} Pessoas contatadas</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden shadow-inner">
                            <div className={`h-2.5 rounded-full transition-all duration-500 ease-out ${metaBatida ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{ width: `${pctMeta}%` }}></div>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <button onClick={() => setContatosHojeAberto(true)} className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center gap-2 border ${pendentesHoje.total > 0 ? 'bg-blue-600 text-white hover:bg-blue-700 border-blue-700' : 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 border-slate-200 dark:border-slate-800'}`}>
                        <CalendarCheck className="w-4 h-4" /> Contatos de hoje{pendentesHoje.total > 0 ? ` (${pendentesHoje.total})` : ''}
                    </button>
                    <button onClick={() => setConsultorAtivo(null)} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800">
                        <LogOut className="w-4 h-4" /> {lideraOuAcompanha ? 'Voltar ao Painel' : 'Trocar'}
                    </button>
                    <button onClick={() => setMostrarRelatorio(true)} className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center gap-2 ${metaBatida ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-[0_4px_15px_rgba(16,185,129,0.3)]' : 'bg-slate-800 text-white hover:bg-black border border-slate-700 shadow-md'}`}>
                        <FileText className="w-4 h-4" /> Fechar Turno
                    </button>
                </div>
            </div>

            {lideraOuAcompanha && (
                <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 text-blue-800 dark:text-blue-300 rounded-xl px-4 py-2.5 text-[11px] font-bold flex items-center gap-2">
                    <Info className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                    Você está vendo o CRM de <strong className="uppercase">{consultorLogado}</strong>. O que você fizer aqui conta para {consultorLogado.split(' ')[0]}, com a marca "feito por {usuarioLogado?.nome?.split(' ')[0] || 'você'}" no histórico.
                </div>
            )}

            {/* BARRA DE NAVEGAÇÃO / ABAS */}
            <div className="flex bg-slate-200 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-300/60 dark:border-slate-700 shadow-inner w-full max-w-6xl mx-auto overflow-x-auto custom-scrollbar">
                <button onClick={() => setVisaoAtiva('base')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${visaoAtiva === 'base' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}>
                    <Database className="w-4 h-4" /> Base ({leadsNaBase.length})
                </button>
                <button onClick={() => setVisaoAtiva('kanban')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${visaoAtiva === 'kanban' ? 'bg-white dark:bg-slate-900 shadow-sm text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}>
                    <KanbanIcon className="w-4 h-4" /> Kanban
                </button>
                <button onClick={() => setVisaoAtiva('lista')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${visaoAtiva === 'lista' ? 'bg-white dark:bg-slate-900 shadow-sm text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}>
                    <List className="w-4 h-4" /> Lista
                </button>
                <button onClick={() => setVisaoAtiva('geladeira')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${visaoAtiva === 'geladeira' ? 'bg-cyan-500 shadow-sm text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}>
                    <Snowflake className="w-4 h-4" /> Geladeira ({meusLeadsGeladeira.length})
                </button>
                <button onClick={() => setVisaoAtiva('migracao')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${visaoAtiva === 'migracao' ? 'bg-blue-600 shadow-sm text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}>
                    <Repeat className="w-4 h-4" /> Migração
                </button>
                <button onClick={() => setVisaoAtiva('naocontatar')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${visaoAtiva === 'naocontatar' ? 'bg-rose-600 shadow-sm text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}>
                    <Ban className="w-4 h-4" /> Não contatar
                </button>
                <button onClick={() => setVisaoAtiva('dashboard')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${visaoAtiva === 'dashboard' ? 'bg-slate-900 shadow-sm text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}>
                    <PieChart className="w-4 h-4" /> Métricas
                </button>
                {/* ✅ ABA RELATÓRIO INSERIDA NA BARRA DE NAVEGAÇÃO */}
                <button onClick={() => setVisaoAtiva('relatorio')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${visaoAtiva === 'relatorio' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}>
                    <Table className="w-4 h-4" /> Relatório
                </button>
            </div>

            {/* ABA GELADEIRA (RECUPERAÇÃO) */}
            {visaoAtiva === 'geladeira' && (
                <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-cyan-200 dark:border-cyan-500/30 shadow-sm p-6 lg:p-8 animate-[fadeIn_0.3s_ease-out]">
                    <div className="flex items-center gap-4 mb-8 border-b border-slate-100 dark:border-slate-800 pb-6">
                        <div className="w-14 h-14 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-500 rounded-2xl flex items-center justify-center shadow-inner">
                            <Snowflake className="w-7 h-7" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Geladeira de Contatos (30 Dias)</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Contatos que deram "Perdido". Aguarde o tempo de maturação para tentar resgatá-los para o Kanban.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {meusLeadsGeladeira.length === 0 ? (
                            <p className="text-slate-400 font-bold col-span-3 text-center py-10 uppercase tracking-widest text-xs">Sua geladeira está vazia.</p>
                        ) : (
                            meusLeadsGeladeira.map(v => {
                                const diasNaGeladeira = Math.floor((new Date() - new Date(v.perdido_em)) / (1000 * 60 * 60 * 24));
                                const liberado = diasNaGeladeira >= 30;

                                return (
                                    <div key={v.id} className={`p-5 rounded-2xl border ${liberado ? 'border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60'} relative flex flex-col`}>
                                        <h4 className="font-black text-slate-800 dark:text-white uppercase text-sm mb-1 pr-10">{v.nome}</h4>
                                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-4">{v.telefone}</p>
                                        
                                        <div className="mt-auto pt-4 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${liberado ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-200/50 dark:bg-emerald-500/25' : 'text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800'}`}>
                                                {diasNaGeladeira} / 30 Dias
                                            </span>
                                            
                                            <button 
                                                onClick={() => alterarStatus(v.id, 'Novo')}
                                                disabled={!liberado}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${liberado ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'}`}
                                                title={liberado ? "Resgatar para o Kanban" : "Ainda em maturação"}
                                            >
                                                <RotateCcw className="w-3.5 h-3.5" /> Resgatar
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
            {visaoAtiva === 'base' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-[fadeIn_0.3s_ease-out] p-6 lg:p-8 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 rounded-full flex items-center justify-center mb-4 border border-indigo-100 dark:border-indigo-500/20">
                                <Users className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight mb-2">Fila de Trabalho Automática</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-6">
                                <strong className="text-indigo-600 dark:text-indigo-400">{leadsNaBase.length} leads</strong> aguardando na Piscina. Puxe um lote para começar a vender.
                            </p>

                            <div className="flex items-center gap-3 w-full bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <select id="qtdPuxar" className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3.5 text-xs font-black text-slate-700 dark:text-slate-200 outline-none uppercase tracking-widest cursor-pointer shadow-sm">
                                    <option value="10">Puxar 10 contatos</option>
                                    <option value="20">Puxar 20 contatos</option>
                                    <option value="50">Puxar 50 contatos</option>
                                    <option value="100">Puxar 100 contatos</option>
                                </select>
                                <button onClick={() => puxarLote(Number(document.getElementById('qtdPuxar').value))} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-3.5 rounded-xl shadow-[0_4px_15px_rgba(79,70,229,0.3)] transition-all flex items-center justify-center gap-2 uppercase text-[10px] tracking-widest">
                                    <ArrowRightCircle className="w-5 h-5" /> Iniciar
                                </button>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm p-6 lg:p-8">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><UserPlus className="w-4 h-4" /> Inserção Manual (1 Lead)</h3>
                            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                                <div className="flex gap-4">
                                    <select name="tipo_lead" value={formData.tipo_lead} onChange={handleChange} required className="w-1/3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-3 text-xs font-black text-slate-700 dark:text-slate-200 outline-none uppercase shadow-sm">
                                        <option value="" disabled hidden>Tipo...</option>
                                        <option value="VISITANTE">VISITANTE</option>
                                        <option value="CANCELADO">CANCELADO</option>
                                        <option value="INATIVO">INATIVO</option>
                                    </select>
                                    <input type="text" name="nome" value={formData.nome} onChange={handleChange} required placeholder="Nome do Lead" className="w-2/3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none uppercase shadow-sm" />
                                </div>
                                <div className="flex gap-4">
                                    <div className="w-1/2 flex flex-col">
                                        <input type="text" name="cpf" value={formData.cpf} onChange={handleChange} placeholder="CPF" maxLength={14} className={`bg-slate-50 dark:bg-slate-800/60 border ${leadDuplicadoManual ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 dark:border-slate-800'} rounded-xl px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none shadow-sm transition-colors`} />
                                        {leadDuplicadoManual && (
                                            <span className="text-[9px] text-rose-500 font-black uppercase mt-1.5 flex items-center gap-1 animate-[fadeIn_0.2s_ease-out]">
                                                <AlertTriangle className="w-3 h-3"/> Já Existe: {leadDuplicadoManual.nome} ({leadDuplicadoManual.status})
                                            </span>
                                        )}
                                    </div>
                                    <div className="w-1/2 flex flex-col">
                                        <input type="text" name="telefone" value={formData.telefone} onChange={handleChange} required placeholder="Telefone/Zap" className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none shadow-sm" />
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <select name="vendedor" value={formData.vendedor} onChange={handleChange} required className="w-1/2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none uppercase shadow-sm">
                                        <option value="">Consultor...</option>
                                        {opcoesVendedor.map(c => <option key={c.id} value={c.nome}>{c.nome.split(' ')[0]}</option>)}
                                    </select>
                                    <input type="text" name="observacao" value={formData.observacao} onChange={handleChange} placeholder="Observação..." className="w-1/2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none shadow-sm" />
                                </div>
                                <button type="submit" disabled={isSubmitting || !!leadDuplicadoManual} className="w-full mt-2 bg-slate-800 hover:bg-black disabled:opacity-50 disabled:bg-slate-300 disabled:text-slate-500 text-white font-black py-3.5 rounded-xl shadow-md transition-all uppercase text-[10px] tracking-widest flex items-center justify-center gap-2">
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : sucesso ? <><CheckCircle2 className="w-4 h-4" /> Salvo na Base</> : 'Salvar na Base'}
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-[24px] border-2 border-emerald-500/30 shadow-lg shadow-emerald-500/10 overflow-hidden animate-[slideUp_0.4s_ease-out] p-6 lg:p-8 flex flex-col h-full relative">
                        <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest px-4 py-1 rounded-bl-2xl shadow-sm">Mais Rápido ⚡</div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
                                <ClipboardPaste className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Smart Paste</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Injeção em Lote</p>
                            </div>
                        </div>

                        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 p-4 rounded-2xl mb-4 text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-start gap-3">
                            <Info className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                            <p>Copie as linhas na Pacto, dê <kbd className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/30 shadow-sm font-mono text-[10px]">Ctrl+C</kbd> e cole abaixo com <kbd className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/30 shadow-sm font-mono text-[10px]">Ctrl+V</kbd>.</p>
                        </div>

                        <select value={tipoLeadSmartPaste} onChange={(e) => { setTipoLeadSmartPaste(e.target.value); processarColagem(textoSmartPaste, e.target.value); }} className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs font-black text-slate-700 dark:text-slate-200 outline-none uppercase shadow-sm mb-4 cursor-pointer">
                            <option value="AUTO">Automático: pelo Status do TECACE</option>
                            <option value="VISITANTE">Classificar lote como: VISITANTE</option>
                            <option value="CANCELADO">Classificar lote como: CANCELADO</option>
                            <option value="INATIVO">Classificar lote como: INATIVO</option>
                        </select>

                        <textarea 
                            value={textoSmartPaste} onChange={(e) => processarColagem(e.target.value)} placeholder="Cole aqui..."
                            className="w-full flex-1 min-h-[180px] bg-slate-50 dark:bg-slate-800/60 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-5 text-sm font-mono text-slate-600 dark:text-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all resize-none custom-scrollbar whitespace-pre"
                        />

                        {previewLeads.length > 0 && (
                            <div className="mt-4 animate-[zoomIn_0.2s_ease-out]">
                                {pasteSemTipo && (
                                    <div className="mb-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-xl px-4 py-3 flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>Esta lista não é do TECACE (não tem a coluna Status), então o modo "Automático" não sabe o tipo. Escolha acima se o lote é <strong>VISITANTE</strong>, <strong>CANCELADO</strong> ou <strong>INATIVO</strong>.</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 px-2 py-1 rounded-md">{estatisticasPaste.novos} Novos</span>
                                        {estatisticasPaste.duplicados > 0 && (
                                            <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 px-2 py-1 rounded-md flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3"/> {estatisticasPaste.duplicados} Ignorados
                                            </span>
                                        )}
                                    </div>
                                    <button onClick={() => {setTextoSmartPaste(''); setPreviewLeads([]); setEstatisticasPaste({novos:0, duplicados:0});}} className="text-[10px] font-black uppercase text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 flex items-center gap-1 transition-colors"><Trash2 className="w-3 h-3"/> Limpar</button>
                                </div>
                                
                                <div className="max-h-[140px] overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl mb-4">
                                    <table className="w-full text-left">
                                        <tbody>
                                            {previewLeads.slice(0,50).map((l) => (
                                                <tr key={l.id_temp} className={`border-b border-slate-100 dark:border-slate-800 last:border-0 text-[10px] uppercase font-bold transition-opacity ${l.isDuplicado ? 'text-slate-400 opacity-60 bg-slate-100/50 dark:bg-slate-800' : 'text-slate-700 dark:text-slate-200'}`}>
                                                    <td className="px-3 py-2 truncate max-w-[140px] flex items-center">
                                                        {l.isDuplicado && <span className="mr-2 text-[8px] bg-rose-100 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded shadow-sm font-black whitespace-nowrap">{l.motivo}</span>}
                                                        <span className="truncate">{l.nome}</span>
                                                    </td>
                                                    <td className="px-3 py-2">{l.telefone || 'S/N'}</td>
                                                    <td className="px-3 py-2 text-right">{l.tipo && <span className={`px-1.5 py-0.5 rounded border text-[8px] font-black tracking-widest ${classeTipoLead(l.tipo)}`}>{l.tipo}</span>}</td>
                                                </tr>
                                            ))}
                                            {previewLeads.length > 50 && (
                                                <tr><td colSpan="3" className="px-3 py-2 text-center text-[10px] font-bold text-slate-400">...e mais {previewLeads.length - 50} linhas</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                
                                <button onClick={confirmarSmartPaste} disabled={processandoPaste || estatisticasPaste.novos === 0 || pasteSemTipo} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:bg-slate-300 disabled:text-slate-500 text-white font-black py-4 rounded-xl shadow-[0_4px_15px_rgba(16,185,129,0.3)] transition-all uppercase text-[10px] tracking-widest flex items-center justify-center gap-2">
                                    {processandoPaste ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> Salvar {estatisticasPaste.novos} Novos no Banco</>}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm p-6 lg:p-8 col-span-1 lg:col-span-2 mt-2">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2 tracking-tight">
                                    <Database className="w-5 h-5 text-indigo-500"/> Banco Bruto 
                                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-2 border border-slate-200 dark:border-slate-800">{leadsNaBase.length} Registros</span>
                                </h3>
                            </div>
                            
                            {selecionadosBase.length > 0 && (
                                <div className="flex items-center gap-3 animate-[fadeIn_0.2s_ease-out]">
                                    {podeApagar && (
                                        <button onClick={excluirSelecionadosBase} className="bg-rose-100 dark:bg-rose-500/20 hover:bg-rose-200 dark:hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 font-black px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 uppercase text-[10px] tracking-widest">
                                            <Trash2 className="w-4 h-4" /> Apagar do Banco ({selecionadosBase.length})
                                        </button>
                                    )}
                                    <button onClick={puxarSelecionados} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-2.5 rounded-xl shadow-[0_4px_15px_rgba(79,70,229,0.3)] transition-all flex items-center gap-2 uppercase text-[10px] tracking-widest">
                                        <CheckSquare className="w-4 h-4" /> Puxar para Fila
                                    </button>
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
                                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500 cursor-pointer"
                                                checked={selecionadosBase.length === leadsNaBase.length && leadsNaBase.length > 0}
                                                onChange={(e) => e.target.checked ? setSelecionadosBase(leadsNaBase.map(l => l.id)) : setSelecionadosBase([])}
                                            />
                                        </th>
                                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">Aluno / Lead</th>
                                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">Contato (WhatsApp)</th>
                                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">Tipo</th>
                                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">Data Base</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                    {leadsNaBase.length > 0 ? leadsNaBase.map(v => (
                                        <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer" onClick={() => {
                                            if (selecionadosBase.includes(v.id)) setSelecionadosBase(prev => prev.filter(id => id !== v.id));
                                            else setSelecionadosBase(prev => [...prev, v.id]);
                                        }}>
                                            <td className="px-4 py-3 text-center border-b border-slate-100 dark:border-slate-800">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500 cursor-pointer"
                                                    checked={selecionadosBase.includes(v.id)}
                                                    onChange={() => {}}
                                                    onClick={(e) => e.stopPropagation()} 
                                                />
                                            </td>
                                            <td className="px-6 py-3 border-b border-slate-100 dark:border-slate-800">
                                                <p className="text-xs font-black text-slate-800 dark:text-white uppercase">{v.nome}</p>
                                                {v.cpf && <p className="text-[10px] font-bold text-slate-400 mt-0.5 tracking-wider">CPF: {v.cpf}</p>}
                                            </td>
                                            <td className="px-6 py-3 border-b border-slate-100 dark:border-slate-800">
                                                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{v.telefone}</p>
                                            </td>
                                            <td className="px-6 py-3 border-b border-slate-100 dark:border-slate-800">
                                                <span className={`px-2 py-1 rounded text-[9px] font-black tracking-widest uppercase border ${classeTipoLead(v.tipo_lead)}`}>
                                                    {v.tipo_lead || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                                                {dataDoLead(v) ? new Date(dataDoLead(v)).toLocaleDateString('pt-BR') : '—'}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="5" className="text-center py-10 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                                A piscina de leads está vazia. Cole dados no Smart Paste para começar.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MÓDULOS EXTERNOS */}
            {visaoAtiva === 'dashboard' && <Metricas visitantes={meusLeads} colaboradores={colaboradores} operador={consultorLogado} />}
            
            {/* ✅ ABA RELATÓRIO RENDERIZADA COM O COMPONENTE NOVO */}
            {visaoAtiva === 'relatorio' && (
                <RelatorioCrm 
                    visitantes={visitantes} 
                    temVisaoGlobal={temVisaoGlobal} 
                    usuarioLogado={usuarioLogado}
                />
            )}
            
            {visaoAtiva === 'kanban' && (
                <Kanban 
                    visitantes={meusLeadsAtivos} 
                    alterarStatus={alterarStatus} 
                    deletarLead={deletarLead} 
                    setModalWpp={setModalWpp} 
                    setModalDetalhe={setModalDetalhe} 
                    carregarHistoricoLead={carregarHistoricoLead} 
                    registrarHistorico={registrarHistorico}
                    usuarioLogado={usuarioLogado}
                    podeApagar={podeApagar}
                />
            )}
            
            {visaoAtiva === 'lista' && (
                <Lista 
                    visitantes={meusLeadsAtivos} 
                    alterarStatus={alterarStatus} 
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
                />
            )}

            {visaoAtiva === 'migracao' && (
                <AbaMigracao
                    unidade={unidadeOperacao}
                    operador={consultorLogado}
                    usuarioLogado={usuarioLogado}
                    colaboradores={colaboradores}
                    naoContatar={naoContatar}
                    onNaoContatar={aoColocarNaoContatar}
                    onContatoFeito={somarNaMeta}
                />
            )}

            {visaoAtiva === 'naocontatar' && (
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
                historicoLead={historicoLead} loadingHistorico={loadingHistorico} registrarHistorico={registrarHistorico} alterarStatus={alterarStatus}
                mostrarRelatorio={mostrarRelatorio} setMostrarRelatorio={setMostrarRelatorio} progressoHoje={progressoHoje} consultorAtivo={consultorAtivo}
                usuarioLogado={usuarioLogado} META_DIARIA={META_DIARIA} visitantes={meusLeads} setConsultorAtivo={setConsultorAtivo}
                onNaoContatar={setNaoContatarAlvo}
            />

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

            <ContatosDeHoje
                unidade={unidadeOperacao}
                operador={consultorLogado}
                leads={visitantes}
                usuarioLogado={usuarioLogado}
                aberto={contatosHojeAberto}
                onFechar={() => setContatosHojeAberto(false)}
                onPendentes={aoAtualizarPendentes}
                registrarHistorico={registrarHistorico}
                onNaoContatar={aoColocarNaoContatar}
                onContatoFeito={somarNaMeta}
                versao={versaoDados + versaoNaoContatar}
            />

        </div>
    );
};

export default CrmVisitantes;