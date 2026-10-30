// src/pages/AnaliseVendas/SaudeUnidadeTab.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, AreaChart, Area, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { supabase } from '../../supabaseClient.js';
import { grupoDoPlano, normalizeString } from './utils.js';
import {
    TrendingUp, TrendingDown, Minus, AlertTriangle, Loader2, HelpCircle, ArrowUpDown, ArrowDown, ArrowUp,
    HeartPulse, Info, CircleSlash, Sparkles, Users, ChevronDown
} from 'lucide-react';
import { tx, localeAtual } from '../../i18n/traduzir.js';

// ==========================================
// SAÚDE DA UNIDADE (decisão do dono, 29/10/2026)
// O que está vendendo, o que está caindo e o que parou, comparando o período do filtro com o período
// anterior do mesmo tamanho. Medida principal = QUANTIDADE vendida; a comissão aparece como informação extra
// (regra 5: nunca chamar de faturamento). Obedece a todos os filtros do topo (período, unidade e itens escondidos).
// O período anterior pode ser mais antigo que os 90 dias que o App carrega: busca no banco (só leitura).
// ==========================================

const TAMANHO_PAGINA = 1000;
// Paleta validada (scripts/validate_palette.js do método de gráficos): claro e escuro
const CORES = {
    claro: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'],
    escuro: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'],
};
const COR_OUTROS = { claro: '#94a3b8', escuro: '#64748b' };
const COR_ANTERIOR = { claro: '#64748b', escuro: '#94a3b8' };

// Para o "O que olhar agora" não virar barulho com números pequenos
const MINIMO_PARA_ALERTA = 3;
const QUEDA_RELEVANTE = 0.3;
const SUBIDA_RELEVANTE = 0.3;

// Setor (equipe) de um colaborador no cadastro da Equipe (gravado em "role", como em CadastroGeral/TabEquipe.jsx)
const setorDe = (c) => String(c.role || c.setor || c.cargo || '').trim().toUpperCase();

const CATEGORIAS = [
    ['PLANO', 'Planos'],
    ['PRODUTO', 'Produtos'],
    ['SERVICO', 'Serviços'],
];

// ---------- datas (sempre no horário local, AAAA-MM-DD) ----------
const paraData = (iso) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); };
const paraIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const somarDias = (iso, n) => { const d = paraData(iso); d.setDate(d.getDate() + n); return paraIso(d); };
const diasEntre = (a, b) => Math.round((paraData(b) - paraData(a)) / 86400000);
const hojeIso = () => paraIso(new Date());
const dataCurta = (iso) => paraData(iso).toLocaleDateString(localeAtual(), { day: '2-digit', month: '2-digit' });

// Período atual (com fim até hoje) e o anterior do mesmo tamanho
const calcularPeriodos = (faixa) => {
    if (!faixa?.inicio || !faixa?.fim) return null;
    const hoje = hojeIso();
    const inicio = faixa.inicio;
    if (inicio > hoje) return null;
    const fim = faixa.fim > hoje ? hoje : faixa.fim;
    const emAndamento = faixa.fim > hoje;

    // Mês inteiro: compara com o mês anterior (até o mesmo dia, se o mês ainda está correndo)
    if (faixa.mesInteiro) {
        const ini = paraData(inicio);
        const iniAnt = new Date(ini.getFullYear(), ini.getMonth() - 1, 1);
        const ultimoDiaAnt = new Date(ini.getFullYear(), ini.getMonth(), 0).getDate();
        const diaFim = emAndamento ? Math.min(paraData(fim).getDate(), ultimoDiaAnt) : ultimoDiaAnt;
        return { inicio, fim, inicioAnt: paraIso(iniAnt), fimAnt: paraIso(new Date(iniAnt.getFullYear(), iniAnt.getMonth(), diaFim)), emAndamento };
    }
    // Ano inteiro: compara com o ano anterior (até a mesma data, se ainda está correndo)
    if (faixa.anoInteiro) {
        const ini = paraData(inicio); const f = paraData(fim);
        return { inicio, fim, inicioAnt: paraIso(new Date(ini.getFullYear() - 1, 0, 1)), fimAnt: paraIso(new Date(f.getFullYear() - 1, f.getMonth(), f.getDate())), emAndamento };
    }
    const n = diasEntre(inicio, fim) + 1;
    return { inicio, fim, inicioAnt: somarDias(inicio, -n), fimAnt: somarDias(inicio, -1), emAndamento };
};

