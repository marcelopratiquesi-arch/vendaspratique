import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import { getCategoriaItem } from './utils.js';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { Target, Activity, Share2, Award, Zap } from 'lucide-react';

const MetasTab = ({
    temVisaoGlobal, filtroUnidade, filtroMes, filtroAno, vendasFiltradas, unidadesUnicas, usuarioLogado,
    metaNutri, setMetaNutri, metaProdutos, setMetaProdutos, metaPersonal, setMetaPersonal,
    metaAtivosMensal, setMetaAtivosMensal, metaNutriMensal, setMetaNutriMensal, metaPlusMensal, setMetaPlusMensal, metaPersMensal, setMetaPersMensal,
    ativosAtual, setAtivosAtual, salvarMetasNuvem, isSalvandoMetas, planos, produtos, abrirModalWhatsapp
}) => {
    const { locale } = useI18n();
    const [metasDoBanco, setMetasDoBanco] = useState({});

    // 🔥 O SEGREDO: O MetasTab baixa as metas direto do banco, isolando os Cards do Formulário.
    useEffect(() => {
        const buscarMetas = async () => {
            const { data } = await supabase
                .from('metas_unidades')
                .select('*')
                .eq('mes', filtroMes)
                .eq('ano', filtroAno);
            
            if (data) {
                const dicionario = {};
                data.forEach(linha => {
                    dicionario[linha.unidade.toUpperCase()] = linha;
                });
                setMetasDoBanco(dicionario);
            }
        };
        buscarMetas();
    }, [filtroMes, filtroAno, isSalvandoMetas]); // Recarrega sempre que o botão Salvar terminar de girar.

    const podeEditar = !temVisaoGlobal || filtroUnidade !== 'TODOS';
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

        // 🧠 A MÁGICA DE ISOLAMENTO
        // Pega as metas específicas da Unidade lidas no Banco de Dados
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
        
        if (nutri.meta > 0) {
            txt += `👉 Nutri: ${nutri.realizado} / ${nutri.meta} ${nutri.batida ? '🟢' : '🔴'}\n`;
            if (!nutri.batida) faltam.push(`❌ Falta ${nutri.falta} Nutri - para liberar gratificação`);
        }
        if (produto.meta > 0) {
            txt += `👉 Produto: ${produto.realizado} / ${produto.meta} ${produto.batida ? '🟢' : '🔴'}\n`;
            if (!produto.batida) faltam.push(`❌ Falta ${produto.falta} Produto - para liberar gratificação`);
        }
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
        
        if (nutri.meta > 0) {
            txt += `👉 Nutri: ${nutri.realizado} / ${nutri.meta} = R$ 50,00 ${nutri.batida ? '🟢' : '🔴'}\n`;
            if (!nutri.batida) faltam.push(`❌ Falta ${nutri.falta} Nutri - para vocês ganharem R$ 50,00 a mais na gratificação`);
        }
        if (plus.meta > 0) {
            txt += `👉 Plus: ${plus.realizado} / ${plus.meta} = R$ 50,00 ${plus.batida ? '🟢' : '🔴'}\n`;
            if (!plus.batida) faltam.push(`❌ Falta ${plus.falta} Plus - para vocês ganharem R$ 50,00 a mais na gratificação`);
        }
        if (personal.meta > 0) {
            txt += `👉 Personal Class: ${personal.realizado} / ${personal.meta} = R$ 50,00 ${personal.batida ? '🟢' : '🔴'}\n`;
            if (!personal.batida) faltam.push(`❌ Falta ${personal.falta} Personal Class - para vocês ganharem R$ 50,00 a mais na gratificação`);
        }
        if (ativos.meta > 0) {
            txt += `👉 Usuários: ${ativos.realizado} / ${ativos.meta} = R$ 50,00 ${ativos.batida ? '🟢' : '🔴'}\n`;
            if (!ativos.batida) faltam.push(`❌ Falta ${ativos.falta} Usuários - para vocês ganharem R$ 50,00 a mais na gratificação`);
        }

        txt += `\n`;
        if (faltam.length > 0) {
            txt += faltam.join('\n');
        } else {
            txt += `🎉 PARABÉNS! Vocês bateram todas as metas e garantiram os R$ 200,00 de gratificação extra! 🚀`;
        }

        abrirModalWhatsapp(txt, { titulo: `Alerta: Meta Mensal ${dados.unidade}`, icone: 'award', cor: 'emerald' });
    };

    const MetaItemCard = ({ label, dados, corAtiva, textoSucesso, textoFalha }) => {
        const metaVal = Number(dados.meta) || 0;
        const realizadoVal = Number(dados.realizado) || 0;
        const faltaVal = Number(dados.falta) || 0;

        const perc = metaVal > 0 ? Math.min((realizadoVal / metaVal) * 100, 100) : 0;
        
        return (
            <div className={`p-4 rounded-[16px] border ${dados.batida ? 'bg-emerald-50/50 border-emerald-200 shadow-sm' : 'bg-slate-50 border-slate-200'} transition-all`}>
                <div className="flex justify-between items-center mb-3">
                    <span className={`text-[11px] font-black uppercase tracking-wider ${dados.batida ? 'text-emerald-700' : 'text-slate-600'}`}>{label}</span>
                    <span className={`text-sm font-black ${dados.batida ? 'text-emerald-600' : 'text-slate-800'}`}>{realizadoVal} / {metaVal}</span>
                </div>
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden mb-3">
                    <div className={`h-full rounded-full transition-all duration-1000 ${dados.batida ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : corAtiva}`} style={{ width: `${perc}%` }}></div>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {dados.batida ? 'Meta Concluída' : `Faltam ${faltaVal}`}
                    </span>
                    {dados.batida 
                        ? <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest">{textoSucesso}</span>
                        : <span className="bg-rose-50 text-rose-600 border border-rose-100 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest">{textoFalha}</span>
                    }
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-[fadeIn_0.2s_ease-out] pb-10">
            
            {podeEditar ? (
                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-8 animate-[slideDown_0.3s_ease-out]">
                    <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                            <Target className="w-5 h-5 text-blue-600" /> Configuração das Metas: {filtroUnidade}
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="bg-slate-50 p-5 rounded-[20px] border border-slate-100 shadow-inner">
                            <h4 className="text-[11px] font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-1.5"><Zap className="w-4 h-4"/> Meta Start (Primordial)</h4>
                            <div className="space-y-4">
                                <div><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Nutri</label><input type="number" value={metaNutri} onChange={e=>setMetaNutri(Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm mt-1" /></div>
                                <div><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Produto (Físico)</label><input type="number" value={metaProdutos} onChange={e=>setMetaProdutos(Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm mt-1" /></div>
                                <div><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Personal Class <span className="text-rose-400 text-[8px]">(Zere p/ ocultar)</span></label><input type="number" value={metaPersonal} onChange={e=>setMetaPersonal(Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm mt-1" /></div>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-5 rounded-[20px] border border-slate-100 shadow-inner">
                            <h4 className="text-[11px] font-black text-amber-600 uppercase tracking-widest mb-4 flex items-center gap-1.5"><Award className="w-4 h-4"/> Meta Mensal (R$ 200)</h4>
                            <div className="space-y-4">
                                <div><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Ativos (Alvo)</label><input type="number" value={metaAtivosMensal} onChange={e=>setMetaAtivosMensal(Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black text-slate-700 outline-none focus:ring-2 focus:ring-amber-500 shadow-sm mt-1" /></div>
                                <div><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Nutri</label><input type="number" value={metaNutriMensal} onChange={e=>setMetaNutriMensal(Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black text-slate-700 outline-none focus:ring-2 focus:ring-amber-500 shadow-sm mt-1" /></div>
                                <div><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Plus</label><input type="number" value={metaPlusMensal} onChange={e=>setMetaPlusMensal(Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black text-slate-700 outline-none focus:ring-2 focus:ring-amber-500 shadow-sm mt-1" /></div>
                                <div><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Personal Class <span className="text-rose-400 text-[8px]">(Zere p/ ocultar)</span></label><input type="number" value={metaPersMensal} onChange={e=>setMetaPersMensal(Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black text-slate-700 outline-none focus:ring-2 focus:ring-amber-500 shadow-sm mt-1" /></div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div className="bg-emerald-50/50 p-6 rounded-[20px] border border-emerald-100 flex flex-col items-center justify-center text-center shadow-inner h-full">
                                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                                    <Activity className="w-7 h-7" />
                                </div>
                                <h4 className="text-sm font-black text-emerald-800 uppercase tracking-widest">Qtd. Ativos Atual</h4>
                                <p className="text-[10px] text-emerald-600/80 font-bold uppercase tracking-widest mt-1 mb-6">Atualize este valor diariamente</p>
                                <input type="number" value={ativosAtual} onChange={e=>setAtivosAtual(Number(e.target.value))} className="w-full max-w-[160px] bg-white border-2 border-emerald-300 rounded-2xl p-4 text-3xl font-black text-emerald-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 text-center shadow-sm" />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end border-t border-slate-100 pt-6">
                        <button onClick={salvarMetasNuvem} disabled={isSalvandoMetas} className="px-8 py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all flex items-center gap-2 disabled:opacity-50">
                            {isSalvandoMetas ? <i data-lucide="loader-2" className="w-5 h-5 animate-spin"></i> : <i data-lucide="save" className="w-5 h-5"></i>}
                            Salvar Configurações da {filtroUnidade}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center mb-6">
                        <Target className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Painel de Edição Oculto</h3>
                    <p className="text-sm font-bold text-slate-500 mt-2 max-w-md mx-auto">Para editar e salvar as metas, selecione uma unidade específica no <strong className="text-slate-700">Filtro Global</strong> acima.</p>
                </div>
            )}

            {dadosPorUnidade.map((item, index) => (
                <div key={index} className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="bg-slate-900 px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-5 border-b border-slate-800">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/10">
                                <i data-lucide="building-2" className="w-6 h-6 text-white"></i>
                            </div>
                            <div>
                                <h4 className="text-xl font-black text-white uppercase tracking-tight line-clamp-1">{item.unidade}</h4>
                                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mt-0.5">Visão de Performance Operacional</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <button onClick={() => gerarMensagemMetaStart(item)} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md transition-all flex items-center gap-2">
                                <Share2 className="w-4 h-4" /> Alerta Start
                            </button>
                            <button onClick={() => gerarMensagemMetaMensal(item)} className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md transition-all flex items-center gap-2">
                                <Share2 className="w-4 h-4" /> Alerta Mensal
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 bg-white">
                        <div className="p-6 md:p-8">
                            <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <Zap className="w-4 h-4 text-blue-500"/> META START MENSAL
                            </h5>
                            <div className="flex flex-col gap-4">
                                {item.start.nutri.meta > 0 && <MetaItemCard label="NUTRI" dados={item.start.nutri} corAtiva="bg-blue-500" textoSucesso="✅ BATEU ✅" textoFalha="SEM GRATIFICAÇÃO" />}
                                {item.start.produto.meta > 0 && <MetaItemCard label="PRODUTO" dados={item.start.produto} corAtiva="bg-blue-500" textoSucesso="✅ BATEU ✅" textoFalha="SEM GRATIFICAÇÃO" />}
                                {item.start.personal.meta > 0 && <MetaItemCard label="PERSONAL CLASS" dados={item.start.personal} corAtiva="bg-blue-500" textoSucesso="✅ BATEU ✅" textoFalha="SEM GRATIFICAÇÃO" />}
                            </div>
                        </div>

                        <div className="p-6 md:p-8 bg-slate-50/30">
                            <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <Award className="w-4 h-4 text-amber-500"/> META MENSAL R$ 200 REAIS
                            </h5>
                            <div className="flex flex-col gap-4">
                                {item.mensal.ativos.meta > 0 && <MetaItemCard label="ATIVOS" dados={item.mensal.ativos} corAtiva="bg-amber-400" textoSucesso="✅ BATEU" textoFalha="CORRER ATRÁS 🏃" />}
                                {item.mensal.nutri.meta > 0 && <MetaItemCard label="NUTRI" dados={item.mensal.nutri} corAtiva="bg-amber-400" textoSucesso="✅ BATEU" textoFalha="CORRER ATRÁS 🏃" />}
                                {item.mensal.plus.meta > 0 && <MetaItemCard label="PLUS" dados={item.mensal.plus} corAtiva="bg-amber-400" textoSucesso="✅ BATEU" textoFalha="CORRER ATRÁS 🏃" />}
                                {item.mensal.personal.meta > 0 && <MetaItemCard label="PERSONAL CLASS" dados={item.mensal.personal} corAtiva="bg-amber-400" textoSucesso="✅ BATEU" textoFalha="CORRER ATRÁS 🏃" />}
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default MetasTab;