// ==========================================
// CENTRAL DO COLABORADOR — contas SEM tela (11/11/2026, decisão do dono; dá para testar com node).
// Usa as MESMAS funções das outras telas, para nunca mostrar um número diferente do Dashboard/Fechamento:
// planos e Nutri = contarPlanosDoCard (regra 14) · categoria = getCategoriaItem · dia da venda = diaDaVenda.
// Comissão = soma de `comissao` (ou `valor`) das vendas, igual ao Fechamento (regra 5: é comissão, não preço).
// "Conferida" = venda marcada no Fechamento (entra no pagamento); "aguardando" = ainda não conferida.
// Só leitura: nada aqui grava.
// ==========================================
import { contarPlanosDoCard, getCategoriaItem } from '../../AnaliseVendas/utils.js';
import { diaDaVenda } from '../../AnaliseVendas/painel/calculosPainel.js';

export const paraIsoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const naFaixa = (dia, faixa) => !!dia && (!faixa?.inicio || dia >= faixa.inicio) && (!faixa?.fim || dia <= faixa.fim);
export const normalizarNome = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();

const quantidade = (v) => parseInt(v.quantidade) || 1;
export const comissaoDe = (v) => Number(v.comissao ?? v.valor) || 0;

// Dias entre duas datas AAAA-MM-DD (b - a)
export const diasEntre = (a, b) => {
    if (!a || !b) return null;
    const d1 = new Date(`${a}T12:00:00`);
    const d2 = new Date(`${b}T12:00:00`);
    return Math.round((d2 - d1) / 86400000);
};

// Resumo do período: vendas = as vendas da pessoa (qualquer período carregado); filtra pelo dia da venda
export const resumoColaborador = ({ vendas = [], faixa, planos = [], produtos = [], hojeIso }) => {
    const doPeriodo = vendas.filter(v => naFaixa(diaDaVenda(v), faixa));
    const card = contarPlanosDoCard(doPeriodo, planos, produtos);
    let comissao = 0, conferida = 0, aguardando = 0, produtosQtd = 0, servicosQtd = 0, qtdConferidas = 0;
    const porItem = new Map();
    const porDia = new Map();
    doPeriodo.forEach(v => {
        const valor = comissaoDe(v);
        comissao += valor;
        if (v.conferiu === true) { conferida += valor; qtdConferidas += 1; } else aguardando += valor;
        const cat = getCategoriaItem(v.produto, planos, produtos);
        if (cat === 'PRODUTO') produtosQtd += quantidade(v);
        else if (cat === 'SERVICO') servicosQtd += quantidade(v);
        const nome = String(v.produto || '—').trim().toUpperCase() || '—';
        const item = porItem.get(nome) || { nome, qtd: 0, comissao: 0, categoria: cat };
        item.qtd += quantidade(v); item.comissao += valor;
        porItem.set(nome, item);
        const dia = diaDaVenda(v);
        const d = porDia.get(dia) || { dia, vendas: 0, comissao: 0 };
        d.vendas += 1; d.comissao += valor;
        porDia.set(dia, d);
    });
    // Última venda: de tudo o que foi carregado (não só do período)
    const ultimaVenda = vendas.reduce((m, v) => { const d = diaDaVenda(v); return d && (!m || d > m) ? d : m; }, null);
    return {
        lancamentos: doPeriodo.length,
        comissao,
        conferida,
        aguardando,
        qtdConferidas,
        planos: card.total,
        grupos: card.grupos,
        nutri: card.nutri.total,
        produtos: produtosQtd,
        servicos: servicosQtd,
        maisVendidos: [...porItem.values()].sort((a, b) => b.qtd - a.qtd || b.comissao - a.comissao || a.nome.localeCompare(b.nome, 'pt-BR')),
        porDia: [...porDia.values()].sort((a, b) => a.dia.localeCompare(b.dia)),
        ultimaVenda,
        diasSemVender: ultimaVenda && hojeIso ? diasEntre(ultimaVenda, hojeIso) : null,
        doPeriodo,
    };
};

