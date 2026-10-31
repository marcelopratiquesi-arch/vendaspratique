// Doses válidas para meta/ranking (limiteDoses.js) com TODAS as vendas da unidade no mês, sem filtro de tela
// (decisão do dono: doses fora da tela continuam ocupando as 10 vagas da unidade).
// Usa as vendas que o App já carregou (90 dias) e busca no banco, SÓ LEITURA, os meses mais antigos que isso.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient.js';
import { safeIsoDate } from './utils.js';
import { aplicarLimiteDoses, INICIO_LIMITE_DOSES } from './limiteDoses.js';

const TAMANHO_PAGINA = 1000;
const DIAS_CARREGADOS_PELO_APP = 88;
const paraIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const useDosesValidas = ({ vendasCarregadas = [], vendasDaTela = [], unidade, planos = [], produtos = [] }) => {
    // Meses (a partir do início da regra) que a tela mostra e que o App não tem inteiros
    const mesesParaBuscar = useMemo(() => {
        const d = new Date(); d.setDate(d.getDate() - DIAS_CARREGADOS_PELO_APP);
        const limite = paraIso(d);
        const meses = new Set();
        vendasDaTela.forEach(v => {
            const dia = safeIsoDate(v.data || v.created_at);
            if (dia >= INICIO_LIMITE_DOSES && `${dia.slice(0, 7)}-01` < limite) meses.add(dia.slice(0, 7));
        });
        return [...meses].sort();
    }, [vendasDaTela]);
    const chaveMeses = mesesParaBuscar.join(',');
    const unidadeFixa = unidade && unidade !== 'TODOS' ? unidade : null;

    const [doBanco, setDoBanco] = useState([]);
    useEffect(() => {
        if (!chaveMeses) { setDoBanco([]); return undefined; }
        let ativo = true;
        (async () => {
            let todas = [];
            for (const mes of chaveMeses.split(',')) {
                const [a, m] = mes.split('-').map(Number);
                const fim = paraIso(new Date(a, m, 0));
                for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
                    let q = supabase.from('vendas').select('id, unidade, data, created_at, produto, quantidade, vendedor')
                        .gte('data', `${mes}-01`).lte('data', fim)
                        .order('id', { ascending: true }).range(inicio, inicio + TAMANHO_PAGINA - 1);
                    if (unidadeFixa) q = q.eq('unidade', unidadeFixa);
                    const { data, error } = await q;
                    if (error) { console.error('Limite de doses: erro ao buscar mês antigo', error); break; }
                    todas = todas.concat(data || []);
                    if (!data || data.length < TAMANHO_PAGINA) break;
                }
            }
            if (ativo) setDoBanco(todas);
        })();
        return () => { ativo = false; };
    }, [chaveMeses, unidadeFixa]);

    return useMemo(() => {
        // Junta sem repetir (a tela vale mais, por estar atualizada em tempo real)
        const porId = new Map();
        doBanco.forEach(v => porId.set(v.id, v));
        vendasCarregadas.forEach(v => porId.set(v.id ?? v, v));
        return aplicarLimiteDoses([...porId.values()], planos, produtos);
    }, [doBanco, vendasCarregadas, planos, produtos]);
};
