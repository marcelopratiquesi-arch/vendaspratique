import { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient.js';
import { faixaMesAnterior } from '../../AnaliseVendas/comparativoMesAnterior.js';
import { paraIsoLocal, ACOES_DE_CONTATO } from './contasPanorama.js';

// ==========================================
// PANORAMA DA UNIDADE — leitura dos dados (só leitura; 09/11/2026)
// Busca SÓ quando a aba Panorama é aberta, SÓ da unidade aberta e SÓ do período escolhido (mais o mês atual,
// por causa das metas e do limite de doses, e as mesmas datas do mês anterior para o ▲▼ dos planos).
// Cada parte é lida separada: se uma falhar, as outras aparecem e a parte que falhou avisa.
// ==========================================

const TAMANHO_PAGINA = 1000;
const LIMITE_LINHAS = 30000;

const paginado = async (montar) => {
    let todas = [];
    for (let de = 0; de < LIMITE_LINHAS; de += TAMANHO_PAGINA) {
        const { data, error } = await montar().range(de, de + TAMANHO_PAGINA - 1);
        if (error) throw error;
        todas = todas.concat(data || []);
        if (!data || data.length < TAMANHO_PAGINA) break;
    }
    return todas;
};
const menor = (a, b) => (!a ? a : !b ? b : a < b ? a : b); // null = sem limite
const maior = (a, b) => (!a ? a : !b ? b : a > b ? a : b);
const somarDias = (iso, dias) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + dias); return paraIsoLocal(d); };
const primeiroDoMes = (iso) => `${iso.slice(0, 8)}01`;
const mesAnterior = (iso) => { const d = new Date(`${primeiroDoMes(iso)}T12:00:00`); d.setMonth(d.getMonth() - 1); return paraIsoLocal(d); };

const vendasEntre = (unidade, inicio, fim) => paginado(() => {
    let q = supabase.from('vendas').select('*').eq('unidade', unidade).order('id', { ascending: true });
    if (inicio) q = q.gte('data', inicio);
    if (fim) q = q.lte('data', fim);
    return q;
});

const lerMovimento = async (unidade, inicio, fim) => {
    const consultar = (campos) => {
        let q = supabase.from('movimento_diario').select(campos).eq('unidade', unidade).order('data', { ascending: true });
        if (inicio) q = q.gte('data', inicio);
        if (fim) q = q.lte('data', fim);
        return q;
    };
    let { data, error } = await consultar('unidade, data, faturamento, cancelamentos, ativos');
    if (error && /ativos/i.test(error.message || '')) ({ data, error } = await consultar('unidade, data, faturamento, cancelamentos'));
    if (error) throw error;
    return data || [];
};

const contar = async (montar) => {
    const { count, error } = await montar();
    if (error) throw error;
    return count || 0;
};

