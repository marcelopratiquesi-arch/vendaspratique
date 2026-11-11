import React, { useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft, Phone, MessageCircle, MapPin, Sun, Moon, AlertTriangle, Building, Zap, Pencil, Wallet, ShoppingCart,
    CheckCircle2, Clock, Receipt, Users, Dumbbell, MessagesSquare, TrendingUp, TrendingDown, Loader2,
    Trophy, BarChart3, UserRound, Layers, Target, LayoutDashboard, Gauge,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { tx, localeAtual } from '../../../i18n/traduzir.js';
import { SeletorPeriodo } from '../../HistoricoVendas/FiltrosCompactos.jsx';
import { usePeriodoPadrao } from '../../../components/periodoPadrao.js';
import CopyButton from '../../HistoricoVendas/CopyButton.jsx';
import { abrirNoWhatsApp } from '../../../components/whatsapp.js';
import { setorDoColaborador } from '../../Lancamentos/seletores/setoresEquipe.js';
import { getCategoriaItem } from '../../AnaliseVendas/utils.js';
import { diaDaVenda } from '../../AnaliseVendas/painel/calculosPainel.js';
import { pendenciasAvaliacao } from '../../AvaliacaoFisica/utils.js';
import { ehMudancaPorCompra } from '../../CrmVisitantes/utils';
import { TIPOS_CONTATO } from '../../CrmVisitantes/contatosFeitos.js';
import { faixaEmIso, variacao } from '../panorama/contasPanorama.js';
import { problemasDoColaborador, PROBLEMAS_CADASTRO } from '../cadastroColaborador.js';
import { useCentralColaborador, ehRecepcaoColab, ehAvaliadorColab } from './useCentralColaborador.js';
import {
    resumoColaborador, comissaoPorMes, posicaoNaUnidade, nomesParecidos, resumoVisitantes, comissaoDe,
    resumoCrmColaborador, resumoAvaliacoesColaborador, META_PESSOAS_DIA, situacaoPagamentoDoMes,
} from './contasColaborador.js';

// ==========================================
// CENTRAL DO COLABORADOR (11/11/2026, decisão do dono: "uma página do consultor igual à da unidade e do aluno";
// no mesmo dia: "em vez de abas, um PANORAMA que a gente vai descendo, com tudo o que a pessoa faz no sistema").
// Mais tarde, no mesmo dia, o dono pediu de volta as ABAS, no modelo da Central da Unidade: Visão geral (quem é +
// "Cadastro em dia?") · Panorama (tudo, descendo) · CRM (Recepção) · Vendas · Comissão · Avaliações · Cadastro.
// Aberta por cima da Central da Unidade (clicar no nome do consultor), o Esc fecha só ela e volta para a unidade.
// Antes (panorama único): cabeçalho + cartões + período + atalhos para cada parte e,
// descendo: alertas · CRM (Recepção, primeiro) · Vendas e comissão · Comissão mês a mês (gráfico 6 meses) ·
// Avaliações (SAVER/Líder ou quem fez alguma) · Visitantes atendidos · Vendas do período · Cadastro.
// Só leitura (Editar = a janela de sempre da Equipe, quando aberta de lá). Contas em contasColaborador.js (as
// mesmas do Dashboard/Fechamento/CRM), leitura em useCentralColaborador.js. Conta bancária só para o Admin.
// A Recepção não abre (permissão 809).
// ==========================================

const COR_CONFERIDA = '#059669'; // validadas (claro e escuro) com o validador de paleta
const COR_AGUARDANDO = '#d97706';

const soNumeros = (t) => String(t || '').replace(/\D/g, '');
const dinheiro = (v) => (v === null || v === undefined ? '—' : new Intl.NumberFormat(localeAtual(), { style: 'currency', currency: 'BRL' }).format(Number(v) || 0));
const dinheiroCurto = (v) => new Intl.NumberFormat(localeAtual(), { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(v) || 0);
const dataBr = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');
const dataCurta = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().slice(0, 2).join('/') : '');
const horaDe = (valor) => { if (!valor) return ''; const d = new Date(valor); return isNaN(d) ? '' : d.toLocaleTimeString(localeAtual(), { hour: '2-digit', minute: '2-digit' }); };
const dataHora = (valor) => { if (!valor) return '—'; const d = new Date(valor); return isNaN(d) ? '—' : `${d.toLocaleDateString(localeAtual(), { day: '2-digit', month: '2-digit' })} ${horaDe(valor)}`; };
const iniciais = (nome) => String(nome || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';
const telefoneBonito = (t) => {
    const n = soNumeros(t);
    if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
    if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
    return t || '';
};
const porcento = (v) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`);

const useModoEscuro = () => {
    const [escuro, setEscuro] = useState(() => document.documentElement.classList.contains('dark'));
    useEffect(() => {
        const obs = new MutationObserver(() => setEscuro(document.documentElement.classList.contains('dark')));
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => obs.disconnect();
    }, []);
    return escuro;
};

const Cartao = ({ icone: Icone, cor, titulo, valor, sub, alerta }) => (
    <div className={`bg-white p-4 rounded-xl border shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between min-h-[96px] dark:bg-slate-900 ${alerta === 'vermelho' ? 'border-rose-300 dark:border-rose-500/40' : alerta ? 'border-amber-300 dark:border-amber-500/40' : 'border-slate-200/80 dark:border-slate-800'}`}>
        <div className="flex items-center gap-2.5 mb-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${cor}`}><Icone className="w-3.5 h-3.5" strokeWidth={2.5} /></div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate dark:text-slate-400">{titulo}</span>
        </div>
        <span className="text-[15px] font-extrabold tracking-tight text-slate-800 truncate tabular-nums dark:text-white" title={String(valor)}>{valor}</span>
        <span className={`text-[10px] font-semibold mt-0.5 truncate ${alerta === 'vermelho' ? 'text-rose-600 dark:text-rose-400' : alerta ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`} title={typeof sub === 'string' ? sub : undefined}>{sub}</span>
    </div>
);

