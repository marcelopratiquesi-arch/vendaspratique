// ==========================================
// LISTAS DE CONTATOS DO CRM — carregar conforme a necessidade (decisão do dono, 10/11/2026)
// Antes, abrir o CRM baixava TODOS os contatos (31.648 na Visão Global, 24 mil deles parados no Banco Bruto),
// de 1.000 em 1.000 e um pedido depois do outro, e de novo a cada vez que se entrava no CRM.
// Agora há duas listas:
//   - RESUMO (entrada do CRM: Equipe, Painel, Contatos): só as CARTEIRAS (contatos com uma recepcionista, em
//     aberto ou puxados nos últimos 90 dias) e os VISITANTES dos últimos 90 dias. Os números do topo (Base
//     aguardando, Em atendimento, Na Geladeira) são CONTADOS no banco (contarContatos), sem baixar a lista.
//   - COMPLETA (só de UMA unidade): ao abrir o CRM de uma recepcionista ou o "Abastecer carteiras". É a mesma
//     regra de antes: últimos 90 dias + os mais antigos ainda em aberto (tudo menos Fechado/Arquivado).
// As duas ficam GUARDADAS na memória enquanto o sistema está aberto: sair e voltar ao CRM não baixa de novo.
// Os avisos do tempo real (repassados pelo App, aoVivoContatos.js) mantêm as listas guardadas em dia mesmo com o
// CRM fechado. Pedido de recarga do App (internet caiu etc.) ou o botão "Atualizar" = baixa de novo.
// Download em paralelo: 6 pedidos de 1.000 ao mesmo tempo.
// ==========================================
import { supabase } from '../../supabaseClient.js';
import { EVENTO_CONTATOS, EVENTO_CONTATOS_RECARREGAR } from '../../components/aoVivoContatos.js';

export const DIAS_CORTE_APP = 90;
export const STATUS_ENCERRADOS = ['Fechado', 'Arquivado'];
// Fases "em aberto" de quem está com uma recepcionista (Day Use antigo aparece como Em Contato)
const FASES_ABERTAS = ['Novo', 'Em Contato', 'Day Use (3 Dias)'];
const POR_PAGINA = 1000;
const PEDIDOS_JUNTOS = 6;

const corteISO = () => new Date(Date.now() - DIAS_CORTE_APP * 86400000).toISOString();
const recente = (l) => {
    const t = Date.parse(l?.created_at || '');
    return !Number.isFinite(t) || t >= Date.now() - DIAS_CORTE_APP * 86400000;
};
const mesmaUnidade = (l, unidade) => !unidade || String(l?.unidade || '').toUpperCase().trim() === String(unidade).toUpperCase().trim();
const ehVisitante = (l) => String(l?.origem || '').toUpperCase() === 'RECEPCAO';

// Quem entra em cada lista (a mesma regra da busca no banco, para encaixar os avisos do tempo real)
const REGRAS = {
    completa: (l, unidade) => mesmaUnidade(l, unidade) && (recente(l) || !STATUS_ENCERRADOS.includes(l.status)),
    resumo: (l, unidade) => mesmaUnidade(l, unidade) && (
        (Boolean(l.puxado_por) && (FASES_ABERTAS.includes(l.status) || (l.puxado_em && Date.parse(l.puxado_em) >= Date.now() - DIAS_CORTE_APP * 86400000)))
        || (ehVisitante(l) && recente(l))
    )
};

// Lista guardada: chave "tipo|UNIDADE" → { tipo, unidade, porId: Map, pronta }
const guardadas = new Map();
const chaveDe = (tipo, unidade) => `${tipo}|${String(unidade || '').toUpperCase().trim()}`;
const ordenar = (porId) => [...porId.values()].sort((a, b) => (b.id > a.id ? 1 : b.id < a.id ? -1 : 0));

/** Lista já guardada (ou null). */
export const listaGuardada = (tipo, unidade) => {
    const g = guardadas.get(chaveDe(tipo, unidade));
    return g?.pronta ? ordenar(g.porId) : null;
};

/** A tela mudou a lista (ações locais): guarda o estado atual para a próxima vez. */
export const guardarLista = (tipo, unidade, lista) => {
    guardadas.set(chaveDe(tipo, unidade), { tipo, unidade, porId: new Map(lista.map(l => [l.id, l])), pronta: true });
};

/** Esquece tudo (botão "Atualizar" ou pedido de recarga do App). */
export const esquecerListas = () => guardadas.clear();

/** Regra da lista (para a tela encaixar os avisos do tempo real com o mesmo critério). */
export const ficaNaLista = (tipo, unidade, lead) => Boolean(lead) && REGRAS[tipo](lead, unidade);

// Avisos do tempo real: mantêm as listas guardadas em dia, mesmo com o CRM fechado
if (typeof window !== 'undefined') {
    window.addEventListener(EVENTO_CONTATOS, (e) => {
        const eventos = Array.isArray(e?.detail) ? e.detail : [];
        if (!eventos.length) return;
        guardadas.forEach(g => {
            eventos.forEach(ev => {
                if (ev?.eventType === 'DELETE') { if (ev.old?.id != null) g.porId.delete(ev.old.id); return; }
                const linha = ev?.new;
                if (!linha || linha.id == null) return;
                if (REGRAS[g.tipo](linha, g.unidade)) g.porId.set(linha.id, { ...(g.porId.get(linha.id) || {}), ...linha });
                else g.porId.delete(linha.id);
            });
        });
    });
    window.addEventListener(EVENTO_CONTATOS_RECARREGAR, esquecerListas);
}

