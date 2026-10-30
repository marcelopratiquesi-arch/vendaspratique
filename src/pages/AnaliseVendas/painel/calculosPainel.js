// ==========================================
// CONTAS DO PLACAR DO MÊS (Dashboard novo, decisão do dono 29/10/2026)
// Metas em QUANTIDADE (tabela metas_unidades: uma linha por unidade + mês + ano).
// A contagem usa contarPlanosDoCard (mesma regra da aba "Metas da unidade").
// ==========================================
import { contarPlanosDoCard, getCategoriaItem, safeIsoDate } from '../utils.js';

// Cada meta do placar: campo em metas_unidades e grupo de venda que conta para ela
export const METAS_START = [
    { id: 'start_nutri', rotulo: 'Nutri', campo: 'meta_nutri', grupo: 'NUTRI' },
    { id: 'start_produtos', rotulo: 'Produtos', campo: 'meta_produtos', grupo: 'PRODUTO' },
    { id: 'start_personal', rotulo: 'Personal Class', campo: 'meta_personal', grupo: 'PERSONAL' },
];
export const METAS_MENSAL = [
    { id: 'mensal_nutri', rotulo: 'Nutri', campo: 'meta_nutri_mensal', grupo: 'NUTRI' },
    { id: 'mensal_plus', rotulo: 'Plus', campo: 'meta_plus_mensal', grupo: 'PLUS' },
    { id: 'mensal_personal', rotulo: 'Personal Class', campo: 'meta_pers_mensal', grupo: 'PERSONAL' },
    // Ativos é digitado à mão (ativos_atual): não tem ritmo nem projeção
    { id: 'mensal_ativos', rotulo: 'Ativos', campo: 'meta_ativos_mensal', manual: true },
];

// Faixa amarela: até 15% abaixo do ritmo esperado
export const TOLERANCIA_AMARELO = 0.85;

const paraIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Dia da venda (AAAA-MM-DD). "data" é o dia escolhido no lançamento; sem ela, created_at (UTC) vira o dia de Brasília/local.
export const diaDaVenda = (v) => {
    if (v.data) return safeIsoDate(v.data);
    if (!v.created_at) return '';
    const d = new Date(v.created_at);
    return isNaN(d) ? '' : paraIso(d);
};

// Dias do mês, quantos já passaram (hoje conta) e quantos faltam (hoje conta)
export const infoDoMes = (ano, mes, hoje = new Date()) => {
    const a = Number(ano), m = Number(mes);
    const diasMes = new Date(a, m, 0).getDate();
    const inicio = `${a}-${String(m).padStart(2, '0')}-01`;
    const fim = `${a}-${String(m).padStart(2, '0')}-${String(diasMes).padStart(2, '0')}`;
    const hojeIso = paraIso(hoje);
    let diasPassados = 0;
    if (hojeIso > fim) diasPassados = diasMes;
    else if (hojeIso >= inicio) diasPassados = hoje.getDate();
    const situacao = diasPassados === 0 ? 'futuro' : diasPassados === diasMes && hojeIso > fim ? 'fechado' : 'andamento';
    const diasRestantes = situacao === 'andamento' ? diasMes - diasPassados + 1 : 0;
    return { inicio, fim, diasMes, diasPassados, diasRestantes, situacao };
};

// Quantidade vendida por grupo de meta + comissão total
export const contarVendasDoMes = (vendasDoMes, planos, produtos) => {
    // Mesma contagem das Metas: contarPlanosDoCard (Nutri = adicionais; Plus/Personal = planos base)
    const contagem = contarPlanosDoCard(vendasDoMes, planos, produtos);
    const qtd = { NUTRI: contagem.nutri.total, PERSONAL: contagem.grupos['PERSONAL CLASS'].total, PLUS: contagem.grupos.PLUS.total, PRODUTO: 0 };
    let comissao = 0;
    vendasDoMes.forEach(v => {
        if (getCategoriaItem(v.produto, planos, produtos) === 'PRODUTO') qtd.PRODUTO += parseInt(v.quantidade) || 1;
        comissao += Number(v.comissao ?? v.valor) || 0;
    });
    return { qtd, comissao };
};

// Situação de UMA meta: % atingido, falta, ritmo necessário, projeção e cor.
// Cor: compara o % atingido com o % do mês que já passou (verde = no ritmo, amarelo = até 15% abaixo, vermelho = mais que isso).
export const avaliarMeta = ({ meta, vendido, mes, manual = false }) => {
    const m = Number(meta) || 0;
    const feito = Number(vendido) || 0;
    if (m <= 0) return null;
    const perc = feito / m;
    const falta = Math.max(m - feito, 0);
    const batida = feito >= m;
    const ritmo = !manual && mes.situacao === 'andamento' && !batida ? falta / mes.diasRestantes : null;
    const projecao = !manual && mes.diasPassados > 0 ? (feito / mes.diasPassados) * mes.diasMes : null;

    let status = 'neutro';
    if (batida) status = 'verde';
    else if (manual || mes.situacao === 'futuro') status = 'neutro';
    else if (mes.situacao === 'fechado') status = 'vermelho';
    else {
        const esperado = mes.diasPassados / mes.diasMes;
        const razao = perc / esperado;
        status = razao >= 1 ? 'verde' : razao >= TOLERANCIA_AMARELO ? 'amarelo' : 'vermelho';
    }
    return { meta: m, vendido: feito, perc, falta, batida, ritmo, projecao, status };
};

const PESO_STATUS = { neutro: 0, verde: 1, amarelo: 2, vermelho: 3 };

// Placar completo de uma unidade (metaLinha = linha de metas_unidades, ou undefined)
export const montarPlacar = ({ metaLinha, contagem, mes }) => {
    const linha = metaLinha || {};
    const avaliar = (item) => ({
        ...item,
        vendidoSemMeta: item.manual ? (Number(linha.ativos_atual) || 0) : contagem.qtd[item.grupo],
        resultado: avaliarMeta({
            meta: linha[item.campo],
            vendido: item.manual ? linha.ativos_atual : contagem.qtd[item.grupo],
            mes,
            manual: item.manual,
        }),
    });
    const start = METAS_START.map(avaliar);
    const mensal = METAS_MENSAL.map(avaliar);
    // Status geral = a pior cor entre as metas cadastradas (Ativos fica de fora, é digitado à mão)
    let statusGeral = 'neutro';
    [...start, ...mensal].forEach(i => {
        const s = i.resultado?.status;
        if (s && !i.manual && PESO_STATUS[s] > PESO_STATUS[statusGeral]) statusGeral = s;
    });
    const temMeta = [...start, ...mensal].some(i => i.resultado);
    return { start, mensal, statusGeral, temMeta, comissao: contagem.comissao, qtd: contagem.qtd };
};