// Agrupamento do gráfico de evolução: dia, semana ou mês, conforme o tamanho do período
const tipoDeAgrupamento = (p) => {
    const n = diasEntre(p.inicio, p.fim) + 1;
    if (n <= 45) return 'dia';
    if (n <= 200) return 'semana';
    return 'mes';
};
const indiceNoPeriodo = (iso, inicioPeriodo, tipo) => {
    if (tipo === 'dia') return diasEntre(inicioPeriodo, iso);
    if (tipo === 'semana') return Math.floor(diasEntre(inicioPeriodo, iso) / 7);
    const a = paraData(inicioPeriodo), b = paraData(iso);
    return (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
};

// O tema escuro é a classe "dark" no <html> (App.jsx); os gráficos usam cores próprias para cada tema
const useModoEscuro = () => {
    const [escuro, setEscuro] = useState(() => document.documentElement.classList.contains('dark'));
    useEffect(() => {
        const obs = new MutationObserver(() => setEscuro(document.documentElement.classList.contains('dark')));
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => obs.disconnect();
    }, []);
    return escuro;
};

const formatarComissao = (v) => new Intl.NumberFormat(localeAtual(), { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
const variacao = (atual, antes) => (antes > 0 ? (atual - antes) / antes : null);
const textoPct = (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;

// ---------- pedaços visuais ----------
const Variacao = ({ valor, novo }) => {
    if (valor === null) {
        return novo
            ? <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-md border text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-500/10 dark:border-blue-500/30">{tx('novo')}</span>
            : <span className="text-[11px] font-bold text-slate-400">—</span>;
    }
    const sobe = valor > 0.005, desce = valor < -0.005;
    const Icone = sobe ? TrendingUp : desce ? TrendingDown : Minus;
    const cor = sobe ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/30'
        : desce ? 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-500/10 dark:border-rose-500/30'
            : 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-800/60 dark:border-slate-800';
    return <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-md border tabular-nums ${cor}`}><Icone className="w-3 h-3" />{textoPct(valor)}</span>;
};

// "?" com explicação (mouse ou toque)
const Dica = ({ texto, alinhar = 'right' }) => (
    <span className="group/dica relative inline-flex align-middle">
        <button type="button" aria-label={texto} onClick={(e) => e.stopPropagation()} className="text-slate-400 hover:text-blue-600 focus:text-blue-600 outline-none dark:hover:text-blue-400 dark:focus:text-blue-400">
            <HelpCircle className="w-3.5 h-3.5" />
        </button>
        <span role="tooltip" className={`pointer-events-none absolute top-full mt-2 z-40 w-[min(240px,70vw)] hidden group-hover/dica:block group-focus-within/dica:block bg-slate-800 text-white text-[11px] font-semibold normal-case tracking-normal text-left leading-snug px-3 py-2 rounded-lg shadow-lg dark:bg-slate-700 ${alinhar === 'left' ? 'left-0' : 'right-0'}`}>
            {texto}
        </span>
    </span>
);

const Bloco = ({ titulo, subtitulo, dica, children, direita }) => (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-start justify-between gap-2 dark:border-slate-800">
            <div>
                <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5 dark:text-white">{titulo}{dica && <Dica texto={dica} alinhar="left" />}</h3>
                {subtitulo && <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{subtitulo}</p>}
            </div>
            {direita}
        </div>
        <div className="p-5">{children}</div>
    </div>
);

// Caixinha do gráfico ao passar o mouse
const DicaGrafico = ({ active, payload, label, nomes }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3.5 py-2.5 dark:bg-slate-900 dark:border-slate-800 min-w-[160px]">
            {label && <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 dark:text-slate-400">{label}</p>}
            {payload.map(p => (
                <div key={p.dataKey || p.name} className="flex items-center justify-between gap-4 text-[12px]">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color || p.payload?.cor }} />{nomes?.[p.dataKey] || p.name}
                    </span>
                    <span className="font-black text-slate-800 tabular-nums dark:text-white">{p.value}</span>
                </div>
            ))}
        </div>
    );
};

// Rosca com a lista ao lado (nome, quantidade e %), para não depender só da cor
const Rosca = ({ fatias, total, vazio }) => {
    if (total === 0) return <p className="text-xs font-bold text-slate-400 text-center py-10">{vazio}</p>;
    return (
        <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="w-44 h-44 shrink-0 relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={fatias} dataKey="qtd" nameKey="nome" innerRadius="62%" outerRadius="100%" paddingAngle={fatias.length > 1 ? 1.5 : 0} stroke="none" isAnimationActive={false}>
                            {fatias.map(f => <Cell key={f.nome} fill={f.cor} />)}
                        </Pie>
                        <Tooltip content={<DicaGrafico />} />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-black text-slate-800 tabular-nums dark:text-white">{total}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{tx('vendidos')}</span>
                </div>
            </div>
            <ul className="flex-1 w-full space-y-2">
                {fatias.map(f => (
                    <li key={f.nome} className="flex items-center gap-2 text-[12px]">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: f.cor }} />
                        <span className="font-bold text-slate-700 uppercase truncate flex-1 dark:text-slate-200" title={f.nome}>{f.nome}</span>
                        <span className="font-black text-slate-800 tabular-nums dark:text-white">{f.qtd}</span>
                        <span className="w-10 text-right font-semibold text-slate-400 tabular-nums">{Math.round((f.qtd / total) * 100)}%</span>
                        <span className="w-14 text-right"><Variacao valor={f.variacao} novo={f.qtd > 0 && f.qtdAnt === 0} /></span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

const SaudeUnidadeTab = ({
    vendas = [],
    faixa,
    rotuloPeriodo = '',
    catalogoGeral = [],
    temVisaoGlobal,
    filtroUnidade = 'TODOS',
    unidadeUsuario,
    unidadesPermitidas = [],
    vendedoresOcultos = [],
    planosOcultos = [],
    produtosOcultos = [],
    servicosOcultos = [],
    colaboradores = [],
}) => {
    const escuro = useModoEscuro();
    const paleta = escuro ? CORES.escuro : CORES.claro;
    const periodos = useMemo(() => calcularPeriodos(faixa), [faixa]);
    const unidadeFixa = temVisaoGlobal ? (filtroUnidade !== 'TODOS' ? filtroUnidade : null) : unidadeUsuario;

    // Unidade inteira ou uma equipe (= setor do cadastro da Equipe, decisão do dono 30/10/2026).
    // A equipe entra pelo vendedor da venda: conta quem está naquele setor (ativo ou não, porque vendas antigas valem).
    const [equipe, setEquipe] = useState('TODAS');
    const colaboradoresDaVisao = useMemo(() => colaboradores.filter(c => {
        const u = String(c.unidade || '');
        return unidadeFixa ? u.toUpperCase() === String(unidadeFixa).toUpperCase() : unidadesPermitidas.includes(u);
    }), [colaboradores, unidadeFixa, unidadesPermitidas]);
    const equipesDisponiveis = useMemo(() => [...new Set(colaboradoresDaVisao.map(setorDe).filter(Boolean))].sort(), [colaboradoresDaVisao]);
    const membrosEquipe = useMemo(() => (equipe === 'TODAS' ? null
        : new Set(colaboradoresDaVisao.filter(c => setorDe(c) === equipe && c.nome).map(c => String(c.nome).trim().toUpperCase()))), [equipe, colaboradoresDaVisao]);
    // Trocou de unidade e a equipe não existe nela: volta para a unidade inteira
    useEffect(() => { if (equipe !== 'TODAS' && !equipesDisponiveis.includes(equipe)) setEquipe('TODAS'); }, [equipe, equipesDisponiveis]);

    // Busca no banco os dois períodos de uma vez (são seguidos: do início do anterior ao fim do atual)
    const [doBanco, setDoBanco] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const [erro, setErro] = useState(false);
    useEffect(() => {
        if (!periodos) { setDoBanco([]); return undefined; }
        let ativo = true;
        (async () => {
            setCarregando(true); setErro(false);
            let todas = [];
            for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
                let q = supabase.from('vendas').select('id, unidade, data, produto, quantidade, valor, vendedor')
                    .gte('data', periodos.inicioAnt).lte('data', periodos.fim)
                    .order('id', { ascending: true }).range(inicio, inicio + TAMANHO_PAGINA - 1);
                if (unidadeFixa) q = q.eq('unidade', unidadeFixa);
                const { data, error } = await q;
                if (error) { console.error('Saúde da unidade: erro ao buscar vendas', error); if (ativo) setErro(true); break; }
                todas = todas.concat(data || []);
                if (!data || data.length < TAMANHO_PAGINA) break;
            }
            if (ativo) { setDoBanco(todas); setCarregando(false); }
        })();
        return () => { ativo = false; };
    }, [periodos, unidadeFixa]);

    const mapaCatalogo = useMemo(() => {
        const m = new Map();
        catalogoGeral.forEach(c => m.set(String(c.nome || '').toUpperCase(), String(c.tipo || '').toLowerCase()));
        return m;
    }, [catalogoGeral]);

    // Mesma classificação dos filtros do topo: catálogo manda; fora dele, serviço óbvio ou plano
    const categoriaDe = (produtoUpper) => {
        const tipo = mapaCatalogo.get(produtoUpper);
        if (tipo === 'produto') return 'PRODUTO';
        if (tipo === 'servico' || tipo === 'serviço') return 'SERVICO';
        if (tipo === 'plano') return 'PLANO';
        const n = normalizeString(produtoUpper);
        if (['DIARIA', 'AVALIACAO', 'TAXA', 'MULTA', 'DAY USE'].some(p => n.includes(p))) return 'SERVICO';
        return 'PLANO';
    };

    const dados = useMemo(() => {
        if (!periodos) return null;
        // Junta banco + tela (a tela vale mais, por estar atualizada em tempo real)
        const porId = new Map();
        doBanco.forEach(v => porId.set(v.id, v));
        vendas.forEach(v => { const d = String(v.data || '').slice(0, 10); if (d >= periodos.inicioAnt && d <= periodos.fim) porId.set(v.id, v); });

        const permitidas = new Set(unidadesPermitidas);
        const escondidos = new Set([...planosOcultos, ...produtosOcultos, ...servicosOcultos]);
        const vendedoresEscondidos = new Set(vendedoresOcultos);
        const tipoGrupo = tipoDeAgrupamento(periodos);

        const itens = new Map();
        const tot = { atual: { PLANO: 0, PRODUTO: 0, SERVICO: 0, comissao: 0 }, antes: { PLANO: 0, PRODUTO: 0, SERVICO: 0, comissao: 0 } };
        const grupos = {};
        const serie = new Map();

        porId.forEach(v => {
            const unidade = v.unidade;
            if (unidadeFixa ? unidade !== unidadeFixa : !permitidas.has(unidade)) return;
            const produto = String(v.produto || '').toUpperCase();
            if (!produto || escondidos.has(produto) || vendedoresEscondidos.has(String(v.vendedor || '').toUpperCase())) return;
            if (membrosEquipe && !membrosEquipe.has(String(v.vendedor || '').trim().toUpperCase())) return;
            const data = String(v.data || '').slice(0, 10);
            const atual = data >= periodos.inicio && data <= periodos.fim;
            const antes = data >= periodos.inicioAnt && data <= periodos.fimAnt;
            if (!atual && !antes) return;

            const qtd = parseInt(v.quantidade, 10) || 1;
            const comissao = Number(v.valor) || 0;
            const cat = categoriaDe(produto);
            const lado = atual ? 'atual' : 'antes';
            tot[lado][cat] += qtd;
            tot[lado].comissao += comissao;

            const item = itens.get(produto) || { nome: produto, cat, qtd: 0, qtdAnt: 0, comissao: 0, comissaoAnt: 0 };
            if (atual) { item.qtd += qtd; item.comissao += comissao; } else { item.qtdAnt += qtd; item.comissaoAnt += comissao; }
            itens.set(produto, item);

            if (cat === 'PLANO') {
                const g = grupoDoPlano(produto);
                grupos[g] = grupos[g] || { nome: g, qtd: 0, qtdAnt: 0 };
                if (atual) grupos[g].qtd += qtd; else grupos[g].qtdAnt += qtd;
            }

            const i = indiceNoPeriodo(data, atual ? periodos.inicio : periodos.inicioAnt, tipoGrupo);
            const ponto = serie.get(i) || { i, PLANO: 0, PRODUTO: 0, SERVICO: 0, anterior: 0 };
            if (atual) ponto[cat] += qtd; else ponto.anterior += qtd;
            serie.set(i, ponto);
        });

        // Eixo do gráfico: todos os pontos do período atual, mesmo os sem venda (zero de verdade)
        const ultimo = indiceNoPeriodo(periodos.fim, periodos.inicio, tipoGrupo);
        const evolucao = Array.from({ length: ultimo + 1 }, (_, i) => {
            const p = serie.get(i) || { PLANO: 0, PRODUTO: 0, SERVICO: 0, anterior: 0 };
            let rotulo;
            if (tipoGrupo === 'dia') rotulo = dataCurta(somarDias(periodos.inicio, i));
            else if (tipoGrupo === 'semana') rotulo = dataCurta(somarDias(periodos.inicio, i * 7));
            else { const d = paraData(periodos.inicio); rotulo = new Date(d.getFullYear(), d.getMonth() + i, 1).toLocaleDateString(localeAtual(), { month: 'short', year: '2-digit' }); }
            return { rotulo, PLANO: p.PLANO, PRODUTO: p.PRODUTO, SERVICO: p.SERVICO, anterior: p.anterior };
        });

        const listaItens = [...itens.values()].map(it => ({ ...it, variacao: variacao(it.qtd, it.qtdAnt) }));
        const totalAtual = tot.atual.PLANO + tot.atual.PRODUTO + tot.atual.SERVICO;
        const totalAntes = tot.antes.PLANO + tot.antes.PRODUTO + tot.antes.SERVICO;

        // O que olhar agora: pararam, caíram, subiram (no máximo 4, pelo tamanho da diferença)
        const alertas = [];
        listaItens.forEach(it => {
            if (it.qtd === 0 && it.qtdAnt >= MINIMO_PARA_ALERTA) alertas.push({ tipo: 'parou', it, peso: it.qtdAnt * 2 });
            else if (it.qtdAnt >= MINIMO_PARA_ALERTA && it.variacao !== null && it.variacao <= -QUEDA_RELEVANTE) alertas.push({ tipo: 'caiu', it, peso: it.qtdAnt - it.qtd });
        });
        CATEGORIAS.forEach(([cat, nome]) => {
            const v = variacao(tot.atual[cat], tot.antes[cat]);
            if (tot.antes[cat] >= MINIMO_PARA_ALERTA && v !== null && v <= -QUEDA_RELEVANTE) {
                alertas.push({ tipo: 'caiu', it: { nome: tx(nome), qtd: tot.atual[cat], qtdAnt: tot.antes[cat], variacao: v }, peso: (tot.antes[cat] - tot.atual[cat]) * 1.5 });
            }
        });
        const subidas = listaItens
            .filter(it => it.qtd >= MINIMO_PARA_ALERTA && it.variacao !== null && it.variacao >= SUBIDA_RELEVANTE)
            .sort((a, b) => (b.qtd - b.qtdAnt) - (a.qtd - a.qtdAnt));
        alertas.sort((a, b) => b.peso - a.peso);
        const avisos = alertas.slice(0, subidas.length ? 3 : 4);
        if (subidas.length) avisos.push({ tipo: 'subiu', it: subidas[0] });

        return { tot, totalAtual, totalAntes, listaItens, grupos: Object.values(grupos), evolucao, tipoGrupo, avisos };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- categoriaDe só depende do mapaCatalogo
    }, [periodos, doBanco, vendas, unidadeFixa, unidadesPermitidas, vendedoresOcultos, planosOcultos, produtosOcultos, servicosOcultos, mapaCatalogo, membrosEquipe]);

    // Tabela de itens
    const [categoria, setCategoria] = useState('PLANO');
    const [ordem, setOrdem] = useState({ campo: 'qtd', desc: true });
    const ordenar = (campo) => setOrdem(o => ({ campo, desc: o.campo === campo ? !o.desc : campo !== 'nome' }));

    if (!periodos) {
        return (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-10 text-center dark:bg-slate-900 dark:border-slate-800">
                <HeartPulse className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-black text-slate-700 uppercase tracking-widest dark:text-slate-200">{tx('Escolha um período com começo e fim')}</p>
                <p className="text-xs font-semibold text-slate-400 mt-1">{tx('A Saúde da unidade compara o período escolhido com o período anterior do mesmo tamanho. Ex.: "Este mês", "Últimos 30 dias" ou um mês específico.')}</p>
            </div>
        );
    }

    const d = dados;
    const nomeUnidade = `${unidadeFixa || tx('Todas as unidades')}${equipe !== 'TODAS' ? ` · ${tx('Equipe')} ${equipe}` : ''}`;
    const textoAnterior = `${dataCurta(periodos.inicioAnt)} – ${dataCurta(periodos.fimAnt)}`;
    const nomesSerie = { PLANO: tx('Planos'), PRODUTO: tx('Produtos'), SERVICO: tx('Serviços'), anterior: tx('Período anterior (total)') };

    // Roscas
    const fatiasGrupos = [...d.grupos].sort((a, b) => b.qtd - a.qtd).filter(g => g.qtd > 0)
        .map((g, i) => ({ ...g, cor: paleta[i % paleta.length], variacao: variacao(g.qtd, g.qtdAnt) }));
    const produtosOrdenados = d.listaItens.filter(it => it.cat === 'PRODUTO' && it.qtd > 0).sort((a, b) => b.qtd - a.qtd);
    const fatiasProdutos = produtosOrdenados.slice(0, 4).map((p, i) => ({ nome: p.nome, qtd: p.qtd, qtdAnt: p.qtdAnt, cor: paleta[i], variacao: p.variacao }));
    if (produtosOrdenados.length > 4) {
        const resto = produtosOrdenados.slice(4);
        const qtd = resto.reduce((s, p) => s + p.qtd, 0);
        const qtdAnt = resto.reduce((s, p) => s + p.qtdAnt, 0);
        fatiasProdutos.push({ nome: tx('Outros ({qtd} itens)', { qtd: resto.length }), qtd, qtdAnt, cor: escuro ? COR_OUTROS.escuro : COR_OUTROS.claro, variacao: variacao(qtd, qtdAnt) });
    }

    // Tabela
    const itensCategoria = d.listaItens.filter(it => it.cat === categoria && (it.qtd > 0 || it.qtdAnt > 0));
    const totalCategoria = d.tot.atual[categoria];
    const vendidos = itensCategoria.filter(it => it.qtd > 0).sort((a, b) => b.qtd - a.qtd);
    const maisVendido = vendidos[0]?.nome;
    const menosVendido = vendidos.length > 1 ? vendidos[vendidos.length - 1].nome : null;
    const linhas = [...itensCategoria].sort((a, b) => {
        const x = ordem.campo === 'variacao' ? (a.variacao ?? (a.qtd > 0 ? Infinity : -Infinity)) : a[ordem.campo];
        const y = ordem.campo === 'variacao' ? (b.variacao ?? (b.qtd > 0 ? Infinity : -Infinity)) : b[ordem.campo];
        const c = typeof x === 'string' ? x.localeCompare(y) : x - y;
        return ordem.desc ? -c : c;
    });

    const Titulo = ({ campo, children, dica, alinhar = 'right' }) => {
        const ativo = ordem.campo === campo;
        const Seta = !ativo ? ArrowUpDown : ordem.desc ? ArrowDown : ArrowUp;
        return (
            <th className={`px-4 py-3 border-b border-slate-200 dark:border-slate-800 ${alinhar === 'left' ? 'text-left' : 'text-right'}`}>
                <span className="inline-flex items-center gap-1">
                    <button type="button" onClick={() => ordenar(campo)} className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest transition-colors ${ativo ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}>
                        {children}<Seta className="w-3 h-3" />
                    </button>
                    {dica && <Dica texto={dica} alinhar={alinhar === 'left' ? 'left' : 'right'} />}
                </span>
            </th>
        );
    };

    const corEixo = escuro ? '#64748b' : '#94a3b8';
    const corGrade = escuro ? '#1e293b' : '#e2e8f0';
    const corFundo = escuro ? '#0f172a' : '#ffffff';
    const mostrarEvolucao = d.evolucao.length > 1;

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] pb-10">

            {/* RESUMO EM UMA FAIXA */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-3 dark:bg-slate-900 dark:border-slate-800">
                {/* Unidade inteira ou uma equipe (setor do cadastro) */}
                <div className="relative">
                    <Users className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${equipe !== 'TODAS' ? 'text-blue-700 dark:text-blue-400' : 'text-slate-400'}`} />
                    <select
                        value={equipe}
                        onChange={(e) => setEquipe(e.target.value)}
                        aria-label={tx('Ver a unidade inteira ou uma equipe')}
                        title={tx('A equipe é o setor do cadastro da Equipe. Escolhendo uma, todos os números contam só as vendas das pessoas daquele setor.')}
                        className={`h-9 pl-9 pr-8 rounded-xl border text-[12px] appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${equipe !== 'TODAS' ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-400' : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 font-semibold dark:bg-slate-900 dark:border-slate-800 dark:hover:border-slate-700 dark:text-slate-200'}`}
                    >
                        <option value="TODAS">{unidadeFixa ? tx('Unidade inteira') : tx('Todas as equipes')}</option>
                        {equipesDisponiveis.map(s => <option key={s} value={s}>{tx('Equipe')}: {s}</option>)}
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                </div>
                <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{tx('Vendas')} · {nomeUnidade}</span>
                    <span className="text-lg font-black text-slate-800 tabular-nums dark:text-white">{d.totalAtual}</span>
                    <Variacao valor={variacao(d.totalAtual, d.totalAntes)} />
                    <span className="text-[11px] font-semibold text-slate-400">{tx('antes: {qtd}', { qtd: d.totalAntes })}</span>
                </div>
                <div className="h-5 w-px bg-slate-200 hidden lg:block dark:bg-slate-700" />
                {CATEGORIAS.map(([cat, nome]) => (
                    <div key={cat} className="flex items-baseline gap-1.5 whitespace-nowrap">
                        <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">{tx(nome)}</span>
                        <span className="text-base font-black text-slate-700 tabular-nums dark:text-slate-200">{d.tot.atual[cat]}</span>
                        <Variacao valor={variacao(d.tot.atual[cat], d.tot.antes[cat])} />
                    </div>
                ))}
                <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                    <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">{tx('Comissão')}</span>
                    <span className="text-base font-black text-emerald-700 tabular-nums dark:text-emerald-400">{formatarComissao(d.tot.atual.comissao)}</span>
                </div>
                <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                    {carregando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span className="cursor-help inline-flex items-center gap-1" title={tx('Comparado com o período anterior do mesmo tamanho. Mês em andamento: comparado com o mês passado até o mesmo dia.')}>
                        <Info className="w-3.5 h-3.5" />{tx(rotuloPeriodo)} {tx('vs')} {textoAnterior}
                    </span>
                </span>
            </div>

            {erro && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-xs font-bold dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {tx('Não foi possível buscar todas as vendas no banco. A comparação pode estar incompleta.')}
                </div>
            )}

            {/* O QUE OLHAR AGORA */}
            <Bloco titulo={tx('O que olhar agora')} subtitulo={tx('Avisos automáticos comparando com o período anterior')}
                dica={tx('Aparece quando um item vendia pelo menos 3 no período anterior e caiu 30% ou mais, ou parou de vender. Também mostra o que mais cresceu.')}>
                {d.avisos.length === 0 ? (
                    <p className="text-[12px] font-semibold text-slate-500 flex items-center gap-2 dark:text-slate-400"><Sparkles className="w-4 h-4 text-emerald-500" />{tx('Nenhuma queda importante em relação ao período anterior.')}</p>
                ) : (
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {d.avisos.map(({ tipo, it }) => {
                            const estilo = tipo === 'subiu'
                                ? { Icone: TrendingUp, cor: 'text-emerald-600 dark:text-emerald-400', fundo: 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-500/10' }
                                : tipo === 'parou'
                                    ? { Icone: CircleSlash, cor: 'text-amber-600 dark:text-amber-400', fundo: 'border-amber-200 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/10' }
                                    : { Icone: TrendingDown, cor: 'text-rose-600 dark:text-rose-400', fundo: 'border-rose-200 bg-rose-50/50 dark:border-rose-500/30 dark:bg-rose-500/10' };
                            const texto = tipo === 'parou'
                                ? tx('{nome} parou de vender (vendeu {antes} no período anterior, 0 agora)', { nome: it.nome, antes: it.qtdAnt })
                                : tipo === 'caiu'
                                    ? tx('{nome} caiu {pct} (de {antes} para {agora})', { nome: it.nome, pct: textoPct(it.variacao).replace('-', ''), antes: it.qtdAnt, agora: it.qtd })
                                    : tx('{nome} subiu {pct} (de {antes} para {agora})', { nome: it.nome, pct: textoPct(it.variacao).replace('+', ''), antes: it.qtdAnt, agora: it.qtd });
                            return (
                                <li key={`${tipo}-${it.nome}`} className={`flex items-start gap-2.5 border rounded-xl px-3.5 py-2.5 ${estilo.fundo}`}>
                                    <estilo.Icone className={`w-4 h-4 shrink-0 mt-0.5 ${estilo.cor}`} />
                                    <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">{texto}</span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Bloco>

            {/* PIZZAS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Bloco titulo={tx('Planos por grupo')} subtitulo={tx('Quantos planos de cada grupo saíram no período')}
                    dica={tx('Grupos: NUTRI (com nutricionista), PLUS, FIT, Personal e Outros. A seta mostra a variação de cada grupo em relação ao período anterior.')}>
                    <Rosca fatias={fatiasGrupos} total={d.tot.atual.PLANO} vazio={tx('Nenhum plano vendido no período.')} />
                </Bloco>
                <Bloco titulo={tx('Produtos mais vendidos')} subtitulo={tx('Os 4 que mais saíram; o resto fica em "Outros"')}
                    dica={tx('Quantidade de cada produto vendido no período. A seta mostra a variação em relação ao período anterior.')}>
                    <Rosca fatias={fatiasProdutos} total={d.tot.atual.PRODUTO} vazio={tx('Nenhum produto vendido no período.')} />
                </Bloco>
            </div>

            {/* MONTANHA (EVOLUÇÃO) */}
            <Bloco titulo={tx('Evolução das vendas')}
                subtitulo={d.tipoGrupo === 'dia' ? tx('Por dia, no período escolhido') : d.tipoGrupo === 'semana' ? tx('Por semana, no período escolhido') : tx('Por mês, no período escolhido')}
                dica={tx('Camadas empilhadas: planos, produtos e serviços. A linha tracejada é o total do período anterior no mesmo ponto (ex.: 1º dia com 1º dia).')}
                direita={mostrarEvolucao && (
                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {CATEGORIAS.map(([cat, nome], i) => <span key={cat} className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: paleta[i] }} />{tx(nome)}</span>)}
                        <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed" style={{ borderColor: escuro ? COR_ANTERIOR.escuro : COR_ANTERIOR.claro }} />{tx('Período anterior')}</span>
                    </div>
                )}>
                {mostrarEvolucao ? (
                    <div className="h-64" role="img" aria-label={tx('Gráfico da evolução das vendas no período')}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={d.evolucao} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                                <CartesianGrid vertical={false} stroke={corGrade} />
                                <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tick={{ fill: corEixo, fontSize: 11, fontWeight: 700 }} minTickGap={16} />
                                <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fill: corEixo, fontSize: 11, fontWeight: 700 }} width={40} />
                                <Tooltip content={<DicaGrafico nomes={nomesSerie} />} cursor={{ stroke: corEixo, strokeDasharray: '3 3' }} />
                                {CATEGORIAS.map(([cat], i) => (
                                    <Area key={cat} type="monotone" dataKey={cat} stackId="1" stroke={paleta[i]} strokeWidth={2} fill={paleta[i]} fillOpacity={0.25} isAnimationActive={false}
                                        activeDot={{ r: 4, stroke: corFundo, strokeWidth: 2 }} />
                                ))}
                                <Line type="monotone" dataKey="anterior" stroke={escuro ? COR_ANTERIOR.escuro : COR_ANTERIOR.claro} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <p className="text-xs font-bold text-slate-400 text-center py-10">{tx('Escolha um período maior que um dia para ver a evolução.')}</p>
                )}
            </Bloco>

            {/* TABELA DE ITENS */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-800">
                <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 dark:border-slate-800">
                    <div>
                        <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-widest dark:text-white">{tx('Item por item')}</h3>
                        <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{tx('Clique no título de uma coluna para ordenar.')}</p>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-xl gap-1 dark:bg-slate-800" role="tablist" aria-label={tx('Categoria:')}>
                        {CATEGORIAS.map(([cat, nome]) => {
                            const ativo = categoria === cat;
                            return (
                                <button key={cat} type="button" role="tab" aria-selected={ativo} onClick={() => setCategoria(cat)}
                                    className={`h-8 px-3 rounded-lg text-[12px] flex items-center gap-1.5 transition-colors ${ativo ? 'bg-white shadow-sm text-blue-700 font-extrabold dark:bg-slate-900 dark:text-blue-400' : 'text-slate-500 hover:text-slate-800 font-bold dark:text-slate-400 dark:hover:text-white'}`}>
                                    {tx(nome)}<span className={`text-[11px] tabular-nums ${ativo ? 'text-blue-500' : 'text-slate-400'}`}>{d.tot.atual[cat]}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="overflow-x-auto custom-scrollbar pb-1">
                    <table className="w-full text-left border-collapse min-w-[760px]">
                        <thead className="bg-slate-50 dark:bg-slate-800/60">
                            <tr>
                                <Titulo campo="nome" alinhar="left" dica={tx('Nome do plano, produto ou serviço no catálogo.')}>{tx('Item')}</Titulo>
                                <Titulo campo="qtd" dica={tx('Quantidade vendida no período escolhido.')}>{tx('Agora')}</Titulo>
                                <Titulo campo="qtdAnt" dica={tx('Quantidade vendida no período anterior ({periodo}).', { periodo: textoAnterior })}>{tx('Antes')}</Titulo>
                                <Titulo campo="variacao" dica={tx('Quanto a quantidade subiu (▲) ou caiu (▼) em relação ao período anterior. "Novo" = não vendia antes.')}>{tx('Variação')}</Titulo>
                                <Titulo campo="qtd" dica={tx('Pedaço que este item representa no total da categoria. Ex.: 30 planos vendidos e 6 deste = 20%.')}>{tx('% do total')}</Titulo>
                                <Titulo campo="comissao" dica={tx('Comissão paga pelas vendas deste item no período (não é o preço do plano).')}>{tx('Comissão')}</Titulo>
                                <th className="px-4 py-3 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-800 dark:text-slate-400">{tx('Situação')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {linhas.length === 0 ? (
                                <tr><td colSpan="7" className="py-12 text-center text-xs font-black text-slate-400 uppercase tracking-widest">{tx('Nenhuma venda nesta categoria nos dois períodos.')}</td></tr>
                            ) : linhas.map(it => {
                                const pct = totalCategoria > 0 ? Math.round((it.qtd / totalCategoria) * 100) : 0;
                                const situacao = it.qtd === 0
                                    ? <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/30"><CircleSlash className="w-3 h-3" />{tx('Parou de vender')}</span>
                                    : it.nome === maisVendido
                                        ? <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-500/10 dark:border-blue-500/30">{tx('Mais vendido')}</span>
                                        : it.nome === menosVendido
                                            ? <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-800/60 dark:border-slate-800">{tx('Menos vendido')}</span>
                                            : null;
                                return (
                                    <tr key={it.nome} className="hover:bg-slate-50 transition-colors dark:hover:bg-slate-800/40">
                                        <td className="px-4 py-3 text-[12px] font-black text-slate-800 uppercase tracking-tight dark:text-white">{it.nome}</td>
                                        <td className="px-4 py-3 text-right text-sm font-black text-slate-800 tabular-nums dark:text-white">{it.qtd}</td>
                                        <td className="px-4 py-3 text-right text-sm font-bold text-slate-500 tabular-nums dark:text-slate-400">{it.qtdAnt}</td>
                                        <td className="px-4 py-3 text-right"><Variacao valor={it.variacao} novo={it.qtd > 0 && it.qtdAnt === 0} /></td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden dark:bg-slate-800"><div className="h-full bg-blue-600 rounded-full dark:bg-blue-500" style={{ width: `${pct}%` }} /></div>
                                                <span className="text-xs font-black text-slate-600 tabular-nums w-9 text-right dark:text-slate-300">{pct}%</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right text-[12px] font-bold text-slate-600 tabular-nums dark:text-slate-300">{formatarComissao(it.comissao)}</td>
                                        <td className="px-4 py-3">{situacao}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SaudeUnidadeTab;
