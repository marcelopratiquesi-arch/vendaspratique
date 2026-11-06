// ==========================================
// VISÃO DA REDE no Dashboard (Admin/Mentor com o topo em "Todas"; decisão do dono, 06/11/2026)
// Uma linha por unidade com os mesmos números do Dashboard da unidade. As contas NÃO mudam:
// planos = contarPlanosDoCard (a soma das linhas = o número grande do card), Nutri é adicional,
// produtividade = 100% − (Fit ÷ planos base), produtos/serviços pelo catálogo, saídas e faturamento
// pela Movimentação digitada, ativos = último lançamento da unidade até o fim do período.
// Só leitura: não grava nada.
// ==========================================
import { getCategoriaItem, normalizeString, safeIsoDate } from '../utils.js';
import { somarMovimentoNoPeriodo } from '../movimentoDiario.js';

// Unidade sem venda de plano há este número de dias (ou mais) ganha o selo amarelo "Sem plano há X dias"
export const DIAS_SEM_PLANO_ALERTA = 2;

// Cor da produtividade no quadro (decisão do dono, 06/11/2026): vermelho abaixo de 50%, amarelo de 50% a 69%, verde a partir de 70%
export const PRODUTIVIDADE_ATENCAO = 50;
export const PRODUTIVIDADE_BOA = 70;
export const faixaProdutividade = (p) => (p === null || p === undefined ? null : p >= PRODUTIVIDADE_BOA ? 'boa' : p >= PRODUTIVIDADE_ATENCAO ? 'atencao' : 'ruim');

// Cores das unidades (paleta conferida para daltonismo, claro e escuro). Passando de 8 unidades,
// as cores se repetem com outro traço na linha (tracejado, depois pontilhado), nunca uma cor inventada.
const CORES_CLARO = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const CORES_ESCURO = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
const TRACOS = [undefined, '7 5', '2 4'];
export const estiloDaUnidade = (indice, escuro) => {
    const cores = escuro ? CORES_ESCURO : CORES_CLARO;
    return { cor: cores[indice % cores.length], traco: TRACOS[Math.floor(indice / cores.length) % TRACOS.length] };
};

export const chaveUnidade = (u) => normalizeString(String(u || ''));

const diaDe = (v) => safeIsoDate(v.data || v.created_at);
const diasEntre = (a, b) => {
    const [a1, m1, d1] = a.split('-').map(Number);
    const [a2, m2, d2] = b.split('-').map(Number);
    return Math.round((new Date(a2, m2 - 1, d2) - new Date(a1, m1 - 1, d1)) / 86400000);
};

