// ==========================================
// PANORAMA DA UNIDADE (Central da Unidade → aba Panorama; 09/11/2026, decisão do dono)
// Contas SEM tela (dá para testar com node). Usam as MESMAS funções das outras telas, para o Panorama
// nunca mostrar um número diferente do Dashboard, das Metas ou do CRM:
// - planos e Nutri: contarPlanosDoCard (regra 14) · produtos/serviços: getCategoriaItem (igual ao Dashboard)
// - doses únicas: aplicarLimiteDoses (regra 15) · metas: contarVendasDoMes + montarPlacar (aba Metas)
// - movimentação: derivarMovimento + somarMovimentoNoPeriodo (regra 16)
// Comissão (soma das vendas) e faturamento (digitado na Movimentação) ficam SEMPRE separados (regra 5).
// Só leitura: nada aqui grava.
// ==========================================
import { contarPlanosDoCard, getCategoriaItem } from '../../AnaliseVendas/utils.js';
import { aplicarLimiteDoses, qtdValidaProduto } from '../../AnaliseVendas/limiteDoses.js';
import { contarVendasDoMes, montarPlacar, infoDoMes, diaDaVenda } from '../../AnaliseVendas/painel/calculosPainel.js';
import { derivarMovimento, somarMovimentoNoPeriodo } from '../../AnaliseVendas/movimentoDiario.js';

export const paraIsoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Faixa do seletor de período ({ inicio, fim } em Date, fim NÃO incluído) → { inicio, fim } em AAAA-MM-DD com fim INCLUÍDO
export const faixaEmIso = (faixa) => {
    const inicio = faixa?.inicio ? paraIsoLocal(faixa.inicio) : null;
    let fim = null;
    if (faixa?.fim) { const d = new Date(faixa.fim); d.setDate(d.getDate() - 1); fim = paraIsoLocal(d); }
    return { inicio, fim };
};
export const naFaixaIso = (dia, faixa) => !!dia && (!faixa?.inicio || dia >= faixa.inicio) && (!faixa?.fim || dia <= faixa.fim);

const quantidade = (v) => parseInt(v.quantidade) || 1;
const valorDe = (v) => Number(v.comissao ?? v.valor) || 0;

// Resumo das vendas do período (vendas = todas as vendas carregadas da unidade; filtra pelo dia da venda)
export const resumoVendas = ({ vendas = [], faixa, planos = [], produtos = [] }) => {
    const doPeriodo = vendas.filter(v => naFaixaIso(diaDaVenda(v), faixa));
    const planosCard = contarPlanosDoCard(doPeriodo, planos, produtos);
    // Doses únicas: o limite é por unidade e mês, então usa TODAS as vendas carregadas (o mês inteiro)
    const doses = aplicarLimiteDoses(vendas, planos, produtos);
    let produtosVendidos = 0, produtosNaMeta = 0, servicos = 0, comissao = 0, conferidas = 0;
    const porConsultor = new Map();
    doPeriodo.forEach(v => {
        const categoria = getCategoriaItem(v.produto, planos, produtos);
        if (categoria === 'PRODUTO') { produtosVendidos += quantidade(v); produtosNaMeta += qtdValidaProduto(v, doses); }
        else if (categoria === 'SERVICO') servicos += quantidade(v);
        comissao += valorDe(v);
        if (v.conferiu === true) conferidas += 1;
        const nome = String(v.vendedor || '—').trim().toUpperCase() || '—';
        const c = porConsultor.get(nome) || { nome, itens: 0, comissao: 0 };
        c.itens += quantidade(v); c.comissao += valorDe(v);
        porConsultor.set(nome, c);
    });
    const consultores = [...porConsultor.values()].sort((a, b) => b.itens - a.itens || b.comissao - a.comissao || a.nome.localeCompare(b.nome, 'pt-BR'));
    const ultimas = [...doPeriodo].sort((a, b) => String(b.created_at || b.data || '').localeCompare(String(a.created_at || a.data || ''))).slice(0, 6);
    return {
        lancamentos: doPeriodo.length,
        planos: planosCard.total,
        grupos: planosCard.grupos,
        nutri: planosCard.nutri.total,
        produtosVendidos,
        produtosNaMeta,
        servicos,
        comissao,
        conferidas,
        percConferidas: doPeriodo.length ? conferidas / doPeriodo.length : null,
        consultores,
        ultimas,
    };
};

// Variação contra as mesmas datas do mês anterior (▲▼), igual ao card de planos do Dashboard
export const variacao = (atual, anterior) => {
    if (anterior === null || anterior === undefined) return null;
    if (!anterior) return atual > 0 ? { perc: null, dif: atual } : null;
    return { perc: (atual - anterior) / anterior, dif: atual - anterior };
};

