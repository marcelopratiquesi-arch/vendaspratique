import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../supabaseClient.js';
import { contarPlanosDoCard, getCategoriaItem } from './utils.js';
import { qtdValidaProduto } from './limiteDoses.js';
import { useDosesValidas } from './useDosesValidas.js';
import MovimentoDiarioPainel, { MovimentacaoForm, JanelaMovimento } from './MovimentoDiarioPainel.jsx';
import MonitorMovimentacao from './MonitorMovimentacao.jsx';
import HistoricoMetas from './HistoricoMetas.jsx';
import { useMovimentoDiario, entradasPorDia, podeGravarMovimento } from './movimentoDiario.js';
import { podeFazer } from '../../permissoes/catalogoPermissoes.js';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { Target, Activity, Share2, Award, Zap, Loader2, Save, Check, Building2, CheckCircle2, AlertCircle, Clock, Leaf, Package, Dumbbell, Users, Star, Trophy, TrendingUp, History, XCircle, RotateCcw } from 'lucide-react';
import { avisar } from '../../components/avisar.js';
import { tx, localeAtual } from '../../i18n/traduzir.js';
import { infoDoMes, avaliarMeta } from './painel/calculosPainel.js';

// ==========================================
// 🧠 COMPONENTE REUTILIZÁVEL: Input com Auto-Save (CORRIGIDO)
// ==========================================
const InputFieldWithSave = ({ label, description, subtitle, icon: Icon, value, dbValue, onChange, onSave, theme = 'blue', large = false, somenteLeitura = false, semBotao = false }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const normalizar = (val) => (val === null || val === undefined || val === '') ? '' : String(val);
    const hasChanged = normalizar(value) !== normalizar(dbValue);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!hasChanged || isSaving) return;
        setIsSaving(true);
        try {
            await onSave(value);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
        } catch (err) {
            console.error("Erro ao salvar campo:", err);
            avisar(tx("Erro ao gravar. Verifique sua conexão."));
        } finally {
            setIsSaving(false);
        }
    };

    // Só números inteiros (igual aos campos da Movimentação); vazio continua vazio
    const handleChange = (e) => {
        const val = String(e.target.value || '').replace(/\D/g, '');
        onChange(val === '' ? '' : Number(val));
    };

    const styles = {
        blue: { ring: 'focus:ring-blue-500', btn: 'bg-blue-600 hover:bg-blue-700 text-white', iconTxt: 'text-blue-600 dark:text-blue-400' },
        amber: { ring: 'focus:ring-amber-500', btn: 'bg-amber-500 hover:bg-amber-600 text-white', iconTxt: 'text-amber-500' },
        emerald: { ring: 'focus:ring-emerald-500', btn: 'bg-emerald-600 hover:bg-emerald-700 text-white', iconTxt: 'text-emerald-600 dark:text-emerald-400' }
    }[theme];

    if (large) {
        return (
            <div className="flex items-center justify-center gap-3 w-full my-2">
                <input
                    type="number"
                    value={value}
                    onChange={handleChange}
                    className="w-[200px] h-[72px] bg-white border-2 border-emerald-400 rounded-xl text-4xl font-black text-emerald-700 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 text-center shadow-sm transition-all dark:bg-slate-900 dark:text-emerald-400"
                />
                <button
                    onClick={handleSave}
                    disabled={!hasChanged || isSaving}
                    title={!hasChanged ? tx("Sem alterações pendentes") : tx("Salvar esta meta")}
                    className={`w-16 h-[72px] rounded-xl transition-all flex items-center justify-center shrink-0 shadow-sm border border-transparent
                        ${!hasChanged ? 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800' : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-600 hover:text-white dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30'}
                        ${isSaving ? 'opacity-70 cursor-wait' : ''}
                        ${showSuccess ? '!bg-emerald-500 !text-white !border-emerald-600 scale-105' : ''}
                    `}
                >
                    {isSaving ? <Loader2 className="animate-spin w-6 h-6" /> : 
                     showSuccess ? <Check className="w-6 h-6" /> : 
                     <Save className="w-6 h-6" />}
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-2xl shadow-sm gap-3 dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                {Icon && (
                    <div className={`p-2 rounded-xl bg-slate-50 border border-slate-100 shrink-0 dark:bg-slate-800/60 dark:border-slate-800 ${styles.iconTxt}`}>
                        <Icon className="w-5 h-5" />
                    </div>
                )}
                <div className="flex flex-col min-w-0">
                    <div className="text-[11px] font-black text-slate-800 uppercase tracking-widest truncate dark:text-white">
                        {tx(label)}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                        {subtitle && <span className="text-rose-500 text-[10px] font-bold shrink-0">{subtitle}</span>}
                        {description && <span className="text-[10px] font-medium text-slate-400 truncate">{description}</span>}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <input
                    type="text"
                    inputMode="numeric"
                    aria-label={tx(label)}
                    value={value ?? ''}
                    onChange={handleChange}
                    disabled={somenteLeitura}
                    className={`w-[72px] h-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-800 outline-none focus:bg-white focus:ring-4 disabled:cursor-not-allowed dark:bg-slate-800/60 dark:border-slate-800 dark:text-white dark:focus:bg-slate-900 ${styles.ring} text-center transition-all`}
                />
                {!somenteLeitura && !semBotao && <button
                    onClick={handleSave}
                    disabled={!hasChanged || isSaving}
                    title={!hasChanged ? tx("Sem alterações pendentes") : tx("Salvar esta meta")}
                    className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center shrink-0 border border-transparent
                        ${!hasChanged ? 'bg-slate-50 text-slate-300 cursor-not-allowed dark:bg-slate-800/60' : `${styles.btn} border-current border-opacity-20`}
                        ${isSaving ? 'opacity-70 cursor-wait' : ''}
                        ${showSuccess ? '!bg-emerald-500 !text-white !border-emerald-600 scale-105 shadow-md' : ''}
                    `}
                >
                    {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> :
                     showSuccess ? <Check className="w-4 h-4" /> :
                     <Save className="w-4 h-4" />}
                </button>}
            </div>
        </div>
    );
};

// ==========================================
// 🚀 NOVO DESIGN CIRÚRGICO: MetaItemCard PREMIUM
// ==========================================
// Cor do RITMO (avaliarMeta em painel/calculosPainel.js): compara o feito com o pedaço do mês que já passou
const COR_RITMO = {
    verde: { ponto: 'bg-emerald-500', texto: 'No ritmo' },
    amarelo: { ponto: 'bg-amber-500', texto: 'Um pouco abaixo' },
    vermelho: { ponto: 'bg-rose-500', texto: 'Em risco' },
};
const numeroCurto = (v, casas = 0) => Number(v || 0).toLocaleString(localeAtual(), { maximumFractionDigits: casas });

const MetaItemCard = ({ label, dados, corTema, recompensa, ritmo, mes }) => {
    const metaVal = Number(dados.meta) || 0;
    const realizadoVal = Number(dados.realizado) || 0;
    const faltaVal = Number(dados.falta) || 0;
    
    // Percentual calculado APENAS para UX visual (limitado a 100%)
    const perc = metaVal > 0 ? Math.min((realizadoVal / metaVal) * 100, 100) : 0;

    // A regra oficial do sistema prevalece
    const isBatida = dados.batida;
    
    // Status visual inteligente
    let statusText = "ATRÁS DA META";
    let statusColor = "text-rose-500";
    let StatusIcon = AlertCircle;

    if (isBatida) {
        statusText = "META BATIDA";
        statusColor = "text-emerald-600 dark:text-emerald-400";
        StatusIcon = CheckCircle2;
    } else if (perc >= 80) {
        statusText = "QUASE LÁ";
        statusColor = "text-blue-500";
        StatusIcon = Target;
    } else if (perc >= 50) {
        statusText = "EM ANDAMENTO";
        statusColor = "text-amber-500";
        StatusIcon = Clock;
    }

    // Definição de cores estruturais
    const corBarra = isBatida ? 'bg-emerald-500' : corTema;
    const bgCard = isBatida ? 'bg-emerald-50/40 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30' : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-slate-700';
    const corPercentual = isBatida ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-white';

    return (
        <div className={`p-5 rounded-2xl border ${bgCard} transition-colors duration-300 relative overflow-hidden group shadow-sm hover:shadow-md flex flex-col justify-between`}>
            
            {/* NÍVEL 1 & 2: HIERARQUIA VISUAL DOS NÚMEROS */}
            <div className="flex justify-between items-start mb-3">
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2 dark:text-white">
                        {tx(label)}
                        {ritmo && COR_RITMO[ritmo.status] && !isBatida && (
                            <span className={`w-2.5 h-2.5 rounded-full ${COR_RITMO[ritmo.status].ponto}`} title={tx(COR_RITMO[ritmo.status].texto)} aria-label={tx(COR_RITMO[ritmo.status].texto)} />
                        )}
                    </span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-xl font-black text-slate-800 leading-none dark:text-white">{realizadoVal}</span>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest dark:text-slate-400"> / {metaVal}</span>
                    </div>
                </div>
                <div className="text-right">
                    <span className={`text-3xl font-black tracking-tighter ${corPercentual}`}>
                        {perc.toFixed(0)}%
                    </span>
                </div>
            </div>

            {/* NÍVEL 3: BARRA DE PROGRESSO */}
            <div className="relative w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-4 border border-slate-200/50 dark:bg-slate-800 dark:border-slate-800">
                <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${corBarra}`}
                    style={{ width: `${perc}%` }}
                />
                {/* Risquinho: onde deveria estar hoje (só no mês em andamento) */}
                {ritmo && mes?.situacao === 'andamento' && !isBatida && ritmo.projecao !== null && (
                    <div className="absolute top-0 bottom-0 w-0.5 bg-slate-700 dark:bg-slate-200" style={{ left: `${Math.min((mes.diasPassados / mes.diasMes) * 100, 100)}%` }} title={tx('Onde deveria estar hoje')} />
                )}
            </div>

            {/* Ritmo: quanto precisa por dia e onde o mês termina no ritmo de hoje */}
            {ritmo && !isBatida && (ritmo.ritmo !== null || (ritmo.projecao !== null && mes?.situacao === 'andamento')) && (
                <p className="-mt-2 mb-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {ritmo.ritmo !== null && tx('Precisa de {qtd} por dia', { qtd: numeroCurto(ritmo.ritmo, 1) })}
                    {ritmo.ritmo !== null && ritmo.projecao !== null && ' · '}
                    {ritmo.projecao !== null && mes?.situacao === 'andamento' && tx('Projeção: {qtd}', { qtd: numeroCurto(Math.floor(ritmo.projecao)) })}
                </p>
            )}

            {/* NÍVEL 4 & 5: FALTANTE E STATUS/RECOMPENSA */}
            <div className="flex justify-between items-center mt-auto">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {isBatida ? (
                        <span className="flex items-center gap-1.5 text-emerald-600 bg-emerald-100/60 px-2.5 py-1 rounded-md border border-emerald-200/50 uppercase font-black tracking-widest text-[10px] dark:text-emerald-400 dark:bg-emerald-500/20 dark:border-emerald-500/30">
                            <StatusIcon className="w-3.5 h-3.5" /> {tx(statusText)}
                        </span>
                    ) : (
                        <>
                            <span className="text-slate-500 uppercase tracking-widest text-[10px] font-black dark:text-slate-400">{tx("Faltam")}</span>
                            <strong className="text-slate-800 font-black text-sm dark:text-white">{faltaVal}</strong>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {!isBatida && (
                        <span className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${statusColor}`}>
                            <StatusIcon className="w-3.5 h-3.5" /> {tx(statusText)}
                        </span>
                    )}
                    {recompensa && !isBatida && (
                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider bg-amber-50 px-2 py-1 rounded-md border border-amber-100 ml-1 shadow-sm dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/30">
                            + {recompensa}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
const MetasTab = ({
    temVisaoGlobal, filtroUnidade, filtroMes, filtroAno, vendasFiltradas, unidadesUnicas, usuarioLogado,
    metaNutri, setMetaNutri, metaProdutos, setMetaProdutos, metaPersonal, setMetaPersonal,
    metaAtivosMensal, setMetaAtivosMensal, metaNutriMensal, setMetaNutriMensal, metaPlusMensal, setMetaPlusMensal, metaPersMensal, setMetaPersMensal,
    ativosAtual, setAtivosAtual, planos, produtos, abrirModalWhatsapp, tipoFiltro, vendasTodas = [], faixa = null
}) => {
    const { locale } = useI18n();
    const [metasDoBanco, setMetasDoBanco] = useState({});

    const unidadeAtivaEdicao = temVisaoGlobal ? filtroUnidade : usuarioLogado?.unidade;

    // "Não tem Personal Class" por unidade, vale para sempre até desmarcar (decisão do dono, 04/11/2026)
    const [semPersonalMapa, setSemPersonalMapa] = useState({});
    const [historicoAberto, setHistoricoAberto] = useState(null); // 'start' | 'mensal' | null
    useEffect(() => {
        supabase.from('unidades_sem_personal').select('unidade, sem_personal').then(({ data, error }) => {
            if (error) { console.warn('Metas: falta rodar sql/2026-11-04-metas-personal/1_unidades_sem_personal.sql', error.message); return; }
            const mapa = {};
            (data || []).forEach(l => { if (l.sem_personal) mapa[String(l.unidade).toUpperCase()] = true; });
            setSemPersonalMapa(mapa);
        });
    }, []);
    const podeEditarCampos = unidadeAtivaEdicao && unidadeAtivaEdicao !== 'TODOS';
    // Metas: permissão 307 (padrão: Líder, Mentor e Admin; a Recepção só vê — decisão do dono, 05/11/2026)
    const podeEditarMetas = podeFazer(usuarioLogado, '307');
    const podeMarcarSemPersonal = podeFazer(usuarioLogado, '309');
    // Mês em que as metas são lidas e gravadas (vem do index: mês do período ou o mês atual)
    const rotuloMesMetas = `${String(filtroMes).padStart(2, '0')}/${filtroAno}`;
    const semPersonal = !!semPersonalMapa[String(unidadeAtivaEdicao || '').toUpperCase()];
    const indicadoresMensal = semPersonal ? 3 : 4;
    const marcarSemPersonal = async (valor) => {
        const u = String(unidadeAtivaEdicao).toUpperCase();
        if (valor && !window.confirm(tx('Marcar que a unidade {unidade} NÃO TEM Personal Class? O Personal some das metas (Start e Mensal) e a gratificação mensal fica com 3 indicadores.', { unidade: u }))) return;
        const { error } = await supabase.from('unidades_sem_personal').upsert({ unidade: u, sem_personal: valor, atualizado_por: usuarioLogado?.nome || null, atualizado_em: new Date().toISOString() }, { onConflict: 'unidade' });
        if (error) { console.error('Metas: erro ao gravar Personal', error); avisar(tx('Não foi possível gravar: {erro}', { erro: error.message }), 'erro'); return; }
        setSemPersonalMapa(m => { const n = { ...m }; if (valor) n[u] = true; else delete n[u]; return n; });
        avisar(valor ? tx('Unidade marcada sem Personal Class.') : tx('Personal Class voltou para as metas.'), 'sucesso');
    };

    // Movimentação (card verde + tabela por dia): o dono digita o acumulado do mês; regras em movimentoDiario.js
    const [diaPedido, setDiaPedido] = useState(null); // lápis da tabela: abre o card naquele dia
    const movimento = useMovimentoDiario({ unidade: unidadeAtivaEdicao, faixa });
    const entradasMovimento = useMemo(() => {
        const un = podeEditarCampos ? String(unidadeAtivaEdicao).toUpperCase() : null;
        return entradasPorDia(un ? vendasTodas.filter(v => String(v.unidade || '').toUpperCase() === un) : vendasTodas, planos, produtos);
    }, [vendasTodas, planos, produtos, podeEditarCampos, unidadeAtivaEdicao]);
    const editarDiaMovimento = (d) => { setDiaPedido({ dia: d, vez: Date.now() }); document.getElementById('movimentacao-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); };

    useEffect(() => {
        const buscarMetas = async () => {
            try {
                const { data, error } = await supabase
                    .from('metas_unidades')
                    .select('*')
                    .eq('mes', String(filtroMes))
                    .eq('ano', String(filtroAno));
                
                if (error) throw error;

                if (data) {
                    const dicionario = {};
                    data.forEach(linha => {
                        if(linha.unidade) dicionario[linha.unidade.toUpperCase()] = linha;
                    });
                    setMetasDoBanco(dicionario);
                }
            } catch (err) {
                console.error("Erro ao buscar metas no DB:", err);
            }
        };
        if(filtroMes && filtroAno) buscarMetas();
    }, [filtroMes, filtroAno]);

    // Preenche os campos com o que está no banco SÓ ao abrir / trocar de unidade ou mês. Depois de gravar
    // (um card, ou os ativos pela Movimentação) NÃO recarrega os campos: senão apagava o que estava digitado no outro card.
    const naoRecarregarCampos = useRef(false);
    useEffect(() => {
        if (naoRecarregarCampos.current) { naoRecarregarCampos.current = false; return; }
        if (podeEditarCampos) {
            const metaDb = metasDoBanco[unidadeAtivaEdicao.toUpperCase()];
            if (metaDb) {
                setMetaNutri(metaDb.meta_nutri ?? '');
                setMetaProdutos(metaDb.meta_produtos ?? '');
                setMetaPersonal(metaDb.meta_personal ?? '');
                setMetaAtivosMensal(metaDb.meta_ativos_mensal ?? '');
                setMetaNutriMensal(metaDb.meta_nutri_mensal ?? '');
                setMetaPlusMensal(metaDb.meta_plus_mensal ?? '');
                setMetaPersMensal(metaDb.meta_pers_mensal ?? '');
                setAtivosAtual(metaDb.ativos_atual ?? '');
            } else {
                setMetaNutri(''); setMetaProdutos(''); setMetaPersonal('');
                setMetaAtivosMensal(''); setMetaNutriMensal(''); setMetaPlusMensal('');
                setMetaPersMensal(''); setAtivosAtual('');
            }
        }
    }, [metasDoBanco, unidadeAtivaEdicao, podeEditarCampos]);

    const metaCache = metasDoBanco[unidadeAtivaEdicao?.toUpperCase()] || {};

    const salvarCampo = async (colunaNoBanco, valorDigitado) => {
        if (!podeEditarCampos) return;
        // Ativos do mês continuam sendo atualizados pela Movimentação (que já confere quem pode gravar)
        if (!podeEditarMetas && colunaNoBanco !== 'ativos_atual') return;

        const parseField = (val) => (val === '' || val === null || val === undefined) ? null : Number(val);
        const valorFinal = parseField(valorDigitado);

        const payload = {
            unidade: String(unidadeAtivaEdicao).toUpperCase(),
            mes: String(filtroMes),
            ano: String(filtroAno),
            [colunaNoBanco]: valorFinal
        };

        const { error } = await supabase
            .from('metas_unidades')
            .upsert(payload, { onConflict: 'unidade,mes,ano' });

        if (error) throw error;

        naoRecarregarCampos.current = true;
        setMetasDoBanco(prev => {
            const oldData = prev[payload.unidade] || {};
            return {
                ...prev,
                [payload.unidade]: { ...oldData, ...payload }
            };
        });
    };

    // ==========================================
    // GRAVAR O CARD INTEIRO (decisão do dono, 05/11/2026): um botão embaixo de cada card (Meta Start / Meta Mensal),
    // igual à Movimentação. Todos os campos do card são obrigatórios e a Meta Mensal precisa ser MAIOR que a Meta Start
    // (Nutri e Personal Class; Produto só existe na Start, Ativos e Plus só na Mensal). Se não estiver certo, abre a janela e NÃO grava.
    // ==========================================
    const [janelaMetas, setJanelaMetas] = useState(null); // { titulo, linhas: [], rodape }
    const [gravandoBloco, setGravandoBloco] = useState(null); // 'start' | 'mensal' | null
    const [gravadoBloco, setGravadoBloco] = useState(null);
    const vazio = (v) => v === '' || v === null || v === undefined;
    const camposStart = [
        { coluna: 'meta_nutri', rotulo: 'Nutri', valor: metaNutri },
        { coluna: 'meta_produtos', rotulo: 'Produto', valor: metaProdutos },
        ...(semPersonal ? [] : [{ coluna: 'meta_personal', rotulo: 'Personal Class', valor: metaPersonal }]),
    ];
    const camposMensal = [
        { coluna: 'meta_ativos_mensal', rotulo: 'Ativos Alvo', valor: metaAtivosMensal },
        { coluna: 'meta_nutri_mensal', rotulo: 'Nutri', valor: metaNutriMensal },
        { coluna: 'meta_plus_mensal', rotulo: 'Plus', valor: metaPlusMensal },
        ...(semPersonal ? [] : [{ coluna: 'meta_pers_mensal', rotulo: 'Personal Class', valor: metaPersMensal }]),
    ];
    const mudouBloco = (campos) => campos.some(c => String(c.valor ?? '') !== String(metaCache?.[c.coluna] ?? ''));
    // Pares Start x Mensal (o mesmo indicador nos dois cards)
    const paresStartMensal = [
        { rotulo: 'Nutri', start: metaNutri, mensal: metaNutriMensal },
        ...(semPersonal ? [] : [{ rotulo: 'Personal Class', start: metaPersonal, mensal: metaPersMensal }]),
    ];

    const gravarBloco = async (tipo) => {
        if (!podeEditarCampos || !podeEditarMetas || gravandoBloco) return;
        const campos = tipo === 'start' ? camposStart : camposMensal;
        const faltam = campos.filter(c => vazio(c.valor));
        if (faltam.length) {
            setJanelaMetas({
                titulo: tx('Falta preencher'),
                linhas: faltam.map(c => tx('Você precisa colocar a meta de {indicador}.', { indicador: tx(c.rotulo) })),
                rodape: tipo === 'start' ? tx('A Meta Start só é gravada com todos os campos preenchidos corretamente.') : tx('A Meta Mensal só é gravada com todos os campos preenchidos corretamente.'),
            });
            return;
        }
        // Meta Mensal tem que ser maior que a Meta Start (os dois zerados = sem meta, não confere)
        const errados = paresStartMensal.filter(p => !vazio(p.start) && !vazio(p.mensal) && !(Number(p.start) === 0 && Number(p.mensal) === 0) && Number(p.mensal) <= Number(p.start));
        if (errados.length) {
            setJanelaMetas({
                titulo: tx('Meta Mensal menor que a Meta Start'),
                linhas: errados.map(p => tx('{indicador}: a Meta Mensal ({mensal}) precisa ser maior que a Meta Start ({start}).', { indicador: tx(p.rotulo), mensal: p.mensal, start: p.start })),
                rodape: tx('A Meta Mensal paga a gratificação e sempre é maior que a Meta Start. Corrija os números antes de gravar.'),
            });
            return;
        }
        const payload = { unidade: String(unidadeAtivaEdicao).toUpperCase(), mes: String(filtroMes), ano: String(filtroAno) };
        campos.forEach(c => { payload[c.coluna] = Number(c.valor); });
        setGravandoBloco(tipo);
        const { error } = await supabase.from('metas_unidades').upsert(payload, { onConflict: 'unidade,mes,ano' });
        setGravandoBloco(null);
        if (error) {
            console.error('Metas: erro ao gravar', error);
            avisar(tx('Não foi possível gravar as metas: {erro}', { erro: error.message || '' }), 'erro');
            return;
        }
        naoRecarregarCampos.current = true;
        setMetasDoBanco(prev => ({ ...prev, [payload.unidade]: { ...(prev[payload.unidade] || {}), ...payload } }));
        setGravadoBloco(tipo); setTimeout(() => setGravadoBloco(null), 1800);
        avisar(tipo === 'start' ? tx('Meta Start gravada com sucesso!') : tx('Meta Mensal gravada com sucesso!'), 'sucesso');
    };
    const botaoGravarBloco = (tipo) => {
        if (!podeEditarMetas) return null;
        const mudou = mudouBloco(tipo === 'start' ? camposStart : camposMensal);
        const cor = tipo === 'start' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-500 hover:bg-amber-600';
        return (
            <button type="button" onClick={() => gravarBloco(tipo)} disabled={!mudou || !!gravandoBloco}
                className={`mt-5 w-full h-10 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${gravadoBloco === tipo ? 'bg-emerald-600 text-white' : mudou ? `${cor} text-white` : 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-500'}`}>
                {gravandoBloco === tipo ? <Loader2 className="w-4 h-4 animate-spin" /> : gravadoBloco === tipo ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {gravadoBloco === tipo ? tx('Gravado') : tipo === 'start' ? tx('Gravar Meta Start') : tx('Gravar Meta Mensal')}
            </button>
        );
    };

    // Ritmo das metas (precisa de X por dia, projeção, cor): só quando o período é um mês escolhido
    const mesRitmo = tipoFiltro === 'mes' && filtroMes && filtroMes !== 'TODOS' && filtroAno && filtroAno !== 'TODOS'
        ? infoDoMes(filtroAno, filtroMes) : null;
    const ritmoDe = (dados) => (mesRitmo ? avaliarMeta({ meta: dados.meta, vendido: dados.realizado, mes: mesRitmo }) : null);

    // Doses únicas: até 10 por unidade/mês contam na meta de produtos (com TODAS as vendas da unidade, sem filtro)
    const dosesValidas = useDosesValidas({ vendasCarregadas: vendasTodas, vendasDaTela: vendasFiltradas, unidade: temVisaoGlobal ? filtroUnidade : usuarioLogado?.unidade, planos, produtos });

    const listaUnidadesMetas = unidadesUnicas.filter(u => u !== 'TODOS' && (temVisaoGlobal ? true : u === usuarioLogado?.unidade));

    const dadosPorUnidade = listaUnidadesMetas.map(unidade => {
        const vendasDaUnidade = vendasFiltradas.filter(v => v.unidade === unidade);
        // Planos: contagem única (decomporPlano, decisão do dono 30/10/2026, sem data de corte).
        // Nutri = todo adicional Nutri (combos + PRATIQUE NUTRI) → mesmo conjunto de antes, valor da meta não muda.
        // Plus = todo plano com base Plus, inclusive PLUS + NUTRI e AFILIADOS PLUS + NUTRI. Personal = base Personal.
        const contagem = contarPlanosDoCard(vendasDaUnidade, planos, produtos);
        const nutriRealizado = contagem.nutri.total;
        const plusRealizado = contagem.grupos.PLUS.total;
        const personalRealizado = contagem.grupos['PERSONAL CLASS'].total;
        // Produto físico: cada item vendido, com o limite de doses únicas da unidade (limiteDoses.js)
        let produtosRealizado = 0;
        vendasDaUnidade.forEach(v => {
            if (getCategoriaItem(v.produto, planos, produtos) === 'PRODUTO') produtosRealizado += qtdValidaProduto(v, dosesValidas);
        });

        let metaUnidade = metasDoBanco[unidade.toUpperCase()] || {
            meta_nutri: 0, meta_produtos: 0, meta_personal: 0,
            meta_ativos_mensal: 0, meta_nutri_mensal: 0, meta_plus_mensal: 0, meta_pers_mensal: 0,
            ativos_atual: 0
        };
        if (semPersonalMapa[unidade.toUpperCase()]) metaUnidade = { ...metaUnidade, meta_personal: 0, meta_pers_mensal: 0 };

        return {
            unidade,
            start: {
                nutri: { meta: metaUnidade.meta_nutri, realizado: nutriRealizado, falta: Math.max(metaUnidade.meta_nutri - nutriRealizado, 0), batida: nutriRealizado >= metaUnidade.meta_nutri && metaUnidade.meta_nutri > 0 },
                produto: { meta: metaUnidade.meta_produtos, realizado: produtosRealizado, falta: Math.max(metaUnidade.meta_produtos - produtosRealizado, 0), batida: produtosRealizado >= metaUnidade.meta_produtos && metaUnidade.meta_produtos > 0 },
                personal: { meta: metaUnidade.meta_personal, realizado: personalRealizado, falta: Math.max(metaUnidade.meta_personal - personalRealizado, 0), batida: personalRealizado >= metaUnidade.meta_personal && metaUnidade.meta_personal > 0 }
            },
            mensal: {
                ativos: { meta: metaUnidade.meta_ativos_mensal, realizado: metaUnidade.ativos_atual, falta: Math.max(metaUnidade.meta_ativos_mensal - metaUnidade.ativos_atual, 0), batida: metaUnidade.ativos_atual >= metaUnidade.meta_ativos_mensal && metaUnidade.meta_ativos_mensal > 0 },
                nutri: { meta: metaUnidade.meta_nutri_mensal, realizado: nutriRealizado, falta: Math.max(metaUnidade.meta_nutri_mensal - nutriRealizado, 0), batida: nutriRealizado >= metaUnidade.meta_nutri_mensal && metaUnidade.meta_nutri_mensal > 0 },
                plus: { meta: metaUnidade.meta_plus_mensal, realizado: plusRealizado, falta: Math.max(metaUnidade.meta_plus_mensal - plusRealizado, 0), batida: plusRealizado >= metaUnidade.meta_plus_mensal && metaUnidade.meta_plus_mensal > 0 },
                personal: { meta: metaUnidade.meta_pers_mensal, realizado: personalRealizado, falta: Math.max(metaUnidade.meta_pers_mensal - personalRealizado, 0), batida: personalRealizado >= metaUnidade.meta_pers_mensal && metaUnidade.meta_pers_mensal > 0 }
            }
        };
    });

    const gerarMensagemMetaStart = (dados) => {
        const mesAtual = new Date().toLocaleString(locale || 'pt-BR', { month: 'long' }).toUpperCase();
        const { nutri, produto, personal } = dados.start;

        let txt = `✅ Meta Start - ${mesAtual} ✅\n\n`;
        const faltam = [];
        
        txt += `👉 Nutri: ${nutri.realizado} / ${nutri.meta} ${nutri.batida ? '🟢' : '🔴'}\n`;
        if (!nutri.batida && nutri.meta > 0) faltam.push(`❌ Falta ${nutri.falta} Nutri - para liberar gratificação`);

        txt += `👉 Produto: ${produto.realizado} / ${produto.meta} ${produto.batida ? '🟢' : '🔴'}\n`;
        if (!produto.batida && produto.meta > 0) faltam.push(`❌ Falta ${produto.falta} Produto - para liberar gratificação`);
        
        if (personal.meta > 0) {
            txt += `👉 Personal Class: ${personal.realizado} / ${personal.meta} ${personal.batida ? '🟢' : '🔴'}\n`;
            if (!personal.batida) faltam.push(`❌ Falta ${personal.falta} Class - para liberar gratificação`);
        }

        txt += `\n`;
        if (faltam.length > 0) {
            txt += faltam.join('\n');
        } else {
            txt += `🎉 PARABÉNS! Vocês bateram todas as metas Start! Gratificação da recepção liberada! 🚀`;
        }

        abrirModalWhatsapp(txt, { titulo: `Alerta: Meta Start ${dados.unidade}`, icone: 'target', cor: 'blue' });
    };

    const gerarMensagemMetaMensal = (dados) => {
        const mesAtual = new Date().toLocaleString(locale || 'pt-BR', { month: 'long' }).toUpperCase();
        const { nutri, plus, personal, ativos } = dados.mensal;
        
        let txt = `✅ Parcial de Metas do Mês de ${mesAtual} ✅\n\n`;
        const faltam = [];
        
        txt += `👉 Nutri: ${nutri.realizado} / ${nutri.meta} = R$ 50,00 ${nutri.batida ? '🟢' : '🔴'}\n`;
        if (!nutri.batida && nutri.meta > 0) faltam.push(`❌ Falta ${nutri.falta} Nutri - para vocês ganharem R$ 50,00 a mais na gratificação`);
        
        txt += `👉 Plus: ${plus.realizado} / ${plus.meta} = R$ 50,00 ${plus.batida ? '🟢' : '🔴'}\n`;
        if (!plus.batida && plus.meta > 0) faltam.push(`❌ Falta ${plus.falta} Plus - para vocês ganharem R$ 50,00 a mais na gratificação`);
        
        if (personal.meta > 0) {
            txt += `👉 Personal Class: ${personal.realizado} / ${personal.meta} = R$ 50,00 ${personal.batida ? '🟢' : '🔴'}\n`;
            if (!personal.batida) faltam.push(`❌ Falta ${personal.falta} Personal Class - para vocês ganharem R$ 50,00 a mais na gratificação`);
        }

        txt += `👉 Usuários: ${ativos.realizado} / ${ativos.meta} = R$ 50,00 ${ativos.batida ? '🟢' : '🔴'}\n`;
        if (!ativos.batida && ativos.meta > 0) faltam.push(`❌ Falta ${ativos.falta} Usuários - para vocês ganharem R$ 50,00 a mais na gratificação`);

        txt += `\n`;
        if (faltam.length > 0) {
            txt += faltam.join('\n');
        } else {
            txt += `🎉 PARABÉNS! Vocês bateram todas as metas e garantiram os R$ ${personal.meta > 0 ? 200 : 150},00 de gratificação extra! 🚀`;
        }

        abrirModalWhatsapp(txt, { titulo: `Alerta: Meta Mensal ${dados.unidade}`, icone: 'award', cor: 'emerald' });
    };

    return (
        <div className="space-y-6 animate-[fadeIn_0.2s_ease-out] pb-10 relative">
            
            {podeEditarCampos ? (
                <div className="mb-8 animate-[slideDown_0.3s_ease-out]">
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Movimentação primeiro (decisão do dono, 31/10/2026), depois Meta Start e Meta Mensal */}
                        <div className="flex flex-col bg-gradient-to-b from-emerald-50/50 to-white border border-emerald-100 rounded-[24px] p-6 shadow-sm h-full dark:border-emerald-500/30">
                            <div className="flex items-center gap-3 mb-2">
                                <Activity className="w-6 h-6 text-emerald-600 shrink-0 dark:text-emerald-400" />
                                <h3 className="text-lg font-black text-emerald-900 uppercase tracking-tight dark:text-emerald-300">{tx("Movimentação")}</h3>
                            </div>
                            <p className="text-xs font-medium text-slate-500 mb-6 leading-relaxed dark:text-slate-400">
                                {tx("Ativos atuais, entradas, cancelamentos e faturamento da unidade. Atualize diariamente.")}
                            </p>

                            <div className="space-y-3 flex-1">
                                {/* Ativos agora são lançados por dia, junto com a movimentação (um botão só; decisão do dono, 04/11/2026) */}
                                <MovimentacaoForm unidade={unidadeAtivaEdicao} diaPedido={diaPedido} entradas={entradasMovimento} usuarioLogado={usuarioLogado} aoGravar={movimento.recarregar}
                                    ativosMes={metaCache?.ativos_atual ?? (ativosAtual === "" ? null : ativosAtual)} aoGravarAtivos={async (val) => { setAtivosAtual(val); await salvarCampo('ativos_atual', val); }} />
                            </div>
                        </div>

                        
                        <div className="flex flex-col bg-gradient-to-b from-blue-50/50 to-white border border-blue-100 rounded-[24px] p-6 shadow-sm h-full dark:border-blue-500/30">
                            <div className="flex items-center gap-3 mb-2">
                                <Zap className="w-6 h-6 text-blue-600 shrink-0 dark:text-blue-400" />
                                <h3 className="text-lg font-black text-blue-900 uppercase tracking-tight dark:text-blue-300">{tx("META START")}</h3>
                                <span className="bg-blue-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest shrink-0">{tx("Primordial")}</span>
                                <span className="ml-auto text-[10px] font-black text-blue-700 uppercase tracking-widest shrink-0 dark:text-blue-300" title={tx("Mês em que estas metas valem")}>{rotuloMesMetas}</span>
                            </div>
                            <p className="text-xs font-medium text-slate-500 mb-6 leading-relaxed dark:text-slate-400">
                                {tx("Defina as metas iniciais da sua unidade.")}<br/>
                                <strong className="text-blue-700 dark:text-blue-400">{tx("Conclua todos os indicadores")}</strong>{' '}{tx("para liberar a gratificação.")}
                            </p>
                            {!podeEditarMetas && <p className="-mt-4 mb-4 text-[11px] font-bold text-slate-500 dark:text-slate-400">{tx("Você não tem permissão para gravar as metas (permissão 307).")}</p>}
                            
                            <div className="space-y-3 flex-1">
                                <InputFieldWithSave label={tx("Nutri")} description="Meta de planos Nutri" icon={Leaf} value={metaNutri} dbValue={metaCache?.meta_nutri} onChange={setMetaNutri} onSave={(val) => salvarCampo('meta_nutri', val)} theme="blue" somenteLeitura={!podeEditarMetas} semBotao />
                                <InputFieldWithSave label={tx("Produto")} description="Meta de produtos físicos" icon={Package} value={metaProdutos} dbValue={metaCache?.meta_produtos} onChange={setMetaProdutos} onSave={(val) => salvarCampo('meta_produtos', val)} theme="blue" somenteLeitura={!podeEditarMetas} semBotao />
                                {semPersonal ? <div className="flex items-center justify-between p-3 bg-slate-50 border border-dashed border-slate-300 rounded-2xl gap-3 dark:bg-slate-800/60 dark:border-slate-700">
                                        <div className="flex items-center gap-3 min-w-0"><div className="p-2 rounded-xl bg-white border border-slate-100 shrink-0 text-slate-400 dark:bg-slate-900 dark:border-slate-800"><Dumbbell className="w-5 h-5" /></div>
                                            <div className="min-w-0"><div className="text-[11px] font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">{tx("Personal Class")}</div><div className="text-[10px] font-bold text-rose-600 dark:text-rose-400">{tx("Esta unidade não tem Personal Class")}</div></div></div>
                                        {podeMarcarSemPersonal && <button type="button" onClick={() => marcarSemPersonal(false)} className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-1 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"><RotateCcw className="w-3.5 h-3.5" />{tx("Tem Personal")}</button>}
                                    </div> : (
                                    <div>
                                        <InputFieldWithSave label={tx("Personal Class")} subtitle="(Zerar p/ ocultar)" icon={Dumbbell} value={metaPersonal} dbValue={metaCache?.meta_personal} onChange={setMetaPersonal} onSave={(val) => salvarCampo('meta_personal', val)} theme="blue" somenteLeitura={!podeEditarMetas} semBotao />
                                        {podeMarcarSemPersonal && <button type="button" onClick={() => marcarSemPersonal(true)} className="mt-1 ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-rose-600 flex items-center gap-1 dark:text-slate-400"><XCircle className="w-3.5 h-3.5" />{tx("Não tem Personal Class")}</button>}
                                    </div>
                                )}
                            </div>

                            {botaoGravarBloco('start')}
                            <button type="button" onClick={() => setHistoricoAberto('start')} className="mt-3 w-full h-10 rounded-xl border border-blue-200 bg-white text-blue-700 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-50 dark:bg-slate-900 dark:border-blue-500/30 dark:text-blue-300 dark:hover:bg-blue-500/10">
                                <History className="w-4 h-4" />{tx("Ver metas anteriores")}
                            </button>
                            <div className="mt-3 bg-blue-50/80 border border-blue-100 rounded-xl p-4 flex items-center gap-3 shadow-sm dark:bg-blue-500/10 dark:border-blue-500/30">
                                <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center shrink-0">
                                    <Trophy className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col">
                                    <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest dark:text-blue-300">{tx("Gratificação Start")}</p>
                                    <p className="text-[10px] font-medium text-blue-600 mt-0.5 leading-snug dark:text-blue-400">{tx("Conclua todas as metas para liberar a gratificação.")}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col bg-gradient-to-b from-amber-50/50 to-white border border-amber-100 rounded-[24px] p-6 shadow-sm h-full dark:border-amber-500/30">
                            <div className="flex items-center gap-3 mb-2">
                                <Award className="w-6 h-6 text-amber-500 shrink-0" />
                                <h3 className="text-lg font-black text-amber-900 uppercase tracking-tight dark:text-amber-300">{tx("META MENSAL")}</h3>
                                <span className="bg-amber-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest shrink-0">R$ {indicadoresMensal * 50}</span>
                                <span className="ml-auto text-[10px] font-black text-amber-700 uppercase tracking-widest shrink-0 dark:text-amber-300" title={tx("Mês em que estas metas valem")}>{rotuloMesMetas}</span>
                            </div>
                            <p className="text-xs font-medium text-slate-500 mb-6 leading-relaxed dark:text-slate-400">
                                {tx("Defina as metas mensais da sua unidade.")}<br/>
                                {tx("Cada indicador concluído representa")}{' '}<strong className="text-amber-600 dark:text-amber-400">{tx("R$ 50 de gratificação")}</strong>.
                            </p>
                            
                            <div className="space-y-3 flex-1">
                                <InputFieldWithSave label={tx("Ativos Alvo")} description="Objetivo de alunos ativos" icon={Users} value={metaAtivosMensal} dbValue={metaCache?.meta_ativos_mensal} onChange={setMetaAtivosMensal} onSave={(val) => salvarCampo('meta_ativos_mensal', val)} theme="amber" somenteLeitura={!podeEditarMetas} semBotao />
                                <InputFieldWithSave label={tx("Nutri")} description="Meta mensal Nutri" icon={Leaf} value={metaNutriMensal} dbValue={metaCache?.meta_nutri_mensal} onChange={setMetaNutriMensal} onSave={(val) => salvarCampo('meta_nutri_mensal', val)} theme="amber" somenteLeitura={!podeEditarMetas} semBotao />
                                <InputFieldWithSave label={tx("Plus")} description="Meta mensal Plus" icon={Star} value={metaPlusMensal} dbValue={metaCache?.meta_plus_mensal} onChange={setMetaPlusMensal} onSave={(val) => salvarCampo('meta_plus_mensal', val)} theme="amber" somenteLeitura={!podeEditarMetas} semBotao />
                                {semPersonal ? <div className="flex items-center justify-between p-3 bg-slate-50 border border-dashed border-slate-300 rounded-2xl gap-3 dark:bg-slate-800/60 dark:border-slate-700">
                                        <div className="flex items-center gap-3 min-w-0"><div className="p-2 rounded-xl bg-white border border-slate-100 shrink-0 text-slate-400 dark:bg-slate-900 dark:border-slate-800"><Dumbbell className="w-5 h-5" /></div>
                                            <div className="min-w-0"><div className="text-[11px] font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">{tx("Personal Class")}</div><div className="text-[10px] font-bold text-rose-600 dark:text-rose-400">{tx("Esta unidade não tem Personal Class")}</div></div></div>
                                        {podeMarcarSemPersonal && <button type="button" onClick={() => marcarSemPersonal(false)} className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-1 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"><RotateCcw className="w-3.5 h-3.5" />{tx("Tem Personal")}</button>}
                                    </div> : (
                                    <div>
                                        <InputFieldWithSave label={tx("Personal Class")} subtitle="(Zerar p/ ocultar)" description="Meta mensal Personal" icon={Dumbbell} value={metaPersMensal} dbValue={metaCache?.meta_pers_mensal} onChange={setMetaPersMensal} onSave={(val) => salvarCampo('meta_pers_mensal', val)} theme="amber" somenteLeitura={!podeEditarMetas} semBotao />
                                        {podeMarcarSemPersonal && <button type="button" onClick={() => marcarSemPersonal(true)} className="mt-1 ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-rose-600 flex items-center gap-1 dark:text-slate-400"><XCircle className="w-3.5 h-3.5" />{tx("Não tem Personal Class")}</button>}
                                    </div>
                                )}
                            </div>

                            {botaoGravarBloco('mensal')}
                            <button type="button" onClick={() => setHistoricoAberto('mensal')} className="mt-3 w-full h-10 rounded-xl border border-amber-200 bg-white text-amber-700 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-amber-50 dark:bg-slate-900 dark:border-amber-500/30 dark:text-amber-300 dark:hover:bg-amber-500/10">
                                <History className="w-4 h-4" />{tx("Ver metas anteriores")}
                            </button>
                            <div className="mt-3 pt-4 border-t border-slate-200/80 flex flex-col items-center justify-center text-center dark:border-slate-800">
                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest dark:text-amber-400">{tx("R$ {valor} de Gratificação", { valor: indicadoresMensal * 50 })}</p>
                                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{tx("{n} indicadores • R$ 50 cada meta concluída", { n: indicadoresMensal })}</p>
                            </div>
                        </div>


                    </div>
                </div>
            ) : podeFazer(usuarioLogado, '310') ? (
                // Admin/Mentor em "Todas": monitoramento de quem lançou a movimentação (decisão do dono, 31/10/2026)
                <MonitorMovimentacao unidades={unidadesUnicas.filter(u => u && u !== 'TODOS')} faixa={faixa} vendasFiltradas={vendasFiltradas} planos={planos} produtos={produtos} abrirModalWhatsapp={abrirModalWhatsapp} usuario={usuarioLogado} />
            ) : (
                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center text-center mb-8 dark:bg-slate-900 dark:border-slate-800">
                    <div className="w-20 h-20 bg-slate-50 border border-slate-200 rounded-[20px] flex items-center justify-center mb-6 shadow-sm dark:bg-slate-800/60 dark:border-slate-800">
                        <Target className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight dark:text-white">{tx("Painel de Configuração Oculto")}</h3>
                    <p className="text-sm font-medium text-slate-500 mt-2 max-w-md mx-auto dark:text-slate-400">{tx("Para definir os objetivos e atualizar os ativos, selecione uma unidade específica no filtro global.")}</p>
                </div>
            )}

            {janelaMetas && (
                <JanelaMovimento titulo={janelaMetas.titulo} fechar={() => setJanelaMetas(null)}
                    botoes={[{ texto: tx('Entendi, vou corrigir'), principal: true, acao: () => setJanelaMetas(null) }]}>
                    <ul className="space-y-2">{janelaMetas.linhas.map((l, i) => <li key={i}>👉 {l}</li>)}</ul>
                    <p className="mt-4 text-[14px] text-slate-500 dark:text-slate-400">{janelaMetas.rodape}</p>
                </JanelaMovimento>
            )}

            {historicoAberto && podeEditarCampos && (
                <HistoricoMetas unidade={unidadeAtivaEdicao} tipo={historicoAberto} planos={planos} produtos={produtos} fechar={() => setHistoricoAberto(null)} />
            )}

            {/* Movimentação por dia: valor do dia (diferença dos acumulados) e acumulado do mês */}
            <MovimentoDiarioPainel unidade={unidadeAtivaEdicao} faixa={faixa} movimento={movimento} entradas={entradasMovimento} podeEditar={podeEditarCampos && podeGravarMovimento(usuarioLogado)} aoEditarDia={editarDiaMovimento} />

            {dadosPorUnidade.map((item, index) => (
                <div key={index} className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden flex flex-col mb-8 animate-[slideDown_0.3s_ease-out] dark:bg-slate-900 dark:border-slate-800">
                    
                    <div className="bg-slate-900 px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-5 border-b border-slate-800">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 shadow-inner">
                                <Building2 className="w-6 h-6 text-slate-300" />
                            </div>
                            <div className="flex flex-col">
                                <h4 className="text-xl font-black text-white tracking-tight uppercase">{item.unidade}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tx("Performance de Metas")}</span>
                                    <span className="text-slate-600 dark:text-slate-300">•</span>
                                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{String(filtroMes).padStart(2, '0')}/{filtroAno}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <button 
                                onClick={() => gerarMensagemMetaStart(item)} 
                                className="px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 focus:ring-2 focus:ring-blue-500/50 shadow-sm"
                            >
                                <Share2 className="w-4 h-4" />{' '}{tx("Compartilhar Start")}
                            </button>
                            <button 
                                onClick={() => gerarMensagemMetaMensal(item)} 
                                className="px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 focus:ring-2 focus:ring-amber-500/50 shadow-sm"
                            >
                                <Share2 className="w-4 h-4" />{' '}{tx("Compartilhar Mensal")}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                        
                        <div className="p-6 md:p-8 bg-slate-50/40 dark:bg-slate-800/40">
                            <div className="mb-6 flex flex-col">
                                <h5 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 dark:text-white">
                                    <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400"/>{' '}{tx("META START")}
                                </h5>
                                <p className="text-xs font-medium text-slate-500 mt-1 dark:text-slate-400">{tx("Conclua todos os indicadores para liberar a gratificação.")}</p>
                            </div>
                            
                            <div className="flex flex-col gap-4">
                                <MetaItemCard label={tx("NUTRI")} dados={item.start.nutri} corTema="bg-blue-500" ritmo={ritmoDe(item.start.nutri)} mes={mesRitmo} />
                                <MetaItemCard label={tx("PRODUTO")} dados={item.start.produto} corTema="bg-blue-500" ritmo={ritmoDe(item.start.produto)} mes={mesRitmo} />
                                {item.start.personal.meta > 0 && (
                                    <MetaItemCard label={tx("PERSONAL CLASS")} dados={item.start.personal} corTema="bg-blue-500" ritmo={ritmoDe(item.start.personal)} mes={mesRitmo} />
                                )}
                            </div>
                        </div>

                        <div className="p-6 md:p-8 bg-amber-50/10 dark:bg-amber-500/10">
                            <div className="mb-6 flex flex-col">
                                <h5 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 dark:text-white">
                                    <Award className="w-5 h-5 text-amber-500"/>{' '}{tx("META MENSAL")}
                                </h5>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded uppercase tracking-widest dark:bg-amber-500/20 dark:text-amber-400">{tx("R$ {valor} de gratificação", { valor: item.mensal.personal.meta > 0 ? 200 : 150 })}</span>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{tx("R$ 50 por indicador concluído.")}</span>
                                </div>
                            </div>
                            
                            <div className="flex flex-col gap-4">
                                <MetaItemCard label={tx("ATIVOS")} dados={item.mensal.ativos} corTema="bg-amber-400" recompensa="R$ 50" />
                                <MetaItemCard label={tx("NUTRI")} dados={item.mensal.nutri} corTema="bg-amber-400" recompensa="R$ 50" ritmo={ritmoDe(item.mensal.nutri)} mes={mesRitmo} />
                                <MetaItemCard label="PLUS" dados={item.mensal.plus} corTema="bg-amber-400" recompensa="R$ 50" ritmo={ritmoDe(item.mensal.plus)} mes={mesRitmo} />
                                {item.mensal.personal.meta > 0 && (
                                    <MetaItemCard label={tx("PERSONAL CLASS")} dados={item.mensal.personal} corTema="bg-amber-400" recompensa="R$ 50" ritmo={ritmoDe(item.mensal.personal)} mes={mesRitmo} />
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            ))}
        </div>
    );
};

export default MetasTab;