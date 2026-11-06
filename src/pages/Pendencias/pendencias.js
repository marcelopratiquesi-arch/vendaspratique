// ==========================================
// CENTRAL DE PENDÊNCIAS (decisão do dono, 05/11/2026)
// Junta, por unidade, as 3 cobranças do sistema:
//  1. CONFERÊNCIA — vendas sem conferir cuja sexta de prazo já passou (semana sábado→sexta), todas as vendas
//     (regras em FechamentoCaixa/cobrancaAuditoria.js). Desde 06/11/2026 (decisão do dono: a comissão é paga todo dia 15):
//     até o dia 15 cobra o MÊS ANTERIOR + o atual; do dia 16 em diante, só o mês atual (`inicioCobrancaConferencia`).
//     Isso também diminui muito o que é baixado do banco.
//  2. MOVIMENTAÇÃO — Ativos, Cancelamentos e Faturamento de CADA DIA (inclusive domingo e feriado), desde 05/11/2026.
//     O dia de hoje só é cobrado a partir das 7h. Dia que ficou para trás continua sendo cobrado.
//  3. METAS DO MÊS — Meta Start e Meta Mensal do mês atual. Dias 1 a 3: lembrete (amarelo); do dia 4 em diante: atrasado.
// Quem é cobrado: Líder (a unidade dele) e Mentor (as unidades dele) com janela ao entrar + cartão no canto;
// Admin e Mentor têm a aba "Pendências" com WhatsApp. Só leitura: nada aqui grava.
// Mensagens de WhatsApp não são traduzidas (vão para a equipe, em português).
// ==========================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient.js';
import { normalizeString } from '../AnaliseVendas/utils.js';
import { INICIO_COBRANCA_CONFERENCIA, semanaDaVenda, ultimaSextaVencida } from '../FechamentoCaixa/cobrancaAuditoria.js';
import { buscarEnviosRelatorio, buscarConferenciasRelatorio, pendenciasRelatorio, nomesDoTurno, situacaoRelatorioDias } from './relatorioFechamento.js';

export const INICIO_COBRANCA_MOVIMENTO = '2026-11-05';
export const HORA_COBRANCA_MOVIMENTO = 7;
export const DIA_PRAZO_METAS = 3;
export const DIA_LIMITE_MES_ANTERIOR = 15; // conferência do mês anterior é cobrada até este dia (dia do pagamento)

