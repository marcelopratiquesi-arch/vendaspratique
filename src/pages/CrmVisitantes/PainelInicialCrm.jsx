import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient.js';
import { Users, Database, PhoneForwarded, PhoneOff, Snowflake, CheckCircle2, Activity, Loader2, AlertTriangle, Clock, ChevronDown, RefreshCw, Search, X, UserX, FileText, Globe, BarChart3, ArrowRight, MessageCircle, Phone, PenTool } from 'lucide-react';
import { STATUS_TOKENS, FASES_EM_ATENDIMENTO, formatarDataHora, mesmoNome, normalizarNome, contatoCombinaComBusca, ehCanceladoOuInativo, ehVisitanteRecepcao, dataDaVisita, diaISO, somarDiasISO, dataLocalISO } from './utils';
import { carregarContatosFeitos, carregarNaoContatar, chaveContatoFeito, estaNaoContatar } from './contatosFeitos';
import PainelRedeCrm from './PainelRedeCrm';
import FichaAlunoPopup from './FichaAlunoPopup';
import RelatorioConsultor from './RelatorioConsultor';
import { SeletorPeriodo } from '../HistoricoVendas/FiltrosCompactos.jsx';
import { usePeriodoPadrao, dentroDaFaixa } from '../../components/periodoPadrao.js';
import { tx, localeAtual } from '../../i18n/traduzir.js';

// ==========================================
// TELA DE ENTRADA DO CRM (redesenho de 29/10/2026, decisão do dono)
// - Um filtro de período só, no padrão do sistema (o mesmo do Histórico e do Dashboard), para a página toda.
// - Abas: Equipe (escolher quem opera) · Desempenho (números e planilha) · Rede (Admin/Mentor na Visão Global)
//   · Relatório (por recepcionista) · Histórico ("O que aconteceu").
// - Equipe: cartões pequenos (só o primeiro nome); na Visão Global, agrupados por unidade.
// - Planilha enxuta: 24h, 48h e Migração logo depois do nome; o resto em "ver detalhes" na linha.
// - Clicar numa linha da planilha abre um resumo lateral (com "Abrir o CRM dela" e "Ver relatório").
// As contas são as mesmas de antes.
// ==========================================

// Ações que contam como "contato de verdade" (puxar fila e importar não contam)
const ACOES_DE_CONTATO = ['WhatsApp', 'Ligação', 'Observação', 'Mudança de Fase'];

// Teto de registros do histórico lidos de uma vez na planilha
const LIMITE_HISTORICO = 3000;

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

const Kpi = ({ icone: Icone, titulo, valor, cor, destaque = false }) => (
    <div className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-sm flex items-center gap-3 ${destaque ? 'border-blue-200 dark:border-blue-500/30' : 'border-slate-200 dark:border-slate-800'}`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cor}`}>
            <Icone className="w-5 h-5" />
        </div>
        <div className="min-w-0">
            <p className="text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-none">{valor}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-1 truncate">{tx(titulo)}</p>
        </div>
    </div>
);

