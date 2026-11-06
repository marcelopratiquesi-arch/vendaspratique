// Mensagem "Resumo" do WhatsApp Rede (Ranking global) — decisão do dono, 04/11/2026:
// Nutri e Produtos de cada unidade contra a META START dela, SEMPRE no mês atual até hoje (não segue o filtro do topo).
// Sem "faltam X". Contagem igual à aba Metas: Nutri = todo adicional Nutri (contarPlanosDoCard);
// Produtos = com o limite de doses únicas (regra 15).
// Ajuste do dono (06/11/2026): a meta vai no título do bloco ("🥗 *NUTRI* — meta 30"), cada linha mostra só a
// quantidade (sem "/30" e sem porcentagem) e a bolinha muda de cor pelo quanto já fez da meta:
// 🔴 até 49% · 🟠 50% a 74% · 🟡 75% a 99% · ✅ bateu. Unidade com meta diferente da maioria ganha "· meta X" na linha.
// 🔴 "(sem meta)" para quem não cadastrou a Meta Start.
import { contarPlanosDoCard, getCategoriaItem, safeIsoDate } from '../utils.js';
import { aplicarLimiteDoses, qtdValidaProduto } from '../limiteDoses.js';

const numero = (n) => Number(n || 0).toLocaleString('pt-BR');

// Faixas de cor pela parte da meta já feita
const FAIXA_LARANJA = 0.5;
const FAIXA_AMARELA = 0.75;
const sinal = (feito, meta) => {
    const r = feito / meta;
    if (r >= 1) return '✅';
    if (r >= FAIXA_AMARELA) return '🟡';
    if (r >= FAIXA_LARANJA) return '🟠';
    return '🔴';
};

// Meta que a maioria das unidades usa (empate: a maior)
const metaDaMaioria = (valores) => {
    const conta = new Map();
    valores.filter(v => v > 0).forEach(v => conta.set(v, (conta.get(v) || 0) + 1));
    let melhor = 0; let vezes = 0;
    conta.forEach((q, v) => { if (q > vezes || (q === vezes && v > melhor)) { melhor = v; vezes = q; } });
    return melhor;
};

export const montarMensagemMetasRede = ({ vendas = [], metas = {}, planos = [], produtos = [], hoje = new Date() }) => {
    const mes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const vendasMes = vendas.filter(v => safeIsoDate(v.data || v.created_at).slice(0, 7) === mes);
    const doses = aplicarLimiteDoses(vendasMes, planos, produtos);
    const unidades = [...new Set(vendas.map(v => String(v.unidade || '').toUpperCase()).filter(Boolean))].sort();

    const linhas = unidades.map(u => {
        const daUnidade = vendasMes.filter(v => String(v.unidade || '').toUpperCase() === u);
        const nutri = contarPlanosDoCard(daUnidade, planos, produtos).nutri.total;
        let prod = 0;
        daUnidade.forEach(v => { if (getCategoriaItem(v.produto, planos, produtos) === 'PRODUTO') prod += qtdValidaProduto(v, doses); });
        const m = metas[u] || {};
        return { u, nutri, prod, metaNutri: Number(m.meta_nutri) || 0, metaProd: Number(m.meta_produtos) || 0 };
    });

    // Quem fez a maior parte da meta primeiro; "sem meta" no fim
    const bloco = (titulo, campo, campoMeta) => {
        const metaComum = metaDaMaioria(linhas.map(l => l[campoMeta]));
        const corpo = [...linhas]
            .sort((a, b) => {
                const ra = a[campoMeta] ? a[campo] / a[campoMeta] : -1;
                const rb = b[campoMeta] ? b[campo] / b[campoMeta] : -1;
                return rb - ra || b[campo] - a[campo];
            })
            .map(l => {
                if (!(l[campoMeta] > 0)) return `🔴 ${l.u} — ${numero(l[campo])} (sem meta)`;
                const outraMeta = l[campoMeta] !== metaComum ? ` · meta ${numero(l[campoMeta])}` : '';
                return `${sinal(l[campo], l[campoMeta])} ${l.u} — ${numero(l[campo])}${outraMeta}`;
            })
            .join('\n');
        return `${titulo}${metaComum > 0 ? ` — meta ${numero(metaComum)}` : ''}\n${corpo || '—'}`;
    };

    const nomeMes = hoje.toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();
    const dia = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    let txt = `🏆 *METAS DA REDE – ${nomeMes} (até ${dia})*\n\n`;
    txt += `${bloco('🥗 *NUTRI*', 'nutri', 'metaNutri')}\n\n`;
    txt += bloco('📦 *PRODUTOS*', 'prod', 'metaProd');
    if (linhas.some(l => !l.metaNutri || !l.metaProd)) txt += `\n\n🔴 *Sem meta:* cadastrem a Meta Start na aba Metas.`;
    return txt;
};
