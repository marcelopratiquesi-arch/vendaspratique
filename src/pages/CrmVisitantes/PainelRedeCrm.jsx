import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../supabaseClient.js';
import { Globe, Loader2, AlertTriangle, Send, X, Copy } from 'lucide-react';
import { formatarDataHora, normalizarNome, ehRecepcao, abrirNoWhatsApp } from './utils';
import { tx, localeAtual } from '../../i18n/traduzir.js';
import { avisar } from '../../components/avisar.js';

// ==========================================
// PAINEL DA REDE (só na Visão Global do seletor do topo) — refeito em 04/11/2026 (decisão do dono):
// tabela enxuta por unidade e recepcionista (Ligações, WhatsApp, Público, Sem WhatsApp, Última ação),
// atualizada em tempo real (sem o quadro "Ao vivo": o dono preferiu só a tabela). Leve: só 7 dias de histórico e só as ações de contato.
// ==========================================

// Ações que contam como "uso de verdade" do CRM
const ACOES_DE_CONTATO = ['WhatsApp', 'Ligação', 'Observação', 'Mudança de Fase'];
const PAGINA = 1000;
const MAX_PAGINAS = 30;
// Última ação: basta olhar 7 dias (com 7 dias sem ação a unidade já é "Sem uso")
const DIAS_PARA_ULTIMA_ACAO = 7;
// Meta diária do CRM: pessoas diferentes contatadas no dia (mesma do CRM da recepcionista)
const META_DIARIA = 150;
// Acima disso de "Sem WhatsApp" no dia, a recepcionista ganha o alerta ⚠️ (anti-golpe)
const LIMITE_SEM_WHATSAPP = 5;

const diasDesde = (data) => {
    if (!data) return null;
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dia = new Date(data); dia.setHours(0, 0, 0, 0);
    return Math.round((hoje - dia) / 86400000);
};

