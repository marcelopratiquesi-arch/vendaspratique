import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../supabaseClient.js';
import { 
    Dumbbell, ChevronRight, ListChecks, Activity, Scale, Percent, FileText, Search, Loader2,
    Eye, X, ChevronLeft, TrendingUp, TrendingDown, Minus, HeartPulse, Droplet, CheckSquare, AlertCircle, User, Trash2
} from 'lucide-react';
import { useTotalLixeiraAvaliacoes } from './lixeira.js';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { tx, localeAtual } from '../../i18n/traduzir.js'; 
import { SeletorPeriodo, isoLocal } from '../HistoricoVendas/FiltrosCompactos.jsx';
import { pendenciasAvaliacao } from './utils.js';
import { podeVer } from '../../permissoes/catalogoPermissoes.js';
import { MESES_FILTRO, faixaDoFiltro, rotuloDoFiltro } from '../../components/periodoPadrao.js';
import { consultaSeguraOuDireta } from '../../components/consultaSegura.js';
import { carregarTodasAvaliacoes, cpfCombina, COLUNAS_LISTA, usePerguntasAvaliacao } from './carregarAvaliacoes.js';


// ==========================================
// FUNÇÕES AUXILIARES E DE FORMATAÇÃO
// ==========================================
const getBRDate = () => new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
const formatDateISO = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};
const formatarDataBR = (isoStr) => {
    if (!isoStr) return '-';
    const [y, m, d] = isoStr.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
};
const extrairIniciais = (nome) => {
    if (!nome) return 'AL';
    const partes = String(nome).trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return 'AL';
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
};
const getAvatarColor = (nome) => {
    const colors = ['bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30', 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30', 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/20 dark:text-violet-400 dark:border-violet-500/30', 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30', 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30', 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-400 dark:border-cyan-500/30'];
    if (!nome) return colors[0];
    let hash = 0;
    for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
};
const mascararCPF = (cpf) => {
    if (!cpf) return '';
    const d = String(cpf).replace(/\D/g, '');
    if (d.length !== 11) return cpf;
    return `***.${d.substring(3, 6)}.${d.substring(6, 9)}-**`;
};
const formatarNomeAvaliador = (nome) => {
    const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return 'SISTEMA';
    if (partes.length === 1) return partes[0];
    return `${partes[0]} ${partes[1]}`;
};

// ==========================================
// FUNÇÕES DE APOIO (Bioimpedância e Questionário)
// ==========================================
const parseNum = (val) => {
    if (val === null || val === undefined || String(val).trim() === '') return null;
    const num = parseFloat(String(val).replace(',', '.'));
    return Number.isNaN(num) ? null : num;
};

const fmt = (val, casas = 1) => {
    const n = parseNum(val);
    if (n === null) return null;
    return n.toLocaleString(localeAtual(), { minimumFractionDigits: casas, maximumFractionDigits: casas });
};

const pegar = (obj, ...chaves) => {
    for (const k of chaves) {
        const v = obj?.[k];
        if (v !== null && v !== undefined && String(v).trim() !== '') return v;
    }
    return null;
};

const nomeCurto = (nome) => {
    const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return 'N/I';
    if (partes.length === 1) return partes[0];
    return `${partes[0]} ${partes[partes.length - 1]}`;
};

const gorduraKg = (av) => {
    const direto = parseNum(pegar(av, 'massa_gordura', 'gordura_kg'));
    if (direto !== null) return direto;
    const peso = parseNum(av.peso);
    const pgc = parseNum(av.pgc);
    return peso !== null && pgc !== null ? (peso * pgc) / 100 : null;
};

const massaMuscular = (av) => parseNum(pegar(av, 'mme', 'massa_muscular'));

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

const classeStatus = (status) => {
    const s = semAcento(status);
    if (!s) return 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600';
    if (/SAUDAVEL|NORMAL|OTIM|ADEQUAD/.test(s)) return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
    if (/GRAU II|ESTAGIO 2|ESTAGIO 3|SARCOPENIA|ALTO/.test(s)) return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800';
    if (/LIMITROFE|MODERADO|ESTAGIO 1|ABAIXO|GRAU I|BAIXO/.test(s)) return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800';
    return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600';
};

// 🔥 Indicador de Saúde (Semáforo)
const getIndicadorSaude = (av) => {
    const statuses = [av.smi_status, av.rcq_status, av.gv_status, av.pressao_status, av.hidratacao_status].filter(Boolean).map(s => semAcento(s.toUpperCase()));
    
    let hasAlert = false;
    let hasWarning = false;

    statuses.forEach(s => {
        if (/BAIXO|ALTO|RUIM|ALERTA|ESTAGIO 2|ESTAGIO 3|GRAU II|SARCOPENIA|ACIMA/.test(s)) hasAlert = true;
        else if (/LIMITROFE|MODERADO|ESTAGIO 1|ABAIXO|GRAU I|ATENCAO/.test(s)) hasWarning = true;
    });

    if (hasAlert) return 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]';
    if (hasWarning) return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]';
    return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
};

