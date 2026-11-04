// Feriados NACIONAIS do Brasil (decisão do dono, 04/11/2026: marcar S/D/F no Ritmo do mês).
// Fixos + os que mudam com a Páscoa (Carnaval, Sexta-feira Santa, Corpus Christi). Municipais ficam de fora por enquanto.
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher)
const pascoa = (ano) => {
    const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(ano, mes - 1, dia);
};

const cache = new Map();
// Map 'AAAA-MM-DD' → nome do feriado
export const feriadosDoAno = (ano) => {
    if (cache.has(ano)) return cache.get(ano);
    const mapa = new Map([
        [`${ano}-01-01`, 'Confraternização Universal'],
        [`${ano}-04-21`, 'Tiradentes'],
        [`${ano}-05-01`, 'Dia do Trabalho'],
        [`${ano}-09-07`, 'Independência do Brasil'],
        [`${ano}-10-12`, 'Nossa Senhora Aparecida'],
        [`${ano}-11-02`, 'Finados'],
        [`${ano}-11-15`, 'Proclamação da República'],
        [`${ano}-11-20`, 'Dia da Consciência Negra'],
        [`${ano}-12-25`, 'Natal'],
    ]);
    const p = pascoa(ano);
    const mais = (n) => { const d = new Date(p); d.setDate(d.getDate() + n); return iso(d); };
    mapa.set(mais(-48), 'Carnaval');
    mapa.set(mais(-47), 'Carnaval');
    mapa.set(mais(-2), 'Sexta-feira Santa');
    mapa.set(mais(60), 'Corpus Christi');
    cache.set(ano, mapa);
    return mapa;
};

// Tipo do dia para o gráfico: { letra: 'F'|'S'|'D', nome } ou null (dia útil). Feriado tem prioridade.
export const tipoDoDia = (diaIso) => {
    if (!diaIso) return null;
    const nome = feriadosDoAno(Number(diaIso.slice(0, 4))).get(diaIso);
    if (nome) return { letra: 'F', nome };
    const semana = new Date(`${diaIso}T12:00:00`).getDay();
    if (semana === 6) return { letra: 'S', nome: null };
    if (semana === 0) return { letra: 'D', nome: null };
    return null;
};
