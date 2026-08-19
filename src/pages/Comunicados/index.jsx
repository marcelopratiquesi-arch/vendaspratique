import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import { useI18n } from '../../i18n/I18nContext.jsx';
import FormularioComunicado from './Formulario.jsx';
import { 
    Megaphone, Plus, Search, Calendar, CheckCircle, 
    HelpCircle, Info, ShieldAlert, X, Loader2, Trash2, Eye 
} from 'lucide-react';

export default function CentralComunicados({ usuarioLogado, unidades }) {
    const { t, locale } = useI18n();
    
    const [modo, setModo] = useState('lista'); 
    const [filtroTexto, setFiltroTexto] = useState('');
    const [cardsUnificados, setCardsUnificados] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [visualizando, setVisualizando] = useState(null); 
    const [respostaSelecionada, setRespostaSelecionada] = useState('');
    const [validando, setValidando] = useState(false);
    const [resultado, setResultado] = useState(null);

    // REGRA DEFINITIVA: Somente Admin e Mentor gerenciam.
    const isGestor = ['ADMIN', 'MENTOR'].includes(usuarioLogado?.role);

    const fetchDados = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const emailReal = user?.email;
            if (!emailReal) return;

            const mapCards = new Map();

            // 1. Busca os comunicados que chegaram PARA o usuário
            const { data: inbox } = await supabase
                .from('comunicado_inbox')
                .select(`
                    id, status_leitura,
                    comunicados (
                        id, tipo, obrigatorio, bloqueia_operacao, titulo_pt, conteudo_pt, titulo_en, conteudo_en, 
                        titulo_es, conteudo_es, imagem_url, inicio_em, expira_em, criado_por, status, deleted_at, alternativas
                    )
                `)
                .eq('email_usuario', emailReal)
                .is('comunicados.deleted_at', null)
                .lte('comunicados.inicio_em', new Date().toISOString());

            if (inbox) {
                inbox.forEach(i => {
                    if (!i.comunicados) return;
                    mapCards.set(i.comunicados.id, {
                        comunicado: i.comunicados,
                        inboxStatus: i.status_leitura,
                        inboxId: i.id,
                        isAuthor: false, // Por padrão, apenas recebeu
                        metrics: null
                    });
                });
            }

            // 2. Se for GESTOR, busca os que ele CRIOU para acoplar métricas
            if (isGestor) {
                let query = supabase
                    .from('comunicados')
                    .select('*, comunicado_inbox (id, status_leitura)')
                    .is('deleted_at', null)
                    .order('criado_em', { ascending: false });

                // Mentor só vê métricas dos que ele criou. Admin vê tudo.
                if (usuarioLogado.role === 'MENTOR') {
                    query = query.eq('criado_por', emailReal);
                }

                const { data: authored } = await query;
                
                if (authored) {
                    authored.forEach(com => {
                        const leituras = com.comunicado_inbox || [];
                        const metrics = {
                            total: leituras.length,
                            lidos: leituras.filter(l => l.status_leitura !== 'NAO_LIDO').length,
                            pendentes: leituras.filter(l => l.status_leitura === 'NAO_LIDO' || l.status_leitura === 'PENDENTE').length
                        };

                        if (mapCards.has(com.id)) {
                            // Se ele recebeu o próprio aviso e administra, eleva o card para isAuthor
                            const existing = mapCards.get(com.id);
                            existing.isAuthor = true;
                            existing.metrics = metrics;
                        } else {
                            // Se ele não é destinatário, mas é autor, adiciona na lista dele para gerenciar
                            mapCards.set(com.id, {
                                comunicado: com,
                                inboxStatus: null,
                                inboxId: null,
                                isAuthor: true,
                                metrics: metrics
                            });
                        }
                    });
                }
            }

            // Converte Map para Array e ordena do mais recente pro mais antigo
            const arrayFinal = Array.from(mapCards.values()).sort((a, b) => new Date(b.comunicado.inicio_em) - new Date(a.comunicado.inicio_em));
            setCardsUnificados(arrayFinal);

        } catch (error) {
            console.error("Erro ao buscar comunicados unificados:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (modo === 'lista') fetchDados();
    }, [modo]);

    const excluirComunicado = async (e, comunicadoId, titulo) => {
        e.stopPropagation(); // Evita abrir o modal ao clicar na lixeira
        if (window.confirm(`TEM CERTEZA?\n\nExcluir "${titulo}" removerá a mensagem da Caixa de Entrada de todos os destinatários imediatamente.`)) {
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                await supabase.from('comunicados')
                    .update({ deleted_at: new Date().toISOString(), deleted_by: user.email })
                    .eq('id', comunicadoId);
                fetchDados(); 
            } catch (err) {
                console.error("Erro ao excluir:", err);
                alert("Erro ao excluir comunicado.");
            }
        }
    };

    const abrirViewer = async (card) => {
        setVisualizando(card);
        setRespostaSelecionada('');
        setResultado(null);

        // Se tem inboxId e ainda não leu, muda o status silenciosamente
        if (card.inboxId && card.inboxStatus === 'NAO_LIDO') {
            const novoStatus = card.comunicado.obrigatorio ? 'PENDENTE' : 'LIDO';
            await supabase.from('comunicado_inbox')
                .update({ status_leitura: novoStatus, visualizado_em: new Date().toISOString() })
                .eq('id', card.inboxId);
            fetchDados(); 
        }
    };

    const submeterResposta = async (comId, resposta) => {
        setValidando(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data, error } = await supabase.rpc('validar_resposta_comunicado', { 
                p_comunicado_id: comId, p_email_usuario: user.email, p_resposta: resposta 
            });
            if (error) throw error;
            setResultado(data);
            if (data.sucesso) fetchDados();
        } catch (error) {
            console.error(error);
        } finally {
            setValidando(false);
        }
    };

    const getTextoLocalizado = (com, campo) => {
        const lang = locale.split('-')[0];
        if (lang === 'en' && com[`${campo}_en`]) return com[`${campo}_en`];
        if (lang === 'es' && com[`${campo}_es`]) return com[`${campo}_es`];
        return com[`${campo}_pt`];
    };

    if (modo === 'criar') {
        return <FormularioComunicado usuarioLogado={usuarioLogado} unidades={unidades} onVoltar={() => setModo('lista')} onSalvo={() => { setModo('lista'); fetchDados(); }} />;
    }

    const cardsVisiveis = cardsUnificados.filter(c => getTextoLocalizado(c.comunicado, 'titulo').toLowerCase().includes(filtroTexto.toLowerCase()));

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] max-w-[1400px] mx-auto font-sans pb-10">
            
            {/* HUB HEADER UNIFICADO */}
            <div className="bg-white/70 dark:bg-[#111827]/60 backdrop-blur-2xl rounded-[32px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-2xl border border-white/80 dark:border-white/5 p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center border border-blue-100 dark:border-blue-500/20 shadow-inner shrink-0">
                        <Megaphone className="w-8 h-8" strokeWidth={2} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t('communications.title', { defaultValue: 'Central de Comunicados' })}</h2>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1.5">
                            Comunicação Corporativa e Operacional
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row w-full md:w-auto items-center gap-4">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" placeholder={t('communications.search', { defaultValue: 'Buscar...' })} value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)} className="w-full bg-white dark:bg-white/5 border border-slate-200/70 dark:border-white/10 rounded-xl pl-10 pr-4 py-3 text-xs font-bold text-slate-700 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm" />
                    </div>
                    {isGestor && (
                        <button onClick={() => setModo('criar')} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] active:scale-95 shrink-0">
                            <Plus className="w-4 h-4" /> {t('communications.new', { defaultValue: 'Novo' })}
                        </button>
                    )}
                </div>
            </div>

            {/* ÁREA DE LISTAGEM UNIFICADA */}
            {loading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {cardsVisiveis.map(card => {
                        const com = card.comunicado;
                        const isUnread = card.inboxStatus === 'NAO_LIDO';
                        const isPending = card.inboxStatus === 'PENDENTE';
                        const isCompleted = card.inboxStatus === 'CONCLUIDO';
                        const isAuthor = card.isAuthor;

                        return (
                            <div 
                                key={com.id} onClick={() => abrirViewer(card)}
                                className={`bg-white/80 dark:bg-[#111827]/65 backdrop-blur-xl border rounded-[32px] p-6 cursor-pointer transition-all group flex flex-col relative overflow-hidden ${
                                    isUnread || isPending 
                                    ? 'border-blue-300 dark:border-blue-500/50 shadow-[0_8px_30px_rgba(37,99,235,0.1)] dark:shadow-blue-500/10' 
                                    : 'border-slate-200/70 dark:border-white/10 shadow-sm hover:shadow-lg hover:border-slate-300 dark:hover:border-white/20'
                                }`}
                            >
                                {(isUnread || isPending) && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>}
                                
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        {(isUnread || isPending) && <span className="flex h-2.5 w-2.5 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span></span>}
                                        <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border flex items-center gap-1.5 ${
                                            com.tipo === 'INFORMATIVO' ? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' :
                                            com.tipo === 'CONFIRMACAO' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' :
                                            'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
                                        }`}>
                                            {com.tipo === 'INFORMATIVO' ? <Info className="w-3 h-3" /> : com.tipo === 'CONFIRMACAO' ? <CheckCircle className="w-3 h-3" /> : <HelpCircle className="w-3 h-3" />}
                                            {com.tipo}
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        {isCompleted && !isAuthor && <CheckCircle className="w-5 h-5 text-emerald-500 bg-emerald-50 rounded-full dark:bg-transparent" title="Concluído" />}
                                        {isAuthor && (
                                            <button onClick={(e) => excluirComunicado(e, com.id, getTextoLocalizado(com, 'titulo'))} className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 bg-slate-50 hover:bg-rose-50 dark:bg-white/5 dark:hover:bg-rose-500/20 rounded-lg transition-all" title="Excluir Globalmente">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <h3 className={`text-sm tracking-wide line-clamp-2 mb-2 transition-colors ${isUnread || isPending ? 'font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400' : 'font-bold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white'}`}>
                                    {getTextoLocalizado(com, 'titulo')}
                                </h3>
                                
                                <p className={`text-xs line-clamp-2 mb-6 flex-1 ${isUnread || isPending ? 'font-semibold text-slate-600 dark:text-slate-300' : 'font-medium text-slate-500 dark:text-slate-500'}`}>
                                    {getTextoLocalizado(com, 'conteudo')}
                                </p>

                                {/* Métricas Administrativas */}
                                {isAuthor && card.metrics && (
                                    <div className="mb-4 grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-[#0c101a] border border-slate-100 dark:border-white/5 rounded-xl text-center">
                                        <div className="flex flex-col"><span className="text-[9px] font-bold text-slate-400 uppercase">Enviados</span><span className="text-xs font-black text-slate-700 dark:text-slate-200">{card.metrics.total}</span></div>
                                        <div className="flex flex-col border-l border-r border-slate-200/50 dark:border-white/5"><span className="text-[9px] font-bold text-slate-400 uppercase">Abertos</span><span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{card.metrics.lidos}</span></div>
                                        <div className="flex flex-col"><span className="text-[9px] font-bold text-slate-400 uppercase">Pendentes</span><span className="text-xs font-black text-amber-600 dark:text-amber-400">{card.metrics.pendentes}</span></div>
                                    </div>
                                )}

                                <div className="border-t border-slate-200/70 dark:border-white/5 pt-4 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    <div className="flex items-center gap-1.5" title="Data de Envio">
                                        <Calendar className="w-3.5 h-3.5" /> {new Date(com.inicio_em).toLocaleDateString(locale)}
                                    </div>
                                </div>
                            </div>
                        )
                    })}

                    {cardsVisiveis.length === 0 && (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center opacity-50">
                            <Megaphone className="w-16 h-16 text-slate-400 mb-4" strokeWidth={1} />
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{t('communications.empty', {defaultValue: 'Nenhum comunicado encontrado.'})}</p>
                        </div>
                    )}
                </div>
            )}

            {/* VIEWER MODAL (OVERLAY LIQUID GLASS) */}
            {visualizando && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md p-4 sm:p-8 animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-white/95 dark:bg-[#111827]/95 backdrop-blur-3xl w-full max-w-2xl max-h-[90vh] rounded-[32px] shadow-2xl border border-white dark:border-white/10 flex flex-col overflow-hidden animate-[slideDown_0.3s_ease-out]">
                        
                        <div className="flex justify-between items-center p-6 border-b border-slate-200/50 dark:border-white/5 bg-slate-50/50 dark:bg-[#090b11]/50 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl"><Eye className="w-5 h-5" /></div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{visualizando.comunicado.tipo}</p>
                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{new Date(visualizando.comunicado.inicio_em).toLocaleString(locale)}</p>
                                </div>
                            </div>
                            <button onClick={() => setVisualizando(null)} className="p-2 bg-slate-200/50 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-500 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 bg-transparent">
                            {visualizando.comunicado.imagem_url && <img src={visualizando.comunicado.imagem_url} alt="Banner" className="w-full h-auto rounded-2xl mb-6 shadow-md object-cover border border-slate-200 dark:border-white/5" />}
                            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-4">{getTextoLocalizado(visualizando.comunicado, 'titulo')}</h1>
                            <div className="text-sm md:text-base font-medium text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap mb-8">{getTextoLocalizado(visualizando.comunicado, 'conteudo')}</div>

                            {/* Área de Resposta (Somente se for inbox e o cara tiver que responder) */}
                            {visualizando.inboxId && visualizando.comunicado.tipo !== 'INFORMATIVO' && visualizando.inboxStatus !== 'CONCLUIDO' && (
                                <div className="bg-slate-50/80 dark:bg-[#0c101a] p-6 rounded-2xl border border-slate-200/70 dark:border-white/5">
                                    {visualizando.comunicado.tipo === 'QUESTIONARIO' && (
                                        <div className="space-y-4">
                                            <p className="text-xs font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest flex items-center gap-2 mb-4"><HelpCircle className="w-4 h-4" /> {t('communications.quizSelect', {defaultValue: 'Selecione a resposta:'})}</p>
                                            {visualizando.comunicado.alternativas?.map((alt, idx) => (
                                                <label key={idx} className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${respostaSelecionada === alt ? 'bg-amber-50 border-amber-500 dark:bg-amber-500/10 dark:border-amber-500/50' : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-amber-300'}`}>
                                                    <input type="radio" name="resposta" value={alt} checked={respostaSelecionada === alt} onChange={() => setRespostaSelecionada(alt)} className="w-4 h-4 text-amber-600 cursor-pointer" />
                                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{alt}</span>
                                                </label>
                                            ))}
                                            {resultado && (
                                                <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-bold ${resultado.sucesso ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400'}`}>
                                                    {resultado.sucesso ? <CheckCircle className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />} {resultado.mensagem}
                                                </div>
                                            )}
                                            <button onClick={() => submeterResposta(visualizando.comunicado.id, respostaSelecionada)} disabled={validando || !respostaSelecionada || resultado?.sucesso} className="w-full mt-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-black uppercase tracking-widest py-4 rounded-xl shadow-md transition-all flex justify-center items-center gap-2 text-xs disabled:opacity-50">
                                                {validando ? <Loader2 className="w-4 h-4 animate-spin" /> : resultado?.sucesso ? t('communications.unlocked', {defaultValue: 'Acesso Liberado!'}) : t('communications.btnSubmit', {defaultValue: 'Submeter Resposta'})}
                                            </button>
                                        </div>
                                    )}
                                    {visualizando.comunicado.tipo === 'CONFIRMACAO' && (
                                        <div className="text-center">
                                            {resultado?.sucesso ? (
                                                <div className="p-4 bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2"><CheckCircle className="w-5 h-5" /> {t('communications.unlocked', {defaultValue: 'Liberado'})}</div>
                                            ) : (
                                                <button onClick={() => submeterResposta(visualizando.comunicado.id, 'CIENTE')} disabled={validando} className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black uppercase tracking-widest py-4 rounded-xl shadow-md transition-all flex justify-center items-center gap-2 text-xs disabled:opacity-50">
                                                    {validando ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4" /> {t('communications.btnUnderstand', {defaultValue: 'Estou Ciente'})}</>}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {visualizando.inboxStatus === 'CONCLUIDO' && (
                                <div className="mt-8 p-4 bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-xl flex items-center gap-3 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-widest justify-center">
                                    <CheckCircle className="w-5 h-5" /> Você já concluiu este comunicado.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}