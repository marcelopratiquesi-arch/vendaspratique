// ==========================================
// COMPARATIVO COM O MÊS ANTERIOR (Dashboard, decisão do dono 30/10/2026)
// "Mesmas datas no mês anterior": 01 a 30/10 → 01 a 30/09. Se a data não existe no mês anterior
// (ex.: 31/03 → fevereiro), usa o último dia dele. Período que ainda não acabou é cortado em hoje.
// Também guarda a contagem de planos do card "Planos vendidos" (repetido no mesmo dia não conta),
// usada pelo card, pela lista do card e pelo comparativo: assim os números sempre batem.
// ==========================================
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient.js';
import { getCategoriaItem, criarGruposPlanosVazio, decomporPlano, safeIsoDate } from './utils.js';

const TAMANHO_PAGINA = 1000;
// O App carrega 90 dias de vendas; o que começa antes disso é buscado no banco (só leitura)
const DIAS_CARREGADOS_PELO_APP = 88;

export const paraIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Mesma data no mês anterior; sem esse dia lá, o último dia do mês anterior
export const mesmaDataMesAnterior = (iso) => {
    const [a, m, d] = iso.split('-').map(Number);
    const ultimoDiaAnterior = new Date(a, m - 1, 0).getDate();
    return paraIso(new Date(a, m - 2, Math.min(d, ultimoDiaAnterior)));
};

// faixa = { inicio, fim } (AAAA-MM-DD, fim incluído). Devolve a faixa equivalente do mês anterior, ou null.
export const faixaMesAnterior = (faixa, hojeIso = paraIso(new Date())) => {
    if (!faixa?.inicio || !faixa?.fim || faixa.inicio > hojeIso) return null;
    const fim = faixa.fim > hojeIso ? hojeIso : faixa.fim;
    return { inicio: mesmaDataMesAnterior(faixa.inicio), fim: mesmaDataMesAnterior(fim) };
};

// Planos vendidos com a regra do card: mesma matrícula + mesmo plano + mesmo dia conta 1 vez só.
// NUTRI É ADICIONAL (decisão do dono, 30/10/2026): cada lançamento é decomposto por decomporPlano em
// plano BASE (Plus/Fit/Personal/Outros, conta como entrada) e/ou ADICIONAL NUTRI (não conta como entrada).
// Devolve:
// - total / contados / grupos[PLUS|FIT|PERSONAL CLASS|OUTROS PLANOS]: só planos BASE (o número do card)
// - nutri = { total, contados } e grupos.NUTRI: os adicionais Nutri (combos + PRATIQUE NUTRI)
// Em grupos[...].detalhes fica a quantidade por nome de plano (o mesmo combo aparece no grupo base e no NUTRI).
export const contarPlanosDoCard = (lista, planos, produtos) => {
    const grupos = criarGruposPlanosVazio();
    const contados = [];
    const contadosNutri = [];
    const vistos = new Set();
    let total = 0;
    let totalNutri = 0;
    const somarNoGrupo = (grupo, prodUpper, qtd) => {
        grupos[grupo].total += qtd;
        grupos[grupo].detalhes[prodUpper] = (grupos[grupo].detalhes[prodUpper] || 0) + qtd;
    };
    lista.forEach(v => {
        const prodUpper = (v.produto || '').toUpperCase();
        if (getCategoriaItem(prodUpper, planos, produtos) !== 'PLANO') return;
        let qtd = parseInt(v.quantidade) || 1;
        const matricula = String(v.matricula ?? '').trim();
        if (matricula) {
            const chave = `${matricula}-${prodUpper}-${safeIsoDate(v.data || v.created_at)}`;
            if (vistos.has(chave)) qtd = 0;
            else vistos.add(chave);
        }
        if (qtd === 0) return;
        const { base, nutri } = decomporPlano(prodUpper);
        if (base) {
            total += qtd;
            somarNoGrupo(base, prodUpper, qtd);
            contados.push({ venda: v, qtd, base, nutri });
        }
        if (nutri) {
            totalNutri += qtd;
            somarNoGrupo('NUTRI', prodUpper, qtd);
            contadosNutri.push({ venda: v, qtd, base, nutri });
        }
    });
    return { grupos, contados, total, nutri: { total: totalNutri, contados: contadosNutri } };
};

// Vendas da faixa anterior: do que o App já carregou, ou do banco quando é mais antiga que isso
export const useVendasDaFaixa = (faixa, vendasCarregadas, unidade) => {
    const limite = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - DIAS_CARREGADOS_PELO_APP); return paraIso(d); }, []);
    const precisaBuscar = !!faixa && faixa.inicio < limite;
    const [doBanco, setDoBanco] = useState(null);
    const [erro, setErro] = useState(false);
    const unidadeFixa = unidade && unidade !== 'TODOS' ? unidade : null;

    useEffect(() => {
        if (!precisaBuscar) { setDoBanco(null); return; }
        let ativo = true;
        setDoBanco(null);
        setErro(false);
        (async () => {
            let todas = [];
            for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
                let q = supabase.from('vendas').select('id, unidade, data, created_at, produto, quantidade, valor, comissao, vendedor, matricula')
                    .gte('data', faixa.inicio).lte('data', faixa.fim)
                    .order('id', { ascending: true }).range(inicio, inicio + TAMANHO_PAGINA - 1);
                if (unidadeFixa) q = q.eq('unidade', unidadeFixa);
                const { data, error } = await q;
                if (error) { console.error('Dashboard: erro ao buscar o mês anterior', error); if (ativo) setErro(true); break; }
                todas = todas.concat(data || []);
                if (!data || data.length < TAMANHO_PAGINA) break;
            }
            if (ativo) setDoBanco(todas);
        })();
        return () => { ativo = false; };
    }, [precisaBuscar, faixa?.inicio, faixa?.fim, unidadeFixa]);

    const vendas = useMemo(() => {
        if (!faixa) return [];
        const fonte = precisaBuscar ? (doBanco || []) : vendasCarregadas;
        return fonte.filter(v => {
            const dia = safeIsoDate(v.data || v.created_at);
            return dia >= faixa.inicio && dia <= faixa.fim;
        });
    }, [faixa, precisaBuscar, doBanco, vendasCarregadas]);

    return { vendas, carregando: precisaBuscar && doBanco === null && !erro, erro };
};