// Desde quando a conferência é cobrada hoje: até o dia 15, desde o dia 1º do mês anterior; depois, desde o dia 1º do mês atual
export const inicioCobrancaConferencia = (agora = new Date()) => {
    const dia = agora.getDate();
    const base = new Date(agora.getFullYear(), agora.getMonth() - (dia <= DIA_LIMITE_MES_ANTERIOR ? 1 : 0), 1);
    const iso = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-01`;
    return iso > INICIO_COBRANCA_CONFERENCIA ? iso : INICIO_COBRANCA_CONFERENCIA;
};

const paraIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const chave = (u) => normalizeString(String(u || ''));
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const nomeDoMes = (agora = new Date()) => MESES[agora.getMonth()];

// Campos obrigatórios de cada card de metas (Personal sai quando a unidade "não tem Personal Class")
const CAMPOS_START = [['meta_nutri', 'Nutri'], ['meta_produtos', 'Produto'], ['meta_personal', 'Personal Class']];
const CAMPOS_MENSAL = [['meta_ativos_mensal', 'Ativos Alvo'], ['meta_nutri_mensal', 'Nutri'], ['meta_plus_mensal', 'Plus'], ['meta_pers_mensal', 'Personal Class']];

// ---------- LEITURA NO BANCO (o banco já entrega só o que a pessoa pode ver) ----------
const buscarVendasPendentes = async (hojeIso, inicioIso) => {
    const todas = [];
    for (let de = 0; de < 100000; de += 1000) {
        const { data, error } = await supabase.from('vendas')
            .select('id, unidade, data, valor')
            .gte('data', inicioIso)
            .lte('data', hojeIso)
            .or('conferiu.is.null,conferiu.eq.false')
            .order('id', { ascending: true })
            .range(de, de + 999);
        if (error) throw error;
        todas.push(...(data || []));
        if (!data || data.length < 1000) break;
    }
    return todas;
};

const buscarMovimento = async () => {
    const consultar = (campos) => supabase.from('movimento_diario').select(campos).gte('data', INICIO_COBRANCA_MOVIMENTO);
    let temAtivos = true;
    let { data, error } = await consultar('unidade, data, ativos, cancelamentos, faturamento');
    if (error && /ativos/i.test(error.message || '')) { temAtivos = false; ({ data, error } = await consultar('unidade, data, cancelamentos, faturamento')); }
    if (error) throw error;
    return { linhas: data || [], temAtivos };
};

const buscarMetas = async (agora) => {
    const { data, error } = await supabase.from('metas_unidades').select('*')
        .eq('mes', String(agora.getMonth() + 1).padStart(2, '0')).eq('ano', String(agora.getFullYear()));
    if (error) throw error;
    return data || [];
};

const buscarSemPersonal = async () => {
    const { data, error } = await supabase.from('unidades_sem_personal').select('unidade, sem_personal');
    if (error) return []; // sem a tabela: todas têm Personal
    return data || [];
};

export const carregarDadosPendencias = async (agora = new Date()) => {
    const hojeIso = paraIso(agora);
    const ontem = new Date(agora); ontem.setDate(ontem.getDate() - 1);
    const [vendas, movimento, metas, semPersonal, envios, conferenciasRelatorio] = await Promise.all([
        buscarVendasPendentes(hojeIso, inicioCobrancaConferencia(agora)).catch(e => { console.warn('Pendências: não deu para ler as vendas', e?.message || e); return null; }),
        buscarMovimento().catch(e => { console.warn('Pendências: não deu para ler a movimentação', e?.message || e); return null; }),
        buscarMetas(agora).catch(e => { console.warn('Pendências: não deu para ler as metas', e?.message || e); return null; }),
        buscarSemPersonal(),
        buscarEnviosRelatorio(paraIso(ontem), hojeIso), // null = tabela ainda não criada (não cobra o relatório)
        buscarConferenciasRelatorio(paraIso(ontem), hojeIso), // respostas do Líder no grupo (null = SQL ainda não rodado)
    ]);
    return { vendas, movimento, metas, semPersonal, envios, conferenciasRelatorio };
};

// ---------- CÁLCULO POR UNIDADE ----------
const conferenciaDaUnidade = (vendas, agora) => {
    const hojeIso = paraIso(agora);
    const limite = ultimaSextaVencida(hojeIso);
    const inicio = inicioCobrancaConferencia(agora);
    const mapa = {};
    vendas.forEach(v => {
        if (String(v.data).slice(0, 10) < inicio) return; // mês anterior passou do dia 15: não cobra mais
        const s = semanaDaVenda(v.data);
        if (s.inicio < inicio) s.inicio = inicio;
        if (!mapa[s.fim]) mapa[s.fim] = { ...s, qtd: 0, valor: 0 };
        mapa[s.fim].qtd++;
        mapa[s.fim].valor += Number(v.valor) || 0;
    });
    const semanas = Object.values(mapa).sort((a, b) => a.fim.localeCompare(b.fim));
    const atrasadas = semanas.filter(s => s.fim <= limite);
    const semanaAtual = semanas.find(s => s.fim > limite) || null;
    const sexta = agora.getDay() === 5;
    if (!atrasadas.length && !(sexta && semanaAtual)) return null;
    return {
        atrasadas,
        qtd: atrasadas.reduce((t, s) => t + s.qtd, 0),
        valor: atrasadas.reduce((t, s) => t + s.valor, 0),
        semanaAtual: sexta ? semanaAtual : null, // lembrete da sexta
        atrasado: atrasadas.length > 0,
        // período que a Conferência abre
        periodo: {
            inicio: atrasadas.length ? atrasadas[0].inicio : semanaAtual.inicio,
            fim: sexta && semanaAtual ? hojeIso : atrasadas[atrasadas.length - 1].fim,
        },
    };
};

const movimentoDaUnidade = (linhas, temAtivos, agora) => {
    const hojeIso = paraIso(agora);
    const porDia = {};
    linhas.forEach(l => { porDia[String(l.data).slice(0, 10)] = l; });
    const dias = [];
    const d = new Date(`${INICIO_COBRANCA_MOVIMENTO}T12:00:00`);
    for (let i = 0; i < 400; i++) {
        const iso = paraIso(d);
        if (iso > hojeIso) break;
        if (iso === hojeIso && agora.getHours() < HORA_COBRANCA_MOVIMENTO) break; // hoje só a partir das 7h
        const l = porDia[iso];
        const vazio = (v) => v === null || v === undefined;
        const falta = [];
        if (!l) falta.push(...(temAtivos ? ['Ativos', 'Cancelamentos', 'Faturamento'] : ['Cancelamentos', 'Faturamento']));
        else {
            if (temAtivos && vazio(l.ativos)) falta.push('Ativos');
            if (vazio(l.cancelamentos)) falta.push('Cancelamentos');
            if (vazio(l.faturamento)) falta.push('Faturamento');
        }
        if (falta.length) dias.push({ data: iso, falta, semLancamento: !l, hoje: iso === hojeIso });
        d.setDate(d.getDate() + 1);
    }
    return dias;
};

const metasDaUnidade = (linha, semPersonal, agora) => {
    const vazio = (v) => v === null || v === undefined || v === '';
    const faltando = (campos) => {
        const usados = campos.filter(([col]) => !(semPersonal && (col === 'meta_personal' || col === 'meta_pers_mensal')));
        if (!linha) return { naoPreenchida: true, falta: usados.map(([, r]) => r) };
        const falta = usados.filter(([col]) => vazio(linha[col])).map(([, r]) => r);
        // Tudo zerado = nunca foi preenchida (a linha pode ter nascido só com os Ativos do mês)
        const tudoZero = usados.every(([col]) => Number(linha[col] || 0) === 0);
        if (tudoZero) return { naoPreenchida: true, falta: usados.map(([, r]) => r) };
        return { naoPreenchida: falta.length === usados.length, falta };
    };
    const start = faltando(CAMPOS_START);
    const mensal = faltando(CAMPOS_MENSAL);
    if (!start.falta.length && !mensal.falta.length) return null;
    return {
        start: start.falta.length ? start : null,
        mensal: mensal.falta.length ? mensal : null,
        atrasado: agora.getDate() > DIA_PRAZO_METAS,
        mes: nomeDoMes(agora),
    };
};

// Lista final: uma entrada por unidade (com pendência ou "em dia")
export const montarPendencias = (dados, unidades = [], agora = new Date(), colaboradores = []) => {
    if (!dados) return [];
    const vendasPorUnidade = {};
    (dados.vendas || []).forEach(v => { (vendasPorUnidade[chave(v.unidade)] ||= []).push(v); });
    const movPorUnidade = {};
    (dados.movimento?.linhas || []).forEach(l => { (movPorUnidade[chave(l.unidade)] ||= []).push(l); });
    const metasPorUnidade = {};
    (dados.metas || []).forEach(m => { metasPorUnidade[chave(m.unidade)] = m; });
    const semPersonal = new Set((dados.semPersonal || []).filter(s => s.sem_personal).map(s => chave(s.unidade)));

    return unidades.filter(Boolean).map(nome => {
        const k = chave(nome);
        const conferencia = dados.vendas ? conferenciaDaUnidade(vendasPorUnidade[k] || [], agora) : null;
        const movimento = dados.movimento ? movimentoDaUnidade(movPorUnidade[k] || [], dados.movimento.temAtivos, agora) : [];
        const metas = dados.metas ? metasDaUnidade(metasPorUnidade[k], semPersonal.has(k), agora) : null;
        // Relatório de fechamento da recepção (hoje e ontem), com o nome de quem devia enviar (turno no cadastro da Equipe)
        const relatorio = dados.envios ? pendenciasRelatorio(dados.envios, nome, agora, dados.conferenciasRelatorio || []).map(r => ({ ...r, nomes: nomesDoTurno(colaboradores, nome, r.turno) })) : [];
        // Situação de TODOS os turnos de ontem e hoje (enviado em verde, não enviado em vermelho) — só para mostrar na tela
        const relatorioDias = dados.envios ? situacaoRelatorioDias(dados.envios, dados.conferenciasRelatorio || [], nome, agora).map(r => ({ ...r, nomes: nomesDoTurno(colaboradores, nome, r.turno) })) : [];
        // Quantas pendências (o número vermelho): conferência atrasada = 1, cada dia de movimentação = 1, cada card de meta = 1,
        // cada relatório de turno não enviado = 1
        const total = (conferencia?.atrasado ? 1 : 0) + movimento.length + (metas?.start ? 1 : 0) + (metas?.mensal ? 1 : 0) + relatorio.length;
        const lembretes = (conferencia && !conferencia.atrasado ? 1 : 0);
        const atrasado = !!(conferencia?.atrasado || movimento.some(d => !d.hoje) || (metas && metas.atrasado) || relatorio.some(r => r.situacao !== 'cobrando'));
        return { unidade: nome, conferencia, movimento, metas, relatorio, relatorioDias, total, lembretes, atrasado };
    }).sort((a, b) => b.total - a.total || Number(b.atrasado) - Number(a.atrasado) || a.unidade.localeCompare(b.unidade));
};

// ---------- HOOK: carrega, recalcula com o relógio e recarrega quando alguém grava ----------
export const usePendencias = ({ ativo, unidades = [], colaboradores = [] }) => {
    const [dados, setDados] = useState(null);
    const [carregando, setCarregando] = useState(false);
    const [agora, setAgora] = useState(() => new Date());
    const timer = useRef(null);

    const recarregar = useCallback(async () => {
        setCarregando(true);
        const novo = await carregarDadosPendencias(new Date());
        setDados(novo);
        setAgora(new Date());
        setCarregando(false);
    }, []);

    useEffect(() => {
        if (!ativo) { setDados(null); return undefined; }
        recarregar();
        // Gravou movimentação, meta ou conferiu venda: recarrega (juntando avisos seguidos, espera 3 s)
        const agendar = () => { clearTimeout(timer.current); timer.current = setTimeout(recarregar, 3000); };
        const canal = supabase.channel(`pendencias-${Math.random().toString(36).slice(2, 8)}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'movimento_diario' }, agendar)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'metas_unidades' }, agendar)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'vendas' }, agendar)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'relatorios_fechamento_envios' }, agendar)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'relatorios_fechamento_conferencia' }, agendar)
            .subscribe();
        // Conferiu no grupo / a recepção enviou nesta tela: recarrega na hora
        window.addEventListener('relatorio-fechamento-enviado', recarregar);
        const intervalo = setInterval(recarregar, 10 * 60 * 1000);
        // Relógio de 1 minuto: às 7h a movimentação de hoje entra na cobrança; à meia-noite vira o dia
        const relogio = setInterval(() => setAgora(new Date()), 60 * 1000);
        return () => { clearTimeout(timer.current); supabase.removeChannel(canal); clearInterval(intervalo); clearInterval(relogio); window.removeEventListener('relatorio-fechamento-enviado', recarregar); };
    }, [ativo, recarregar]);

    const chaveUnidades = unidades.join('|');
    const lista = useMemo(() => montarPendencias(dados, chaveUnidades ? chaveUnidades.split('|') : [], agora, colaboradores), [dados, chaveUnidades, agora, colaboradores]);
    const total = lista.reduce((t, u) => t + u.total, 0);
    return { lista, total, carregando, carregado: !!dados, recarregar };
};