const pareceId = (k) => /^[0-9a-f-]{16,}$/i.test(k) || /^\d+$/.test(k) || /^q\d+$/i.test(k);

const extrairRespostas = (bruto, perguntasPorId) => {
    let obj = bruto;
    if (typeof bruto === 'string') {
        try { obj = JSON.parse(bruto); } catch { return []; }
    }
    const mapa = perguntasPorId || {};

    const montar = (chave, i, item) => {
        const info = chave !== undefined && chave !== null ? mapa[chave] : null;
        let pergunta = null;
        if (item && typeof item === 'object' && !Array.isArray(item)) {
            pergunta = item.pergunta || item.label || item.titulo || item.question || item.texto || null;
        }
        if (!pergunta && info?.pergunta) pergunta = info.pergunta;
        if (!pergunta && chave !== undefined && chave !== null && !pareceId(String(chave))) pergunta = String(chave).replace(/_/g, ' ');
        if (!pergunta) pergunta = pareceId(String(chave ?? '')) ? 'Pergunta removida do formulário' : `Pergunta ${i + 1}`;

        const resposta = (item && typeof item === 'object' && !Array.isArray(item))
            ? (item.resposta ?? item.valor ?? item.value ?? item.answer ?? null)
            : item;

        const ordem = typeof info?.ordem === 'number' ? info.ordem : 9999 + i;
        return { pergunta, resposta, descricao: info?.descricao || '', ordem };
    };

    let lista = [];
    if (Array.isArray(obj)) lista = obj.map((item, i) => montar(item?.id ?? item?.pergunta_id, i, item));
    else if (obj && typeof obj === 'object') lista = Object.entries(obj).map(([k, v], i) => montar(k, i, v));

    return lista.sort((a, b) => a.ordem - b.ordem);
};

const textoResposta = (r) => {
    if (r === null || r === undefined || String(r).trim() === '') return 'Não respondida';
    if (typeof r === 'boolean') return r ? 'Sim' : 'Não';
    if (Array.isArray(r)) return r.length ? r.join(', ') : 'Não respondida';
    return String(r);
};

// ==========================================
// COMPONENTE: SECÕES DO MODAL
// ==========================================
const Secao = ({ icone: Icone, titulo, children }) => (
    <section className="bg-white dark:bg-slate-800 p-5 sm:p-6 rounded-[24px] border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Icone className="w-4 h-4" /> {tx(titulo)}
        </h3>
        {children}
    </section>
);

const Campo = ({ rotulo, valor, destaque }) => (
    <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3">
        <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{tx(rotulo)}</span>
        <span className={`block text-sm font-black ${destaque || 'text-slate-800 dark:text-white'}`}>{valor ?? '—'}</span>
    </div>
);

const LinhaIndicador = ({ rotulo, valor, status }) => (
    <div className="flex items-center justify-between gap-3 py-3 border-b last:border-b-0 border-slate-100 dark:border-slate-700">
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{tx(rotulo)}: <strong className="text-slate-800 dark:text-white">{valor}</strong></span>
        {status && <span className={`px-2 py-0.5 rounded border text-[10px] font-black uppercase tracking-widest shrink-0 ${classeStatus(status)}`}>{status}</span>}
    </div>
);

const Variacao = ({ atual, anterior, tipo }) => {
    if (atual === null || anterior === null) return null;
    const v = atual - anterior;
    if (Math.abs(v) < 0.1) return <span className="text-[10px] font-bold text-slate-400 flex items-center justify-center gap-1"><Minus className="w-3 h-3" />{' '}{tx("Estável")}</span>;
    const subiu = v > 0;
    const bom = tipo === 'gordura' ? !subiu : tipo === 'musculo' ? subiu : null;
    const cor = bom === true ? 'text-emerald-600 dark:text-emerald-400' : bom === false ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400';
    return (
        <span className={`text-[10px] font-black flex items-center justify-center gap-0.5 ${cor}`}>
            {subiu ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />} {subiu ? '+' : ''}{fmt(v)}{' '}{tx("vs anterior")}
        </span>
    );
};

// ==========================================
// COMPONENTE: MODAL VER AVALIAÇÃO
// ==========================================
// Momento da avaliação (para achar a anterior do mesmo aluno)
const momentoAvaliacao = (a) => new Date(a?.created_at || a?.data || 0).getTime();
const SEM_HISTORICO = [];

