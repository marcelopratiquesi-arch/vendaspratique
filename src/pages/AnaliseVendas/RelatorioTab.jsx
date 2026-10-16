import React, { useState, useRef, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient.js';
import { safeIsoDate, formatarCPF, formatDataBR, formatMoney, normalizeString, getCategoriaItem } from './utils.js';
import { Download, Share2, Trophy, LayoutList, ChevronDown, ChevronUp, X, Move, Copy, Check, Building2, FileX2, Users, Loader2, ArrowUpDown } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext.jsx';

// ==========================================
// 🧩 SUB-COMPONENTE: Botão de Cópia Rápida
// ==========================================
const CopyMiniButton = ({ textToCopy }) => {
    const [copied, setCopied] = useState(false);

    if (!textToCopy || textToCopy === 'Não informado' || textToCopy === '—') return null;

    const handleCopy = (e) => {
        e.stopPropagation();
        const cleanText = String(textToCopy).trim();
        navigator.clipboard.writeText(cleanText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            type="button"
            onClick={handleCopy}
            className="opacity-0 group-hover/row:opacity-100 p-1 bg-slate-100 hover:bg-blue-100 text-slate-400 hover:text-blue-600 rounded transition-all shrink-0"
            title="Copiar informação"
        >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
        </button>
    );
};

// ==========================================
// 🧠 EXTRATOR UNIVERSAL DE NOME E CPF (COM NORMALIZAÇÃO E CACHE DO BANCO)
// ==========================================
const extrairDadosPessoa = (reg, dicionarioAuxiliar = {}, cacheBanco = { porNome: {}, porMat: {}, porId: {} }) => {
    if (!reg) return { nome: 'Não informado', cpf: 'Não informado', cpfPuro: '', matricula: '' };

    let nomeBruto =
        reg.nome_aluno ||
        reg.aluno_nome ||
        reg.nome_visitante ||
        reg.visitante_nome ||
        reg.nome_avaliado ||
        reg.avaliado ||
        reg.aluno ||
        reg.visitante ||
        reg.cliente ||
        reg.nome_cliente ||
        reg.paciente ||
        reg.nome ||
        reg.alunos?.nome ||
        reg.visitantes?.nome ||
        '';

    if (typeof nomeBruto === 'object' && nomeBruto !== null) {
        nomeBruto = nomeBruto.nome || nomeBruto.nome_aluno || '';
    }

    let cpfBruto =
        reg.cpf ||
        reg.cpf_aluno ||
        reg.aluno_cpf ||
        reg.cpf_visitante ||
        reg.visitante_cpf ||
        reg.cpf_avaliado ||
        reg.documento ||
        reg.doc ||
        reg.alunos?.cpf ||
        reg.visitantes?.cpf ||
        (typeof reg.aluno === 'object' ? reg.aluno?.cpf : '') ||
        '';

    let matriculaBruta = String(
        reg.matricula ||
        reg.matricula_aluno ||
        reg.alunos?.matricula ||
        ''
    ).trim();

    const alunoId = reg.aluno_id || reg.id_aluno || '';

    const nomeNorm = normalizeString(String(nomeBruto || ''));
    let cpfLimpo = String(cpfBruto || '').replace(/\D/g, '');

    // RESGATE NÍVEL 1: Dicionário local da tela
    if (!nomeBruto && cpfLimpo && dicionarioAuxiliar.porCpf?.[cpfLimpo]) {
        nomeBruto = dicionarioAuxiliar.porCpf[cpfLimpo].nome;
    }
    if (!nomeBruto && matriculaBruta && dicionarioAuxiliar.porMat?.[matriculaBruta]) {
        nomeBruto = dicionarioAuxiliar.porMat[matriculaBruta].nome;
    }
    if (!cpfLimpo && matriculaBruta && dicionarioAuxiliar.porMat?.[matriculaBruta]?.cpf) {
        cpfLimpo = dicionarioAuxiliar.porMat[matriculaBruta].cpf;
    }
    if (!cpfLimpo && nomeNorm && dicionarioAuxiliar.porNome?.[nomeNorm]?.cpf) {
        cpfLimpo = dicionarioAuxiliar.porNome[nomeNorm].cpf;
    }

    // RESGATE NÍVEL 2: Cache buscado diretamente na tabela `alunos` do Supabase
    if (!cpfLimpo && alunoId && cacheBanco.porId?.[alunoId]?.cpf) {
        cpfLimpo = cacheBanco.porId[alunoId].cpf;
        if (!nomeBruto) nomeBruto = cacheBanco.porId[alunoId].nome;
        if (!matriculaBruta) matriculaBruta = cacheBanco.porId[alunoId].matricula || '';
    }
    if (!cpfLimpo && matriculaBruta && cacheBanco.porMat?.[matriculaBruta]?.cpf) {
        cpfLimpo = cacheBanco.porMat[matriculaBruta].cpf;
        if (!nomeBruto) nomeBruto = cacheBanco.porMat[matriculaBruta].nome;
    }
    if (!cpfLimpo && nomeNorm && cacheBanco.porNome?.[nomeNorm]?.cpf) {
        cpfLimpo = cacheBanco.porNome[nomeNorm].cpf;
        if (!matriculaBruta) matriculaBruta = cacheBanco.porNome[nomeNorm].matricula || '';
    }

    const nomeFinal = String(nomeBruto || '').trim() || 'Não informado';
    const cpfFormatado = cpfLimpo ? formatarCPF(cpfLimpo) : 'Não informado';

    return {
        nome: nomeFinal,
        cpf: cpfFormatado,
        cpfPuro: cpfLimpo,
        matricula: matriculaBruta
    };
};

// ==========================================
// 🧠 MODAL DRAGGABLE RESPONSIVO (COMPONENTE INTERNO)
// ==========================================
const ModalDraggable = ({ isOpen, onClose, titulo, subtitulo, children }) => {
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (!isOpen) setOffset({ x: 0, y: 0 });
    }, [isOpen]);

    useEffect(() => {
        const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    if (!isOpen) return null;

    const handlePointerDown = (e) => {
        if (e.target.closest('.no-drag')) return;
        setIsDragging(true);
        dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
        e.target.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e) => {
        if (!isDragging) return;
        setOffset({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
    };

    const handlePointerUp = (e) => {
        setIsDragging(false);
        e.target.releasePointerCapture(e.pointerId);
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-[fadeIn_0.2s_ease-out]">
            <div 
                className="bg-white rounded-[20px] shadow-2xl flex flex-col w-full max-w-5xl max-h-[90vh] overflow-hidden border border-slate-200 resize"
                style={{ transform: `translate(${offset.x}px, ${offset.y}px)`, transition: isDragging ? 'none' : 'transform 0.1s ease-out' }}
            >
                <div 
                    className="bg-slate-900 px-6 py-5 flex justify-between items-center cursor-move select-none touch-none border-b border-slate-800 group"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    title="Clique e segure para arrastar"
                >
                    <div className="flex items-center gap-4 no-drag">
                        <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                            <Move className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="flex flex-col">
                            <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight line-clamp-1">{titulo}</h3>
                            {subtitulo && <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mt-0.5">{subtitulo}</p>}
                        </div>
                    </div>
                    <button onClick={onClose} className="no-drag text-slate-400 hover:text-white transition-colors p-2 bg-white/5 hover:bg-rose-500 hover:text-white rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto bg-slate-50 no-drag custom-scrollbar">
                    {children}
                </div>
            </div>
        </div>
    );
};

// ==========================================
// 🧠 MOTOR DE CLASSIFICAÇÃO INTELIGENTE (ADMIN / LÍDER)
// ==========================================
const classificarParaAdmin = (nome, categoria) => {
    const prodNorm = normalizeString(nome);
    
    if (categoria === 'PRODUTO') return { grupo: 'PRODUTOS', tipo: 'AGRUPADO', order: 100, icone: '🛍️', cor: 'text-amber-600' };
    if (categoria === 'SERVICO') return { grupo: 'SERVIÇOS', tipo: 'AGRUPADO', order: 200, icone: '🧾', cor: 'text-violet-600' };
    if (categoria === 'NAO_CLASSIFICADO') return { grupo: 'NÃO CLASSIFICADOS', tipo: 'AGRUPADO', order: 300, icone: '❓', cor: 'text-slate-400' };

    if (prodNorm.includes('NUTRI')) return { grupo: 'NUTRI', tipo: 'AGRUPADO', order: 10, icone: '🥗', cor: 'text-emerald-600' };
    if (prodNorm.includes('PLUS') || prodNorm.includes('AFL')) return { grupo: 'PLUS', tipo: 'AGRUPADO', order: 20, icone: '⭐', cor: 'text-blue-600' };
    if (prodNorm.includes('FIT')) return { grupo: 'FIT', tipo: 'AGRUPADO', order: 30, icone: '🏃', cor: 'text-indigo-600' };
    if (prodNorm.includes('PERSONAL')) return { grupo: 'PERSONAL CLASS', tipo: 'INDIVIDUAL', order: 40, icone: '🏋️', cor: 'text-rose-600' };
    if (prodNorm.includes('1200') || prodNorm.includes('PROMO')) return { grupo: 'PROMOÇÕES', tipo: 'INDIVIDUAL', order: 50, icone: '🎯', cor: 'text-purple-600' };
    if (prodNorm.includes('FÉRIAS') || prodNorm.includes('FERIAS')) return { grupo: 'FÉRIAS', tipo: 'AGRUPADO', order: 60, icone: '🏖️', cor: 'text-orange-500' };
    
    return { grupo: 'OUTROS PLANOS', tipo: 'AGRUPADO', order: 90, icone: '🧩', cor: 'text-slate-600' };
};

const ORDEM_CLASSICA = ["NUTRI", "PLUS", "FIT", "PERSONAL CLASS", "PROMOÇÕES", "FÉRIAS", "OUTROS PLANOS", "PRODUTOS", "SERVIÇOS", "NÃO CLASSIFICADOS"];

// Colunas alinhadas da Matriz Executiva Global separadas nas 3 macro-categorias
const COLUNAS_MATRIZ = [
    { key: 'NUTRI', escopo: 'PLANOS', label: 'NUTRI', icone: '🥗', grupos: ['NUTRI'], badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100', headerColor: 'text-emerald-600' },
    { key: 'PLUS', escopo: 'PLANOS', label: 'PLUS', icone: '⭐', grupos: ['PLUS'], badgeBg: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100', headerColor: 'text-blue-600' },
    { key: 'FIT', escopo: 'PLANOS', label: 'FIT', icone: '🏃', grupos: ['FIT'], badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100', headerColor: 'text-indigo-600' },
    { key: 'PERSONAL', escopo: 'PLANOS', label: 'PERSONAL', icone: '🏋️', grupos: ['PERSONAL CLASS'], badgeBg: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100', headerColor: 'text-rose-600' },
    { key: 'OUTROS_PLANOS', escopo: 'PLANOS', label: 'OUTROS PL.', icone: '🧩', grupos: ['PROMOÇÕES', 'FÉRIAS', 'OUTROS PLANOS'], badgeBg: 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200', headerColor: 'text-slate-600' },
    { key: 'PRODUTOS', escopo: 'PRODUTOS', label: 'PRODUTOS', icone: '🛍️', grupos: ['PRODUTOS'], badgeBg: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100', headerColor: 'text-amber-600' },
    { key: 'SERVICOS', escopo: 'SERVICOS', label: 'SERVIÇOS', icone: '🧾', grupos: ['SERVIÇOS', 'NÃO CLASSIFICADOS'], badgeBg: 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100', headerColor: 'text-violet-600' }
];

const RelatorioTab = ({ vendasFiltradas = [], visitantesFiltrados = [], avaliacoesFiltradas = [], planos = [], produtos = [], temVisaoGlobal, labelFiltroAtual, abrirModalWhatsapp, usuarioLogado }) => {
    const { t, locale, language } = useI18n(); 
    const langAtual = locale || language || 'pt-BR';

    const [unidadesRecolhidas, setUnidadesRecolhidas] = useState({});
    const [visaoDetalhada, setVisaoDetalhada] = useState(false);
    
    // 🔥 4 CATEGORIAS SEPARADAS: 'TOTAL' | 'PLANOS' | 'PRODUTOS' | 'SERVICOS'
    const [criterioRanking, setCriterioRanking] = useState('TOTAL');
    const [colunaOrdemMatriz, setColunaOrdemMatriz] = useState(null);

    // 🔥 ESTADOS DO MODAL INTERATIVO E CACHE DE CPFs DO BANCO
    const [modalConfig, setModalConfig] = useState({
        isOpen: false,
        tipoTabela: '', // 'VENDA', 'VISITANTE', 'AVALIACAO'
        titulo: '',
        subtitulo: '',
        registros: [],
        totalItensUnicos: 0
    });
    const [cacheAlunosBanco, setCacheAlunosBanco] = useState({ porNome: {}, porMat: {}, porId: {} });
    const [buscandoCpfsBanco, setBuscandoCpfsBanco] = useState(false);

    const permissaoGerencial = temVisaoGlobal || (usuarioLogado && usuarioLogado.role === 'LIDER');

    const handleTrocarEscopoRanking = (novoEscopo) => {
        setCriterioRanking(novoEscopo);
        setColunaOrdemMatriz(null);
    };

    const handleOrdenarPorColunaMatriz = (colKey) => {
        setColunaOrdemMatriz(prev => prev === colKey ? null : colKey);
    };

    // 🔥 DICIONÁRIO DE RESGATE CRUZADO LOCAL
    const dicionarioPessoas = useMemo(() => {
        const porCpf = {};
        const porMat = {};
        const porNome = {};

        const indexar = (item) => {
            const nome = String(
                item?.nome_aluno || item?.aluno_nome || item?.nome_visitante || item?.aluno || item?.visitante || item?.nome || item?.alunos?.nome || ''
            ).trim();
            const cpf = String(
                item?.cpf || item?.cpf_aluno || item?.cpf_visitante || item?.documento || item?.alunos?.cpf || ''
            ).replace(/\D/g, '');
            const mat = String(item?.matricula || item?.alunos?.matricula || '').trim();
            const nomeNorm = normalizeString(nome);

            if (cpf && nome) porCpf[cpf] = { nome, cpf, matricula: mat };
            if (mat && (nome || cpf)) porMat[mat] = { nome: nome || porMat[mat]?.nome, cpf: cpf || porMat[mat]?.cpf, matricula: mat };
            if (nomeNorm && cpf) porNome[nomeNorm] = { nome, cpf, matricula: mat };
        };

        vendasFiltradas.forEach(indexar);
        visitantesFiltrados.forEach(indexar);
        avaliacoesFiltradas.forEach(indexar);

        return { porCpf, porMat, porNome };
    }, [vendasFiltradas, visitantesFiltrados, avaliacoesFiltradas]);

    // 🔥 AUTO-BUSCA NO SUPABASE QUANDO O MODAL ABRE E FALTAM CPFs
    useEffect(() => {
        if (!modalConfig.isOpen || modalConfig.registros.length === 0) return;

        const nomesSemCpf = new Set();
        const matsSemCpf = new Set();

        modalConfig.registros.forEach(reg => {
            const dados = extrairDadosPessoa(reg, dicionarioPessoas, cacheAlunosBanco);
            if (!dados.cpfPuro) {
                if (dados.nome && dados.nome !== 'Não informado') {
                    nomesSemCpf.add(dados.nome.toUpperCase().trim());
                }
                if (dados.matricula) {
                    matsSemCpf.add(dados.matricula);
                }
            }
        });

        if (nomesSemCpf.size === 0 && matsSemCpf.size === 0) return;

        let ativo = true;
        const buscarDadosFaltantesNoBanco = async () => {
            setBuscandoCpfsBanco(true);
            try {
                const novoPorNome = { ...cacheAlunosBanco.porNome };
                const novoPorMat = { ...cacheAlunosBanco.porMat };
                const novoPorId = { ...cacheAlunosBanco.porId };

                const registrarAlunoNoCache = (al) => {
                    if (!al) return;
                    const cpfLimpo = String(al.cpf || '').replace(/\D/g, '');
                    if (!cpfLimpo) return;
                    const nNorm = normalizeString(al.nome || '');
                    const mat = String(al.matricula || '').trim();
                    const obj = { nome: al.nome, cpf: cpfLimpo, matricula: mat };
                    if (nNorm) novoPorNome[nNorm] = obj;
                    if (mat) novoPorMat[mat] = obj;
                    if (al.id) novoPorId[al.id] = obj;
                };

                if (matsSemCpf.size > 0) {
                    const listaMats = Array.from(matsSemCpf);
                    const { data: porMatAlunos } = await supabase
                        .from('alunos')
                        .select('id, nome, cpf, matricula')
                        .in('matricula', listaMats);
                    (porMatAlunos || []).forEach(registrarAlunoNoCache);

                    const { data: porMatVinculos } = await supabase
                        .from('alunos_unidades')
                        .select('matricula, alunos(id, nome, cpf, matricula)')
                        .in('matricula', listaMats);
                    (porMatVinculos || []).forEach(v => {
                        if (v.alunos) {
                            registrarAlunoNoCache({ ...v.alunos, matricula: v.matricula || v.alunos.matricula });
                        }
                    });
                }

                if (nomesSemCpf.size > 0) {
                    const listaNomes = Array.from(nomesSemCpf);
                    const { data: porNomeExato } = await supabase
                        .from('alunos')
                        .select('id, nome, cpf, matricula')
                        .in('nome', listaNomes);
                    (porNomeExato || []).forEach(registrarAlunoNoCache);

                    const faltantesAinda = listaNomes.filter(n => !novoPorNome[normalizeString(n)]);
                    if (faltantesAinda.length > 0 && faltantesAinda.length <= 30) {
                        await Promise.all(
                            faltantesAinda.map(async (nomeAlvo) => {
                                const partes = nomeAlvo.split(/\s+/).filter(Boolean);
                                if (partes.length === 0) return;
                                const padraoBusca = partes.length >= 2 
                                    ? `%${partes[0]}%${partes[partes.length - 1]}%` 
                                    : `%${partes[0]}%`;
                                const { data } = await supabase
                                    .from('alunos')
                                    .select('id, nome, cpf, matricula')
                                    .ilike('nome', padraoBusca)
                                    .limit(5);
                                (data || []).forEach(registrarAlunoNoCache);
                            })
                        );
                    }
                }

                if (ativo) {
                    setCacheAlunosBanco({ porNome: novoPorNome, porMat: novoPorMat, porId: novoPorId });
                }
            } catch (err) {
                console.error("Erro ao resgatar CPFs na base de alunos:", err);
            } finally {
                if (ativo) setBuscandoCpfsBanco(false);
            }
        };

        buscarDadosFaltantesNoBanco();
        return () => { ativo = false; };
    }, [modalConfig.isOpen, modalConfig.registros, dicionarioPessoas]);

    const toggleUnidade = (unidade) => {
        setUnidadesRecolhidas(prev => ({
            ...prev,
            [unidade]: !prev[unidade]
        }));
    };

    const abrirModalAuditoria = (titulo, unidade, tipoTabela, registros, totalUnicos) => {
        setModalConfig({
            isOpen: true,
            titulo: titulo,
            subtitulo: `${unidade} — Ref: ${labelFiltroAtual}`,
            tipoTabela: tipoTabela,
            registros: registros,
            totalItensUnicos: totalUnicos
        });
    };

    const scrollRef = useRef(null);
    const isDragging = useRef(false);
    const startY = useRef(0);
    const scrollTop = useRef(0);

    const onMouseDown = (e) => {
        if (e.target.closest('button') || e.target.closest('.no-drag') || e.target.closest('.cursor-pointer')) return;
        isDragging.current = true;
        scrollRef.current.classList.add('cursor-grabbing');
        scrollRef.current.classList.remove('cursor-grab');
        scrollRef.current.style.userSelect = 'none';
        startY.current = e.pageY - scrollRef.current.offsetTop;
        scrollTop.current = scrollRef.current.scrollTop;
    };

    const onMouseLeaveOrUp = () => {
        isDragging.current = false;
        if (scrollRef.current) {
            scrollRef.current.classList.remove('cursor-grabbing');
            scrollRef.current.classList.add('cursor-grab');
            scrollRef.current.style.userSelect = 'auto';
        }
    };

    const onMouseMove = (e) => {
        if (!isDragging.current) return;
        e.preventDefault();
        const y = e.pageY - scrollRef.current.offsetTop;
        const walk = (y - startY.current) * 1.5; 
        scrollRef.current.scrollTop = scrollTop.current - walk;
    };

    const relatorioPorUnidade = {};
    let vendasGlobal = 0;

    const inicializarUnidade = (unidade) => {
        if (!relatorioPorUnidade[unidade]) {
            relatorioPorUnidade[unidade] = {
                totalGeralVendas: 0,
                vendedoresTotal: {},
                visitantes: [], 
                avaliacoes: [], 
                grupos: {
                    "NUTRI": { total: 0, itens: {}, cor: "text-emerald-600", bgIcone: "bg-emerald-100 text-emerald-600", icone: "🥗", escopo: "PLANOS" },
                    "PLUS": { total: 0, itens: {}, cor: "text-blue-600", bgIcone: "bg-blue-100 text-blue-600", icone: "⭐", escopo: "PLANOS" },
                    "FIT": { total: 0, itens: {}, cor: "text-indigo-600", bgIcone: "bg-indigo-100 text-indigo-600", icone: "🏃", escopo: "PLANOS" },
                    "PERSONAL CLASS": { total: 0, itens: {}, cor: "text-rose-600", bgIcone: "bg-rose-100 text-rose-600", icone: "🏋️", escopo: "PLANOS" }, 
                    "PROMOÇÕES": { total: 0, itens: {}, cor: "text-purple-600", bgIcone: "bg-purple-100 text-purple-600", icone: "🎯", escopo: "PLANOS" },
                    "FÉRIAS": { total: 0, itens: {}, cor: "text-orange-500", bgIcone: "bg-orange-100 text-orange-500", icone: "🏖️", escopo: "PLANOS" },
                    "OUTROS PLANOS": { total: 0, itens: {}, cor: "text-slate-600", bgIcone: "bg-slate-200 text-slate-600", icone: "🧩", escopo: "PLANOS" },
                    "PRODUTOS": { total: 0, itens: {}, cor: "text-amber-600", bgIcone: "bg-amber-100 text-amber-600", icone: "🛍️", escopo: "PRODUTOS" },
                    "SERVIÇOS": { total: 0, itens: {}, cor: "text-violet-600", bgIcone: "bg-violet-100 text-violet-600", icone: "🧾", escopo: "SERVICOS" },
                    "NÃO CLASSIFICADOS": { total: 0, itens: {}, cor: "text-slate-400", bgIcone: "bg-slate-100 text-slate-400", icone: "❓", escopo: "SERVICOS" }
                },
                gruposAdmin: {}
            };
        }
    };

    const transacoesUnicas = new Set();

    vendasFiltradas.forEach(v => {
        const unidade = v.unidade || 'SEM UNIDADE';
        inicializarUnidade(unidade);
        
        let qtd = parseInt(v.quantidade) || 1;
        const prodOriginal = (v.produto || 'ITEM NÃO IDENTIFICADO');
        const prodUpper = prodOriginal.toUpperCase().trim();
        const vendPrimeiroNome = (v.vendedor ? v.vendedor.split(' ')[0] : 'SISTEMA').charAt(0).toUpperCase() + (v.vendedor ? v.vendedor.split(' ')[0] : 'SISTEMA').slice(1).toLowerCase();
        
        const categoriaMestre = getCategoriaItem(prodOriginal, planos, produtos);

        if (categoriaMestre === 'PLANO' && v.matricula && v.matricula.trim() !== '') {
            const dataLimpa = safeIsoDate(v.data || v.created_at);
            const chaveUnica = `${v.matricula.trim()}-${prodUpper}-${dataLimpa}`;

            if (transacoesUnicas.has(chaveUnica)) {
                qtd = 0; 
            } else {
                transacoesUnicas.add(chaveUnica);
            }
        }

        const registro = relatorioPorUnidade[unidade];
        registro.totalGeralVendas += qtd;
        vendasGlobal += qtd;
        registro.vendedoresTotal[vendPrimeiroNome] = (registro.vendedoresTotal[vendPrimeiroNome] || 0) + qtd;

        let grupoAlvo = '';
        if (categoriaMestre === 'PLANO') {
            const nomeNorm = normalizeString(prodUpper);
            if (nomeNorm.includes("NUTRI")) grupoAlvo = "NUTRI";
            else if (nomeNorm.includes("PLUS") || nomeNorm.includes("AFL")) grupoAlvo = "PLUS";
            else if (nomeNorm.includes("FIT")) grupoAlvo = "FIT";
            else if (nomeNorm.includes("PERSONAL")) grupoAlvo = "PERSONAL CLASS"; 
            else if (nomeNorm.includes("1200") || nomeNorm.includes("PROMO")) grupoAlvo = "PROMOÇÕES"; 
            else if (nomeNorm.includes("FÉRIAS") || nomeNorm.includes("FERIAS")) grupoAlvo = "FÉRIAS"; 
            else grupoAlvo = "OUTROS PLANOS";
        } else if (categoriaMestre === 'PRODUTO') {
            grupoAlvo = "PRODUTOS";
        } else if (categoriaMestre === 'SERVICO') {
            grupoAlvo = "SERVIÇOS";
        } else {
            grupoAlvo = "NÃO CLASSIFICADOS";
        }

        if (grupoAlvo) {
            registro.grupos[grupoAlvo].total += qtd;
            if (!registro.grupos[grupoAlvo].itens[prodUpper]) {
                registro.grupos[grupoAlvo].itens[prodUpper] = { total: 0, vendedores: {}, vendasAuditaveis: [] };
            }
            registro.grupos[grupoAlvo].itens[prodUpper].total += qtd;
            registro.grupos[grupoAlvo].itens[prodUpper].vendedores[vendPrimeiroNome] = (registro.grupos[grupoAlvo].itens[prodUpper].vendedores[vendPrimeiroNome] || 0) + qtd;
            
            if (qtd > 0) {
                registro.grupos[grupoAlvo].itens[prodUpper].vendasAuditaveis.push({...v, qtdConsolidada: qtd});
            }
        }

        const clAdmin = classificarParaAdmin(prodOriginal, categoriaMestre);
        
        if (!registro.gruposAdmin[clAdmin.grupo]) {
            registro.gruposAdmin[clAdmin.grupo] = { 
                grupo: clAdmin.grupo,
                total: 0, 
                itens: {}, 
                tipo: clAdmin.tipo,
                order: clAdmin.order, 
                icone: clAdmin.icone, 
                cor: clAdmin.cor 
            };
        }
        registro.gruposAdmin[clAdmin.grupo].total += qtd;

        if (!registro.gruposAdmin[clAdmin.grupo].itens[prodUpper]) {
            registro.gruposAdmin[clAdmin.grupo].itens[prodUpper] = { total: 0 };
        }
        registro.gruposAdmin[clAdmin.grupo].itens[prodUpper].total += qtd;
    });

    visitantesFiltrados.forEach(v => {
        if (v.origem && v.origem !== 'RECEPCAO') return;
        const unidade = v.unidade || 'SEM UNIDADE';
        inicializarUnidade(unidade);
        relatorioPorUnidade[unidade].visitantes.push(v);
    });

    avaliacoesFiltradas.forEach(a => {
        const unidade = a.unidade || 'SEM UNIDADE';
        inicializarUnidade(unidade);
        relatorioPorUnidade[unidade].avaliacoes.push(a);
    });

    const unidadesOrdenadas = Object.keys(relatorioPorUnidade).sort();

    // 🔥 PROCESSAMENTO BASE DE TODAS AS UNIDADES PARA A MATRIZ (COM 4 ESCOPOS SEPARADOS)
    const baseRankingUnidades = unidadesOrdenadas
        .map(u => {
            const dados = relatorioPorUnidade[u];
            const colunas = {};
            const registrosPorColuna = {};
            const todosRegistrosUnidade = [];
            const registrosPlanosUnidade = [];
            const registrosProdutosUnidade = [];
            const registrosServicosUnidade = [];

            COLUNAS_MATRIZ.forEach(col => {
                let soma = 0;
                const regs = [];
                col.grupos.forEach(gName => {
                    const grp = dados.grupos[gName];
                    if (grp) {
                        soma += grp.total || 0;
                        Object.values(grp.itens).forEach(it => {
                            if (it.vendasAuditaveis?.length) {
                                regs.push(...it.vendasAuditaveis);
                            }
                        });
                    }
                });
                colunas[col.key] = soma;
                registrosPorColuna[col.key] = regs;
                todosRegistrosUnidade.push(...regs);

                if (col.escopo === 'PLANOS') registrosPlanosUnidade.push(...regs);
                else if (col.escopo === 'PRODUTOS') registrosProdutosUnidade.push(...regs);
                else if (col.escopo === 'SERVICOS') registrosServicosUnidade.push(...regs);
            });

            const totalPlanos = colunas.NUTRI + colunas.PLUS + colunas.FIT + colunas.PERSONAL + colunas.OUTROS_PLANOS;
            const totalProdutos = colunas.PRODUTOS || 0;
            const totalServicos = colunas.SERVICOS || 0;

            // Lista detalhada de itens físicos (para exibir quando SÓ PRODUTOS estiver ativo)
            const itensProdutosDetalhados = Object.entries(dados.grupos['PRODUTOS']?.itens || {})
                .filter(([_, d]) => d.total > 0)
                .sort((a, b) => b[1].total - a[1].total);

            // Lista detalhada de serviços (para exibir quando SÓ SERVIÇOS estiver ativo)
            const itensServicosDetalhados = [
                ...Object.entries(dados.grupos['SERVIÇOS']?.itens || {}),
                ...Object.entries(dados.grupos['NÃO CLASSIFICADOS']?.itens || {})
            ]
                .filter(([_, d]) => d.total > 0)
                .sort((a, b) => b[1].total - a[1].total);

            return {
                nome: u,
                vendas: dados.totalGeralVendas,
                totalPlanos,
                totalProdutos,
                totalServicos,
                colunas,
                registrosPorColuna,
                todosRegistrosUnidade,
                registrosPlanosUnidade,
                registrosProdutosUnidade,
                registrosServicosUnidade,
                itensProdutosDetalhados,
                itensServicosDetalhados
            };
        })
        .filter(u => u.vendas > 0);

    // Totais da Rede inteira para cada uma das 4 categorias
    const totaisRedeMatriz = COLUNAS_MATRIZ.reduce((acc, col) => {
        acc[col.key] = baseRankingUnidades.reduce((sum, u) => sum + (u.colunas[col.key] || 0), 0);
        return acc;
    }, { totalPlanos: 0, totalProdutos: 0, totalServicos: 0 });
    totaisRedeMatriz.totalPlanos = baseRankingUnidades.reduce((sum, u) => sum + u.totalPlanos, 0);
    totaisRedeMatriz.totalProdutos = baseRankingUnidades.reduce((sum, u) => sum + u.totalProdutos, 0);
    totaisRedeMatriz.totalServicos = baseRankingUnidades.reduce((sum, u) => sum + u.totalServicos, 0);

    // Colunas visíveis na tabela conforme a categoria selecionada
    const colunasMatrizVisiveis = COLUNAS_MATRIZ.filter(col => {
        if (criterioRanking === 'PLANOS') return col.escopo === 'PLANOS';
        if (criterioRanking === 'PRODUTOS') return col.escopo === 'PRODUTOS';
        if (criterioRanking === 'SERVICOS') return col.escopo === 'SERVICOS';
        return true;
    });

    // Ranking filtrado e ordenado conforme a categoria ativa
    const rankingUnidades = [...baseRankingUnidades]
        .filter(u => {
            if (criterioRanking === 'PLANOS') return u.totalPlanos > 0;
            if (criterioRanking === 'PRODUTOS') return u.totalProdutos > 0;
            if (criterioRanking === 'SERVICOS') return u.totalServicos > 0;
            return u.vendas > 0;
        })
        .sort((a, b) => {
            if (colunaOrdemMatriz) {
                const valA = a.colunas[colunaOrdemMatriz] || 0;
                const valB = b.colunas[colunaOrdemMatriz] || 0;
                if (valB !== valA) return valB - valA;
            }
            if (criterioRanking === 'PLANOS') {
                if (b.totalPlanos !== a.totalPlanos) return b.totalPlanos - a.totalPlanos;
                return b.vendas - a.vendas;
            }
            if (criterioRanking === 'PRODUTOS') {
                if (b.totalProdutos !== a.totalProdutos) return b.totalProdutos - a.totalProdutos;
                return b.vendas - a.vendas;
            }
            if (criterioRanking === 'SERVICOS') {
                if (b.totalServicos !== a.totalServicos) return b.totalServicos - a.totalServicos;
                return b.vendas - a.vendas;
            }
            if (b.vendas !== a.vendas) return b.vendas - a.vendas;
            return b.totalPlanos - a.totalPlanos;
        });

    const exportarCSV = () => {
        try {
            if (vendasFiltradas.length === 0) {
                alert(t('analytics.report.noDataExport', { defaultValue: "Não há dados para exportar com os filtros atuais." }));
                return;
            }

            let csvContent = ""; 

            if (visaoDetalhada) {
                const cabeçalho = ['ID', 'Data', 'Unidade', 'Matricula', 'Aluno', 'Produto', 'Qtd', 'Vendedor'];
                const linhas = vendasFiltradas.map(v => {
                    const dataFormatada = v.data || v.created_at ? safeIsoDate(v.data || v.created_at) : '';
                    const pessoa = extrairDadosPessoa(v, dicionarioPessoas, cacheAlunosBanco);
                    return [
                        v.id || '',
                        dataFormatada,
                        `"${(v.unidade || '').replace(/"/g, '""')}"`,
                        `"${(pessoa.matricula || '').replace(/"/g, '""')}"`,
                        `"${(pessoa.nome || '').replace(/"/g, '""')}"`,
                        `"${(v.produto || '').replace(/"/g, '""')}"`,
                        v.quantidade || 1,
                        `"${(v.vendedor || '').replace(/"/g, '""')}"`
                    ].join(';');
                });
                csvContent = [cabeçalho.join(';'), ...linhas].join('\n');
            } else {
                const cabeçalho = ['Unidade', 'Categoria', 'Quantidade Total'];
                const linhas = [];
                unidadesOrdenadas.forEach(uni => {
                    const dados = relatorioPorUnidade[uni];
                    const gruposOrd = Object.values(dados.gruposAdmin).sort((a,b) => {
                        if (a.order !== b.order) return a.order - b.order;
                        return b.total - a.total;
                    });

                    gruposOrd.forEach(info => {
                        if (info.total > 0) {
                            linhas.push(`"${uni}";"${info.grupo}";${info.total}`);
                        }
                    });
                });
                csvContent = [cabeçalho.join(';'), ...linhas].join('\n');
            }
            
            const hojeData = new Date();
            const anoStr = hojeData.getFullYear();
            const mesStr = String(hojeData.getMonth() + 1).padStart(2, '0');
            const diaStr = String(hojeData.getDate()).padStart(2, '0');
            const dataStringSegura = `${anoStr}-${mesStr}-${diaStr}`;
            
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `Exportacao_Vendas_${visaoDetalhada ? 'Detalhada' : 'Resumo'}_${dataStringSegura}.csv`);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(url);
            
        } catch (error) {
            console.error("Erro ao exportar CSV:", error);
            alert(t('analytics.report.exportError', { defaultValue: "Ocorreu um erro ao gerar a planilha. Verifique o console para mais detalhes." }));
        }
    };

    const gerarRelatorioGlobalWhatsapp = () => {
        if (unidadesOrdenadas.length === 0) {
            alert(t('analytics.report.noDataWpp', { defaultValue: "Não há dados para gerar relatório com os filtros atuais." }));
            return;
        }

        const dataAtual = new Date();
        const dia = String(dataAtual.getDate()).padStart(2, '0');
        const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
        const hojeSemAno = `${dia}/${mes}`;
        const horaAtual = dataAtual.toLocaleTimeString(langAtual, { hour: '2-digit', minute: '2-digit' });

        let txt = `${t('analytics.report.wppGlobalTitle', { defaultValue: '📊 *RESUMO EXECUTIVO – PRATIQUE FITNESS* 📊' })}\n`;
        txt += `${t('analytics.report.wppActiveFilter', { defaultValue: '📅 *Filtro Ativo:*' })} ${labelFiltroAtual}\n`;
        txt += `${t('analytics.report.wppGeneratedAt', { defaultValue: '🕐 *Gerado em:*' })} ${hojeSemAno} às ${horaAtual}\n\n`;

        rankingUnidades.forEach((uni) => {
            const dados = relatorioPorUnidade[uni.nome];
            txt += `🏢 *${uni.nome}:* ${uni.vendas} ${t('analytics.report.wppSalesLow', { defaultValue: 'vendas' })}\n\n`;
            
            const gruposOrd = Object.values(dados.gruposAdmin).sort((a,b) => {
                if(a.order !== b.order) return a.order - b.order;
                return b.total - a.total;
            });

            gruposOrd.forEach(g => {
                if(g.total === 0) return;
                
                txt += `${g.icone} *${g.grupo} — ${String(g.total).padStart(2, '0')}*\n`;
                
                if (visaoDetalhada && g.tipo === 'AGRUPADO') {
                    Object.entries(g.itens).sort((a,b)=>b[1].total - a[1].total).forEach(([ni, di]) => {
                        txt += `▫️ ${String(di.total).padStart(2, '0')}x ${ni}\n`;
                    });
                }
                
                txt += `\n`;
            });
        });

        txt += `${t('analytics.report.wppTotalGlobal', { defaultValue: '📈 *TOTAL GERAL:*' })} ${vendasGlobal} ${t('analytics.report.wppSalesLow', { defaultValue: 'vendas' })}\n`;

        abrirModalWhatsapp(txt.trim(), { titulo: t('analytics.report.wppGlobalModal', { defaultValue: 'Resumo Global' }), icone: 'share-2', cor: 'blue' });
    };

    const gerarTextoFechamento = (unidadeAlvo) => {
        const dataAtual = new Date();
        const dia = String(dataAtual.getDate()).padStart(2, '0');
        const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
        const ano = dataAtual.getFullYear();
        
        const hojeDataBR = `${dia}/${mes}/${ano}`;
        const hojeSemAno = `${dia}/${mes}`;
        const horaAtual = dataAtual.toLocaleTimeString(langAtual, { hour: '2-digit', minute: '2-digit' });

        let labelReferencia = labelFiltroAtual;
        let labelEnviado = `${hojeSemAno} às ${horaAtual}`;

        if (labelFiltroAtual === hojeDataBR) {
            const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
            const diaSemanaStr = diasSemana[dataAtual.getDay()];
            labelReferencia = `${diaSemanaStr}, ${hojeSemAno}`; 
        }

        const dados = relatorioPorUnidade[unidadeAlvo];

        let txt = `${t('analytics.report.wppCloseTitle', { defaultValue: '📊 *RELATÓRIO DE FECHAMENTO – PRATIQUE FITNESS* 📊' })}\n`;
        txt += `${t('analytics.report.wppRef', { defaultValue: '📅 *Referência:*' })} ${labelReferencia}\n`;
        txt += `${t('analytics.report.wppSentAt', { defaultValue: '🕐 *Enviado em:*' })} ${labelEnviado}\n`;
        txt += `${t('analytics.report.wppUnit', { defaultValue: '🏢 *Unidade:*' })} ${unidadeAlvo}\n\n`;
        
        txt += `${t('analytics.report.wppSalesSummary', { defaultValue: '📌 *RESUMO DAS VENDAS*' })}\n\n`;

        const gruposClassicosOrdenados = Object.entries(dados.grupos)
            .sort((a, b) => ORDEM_CLASSICA.indexOf(a[0]) - ORDEM_CLASSICA.indexOf(b[0]))
            .filter(([_, info]) => info.total > 0);

        gruposClassicosOrdenados.forEach(([nomeGrupo, grupoInfo]) => {
            const icone = grupoInfo.icone || "🔹";

            txt += `${icone} *${nomeGrupo} — ${String(grupoInfo.total).padStart(2, '0')} ${grupoInfo.total > 1 ? t('analytics.report.wppSalesLow', { defaultValue: 'vendas' }) : t('analytics.report.wppSaleLow', { defaultValue: 'venda' })}*\n`;
            
            const itensOrdenados = Object.entries(grupoInfo.itens).sort((a,b) => b[1].total - a[1].total);
            itensOrdenados.forEach(([nomeItem, itemData]) => {
                if (itemData.total > 0) {
                    const stringConsultores = Object.entries(itemData.vendedores)
                        .filter(([_, vQtd]) => vQtd > 0)
                        .sort((a,b) => b[1] - a[1])
                        .map(([vNome, vQtd]) => `${vNome} ${String(vQtd).padStart(2, '0')}`)
                        .join(', ');
                    
                    const txtConsultores = stringConsultores ? ` (${stringConsultores})` : '';
                    txt += `▫️ ${String(itemData.total).padStart(2, '0')}x ${nomeItem}${txtConsultores}\n`;
                }
            });
            
            txt += `\n`;
        });

        if (dados.totalGeralVendas > 0) {
            txt += `${t('analytics.report.wppSalesByConsultant', { defaultValue: '👥 *VENDAS POR CONSULTOR*' })}\n`;
            const consultoresOrdenados = Object.entries(dados.vendedoresTotal)
                .filter(([_, cTotal]) => cTotal > 0)
                .sort((a,b) => b[1] - a[1]);
                
            consultoresOrdenados.forEach(([cNome, cTotal]) => {
                txt += `${cNome} — ${String(cTotal).padStart(2, '0')}\n`;
            });
            txt += `\n${t('analytics.report.wppTotalSalesUpper', { defaultValue: '📈 *TOTAL DE VENDAS:' })} ${String(dados.totalGeralVendas).padStart(2, '0')}*\n`;
        } else {
            txt += `${t('analytics.report.wppNoSales', { defaultValue: 'Nenhuma venda registrada.' })}\n`;
        }
        
        txt += `\n➖➖➖➖➖➖➖➖➖➖\n\n`;
        txt += `${t('analytics.report.wppVisitorsDesk', { defaultValue: '👥 *VISITANTES (BALCÃO):*' })} ${String(dados.visitantes.length).padStart(2, '0')}\n`;
        txt += `${t('analytics.report.wppAssessmentsDone', { defaultValue: '📋 *AVALIAÇÕES FEITAS:*' })} ${String(dados.avaliacoes.length).padStart(2, '0')}\n`;

        abrirModalWhatsapp(txt.trim(), { titulo: `${t('analytics.report.reportName', { defaultValue: 'Relatório' })}: ${unidadeAlvo}`, icone: 'file-text', cor: 'blue' });
    };

    // 🔥 RENDERIZADORES DAS TABELAS DO MODAL
    const RenderTabelaModal = () => {
        if (modalConfig.registros.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-20 opacity-60">
                    <LayoutList className="w-12 h-12 text-slate-300 mb-4" />
                    <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Nenhum registro detalhado encontrado.</p>
                </div>
            );
        }

        if (modalConfig.tipoTabela === 'VENDA') {
            return (
                <div className="w-full overflow-x-auto custom-scrollbar bg-white">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-slate-100/50 border-b border-slate-200">
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky left-0 bg-slate-100/90 backdrop-blur">Aluno</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">CPF</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Data</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Plano/Produto</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Qtd</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Vendedor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {modalConfig.registros.map((v, i) => {
                                const pessoa = extrairDadosPessoa(v, dicionarioPessoas, cacheAlunosBanco);
                                return (
                                    <tr key={i} className="hover:bg-blue-50/50 transition-colors group/row">
                                        <td className="py-4 px-5 font-bold text-slate-800 text-xs sticky left-0 bg-white/95 backdrop-blur">
                                            <div className="flex items-center gap-2 max-w-[220px]">
                                                <span className="truncate uppercase" title={pessoa.nome}>{pessoa.nome}</span>
                                                <CopyMiniButton textToCopy={pessoa.nome} />
                                            </div>
                                        </td>
                                        <td className="py-4 px-5 font-mono text-[11px] font-bold text-slate-600">
                                            <div className="flex items-center gap-2">
                                                <span>{pessoa.cpf}</span>
                                                <CopyMiniButton textToCopy={pessoa.cpfPuro || pessoa.cpf} />
                                            </div>
                                        </td>
                                        <td className="py-4 px-5 text-xs text-slate-600 font-medium whitespace-nowrap">{formatDataBR(v.data || v.created_at)}</td>
                                        <td className="py-4 px-5 text-xs font-bold text-blue-700 uppercase truncate max-w-[250px]" title={v.produto}>{v.produto}</td>
                                        <td className="py-4 px-5 text-xs font-black text-center text-slate-800">{v.qtdConsolidada || v.quantidade || 1}</td>
                                        <td className="py-4 px-5 text-xs font-bold text-slate-600 uppercase truncate max-w-[150px]">{v.vendedor || 'Sistema'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            );
        }

        if (modalConfig.tipoTabela === 'VISITANTE') {
            return (
                <div className="w-full overflow-x-auto custom-scrollbar bg-white">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-slate-100/50 border-b border-slate-200">
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky left-0 bg-slate-100/90 backdrop-blur">Visitante / Aluno</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">CPF</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Telefone</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Data</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Consultor Resp.</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {modalConfig.registros.map((v, i) => {
                                const pessoa = extrairDadosPessoa(v, dicionarioPessoas, cacheAlunosBanco);
                                const tel = v.telefone || v.celular || v.contato || v.whatsapp || 'Não informado';
                                const responsavel = v.consultor || v.vendedor || v.responsavel || v.atendente || v.criado_por || 'Recepção';
                                return (
                                    <tr key={i} className="hover:bg-blue-50/50 transition-colors group/row">
                                        <td className="py-4 px-5 font-bold text-slate-800 text-xs sticky left-0 bg-white/95 backdrop-blur">
                                            <div className="flex items-center gap-2 max-w-[220px]">
                                                <span className="truncate uppercase" title={pessoa.nome}>{pessoa.nome}</span>
                                                <CopyMiniButton textToCopy={pessoa.nome} />
                                            </div>
                                        </td>
                                        <td className="py-4 px-5 font-mono text-[11px] font-bold text-slate-600">
                                            <div className="flex items-center gap-2">
                                                <span>{pessoa.cpf}</span>
                                                <CopyMiniButton textToCopy={pessoa.cpfPuro || pessoa.cpf} />
                                            </div>
                                        </td>
                                        <td className="py-4 px-5 font-mono text-[11px] text-slate-600">{tel}</td>
                                        <td className="py-4 px-5 text-xs text-slate-600 font-medium whitespace-nowrap">{formatDataBR(v.data || v.criado_em || v.created_at)}</td>
                                        <td className="py-4 px-5 text-xs font-bold text-slate-600 uppercase truncate max-w-[150px]">{responsavel}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            );
        }

        if (modalConfig.tipoTabela === 'AVALIACAO') {
            return (
                <div className="w-full overflow-x-auto custom-scrollbar bg-white">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-slate-100/50 border-b border-slate-200">
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky left-0 bg-slate-100/90 backdrop-blur">Aluno Avaliado</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">CPF</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Data</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Professor / Avaliador</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Situação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {modalConfig.registros.map((a, i) => {
                                const pessoa = extrairDadosPessoa(a, dicionarioPessoas, cacheAlunosBanco);
                                const prof = a.professor || a.avaliador || a.instrutor || a.profissional || a.responsavel || a.criado_por || 'Não informado';
                                const statusAval = a.status || a.situacao || 'Concluída';
                                return (
                                    <tr key={i} className="hover:bg-blue-50/50 transition-colors group/row">
                                        <td className="py-4 px-5 font-bold text-slate-800 text-xs sticky left-0 bg-white/95 backdrop-blur">
                                            <div className="flex items-center gap-2 max-w-[260px]">
                                                <span className="truncate uppercase" title={pessoa.nome}>{pessoa.nome}</span>
                                                {pessoa.matricula && (
                                                    <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                                                        MAT: {pessoa.matricula}
                                                    </span>
                                                )}
                                                <CopyMiniButton textToCopy={pessoa.nome} />
                                            </div>
                                        </td>
                                        <td className="py-4 px-5 font-mono text-[11px] font-bold text-slate-600">
                                            <div className="flex items-center gap-2">
                                                <span>{pessoa.cpf}</span>
                                                <CopyMiniButton textToCopy={pessoa.cpfPuro || pessoa.cpf} />
                                            </div>
                                        </td>
                                        <td className="py-4 px-5 text-xs text-slate-600 font-medium whitespace-nowrap">{formatDataBR(a.data || a.data_avaliacao || a.created_at)}</td>
                                        <td className="py-4 px-5 text-xs font-bold text-slate-700 uppercase truncate max-w-[180px]">{prof}</td>
                                        <td className="py-4 px-5">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-emerald-50 text-emerald-600 border border-emerald-200">
                                                {statusAval}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            );
        }

        return null;
    };

    const top3Unidades = rankingUnidades.slice(0, 3);
    const totalEscopoAtivoRede = criterioRanking === 'PLANOS' 
        ? totaisRedeMatriz.totalPlanos 
        : criterioRanking === 'PRODUTOS' 
        ? totaisRedeMatriz.totalProdutos 
        : criterioRanking === 'SERVICOS'
        ? totaisRedeMatriz.totalServicos
        : vendasGlobal;

    return (
        <div 
            className="animate-[fadeIn_0.3s_ease-out] max-h-[75vh] overflow-y-auto custom-scrollbar cursor-grab px-2 pb-10"
            ref={scrollRef}
            onMouseDown={onMouseDown}
            onMouseLeave={onMouseLeaveOrUp}
            onMouseUp={onMouseLeaveOrUp}
            onMouseMove={onMouseMove}
        >
            <ModalDraggable 
                isOpen={modalConfig.isOpen} 
                onClose={() => setModalConfig({...modalConfig, isOpen: false})}
                titulo={modalConfig.titulo}
                subtitulo={modalConfig.subtitulo}
            >
                <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between no-drag">
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                        Total Encontrado: <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 ml-1">{modalConfig.totalItensUnicos} Itens Consolidados</span>
                    </span>
                    {buscandoCpfsBanco && (
                        <span className="flex items-center gap-1.5 text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sincronizando CPFs da base...
                        </span>
                    )}
                </div>
                <RenderTabelaModal />
            </ModalDraggable>

            <div className="space-y-8">

                {/* 📌 BARRA DE AÇÕES GERENCIAIS E CHAVE SELETORA */}
                {unidadesOrdenadas.length > 0 && permissaoGerencial && (
                    <div className="bg-white p-4 md:p-6 rounded-[24px] shadow-sm border border-slate-200 flex flex-col md:flex-row gap-6 items-center justify-between no-drag">
                        
                        <div className="flex items-center gap-4 w-full md:w-auto">
                            <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center shadow-md shrink-0">
                                <LayoutList className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-800 uppercase tracking-widest">Painel Gerencial</h3>
                                <p className="text-[11px] font-bold text-slate-400 mt-0.5">Visão Global e Exportação</p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row w-full md:w-auto gap-4 items-center">
                            <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full sm:w-auto">
                                <button 
                                    onClick={() => setVisaoDetalhada(false)}
                                    className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!visaoDetalhada ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    Resumo
                                </button>
                                <button 
                                    onClick={() => setVisaoDetalhada(true)}
                                    className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${visaoDetalhada ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    Detalhado
                                </button>
                            </div>

                            <div className="flex w-full sm:w-auto gap-3">
                                <button 
                                    onClick={exportarCSV}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors border border-slate-200"
                                >
                                    <Download className="w-4 h-4" /> Planilha
                                </button>
                                <button 
                                    onClick={gerarRelatorioGlobalWhatsapp}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors border border-emerald-200"
                                >
                                    <Share2 className="w-4 h-4" /> WhatsApp
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 🏆 MATRIZ EXECUTIVA ALINHADA + PÓDIO TOP 3 (4 CATEGORIAS SEPARADAS) */}
                {permissaoGerencial && baseRankingUnidades.length > 0 && (
                    <div className="bg-white rounded-[24px] shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-200 overflow-hidden no-drag animate-[slideDown_0.4s_ease-out]">
                        
                        {/* CABEÇALHO DO RANKING + 4 BOTÕES DE CATEGORIA */}
                        <div className="p-6 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500 shadow-inner">
                                    <Trophy className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                                        Ranking Global & Matriz de Composição
                                    </h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                        Clique nos números para auditar os alunos ou no título da coluna para ordenar • {rankingUnidades.length} Unidades Ativas
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Categoria:</span>
                                <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
                                    <button
                                        type="button"
                                        onClick={() => handleTrocarEscopoRanking('TOTAL')}
                                        className={`px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${criterioRanking === 'TOTAL' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        Total Geral ({vendasGlobal})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleTrocarEscopoRanking('PLANOS')}
                                        className={`px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${criterioRanking === 'PLANOS' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        Só Planos ({totaisRedeMatriz.totalPlanos})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleTrocarEscopoRanking('PRODUTOS')}
                                        className={`px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${criterioRanking === 'PRODUTOS' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        Só Produtos ({totaisRedeMatriz.totalProdutos})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleTrocarEscopoRanking('SERVICOS')}
                                        className={`px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${criterioRanking === 'SERVICOS' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        Só Serviços ({totaisRedeMatriz.totalServicos})
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 🥇🥈🥉 PÓDIO TOP 3 DINÂMICO */}
                        {top3Unidades.length > 0 && (
                            <div className="p-6 bg-slate-50/70 border-b border-slate-200/80 grid grid-cols-1 md:grid-cols-3 gap-4">
                                {top3Unidades.map((uni, idx) => {
                                    const valorPrincipalPodio = criterioRanking === 'PLANOS' 
                                        ? uni.totalPlanos 
                                        : criterioRanking === 'PRODUTOS' 
                                        ? uni.totalProdutos 
                                        : criterioRanking === 'SERVICOS'
                                        ? uni.totalServicos
                                        : uni.vendas;

                                    const labelPrincipalPodio = criterioRanking === 'PLANOS'
                                        ? 'Planos Vendidos'
                                        : criterioRanking === 'PRODUTOS'
                                        ? 'Produtos Vendidos'
                                        : criterioRanking === 'SERVICOS'
                                        ? 'Serviços Vendidos'
                                        : 'Vendas Totais';

                                    const registrosDoPodio = criterioRanking === 'PLANOS'
                                        ? uni.registrosPlanosUnidade
                                        : criterioRanking === 'PRODUTOS'
                                        ? uni.registrosProdutosUnidade
                                        : criterioRanking === 'SERVICOS'
                                        ? uni.registrosServicosUnidade
                                        : uni.todosRegistrosUnidade;

                                    const pctShareRede = totalEscopoAtivoRede > 0
                                        ? Math.round((valorPrincipalPodio / totalEscopoAtivoRede) * 100)
                                        : 0;

                                    const estilosPodio = [
                                        {
                                            medalha: '🥇 1º LUGAR',
                                            card: 'bg-gradient-to-br from-amber-50/90 via-white to-white border-amber-300 ring-1 ring-amber-200/60',
                                            badge: 'bg-amber-100 text-amber-800 border-amber-300',
                                            numero: 'text-amber-600'
                                        },
                                        {
                                            medalha: '🥈 2º LUGAR',
                                            card: 'bg-gradient-to-br from-slate-100/80 via-white to-white border-slate-300',
                                            badge: 'bg-slate-200/80 text-slate-700 border-slate-300',
                                            numero: 'text-slate-700'
                                        },
                                        {
                                            medalha: '🥉 3º LUGAR',
                                            card: 'bg-gradient-to-br from-orange-50/70 via-white to-white border-orange-200',
                                            badge: 'bg-orange-100 text-orange-800 border-orange-200',
                                            numero: 'text-orange-600'
                                        }
                                    ][idx];

                                    return (
                                        <div 
                                            key={uni.nome}
                                            onClick={() => abrirModalAuditoria(`${labelPrincipalPodio} — ${uni.nome}`, uni.nome, 'VENDA', registrosDoPodio, valorPrincipalPodio)}
                                            className={`p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between ${estilosPodio.card}`}
                                            title="Clique para auditar os alunos desta unidade"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={`inline-block px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${estilosPodio.badge}`}>
                                                            {estilosPodio.medalha}
                                                        </span>
                                                        <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                            {pctShareRede}% da Rede
                                                        </span>
                                                    </div>
                                                    <h4 className="text-base font-black text-slate-800 uppercase tracking-tight truncate mt-2" title={uni.nome}>
                                                        {uni.nome}
                                                    </h4>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <span className={`text-3xl font-black leading-none ${estilosPodio.numero}`}>
                                                        {String(valorPrincipalPodio).padStart(2, '0')}
                                                    </span>
                                                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                                                        {labelPrincipalPodio}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Rodapé Dinâmico do Card do Pódio conforme a Categoria */}
                                            <div className="mt-4 pt-3 border-t border-slate-200/60">
                                                {criterioRanking === 'TOTAL' && (() => {
                                                    const tot = uni.vendas || 1;
                                                    const pctPlanos = Math.round((uni.totalPlanos / tot) * 100);
                                                    const pctProd = Math.round((uni.totalProdutos / tot) * 100);
                                                    const pctServ = Math.max(0, 100 - pctPlanos - pctProd);
                                                    return (
                                                        <>
                                                            <div className="flex flex-wrap justify-between text-[9px] font-black uppercase tracking-wider mb-1.5 gap-1">
                                                                <span className="text-emerald-600">📋 {String(uni.totalPlanos).padStart(2, '0')} Planos ({pctPlanos}%)</span>
                                                                <span className="text-amber-600">🛍️ {String(uni.totalProdutos).padStart(2, '0')} Prod ({pctProd}%)</span>
                                                                <span className="text-violet-600">🧾 {String(uni.totalServicos).padStart(2, '0')} Serv ({pctServ}%)</span>
                                                            </div>
                                                            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden flex">
                                                                <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${pctPlanos}%` }}></div>
                                                                <div className="bg-amber-400 h-full transition-all duration-500" style={{ width: `${pctProd}%` }}></div>
                                                                <div className="bg-violet-500 h-full transition-all duration-500" style={{ width: `${pctServ}%` }}></div>
                                                            </div>
                                                        </>
                                                    );
                                                })()}

                                                {criterioRanking === 'PLANOS' && (() => {
                                                    const totP = uni.totalPlanos || 1;
                                                    const pNutri = Math.round(((uni.colunas.NUTRI || 0) / totP) * 100);
                                                    const pPlus = Math.round(((uni.colunas.PLUS || 0) / totP) * 100);
                                                    const pFit = Math.round(((uni.colunas.FIT || 0) / totP) * 100);
                                                    const pOutros = Math.max(0, 100 - pNutri - pPlus - pFit);
                                                    return (
                                                        <>
                                                            <div className="flex flex-wrap justify-between text-[9px] font-black uppercase tracking-wider mb-1.5 gap-1">
                                                                <span className="text-emerald-600">🥗 Nutri: {String(uni.colunas.NUTRI || 0).padStart(2, '0')}</span>
                                                                <span className="text-blue-600">⭐ Plus: {String(uni.colunas.PLUS || 0).padStart(2, '0')}</span>
                                                                <span className="text-indigo-600">🏃 Fit: {String(uni.colunas.FIT || 0).padStart(2, '0')}</span>
                                                                <span className="text-rose-600">🏋️ Pers/Out: {String((uni.colunas.PERSONAL || 0) + (uni.colunas.OUTROS_PLANOS || 0)).padStart(2, '0')}</span>
                                                            </div>
                                                            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden flex">
                                                                <div className="bg-emerald-500 h-full" style={{ width: `${pNutri}%` }}></div>
                                                                <div className="bg-blue-500 h-full" style={{ width: `${pPlus}%` }}></div>
                                                                <div className="bg-indigo-500 h-full" style={{ width: `${pFit}%` }}></div>
                                                                <div className="bg-rose-400 h-full" style={{ width: `${pOutros}%` }}></div>
                                                            </div>
                                                        </>
                                                    );
                                                })()}

                                                {criterioRanking === 'PRODUTOS' && (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {uni.itensProdutosDetalhados.slice(0, 3).map(([nomeItem, d]) => (
                                                            <span key={nomeItem} className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded text-[9px] font-black uppercase truncate max-w-[140px]">
                                                                {String(d.total).padStart(2, '0')}x {nomeItem}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                {criterioRanking === 'SERVICOS' && (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {uni.itensServicosDetalhados.slice(0, 3).map(([nomeItem, d]) => (
                                                            <span key={nomeItem} className="inline-flex items-center gap-1 bg-violet-50 border border-violet-200 text-violet-800 px-2 py-0.5 rounded text-[9px] font-black uppercase truncate max-w-[140px]">
                                                                {String(d.total).padStart(2, '0')}x {nomeItem}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* 📊 TABELA MATRIZ EXECUTIVA ALINHADA */}
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[750px]">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-100/70">
                                        <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-16 text-center">Pos</th>
                                        <th className="py-3.5 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest min-w-[180px] sticky left-0 bg-slate-100/95 backdrop-blur z-10">Unidade</th>
                                        
                                        {/* Coluna TOTAL GERAL (visível apenas no modo TOTAL) */}
                                        {criterioRanking === 'TOTAL' && (
                                            <th 
                                                onClick={() => setColunaOrdemMatriz(null)}
                                                className="py-3.5 px-3 text-[10px] font-black text-slate-800 uppercase tracking-widest text-center bg-slate-200/60 w-28 cursor-pointer hover:bg-slate-200 transition-colors"
                                                title="Ordenar pelo Total Geral"
                                            >
                                                Total Geral
                                            </th>
                                        )}

                                        {/* Coluna SOMA DE PLANOS (visível no modo TOTAL e SÓ PLANOS) */}
                                        {(criterioRanking === 'TOTAL' || criterioRanking === 'PLANOS') && (
                                            <th 
                                                onClick={() => setColunaOrdemMatriz(null)}
                                                className="py-3.5 px-3 text-[10px] font-black text-emerald-700 uppercase tracking-widest text-center bg-emerald-50/70 border-x border-slate-200/70 w-28 cursor-pointer hover:bg-emerald-100/60 transition-colors"
                                                title="Ordenar pelo Total de Planos"
                                            >
                                                {criterioRanking === 'PLANOS' ? 'Total Planos' : 'Planos'}
                                            </th>
                                        )}

                                        {/* Colunas de Categorias Visíveis */}
                                        {colunasMatrizVisiveis.map(col => {
                                            const isOrdenada = colunaOrdemMatriz === col.key;
                                            return (
                                                <th 
                                                    key={col.key} 
                                                    onClick={() => handleOrdenarPorColunaMatriz(col.key)}
                                                    className={`py-3.5 px-2.5 text-[10px] font-black uppercase tracking-wider text-center w-28 cursor-pointer select-none transition-colors ${isOrdenada ? 'bg-blue-50/80 ring-1 ring-inset ring-blue-300' : 'hover:bg-slate-200/50'}`}
                                                    title={`Clique para ordenar por ${col.label}`}
                                                >
                                                    <div className="flex flex-col items-center justify-center leading-tight">
                                                        <span className="text-xs mb-0.5">{col.icone}</span>
                                                        <span className={`flex items-center gap-0.5 ${col.headerColor}`}>
                                                            {col.label}
                                                            <ArrowUpDown className={`w-2.5 h-2.5 ${isOrdenada ? 'opacity-100 text-blue-600' : 'opacity-30'}`} />
                                                        </span>
                                                    </div>
                                                </th>
                                            );
                                        })}

                                        {/* Coluna extra de Detalhamento de Itens quando em SÓ PRODUTOS ou SÓ SERVIÇOS */}
                                        {(criterioRanking === 'PRODUTOS' || criterioRanking === 'SERVICOS') && (
                                            <th className="py-3.5 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                Composição de Itens Vendidos (Clique para auditar)
                                            </th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {rankingUnidades.length === 0 ? (
                                        <tr>
                                            <td colSpan="12" className="py-12 text-center text-xs font-black text-slate-400 uppercase tracking-widest">
                                                Nenhuma venda registrada nesta categoria para o período selecionado.
                                            </td>
                                        </tr>
                                    ) : (
                                        rankingUnidades.map((uni, idx) => {
                                            const isTop1 = idx === 0;
                                            const isTop2 = idx === 1;
                                            const isTop3 = idx === 2;

                                            const posBadge = isTop1
                                                ? 'bg-amber-400 text-slate-900 shadow-sm'
                                                : isTop2
                                                ? 'bg-slate-300 text-slate-800'
                                                : isTop3
                                                ? 'bg-orange-200 text-orange-900'
                                                : 'bg-slate-100 text-slate-500';

                                            const valorEscopoUnidade = criterioRanking === 'PLANOS'
                                                ? uni.totalPlanos
                                                : criterioRanking === 'PRODUTOS'
                                                ? uni.totalProdutos
                                                : criterioRanking === 'SERVICOS'
                                                ? uni.totalServicos
                                                : uni.vendas;

                                            const pctRedeUnidade = totalEscopoAtivoRede > 0
                                                ? Math.round((valorEscopoUnidade / totalEscopoAtivoRede) * 100)
                                                : 0;

                                            const listaItensEspecificos = criterioRanking === 'PRODUTOS'
                                                ? uni.itensProdutosDetalhados
                                                : uni.itensServicosDetalhados;

                                            return (
                                                <tr key={uni.nome} className={`transition-colors hover:bg-blue-50/30 ${isTop1 ? 'bg-amber-50/15' : 'bg-white'}`}>
                                                    <td className="py-3.5 px-4 text-center">
                                                        <span className={`w-7 h-7 mx-auto rounded-lg flex items-center justify-center text-[11px] font-black ${posBadge}`}>
                                                            {idx + 1}º
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-4 font-black text-slate-800 uppercase tracking-tight text-xs sticky left-0 bg-white/95 backdrop-blur z-10 border-r border-slate-100">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="truncate">{uni.nome}</span>
                                                            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0" title="Participação no total da rede">
                                                                {pctRedeUnidade}%
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {/* Célula TOTAL GERAL */}
                                                    {criterioRanking === 'TOTAL' && (
                                                        <td className="py-3.5 px-3 text-center bg-slate-50/70">
                                                            <button
                                                                type="button"
                                                                onClick={() => abrirModalAuditoria(`Todas as Vendas — ${uni.nome}`, uni.nome, 'VENDA', uni.todosRegistrosUnidade, uni.vendas)}
                                                                className="inline-flex items-center justify-center min-w-[42px] px-2.5 py-1 rounded-lg text-xs font-black bg-slate-800 text-white hover:bg-blue-600 transition-colors shadow-sm"
                                                                title="Auditar todas as vendas da unidade"
                                                            >
                                                                {String(uni.vendas).padStart(2, '0')}
                                                            </button>
                                                        </td>
                                                    )}

                                                    {/* Célula TOTAL PLANOS */}
                                                    {(criterioRanking === 'TOTAL' || criterioRanking === 'PLANOS') && (
                                                        <td className="py-3.5 px-3 text-center bg-emerald-50/20 border-x border-slate-100">
                                                            <button
                                                                type="button"
                                                                onClick={() => abrirModalAuditoria(`Todos os Planos — ${uni.nome}`, uni.nome, 'VENDA', uni.registrosPlanosUnidade, uni.totalPlanos)}
                                                                className="inline-flex items-center justify-center min-w-[42px] px-2.5 py-1 rounded-lg text-xs font-black text-emerald-800 bg-emerald-100/80 hover:bg-emerald-200 border border-emerald-300 transition-colors shadow-sm"
                                                                title="Auditar apenas os planos vendidos nesta unidade"
                                                            >
                                                                {String(uni.totalPlanos).padStart(2, '0')}
                                                            </button>
                                                        </td>
                                                    )}

                                                    {/* CÉLULAS ALINHADAS POR CATEGORIA VISÍVEL */}
                                                    {colunasMatrizVisiveis.map(col => {
                                                        const valorCel = uni.colunas[col.key] || 0;
                                                        const regsCel = uni.registrosPorColuna[col.key] || [];
                                                        const isColOrdenada = colunaOrdemMatriz === col.key;

                                                        return (
                                                            <td key={col.key} className={`py-3.5 px-2.5 text-center ${isColOrdenada ? 'bg-blue-50/20' : ''}`}>
                                                                {valorCel > 0 ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => abrirModalAuditoria(`${col.label} — ${uni.nome}`, uni.nome, 'VENDA', regsCel, valorCel)}
                                                                        className={`inline-flex items-center justify-center min-w-[38px] px-2.5 py-1 rounded-lg text-[11px] font-black border transition-all shadow-sm cursor-pointer ${col.badgeBg}`}
                                                                        title={`Clique para auditar ${valorCel} registro(s) de ${col.label} em ${uni.nome}`}
                                                                    >
                                                                        {String(valorCel).padStart(2, '0')}
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-slate-300 font-bold text-xs select-none">—</span>
                                                                )}
                                                            </td>
                                                        );
                                                    })}

                                                    {/* Detalhamento de Itens quando em SÓ PRODUTOS ou SÓ SERVIÇOS */}
                                                    {(criterioRanking === 'PRODUTOS' || criterioRanking === 'SERVICOS') && (
                                                        <td className="py-3.5 px-4">
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {listaItensEspecificos.map(([nomeItem, itemData]) => (
                                                                    <button
                                                                        key={nomeItem}
                                                                        type="button"
                                                                        onClick={() => abrirModalAuditoria(`${nomeItem} — ${uni.nome}`, uni.nome, 'VENDA', itemData.vendasAuditaveis, itemData.total)}
                                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black border transition-all shadow-sm cursor-pointer ${
                                                                            criterioRanking === 'PRODUTOS'
                                                                                ? 'bg-white hover:bg-amber-50 text-slate-700 border-slate-200 hover:border-amber-300'
                                                                                : 'bg-white hover:bg-violet-50 text-slate-700 border-slate-200 hover:border-violet-300'
                                                                        }`}
                                                                        title={`Auditar ${nomeItem}`}
                                                                    >
                                                                        <span className={criterioRanking === 'PRODUTOS' ? 'text-amber-600' : 'text-violet-600'}>
                                                                            {String(itemData.total).padStart(2, '0')}x
                                                                        </span>
                                                                        <span className="uppercase truncate max-w-[180px]">{nomeItem}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>

                                {/* RODAPÉ TOTALIZADOR DA REDE */}
                                {rankingUnidades.length > 1 && (
                                    <tfoot>
                                        <tr className="bg-slate-900 text-white font-black border-t-2 border-slate-300">
                                            <td className="py-3.5 px-4 text-center text-[10px] uppercase tracking-widest text-amber-400">∑</td>
                                            <td className="py-3.5 px-4 text-[11px] uppercase tracking-widest sticky left-0 bg-slate-900 z-10">
                                                TOTAL DA REDE
                                            </td>
                                            {criterioRanking === 'TOTAL' && (
                                                <td className="py-3.5 px-3 text-center text-xs text-amber-400 bg-slate-800">
                                                    {String(vendasGlobal).padStart(2, '0')}
                                                </td>
                                            )}
                                            {(criterioRanking === 'TOTAL' || criterioRanking === 'PLANOS') && (
                                                <td className="py-3.5 px-3 text-center text-xs text-emerald-400 bg-slate-800/80 border-x border-slate-700">
                                                    {String(totaisRedeMatriz.totalPlanos).padStart(2, '0')}
                                                </td>
                                            )}
                                            {colunasMatrizVisiveis.map(col => (
                                                <td key={col.key} className="py-3.5 px-2.5 text-center text-xs text-slate-200">
                                                    {totaisRedeMatriz[col.key] > 0 ? String(totaisRedeMatriz[col.key]).padStart(2, '0') : '—'}
                                                </td>
                                            ))}
                                            {(criterioRanking === 'PRODUTOS' || criterioRanking === 'SERVICOS') && (
                                                <td className="py-3.5 px-4 text-[10px] text-slate-400 uppercase tracking-widest">
                                                    100% da Categoria na Rede
                                                </td>
                                            )}
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                )}

                {/* 🏢 CARDS SANFONA POR UNIDADE COM INTERAÇÃO DE MODAL */}
                {unidadesOrdenadas.length === 0 ? (
                    <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm flex flex-col items-center justify-center h-64 opacity-60 pointer-events-none">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <FileX2 className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-sm font-black text-slate-500 uppercase tracking-widest">{t('analytics.report.emptyData', { defaultValue: 'Nenhum dado neste período.' })}</p>
                    </div>
                ) : (
                    unidadesOrdenadas.map(unidade => {
                        const dados = relatorioPorUnidade[unidade];
                        const isRecolhido = unidadesRecolhidas[unidade];

                        const hasVisitantes = dados.visitantes.length > 0;
                        const hasAvaliacoes = dados.avaliacoes.length > 0;

                        // Filtra os grupos do card sanfona caso um filtro específico esteja ativo
                        const gruposUnidadeFiltrados = Object.entries(dados.grupos)
                            .sort((a, b) => ORDEM_CLASSICA.indexOf(a[0]) - ORDEM_CLASSICA.indexOf(b[0]))
                            .filter(([_, info]) => {
                                if (info.total <= 0) return false;
                                if (criterioRanking === 'PLANOS') return info.escopo === 'PLANOS';
                                if (criterioRanking === 'PRODUTOS') return info.escopo === 'PRODUTOS';
                                if (criterioRanking === 'SERVICOS') return info.escopo === 'SERVICOS';
                                return true;
                            });

                        return (
                            <div key={unidade} className="bg-white border border-slate-200 rounded-[24px] shadow-sm overflow-hidden transition-all duration-300">
                                
                                <div 
                                    className="bg-slate-900 px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-5 transition-colors cursor-pointer select-none group"
                                    onClick={() => toggleUnidade(unidade)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/10 shrink-0 group-hover:bg-blue-500/20 group-hover:border-blue-500/30 transition-colors">
                                            <Building2 className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <h4 className="text-lg md:text-xl font-black text-white uppercase tracking-tight line-clamp-1">
                                                {unidade}
                                            </h4>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                {t('analytics.report.perfOps', { defaultValue: 'Performance Operacional' })}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-3 no-drag">
                                        <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl flex items-center gap-2" title="Total de Vendas Registradas">
                                            <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">
                                                {String(dados.totalGeralVendas).padStart(2, '0')} {t('analytics.report.salesUnit', { defaultValue: 'Vendas' })}
                                            </span>
                                        </div>

                                        <button 
                                            onClick={(e) => { e.stopPropagation(); gerarTextoFechamento(unidade); }} 
                                            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                                        >
                                            <Share2 className="w-3.5 h-3.5" /> WhatsApp
                                        </button>

                                        <button 
                                            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-400 transition-colors shrink-0"
                                            title={isRecolhido ? t('analytics.report.btnExpand', { defaultValue: 'Expandir' }) : t('analytics.report.btnCollapse', { defaultValue: 'Recolher' })}
                                        >
                                            {isRecolhido ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                <div className={`transition-all duration-300 ${isRecolhido ? 'h-0 opacity-0 overflow-hidden' : 'p-6 md:p-8 bg-slate-50/50 border-t border-slate-200'}`}>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                        
                                        {/* VENDAS (CLICÁVEIS) */}
                                        {gruposUnidadeFiltrados.map(([grupo, info]) => (
                                            <div key={grupo} className="bg-white border border-slate-200 rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] flex flex-col overflow-hidden transition-all hover:shadow-md hover:border-slate-300">
                                                <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${info.bgIcone}`}>
                                                            {info.icone}
                                                        </span>
                                                        <span className={`text-xs font-black uppercase tracking-wider ${info.cor}`}>
                                                            {grupo}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md border border-slate-200">
                                                        {String(info.total).padStart(2, '0')} UN
                                                    </span>
                                                </div>

                                                <div className="flex-1 divide-y divide-slate-100 bg-slate-50/30 max-h-[160px] overflow-y-auto custom-scrollbar animate-[fadeIn_0.3s_ease-out] no-drag">
                                                    {Object.entries(info.itens).sort((a,b) => b[1].total - a[1].total).map(([nomeItem, itemData]) => {
                                                        if(itemData.total === 0) return null;
                                                        
                                                        const stringConsultores = Object.entries(itemData.vendedores)
                                                            .filter(([_, vQtd]) => vQtd > 0)
                                                            .sort((a,b) => b[1] - a[1])
                                                            .map(([vNome, vQtd]) => `${vNome} (${String(vQtd).padStart(2, '0')})`)
                                                            .join(', ');

                                                        return (
                                                            <div 
                                                                key={nomeItem} 
                                                                onClick={(e) => { e.stopPropagation(); abrirModalAuditoria(nomeItem, unidade, 'VENDA', itemData.vendasAuditaveis, itemData.total); }}
                                                                className="px-5 py-3.5 flex justify-between items-center bg-white hover:bg-blue-50/60 cursor-pointer transition-colors group"
                                                                title="Clique para detalhar auditoria"
                                                            >
                                                                <div className="flex flex-col pr-4">
                                                                    <span className="text-[11px] font-black text-slate-700 uppercase group-hover:text-blue-600 transition-colors line-clamp-1">
                                                                        {nomeItem}
                                                                    </span>
                                                                    {stringConsultores && (
                                                                        <span className="text-[9px] font-bold text-slate-400 mt-0.5 line-clamp-1 flex items-center gap-1" title={stringConsultores}>
                                                                            <Users className="w-2.5 h-2.5 inline-block opacity-70 shrink-0" />
                                                                            {stringConsultores}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="text-[11px] font-black text-slate-800 shrink-0 bg-slate-100 px-2 py-1 rounded-md border border-slate-200 shadow-sm group-hover:bg-blue-100 group-hover:border-blue-200 group-hover:text-blue-700 transition-colors">
                                                                    {String(itemData.total).padStart(2, '0')}x
                                                                </span>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        ))}

                                        {/* UX PREMIUM: VISITANTES (CLICÁVEL) */}
                                        <div 
                                            className={`bg-white border no-drag ${hasVisitantes ? 'border-slate-200 hover:border-blue-300 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-md cursor-pointer group' : 'border-slate-200 border-dashed opacity-80 pointer-events-none'} rounded-2xl flex flex-col overflow-hidden transition-all`}
                                            onClick={(e) => { if(hasVisitantes) { e.stopPropagation(); abrirModalAuditoria('Visitantes Capturados', unidade, 'VISITANTE', dados.visitantes, dados.visitantes.length); } }}
                                        >
                                            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white group-hover:bg-blue-50/50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${hasVisitantes ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                                        👥
                                                    </span>
                                                    <span className={`text-xs font-black uppercase tracking-wider ${hasVisitantes ? 'text-blue-600' : 'text-slate-400'}`}>
                                                        {t('analytics.report.cardVisitors', { defaultValue: 'VISITANTES' })}
                                                    </span>
                                                </div>
                                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-md border transition-colors ${hasVisitantes ? 'bg-blue-50 text-blue-600 border-blue-200 group-hover:bg-blue-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                                    {String(dados.visitantes.length).padStart(2, '0')} UN
                                                </span>
                                            </div>
                                            <div className="flex-1 bg-slate-50/30 p-5 flex flex-col items-center justify-center text-center min-h-[160px] group-hover:bg-blue-50/20 transition-colors">
                                                {hasVisitantes ? (
                                                    <>
                                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 group-hover:text-blue-600/70 transition-colors">{t('analytics.report.totalCaptured', { defaultValue: 'Total Capturado' })}</p>
                                                        <p className="text-4xl md:text-5xl font-black text-slate-800 group-hover:text-blue-700 transition-colors">{dados.visitantes.length}</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="text-4xl md:text-5xl font-black text-slate-300 mb-2">00</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('analytics.report.emptyVisitors', { defaultValue: 'Nenhuma visita' })}</p>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* UX PREMIUM: AVALIAÇÕES (CLICÁVEL) */}
                                        <div 
                                            className={`bg-white border no-drag ${hasAvaliacoes ? 'border-slate-200 hover:border-orange-300 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-md cursor-pointer group' : 'border-slate-200 border-dashed opacity-80 pointer-events-none'} rounded-2xl flex flex-col overflow-hidden transition-all`}
                                            onClick={(e) => { if(hasAvaliacoes) { e.stopPropagation(); abrirModalAuditoria('Avaliações Realizadas', unidade, 'AVALIACAO', dados.avaliacoes, dados.avaliacoes.length); } }}
                                        >
                                            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white group-hover:bg-orange-50/50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${hasAvaliacoes ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'}`}>
                                                        📋
                                                    </span>
                                                    <span className={`text-xs font-black uppercase tracking-wider ${hasAvaliacoes ? 'text-orange-600' : 'text-slate-400'}`}>
                                                        {t('analytics.report.cardAssessments', { defaultValue: 'AVALIAÇÕES' })}
                                                    </span>
                                                </div>
                                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-md border transition-colors ${hasAvaliacoes ? 'bg-orange-50 text-orange-600 border-orange-200 group-hover:bg-orange-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                                    {String(dados.avaliacoes.length).padStart(2, '0')} UN
                                                </span>
                                            </div>
                                            <div className="flex-1 bg-slate-50/30 p-5 flex flex-col items-center justify-center text-center min-h-[160px] group-hover:bg-orange-50/20 transition-colors">
                                                {hasAvaliacoes ? (
                                                    <>
                                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 group-hover:text-orange-600/70 transition-colors">{t('analytics.report.doneToday', { defaultValue: 'Realizadas' })}</p>
                                                        <p className="text-4xl md:text-5xl font-black text-slate-800 group-hover:text-orange-700 transition-colors">{dados.avaliacoes.length}</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="text-4xl md:text-5xl font-black text-slate-300 mb-2">00</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('analytics.report.emptyAssessments', { defaultValue: 'Nenhuma avaliação' })}</p>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default RelatorioTab;