// Baixa todas as páginas de uma busca: a 1ª pede o total; as outras vão 6 de cada vez
const baixarTudo = async (montar, aoProgresso) => {
    const primeira = await montar(true).range(0, POR_PAGINA - 1);
    if (primeira.error) throw primeira.error;
    const porId = new Map((primeira.data || []).map(l => [l.id, l]));
    const total = Number.isFinite(primeira.count) ? primeira.count : null;
    aoProgresso?.(porId.size, total);
    if ((primeira.data || []).length < POR_PAGINA) return porId;
    const paginas = total ? Math.ceil(total / POR_PAGINA) : 200;
    for (let inicio = 1; inicio < paginas; inicio += PEDIDOS_JUNTOS) {
        const lote = [];
        for (let p = inicio; p < Math.min(paginas, inicio + PEDIDOS_JUNTOS); p++) {
            lote.push(montar(false).range(p * POR_PAGINA, p * POR_PAGINA + POR_PAGINA - 1));
        }
        const respostas = await Promise.all(lote);
        let acabou = false;
        for (const r of respostas) {
            if (r.error) throw r.error;
            (r.data || []).forEach(l => porId.set(l.id, l));
            if ((r.data || []).length < POR_PAGINA) acabou = true;
        }
        aoProgresso?.(porId.size, total);
        if (acabou && !total) break;
    }
    // Entrou contato novo durante a carga (as páginas andam): o tempo real encaixa depois
    return porId;
};

/**
 * Carrega (ou devolve a guardada) uma lista: tipo 'resumo' (unidade '' = todas) ou 'completa' (sempre UMA unidade).
 * aoProgresso(feitos, total) para a barra. Devolve a lista em ordem (mais novos primeiro).
 */
export const carregarListaCrm = async (tipo, unidade, aoProgresso) => {
    const guardada = listaGuardada(tipo, unidade);
    if (guardada) return guardada;
    const encerrados = `(${STATUS_ENCERRADOS.map(s => `"${s}"`).join(',')})`;
    const abertas = `(${FASES_ABERTAS.map(s => `"${s}"`).join(',')})`;
    const corte = corteISO();
    const filtroUnidade = (q) => (unidade ? q.ilike('unidade', String(unidade).trim()) : q);
    let porId;
    if (tipo === 'completa') {
        porId = await baixarTudo((comTotal) => filtroUnidade(
            supabase.from('leads').select('*', comTotal ? { count: 'exact' } : undefined)
                .or(`created_at.gte."${corte}",status.not.in.${encerrados}`)
                .order('id', { ascending: false })
        ), aoProgresso);
    } else {
        // Carteiras (com recepcionista: em aberto ou puxados nos últimos 90 dias) + visitantes dos últimos 90 dias
        const [carteiras, visitantes] = await Promise.all([
            baixarTudo((comTotal) => filtroUnidade(
                supabase.from('leads').select('*', comTotal ? { count: 'exact' } : undefined)
                    .not('puxado_por', 'is', null)
                    .or(`status.in.${abertas},puxado_em.gte."${corte}"`)
                    .order('id', { ascending: false })
            ), aoProgresso),
            baixarTudo((comTotal) => filtroUnidade(
                supabase.from('leads').select('*', comTotal ? { count: 'exact' } : undefined)
                    .ilike('origem', 'recepcao')
                    .gte('created_at', corte)
                    .order('id', { ascending: false })
            ))
        ]);
        porId = new Map([...visitantes, ...carteiras]);
    }
    guardadas.set(chaveDe(tipo, unidade), { tipo, unidade, porId, pronta: true });
    return ordenar(porId);
};

/**
 * Números do topo da entrada do CRM contados no banco (sem baixar a lista), com as mesmas regras de antes:
 * Base aguardando = sem recepcionista e não arquivado; Em atendimento = com recepcionista em Novo/Em Contato;
 * Na Geladeira = Perdido. (Mesma faixa de contatos de antes: últimos 90 dias + os mais antigos em aberto.)
 */
export const contarContatos = async (unidade) => {
    const encerrados = `(${STATUS_ENCERRADOS.map(s => `"${s}"`).join(',')})`;
    const abertas = `(${FASES_ABERTAS.map(s => `"${s}"`).join(',')})`;
    const corte = corteISO();
    const base = () => {
        let q = supabase.from('leads').select('id', { count: 'exact', head: true })
            .or(`created_at.gte."${corte}",status.not.in.${encerrados}`);
        if (unidade) q = q.ilike('unidade', String(unidade).trim());
        return q;
    };
    const [semDona, emAtendimento, geladeira] = await Promise.all([
        base().is('puxado_em', null).neq('status', 'Arquivado'),
        base().not('puxado_em', 'is', null).filter('status', 'in', abertas),
        base().eq('status', 'Perdido')
    ]);
    const erro = semDona.error || emAtendimento.error || geladeira.error;
    if (erro) { console.error('CRM: erro ao contar os contatos', erro); return null; }
    return { base: semDona.count || 0, emAtendimento: emAtendimento.count || 0, geladeira: geladeira.count || 0 };
};
