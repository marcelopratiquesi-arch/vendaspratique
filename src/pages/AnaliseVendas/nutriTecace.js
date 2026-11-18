// ==========================================
// NUTRI / TECACE (decisão do dono, 17/11/2026) — a regra única do Nutri "consolidado".
// O Líder digita (Metas → Movimentação) o TOTAL de planos Nutri do MÊS que aparece no Tecace (campo movimento_diario.nutri_tecace).
// O sistema calcula sozinho:   adicional = máx(0, Tecace − vendas Nutri do sistema)    total = vendas + adicional.
//   - Tecace vazio            → só as vendas do sistema (sem renovação inventada).
//   - Tecace menor que vendas → adicional 0, vendas preservadas e sinal de "divergência" para conferir.
// O adicional NUNCA vira venda, comissão, ranking de vendedor nem faturamento: é só para metas e indicadores da unidade.
// Vale só quando o período é um MÊS (o Tecace é um total do mês); em "Hoje", "7 dias" etc. fica só o interno.
// O valor vigente do mês = o ÚLTIMO lançamento do mês (nunca soma os dias).
// ==========================================
// A cobrança do Nutri/Tecace começa neste dia (decisão do dono: a partir de amanhã da publicação, 18/11/2026)
export const INICIO_COBRANCA_NUTRI = '2026-11-18';

const chaveU = (u) => String(u || '').trim().toUpperCase();
const numeroOuNull = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

// vendas internas + total do Tecace → { internas, tecace, adicional, total, divergencia }
export const consolidarNutri = (internas, tecace) => {
    const interno = Number(internas) || 0;
    const t = numeroOuNull(tecace);
    if (t === null) return { internas: interno, tecace: null, adicional: 0, total: interno, divergencia: false };
    return { internas: interno, tecace: t, adicional: Math.max(0, t - interno), total: interno + Math.max(0, t - interno), divergencia: t < interno };
};

// Linhas de movimento_diario → Map UNIDADE → total vigente do mês (último lançamento não vazio, até `ate`)
export const tecaceVigentePorUnidade = (linhas = [], ate = null) => {
    const ultimo = new Map();
    [...linhas].sort((a, b) => String(a.data).localeCompare(String(b.data))).forEach(l => {
        const v = numeroOuNull(l.nutri_tecace);
        const dia = String(l.data).slice(0, 10);
        if (v === null || (ate && dia > ate)) return;
        ultimo.set(chaveU(l.unidade), v);
    });
    return ultimo;
};

// Mapa (ou null = sem Tecace neste período) + unidade + vendas Nutri internas → consolidado
export const nutriDaUnidade = (mapaTecace, unidade, internas) => consolidarNutri(internas, mapaTecace ? mapaTecace.get(chaveU(unidade)) : null);

// Vigente por unidade para VÁRIOS meses de uma vez: Map 'AAAA-MM|UNIDADE' → total do mês (usado nas "metas anteriores")
export const tecaceVigentePorMes = (linhas = []) => {
    const ordenadas = [...linhas].sort((a, b) => String(a.data).localeCompare(String(b.data)));
    const mapa = new Map();
    ordenadas.forEach(l => {
        const v = numeroOuNull(l.nutri_tecace);
        if (v !== null) mapa.set(`${String(l.data).slice(0, 7)}|${chaveU(l.unidade)}`, v);
    });
    return mapa;
};
