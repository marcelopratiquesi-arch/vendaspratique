// ==========================================
// MOVIMENTAÇÃO DA UNIDADE (decisão do dono, 31/10/2026) — tabela movimento_diario (sql/2026-10-31-movimento-diario/)
// O dono digita o ACUMULADO DO MÊS até um dia (normalmente ONTEM): ex.: no dia 15/11 digita os cancelamentos e o
// faturamento de 01/11 a 14/11; no dia 01/12 digita novembro fechado. Cada linha = { unidade, data = "acumulado até
// este dia", cancelamentos (acumulado), faturamento (acumulado, R$ que entrou — NÃO é comissão) }.
// O valor de CADA DIA sai da diferença para o lançamento anterior do MESMO mês (o 1º do mês = o próprio valor).
// Se pulou dias, a diferença cobre todos os dias desde o lançamento anterior (aparece "X dias").
// ENTRADAS não ficam gravadas: = planos BASE vendidos (contarPlanosDoCard; PRATIQUE NUTRI é adicional e não entra).
// Quem grava: Líder, Mentor e Admin (o banco garante). Recepção só vê.
// ==========================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient.js';
import { contarPlanosDoCard, safeIsoDate } from './utils.js';

export const PAPEIS_QUE_GRAVAM_MOVIMENTO = ['ADMIN', 'MENTOR', 'LIDER'];
export const podeGravarMovimento = (usuario) => PAPEIS_QUE_GRAVAM_MOVIMENTO.includes(String(usuario?.roleReal || usuario?.role || '').toUpperCase());

const tabelaNaoExiste = (erro) => /movimento_diario.*(does not exist|not find)|PGRST205|42P01/i.test(`${erro?.code || ''} ${erro?.message || ''}`);
const paraIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const hojeIso = () => paraIso(new Date());
export const ontemIso = () => { const d = new Date(); d.setDate(d.getDate() - 1); return paraIso(d); };
const diasEntre = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);

// Número digitado com ponto e/ou vírgula: "1.234,56" · "1234,56" · "1234.56" · "250.000" (milhar) → número. Vazio → null.
export const lerNumeroBR = (texto) => {
    let t = String(texto ?? '').trim().replace(/\s|R\$/g, '');
    if (!t) return null;
    if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ''); // só pontos de milhar
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
};
// Número → texto para o campo (padrão brasileiro: 168.160,05; lerNumeroBR lê de volta)
export const numeroParaCampo = (n, casas = 2) => (n === null || n === undefined || n === '' ? '' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }));

// Entradas (planos base) por dia: Map 'AAAA-MM-DD' → quantidade
export const entradasPorDia = (vendas = [], planos = [], produtos = []) => {
    const mapa = new Map();
    contarPlanosDoCard(vendas, planos, produtos).contados.forEach(({ venda, qtd }) => {
        const dia = safeIsoDate(venda.data || venda.created_at);
        if (dia) mapa.set(dia, (mapa.get(dia) || 0) + qtd);
    });
    return mapa;
};
// Entradas acumuladas do mês até um dia (do dia 1º até o dia, incluído)
export const entradasAcumuladasAte = (mapaEntradas, dia) => {
    if (!dia) return 0;
    const inicioMes = `${dia.slice(0, 8)}01`;
    let soma = 0;
    mapaEntradas.forEach((qtd, d) => { if (d >= inicioMes && d <= dia) soma += qtd; });
    return soma;
};

// Acumulados → valor de cada dia (por unidade e por mês). Devolve as linhas com *_Dia e diasCobertos.
export const derivarMovimento = (linhas = []) => {
    const porUnidadeMes = new Map();
    linhas.forEach(l => {
        const chave = `${String(l.unidade).toUpperCase()}|${String(l.data).slice(0, 7)}`;
        if (!porUnidadeMes.has(chave)) porUnidadeMes.set(chave, []);
        porUnidadeMes.get(chave).push(l);
    });
    const saida = [];
    porUnidadeMes.forEach(lista => {
        lista.sort((a, b) => String(a.data).localeCompare(String(b.data)));
        let anterior = null;
        lista.forEach(l => {
            const cancAcum = l.cancelamentos === null || l.cancelamentos === undefined ? null : Number(l.cancelamentos);
            const fatAcum = l.faturamento === null || l.faturamento === undefined ? null : Number(l.faturamento);
            const base = (campo) => (anterior && anterior[campo] !== null ? anterior[campo] : 0);
            saida.push({
                ...l,
                cancelamentosAcum: cancAcum,
                faturamentoAcum: fatAcum,
                cancelamentosDia: cancAcum === null ? null : cancAcum - base('cancelamentosAcum'),
                faturamentoDia: fatAcum === null ? null : fatAcum - base('faturamentoAcum'),
                diasCobertos: anterior ? diasEntre(anterior.data, l.data) : Number(String(l.data).slice(8, 10)),
            });
            anterior = { data: l.data, cancelamentosAcum: cancAcum ?? (anterior ? anterior.cancelamentosAcum : null), faturamentoAcum: fatAcum ?? (anterior ? anterior.faturamentoAcum : null) };
        });
    });
    return saida.sort((a, b) => String(a.data).localeCompare(String(b.data)));
};