// ---------- TEXTOS (tela e WhatsApp) ----------
const juntar = (lista) => (lista.length > 1 ? `${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]}` : lista[0] || '');
const dinheiro = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);

export const textoMovimentoDia = (d) => (d.semLancamento ? `${ddmm(d.data)} não lançou` : `${ddmm(d.data)} falta ${juntar(d.falta)}`);

// Movimentação: dias seguidos com a MESMA falta viram um bloco só ("05/11 a 07/11 · falta Cancelamentos"),
// para não encher a tela quando a unidade fica vários dias sem lançar (decisão do dono, 06/11/2026). Hoje fica separado.
export const agruparDiasMovimento = (dias = []) => {
    const blocos = [];
    const umDiaDepois = (iso) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + 1); return paraIso(d); };
    dias.forEach(d => {
        const chaveFalta = `${d.semLancamento ? 'SEM' : ''}|${d.falta.join(',')}`;
        const ultimo = blocos[blocos.length - 1];
        if (ultimo && !d.hoje && !ultimo.hoje && ultimo.chaveFalta === chaveFalta && umDiaDepois(ultimo.fim) === d.data) {
            ultimo.fim = d.data; ultimo.qtd++;
        } else {
            blocos.push({ inicio: d.data, fim: d.data, qtd: 1, falta: d.falta, semLancamento: d.semLancamento, hoje: d.hoje, chaveFalta });
        }
    });
    return blocos;
};
const textoBlocoMovimento = (b) => {
    const quando = b.hoje ? 'hoje' : b.qtd > 1 ? `${ddmm(b.inicio)} a ${ddmm(b.fim)} (${b.qtd} dias)` : ddmm(b.inicio);
    return b.semLancamento ? `${quando} não lançou` : `${quando} falta ${juntar(b.falta)}`;
};
export const textoMetaCard = (card) => (card.naoPreenchida ? 'não preenchida' : `falta ${juntar(card.falta)}`);
// "hoje manhã não enviado (Ana)" / "04/11 noite não enviado (Júlia)"
export const textoRelatorioTurno = (r) => `${r.hoje ? 'hoje' : ddmm(r.data)} ${r.rotulo} ${r.situacao === 'cobrando' ? 'ainda não enviado' : 'não enviado'}${r.nomes?.length ? ` (${r.nomes.join(' / ')})` : ''}`;

