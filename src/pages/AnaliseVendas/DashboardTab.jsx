import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ComposedChart, Area, ReferenceLine } from 'recharts';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { supabase } from '../../supabaseClient.js';
import {
    formatarCPF,
    formatDataBR,
    getCategoriaItem,
    normalizeString,
    safeIsoDate
} from './utils.js';
import { contarPlanosDoCard, faixaMesAnterior, useVendasDaFaixa, paraIso } from './comparativoMesAnterior.js';
import { agruparProdutos } from './familiasProdutos.js';
import { qtdValidaProduto } from './limiteDoses.js';
import { useDosesValidas } from './useDosesValidas.js';
import { useMovimentoDiario, somarMovimentoNoPeriodo } from './movimentoDiario.js';
import {
    TrendingUp, X, Users, Loader2, CheckCircle2, Layers, Calculator, Box, Briefcase,
    ChevronDown, ArrowRight, Pencil, MessageCircle, Search, Send, UserPlus, UserMinus, Wallet, HelpCircle
} from 'lucide-react';
import { avisar } from '../../components/avisar.js';
import { tx, localeAtual } from '../../i18n/traduzir.js';

// ==========================================
// DASHBOARD PRINCIPAL — visual aprovado pelo dono (30/10/2026)
// Ordem: Planos vendidos (card escuro) + Produtividade (rosca) · Ativos / Produtos / Serviços ·
// Ritmo do mês (planos acumulados × mesmas datas do mês anterior) · Painel Assinaturas | Produtos | Ranking.
// Regras que NÃO mudam: planos com a regra do card (repetido no mesmo dia para a mesma matrícula conta 1,
// contarPlanosDoCard). NUTRI É ADICIONAL (30/10/2026): decomporPlano separa plano base e adicional Nutri;
// total/produtividade usam só planos base (Fit inclui FIT + NUTRI). Todos os filtros do topo valem aqui.
// Números grandes: só o total do card "Planos vendidos" (exceção do dono); o resto segue o visual compacto.
// ==========================================

const FUSO = 'America/Sao_Paulo';

// Cores fixas por grupo de plano (iguais em toda a tela). "clara" = no card escuro e no modo escuro.
const GRUPOS = [
    { chave: 'NUTRI', rotulo: 'Nutri', cor: '#0E9F6E', clara: '#34D399' },
    { chave: 'PLUS', rotulo: 'Plus', cor: '#1D4FD8', clara: '#60A5FA' },
    { chave: 'FIT', rotulo: 'Fit', cor: '#7C3AED', clara: '#A78BFA' },
    { chave: 'PERSONAL CLASS', rotulo: 'Personal Class', cor: '#DB2777', clara: '#F9A8D4' },
    { chave: 'OUTROS PLANOS', rotulo: 'Outros planos', cor: '#64748B', clara: '#94A3B8' },
];
const ROTULO_CURTO = { NUTRI: 'Nutri', PLUS: 'Plus', FIT: 'Fit', 'PERSONAL CLASS': 'Personal', 'OUTROS PLANOS': 'Outros' };
const AZUL_DESTAQUE = '#1D4FD8';
const COR_MES_ANTERIOR = '#94A3B8';

// ---------- datas ----------
const paraData = (iso) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); };
const diasEntre = (a, b) => Math.round((paraData(b) - paraData(a)) / 86400000);
const somarDias = (iso, n) => { const d = paraData(iso); d.setDate(d.getDate() + n); return paraIso(d); };
const ddmm = (iso) => iso.split('-').reverse().slice(0, 2).join('/');
const diaDaVenda = (v) => safeIsoDate(v.data || v.created_at);
const dataHora = (v) => {
    const dia = formatDataBR(diaDaVenda(v));
    if (!v.created_at) return dia;
    const d = new Date(v.created_at);
    return isNaN(d) ? dia : `${dia} · ${d.toLocaleTimeString(localeAtual(), { hour: '2-digit', minute: '2-digit', timeZone: FUSO })}`;
};
const pct = (v) => `${Number(v || 0).toLocaleString(localeAtual(), { maximumFractionDigits: 1 })}%`;
const dois = (n) => String(n).padStart(2, '0');

// O tema escuro é a classe "dark" no <html> (App.jsx); gráficos usam cores próprias para cada tema
const useModoEscuro = () => {
    const [escuro, setEscuro] = useState(() => document.documentElement.classList.contains('dark'));
    useEffect(() => {
        const obs = new MutationObserver(() => setEscuro(document.documentElement.classList.contains('dark')));
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => obs.disconnect();
    }, []);
    return escuro;
};

// ==========================================
// 🧠 COMPONENTE: JANELA FLUTUANTE (DRAGGABLE & RESIZABLE)
// Padrão de UX Avançado: Pop-up móvel sem travar o fundo. No celular ocupa a tela (com margem).
// ==========================================
const DraggableWindow = ({ isOpen, onClose, title, subtitle, icon: Icon, iconColor = 'text-blue-500', minWidth = 350, minHeight = 400, children }) => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [celular, setCelular] = useState(false);
    const dragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

    // Centraliza a janela assim que ela for aberta
    useEffect(() => {
        if (isOpen) {
            const pequeno = window.innerWidth < 640;
            setCelular(pequeno);
            setPosition(pequeno ? { x: 8, y: 8 } : {
                x: Math.max(0, (window.innerWidth - minWidth) / 2),
                y: Math.max(0, (window.innerHeight - minHeight) / 2)
            });
        }
    }, [isOpen, minWidth, minHeight]);

    // Lógica do Motor de Arraste (Drag & Drop)
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDragging) return;
            setPosition({
                x: dragRef.current.initialX + (e.clientX - dragRef.current.startX),
                y: dragRef.current.initialY + (e.clientY - dragRef.current.startY)
            });
        };

        const handleMouseUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    if (!isOpen) return null;

    return (
        <div
            style={celular ? {
                left: '8px', top: '8px', width: 'calc(100vw - 16px)', maxHeight: 'calc(100vh - 16px)'
            } : {
                left: `${position.x}px`,
                top: `${position.y}px`,
                minWidth: `min(${minWidth}px, calc(100vw - 16px))`,
                minHeight: `min(${minHeight}px, calc(100vh - 16px))`,
                maxHeight: 'calc(100vh - 16px)'
            }}
            className="fixed z-[200] bg-white rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] flex flex-col border border-slate-300 resize overflow-hidden animate-[zoomIn_0.2s_ease-out] dark:bg-slate-900 dark:border-slate-700"
        >
            {/* CABEÇALHO (ÁREA DE ARRASTE) */}
            <div
                onMouseDown={(e) => {
                    if (celular) return;
                    setIsDragging(true);
                    dragRef.current = { startX: e.clientX, startY: e.clientY, initialX: position.x, initialY: position.y };
                }}
                className={`p-5 sm:p-6 bg-slate-900 text-white flex justify-between items-center gap-3 border-b border-slate-800 shrink-0 ${celular ? '' : 'cursor-move'}`}
            >
                <div className="pointer-events-none select-none min-w-0">
                    <h3 className="text-base sm:text-lg font-black uppercase tracking-tighter flex items-center gap-2">
                        {Icon && <Icon className={`w-5 h-5 shrink-0 ${iconColor}`} />} <span className="truncate">{title}</span>
                    </h3>
                    {subtitle && <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1 truncate">{subtitle}</p>}
                </div>
                <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={onClose}
                    aria-label={tx("Fechar")}
                    className="hover:rotate-90 transition-transform bg-white/10 p-2 rounded-full hover:bg-white/20 shrink-0"
                >
                    <X className="w-5 h-5 text-white" />
                </button>
            </div>

            {/* CORPO DA JANELA (SCROLLÁVEL) */}
            <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto custom-scrollbar relative dark:bg-slate-800/60">
                {children}
            </div>
        </div>
    );
};

// ---------- pedaços visuais ----------
const Rotulo = ({ children, className = '' }) => (
    <p className={`text-[12px] font-bold uppercase tracking-[0.07em] text-[#3B4458] dark:text-slate-300 ${className}`}>{children}</p>
);

// Selo de variação: ▲ positivo · ▼ negativo · = estável
const SeloVariacao = ({ atual, antes }) => {
    const dif = atual - antes;
    let texto, estilo;
    if (dif === 0) {
        texto = `= ${tx('estável')}`;
        estilo = 'bg-[#EEF1F6] text-[#3B4458] dark:bg-slate-800 dark:text-slate-300';
    } else if (dif > 0) {
        texto = `▲ ${dif} · ${antes > 0 ? `+${Math.round((dif / antes) * 100)}%` : tx('novo')}`;
        estilo = 'bg-[#E7F7EF] text-[#0B7A52] dark:bg-emerald-500/15 dark:text-emerald-300';
    } else {
        texto = `▼ ${Math.abs(dif)} · −${Math.abs(Math.round((dif / antes) * 100))}%`;
        estilo = 'bg-[#FDECEA] text-[#B42318] dark:bg-rose-500/15 dark:text-rose-300';
    }
    return <span className={`inline-flex items-center h-7 px-2.5 rounded-full text-[12px] font-bold tabular-nums whitespace-nowrap ${estilo}`}>{texto}</span>;
};

// "?" com explicação (mesmo modelo das outras telas)
const DicaCard = ({ texto }) => (
    <span className="group/dica relative inline-flex align-middle normal-case tracking-normal">
        <button type="button" aria-label={texto} className="text-slate-400 hover:text-blue-600 focus:text-blue-600 outline-none dark:hover:text-blue-400"><HelpCircle className="w-3.5 h-3.5" /></button>
        <span role="tooltip" className="pointer-events-none absolute top-full mt-2 left-0 z-40 w-[min(260px,70vw)] hidden group-hover/dica:block group-focus-within/dica:block bg-slate-800 text-white text-[11px] font-semibold text-left leading-snug px-3 py-2 rounded-lg shadow-lg dark:bg-slate-700">{texto}</span>
    </span>
);