// Lista de unidades da rede: as unidades visíveis (Mentor = as dele; ativas) + qualquer unidade que tenha venda
// no período (ex.: unidade desativada com venda antiga), para a soma das linhas bater com o total.
// "indice" = posição em ordem alfabética: a cor segue a unidade, não a posição no ranking.
export const listaUnidadesRede = (unidades = [], vendasFiltradas = []) => {
    const mapa = new Map();
    unidades.forEach(u => { const nome = typeof u === 'string' ? u : u?.nome; if (nome && !mapa.has(chaveUnidade(nome))) mapa.set(chaveUnidade(nome), nome); });
    vendasFiltradas.forEach(v => { if (v.unidade && !mapa.has(chaveUnidade(v.unidade))) mapa.set(chaveUnidade(v.unidade), v.unidade); });
    return [...mapa.entries()]
        .map(([chave, nome]) => ({ chave, nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        .map((u, indice) => ({ ...u, indice }));
};

// Último dia com venda de plano base de cada unidade (vendas carregadas no sistema, sem filtro de tela)
export const ultimoPlanoPorUnidade = (contadosTodos = []) => {
    const mapa = new Map();
    contadosTodos.forEach(({ venda }) => {
        const k = chaveUnidade(venda.unidade);
        const dia = diaDe(venda);
        if (dia && (!mapa.has(k) || dia > mapa.get(k))) mapa.set(k, dia);
    });
    return mapa;
};

const vazio = () => ({ planos: 0, grupos: { PLUS: 0, FIT: 0, 'PERSONAL CLASS': 0, 'OUTROS PLANOS': 0 }, nutri: 0, anterior: 0, produtos: 0, produtosValidos: 0, servicos: 0 });

/**
 * Uma linha por unidade.
 * contagemPlanos / contagemAnterior = resultado de contarPlanosDoCard (rede inteira, mesmos filtros da tela)
 * qtdValidaProduto(venda) = quanto daquela venda de produto conta para a meta (limite de doses)
 */
export const montarLinhasRede = ({
    unidadesRede, contagemPlanos, contagemAnterior, vendasFiltradas, planos, produtos, qtdValidaProduto,
    derivadosMovimento = [], faixa, ultimoPlano, hojeIso,
}) => {
    const porUnidade = new Map(unidadesRede.map(u => [u.chave, vazio()]));
    const de = (unidade) => {
        const k = chaveUnidade(unidade);
        if (!porUnidade.has(k)) porUnidade.set(k, vazio());
        return porUnidade.get(k);
    };
    contagemPlanos.contados.forEach(({ venda, qtd, base }) => {
        const l = de(venda.unidade);
        l.planos += qtd;
        if (l.grupos[base] !== undefined) l.grupos[base] += qtd;
    });
    contagemPlanos.nutri.contados.forEach(({ venda, qtd }) => { de(venda.unidade).nutri += qtd; });
    (contagemAnterior?.contados || []).forEach(({ venda, qtd }) => { de(venda.unidade).anterior += qtd; });
    vendasFiltradas.forEach(v => {
        const qtd = parseInt(v.quantidade) || 1;
        const cat = getCategoriaItem((v.produto || '').toUpperCase(), planos, produtos);
        if (cat === 'PRODUTO') {
            const l = de(v.unidade);
            l.produtos += qtd;
            l.produtosValidos += qtdValidaProduto ? qtdValidaProduto(v) : qtd;
        } else if (cat === 'SERVICO') de(v.unidade).servicos += qtd;
    });

    // O período inclui hoje? (só então o selo "Sem plano há X dias" faz sentido)
    const periodoComHoje = !faixa || (faixa.inicio <= hojeIso && faixa.fim >= hojeIso);

    return unidadesRede.map(u => {
        const l = porUnidade.get(u.chave) || vazio();
        const mov = derivadosMovimento.filter(x => chaveUnidade(x.unidade) === u.chave);
        const somaMov = somarMovimentoNoPeriodo(mov, faixa);
        const ultimoAtivos = [...mov].reverse().find(x => x.ativos !== null && x.ativos !== undefined && (!faixa?.fim || x.data <= faixa.fim));
        const ultimo = ultimoPlano?.get(u.chave) || null;
        const diasSemPlano = ultimo ? diasEntre(ultimo, hojeIso) : null;
        return {
            ...u,
            ...l,
            produtividade: l.planos > 0 ? Math.max(100 - (l.grupos.FIT / l.planos) * 100, 0) : null,
            // null = a unidade não lançou nada no período (aparece "—")
            cancelamentos: mov.some(x => x.cancelamentosDia !== null && (!faixa || (x.data >= faixa.inicio && x.data <= faixa.fim))) ? somaMov.cancelamentos : null,
            faturamento: somaMov.lancamentos > 0 ? somaMov.faturamento : null,
            ativos: ultimoAtivos ? ultimoAtivos.ativos : null,
            ultimoPlano: ultimo,
            diasSemPlano,
            // Selo amarelo: o período inclui hoje e a unidade está há 2 dias ou mais sem vender plano
            parouDeVender: periodoComHoje && diasSemPlano !== null && diasSemPlano >= DIAS_SEM_PLANO_ALERTA,
        };
    });
};

// Ordem do quadro: quem vendeu mais primeiro; quem não vendeu fica no fim (ordem alfabética)
export const ordenarLinhasRede = (linhas) => [...linhas].sort((a, b) => {
    if ((b.planos > 0) !== (a.planos > 0)) return b.planos > 0 ? 1 : -1;
    if (b.planos !== a.planos) return b.planos - a.planos;
    return a.nome.localeCompare(b.nome, 'pt-BR');
});

// Ritmo por unidade: uma série por unidade, dia a dia (ou acumulado), a partir dos planos contados do grupo escolhido
export const ritmoPorUnidade = ({ contados, unidadesRede, faixa, hojeIso, modo }) => {
    if (!faixa?.inicio || !faixa?.fim || faixa.inicio > hojeIso) return null;
    const n = diasEntre(faixa.inicio, faixa.fim) + 1;
    if (n < 2) return null;
    const ultimo = diasEntre(faixa.inicio, faixa.fim > hojeIso ? hojeIso : faixa.fim);
    const porUnidade = new Map(unidadesRede.map(u => [u.chave, new Array(ultimo + 1).fill(0)]));
    contados.forEach(({ venda, qtd }) => {
        const serie = porUnidade.get(chaveUnidade(venda.unidade));
        if (!serie) return;
        const i = diasEntre(faixa.inicio, diaDe(venda));
        if (i >= 0 && i <= ultimo) serie[i] += qtd;
    });
    if (modo === 'acumulado') porUnidade.forEach((serie) => { let s = 0; serie.forEach((q, i) => { s += q; serie[i] = s; }); });
    const linhas = Array.from({ length: n }, (_, i) => {
        const l = { i };
        unidadesRede.forEach(u => { l[`u${u.indice}`] = i <= ultimo ? porUnidade.get(u.chave)[i] : null; });
        return l;
    });
    const totais = new Map(unidadesRede.map(u => {
        const serie = porUnidade.get(u.chave);
        return [u.chave, modo === 'acumulado' ? serie[serie.length - 1] || 0 : serie.reduce((a, b) => a + b, 0)];
    }));
    return { linhas, totais, ultimo };
};
