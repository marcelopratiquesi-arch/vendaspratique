import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient.js';
import { Users, Database, PhoneForwarded, PhoneOff, Snowflake, CheckCircle2, Activity, Loader2, AlertTriangle, Clock, ChevronDown, RefreshCw, Search, X, UserX, FileText, BarChart3 } from 'lucide-react';
import { STATUS_TOKENS, FASES_EM_ATENDIMENTO, formatarDataHora, mesmoNome, normalizarNome, contatoCombinaComBusca, ehCanceladoOuInativo, ehVisitanteRecepcao, dataDaVisita, diaISO, somarDiasISO, dataLocalISO, ehMudancaPorCompra, ehBoasVindas, situacaoProximoContato, LIMITE_CARTEIRA, ocupaVaga, estaEmEspera } from './utils';
import { carregarContatosFeitos, carregarNaoContatar, chaveContatoFeito, estaNaoContatar, ehSemWhatsApp } from './contatosFeitos';
import PainelCrm from './PainelCrm';
import FichaAlunoPopup from './FichaAlunoPopup';
import FichaRecepcionista from './FichaRecepcionista';
import RelatorioConsultor from './RelatorioConsultor';
import { SeletorPeriodo } from '../HistoricoVendas/FiltrosCompactos.jsx';
import { usePeriodoPadrao, dentroDaFaixa } from '../../components/periodoPadrao.js';
import { tx, localeAtual } from '../../i18n/traduzir.js';
import { tipoDoDia } from '../AnaliseVendas/feriados.js';
import { podeVer, podeFazer } from '../../permissoes/catalogoPermissoes.js';

// ==========================================
// TELA DE ENTRADA DO CRM (redesenho de 29/10/2026, decisão do dono)
// - Um filtro de período só, no padrão do sistema (o mesmo do Histórico e do Dashboard), para a página toda.
// - Abas (07/11/2026, decisão do dono: de 5 para 3): Equipe (escolher quem opera + Base) · Painel (uma tabela só:
//   antigas Desempenho + Rede + Resultado por recepcionista, PainelCrm.jsx) · Contatos (antigos Relatório e Histórico:
//   "Pessoas contatadas" e "O que aconteceu").
// - Equipe: cartões pequenos (só o primeiro nome); na Visão Global, agrupados por unidade.
// - Planilha enxuta: 24h, 48h e Migração logo depois do nome; o resto em "ver detalhes" na linha.
// - Clicar numa linha da planilha abre um resumo lateral (com "Abrir o CRM dela" e "Ver relatório").
// As contas são as mesmas de antes.
// ==========================================

// Ações que contam como "contato de verdade" (puxar fila e importar não contam)
const ACOES_DE_CONTATO = ['WhatsApp', 'Ligação', 'Observação', 'Mudança de Fase'];

// Teto de registros do histórico lidos de uma vez na planilha
const LIMITE_HISTORICO = 3000;

// Meta do dia muito abaixo do esperado para a hora (09/11/2026, decisão do dono): fica vermelha quando a pessoa fez
// menos da METADE do ritmo para chegar a 150 no fim do turno. Só de segunda a sexta (sábado, domingo e feriado não
// têm turno) e só depois de 1 hora de turno. Manhã 7h–13h, Noite 13h–21h, sem turno 7h–21h.
const JANELA_TURNO = { MANHA: [7, 13], NOITE: [13, 21] };
const metaAbaixoDoEsperado = (pessoasHoje, turno) => {
    const agora = new Date();
    if (tipoDoDia(dataLocalISO(agora))) return false;
    const [ini, fim] = JANELA_TURNO[turno] || [7, 21];
    const hora = agora.getHours() + agora.getMinutes() / 60;
    if (hora < ini + 1) return false;
    const esperado = 150 * Math.min(1, (hora - ini) / (fim - ini));
    return pessoasHoje < esperado * 0.5;
};

const moveuPara = (h, fase) => h.tipo_acao === 'Mudança de Fase' && String(h.observacao || '').includes(`para "${fase}"`);

// "há 20 min", "há 3 h", "ontem", "há 5 dias"
const tempoRelativo = (valor) => {
    if (!valor) return '';
    const minutos = Math.floor((Date.now() - new Date(valor).getTime()) / 60000);
    if (minutos < 1) return tx('agora');
    if (minutos < 60) return tx('há {qtd} min', { qtd: minutos });
    const hoje = diaISO(0);
    const dia = dataLocalISO(valor);
    if (dia === hoje) return tx('há {qtd} h', { qtd: Math.floor(minutos / 60) });
    if (dia === diaISO(-1)) return tx('ontem');
    const [a1, m1, d1] = dia.split('-').map(Number);
    const [a2, m2, d2] = hoje.split('-').map(Number);
    return tx('há {dias} dias', { dias: Math.round((new Date(a2, m2 - 1, d2) - new Date(a1, m1 - 1, d1)) / 86400000) });
};