// Usando: ação hoje ou ontem · Parado: 2 a 6 dias · Sem uso: 7 dias ou mais, ou nunca
const situacaoDeUso = (ultima) => {
    const dias = diasDesde(ultima);
    if (dias === null || dias >= 7) return { rotulo: 'Sem uso', ordem: 2, classe: 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30', bolinha: 'bg-rose-500' };
    if (dias >= 2) return { rotulo: 'Parado', ordem: 1, classe: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30', bolinha: 'bg-amber-500' };
    return { rotulo: 'Usando', ordem: 0, classe: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30', bolinha: 'bg-emerald-500' };
};

// Público do contato: tipo da lista (contatos feitos) ou tipo do contato do CRM (histórico)
const PUBLICOS = {
    VISITANTE_24H: { rotulo: '24h', cor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30' },
    VISITANTE_48H: { rotulo: '48h', cor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30' },
    VISITANTE: { rotulo: 'Visitantes', cor: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30' },
    MIGRACAO: { rotulo: 'Migração', cor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30' },
    CANCELADO: { rotulo: 'Cancelados', cor: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30' },
    INATIVO: { rotulo: 'Inativos', cor: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/30' },
    ANIVERSARIO: { rotulo: 'Aniversário', cor: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-500/10 dark:text-pink-300 dark:border-pink-500/30' },
};
const publicoDoLead = (tipoLead) => {
    const t = String(tipoLead || '').toUpperCase();
    if (t === 'CANCELADO') return 'CANCELADO';
    if (t === 'INATIVO' || t === 'CANCELADO/INATIVO') return 'INATIVO';
    if (t === 'VISITANTE') return 'VISITANTE';
    return null;
};

// Busca em páginas de 1000 (limite do Supabase). Devolve também se bateu no teto.
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

// O período vem do filtro padrão do topo do CRM: faixa = { inicio, fim } (fim não entra)
const PainelRedeCrm = ({ colaboradores = [], faixa = { inicio: null, fim: null }, rotuloPeriodo = '', versao, unidadeFoco, onFocarUnidade }) => {
    const [unidades, setUnidades] = useState([]);
    const [historico, setHistorico] = useState([]);
    const [contatosFeitos, setContatosFeitos] = useState([]);
    const [leadsInfo, setLeadsInfo] = useState({}); // id → { tipo_lead, unidade } dos contatos tocados
    const [carregando, setCarregando] = useState(false);
    const [erro, setErro] = useState(false);
    const [cortado, setCortado] = useState(false);
    const leadsInfoRef = useRef({});

    const inicioIso = faixa.inicio ? faixa.inicio.toISOString() : '';
    const fimIso = faixa.fim ? faixa.fim.toISOString() : '';

    // Tipo/unidade dos contatos que aparecem no histórico (só os que faltam), de 200 em 200
    const buscarInfoLeads = async (ids) => {
        const faltam = [...new Set(ids.map(String))].filter(id => id && id !== 'null' && !leadsInfoRef.current[id]);
        if (!faltam.length) return;
        const novos = {};
        for (let i = 0; i < faltam.length; i += 200) {
            const { data, error } = await supabase.from('leads').select('id, tipo_lead, unidade').in('id', faltam.slice(i, i + 200));
            if (error) { console.error('Painel da Rede: erro ao ler os contatos', error); break; }
            (data || []).forEach(l => { novos[String(l.id)] = { tipo_lead: l.tipo_lead, unidade: l.unidade }; });
        }
        leadsInfoRef.current = { ...leadsInfoRef.current, ...novos };
        setLeadsInfo(leadsInfoRef.current);
    };

    useEffect(() => {
        let cancelado = false;
        const buscar = async () => {
            setCarregando(true);
            setErro(false);
            try {
                // Desde quando: o início do período, mas no mínimo 7 dias (para saber a última ação)
                const limiteUltima = new Date();
                limiteUltima.setDate(limiteUltima.getDate() - DIAS_PARA_ULTIMA_ACAO);
                limiteUltima.setHours(0, 0, 0, 0);
                const desde = inicioIso ? new Date(Math.min(new Date(inicioIso).getTime(), limiteUltima.getTime())) : limiteUltima;

                const [resUnidades, resHist] = await Promise.all([
                    supabase.from('unidades').select('*').order('nome', { ascending: true }),
                    buscarPaginado(() => supabase.from('historico_leads').select('id, lead_id, consultor, tipo_acao, observacao, data_registro')
                        .in('tipo_acao', ACOES_DE_CONTATO).gte('data_registro', desde.toISOString()).order('data_registro', { ascending: false }))
                ]);
                let feitos = [];
                try {
                    const resFeitos = await buscarPaginado(() => supabase.from('crm_contatos_feitos').select('id, unidade, criado_em, consultor, tipo, canal, lead_id, aluno_id')
                        .gte('criado_em', desde.toISOString()).order('criado_em', { ascending: false }));
                    feitos = resFeitos.dados;
                } catch (erroFeitos) {
                    console.warn('Contatos feitos indisponíveis no Painel da Rede:', erroFeitos?.message || erroFeitos);
                }
                if (cancelado) return;
                if (resUnidades.error) console.error('Erro ao buscar unidades:', resUnidades.error);
                // Unidade desativada (Configurações) não aparece no painel
                setUnidades((resUnidades.data || []).filter(u => u.ativa !== false));
                setHistorico(resHist.dados);
                setContatosFeitos(feitos);
                setCortado(resHist.cortado);
                setCarregando(false);
                // Tipo do contato só para as ações do período (público) — depois de mostrar a tabela
                const inicio = inicioIso ? new Date(inicioIso) : null;
                await buscarInfoLeads(resHist.dados.filter(h => !inicio || new Date(h.data_registro) >= inicio).map(h => h.lead_id));
            } catch (e) {
                if (cancelado) return;
                console.error('Erro ao montar o Painel da Rede do CRM:', e);
                setErro(true);
                setCarregando(false);
            }
        };
        buscar();
        return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- buscarInfoLeads só lê o cache
    }, [inicioIso, versao]);

    // AO VIVO: cada ligação/WhatsApp/contato novo entra na hora (sem recarregar tudo)
    useEffect(() => {
        const canal = supabase.channel(`crm-rede-ao-vivo-${Math.random().toString(36).slice(2, 8)}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'historico_leads' }, (p) => {
                const h = p.new;
                if (!h || !ACOES_DE_CONTATO.includes(h.tipo_acao)) return;
                setHistorico(prev => (prev.some(x => x.id === h.id) ? prev : [h, ...prev]));
                buscarInfoLeads([h.lead_id]);
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_contatos_feitos' }, (p) => {
                const f = p.new;
                if (!f) return;
                setContatosFeitos(prev => (prev.some(x => x.id === f.id) ? prev : [f, ...prev]));
            })
            .subscribe();
        return () => { supabase.removeChannel(canal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- canal aberto uma vez
    }, []);

    // Todas as ações num formato só (para a tabela e o "Ao vivo")
    const acoes = useMemo(() => {
        const unidadeDoConsultor = new Map();
        colaboradores.forEach(c => {
            const chave = normalizarNome(c.nome);
            if (chave && c.unidade && !unidadeDoConsultor.has(chave)) unidadeDoConsultor.set(chave, c.unidade);
        });
        const lista = [];
        historico.forEach(h => {
            const info = leadsInfo[String(h.lead_id)];
            lista.push({
                id: `h${h.id}`, quando: h.data_registro, consultor: h.consultor, tipoAcao: h.tipo_acao,
                unidade: unidadeDoConsultor.get(normalizarNome(h.consultor)) || info?.unidade || '',
                meio: h.tipo_acao === 'WhatsApp' || h.tipo_acao === 'Ligação' ? h.tipo_acao : null,
                publico: h.tipo_acao === 'WhatsApp' || h.tipo_acao === 'Ligação' ? publicoDoLead(info?.tipo_lead) : null,
                fechou: h.tipo_acao === 'Mudança de Fase' && String(h.observacao || '').includes('para "Fechado"') ? String(h.lead_id) : null,
                contaNaUnidade: true, pessoa: `lead:${h.lead_id}`,
            });
        });
        contatosFeitos.forEach(f => {
            const semLead = f.lead_id === null || f.lead_id === undefined;
            const t = String(f.tipo || '').toUpperCase();
            lista.push({
                id: `f${f.id}`, quando: f.criado_em, consultor: f.consultor, tipoAcao: 'Contato',
                unidade: f.unidade || unidadeDoConsultor.get(normalizarNome(f.consultor)) || '',
                // 24h/48h com contato do funil já têm o WhatsApp no histórico: aqui só o público e o "sem WhatsApp"
                meio: f.canal === 'WHATSAPP' ? (semLead ? 'WhatsApp' : null) : 'Sem WhatsApp',
                publico: PUBLICOS[t] ? t : null, fechou: null, contaNaUnidade: semLead,
                pessoa: semLead ? `aluno:${f.aluno_id || `f${f.id}`}` : `lead:${f.lead_id}`,
            });
        });
        return lista.sort((a, b) => new Date(b.quando) - new Date(a.quando));
    }, [historico, contatosFeitos, leadsInfo, colaboradores]);

    const linhas = useMemo(() => {
        const mapa = new Map();
        const linhaDa = (nome) => {
            const chave = normalizarNome(nome);
            if (!chave) return null;
            if (!mapa.has(chave)) mapa.set(chave, { chave, unidade: String(nome).toUpperCase().trim(), recepcionistas: 0, acoes: 0, fechadosIds: new Set(), ultima: null, pessoas: new Map() });
            return mapa.get(chave);
        };
        const pessoaDa = (l, nome) => {
            const chave = normalizarNome(nome);
            if (!l.pessoas.has(chave)) l.pessoas.set(chave, { chave, nome: String(nome || '').toUpperCase(), ligacoes: 0, whatsapp: 0, semWhatsapp: 0, publico: {}, ultima: null, ultimaMeio: '', pessoasHoje: new Set(), ligHoje: 0, zapHoje: 0, semHoje: 0 });
            return l.pessoas.get(chave);
        };
        unidades.forEach(u => linhaDa(u.nome));
        colaboradores.filter(c => ehRecepcao(c) && c.ativo !== false).forEach(c => { const l = linhaDa(c.unidade); if (l) { l.recepcionistas++; pessoaDa(l, c.nome); } });

        const inicio = inicioIso ? new Date(inicioIso) : null;
        const fim = fimIso ? new Date(fimIso) : null;
        const noPeriodo = (data) => (!inicio || new Date(data) >= inicio) && (!fim || new Date(data) < fim);
        const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0);

        acoes.forEach(a => {
            const l = linhaDa(a.unidade);
            if (!l) return;
            if (a.contaNaUnidade && (!l.ultima || new Date(a.quando) > new Date(l.ultima))) l.ultima = a.quando;
            const p = l.pessoas.get(normalizarNome(a.consultor));
            if (p && a.meio && (!p.ultima || new Date(a.quando) > new Date(p.ultima))) { p.ultima = a.quando; p.ultimaMeio = a.meio; }
            if (p && new Date(a.quando) >= inicioHoje) {
                if (a.contaNaUnidade || a.publico) p.pessoasHoje.add(a.pessoa);
                if (a.meio === 'Ligação') p.ligHoje++;
                else if (a.meio === 'WhatsApp') p.zapHoje++;
                else if (a.meio === 'Sem WhatsApp') p.semHoje++;
            }
            if (!noPeriodo(a.quando)) return;
            if (a.contaNaUnidade) l.acoes++;
            if (a.fechou) l.fechadosIds.add(a.fechou);
            if (!p) return;
            if (a.meio === 'Ligação') p.ligacoes++;
            else if (a.meio === 'WhatsApp') p.whatsapp++;
            else if (a.meio === 'Sem WhatsApp') p.semWhatsapp++;
            if (a.publico) p.publico[a.publico] = (p.publico[a.publico] || 0) + 1;
        });

        return [...mapa.values()]
            .map(({ fechadosIds, pessoas, ...l }) => ({
                ...l, fechados: fechadosIds.size, situacao: situacaoDeUso(l.ultima),
                pessoas: [...pessoas.values()].sort((a, b) => (b.ultima ? new Date(b.ultima) : 0) - (a.ultima ? new Date(a.ultima) : 0) || a.nome.localeCompare(b.nome, 'pt-BR')),
            }))
            .sort((a, b) => a.situacao.ordem - b.situacao.ordem || b.acoes - a.acoes || a.unidade.localeCompare(b.unidade, 'pt-BR'));
    }, [unidades, colaboradores, acoes, inicioIso, fimIso]);

    const resumo = useMemo(() => ({
        usando: linhas.filter(l => l.situacao.rotulo === 'Usando').length,
        parado: linhas.filter(l => l.situacao.rotulo === 'Parado').length,
        semUso: linhas.filter(l => l.situacao.rotulo === 'Sem uso').length
    }), [linhas]);


    const foco = unidadeFoco || '';
    // "há 25 min" / "há 3 h" / "ontem" / "há 4 dias" (com a data e hora no título)
    const haQuanto = (data) => {
        if (!data) return tx("Nada nos últimos {DIAS_PARA_ULTIMA_ACAO} dias", { DIAS_PARA_ULTIMA_ACAO });
        const min = Math.floor((Date.now() - new Date(data).getTime()) / 60000);
        if (min < 60) return tx("há {qtd} min", { qtd: Math.max(1, min) });
        if (min < 24 * 60) return tx("há {qtd} h", { qtd: Math.floor(min / 60) });
        const dias = diasDesde(data);
        return dias === 1 ? tx("ontem") : tx("há {dias} dias", { dias });
    };
    const corUltima = (data) => { const s = situacaoDeUso(data); return s.ordem === 0 ? 'text-emerald-700 dark:text-emerald-400' : s.ordem === 1 ? 'text-amber-700 dark:text-amber-400' : 'text-rose-700 dark:text-rose-400'; };
    const numero = (n, cor = 'text-slate-800 dark:text-white') => (n > 0 ? <span className={`text-[13px] font-black tabular-nums ${cor}`}>{n}</span> : <span className="text-slate-300 dark:text-slate-600">—</span>);
    const Chip = ({ chave, qtd }) => <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-black ${PUBLICOS[chave].cor}`}>{tx(PUBLICOS[chave].rotulo)}{qtd !== undefined && <span className="tabular-nums">{qtd}</span>}</span>;
    const th = 'px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 whitespace-nowrap';

    // Cobrança no WhatsApp (decisão do dono, 04/11/2026): sempre do DIA, quem trabalhou e quem está parado
    const [mensagem, setMensagem] = useState(null);
    const montarCobranca = () => {
        const hoje = new Date();
        const dia = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}`;
        const primeiro = (n) => String(n || '').split(' ')[0];
        const trabalharam = [];
        const paradas = [];
        linhas.forEach(l => l.pessoas.forEach(p => {
            const fez = p.ligHoje + p.zapHoje + p.semHoje > 0;
            if (fez) trabalharam.push({ l, p });
            else paradas.push({ l, p });
        }));
        trabalharam.sort((a, b) => b.p.pessoasHoje.size - a.p.pessoasHoje.size);
        let txt = `📞 *CRM DA RECEPÇÃO – ${dia}*\n\n`;
        txt += `✅ *TRABALHARAM HOJE (${trabalharam.length})*\n`;
        txt += (trabalharam.map(({ l, p }) => {
            const bateu = p.pessoasHoje.size >= META_DIARIA ? ' 🏆' : '';
            const alerta = p.semHoje > LIMITE_SEM_WHATSAPP ? ` ⚠️ ${p.semHoje} sem WhatsApp` : '';
            return `• ${primeiro(p.nome)} (${l.unidade}) — ${p.pessoasHoje.size}/${META_DIARIA} pessoas · ${p.ligHoje} lig. · ${p.zapHoje} WhatsApp${bateu}${alerta}`;
        }).join('\n') || '—') + '\n\n';
        txt += `❌ *PARADAS HOJE (${paradas.length})*\n`;
        txt += (paradas.map(({ l, p }) => `• ${primeiro(p.nome)} (${l.unidade}) — última ação: ${p.ultima ? haQuanto(p.ultima) : 'nada nos últimos 7 dias'}`).join('\n') || '—');
        if (paradas.length) txt += `\n\n⏰ *Por gentileza, comecem agora os contatos do dia.* Meta: ${META_DIARIA} pessoas por recepcionista.`;
        setMensagem(txt);
    };
    const copiar = async () => {
        try { await navigator.clipboard.writeText(mensagem); avisar(tx('Mensagem copiada.'), 'sucesso'); }
        catch { avisar(tx('Não foi possível copiar. Selecione o texto e copie.'), 'erro'); }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    {tx("O que cada recepcionista fez:")}{' '}<strong className="text-slate-700 dark:text-slate-200">{tx(rotuloPeriodo)}</strong>
                    {carregando && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={montarCobranca} disabled={carregando} className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><Send className="w-3.5 h-3.5" />{tx('Cobrar no WhatsApp')}</button>
                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30">{resumo.usando}{' '}{tx("usando")}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30">{resumo.parado}{' '}{tx("parado")}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30">{resumo.semUso}{' '}{tx("sem uso")}</span>
                </div>
            </div>

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
                    <AlertTriangle className="w-4 h-4 shrink-0" />{' '}{tx("Não foi possível carregar o Painel da Rede. Tente recarregar a página.")}
                </div>
            )}
            {cortado && (
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-xl px-4 py-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />{' '}{tx("Muitos registros: os números foram calculados com os primeiros")}{' '}{(PAGINA * MAX_PAGINAS).toLocaleString(localeAtual())}{' '}{tx("e podem estar abaixo da realidade. Escolha um período menor.")}
                </div>
            )}

            <div>
                {/* Tabela: unidade (com a situação) e, embaixo, uma linha por recepcionista */}
                {linhas.length === 0 ? (
                    <p className="text-center py-10 text-[10px] font-black uppercase tracking-widest text-slate-400">{carregando ? tx("Carregando...") : tx("Nenhuma unidade encontrada.")}</p>
                ) : (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto custom-scrollbar">
                        <table className="w-full min-w-[760px] border-collapse text-left">
                            <thead className="bg-slate-50 dark:bg-slate-800/60">
                                <tr>
                                    <th className={th}>{tx("Unidade / recepcionista")}</th>
                                    <th className={`${th} text-center`}>{tx("Ligações")}</th>
                                    <th className={`${th} text-center`}>{tx("WhatsApp")}</th>
                                    <th className={th}>{tx("Público")}</th>
                                    <th className={`${th} text-center`}>{tx("Sem WhatsApp")}</th>
                                    <th className={th}>{tx("Última ação")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {linhas.map(l => {
                                    const ativa = foco === l.chave;
                                    return (
                                        <React.Fragment key={l.chave}>
                                            <tr className={`border-t border-slate-200 dark:border-slate-800 cursor-pointer ${ativa ? 'bg-blue-50 dark:bg-blue-500/10' : 'bg-slate-50/60 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/60'}`}
                                                onClick={() => onFocarUnidade(ativa ? null : { chave: l.chave, nome: l.unidade })} title={ativa ? tx("Voltar a ver todas as unidades") : tx("Ver só a recepção desta unidade")}>
                                                <td className="px-3 py-2.5" colSpan={6}>
                                                    <div className="flex flex-wrap items-center gap-3">
                                                        <span className={`text-[12px] font-black uppercase ${ativa ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-white'}`}>{l.unidade}</span>
                                                        <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${l.situacao.classe}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${l.situacao.bolinha}`}></span>{tx(l.situacao.rotulo)}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{tx("{acoes} ações · {fechados} fechados", { acoes: l.acoes, fechados: l.fechados })}</span>
                                                        {l.recepcionistas === 0 && <span className="text-[10px] font-bold text-rose-500">{tx("Nenhuma recepcionista")}</span>}
                                                    </div>
                                                </td>
                                            </tr>
                                            {l.pessoas.map(p => {
                                                const publicos = Object.entries(p.publico).sort((a, b) => b[1] - a[1]);
                                                const parada = !p.ligacoes && !p.whatsapp && !p.semWhatsapp;
                                                return (
                                                    <tr key={`${l.chave}-${p.chave}`} className="border-t border-slate-100 dark:border-slate-800">
                                                        <td className="pl-8 pr-3 py-2 whitespace-nowrap">
                                                            <span className={`text-[12px] font-bold ${parada ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}>{p.nome}</span>
                                                            {p.semHoje > LIMITE_SEM_WHATSAPP && <span title={tx('{qtd} contatos sem WhatsApp hoje', { qtd: p.semHoje })} className="ml-1.5 text-[11px] font-black text-rose-600 dark:text-rose-400">⚠️ {p.semHoje}</span>}
                                                            {/* Meta do dia: pessoas diferentes contatadas hoje */}
                                                            <span className="flex items-center gap-2 mt-1" title={tx('Meta do dia: pessoas diferentes contatadas hoje')}>
                                                                <span className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden dark:bg-slate-800">
                                                                    <span className={`block h-full rounded-full ${p.pessoasHoje.size >= META_DIARIA ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{ width: `${Math.min(100, (p.pessoasHoje.size / META_DIARIA) * 100)}%` }} />
                                                                </span>
                                                                <span className="text-[10px] font-black text-slate-500 tabular-nums dark:text-slate-400">{tx('{qtd} / {meta} pessoas', { qtd: p.pessoasHoje.size, meta: META_DIARIA })}</span>
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-center">{numero(p.ligacoes)}</td>
                                                        <td className="px-3 py-2 text-center">{numero(p.whatsapp, 'text-emerald-700 dark:text-emerald-400')}</td>
                                                        <td className="px-3 py-2">
                                                            {publicos.length ? <div className="flex flex-wrap gap-1">{publicos.map(([k, q]) => <Chip key={k} chave={k} qtd={q} />)}</div> : <span className="text-slate-300 dark:text-slate-600">—</span>}
                                                        </td>
                                                        <td className="px-3 py-2 text-center">{numero(p.semWhatsapp, 'text-rose-600 dark:text-rose-400')}</td>
                                                        <td className="px-3 py-2 whitespace-nowrap" title={p.ultima ? formatarDataHora(p.ultima) : ''}>
                                                            <span className={`text-[12px] font-black ${p.ultima ? corUltima(p.ultima) : 'text-rose-600 dark:text-rose-400'}`}>{haQuanto(p.ultima)}</span>
                                                            {p.ultimaMeio && <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400">{tx(p.ultimaMeio)} · {formatarDataHora(p.ultima)}</span>}
                                                        </td>
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
        </div>
    );
};

export default PainelRedeCrm;