// Comissão dos últimos N meses (o mês atual é o último): total, conferida, aguardando e quantidade de vendas
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const inicioDosUltimosMeses = (meses = 6, agora = new Date()) => paraIsoLocal(new Date(agora.getFullYear(), agora.getMonth() - (meses - 1), 1));
export const comissaoPorMes = ({ vendas = [], meses = 6, agora = new Date() }) => {
    const lista = [];
    for (let i = meses - 1; i >= 0; i -= 1) {
        const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
        const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        lista.push({ mes, rotulo: `${MESES_CURTOS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, total: 0, conferida: 0, aguardando: 0, vendas: 0 });
    }
    const porMes = new Map(lista.map(l => [l.mes, l]));
    vendas.forEach(v => {
        const linha = porMes.get(diaDaVenda(v).slice(0, 7));
        if (!linha) return;
        const valor = comissaoDe(v);
        linha.total += valor;
        linha.vendas += 1;
        if (v.conferiu === true) linha.conferida += valor; else linha.aguardando += valor;
    });
    return lista;
};

// Posição na unidade pela comissão do período (vendasUnidade = vendas da unidade no período; só vendedor e valor)
export const posicaoNaUnidade = (vendasUnidade = [], nome) => {
    const alvo = normalizarNome(nome);
    const soma = new Map();
    vendasUnidade.forEach(v => { const n = normalizarNome(v.vendedor); if (n) soma.set(n, (soma.get(n) || 0) + comissaoDe(v)); });
    const ordem = [...soma.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
    const i = ordem.findIndex(([n]) => n === alvo);
    return { posicao: i >= 0 ? i + 1 : null, total: ordem.length, lider: ordem[0] ? { nome: ordem[0][0], comissao: ordem[0][1] } : null };
};

// Outros nomes parecidos com vendas (mesmo 1º e último nome, escrito diferente): a comissão ficou separada
export const nomesParecidos = (linhas = [], nome) => {
    const alvo = normalizarNome(nome);
    const cont = new Map();
    linhas.forEach(l => { const n = normalizarNome(l.vendedor); if (n && n !== alvo) cont.set(n, (cont.get(n) || 0) + 1); });
    return [...cont.entries()].map(([nomeOutro, qtd]) => ({ nome: nomeOutro, qtd })).sort((a, b) => b.qtd - a.qtd);
};

// Visitantes que a pessoa atendeu no período (leads do Cadastro de Visitante) e quantos fecharam
export const resumoVisitantes = (leads = []) => ({
    total: leads.length,
    fechados: leads.filter(l => String(l.status || '').toLowerCase() === 'fechado').length,
});

// ------------------------------------------
// Nome igual "de verdade": sem acento, sem diferença de maiúscula e sem espaço a mais (o banco guarda o nome
// escrito à mão em vendas, avaliações e CRM). padraoBuscaNome monta o filtro largo do banco (ilike) que pega
// também a versão com/sem acento; a tela depois fica só com quem tem o nome igual (mesmoNomeColaborador).
// ------------------------------------------
export const mesmoNomeColaborador = (a, b) => !!normalizarNome(a) && normalizarNome(a) === normalizarNome(b);
export const padraoBuscaNome = (nome) => {
    const palavras = normalizarNome(nome).split(' ').filter(Boolean);
    if (!palavras.length) return null;
    // Vogal e C podem ter acento no banco (É, Ã, Ç...): viram "_" (um caractere qualquer)
    return `%${palavras.map(p => p.replace(/[%_\]/g, '').replace(/[AEIOUC]/g, '_')).join('%')}%`;
};

// ------------------------------------------
// CRM da recepcionista no período (regra 10: a meta conta PESSOAS diferentes no dia, 150 por dia)
// historico = ações dela no historico_leads (WhatsApp, Ligação, Observação, Mudança de Fase, Agendamento)
// feitos = crm_contatos_feitos dela (tem o meio: WHATSAPP, LIGACAO ou "sem WhatsApp") · resultados = crm_resultados_contato
// ------------------------------------------
export const META_PESSOAS_DIA = 150;
const RESPONDEU_CODIGOS = ['PENSANDO', 'INTERESSADO', 'NAO_QUER'];
const ehSemWhatsAppCanal = (canal) => !!canal && canal !== 'WHATSAPP' && canal !== 'LIGACAO';
const diaDoRegistro = (valor) => (valor ? paraIsoLocal(new Date(valor)) : '');
const ACOES_CONTATO = ['WhatsApp', 'Ligação', 'Observação', 'Mudança de Fase'];

export const resumoCrmColaborador = ({ historico = [], feitos = [], resultados = [], faixa, hojeIso, ehMudancaPorCompra = () => false }) => {
    const hist = historico.filter(h => naFaixa(diaDoRegistro(h.data_registro), faixa));
    const feitosP = feitos.filter(f => naFaixa(diaDoRegistro(f.criado_em), faixa));
    const resP = resultados.filter(r => naFaixa(diaDoRegistro(r.criado_em), faixa));
    const contatos = hist.filter(h => ACOES_CONTATO.includes(h.tipo_acao));

    // Pessoas diferentes por dia (contato do CRM pelo lead; contato sem lead, como Migração/Resgate, pelo aluno)
    const porDia = new Map();
    const marcar = (dia, chave) => { if (!dia) return; if (!porDia.has(dia)) porDia.set(dia, new Set()); porDia.get(dia).add(chave); };
    contatos.filter(h => !String(h.observacao || '').startsWith('Movido em lote')).forEach(h => marcar(diaDoRegistro(h.data_registro), `lead:${h.lead_id}`));
    feitosP.filter(f => !f.lead_id).forEach(f => marcar(diaDoRegistro(f.criado_em), `aluno:${f.aluno_id || f.id}`));
    const dias = [...porDia.entries()].map(([dia, s]) => ({ dia, pessoas: s.size })).sort((a, b) => a.dia.localeCompare(b.dia));

    const textoRes = (h) => String(h.observacao || '').toLowerCase();
    const resultadosFunil = hist.filter(h => h.tipo_acao === 'Agendamento' && textoRes(h).startsWith('resultado:'));
    const naoRespondeuFunil = resultadosFunil.filter(h => textoRes(h).includes('não respondeu')).length;
    const respondeuFunil = resultadosFunil.length - naoRespondeuFunil;
    const interessadoFunil = resultadosFunil.filter(h => textoRes(h).includes('interessado')).length;
    const responderam = respondeuFunil + resP.filter(r => RESPONDEU_CODIGOS.includes(r.resultado)).length;
    const naoResponderam = naoRespondeuFunil + resP.filter(r => r.resultado === 'SEM_RESPOSTA').length;

    const porTipo = {};
    feitosP.forEach(f => { const t = f.tipo || 'OUTRO'; porTipo[t] = (porTipo[t] || 0) + 1; });

    return {
        dias,
        pessoasHoje: dias.find(d => d.dia === hojeIso)?.pessoas || 0,
        totalPessoas: dias.reduce((s, d) => s + d.pessoas, 0),
        diasTrabalhados: dias.length,
        diasComMeta: dias.filter(d => d.pessoas >= META_PESSOAS_DIA).length,
        mediaPorDia: dias.length ? Math.round(dias.reduce((s, d) => s + d.pessoas, 0) / dias.length) : 0,
        acoes: contatos.length,
        whatsapp: contatos.filter(h => h.tipo_acao === 'WhatsApp').length,
        ligacoes: contatos.filter(h => h.tipo_acao === 'Ligação').length,
        semWhatsapp: feitosP.filter(f => ehSemWhatsAppCanal(f.canal)).length,
        boasVindas: contatos.filter(h => h.tipo_acao === 'WhatsApp' && String(h.observacao || '').startsWith('Mensagem enviada (Boas-vindas)')).length,
        fechou: new Set(contatos.filter(h => h.tipo_acao === 'Mudança de Fase' && String(h.observacao || '').includes('para "Fechado"') && !ehMudancaPorCompra(h.observacao)).map(h => String(h.lead_id))).size,
        responderam,
        naoResponderam,
        interessados: interessadoFunil + resP.filter(r => r.resultado === 'INTERESSADO').length,
        percResposta: responderam + naoResponderam ? responderam / (responderam + naoResponderam) : null,
        porTipo,
        ultimaAcao: hist.reduce((m, h) => (h.data_registro && (!m || h.data_registro > m) ? h.data_registro : m), null),
    };
};

// ------------------------------------------
// Avaliações físicas que a pessoa fez: período, incompletas e os últimos 6 meses
// ------------------------------------------
const diaDaAvaliacao = (a) => String(a.data || '').slice(0, 10) || (a.created_at ? paraIsoLocal(new Date(a.created_at)) : '');
export const resumoAvaliacoesColaborador = ({ avaliacoes = [], faixa, agora = new Date(), estaIncompleta = () => false }) => {
    const doPeriodo = avaliacoes.filter(a => naFaixa(diaDaAvaliacao(a), faixa));
    const meses = comissaoPorMes({ vendas: [], meses: 6, agora }).map(m => ({ mes: m.mes, rotulo: m.rotulo, qtd: 0 }));
    const porMes = new Map(meses.map(m => [m.mes, m]));
    avaliacoes.forEach(a => { const m = porMes.get(diaDaAvaliacao(a).slice(0, 7)); if (m) m.qtd += 1; });
    return {
        total: doPeriodo.length,
        incompletas: doPeriodo.filter(estaIncompleta).length,
        alunos: new Set(doPeriodo.map(a => a.aluno_id || a.cpf || a.aluno)).size,
        porMes: meses,
        ultimas: [...doPeriodo].sort((a, b) => diaDaAvaliacao(b).localeCompare(diaDaAvaliacao(a)) || (b.id || 0) - (a.id || 0)),
        ultimaEm: avaliacoes.reduce((m, a) => { const d = diaDaAvaliacao(a); return d && (!m || d > m) ? d : m; }, null),
    };
};

// ------------------------------------------
// Pagamento aprovado de cada mês (aba Comissões do Fechamento, 11/11/2026). A pessoa pode ter vendido em mais de
// uma unidade no mês: "aprovado" só quando TODAS as unidades das vendas dela naquele mês tiveram o pagamento
// aprovado; "parcial" quando só algumas. pagamentos = null quando a tabela ainda não existe (sem a coluna).
// ------------------------------------------
export const situacaoPagamentoDoMes = ({ mes, vendas = [], pagamentos = [] }) => {
    const unidades = [...new Set(vendas.filter(v => diaDaVenda(v).slice(0, 7) === mes).map(v => String(v.unidade || '').trim().toUpperCase()).filter(Boolean))];
    if (!unidades.length) return { situacao: 'sem_vendas' };
    const aprovados = unidades.map(u => pagamentos.find(p => p.ativo !== false && p.mes === mes && String(p.unidade || '').trim().toUpperCase() === u)).filter(Boolean);
    if (!aprovados.length) return { situacao: 'aberto' };
    const ultimo = aprovados.reduce((m, p) => (!m || String(p.aprovado_em) > String(m.aprovado_em) ? p : m), null);
    return { situacao: aprovados.length === unidades.length ? 'aprovado' : 'parcial', aprovadoEm: ultimo.aprovado_em, aprovadoPor: ultimo.aprovado_por };
};
