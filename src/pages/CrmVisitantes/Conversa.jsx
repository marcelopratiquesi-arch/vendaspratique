import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '../../supabaseClient.js';
import {
    COLUNAS, STATUS_TOKENS, dataDoLead, classeTipoLead, contatoCombinaComBusca, situacaoProximoContato, formatarDiaCurto,
    gerarTextoWhatsApp, chaveMensagemDoLead, abrirNoWhatsApp, destinoWhatsApp, definirDestinoWhatsApp, podeEscolherDestinoWhatsApp,
    podeEditarMensagensProntas, formatarDataHora, textoMensagemEnviada, rotuloMensagemDoLead
} from './utils';
import { EtiquetaParado, EtiquetaProximo } from './EtiquetasCrm';
import MensagensProntas from './MensagensProntas';
import { ROTULOS_MENSAGENS } from './embaralhador.js';
import { carregarContatosDoAluno } from './contatosFeitos';
import {
    Search, MessageCircle, PhoneCall, Send, StickyNote, RefreshCw, PenTool, ArrowLeft, ChevronLeft, ChevronRight,
    Info, CalendarPlus, Ban, Trash2, Loader2, MoveRight, CalendarClock, Inbox, PanelRightOpen, PanelRightClose, AlertTriangle,
    CheckCircle2, Clock, Cake, UserCheck, Repeat, AlarmClock
} from 'lucide-react';
import { tx, localeAtual } from '../../i18n/traduzir.js';

// ==========================================
// MODO CONVERSA DO CRM (decisão do dono, 06/11/2026)
// Igual ao WhatsApp Business: contatos da recepcionista à esquerda; clicando, abre a "conversa" do contato
// (tudo o que já foi feito com ele, lido do historico_leads: mensagens enviadas, ligações, notas, mudanças de fase)
// e embaixo a caixa para mandar mais uma mensagem (abre o WhatsApp e registra, como no Kanban) ou anotar.
// À direita, os detalhes do contato (fase, próximo contato, dados). Só usa as ações que já existem no CRM:
// nenhuma regra de contagem nova (meta, planilha e relatórios continuam iguais).
// O sistema NÃO recebe as respostas do aluno (não está ligado ao WhatsApp): a conversa mostra o que a equipe fez.
// ==========================================

const FILTROS = ['Todos', 'Hoje', 'Novo', 'Em Contato', 'Fechado'];