// Tipos de pendência (o filtro da aba Pendências escolhe qual vai na mensagem)
export const TIPOS_PENDENCIA = {
    conferencia: (u) => !!u.conferencia?.atrasado,
    movimento: (u) => u.movimento.length > 0,
    metas: (u) => !!u.metas,
    relatorio: (u) => (u.relatorio || []).length > 0,
};
const PRAZO_POR_TIPO = {
    conferencia: `Conferência: toda sexta-feira (o mês anterior até o dia ${DIA_LIMITE_MES_ANTERIOR}, dia do pagamento).`,
    movimento: 'Movimentação: todo dia a partir das 7h.',
    metas: 'Metas: até o dia 03 de cada mês.',
    relatorio: 'Relatório de fechamento: manhã das 13h30 às 15h, noite das 21h30 às 23h, sábado, domingo e feriado das 12h às 13h.',
};
const TITULO_POR_TIPO = { conferencia: 'CONFERÊNCIA', movimento: 'MOVIMENTAÇÃO', metas: 'METAS DO MÊS', relatorio: 'RELATÓRIO DE FECHAMENTO' };

// tipo = null (tudo) ou 'conferencia' | 'movimento' | 'metas' | 'relatorio' (só aquele)
const linhasDaUnidade = (u, tipo = null) => {
    const l = [];
    const quer = (t) => !tipo || tipo === t;
    if (quer('conferencia') && u.conferencia?.atrasado) {
        const c = u.conferencia;
        l.push(`🧾 Conferência: ${c.qtd} venda${c.qtd === 1 ? '' : 's'} sem conferir (${dinheiro(c.valor)} em comissão) · desde a semana ${ddmm(c.atrasadas[0].inicio)} a ${ddmm(c.atrasadas[0].fim)}`);
    }
    if (quer('movimento') && u.movimento.length) l.push(`📊 Movimentação: ${agruparDiasMovimento(u.movimento).map(textoBlocoMovimento).join(' · ')}`);
    if (quer('metas') && u.metas) {
        const partes = [];
        if (u.metas.start) partes.push(`Meta Start ${textoMetaCard(u.metas.start)}`);
        if (u.metas.mensal) partes.push(`Meta Mensal ${textoMetaCard(u.metas.mensal)}`);
        l.push(`🎯 Metas de ${u.metas.mes}: ${partes.join(' · ')}${u.metas.atrasado ? ` (prazo dia ${String(DIA_PRAZO_METAS).padStart(2, '0')} vencido)` : ` (prazo até dia ${String(DIA_PRAZO_METAS).padStart(2, '0')})`}`);
    }
    if (quer('relatorio') && u.relatorio?.length) l.push(`📤 Relatório de fechamento: ${u.relatorio.map(textoRelatorioTurno).join(' · ')}`);
    return l;
};

