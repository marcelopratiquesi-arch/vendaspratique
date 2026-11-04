// Mensagem "Resumo" do WhatsApp Rede (Ranking global) — decisão do dono, 04/11/2026:
// Nutri e Produtos de cada unidade contra a META START dela, SEMPRE no mês atual até hoje (não segue o filtro do topo).
// ✅ bateu · ❌ não bateu · 🔴 sem meta cadastrada. Sem "faltam X".
// Contagem igual à aba Metas: Nutri = todo adicional Nutri (contarPlanosDoCard); Produtos = com o limite de doses únicas (regra 15).
import { contarPlanosDoCard, getCategoriaItem, safeIsoDate } from '../utils.js';
import { aplicarLimiteDoses, qtdValidaProduto } from '../limiteDoses.js';

const numero = (n) => Number(n || 0).toLocaleString('pt-BR');

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

    // Bateu primeiro (maior % primeiro), depois quem não bateu (mais perto primeiro), "sem meta" no fim
    const bloco = (campo, campoMeta) => [...linhas]
        .sort((a, b) => {
            const ra = a[campoMeta] ? a[campo] / a[campoMeta] : -1;
            const rb = b[campoMeta] ? b[campo] / b[campoMeta] : -1;
            return rb - ra || b[campo] - a[campo];
        })
        .map(l => (l[campoMeta] > 0
            ? `${l[campo] >= l[campoMeta] ? '✅' : '❌'} ${l.u} — ${numero(l[campo])}/${numero(l[campoMeta])}`
            : `🔴 ${l.u} — ${numero(l[campo])} (sem meta)`))
        .join('\n');

    const nomeMes = hoje.toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();
    const dia = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    let txt = `🏆 *METAS DA REDE – ${nomeMes} (até ${dia})*\n\n`;
    txt += `🥗 *NUTRI*\n${bloco('nutri', 'metaNutri') || '—'}\n\n`;
    txt += `📦 *PRODUTOS*\n${bloco('prod', 'metaProd') || '—'}`;
    if (linhas.some(l => !l.metaNutri || !l.metaProd)) txt += `\n\n🔴 *Sem meta:* cadastrem a Meta Start na aba Metas.`;
    return txt;
};