// Metas do MÊS ATUAL (não seguem o período: são do mês), com o mesmo placar da aba Metas.
// Produto conta com o limite de doses únicas (regra 15).
export const placarDoMes = ({ vendas = [], metaLinha, semPersonal = false, planos = [], produtos = [], agora = new Date() }) => {
    const mesIso = paraIsoLocal(agora).slice(0, 7);
    const doMes = vendas.filter(v => diaDaVenda(v).slice(0, 7) === mesIso);
    const contagem = contarVendasDoMes(doMes, planos, produtos);
    const doses = aplicarLimiteDoses(vendas, planos, produtos);
    contagem.qtd.PRODUTO = doMes.reduce((s, v) => (getCategoriaItem(v.produto, planos, produtos) === 'PRODUTO' ? s + qtdValidaProduto(v, doses) : s), 0);
    const mes = infoDoMes(agora.getFullYear(), agora.getMonth() + 1, agora);
    const placar = montarPlacar({ metaLinha, contagem, mes });
    const tirarPersonal = (lista) => (semPersonal ? lista.filter(i => !/PERSONAL/i.test(i.rotulo)) : lista);
    return { ...placar, start: tirarPersonal(placar.start), mensal: tirarPersonal(placar.mensal), mes };
};

// Movimentação do período: faturamento (digitado) e cancelamentos somados dia a dia; ativos = último lançado até o fim
export const resumoMovimento = ({ linhas = [], faixa }) => {
    const derivados = derivarMovimento(linhas);
    const soma = somarMovimentoNoPeriodo(derivados, faixa);
    const ultimoAtivos = [...derivados].reverse().find(l => l.ativos !== null && l.ativos !== undefined && (!faixa?.fim || l.data <= faixa.fim)) || null;
    const ultimoLancamento = [...derivados].reverse().find(l => !faixa?.fim || l.data <= faixa.fim) || null;
    return {
        faturamento: soma.lancamentos ? soma.faturamento : null,
        cancelamentos: soma.cancelamentos,
        lancamentos: soma.lancamentos,
        ativos: ultimoAtivos ? ultimoAtivos.ativos : null,
        ativosEm: ultimoAtivos ? ultimoAtivos.data : null,
        ultimoLancamento: ultimoLancamento ? ultimoLancamento.data : null,
    };
};

// Avaliações do período (avaliacoes = da unidade; dia = data da avaliação ou do registro)
export const resumoAvaliacoes = ({ avaliacoes = [], faixa, pendenciasAvaliacao }) => {
    const doPeriodo = avaliacoes.filter(a => naFaixaIso(String(a.data || '').slice(0, 10) || (a.created_at ? paraIsoLocal(new Date(a.created_at)) : ''), faixa));
    const porAvaliador = new Map();
    let incompletas = 0;
    doPeriodo.forEach(a => {
        const nome = String(a.professor || '—').trim().toUpperCase() || '—';
        porAvaliador.set(nome, (porAvaliador.get(nome) || 0) + 1);
        if (pendenciasAvaliacao && pendenciasAvaliacao(a).length) incompletas += 1;
    });
    return {
        total: doPeriodo.length,
        incompletas,
        avaliadores: [...porAvaliador.entries()].map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd || a.nome.localeCompare(b.nome, 'pt-BR')),
    };
};

// CRM: ações de contato e pessoas diferentes contatadas (regra 10: a meta conta PESSOAS, não cliques)
export const ACOES_DE_CONTATO = ['WhatsApp', 'Ligação', 'Observação', 'Mudança de Fase'];
const mesmoNomeSimples = (a, b) => String(a || '').trim().toUpperCase() === String(b || '').trim().toUpperCase();
// historico = ações das recepcionistas do período E de hoje (a meta é sempre de hoje); faixa = período escolhido
export const resumoCrm = ({ historico = [], feitosHoje = [], recepcionistas = [], hojeIso, faixa, mesmoNome = mesmoNomeSimples, ehMudancaPorCompra = () => false }) => {
    const doDia = (h) => h.data_registro && paraIsoLocal(new Date(h.data_registro)) === hojeIso;
    const porPessoa = recepcionistas.map(r => {
        const todasDela = historico.filter(h => mesmoNome(h.consultor, r.nome));
        const dela = todasDela.filter(h => h.data_registro && naFaixaIso(paraIsoLocal(new Date(h.data_registro)), faixa));
        const pessoasHoje = new Set([
            ...todasDela.filter(h => doDia(h) && !String(h.observacao || '').startsWith('Movido em lote')).map(h => `lead:${h.lead_id}`),
            ...feitosHoje.filter(f => !f.lead_id && mesmoNome(f.consultor, r.nome)).map(f => `aluno:${f.aluno_id || f.id}`),
        ]).size;
        return {
            nome: r.nome,
            turno: r.turno || null,
            pessoasHoje,
            acoes: dela.length,
            whatsapp: dela.filter(h => h.tipo_acao === 'WhatsApp').length,
            ligacoes: dela.filter(h => h.tipo_acao === 'Ligação').length,
            fechados: new Set(dela.filter(h => h.tipo_acao === 'Mudança de Fase' && String(h.observacao || '').includes('para "Fechado"') && !ehMudancaPorCompra(h.observacao)).map(h => String(h.lead_id))).size,
        };
    }).sort((a, b) => b.pessoasHoje - a.pessoasHoje || b.acoes - a.acoes || a.nome.localeCompare(b.nome, 'pt-BR'));
    const soma = (campo) => porPessoa.reduce((s, p) => s + p[campo], 0);
    return {
        porPessoa,
        pessoasHoje: soma('pessoasHoje'),
        metaHoje: 150 * recepcionistas.length,
        acoes: soma('acoes'),
        whatsapp: soma('whatsapp'),
        ligacoes: soma('ligacoes'),
        fechados: soma('fechados'),
    };
};