export const ModalVerAvaliacao = ({ avaliacoes, initialIndex, onClose, perguntasPorId }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const fecharRef = useRef(null);
    const avDaLista = avaliacoes[currentIndex];
    // "vs anterior" = avaliação anterior DO MESMO ALUNO (correção de 09/11/2026: antes comparava com a
    // linha de cima da lista, que era de outro aluno). Lê o histórico do aluno na rede inteira
    // (consulta segura avaliacoes_do_aluno) uma vez por aluno. Esse histórico já vem COMPLETO, então a folha
    // usa ele para mostrar braços, pernas, checklist... (pacote 2: a lista baixa só o que mostra).
    // Sem aluno ligado, lê só aquela avaliação.
    const [historicos, setHistoricos] = useState({});
    const chaveAluno = avDaLista?.aluno_id ? String(avDaLista.aluno_id) : '';
    const chaveBusca = chaveAluno ? `aluno:${chaveAluno}` : (avDaLista?.id ? `id:${avDaLista.id}` : '');
    useEffect(() => {
        if (!chaveBusca || historicos[chaveBusca]) return undefined;
        let ativo = true;
        const pedido = chaveAluno
            ? consultaSeguraOuDireta('avaliacoes_do_aluno', { p_aluno_id: chaveAluno },
                () => supabase.from('avaliacoes_realizadas').select('*').eq('aluno_id', chaveAluno))
            : supabase.from('avaliacoes_realizadas').select('*').eq('id', avDaLista.id);
        pedido.then(({ data, error }) => {
            if (!ativo) return;
            if (error) console.error('Erro ao ler as avaliações do aluno:', error);
            setHistoricos(h => ({ ...h, [chaveBusca]: data || [] }));
        });
        return () => { ativo = false; };
    }, [chaveBusca, chaveAluno, avDaLista, historicos]);
    const historicoAluno = chaveBusca ? historicos[chaveBusca] : SEM_HISTORICO;
    const av = useMemo(() => {
        if (!avDaLista) return avDaLista;
        const completa = (historicoAluno || []).find(a => String(a.id) === String(avDaLista.id));
        return completa ? { ...avDaLista, ...completa } : avDaLista;
    }, [avDaLista, historicoAluno]);
    const anterior = useMemo(() => {
        if (!avDaLista || !chaveAluno || !historicoAluno) return null;
        const quando = momentoAvaliacao(avDaLista);
        return historicoAluno
            .filter(a => String(a.id) !== String(avDaLista.id) && momentoAvaliacao(a) < quando)
            .sort((a, b) => momentoAvaliacao(b) - momentoAvaliacao(a))[0] || null;
    }, [avDaLista, chaveAluno, historicoAluno]);
    const carregandoAnterior = Boolean(chaveBusca) && !historicoAluno;

    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft' && currentIndex > 0) setCurrentIndex(p => p - 1);
            if (e.key === 'ArrowRight' && currentIndex < avaliacoes.length - 1) setCurrentIndex(p => p + 1);
        };
        const overflowAnterior = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKey);
        fecharRef.current?.focus();
        return () => {
            document.body.style.overflow = overflowAnterior;
            window.removeEventListener('keydown', handleKey);
        };
    }, [currentIndex, avaliacoes.length, onClose]);

    if (!av) return null;

    const respostas = extrairRespostas(pegar(av, 'respostas_dinamicas', 'respostas', 'anamnese_respostas'), perguntasPorId);
    const objetivo = pegar(av, 'objetivo', 'objetivo_principal');
    const disponibilidade = pegar(av, 'disponibilidade', 'disponibilidade_semanal');
    const restricoes = pegar(av, 'restricoes', 'restricoes_fisicas', 'lesoes');
    const checklist = av.checklist && typeof av.checklist === 'object' ? av.checklist : null;

    const segmentos = [
        ['Braço esquerdo', pegar(av, 'braco_esq', 'braco_esquerdo')],
        ['Braço direito', pegar(av, 'braco_dir', 'braco_direito')],
        ['Perna esquerda', pegar(av, 'perna_esq', 'perna_esquerda')],
        ['Perna direita', pegar(av, 'perna_dir', 'perna_direita')],
    ];
    const temSegmentos = segmentos.some(([, v]) => parseNum(v) !== null);
    const assimetria = (a, b) => {
        const e = parseNum(a); const d = parseNum(b);
        if (e === null || d === null || Math.max(e, d) === 0) return false;
        return Math.abs(e - d) / Math.max(e, d) > 0.1;
    };
    const assimBracos = assimetria(segmentos[0][1], segmentos[1][1]);
    const assimPernas = assimetria(segmentos[2][1], segmentos[3][1]);

    const sist = pegar(av, 'sistolica', 'pressao_sistolica');
    const diast = pegar(av, 'diastolica', 'pressao_diastolica');
    const indicadores = [
        sist && diast ? { rotulo: tx("Pressão arterial"), valor: `${sist}/${diast} mmHg`, status: av.pressao_status } : null,
        pegar(av, 'rcq') ? { rotulo: tx("Relação cintura-quadril (RCQ)"), valor: fmt(av.rcq, 2), status: av.rcq_status } : null,
        pegar(av, 'gv') ? { rotulo: tx("Gordura visceral"), valor: av.gv, status: av.gv_status } : null,
        pegar(av, 'agua_total') ? { rotulo: tx("Água corporal total"), valor: `${fmt(av.agua_total)} L`, status: av.hidratacao_status } : null,
        pegar(av, 'smi_resultado', 'smi') ? { rotulo: tx("Índice muscular apendicular (SMI)"), valor: fmt(pegar(av, 'smi_resultado', 'smi'), 2), status: av.smi_status } : null,
    ].filter(Boolean);

    const marcasChecklist = checklist ? [
        ['diagnose', 'Diagnose'], ['email', 'E-mail enviado'], ['treino', 'Treino prescrito'], ['apenasAvaliacao', 'Apenas avaliação'],
    ].filter(([k]) => checklist[k]) : [];

    const gAtual = gorduraKg(av);
    const gAnt = anterior ? gorduraKg(anterior) : null;
    const mAtual = massaMuscular(av);
    const mAnt = anterior ? massaMuscular(anterior) : null;

    const cartoes = [
        { rotulo: tx("Peso"), icone: Scale, cor: 'text-slate-400', valor: fmt(av.peso), sufixo: 'kg', atual: parseNum(av.peso), ant: anterior ? parseNum(anterior.peso) : null, tipo: 'neutro' },
        { rotulo: tx("Massa muscular"), icone: Dumbbell, cor: 'text-blue-500', valor: fmt(mAtual), sufixo: 'kg', atual: mAtual, ant: mAnt, tipo: 'musculo' },
        { rotulo: tx("Gordura"), icone: Droplet, cor: 'text-orange-500', valor: fmt(gAtual), sufixo: 'kg', atual: gAtual, ant: gAnt, tipo: 'gordura' },
        { rotulo: tx("% Gordura"), icone: Percent, cor: 'text-rose-500', valor: fmt(av.pgc), sufixo: '%', atual: parseNum(av.pgc), ant: anterior ? parseNum(anterior.pgc) : null, tipo: 'gordura' },
    ];

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm sm:p-4 animate-[fadeIn_0.2s_ease-out]"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-slate-50 dark:bg-slate-900 w-full h-full sm:h-auto sm:max-h-[92vh] max-w-4xl sm:rounded-[28px] shadow-2xl flex flex-col overflow-hidden">
                <div className="bg-white dark:bg-slate-800 px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
                            <Activity className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">{tx("Folha da avaliação física")}</p>
                            <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight truncate">{av.aluno || av.nome_aluno || tx("Aluno")}</h2>
                            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">
                                {formatarDataBR(av.data || av.created_at)}{av.hora ? " " + tx("às {v1}", { v1: String(av.hora).substring(0, 5) }) + "" : ''}{' '}{tx("• Prof.")}{' '}{nomeCurto(av.professor)}{av.unidade ? ` • ${av.unidade}` : ''}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {avaliacoes.length > 1 && (
                            <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                                <button type="button" onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))} disabled={currentIndex === 0} aria-label={tx("Avaliação anterior")} className="p-1.5 text-slate-500 dark:text-slate-300 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-600 rounded-md transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                                <span className="px-2 text-[10px] font-black text-slate-500 dark:text-slate-300">{currentIndex + 1} / {avaliacoes.length}</span>
                                <button type="button" onClick={() => setCurrentIndex((i) => Math.min(avaliacoes.length - 1, i + 1))} disabled={currentIndex === avaliacoes.length - 1} aria-label={tx("Próxima avaliação")} className="p-1.5 text-slate-500 dark:text-slate-300 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-600 rounded-md transition-colors"><ChevronRight className="w-4 h-4" /></button>
                            </div>
                        )}
                        <button ref={fecharRef} type="button" onClick={onClose} aria-label={tx("Fechar")} className="w-10 h-10 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 rounded-full flex items-center justify-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><X className="w-5 h-5" /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {cartoes.map(({ rotulo, icone: Icone, cor, valor, sufixo, atual, ant, tipo }) => (
                            <div key={rotulo} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center text-center gap-1">
                                <Icone className={`w-5 h-5 ${cor}`} />
                                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{tx(rotulo)}</span>
                                <span className="text-xl font-black text-slate-800 dark:text-white">{valor ? `${valor} ${sufixo}` : '—'}</span>
                                <Variacao atual={atual} anterior={ant} tipo={tipo} />
                            </div>
                        ))}
                    </div>
                    {chaveAluno && <p className="-mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 text-center">
                        {carregandoAnterior ? tx("Buscando a avaliação anterior do aluno...")
                            : anterior ? tx("Comparado com a avaliação anterior deste aluno, de {data}", { data: formatarDataBR(anterior.data || anterior.created_at) })
                            : tx("Primeira avaliação deste aluno: sem comparação")}
                    </p>}

                    <Secao icone={User} titulo={tx("Dados do aluno")}>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <Campo rotulo={tx("Nome")} valor={av.aluno || av.nome_aluno} />
                            <Campo rotulo={tx("Altura")} valor={pegar(av, 'altura') ? `${fmt(av.altura, 2)} m` : null} />
                            <Campo rotulo={tx("Avaliador")} valor={nomeCurto(av.professor)} />
                            <Campo rotulo={tx("Unidade")} valor={av.unidade} />
                        </div>
                    </Secao>

                    {temSegmentos && (
                        <Secao icone={Activity} titulo={tx("Bioimpedância (massa por segmento)")}>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {segmentos.map(([rotulo, valor], i) => {
                                    const alerta = i < 2 ? assimBracos : assimPernas;
                                    return <Campo key={rotulo} rotulo={rotulo} valor={parseNum(valor) !== null ? `${fmt(valor)} kg` : null} destaque={alerta ? 'text-rose-600 dark:text-rose-400' : undefined} />;
                                })}
                            </div>
                            {(assimBracos || assimPernas) && (
                                <p className="mt-3 text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                                    <AlertCircle className="w-3.5 h-3.5" />{' '}{tx("Diferença acima de 10% entre os lados")}{' '}{assimBracos && assimPernas ? tx("nos braços e nas pernas") : assimBracos ? tx("nos braços") : tx("nas pernas")}.
                                </p>
                            )}
                        </Secao>
                    )}

                    {indicadores.length > 0 && (
                        <Secao icone={HeartPulse} titulo={tx("Indicadores de saúde")}>
                            {indicadores.map((it) => <LinhaIndicador key={it.rotulo} {...it} />)}
                        </Secao>
                    )}

                    {(objetivo || disponibilidade || restricoes || respostas.length > 0) && (
                        <Secao icone={ListChecks} titulo={tx("Anamnese e questionário")}>
                            {(objetivo || disponibilidade || restricoes) && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                                    {objetivo && <Campo rotulo={tx("Objetivo principal")} valor={objetivo} />}
                                    {disponibilidade && <Campo rotulo={tx("Disponibilidade semanal")} valor={disponibilidade} />}
                                    {restricoes && <Campo rotulo={tx("Restrições / lesões")} valor={restricoes} />}
                                </div>
                            )}
                            {respostas.length > 0 && (
                                <ol className="space-y-3">
                                    {respostas.map((r, i) => (
                                        <li key={i} className="bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3">
                                            <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">{r.pergunta}</p>
                                            <p className={`text-sm font-bold ${textoResposta(r.resposta) === 'Não respondida' ? 'text-slate-400 italic' : 'text-slate-800 dark:text-white'}`}>{textoResposta(r.resposta)}</p>
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </Secao>
                    )}

                    {marcasChecklist.length > 0 && (
                        <Secao icone={CheckSquare} titulo={tx("Checklist administrativo")}>
                            <div className="flex flex-wrap gap-2">
                                {marcasChecklist.map(([k, rotulo]) => (
                                    <span key={k} className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-[10px] font-black uppercase tracking-widest">{tx(rotulo)}</span>
                                ))}
                            </div>
                        </Secao>
                    )}
                </div>
            </div>
        </div>
    );
};

// ==========================================
// COMPONENTE PRINCIPAL (PAINEL INICIAL)
// ==========================================
const PainelInicial = ({ usuarioLogado, colaboradores, setProfessorAtivo, setAbaAtiva }) => {
    const { locale, language } = useI18n(); 
    const langAtual = locale || language || 'pt-BR';
    
    // Admin de verdade (mesmo com uma unidade escolhida no topo): Configurar Formulário (corrigido em 06/11/2026)
    const isAdmin = (usuarioLogado?.roleReal || usuarioLogado?.role) === 'ADMIN';
    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';
    // Cartões e botão da Lixeira pelas permissões (Configurações → Permissões, 06/11/2026; padrão = como era).
    // O Dashboard Global também precisa da visão de várias unidades (topo em "Todas").
    const verDashGlobal = temVisaoGlobal && podeVer(usuarioLogado, '702');
    const verDashUnidade = podeVer(usuarioLogado, '703');
    const verLixeira = podeVer(usuarioLogado, '707');
    const profsDaUnidade = colaboradores.filter(c => c.unidade === usuarioLogado?.unidade);
    // Lixeira das avaliações (04/11/2026): contador vermelho no botão, da unidade do topo (TODAS = as que a pessoa vê)
    const totalLixeira = useTotalLixeiraAvaliacoes(usuarioLogado?.unidade && usuarioLogado.unidade !== 'TODAS' ? usuarioLogado.unidade : null);

    const [metricasCards, setMetricasCards] = useState({});
    const [avaliacoesRecentes, setAvaliacoesRecentes] = useState([]);
    const [loadingTabela, setLoadingTabela] = useState(false);
    // Perguntas da anamnese lidas uma vez para as 3 telas (pacote 2, 09/11/2026)
    const { perguntas: perguntasAvaliacao } = usePerguntasAvaliacao();
    const perguntasPorId = useMemo(() => {
        const map = {};
        perguntasAvaliacao.forEach(p => { map[p.id] = p; });
        return map;
    }, [perguntasAvaliacao]);

    const [modalOpen, setModalOpen] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    
    // Filtro de período padrão do sistema (começa em "Últimos 3 dias", como antes)
    const [filtroPeriodo, setFiltroPeriodo] = useState('3d');
    const [dataInicio, setDataInicio] = useState(() => { const d = getBRDate(); d.setDate(d.getDate() - 2); return formatDateISO(d); });
    const [dataFim, setDataFim] = useState(() => formatDateISO(getBRDate()));
    const [mesAno, setMesAno] = useState(() => ({ mes: String(new Date().getMonth() + 1).padStart(2, '0'), ano: String(new Date().getFullYear()) }));
    
    // Paginação
    const [paginaAtual, setPaginaAtual] = useState(1);
    // Busca nas Últimas Avaliações: aluno, CPF ou avaliador (decisão do dono, 04/11/2026)
    const [buscaTabela, setBuscaTabela] = useState('');
    const ITENS_POR_PAGINA = 10;

    useEffect(() => {
        // Com o topo em "Todas" não há cartões de avaliador: não pergunta nada ao banco (pacote 2, 09/11/2026)
        const unidadeCartoes = usuarioLogado?.unidade;
        if (!unidadeCartoes || unidadeCartoes === 'TODAS') return;
        const fetchMetricasCards = async () => {
            try {
                // Mais leve (04/11/2026): só os últimos 90 dias (bastam para "este mês" e para a última avaliação de cada avaliador)
                const desde90 = new Date(); desde90.setDate(desde90.getDate() - 90);
                const { data, error } = await carregarTodasAvaliacoes((colunas) => supabase.from('avaliacoes_realizadas').select(colunas)
                    .eq('unidade', unidadeCartoes).gte('created_at', desde90.toISOString()).order('id', { ascending: true }), ['professor', 'created_at', 'data']);
                if (error) throw error;
                const now = new Date();
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();
                const agroupado = {};
                (data || []).forEach(aval => {
                    const prof = aval.professor;
                    if (!prof) return;
                    if (!agroupado[prof]) agroupado[prof] = { mes: 0, ultima: null };
                    const dateObj = new Date(aval.created_at || aval.data);
                    if (!agroupado[prof].ultima || dateObj > agroupado[prof].ultima) agroupado[prof].ultima = dateObj;
                    if (dateObj.getMonth() === currentMonth && dateObj.getFullYear() === currentYear) agroupado[prof].mes += 1;
                });
                setMetricasCards(agroupado);
            } catch (err) { console.error("Erro ao buscar métricas dos cartões:", err); }
        };
        fetchMetricasCards();
    }, [usuarioLogado?.unidade]);

    useEffect(() => {
        const fetchTabelaRecentes = async () => {
            setLoadingTabela(true);
            try {
                // Sem o corte de 100 (correção de 09/11/2026): traz todas do período, de 1.000 em 1.000
                // Pacote 2: só as colunas que a tabela mostra (a folha completa é lida ao clicar em Ver)
                const montar = (colunas) => {
                    let query = supabase.from('avaliacoes_realizadas').select(colunas).order('created_at', { ascending: false }).order('id', { ascending: false });
                    if (!temVisaoGlobal) query = query.eq('unidade', usuarioLogado?.unidade);
                    if (filtroPeriodo !== 'todo' && dataInicio && dataFim) {
                        const start = new Date(`${dataInicio}T00:00:00-03:00`).toISOString();
                        const end = new Date(`${dataFim}T23:59:59-03:00`).toISOString();
                        query = query.gte('created_at', start).lte('created_at', end);
                    }
                    return query;
                };
                const { data, error } = await carregarTodasAvaliacoes(montar, COLUNAS_LISTA);
                if (error) throw error;
                
                setAvaliacoesRecentes(data || []);
                setPaginaAtual(1); // Reseta a paginação ao filtrar
            } catch (err) {
                console.error("Erro ao buscar avaliações recentes:", err);
            } finally {
                setLoadingTabela(false);
            }
        };
        fetchTabelaRecentes();
    }, [dataInicio, dataFim, filtroPeriodo, temVisaoGlobal, usuarioLogado?.unidade]);

    const aplicarPeriodo = (p) => {
        if (!p) return;
        const { inicio, fim } = faixaDoFiltro(p);
        const ultimoDia = fim ? new Date(fim.getFullYear(), fim.getMonth(), fim.getDate() - 1) : null;
        setDataInicio(inicio ? isoLocal(inicio) : '');
        setDataFim(ultimoDia ? isoLocal(ultimoDia) : '');
        if (p.tipo === 'mes') setMesAno({ mes: p.mes, ano: p.ano });
        setFiltroPeriodo(p.preset);
    };
    const filtroAtual = { preset: filtroPeriodo, tipo: filtroPeriodo === 'mes' ? 'mes' : 'periodo', dia: dataInicio, inicio: dataInicio, fim: dataFim, ...mesAno };
    const anosFiltro = [String(new Date().getFullYear()), String(new Date().getFullYear() - 1), String(new Date().getFullYear() - 2)];

    const termoBusca = buscaTabela.trim().toLowerCase();
    const listaTabela = termoBusca ? avaliacoesRecentes.filter(a => String(a.aluno || '').toLowerCase().includes(termoBusca) || String(a.professor || '').toLowerCase().includes(termoBusca) || cpfCombina(a.cpf, buscaTabela)) : avaliacoesRecentes;

    // A janela anda (setas) pela lista que está na tela (com a busca aplicada)
    const openModal = (id) => {
        const idx = listaTabela.findIndex(a => a.id === id);
        if (idx >= 0) { setCurrentIndex(idx); setModalOpen(true); }
    };
    const totalPaginas = Math.ceil(listaTabela.length / ITENS_POR_PAGINA);
    const dadosPaginados = listaTabela.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA);

    return (
        <div className="w-full max-w-[1440px] mx-auto space-y-4 pb-10 animate-[fadeIn_0.3s_ease-out]">
            {/* Faixa do topo (visual compacto, 09/11/2026): abas à esquerda; período, Lixeira e formulário à direita */}
            <div className="relative z-30 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-2 pr-1 text-[11px] font-black uppercase tracking-widest text-slate-800 dark:text-white">
                        <Dumbbell className="w-4 h-4 text-blue-600 dark:text-blue-400" />{tx("Avaliação Física")}
                    </span>
                    <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                        <span className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest">{tx("Avaliadores")}</span>
                        {verDashUnidade && (
                            <button type="button" onClick={() => setProfessorAtivo({ id: 'GERAL', nome: `DASHBOARD - ${usuarioLogado?.unidade}`, unidade: usuarioLogado?.unidade })} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors">
                                {tx("Dashboard da Unidade")}
                            </button>
                        )}
                        {verDashGlobal && (
                            <button type="button" onClick={() => setProfessorAtivo({ id: 'GLOBAL', nome: 'VISÃO GLOBAL DA REDE' })} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors">
                                {tx("Dashboard Global")}
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="hidden md:inline text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        {rotuloDoFiltro(filtroAtual)} · {!usuarioLogado?.unidade || usuarioLogado.unidade === 'TODAS' ? tx("Todas as unidades") : usuarioLogado.unidade}
                    </span>
                    {isAdmin && (
                        <button type="button" onClick={() => setAbaAtiva('construtor')} className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                            <ListChecks className="w-3.5 h-3.5" />{tx("Configurar Formulário")}
                        </button>
                    )}
                    {verLixeira && (
                        <button type="button" onClick={() => setAbaAtiva('lixeira')} className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-700 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />{tx("Lixeira")}
                            {totalLixeira > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center">{totalLixeira}</span>}
                        </button>
                    )}
                    <SeletorPeriodo
                        rotulo={rotuloDoFiltro(filtroAtual)}
                        preset={filtroPeriodo}
                        tipo={filtroAtual.tipo}
                        dia={dataInicio}
                        inicio={dataInicio}
                        fim={dataFim}
                        mes={mesAno.mes}
                        ano={mesAno.ano}
                        meses={MESES_FILTRO}
                        anos={anosFiltro}
                        onAplicar={aplicarPeriodo}
                    />
                </div>
            </div>

            {/* Avaliadores da unidade: cartões pequenos (como a aba Equipe do CRM) */}
            <div>
                <h3 className="mb-2 px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    {tx("Avaliadores")}{usuarioLogado?.unidade && usuarioLogado.unidade !== 'TODAS' ? ` · ${usuarioLogado.unidade}` : ''}
                </h3>
                {profsDaUnidade.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-[12px] font-bold text-slate-500 dark:text-slate-400">
                        {!usuarioLogado?.unidade || usuarioLogado.unidade === 'TODAS' ? tx("Escolha uma unidade no seletor do topo para ver os avaliadores.") : tx("Nenhum avaliador cadastrado nesta unidade.")}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                        {profsDaUnidade.map((c) => {
                            const metrica = metricasCards[c.nome] || { mes: 0, ultima: null };
                            const partes = String(c.nome || '').trim().split(/\s+/);
                            return (
                                <button key={c.id} type="button" onClick={() => setProfessorAtivo({ ...c, unidade: usuarioLogado?.unidade })} className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 rounded-xl p-3 flex items-center gap-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                                    <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-sm shrink-0">{partes[0]?.charAt(0)}</div>
                                    <div className="min-w-0 flex-1">
                                        <span className="block text-[12px] font-black text-slate-800 dark:text-white uppercase truncate" title={c.nome}>{partes.slice(0, 2).join(' ')}</span>
                                        <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5 truncate">
                                            <strong className="text-slate-800 dark:text-white">{metrica.mes}</strong> {tx("no mês")}
                                            {' · '}{metrica.ultima ? tx("última {v1}", { v1: new Date(metrica.ultima).toLocaleDateString(langAtual, { day: '2-digit', month: '2-digit' }) }) : tx("sem avaliação em 90 dias")}
                                        </span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 shrink-0" />
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            <div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div>
                            <h2 className="text-[12px] font-black text-slate-800 dark:text-white uppercase tracking-widest leading-none">{tx("Últimas Avaliações")}</h2>
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">
                                {listaTabela.length}{' '}{tx("registros encontrados")}
                            </p>
                        </div>
                        <div className="relative w-full sm:w-64">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input type="text" value={buscaTabela} onChange={(e) => { setBuscaTabela(e.target.value); setPaginaAtual(1); }} placeholder={tx("Buscar aluno, CPF ou avaliador")} className="w-full h-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 text-[12px] font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
                        </div>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar max-h-[500px]">
                        {loadingTabela ? (
                            <div className="py-20 flex flex-col items-center justify-center">
                                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tx("Buscando avaliações...")}</p>
                            </div>
                        ) : listaTabela.length === 0 ? (
                            <div className="py-20 flex flex-col items-center justify-center text-center">
                                <Search className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-4" />
                                <h4 className="text-sm font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">{tx("Nenhuma avaliação encontrada")}</h4>
                                <p className="text-xs font-medium text-slate-400 mt-1">{tx("Não houve avaliações no período selecionado.")}</p>
                            </div>
                        ) : (
                            <table className="w-full text-left whitespace-nowrap">
                                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{tx("Aluno(a)")}</th>
                                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{tx("Data e Hora")}</th>
                                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{tx("Avaliador")}</th>
                                        {temVisaoGlobal && <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{tx("Unidade")}</th>}
                                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">{tx("Peso")}</th>
                                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">{tx("Músculo (MME)")}</th>
                                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">{tx("% Gordura")}</th>
                                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">{tx("Ações")}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                    {dadosPaginados.map(av => {
                                        const avatarColor = getAvatarColor(av.aluno);
                                        const p = av.peso ? parseFloat(String(av.peso).replace(',', '.')) : null;
                                        const m = av.mme ? parseFloat(String(av.mme).replace(',', '.')) : null;
                                        const g = av.pgc ? parseFloat(String(av.pgc).replace(',', '.')) : null;

                                        return (
                                            <tr key={av.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => openModal(av.id)}>
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center gap-3.5">
                                                        <div className="relative">
                                                            <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-[10px] font-black shrink-0 ${avatarColor}`}>
                                                                {extrairIniciais(av.aluno)}
                                                            </div>
                                                            <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${getIndicadorSaude(av)}`} title={tx("Indicador de Saúde da Avaliação")}></div>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{av.aluno || 'N/I'}</span>
                                                            {av.cpf && <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono tracking-widest mt-0.5">{mascararCPF(av.cpf)}</span>}
                                                            {pendenciasAvaliacao(av).length > 0 && (
                                                                <span title={tx('Avaliação incompleta: complete pelo botão Editar')} className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-md border bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-black uppercase tracking-wider dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30">
                                                                    ⚠️ {tx('Sem')} {pendenciasAvaliacao(av).map(p => tx(p)).join(' · ')}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3 flex flex-col justify-center min-h-[56px]">
                                                    <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300">{formatarDataBR(av.data || av.created_at)}</span>
                                                    {av.hora && <span className="text-[10px] font-black text-slate-400">{String(av.hora).substring(0, 5)}</span>}
                                                </td>
                                                <td className="px-5 py-3 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase" title={av.professor || tx("SISTEMA")}>
                                                    {formatarNomeAvaliador(av.professor)}
                                                </td>
                                                {temVisaoGlobal && (
                                                    <td className="px-5 py-3">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:text-slate-400">{av.unidade}</span>
                                                    </td>
                                                )}
                                                <td className="px-5 py-3 text-xs font-black text-slate-800 dark:text-white text-right">{p !== null ? tx("{v1} kg", { v1: p.toFixed(1) }) : '—'}</td>
                                                <td className="px-5 py-3 text-xs font-black text-blue-600 dark:text-blue-400 text-right">{m !== null ? tx("{v1} kg", { v1: m.toFixed(1) }) : '—'}</td>
                                                <td className="px-5 py-3 text-xs font-black text-rose-600 dark:text-rose-400 text-right">{g !== null ? `${g.toFixed(1)}%` : '—'}</td>
                                                <td className="px-5 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button onClick={() => openModal(av.id)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors border border-transparent hover:border-blue-200 dark:hover:border-blue-800 flex items-center gap-1.5 px-3 bg-slate-50 dark:bg-slate-800 shadow-sm dark:hover:text-blue-400" title={tx("Ver Avaliação Completa")}>
                                                            <Eye className="w-4 h-4 text-blue-500" />
                                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">{tx("Ver")}</span>
                                                        </button>
                                                        {av.arquivo_inbody_url ? (
                                                            <a href={av.arquivo_inbody_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors shadow-sm dark:hover:bg-blue-500/20" title={tx("Ver Exame em PDF/Imagem")}>
                                                                <FileText className="w-3.5 h-3.5" /> PDF
                                                            </a>
                                                        ) : null}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                    {totalPaginas > 1 && (
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest dark:text-slate-400">
                                {tx("Exibindo")}{' '}{(paginaAtual - 1) * ITENS_POR_PAGINA + 1} a {Math.min(paginaAtual * ITENS_POR_PAGINA, listaTabela.length)}{' '}{tx("de")}{' '}{listaTabela.length}
                            </span>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setPaginaAtual(p => Math.max(1, p - 1))} disabled={paginaAtual === 1} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 transition-colors dark:text-slate-400"><ChevronLeft className="w-4 h-4"/></button>
                                <button onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))} disabled={paginaAtual === totalPaginas} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 transition-colors dark:text-slate-400"><ChevronRight className="w-4 h-4"/></button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* RENDERIZA O MODAL SE ESTIVER ABERTO */}
            {modalOpen && (
                <ModalVerAvaliacao 
                    avaliacoes={listaTabela}
                    initialIndex={currentIndex} 
                    onClose={() => setModalOpen(false)}
                    perguntasPorId={perguntasPorId}
                />
            )}
        </div>
    );
};

export default PainelInicial;