const PainelInicialCrm = ({ usuarioLogado, recepcionistas: recepcionistasTodas = [], leads: leadsTodos = [], colaboradores = [], versao = 0, onAtualizar, onEscolher, conteudoBase = null, onAbrirDistribuir = null }) => {
    // Filtro de período padrão do sistema (vale para a página inteira)
    const periodo = usePeriodoPadrao('hoje');
    const faixa = periodo.faixa;
    const [aba, setAba] = useState('equipe');
    const [historico, setHistorico] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const [erroHistorico, setErroHistorico] = useState(false);
    const [filtroPessoa, setFiltroPessoa] = useState('');
    const [limiteLista, setLimiteLista] = useState(30);
    // Unidade clicada na aba Rede (só na Visão Global): o resto da página mostra só ela.
    // Guarda { chave, nome }: a chave ignora acentos e maiúsculas ("SANTA INÊS" = "Santa Ines").
    const [unidadeFoco, setUnidadeFoco] = useState(null);
    const chaveFoco = unidadeFoco?.chave || '';
    // Busca na lista "O que aconteceu" e ficha do aluno em pop-up (a tela fica aberta por baixo)
    const [buscaAcontecimentos, setBuscaAcontecimentos] = useState('');
    const [contatoFicha, setContatoFicha] = useState(null);
    // Relatório por recepcionista: quem está escolhida
    const [relatorioPessoa, setRelatorioPessoa] = useState('');
    // Resumo lateral de uma recepcionista e linhas da planilha abertas em "ver detalhes"
    const [resumoDe, setResumoDe] = useState(null);
    // Grupos de unidade abertos na aba Equipe (Visão Global)
    const [gruposAbertos, setGruposAbertos] = useState(() => new Set());

    // Aba Contatos: "Pessoas contatadas" (relatório por recepcionista) ou "O que aconteceu" (histórico)
    const [subContatos, setSubContatos] = useState('pessoas');
    const abrirRelatorioDe = (nome) => {
        setRelatorioPessoa(normalizarNome(nome));
        setResumoDe(null);
        setSubContatos('pessoas');
        setAba('contatos');
    };

    const visaoGlobal = !usuarioLogado?.unidade || usuarioLogado.unidade === 'TODAS';
    const ehRecepcaoLogada = String(usuarioLogado?.role || '').toUpperCase() === 'RECEPCAO';
    // O Painel da Rede (uso por unidade) é só para Admin/Mentor na Visão Global
    const mostrarPainelRede = visaoGlobal && !ehRecepcaoLogada;

    const recepcionistas = useMemo(() => (
        chaveFoco ? recepcionistasTodas.filter(r => normalizarNome(r.unidade) === chaveFoco) : recepcionistasTodas
    ), [recepcionistasTodas, chaveFoco]);
    const leads = useMemo(() => (
        chaveFoco ? leadsTodos.filter(l => normalizarNome(l.unidade) === chaveFoco) : leadsTodos
    ), [leadsTodos, chaveFoco]);

    // Recepcionistas desligadas (ativo = false no Cadastro Geral → Equipe): não aparecem em nada do CRM.
    // A contagem aparece embaixo da planilha só para confirmar que a regra está valendo.
    const desligadasEscondidas = useMemo(() => {
        const unidadeTopo = !visaoGlobal ? normalizarNome(usuarioLogado?.unidade) : '';
        return colaboradores.filter(c => {
            const cargo = String(c.role || c.setor || c.cargo || '').toUpperCase();
            if (!cargo.includes('RECEP') || c.ativo !== false) return false;
            if (unidadeTopo && normalizarNome(c.unidade) !== unidadeTopo) return false;
            if (chaveFoco && normalizarNome(c.unidade) !== chaveFoco) return false;
            return true;
        }).length;
    }, [colaboradores, visaoGlobal, usuarioLogado?.unidade, chaveFoco]);
    const nomesChave = recepcionistas.map(r => r.nome).sort().join('|');

    // Histórico real gravado no banco (mesmo número em qualquer computador)
    useEffect(() => {
        const nomes = nomesChave ? nomesChave.split('|') : [];
        if (nomes.length === 0) { setHistorico([]); return; }
        let cancelado = false;
        const buscar = async () => {
            setCarregando(true);
            setErroHistorico(false);
            let query = supabase.from('historico_leads').select('*').in('consultor', nomes).order('data_registro', { ascending: false }).limit(LIMITE_HISTORICO);
            if (faixa.inicio) query = query.gte('data_registro', faixa.inicio.toISOString());
            if (faixa.fim) query = query.lt('data_registro', faixa.fim.toISOString());
            const { data, error } = await query;
            if (cancelado) return;
            if (error) { console.error('Erro ao buscar histórico do CRM:', error); setErroHistorico(true); setHistorico([]); }
            else setHistorico((data || []).filter(h => !ehMudancaPorCompra(h.observacao)));
            setCarregando(false);
        };
        buscar();
        return () => { cancelado = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- a faixa muda junto com periodo.chave
    }, [periodo.chave, nomesChave, versao]);

    // Contatos de 24h/48h feitos (tabela crm_contatos_feitos) e lista "Não contatar", para a planilha
    const [feitosVisitas, setFeitosVisitas] = useState([]);
    const [naoContatar, setNaoContatar] = useState(new Set());
    useEffect(() => {
        let cancelado = false;
        // A visita é 1 ou 2 dias antes do prazo: busca a partir de 2 dias antes do início do período
        const desde = faixa.inicio ? somarDiasISO(dataLocalISO(faixa.inicio), -2) : null;
        Promise.all([carregarContatosFeitos({ tipos: ['VISITANTE_24H', 'VISITANTE_48H', 'ANIVERSARIO', 'MIGRACAO', 'RESGATE'], desde }), carregarNaoContatar()])
            .then(([feitos, bloqueados]) => {
                if (cancelado) return;
                setFeitosVisitas(feitos || []);
                setNaoContatar(bloqueados);
            });
        return () => { cancelado = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- a faixa muda junto com periodo.chave
    }, [periodo.chave, versao]);

    // Visitantes 24h/48h por recepcionista:
    // - "no prazo": feito até o dia do prazo (visita + 1 dia para 24h, + 2 dias para 48h) → conta para QUEM FEZ;
    // - "atrasado": feito depois do prazo ou ainda não feito com o prazo vencido → conta para QUEM ATENDEU a visita.
    // Prazo de hoje ainda não feito não é atraso. Contato FEITO conta sempre (mesmo se depois fechou plano ou pediu
    // "Não contatar"); quem fechou, foi arquivado ou está no Não contatar só deixa de contar como pendente/atrasado.
    // Entram os prazos que caem dentro do período escolhido.
    const prazosVisitantes = useMemo(() => {
        const hoje = diaISO(0);
        const inicioISO = faixa.inicio ? dataLocalISO(faixa.inicio) : '';
        const fimISO = faixa.fim ? dataLocalISO(faixa.fim) : '';
        const feitoPor = new Map(feitosVisitas.map(f => [chaveContatoFeito(f.tipo, f.lead_id || f.aluno_id, f.referencia), f]));
        const porPessoa = new Map();
        const somar = (nome, campo) => {
            const chave = normalizarNome(nome);
            if (!chave) return;
            if (!porPessoa.has(chave)) porPessoa.set(chave, { noPrazo24: 0, atrasado24: 0, noPrazo48: 0, atrasado48: 0 });
            porPessoa.get(chave)[campo]++;
        };
        leads
            .filter(ehVisitanteRecepcao)
            .forEach(l => {
                const visita = dataDaVisita(l);
                if (!visita) return;
                const semPendencia = ['Fechado', 'Arquivado'].includes(l.status) || estaNaoContatar(naoContatar, { cpf: l.cpf, leadId: String(l.id) });
                [['VISITANTE_24H', 1, '24'], ['VISITANTE_48H', 2, '48']].forEach(([tipo, dias, sufixo]) => {
                    const prazo = somarDiasISO(visita, dias);
                    if (prazo > hoje || (inicioISO && prazo < inicioISO) || (fimISO && prazo >= fimISO)) return;
                    const feito = feitoPor.get(chaveContatoFeito(tipo, String(l.id), visita));
                    if (!feito && semPendencia) return;
                    const atendente = l.vendedor || l.puxado_por;
                    if (feito && dataLocalISO(feito.criado_em) <= prazo) somar(feito.consultor, `noPrazo${sufixo}`);
                    else if (feito || prazo < hoje) somar(atendente, `atrasado${sufixo}`);
                });
            });
        return porPessoa;
        // eslint-disable-next-line react-hooks/exhaustive-deps -- a faixa muda junto com periodo.chave
    }, [leads, feitosVisitas, naoContatar, periodo.chave]);

    // Boas-vindas (07/11/2026): visitantes cadastrados no período por quem atendeu × quantos receberam a mensagem
    // de boas-vindas no WhatsApp ("8 de 10"). Mostra quem cadastra e não manda.
    const boasVindasPorPessoa = useMemo(() => {
        const inicioISO = faixa.inicio ? dataLocalISO(faixa.inicio) : '';
        const fimISO = faixa.fim ? dataLocalISO(faixa.fim) : '';
        const hoje = diaISO(0);
        const receberam = new Set(historico.filter(ehBoasVindas).map(h => String(h.lead_id)));
        const mapa = new Map();
        leads.filter(ehVisitanteRecepcao).forEach(l => {
            const visita = dataDaVisita(l);
            if (!visita || visita > hoje || (inicioISO && visita < inicioISO) || (fimISO && visita >= fimISO)) return;
            const chave = normalizarNome(l.vendedor || l.puxado_por);
            if (!chave) return;
            const atual = mapa.get(chave) || { total: 0, enviadas: 0 };
            atual.total++;
            if (receberam.has(String(l.id))) atual.enviadas++;
            mapa.set(chave, atual);
        });
        return mapa;
        // eslint-disable-next-line react-hooks/exhaustive-deps -- a faixa muda junto com periodo.chave
    }, [leads, historico, periodo.chave]);

    // Contatos marcados como feitos SEM WhatsApp no período (em vermelho, para o Líder conferir), por quem marcou
    const semWhatsAppPorPessoa = useMemo(() => {
        const mapa = new Map();
        feitosVisitas
            .filter(f => ehSemWhatsApp(f.canal) && dentroDaFaixa(f.criado_em, faixa))
            .forEach(f => { const chave = normalizarNome(f.consultor); mapa.set(chave, (mapa.get(chave) || 0) + 1); });
        return mapa;
        // eslint-disable-next-line react-hooks/exhaustive-deps -- a faixa muda junto com periodo.chave
    }, [feitosVisitas, periodo.chave]);

    // Contatos de Migração no período, por quem fez (total, via WhatsApp e sem WhatsApp)
    const migracaoPorPessoa = useMemo(() => {
        const mapa = new Map();
        feitosVisitas
            .filter(f => f.tipo === 'MIGRACAO' && dentroDaFaixa(f.criado_em, faixa))
            .forEach(f => {
                const chave = normalizarNome(f.consultor);
                const atual = mapa.get(chave) || { total: 0, whatsapp: 0 };
                atual.total++;
                if (f.canal === 'WHATSAPP') atual.whatsapp++;
                mapa.set(chave, atual);
            });
        return mapa;
        // eslint-disable-next-line react-hooks/exhaustive-deps -- a faixa muda junto com periodo.chave
    }, [feitosVisitas, periodo.chave]);

    useEffect(() => { setLimiteLista(30); }, [periodo.chave, filtroPessoa, buscaAcontecimentos]);
    useEffect(() => { setFiltroPessoa(''); setRelatorioPessoa(''); setResumoDe(null); }, [chaveFoco]);

    const leadPorId = useMemo(() => {
        const m = new Map();
        leads.forEach(l => m.set(String(l.id), l));
        return m;
    }, [leads]);

    // Linha da planilha de cada recepcionista
    const linhas = useMemo(() => {
        return recepcionistas.map(r => {
            const acoes = historico.filter(h => mesmoNome(h.consultor, r.nome));
            const contatos = acoes.filter(h => ACOES_DE_CONTATO.includes(h.tipo_acao));
            const idsTrabalhados = new Set(contatos.map(h => String(h.lead_id)));

            let visitantes = 0, cancelados = 0;
            idsTrabalhados.forEach(id => {
                const lead = leadPorId.get(id);
                if (lead?.tipo_lead === 'VISITANTE') visitantes++;
                else if (ehCanceladoOuInativo(lead?.tipo_lead)) cancelados++;
            });

            // Contatos de aniversário e migração (sem contato no funil) também são ações da pessoa
            const feitosDaPessoa = feitosVisitas.filter(f => !f.lead_id && mesmoNome(f.consultor, r.nome) && dentroDaFaixa(f.criado_em, faixa));
            const ultimaFunil = acoes[0]?.data_registro || null;
            const ultimaFeito = feitosDaPessoa[0]?.criado_em || null;

            const daPessoa = leads.filter(l => mesmoNome(l.puxado_por, r.nome));
            const carteira = daPessoa.filter(l => FASES_EM_ATENDIMENTO.includes(l.status));
            // Cartão da equipe (07/11/2026): para hoje (agendados hoje/atrasados) e pessoas contatadas hoje (meta)
            const hojeIso = diaISO(0);
            const pessoasHoje = new Set([
                ...contatos.filter(h => dataLocalISO(h.data_registro) === hojeIso && !String(h.observacao || '').startsWith('Movido em lote')).map(h => `lead:${h.lead_id}`),
                ...feitosVisitas.filter(x => !x.lead_id && mesmoNome(x.consultor, r.nome) && dataLocalISO(x.criado_em) === hojeIso).map(x => `aluno:${x.aluno_id || x.id}`)
            ]).size;
            const puxados = daPessoa.filter(l => l.puxado_em && dentroDaFaixa(l.puxado_em, faixa)).length;

            return {
                colaborador: r,
                puxados,
                visitantes,
                cancelados,
                whatsapp: acoes.filter(h => h.tipo_acao === 'WhatsApp').length,
                ligacoes: acoes.filter(h => h.tipo_acao === 'Ligação').length,
                notas: acoes.filter(h => h.tipo_acao === 'Observação').length,
                // Conta cada contato uma vez só (ir e voltar de "Fechado" não vira 2 fechamentos)
                fechados: new Set(acoes.filter(h => moveuPara(h, 'Fechado')).map(h => String(h.lead_id))).size,
                perdidos: new Set(acoes.filter(h => moveuPara(h, 'Perdido')).map(h => String(h.lead_id))).size,
                acoes: contatos.length + feitosDaPessoa.length,
                // Em trabalho (ocupa vaga) × Em Espera (data de volta depois de hoje, não ocupa vaga; 09/11/2026)
                emAtendimento: carteira.filter(ocupaVaga).length,
                emEspera: carteira.filter(estaEmEspera).length,
                paraHoje: carteira.filter(l => ['hoje', 'atrasado'].includes(situacaoProximoContato(l))).length,
                atrasadosAgenda: carteira.filter(l => situacaoProximoContato(l) === 'atrasado').length,
                pessoasHoje,
                semContato: carteira.filter(l => !idsTrabalhados.has(String(l.id))).length,
                ultima: [ultimaFunil, ultimaFeito].filter(Boolean).sort((x, y) => new Date(x) - new Date(y)).pop() || null,
                prazos: prazosVisitantes.get(normalizarNome(r.nome)) || { noPrazo24: 0, atrasado24: 0, noPrazo48: 0, atrasado48: 0 },
                semWhatsApp: semWhatsAppPorPessoa.get(normalizarNome(r.nome)) || 0,
                migracao: migracaoPorPessoa.get(normalizarNome(r.nome)) || { total: 0, whatsapp: 0 },
                boasVindas: boasVindasPorPessoa.get(normalizarNome(r.nome)) || { total: 0, enviadas: 0 }
            };
        })
            // Visão Global: agrupadas por unidade; dentro da unidade, por nome
            .sort((a, b) => String(a.colaborador.unidade || '').localeCompare(String(b.colaborador.unidade || ''), 'pt-BR') || String(a.colaborador.nome || '').localeCompare(String(b.colaborador.nome || ''), 'pt-BR'));
        // eslint-disable-next-line react-hooks/exhaustive-deps -- a faixa muda junto com periodo.chave
    }, [recepcionistas, historico, leads, leadPorId, periodo.chave, prazosVisitantes, semWhatsAppPorPessoa, migracaoPorPessoa, boasVindasPorPessoa, feitosVisitas]);

    const linhaDe = (r) => linhas.find(l => l.colaborador.id === r.id);
    // Números da planilha por nome, para o Painel (24h/48h, boas-vindas, migração, sem contato, fechou)
    const extrasPorNome = useMemo(() => new Map(linhas.map(l => [normalizarNome(l.colaborador.nome), l])), [linhas]);

    const kpis = useMemo(() => ({
        base: leads.filter(v => !v.puxado_em && v.status !== 'Arquivado').length,
        emAtendimento: leads.filter(v => v.puxado_em && FASES_EM_ATENDIMENTO.includes(v.status)).length,
        semContato: linhas.reduce((s, l) => s + l.semContato, 0),
        geladeira: leads.filter(v => v.status === 'Perdido').length,
        fechados: linhas.reduce((s, l) => s + l.fechados, 0),
        acoes: linhas.reduce((s, l) => s + l.acoes, 0)
    }), [leads, linhas]);

    const acontecimentos = useMemo(() => historico.filter(h => {
        if (filtroPessoa && normalizarNome(h.consultor) !== filtroPessoa) return false;
        // Busca por nome, CPF ou telefone do contato
        if (buscaAcontecimentos.trim()) {
            const lead = leadPorId.get(String(h.lead_id));
            return Boolean(lead) && contatoCombinaComBusca(lead, buscaAcontecimentos);
        }
        return true;
    }), [historico, filtroPessoa, buscaAcontecimentos, leadPorId]);

    // Recepcionistas agrupadas por unidade (aba Equipe na Visão Global)
    const gruposEquipe = useMemo(() => {
        const mapa = new Map();
        recepcionistas.forEach(r => {
            const chave = normalizarNome(r.unidade) || '—';
            if (!mapa.has(chave)) mapa.set(chave, { chave, nome: String(r.unidade || '—').toUpperCase(), pessoas: [] });
            mapa.get(chave).pessoas.push(r);
        });
        return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    }, [recepcionistas]);
    const agruparPorUnidade = visaoGlobal && !chaveFoco && gruposEquipe.length > 1;


    const nomeUnidade = unidadeFoco?.nome || (visaoGlobal ? tx('Todas as unidades') : usuarioLogado?.unidade);
    const historicoNoLimite = historico.length >= LIMITE_HISTORICO;
    const th = 'px-3 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap';

    // Abas pelas permissões (Configurações → Permissões, 06/11/2026; padrão = como era). Equipe é a principal (sempre).
    const ABAS = [
        { id: 'equipe', rotulo: 'Equipe', icone: Users },
        { id: 'painel', rotulo: 'Painel', icone: BarChart3, codigo: '502' },
        { id: 'contatos', rotulo: 'Contatos', icone: FileText, codigo: '504' }
    ].filter(a => !a.codigo || podeVer(usuarioLogado, a.codigo));
    const abaMostrada = ABAS.some(a => a.id === aba) ? aba : 'equipe';

    // Cartão de uma recepcionista (clique = abrir o CRM dela).
    // 09/11/2026 (decisão do dono): "última ação há X", turno escrito, meta em vermelho quando está muito abaixo
    // do esperado para a hora e aviso "Carteira vazia" que leva ao passo Distribuir.
    const cartaoRecepcionista = (c) => {
        const l = linhaDe(c);
        const partes = String(c.nome || '').trim().split(' ');
        const turno = String(c.turno || '').toUpperCase();
        const metaAtrasada = l ? metaAbaixoDoEsperado(l.pessoasHoje, turno) : false;
        const carteiraVazia = l && l.emAtendimento === 0 && !!onAbrirDistribuir;
        return (
            <div key={c.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all flex flex-col overflow-hidden">
            <button type="button" onClick={() => onEscolher(c)} title={`${c.nome}${c.unidade ? ` · ${c.unidade}` : ''}`}
                className="p-3.5 group text-left flex flex-col gap-3 flex-1">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 shrink-0 bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white rounded-full flex items-center justify-center font-black transition-colors">
                        {partes[0]?.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="font-black text-sm text-slate-800 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 uppercase truncate leading-tight flex items-center gap-1.5">
                            <span className="truncate">{partes[0]}</span>
                            {turno === 'MANHA' && <span className="shrink-0 text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300">☀ {tx('Manhã')}</span>}
                            {turno === 'NOITE' && <span className="shrink-0 text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">🌙 {tx('Noite')}</span>}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">{l?.ultima ? tx('última ação {quando}', { quando: tempoRelativo(l.ultima) }) : tx('Sem ação no período')}</p>
                    </div>
                </div>
                {l && (
                    <div className="space-y-1.5">
                        {/* Meta de hoje (pessoas diferentes) */}
                        <div className="flex items-center gap-2" title={metaAtrasada ? tx('Muito abaixo do esperado para este horário (menos da metade do ritmo para chegar a 150 no fim do turno).') : tx('Meta do dia: pessoas diferentes contatadas hoje')}>
                            <span className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><span className={`block h-full rounded-full ${l.pessoasHoje >= 150 ? 'bg-emerald-500' : metaAtrasada ? 'bg-rose-500' : 'bg-orange-500'}`} style={{ width: `${Math.max(l.pessoasHoje > 0 ? 3 : 0, Math.min(100, (l.pessoasHoje / 150) * 100))}%` }} /></span>
                            <span className={`text-[10px] font-black tabular-nums whitespace-nowrap ${metaAtrasada ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'}`}>{metaAtrasada ? '⚠️ ' : ''}{l.pessoasHoje}/150 {tx('hoje')}</span>
                        </div>
                        {/* Carteira × limite */}
                        <div className="flex items-center gap-2" title={tx('Em trabalho: Novo + Em Contato (sem os que estão Em Espera). Limite de {limite}. Em espera: {espera}.', { limite: LIMITE_CARTEIRA, espera: l.emEspera })}>
                            <span className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><span className={`block h-full rounded-full ${l.emAtendimento > LIMITE_CARTEIRA ? 'bg-rose-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, (l.emAtendimento / LIMITE_CARTEIRA) * 100)}%` }} /></span>
                            <span className={`text-[10px] font-black tabular-nums whitespace-nowrap ${l.emAtendimento > LIMITE_CARTEIRA ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'}`}>{l.emAtendimento.toLocaleString(localeAtual())}/{LIMITE_CARTEIRA}{l.emAtendimento > LIMITE_CARTEIRA ? ' ⚠️' : ''}{l.emEspera ? <span className="text-sky-600 dark:text-sky-400"> · {tx('espera')} {l.emEspera.toLocaleString(localeAtual())}</span> : null}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-center bg-slate-50 dark:bg-slate-800/60 rounded-xl py-1.5">
                            <div title={tx('Agendados para hoje ou atrasados')}><p className={`text-sm font-black leading-none ${l.atrasadosAgenda ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>{l.paraHoje}</p><p className="text-[10px] font-bold uppercase text-slate-400 mt-0.5">{tx('Para hoje')}</p></div>
                            <div title={tx('Ações')}><p className="text-sm font-black text-slate-700 dark:text-slate-200 leading-none">{l.acoes}</p><p className="text-[10px] font-bold uppercase text-slate-400 mt-0.5">{tx('Ações')}</p></div>
                            <div title={tx('Fechou')}><p className="text-sm font-black text-emerald-600 dark:text-emerald-400 leading-none">{l.fechados}</p><p className="text-[10px] font-bold uppercase text-slate-400 mt-0.5">{tx('Fechou')}</p></div>
                        </div>
                    </div>
                )}
            </button>
            {carteiraVazia && (
                <button type="button" onClick={onAbrirDistribuir} title={tx('Abrir o passo Distribuir do "Abastecer carteiras"')}
                    className="w-full px-3 py-2 border-t border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300 flex items-center justify-center gap-1.5 transition-colors">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{tx('Carteira vazia: distribuir contatos')}
                </button>
            )}
            </div>
        );
    };

    // Poucas pessoas: cartões maiores (com 2 recepcionistas sobrava tela vazia)
    const gradeCartoes = (pessoas) => (
        <div className={`grid gap-3 ${pessoas.length <= 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6'}`}>
            {pessoas.map(c => cartaoRecepcionista(c))}
        </div>
    );

    const alternarGrupo = (chave) => setGruposAbertos(prev => {
        const novo = new Set(prev);
        if (novo.has(chave)) novo.delete(chave); else novo.add(chave);
        return novo;
    });
    const avisoDesligadas = desligadasEscondidas > 0 && (
        <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
            <UserX className="w-3.5 h-3.5" />
            {desligadasEscondidas === 1 ? tx("1 recepcionista desligada não aparece") : tx("{desligadasEscondidas} recepcionistas desligadas não aparecem", { desligadasEscondidas: desligadasEscondidas })}{' '}{tx("nesta lista (desligadas no Cadastro Geral → Equipe).")}
        </p>
    );

    const linhaResumo = resumoDe ? linhas.find(l => l.colaborador.id === resumoDe.id) : null;
    const ultimasDoResumo = resumoDe ? historico.filter(h => mesmoNome(h.consultor, resumoDe.nome)) : [];

    return (
        <div className="space-y-5 animate-[fadeIn_0.3s_ease-out] max-w-[1400px] mx-auto px-1">

            {/* CABEÇALHO (09/11/2026, refeito a pedido do dono): uma faixa só, alinhada.
                Esquerda: ícone + "CRM da Recepção" + unidade. Meio: abas (mesma altura dos botões). Direita: Atualizar + período.
                O período não se repete em texto (já está no seletor). */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 shrink-0 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-sm shadow-blue-600/20">
                        <Users className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 leading-tight">
                        <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white whitespace-nowrap">{tx('CRM da Recepção')}</h2>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 truncate">{nomeUnidade}</span>
                            {unidadeFoco && (
                                <button type="button" onClick={() => setUnidadeFoco(null)} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest" title={tx("Voltar a ver todas as unidades")}>
                                    <X className="w-3 h-3" />{tx("Ver todas")}
                                </button>
                            )}
                            {carregando && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                        </div>
                    </div>
                </div>

                <div className="hidden sm:block w-px h-8 bg-slate-200 dark:bg-slate-800" />

                <nav className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
                    {ABAS.map(a => {
                        const Icone = a.icone;
                        const ativa = abaMostrada === a.id;
                        return (
                            <button key={a.id} type="button" onClick={() => setAba(a.id)}
                                className={`h-10 px-4 rounded-xl text-[11px] font-black uppercase tracking-widest whitespace-nowrap flex items-center gap-2 transition-all ${ativa ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-white'}`}>
                                <Icone className="w-4 h-4" />{tx(a.rotulo)}
                            </button>
                        );
                    })}
                </nav>

                <div className="flex items-center gap-2 ml-auto">
                    {onAtualizar && (
                        <button type="button" onClick={onAtualizar} disabled={carregando} aria-label={tx("Atualizar")} title={tx("Buscar os números mais novos agora (sozinho, o painel atualiza no máximo 1 vez por minuto)")} className="h-10 w-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-500/40 disabled:opacity-50 flex items-center justify-center transition-colors">
                            <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
                        </button>
                    )}
                    <SeletorPeriodo {...periodo.propsSeletor} />
                </div>
            </div>

            {erroHistorico && (
                <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-xl px-4 py-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />{' '}{tx("Não foi possível carregar o histórico de contatos. Os números de ações podem aparecer zerados.")}
                </div>
            )}
            {historicoNoLimite && ['painel', 'contatos', 'equipe'].includes(aba) && (
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-xl px-4 py-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />{' '}{tx("Muitas ações no período: a planilha leu só as")}{' '}{LIMITE_HISTORICO.toLocaleString(localeAtual())}{' '}{tx("mais recentes, então os números podem estar abaixo da realidade. Escolha um período menor")}{visaoGlobal && !chaveFoco ? " " + tx("ou clique numa unidade no Painel") : ''}.
                </div>
            )}

            {/* ABA EQUIPE: cartões da recepção (clique = abrir o CRM da pessoa) */}
            {abaMostrada === 'equipe' && (
                <div className="space-y-3">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {ehRecepcaoLogada ? tx("Quem está operando o CRM? Clique no seu nome para começar o turno.") : tx("Clique num cartão da recepção para ver o Kanban e a Lista daquela pessoa.")}
                    </p>
                    {recepcionistas.length === 0 ? (
                        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-6 rounded-2xl text-center max-w-lg mx-auto">
                            <p className="text-amber-700 dark:text-amber-300 font-bold text-sm">{tx("Nenhuma recepcionista cadastrada")}{' '}{visaoGlobal && !chaveFoco ? tx("na rede") : tx("nesta unidade")}.</p>
                            <p className="text-amber-600/80 dark:text-amber-400/80 text-xs font-medium mt-1">{tx("Cadastre em Cadastro Geral → Equipe, com o setor Recepção.")}</p>
                        </div>
                    ) : agruparPorUnidade ? (
                        <div className="space-y-2">
                            {gruposEquipe.map(g => {
                                const aberto = gruposAbertos.has(g.chave);
                                const somaAcoes = g.pessoas.reduce((s, p) => s + (linhaDe(p)?.acoes || 0), 0);
                                const somaFechados = g.pessoas.reduce((s, p) => s + (linhaDe(p)?.fechados || 0), 0);
                                return (
                                    <div key={g.chave} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                                        <button type="button" onClick={() => alternarGrupo(g.chave)} className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                            <span className="flex items-center gap-2 min-w-0">
                                                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${aberto ? '' : '-rotate-90'}`} />
                                                <span className="text-sm font-black uppercase text-slate-800 dark:text-white truncate">{g.nome}</span>
                                                <span className="text-[10px] font-black text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">{g.pessoas.length}</span>
                                            </span>
                                            <span className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest shrink-0">
                                                <span className="text-slate-500 dark:text-slate-400">{somaAcoes}{' '}{tx("Ações")}</span>
                                                <span className="text-emerald-600 dark:text-emerald-400">{somaFechados}{' '}{tx("Fechou")}</span>
                                            </span>
                                        </button>
                                        {aberto && <div className="px-4 pb-4 pt-1">{gradeCartoes(g.pessoas)}</div>}
                                    </div>
                                );
                            })}
                        </div>
                    ) : gradeCartoes(recepcionistas)}
                    {avisoDesligadas}
                    {/* Base da unidade embaixo da equipe: Smart Paste, distribuir/mover e Banco Bruto (decisão do dono, 04/11/2026) */}
                    {conteudoBase && <div className="pt-4">{conteudoBase}</div>}
                </div>
            )}

            {/* ABA PAINEL (07/11/2026): faixa fina com os números da carteira + uma tabela só (PainelCrm.jsx) */}
            {abaMostrada === 'painel' && (
                <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                        {[
                            [Activity, 'Ações no período', kpis.acoes, 'text-blue-600 dark:text-blue-400', 'Tudo o que a recepção fez no período: WhatsApp, ligações, notas e mudanças de fase.'],
                            [PhoneForwarded, 'Em atendimento', kpis.emAtendimento, 'text-blue-600 dark:text-blue-400', 'Contatos nas carteiras das recepcionistas (Novo e Em Contato).'],
                            [PhoneOff, 'Carteira sem contato', kpis.semContato, 'text-rose-600 dark:text-rose-400', 'Contatos das carteiras em que ninguém fez nada no período.'],
                            [CheckCircle2, 'Fechados no período', kpis.fechados, 'text-emerald-600 dark:text-emerald-400', 'Contatos que a recepcionista passou para Fechado (fechou plano).'],
                            [Database, 'Base aguardando', kpis.base, 'text-slate-500 dark:text-slate-400', 'Contatos no Banco Bruto, ainda sem recepcionista.'],
                            [Snowflake, 'Na Geladeira', kpis.geladeira, 'text-cyan-500', 'Contatos Perdidos (voltam a ser trabalhados depois de 30 dias).']
                        ].map(([Icone, rotulo, valor, cor, dica]) => (
                            <span key={rotulo} title={tx(dica)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                <Icone className={`w-3.5 h-3.5 ${cor}`} />{tx(rotulo)}: <strong className="text-base font-black text-slate-800 dark:text-white">{valor}</strong>
                            </span>
                        ))}
                    </div>
                    <PainelCrm
                        podeCobrar={mostrarPainelRede && podeFazer(usuarioLogado, '518')}
                        colaboradores={colaboradores}
                        recepcionistas={recepcionistas}
                        faixa={faixa}
                        rotuloPeriodo={periodo.rotulo}
                        versao={versao}
                        visaoGlobal={visaoGlobal}
                        unidadeEscopo={chaveFoco || (!visaoGlobal ? normalizarNome(usuarioLogado?.unidade) : '')}
                        extras={extrasPorNome}
                        onAbrirResumo={setResumoDe}
                    />
                    {avisoDesligadas}
                </div>
            )}

            {/* ABA CONTATOS (07/11/2026): "Pessoas contatadas" (antigo Relatório) | "O que aconteceu" (antigo Histórico) */}
            {abaMostrada === 'contatos' && (
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 w-fit">
                    {[['pessoas', 'Pessoas contatadas'], ['acontecimentos', 'O que aconteceu']].map(([id, rotulo]) => (
                        <button key={id} type="button" onClick={() => setSubContatos(id)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${subContatos === id ? 'bg-white dark:bg-slate-900 shadow-sm text-blue-700 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}>{tx(rotulo)}</button>
                    ))}
                </div>
            )}
            {abaMostrada === 'contatos' && subContatos === 'pessoas' && (
                <RelatorioConsultor
                    recepcionistas={recepcionistas}
                    leads={leads}
                    usuarioLogado={usuarioLogado}
                    unidadeEscopo={chaveFoco || (!visaoGlobal ? normalizarNome(usuarioLogado?.unidade) : '')}
                    pessoa={relatorioPessoa}
                    onPessoa={setRelatorioPessoa}
                    versao={versao}
                    faixa={faixa}
                    rotuloPeriodo={periodo.rotulo}
                />
            )}

            {/* CONTATOS → O que aconteceu */}
            {abaMostrada === 'contatos' && subContatos === 'acontecimentos' && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />{' '}{tx("O que aconteceu")}
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">{acontecimentos.length}</span>
                        </h4>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                    type="text"
                                    value={buscaAcontecimentos}
                                    onChange={(e) => setBuscaAcontecimentos(e.target.value)}
                                    placeholder={tx("Buscar por nome, CPF ou telefone")}
                                    className="w-64 max-w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                                />
                                {buscaAcontecimentos && (
                                    <button type="button" onClick={() => setBuscaAcontecimentos('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white" title={tx("Limpar busca")}>
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                            <select value={filtroPessoa} onChange={(e) => setFiltroPessoa(e.target.value)} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 outline-none cursor-pointer">
                                <option value="">{tx("Todas as recepcionistas")}</option>
                                {recepcionistas.map(r => <option key={r.id} value={normalizarNome(r.nome)}>{r.nome}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-max">
                            <thead className="bg-slate-50 dark:bg-slate-800/60">
                                <tr>
                                    <th className={th}>{tx("Quando")}</th>
                                    <th className={th}>{tx("Recepcionista")}</th>
                                    <th className={th}>{tx("Ação")}</th>
                                    <th className={th}>{tx("Contato")}</th>
                                    <th className={th}>{tx("Tipo")}</th>
                                    <th className={th}>{tx("Fase atual")}</th>
                                    <th className={th}>{tx("Detalhe")}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {acontecimentos.length === 0 ? (
                                    <tr><td colSpan="7" className="text-center py-10 text-[10px] font-black uppercase tracking-widest text-slate-400">{carregando ? tx("Carregando...") : tx("Nada registrado no período.")}</td></tr>
                                ) : acontecimentos.slice(0, limiteLista).map(h => {
                                    const lead = leadPorId.get(String(h.lead_id));
                                    const token = lead ? STATUS_TOKENS[lead.status] : null;
                                    return (
                                        <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                            <td className="px-4 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap" title={formatarDataHora(h.data_registro || h.created_at)}>{tempoRelativo(h.data_registro || h.created_at)}</td>
                                            <td className="px-4 py-2.5 text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase whitespace-nowrap">{String(h.consultor || '').split(' ')[0]}</td>
                                            <td className="px-4 py-2.5"><span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded">{tx(h.tipo_acao)}</span></td>
                                            <td className="px-4 py-2.5 text-[11px] font-bold text-slate-800 dark:text-white uppercase whitespace-nowrap">{lead ? (
                                                <button type="button" onClick={() => setContatoFicha(lead)} className="uppercase text-left hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-2 transition-colors" title={tx("Abrir a ficha do aluno")}>
                                                    {lead.nome}
                                                </button>
                                            ) : <span className="text-slate-400 normal-case font-medium">{tx("Contato fora da lista atual")}</span>}</td>
                                            <td className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">{lead?.tipo_lead ? tx(lead.tipo_lead) : '—'}</td>
                                            <td className="px-4 py-2.5">
                                                {lead ? <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border ${token?.bg || ''} ${token?.text || 'text-slate-500 dark:text-slate-400'} ${token?.border || 'border-slate-200 dark:border-slate-800'}`}>{tx(lead.status)}</span> : <span className="text-slate-400">—</span>}
                                            </td>
                                            <td className="px-4 py-2.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 max-w-[320px] truncate" title={h.observacao}>{h.observacao}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {acontecimentos.length > limiteLista && (
                        <button type="button" onClick={() => setLimiteLista(n => n + 30)} className="w-full py-3 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-1.5 transition-colors">
                            <ChevronDown className="w-4 h-4" />{' '}{tx("Ver mais (")}{acontecimentos.length - limiteLista}{' '}{tx("restantes)")}
                        </button>
                    )}
                </div>
            )}

            {/* FICHA DA RECEPCIONISTA (09/11/2026: janela no meio, no modelo da ficha do aluno; antes era um painel lateral) */}
            {resumoDe && (
                <FichaRecepcionista
                    recepcionista={resumoDe}
                    linha={linhaResumo}
                    acoes={ultimasDoResumo}
                    leadPorId={leadPorId}
                    periodoRotulo={periodo.rotulo}
                    tempoRelativo={tempoRelativo}
                    formatarDataHora={formatarDataHora}
                    onVerRelatorio={() => abrirRelatorioDe(resumoDe.nome)}
                    onAbrirCrm={() => { const c = resumoDe; setResumoDe(null); onEscolher(c); }}
                    onAbrirContato={setContatoFicha}
                    bloquearEsc={!!contatoFicha}
                    onFechar={() => setResumoDe(null)}
                />
            )}

            {contatoFicha && (
                <FichaAlunoPopup contato={contatoFicha} usuarioLogado={usuarioLogado} onFechar={() => setContatoFicha(null)} />
            )}
        </div>
    );
};

export default PainelInicialCrm;