// Soma dos valores DO DIA dentro do período (faixa com fim incluído; sem faixa = tudo)
export const somarMovimentoNoPeriodo = (derivados = [], faixa = null) => derivados.reduce((acc, l) => {
    if (faixa?.inicio && l.data < faixa.inicio) return acc;
    if (faixa?.fim && l.data > faixa.fim) return acc;
    if (l.faturamentoDia !== null) { acc.faturamento += l.faturamentoDia; acc.lancamentos += 1; }
    if (l.cancelamentosDia !== null) acc.cancelamentos += l.cancelamentosDia;
    return acc;
}, { faturamento: 0, cancelamentos: 0, lancamentos: 0 });

// Lê os lançamentos do período. Busca desde o dia 1º do mês do início, para calcular a diferença do 1º dia do período.
export const useMovimentoDiario = ({ unidade, faixa }) => {
    const [linhas, setLinhas] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const [semTabela, setSemTabela] = useState(false);
    const [versao, setVersao] = useState(0);
    const recarregar = useCallback(() => setVersao(v => v + 1), []);
    const unidadeFixa = unidade && unidade !== 'TODOS' ? String(unidade).toUpperCase() : null;
    const inicio = faixa?.inicio ? `${faixa.inicio.slice(0, 8)}01` : null;
    const fim = faixa?.fim || null;

    useEffect(() => {
        let ativo = true;
        setCarregando(true);
        (async () => {
            let q = supabase.from('movimento_diario').select('unidade, data, faturamento, cancelamentos, atualizado_por, atualizado_em').order('data', { ascending: true });
            if (unidadeFixa) q = q.eq('unidade', unidadeFixa);
            if (inicio) q = q.gte('data', inicio);
            if (fim) q = q.lte('data', fim);
            const { data, error } = await q;
            if (!ativo) return;
            if (error) {
                if (tabelaNaoExiste(error)) setSemTabela(true);
                else console.error('Movimentação: erro ao ler', error);
                setLinhas([]);
            } else {
                setSemTabela(false);
                setLinhas(data || []);
            }
            setCarregando(false);
        })();
        return () => { ativo = false; };
    }, [unidadeFixa, inicio, fim, versao]);

    // Atualiza sozinho quando alguém grava (tempo real)
    useEffect(() => {
        const canal = supabase.channel(`movimento-diario-${unidadeFixa || 'todas'}-${Math.random().toString(36).slice(2, 8)}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'movimento_diario' }, () => recarregar())
            .subscribe();
        return () => { supabase.removeChannel(canal); };
    }, [unidadeFixa, recarregar]);

    const derivados = useMemo(() => derivarMovimento(linhas), [linhas]);
    return { linhas, derivados, carregando, semTabela, recarregar };
};

// Grava (cria ou atualiza) o acumulado do mês até um dia. Devolve o erro (ou null).
export const salvarMovimentoDia = async ({ unidade, data, faturamento, cancelamentos, usuario }) => {
    const payload = {
        unidade: String(unidade || '').toUpperCase(),
        data,
        faturamento: faturamento === null || Number.isNaN(faturamento) ? null : faturamento,
        cancelamentos: cancelamentos === null || Number.isNaN(cancelamentos) ? null : cancelamentos,
        atualizado_por: usuario?.nome || null,
        atualizado_em: new Date().toISOString(),
    };
    const { error } = await supabase.from('movimento_diario').upsert(payload, { onConflict: 'unidade,data' });
    return error || null;
};