// tipo = null: todas as pendências; ou só um tipo (o que está escolhido no filtro da aba Pendências)
export const mensagemPendenciasGrupo = (lista, agora = new Date(), tipo = null) => {
    const tem = tipo ? TIPOS_PENDENCIA[tipo] : (u) => u.total > 0;
    const comPendencia = lista.filter(tem);
    const emDia = lista.filter(u => !tem(u));
    const hora = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    let txt = `🚨 *PENDÊNCIAS${tipo ? ` – ${TITULO_POR_TIPO[tipo]}` : ' DAS UNIDADES'} – ${ddmm(paraIso(agora))} às ${hora}*\n\n`;
    if (!comPendencia.length) return `${txt}✅ Todas as unidades estão em dia. Obrigado, equipe!`;
    txt += comPendencia.map(u => `*${u.unidade}*\n${linhasDaUnidade(u, tipo).join('\n')}`).join('\n\n');
    if (emDia.length) txt += `\n\n✅ *EM DIA:* ${emDia.map(u => u.unidade).join(', ')}`;
    txt += `\n\n⏰ Por gentileza, regularizem hoje. ${tipo ? PRAZO_POR_TIPO[tipo] : Object.values(PRAZO_POR_TIPO).join(' ')}`;
    return txt;
};

export const mensagemPendenciasUnidade = (u, nomeLider, tipo = null) => {
    const p = String(nomeLider || '').trim().split(/\s+/)[0] || '';
    const nome = p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : '';
    let txt = `Olá${nome ? `, ${nome}` : ''}! 👋\n\n🚨 *Pendências – ${u.unidade}*\n`;
    txt += linhasDaUnidade(u, tipo).join('\n');
    txt += '\n\nPor gentileza, regularize hoje. Obrigado!';
    return txt;
};