const PainelInicialCrm = ({ usuarioLogado, recepcionistas: recepcionistasTodas = [], leads: leadsTodos = [], colaboradores = [], versao = 0, onAtualizar, onEscolher }) => {
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
    const [detalhesAbertos, setDetalhesAbertos] = useState(() => new Set());
    // Grupos de unidade abertos na aba Equipe (Visão Global)
    const [gruposAbertos, setGruposAbertos] = useState(() => new Set());

    const abrirRelatorioDe = (nome) => {
        setRelatorioPessoa(normalizarNome(nome));
        setResumoDe(null);
        setAba('relatorio');
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
            else setHistorico(data || []);
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
        Promise.all([carregarContatosFeitos({ tipos: ['VISITANTE_24H', 'VISITANTE_48H', 'ANIVERSARIO', 'MIGRACAO'], desde }), carregarNaoContatar()])
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

    // Contatos marcados como feitos SEM WhatsApp no período (em vermelho, para o Líder conferir), por quem marcou
    const semWhatsAppPorPessoa = useMemo(() => {
        const mapa = new Map();
        feitosVisitas
            .filter(f => f.canal && f.canal !== 'WHATSAPP' && dentroDaFaixa(f.criado_em, faixa))
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
                emAtendimento: carteira.length,
                semContato: carteira.filter(l => !idsTrabalhados.has(String(l.id))).length,
                ultima: [ultimaFunil, ultimaFeito].filter(Boolean).sort((x, y) => new Date(x) - new Date(y)).pop() || null,
                prazos: prazosVisitantes.get(normalizarNome(r.nome)) || { noPrazo24: 0, atrasado24: 0, noPrazo48: 0, atrasado48: 0 },
                semWhatsApp: semWhatsAppPorPessoa.get(normalizarNome(r.nome)) || 0,
                migracao: migracaoPorPessoa.get(normalizarNome(r.nome)) || { total: 0, whatsapp: 0 }
            };
        })
            // Visão Global: agrupadas por unidade; dentro da unidade, por nome
            .sort((a, b) => String(a.colaborador.unidade || '').localeCompare(String(b.colaborador.unidade || ''), 'pt-BR') || String(a.colaborador.nome || '').localeCompare(String(b.colaborador.nome || ''), 'pt-BR'));
        // eslint-disable-next-line react-hooks/exhaustive-deps -- a faixa muda junto com periodo.chave
    }, [recepcionistas, historico, leads, leadPorId, periodo.chave, prazosVisitantes, semWhatsAppPorPessoa, migracaoPorPessoa, feitosVisitas]);

    const linhaDe = (r) => linhas.find(l => l.colaborador.id === r.id);

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

    // Esc fecha o resumo lateral
    useEffect(() => {
        if (!resumoDe) return undefined;
        const aoTeclar = (e) => { if (e.key === 'Escape') setResumoDe(null); };
        window.addEventListener('keydown', aoTeclar);
        return () => window.removeEventListener('keydown', aoTeclar);
    }, [resumoDe]);

    const nomeUnidade = unidadeFoco?.nome || (visaoGlobal ? tx('Todas as unidades') : usuarioLogado?.unidade);
    const historicoNoLimite = historico.length >= LIMITE_HISTORICO;
    const th = 'px-3 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap';
    const td = 'px-3 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 text-center';

    const ABAS = [
        { id: 'equipe', rotulo: 'Equipe', icone: Users },
        { id: 'desempenho', rotulo: 'Desempenho', icone: BarChart3 },
        ...(mostrarPainelRede ? [{ id: 'rede', rotulo: 'Rede', icone: Globe }] : []),
        { id: 'relatorio', rotulo: 'Relatório', icone: FileText },
        { id: 'historico', rotulo: 'Histórico', icone: Clock }
    ];

    // Cartão pequeno de uma recepcionista (clique = abrir o CRM dela)
    const cartaoRecepcionista = (c) => {
        const l = linhaDe(c);
        const partes = String(c.nome || '').trim().split(' ');
        return (
            <button key={c.id} type="button" onClick={() => onEscolher(c)} title={`${c.nome}${c.unidade ? ` · ${c.unidade}` : ''}`}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-sm hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all group text-left flex flex-col gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 shrink-0 bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white rounded-full flex items-center justify-center font-black transition-colors">
                        {partes[0]?.charAt(0)}
                    </div>
                    <div className="min-w-0">
                        <p className="font-black text-sm text-slate-800 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 uppercase truncate leading-tight">{partes[0]}</p>
                        <p className="text-[10px] font-bold text-slate-400 truncate">{l?.ultima ? tempoRelativo(l.ultima) : tx('Sem ação no período')}</p>
                    </div>
                </div>
                {l && (
                    <div className="grid grid-cols-3 gap-1 text-center bg-slate-50 dark:bg-slate-800/60 rounded-xl py-1.5">
                        <div title={tx('Carteira')}><p className="text-sm font-black text-blue-600 dark:text-blue-400 leading-none">{l.emAtendimento}</p><p className="text-[10px] font-bold uppercase text-slate-400 mt-0.5">{tx('Carteira')}</p></div>
                        <div title={tx('Ações')}><p className="text-sm font-black text-slate-700 dark:text-slate-200 leading-none">{l.acoes}</p><p className="text-[10px] font-bold uppercase text-slate-400 mt-0.5">{tx('Ações')}</p></div>
                        <div title={tx('Fechou')}><p className="text-sm font-black text-emerald-600 dark:text-emerald-400 leading-none">{l.fechados}</p><p className="text-[10px] font-bold uppercase text-slate-400 mt-0.5">{tx('Fechou')}</p></div>
                    </div>
                )}
            </button>
        );
    };

    const gradeCartoes = (pessoas) => (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
            {pessoas.map(c => cartaoRecepcionista(c))}
        </div>
    );

    const alternarGrupo = (chave) => setGruposAbertos(prev => {
        const novo = new Set(prev);
        if (novo.has(chave)) novo.delete(chave); else novo.add(chave);
        return novo;
    });
    const alternarDetalhes = (id) => setDetalhesAbertos(prev => {
        const novo = new Set(prev);
        if (novo.has(id)) novo.delete(id); else novo.add(id);
        return novo;
    });

    const avisoDesligadas = desligadasEscondidas > 0 && (
        <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
            <UserX className="w-3.5 h-3.5" />
            {desligadasEscondidas === 1 ? tx("1 recepcionista desligada não aparece") : tx("{desligadasEscondidas} recepcionistas desligadas não aparecem", { desligadasEscondidas: desligadasEscondidas })}{' '}{tx("nesta lista (desligadas no Cadastro Geral → Equipe).")}
        </p>
    );

    const linhaResumo = resumoDe ? linhas.find(l => l.colaborador.id === resumoDe.id) : null;
    const ultimasDoResumo = resumoDe ? historico.filter(h => mesmoNome(h.consultor, resumoDe.nome)).slice(0, 8) : [];

    return (
        <div className="space-y-5 animate-[fadeIn_0.3s_ease-out] max-w-[1400px] mx-auto px-1">

            {/* CABEÇALHO: título, unidade, filtro de período padrão e Atualizar */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-4 md:p-5 flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 shrink-0 bg-blue-600 text-white rounded-xl flex items-center justify-center">
                            <Users className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
                                {ehRecepcaoLogada ? tx("Quem está operando o CRM?") : tx("CRM da Recepção")}
                            </h2>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">{nomeUnidade}</span>
                                {unidadeFoco && (
                                    <button type="button" onClick={() => setUnidadeFoco(null)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest" title={tx("Voltar a ver todas as unidades")}>
                                        <X className="w-3 h-3" />{' '}{tx("Ver todas")}
                                    </button>
                                )}
                                {carregando && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {onAtualizar && (
                            <button type="button" onClick={onAtualizar} disabled={carregando} title={tx("Buscar os números mais novos agora (sozinho, o painel atualiza no máximo 1 vez por minuto)")} className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                                <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />{' '}{tx("Atualizar")}
                            </button>
                        )}
                        <SeletorPeriodo {...periodo.propsSeletor} />
                    </div>
                </div>

                {/* ABAS */}
                <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto custom-scrollbar">
                    {ABAS.map(a => {
                        const Icone = a.icone;
                        const ativa = aba === a.id;
                        return (
                            <button key={a.id} type="button" onClick={() => setAba(a.id)}
                                className={`flex-1 min-w-[110px] px-3 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest whitespace-nowrap flex items-center justify-center gap-2 transition-all ${ativa ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}>
                                <Icone className="w-4 h-4" />{tx(a.rotulo)}
                            </button>
                        );
                    })}
                </div>
            </div>

            {erroHistorico && (
                <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-xl px-4 py-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />{' '}{tx("Não foi possível carregar o histórico de contatos. Os números de ações podem aparecer zerados.")}
                </div>
            )}
            {historicoNoLimite && ['desempenho', 'historico', 'equipe'].includes(aba) && (
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-xl px-4 py-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />{' '}{tx("Muitas ações no período: a planilha leu só as")}{' '}{LIMITE_HISTORICO.toLocaleString(localeAtual())}{' '}{tx("mais recentes, então os números podem estar abaixo da realidade. Escolha um período menor")}{visaoGlobal && !chaveFoco ? " " + tx("ou clique numa unidade no Painel da Rede") : ''}.
                </div>
            )}

            {/* ABA EQUIPE: cartões da recepção (clique = abrir o CRM da pessoa) */}
            {aba === 'equipe' && (
                <div className="space-y-3">
                    <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">
                        {ehRecepcaoLogada ? tx("Selecione seu nome para iniciar o turno. Embaixo está o andamento da recepção.") : tx("Clique num cartão da recepção para ver o Kanban e a Lista daquela pessoa.")}
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
                </div>
            )}

            {/* ABA DESEMPENHO: números grandes e planilha enxuta */}
            {aba === 'desempenho' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <Kpi icone={Activity} titulo="Ações no período" valor={kpis.acoes} cor="bg-blue-600 text-white" destaque />
                        <Kpi icone={PhoneForwarded} titulo="Em atendimento" valor={kpis.emAtendimento} cor="bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400" />
                        <Kpi icone={PhoneOff} titulo="Carteira sem contato" valor={kpis.semContato} cor="bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400" />
                        <Kpi icone={CheckCircle2} titulo="Fechados no período" valor={kpis.fechados} cor="bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            <Database className="w-3.5 h-3.5" />{tx("Base aguardando")}: <strong className="text-slate-800 dark:text-white">{kpis.base}</strong>
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            <Snowflake className="w-3.5 h-3.5 text-cyan-500" />{tx("Na Geladeira")}: <strong className="text-slate-800 dark:text-white">{kpis.geladeira}</strong>
                        </span>
                    </div>

                    {/* PLANILHA POR RECEPCIONISTA */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">{tx("Planilha por recepcionista")}</h4>
                            <p className="text-[11px] font-medium text-slate-400 mt-0.5">{tx("Clique numa linha para ver o resumo da recepcionista. A seta abre os detalhes.")}</p>
                        </div>
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 dark:bg-slate-800/60">
                                    <tr>
                                        <th className={`${th} sticky left-0 z-10 bg-slate-50 dark:bg-slate-800`}>{tx("Recepcionista")}</th>
                                        <th className={`${th} text-center`} title={tx("No prazo (quem fez) · atrasados (quem atendeu a visita)")}>{tx("Visitantes 24h")}</th>
                                        <th className={`${th} text-center`} title={tx("No prazo (quem fez) · atrasados (quem atendeu a visita)")}>{tx("Visitantes 48h")}</th>
                                        <th className={`${th} text-center`} title={tx("Contatos de migração para plano com nutricionista no período")}>{tx("Migração")}</th>
                                        <th className={`${th} text-center`} title={tx("WhatsApp, ligações, notas e mudanças de fase")}>{tx("Ações")}</th>
                                        <th className={`${th} text-center`}>{tx("Fechou")}</th>
                                        <th className={`${th} text-center`} title={tx("\"Sem contato\" = contatos na carteira da pessoa em que nada foi feito no período.")}>{tx("Sem contato")}</th>
                                        <th className={`${th} text-center`} title={tx("Contatos marcados como feitos sem mandar o WhatsApp (o Líder confere)")}>{tx("Sem WhatsApp")}</th>
                                        <th className={th}>{tx("Última ação")}</th>
                                        <th className={th}></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {linhas.length === 0 ? (
                                        <tr><td colSpan="10" className="text-center py-10 text-[10px] font-black uppercase tracking-widest text-slate-400">{tx("Nenhuma recepcionista para mostrar.")}</td></tr>
                                    ) : linhas.map(l => {
                                        const aberta = detalhesAbertos.has(l.colaborador.id);
                                        const partes = String(l.colaborador.nome || '').trim().split(' ');
                                        return (
                                            <React.Fragment key={l.colaborador.id}>
                                                <tr className="group hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors" onClick={() => setResumoDe(l.colaborador)} title={l.colaborador.nome}>
                                                    <td className="px-3 py-3 sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800">
                                                        <p className="text-xs font-black text-slate-800 dark:text-white uppercase whitespace-nowrap">{partes[0]}{' '}<span className="text-slate-400 font-bold">{partes.slice(1).join(' ').split(' ')[0] || ''}</span></p>
                                                        {visaoGlobal && l.colaborador.unidade && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{l.colaborador.unidade}</p>}
                                                    </td>
                                                    <td className={td}>
                                                        <span className="font-black text-emerald-600 dark:text-emerald-400" title={tx("Feitos no prazo")}>{l.prazos.noPrazo24}</span>
                                                        {l.prazos.atrasado24 > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[10px] font-black" title={tx("Atrasados (de quem atendeu a visita)")}>{l.prazos.atrasado24}{' '}{tx("atras.")}</span>}
                                                    </td>
                                                    <td className={td}>
                                                        <span className="font-black text-emerald-600 dark:text-emerald-400" title={tx("Feitos no prazo")}>{l.prazos.noPrazo48}</span>
                                                        {l.prazos.atrasado48 > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[10px] font-black" title={tx("Atrasados (de quem atendeu a visita)")}>{l.prazos.atrasado48}{' '}{tx("atras.")}</span>}
                                                    </td>
                                                    <td className={td} title={tx("{whatsapp} via WhatsApp · {v2} sem WhatsApp", { whatsapp: l.migracao.whatsapp, v2: l.migracao.total - l.migracao.whatsapp })}>
                                                        <span className={`font-black ${l.migracao.total > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>{l.migracao.total}</span>
                                                    </td>
                                                    <td className={`${td} font-black text-slate-800 dark:text-white`} title={tx("WhatsApp {w} · Ligações {l} · Notas {n}", { w: l.whatsapp, l: l.ligacoes, n: l.notas })}>{l.acoes}</td>
                                                    <td className={`${td} text-emerald-600 dark:text-emerald-400 font-black`}>{l.fechados}</td>
                                                    <td className={td}>
                                                        <span className={`px-2 py-0.5 rounded-md font-black ${l.semContato > 0 ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'text-slate-400'}`}>{l.semContato}</span>
                                                    </td>
                                                    <td className={td}>
                                                        <span className={`px-2 py-0.5 rounded-md font-black ${l.semWhatsApp > 0 ? 'bg-rose-600 text-white' : 'text-slate-400'}`} title={tx("Marcados como feitos sem WhatsApp")}>{l.semWhatsApp}</span>
                                                    </td>
                                                    <td className="px-3 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap" title={l.ultima ? formatarDataHora(l.ultima) : ''}>{l.ultima ? tempoRelativo(l.ultima) : '—'}</td>
                                                    <td className="px-2 py-3 text-right">
                                                        <button type="button" onClick={(e) => { e.stopPropagation(); alternarDetalhes(l.colaborador.id); }} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10" title={tx("Ver detalhes")} aria-expanded={aberta}>
                                                            <ChevronDown className={`w-4 h-4 transition-transform ${aberta ? 'rotate-180' : ''}`} />
                                                        </button>
                                                    </td>
                                                </tr>
                                                {aberta && (
                                                    <tr className="bg-slate-50/70 dark:bg-slate-800/40">
                                                        <td colSpan="10" className="px-4 py-3">
                                                            <div className="flex flex-wrap gap-2">
                                                                {[
                                                                    ['Puxados', l.puxados], ['Visitantes trabalhados', l.visitantes], ['Cancelados/Inativos trabalhados', l.cancelados],
                                                                    ['WhatsApp', l.whatsapp], ['Ligações', l.ligacoes], ['Notas', l.notas], ['Perdidos', l.perdidos], ['Carteira', l.emAtendimento]
                                                                ].map(([rotulo, valor]) => (
                                                                    <span key={rotulo} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                                                        {tx(rotulo)}: <strong className="text-slate-800 dark:text-white">{valor}</strong>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {desligadasEscondidas > 0 && <div className="px-5 py-2.5 border-t border-slate-100 dark:border-slate-800">{avisoDesligadas}</div>}
                    </div>
                </div>
            )}

            {/* ABA REDE: uso do CRM por unidade (Admin/Mentor na Visão Global) */}
            {aba === 'rede' && mostrarPainelRede && (
                <PainelRedeCrm
                    colaboradores={colaboradores}
                    faixa={faixa}
                    rotuloPeriodo={periodo.rotulo}
                    versao={versao}
                    unidadeFoco={chaveFoco}
                    onFocarUnidade={setUnidadeFoco}
                />
            )}

            {/* ABA RELATÓRIO POR RECEPCIONISTA */}
            {aba === 'relatorio' && (
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

            {/* ABA HISTÓRICO: o que aconteceu */}
            {aba === 'historico' && (
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

            {/* RESUMO LATERAL DE UMA RECEPCIONISTA */}
            {resumoDe && (
                <div className="fixed inset-0 z-[120] flex justify-end bg-slate-900/40 backdrop-blur-[2px] animate-[fadeIn_0.15s_ease-out]" onMouseDown={(e) => { if (e.target === e.currentTarget) setResumoDe(null); }}>
                    <aside className="w-full sm:w-[420px] h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col" role="dialog" aria-modal="true" aria-label={resumoDe.nome}>
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-11 h-11 shrink-0 bg-blue-600 text-white rounded-full flex items-center justify-center font-black text-lg">{String(resumoDe.nome || '').charAt(0)}</div>
                                <div className="min-w-0">
                                    <p className="text-sm font-black uppercase text-slate-800 dark:text-white leading-tight">{resumoDe.nome}</p>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{resumoDe.unidade || '—'} · {tx(periodo.rotulo)}</p>
                                </div>
                            </div>
                            <button type="button" onClick={() => setResumoDe(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={tx("Fechar")}>
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
                            {linhaResumo && (
                                <>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            ['Ações', linhaResumo.acoes, 'text-slate-800 dark:text-white'],
                                            ['Fechou', linhaResumo.fechados, 'text-emerald-600 dark:text-emerald-400'],
                                            ['Carteira', linhaResumo.emAtendimento, 'text-blue-600 dark:text-blue-400'],
                                            ['Visitantes 24h', `${linhaResumo.prazos.noPrazo24}${linhaResumo.prazos.atrasado24 ? ` / ${linhaResumo.prazos.atrasado24}⚠` : ''}`, 'text-emerald-600 dark:text-emerald-400'],
                                            ['Visitantes 48h', `${linhaResumo.prazos.noPrazo48}${linhaResumo.prazos.atrasado48 ? ` / ${linhaResumo.prazos.atrasado48}⚠` : ''}`, 'text-emerald-600 dark:text-emerald-400'],
                                            ['Migração', linhaResumo.migracao.total, 'text-blue-600 dark:text-blue-400'],
                                            ['Sem contato', linhaResumo.semContato, 'text-amber-600 dark:text-amber-400'],
                                            ['Sem WhatsApp', linhaResumo.semWhatsApp, linhaResumo.semWhatsApp > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'],
                                            ['Perdidos', linhaResumo.perdidos, 'text-rose-500 dark:text-rose-400']
                                        ].map(([rotulo, valor, cor]) => (
                                            <div key={rotulo} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl p-2.5 text-center">
                                                <p className={`text-lg font-black leading-none ${cor}`}>{valor}</p>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1 truncate">{tx(rotulo)}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                        <span className="inline-flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5 text-emerald-500" />{tx("WhatsApp")}: {linhaResumo.whatsapp}</span>
                                        <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-blue-500" />{tx("Ligações")}: {linhaResumo.ligacoes}</span>
                                        <span className="inline-flex items-center gap-1"><PenTool className="w-3.5 h-3.5 text-slate-400" />{tx("Notas")}: {linhaResumo.notas}</span>
                                        <span className="inline-flex items-center gap-1">{tx("Puxados")}: {linhaResumo.puxados}</span>
                                    </div>
                                </>
                            )}

                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{tx("Últimas ações")}</p>
                                {ultimasDoResumo.length === 0 ? (
                                    <p className="text-[11px] font-bold text-slate-400">{tx("Sem ação no período")}</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {ultimasDoResumo.map(h => {
                                            const lead = leadPorId.get(String(h.lead_id));
                                            return (
                                                <li key={h.id} className="flex items-start justify-between gap-3 text-[11px]">
                                                    <span className="min-w-0">
                                                        <span className="font-black text-slate-700 dark:text-slate-200 uppercase">{tx(h.tipo_acao)}</span>
                                                        <span className="text-slate-500 dark:text-slate-400"> · {lead?.nome || tx("Contato fora da lista atual")}</span>
                                                    </span>
                                                    <span className="shrink-0 font-bold text-slate-400" title={formatarDataHora(h.data_registro)}>{tempoRelativo(h.data_registro)}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => abrirRelatorioDe(resumoDe.nome)} className="py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5">
                                <FileText className="w-4 h-4" />{tx("Ver relatório")}
                            </button>
                            <button type="button" onClick={() => { const c = resumoDe; setResumoDe(null); onEscolher(c); }} className="py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5">
                                {tx("Abrir o CRM dela")}<ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </aside>
                </div>
            )}

            {contatoFicha && (
                <FichaAlunoPopup contato={contatoFicha} usuarioLogado={usuarioLogado} onFechar={() => setContatoFicha(null)} />
            )}
        </div>
    );
};

export default PainelInicialCrm;