const Quadro = ({ icone: Icone, cor, titulo, sub, children, className = '' }) => (
    <section className={`bg-white rounded-xl border border-slate-200/80 flex flex-col dark:bg-slate-900 dark:border-slate-800 ${className}`}>
        <header className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            {Icone && <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${cor}`}><Icone className="w-3.5 h-3.5" strokeWidth={2.5} /></span>}
            <div className="min-w-0">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">{titulo}</h4>
                {sub && <p className="text-[10px] font-semibold text-slate-400 truncate">{sub}</p>}
            </div>
        </header>
        <div className="p-4 flex-1">{children}</div>
    </section>
);

// Título de cada parte do panorama (com âncora para os atalhos do topo)
const Secao = ({ id, icone: Icone, titulo, sub, children }) => (
    <section id={id} className="scroll-mt-4 space-y-3">
        <div className="flex items-baseline gap-2 pt-2">
            <Icone className="w-4 h-4 text-blue-600 self-center dark:text-blue-400" />
            <h3 className="text-[13px] font-black uppercase tracking-widest text-slate-800 dark:text-white">{titulo}</h3>
            {sub && <span className="text-[11px] font-semibold text-slate-400">{sub}</span>}
        </div>
        {children}
    </section>
);

const Barra = ({ valor, total, cor = 'bg-blue-500' }) => (
    <span className="block h-1.5 rounded-full bg-slate-100 overflow-hidden dark:bg-slate-800">
        <span className={`block h-full rounded-full ${cor}`} style={{ width: `${Math.max(0, Math.min(100, total ? (valor / total) * 100 : 0))}%` }} />
    </span>
);

const Variacao = ({ v }) => {
    if (!v) return <span className="text-slate-400">—</span>;
    if (v.perc === null) return <span className="text-emerald-600 dark:text-emerald-400">{tx('novo')}</span>;
    const sobe = v.dif >= 0;
    const Icone = sobe ? TrendingUp : TrendingDown;
    return (
        <span className={`inline-flex items-center gap-1 ${sobe ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            <Icone className="w-3.5 h-3.5" />{sobe ? '+' : ''}{Math.round(v.perc * 100)}%
        </span>
    );
};

// Um número da faixa (igual à faixa do Panorama da unidade)
const Numero = ({ rotulo, valor, sub, cor = 'text-slate-800 dark:text-white', titulo }) => (
    <div className="min-w-[104px] px-3 py-2" title={titulo}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">{rotulo}</p>
        <p className={`text-lg font-extrabold tabular-nums leading-tight ${cor}`}>{valor}</p>
        {sub && <div className="text-[10px] font-semibold text-slate-400 truncate">{sub}</div>}
    </div>
);
const Faixa = ({ children }) => (
    <div className="bg-white rounded-xl border border-slate-200/80 flex flex-wrap divide-x divide-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:divide-slate-800">{children}</div>
);

const Vazio = ({ children }) => <p className="text-[12px] font-semibold text-slate-400 py-2">{children}</p>;

// Barras por dia ou por mês (com linha da meta, quando houver). Texto da dica = title (sem cor como única pista).
const BarrasSimples = ({ itens, valor, rotulo, dica, meta, corDe }) => {
    const maximo = Math.max(1, meta || 0, ...itens.map(valor));
    return (
        <div className="relative">
            {meta ? (
                <div className="absolute inset-x-0 border-t-2 border-dashed border-emerald-500/70 pointer-events-none" style={{ bottom: `calc(${(meta / maximo) * 100}% * 0.82 + 18px)` }}>
                    <span className="absolute right-0 -top-4 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">{tx('meta {qtd}', { qtd: meta })}</span>
                </div>
            ) : null}
            <div className="flex items-end gap-[3px] h-32" role="img" aria-label={tx('Gráfico de barras')}>
                {itens.map((it, i) => (
                    <div key={i} className="flex-1 min-w-[4px] h-full flex flex-col justify-end items-center gap-1" title={dica(it)}>
                        <span className="block w-full rounded-t-[4px]" style={{ height: `calc(${Math.max(3, (valor(it) / maximo) * 100)}% * 0.82)`, background: corDe ? corDe(it) : COR_CONFERIDA }} />
                        {rotulo && <span className="text-[10px] font-bold text-slate-400 leading-none h-[14px]">{rotulo(it)}</span>}
                    </div>
                ))}
            </div>
        </div>
    );
};

const th = 'px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap dark:text-slate-400';
const td = 'px-3 py-2 text-[12px] font-semibold text-slate-700 dark:text-slate-200';

// Dica do gráfico de comissão (texto nas cores de texto, a cor só na bolinha)
const DicaGrafico = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const linha = payload[0].payload;
    return (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg text-[12px] dark:bg-slate-900 dark:border-slate-700">
            <p className="font-black uppercase text-slate-800 dark:text-white">{label}</p>
            <p className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: COR_CONFERIDA }} />{tx('Conferida')}: {dinheiro(linha.conferida)}</p>
            <p className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: COR_AGUARDANDO }} />{tx('Aguardando conferência')}: {dinheiro(linha.aguardando)}</p>
            <p className="font-black text-slate-800 mt-0.5 dark:text-white">{tx('Total')}: {dinheiro(linha.total)} · {linha.vendas === 1 ? tx('1 venda') : tx('{qtd} vendas', { qtd: linha.vendas })}</p>
        </div>
    );
};

