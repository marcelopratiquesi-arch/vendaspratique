// GESTÃO À VISTA — PRODUTOS (decisão do dono, 18/11/2026). Só contas, sem tela e sem banco.
// Regras (as mesmas que o Ranking de produtos já usa, só mostradas de outro jeito):
//  - Quem é cobrado: Saver e Recepção ATIVOS (Líder, Bem-estar e outros não são cobrados; se venderam, aparecem só no histórico).
//  - Meta: mínimo de 3 produtos (Whey, Energy e outros produtos) POR PESSOA, POR MÊS. A unidade pode ter outro número
//    (tabela meta_produtos_pessoa); sem linha, vale META_PADRAO.
//  - Doses únicas acima do limite da unidade não contam (limiteDoses.js, regra 15): usa qtdValidaProduto.
//  - Início = colaboradores.data_inicio (dia 1 no sistema); fim = colaboradores.desligado_em. Mês fora desse intervalo = "Inativo"
//    (não é cobrado nem conta como "abaixo").
import { getCategoriaItem, normalizeString, safeIsoDate } from '../utils.js';
import { qtdValidaProduto } from '../limiteDoses.js';

export const META_PADRAO = 3;
export const PERIODOS_DIAS = [30, 60, 90, 120];

export const hojeBrasil = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const paraData = (iso) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); };
const paraIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const somarDias = (iso, n) => { const d = paraData(iso); d.setDate(d.getDate() + n); return paraIso(d); };
export const diasEntre = (a, b) => Math.round((paraData(b) - paraData(a)) / 86400000);
const primeiroDiaDoMes = (mes) => `${mes}-01`;
export const ultimoDiaDoMes = (mes) => { const [a, m] = mes.split('-').map(Number); return paraIso(new Date(a, m, 0)); };

export const faixaDosDias = (dias, hoje = hojeBrasil()) => ({ inicio: somarDias(hoje, -(dias - 1)), fim: hoje });

// Meses (AAAA-MM) que a faixa toca, do mais antigo para o mais novo
export const mesesDaFaixa = (inicio, fim) => {
    const lista = [];
    let [a, m] = inicio.slice(0, 7).split('-').map(Number);
    const [fa, fm] = fim.slice(0, 7).split('-').map(Number);
    while (a < fa || (a === fa && m <= fm)) {
        lista.push(`${a}-${String(m).padStart(2, '0')}`);
        m += 1; if (m > 12) { m = 1; a += 1; }
    }
    return lista;
};

export const ehSaverOuRecepcao = (c) => {
    const cargo = String(c?.cargo || c?.setor || c?.role || '').toUpperCase();
    return cargo.includes('SAVER') || cargo.includes('RECEPÇÃO') || cargo.includes('RECEPCAO');
};

const diaDe = (campo) => (campo ? String(campo).slice(0, 10) : null);
// Fim do vínculo: data do desligamento; desligado sem data = já fora (nunca cobrado)
export const fimDoVinculo = (c) => {
    const d = diaDe(c?.desligado_em);
    if (d) return d;
    return c?.ativo === false || c?.is_active === false ? '0000-00-00' : null;
};
export const inicioDoVinculo = (c) => diaDe(c?.data_inicio);

export const nomeCurto = (nome) => String(nome || '').trim().split(/\s+/).slice(0, 2).join(' ');

export const ROTULO_SITUACAO = { atingida: 'Meta atingida', abaixo: 'Abaixo da meta', inativo: 'Inativo' };