// Botão "Hoje" da Conversa (06/11/2026, decisão do dono): tudo o que é do dia, FEITO e NÃO FEITO, por grupo.
// Agendados = carteira da recepcionista; os outros vêm do "Contatos de hoje" (unidade inteira, quem fizer primeiro tira).
const GRUPOS_HOJE = [
    { chave: 'AGENDADOS', titulo: 'Agendados para hoje', icone: CalendarClock },
    { chave: 'VISITANTE_24H', titulo: 'Visitantes 24h', icone: UserCheck },
    { chave: 'VISITANTE_48H', titulo: 'Visitantes 48h', icone: Repeat },
    { chave: 'ATRASADOS', titulo: 'Atrasados (até 7 dias)', icone: AlarmClock },
    { chave: 'ANIVERSARIO', titulo: 'Aniversariantes do dia', icone: Cake },
];
const rotuloMeio = (canal) => (canal === 'WHATSAPP' ? 'WhatsApp' : canal === 'LIGACAO' ? 'Ligação' : 'Sem WhatsApp');
const corMeio = (canal) => (canal === 'WHATSAPP' ? 'text-emerald-600 dark:text-emerald-400' : canal === 'LIGACAO' ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400');
const primeiroNome = (nome) => String(nome || '').trim().split(' ')[0];

// "há 5 min", "há 3 h", "há 2 dias"
const haQuanto = (iso) => {
    if (!iso) return '';
    const ms = Date.now() - new Date(iso).getTime();
    if (isNaN(ms)) return '';
    const min = Math.floor(ms / 60000);
    if (min < 1) return tx('agora');
    if (min < 60) return tx('há {qtd} min', { qtd: min });
    const horas = Math.floor(min / 60);
    if (horas < 24) return tx('há {qtd} h', { qtd: horas });
    const dias = Math.floor(horas / 24);
    return dias === 1 ? tx('há 1 dia') : tx('há {qtd} dias', { qtd: dias });
};

const horaCurta = (iso) => new Date(iso).toLocaleTimeString(localeAtual(), { hour: '2-digit', minute: '2-digit' });

// Separador de dia da conversa: "Hoje", "Ontem" ou a data
const rotuloDia = (iso) => {
    const d = new Date(iso);
    const hoje = new Date();
    const ontem = new Date(); ontem.setDate(hoje.getDate() - 1);
    if (d.toDateString() === hoje.toDateString()) return tx('Hoje');
    if (d.toDateString() === ontem.toDateString()) return tx('Ontem');
    return d.toLocaleDateString(localeAtual(), { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Tira do texto do histórico a marca "[feito por NOME (Papel)]" (vai à parte no balão)
const separarFeitoPor = (texto) => {
    const m = String(texto || '').match(/^([\s\S]*?)\s*\[(feito por [^\]]+)\]\s*$/);
    return m ? { corpo: m[1], feitoPor: m[2] } : { corpo: String(texto || ''), feitoPor: '' };
};

// Mensagem do WhatsApp: o histórico grava `Mensagem enviada (Situação): "texto"` (sem a situação nas antigas)
const lerMensagem = (corpo) => {
    const m = String(corpo || '').match(/^Mensagem enviada(?:\s*\(([^)]*)\))?:\s*"([\s\S]*)"$/);
    return m ? { rotulo: m[1] || '', texto: m[2] } : null;
};

// Fase gravada numa mudança: Movido de "Novo" para "Em Contato"
const lerMudanca = (corpo) => {
    const m = String(corpo || '').match(/Movido de "([^"]*)" para "([^"]*)"/);
    return m ? { de: m[1], para: m[2] } : null;
};

// Cor da etiqueta da etapa no balão
const corDaEtapa = (rotulo) => {
    const r = String(rotulo || '');
    if (/24h|48h/i.test(r)) return 'bg-blue-600 text-white';
    if (/Aniversário/i.test(r)) return 'bg-rose-500 text-white';
    if (/Migração/i.test(r)) return 'bg-emerald-700 text-white';
    if (/^Fechado/i.test(r)) return 'bg-emerald-600 text-white';
    if (/^Perdido/i.test(r)) return 'bg-slate-500 text-white';
    if (/^Em Contato/i.test(r)) return 'bg-amber-500 text-white';
    return 'bg-slate-700 text-white dark:bg-slate-600';
};

const iniciais = (nome) => String(nome || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();

const EtiquetaFase = ({ status }) => {
    const t = STATUS_TOKENS[status] || STATUS_TOKENS['Novo'];
    return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${t.bg} ${t.text} ${t.border}`}>{tx(status)}</span>;
};

// ------------------------------------------
// Um item da conversa (balão ou linha no meio)
// ------------------------------------------
const ItemConversa = ({ item, etapa }) => {
    const { corpo, feitoPor } = separarFeitoPor(item.observacao);
    const rodape = (
        <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500">
            <span className="truncate">{item.consultor}{feitoPor ? ` · ${feitoPor}` : ''}</span>
            <span>·</span>
            <span>{horaCurta(item.data_registro)}</span>
        </div>
    );

    if (item.tipo_acao === 'WhatsApp') {
        const msg = lerMensagem(corpo);
        return (
            <div className="flex justify-end">
                <div className="max-w-[85%] md:max-w-[70%] bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl rounded-tr-sm px-3.5 py-2.5 shadow-sm">
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 mb-1">
                        <MessageCircle className="w-3 h-3" />{tx('WhatsApp enviado')}
                        {etapa?.texto && (
                            <span className={`px-1.5 py-0.5 rounded normal-case tracking-normal ${corDaEtapa(etapa.texto)}`}
                                title={etapa.deduzido ? tx('Mensagem antiga: etapa deduzida pela fase do contato na época') : tx('Mensagem de qual etapa')}>
                                {tx(etapa.texto)}{etapa.deduzido ? ' *' : ''}
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words">{msg ? msg.texto : corpo}</p>
                    {rodape}
                </div>
            </div>
        );
    }

    if (item.tipo_acao === 'Observação') {
        const semWpp = /SEM WhatsApp/i.test(corpo);
        const cor = semWpp
            ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30'
            : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30';
        return (
            <div className="flex justify-end">
                <div className={`max-w-[85%] md:max-w-[70%] border rounded-2xl rounded-tr-sm px-3.5 py-2.5 shadow-sm ${cor}`}>
                    <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest mb-1 ${semWpp ? 'text-rose-600 dark:text-rose-400' : 'text-amber-700 dark:text-amber-300'}`}>
                        {semWpp ? <AlertTriangle className="w-3 h-3" /> : <StickyNote className="w-3 h-3" />}
                        {semWpp ? tx('Feito sem WhatsApp') : tx('Nota interna')}
                    </div>
                    <p className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words">{corpo}</p>
                    {rodape}
                </div>
            </div>
        );
    }

    // Ligação, mudança de fase, agendamento, fila de trabalho, reciclagem...: linha no meio
    const Icone = item.tipo_acao === 'Ligação' ? PhoneCall
        : item.tipo_acao === 'Mudança de Fase' ? MoveRight
        : item.tipo_acao === 'Agendamento' ? CalendarClock : Info;
    const destaque = item.tipo_acao === 'Ligação'
        ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30'
        : 'text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800';
    return (
        <div className="flex justify-center">
            <div className={`max-w-[90%] border rounded-xl px-3 py-1.5 text-[11px] font-bold flex items-start gap-1.5 shadow-sm ${destaque}`} title={`${item.consultor}${feitoPor ? ` · ${feitoPor}` : ''}`}>
                <Icone className="w-3.5 h-3.5 mt-px shrink-0" />
                <span className="break-words"><strong className="uppercase tracking-wider">{tx(item.tipo_acao)}</strong>{corpo ? ` · ${corpo}` : ''}<span className="text-slate-400 dark:text-slate-500 font-medium"> · {horaCurta(item.data_registro)}</span></span>
            </div>
        </div>
    );
};

// ------------------------------------------
// Linha de dado no painel de detalhes
// ------------------------------------------
const Dado = ({ rotulo, children }) => (
    <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">{rotulo}</span>
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 text-right break-words min-w-0">{children || '—'}</span>
    </div>
);