export const usePanoramaUnidade = ({ unidade, faixa, recepcionistas = [], ativo = true, versao = 0 }) => {
    const [dados, setDados] = useState(null);
    const [carregando, setCarregando] = useState(false);
    const nomes = recepcionistas.map(r => r.nome).filter(Boolean);
    const chaveNomes = nomes.join('|');
    // Período em texto (AAAA-MM-DD, fim incluído): o efeito só roda de novo quando a data muda de verdade
    const fxInicio = faixa?.inicio || null;
    const fxFim = faixa?.fim || null;

    useEffect(() => {
        if (!ativo || !unidade) return undefined;
        let vivo = true;
        setCarregando(true);
        const faixa = { inicio: fxInicio, fim: fxFim };
        (async () => {
            const agora = new Date();
            const hoje = paraIsoLocal(agora);
            const inicioMes = primeiroDoMes(hoje);
            const erros = [];
            const tentar = async (parte, fn, padrao) => {
                try { return await fn(); } catch (e) { console.warn(`Panorama: não deu para ler ${parte}`, e?.message || e); erros.push(parte); return padrao; }
            };
            const listaNomes = chaveNomes ? chaveNomes.split('|') : [];
            const anterior = faixaMesAnterior(faixa?.inicio && faixa?.fim ? faixa : null, hoje);
            // Histórico do CRM: o período e também hoje (a meta do dia é sempre de hoje)
            const crmDe = menor(faixa?.inicio, hoje);
            const crmAte = maior(faixa?.fim, hoje);

            const [vendas, vendasAnterior, movimento, metas, avaliacoes, historico, feitosHoje, carteira, bancoBruto, visitantes] = await Promise.all([
                // Vendas do período + o mês atual inteiro (metas e limite de doses)
                tentar('as vendas', () => vendasEntre(unidade, menor(faixa?.inicio, inicioMes), maior(faixa?.fim, hoje)), []),
                anterior ? tentar('as vendas do mês anterior', () => vendasEntre(unidade, anterior.inicio, anterior.fim), null) : Promise.resolve(null),
                // Movimentação: desde o 1º dia do mês anterior ao início (o valor do dia é a diferença dos acumulados)
                tentar('a movimentação', () => lerMovimento(unidade, faixa?.inicio ? mesAnterior(faixa.inicio) : null, faixa?.fim || null), null),
                tentar('as metas', async () => {
                    const { data, error } = await supabase.from('metas_unidades').select('*').eq('unidade', unidade)
                        .eq('mes', String(agora.getMonth() + 1).padStart(2, '0')).eq('ano', String(agora.getFullYear())).limit(1);
                    if (error) throw error;
                    return data?.[0] || null;
                }, undefined),
                tentar('as avaliações', () => paginado(() => {
                    let q = supabase.from('avaliacoes_realizadas').select('id, data, created_at, professor, mme, pgc, respostas_dinamicas').eq('unidade', unidade).order('id', { ascending: true });
                    if (faixa?.inicio) q = q.gte('data', faixa.inicio);
                    if (faixa?.fim) q = q.lte('data', faixa.fim);
                    return q;
                }), null),
                listaNomes.length ? tentar('o CRM', () => paginado(() => {
                    let q = supabase.from('historico_leads').select('id, lead_id, consultor, tipo_acao, observacao, data_registro')
                        .in('consultor', listaNomes).in('tipo_acao', ACOES_DE_CONTATO).order('data_registro', { ascending: false });
                    if (crmDe) q = q.gte('data_registro', new Date(`${crmDe}T00:00:00`).toISOString());
                    if (crmAte) q = q.lt('data_registro', new Date(`${somarDias(crmAte, 1)}T00:00:00`).toISOString());
                    return q;
                }), null) : Promise.resolve([]),
                tentar('os contatos de hoje', async () => {
                    const { data, error } = await supabase.from('crm_contatos_feitos').select('id, lead_id, aluno_id, consultor, criado_em')
                        .gte('criado_em', new Date(`${hoje}T00:00:00`).toISOString()).limit(5000);
                    if (error) throw error;
                    return (data || []).filter(f => listaNomes.some(n => String(n).trim().toUpperCase() === String(f.consultor || '').trim().toUpperCase()));
                }, []),
                tentar('a carteira do CRM', () => contar(() => supabase.from('leads').select('id', { count: 'exact', head: true })
                    .eq('unidade', unidade).in('status', ['Novo', 'Em Contato']).not('puxado_por', 'is', null)), null),
                tentar('o Banco Bruto', () => contar(() => supabase.from('leads').select('id', { count: 'exact', head: true })
                    .eq('unidade', unidade).eq('status', 'Novo').is('puxado_por', null)), null),
                tentar('os visitantes', () => contar(() => {
                    let q = supabase.from('leads').select('id', { count: 'exact', head: true }).eq('unidade', unidade).eq('origem', 'RECEPCAO');
                    if (faixa?.inicio) q = q.gte('created_at', new Date(`${faixa.inicio}T00:00:00`).toISOString());
                    if (faixa?.fim) q = q.lt('created_at', new Date(`${somarDias(faixa.fim, 1)}T00:00:00`).toISOString());
                    return q;
                }), null),
            ]);
            if (!vivo) return;
            setDados({ vendas, vendasAnterior, faixaAnterior: anterior, movimento, metas, avaliacoes, historico, feitosHoje, carteira, bancoBruto, visitantes, erros, hoje, lidoEm: new Date() });
            setCarregando(false);
        })();
        return () => { vivo = false; };
    }, [unidade, fxInicio, fxFim, chaveNomes, ativo, versao]);

    return { dados, carregando };
};
