import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import { getCategoriaItem } from './utils.js';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { Target, Activity, Share2, Award, Zap, Loader2, Save, Check, Building2, CheckCircle2, AlertCircle, Clock, Leaf, Package, Dumbbell, Users, Star, Trophy, TrendingUp, Info } from 'lucide-react';

// ==========================================
// 🧠 COMPONENTE REUTILIZÁVEL: Input com Auto-Save (CORRIGIDO)
// ==========================================
const InputFieldWithSave = ({ label, description, subtitle, icon: Icon, value, dbValue, onChange, onSave, theme = 'blue', large = false }) => {
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
            alert("Erro ao gravar. Verifique sua conexão.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (e) => {
        const val = e.target.value;
        onChange(val === '' ? '' : Number(val));
    };

    const styles = {
        blue: { ring: 'focus:ring-blue-500', btn: 'bg-blue-600 hover:bg-blue-700 text-white', iconTxt: 'text-blue-600' },
        amber: { ring: 'focus:ring-amber-500', btn: 'bg-amber-500 hover:bg-amber-600 text-white', iconTxt: 'text-amber-500' },
        emerald: { ring: 'focus:ring-emerald-500', btn: 'bg-emerald-600 hover:bg-emerald-700 text-white', iconTxt: 'text-emerald-600' }
    }[theme];

    if (large) {
        return (
            <div className="flex items-center justify-center gap-3 w-full my-2">
                <input
                    type="number"
                    value={value}
                    onChange={handleChange}
                    className="w-[200px] h-[72px] bg-white border-2 border-emerald-400 rounded-xl text-4xl font-black text-emerald-700 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 text-center shadow-sm transition-all"
                />
                <button
                    onClick={handleSave}
                    disabled={!hasChanged || isSaving}
                    title={!hasChanged ? "Sem alterações pendentes" : "Salvar esta meta"}
                    className={`w-16 h-[72px] rounded-xl transition-all flex items-center justify-center shrink-0 shadow-sm border border-transparent
                        ${!hasChanged ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-600 hover:text-white'}
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
        <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-2xl shadow-sm gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                {Icon && (
                    <div className={`p-2 rounded-xl bg-slate-50 border border-slate-100 shrink-0 ${styles.iconTxt}`}>
                        <Icon className="w-5 h-5" />
                    </div>
                )}
                <div className="flex flex-col min-w-0">
                    <div className="text-[11px] font-black text-slate-800 uppercase tracking-widest truncate">
                        {label}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                        {subtitle && <span className="text-rose-500 text-[9px] font-bold shrink-0">{subtitle}</span>}
                        {description && <span className="text-[10px] font-medium text-slate-400 truncate">{description}</span>}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <input
                    type="number"
                    value={value}
                    onChange={handleChange}
                    className={`w-[72px] h-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-800 outline-none focus:bg-white focus:ring-4 ${styles.ring} text-center transition-all`}
                />
                <button
                    onClick={handleSave}
                    disabled={!hasChanged || isSaving}
                    title={!hasChanged ? "Sem alterações pendentes" : "Salvar esta meta"}
                    className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center shrink-0 border border-transparent
                        ${!hasChanged ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : `${styles.btn} border-current border-opacity-20`}
                        ${isSaving ? 'opacity-70 cursor-wait' : ''}
                        ${showSuccess ? '!bg-emerald-500 !text-white !border-emerald-600 scale-105 shadow-md' : ''}
                    `}
                >
                    {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : 
                     showSuccess ? <Check className="w-4 h-4" /> : 
                     <Save className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );
};

// ==========================================
// 🚀 NOVO DESIGN CIRÚRGICO: MetaItemCard PREMIUM
// ==========================================
const MetaItemCard = ({ label, dados, corTema, recompensa }) => {
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
        statusColor = "text-emerald-600";
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
    const bgCard = isBatida ? 'bg-emerald-50/40 border-emerald-200' : 'bg-white border-slate-200 hover:border-slate-300';
    const corPercentual = isBatida ? 'text-emerald-600' : 'text-slate-800';

    return (
        <div className={`p-5 rounded-2xl border ${bgCard} transition-colors duration-300 relative overflow-hidden group shadow-sm hover:shadow-md flex flex-col justify-between`}>
            
            {/* NÍVEL 1 & 2: HIERARQUIA VISUAL DOS NÚMEROS */}
            <div className="flex justify-between items-start mb-3">
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-800 uppercase tracking-wide">{label}</span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-xl font-black text-slate-800 leading-none">{realizadoVal}</span>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest"> / {metaVal}</span>
                    </div>
                </div>
                <div className="text-right">
                    <span className={`text-3xl font-black tracking-tighter ${corPercentual}`}>
                        {perc.toFixed(0)}%
                    </span>
                </div>
            </div>

            {/* NÍVEL 3: BARRA DE PROGRESSO */}
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-4 border border-slate-200/50">
                <div 
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${corBarra}`} 
                    style={{ width: `${perc}%` }}
                />
            </div>

            {/* NÍVEL 4 & 5: FALTANTE E STATUS/RECOMPENSA */}
            <div className="flex justify-between items-center mt-auto">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                    {isBatida ? (
                        <span className="flex items-center gap-1.5 text-emerald-600 bg-emerald-100/60 px-2.5 py-1 rounded-md border border-emerald-200/50 uppercase font-black tracking-widest text-[9px]">
                            <StatusIcon className="w-3.5 h-3.5" /> {statusText}
                        </span>
                    ) : (
                        <>
                            <span className="text-slate-500 uppercase tracking-widest text-[9px] font-black">Faltam</span>
                            <strong className="text-slate-800 font-black text-sm">{faltaVal}</strong>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {!isBatida && (
                        <span className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-widest ${statusColor}`}>
                            <StatusIcon className="w-3.5 h-3.5" /> {statusText}
                        </span>
                    )}
                    {recompensa && !isBatida && (
                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider bg-amber-50 px-2 py-1 rounded-md border border-amber-100 ml-1 shadow-sm">
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
    ativosAtual, setAtivosAtual, planos, produtos, abrirModalWhatsapp
}) => {
    const { locale } = useI18n();
    const [metasDoBanco, setMetasDoBanco] = useState({});

    const unidadeAtivaEdicao = temVisaoGlobal ? filtroUnidade : usuarioLogado?.unidade;
    const podeEditarCampos = unidadeAtivaEdicao && unidadeAtivaEdicao !== 'TODOS';

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

    useEffect(() => {
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

        setMetasDoBanco(prev => {
            const oldData = prev[payload.unidade] || {};
            return {
                ...prev,
                [payload.unidade]: { ...oldData, ...payload }
            };
        });
    };

    const listaUnidadesMetas = unidadesUnicas.filter(u => u !== 'TODOS' && (temVisaoGlobal ? true : u === usuarioLogado?.unidade));

    const dadosPorUnidade = listaUnidadesMetas.map(unidade => {
        const vendasDaUnidade = vendasFiltradas.filter(v => v.unidade === unidade);
        let nutriRealizado = 0, produtosRealizado = 0, personalRealizado = 0, plusRealizado = 0;

        vendasDaUnidade.forEach(v => {
            const qtd = parseInt(v.quantidade) || 1;
            const prodUpper = (v.produto || '').toUpperCase();
            const cat = getCategoriaItem(prodUpper, planos, produtos);

            if (cat === 'PLANO') {
                if (prodUpper.includes("NUTRI")) nutriRealizado += qtd;
                else if (prodUpper.includes("PERSONAL")) personalRealizado += qtd;
                else if (prodUpper.includes("PLUS") || prodUpper.includes("AFL")) plusRealizado += qtd;
            } else if (cat === 'PRODUTO') {
                produtosRealizado += qtd;
            }
        });

        const metaUnidade = metasDoBanco[unidade.toUpperCase()] || {
            meta_nutri: 0, meta_produtos: 0, meta_personal: 0,
            meta_ativos_mensal: 0, meta_nutri_mensal: 0, meta_plus_mensal: 0, meta_pers_mensal: 0,
            ativos_atual: 0
        };

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
            txt += `🎉 PARABÉNS! Vocês bateram todas as metas e garantiram os R$ 200,00 de gratificação extra! 🚀`;
        }

        abrirModalWhatsapp(txt, { titulo: `Alerta: Meta Mensal ${dados.unidade}`, icone: 'award', cor: 'emerald' });
    };

    return (
        <div className="space-y-6 animate-[fadeIn_0.2s_ease-out] pb-10 relative">
            
            {podeEditarCampos ? (
                <div className="mb-8 animate-[slideDown_0.3s_ease-out]">
                    
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white rounded-[24px] border border-slate-200 shadow-sm p-5 mb-6 gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
                                <Target className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">Configuração das Metas</h2>
                                <p className="text-xs font-medium text-slate-500 mt-0.5">
                                    <strong className="text-slate-800 uppercase">{unidadeAtivaEdicao}</strong> • Defina os objetivos da sua unidade
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl w-full lg:w-auto">
                            <div className="text-blue-600 shrink-0"><Zap className="w-5 h-5" /></div>
                            <div className="flex flex-col">
                                <span className="text-[11px] font-black text-blue-700 uppercase tracking-widest">Modo de Edição Rápida Ativo</span>
                                <span className="text-[10px] font-medium text-slate-500">Faça alterações e salve individualmente</span>
                            </div>
                            <div className="ml-auto lg:ml-2 w-10 h-6 bg-emerald-400 rounded-full flex items-center justify-end px-1 shadow-inner shrink-0">
                                <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        <div className="flex flex-col bg-gradient-to-b from-blue-50/50 to-white border border-blue-100 rounded-[24px] p-6 shadow-sm h-full">
                            <div className="flex items-center gap-3 mb-2">
                                <Zap className="w-6 h-6 text-blue-600 shrink-0" />
                                <h3 className="text-lg font-black text-blue-900 uppercase tracking-tight">META START</h3>
                                <span className="bg-blue-600 text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest shrink-0">Primordial</span>
                            </div>
                            <p className="text-xs font-medium text-slate-500 mb-6 leading-relaxed">
                                Defina as metas iniciais da sua unidade.<br/>
                                <strong className="text-blue-700">Conclua todos os indicadores</strong> para liberar a gratificação.
                            </p>
                            
                            <div className="space-y-3 flex-1">
                                <InputFieldWithSave label="Nutri" description="Meta de planos Nutri" icon={Leaf} value={metaNutri} dbValue={metaCache?.meta_nutri} onChange={setMetaNutri} onSave={(val) => salvarCampo('meta_nutri', val)} theme="blue" />
                                <InputFieldWithSave label="Produto" description="Meta de produtos físicos" icon={Package} value={metaProdutos} dbValue={metaCache?.meta_produtos} onChange={setMetaProdutos} onSave={(val) => salvarCampo('meta_produtos', val)} theme="blue" />
                                <InputFieldWithSave label="Personal Class" subtitle="(Zerar p/ ocultar)" icon={Dumbbell} value={metaPersonal} dbValue={metaCache?.meta_personal} onChange={setMetaPersonal} onSave={(val) => salvarCampo('meta_personal', val)} theme="blue" />
                            </div>

                            <div className="mt-5 bg-blue-50/80 border border-blue-100 rounded-xl p-4 flex items-center gap-3 shadow-sm">
                                <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center shrink-0">
                                    <Trophy className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col">
                                    <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Gratificação Start</p>
                                    <p className="text-[10px] font-medium text-blue-600 mt-0.5 leading-snug">Conclua todas as metas para liberar a gratificação.</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col bg-gradient-to-b from-amber-50/50 to-white border border-amber-100 rounded-[24px] p-6 shadow-sm h-full">
                            <div className="flex items-center gap-3 mb-2">
                                <Award className="w-6 h-6 text-amber-500 shrink-0" />
                                <h3 className="text-lg font-black text-amber-900 uppercase tracking-tight">META MENSAL</h3>
                                <span className="bg-amber-500 text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest shrink-0">R$ 200</span>
                            </div>
                            <p className="text-xs font-medium text-slate-500 mb-6 leading-relaxed">
                                Defina as metas mensais da sua unidade.<br/>
                                Cada indicador concluído representa <strong className="text-amber-600">R$ 50 de gratificação</strong>.
                            </p>
                            
                            <div className="space-y-3 flex-1">
                                <InputFieldWithSave label="Ativos Alvo" description="Objetivo de alunos ativos" icon={Users} value={metaAtivosMensal} dbValue={metaCache?.meta_ativos_mensal} onChange={setMetaAtivosMensal} onSave={(val) => salvarCampo('meta_ativos_mensal', val)} theme="amber" />
                                <InputFieldWithSave label="Nutri" description="Meta mensal Nutri" icon={Leaf} value={metaNutriMensal} dbValue={metaCache?.meta_nutri_mensal} onChange={setMetaNutriMensal} onSave={(val) => salvarCampo('meta_nutri_mensal', val)} theme="amber" />
                                <InputFieldWithSave label="Plus" description="Meta mensal Plus" icon={Star} value={metaPlusMensal} dbValue={metaCache?.meta_plus_mensal} onChange={setMetaPlusMensal} onSave={(val) => salvarCampo('meta_plus_mensal', val)} theme="amber" />
                                <InputFieldWithSave label="Personal Class" subtitle="(Zerar p/ ocultar)" description="Meta mensal Personal" icon={Dumbbell} value={metaPersMensal} dbValue={metaCache?.meta_pers_mensal} onChange={setMetaPersMensal} onSave={(val) => salvarCampo('meta_pers_mensal', val)} theme="amber" />
                            </div>

                            <div className="mt-5 pt-5 border-t border-slate-200/80 flex flex-col items-center justify-center text-center">
                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">R$ 200 de Gratificação</p>
                                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">4 indicadores • R$ 50 cada meta concluída</p>
                            </div>
                        </div>

                        <div className="flex flex-col bg-gradient-to-b from-emerald-50/50 to-white border border-emerald-100 rounded-[24px] p-6 shadow-sm h-full">
                            <div className="flex items-center gap-3 mb-2">
                                <Activity className="w-6 h-6 text-emerald-600 shrink-0" />
                                <h3 className="text-lg font-black text-emerald-900 uppercase tracking-tight">Qtd. Ativos Atual</h3>
                            </div>
                            <p className="text-xs font-medium text-slate-500 mb-6 leading-relaxed">
                                Atualize diariamente a quantidade de alunos ativos da unidade.
                            </p>
                            
                            <div className="flex-1 flex flex-col items-center justify-center">
                                <InputFieldWithSave large={true} value={ativosAtual} dbValue={metaCache?.ativos_atual} onChange={setAtivosAtual} onSave={(val) => salvarCampo('ativos_atual', val)} theme="emerald" />
                                
                                <div className="mt-8 w-full space-y-3">
                                    <div className="bg-emerald-50/80 border border-emerald-100 rounded-2xl p-4 flex gap-3 shadow-sm">
                                        <Activity className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                                        <div className="flex flex-col">
                                            <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Controle Diário</p>
                                            <p className="text-[10px] font-medium text-emerald-700 mt-1 leading-snug">Mantenha este valor atualizado para um acompanhamento preciso.</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-start gap-2.5 px-2">
                                        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                                        <div className="flex flex-col">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Dica</p>
                                            <p className="text-[9px] font-medium text-slate-400 mt-0.5 leading-snug">Atualize sempre que houver mudanças significativas na base.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center text-center mb-8">
                    <div className="w-20 h-20 bg-slate-50 border border-slate-200 rounded-[20px] flex items-center justify-center mb-6 shadow-sm">
                        <Target className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Painel de Configuração Oculto</h3>
                    <p className="text-sm font-medium text-slate-500 mt-2 max-w-md mx-auto">Para definir os objetivos e atualizar os ativos, selecione uma unidade específica no filtro global.</p>
                </div>
            )}

            {dadosPorUnidade.map((item, index) => (
                <div key={index} className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden flex flex-col mb-8 animate-[slideDown_0.3s_ease-out]">
                    
                    <div className="bg-slate-900 px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-5 border-b border-slate-800">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 shadow-inner">
                                <Building2 className="w-6 h-6 text-slate-300" />
                            </div>
                            <div className="flex flex-col">
                                <h4 className="text-xl font-black text-white tracking-tight uppercase">{item.unidade}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Performance de Metas</span>
                                    <span className="text-slate-600">•</span>
                                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{String(filtroMes).padStart(2, '0')}/{filtroAno}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <button 
                                onClick={() => gerarMensagemMetaStart(item)} 
                                className="px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 focus:ring-2 focus:ring-blue-500/50 shadow-sm"
                            >
                                <Share2 className="w-4 h-4" /> Compartilhar Start
                            </button>
                            <button 
                                onClick={() => gerarMensagemMetaMensal(item)} 
                                className="px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 focus:ring-2 focus:ring-amber-500/50 shadow-sm"
                            >
                                <Share2 className="w-4 h-4" /> Compartilhar Mensal
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 bg-white">
                        
                        <div className="p-6 md:p-8 bg-slate-50/40">
                            <div className="mb-6 flex flex-col">
                                <h5 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                    <Zap className="w-5 h-5 text-blue-600"/> META START
                                </h5>
                                <p className="text-xs font-medium text-slate-500 mt-1">Conclua todos os indicadores para liberar a gratificação.</p>
                            </div>
                            
                            <div className="flex flex-col gap-4">
                                <MetaItemCard label="NUTRI" dados={item.start.nutri} corTema="bg-blue-500" />
                                <MetaItemCard label="PRODUTO" dados={item.start.produto} corTema="bg-blue-500" />
                                {item.start.personal.meta > 0 && (
                                    <MetaItemCard label="PERSONAL CLASS" dados={item.start.personal} corTema="bg-blue-500" />
                                )}
                            </div>
                        </div>

                        <div className="p-6 md:p-8 bg-amber-50/10">
                            <div className="mb-6 flex flex-col">
                                <h5 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                    <Award className="w-5 h-5 text-amber-500"/> META MENSAL
                                </h5>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded uppercase tracking-widest">R$ 200 de gratificação</span>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-xs font-medium text-slate-500">R$ 50 por indicador concluído.</span>
                                </div>
                            </div>
                            
                            <div className="flex flex-col gap-4">
                                <MetaItemCard label="ATIVOS" dados={item.mensal.ativos} corTema="bg-amber-400" recompensa="R$ 50" />
                                <MetaItemCard label="NUTRI" dados={item.mensal.nutri} corTema="bg-amber-400" recompensa="R$ 50" />
                                <MetaItemCard label="PLUS" dados={item.mensal.plus} corTema="bg-amber-400" recompensa="R$ 50" />
                                {item.mensal.personal.meta > 0 && (
                                    <MetaItemCard label="PERSONAL CLASS" dados={item.mensal.personal} corTema="bg-amber-400" recompensa="R$ 50" />
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