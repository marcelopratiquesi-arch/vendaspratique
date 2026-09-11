import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { supabase } from '../../supabaseClient.js';
import {
    formatMoney,
    getCategoriaItem,
    getValorRealDaVenda,
    criarGruposPlanosVazio,
    classificarPlanoEmGrupo,
    safeIsoDate
} from './utils.js';
import { TrendingUp, X, Users, Loader2, CheckCircle2 } from 'lucide-react'; 

// ==========================================
// 🧠 COMPONENTE: JANELA FLUTUANTE (DRAGGABLE & RESIZABLE)
// Padrão de UX Avançado: Pop-up móvel sem travar o fundo
// ==========================================
const DraggableWindow = ({ isOpen, onClose, title, subtitle, icon: Icon, iconColor = 'text-blue-500', minWidth = 350, minHeight = 400, children }) => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

    // Centraliza a janela assim que ela for aberta
    useEffect(() => {
        if (isOpen) {
            setPosition({
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
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                minWidth: `${minWidth}px`,
                minHeight: `${minHeight}px`
            }}
            className="fixed z-[200] bg-white rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] flex flex-col border border-slate-300 resize overflow-hidden animate-[zoomIn_0.2s_ease-out]"
        >
            {/* CABEÇALHO (ÁREA DE ARRASTE) */}
            <div
                onMouseDown={(e) => {
                    setIsDragging(true);
                    dragRef.current = { startX: e.clientX, startY: e.clientY, initialX: position.x, initialY: position.y };
                }}
                className="p-6 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800 cursor-move"
            >
                <div className="pointer-events-none select-none">
                    <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
                        {Icon && <Icon className={`w-5 h-5 ${iconColor}`} />} {title}
                    </h3>
                    {subtitle && <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">{subtitle}</p>}
                </div>
                <button
                    onMouseDown={(e) => e.stopPropagation()} // Impede o arraste ao tentar fechar
                    onClick={onClose}
                    className="hover:rotate-90 transition-transform bg-white/10 p-2 rounded-full hover:bg-white/20"
                >
                    <X className="w-5 h-5 text-white" />
                </button>
            </div>

            {/* CORPO DA JANELA (SCROLLÁVEL) */}
            <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto custom-scrollbar relative">
                {children}
            </div>
        </div>
    );
};

const DashboardTab = ({ 
    vendasFiltradas, colaboradores, unidadeAtual, 
    filtroMes, filtroAno, // Usado na consulta segura dos Ativos
    metaProdutos, metaNutri, metaPersonal, planos, produtos, abrirModalWhatsapp 
}) => {
    const { t, locale } = useI18n(); 
    const [grupoExpandido, setGrupoExpandido] = useState(null);
    const [modalProdOpen, setModalProdOpen] = useState(false);

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
            alert("Selecione uma unidade específica no filtro acima para editar os ativos.");
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
    // CÁLCULOS DO DASHBOARD
    // ==========================================
    const rankingConsultoresFisicos = {};
    const equipeLocal = (colaboradores || []).filter(c =>
        unidadeAtual === 'TODOS' ? true : c.unidade?.toUpperCase() === unidadeAtual?.toUpperCase()
    );
    equipeLocal.forEach(colab => { rankingConsultoresFisicos[colab.nome.toUpperCase()] = 0; });

    let totalVendasProdutos = 0;
    let totalPlanos = 0;
    let totalServicos = 0;
    let faturamento = 0;
    const rankingProdutosFisicos = {};
    const gruposPlanos = criarGruposPlanosVazio();

    const transacoesUnicas = new Set();

    vendasFiltradas.forEach(v => {
        let qtd = parseInt(v.quantidade) || 1;
        const valorFaturado = getValorRealDaVenda(v, planos, produtos);
        
        const prodUpper = (v.produto || '').toUpperCase();
        const vendUpper = (v.vendedor || '').toUpperCase();
        const categoriaFinal = getCategoriaItem(prodUpper, planos, produtos);

        if (categoriaFinal === 'PLANO' && v.matricula && v.matricula.trim() !== '') {
            const dataLimpa = safeIsoDate(v.data || v.created_at);
            const chaveUnica = `${v.matricula.trim()}-${prodUpper}-${dataLimpa}`;

            if (transacoesUnicas.has(chaveUnica)) {
                qtd = 0;
            } else {
                transacoesUnicas.add(chaveUnica);
            }
        }

        faturamento += valorFaturado;

        if (categoriaFinal === 'PLANO') {
            totalPlanos += qtd;
            classificarPlanoEmGrupo(gruposPlanos, prodUpper, qtd);
        } else if (categoriaFinal === 'PRODUTO') {
            totalVendasProdutos += qtd;
            rankingProdutosFisicos[prodUpper] = (rankingProdutosFisicos[prodUpper] || 0) + qtd;
            if (rankingConsultoresFisicos[vendUpper] !== undefined) {
                rankingConsultoresFisicos[vendUpper] += qtd;
            } else {
                rankingConsultoresFisicos[vendUpper] = qtd;
            }
        } else if (categoriaFinal === 'SERVICO') {
            totalServicos += qtd;
        }
    });

    const topProdutosLista = Object.entries(rankingProdutosFisicos).sort((a, b) => b[1] - a[1]);
    const rankingOrdenado = Object.entries(rankingConsultoresFisicos).sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
    });

    const toggleGrupoPlanos = (nomeGrupo) => {
        setGrupoExpandido(prev => prev === nomeGrupo ? null : nomeGrupo);
    };

    const totalFit = gruposPlanos["FIT"]?.total || 0;
    const percentualFit = totalPlanos > 0 ? (totalFit / totalPlanos) * 100 : 0;
    const produtividadeUpsell = totalPlanos > 0 ? Math.max(100 - percentualFit, 0) : 0;

    const todosPlanosDetalhados = [];
    Object.values(gruposPlanos).forEach(grupo => {
        Object.entries(grupo.detalhes).forEach(([nome, qtd]) => {
            if (qtd > 0) todosPlanosDetalhados.push({ nome, qtd });
        });
    });
    todosPlanosDetalhados.sort((a, b) => b.qtd - a.qtd); 

    const dispararModalMetas = () => {
        const mesAtual = new Date().toLocaleString(locale || 'pt-BR', { month: 'long' }).toUpperCase();
        
        const nutriRealizado = gruposPlanos["NUTRI"]?.total || 0;
        const personalRealizado = gruposPlanos["PERSONAL CLASS"]?.total || 0;
        const produtosRealizado = totalVendasProdutos || 0;

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
        txt += `${t('analytics.dashboard.wppTotalSales', { defaultValue: '*Total de Vendas:*' })} ${String(totalVendasProdutos).padStart(2, '0')} / ${String(metaProdutos || 0).padStart(2, '0')}\n\n`;

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

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [vendasFiltradas, grupoExpandido, modalProdOpen, modalAtivosOpen]);

    return (
        <div className="space-y-6 animate-[fadeIn_0.2s_ease-out] relative">
            
            {/* 🔥 NOVO PADRÃO: JANELAS FLUTUANTES (PRODUTIVIDADE) */}
            <DraggableWindow
                isOpen={modalProdOpen}
                onClose={() => setModalProdOpen(false)}
                title="Memória de Cálculo"
                subtitle="Transparência dos dados e conversão"
                icon={TrendingUp}
                iconColor="text-rose-500"
                minWidth={500}
                minHeight={500}
            >
                <div className="p-6 md:p-8 space-y-8">
                    <div>
                        <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <i data-lucide="layers" className="w-4 h-4 text-blue-500"></i> Planos Vendidos no Período
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {todosPlanosDetalhados.map((p, i) => (
                                <div key={i} className="bg-white border border-slate-200 p-3.5 rounded-xl flex justify-between items-center shadow-sm">
                                    <span className="text-[10px] font-bold text-slate-700 uppercase truncate mr-2" title={p.nome}>{p.nome}</span>
                                    <span className="text-xs font-black text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg">{p.qtd}</span>
                                </div>
                            ))}
                            {todosPlanosDetalhados.length === 0 && (
                                <p className="text-xs font-bold text-slate-400 italic col-span-full">Nenhum plano registrado neste filtro.</p>
                            )}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <i data-lucide="calculator" className="w-4 h-4 text-rose-500"></i> Fórmula de Upsell Aplicada
                        </h4>
                        <div className="bg-white border border-slate-200 rounded-[20px] p-6 shadow-sm space-y-5">
                            <div className="flex justify-between items-center">
                                <span className="text-[11px] font-bold text-slate-500 uppercase">1. Total de Entradas (Todos os Planos)</span>
                                <span className="text-sm font-black text-slate-800 bg-slate-100 px-3 py-1 rounded-lg">{totalPlanos}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[11px] font-bold text-slate-500 uppercase">2. Quantidade de Planos "FIT" (Básicos)</span>
                                <span className="text-sm font-black text-slate-800 bg-slate-100 px-3 py-1 rounded-lg">{totalFit}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[11px] font-bold text-slate-500 uppercase">3. Percentual FIT <span className="text-[9px] lowercase normal-case text-slate-400">(Fit ÷ Entradas × 100)</span></span>
                                <span className="text-sm font-black text-rose-600 bg-rose-50 px-3 py-1 rounded-lg">{percentualFit.toFixed(1)}%</span>
                            </div>
                            <div className="pt-5 border-t border-slate-200 flex justify-between items-center">
                                <div>
                                    <span className="block text-xs font-black text-slate-800 uppercase tracking-widest">Produtividade Final</span>
                                    <span className="block text-[9px] font-bold text-slate-400 mt-0.5">100% - Percentual FIT</span>
                                </div>
                                <span className="text-2xl font-black text-emerald-600">{produtividadeUpsell.toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </DraggableWindow>

            {/* 🔥 NOVO PADRÃO: JANELAS FLUTUANTES (ATIVOS DA UNIDADE) */}
            <DraggableWindow
                isOpen={modalAtivosOpen}
                onClose={() => { if (!isSalvandoAtivos && !sucessoAtivos) setModalAtivosOpen(false) }}
                title="Ativos da Unidade"
                subtitle={`${unidadeAtual} • ${String(filtroMes).padStart(2, '0')}/${filtroAno}`}
                icon={Users}
                iconColor="text-emerald-500"
                minWidth={350}
                minHeight={350}
            >
                <div className="p-6 md:p-8 flex flex-col gap-6 h-full justify-center">
                    {sucessoAtivos ? (
                        <div className="flex flex-col items-center justify-center py-6 animate-[zoomIn_0.2s_ease-out]">
                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 shadow-inner border border-emerald-200">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <h4 className="text-lg font-black text-slate-800 tracking-tight">Ativos Atualizados!</h4>
                            <p className="text-xs font-bold text-slate-500 mt-1 text-center">O Dashboard já foi sincronizado.</p>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 block text-center">
                                    Quantidade de alunos ativos
                                </label>
                                <input 
                                    type="number" 
                                    min="0"
                                    value={ativosInput} 
                                    onChange={(e) => setAtivosInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSalvarAtivos(); }}
                                    className="w-full bg-white border-2 border-emerald-300 rounded-2xl p-4 text-3xl font-black text-emerald-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 text-center shadow-sm"
                                    autoFocus
                                />
                                {erroAtivos && <p className="text-xs font-bold text-rose-500 mt-2 text-center animate-pulse">{erroAtivos}</p>}
                            </div>
                            
                            <button 
                                onClick={handleSalvarAtivos}
                                disabled={!hasChangesAtivos || isSalvandoAtivos}
                                className={`w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-2
                                    ${!hasChangesAtivos ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}
                                    ${isSalvandoAtivos ? 'opacity-70 cursor-wait' : ''}
                                `}
                            >
                                {isSalvandoAtivos ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> Salvando...</>
                                ) : (
                                    <><Users className="w-5 h-5" /> Salvar atualização</>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </DraggableWindow>

            {/* 🔥 GRID PRINCIPAL DOS INDICADORES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6">
                
                <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-2">{t('analytics.dashboard.kpiPlans', { defaultValue: 'Planos Vendidos' })}</p>
                    <p className="text-4xl font-black tracking-tight" title={t('analytics.dashboard.kpiTooltip', { defaultValue: 'Métrica deduplicada para espelhar número real de alunos' })}>{String(totalPlanos).padStart(2, '0')}</p>
                </div>
                
                {/* NOVO CARD: ATIVOS DA UNIDADE */}
                <div 
                    onClick={handleAbrirModalAtivos}
                    title="Clique para atualizar a quantidade de alunos ativos"
                    className="bg-gradient-to-br from-emerald-500 to-teal-700 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden group cursor-pointer hover:ring-4 hover:ring-emerald-500/30 hover:-translate-y-1 transition-all duration-300"
                >
                    <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <Users className="w-32 h-32" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-2 relative z-10 flex items-center gap-1.5">
                        Ativos da Unidade <i data-lucide="info" className="w-3 h-3 opacity-70"></i>
                    </p>
                    <div className="relative z-10">
                        {isCarregandoAtivos ? (
                            <div className="flex items-center gap-2 mt-2">
                                <Loader2 className="w-6 h-6 animate-spin opacity-80" />
                                <span className="text-xs font-bold opacity-80 uppercase tracking-widest">Sincronizando</span>
                            </div>
                        ) : ativosAtualBanco !== null ? (
                            <p className="text-4xl font-black tracking-tight">{Number(ativosAtualBanco).toLocaleString('pt-BR')}</p>
                        ) : (
                            <p className="text-2xl font-black tracking-tight opacity-90 mt-1">Não Informado</p>
                        )}
                    </div>
                </div>

                <div 
                    onClick={() => setModalProdOpen(true)}
                    className="bg-gradient-to-br from-pink-600 to-rose-800 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden group cursor-pointer hover:ring-4 hover:ring-rose-500/30 hover:-translate-y-1 transition-all duration-300"
                    title="Clique para ver a Memória de Cálculo"
                >
                    <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <TrendingUp className="w-32 h-32" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-2 relative z-10 flex items-center gap-1.5">
                        Produtividade <i data-lucide="info" className="w-3 h-3 opacity-70"></i>
                    </p>
                    <div className="flex items-baseline gap-1 relative z-10">
                        <p className="text-4xl font-black tracking-tight">{produtividadeUpsell.toFixed(0)}</p>
                        <span className="text-xl font-bold opacity-80">%</span>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-amber-500 to-amber-700 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-2">{t('analytics.dashboard.kpiProducts', { defaultValue: 'Produtos Físicos' })}</p>
                    <p className="text-4xl font-black tracking-tight">{String(totalVendasProdutos).padStart(2, '0')}</p>
                </div>

                <div className="bg-gradient-to-br from-violet-500 to-violet-700 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-2">{t('analytics.dashboard.kpiServices', { defaultValue: 'Serviços Avulsos' })}</p>
                    <p className="text-4xl font-black tracking-tight">{String(totalServicos).padStart(2, '0')}</p>
                </div>

                <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-2">{t('analytics.dashboard.kpiRevenue', { defaultValue: 'Faturamento Bruto' })}</p>
                    <p className="text-2xl lg:text-3xl font-black tracking-tight mt-1">{formatMoney(faturamento)}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-8 h-[450px] flex flex-col">
                    <div className="flex justify-between items-center border-b border-slate-100 mb-6 pb-4">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                            <i data-lucide="layers" className="w-5 h-5 text-blue-500"></i> {t('analytics.dashboard.plansTitle', { defaultValue: 'Venda de Assinaturas' })}
                        </h3>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                        {Object.entries(gruposPlanos).filter(([_, data]) => data.total > 0).map(([nomeGrupo, data]) => {
                            const perc = totalPlanos > 0 ? (data.total / totalPlanos) * 100 : 0;
                            const isSingleLooseItem = Object.keys(data.detalhes).length === 1 && Object.keys(data.detalhes)[0] === nomeGrupo;
                            const isExpanded = grupoExpandido === nomeGrupo && !isSingleLooseItem;

                            return (
                                <div key={nomeGrupo} className="group flex flex-col gap-1 border border-slate-100 rounded-xl p-3 bg-slate-50 transition-all">
                                    <div className={`flex justify-between items-center select-none ${!isSingleLooseItem ? 'cursor-pointer' : ''}`} onClick={() => !isSingleLooseItem && toggleGrupoPlanos(nomeGrupo)}>
                                        <div className="flex items-center gap-2">
                                            {!isSingleLooseItem ? <i data-lucide={isExpanded ? "chevron-up" : "chevron-down"} className="w-4 h-4 text-slate-400"></i> : <div className="w-1 h-1 rounded-full bg-slate-400 ml-1.5 mr-1.5"></div>}
                                            <span className={`text-[11px] font-black uppercase tracking-wider ${data.textCor}`}>{nomeGrupo}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-400 text-[10px] font-bold">{perc.toFixed(0)}%</span>
                                            <span className="bg-white px-2 py-0.5 rounded text-[10px] border shadow-sm font-black">{String(data.total).padStart(2, '0')} un</span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                                        <div className={`h-full rounded-full transition-all duration-700 ease-out ${data.cor}`} style={{ width: `${perc}%` }}></div>
                                    </div>
                                    {isExpanded && (
                                        <div className="mt-3 pt-3 border-t border-slate-200 space-y-2 animate-[fadeIn_0.2s_ease-out]">
                                            {Object.entries(data.detalhes).sort((a,b)=>b[1]-a[1]).map(([nomePlano, qtdPlano]) => (
                                                <div key={nomePlano} className="flex justify-between items-center text-[9px] font-bold text-slate-600 uppercase">
                                                    <span className="truncate max-w-[180px] pl-2 border-l-2 border-slate-300">{nomePlano}</span>
                                                    <span className="bg-white border border-slate-100 px-1.5 rounded shadow-sm">{String(qtdPlano).padStart(2, '0')} un</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                        {Object.keys(gruposPlanos).every(k => gruposPlanos[k].total === 0) && <p className="text-center text-xs font-bold text-slate-400 py-12">{t('analytics.dashboard.emptyPlans', { defaultValue: 'Nenhum plano vendido.' })}</p>}
                    </div>
                    <button onClick={dispararModalMetas} className="mt-4 w-full bg-blue-600 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-sm shrink-0">
                        <i data-lucide="share-2" className="w-4 h-4 text-blue-200"></i> ALERTAR METAS (WHATSAPP)
                    </button>
                </div>

                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-8 h-[450px] flex flex-col">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b pb-4">
                        <i data-lucide="box" className="w-5 h-5 text-amber-500"></i> {t('analytics.dashboard.productsTitle', { defaultValue: 'Produtos / Complementos' })}
                    </h3>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                        {topProdutosLista.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <span className="text-[10px] font-black text-slate-700 uppercase"><span className="text-slate-400 font-bold w-4 mr-2">{idx + 1}º</span>{item[0]}</span>
                                <span className="bg-white px-3 py-1 rounded-lg border text-[10px] font-black text-amber-600">{String(item[1]).padStart(2, '0')} un</span>
                            </div>
                        ))}
                        {topProdutosLista.length === 0 && <p className="text-center text-xs font-bold text-slate-400 py-12">{t('analytics.dashboard.emptyProducts', { defaultValue: 'Nenhum produto físico vendido.' })}</p>}
                    </div>
                </div>

                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-8 h-[450px] flex flex-col">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b pb-4">
                        <i data-lucide="medal" className="w-5 h-5 text-emerald-500"></i> {t('analytics.dashboard.podiumTitle', { defaultValue: 'Pódio Físico (Garrafa/Whey)' })}
                    </h3>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                        {rankingOrdenado.map(([nome, qtd], idx) => {
                            let emojiUI = "🟢 ❌ ❌";
                            if (qtd === 0) emojiUI = "❌ ❌ ❌";
                            else if (qtd === 2) emojiUI = "🟢 🟢 ❌";
                            else if (qtd >= 3) emojiUI = "✅ ✅ ✅";

                            return (
                                <div key={idx} className={`flex justify-between items-center p-3 rounded-xl border ${qtd === 0 ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                                    <span className={`text-[10px] font-black uppercase truncate max-w-[120px] ${qtd === 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                                        {idx+1}º {nome.split(' ')[0]}
                                    </span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] tracking-widest">{emojiUI}</span>
                                        <span className={`text-[10px] font-black bg-white px-2 py-0.5 rounded border shadow-sm ${qtd === 0 ? 'text-rose-500 border-rose-200' : 'text-emerald-600 border-slate-200'}`}>{String(qtd).padStart(2, '0')} un</span>
                                    </div>
                                </div>
                            )
                        })}
                        {rankingOrdenado.length === 0 && <p className="text-center text-xs font-bold text-slate-400 py-12">{t('analytics.dashboard.emptyConsultants', { defaultValue: 'Nenhum consultor cadastrado na unidade.' })}</p>}
                    </div>
                    <button onClick={dispararModalCompartilhar} disabled={rankingOrdenado.length === 0} className="mt-4 w-full bg-slate-800 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-sm shrink-0">
                        <i data-lucide="share-2" className="w-4 h-4"></i> {t('analytics.dashboard.wppButton', { defaultValue: 'Ranking WhatsApp' })}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DashboardTab;