const CardMenor = ({ rotulo, valor, icone: Icone, fundoIcone, corIcone, iconeBotao: IconeBotao, rotuloBotao, onClick, carregando, sub, dica }) => (
    <div className="bg-white border border-[#E4E8F0] rounded-[18px] p-5 flex items-center gap-4 min-w-0 dark:bg-slate-900 dark:border-slate-800">
        <span className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${fundoIcone}`}><Icone className={`w-6 h-6 ${corIcone}`} strokeWidth={1.75} /></span>
        <div className="flex-1 min-w-0">
            <Rotulo className="flex items-center gap-1.5"><span className="truncate">{rotulo}</span>{dica && <DicaCard texto={dica} />}</Rotulo>
            <p className="text-lg font-extrabold text-[#0F172A] tabular-nums mt-0.5 dark:text-white">
                {carregando ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : valor}
            </p>
            {sub && <p className="text-[12px] font-semibold text-[#5B6478] truncate dark:text-slate-400">{sub}</p>}
        </div>
        {IconeBotao && (
            <button type="button" onClick={onClick} aria-label={rotuloBotao} title={rotuloBotao}
                className="w-11 h-11 rounded-xl border border-[#D6DCE8] text-[#0F172A] flex items-center justify-center shrink-0 hover:bg-[#F3F5FA] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800">
                <IconeBotao className="w-4 h-4" />
            </button>
        )}
    </div>
);

const iniciais = (nome) => {
    const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return '?';
    return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
};

// ==========================================
// MODAL "PLANOS VENDIDOS" (lista do card; pode vir filtrada por um grupo e/ou por um plano)
// lista = planos BASE (o número do card); listaNutri = adicionais Nutri (usada quando grupo = 'NUTRI')
// ==========================================
const ModalPlanos = ({ aberto, onFechar, lista, listaNutri = [], grupo, plano, textoPeriodo }) => {
    const [busca, setBusca] = useState('');
    const campoRef = useRef(null);
    useEffect(() => {
        if (!aberto) return undefined;
        setBusca('');
        const tecla = (e) => { if (e.key === 'Escape') onFechar(); };
        window.addEventListener('keydown', tecla);
        setTimeout(() => campoRef.current?.focus(), 50);
        return () => window.removeEventListener('keydown', tecla);
    }, [aberto, onFechar]);

    const doGrupo = useMemo(() => {
        let base = grupo === 'NUTRI' ? listaNutri : (grupo ? lista.filter(p => p.base === grupo) : lista);
        if (plano) base = base.filter(p => (p.venda.produto || '').toUpperCase() === plano);
        return base;
    }, [lista, listaNutri, grupo, plano]);
    const termo = normalizeString(busca);
    const digitos = busca.replace(/\D/g, '');
    const visiveis = useMemo(() => (!termo ? doGrupo : doGrupo.filter(({ venda }) => {
        const nome = normalizeString(String(venda.nome_aluno || venda.nome || ''));
        const cpf = String(venda.cpf || '').replace(/\D/g, '');
        return nome.includes(termo) || (digitos.length >= 3 && cpf.includes(digitos));
    })), [doGrupo, termo, digitos]);
    const total = doGrupo.reduce((s, p) => s + p.qtd, 0);
    const mostrando = visiveis.reduce((s, p) => s + p.qtd, 0);
    const nomeGrupo = plano || (grupo ? tx(GRUPOS.find(g => g.chave === grupo)?.rotulo || grupo) : null);

    if (!aberto) return null;
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4" style={{ background: 'rgba(11,31,75,0.45)' }} onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
            <div role="dialog" aria-modal="true" aria-label={tx('Planos vendidos')} className="bg-white rounded-[20px] shadow-2xl w-[min(900px,100%)] max-h-[calc(100vh-16px)] flex flex-col overflow-hidden animate-[zoomIn_0.2s_ease-out] dark:bg-slate-900">
                <div className="px-5 py-4 border-b border-[#EEF1F6] flex items-start justify-between gap-3 dark:border-slate-800">
                    <div className="min-w-0">
                        <h3 className="text-[18px] font-extrabold text-[#0F172A] dark:text-white">{tx('Planos vendidos')}{nomeGrupo ? ` · ${nomeGrupo}` : ''}</h3>
                        <p className="text-[12px] font-medium text-[#5B6478] mt-0.5 dark:text-slate-400">
                            {textoPeriodo ? `${textoPeriodo} · ` : ''}{tx('mais recente primeiro')}{plano ? ` · ${tx('só o plano {plano}', { plano })}` : nomeGrupo ? ` · ${tx('só o grupo {grupo}', { grupo: nomeGrupo })}` : ''}{grupo === 'NUTRI' && !plano ? ` · ${tx('adicionais Nutri')}` : ''}
                        </p>
                    </div>
                    <button type="button" onClick={onFechar} aria-label={tx('Fechar')} className="w-11 h-11 rounded-xl border border-[#D6DCE8] flex items-center justify-center shrink-0 text-[#0F172A] hover:bg-[#F3F5FA] dark:border-slate-700 dark:text-white dark:hover:bg-slate-800">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="px-5 py-3 border-b border-[#EEF1F6] dark:border-slate-800">
                    <label className="block">
                        <span className="text-[12px] font-bold text-[#3B4458] dark:text-slate-300">{tx('Buscar aluno ou CPF')}</span>
                        <span className="mt-1 h-11 px-3 border border-[#D6DCE8] rounded-xl flex items-center gap-2 focus-within:ring-2 focus-within:ring-blue-500 dark:border-slate-700">
                            <Search className="w-4 h-4 text-[#5B6478] shrink-0" />
                            <input ref={campoRef} value={busca} onChange={(e) => setBusca(e.target.value)} className="flex-1 min-w-0 bg-transparent outline-none text-[14px] font-medium text-[#0F172A] dark:text-white" />
                            {busca && <button type="button" onClick={() => setBusca('')} aria-label={tx('Limpar busca')} className="p-1 rounded-md text-[#5B6478] hover:bg-[#F3F5FA] dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>}
                        </span>
                    </label>
                </div>
                <div className="flex-1 overflow-auto custom-scrollbar">
                    {visiveis.length === 0 ? (
                        <p className="text-center text-[13px] font-semibold text-[#5B6478] py-12 dark:text-slate-400">{doGrupo.length === 0 ? tx('Nenhum plano registrado neste filtro.') : tx('Nenhum aluno encontrado nesta busca.')}</p>
                    ) : (
                        <table className="w-full min-w-[640px] text-left border-collapse">
                            <thead className="sticky top-0 bg-white dark:bg-slate-900">
                                <tr>
                                    {['Aluno', 'CPF', 'Plano', 'Data e hora'].map(c => (
                                        <th key={c} className="px-5 py-3 border-b border-[#EEF1F6] text-[11px] font-bold uppercase tracking-[0.07em] text-[#5B6478] dark:border-slate-800 dark:text-slate-400">{tx(c)}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {visiveis.map(({ venda, qtd }, i) => (
                                    <tr key={venda.id || i} className="border-b border-[#F1F3F8] last:border-0 dark:border-slate-800">
                                        <td className="px-5 py-3 text-[14px] font-bold text-[#0F172A] dark:text-white">{venda.nome_aluno || venda.nome || '—'}</td>
                                        <td className="px-5 py-3 text-[13px] font-medium text-[#3B4458] tabular-nums whitespace-nowrap dark:text-slate-300">{venda.cpf ? formatarCPF(venda.cpf) : '—'}</td>
                                        <td className="px-5 py-3">
                                            <span className="inline-flex items-center h-7 px-2.5 rounded-full bg-[#E8EEFF] text-[#1D4FD8] text-[12px] font-bold whitespace-nowrap dark:bg-blue-500/15 dark:text-blue-300">{venda.produto}{qtd > 1 ? ` ×${qtd}` : ''}</span>
                                        </td>
                                        <td className="px-5 py-3 text-[13px] font-medium text-[#3B4458] tabular-nums whitespace-nowrap dark:text-slate-300">{dataHora(venda)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="px-5 py-3 bg-[#F8FAFD] border-t border-[#EEF1F6] flex flex-wrap items-center justify-between gap-2 text-[13px] dark:bg-slate-800/60 dark:border-slate-800">
                    <span className="font-medium text-[#3B4458] dark:text-slate-300">{tx('Mostrando {x} de {y}', { x: mostrando, y: total })}</span>
                    <span className="font-extrabold text-[#0F172A] dark:text-white">{tx('Total da lista')}: <span className="tabular-nums">{total}</span></span>
                </div>
            </div>
        </div>
    );
};

const DashboardTab = ({
    vendasFiltradas, colaboradores, unidadeAtual,
    filtroMes, filtroAno,
    metaProdutos, metaNutri, metaPersonal, planos, produtos, abrirModalWhatsapp,
    vendasTodas = [], faixa = null,
    vendedoresOcultos = [], planosOcultos = [], produtosOcultos = [], servicosOcultos = []
}) => {
    const { t, locale } = useI18n();
    const escuro = useModoEscuro();
    const [modalProdOpen, setModalProdOpen] = useState(false);
    const [modalServicosOpen, setModalServicosOpen] = useState(false);
    // Lista de planos aberta: null = fechada; { grupo: '' } = todos os planos base; { grupo, plano } = filtrada
    const [listaPlanosGrupo, setListaPlanosGrupo] = useState(null);
    const fecharListaPlanos = useCallback(() => setListaPlanosGrupo(null), []);
    // Painel embaixo (um de cada vez) e linhas abertas
    const [painel, setPainel] = useState('assinaturas');
    const [grupoAberto, setGrupoAberto] = useState(null);
    const [produtoAberto, setProdutoAberto] = useState(null);
    const [grupoRitmo, setGrupoRitmo] = useState('TODOS');
    // Ritmo: 'dia' = quantos planos em cada dia (montanha); 'acumulado' = a linha que só cresce (modo antigo)
    const [modoRitmo, setModoRitmo] = useState('dia');
    const painelRef = useRef(null);

    // ==========================================
    // 🔥 ESTADOS FLUXO ATIVOS DA UNIDADE
    // ==========================================
    const [modalAtivosOpen, setModalAtivosOpen] = useState(false);
    const [ativosAtualBanco, setAtivosAtualBanco] = useState(null);
    const [ativosInput, setAtivosInput] = useState('');
    const [isCarregandoAtivos, setIsCarregandoAtivos] = useState(false);
    const [isSalvandoAtivos, setIsSalvandoAtivos] = useState(false);
    const [sucessoAtivos, setSucessoAtivos] = useState(false);
    const [erroAtivos, setErroAtivos] = useState(null);

    // BUSCA OS ATIVOS DO BANCO
    useEffect(() => {
        const buscarAtivos = async () => {
            if (!unidadeAtual || unidadeAtual === 'TODOS' || !filtroMes || !filtroAno) {
                setAtivosAtualBanco(null);
                return;
            }

            setIsCarregandoAtivos(true);
            try {
                const { data, error } = await supabase
                    .from('metas_unidades')
                    .select('ativos_atual')
                    .eq('unidade', String(unidadeAtual).toUpperCase())
                    .eq('mes', String(filtroMes))
                    .eq('ano', String(filtroAno))
                    .maybeSingle();

                if (error) throw error;

                if (data && data.ativos_atual !== null) setAtivosAtualBanco(Number(data.ativos_atual));
                else setAtivosAtualBanco(0);
            } catch (err) {
                console.error("Erro ao carregar ativos:", err);
                setAtivosAtualBanco(null);
            } finally {
                setIsCarregandoAtivos(false);
            }
        };

        buscarAtivos();
    }, [unidadeAtual, filtroMes, filtroAno]);

    // ABERTURA DO PAINEL FLUTUANTE
    const handleAbrirModalAtivos = () => {
        if (unidadeAtual === 'TODOS') {
            avisar(tx("Selecione uma unidade específica no filtro acima para editar os ativos."));
            return;
        }
        setAtivosInput(ativosAtualBanco !== null ? String(ativosAtualBanco) : '0');
        setErroAtivos(null);
        setSucessoAtivos(false);
        setModalAtivosOpen(true);
    };

    // SALVAMENTO SEGURO
    const handleSalvarAtivos = async () => {
        if (!unidadeAtual || unidadeAtual === 'TODOS') return;

        const valorFinal = Number(ativosInput);
        if (ativosInput === '' || isNaN(valorFinal) || valorFinal < 0) {
            setErroAtivos("Digite um número válido.");
            return;
        }

        setIsSalvandoAtivos(true);
        setErroAtivos(null);

        try {
            const payload = {
                unidade: String(unidadeAtual).toUpperCase(),
                mes: String(filtroMes),
                ano: String(filtroAno),
                ativos_atual: valorFinal
            };

            const { error } = await supabase
                .from('metas_unidades')
                .upsert(payload, { onConflict: 'unidade,mes,ano' });

            if (error) throw error;

            setAtivosAtualBanco(valorFinal);
            setSucessoAtivos(true);

            setTimeout(() => {
                setSucessoAtivos(false);
                setModalAtivosOpen(false);
            }, 1500);

        } catch (err) {
            console.error("Erro ao atualizar ativos:", err);
            setErroAtivos("Falha ao salvar. Tente novamente.");
        } finally {
            setIsSalvandoAtivos(false);
        }
    };

    const hasChangesAtivos = ativosInput !== '' && Number(ativosInput) !== ativosAtualBanco;

    // ==========================================
    // CÁLCULOS DO DASHBOARD E TRATATIVA DE METAS
    // ==========================================
    const rankingConsultoresFisicos = {};
    const equipeLocal = (colaboradores || []).filter(c =>
        unidadeAtual === 'TODOS' ? true : c.unidade?.toUpperCase() === unidadeAtual?.toUpperCase()
    );

    // 🔥 NOVO CRIVO BLINDADO: Inicia com 0 APENAS quem deve ser cobrado (Savers/Recepção Ativos)
    equipeLocal.forEach(colab => {
        // 1. Identifica o setor/cargo usando TODAS as chaves possíveis (incluindo o 'role' do ModalColaborador)
        const cargo = String(colab.cargo || colab.setor || colab.role || '').toUpperCase();
        const isAlvoCobranca = cargo.includes('SAVER') || cargo.includes('RECEPÇÃO') || cargo.includes('RECEPCAO');

        // 2. Varredura Profunda (Deep Scan) para achar inativos independente do nome da chave no banco
        const stringDoColaborador = JSON.stringify(colab).toUpperCase();
        const isDesligado =
            colab.ativo === false ||
            colab.is_active === false ||
            stringDoColaborador.includes('DESLIGADO') ||
            stringDoColaborador.includes('INATIVO');

        // Se for alvo de cobrança E estiver ativo (não desligado), entra zerado no ranking de cobrança
        if (isAlvoCobranca && !isDesligado) {
            rankingConsultoresFisicos[colab.nome.toUpperCase()] = 0;
        }
    });

    let totalVendasProdutos = 0;
    // Produtos que contam para meta/ranking (doses únicas até o limite da unidade + outros produtos)
    let totalProdutosValidos = 0;
    let totalServicos = 0;
    const rankingProdutosFisicos = {};
    const rankingServicos = {};

    // Movimento do dia (aba Metas): cancelamentos e faturamento digitados, somados no período
    const movimento = useMovimentoDiario({ unidade: unidadeAtual, faixa });
    const totaisMovimento = somarMovimentoNoPeriodo(movimento.derivados, faixa);

    // Doses únicas: até 10 por unidade/mês contam para meta e ranking (com TODAS as vendas da unidade, sem filtro)
    const dosesValidas = useDosesValidas({ vendasCarregadas: vendasTodas, vendasDaTela: vendasFiltradas, unidade: unidadeAtual, planos, produtos });

    // Planos: regra do card (repetido no mesmo dia não conta), a mesma da lista, do ritmo e do comparativo
    const contagemPlanos = contarPlanosDoCard(vendasFiltradas, planos, produtos);
    const gruposPlanos = contagemPlanos.grupos;
    const totalPlanos = contagemPlanos.total;

    vendasFiltradas.forEach(v => {
        const qtd = parseInt(v.quantidade) || 1;
        const prodUpper = (v.produto || '').toUpperCase();
        const vendUpper = (v.vendedor || '').toUpperCase();
        const categoriaFinal = getCategoriaItem(prodUpper, planos, produtos);

        if (categoriaFinal === 'PRODUTO') {
            // Total REAL: card "Produtos físicos" e lista "Produtos / Complementos" (sem limite)
            totalVendasProdutos += qtd;
            rankingProdutosFisicos[prodUpper] = (rankingProdutosFisicos[prodUpper] || 0) + qtd;

            // Meta e ranking: limite de doses únicas por unidade (limiteDoses.js)
            const qtdValida = qtdValidaProduto(v, dosesValidas);
            totalProdutosValidos += qtdValida;

            // Se quem vendeu não estava no ranking (ex: Líder, Bem-estar), ele é inserido aqui dinamicamente
            if (rankingConsultoresFisicos[vendUpper] !== undefined) {
                rankingConsultoresFisicos[vendUpper] += qtdValida;
            } else {
                rankingConsultoresFisicos[vendUpper] = qtdValida;
            }
        } else if (categoriaFinal === 'SERVICO') {
            totalServicos += qtd;
            rankingServicos[prodUpper] = (rankingServicos[prodUpper] || 0) + qtd;
        }
    });

    const topProdutosLista = Object.entries(rankingProdutosFisicos).sort((a, b) => b[1] - a[1]);
    const produtosAgrupados = agruparProdutos(topProdutosLista);
    const maiorProduto = produtosAgrupados.length > 0 ? produtosAgrupados[0].total : 0;
    const servicosLista = Object.entries(rankingServicos).sort((a, b) => b[1] - a[1]);
    const rankingOrdenado = Object.entries(rankingConsultoresFisicos).sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
    });

    // Listas: mais recente primeiro. Planos BASE (soma = número do card) e adicionais Nutri (soma = linha Nutri).
    const maisRecentePrimeiro = (a, b) => {
        const da = diaDaVenda(a.venda), db = diaDaVenda(b.venda);
        if (da !== db) return db.localeCompare(da);
        return String(b.venda.created_at || '').localeCompare(String(a.venda.created_at || ''));
    };
    const listaPlanos = [...contagemPlanos.contados].sort(maisRecentePrimeiro);
    const listaNutri = [...contagemPlanos.nutri.contados].sort(maisRecentePrimeiro);
    const totalNutri = contagemPlanos.nutri.total;
    // Planos descontinuados no catálogo (ativo = false) ganham etiqueta nas listas
    const descontinuados = new Set((planos || []).filter(p => p.ativo === false).map(p => String(p.nome || '').toUpperCase()));

    // ---------- comparativo com as mesmas datas no mês anterior ----------
    const faixaAnterior = useMemo(() => faixaMesAnterior(faixa), [faixa]);
    const { vendas: vendasAnteriorBrutas, carregando: carregandoAnterior, erro: erroAnterior } = useVendasDaFaixa(faixaAnterior, vendasTodas, unidadeAtual);
    const contagemAnterior = useMemo(() => {
        const lista = vendasAnteriorBrutas.filter(v => {
            if (unidadeAtual && unidadeAtual !== 'TODOS' && v.unidade !== unidadeAtual) return false;
            const prod = (v.produto || '').toUpperCase();
            if (vendedoresOcultos.includes((v.vendedor || '').toUpperCase())) return false;
            return !(planosOcultos.includes(prod) || produtosOcultos.includes(prod) || servicosOcultos.includes(prod));
        });
        return contarPlanosDoCard(lista, planos, produtos);
    }, [vendasAnteriorBrutas, unidadeAtual, vendedoresOcultos, planosOcultos, produtosOcultos, servicosOcultos, planos, produtos]);
    const gruposAnteriores = contagemAnterior.grupos;
    const temComparativo = !!faixaAnterior && !carregandoAnterior && !erroAnterior;
    const hojeIso = paraIso(new Date());
    const fimEfetivo = faixa ? (faixa.fim > hojeIso ? hojeIso : faixa.fim) : null;
    const textoPeriodo = faixa && faixa.inicio <= hojeIso ? `${ddmm(faixa.inicio)} ${tx('a')} ${ddmm(fimEfetivo)}` : '';
    const textoFaixaAnterior = faixaAnterior ? `${ddmm(faixaAnterior.inicio)} ${tx('a')} ${ddmm(faixaAnterior.fim)}` : '';
    const nomeMesAnterior = faixaAnterior ? paraData(faixaAnterior.inicio).toLocaleDateString(localeAtual(), { month: 'long' }) : '';
    const nomeMesAtual = faixa ? paraData(faixa.inicio).toLocaleDateString(localeAtual(), { month: 'long' }) : '';

    // Produtividade = 100% − (Fit ÷ total de entradas). Entradas = planos BASE (sem Nutri);
    // Fit = todo plano com base FIT, inclusive FIT + NUTRI (decisão do dono, 30/10/2026).
    const totalFit = gruposPlanos["FIT"]?.total || 0;
    const percentualFit = totalPlanos > 0 ? (totalFit / totalPlanos) * 100 : 0;
    const produtividadeUpsell = totalPlanos > 0 ? Math.max(100 - percentualFit, 0) : 0;

    // Memória de cálculo: só planos base (o grupo NUTRI repetiria os combos)
    const todosPlanosDetalhados = [];
    Object.entries(gruposPlanos).filter(([chave]) => chave !== 'NUTRI').forEach(([, grupo]) => {
        Object.entries(grupo.detalhes).forEach(([nome, qtd]) => {
            if (qtd > 0) todosPlanosDetalhados.push({ nome, qtd });
        });
    });
    todosPlanosDetalhados.sort((a, b) => b.qtd - a.qtd);

    // ---------- Ritmo do mês: planos acumulados dia a dia (atual × mesmas datas do mês anterior) ----------
    const ritmo = useMemo(() => {
        if (!faixa?.inicio || !faixa?.fim || faixa.inicio > hojeIso) return null;
        const n = diasEntre(faixa.inicio, faixa.fim) + 1;
        if (n < 2) return null;
        const ultimoAtual = diasEntre(faixa.inicio, faixa.fim > hojeIso ? hojeIso : faixa.fim);
        // Todos = planos base · Plus/Fit/Personal/Outros = base daquele grupo · Nutri = adicionais Nutri
        const fonte = (contagem) => (grupoRitmo === 'NUTRI' ? contagem.nutri.contados : contagem.contados);
        const doGrupo = (item) => grupoRitmo === 'TODOS' || grupoRitmo === 'NUTRI' || item.base === grupoRitmo;
        const contarPorDia = (contados, inicio, tamanho) => {
            const porDia = new Array(tamanho).fill(0);
            contados.forEach((item) => {
                const { venda, qtd } = item;
                if (!doGrupo(item)) return;
                const i = diasEntre(inicio, diaDaVenda(venda));
                if (i >= 0 && i < tamanho) porDia[i] += qtd;
            });
            return porDia;
        };
        const acumular = (porDia) => { let soma = 0; return porDia.map(q => (soma += q)); };
        const diaAtual = contarPorDia(fonte(contagemPlanos), faixa.inicio, ultimoAtual + 1);
        const nAnt = temComparativo ? diasEntre(faixaAnterior.inicio, faixaAnterior.fim) + 1 : 0;
        const diaAnterior = temComparativo ? contarPorDia(fonte(contagemAnterior), faixaAnterior.inicio, nAnt) : [];
        const atual = acumular(diaAtual);
        const anterior = acumular(diaAnterior);
        const linhas = Array.from({ length: n }, (_, i) => ({
            i,
            dia: somarDias(faixa.inicio, i),
            atual: i < atual.length ? atual[i] : null,
            anterior: i < anterior.length ? anterior[i] : null,
            atualDia: i < diaAtual.length ? diaAtual[i] : null,
            anteriorDia: i < diaAnterior.length ? diaAnterior[i] : null,
        }));
        // Destaques do modo "Por dia": melhor e pior dia (até hoje) e média por dia
        let melhor = null, pior = null;
        diaAtual.forEach((q, i) => {
            if (!melhor || q > melhor.qtd) melhor = { i, qtd: q };
            if (!pior || q < pior.qtd) pior = { i, qtd: q };
        });
        const media = diaAtual.length ? diaAtual.reduce((a, b) => a + b, 0) / diaAtual.length : 0;
        const ticks = n <= 12 ? linhas.map(l => l.i)
            : linhas.filter(l => ['01', '10', '20'].includes(l.dia.slice(8)) || l.i === n - 1).map(l => l.i);
        return {
            linhas, ticks,
            ultimoAtual: atual.length - 1, ultimoAnterior: anterior.length - 1,
            totalAtual: atual[atual.length - 1] || 0, totalAnterior: anterior.length ? anterior[anterior.length - 1] : 0,
            melhor: melhor && { ...melhor, dia: somarDias(faixa.inicio, melhor.i) },
            pior: pior && { ...pior, dia: somarDias(faixa.inicio, pior.i) },
            media,
        };
    }, [faixa, faixaAnterior, hojeIso, grupoRitmo, contagemPlanos, contagemAnterior, temComparativo]);

    const dispararModalMetas = () => {
        const mesAtual = new Date().toLocaleString(locale || 'pt-BR', { month: 'long' }).toUpperCase();

        const nutriRealizado = gruposPlanos["NUTRI"]?.total || 0;
        const personalRealizado = gruposPlanos["PERSONAL CLASS"]?.total || 0;
        const produtosRealizado = totalProdutosValidos || 0; // meta de produtos: com o limite de doses únicas

        const mNutri = metaNutri || 0;
        const mProd = metaProdutos || 0;
        const mPers = metaPersonal || 0;

        const faltaNutri = Math.max(mNutri - nutriRealizado, 0);
        const faltaProd = Math.max(mProd - produtosRealizado, 0);
        const faltaPers = Math.max(mPers - personalRealizado, 0);

        const batidaNutri = nutriRealizado >= mNutri && mNutri > 0;
        const batidaProd = produtosRealizado >= mProd && mProd > 0;
        const batidaPers = personalRealizado >= mPers && mPers > 0;

        const iconNutri = batidaNutri ? '🟢' : '🔴';
        const iconProd = batidaProd ? '🟢' : '🔴';
        const iconPers = batidaPers ? '🟢' : '🔴';

        let txt = `✅ Meta Start - ${mesAtual} ✅\n\n`;
        const faltam = [];

        txt += `👉 Nutri: ${nutriRealizado} / ${mNutri} ${iconNutri}\n`;
        if (!batidaNutri && mNutri > 0) faltam.push(`❌ Falta ${faltaNutri} Nutri - para liberar gratificação`);

        txt += `👉 Produto: ${produtosRealizado} / ${mProd} ${iconProd}\n`;
        if (!batidaProd && mProd > 0) faltam.push(`❌ Falta ${faltaProd} Produto - para liberar gratificação`);

        if (mPers > 0) {
            txt += `👉 Personal Class: ${personalRealizado} / ${mPers} ${iconPers}\n`;
            if (!batidaPers) faltam.push(`❌ Falta ${faltaPers} Class - para liberar gratificação`);
        }

        txt += `\n`;
        if (faltam.length > 0) {
            txt += faltam.join('\n');
        } else {
            txt += `🎉 PARABÉNS! Vocês bateram todas as metas Start! Gratificação da recepção liberada! 🚀`;
        }

        abrirModalWhatsapp(txt, { titulo: `Status das Metas`, icone: 'target', cor: 'blue' });
    };

    const dispararModalCompartilhar = () => {
        let txt = `${t('analytics.dashboard.wppRankingTitle', { defaultValue: '*🏆 Ranking de Vendas de Produtos 🏆*' })}\n`;
        txt += `${t('analytics.dashboard.wppTotalSales', { defaultValue: '*Total de Vendas:*' })} ${String(totalProdutosValidos).padStart(2, '0')} / ${String(metaProdutos || 0).padStart(2, '0')}\n\n`;

        const vendidos = rankingOrdenado.filter(item => item[1] > 0);
        const zerados = rankingOrdenado.filter(item => item[1] === 0);
        let posicaoAtual = 1;

        vendidos.forEach((item) => {
            const nome = item[0].split(' ')[0];
            const qtd = item[1];
            let emoji = "🟢❌❌";
            if (qtd === 2) emoji = "🟢🟢❌";
            else if (qtd >= 3) emoji = "✅✅✅";
            txt += `${posicaoAtual} ${emoji} ${nome} ${String(qtd).padStart(2, '0')}\n`;
            posicaoAtual++;
        });

        if (zerados.length > 0) {
            txt += `\n➖➖➖➖➖➖➖➖➖➖\n`;
            txt += `${t('analytics.dashboard.wppAlertPush', { defaultValue: '*🚨 BORA ACELERAR, GALERA! 🚀*' })}\n`;
            txt += `${t('analytics.dashboard.wppAlertSub', { defaultValue: '_Todos abaixo ainda não pontuaram hoje._' })}\n`;
            txt += `${t('analytics.dashboard.wppAlertHelp', { defaultValue: '*SOCORRO, DEUS!!! 🙏*' })}\n\n`;
            zerados.forEach((item) => {
                const nome = item[0].split(' ')[0];
                txt += `${posicaoAtual} ❌❌❌ ${nome}\n`;
                posicaoAtual++;
            });
        }

        abrirModalWhatsapp(txt, { titulo: t('analytics.dashboard.wppModalTitle', { defaultValue: 'Ranking para Grupo' }), icone: 'send', cor: 'emerald' });
    };

    const abrirPainelProdutos = () => {
        setPainel('produtos');
        setTimeout(() => painelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    };

    // ---------- valores por grupo (cores, rosca, tabela) ----------
    const corDoGrupo = (g) => (escuro ? g.clara : g.cor);
    const linhasGrupos = GRUPOS.map(g => ({
        ...g,
        total: gruposPlanos[g.chave]?.total || 0,
        anterior: gruposAnteriores[g.chave]?.total || 0,
    }));
    // NUTRI (adicional) vem primeiro na tabela; os outros são planos base
    const gruposTabela = linhasGrupos.filter(g => g.total > 0 || (temComparativo && g.anterior > 0));
    const gruposBase = linhasGrupos.filter(g => g.chave !== 'NUTRI');
    const linhaNutri = linhasGrupos.find(g => g.chave === 'NUTRI');
    const totalAnteriorPlanos = contagemAnterior.total;
    // Adesão ao Nutri: adicionais ÷ planos base
    const adesaoNutri = totalPlanos > 0 ? (totalNutri / totalPlanos) * 100 : 0;

    // Rosca: Plus, Personal e Outros (coloridas) + cinza = Fit (o que falta para 100%). O Nutri não entra.
    const fatiasProdutividade = gruposBase.filter(g => g.chave !== 'FIT').map(g => ({ nome: g.chave === 'OUTROS PLANOS' ? 'Outros' : g.rotulo, valor: totalPlanos > 0 ? (g.total / totalPlanos) * 100 : 0, cor: corDoGrupo(g) }));
    // Fatia cinza: todo plano com base FIT (inclui FIT + NUTRI)
    const fatiaFit = { nome: 'Fit (não entra)', valor: percentualFit, cor: escuro ? '#334155' : '#EEF1F6' };
    const dadosRosca = totalPlanos > 0 ? [...fatiasProdutividade, fatiaFit].filter(f => f.valor > 0) : [{ nome: '—', valor: 100, cor: escuro ? '#334155' : '#EEF1F6' }];

    // Ritmo: cor da linha atual
    const grupoRitmoInfo = GRUPOS.find(g => g.chave === grupoRitmo);
    const corRitmo = grupoRitmoInfo ? corDoGrupo(grupoRitmoInfo) : (escuro ? '#60A5FA' : AZUL_DESTAQUE);
    const rotuloRitmo = grupoRitmoInfo ? tx(grupoRitmoInfo.rotulo) : tx('todos os planos');

    // Pódio: ordem visual 2º | 1º | 3º
    const ESTILO_DEGRAU = [
        { altura: 160, fundo: 'bg-[#FFF4CC] dark:bg-amber-500/15', borda: 'border-t-[#E7B416]', circulo: 'w-16 h-16 text-[18px]' },
        { altura: 120, fundo: 'bg-[#E9EDF3] dark:bg-slate-700/60', borda: 'border-t-[#A7B1C2]', circulo: 'w-12 h-12 text-[14px]' },
        { altura: 90, fundo: 'bg-[#FBEADF] dark:bg-orange-500/15', borda: 'border-t-[#C98A5A]', circulo: 'w-12 h-12 text-[14px]' },
    ];
    const podio = [1, 0, 2].filter(i => rankingOrdenado[i]).map(i => ({ pos: i, nome: rankingOrdenado[i][0], qtd: rankingOrdenado[i][1] }));
    const restoRanking = rankingOrdenado.slice(3);

    const corEixo = escuro ? '#94A3B8' : '#5B6478';
    const corGrade = escuro ? '#1E293B' : '#EEF1F6';

    // Rótulo do valor final de cada linha do ritmo (afasta os dois quando ficam perto)
    const pertos = ritmo && Math.abs(ritmo.totalAtual - ritmo.totalAnterior) <= Math.max(ritmo.totalAtual, ritmo.totalAnterior, 1) * 0.1;
    const pontoFinal = (ultimo, cor, deslocamento) => (props) => {
        const { cx, cy, index, value } = props;
        if (index !== ultimo || cx == null || cy == null || value == null) return <g key={`p-${index}`} />;
        return (
            <g key={`p-${index}`}>
                <circle cx={cx} cy={cy} r={5} fill={cor} stroke={escuro ? '#0F172A' : '#FFFFFF'} strokeWidth={2} />
                <text x={cx + 9} y={cy + deslocamento} fill={cor} fontSize={12} fontWeight={800}>{value}</text>
            </g>
        );
    };

    return (
        <div className="space-y-4 animate-[fadeIn_0.2s_ease-out] relative">

            {/* 🔥 NOVO PADRÃO: JANELAS FLUTUANTES (PRODUTIVIDADE) */}
            <DraggableWindow
                isOpen={modalProdOpen}
                onClose={() => setModalProdOpen(false)}
                title={tx("Memória de Cálculo")}
                subtitle="Transparência dos dados e conversão"
                icon={TrendingUp}
                iconColor="text-rose-500"
                minWidth={500}
                minHeight={500}
            >
                <div className="p-6 md:p-8 space-y-8">
                    <div>
                        <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2 dark:text-slate-400">
                            <Layers className="w-4 h-4 text-blue-500" />{' '}{tx("Planos Vendidos no Período")}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {todosPlanosDetalhados.map((p, i) => (
                                <div key={i} className="bg-white border border-slate-200 p-3.5 rounded-xl flex justify-between items-center shadow-sm dark:bg-slate-900 dark:border-slate-800">
                                    <span className="text-[10px] font-bold text-slate-700 uppercase truncate mr-2 dark:text-slate-200" title={p.nome}>{p.nome}</span>
                                    <span className="text-xs font-black text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg dark:text-blue-400 dark:bg-blue-500/10 dark:border-blue-500/30">{p.qtd}</span>
                                </div>
                            ))}
                            {todosPlanosDetalhados.length === 0 && (
                                <p className="text-xs font-bold text-slate-400 italic col-span-full">{tx("Nenhum plano registrado neste filtro.")}</p>
                            )}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2 dark:text-slate-400">
                            <Calculator className="w-4 h-4 text-rose-500" />{' '}{tx("Fórmula de Upsell Aplicada")}
                        </h4>
                        <div className="bg-white border border-slate-200 rounded-[20px] p-6 shadow-sm space-y-5 dark:bg-slate-900 dark:border-slate-800">
                            <div className="flex justify-between items-center">
                                <span className="text-[11px] font-bold text-slate-500 uppercase dark:text-slate-400">{tx("1. Total de entradas (planos base, sem Nutri)")}</span>
                                <span className="text-sm font-black text-slate-800 bg-slate-100 px-3 py-1 rounded-lg dark:text-white dark:bg-slate-800">{totalPlanos}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[11px] font-bold text-slate-500 uppercase dark:text-slate-400">{tx("2. Planos Fit (inclui Fit + Nutri)")}</span>
                                <span className="text-sm font-black text-slate-800 bg-slate-100 px-3 py-1 rounded-lg dark:text-white dark:bg-slate-800">{totalFit}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[11px] font-bold text-slate-500 uppercase dark:text-slate-400">{tx("3. Percentual FIT")}{' '}<span className="text-[10px] lowercase normal-case text-slate-400">{tx("(Fit ÷ Entradas × 100)")}</span></span>
                                <span className="text-sm font-black text-rose-600 bg-rose-50 px-3 py-1 rounded-lg dark:text-rose-400 dark:bg-rose-500/10">{percentualFit.toFixed(1)}%</span>
                            </div>
                            <div className="pt-5 border-t border-slate-200 flex justify-between items-center dark:border-slate-800">
                                <div>
                                    <span className="block text-xs font-black text-slate-800 uppercase tracking-widest dark:text-white">{tx("Produtividade Final")}</span>
                                    <span className="block text-[10px] font-bold text-slate-400 mt-0.5">{tx("100% - Percentual FIT")}</span>
                                </div>
                                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{produtividadeUpsell.toFixed(1)}%</span>
                            </div>
                        </div>
                        {/* Nutri é adicional: aparece só como informação, fora da conta */}
                        <p className="mt-4 bg-[#E7F7EF] text-[#0B7A52] rounded-xl px-4 py-3 text-[12px] font-semibold dark:bg-emerald-500/15 dark:text-emerald-300">
                            {tx('Adicionais Nutri vendidos: {qtd} — subproduto do plano, não entra no cálculo.', { qtd: totalNutri })}
                        </p>
                    </div>
                </div>
            </DraggableWindow>

            {/* MODAL: LISTA DOS PLANOS VENDIDOS (todos ou de um grupo) */}
            <ModalPlanos
                aberto={listaPlanosGrupo !== null}
                onFechar={fecharListaPlanos}
                listaNutri={listaNutri}
                plano={listaPlanosGrupo?.plano || null}
                lista={listaPlanos}
                grupo={listaPlanosGrupo?.grupo || null}
                textoPeriodo={textoPeriodo}
            />

            {/* JANELA: SERVIÇOS AVULSOS */}
            <DraggableWindow
                isOpen={modalServicosOpen}
                onClose={() => setModalServicosOpen(false)}
                title={tx("Serviços avulsos")}
                subtitle={tx("{qtd} no período", { qtd: totalServicos })}
                icon={Briefcase}
                iconColor="text-violet-400"
                minWidth={420}
                minHeight={360}
            >
                <div className="p-3 sm:p-5">
                    {servicosLista.length === 0 ? (
                        <p className="text-center text-xs font-bold text-slate-400 py-12">{tx("Nenhum serviço vendido no período.")}</p>
                    ) : (
                        <ul className="space-y-2">
                            {servicosLista.map(([nome, qtd]) => (
                                <li key={nome} className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-3 py-2.5 dark:bg-slate-900 dark:border-slate-800">
                                    <span className="text-[12px] font-black text-slate-800 uppercase dark:text-white">{nome}</span>
                                    <span className="text-[12px] font-black text-white bg-[#6D28D9] px-2.5 py-0.5 rounded-lg tabular-nums">{qtd}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </DraggableWindow>

            {/* 🔥 NOVO PADRÃO: JANELAS FLUTUANTES (ATIVOS DA UNIDADE) */}
            <DraggableWindow
                isOpen={modalAtivosOpen}
                onClose={() => { if (!isSalvandoAtivos && !sucessoAtivos) setModalAtivosOpen(false) }}
                title={tx("Ativos da Unidade")}
                subtitle={`${unidadeAtual} • ${String(filtroMes).padStart(2, '0')}/${filtroAno}`}
                icon={Users}
                iconColor="text-emerald-500"
                minWidth={350}
                minHeight={350}
            >
                <div className="p-6 md:p-8 flex flex-col gap-6 h-full justify-center">
                    {sucessoAtivos ? (
                        <div className="flex flex-col items-center justify-center py-6 animate-[zoomIn_0.2s_ease-out]">
                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 shadow-inner border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <h4 className="text-lg font-black text-slate-800 tracking-tight dark:text-white">{tx("Ativos Atualizados!")}</h4>
                            <p className="text-xs font-bold text-slate-500 mt-1 text-center dark:text-slate-400">{tx("O Dashboard já foi sincronizado.")}</p>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 block text-center dark:text-slate-400">
                                    {tx("Quantidade de alunos ativos")}
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={ativosInput}
                                    onChange={(e) => setAtivosInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSalvarAtivos(); }}
                                    className="w-full bg-white border-2 border-emerald-300 rounded-2xl p-4 text-3xl font-black text-emerald-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 text-center shadow-sm dark:bg-slate-900 dark:border-emerald-500/30 dark:text-emerald-400"
                                    autoFocus
                                />
                                {erroAtivos && <p className="text-xs font-bold text-rose-500 mt-2 text-center animate-pulse">{erroAtivos}</p>}
                            </div>

                            <button
                                onClick={handleSalvarAtivos}
                                disabled={!hasChangesAtivos || isSalvandoAtivos}
                                className={`w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-2
                                    ${!hasChangesAtivos ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none dark:bg-slate-700' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}
                                    ${isSalvandoAtivos ? 'opacity-70 cursor-wait' : ''}
                                `}
                            >
                                {isSalvandoAtivos ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" />{' '}{tx("Salvando...")}</>
                                ) : (
                                    <><Users className="w-5 h-5" />{' '}{tx("Salvar atualização")}</>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </DraggableWindow>

            {/* ===== 3. LINHA DE DESTAQUES ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* 3.1 PLANOS VENDIDOS (card escuro) */}
                <section className="lg:col-span-7 bg-[#0B1F4B] text-white rounded-[20px] p-6 md:p-7 flex flex-col gap-4 dark:bg-[#0B1F4B] dark:ring-1 dark:ring-blue-900">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#B9C6E8]">{t('analytics.dashboard.kpiPlans', { defaultValue: 'Planos Vendidos' })}</p>
                        {textoPeriodo && <span className="h-7 px-3 rounded-full bg-white/10 text-[12px] font-bold text-white flex items-center tabular-nums">{textoPeriodo}</span>}
                    </div>
                    <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
                        <span className="text-[64px] leading-none font-extrabold tracking-tight tabular-nums" title={t('analytics.dashboard.kpiTooltip', { defaultValue: 'Métrica deduplicada para espelhar número real de alunos' })}>{dois(totalPlanos)}</span>
                        {temComparativo && (
                            <div className="pb-1.5">
                                {(() => {
                                    const dif = totalPlanos - totalAnteriorPlanos;
                                    const cor = dif > 0 ? 'text-[#86EFAC]' : dif < 0 ? 'text-[#FFB4A8]' : 'text-[#B9C6E8]';
                                    const texto = dif === 0 ? `= ${tx('estável')}` : `${dif > 0 ? '▲' : '▼'} ${Math.abs(dif)}${totalAnteriorPlanos > 0 ? ` · ${dif > 0 ? '+' : '−'}${Math.abs(Math.round((dif / totalAnteriorPlanos) * 100))}%` : ''}`;
                                    return <p className={`text-[15px] font-extrabold tabular-nums ${cor}`}>{texto}</p>;
                                })()}
                                <p className="text-[13px] font-medium text-[#B9C6E8]">{tx('vs {qtd} no mesmo período de {mes}', { qtd: totalAnteriorPlanos, mes: nomeMesAnterior })}</p>
                            </div>
                        )}
                        {carregandoAnterior && <Loader2 className="w-4 h-4 animate-spin text-[#B9C6E8] mb-3" />}
                    </div>
                    {/* Barra: planos base (somam o total) + um espaço + Nutri listrado (adicional, não soma) */}
                    <div className="flex items-center gap-2 h-2.5 w-full" aria-hidden="true">
                        <div className="flex h-full rounded-full overflow-hidden bg-white/10 gap-0.5" style={{ flex: Math.max(totalPlanos, 1) }}>
                            {gruposBase.filter(g => g.total > 0).map(g => (
                                <span key={g.chave} style={{ width: `${(g.total / totalPlanos) * 100}%`, background: g.clara }} />
                            ))}
                        </div>
                        {totalNutri > 0 && (
                            <span className="h-full rounded-full opacity-80" title={tx('Adicional Nutri (não soma no total)')}
                                style={{ flex: totalNutri, background: `repeating-linear-gradient(135deg, ${linhaNutri.clara} 0 4px, transparent 4px 7px)`, boxShadow: `inset 0 0 0 1px ${linhaNutri.clara}` }} />
                        )}
                    </div>
                    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-medium text-[#DCE4F7]">
                        <li className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ background: linhaNutri.clara }} />{tx('Nutri')} <span className="font-bold text-white tabular-nums">{dois(totalNutri)}</span>
                            <span className="text-[#B9C6E8]">· {tx('adicional')}</span>
                        </li>
                        {gruposBase.map(g => (
                            <li key={g.chave} className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: g.clara }} />{tx(ROTULO_CURTO[g.chave])} <span className="font-bold text-white tabular-nums">{dois(g.total)}</span></li>
                        ))}
                    </ul>
                    <div>
                        <button type="button" onClick={() => setListaPlanosGrupo({ grupo: '' })} className="h-11 px-4 rounded-xl bg-white text-[#0B1F4B] text-[14px] font-bold inline-flex items-center gap-2 hover:bg-[#E8EEFF] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white">
                            {tx('Ver lista de planos')}<ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </section>

                {/* 3.2 PRODUTIVIDADE (rosca) */}
                <section className="lg:col-span-5 bg-white border border-[#E4E8F0] rounded-[20px] p-6 flex flex-col gap-4 dark:bg-slate-900 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-3">
                        <Rotulo>{tx('Produtividade')}</Rotulo>
                        <button type="button" onClick={() => setModalProdOpen(true)} className="h-10 px-3.5 rounded-xl border border-[#D6DCE8] text-[13px] font-bold text-[#0F172A] hover:bg-[#F3F5FA] transition-colors dark:border-slate-700 dark:text-white dark:hover:bg-slate-800">{tx('Ver cálculo')}</button>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-5">
                        <div className="relative w-[168px] h-[168px] shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={dadosRosca} dataKey="valor" nameKey="nome" innerRadius={56} outerRadius={80} startAngle={90} endAngle={-270} stroke={escuro ? '#0F172A' : '#FFFFFF'} strokeWidth={2} isAnimationActive={false}>
                                        {dadosRosca.map(f => <Cell key={f.nome} fill={f.cor} />)}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-lg font-extrabold text-[#0F172A] tabular-nums dark:text-white">{totalPlanos > 0 ? `${produtividadeUpsell.toFixed(0)}%` : '—'}</span>
                                <span className="text-[11px] font-semibold text-[#5B6478] dark:text-slate-400">{tx('sem FIT')}</span>
                            </div>
                        </div>
                        <ul className="flex-1 w-full space-y-1.5">
                            {fatiasProdutividade.map(f => (
                                <li key={f.nome} className="flex items-center justify-between gap-3 text-[13px]">
                                    <span className="inline-flex items-center gap-2 font-medium text-[#3B4458] dark:text-slate-300"><span className="w-3 h-3 rounded-[3px]" style={{ background: f.cor }} />{tx(f.nome)}</span>
                                    <span className="font-bold text-[#0F172A] tabular-nums dark:text-white">{pct(f.valor)}</span>
                                </li>
                            ))}
                            <li className="flex items-center justify-between gap-3 text-[13px] pt-2 mt-1 border-t border-[#EEF1F6] dark:border-slate-800">
                                <span className="inline-flex items-center gap-2 font-medium text-[#5B6478] dark:text-slate-400"><span className="w-3 h-3 rounded-[3px] border border-[#D6DCE8] dark:border-slate-600" style={{ background: fatiaFit.cor }} />{tx(fatiaFit.nome)}</span>
                                <span className="font-bold text-[#5B6478] tabular-nums dark:text-slate-400">{pct(fatiaFit.valor)}</span>
                            </li>
                        </ul>
                    </div>
                </section>
            </div>

            {/* ===== 4. INDICADORES MENORES ===== */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <CardMenor
                    rotulo={tx("Ativos da Unidade")}
                    valor={ativosAtualBanco !== null ? Number(ativosAtualBanco).toLocaleString(localeAtual()) : <span className="text-base">{tx("Não Informado")}</span>}
                    carregando={isCarregandoAtivos}
                    icone={Users} fundoIcone="bg-[#E8EEFF] dark:bg-blue-500/15" corIcone="text-[#1D4FD8] dark:text-blue-300"
                    iconeBotao={Pencil} rotuloBotao={tx("Clique para atualizar a quantidade de alunos ativos")}
                    onClick={handleAbrirModalAtivos}
                />
                {/* Entradas = planos base do período (automático) · Saídas = cancelamentos digitados · Faturamento = digitado */}
                <CardMenor
                    rotulo={tx('Entradas')}
                    valor={dois(totalPlanos)}
                    sub={movimento.semTabela ? '' : tx('Saldo no período: {saldo}', { saldo: `${totalPlanos - totaisMovimento.cancelamentos > 0 ? '+' : ''}${totalPlanos - totaisMovimento.cancelamentos}` })}
                    dica={tx('Planos vendidos no período (os mesmos do card de planos). Saldo = entradas − saídas.')}
                    icone={UserPlus} fundoIcone="bg-[#E7F7EF] dark:bg-emerald-500/15" corIcone="text-[#0B7A52] dark:text-emerald-300"
                />
                <CardMenor
                    rotulo={tx('Saídas')}
                    valor={movimento.semTabela ? '—' : dois(totaisMovimento.cancelamentos)}
                    carregando={movimento.carregando}
                    sub={tx('Cancelamentos lançados na aba Metas')}
                    dica={tx('Soma dos cancelamentos digitados na aba Metas → Movimento do dia, no período escolhido.')}
                    icone={UserMinus} fundoIcone="bg-[#FDECEA] dark:bg-rose-500/15" corIcone="text-[#B42318] dark:text-rose-300"
                />
                <CardMenor
                    rotulo={tx('Faturamento')}
                    valor={movimento.semTabela ? '—' : new Intl.NumberFormat(localeAtual(), { style: 'currency', currency: 'BRL' }).format(totaisMovimento.faturamento)}
                    carregando={movimento.carregando}
                    sub={movimento.semTabela ? tx('Falta criar a tabela no banco') : tx('{qtd} lançamento(s) no período', { qtd: totaisMovimento.lancamentos })}
                    dica={tx('Dinheiro que entrou, digitado dia a dia na aba Metas → Movimento do dia. Não é a comissão (a comissão fica no Fechamento).')}
                    icone={Wallet} fundoIcone="bg-[#E7F7EF] dark:bg-emerald-500/15" corIcone="text-[#0E9F6E] dark:text-emerald-300"
                />
                <CardMenor
                    rotulo={t('analytics.dashboard.kpiProducts', { defaultValue: 'Produtos Físicos' })}
                    valor={dois(totalVendasProdutos)}
                    icone={Box} fundoIcone="bg-[#FFF1E5] dark:bg-orange-500/15" corIcone="text-[#C2410C] dark:text-orange-300"
                    iconeBotao={ArrowRight} rotuloBotao={tx("Ver produtos")}
                    onClick={abrirPainelProdutos}
                />
                <CardMenor
                    rotulo={t('analytics.dashboard.kpiServices', { defaultValue: 'Serviços Avulsos' })}
                    valor={dois(totalServicos)}
                    icone={Briefcase} fundoIcone="bg-[#F1EBFF] dark:bg-violet-500/15" corIcone="text-[#6D28D9] dark:text-violet-300"
                    iconeBotao={ArrowRight} rotuloBotao={tx("Ver serviços")}
                    onClick={() => setModalServicosOpen(true)}
                />
            </div>

            {/* ===== 5. RITMO DO MÊS ===== */}
            <section className="bg-white border border-[#E4E8F0] rounded-[20px] p-5 md:p-6 dark:bg-slate-900 dark:border-slate-800">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <Rotulo>{tx('Ritmo do mês')} · {rotuloRitmo}</Rotulo>
                        {ritmo && (
                            <p className="mt-1 text-[14px] text-[#3B4458] flex flex-wrap items-center gap-2 dark:text-slate-300">
                                <span>
                                    <strong className="font-extrabold text-[#0F172A] dark:text-white">{ritmo.totalAtual}</strong> {tx('em {mes}', { mes: nomeMesAtual })}
                                    {temComparativo && <> {tx('vs')} <strong className="font-extrabold text-[#0F172A] dark:text-white">{ritmo.totalAnterior}</strong> {tx('em {mes}, nas mesmas datas', { mes: nomeMesAnterior })}</>}
                                </span>
                                {temComparativo && <SeloVariacao atual={ritmo.totalAtual} antes={ritmo.totalAnterior} />}
                            </p>
                        )}
                        {grupoRitmo === 'NUTRI' && (
                            <p className="mt-1 text-[12px] font-semibold text-[#0B7A52] dark:text-emerald-300">{tx('Adicional — não entra no total de planos')}</p>
                        )}
                    </div>
                    {ritmo && (
                        <div className="flex flex-wrap items-center gap-4 text-[13px] font-semibold text-[#3B4458] dark:text-slate-300">
                            <div className="inline-flex p-1 bg-[#F3F5FA] rounded-xl gap-1 dark:bg-slate-800" role="group" aria-label={tx('Como mostrar o ritmo')}>
                                {[['dia', 'Por dia'], ['acumulado', 'Acumulado']].map(([id, nome]) => (
                                    <button key={id} type="button" aria-pressed={modoRitmo === id} onClick={() => setModoRitmo(id)}
                                        className={`h-8 px-3 rounded-lg text-[12px] font-bold transition-colors ${modoRitmo === id ? 'bg-white text-[#0B1F4B] shadow-sm dark:bg-slate-900 dark:text-white' : 'text-[#3B4458] hover:text-[#0F172A] dark:text-slate-300 dark:hover:text-white'}`}>
                                        {tx(nome)}
                                    </button>
                                ))}
                            </div>
                            <span className="inline-flex items-center gap-2"><span className="w-6 h-1 rounded-full" style={{ background: corRitmo }} />{nomeMesAtual}</span>
                            {temComparativo && <span className="inline-flex items-center gap-2"><span className="w-6 border-t-[3px] border-dashed" style={{ borderColor: COR_MES_ANTERIOR }} />{nomeMesAnterior}</span>}
                        </div>
                    )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={tx('Grupo do gráfico')}>
                    {[{ chave: 'TODOS', rotulo: 'Todos', cor: AZUL_DESTAQUE, clara: '#60A5FA' }, ...GRUPOS].map(g => {
                        const ativo = grupoRitmo === g.chave;
                        return (
                            <button key={g.chave} type="button" aria-pressed={ativo} onClick={() => setGrupoRitmo(g.chave)}
                                className={`h-10 px-4 rounded-full border text-[13px] font-semibold inline-flex items-center gap-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${ativo ? 'bg-[#0B1F4B] border-[#0B1F4B] text-white dark:bg-blue-600 dark:border-blue-600' : 'bg-white border-[#D6DCE8] text-[#0F172A] hover:bg-[#F3F5FA] dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800'}`}>
                                <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: ativo ? '#FFFFFF' : (escuro ? g.clara : g.cor) }} />{tx(g.chave === 'OUTROS PLANOS' ? 'Outros' : g.rotulo)}
                            </button>
                        );
                    })}
                </div>

                {!ritmo ? (
                    <p className="text-center text-[13px] font-semibold text-[#5B6478] py-10 dark:text-slate-400">{tx('Escolha um período de mais de um dia (ex.: "Este mês") para ver o ritmo.')}</p>
                ) : modoRitmo === 'dia' ? (
                    <>
                        {/* Destaques: melhor dia, pior dia e média */}
                        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-[#3B4458] dark:text-slate-300">
                            {ritmo.melhor && <span>{tx('Melhor dia')}: <strong className="font-extrabold text-[#0B7A52] dark:text-emerald-400">{formatDataBR(ritmo.melhor.dia).slice(0, 5)} · {ritmo.melhor.qtd}</strong></span>}
                            {ritmo.pior && <span>{tx('Pior dia')}: <strong className="font-extrabold text-[#B42318] dark:text-rose-300">{formatDataBR(ritmo.pior.dia).slice(0, 5)} · {ritmo.pior.qtd}</strong></span>}
                            <span>{tx('Média por dia')}: <strong className="font-extrabold text-[#0F172A] dark:text-white">{ritmo.media.toLocaleString(localeAtual(), { maximumFractionDigits: 1 })}</strong></span>
                        </div>
                        <div className="mt-3 h-[260px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={ritmo.linhas} margin={{ top: 16, right: 16, left: 0, bottom: 4 }}>
                                    <defs>
                                        <linearGradient id="montanhaRitmo" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={corRitmo} stopOpacity={0.35} />
                                            <stop offset="100%" stopColor={corRitmo} stopOpacity={0.03} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid vertical={false} stroke={corGrade} />
                                    <XAxis dataKey="i" type="number" domain={[0, ritmo.linhas.length - 1]} ticks={ritmo.ticks}
                                        tickFormatter={(i) => ritmo.linhas[i]?.dia.slice(8) || ''} tick={{ fill: corEixo, fontSize: 12 }} axisLine={{ stroke: corGrade }} tickLine={false} />
                                    <YAxis allowDecimals={false} tickCount={5} domain={[0, 'auto']} tick={{ fill: corEixo, fontSize: 12 }} axisLine={false} tickLine={false} width={36} />
                                    <Tooltip
                                        labelFormatter={(i) => (ritmo.linhas[i] ? formatDataBR(ritmo.linhas[i].dia) : '')}
                                        formatter={(valor, nome) => [tx('{qtd} plano(s)', { qtd: valor }), nome === 'atualDia' ? nomeMesAtual : nomeMesAnterior]}
                                        contentStyle={{ borderRadius: 12, border: `1px solid ${escuro ? '#334155' : '#E4E8F0'}`, background: escuro ? '#0F172A' : '#FFFFFF', fontSize: 12 }}
                                    />
                                    {ritmo.media > 0 && <ReferenceLine y={ritmo.media} stroke={corEixo} strokeDasharray="2 4" />}
                                    {temComparativo && (
                                        <Line type="monotone" dataKey="anteriorDia" stroke={COR_MES_ANTERIOR} strokeWidth={2} strokeDasharray="7 6" dot={false} connectNulls={false} isAnimationActive={false} />
                                    )}
                                    <Area type="monotone" dataKey="atualDia" stroke={corRitmo} strokeWidth={3} fill="url(#montanhaRitmo)" connectNulls={false} isAnimationActive={false}
                                        dot={{ r: 2.5, fill: corRitmo, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="mt-1 text-[11px] text-[#5B6478] dark:text-slate-400">{tx('A linha pontilhada é a média por dia. Passe o mouse num dia para ver quantos planos saíram.')}</p>
                    </>
                ) : (
                    <div className="mt-4 h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={ritmo.linhas} margin={{ top: 16, right: 44, left: 0, bottom: 4 }}>
                                <CartesianGrid vertical={false} stroke={corGrade} />
                                <XAxis dataKey="i" type="number" domain={[0, ritmo.linhas.length - 1]} ticks={ritmo.ticks}
                                    tickFormatter={(i) => ritmo.linhas[i]?.dia.slice(8) || ''} tick={{ fill: corEixo, fontSize: 12 }} axisLine={{ stroke: corGrade }} tickLine={false} />
                                <YAxis allowDecimals={false} tickCount={5} domain={[0, 'auto']} tick={{ fill: corEixo, fontSize: 12 }} axisLine={false} tickLine={false} width={36} />
                                <Tooltip
                                    labelFormatter={(i) => (ritmo.linhas[i] ? formatDataBR(ritmo.linhas[i].dia) : '')}
                                    formatter={(valor, nome) => [valor, nome === 'atual' ? nomeMesAtual : nomeMesAnterior]}
                                    contentStyle={{ borderRadius: 12, border: `1px solid ${escuro ? '#334155' : '#E4E8F0'}`, background: escuro ? '#0F172A' : '#FFFFFF', fontSize: 12 }}
                                />
                                {temComparativo && (
                                    <Line type="monotone" dataKey="anterior" stroke={COR_MES_ANTERIOR} strokeWidth={3} strokeDasharray="7 6" connectNulls={false} isAnimationActive={false}
                                        dot={pontoFinal(ritmo.ultimoAnterior, COR_MES_ANTERIOR, pertos && ritmo.totalAnterior < ritmo.totalAtual ? 16 : pertos ? -8 : 4)} activeDot={{ r: 4 }} />
                                )}
                                <Line type="monotone" dataKey="atual" stroke={corRitmo} strokeWidth={4} connectNulls={false} isAnimationActive={false}
                                    dot={pontoFinal(ritmo.ultimoAtual, corRitmo, pertos && ritmo.totalAtual <= ritmo.totalAnterior ? 16 : pertos ? -8 : 4)} activeDot={{ r: 5 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </section>

            {/* ===== 6. PAINEL COM ABAS ===== */}
            <section ref={painelRef} className="bg-white border border-[#E4E8F0] rounded-[20px] dark:bg-slate-900 dark:border-slate-800 scroll-mt-4">
                <div className="px-4 md:px-6 pt-5 pb-4 border-b border-[#EEF1F6] flex flex-wrap items-center justify-between gap-3 dark:border-slate-800">
                    <div className="flex bg-[#F3F5FA] p-1 rounded-xl gap-1 overflow-x-auto custom-scrollbar max-w-full dark:bg-slate-800" role="tablist" aria-label={tx("Painéis")}>
                        {[
                            ['assinaturas', 'Assinaturas'],
                            ['produtos', 'Produtos / Complementos'],
                            ['ranking', 'Ranking de produtos'],
                        ].map(([id, rotulo]) => {
                            const ativa = painel === id;
                            return (
                                <button key={id} type="button" role="tab" aria-selected={ativa} onClick={() => setPainel(id)}
                                    className={`h-10 px-4 rounded-lg text-[14px] whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${ativa ? 'bg-white shadow-sm text-[#0B1F4B] font-bold dark:bg-slate-900 dark:text-white' : 'text-[#3B4458] hover:text-[#0F172A] font-semibold dark:text-slate-300 dark:hover:text-white'}`}>
                                    {tx(rotulo)}
                                </button>
                            );
                        })}
                    </div>
                    <button type="button" onClick={dispararModalMetas} className="h-11 px-4 rounded-xl bg-[#1D4FD8] text-white text-[14px] font-bold inline-flex items-center gap-2 hover:bg-[#1A45BF] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-300">
                        <MessageCircle className="w-4 h-4" />{tx('Alertar metas')}
                    </button>
                </div>

                <div className="p-4 md:p-6">
                    {/* ----- 6.1 ASSINATURAS ----- */}
                    {painel === 'assinaturas' && (
                        <>
                            {gruposTabela.length === 0 ? (
                                <p className="text-center text-[13px] font-semibold text-[#5B6478] py-10 dark:text-slate-400">{t('analytics.dashboard.emptyPlans', { defaultValue: 'Nenhum plano vendido.' })}</p>
                            ) : (
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full min-w-[760px] text-left border-collapse">
                                        <thead>
                                            <tr>
                                                {['Grupo', 'Vendidos', 'Participação', 'Mês ant. (mesmas datas)', 'Variação', ''].map((c, i) => (
                                                    <th key={i} className="px-2 py-3 border-b border-[#EEF1F6] text-[11px] font-bold uppercase tracking-[0.07em] text-[#5B6478] whitespace-nowrap dark:border-slate-800 dark:text-slate-400">{c ? tx(c) : <span className="sr-only">{tx('Abrir')}</span>}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {gruposTabela.map(g => {
                                                const aberto = grupoAberto === g.chave;
                                                const ehNutri = g.chave === 'NUTRI';
                                                // Nutri: adesão (adicionais ÷ planos base) · demais: % do total de planos base
                                                const part = totalPlanos > 0 ? (g.total / totalPlanos) * 100 : 0;
                                                // Nível 1: planos do grupo agrupados por nome (o mesmo combo aparece no grupo base e no Nutri)
                                                const planosDoGrupo = Object.entries(gruposPlanos[g.chave]?.detalhes || {})
                                                    .filter(([, qtd]) => qtd > 0)
                                                    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
                                                return (
                                                    <React.Fragment key={g.chave}>
                                                        <tr className="border-b border-[#F1F3F8] dark:border-slate-800">
                                                            <td className="px-2 py-3.5">
                                                                <span className="inline-flex items-center gap-2.5 text-[15px] font-bold text-[#0F172A] dark:text-white"><span className="w-3 h-3 rounded-[3px]" style={{ background: corDoGrupo(g) }} />{tx(g.rotulo)}</span>
                                                                {ehNutri && <span className="block mt-0.5 ml-[22px] text-[11px] font-semibold text-[#5B6478] dark:text-slate-400">{tx('Adicional · não conta como ativo')}</span>}
                                                            </td>
                                                            <td className="px-2 py-3.5 text-lg font-extrabold text-[#0F172A] tabular-nums dark:text-white">{dois(g.total)}</td>
                                                            <td className="px-2 py-3.5 w-[34%]">
                                                                <span className="flex items-center gap-3">
                                                                    <span className="flex-1 h-3 rounded-full bg-[#EEF1F6] overflow-hidden dark:bg-slate-800">
                                                                        <span className="block h-full rounded-full" style={ehNutri
                                                                            ? { width: `${Math.min(adesaoNutri, 100)}%`, background: `repeating-linear-gradient(135deg, ${corDoGrupo(g)} 0 5px, ${corDoGrupo(g)}99 5px 9px)` }
                                                                            : { width: `${part}%`, background: corDoGrupo(g) }} />
                                                                    </span>
                                                                    <span className={`text-right text-[13px] font-semibold text-[#3B4458] tabular-nums whitespace-nowrap dark:text-slate-300 ${ehNutri ? 'w-28' : 'w-10'}`}>
                                                                        {ehNutri ? tx('{pct}% de adesão', { pct: Math.round(adesaoNutri) }) : `${Math.round(part)}%`}
                                                                    </span>
                                                                </span>
                                                            </td>
                                                            <td className="px-2 py-3.5 text-[15px] font-semibold text-[#3B4458] tabular-nums dark:text-slate-300">{temComparativo ? g.anterior : '—'}</td>
                                                            <td className="px-2 py-3.5">{temComparativo ? <SeloVariacao atual={g.total} antes={g.anterior} /> : <span className="text-[#5B6478]">—</span>}</td>
                                                            <td className="px-2 py-3.5 text-right">
                                                                <button type="button" onClick={() => setGrupoAberto(aberto ? null : g.chave)} aria-expanded={aberto} aria-label={tx('Ver planos de {grupo}', { grupo: tx(g.rotulo) })}
                                                                    className={`w-10 h-10 rounded-xl border inline-flex items-center justify-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${aberto ? 'bg-[#0B1F4B] border-[#0B1F4B] text-white dark:bg-blue-600 dark:border-blue-600' : 'border-[#D6DCE8] text-[#0F172A] hover:bg-[#F3F5FA] dark:border-slate-700 dark:text-white dark:hover:bg-slate-800'}`}>
                                                                    <ChevronDown className={`w-4 h-4 transition-transform ${aberto ? 'rotate-180' : ''}`} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                        {aberto && (
                                                            <tr>
                                                                <td colSpan={6} className="px-0 py-3">
                                                                    <div className="bg-[#F8FAFD] border border-[#EEF1F6] rounded-xl px-4 py-2 dark:bg-slate-800/60 dark:border-slate-800">
                                                                        {planosDoGrupo.length === 0 ? (
                                                                            <p className="text-[13px] font-semibold text-[#5B6478] py-3 dark:text-slate-400">{tx('Nenhuma venda deste grupo no período.')}</p>
                                                                        ) : (
                                                                            <>
                                                                                {/* Nível 1: cada plano do grupo (clicar = lista só daquele plano) */}
                                                                                <ul className="divide-y divide-[#EEF1F6] dark:divide-slate-700">
                                                                                    {planosDoGrupo.map(([nomePlano, qtd]) => (
                                                                                        <li key={nomePlano}>
                                                                                            <button type="button" onClick={() => setListaPlanosGrupo({ grupo: g.chave, plano: nomePlano })}
                                                                                                className="w-full min-h-10 py-2 flex items-center justify-between gap-3 text-left text-[14px] rounded-lg hover:bg-white transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-900">
                                                                                                <span className="min-w-0 flex items-center gap-2 flex-wrap">
                                                                                                    <span className="font-bold text-[#0F172A] dark:text-white">{nomePlano}</span>
                                                                                                    {descontinuados.has(nomePlano) && <span className="h-6 px-2 rounded-full bg-[#EEF1F6] text-[#3B4458] text-[11px] font-bold inline-flex items-center dark:bg-slate-700 dark:text-slate-200">{tx('descontinuado')}</span>}
                                                                                                </span>
                                                                                                <span className="shrink-0 font-extrabold text-[#0F172A] tabular-nums dark:text-white">{qtd}</span>
                                                                                            </button>
                                                                                        </li>
                                                                                    ))}
                                                                                </ul>
                                                                                {/* Nível 2: todas as vendas do grupo */}
                                                                                <button type="button" onClick={() => setListaPlanosGrupo({ grupo: g.chave })} className="mt-1 mb-1 h-10 px-2 text-[13px] font-bold text-[#1D4FD8] hover:underline dark:text-blue-300">
                                                                                    {tx('Ver todos os {qtd} de {grupo}', { qtd: g.total, grupo: tx(g.rotulo) })} →
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            <p className="mt-4 text-[13px] font-medium text-[#5B6478] flex items-center gap-2 dark:text-slate-400">
                                {faixaAnterior ? (
                                    carregandoAnterior ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx("Buscando o mês anterior...")}</>
                                        : erroAnterior ? <span className="text-[#B42318] dark:text-rose-300">{tx("Não foi possível buscar o mês anterior.")}</span>
                                            : tx('Comparação com {faixa} — as mesmas datas do mês anterior.', { faixa: textoFaixaAnterior })
                                ) : tx("Escolha um período com começo e fim para ver o comparativo com o mês anterior.")}
                            </p>
                        </>
                    )}

                    {/* ----- 6.2 PRODUTOS / COMPLEMENTOS ----- */}
                    {painel === 'produtos' && (
                        produtosAgrupados.length === 0 ? (
                            <p className="text-center text-[13px] font-semibold text-[#5B6478] py-10 dark:text-slate-400">{t('analytics.dashboard.emptyProducts', { defaultValue: 'Nenhum produto físico vendido.' })}</p>
                        ) : (
                            <ul className="space-y-2">
                                {produtosAgrupados.map((p, idx) => {
                                    const aberto = produtoAberto === p.chave;
                                    const complemento = p.sabores ? [p.complemento, tx('{qtd} sabores', { qtd: p.sabores.length })].filter(Boolean).join(' · ') : '';
                                    return (
                                        <li key={p.chave} className="border border-[#EEF1F6] rounded-xl dark:border-slate-800">
                                            <div className="flex items-center gap-3 p-3">
                                                <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-[13px] font-extrabold shrink-0 ${idx < 3 ? 'bg-[#0B1F4B] text-white dark:bg-blue-600' : 'bg-[#F3F5FA] text-[#3B4458] dark:bg-slate-800 dark:text-slate-200'}`}>{idx + 1}º</span>
                                                <span className="flex-1 min-w-0">
                                                    <span className="block text-[15px] font-bold text-[#0F172A] truncate dark:text-white">
                                                        {p.nome}
                                                        {complemento && <span className="font-medium text-[#5B6478] dark:text-slate-400"> · {complemento}</span>}
                                                    </span>
                                                    <span className="block w-full h-2 rounded-full bg-[#FFF1E5] overflow-hidden mt-2 dark:bg-orange-500/15">
                                                        <span className="block h-full rounded-full bg-[#F07B1A]" style={{ width: `${maiorProduto > 0 ? (p.total / maiorProduto) * 100 : 0}%` }} />
                                                    </span>
                                                </span>
                                                <span className="h-8 px-3 rounded-full bg-[#C2410C] text-white text-[13px] font-extrabold inline-flex items-center tabular-nums shrink-0">{p.total} {tx('un')}</span>
                                                {p.sabores ? (
                                                    <button type="button" onClick={() => setProdutoAberto(aberto ? null : p.chave)} aria-expanded={aberto} aria-label={tx('Ver sabores de {produto}', { produto: p.nome })}
                                                        className={`w-10 h-10 rounded-xl border inline-flex items-center justify-center shrink-0 transition-colors ${aberto ? 'bg-[#0B1F4B] border-[#0B1F4B] text-white dark:bg-blue-600 dark:border-blue-600' : 'border-[#D6DCE8] text-[#0F172A] hover:bg-[#F3F5FA] dark:border-slate-700 dark:text-white dark:hover:bg-slate-800'}`}>
                                                        <ChevronDown className={`w-4 h-4 transition-transform ${aberto ? 'rotate-180' : ''}`} />
                                                    </button>
                                                ) : <span className="w-10 shrink-0" aria-hidden="true" />}
                                            </div>
                                            {aberto && p.sabores && (
                                                <ul className="mx-3 mb-3 bg-[#FFF8F2] rounded-xl px-4 py-1 divide-y divide-[#FBE3CF] dark:bg-orange-500/10 dark:divide-orange-500/20">
                                                    {p.sabores.map(s => (
                                                        <li key={s.produto} className="py-2 flex items-center justify-between gap-3 text-[14px]">
                                                            <span className="font-semibold text-[#0F172A] dark:text-white" title={s.produto}>{s.nome}</span>
                                                            <span className="font-extrabold text-[#C2410C] tabular-nums dark:text-orange-300">{s.qtd} {tx('un')}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )
                    )}

                    {/* ----- 6.3 RANKING DE PRODUTOS (antigo Pódio Físico) ----- */}
                    {painel === 'ranking' && (
                        <div className="space-y-6">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-[16px] font-extrabold text-[#0F172A] dark:text-white">{tx('Ranking de produtos')}</h3>
                                    <p className="text-[13px] font-medium text-[#5B6478] dark:text-slate-400">{tx('Garrafas e Whey vendidos por consultor no período')}</p>
                                </div>
                                <button type="button" onClick={dispararModalCompartilhar} disabled={rankingOrdenado.length === 0} className="h-11 px-4 rounded-xl bg-[#0F7A3E] text-white text-[14px] font-bold inline-flex items-center gap-2 hover:bg-[#0C6533] transition-colors disabled:opacity-50">
                                    <Send className="w-4 h-4" />{tx('Enviar ranking no WhatsApp')}
                                </button>
                            </div>

                            {rankingOrdenado.length === 0 ? (
                                <p className="text-center text-[13px] font-semibold text-[#5B6478] py-10 dark:text-slate-400">{t('analytics.dashboard.emptyConsultants', { defaultValue: 'Nenhum consultor cadastrado na unidade.' })}</p>
                            ) : (
                                <>
                                    {/* Pódio de verdade: 2º | 1º | 3º */}
                                    <div className="flex items-end justify-center gap-2 sm:gap-4 max-w-[560px] mx-auto">
                                        {podio.map(({ pos, nome, qtd }) => {
                                            const e = ESTILO_DEGRAU[pos];
                                            return (
                                                <div key={nome} className="flex-1 min-w-0 flex flex-col items-center">
                                                    <span className={`${e.circulo} rounded-full bg-[#0B1F4B] text-white font-extrabold flex items-center justify-center dark:bg-blue-600`}>{iniciais(nome)}</span>
                                                    <p className="mt-2 text-[14px] font-bold text-[#0F172A] truncate max-w-full dark:text-white">{nome.split(' ')[0]}</p>
                                                    <p className={`text-[12px] font-semibold mb-2 ${qtd === 0 ? 'text-[#B42318] dark:text-rose-300' : 'text-[#5B6478] dark:text-slate-400'}`}>{tx('{qtd} itens', { qtd })}</p>
                                                    <div className={`w-full rounded-t-xl border-t-4 ${e.fundo} ${e.borda} flex items-start justify-center pt-3`} style={{ height: e.altura }}>
                                                        <span className="text-lg font-extrabold text-[#0F172A] dark:text-white">{pos + 1}º</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {restoRanking.length > 0 && (
                                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {restoRanking.map(([nome, qtd], i) => (
                                                <li key={nome} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-[#EEF1F6] dark:border-slate-800">
                                                    <span className="flex items-center gap-3 min-w-0">
                                                        <span className="w-8 text-[13px] font-extrabold text-[#5B6478] tabular-nums dark:text-slate-400">{i + 4}º</span>
                                                        <span className="text-[14px] font-bold text-[#0F172A] truncate dark:text-white">{nome.split(' ')[0]}</span>
                                                    </span>
                                                    <span className={`h-7 px-2.5 rounded-full text-[12px] font-bold inline-flex items-center tabular-nums ${qtd === 0 ? 'bg-[#FDECEA] text-[#B42318] dark:bg-rose-500/15 dark:text-rose-300' : 'bg-[#EEF1F6] text-[#0F172A] dark:bg-slate-800 dark:text-white'}`}>{dois(qtd)} {tx('un')}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default DashboardTab;
