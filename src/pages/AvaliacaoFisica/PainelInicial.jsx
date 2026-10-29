import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient.js';
import { 
    Dumbbell, Building2, ChevronRight, BarChart3, ListChecks, Users, BarChart2, 
    CalendarDays, ChevronDown, Check, Activity, Scale, Percent, FileText, Search, Loader2,
    Eye, X, ChevronLeft, TrendingUp, TrendingDown, Minus, HeartPulse, Droplet, CheckSquare, AlertCircle, User
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext.jsx'; 

const colorThemes = [
    { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-50/70 dark:bg-blue-900/50', border: 'hover:border-blue-400 dark:hover:border-blue-600', shadow: 'hover:shadow-[0_8px_25px_rgba(59,130,246,0.12)]' },
    { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-50/70 dark:bg-blue-900/50', border: 'hover:border-blue-400 dark:hover:border-blue-600', shadow: 'hover:shadow-[0_8px_25px_rgba(99,102,241,0.12)]' },
    { bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', iconBg: 'bg-orange-50/70 dark:bg-orange-900/50', border: 'hover:border-orange-400 dark:hover:border-orange-600', shadow: 'hover:shadow-[0_8px_25px_rgba(249,115,22,0.12)]' },
    { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-50/70 dark:bg-emerald-900/50', border: 'hover:border-emerald-400 dark:hover:border-emerald-600', shadow: 'hover:shadow-[0_8px_25px_rgba(16,185,129,0.12)]' },
    { bg: 'bg-rose-50 dark:bg-rose-900/30', text: 'text-rose-600 dark:text-rose-400', iconBg: 'bg-rose-50/70 dark:bg-rose-900/50', border: 'hover:border-rose-400 dark:hover:border-rose-600', shadow: 'hover:shadow-[0_8px_25px_rgba(244,63,94,0.12)]' }
];

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
    return n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
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
            <Icone className="w-4 h-4" /> {titulo}
        </h3>
        {children}
    </section>
);

const Campo = ({ rotulo, valor, destaque }) => (
    <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3">
        <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{rotulo}</span>
        <span className={`block text-sm font-black ${destaque || 'text-slate-800 dark:text-white'}`}>{valor ?? '—'}</span>
    </div>
);

const LinhaIndicador = ({ rotulo, valor, status }) => (
    <div className="flex items-center justify-between gap-3 py-3 border-b last:border-b-0 border-slate-100 dark:border-slate-700">
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{rotulo}: <strong className="text-slate-800 dark:text-white">{valor}</strong></span>
        {status && <span className={`px-2 py-0.5 rounded border text-[10px] font-black uppercase tracking-widest shrink-0 ${classeStatus(status)}`}>{status}</span>}
    </div>
);

const Variacao = ({ atual, anterior, tipo }) => {
    if (atual === null || anterior === null) return null;
    const v = atual - anterior;
    if (Math.abs(v) < 0.1) return <span className="text-[10px] font-bold text-slate-400 flex items-center justify-center gap-1"><Minus className="w-3 h-3" /> Estável</span>;
    const subiu = v > 0;
    const bom = tipo === 'gordura' ? !subiu : tipo === 'musculo' ? subiu : null;
    const cor = bom === true ? 'text-emerald-600 dark:text-emerald-400' : bom === false ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400';
    return (
        <span className={`text-[10px] font-black flex items-center justify-center gap-0.5 ${cor}`}>
            {subiu ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />} {subiu ? '+' : ''}{fmt(v)} vs anterior
        </span>
    );
};

// ==========================================
// COMPONENTE: MODAL VER AVALIAÇÃO
// ==========================================
const ModalVerAvaliacao = ({ avaliacoes, initialIndex, onClose, perguntasPorId }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const fecharRef = useRef(null);
    const av = avaliacoes[currentIndex];
    const anterior = currentIndex > 0 ? avaliacoes[currentIndex - 1] : null;

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
        sist && diast ? { rotulo: 'Pressão arterial', valor: `${sist}/${diast} mmHg`, status: av.pressao_status } : null,
        pegar(av, 'rcq') ? { rotulo: 'Relação cintura-quadril (RCQ)', valor: fmt(av.rcq, 2), status: av.rcq_status } : null,
        pegar(av, 'gv') ? { rotulo: 'Gordura visceral', valor: av.gv, status: av.gv_status } : null,
        pegar(av, 'agua_total') ? { rotulo: 'Água corporal total', valor: `${fmt(av.agua_total)} L`, status: av.hidratacao_status } : null,
        pegar(av, 'smi_resultado', 'smi') ? { rotulo: 'Índice muscular apendicular (SMI)', valor: fmt(pegar(av, 'smi_resultado', 'smi'), 2), status: av.smi_status } : null,
    ].filter(Boolean);

    const marcasChecklist = checklist ? [
        ['diagnose', 'Diagnose'], ['email', 'E-mail enviado'], ['treino', 'Treino prescrito'], ['apenasAvaliacao', 'Apenas avaliação'],
    ].filter(([k]) => checklist[k]) : [];

    const gAtual = gorduraKg(av);
    const gAnt = anterior ? gorduraKg(anterior) : null;
    const mAtual = massaMuscular(av);
    const mAnt = anterior ? massaMuscular(anterior) : null;

    const cartoes = [
        { rotulo: 'Peso', icone: Scale, cor: 'text-slate-400', valor: fmt(av.peso), sufixo: 'kg', atual: parseNum(av.peso), ant: anterior ? parseNum(anterior.peso) : null, tipo: 'neutro' },
        { rotulo: 'Massa muscular', icone: Dumbbell, cor: 'text-blue-500', valor: fmt(mAtual), sufixo: 'kg', atual: mAtual, ant: mAnt, tipo: 'musculo' },
        { rotulo: 'Gordura', icone: Droplet, cor: 'text-orange-500', valor: fmt(gAtual), sufixo: 'kg', atual: gAtual, ant: gAnt, tipo: 'gordura' },
        { rotulo: '% Gordura', icone: Percent, cor: 'text-rose-500', valor: fmt(av.pgc), sufixo: '%', atual: parseNum(av.pgc), ant: anterior ? parseNum(anterior.pgc) : null, tipo: 'gordura' },
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
                            <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Folha da avaliação física</p>
                            <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight truncate">{av.aluno || av.nome_aluno || 'Aluno'}</h2>
                            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">
                                {formatarDataBR(av.data || av.created_at)}{av.hora ? ` às ${String(av.hora).substring(0, 5)}` : ''} • Prof. {nomeCurto(av.professor)}{av.unidade ? ` • ${av.unidade}` : ''}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {avaliacoes.length > 1 && (
                            <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                                <button type="button" onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))} disabled={currentIndex === 0} aria-label="Avaliação anterior" className="p-1.5 text-slate-500 dark:text-slate-300 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-600 rounded-md transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                                <span className="px-2 text-[10px] font-black text-slate-500 dark:text-slate-300">{currentIndex + 1} / {avaliacoes.length}</span>
                                <button type="button" onClick={() => setCurrentIndex((i) => Math.min(avaliacoes.length - 1, i + 1))} disabled={currentIndex === avaliacoes.length - 1} aria-label="Próxima avaliação" className="p-1.5 text-slate-500 dark:text-slate-300 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-600 rounded-md transition-colors"><ChevronRight className="w-4 h-4" /></button>
                            </div>
                        )}
                        <button ref={fecharRef} type="button" onClick={onClose} aria-label="Fechar" className="w-10 h-10 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 rounded-full flex items-center justify-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><X className="w-5 h-5" /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {cartoes.map(({ rotulo, icone: Icone, cor, valor, sufixo, atual, ant, tipo }) => (
                            <div key={rotulo} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center text-center gap-1">
                                <Icone className={`w-5 h-5 ${cor}`} />
                                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{rotulo}</span>
                                <span className="text-xl font-black text-slate-800 dark:text-white">{valor ? `${valor} ${sufixo}` : '—'}</span>
                                <Variacao atual={atual} anterior={ant} tipo={tipo} />
                            </div>
                        ))}
                    </div>

                    <Secao icone={User} titulo="Dados do aluno">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <Campo rotulo="Nome" valor={av.aluno || av.nome_aluno} />
                            <Campo rotulo="Altura" valor={pegar(av, 'altura') ? `${fmt(av.altura, 2)} m` : null} />
                            <Campo rotulo="Avaliador" valor={nomeCurto(av.professor)} />
                            <Campo rotulo="Unidade" valor={av.unidade} />
                        </div>
                    </Secao>

                    {temSegmentos && (
                        <Secao icone={Activity} titulo="Bioimpedância (massa por segmento)">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {segmentos.map(([rotulo, valor], i) => {
                                    const alerta = i < 2 ? assimBracos : assimPernas;
                                    return <Campo key={rotulo} rotulo={rotulo} valor={parseNum(valor) !== null ? `${fmt(valor)} kg` : null} destaque={alerta ? 'text-rose-600 dark:text-rose-400' : undefined} />;
                                })}
                            </div>
                            {(assimBracos || assimPernas) && (
                                <p className="mt-3 text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                                    <AlertCircle className="w-3.5 h-3.5" /> Diferença acima de 10% entre os lados {assimBracos && assimPernas ? 'nos braços e nas pernas' : assimBracos ? 'nos braços' : 'nas pernas'}.
                                </p>
                            )}
                        </Secao>
                    )}

                    {indicadores.length > 0 && (
                        <Secao icone={HeartPulse} titulo="Indicadores de saúde">
                            {indicadores.map((it) => <LinhaIndicador key={it.rotulo} {...it} />)}
                        </Secao>
                    )}

                    {(objetivo || disponibilidade || restricoes || respostas.length > 0) && (
                        <Secao icone={ListChecks} titulo="Anamnese e questionário">
                            {(objetivo || disponibilidade || restricoes) && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                                    {objetivo && <Campo rotulo="Objetivo principal" valor={objetivo} />}
                                    {disponibilidade && <Campo rotulo="Disponibilidade semanal" valor={disponibilidade} />}
                                    {restricoes && <Campo rotulo="Restrições / lesões" valor={restricoes} />}
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
                        <Secao icone={CheckSquare} titulo="Checklist administrativo">
                            <div className="flex flex-wrap gap-2">
                                {marcasChecklist.map(([k, rotulo]) => (
                                    <span key={k} className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-[10px] font-black uppercase tracking-widest">{rotulo}</span>
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
    
    const isAdmin = usuarioLogado?.role === 'ADMIN';
    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';
    const podeEditar = ['ADMIN', 'MENTOR', 'LIDER'].includes(usuarioLogado?.role);
    const profsDaUnidade = colaboradores.filter(c => c.unidade === usuarioLogado?.unidade);

    const [metricasCards, setMetricasCards] = useState({});
    const [avaliacoesRecentes, setAvaliacoesRecentes] = useState([]);
    const [loadingTabela, setLoadingTabela] = useState(false);
    const [perguntasPorId, setPerguntasPorId] = useState({});
    
    const [modalOpen, setModalOpen] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    
    const [filtroPeriodo, setFiltroPeriodo] = useState('Últimos 3 dias');
    const [dataInicio, setDataInicio] = useState(() => { const d = getBRDate(); d.setDate(d.getDate() - 2); return formatDateISO(d); });
    const [dataFim, setDataFim] = useState(() => formatDateISO(getBRDate()));
    const [dropdownPeriodoOpen, setDropdownPeriodoOpen] = useState(false);
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const dropdownRef = useRef(null);
    
    // Paginação
    const [paginaAtual, setPaginaAtual] = useState(1);
    const ITENS_POR_PAGINA = 10;

    const opcoesPeriodo = ['Todo período', 'Hoje', 'Ontem', 'Últimos 3 dias', 'Últimos 7 dias', 'Últimos 30 dias', 'Este mês', 'Mês passado', 'Personalizado'];

    useEffect(() => {
        const handleClickOutside = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownPeriodoOpen(false); };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchPerguntas = async () => {
            const { data } = await supabase.from('avaliacao_perguntas').select('id, pergunta, ordem, descricao');
            if (data) {
                const map = {};
                data.forEach(p => { map[p.id] = p; });
                setPerguntasPorId(map);
            }
        };
        fetchPerguntas();
    }, []);

    useEffect(() => {
        const fetchMetricasCards = async () => {
            try {
                const { data, error } = await supabase.from('avaliacoes_realizadas').select('professor, created_at, data').eq('unidade', usuarioLogado?.unidade);
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
                let query = supabase.from('avaliacoes_realizadas').select('*').order('created_at', { ascending: false });
                
                if (!temVisaoGlobal) query = query.eq('unidade', usuarioLogado?.unidade);
                if (filtroPeriodo !== 'Todo período' && dataInicio && dataFim) {
                    const start = new Date(`${dataInicio}T00:00:00-03:00`).toISOString();
                    const end = new Date(`${dataFim}T23:59:59-03:00`).toISOString();
                    query = query.gte('created_at', start).lte('created_at', end);
                }

                const { data, error } = await query.limit(100); 
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

    const aplicarFiltroPredefinido = (tipo) => {
        const hoje = getBRDate();
        let start = ''; let end = '';
        switch (tipo) {
            case 'Hoje': start = end = formatDateISO(hoje); break;
            case 'Ontem': hoje.setDate(hoje.getDate() - 1); start = end = formatDateISO(hoje); break;
            case 'Últimos 3 dias': end = formatDateISO(hoje); hoje.setDate(hoje.getDate() - 2); start = formatDateISO(hoje); break;
            case 'Últimos 7 dias': end = formatDateISO(hoje); hoje.setDate(hoje.getDate() - 6); start = formatDateISO(hoje); break;
            case 'Últimos 30 dias': end = formatDateISO(hoje); hoje.setDate(hoje.getDate() - 29); start = formatDateISO(hoje); break;
            case 'Este mês': end = formatDateISO(hoje); start = formatDateISO(new Date(hoje.getFullYear(), hoje.getMonth(), 1)); break;
            case 'Mês passado': 
                const u = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
                const p = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
                end = formatDateISO(u); start = formatDateISO(p);
                break;
            default: break;
        }

        if (tipo !== 'Personalizado') {
            setDataInicio(start); setDataFim(end);
            setFiltroPeriodo(tipo); setDropdownPeriodoOpen(false);
        } else {
            setFiltroPeriodo('Personalizado');
            setCustomStart(dataInicio); setCustomEnd(dataFim);
        }
    };

    const aplicarPersonalizado = () => { setDataInicio(customStart); setDataFim(customEnd); setDropdownPeriodoOpen(false); };
    const formatarLabelPeriodo = () => {
        if (filtroPeriodo === 'Personalizado' && dataInicio && dataFim) return `${dataInicio.split('-').reverse().join('/')} – ${dataFim.split('-').reverse().join('/')}`;
        return filtroPeriodo;
    };

    const openModal = (id) => {
        const idx = avaliacoesRecentes.findIndex(a => a.id === id);
        if (idx >= 0) { setCurrentIndex(idx); setModalOpen(true); }
    };

    const totalPaginas = Math.ceil(avaliacoesRecentes.length / ITENS_POR_PAGINA);
    const dadosPaginados = avaliacoesRecentes.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA);

    return (
        <div className="w-full relative pb-20 animate-[fadeIn_0.5s_ease-out]">
            <div className="relative w-full max-w-[1440px] mx-auto pt-4 md:pt-6 pb-6 px-4 flex flex-col items-center z-10">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-[16px] flex items-center justify-center mb-3 shadow-[0_8px_25px_rgba(37,99,235,0.4)] border border-blue-400/50 dark:border-blue-500/20">
                    <Dumbbell className="w-7 h-7" />
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white tracking-tight text-center max-w-2xl leading-tight">
                    Painel de <span className="text-blue-600 dark:text-blue-400 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-600 dark:from-blue-400 dark:to-blue-400">Avaliação Física</span>
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-3 font-medium text-center text-sm max-w-lg mb-5">
                    Acesse a gestão estratégica ou selecione o perfil de um avaliador.
                </p>
                
                <div className="w-full flex flex-col md:flex-row justify-center gap-4 max-w-3xl mx-auto">
                    {temVisaoGlobal && (
                        <button onClick={() => setProfessorAtivo({ id: 'GLOBAL', nome: 'VISÃO GLOBAL DA REDE' })} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 p-5 rounded-[20px] shadow-[0_8px_30px_rgba(59,130,246,0.25)] flex items-center justify-between transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(59,130,246,0.35)] border border-blue-400 dark:border-blue-500/30 group relative overflow-hidden">
                            <svg className="absolute bottom-0 right-10 w-24 h-12 opacity-30 group-hover:opacity-60 transition-opacity" viewBox="0 0 100 30" fill="none">
                                <path d="M0 30L20 15L40 20L60 5L80 15L100 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/20">
                                    <Building2 className="w-6 h-6 text-white" />
                                </div>
                                <div className="text-left">
                                    <span className="font-black uppercase tracking-widest text-xs text-white block mb-0.5">Dashboard Global</span>
                                    <span className="text-[10px] text-blue-100 font-bold uppercase tracking-widest block">Desempenho de todas as unidades</span>
                                </div>
                            </div>
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm group-hover:bg-white/30 transition-colors relative z-10">
                                <ChevronRight className="w-5 h-5 text-white" />
                            </div>
                        </button>
                    )}

                    {podeEditar && (
                        <button onClick={() => setProfessorAtivo({ id: 'GERAL', nome: `DASHBOARD - ${usuarioLogado?.unidade}`, unidade: usuarioLogado?.unidade })} className="flex-1 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 p-5 rounded-[20px] shadow-[0_8px_30px_rgba(15,23,42,0.25)] flex items-center justify-between transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(15,23,42,0.35)] border border-slate-700 dark:border-slate-700/50 group relative overflow-hidden">
                            <div className="absolute right-0 top-0 w-32 h-full bg-gradient-to-l from-orange-500/20 to-transparent pointer-events-none"></div>
                            <svg className="absolute bottom-0 right-10 w-24 h-12 opacity-30 group-hover:opacity-60 transition-opacity" viewBox="0 0 100 30" fill="none">
                                <path d="M0 30L20 15L40 20L60 5L80 15L100 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-orange-500/30">
                                    <BarChart3 className="w-6 h-6 text-orange-400" />
                                </div>
                                <div className="text-left">
                                    <span className="font-black uppercase tracking-widest text-xs text-white block mb-0.5">Dashboard da Unidade</span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">Métricas da Unidade {usuarioLogado?.unidade}</span>
                                </div>
                            </div>
                            <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30 group-hover:bg-orange-400 transition-colors relative z-10">
                                <ChevronRight className="w-5 h-5 text-white" />
                            </div>
                        </button>
                    )}
                </div>

                {isAdmin && (
                    <button onClick={() => setAbaAtiva('construtor')} className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md px-5 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:bg-white dark:hover:bg-slate-800 hover:border-blue-200 dark:hover:border-blue-800">
                        <ListChecks className="w-3.5 h-3.5" /> Configurar Formulário
                    </button>
                )}
            </div>

            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 relative z-20 mb-8">
                <div className="w-full flex items-center gap-4 mb-6">
                    <div className="h-px bg-slate-300/40 dark:bg-slate-700/50 flex-1"></div>
                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm px-4 py-1.5 rounded-full border border-slate-200/50 dark:border-slate-700/50">
                        <Users className="w-4 h-4 text-blue-500 dark:text-blue-400"/> Avaliadores - Unidade {usuarioLogado?.unidade}
                    </span>
                    <div className="h-px bg-slate-300/40 dark:bg-slate-700/50 flex-1"></div>
                </div>

                {profsDaUnidade.length === 0 ? (
                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/50 dark:border-slate-800 p-6 rounded-[24px] text-center w-full max-w-sm mx-auto shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
                        <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">Nenhum avaliador cadastrado nesta unidade.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 w-full">
                        {profsDaUnidade.map((c, index) => {
                            const theme = colorThemes[index % colorThemes.length];
                            const metrica = metricasCards[c.nome] || { mes: 0, ultima: null };
                            
                            return (
                                <button key={c.id} onClick={() => setProfessorAtivo({ ...c, unidade: usuarioLogado?.unidade })} className={`bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-white/60 dark:border-slate-800 p-4 rounded-[20px] shadow-[0_4px_15px_rgba(0,0,0,0.03)] transition-all group flex flex-col justify-between min-h-[118px] relative overflow-hidden ${theme.border} ${theme.shadow} hover:-translate-y-1 outline-none text-left`}>
                                    <div className="flex items-center gap-3 w-full pr-6">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-base transition-colors shadow-inner shrink-0 border border-white/50 dark:border-white/10 ${theme.bg} ${theme.text}`}>
                                            {c.nome.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="font-extrabold text-slate-800 dark:text-white block leading-tight text-sm truncate" title={c.nome}>{c.nome.split(' ')[0]}</span>
                                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5 block truncate" title={c.nome.split(' ').slice(1).join(' ')}>
                                                {c.nome.split(' ').slice(1).join(' ') || 'Avaliador'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="absolute top-5 right-4 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/40 group-hover:text-blue-500 dark:group-hover:text-blue-400">
                                        <ChevronRight className="w-4 h-4" />
                                    </div>
                                    <div className="mt-3 pt-2.5 border-t border-slate-100/60 dark:border-slate-800 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${theme.iconBg} ${theme.text}`}><BarChart2 className="w-4 h-4" /></div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-slate-800 dark:text-white leading-none">{metrica.mes}</span>
                                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Avaliações</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-right">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-black text-slate-800 dark:text-white leading-none">
                                                    {metrica.ultima ? new Date(metrica.ultima).toLocaleDateString(langAtual, {day:'2-digit', month:'2-digit', year:'2-digit'}) : '-'}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Última</span>
                                            </div>
                                            <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-400 dark:text-slate-500 group-hover:bg-slate-100 dark:group-hover:bg-slate-700 transition-colors">
                                                <CalendarDays className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 relative z-20">
                <div className="w-full flex items-center gap-4 mb-6">
                    <div className="h-px bg-slate-300/40 dark:bg-slate-700/50 flex-1"></div>
                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm px-4 py-1.5 rounded-full border border-slate-200/50 dark:border-slate-700/50">
                        <Activity className="w-4 h-4 text-blue-500 dark:text-blue-400"/> Acompanhamento Geral
                    </span>
                    <div className="h-px bg-slate-300/40 dark:bg-slate-700/50 flex-1"></div>
                </div>

                <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-[24px] border border-white/50 dark:border-slate-700/50 shadow-sm flex flex-col overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-black text-slate-800 dark:text-white tracking-tight leading-none">Últimas Avaliações</h2>
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1.5">
                                {avaliacoesRecentes.length} registros encontrados
                            </p>
                        </div>
                        <div className="relative min-w-[200px]" ref={dropdownRef}>
                            <button onClick={() => setDropdownPeriodoOpen(!dropdownPeriodoOpen)} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none hover:border-slate-300 focus:ring-2 focus:ring-blue-500 flex items-center justify-between shadow-sm transition-all dark:hover:border-slate-700">
                                <div className="flex items-center gap-2">
                                    <CalendarDays className="w-4 h-4 text-blue-500" />
                                    <span className="truncate">{formatarLabelPeriodo()}</span>
                                </div>
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dropdownPeriodoOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {dropdownPeriodoOpen && (
                                <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 overflow-hidden animate-[fadeIn_0.1s_ease-out]">
                                    <div className="max-h-64 overflow-y-auto py-2 custom-scrollbar">
                                        {opcoesPeriodo.map(opcao => (
                                            <button key={opcao} onClick={() => aplicarFiltroPredefinido(opcao)} className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors flex items-center gap-2 ${filtroPeriodo === opcao ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                                                {filtroPeriodo === opcao ? <Check className="w-4 h-4 shrink-0" /> : <div className="w-4 h-4 shrink-0" />} {opcao}
                                            </button>
                                        ))}
                                    </div>
                                    {filtroPeriodo === 'Personalizado' && (
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex flex-col gap-3">
                                            <div className="flex gap-2">
                                                <div className="flex-1"><label className="text-[10px] font-black uppercase text-slate-400 block mb-1">De</label><input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" /></div>
                                                <div className="flex-1"><label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Até</label><input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" /></div>
                                            </div>
                                            <button onClick={aplicarPersonalizado} disabled={!customStart || !customEnd} className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[10px] font-black uppercase rounded-lg transition-colors">Aplicar Filtro</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar max-h-[500px]">
                        {loadingTabela ? (
                            <div className="py-20 flex flex-col items-center justify-center">
                                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Buscando avaliações...</p>
                            </div>
                        ) : avaliacoesRecentes.length === 0 ? (
                            <div className="py-20 flex flex-col items-center justify-center text-center">
                                <Search className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-4" />
                                <h4 className="text-sm font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">Nenhuma avaliação encontrada</h4>
                                <p className="text-xs font-medium text-slate-400 mt-1">Não houve avaliações no período selecionado.</p>
                            </div>
                        ) : (
                            <table className="w-full text-left whitespace-nowrap">
                                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Aluno(a)</th>
                                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Data e Hora</th>
                                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Avaliador</th>
                                        {temVisaoGlobal && <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Unidade</th>}
                                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Peso</th>
                                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Músculo (MME)</th>
                                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">% Gordura</th>
                                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Ações</th>
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
                                                            <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${getIndicadorSaude(av)}`} title="Indicador de Saúde da Avaliação"></div>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{av.aluno || 'N/I'}</span>
                                                            {av.cpf && <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono tracking-widest mt-0.5">{mascararCPF(av.cpf)}</span>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3 flex flex-col justify-center min-h-[56px]">
                                                    <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300">{formatarDataBR(av.data || av.created_at)}</span>
                                                    {av.hora && <span className="text-[10px] font-black text-slate-400">{String(av.hora).substring(0, 5)}</span>}
                                                </td>
                                                <td className="px-5 py-3 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase" title={av.professor || 'SISTEMA'}>
                                                    {formatarNomeAvaliador(av.professor)}
                                                </td>
                                                {temVisaoGlobal && (
                                                    <td className="px-5 py-3">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:text-slate-400">{av.unidade}</span>
                                                    </td>
                                                )}
                                                <td className="px-5 py-3 text-xs font-black text-slate-800 dark:text-white text-right">{p !== null ? `${p.toFixed(1)} kg` : '—'}</td>
                                                <td className="px-5 py-3 text-xs font-black text-blue-600 dark:text-blue-400 text-right">{m !== null ? `${m.toFixed(1)} kg` : '—'}</td>
                                                <td className="px-5 py-3 text-xs font-black text-rose-600 dark:text-rose-400 text-right">{g !== null ? `${g.toFixed(1)}%` : '—'}</td>
                                                <td className="px-5 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button onClick={() => openModal(av.id)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors border border-transparent hover:border-blue-200 dark:hover:border-blue-800 flex items-center gap-1.5 px-3 bg-slate-50 dark:bg-slate-800 shadow-sm dark:hover:text-blue-400" title="Ver Avaliação Completa">
                                                            <Eye className="w-4 h-4 text-blue-500" />
                                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Ver</span>
                                                        </button>
                                                        {av.arquivo_inbody_url ? (
                                                            <a href={av.arquivo_inbody_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors shadow-sm dark:hover:bg-blue-500/20" title="Ver Exame em PDF/Imagem">
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
                                Exibindo {(paginaAtual - 1) * ITENS_POR_PAGINA + 1} a {Math.min(paginaAtual * ITENS_POR_PAGINA, avaliacoesRecentes.length)} de {avaliacoesRecentes.length}
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
                    avaliacoes={avaliacoesRecentes} 
                    initialIndex={currentIndex} 
                    onClose={() => setModalOpen(false)}
                    perguntasPorId={perguntasPorId}
                />
            )}
        </div>
    );
};

export default PainelInicial;