const Conversa = ({
    visitantes = [],
    registrarHistorico,
    alterarStatus,
    deletarLead,
    podeApagar = false,
    usuarioLogado,
    onProximoContato,
    aoEnviarWhatsApp,
    onNaoContatar,
    abrirFicha,
    versao = 0,
    todosLeads = [],
    contatosDoDia = null
}) => {
    const [busca, setBusca] = useState('');
    const [filtro, setFiltro] = useState('Todos');
    const [selecionadoId, setSelecionadoId] = useState(null);
    const [chaveAtiva, setChaveAtiva] = useState(null); // item escolhido na lista (lead:ID ou contato do dia)
    const [pessoaDia, setPessoaDia] = useState(null); // contato do dia escolhido no botão Hoje (24h, 48h, atrasado, aniversário)
    const [contatosAluno, setContatosAluno] = useState([]); // aniversariante: contatos já feitos com ele
    const [historico, setHistorico] = useState([]);
    const [contatosFeitos, setContatosFeitos] = useState([]); // 24h/48h/aniversário (para mensagens antigas sem a etapa)
    const [carregando, setCarregando] = useState(false);
    const [modo, setModo] = useState('whatsapp'); // 'whatsapp' | 'nota'
    const [texto, setTexto] = useState('');
    const [nota, setNota] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [destinoWpp, setDestinoWpp] = useState(() => destinoWhatsApp());
    const [editandoMensagens, setEditandoMensagens] = useState(false);
    const [detalhesAbertos, setDetalhesAbertos] = useState(false); // telas menores: detalhes por cima da conversa
    const fimRef = useRef(null);
    const podeEditarMensagens = podeEditarMensagensProntas(usuarioLogado);

    // Mais recente primeiro (última ação; sem ação, quando foi puxado/entrou)
    const momento = (v) => v.ultima_acao_em || v.puxado_em || dataDoLead(v) || '';
    const modoHoje = filtro === 'Hoje';

    // Contatos do dia: agendados da carteira + 24h/48h/atrasados/aniversariantes (feitos e pendentes)
    const agendadosHoje = useMemo(() => visitantes
        .filter(v => ['hoje', 'atrasado'].includes(situacaoProximoContato(v)))
        .map(v => ({
            chave: `ag:${v.id}`, tipo: 'AGENDADO', lead: v, nome: v.nome, telefone: v.telefone, cpf: v.cpf, feito: null,
            detalhe: situacaoProximoContato(v) === 'atrasado' ? tx('Atrasado · marcado para {dia}', { dia: formatarDiaCurto(v.proximo_contato) }) : tx('Marcado para hoje')
        })), [visitantes]);
    const todosDoDia = useMemo(() => {
        const g = contatosDoDia?.grupos || {};
        return GRUPOS_HOJE.map(gr => ({ ...gr, itens: gr.chave === 'AGENDADOS' ? agendadosHoje : (g[gr.chave] || []) }));
    }, [contatosDoDia, agendadosHoje]);
    const gruposHoje = useMemo(() => todosDoDia.map(gr => ({ ...gr, itens: gr.itens.filter(p => contatoCombinaComBusca(p, busca)) })), [todosDoDia, busca]);
    const pendentesDoDia = useMemo(() => todosDoDia.reduce((s, gr) => s + gr.itens.filter(p => !p.feito).length, 0), [todosDoDia]);
    const totalDoDia = useMemo(() => todosDoDia.reduce((s, gr) => s + gr.itens.length, 0), [todosDoDia]);

    const contagem = useMemo(() => ({
        'Todos': visitantes.length,
        'Hoje': pendentesDoDia,
        ...Object.fromEntries(COLUNAS.map(c => [c, visitantes.filter(v => v.status === c).length]))
    }), [visitantes, pendentesDoDia]);
    const lista = useMemo(() => visitantes
        .filter(v => filtro === 'Todos' || filtro === 'Hoje' || v.status === filtro)
        .filter(v => contatoCombinaComBusca(v, busca))
        .sort((a, b) => String(momento(b)).localeCompare(String(momento(a)))), [visitantes, filtro, busca]);

    // Itens da lista da esquerda (para as setas do teclado)
    const itensNav = useMemo(() => (modoHoje
        ? gruposHoje.flatMap(gr => gr.itens)
        : lista.map(v => ({ chave: `lead:${v.id}`, lead: v }))), [modoHoje, gruposHoje, lista]);
    const posicao = itensNav.findIndex(i => i.chave === chaveAtiva);
    const escolher = (item) => {
        if (!item) return;
        setChaveAtiva(item.chave);
        setPessoaDia(item.tipo && item.tipo !== 'AGENDADO' ? item : null);
        setSelecionadoId(item.lead ? item.lead.id : null);
    };
    const fecharSelecao = () => { setSelecionadoId(null); setChaveAtiva(null); setPessoaDia(null); };

    // O contato pode não estar na carteira (visitante 24h/48h da unidade): procura em todos os contatos do CRM
    const lead = selecionadoId ? (visitantes.find(v => v.id === selecionadoId) || todosLeads.find(v => v.id === selecionadoId) || null) : null;
    // Contato do dia escolhido, sempre com a situação atual (feito ou não)
    const pessoaDiaAtual = pessoaDia ? (todosDoDia.flatMap(gr => gr.itens).find(p => p.chave === pessoaDia.chave) || pessoaDia) : null;
    // Contato do dia ainda NÃO feito com um contato do funil: a mensagem é a da situação (24h, 48h...) e o envio marca como feito
    const pessoaPendente = pessoaDiaAtual && !pessoaDiaAtual.feito && pessoaDiaAtual.lead && contatosDoDia?.acoes ? pessoaDiaAtual : null;
    const mensagemPara = (l) => (pessoaPendente && String(pessoaPendente.lead.id) === String(l.id) ? contatosDoDia.acoes.textoDe(pessoaPendente) : gerarTextoWhatsApp(l));
    const rotuloPara = (l) => (pessoaPendente && String(pessoaPendente.lead.id) === String(l.id) ? contatosDoDia.acoes.rotuloDe(pessoaPendente) : rotuloMensagemDoLead(l));

    // Contato sumiu de todo o CRM (ex.: apagado): fecha a conversa
    useEffect(() => { if (selecionadoId && !lead) fecharSelecao(); }, [selecionadoId, lead]); // eslint-disable-line react-hooks/exhaustive-deps

    // Aniversariante (aluno, sem contato no funil): carrega os contatos já feitos com ele
    const alunoAniversario = !lead && pessoaDiaAtual?.aluno_id ? pessoaDiaAtual.aluno_id : null;
    useEffect(() => {
        setContatosAluno([]);
        if (!alunoAniversario) return;
        let cancelado = false;
        carregarContatosDoAluno(alunoAniversario, []).then(l => { if (!cancelado) setContatosAluno(l || []); }).catch(() => {});
        return () => { cancelado = true; };
    }, [alunoAniversario]);

    const carregarHistorico = useCallback(async (id, silencioso = false) => {
        if (!id) return;
        if (!silencioso) setCarregando(true);
        const { data, error } = await supabase.from('historico_leads').select('*')
            .eq('lead_id', String(id)).order('data_registro', { ascending: true }).limit(500);
        if (error) console.error('Erro ao carregar a conversa do contato:', error);
        setHistorico(prev => (error ? prev : (data || [])));
        setCarregando(false);
    }, []);

    // Trocou de contato: carrega a conversa e prepara uma mensagem nova
    useEffect(() => {
        setHistorico([]);
        setContatosFeitos([]);
        setNota('');
        setDetalhesAbertos(false);
        if (!selecionadoId) return;
        carregarHistorico(selecionadoId);
        let cancelado = false;
        carregarContatosDoAluno(null, [String(selecionadoId)]).then(lista => { if (!cancelado) setContatosFeitos(lista || []); }).catch(() => {});
        setTexto(lead ? mensagemPara(lead) : '');
        return () => { cancelado = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selecionadoId, chaveAtiva, carregarHistorico]);

    // Mudanças de outras pessoas (versão dos dados do CRM): atualiza a conversa aberta sem piscar
    useEffect(() => { if (selecionadoId) carregarHistorico(selecionadoId, true); }, [versao]); // eslint-disable-line react-hooks/exhaustive-deps

    // Sempre mostra o fim da conversa (o mais recente)
    useEffect(() => { fimRef.current?.scrollIntoView({ block: 'end' }); }, [historico]);

    // Mudou a fase: a mensagem pronta passa a ser a da fase nova
    const faseAtual = lead?.status;
    useEffect(() => { if (lead) setTexto(mensagemPara(lead)); }, [faseAtual]); // eslint-disable-line react-hooks/exhaustive-deps

    const irPara = (passo) => {
        const proximo = posicao < 0 ? itensNav[0] : itensNav[posicao + passo];
        if (!proximo) return;
        escolher(proximo);
        document.getElementById(`conversa-item-${proximo.chave}`)?.scrollIntoView({ block: 'nearest' });
    };

    // Atalho: seta para baixo = próximo contato, seta para cima = anterior (fora das caixas de texto)
    const irParaRef = useRef(irPara);
    useEffect(() => { irParaRef.current = irPara; });
    useEffect(() => {
        const aoTeclar = (e) => {
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
            if (e.altKey || e.ctrlKey || e.metaKey) return;
            const alvo = e.target;
            if (alvo && (['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName) || alvo.isContentEditable)) return;
            if (document.querySelector('.fixed.inset-0')) return; // alguma janela aberta por cima
            e.preventDefault();
            irParaRef.current(e.key === 'ArrowDown' ? 1 : -1);
        };
        window.addEventListener('keydown', aoTeclar);
        return () => window.removeEventListener('keydown', aoTeclar);
    }, []);

    const enviarWhatsApp = async () => {
        if (!lead || !lead.telefone || !texto.trim() || enviando) return;
        setEnviando(true);
        const enviado = texto;
        const doDia = pessoaPendente;
        // Mesmo registro do Kanban: conta na meta e tira do "parado"
        await registrarHistorico(lead.id, 'WhatsApp', textoMensagemEnviada(enviado, rotuloPara(lead)));
        abrirNoWhatsApp(lead.telefone, enviado);
        // Era um contato do dia (24h, 48h, atrasado): fica marcado como feito, igual ao "Contatos de hoje"
        if (doDia) await contatosDoDia.acoes.marcarFeito(doDia, { canal: 'WHATSAPP' });
        setTexto(gerarTextoWhatsApp(lead));
        await carregarHistorico(lead.id, true);
        setEnviando(false);
        if (aoEnviarWhatsApp) aoEnviarWhatsApp(lead);
    };

    const salvarNota = async () => {
        if (!lead || !nota.trim() || enviando) return;
        setEnviando(true);
        await registrarHistorico(lead.id, 'Observação', nota.trim());
        setNota('');
        await carregarHistorico(lead.id, true);
        setEnviando(false);
    };

    const ligar = async () => {
        if (!lead?.telefone) return;
        const doDia = pessoaPendente;
        await registrarHistorico(lead.id, 'Ligação', `Tentativa de contato telefônico (MicroSIP) para o número ${lead.telefone}`);
        if (doDia) await contatosDoDia.acoes.marcarFeito(doDia, { canal: 'LIGACAO' });
        carregarHistorico(lead.id, true);
        window.location.href = `sip:${lead.telefone.replace(/\D/g, '')}`;
    };

    const mudarFase = async (novo) => {
        if (!lead) return;
        await alterarStatus(lead.id, novo);
        carregarHistorico(lead.id, true);
    };

    // Etapa de cada mensagem: a gravada no histórico; nas antigas, um contato 24h/48h/aniversário feito
    // na mesma hora (crm_contatos_feitos) ou a fase em que o contato estava (pelas mudanças de fase)
    const etapas = useMemo(() => {
        const mapa = {};
        const primeira = historico.map(h => (h.tipo_acao === 'Mudança de Fase' ? lerMudanca(h.observacao) : null)).find(Boolean);
        let fase = primeira ? primeira.de : (lead?.status || 'Novo');
        historico.forEach(h => {
            if (h.tipo_acao === 'Mudança de Fase') {
                const m = lerMudanca(h.observacao);
                if (m) fase = m.para;
                return;
            }
            if (h.tipo_acao !== 'WhatsApp') return;
            const msg = lerMensagem(separarFeitoPor(h.observacao).corpo);
            if (msg?.rotulo) { mapa[h.id] = { texto: msg.rotulo, deduzido: false }; return; }
            const quando = new Date(h.data_registro).getTime();
            const feito = contatosFeitos.find(c => ROTULOS_MENSAGENS[c.tipo] && Math.abs(new Date(c.criado_em).getTime() - quando) < 5 * 60000);
            mapa[h.id] = { texto: feito ? ROTULOS_MENSAGENS[feito.tipo] : fase, deduzido: true };
        });
        return mapa;
    }, [historico, contatosFeitos, lead?.status]);

    // Conversa agrupada por dia
    const blocos = useMemo(() => {
        const grupos = [];
        historico.forEach(h => {
            const dia = new Date(h.data_registro).toDateString();
            const ultimo = grupos[grupos.length - 1];
            if (ultimo && ultimo.dia === dia) ultimo.itens.push(h);
            else grupos.push({ dia, rotulo: rotuloDia(h.data_registro), itens: [h] });
        });
        return grupos;
    }, [historico]);

    const painelDetalhes = lead && (
        <div className="space-y-4">
            <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{tx('Fase')}</label>
                <select value={lead.status} onChange={(e) => mudarFase(e.target.value)}
                    className="mt-1 w-full text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-lg h-9 px-2 bg-slate-50 dark:bg-slate-800/60 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer">
                    {COLUNAS.map(c => <option key={c} value={c}>{tx(c)}</option>)}
                </select>
            </div>
            <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{tx('Próximo contato')}</label>
                <button type="button" onClick={() => onProximoContato?.(lead)}
                    className="mt-1 w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:border-blue-400 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <CalendarPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    {lead.proximo_contato ? formatarDiaCurto(lead.proximo_contato) : tx('Marcar data')}
                    <span className="ml-auto"><EtiquetaProximo lead={lead} /></span>
                </button>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1">
                <Dado rotulo={tx('Tipo')}>{lead.tipo_lead ? tx(lead.tipo_lead) : ''}</Dado>
                <Dado rotulo={tx('Telefone')}>{lead.telefone}</Dado>
                <Dado rotulo="CPF">{lead.cpf}</Dado>
                {lead.matricula && <Dado rotulo={tx('Matrícula')}>{lead.matricula}</Dado>}
                {lead.email && <Dado rotulo={tx('E-mail')}>{lead.email}</Dado>}
                <Dado rotulo={tx('Unidade')}>{lead.unidade}</Dado>
                <Dado rotulo={tx('Recepcionista')}>{lead.puxado_por || lead.vendedor}</Dado>
                <Dado rotulo={tx('Entrou em')}>{formatarDataHora(dataDoLead(lead))}</Dado>
                {lead.puxado_em && <Dado rotulo={tx('Na carteira desde')}>{formatarDataHora(lead.puxado_em)}</Dado>}
                <Dado rotulo={tx('Última ação')}>{lead.ultima_acao_em ? haQuanto(lead.ultima_acao_em) : ''}</Dado>
            </div>
            <div className="flex flex-col gap-2">
                <button type="button" onClick={() => abrirFicha?.(lead)} className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                    <Info className="w-4 h-4" />{tx('Ficha completa')}
                </button>
                {onNaoContatar && (
                    <button type="button" onClick={() => onNaoContatar(lead)} className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                        <Ban className="w-4 h-4" />{tx('Não contatar')}
                    </button>
                )}
                {podeApagar && deletarLead && (
                    <button type="button" onClick={() => deletarLead(lead.id)} className="h-9 rounded-lg border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                        <Trash2 className="w-4 h-4" />{tx('Apagar contato')}
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex h-[78vh] min-h-[560px] animate-[fadeIn_0.3s_ease-out]">
            {editandoMensagens && lead && (
                <MensagensProntas
                    usuarioLogado={usuarioLogado}
                    chaveInicial={pessoaPendente ? pessoaPendente.tipo : chaveMensagemDoLead(lead)}
                    onFechar={() => setEditandoMensagens(false)}
                    onSalvo={() => setTexto(mensagemPara(lead))}
                />
            )}

            {/* ===== LISTA DE CONTATOS (esquerda) ===== */}
            <aside className={`${lead || pessoaDiaAtual ? 'hidden md:flex' : 'flex'} w-full md:w-[320px] lg:w-[340px] shrink-0 flex-col border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60`}>
                <div className="p-3 space-y-2 border-b border-slate-200 dark:border-slate-800">
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={tx('Buscar por nome, CPF ou telefone')}
                            className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {FILTROS.map(f => (
                            <button key={f} type="button" onClick={() => setFiltro(f)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-colors ${filtro === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-800 dark:hover:text-white'}`}>
                                {tx(f)} <span className="opacity-70">{contagem[f] || 0}</span>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {modoHoje && (
                        <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                <span>{tx('{feitos} de {total} feitos hoje', { feitos: totalDoDia - pendentesDoDia, total: totalDoDia })}</span>
                                {contatosDoDia?.carregando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            </div>
                            <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${totalDoDia ? Math.round(((totalDoDia - pendentesDoDia) / totalDoDia) * 100) : 0}%` }} />
                            </div>
                        </div>
                    )}
                    {modoHoje && gruposHoje.map(gr => {
                        const IconeGrupo = gr.icone;
                        const feitosGrupo = gr.itens.filter(p => p.feito).length;
                        return (
                            <div key={gr.chave}>
                                <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-1.5 sticky top-0 z-10">
                                    <IconeGrupo className="w-3.5 h-3.5" />{tx(gr.titulo)}
                                    <span className="ml-auto">{gr.chave === 'AGENDADOS' ? gr.itens.length : `${feitosGrupo}/${gr.itens.length}`}</span>
                                </div>
                                {gr.itens.length === 0 && <p className="px-3 py-2 text-[10px] font-bold text-slate-400">{tx('Nenhum')}</p>}
                                {gr.itens.map(p => {
                                    const ativo = p.chave === chaveAtiva;
                                    return (
                                        <button key={p.chave} id={`conversa-item-${p.chave}`} type="button" onClick={() => escolher(p)}
                                            className={`w-full text-left px-3 py-2 flex gap-2.5 border-b border-slate-100 dark:border-slate-800 transition-colors ${ativo ? 'bg-blue-50 dark:bg-blue-500/10 border-l-4 border-l-blue-600' : 'hover:bg-white dark:hover:bg-slate-900 border-l-4 border-l-transparent'}`}>
                                            {p.feito
                                                ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                                : <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />}
                                            <div className="min-w-0 flex-1">
                                                <span className="block text-xs font-black uppercase text-slate-800 dark:text-white truncate">{p.nome}</span>
                                                <span className="block text-[10px] font-bold text-slate-400 truncate">{p.detalhe}</span>
                                                {p.feito ? (
                                                    <span className={`block text-[10px] font-black ${corMeio(p.feito.canal)}`}>
                                                        {tx('Feito')} {horaCurta(p.feito.criado_em)} · {primeiroNome(p.feito.consultor)} · {tx(rotuloMeio(p.feito.canal))}
                                                    </span>
                                                ) : (
                                                    <span className="block text-[10px] font-black text-amber-600 dark:text-amber-400">{tx('Não feito')}</span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })}
                    {!modoHoje && lista.map(v => {
                        const ativo = `lead:${v.id}` === chaveAtiva;
                        return (
                            <button key={v.id} id={`conversa-item-lead:${v.id}`} type="button" onClick={() => escolher({ chave: `lead:${v.id}`, lead: v })}
                                className={`w-full text-left px-3 py-2.5 flex gap-2.5 border-b border-slate-100 dark:border-slate-800 transition-colors ${ativo ? 'bg-blue-50 dark:bg-blue-500/10 border-l-4 border-l-blue-600' : 'hover:bg-white dark:hover:bg-slate-900 border-l-4 border-l-transparent'}`}>
                                <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 flex items-center justify-center text-[11px] font-black shrink-0">{iniciais(v.nome)}</div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-black uppercase text-slate-800 dark:text-white truncate">{v.nome}</span>
                                        <span className="text-[10px] font-bold text-slate-400 shrink-0">{haQuanto(momento(v))}</span>
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-1">
                                        <EtiquetaFase status={v.status} />
                                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${classeTipoLead(v.tipo_lead)}`}>{v.tipo_lead ? tx(v.tipo_lead) : tx('Não Informado')}</span>
                                    </div>
                                    <div className="mt-1 flex flex-wrap gap-1 empty:hidden">
                                        <EtiquetaProximo lead={v} />
                                        <EtiquetaParado lead={v} />
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                    {!modoHoje && lista.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 opacity-50">
                            <Inbox className="w-8 h-8 text-slate-400 mb-2" />
                            <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{tx('Nenhum contato')}</p>
                        </div>
                    )}
                </div>
                <div className="px-3 py-2 text-[10px] font-bold text-slate-400 text-center border-t border-slate-200 dark:border-slate-800">
                    {modoHoje ? tx('{qtd} contato(s) do dia', { qtd: totalDoDia }) : tx('{qtd} contato(s)', { qtd: lista.length })} · <span title={tx('Use as setas do teclado para passar de um contato para outro')}>{tx('↑ ↓ trocam de contato')}</span>
                </div>
            </aside>

            {/* ===== CONVERSA (meio) ===== */}
            {!lead && pessoaDiaAtual ? (
                <section className="flex-1 min-w-0 flex flex-col">
                    <div className="px-3 md:px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-white dark:bg-slate-900">
                        <button type="button" onClick={fecharSelecao} className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title={tx('Voltar para a lista')}>
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="w-9 h-9 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0"><Cake className="w-4 h-4" /></div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-black uppercase text-slate-800 dark:text-white truncate">{pessoaDiaAtual.nome}</p>
                            <p className="text-[10px] font-bold text-slate-400 truncate">{pessoaDiaAtual.telefone || tx('sem telefone')} · {pessoaDiaAtual.detalhe}</p>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-3 md:px-6 py-4 space-y-3 bg-slate-100/70 dark:bg-slate-950/40">
                        <div className="flex justify-center">
                            {pessoaDiaAtual.feito ? (
                                <span className={`text-[11px] font-black uppercase tracking-widest bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 ${corMeio(pessoaDiaAtual.feito.canal)}`}>
                                    ✅ {tx('Feito')} {horaCurta(pessoaDiaAtual.feito.criado_em)} · {pessoaDiaAtual.feito.consultor} · {tx(rotuloMeio(pessoaDiaAtual.feito.canal))}
                                </span>
                            ) : (
                                <span className="text-[11px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-3 py-1.5">
                                    {tx('Ainda não feito hoje')}
                                </span>
                            )}
                        </div>
                        <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400">{tx('Contatos já feitos com este aluno')}</p>
                        {contatosAluno.length === 0 && <p className="text-center text-xs font-bold text-slate-400">{tx('Nenhum contato registrado.')}</p>}
                        {contatosAluno.map(c => (
                            <div key={c.id} className="flex justify-center">
                                <div className="max-w-[90%] border rounded-xl px-3 py-1.5 text-[11px] font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                                    <strong className="uppercase tracking-wider">{tx(ROTULOS_MENSAGENS[c.tipo] || c.tipo)}</strong> · <span className={corMeio(c.canal)}>{tx(rotuloMeio(c.canal))}</span> · {c.consultor}
                                    <span className="text-slate-400"> · {formatarDataHora(c.criado_em)}</span>
                                    {c.justificativa ? <span className="block text-rose-600 dark:text-rose-400">{c.justificativa}</span> : null}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-wrap gap-2 justify-end">
                        <button type="button" onClick={() => contatosDoDia?.acoes?.ligar(pessoaDiaAtual)} disabled={!pessoaDiaAtual.telefone}
                            className="h-11 px-4 rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-600 hover:text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
                            <PhoneCall className="w-4 h-4" />{tx('Ligar')}
                        </button>
                        <button type="button" onClick={() => contatosDoDia?.acoes?.abrirWhatsApp(pessoaDiaAtual)} disabled={!pessoaDiaAtual.telefone}
                            className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm disabled:opacity-50" title={tx('Abre o WhatsApp com a mensagem e registra o contato')}>
                            <Send className="w-4 h-4" />{tx('Enviar parabéns no WhatsApp')}
                        </button>
                    </div>
                </section>
            ) : !lead ? (
                <div className="hidden md:flex flex-1 flex-col items-center justify-center text-center p-8 bg-slate-50/50 dark:bg-slate-900">
                    <MessageCircle className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
                    <p className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{tx('Escolha um contato na lista')}</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">{tx('Aqui aparece tudo o que já foi feito com ele (mensagens, ligações, notas e mudanças de fase) e você manda a próxima mensagem.')}</p>
                </div>
            ) : (
                <section className="flex-1 min-w-0 flex flex-col">
                    {/* Cabeçalho do contato */}
                    <div className="px-3 md:px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-white dark:bg-slate-900">
                        <button type="button" onClick={fecharSelecao} className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title={tx('Voltar para a lista')}>
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-black shrink-0">{iniciais(lead.nome)}</div>
                        <div className="min-w-0 flex-1">
                            <button type="button" onClick={() => abrirFicha?.(lead)} className="block max-w-full text-left text-sm font-black uppercase text-slate-800 dark:text-white truncate hover:text-blue-600 dark:hover:text-blue-400" title={tx('Ver Ficha e Histórico Completo')}>{lead.nome}</button>
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                <span>{lead.telefone || tx('sem telefone')}</span>
                                <EtiquetaFase status={lead.status} />
                                <EtiquetaParado lead={lead} />
                                {pessoaDiaAtual && pessoaDiaAtual.lead && (
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${pessoaDiaAtual.feito ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
                                        {tx(ROTULOS_MENSAGENS[pessoaDiaAtual.tipo] || pessoaDiaAtual.tipo)}{pessoaDiaAtual.atrasado ? ` · ${tx('atrasado')}` : ''} · {pessoaDiaAtual.feito ? tx('Feito') : tx('Não feito')}
                                    </span>
                                )}
                            </div>
                        </div>
                        <button type="button" onClick={ligar} disabled={!lead.telefone} className="h-9 w-9 rounded-lg border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white flex items-center justify-center disabled:opacity-40" title={tx('Ligar (MicroSIP)')}>
                            <PhoneCall className="w-4 h-4" />
                        </button>
                        <div className="hidden sm:flex items-center">
                            <button type="button" onClick={() => irPara(-1)} disabled={posicao <= 0} className="h-9 w-8 rounded-l-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center disabled:opacity-40" title={tx('Contato anterior')}><ChevronLeft className="w-4 h-4" /></button>
                            <button type="button" onClick={() => irPara(1)} disabled={posicao < 0 || posicao >= itensNav.length - 1} className="h-9 w-8 rounded-r-lg border border-l-0 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center disabled:opacity-40" title={tx('Próximo contato da lista')}><ChevronRight className="w-4 h-4" /></button>
                        </div>
                        <button type="button" onClick={() => setDetalhesAbertos(a => !a)} className="xl:hidden h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" title={tx('Detalhes')}>
                            {detalhesAbertos ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                        </button>
                    </div>

                    {/* Detalhes por cima da conversa (telas menores) */}
                    {detalhesAbertos && (
                        <div className="xl:hidden max-h-[50%] overflow-y-auto custom-scrollbar p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                            {painelDetalhes}
                        </div>
                    )}

                    {/* Histórico em forma de conversa */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-3 md:px-6 py-4 space-y-3 bg-slate-100/70 dark:bg-slate-950/40">
                        <div className="flex justify-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1">
                                {tx('Contato criado em {data}', { data: formatarDataHora(dataDoLead(lead)) })}
                            </span>
                        </div>
                        {carregando && (
                            <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
                        )}
                        {!carregando && historico.length === 0 && (
                            <p className="text-center text-xs font-bold text-slate-400 py-6">{tx('Nenhuma ação com este contato ainda. Mande a primeira mensagem aqui embaixo.')}</p>
                        )}
                        {blocos.map(b => (
                            <div key={b.dia} className="space-y-2">
                                <div className="flex justify-center sticky top-0 z-10">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 rounded-full px-3 py-0.5 shadow-sm">{b.rotulo}</span>
                                </div>
                                {b.itens.map(h => <ItemConversa key={h.id} item={h} etapa={etapas[h.id]} />)}
                            </div>
                        ))}
                        <div ref={fimRef} />
                    </div>

                    {/* Caixa de envio */}
                    <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <button type="button" onClick={() => setModo('whatsapp')} className={`h-8 px-3 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${modo === 'whatsapp' ? 'bg-emerald-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                                    <MessageCircle className="w-3.5 h-3.5" />{tx('WhatsApp')}
                                </button>
                                <button type="button" onClick={() => setModo('nota')} className={`h-8 px-3 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${modo === 'nota' ? 'bg-amber-500 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                                    <StickyNote className="w-3.5 h-3.5" />{tx('Nota interna')}
                                </button>
                            </div>
                            {modo === 'whatsapp' && (
                                <>
                                    {podeEscolherDestinoWhatsApp() && (
                                        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden" title={tx('Onde a conversa abre neste computador')}>
                                            {[['web', tx('WhatsApp Web')], ['app', tx('Aplicativo')]].map(([valor, rotulo]) => (
                                                <button key={valor} type="button" onClick={() => { definirDestinoWhatsApp(valor); setDestinoWpp(valor); }}
                                                    className={`h-8 px-2.5 text-[10px] font-black uppercase tracking-widest ${destinoWpp === valor ? 'bg-slate-800 text-white dark:bg-slate-700' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                                                    {rotulo}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <div className="ml-auto flex items-center gap-2">
                                        {podeEditarMensagens && (
                                            <button type="button" onClick={() => setEditandoMensagens(true)} className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                                                <PenTool className="w-3.5 h-3.5" />{tx('Mensagens')}
                                            </button>
                                        )}
                                        <button type="button" onClick={() => setTexto(mensagemPara(lead))} className="h-8 px-3 rounded-lg border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                                            <RefreshCw className="w-3.5 h-3.5" />{tx('Gerar outra')}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="flex items-end gap-2">
                            {modo === 'whatsapp' ? (
                                <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3}
                                    className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 custom-scrollbar" />
                            ) : (
                                <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={3} placeholder={tx('Anotação só para a equipe (o aluno não recebe)...')}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); salvarNota(); } }}
                                    className="flex-1 resize-none rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/10 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-amber-500 custom-scrollbar" />
                            )}
                            {modo === 'whatsapp' ? (
                                <button type="button" onClick={enviarWhatsApp} disabled={enviando || !lead.telefone || !texto.trim()}
                                    className="h-12 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm disabled:opacity-50" title={lead.telefone ? tx('Abre o WhatsApp com a mensagem e registra o contato') : tx('Contato sem telefone')}>
                                    {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}{tx('Enviar')}
                                </button>
                            ) : (
                                <button type="button" onClick={salvarNota} disabled={enviando || !nota.trim()}
                                    className="h-12 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm disabled:opacity-50">
                                    {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <StickyNote className="w-4 h-4" />}{tx('Salvar nota')}
                                </button>
                            )}
                        </div>
                    </div>
                </section>
            )}

            {/* ===== DETALHES (direita, telas grandes) ===== */}
            {lead && (
                <aside className="hidden xl:block w-[290px] shrink-0 border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-4 overflow-y-auto custom-scrollbar">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">{tx('Detalhes')}</h4>
                    {painelDetalhes}
                </aside>
            )}
        </div>
    );
};

export default Conversa;
