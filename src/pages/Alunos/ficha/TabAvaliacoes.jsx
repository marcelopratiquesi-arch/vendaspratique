import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    Dumbbell, FileText, Eye, Trash2, X, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus,
    Activity, HeartPulse, Scale, Percent, Droplet, CheckSquare, AlertCircle, ClipboardList, User, Pencil
} from 'lucide-react';
import { formatarDataBR } from '../utils.js';

// ==========================================
// FUNÇÕES DE APOIO
// ==========================================

const parseNum = (val) => {
    if (val === null || val === undefined || String(val).trim() === '') return null;
    const num = parseFloat(String(val).replace(',', '.'));
    return Number.isNaN(num) ? null : num;
};

// 66.3 -> "66,3"
const fmt = (val, casas = 1) => {
    const n = parseNum(val);
    if (n === null) return null;
    return n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
};

// Primeiro campo que existir no registro (para colunas com nomes alternativos)
const pegar = (obj, ...chaves) => {
    for (const k of chaves) {
        const v = obj?.[k];
        if (v !== null && v !== undefined && String(v).trim() !== '') return v;
    }
    return null;
};

// "PHILLIP MONT SERRAT MACHADO DE SOUZA" -> "PHILLIP SOUZA"
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

const dataHora = (av) => {
    const base = String(av.data || av.created_at || '').substring(0, 10);
    const hora = av.hora ? String(av.hora).substring(0, 5) : '00:00';
    const t = new Date(`${base}T${hora}`).getTime();
    return Number.isNaN(t) ? new Date(av.created_at || 0).getTime() : t;
};

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

const classeStatus = (status) => {
    const s = semAcento(status);
    if (!s) return 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600';
    if (/SAUDAVEL|NORMAL|OTIM|ADEQUAD/.test(s)) return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
    if (/GRAU II|ESTAGIO 2|ESTAGIO 3|SARCOPENIA|ALTO/.test(s)) return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800';
    if (/LIMITROFE|MODERADO|ESTAGIO 1|ABAIXO|GRAU I|BAIXO/.test(s)) return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800';
    return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600';
};

// Lê o questionário em qualquer um dos formatos comuns (objeto, lista, texto JSON)
// perguntasPorId: { [id]: { pergunta, ordem, descricao } } vindo da tabela avaliacao_perguntas
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

    // Mesma ordem em que as perguntas aparecem no formulário
    return lista.sort((a, b) => a.ordem - b.ordem);
};

const textoResposta = (r) => {
    if (r === null || r === undefined || String(r).trim() === '') return 'Não respondida';
    if (typeof r === 'boolean') return r ? 'Sim' : 'Não';
    if (Array.isArray(r)) return r.length ? r.join(', ') : 'Não respondida';
    return String(r);
};

