import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../supabaseClient.js';
import { Loader2, AlertTriangle, Send, X, Copy, ArrowUp, ArrowDown, Moon, Sun, Clock3, MessageCircle, PhoneOff, Building2, ChevronDown, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { tipoDoDia } from '../AnaliseVendas/feriados.js';
import { formatarDataHora, normalizarNome, abrirNoWhatsApp, ehMudancaPorCompra, dataLocalISO, ehBoasVindas } from './utils';
import { useResultadosRecepcao } from './useResultadosRecepcao.js';
import { tx, localeAtual } from '../../i18n/traduzir.js';
import { avisar } from '../../components/avisar.js';

// ==========================================
// PAINEL DA ENTRADA DO CRM (07/11/2026, decisão do dono: "não vejo motivo para ter 5 abas")
// Junta as antigas abas Desempenho (planilha), Rede (tabela ao vivo por unidade) e o "Resultado por recepcionista".
// Uma tabela só: na Visão Global agrupada por unidade; numa unidade, só ela.
//   Resumido: meta do dia · Começou · Ligações · WhatsApp · Fechou · Última ação
//   Detalhado: + 24h/48h · Boas-vindas · Migração · Resgate · Sem WhatsApp · % resposta · Interessados · Migrou ·
//              Voltou · Sem contato · Público
// Clicar no título ordena (maior primeiro, depois o contrário, depois volta). Clicar na recepcionista abre o resumo
// lateral; na Visão Global, clicar na unidade mostra só ela.
// Situação da unidade pelo PERÍODO escolhido (antes "Usando" valia para ação hoje OU ontem e enganava em "Hoje"):
//   Usando = teve ação no período · Sem ação = nada no período, mas usou nos últimos 7 dias · Sem uso = 7 dias ou mais.
// Turno: recepcionista da NOITE não conta como parada antes das 13h (HORA_INICIO_NOITE). Turno só vale de segunda a
// sexta (sábado, domingo e feriado têm horário próprio: ninguém é "turno da noite").
// Visão Global (07/11/2026, pedido do dono): unidades FECHADAS, cada uma numa linha com o resumo dela nas mesmas
// colunas (somas; Começou = a mais cedo; Última = a mais recente). Clicar na unidade abre/fecha (não filtra).
// Botão "Abrir todas / Fechar todas". O "Público" fica também no Resumido.
// Ao vivo: cada ligação/WhatsApp/contato novo entra na hora (como o antigo Painel da Rede).
// ==========================================

const ACOES_DE_CONTATO = ['WhatsApp', 'Ligação', 'Observação', 'Mudança de Fase'];
const PAGINA = 1000;
const MAX_PAGINAS = 30;
const DIAS_PARA_ULTIMA_ACAO = 7;
const META_DIARIA = 150;
const LIMITE_SEM_WHATSAPP = 5;
const HORA_INICIO_NOITE = 13;
const CHAVE_MODO = 'crm_painel_modo';

const PUBLICOS = {
    VISITANTE_24H: { rotulo: '24h', cor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30' },
    VISITANTE_48H: { rotulo: '48h', cor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30' },
    BOAS_VINDAS: { rotulo: 'Boas-vindas', cor: 'bg-lime-50 text-lime-800 border-lime-200 dark:bg-lime-500/10 dark:text-lime-300 dark:border-lime-500/30' },
    VISITANTE: { rotulo: 'Visitantes', cor: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30' },
    MIGRACAO: { rotulo: 'Migração', cor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30' },
    RESGATE: { rotulo: 'Resgate', cor: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/30' },
    CANCELADO: { rotulo: 'Cancelados', cor: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30' },
    INATIVO: { rotulo: 'Inativos', cor: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/30' },
    ANIVERSARIO: { rotulo: 'Aniversário', cor: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-500/10 dark:text-pink-300 dark:border-pink-500/30' },
};
const publicoDoLead = (tipoLead) => {
    const t = String(tipoLead || '').toUpperCase();
    if (t === 'CANCELADO') return 'CANCELADO';
    if (t === 'INATIVO' || t === 'CANCELADO/INATIVO') return 'INATIVO';
    if (t === 'VISITANTE') return 'VISITANTE';
    if (t === 'MIGRACAO') return 'MIGRACAO';
    return null;
};

const diasDesde = (data) => {
    if (!data) return null;
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dia = new Date(data); dia.setHours(0, 0, 0, 0);
    return Math.round((hoje - dia) / 86400000);
};

const SITUACOES = {
    USANDO: { rotulo: 'Usando', ordem: 0, classe: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30', bolinha: 'bg-emerald-500' },
    SEM_ACAO: { rotulo: 'Sem ação no período', ordem: 1, classe: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30', bolinha: 'bg-amber-500' },
    SEM_USO: { rotulo: 'Sem uso', ordem: 2, classe: 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30', bolinha: 'bg-rose-500' }
};

const buscarPaginado = async (montarQuery) => {
    const todos = [];
    for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
        const { data, error } = await montarQuery().range(pagina * PAGINA, pagina * PAGINA + PAGINA - 1);
        if (error) throw error;
        todos.push(...(data || []));
        if (!data || data.length < PAGINA) return { dados: todos, cortado: false };
    }
    return { dados: todos, cortado: true };
};

const lerModo = () => { try { return localStorage.getItem(CHAVE_MODO) === 'detalhado' ? 'detalhado' : 'resumido'; } catch { return 'resumido'; } };

const PainelCrm = ({
    podeCobrar = true, colaboradores = [], recepcionistas = [], faixa = { inicio: null, fim: null }, rotuloPeriodo = '', versao,
    visaoGlobal = false, unidadeEscopo = '', extras = new Map(), onAbrirResumo
}) => {
    const [unidades, setUnidades] = useState([]);
    const [historico, setHistorico] = useState([]);
    const [contatosFeitos, setContatosFeitos] = useState([]);
    const [leadsInfo, setLeadsInfo] = useState({});
    const [carregando, setCarregando] = useState(false);
    const [erro, setErro] = useState(false);
    const [cortado, setCortado] = useState(false);
    const [modo, setModoEstado] = useState(lerModo);
    const [ordem, setOrdem] = useState({ col: '', dir: 'desc' });
    const [alerta, setAlerta] = useState('');
    const [mensagem, setMensagem] = useState(null);
    const leadsInfoRef = useRef({});

    const setModo = (m) => { setModoEstado(m); try { localStorage.setItem(CHAVE_MODO, m); } catch { /* sem armazenamento */ } };
    const inicioIso = faixa.inicio ? faixa.inicio.toISOString() : '';
    const fimIso = faixa.fim ? faixa.fim.toISOString() : '';
    const hojeIso = dataLocalISO(new Date());
    const periodoTemHoje = (!faixa.inicio || dataLocalISO(faixa.inicio) <= hojeIso) && (!faixa.fim || dataLocalISO(faixa.fim) > hojeIso);
    const periodoEhHoje = periodoTemHoje && faixa.inicio && dataLocalISO(faixa.inicio) === hojeIso;
    const diaUtil = !tipoDoDia(hojeIso);
    const [abertas, setAbertas] = useState(() => new Set());

    // Nome real da unidade (para a consulta de Migrou/Voltou, que é por unidade)
    const nomeUnidade = useMemo(() => (unidadeEscopo ? recepcionistas.find(r => normalizarNome(r.unidade) === unidadeEscopo)?.unidade || '' : ''), [recepcionistas, unidadeEscopo]);
    const resultados = useResultadosRecepcao({ faixa, nomeUnidade, unidadeEscopo, versao });

    const buscarInfoLeads = async (ids) => {
        const faltam = [...new Set(ids.map(String))].filter(id => id && id !== 'null' && !leadsInfoRef.current[id]);
        if (!faltam.length) return;
        const novos = {};
        for (let i = 0; i < faltam.length; i += 200) {
            const { data, error } = await supabase.from('leads').select('id, tipo_lead, unidade').in('id', faltam.slice(i, i + 200));
            if (error) { console.error('Painel do CRM: erro ao ler os contatos', error); break; }
            (data || []).forEach(l => { novos[String(l.id)] = { tipo_lead: l.tipo_lead, unidade: l.unidade }; });
        }
        leadsInfoRef.current = { ...leadsInfoRef.current, ...novos };
        setLeadsInfo(leadsInfoRef.current);
    };

    useEffect(() => {
        let cancelado = false;
        (async () => {
            setCarregando(true);
            setErro(false);
            try {
                const limiteUltima = new Date();
                limiteUltima.setDate(limiteUltima.getDate() - DIAS_PARA_ULTIMA_ACAO);
                limiteUltima.setHours(0, 0, 0, 0);
                const desde = inicioIso ? new Date(Math.min(new Date(inicioIso).getTime(), limiteUltima.getTime())) : limiteUltima;
                const [resUnidades, resHist] = await Promise.all([
                    visaoGlobal && !unidadeEscopo ? supabase.from('unidades').select('*').order('nome', { ascending: true }) : Promise.resolve({ data: [] }),
                    buscarPaginado(() => supabase.from('historico_leads').select('id, lead_id, consultor, tipo_acao, observacao, data_registro')
                        .in('tipo_acao', ACOES_DE_CONTATO).gte('data_registro', desde.toISOString()).order('data_registro', { ascending: false }))
                ]);
                let feitos = [];
                try {
                    const resFeitos = await buscarPaginado(() => supabase.from('crm_contatos_feitos').select('id, unidade, criado_em, consultor, tipo, canal, lead_id, aluno_id')
                        .gte('criado_em', desde.toISOString()).order('criado_em', { ascending: false }));
                    feitos = resFeitos.dados;
                } catch (erroFeitos) {
                    console.warn('Contatos feitos indisponíveis no Painel do CRM:', erroFeitos?.message || erroFeitos);
                }
                if (cancelado) return;
                setUnidades((resUnidades.data || []).filter(u => u.ativa !== false));
                setHistorico(resHist.dados);
                setContatosFeitos(feitos);
                setCortado(resHist.cortado);
                setCarregando(false);
                const inicio = inicioIso ? new Date(inicioIso) : null;
                await buscarInfoLeads(resHist.dados.filter(h => !inicio || new Date(h.data_registro) >= inicio).map(h => h.lead_id));
            } catch (e) {
                if (cancelado) return;
                console.error('Erro ao montar o Painel do CRM:', e);
                setErro(true);
                setCarregando(false);
            }
        })();
        return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- buscarInfoLeads só lê o cache
    }, [inicioIso, versao, visaoGlobal, unidadeEscopo]);

    // AO VIVO
    useEffect(() => {
        const canal = supabase.channel(`crm-painel-ao-vivo-${Math.random().toString(36).slice(2, 8)}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'historico_leads' }, (p) => {
                const h = p.new;
                if (!h || !ACOES_DE_CONTATO.includes(h.tipo_acao)) return;
                setHistorico(prev => (prev.some(x => x.id === h.id) ? prev : [h, ...prev]));
                buscarInfoLeads([h.lead_id]);
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_contatos_feitos' }, (p) => {
                const f = p.new;
                if (f) setContatosFeitos(prev => (prev.some(x => x.id === f.id) ? prev : [f, ...prev]));
            })
            .subscribe();
        return () => { supabase.removeChannel(canal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- canal aberto uma vez
    }, []);

    // Todas as ações num formato só
    const acoes = useMemo(() => {
        const unidadeDoConsultor = new Map();
        colaboradores.forEach(c => {
            const chave = normalizarNome(c.nome);
            if (chave && c.unidade && !unidadeDoConsultor.has(chave)) unidadeDoConsultor.set(chave, c.unidade);
        });
        const lista = [];
        historico.forEach(h => {
            if (ehMudancaPorCompra(h.observacao)) return;
            const info = leadsInfo[String(h.lead_id)];
            const meio = h.tipo_acao === 'WhatsApp' || h.tipo_acao === 'Ligação' ? h.tipo_acao : null;
            lista.push({
                id: `h${h.id}`, quando: h.data_registro, consultor: h.consultor,
                unidade: unidadeDoConsultor.get(normalizarNome(h.consultor)) || info?.unidade || '',
                // Boas-vindas do Cadastro de Visitante tem etiqueta própria (07/11/2026)
                meio, publico: meio ? (ehBoasVindas(h) ? 'BOAS_VINDAS' : publicoDoLead(info?.tipo_lead)) : null,
                fechou: h.tipo_acao === 'Mudança de Fase' && String(h.observacao || '').includes('para "Fechado"') && !String(h.observacao || '').startsWith('Movido em lote') ? String(h.lead_id) : null,
                contaNaUnidade: true, pessoa: `lead:${h.lead_id}`,
            });
        });
        contatosFeitos.forEach(f => {
            const semLead = f.lead_id === null || f.lead_id === undefined;
            const t = String(f.tipo || '').toUpperCase();
            lista.push({
                id: `f${f.id}`, quando: f.criado_em, consultor: f.consultor,
                unidade: f.unidade || unidadeDoConsultor.get(normalizarNome(f.consultor)) || '',
                meio: f.canal === 'WHATSAPP' ? (semLead ? 'WhatsApp' : null) : f.canal === 'LIGACAO' ? (semLead ? 'Ligação' : null) : 'Sem WhatsApp',
                publico: PUBLICOS[t] ? t : null, fechou: null, contaNaUnidade: semLead,
                pessoa: semLead ? `aluno:${f.aluno_id || `f${f.id}`}` : `lead:${f.lead_id}`,
            });
        });
        return lista;
    }, [historico, contatosFeitos, leadsInfo, colaboradores]);

    // Unidades e recepcionistas com os números
    const linhas = useMemo(() => {
        const mapa = new Map();
        const unidadeDa = (nome) => {
            const chave = normalizarNome(nome);
            if (!chave) return null;
            if (unidadeEscopo && chave !== unidadeEscopo) return null;
            if (!mapa.has(chave)) mapa.set(chave, { chave, unidade: String(nome).toUpperCase().trim(), acoes: 0, fechadosIds: new Set(), ultima: null, pessoas: new Map() });
            return mapa.get(chave);
        };
        unidades.forEach(u => unidadeDa(u.nome));
        recepcionistas.forEach(c => {
            const u = unidadeDa(c.unidade);
            if (!u) return;
            const k = normalizarNome(c.nome);
            u.pessoas.set(k, {
                chave: k, nome: String(c.nome || '').toUpperCase(), colaborador: c, turno: String(c.turno || '').toUpperCase(),
                ligacoes: 0, whatsapp: 0, semWhatsapp: 0, publico: {}, ultima: null, ultimaMeio: '',
                pessoasHoje: new Set(), ligHoje: 0, zapHoje: 0, semHoje: 0, primeiraHoje: null, fechadosIds: new Set()
            });
        });
        const inicio = inicioIso ? new Date(inicioIso) : null;
        const fim = fimIso ? new Date(fimIso) : null;
        const noPeriodo = (data) => (!inicio || new Date(data) >= inicio) && (!fim || new Date(data) < fim);
        const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0);

        acoes.forEach(a => {
            const u = mapa.get(normalizarNome(a.unidade));
            if (!u) return;
            if (a.contaNaUnidade && (!u.ultima || new Date(a.quando) > new Date(u.ultima))) u.ultima = a.quando;
            const p = u.pessoas.get(normalizarNome(a.consultor));
            if (p && a.meio && (!p.ultima || new Date(a.quando) > new Date(p.ultima))) { p.ultima = a.quando; p.ultimaMeio = a.meio; }
            if (p && new Date(a.quando) >= inicioHoje) {
                if (a.contaNaUnidade || a.publico) p.pessoasHoje.add(a.pessoa);
                if (a.meio === 'Ligação') p.ligHoje++;
                else if (a.meio === 'WhatsApp') p.zapHoje++;
                else if (a.meio === 'Sem WhatsApp') p.semHoje++;
                if (a.meio && (!p.primeiraHoje || new Date(a.quando) < new Date(p.primeiraHoje))) p.primeiraHoje = a.quando;
            }
            if (!noPeriodo(a.quando)) return;
            if (a.contaNaUnidade) u.acoes++;
            if (a.fechou) u.fechadosIds.add(a.fechou);
            if (!p) return;
            if (a.fechou) p.fechadosIds.add(a.fechou);
            if (a.meio === 'Ligação') p.ligacoes++;
            else if (a.meio === 'WhatsApp') p.whatsapp++;
            else if (a.meio === 'Sem WhatsApp') p.semWhatsapp++;
            if (a.publico) p.publico[a.publico] = (p.publico[a.publico] || 0) + 1;
        });

        const agora = new Date();
        return [...mapa.values()].map(({ fechadosIds, pessoas, ...u }) => {
            const lista = [...pessoas.values()].map(({ fechadosIds: fIds, ...p }) => {
                const ext = extras.get(p.chave) || {};
                const res = resultados.porNome.get(p.chave) || {};
                const marcados = (res.responderam || 0) + (res.naoResponderam || 0);
                return {
                    ...p,
                    fechou: ext.fechados ?? fIds.size,
                    prazos: ext.prazos || { noPrazo24: 0, atrasado24: 0, noPrazo48: 0, atrasado48: 0 },
                    boasVindas: ext.boasVindas || { total: 0, enviadas: 0 },
                    migracao: ext.migracao?.total || 0,
                    resgate: p.publico.RESGATE || 0,
                    semContato: ext.semContato || 0,
                    responderam: res.responderam || 0,
                    interessados: res.interessados || 0,
                    taxa: marcados ? Math.round(((res.responderam || 0) / marcados) * 100) : null,
                    migrou: res.migrou || 0,
                    voltou: res.voltou || 0,
                    // Turno da noite antes das 13h: ainda não começou (não é parada)
                    naoResponderam: res.naoResponderam || 0,
                    noiteAindaNao: diaUtil && periodoTemHoje && p.turno === 'NOITE' && agora.getHours() < HORA_INICIO_NOITE
                };
            });
            const dias = diasDesde(u.ultima);
            const situacao = u.acoes > 0 ? SITUACOES.USANDO : (dias !== null && dias < DIAS_PARA_ULTIMA_ACAO ? SITUACOES.SEM_ACAO : SITUACOES.SEM_USO);
            const pessoasHojeUnidade = lista.reduce((s, p) => s + p.pessoasHoje.size, 0);
            return { ...u, fechados: fechadosIds.size, situacao, pessoas: lista, pessoasHojeUnidade, metaUnidade: META_DIARIA * lista.length };
        });
    }, [unidades, recepcionistas, acoes, inicioIso, fimIso, unidadeEscopo, extras, resultados, periodoTemHoje, diaUtil]);

    // Alertas (o que pede ação agora). Clicar filtra a tabela.
    const alertas = useMemo(() => {
        const todas = linhas.flatMap(l => l.pessoas);
        return [
            { id: 'semAcao', icone: Building2, cor: 'rose', qtd: linhas.filter(l => l.situacao !== SITUACOES.USANDO && l.pessoas.length).length, texto: (q) => tx('{qtd} unidade(s) sem ação no período', { qtd: q }) },
            { id: 'atrasados', icone: Clock3, cor: 'amber', qtd: todas.reduce((s, p) => s + p.prazos.atrasado24 + p.prazos.atrasado48, 0), texto: (q) => tx('{qtd} visitante(s) 24h/48h atrasado(s)', { qtd: q }) },
            { id: 'boasVindas', icone: MessageCircle, cor: 'amber', qtd: todas.reduce((s, p) => s + (p.boasVindas.total - p.boasVindas.enviadas), 0), texto: (q) => tx('{qtd} visitante(s) sem boas-vindas', { qtd: q }) },
            { id: 'semWpp', icone: PhoneOff, cor: 'rose', qtd: todas.filter(p => p.semHoje > LIMITE_SEM_WHATSAPP).length, texto: (q) => tx('{qtd} recepcionista(s) com mais de {lim} "sem WhatsApp" hoje', { qtd: q, lim: LIMITE_SEM_WHATSAPP }) }
        ].filter(a => a.qtd > 0);
    }, [linhas]);

    const passaAlerta = (l, p) => {
        if (!alerta) return true;
        if (alerta === 'semAcao') return l.situacao !== SITUACOES.USANDO;
        if (alerta === 'atrasados') return p.prazos.atrasado24 + p.prazos.atrasado48 > 0;
        if (alerta === 'boasVindas') return p.boasVindas.total > p.boasVindas.enviadas;
        if (alerta === 'semWpp') return p.semHoje > LIMITE_SEM_WHATSAPP;
        return true;
    };

    // Colunas
    const haQuanto = (data) => {
        if (!data) return tx("Nada nos últimos {DIAS_PARA_ULTIMA_ACAO} dias", { DIAS_PARA_ULTIMA_ACAO });
        const min = Math.floor((Date.now() - new Date(data).getTime()) / 60000);
        if (min < 60) return tx("há {qtd} min", { qtd: Math.max(1, min) });
        if (min < 24 * 60) return tx("há {qtd} h", { qtd: Math.floor(min / 60) });
        const dias = diasDesde(data);
        return dias === 1 ? tx("ontem") : tx("há {dias} dias", { dias });
    };
    const corUltima = (data) => { const d = diasDesde(data); return d === null || d >= 7 ? 'text-rose-700 dark:text-rose-400' : d >= 1 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'; };
    const num = (n, cor = 'text-slate-800 dark:text-white') => (n > 0 ? <span className={`text-base font-black tabular-nums ${cor}`}>{n}</span> : <span className="text-slate-300 dark:text-slate-600">—</span>);
    const hora = (d) => new Date(d).toLocaleTimeString(localeAtual(), { hour: '2-digit', minute: '2-digit' });
    const prazo = (feito, atrasado) => (
        <>{num(feito, 'text-emerald-600 dark:text-emerald-400')}{atrasado > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[10px] font-black" title={tx("Atrasados (de quem atendeu a visita)")}>{atrasado}{' '}{tx("atras.")}</span>}</>
    );

    const COLUNAS = [
        { id: 'comecou', rotulo: 'Começou', dica: 'Primeiro contato de hoje (ligação ou WhatsApp).', valor: p => (p.primeiraHoje ? -new Date(p.primeiraHoje).getTime() : -Infinity), celula: p => (p.primeiraHoje ? <span className="text-sm font-black text-slate-800 dark:text-white tabular-nums">{hora(p.primeiraHoje)}</span> : <span className="text-slate-300 dark:text-slate-600">—</span>) },
        { id: 'ligacoes', rotulo: 'Ligações', valor: p => p.ligacoes, celula: p => num(p.ligacoes) },
        { id: 'whatsapp', rotulo: 'WhatsApp', valor: p => p.whatsapp, celula: p => num(p.whatsapp, 'text-emerald-700 dark:text-emerald-400') },
        { id: 'v24', rotulo: '24h', detalhe: true, dica: 'Visitantes 24h: no prazo (quem fez) · atrasados (quem atendeu a visita).', valor: p => p.prazos.noPrazo24, celula: p => prazo(p.prazos.noPrazo24, p.prazos.atrasado24) },
        { id: 'v48', rotulo: '48h', detalhe: true, dica: 'Visitantes 48h: no prazo (quem fez) · atrasados (quem atendeu a visita).', valor: p => p.prazos.noPrazo48, celula: p => prazo(p.prazos.noPrazo48, p.prazos.atrasado48) },
        { id: 'bv', rotulo: 'Boas-vindas', detalhe: true, dica: 'Visitantes que ela cadastrou no período × quantos receberam a boas-vindas no WhatsApp.', valor: p => (p.boasVindas.total ? p.boasVindas.enviadas / p.boasVindas.total : -1), celula: p => (p.boasVindas.total === 0 ? <span className="text-slate-300 dark:text-slate-600">—</span> : <span className={`text-[13px] font-black ${p.boasVindas.enviadas === p.boasVindas.total ? 'text-emerald-600 dark:text-emerald-400' : p.boasVindas.enviadas === 0 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>{p.boasVindas.enviadas}<span className="text-slate-400 font-bold">/{p.boasVindas.total}</span></span>) },
        { id: 'migracao', rotulo: 'Migração', detalhe: true, dica: 'Contatos de migração para plano com nutricionista.', valor: p => p.migracao, celula: p => num(p.migracao, 'text-blue-600 dark:text-blue-400') },
        { id: 'resgate', rotulo: 'Resgate', detalhe: true, dica: 'Contatos com alunos finalizados e inativos (aba Resgate).', valor: p => p.resgate, celula: p => num(p.resgate, 'text-teal-600 dark:text-teal-400') },
        { id: 'semWpp', rotulo: 'Sem WhatsApp', detalhe: true, dica: 'Contatos marcados como feitos sem mandar o WhatsApp (o Líder confere).', valor: p => p.semWhatsapp, celula: p => num(p.semWhatsapp, 'text-rose-600 dark:text-rose-400') },
        { id: 'taxa', rotulo: '% resposta', detalhe: true, dica: 'Marcado na janela "Como foi o contato?" da Migração e do Resgate: responderam ÷ (responderam + não responderam). O sistema não lê o WhatsApp.', valor: p => (p.taxa === null ? -1 : p.taxa), celula: p => (p.taxa === null ? <span className="text-slate-300 dark:text-slate-600">—</span> : <span className={`text-[13px] font-black ${p.taxa >= 50 ? 'text-emerald-600 dark:text-emerald-400' : p.taxa >= 25 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>{p.taxa}%</span>) },
        { id: 'interessados', rotulo: 'Interessados', detalhe: true, valor: p => p.interessados, celula: p => num(p.interessados, 'text-amber-600 dark:text-amber-400') },
        ...(resultados.conversoes ? [
            { id: 'migrou', rotulo: 'Migrou', detalhe: true, dica: 'Alunos da fila de Migração dela que compraram plano com Nutri no período.', valor: p => p.migrou, celula: p => num(p.migrou, 'text-emerald-600 dark:text-emerald-400') },
            { id: 'voltou', rotulo: 'Voltou', detalhe: true, dica: 'Alunos da fila de Resgate dela que compraram plano no período.', valor: p => p.voltou, celula: p => num(p.voltou, 'text-teal-600 dark:text-teal-400') }
        ] : []),
        { id: 'fechou', rotulo: 'Fechou', dica: 'Contatos do funil que ela passou para "Fechado". Quem comprou e saiu sozinho do funil não conta.', valor: p => p.fechou, celula: p => num(p.fechou, 'text-emerald-700 dark:text-emerald-300') },
        { id: 'semContato', rotulo: 'Sem contato', detalhe: true, dica: 'Contatos na carteira dela em que nada foi feito no período.', valor: p => p.semContato, celula: p => (p.semContato > 0 ? <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[12px] font-black">{p.semContato}</span> : <span className="text-slate-300 dark:text-slate-600">—</span>) },
        { id: 'publico', rotulo: 'Público', semOrdem: true, celula: p => { const ps = Object.entries(p.publico).sort((a, b) => b[1] - a[1]); return ps.length ? <div className="flex flex-wrap justify-center gap-2">{ps.map(([k, q]) => <span key={k} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-black ${PUBLICOS[k].cor}`}>{tx(PUBLICOS[k].rotulo)}<span className="tabular-nums text-base">{q}</span></span>)}</div> : <span className="text-slate-300 dark:text-slate-600">—</span>; } },
        { id: 'ultima', rotulo: 'Última ação', esquerda: true, valor: p => (p.ultima ? new Date(p.ultima).getTime() : 0), celula: p => (
            <span className="whitespace-nowrap" title={p.ultima ? formatarDataHora(p.ultima) : ''}>
                <span className={`text-sm font-black ${p.ultima ? corUltima(p.ultima) : 'text-rose-600 dark:text-rose-400'}`}>{haQuanto(p.ultima)}</span>
                {p.ultimaMeio && <span className="block text-[12px] font-semibold text-slate-500 dark:text-slate-400">{tx(p.ultimaMeio)} · {formatarDataHora(p.ultima)}</span>}
            </span>
        ) }
    ];
    const colunas = COLUNAS.filter(c => modo === 'detalhado' || !c.detalhe);
    // Soma das recepcionistas da unidade, no mesmo formato de uma recepcionista (para a linha da unidade fechada)
    const somaDaUnidade = (l) => {
        const ps = l.pessoas;
        const soma = (fn) => ps.reduce((s, p) => s + (fn(p) || 0), 0);
        const publico = {};
        ps.forEach(p => Object.entries(p.publico).forEach(([k, q]) => { publico[k] = (publico[k] || 0) + q; }));
        const primeira = ps.map(p => p.primeiraHoje).filter(Boolean).sort((a, b) => new Date(a) - new Date(b))[0] || null;
        const ultimaP = ps.filter(p => p.ultima).sort((a, b) => new Date(b.ultima) - new Date(a.ultima))[0];
        const responderam = soma(p => p.responderam);
        const naoResponderam = soma(p => p.naoResponderam);
        return {
            primeiraHoje: primeira, ligacoes: soma(p => p.ligacoes), whatsapp: soma(p => p.whatsapp), semWhatsapp: soma(p => p.semWhatsapp),
            prazos: { noPrazo24: soma(p => p.prazos.noPrazo24), atrasado24: soma(p => p.prazos.atrasado24), noPrazo48: soma(p => p.prazos.noPrazo48), atrasado48: soma(p => p.prazos.atrasado48) },
            boasVindas: { total: soma(p => p.boasVindas.total), enviadas: soma(p => p.boasVindas.enviadas) },
            migracao: soma(p => p.migracao), resgate: soma(p => p.resgate), semContato: soma(p => p.semContato),
            responderam, naoResponderam, taxa: responderam + naoResponderam ? Math.round((responderam / (responderam + naoResponderam)) * 100) : null,
            interessados: soma(p => p.interessados), migrou: soma(p => p.migrou), voltou: soma(p => p.voltou),
            fechou: soma(p => p.fechou), publico,
            ultima: ultimaP?.ultima || l.ultima || null, ultimaMeio: ultimaP?.ultimaMeio || ''
        };
    };
    const colOrdem = COLUNAS.find(c => c.id === ordem.col);

    const clicarTitulo = (c) => {
        if (c.semOrdem) return;
        setOrdem(o => (o.col !== c.id ? { col: c.id, dir: 'desc' } : o.dir === 'desc' ? { col: c.id, dir: 'asc' } : { col: '', dir: 'desc' }));
    };

    // Linhas na ordem certa (dentro de cada unidade; as unidades pela soma da coluna)
    const visiveis = useMemo(() => {
        const sinal = ordem.dir === 'asc' ? 1 : -1;
        const valorP = (p) => (colOrdem ? colOrdem.valor(p) : p.pessoasHoje.size);
        return linhas.map(l => ({ ...l, pessoas: l.pessoas.filter(p => passaAlerta(l, p)).sort((a, b) => (colOrdem ? sinal * (valorP(a) - valorP(b)) : (b.pessoasHoje.size - a.pessoasHoje.size) || a.nome.localeCompare(b.nome, 'pt-BR'))) }))
            .filter(l => !alerta || l.pessoas.length || (alerta === 'semAcao' && l.situacao !== SITUACOES.USANDO))
            .sort((a, b) => {
                if (!colOrdem) return a.situacao.ordem - b.situacao.ordem || b.acoes - a.acoes || a.unidade.localeCompare(b.unidade, 'pt-BR');
                const soma = (l) => l.pessoas.reduce((s, p) => s + Math.max(0, Number(valorP(p)) || 0), 0);
                return sinal * (soma(a) - soma(b));
            });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- passaAlerta depende só de "alerta"
    }, [linhas, ordem, alerta, modo]);

    const resumo = useMemo(() => ({
        usando: linhas.filter(l => l.situacao === SITUACOES.USANDO).length,
        semAcao: linhas.filter(l => l.situacao === SITUACOES.SEM_ACAO).length,
        semUso: linhas.filter(l => l.situacao === SITUACOES.SEM_USO).length
    }), [linhas]);

    // Cobrança no WhatsApp (sempre do DIA): quem trabalhou, quem está parada, alertas
    const montarCobranca = () => {
        const hoje = new Date();
        const dia = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}`;
        const primeiro = (n) => String(n || '').split(' ')[0];
        const trabalharam = [];
        const paradas = [];
        const noite = [];
        linhas.forEach(l => l.pessoas.forEach(p => {
            const fez = p.ligHoje + p.zapHoje + p.semHoje > 0;
            if (fez) trabalharam.push({ l, p });
            else if (p.noiteAindaNao) noite.push({ l, p });
            else paradas.push({ l, p });
        }));
        // Mensagem do grupo (decisão do dono, 09/11/2026, depois de 3 versões "poluídas"): EMOJI SÓ NOS TÍTULOS,
        // nenhum nas linhas das pessoas. Linha: "1. *Nome* · Unidade — 162  _159 lig · 3 zap_" (nome em negrito,
        // total normal, detalhe em itálico, que no WhatsApp fica mais leve; a parte zerada não aparece).
        // Em cima, o total da equipe no dia. Quem não começou: uma linha por unidade. ⚠️ "sem WhatsApp" continua (anti-golpe).
        const bonito = (t) => String(t || '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
        const totalDe = (p) => p.ligHoje + p.zapHoje + p.semHoje;
        const detalhe = (lig, zap) => [lig && `${lig} lig`, zap && `${zap} zap`].filter(Boolean).join(' · ');
        trabalharam.sort((a, b) => totalDe(b.p) - totalDe(a.p));
        // Ajuste do dono (09/11/2026): sem a linha "Equipe hoje", ✅ no lugar do 🔥, sem o total na linha
        // (só "159 lig · 3 zap") e a unidade entre parênteses.
        let txt = `📋 *CRM DA RECEPÇÃO · ${dia}*\n\n`;
        txt += `✅ *Já trabalharam (${trabalharam.length})*\n`;
        txt += (trabalharam.map(({ l, p }, i) => {
            const det = detalhe(p.ligHoje, p.zapHoje);
            const sem = p.semHoje ? `${p.semHoje > LIMITE_SEM_WHATSAPP ? '⚠️ ' : ''}${p.semHoje} sem WhatsApp` : '';
            const partes = [det && `_${det}_`, sem].filter(Boolean).join('  ');
            return `${i + 1}. *${bonito(primeiro(p.nome))}* (${bonito(l.unidade)}) — ${partes}`;
        }).join('\n') || '—');
        if (noite.length) txt += `\n\n🌙 *Noite (a partir das ${HORA_INICIO_NOITE}h)*\n${noite.map(({ l, p }) => `${bonito(primeiro(p.nome))} (${bonito(l.unidade)})`).join(', ')}`;
        if (paradas.length) {
            const porUnidade = new Map();
            paradas.forEach(({ l, p }) => {
                const u = bonito(l.unidade);
                if (!porUnidade.has(u)) porUnidade.set(u, []);
                porUnidade.get(u).push(bonito(primeiro(p.nome)));
            });
            txt += `\n\n⏳ *Ainda não começaram (${paradas.length})*\n`;
            txt += [...porUnidade].map(([u, nomes]) => `${u}: ${nomes.join(', ')}`).join('\n');
        }
        if (periodoEhHoje) {
            const atrasados = linhas.flatMap(l => l.pessoas).reduce((s, p) => s + p.prazos.atrasado24 + p.prazos.atrasado48, 0);
            const semBV = linhas.flatMap(l => l.pessoas).reduce((s, p) => s + (p.boasVindas.total - p.boasVindas.enviadas), 0);
            if (atrasados || semBV) {
                txt += `\n\n⚠️ *Atenção*`;
                if (atrasados) txt += `\n${atrasados} visitante(s) 24h/48h atrasado(s)`;
                if (semBV) txt += `\n${semBV} visitante(s) de hoje sem boas-vindas`;
            }
        }
        if (paradas.length) txt += `\n\n👉 *Bora começar os contatos de hoje!*`;
        setMensagem(txt);
    };
    const copiar = async () => {
        try { await navigator.clipboard.writeText(mensagem); avisar(tx('Mensagem copiada.'), 'sucesso'); }
        catch { avisar(tx('Não foi possível copiar. Selecione o texto e copie.'), 'erro'); }
    };

    const th = 'px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 whitespace-nowrap select-none';
    const corAlerta = { rose: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30', amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30' };
    const mostrarUnidades = visaoGlobal && !unidadeEscopo;

    return (
        <div className="space-y-3">
            {/* Faixa: período, Resumido/Detalhado, situação das unidades e cobrança */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        {['resumido', 'detalhado'].map(m => (
                            <button key={m} type="button" onClick={() => setModo(m)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${modo === m ? 'bg-white dark:bg-slate-900 shadow-sm text-blue-700 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}>{tx(m === 'resumido' ? 'Resumido' : 'Detalhado')}</button>
                        ))}
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{tx(rotuloPeriodo)}</span>
                    {mostrarUnidades && (
                        <button type="button" onClick={() => setAbertas(abertas.size ? new Set() : new Set(linhas.map(l => l.chave)))} className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5">
                            {abertas.size ? <ChevronsDownUp className="w-3.5 h-3.5" /> : <ChevronsUpDown className="w-3.5 h-3.5" />}{tx(abertas.size ? 'Fechar todas' : 'Abrir todas')}
                        </button>
                    )}
                    {carregando && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {mostrarUnidades && <>
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${SITUACOES.USANDO.classe}`}>{resumo.usando}{' '}{tx("usando")}</span>
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${SITUACOES.SEM_ACAO.classe}`}>{resumo.semAcao}{' '}{tx("sem ação")}</span>
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${SITUACOES.SEM_USO.classe}`}>{resumo.semUso}{' '}{tx("sem uso")}</span>
                    </>}
                    {podeCobrar && <button type="button" onClick={montarCobranca} disabled={carregando} className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><Send className="w-3.5 h-3.5" />{tx('Cobrar no WhatsApp')}</button>}
                </div>
            </div>

            {/* Alertas: clicar filtra a tabela */}
            {alertas.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    {alertas.map(a => {
                        const Icone = a.icone;
                        const ativo = alerta === a.id;
                        return (
                            <button key={a.id} type="button" onClick={() => setAlerta(ativo ? '' : a.id)} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${corAlerta[a.cor]} ${ativo ? 'ring-2 ring-blue-500/50' : 'hover:brightness-95'}`}>
                                <Icone className="w-3.5 h-3.5" />{a.texto(a.qtd)}
                            </button>
                        );
                    })}
                    {alerta && <button type="button" onClick={() => setAlerta('')} className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 hover:underline">{tx('Limpar filtro')}</button>}
                </div>
            )}

            {mensagem !== null && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => setMensagem(null)}>
                    <div className="bg-white rounded-2xl shadow-xl w-[min(560px,100%)] p-5 space-y-3 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-[13px] font-black uppercase tracking-widest text-slate-800 dark:text-white">{tx('Cobrança do dia')}</h3>
                            <button type="button" onClick={() => setMensagem(null)} aria-label={tx('Fechar')} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>
                        </div>
                        <textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={14} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-[12px] font-mono text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800/60 dark:border-slate-700 dark:text-white" />
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={copiar} className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest flex items-center gap-2"><Copy className="w-4 h-4" />{tx('Copiar')}</button>
                            <button type="button" onClick={() => abrirNoWhatsApp('', mensagem)} className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-widest flex items-center gap-2"><Send className="w-4 h-4" />{tx('Enviar no WhatsApp')}</button>
                        </div>
                    </div>
                </div>
            )}

            {erro && (
                <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-xl px-4 py-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />{' '}{tx("Não foi possível carregar o painel. Tente recarregar a página.")}
                </div>
            )}
            {cortado && (
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-xl px-4 py-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />{' '}{tx("Muitos registros: os números foram calculados com os primeiros")}{' '}{(PAGINA * MAX_PAGINAS).toLocaleString(localeAtual())}{' '}{tx("e podem estar abaixo da realidade. Escolha um período menor.")}
                </div>
            )}

            {visiveis.length === 0 ? (
                <p className="text-center py-10 text-[10px] font-black uppercase tracking-widest text-slate-400">{carregando ? tx("Carregando...") : tx("Nenhuma recepcionista para mostrar.")}</p>
            ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto custom-scrollbar">
                    <table className="w-full min-w-[760px] border-collapse text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/60">
                            <tr>
                                <th className={`${th} sticky left-0 z-10 bg-slate-50 dark:bg-slate-800`}>{tx(mostrarUnidades ? "Unidade / recepcionista" : "Recepcionista")}</th>
                                {colunas.map(c => (
                                    <th key={c.id} className={`${th} ${c.esquerda ? '' : 'text-center'} ${c.semOrdem ? '' : 'cursor-pointer hover:text-blue-600 dark:hover:text-blue-400'}`} onClick={() => clicarTitulo(c)} title={c.dica ? tx(c.dica) : (c.semOrdem ? '' : tx('Clique para ordenar'))}>
                                        <span className="inline-flex items-center gap-1">
                                            {tx(c.rotulo)}
                                            {ordem.col === c.id && (ordem.dir === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />)}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {visiveis.map(l => {
                                const aberta = !mostrarUnidades || !!alerta || abertas.has(l.chave);
                                const pct = l.metaUnidade ? Math.min(100, (l.pessoasHojeUnidade / l.metaUnidade) * 100) : 0;
                                const somaU = mostrarUnidades ? somaDaUnidade(l) : null;
                                return (
                                    <React.Fragment key={l.chave}>
                                        {mostrarUnidades && (
                                            <tr className="group border-t border-slate-200 dark:border-slate-800 cursor-pointer bg-slate-50/60 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                                                onClick={() => setAbertas(prev => { const n = new Set(prev); if (n.has(l.chave)) n.delete(l.chave); else n.add(l.chave); return n; })} title={tx(aberta ? "Fechar a unidade" : "Abrir a unidade")}>
                                                <td className="px-3 py-2.5 sticky left-0 z-10 bg-slate-50 dark:bg-slate-800 group-hover:bg-slate-100 dark:group-hover:bg-slate-800">
                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${aberta ? '' : '-rotate-90'}`} />
                                                        <span className="text-sm font-black uppercase text-slate-800 dark:text-white">{l.unidade}</span>
                                                        <span className="text-[10px] font-black text-slate-400 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">{l.pessoas.length}</span>
                                                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${l.situacao.classe}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${l.situacao.bolinha}`}></span>{tx(l.situacao.rotulo)}
                                                        </span>
                                                        {l.pessoas.length > 0 && periodoTemHoje && (
                                                            <span className="basis-full flex items-center gap-2 pl-6" title={tx('Pessoas contatadas hoje (meta: {meta} por recepcionista)', { meta: META_DIARIA })}>
                                                                <span className="w-28 h-2 rounded-full bg-slate-200 overflow-hidden dark:bg-slate-700"><span className="block h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} /></span>
                                                                <span className="text-sm font-black text-slate-700 dark:text-slate-200 tabular-nums">{tx('{qtd} pessoas', { qtd: l.pessoasHojeUnidade })}</span>
                                                            </span>
                                                        )}
                                                        {l.pessoas.length === 0 && !alerta && <span className="text-[10px] font-bold text-rose-500">{tx("Nenhuma recepcionista")}</span>}
                                                    </div>
                                                </td>
                                                {colunas.map(c => <td key={c.id} className={`px-3 py-2 ${c.esquerda ? '' : 'text-center'}`}>{l.pessoas.length ? c.celula(somaU) : null}</td>)}
                                            </tr>
                                        )}
                                        {aberta && l.pessoas.map(p => {
                                            const parada = !p.ligacoes && !p.whatsapp && !p.semWhatsapp;
                                            return (
                                                <tr key={`${l.chave}-${p.chave}`} className="group border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer" onClick={() => onAbrirResumo && onAbrirResumo(p.colaborador)} title={tx('Ver o resumo da recepcionista')}>
                                                    <td className={`${mostrarUnidades ? 'pl-8' : 'pl-3'} pr-3 py-2 whitespace-nowrap sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800`}>
                                                        <span className={`text-sm font-bold ${parada && !p.noiteAindaNao ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>{p.nome.split(' ').slice(0, 2).join(' ')}</span>
                                                        {p.turno === 'MANHA' && <Sun className="inline w-3 h-3 ml-1.5 text-amber-500" aria-label={tx('manhã')} />}
                                                        {p.turno === 'NOITE' && <Moon className="inline w-3 h-3 ml-1.5 text-indigo-400" aria-label={tx('noite')} />}
                                                        {p.semHoje > LIMITE_SEM_WHATSAPP && <span title={tx('{qtd} contatos sem WhatsApp hoje', { qtd: p.semHoje })} className="ml-1.5 text-[11px] font-black text-rose-600 dark:text-rose-400">⚠️ {p.semHoje}</span>}
                                                        {p.noiteAindaNao && !p.primeiraHoje
                                                            ? <span className="block mt-1 text-[12px] font-bold text-indigo-500 dark:text-indigo-300">{tx('turno da noite · começa às {h}h', { h: HORA_INICIO_NOITE })}</span>
                                                            : periodoTemHoje && (
                                                                <span className="flex items-center gap-2 mt-1" title={tx('Meta do dia: pessoas diferentes contatadas hoje')}>
                                                                    <span className="w-28 h-2 rounded-full bg-slate-100 overflow-hidden dark:bg-slate-800">
                                                                        <span className={`block h-full rounded-full ${p.pessoasHoje.size >= META_DIARIA ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{ width: `${Math.min(100, (p.pessoasHoje.size / META_DIARIA) * 100)}%` }} />
                                                                    </span>
                                                                    <span className="text-sm font-black text-slate-700 tabular-nums dark:text-slate-200">{tx('{qtd} pessoas', { qtd: p.pessoasHoje.size })}</span>
                                                                </span>
                                                            )}
                                                    </td>
                                                    {colunas.map(c => <td key={c.id} className={`px-3 py-2 ${c.esquerda ? '' : 'text-center'}`}>{c.celula(p)}</td>)}
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default PainelCrm;