// Monta uma linha por colaborador cobrado (ou que vendeu) no período
export const montarGestao = ({ colaboradores = [], vendas = [], planos = [], produtos = [], dosesValidas, metasPorUnidade = {}, faixa, hoje = hojeBrasil(), mesMeta, unidadesPermitidas = null }) => {
    const mesesFaixa = mesesDaFaixa(faixa.inicio, faixa.fim);
    const mesDaMeta = mesMeta && mesesFaixa.includes(mesMeta) ? mesMeta : mesesFaixa[mesesFaixa.length - 1];
    const permitida = (u) => !unidadesPermitidas || unidadesPermitidas.includes(String(u || '').toUpperCase());

    // nome -> colaboradores com esse nome (homônimos: a venda vai para o da mesma unidade, senão o primeiro)
    const porNome = new Map();
    colaboradores.filter(c => permitida(c.unidade)).forEach(c => {
        const k = normalizeString(c.nome);
        if (!k) return;
        if (!porNome.has(k)) porNome.set(k, []);
        porNome.get(k).push(c);
    });
    const dono = (v) => {
        const lista = porNome.get(normalizeString(v.vendedor));
        if (!lista) return null;
        return lista.find(c => String(c.unidade || '').toUpperCase() === String(v.unidade || '').toUpperCase()) || lista[0];
    };

    const linhasPorId = new Map();
    const linhaDe = (c) => {
        const chave = c.id ?? `${c.nome}|${c.unidade}`;
        if (!linhasPorId.has(chave)) linhasPorId.set(chave, { colab: c, itens: [], porMes: {}, totalPeriodo: 0 });
        return linhasPorId.get(chave);
    };

    vendas.forEach(v => {
        const prod = String(v.produto || '').toUpperCase();
        if (getCategoriaItem(prod, planos, produtos) !== 'PRODUTO') return;
        const c = dono(v);
        if (!c) return;
        const dia = safeIsoDate(v.data || v.created_at);
        if (!dia) return;
        const qtd = parseInt(v.quantidade, 10) || 1;
        const valida = dosesValidas ? qtdValidaProduto(v, dosesValidas) : qtd;
        const l = linhaDe(c);
        l.itens.push({ dia, produto: prod, qtd, valida, unidadeVenda: v.unidade });
        const mes = dia.slice(0, 7);
        l.porMes[mes] = (l.porMes[mes] || 0) + valida;
        if (dia >= faixa.inicio && dia <= faixa.fim) l.totalPeriodo += valida;
    });

    // quem é cobrado entra mesmo sem nenhuma venda
    colaboradores.forEach(c => {
        if (!permitida(c.unidade) || !ehSaverOuRecepcao(c)) return;
        const ini = inicioDoVinculo(c), fim = fimDoVinculo(c);
        if (fim && fim < faixa.inicio) return;
        if (ini && ini > faixa.fim) return;
        linhaDe(c);
    });

    const linhas = [];
    linhasPorId.forEach(l => {
        const c = l.colab;
        const ini = inicioDoVinculo(c), fim = fimDoVinculo(c);
        const cobrado = ehSaverOuRecepcao(c);
        // sem vínculo no período e sem venda: fora
        if (!cobrado && l.totalPeriodo === 0) return;
        const unidade = String(c.unidade || '').toUpperCase();
        const meta = metasPorUnidade[unidade] ?? META_PADRAO;
        const meses = mesesFaixa.map(mes => {
            const obrigada = cobrado && (!ini || ini <= ultimoDiaDoMes(mes)) && (!fim || fim >= primeiroDiaDoMes(mes));
            const realizado = l.porMes[mes] || 0;
            const status = !obrigada ? 'inativo' : (realizado >= meta ? 'atingida' : 'abaixo');
            return { mes, realizado, meta, obrigada, status };
        });
        const statusMes = meses.find(m => m.mes === mesDaMeta)?.status || 'inativo';
        // Situação do PERÍODO inteiro (decisão do dono, 18/11/2026): bateu a meta em TODOS os meses em que era cobrada = atingida;
        // faltou em algum mês (inclusive o atual, em andamento) = abaixo; nenhum mês cobrado = inativo.
        const cobradosMeses = meses.filter(m => m.obrigada);
        const geral = cobradosMeses.length === 0 ? 'inativo' : cobradosMeses.every(m => m.status === 'atingida') ? 'atingida' : 'abaixo';
        const ordenadas = [...l.itens].filter(i => i.dia >= faixa.inicio && i.dia <= faixa.fim && i.valida > 0).sort((a, b) => b.dia.localeCompare(a.dia));
        const ultima = ordenadas[0]?.dia || null;
        const efInicio = ini && ini > faixa.inicio ? ini : faixa.inicio;
        const efFim = fim && fim !== '0000-00-00' && fim < faixa.fim ? fim : faixa.fim;
        linhas.push({
            id: c.id ?? `${c.nome}|${c.unidade}`, colab: c, nome: c.nome, unidade, setor: String(c.role || c.setor || c.cargo || ''),
            cobrado, meta, meses, statusMes, geral, metaMes: meses.find(m => m.mes === mesDaMeta),
            totalPeriodo: l.totalPeriodo, itens: l.itens, ultima, diasSemVender: ultima ? diasEntre(ultima, hoje) : null,
            semVendas: l.totalPeriodo === 0,
            inicio: ini, fim: fim === '0000-00-00' ? null : fim, desligadoSemData: fim === '0000-00-00',
            vinculoDias: ini ? diasEntre(ini, hoje) + 1 : null,
            diasPeriodo: Math.max(0, diasEntre(faixa.inicio, faixa.fim) + 1),
            diasEfetivos: Math.max(0, diasEntre(efInicio, efFim) + 1),
            periodoCurto: !!ini && ini > faixa.inicio,
            semDataInicio: !ini,
        });
    });
    return { linhas, mesDaMeta, mesesFaixa };
};

// Filtro de MÊS (18/11/2026): mesFoco = 'AAAA-MM' olha só aquele mês; vazio = período inteiro (todos os meses)
export const situacaoDe = (l, mesFoco) => (mesFoco ? (l.meses.find(m => m.mes === mesFoco)?.status || 'inativo') : l.geral);
export const semVendasDe = (l, mesFoco) => {
    if (!l.cobrado) return false;
    if (!mesFoco) return l.semVendas && l.geral !== 'inativo';
    const m = l.meses.find(x => x.mes === mesFoco);
    return !!m && m.obrigada && m.realizado === 0;
};