const FichaColaborador = ({ colaborador: c, planos = [], produtos = [], ehAdmin = false, onEditar, onFechar }) => {
    const [aba, setAba] = useState('geral');
    const [filtroVendas, setFiltroVendas] = useState('TODAS');
    const [mostrar, setMostrar] = useState(20);
    const periodo = usePeriodoPadrao('este_mes');
    const faixa = useMemo(() => faixaEmIso(periodo.faixa), [periodo.faixa]);
    const { dados, carregando } = useCentralColaborador({ colaborador: c, faixa });
    const escuro = useModoEscuro();

    // Esc fecha SÓ esta janela: aberta por cima da Central da Unidade, volta para a unidade (o Esc não chega nela)
    useEffect(() => {
        const aoTeclar = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onFechar(); } };
        window.addEventListener('keydown', aoTeclar, true);
        return () => window.removeEventListener('keydown', aoTeclar, true);
    }, [onFechar]);

    const setor = setorDoColaborador(c);
    const ativo = c.ativo !== false;
    const temCadastro = c.id != null;
    const turno = String(c.turno || '').toUpperCase();
    const problemas = temCadastro ? problemasDoColaborador(c, null) : [];
    const telOk = soNumeros(c.telefone).length >= 10;
    const recepcao = ehRecepcaoColab(c);
    const vendas = useMemo(() => dados?.vendas || [], [dados]);
    const anterior = dados?.faixaAnterior || null;
    // Coluna "Pagamento" só quando a tabela de pagamentos aprovados existe (SQL de 11/11/2026)
    const temPagamentos = Array.isArray(dados?.pagamentos);
    const desligadoEm = c.desligado_em ? dataBr(String(c.desligado_em).slice(0, 10)) : null;

    // ---------- Vendas e comissão ----------
    const r = useMemo(() => resumoColaborador({ vendas, faixa, planos, produtos, hojeIso: dados?.hoje }), [vendas, faixa, planos, produtos, dados?.hoje]);
    const ant = useMemo(() => (anterior ? resumoColaborador({ vendas, faixa: anterior, planos, produtos, hojeIso: dados?.hoje }) : null), [vendas, anterior, planos, produtos, dados?.hoje]);
    const meses = useMemo(() => comissaoPorMes({ vendas }), [vendas]);
    const posicao = useMemo(() => (dados?.vendasUnidade ? posicaoNaUnidade(dados.vendasUnidade, c.nome) : null), [dados, c.nome]);
    const parecidos = useMemo(() => nomesParecidos(dados?.parecidas || [], c.nome), [dados, c.nome]);

    // ---------- Visitantes ----------
    const visitantes = useMemo(() => (dados?.visitantes ? resumoVisitantes(dados.visitantes) : null), [dados]);

    // ---------- Avaliações ----------
    const listaAval = dados?.avaliacoes;
    const aval = useMemo(() => (listaAval ? resumoAvaliacoesColaborador({ avaliacoes: listaAval, faixa, estaIncompleta: (a) => pendenciasAvaliacao(a).length > 0 }) : null), [listaAval, faixa]);
    const avalAnt = useMemo(() => (listaAval && anterior ? resumoAvaliacoesColaborador({ avaliacoes: listaAval, faixa: anterior }) : null), [listaAval, anterior]);
    const mostrarAvaliacoes = ehAvaliadorColab(c) || (listaAval && listaAval.length > 0);

    // ---------- CRM (Recepção) ----------
    const crm = useMemo(() => (dados?.historico ? resumoCrmColaborador({ historico: dados.historico, feitos: dados.feitos || [], resultados: dados.resultados || [], faixa, hojeIso: dados.hoje, ehMudancaPorCompra }) : null), [dados, faixa]);
    const crmAnt = useMemo(() => (dados?.historico && anterior ? resumoCrmColaborador({ historico: dados.historico, feitos: dados.feitos || [], resultados: dados.resultados || [], faixa: anterior, hojeIso: dados.hoje, ehMudancaPorCompra }) : null), [dados, anterior]);

    // ---------- Lista de vendas do período ----------
    const vendasDaLista = useMemo(() => {
        const ordem = [...r.doPeriodo].sort((a, b) => String(diaDaVenda(b)).localeCompare(String(diaDaVenda(a))) || (b.id || 0) - (a.id || 0));
        if (filtroVendas === 'TODAS') return ordem;
        return ordem.filter(v => getCategoriaItem(v.produto, planos, produtos) === filtroVendas);
    }, [r.doPeriodo, filtroVendas, planos, produtos]);
    const contagemCategoria = useMemo(() => {
        const cont = { PLANO: 0, PRODUTO: 0, SERVICO: 0 };
        r.doPeriodo.forEach(v => { const k = getCategoriaItem(v.produto, planos, produtos); if (cont[k] !== undefined) cont[k] += 1; });
        return cont;
    }, [r.doPeriodo, planos, produtos]);
    const unidadesNasVendas = useMemo(() => new Set(r.doPeriodo.map(v => v.unidade).filter(Boolean)).size, [r.doPeriodo]);
    const maxDia = Math.max(1, ...r.porDia.map(d => d.comissao));
    const maxItem = Math.max(1, ...r.maisVendidos.map(i => i.qtd));

    const separador = <span className="hidden sm:block w-px h-3 bg-slate-300 dark:bg-slate-700" />;
    const botaoTopo = 'flex-1 sm:flex-none px-4 py-2 rounded-lg border text-[11px] font-bold uppercase tracking-wider transition-colors shadow-sm flex items-center justify-center gap-1.5';
    const ultimaAlerta = r.diasSemVender !== null && r.diasSemVender >= 15 ? 'vermelho' : null;
    const textoUltima = r.ultimaVenda ? (r.diasSemVender === 0 ? tx('hoje') : r.diasSemVender === 1 ? tx('ontem') : tx('há {qtd} dias', { qtd: r.diasSemVender })) : tx('Nenhuma');
    const rotPeriodo = tx(periodo.rotulo);

    const comoRecebe = () => {
        if (c.tipo_conta === 'INTER' && soNumeros(c.conta_inter)) return (
            <span className="inline-flex items-center gap-1.5 text-orange-700 dark:text-orange-400"><Building className="w-3.5 h-3.5" />{tx('Banco Inter')}
                {ehAdmin && <><b className="font-mono font-bold">{c.conta_inter}</b><CopyButton textToCopy={c.conta_inter} label={tx('Copiar conta')} /></>}
            </span>
        );
        if (c.tipo_conta === 'PIX_CPF') return <span className="inline-flex items-center gap-1.5 font-bold text-rose-600 dark:text-rose-400"><Zap className="w-3.5 h-3.5" />{tx('Recebe por PIX: trocar para o Banco Inter')}</span>;
        if (!temCadastro) return <span className="inline-flex items-center gap-1.5 font-bold text-rose-600 dark:text-rose-400"><AlertTriangle className="w-3.5 h-3.5" />{tx('Sem cadastro na Equipe')}</span>;
        return <span className="inline-flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400"><AlertTriangle className="w-3.5 h-3.5" />{tx('Sem conta para receber a comissão')}</span>;
    };

    // ABAS (decisão do dono, 11/11/2026: "igual à Central da Unidade": Visão geral → Panorama → as outras)
    const abas = [
        ['geral', 'Visão geral', LayoutDashboard],
        ['panorama', 'Panorama', Gauge],
        recepcao && ['crm', 'CRM', MessagesSquare],
        ['vendas', 'Vendas', ShoppingCart],
        ['comissao', 'Comissão', Wallet],
        mostrarAvaliacoes && ['avaliacoes', 'Avaliações', Dumbbell],
        ['cadastro', 'Cadastro', UserRound],
    ].filter(Boolean);
    const abaMostrada = abas.some(([id]) => id === aba) ? aba : 'geral';

    // "Cadastro em dia?" (Visão geral; mesmo modelo do "Unidade pronta?"): cada item com o caminho para resolver
    const pagMesPassado = (() => {
        if (!Array.isArray(dados?.pagamentos)) return null;
        const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
        const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return { mes, ...situacaoPagamentoDoMes({ mes, vendas, pagamentos: dados.pagamentos }) };
    })();
    const itensCadastro = [
        { id: 'equipe', ok: temCadastro, titulo: 'Cadastrado na Equipe', detalhe: temCadastro ? (ativo ? tx('Ativo') : tx('Desligado')) : tx('O nome aparece nas vendas, mas não está na Equipe'), resolver: tx('Cadastre em Cadastros → Equipe (com CPF e Banco Inter).') },
        temCadastro && { id: 'cpf', ok: !problemas.includes('cpf'), titulo: 'CPF válido', detalhe: c.cpf || tx('não informado'), resolver: tx('Corrija o CPF no cadastro.') },
        temCadastro && { id: 'telefone', ok: !problemas.includes('telefone'), titulo: 'Telefone (WhatsApp)', detalhe: telOk ? telefoneBonito(c.telefone) : tx('sem telefone'), resolver: tx('Coloque o WhatsApp no cadastro.') },
        temCadastro && { id: 'conta', ok: !problemas.some(p => p === 'pix' || p === 'semConta'), titulo: 'Recebe pelo Banco Inter', detalhe: c.tipo_conta === 'PIX_CPF' ? tx('Recebe por PIX: trocar para o Banco Inter') : c.tipo_conta === 'INTER' ? tx('Banco Inter') : tx('Sem conta para receber a comissão'), resolver: tx('Coloque a conta do Banco Inter no cadastro (o Banco Inter é o pagamento principal).') },
        temCadastro && { id: 'setor', ok: !problemas.includes('semSetor'), titulo: 'Setor', detalhe: c.role || tx('Sem setor'), resolver: tx('Escolha o setor no cadastro.') },
        temCadastro && recepcao && { id: 'turno', ok: !!c.turno, titulo: 'Turno da recepção', detalhe: turno === 'MANHA' ? tx('Manhã (7h às 13h)') : turno === 'NOITE' ? tx('Noite (13h às 21h)') : tx('Sem turno'), resolver: tx('Marque Manhã ou Noite no cadastro.') },
        { id: 'nome', ok: parecidos.length === 0, titulo: 'Vendas no nome certo', detalhe: parecidos.length ? tx('Há vendas com o nome escrito de outro jeito: {nomes}', { nomes: parecidos.slice(0, 3).map(p => p.nome).join(', ') }) : tx('Nenhuma venda com o nome escrito diferente'), resolver: tx('Confira essas vendas no Histórico.') },
        { id: 'conferencia', ok: r.aguardando === 0, aviso: true, titulo: 'Comissão conferida', detalhe: r.aguardando > 0 ? tx('{valor} aguardando conferência ({periodo})', { valor: dinheiro(r.aguardando), periodo: rotPeriodo }) : tx('tudo conferido'), resolver: tx('O Líder confere no Fechamento → Conferência (toda sexta).') },
    ].filter(Boolean);
    const itensComProblema = itensCadastro.filter(i => !i.ok).length;

    // ================= PARTES DO PANORAMA =================
    const secaoCrm = recepcao && (
        <Secao id="sec-crm" icone={MessagesSquare} titulo={tx('CRM da Recepção')} sub={`${rotPeriodo} · ${tx('meta de {qtd} pessoas por dia', { qtd: META_PESSOAS_DIA })}`}>
            {crm ? (
                <>
                    <Faixa>
                        <Numero rotulo={tx('Hoje')} valor={`${crm.pessoasHoje}/${META_PESSOAS_DIA}`} cor={crm.pessoasHoje >= META_PESSOAS_DIA ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-white'} sub={tx('pessoas contatadas')} />
                        <Numero rotulo={tx('Média por dia')} valor={crm.mediaPorDia} sub={tx('{qtd} dias trabalhados', { qtd: crm.diasTrabalhados })} />
                        <Numero rotulo={tx('Dias com meta')} valor={`${crm.diasComMeta}/${crm.diasTrabalhados}`} cor={crm.diasTrabalhados && crm.diasComMeta === crm.diasTrabalhados ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-white'} sub={tx('bateu 150 pessoas')} />
                        <Numero rotulo={tx('Pessoas no período')} valor={crm.totalPessoas} sub={crmAnt ? <span className="inline-flex items-center gap-1"><Variacao v={variacao(crm.totalPessoas, crmAnt.totalPessoas)} />{tx('× mês passado')}</span> : null} />
                        <Numero rotulo={tx('Ações')} valor={crm.acoes} sub={crmAnt ? <span className="inline-flex items-center gap-1"><Variacao v={variacao(crm.acoes, crmAnt.acoes)} />{tx('× mês passado')}</span> : null} />
                        <Numero rotulo={tx('WhatsApp')} valor={crm.whatsapp} />
                        <Numero rotulo={tx('Ligações')} valor={crm.ligacoes} />
                        <Numero rotulo={tx('Sem WhatsApp')} valor={crm.semWhatsapp} cor={crm.semWhatsapp > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-white'} titulo={tx('Contato registrado sem WhatsApp nem ligação (precisa de justificativa)')} />
                        <Numero rotulo={tx('Fechou')} valor={crm.fechou} cor="text-emerald-600 dark:text-emerald-400" />
                    </Faixa>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <Quadro icone={BarChart3} cor="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" titulo={tx('Pessoas contatadas por dia')} sub={tx('verde = bateu a meta de 150')} className="lg:col-span-2">
                            {crm.dias.length ? (
                                <BarrasSimples itens={crm.dias.slice(-31)} valor={d => d.pessoas} meta={META_PESSOAS_DIA}
                                    rotulo={d => d.dia.slice(8, 10)} corDe={d => (d.pessoas >= META_PESSOAS_DIA ? COR_CONFERIDA : '#2563eb')}
                                    dica={d => `${dataBr(d.dia)}: ${tx('{qtd} pessoas', { qtd: d.pessoas })}`} />
                            ) : <Vazio>{tx('Nenhum contato no período.')}</Vazio>}
                            {crm.ultimaAcao && <p className="mt-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tx('Última ação no CRM: {quando}', { quando: dataHora(crm.ultimaAcao) })}</p>}
                        </Quadro>
                        <Quadro icone={Target} cor="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" titulo={tx('Como as pessoas respondem')} sub={tx('marcado em "Como foi o contato?"')}>
                            <div className="space-y-2.5">
                                <div className="flex items-baseline justify-between"><span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{tx('% de resposta')}</span>
                                    <span className={`text-lg font-extrabold tabular-nums ${crm.percResposta === null ? 'text-slate-400' : crm.percResposta >= 0.5 ? 'text-emerald-600 dark:text-emerald-400' : crm.percResposta >= 0.25 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>{porcento(crm.percResposta)}</span></div>
                                {[['Responderam', crm.responderam], ['Não responderam', crm.naoResponderam], ['Interessados', crm.interessados], ['Boas-vindas enviadas', crm.boasVindas]].map(([rot, v]) => (
                                    <p key={rot} className="flex items-center justify-between text-[12px] font-semibold text-slate-600 border-t border-slate-100 pt-2 dark:text-slate-300 dark:border-slate-800"><span>{tx(rot)}</span><span className="tabular-nums font-black">{v}</span></p>
                                ))}
                            </div>
                        </Quadro>
                    </div>
                    {Object.keys(crm.porTipo).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(crm.porTipo).sort((a, b) => b[1] - a[1]).map(([tipo, qtd]) => (
                                <span key={tipo} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold uppercase text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300">
                                    {tx(TIPOS_CONTATO[tipo] || tipo)} <span className="tabular-nums text-slate-800 dark:text-white">{qtd}</span>
                                </span>
                            ))}
                        </div>
                    )}
                </>
            ) : <Vazio>{carregando ? tx('Carregando...') : tx('Não deu para ler o CRM.')}</Vazio>}
        </Secao>
    );

    const secaoVendas = (
        <Secao id="sec-vendas" icone={ShoppingCart} titulo={tx('Vendas e comissão')} sub={rotPeriodo}>
            {parecidos.length > 0 && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[12px] font-semibold text-amber-900 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-200">
                    <p className="font-black flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />{tx('Também há vendas com o nome escrito de outro jeito (últimos 6 meses):')}</p>
                    <p className="mt-1">{parecidos.slice(0, 5).map(p => tx('{nome} ({qtd})', { nome: p.nome, qtd: p.qtd })).join(' · ')}</p>
                    <p className="mt-1 text-[11px] opacity-80">{tx('Essas vendas não entram nesta Central. Confira se é a mesma pessoa.')}</p>
                </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Quadro icone={TrendingUp} cor="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" titulo={tx('Comparação com o mês passado')}
                    sub={anterior ? tx('mesmas datas: {de} a {ate}', { de: dataCurta(anterior.inicio), ate: dataCurta(anterior.fim) }) : tx('escolha um período com início e fim')}>
                    {ant ? (
                        <table className="w-full">
                            <thead><tr><th className={th}></th><th className={`${th} text-right`}>{tx('Agora')}</th><th className={`${th} text-right`}>{tx('Mês passado')}</th><th className={`${th} text-right`}>{tx('Variação')}</th></tr></thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {[['Comissão', r.comissao, ant.comissao, true], ['Vendas', r.lancamentos, ant.lancamentos], ['Planos', r.planos, ant.planos], ['Nutri (adicional)', r.nutri, ant.nutri], ['Produtos', r.produtos, ant.produtos], ['Serviços', r.servicos, ant.servicos]].map(([rot, a, b, din]) => (
                                    <tr key={rot}>
                                        <td className={`${td} uppercase text-[11px] font-bold text-slate-500 dark:text-slate-400`}>{tx(rot)}</td>
                                        <td className={`${td} text-right tabular-nums font-black`}>{din ? dinheiro(a) : a}</td>
                                        <td className={`${td} text-right tabular-nums text-slate-500 dark:text-slate-400`}>{din ? dinheiro(b) : b}</td>
                                        <td className={`${td} text-right`}><Variacao v={variacao(a, b)} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : <Vazio>{tx('Sem comparação para este período.')}</Vazio>}
                </Quadro>
                <Quadro icone={Trophy} cor="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" titulo={tx('Posição na unidade')} sub={tx('pela comissão do período · {unidade}', { unidade: c.unidade || '—' })}>
                    {posicao?.posicao ? (
                        <div className="space-y-2">
                            <p className="text-lg font-extrabold text-slate-800 dark:text-white">{tx('{posicao}º de {total}', { posicao: posicao.posicao, total: posicao.total })}</p>
                            {posicao.lider && posicao.posicao > 1 && <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">{tx('1º lugar: {nome} ({valor})', { nome: posicao.lider.nome, valor: dinheiro(posicao.lider.comissao) })}</p>}
                            {posicao.posicao === 1 && <p className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400">{tx('Primeiro lugar da unidade no período.')}</p>}
                        </div>
                    ) : <Vazio>{!faixa.inicio ? tx('Escolha um período para ver a posição.') : posicao ? tx('Sem vendas na unidade no período.') : tx('Carregando...')}</Vazio>}
                </Quadro>
                <Quadro icone={BarChart3} cor="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" titulo={tx('Comissão por dia')} sub={rotPeriodo}>
                    {r.porDia.length ? (
                        <div className="flex items-end gap-[2px] h-28" role="img" aria-label={tx('Comissão por dia')}>
                            {r.porDia.slice(-45).map(d => (
                                <div key={d.dia} className="flex-1 min-w-[4px] h-full flex items-end" title={`${dataBr(d.dia)}: ${d.vendas === 1 ? tx('1 venda') : tx('{qtd} vendas', { qtd: d.vendas })} · ${dinheiro(d.comissao)}`}>
                                    <span className="block w-full rounded-t-[4px]" style={{ height: `${Math.max(4, (d.comissao / maxDia) * 100)}%`, background: COR_CONFERIDA }} />
                                </div>
                            ))}
                        </div>
                    ) : <Vazio>{tx('Nenhuma venda no período.')}</Vazio>}
                    {r.porDia.length > 0 && <p className="mt-2 text-[10px] font-semibold text-slate-400">{tx('{dias} dias com venda · média {valor} por dia com venda', { dias: r.porDia.length, valor: dinheiro(r.comissao / r.porDia.length) })}</p>}
                </Quadro>
                <Quadro icone={Receipt} cor="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400" titulo={tx('O que mais vende')} sub={rotPeriodo}>
                    {r.maisVendidos.length ? (
                        <ul className="space-y-2.5">
                            {r.maisVendidos.slice(0, 6).map(i => (
                                <li key={i.nome}>
                                    <div className="flex items-center justify-between gap-2 text-[12px] font-bold text-slate-700 dark:text-slate-200">
                                        <span className="truncate uppercase" title={i.nome}>{i.nome}</span>
                                        <span className="shrink-0 tabular-nums">{i.qtd} · <span className="text-slate-500 dark:text-slate-400">{dinheiro(i.comissao)}</span></span>
                                    </div>
                                    <Barra valor={i.qtd} total={maxItem} cor="bg-indigo-500" />
                                </li>
                            ))}
                        </ul>
                    ) : <Vazio>{tx('Nenhuma venda no período.')}</Vazio>}
                </Quadro>
            </div>
        </Secao>
    );

    const secaoMeses = (
        <Secao id="sec-meses" icone={Wallet} titulo={tx('Comissão mês a mês')} sub={tx('não segue o período: mês a mês até hoje')}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Quadro icone={Wallet} cor="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" titulo={tx('Comissão dos últimos 6 meses')} className="lg:col-span-2">
                    <div className="flex flex-wrap items-center gap-4 mb-3 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: COR_CONFERIDA }} />{tx('Conferida (entra no pagamento)')}</span>
                        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: COR_AGUARDANDO }} />{tx('Aguardando conferência')}</span>
                    </div>
                    <div className="h-60" role="img" aria-label={tx('Comissão dos últimos 6 meses')}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={meses} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
                                <CartesianGrid vertical={false} stroke={escuro ? '#1e293b' : '#f1f5f9'} />
                                <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: escuro ? '#94a3b8' : '#64748b' }} />
                                <YAxis tickLine={false} axisLine={false} width={70} tickFormatter={dinheiroCurto} tick={{ fontSize: 10, fontWeight: 600, fill: escuro ? '#64748b' : '#94a3b8' }} />
                                <Tooltip content={<DicaGrafico />} cursor={{ fill: escuro ? 'rgba(148,163,184,0.08)' : 'rgba(148,163,184,0.12)' }} />
                                <Bar dataKey="conferida" stackId="c" fill={COR_CONFERIDA} stroke={escuro ? '#0f172a' : '#ffffff'} strokeWidth={2} />
                                <Bar dataKey="aguardando" stackId="c" fill={COR_AGUARDANDO} stroke={escuro ? '#0f172a' : '#ffffff'} strokeWidth={2} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Quadro>
                <Quadro icone={Building} cor="bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400" titulo={tx('Como recebe')}>
                    <div className="text-[13px] font-semibold">{comoRecebe()}</div>
                    <p className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {tx('O pagamento das comissões é feito principalmente pelo Banco Inter.')} {tx('Conferida = já entrou no pagamento. Aguardando = ainda não foi conferida no Fechamento.')}
                    </p>
                </Quadro>
            </div>
            <div className="bg-white rounded-xl border border-slate-200/80 overflow-x-auto custom-scrollbar dark:bg-slate-900 dark:border-slate-800">
                <table className="w-full min-w-[520px]">
                    <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-800/60 dark:border-slate-800">
                        <tr><th className={th}>{tx('Mês')}</th><th className={`${th} text-right`}>{tx('Vendas')}</th><th className={`${th} text-right`}>{tx('Comissão')}</th><th className={`${th} text-right`}>{tx('Conferida')}</th><th className={`${th} text-right`}>{tx('Aguardando')}</th>
                            {temPagamentos && <th className={th}>{tx('Pagamento')}</th>}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {[...meses].reverse().map(m => {
                            const pg = temPagamentos ? situacaoPagamentoDoMes({ mes: m.mes, vendas, pagamentos: dados.pagamentos }) : null;
                            return (
                                <tr key={m.mes}>
                                    <td className={`${td} uppercase font-bold`}>{m.rotulo}</td>
                                    <td className={`${td} text-right tabular-nums`}>{m.vendas}</td>
                                    <td className={`${td} text-right tabular-nums font-black`}>{dinheiro(m.total)}</td>
                                    <td className={`${td} text-right tabular-nums text-emerald-700 dark:text-emerald-400`}>{dinheiro(m.conferida)}</td>
                                    <td className={`${td} text-right tabular-nums ${m.aguardando > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400'}`}>{dinheiro(m.aguardando)}</td>
                                    {temPagamentos && (
                                        <td className={`${td} text-[11px]`}>
                                            {pg.situacao === 'aprovado' && <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400" title={tx('Aprovado por {nome}', { nome: pg.aprovadoPor || '—' })}><CheckCircle2 className="w-3.5 h-3.5" />{tx('Aprovado em {data}', { data: dataBr(String(pg.aprovadoEm || '').slice(0, 10)) })}</span>}
                                            {pg.situacao === 'parcial' && <span className="font-bold text-amber-700 dark:text-amber-400" title={tx('Vendeu em mais de uma unidade e nem todas aprovaram o pagamento')}>{tx('Parcial')}</span>}
                                            {pg.situacao === 'aberto' && <span className="font-semibold text-slate-400">{tx('Não aprovado')}</span>}
                                            {pg.situacao === 'sem_vendas' && <span className="text-slate-300 dark:text-slate-600">—</span>}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                        <tr className="bg-slate-50 dark:bg-slate-800/60">
                            <td className={`${td} uppercase font-black`}>{tx('6 meses')}</td>
                            <td className={`${td} text-right tabular-nums font-black`}>{meses.reduce((s, m) => s + m.vendas, 0)}</td>
                            <td className={`${td} text-right tabular-nums font-black`}>{dinheiro(meses.reduce((s, m) => s + m.total, 0))}</td>
                            <td className={`${td} text-right tabular-nums font-black text-emerald-700 dark:text-emerald-400`}>{dinheiro(meses.reduce((s, m) => s + m.conferida, 0))}</td>
                            <td className={`${td} text-right tabular-nums font-black text-amber-700 dark:text-amber-400`}>{dinheiro(meses.reduce((s, m) => s + m.aguardando, 0))}</td>
                            {temPagamentos && <td className={td} />}
                        </tr>
                    </tbody>
                </table>
            </div>
        </Secao>
    );

    const secaoAvaliacoes = mostrarAvaliacoes && (
        <Secao id="sec-avaliacoes" icone={Dumbbell} titulo={tx('Avaliações físicas')} sub={rotPeriodo}>
            {aval ? (
                <>
                    <Faixa>
                        <Numero rotulo={tx('Avaliações')} valor={aval.total} sub={avalAnt ? <span className="inline-flex items-center gap-1"><Variacao v={variacao(aval.total, avalAnt.total)} />{tx('× mês passado')}</span> : null} />
                        <Numero rotulo={tx('Alunos avaliados')} valor={aval.alunos} />
                        <Numero rotulo={tx('Incompletas')} valor={aval.incompletas} cor={aval.incompletas ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-white'} titulo={tx('Sem bioimpedância ou sem anamnese')} />
                        <Numero rotulo={tx('Última avaliação')} valor={aval.ultimaEm ? dataBr(aval.ultimaEm) : '—'} sub={tx('nos últimos 6 meses')} />
                    </Faixa>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Quadro icone={BarChart3} cor="bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400" titulo={tx('Avaliações por mês')} sub={tx('últimos 6 meses')}>
                            <BarrasSimples itens={aval.porMes} valor={m => m.qtd} rotulo={m => m.rotulo} corDe={() => '#ea580c'}
                                dica={m => `${m.rotulo}: ${m.qtd === 1 ? tx('1 avaliação') : tx('{qtd} avaliações', { qtd: m.qtd })}`} />
                        </Quadro>
                        <Quadro icone={Dumbbell} cor="bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400" titulo={tx('Últimas avaliações')} sub={rotPeriodo}>
                            {aval.ultimas.length ? aval.ultimas.slice(0, 8).map(a => (
                                <p key={a.id} className="flex items-center justify-between gap-2 text-[12px] font-semibold text-slate-600 py-1.5 border-b border-slate-100 last:border-0 dark:text-slate-300 dark:border-slate-800">
                                    <span className="truncate uppercase">{a.aluno}{pendenciasAvaliacao(a).length > 0 && <span className="ml-1.5 text-[10px] font-black text-amber-600 dark:text-amber-400">⚠ {tx('incompleta')}</span>}</span>
                                    <span className="shrink-0 text-[11px] text-slate-400">{dataCurta(a.data)}{unidadesNasVendas > 1 || a.unidade !== c.unidade ? ` · ${a.unidade || ''}` : ''}</span>
                                </p>
                            )) : <Vazio>{tx('Nenhuma avaliação no período.')}</Vazio>}
                        </Quadro>
                    </div>
                </>
            ) : <Vazio>{carregando ? tx('Carregando...') : tx('Não deu para ler as avaliações.')}</Vazio>}
        </Secao>
    );

    const secaoVisitantes = (
        <Secao id="sec-visitantes" icone={Users} titulo={tx('Visitantes atendidos')} sub={rotPeriodo}>
            {visitantes ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Faixa>
                        <Numero rotulo={tx('Atendidos')} valor={visitantes.total} />
                        <Numero rotulo={tx('Fecharam')} valor={visitantes.fechados} cor="text-emerald-600 dark:text-emerald-400" />
                        <Numero rotulo={tx('Conversão')} valor={visitantes.total ? `${Math.round((visitantes.fechados / visitantes.total) * 100)}%` : '—'} />
                    </Faixa>
                    <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 px-4 py-2 dark:bg-slate-900 dark:border-slate-800">
                        {(dados?.visitantes || []).slice(-8).reverse().map(l => (
                            <p key={l.id} className="flex items-center justify-between gap-2 text-[12px] font-semibold text-slate-600 py-1.5 border-b border-slate-100 last:border-0 dark:text-slate-300 dark:border-slate-800">
                                <span className="truncate uppercase">{l.nome}</span>
                                <span className="shrink-0 text-[11px] text-slate-400">{tx(l.status || '—')} · {dataCurta(String(l.created_at || '').slice(0, 10))}</span>
                            </p>
                        ))}
                        {visitantes.total === 0 && <Vazio>{tx('Nenhum visitante atendido no período.')}</Vazio>}
                    </div>
                </div>
            ) : <Vazio>{carregando ? tx('Carregando...') : tx('Não deu para ler os visitantes.')}</Vazio>}
        </Secao>
    );

    const secaoLista = (
        <Secao id="sec-lista" icone={Receipt} titulo={tx('Lista de vendas')} sub={rotPeriodo}>
            <section className="bg-white rounded-xl border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    {[['TODAS', 'Todas', r.doPeriodo.length], ['PLANO', 'Planos', contagemCategoria.PLANO], ['PRODUTO', 'Produtos', contagemCategoria.PRODUTO], ['SERVICO', 'Serviços', contagemCategoria.SERVICO]].map(([id, rot, qtd]) => (
                        <button key={id} type="button" onClick={() => { setFiltroVendas(id); setMostrar(20); }} aria-pressed={filtroVendas === id}
                            className={`h-8 px-3 rounded-lg text-[11px] font-bold uppercase tracking-wider ${filtroVendas === id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>
                            {tx(rot)} <span className="opacity-70">{qtd}</span>
                        </button>
                    ))}
                    <span className="ml-auto text-[11px] font-bold text-slate-500 dark:text-slate-400">{tx('Total')}: {dinheiro(vendasDaLista.reduce((s, v) => s + comissaoDe(v), 0))}</span>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full min-w-[760px]">
                        <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-800/60 dark:border-slate-800">
                            <tr>
                                <th className={th}>{tx('Data')}</th><th className={th}>{tx('Aluno')}</th><th className={th}>CPF</th><th className={th}>{tx('Item')}</th>
                                <th className={`${th} text-right`}>{tx('Qtd')}</th><th className={`${th} text-right`}>{tx('Comissão')}</th><th className={th}>{tx('Conferência')}</th>
                                {unidadesNasVendas > 1 && <th className={th}>{tx('Unidade')}</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {vendasDaLista.slice(0, mostrar).map(v => (
                                <tr key={v.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                                    <td className={`${td} whitespace-nowrap tabular-nums`}>{dataBr(diaDaVenda(v))}</td>
                                    <td className={td}><span className="inline-flex items-center gap-1 uppercase">{v.nome_aluno || '—'}{v.nome_aluno && <CopyButton textToCopy={v.nome_aluno} label={tx('Copiar nome')} />}</span></td>
                                    <td className={`${td} font-mono whitespace-nowrap`}>{v.cpf ? <span className="inline-flex items-center gap-1">{v.cpf}<CopyButton textToCopy={soNumeros(v.cpf)} label={tx('Copiar CPF')} /></span> : '—'}</td>
                                    <td className={`${td} uppercase`}>{v.produto}</td>
                                    <td className={`${td} text-right tabular-nums`}>{parseInt(v.quantidade) || 1}</td>
                                    <td className={`${td} text-right tabular-nums font-black`}>{dinheiro(comissaoDe(v))}</td>
                                    <td className={td}>{v.conferiu === true
                                        ? <span className="inline-flex items-center gap-1 text-emerald-700 text-[11px] font-bold dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />{tx('Conferida')}</span>
                                        : <span className="inline-flex items-center gap-1 text-amber-700 text-[11px] font-bold dark:text-amber-400"><Clock className="w-3.5 h-3.5" />{tx('Aguardando')}</span>}</td>
                                    {unidadesNasVendas > 1 && <td className={`${td} uppercase text-[11px]`}>{v.unidade}</td>}
                                </tr>
                            ))}
                            {vendasDaLista.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-[11px] font-bold uppercase tracking-widest text-slate-400">{carregando ? tx('Carregando...') : tx('Nenhuma venda no período.')}</td></tr>}
                        </tbody>
                    </table>
                </div>
                {vendasDaLista.length > mostrar && (
                    <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800">
                        <button type="button" onClick={() => setMostrar(m => m + 50)} className="text-[11px] font-bold uppercase tracking-wider text-blue-700 hover:underline dark:text-blue-400">
                            {tx('Mostrar mais ({qtd} restantes)', { qtd: vendasDaLista.length - mostrar })}
                        </button>
                    </div>
                )}
            </section>
        </Secao>
    );

    const secaoCadastro = (
        <Secao id="sec-cadastro" icone={UserRound} titulo={tx('Cadastro')}>
            {problemas.length > 0 && ativo && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:bg-amber-500/10 dark:border-amber-500/30">
                    <p className="text-[12px] font-black text-amber-900 flex items-center gap-1.5 dark:text-amber-200"><AlertTriangle className="w-3.5 h-3.5" />{tx('Cadastro incompleto')}</p>
                    <ul className="mt-1 text-[12px] font-semibold text-amber-800 list-disc ml-5 dark:text-amber-300">{problemas.map(p => <li key={p}>{tx(PROBLEMAS_CADASTRO[p])}</li>)}</ul>
                    {onEditar
                        ? <button type="button" onClick={() => onEditar(c)} className="mt-2 h-9 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest">{tx('Corrigir')}</button>
                        : <p className="mt-2 text-[11px] font-bold text-amber-800 dark:text-amber-300">{tx('Corrija em Cadastros → Equipe.')}</p>}
                </div>
            )}
            {!temCadastro && (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-bold text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300">
                    {tx('Este nome aparece nas vendas, mas não está cadastrado na Equipe. Cadastre a pessoa (com CPF e Banco Inter) para a comissão ser paga.')}
                </p>
            )}
            <section className="bg-white rounded-xl border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 dark:bg-slate-900 dark:border-slate-800">
                {[
                    ['Nome completo', c.nome, c.nome],
                    ['CPF', c.cpf, soNumeros(c.cpf)],
                    ['Telefone / WhatsApp', telOk ? telefoneBonito(c.telefone) : null, soNumeros(c.telefone)],
                    ['Setor / Cargo', c.role],
                    ['Unidade', c.unidade],
                    ['Turno', recepcao ? (turno === 'MANHA' ? tx('Manhã (7h às 13h)') : turno === 'NOITE' ? tx('Noite (13h às 21h)') : tx('Sem turno')) : null],
                    ['Situação', temCadastro ? (ativo ? tx('Ativo') : tx('Desligado')) : tx('Sem cadastro na Equipe')],
                    ...(!ativo && temCadastro ? [['Desligado em', desligadoEm], ['Motivo do desligamento', c.motivo_desligamento ? tx(c.motivo_desligamento) : null]] : []),
                    ['Forma de recebimento', c.tipo_conta === 'INTER' ? tx('Banco Inter') : c.tipo_conta === 'PIX_CPF' ? tx('PIX (chave CPF)') : null],
                    ...(ehAdmin && c.tipo_conta === 'INTER' ? [['Conta Banco Inter', c.conta_inter, c.conta_inter]] : []),
                ].map(([rot, valor, copiar]) => (
                    <div key={rot} className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{tx(rot)}</p>
                        <p className="text-[13px] font-bold text-slate-800 uppercase flex items-center gap-1 dark:text-white">
                            {valor || <span className="text-slate-400 normal-case font-semibold">—</span>}
                            {valor && copiar && <CopyButton textToCopy={copiar} label={tx('Copiar')} />}
                        </p>
                    </div>
                ))}
            </section>
        </Secao>
    );

    return (
        <div className="fixed inset-0 z-[210] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-3 md:p-8 overflow-y-auto animate-[fadeIn_0.15s_ease-out]" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
            <div className="w-full min-w-0 max-w-6xl my-auto bg-[#F8FAFC] dark:bg-slate-950 rounded-[20px] p-5 md:p-6 flex flex-col shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="titulo-central-colaborador">

                <div className="mb-5 flex items-center">
                    <button type="button" onClick={onFechar}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50 transition-colors shadow-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/60">
                        <ArrowLeft className="w-3.5 h-3.5" />{tx('Fechar')}
                    </button>
                </div>

                {/* CABEÇALHO */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 pb-5 mb-5 border-b border-slate-200/80 dark:border-slate-800">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto min-w-0">
                        <div className="relative shrink-0">
                            <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-black text-white shadow-sm" style={{ background: ativo ? setor.cor : '#94a3b8' }}>
                                {iniciais(c.nome)}
                            </div>
                            {ativo && temCadastro && <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-sm dark:border-slate-950" title={tx('Ativo')} />}
                        </div>
                        <div className="flex flex-col w-full min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                <h2 id="titulo-central-colaborador" className="text-[19px] font-extrabold text-slate-800 uppercase tracking-tight dark:text-white">{c.nome}</h2>
                                <CopyButton textToCopy={c.nome} label={tx('Copiar nome')} />
                                {c.role && <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-slate-200 bg-white text-slate-600 text-[10px] font-bold uppercase tracking-wider dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"><span className="w-2 h-2 rounded-full" style={{ background: setor.cor }} />{c.role}</span>}
                                {recepcao && turno === 'MANHA' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-bold uppercase dark:bg-amber-500/10 dark:text-amber-300"><Sun className="w-3 h-3" />{tx('Manhã')}</span>}
                                {recepcao && turno === 'NOITE' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold uppercase dark:bg-blue-500/10 dark:text-blue-300"><Moon className="w-3 h-3" />{tx('Noite')}</span>}
                                {temCadastro && (ativo
                                    ? <span className="px-2 py-0.5 rounded-md border bg-emerald-50 border-emerald-200 text-emerald-700 text-[10px] font-bold uppercase tracking-wider dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300">{tx('Ativo')}</span>
                                    : <span className="px-2 py-0.5 rounded-md border bg-rose-50 border-rose-200 text-rose-700 text-[10px] font-bold uppercase tracking-wider dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300" title={c.motivo_desligamento ? tx(c.motivo_desligamento) : undefined}>
                                        {tx('Desligado')}{desligadoEm ? ` · ${tx('em {data}', { data: desligadoEm })}` : ''}
                                    </span>)}
                                {problemas.length > 0 && ativo && (
                                    <button type="button" onClick={() => (onEditar ? onEditar(c) : setAba('cadastro'))} title={problemas.map(p => tx(PROBLEMAS_CADASTRO[p])).join(' · ')}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border bg-amber-50 border-amber-300 text-amber-800 text-[10px] font-bold uppercase tracking-wider hover:bg-amber-100 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">
                                        <AlertTriangle className="w-3 h-3" />{tx('Cadastro incompleto')} · {tx('Corrigir')}
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-y-2 gap-x-3 text-[12px] font-medium text-slate-500 dark:text-slate-400">
                                <span className="flex items-center gap-1.5 uppercase font-bold"><MapPin className="w-3.5 h-3.5 text-blue-500" />{c.unidade || '—'}</span>
                                {separador}
                                <span className="flex items-center gap-1.5">
                                    <Phone className="w-3.5 h-3.5 text-emerald-500" />
                                    {telOk ? <>
                                        {telefoneBonito(c.telefone)}<CopyButton textToCopy={soNumeros(c.telefone)} label={tx('Copiar telefone')} />
                                        <button type="button" onClick={() => abrirNoWhatsApp(c.telefone, '')} title={tx('Abrir no WhatsApp')} aria-label={tx('Abrir no WhatsApp')}
                                            className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"><MessageCircle className="w-3.5 h-3.5" /></button>
                                    </> : <span className="text-rose-600 dark:text-rose-400">{tx('sem telefone')}</span>}
                                </span>
                                {separador}
                                <span className="flex items-center gap-1.5 font-mono">
                                    CPF {c.cpf || <span className="font-sans text-rose-600 dark:text-rose-400">{tx('não informado')}</span>}
                                    {c.cpf && <CopyButton textToCopy={soNumeros(c.cpf)} label={tx('Copiar CPF')} />}
                                </span>
                                {separador}
                                <span className="flex items-center gap-1.5 basis-full sm:basis-auto">{comoRecebe()}</span>
                            </div>
                        </div>
                    </div>
                    {onEditar && temCadastro && (
                        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto shrink-0">
                            <button type="button" onClick={() => onEditar(c)} className={`${botaoTopo} bg-blue-600 border-blue-600 text-white hover:bg-blue-700`}>
                                <Pencil className="w-3.5 h-3.5" />{tx('Editar cadastro')}
                            </button>
                        </div>
                    )}
                </div>

                {/* CARTÕES (Recepção ganha "CRM hoje"; quem avalia ganha "Avaliações") */}
                <div className={`grid grid-cols-2 gap-3 mb-5 ${recepcao || mostrarAvaliacoes ? 'lg:grid-cols-6' : 'lg:grid-cols-5'}`}>
                    {recepcao && <Cartao icone={MessagesSquare} cor="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" titulo={tx('CRM hoje')} valor={crm ? `${crm.pessoasHoje}/${META_PESSOAS_DIA}` : '…'}
                        sub={crm ? tx('média {qtd} por dia no período', { qtd: crm.mediaPorDia }) : tx('Carregando...')} alerta={crm && crm.pessoasHoje < META_PESSOAS_DIA / 2 ? true : null} />}
                    <Cartao icone={Wallet} cor="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" titulo={tx('Comissão')} valor={carregando && !dados ? '…' : dinheiro(r.comissao)}
                        sub={ant ? <span className="inline-flex items-center gap-1"><Variacao v={variacao(r.comissao, ant.comissao)} /> {tx('× mês passado')}</span> : rotPeriodo} />
                    <Cartao icone={ShoppingCart} cor="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" titulo={tx('Vendas')} valor={r.lancamentos}
                        sub={tx('{produtos} produtos · {servicos} serviços', { produtos: r.produtos, servicos: r.servicos })} />
                    <Cartao icone={Layers} cor="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400" titulo={tx('Planos')} valor={r.planos}
                        sub={tx('+{qtd} Nutri (adicional)', { qtd: r.nutri })} />
                    {!recepcao && mostrarAvaliacoes && <Cartao icone={Dumbbell} cor="bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400" titulo={tx('Avaliações')} valor={aval ? aval.total : '…'}
                        sub={aval ? (aval.incompletas ? tx('{qtd} incompletas', { qtd: aval.incompletas }) : tx('{qtd} alunos', { qtd: aval.alunos })) : tx('Carregando...')} alerta={aval && aval.incompletas > 0} />}
                    <Cartao icone={CheckCircle2} cor="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" titulo={tx('Conferida')} valor={dinheiro(r.conferida)}
                        sub={r.aguardando > 0 ? tx('{valor} aguardando conferência', { valor: dinheiro(r.aguardando) }) : tx('tudo conferido')} alerta={r.aguardando > 0} />
                    <Cartao icone={Clock} cor="bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400" titulo={tx('Última venda')} valor={textoUltima}
                        sub={r.ultimaVenda ? dataBr(r.ultimaVenda) : tx('nos últimos 6 meses')} alerta={ultimaAlerta} />
                </div>

                {/* ABAS + PERÍODO (o período vale para todas as abas) */}
                <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-5">
                    <div className="flex flex-1 bg-white p-1.5 rounded-xl border border-slate-200/80 overflow-x-auto custom-scrollbar shadow-sm dark:bg-slate-900 dark:border-slate-800" role="tablist">
                        {abas.map(([id, rotulo, Icone]) => {
                            const sel = abaMostrada === id;
                            return (
                                <button key={id} type="button" role="tab" aria-selected={sel} onClick={() => setAba(id)}
                                    className={`flex-1 min-w-[104px] px-3 py-2.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 whitespace-nowrap outline-none ${sel ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'}`}>
                                    <Icone className="w-3.5 h-3.5" strokeWidth={sel ? 2.5 : 2} />{tx(rotulo)}
                                    {id === 'geral' && itensComProblema > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black inline-flex items-center justify-center">{itensComProblema}</span>}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {carregando && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                        {dados?.lidoEm && !carregando && <span className="text-[10px] font-semibold text-slate-400">{tx('atualizado às {hora}', { hora: horaDe(dados.lidoEm) })}</span>}
                        <SeletorPeriodo {...periodo.propsSeletor} />
                    </div>
                </div>

                {dados?.erros?.length > 0 && (
                    <p className="mb-4 text-[12px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-center gap-1.5 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{tx('Não deu para ler: {partes}. O resto está certo.', { partes: dados.erros.map(e => tx(e)).join(', ') })}
                    </p>
                )}

                <div className="min-h-[300px]">
                    {/* VISÃO GERAL: quem é a pessoa + "Cadastro em dia?" (o que está certo e o que precisa corrigir) */}
                    {abaMostrada === 'geral' && (
                        <div className="space-y-5">
                            <Faixa>
                                <Numero rotulo={tx('Unidade')} valor={c.unidade || '—'} />
                                <Numero rotulo={tx('Setor')} valor={c.role || '—'} />
                                <Numero rotulo={tx('Na equipe desde')} valor={c.created_at ? dataBr(String(c.created_at).slice(0, 10)) : '—'} />
                                <Numero rotulo={tx('Última venda')} valor={textoUltima} cor={ultimaAlerta ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-white'} />
                                {pagMesPassado && <Numero rotulo={tx('Pagamento do mês passado')}
                                    valor={pagMesPassado.situacao === 'aprovado' ? tx('Aprovado') : pagMesPassado.situacao === 'parcial' ? tx('Parcial') : pagMesPassado.situacao === 'aberto' ? tx('Não aprovado') : '—'}
                                    cor={pagMesPassado.situacao === 'aprovado' ? 'text-emerald-600 dark:text-emerald-400' : pagMesPassado.situacao === 'aberto' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-white'}
                                    sub={pagMesPassado.aprovadoEm ? tx('em {data}', { data: dataBr(String(pagMesPassado.aprovadoEm).slice(0, 10)) }) : null} />}
                                {recepcao && crm && <Numero rotulo={tx('CRM hoje')} valor={`${crm.pessoasHoje}/${META_PESSOAS_DIA}`} />}
                                {mostrarAvaliacoes && aval && <Numero rotulo={tx('Avaliações')} valor={aval.total} sub={rotPeriodo} />}
                            </Faixa>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3 dark:text-slate-400">
                                    {tx('Cadastro em dia?')} · {itensComProblema === 0 ? tx('tudo certo') : tx('{qtd} de {total} itens precisam de atenção', { qtd: itensComProblema, total: itensCadastro.length })}
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {itensCadastro.map(item => (
                                        <div key={item.id} className={`bg-white rounded-xl border p-4 flex items-start gap-3 dark:bg-slate-900 ${item.ok ? 'border-slate-200/80 dark:border-slate-800' : item.aviso ? 'border-amber-300 dark:border-amber-500/40' : 'border-rose-200 dark:border-rose-500/30'}`}>
                                            {item.ok
                                                ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
                                                : <AlertTriangle className={`w-5 h-5 shrink-0 ${item.aviso ? 'text-amber-500' : 'text-rose-500'}`} />}
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[12px] font-black uppercase tracking-wide text-slate-800 dark:text-white">{tx(item.titulo)}</p>
                                                <p className={`text-[12px] font-semibold ${item.ok ? 'text-slate-500 dark:text-slate-400' : item.aviso ? 'text-amber-700 dark:text-amber-300' : 'text-rose-600 dark:text-rose-400'}`}>{item.detalhe}</p>
                                                {!item.ok && (
                                                    ['cpf', 'telefone', 'conta', 'setor', 'turno'].includes(item.id) && onEditar
                                                        ? <button type="button" onClick={() => onEditar(c)} className="mt-2 h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest">{tx('Corrigir')}</button>
                                                        : item.id === 'conferencia'
                                                            ? <button type="button" onClick={() => setAba('vendas')} className="mt-1 text-[11px] font-bold uppercase tracking-wider text-blue-700 hover:underline dark:text-blue-400">{tx('Ver as vendas')}</button>
                                                            : <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{item.resolver}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PANORAMA: tudo da pessoa numa página só (a parte principal primeiro: Recepção = CRM) */}
                    {abaMostrada === 'panorama' && (
                        <div className="space-y-8">
                            {secaoCrm}
                            {secaoVendas}
                            {secaoMeses}
                            {secaoAvaliacoes}
                            {secaoVisitantes}
                        </div>
                    )}
                    {abaMostrada === 'crm' && <div className="space-y-8">{secaoCrm}{secaoVisitantes}</div>}
                    {abaMostrada === 'vendas' && <div className="space-y-8">{secaoLista}{secaoVendas}</div>}
                    {abaMostrada === 'comissao' && secaoMeses}
                    {abaMostrada === 'avaliacoes' && secaoAvaliacoes}
                    {abaMostrada === 'cadastro' && secaoCadastro}
                </div>
            </div>
        </div>
    );
};

export default FichaColaborador;