// ==========================================
// MINIGRÁFICO (SVG puro)
// ==========================================
const CartaoEvolucao = ({ titulo, valores, sufixo, tipo, corLinha }) => {
    const pontos = valores.filter((v) => v !== null);
    if (pontos.length === 0) return null;

    const atual = pontos[pontos.length - 1];
    const variacao = pontos.length > 1 ? atual - pontos[pontos.length - 2] : null;

    let corVar = 'text-slate-500 bg-slate-100 dark:text-slate-300 dark:bg-slate-700';
    let Icone = Minus;
    if (variacao !== null && Math.abs(variacao) >= 0.1) {
        const subiu = variacao > 0;
        Icone = subiu ? TrendingUp : TrendingDown;
        const bom = tipo === 'gordura' ? !subiu : tipo === 'musculo' ? subiu : null;
        if (bom === true) corVar = 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/30';
        if (bom === false) corVar = 'text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-900/30';
    }

    const L = 100; const A = 32; const p = 4;
    const min = Math.min(...pontos); const max = Math.max(...pontos);
    const faixa = max - min || 1;
    const x = (i) => p + (i / Math.max(pontos.length - 1, 1)) * (L - 2 * p);
    const y = (v) => A - p - ((v - min) / faixa) * (A - 2 * p);
    const caminho = pontos.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');

    return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[20px] p-4 shadow-sm min-w-[170px] flex-1">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{titulo}</h4>
            <div className="flex items-end justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                    <span className="text-2xl font-black text-slate-800 dark:text-white leading-none">
                        {fmt(atual)}<span className="text-[11px] font-bold text-slate-400 ml-0.5">{sufixo}</span>
                    </span>
                    {variacao !== null ? (
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-black w-fit ${corVar}`}>
                            <Icone className="w-3 h-3" /> {variacao > 0 ? '+' : ''}{fmt(variacao)}
                        </span>
                    ) : (
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Primeira avaliação</span>
                    )}
                </div>
                {pontos.length > 1 && (
                    <svg viewBox={`0 0 ${L} ${A}`} className="w-20 h-9 shrink-0 overflow-visible" aria-hidden="true">
                        <path d={caminho} fill="none" className={corLinha} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx={x(pontos.length - 1)} cy={y(atual)} r="3.5" className={`fill-white dark:fill-slate-800 ${corLinha}`} strokeWidth="2" />
                    </svg>
                )}
            </div>
        </div>
    );
};

// ==========================================
// FOLHA DA AVALIAÇÃO (janela "Ver")
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

const ModalVerAvaliacao = ({ avaliacoes, indiceInicial, alunoNome, perguntasPorId, podeEditar, onEditar, onClose }) => {
    const [indice, setIndice] = useState(indiceInicial);
    const fecharRef = useRef(null);
    const av = avaliacoes[indice];
    const anterior = indice > 0 ? avaliacoes[indice - 1] : null;

    useEffect(() => {
        const aoTeclar = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') setIndice((i) => Math.max(0, i - 1));
            if (e.key === 'ArrowRight') setIndice((i) => Math.min(avaliacoes.length - 1, i + 1));
        };
        const overflowAnterior = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', aoTeclar);
        fecharRef.current?.focus();
        return () => {
            document.body.style.overflow = overflowAnterior;
            window.removeEventListener('keydown', aoTeclar);
        };
    }, [avaliacoes.length, onClose]);

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
            className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm sm:p-4 animate-[fadeIn_0.2s_ease-out]"
            role="dialog"
            aria-modal="true"
            aria-label="Avaliação física"
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-slate-50 dark:bg-slate-900 w-full h-full sm:h-auto sm:max-h-[92vh] max-w-4xl sm:rounded-[28px] shadow-2xl flex flex-col overflow-hidden">

                {/* Cabeçalho */}
                <div className="bg-white dark:bg-slate-800 px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
                            <ClipboardList className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Folha da avaliação física</p>
                            <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight truncate">{alunoNome || av.aluno || av.nome_aluno || 'Aluno'}</h2>
                            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">
                                {formatarDataBR(av.data || av.created_at)}{av.hora ? ` às ${String(av.hora).substring(0, 5)}` : ''} • Prof. {nomeCurto(av.professor)}{av.unidade ? ` • ${av.unidade}` : ''}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {avaliacoes.length > 1 && (
                            <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                                <button type="button" onClick={() => setIndice((i) => Math.max(0, i - 1))} disabled={indice === 0} aria-label="Avaliação anterior" className="p-1.5 text-slate-500 dark:text-slate-300 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-600 rounded-md transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                                <span className="px-2 text-[10px] font-black text-slate-500 dark:text-slate-300">{indice + 1} / {avaliacoes.length}</span>
                                <button type="button" onClick={() => setIndice((i) => Math.min(avaliacoes.length - 1, i + 1))} disabled={indice === avaliacoes.length - 1} aria-label="Próxima avaliação" className="p-1.5 text-slate-500 dark:text-slate-300 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-600 rounded-md transition-colors"><ChevronRight className="w-4 h-4" /></button>
                            </div>
                        )}
                        <button ref={fecharRef} type="button" onClick={onClose} aria-label="Fechar" className="w-10 h-10 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 rounded-full flex items-center justify-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><X className="w-5 h-5" /></button>
                    </div>
                </div>

                {/* Corpo */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">

                    {/* Resultado principal */}
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

                    {/* Dados do aluno */}
                    <Secao icone={User} titulo="Dados do aluno">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <Campo rotulo="Nome" valor={alunoNome || av.aluno || av.nome_aluno} />
                            <Campo rotulo="Altura" valor={pegar(av, 'altura') ? `${fmt(av.altura, 2)} m` : null} />
                            <Campo rotulo="Avaliador" valor={nomeCurto(av.professor)} />
                            <Campo rotulo="Unidade" valor={av.unidade} />
                        </div>
                    </Secao>

                    {/* Bioimpedância segmentar */}
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

                    {/* Indicadores de saúde */}
                    {indicadores.length > 0 && (
                        <Secao icone={HeartPulse} titulo="Indicadores de saúde">
                            {indicadores.map((it) => <LinhaIndicador key={it.rotulo} {...it} />)}
                        </Secao>
                    )}

                    {/* Anamnese e questionário */}
                    {(objetivo || disponibilidade || restricoes || respostas.length > 0) && (
                        <Secao icone={ClipboardList} titulo="Anamnese e questionário">
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

                    {/* Checklist */}
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

                {/* Rodapé */}
                {(av.arquivo_inbody_url || (podeEditar && onEditar)) && (
                    <div className="bg-white dark:bg-slate-800 px-5 py-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap justify-end gap-2 shrink-0">
                        {podeEditar && onEditar && (
                            <button type="button" onClick={() => onEditar(av)} className="px-5 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 rounded-xl text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-2">
                                <Pencil className="w-4 h-4" /> Editar avaliação
                            </button>
                        )}
                        {av.arquivo_inbody_url && (
                            <a href={av.arquivo_inbody_url} target="_blank" rel="noopener noreferrer" className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-2">
                                <FileText className="w-4 h-4" /> Abrir arquivo InBody
                            </a>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ==========================================
// ABA PRINCIPAL
// ==========================================
const TabAvaliacoes = ({ avaliacoes, alunoNome, podeExcluir, onExcluir, podeEditar, onEditar, perguntasPorId }) => {
    const [indiceAberto, setIndiceAberto] = useState(null);

    // Mais antiga primeiro (gráficos e navegação); a tabela mostra a mais recente no topo
    const cronologica = useMemo(
        () => [...(avaliacoes || [])].sort((a, b) => dataHora(a) - dataHora(b)),
        [avaliacoes]
    );
    const paraTabela = useMemo(() => [...cronologica].reverse(), [cronologica]);

    if (!avaliacoes || avaliacoes.length === 0) {
        return (
            <div className="py-16 flex flex-col items-center justify-center text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                <Dumbbell className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
                <h4 className="text-sm font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">Nenhuma avaliação física</h4>
                <p className="text-xs font-medium text-slate-400 mt-1">Este aluno ainda não realizou avaliações no sistema.</p>
            </div>
        );
    }

    const abrir = (id) => {
        const i = cronologica.findIndex((a) => a.id === id);
        if (i >= 0) setIndiceAberto(i);
    };

    const th = 'px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400';

    return (
        <div className="animate-[fadeIn_0.2s_ease-out] space-y-5">

            {/* Evolução */}
            <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-1">
                <CartaoEvolucao titulo="Peso" valores={cronologica.map((a) => parseNum(a.peso))} sufixo="kg" tipo="neutro" corLinha="stroke-slate-400" />
                <CartaoEvolucao titulo="Massa muscular" valores={cronologica.map(massaMuscular)} sufixo="kg" tipo="musculo" corLinha="stroke-blue-500" />
                <CartaoEvolucao titulo="Gordura" valores={cronologica.map(gorduraKg)} sufixo="kg" tipo="gordura" corLinha="stroke-orange-500" />
                <CartaoEvolucao titulo="% Gordura" valores={cronologica.map((a) => parseNum(a.pgc))} sufixo="%" tipo="gordura" corLinha="stroke-rose-500" />
            </div>

            {/* Tabela */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
                <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                            <th className={th}>Data e hora</th>
                            <th className={th}>Avaliador</th>
                            <th className={`${th} text-right`}>Peso</th>
                            <th className={`${th} text-right`}>Massa muscular</th>
                            <th className={`${th} text-right`}>Gordura</th>
                            <th className={`${th} text-right`}>% Gordura</th>
                            <th className={`${th} text-right`}>Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                        {paraTabela.map((av) => {
                            const m = massaMuscular(av);
                            const g = gorduraKg(av);
                            return (
                                <tr key={av.id} onClick={() => abrir(av.id)} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                                    <td className="px-5 py-3">
                                        <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">{formatarDataBR(av.data || av.created_at)}</span>
                                        {av.hora && <span className="block text-[10px] font-black text-slate-400">{String(av.hora).substring(0, 5)}</span>}
                                    </td>
                                    <td className="px-5 py-3 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase" title={av.professor || ''}>{nomeCurto(av.professor)}</td>
                                    <td className="px-5 py-3 text-xs font-black text-slate-800 dark:text-white text-right">{fmt(av.peso) ? `${fmt(av.peso)} kg` : '—'}</td>
                                    <td className="px-5 py-3 text-xs font-black text-blue-600 dark:text-blue-400 text-right">{m !== null ? `${fmt(m)} kg` : '—'}</td>
                                    <td className="px-5 py-3 text-xs font-black text-orange-600 dark:text-orange-400 text-right">{g !== null ? `${fmt(g)} kg` : '—'}</td>
                                    <td className="px-5 py-3 text-xs font-black text-rose-600 dark:text-rose-400 text-right">{fmt(av.pgc) ? `${fmt(av.pgc)}%` : '—'}</td>
                                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-end gap-2">
                                            <button type="button" onClick={() => abrir(av.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors">
                                                <Eye className="w-3.5 h-3.5" /> Ver avaliação
                                            </button>
                                            {av.arquivo_inbody_url && (
                                                <a href={av.arquivo_inbody_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors dark:hover:bg-blue-500/20">
                                                    <FileText className="w-3.5 h-3.5" /> PDF
                                                </a>
                                            )}
                                            {podeExcluir && onExcluir && (
                                                <button type="button" onClick={() => onExcluir(av.id)} aria-label="Excluir avaliação" title="Excluir avaliação" className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors dark:hover:text-rose-400">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {indiceAberto !== null && (
                <ModalVerAvaliacao
                    avaliacoes={cronologica}
                    indiceInicial={indiceAberto}
                    alunoNome={alunoNome}
                    perguntasPorId={perguntasPorId}
                    podeEditar={podeEditar}
                    onEditar={onEditar}
                    onClose={() => setIndiceAberto(null)}
                />
            )}
        </div>
    );
};

export default TabAvaliacoes;