export const filtrarLinhas = (linhas, { situacao = 'todos', busca = '', unidade = 'TODOS', mesFoco = '' } = {}) => {
    const q = normalizeString(busca);
    return linhas.filter(l => {
        if (unidade !== 'TODOS' && l.unidade !== String(unidade).toUpperCase()) return false;
        if (q && !normalizeString(l.nome).includes(q)) return false;
        if (situacao === 'vendeu') return l.totalPeriodo > 0;
        if (situacao === 'semvendas') return semVendasDe(l, mesFoco);
        if (situacao === 'atingida') return situacaoDe(l, mesFoco) === 'atingida';
        if (situacao === 'abaixo') return situacaoDe(l, mesFoco) === 'abaixo';
        return true;
    });
};

export const resumir = (linhas, mesFoco = '') => ({
    cobrados: linhas.filter(l => l.cobrado && situacaoDe(l, mesFoco) !== 'inativo').length,
    atingiram: linhas.filter(l => situacaoDe(l, mesFoco) === 'atingida').length,
    abaixo: linhas.filter(l => situacaoDe(l, mesFoco) === 'abaixo').length,
    semVendas: linhas.filter(l => semVendasDe(l, mesFoco)).length,
    total: linhas.reduce((s, l) => s + (mesFoco ? (l.meses.find(m => m.mes === mesFoco)?.realizado || 0) : l.totalPeriodo), 0),
});

export const agruparPorUnidade = (linhas, mesFoco = '') => {
    const mapa = new Map();
    linhas.forEach(l => { if (!mapa.has(l.unidade)) mapa.set(l.unidade, []); mapa.get(l.unidade).push(l); });
    return [...mapa.entries()].map(([unidade, lista]) => ({ unidade, linhas: lista.sort((a, b) => a.nome.localeCompare(b.nome)), resumo: resumir(lista, mesFoco) }))
        .sort((a, b) => (b.resumo.abaixo + b.resumo.semVendas) - (a.resumo.abaixo + a.resumo.semVendas) || a.unidade.localeCompare(b.unidade));
};

// Vendas da pessoa por semana (barras do gráfico); semana fora do vínculo = inativa (cinza)
export const semanasDaPessoa = (linha, faixa) => {
    const semanas = [];
    for (let ini = faixa.inicio; ini <= faixa.fim; ini = somarDias(ini, 7)) {
        const fim = somarDias(ini, 6) > faixa.fim ? faixa.fim : somarDias(ini, 6);
        const qtd = linha.itens.filter(i => i.dia >= ini && i.dia <= fim).reduce((s, i) => s + i.valida, 0);
        const ativa = (!linha.inicio || linha.inicio <= fim) && (!linha.fim || linha.fim >= ini) && !linha.desligadoSemData;
        semanas.push({ ini, fim, rotulo: `${ini.slice(8)}/${ini.slice(5, 7)}`, qtd, ativa });
    }
    return semanas;
};

const mesCurtoPt = (mes) => {
    const n = new Date(`${mes}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    return n.charAt(0).toUpperCase() + n.slice(1);
};

const mesLongoPt = (mes) => new Date(`${mes}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();

// Mensagem de cobrança no WhatsApp: respeita os filtros (unidade, mês, situação); só nome e sobrenome,
// sem CPF, telefone ou comissão. Cada pessoa vem com o(s) mês(es) que faltou e quanto vendeu (ex.: "Set 1/3").
export const mensagemGestao = ({ grupos, situacao, rotuloPeriodo, mesAtual, mesFoco = '' }) => {
    const titulo = { todos: 'RESUMO', atingida: 'META ATINGIDA', abaixo: 'META NÃO ATINGIDA' }[situacao] || 'RESUMO';
    const periodo = mesFoco ? `${rotuloPeriodo}
MÊS ANALISADO: ${mesLongoPt(mesFoco)}` : rotuloPeriodo;
    let txt = `*GESTÃO À VISTA — PRODUTOS*\n_${titulo}_\n${periodo}\n`;
    let total = 0;
    grupos.forEach(g => {
        if (g.linhas.length === 0) return;
        const meta = g.linhas[0].meta;
        txt += `\n*${g.unidade}* (meta: ${meta} produtos por pessoa por mês)\n`;
        g.linhas.forEach(l => {
            total += 1;
            const nome = nomeCurto(l.nome);
            const mesesDaConta = mesFoco ? l.meses.filter(m => m.mes === mesFoco) : l.meses;
            const faltou = mesesDaConta.filter(m => m.obrigada && m.status === 'abaixo')
                .map(m => `${mesCurtoPt(m.mes)} ${m.realizado}/${m.meta}${m.mes === mesAtual ? ' (em andamento)' : ''}`);
            if (semVendasDe(l, mesFoco)) txt += `• ${nome} — sem vendas${mesFoco ? '' : ' no período'}${faltou.length && !mesFoco ? ` · faltou: ${faltou.join(', ')}` : ''}\n`;
            else if (faltou.length) txt += `• ${nome} — faltou: ${faltou.join(', ')}\n`;
            else txt += `• ${nome}\n`;
        });
    });
    txt += `\nTOTAL: ${total} colaborador${total === 1 ? '' : 'es'}`;
    if (situacao === 'abaixo' || situacao === 'todos') txt += '\n\nBora bater essa meta, pessoal! 💪';
    return txt;
};
