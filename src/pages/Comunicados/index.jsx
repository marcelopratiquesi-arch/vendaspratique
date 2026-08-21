import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient.js';
import { useI18n } from '../../i18n/I18nContext.jsx';
import FormularioComunicado from './Formulario.jsx';
import { 
    Megaphone, Plus, Search, Calendar, CheckCircle, 
    HelpCircle, Info, ShieldAlert, X, Loader2, Trash2, Eye, FileText,
    BarChart3, Users, Lock, Unlock, ArrowLeft, ChevronLeft, ChevronRight
} from 'lucide-react';

function RelatorioComunicado({ comunicado, usuarioLogado, onVoltar }) {
    const { locale, language } = useI18n(); 
    const langAtual = locale || language || 'pt-BR'; 
    
    const [loading, setLoading] = useState(true);
    const [inboxes, setInboxes] = useState([]);
    
    const [busca, setBusca] = useState('');
    const [filtroStatus, setFiltroStatus] = useState('TODOS');
    const [pagina, setPagina] = useState(1);
    const ITENS_POR_PAGINA = 15;

    const carregarRelatorio = async () => {
        setLoading(true);
        try {
            const { data: inboxData, error } = await supabase
                .from('comunicado_inbox')
                .select('*')
                .eq('comunicado_id', comunicado.id)
                .order('confirmado_em', { ascending: false, nullsFirst: false });

            if (error) throw error;

            const emails = inboxData.map(i => i.email_usuario);
            let mapUsuarios = {};
            if (emails.length > 0) {
                const { data: users } = await supabase
                    .from('colaboradores')
                    .select('email, nome, unidade, cargo')
                    .in('email', emails);
                if (users) {
                    users.forEach(u => { mapUsuarios[u.email] = u; });
                }
            }

            const dadosEnriquecidos = inboxData.map(item => ({
                ...item,
                nome: mapUsuarios[item.email_usuario]?.nome || item.email_usuario,
                unidade: mapUsuarios[item.email_usuario]?.unidade || '-',
                cargo: mapUsuarios[item.email_usuario]?.cargo || '-'
            }));

            setInboxes(dadosEnriquecidos);
        } catch (err) {
            console.error("Erro ao carregar relatório:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarRelatorio();
    }, [comunicado.id]);

    const handleResetarTentativas = async (inboxId, nome) => {
        if (!window.confirm(`Deseja perdoar as falhas e liberar uma nova chance para ${nome}? O histórico de erros será mantido na auditoria.`)) return;
        
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user?.email) {
                throw new Error("Sessão inválida ou e-mail não encontrado. Refaça o login.");
            }

            const { error } = await supabase.rpc('resetar_tentativas_comunicado', {
                p_inbox_id: inboxId,
                p_admin_email: user.email 
            });
            
            if (error) throw error;
            
            setInboxes(prev => prev.map(i => i.id === inboxId ? { ...i, tentativas: 0, status_leitura: 'PENDENTE' } : i));
            alert("Nova chance liberada com sucesso!");
        } catch (err) {
            console.error("ERRO DO SUPABASE:", err);
            alert("Erro ao liberar nova chance: " + (err.message || "Erro desconhecido"));
        }
    };

    const totalEnviados = inboxes.length;
    const totalAbertos = inboxes.filter(i => i.visualizado_em).length;
    const totalConcluidos = inboxes.filter(i => i.status_leitura === 'CONCLUIDO').length;
    const totalBloqueados = inboxes.filter(i => i.status_leitura === 'BLOQUEADO').length;

    const dadosFiltrados = useMemo(() => {
        return inboxes.filter(i => {
            const matchBusca = i.nome.toLowerCase().includes(busca.toLowerCase()) || i.email_usuario.toLowerCase().includes(busca.toLowerCase());
            const matchStatus = filtroStatus === 'TODOS' || i.status_leitura === filtroStatus;
            return matchBusca && matchStatus;
        });
    }, [inboxes, busca, filtroStatus]);

    const totalPaginas = Math.ceil(dadosFiltrados.length / ITENS_POR_PAGINA);
    const dadosPaginados = dadosFiltrados.slice((pagina - 1) * ITENS_POR_PAGINA, pagina * ITENS_POR_PAGINA);

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/70 dark:bg-[#111827]/60 backdrop-blur-2xl p-6 rounded-[32px] border border-slate-200/50 dark:border-white/5 shadow-sm">
                <div>
                    <button onClick={onVoltar} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 transition-colors mb-4">
                        <ArrowLeft className="w-3.5 h-3.5" /> Voltar para Central
                    </button>
                    <div className="flex items-center gap-3 mb-1">
                        <span className="bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border border-blue-200 dark:border-blue-500/20">
                            {comunicado.tipo}
                        </span>
                        <span className="text-xs font-bold text-slate-400">{new Date(comunicado.inicio_em).toLocaleDateString(langAtual)}</span>
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{comunicado.titulo_pt || comunicado.titulo}</h2>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/80 dark:bg-[#111827]/80 p-5 rounded-2xl border border-slate-200/50 dark:border-white/5 shadow-sm flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><Users className="w-3.5 h-3.5" /> Enviados</span>
                    <span className="text-3xl font-black text-slate-800 dark:text-white">{loading ? '-' : totalEnviados}</span>
                </div>
                <div className="bg-white/80 dark:bg-[#111827]/80 p-5 rounded-2xl border border-slate-200/50 dark:border-white/5 shadow-sm flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><Eye className="w-3.5 h-3.5" /> Abertos</span>
                    <span className="text-3xl font-black text-blue-600 dark:text-blue-400">{loading ? '-' : totalAbertos}</span>
                </div>
                <div className="bg-white/80 dark:bg-[#111827]/80 p-5 rounded-2xl border border-slate-200/50 dark:border-white/5 shadow-sm flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><CheckCircle className="w-3.5 h-3.5" /> Concluídos</span>
                    <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{loading ? '-' : totalConcluidos}</span>
                </div>
                <div className="bg-white/80 dark:bg-[#111827]/80 p-5 rounded-2xl border border-rose-200/50 dark:border-rose-500/20 shadow-sm flex flex-col bg-rose-50/30 dark:bg-rose-500/5">
                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-1.5 mb-1"><Lock className="w-3.5 h-3.5" /> Bloqueados (Falhas)</span>
                    <span className="text-3xl font-black text-rose-600 dark:text-rose-400">{loading ? '-' : totalBloqueados}</span>
                </div>
            </div>

            <div className="bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-[32px] border border-slate-200/70 dark:border-white/10 shadow-sm overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-200/50 dark:border-white/5 flex flex-col sm:flex-row gap-4 justify-between bg-slate-50/50 dark:bg-black/10">
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" placeholder="Buscar destinatário..." value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} className="w-full bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold text-slate-700 dark:text-white outline-none focus:border-blue-500" />
                    </div>
                    <select value={filtroStatus} onChange={(e) => { setFiltroStatus(e.target.value); setPagina(1); }} className="w-full sm:w-48 bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-white outline-none cursor-pointer">
                        <option value="TODOS">Todos os Status</option>
                        <option value="CONCLUIDO">Concluídos</option>
                        <option value="PENDENTE">Pendentes</option>
                        <option value="NAO_LIDO">Não Lidos</option>
                        <option value="BLOQUEADO">Bloqueados</option>
                    </select>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
                    ) : (
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200/50 dark:border-white/5">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Destinatário</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Tentativas</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ação de Auditoria</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dadosPaginados.map(item => (
                                    <tr key={item.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">{item.nome}</p>
                                            <p className="text-[10px] font-semibold text-slate-500 mt-0.5">{item.email_usuario} • {item.unidade}</p>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${item.tentativas >= 5 ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20' : item.tentativas > 0 ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20' : 'bg-slate-100 text-slate-400 dark:bg-white/5'}`}>
                                                {item.tentativas}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${
                                                item.status_leitura === 'CONCLUIDO' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20' :
                                                item.status_leitura === 'BLOQUEADO' ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20' :
                                                item.status_leitura === 'PENDENTE' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20' :
                                                'bg-slate-100 text-slate-500 border-slate-200 dark:bg-white/5 dark:border-white/10 dark:text-slate-400'
                                            }`}>
                                                {item.status_leitura}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {item.status_leitura === 'BLOQUEADO' ? (
                                                <button onClick={() => handleResetarTentativas(item.id, item.nome)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:border-rose-500/30 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors shadow-sm">
                                                    <Unlock className="w-3.5 h-3.5" /> Liberar
                                                </button>
                                            ) : (
                                                <span className="text-[10px] font-bold text-slate-400 italic">Sem ação pendente</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {dadosPaginados.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-12 text-center text-sm font-bold text-slate-400 uppercase tracking-widest">
                                            Nenhum destinatário encontrado.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {totalPaginas > 1 && (
                    <div className="p-4 border-t border-slate-200/50 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-black/10">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Página {pagina} de {totalPaginas}</span>
                        <div className="flex gap-2">
                            <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1} className="p-1.5 rounded-lg bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-white/10 text-slate-500 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-white/5"><ChevronLeft className="w-4 h-4" /></button>
                            <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas} className="p-1.5 rounded-lg bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-white/10 text-slate-500 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-white/5"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}


export default function CentralComunicados({ usuarioLogado, unidades }) {
    const { t, locale, language } = useI18n(); 
    const langAtual = locale || language || 'pt-BR';
    
    const [modo, setModo] = useState('lista'); 
    const [filtroTexto, setFiltroTexto] = useState('');
    const [cardsUnificados, setCardsUnificados] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [visualizando, setVisualizando] = useState(null); 
    const [comunicadoParaRelatorio, setComunicadoParaRelatorio] = useState(null);

    const isGestor = ['ADMIN', 'MENTOR'].includes(usuarioLogado?.role);

    const fetchDados = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const emailReal = user?.email;
            if (!emailReal) return;

            const mapCards = new Map();

            const { data: inbox, error: errInbox } = await supabase
                .from('comunicado_inbox')
                .select(`
                    id, status_leitura,
                    comunicados!inner (*)
                `)
                .eq('email_usuario', emailReal)
                .is('comunicados.deleted_at', null)
                .lte('comunicados.inicio_em', new Date().toISOString());

            if (errInbox) throw errInbox;

            if (inbox) {
                inbox.forEach(i => {
                    if (!i.comunicados) return;
                    mapCards.set(i.comunicados.id, {
                        comunicado: i.comunicados,
                        inboxStatus: i.status_leitura,
                        inboxId: i.id,
                        isAuthor: false,
                        metrics: null
                    });
                });
            }

            if (isGestor) {
                // 🔥 CORREÇÃO FATAL DO ADMIN: Agora a ordenação é por inicio_em e o React nunca mais crasha!
                let query = supabase.from('comunicados').select('*').is('deleted_at', null).order('inicio_em', { ascending: false });
                if (usuarioLogado.role === 'MENTOR') query = query.eq('criado_por', emailReal);
                
                const { data: authored } = await query;
                
                if (authored && authored.length > 0) {
                    const idsAuthored = authored.map(a => a.id);
                    const { data: metricasView } = await supabase
                        .from('vw_comunicados_metricas')
                        .select('*')
                        .in('comunicado_id', idsAuthored);

                    const mapMetricas = {};
                    if (metricasView) {
                        metricasView.forEach(m => { mapMetricas[m.comunicado_id] = m; });
                    }

                    authored.forEach(com => {
                        const m = mapMetricas[com.id] || { total_enviados: 0, total_abertos: 0, total_pendentes: 0, total_concluidos: 0, total_bloqueados: 0 };
                        const metrics = {
                            total: m.total_enviados,
                            lidos: m.total_abertos,
                            pendentes: m.total_pendentes,
                            concluidos: m.total_concluidos,
                            bloqueados: m.total_bloqueados
                        };

                        if (mapCards.has(com.id)) {
                            const existing = mapCards.get(com.id);
                            existing.isAuthor = true;
                            existing.metrics = metrics;
                        } else {
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

            const arrayFinal = Array.from(mapCards.values()).sort((a, b) => new Date(b.comunicado.inicio_em) - new Date(a.comunicado.inicio_em));
            setCardsUnificados(arrayFinal);

        } catch (error) {
            console.error("Erro ao buscar comunicados:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (modo === 'lista') fetchDados();
    }, [modo]);

    const excluirComunicado = async (e, comunicadoId, titulo) => {
        e.stopPropagation(); 
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
        if (card.inboxId && card.inboxStatus === 'NAO_LIDO') {
            await supabase.from('comunicado_inbox').update({ status_leitura: 'PENDENTE', visualizado_em: new Date().toISOString() }).eq('id', card.inboxId);
            fetchDados(); 
        }
    };

    const abrirRelatorio = (e, comunicado) => {
        e.stopPropagation();
        setComunicadoParaRelatorio(comunicado);
        setModo('relatorio');
    };

    const getTextoLocalizado = (com, campo) => {
        if (!com) return '';
        try {
            const currentLang = langAtual.split('-')[0];
            if (currentLang === 'en' && com[`${campo}_en`]) return com[`${campo}_en`];
            if (currentLang === 'es' && com[`${campo}_es`]) return com[`${campo}_es`];
            return com[`${campo}_pt`] || com[campo] || '';
        } catch (e) {
            return com[campo] || '';
        }
    };

    if (modo === 'criar') {
        return <FormularioComunicado usuarioLogado={usuarioLogado} unidades={unidades} onVoltar={() => setModo('lista')} onSalvo={() => { setModo('lista'); fetchDados(); }} />;
    }

    if (modo === 'relatorio' && comunicadoParaRelatorio) {
        return <RelatorioComunicado comunicado={comunicadoParaRelatorio} usuarioLogado={usuarioLogado} onVoltar={() => { setComunicadoParaRelatorio(null); setModo('lista'); fetchDados(); }} />;
    }

    const cardsVisiveis = cardsUnificados.filter(c => {
        try {
            return getTextoLocalizado(c.comunicado, 'titulo').toLowerCase().includes(filtroTexto.toLowerCase());
        } catch(e) { return false; }
    });

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] max-w-[1400px] mx-auto font-sans pb-10">
            
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

            {loading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
            ) : cardsVisiveis.length === 0 ? (
                <div className="col-span-full py-20 flex flex-col items-center justify-center opacity-50">
                    <Megaphone className="w-16 h-16 text-slate-400 mb-4" strokeWidth={1} />
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{t('communications.empty', {defaultValue: 'Nenhum comunicado encontrado.'})}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {cardsVisiveis.map(card => {
                        const com = card.comunicado;
                        const isUnread = card.inboxStatus === 'NAO_LIDO';
                        const isPending = card.inboxStatus === 'PENDENTE';
                        const isBlocked = card.inboxStatus === 'BLOQUEADO';
                        const isCompleted = card.inboxStatus === 'CONCLUIDO';
                        const isAuthor = card.isAuthor;

                        return (
                            <div key={com.id} className="bg-white/90 dark:bg-[#111827]/80 backdrop-blur-xl border border-slate-200/70 dark:border-white/10 shadow-sm rounded-3xl p-5 flex flex-col relative transition-all hover:shadow-lg">
                                
                                {(isUnread || isPending) && !isAuthor && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>}
                                {isBlocked && !isAuthor && <div className="absolute top-0 left-0 w-full h-1 bg-rose-500"></div>}
                                {isAuthor && <div className="absolute top-0 left-0 w-full h-1 bg-slate-300 dark:bg-white/20"></div>}

                                <div className="flex justify-between items-start mb-3">
                                    <span className="px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border flex items-center gap-1.5 bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10">
                                        {com.tipo === 'INFORMATIVO' ? <Info className="w-3 h-3" /> : <HelpCircle className="w-3 h-3" />} {com.tipo}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(com.inicio_em).toLocaleDateString(langAtual)}</span>
                                </div>

                                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight line-clamp-1 mb-1" title={getTextoLocalizado(com, 'titulo')}>
                                    {getTextoLocalizado(com, 'titulo')}
                                </h3>
                                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 flex-1">
                                    {getTextoLocalizado(com, 'conteudo')}
                                </p>

                                {!isAuthor && (
                                    <div className="mb-4">
                                        {isCompleted && <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"><CheckCircle className="w-3 h-3"/> Concluído</span>}
                                        {isPending && <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"><Loader2 className="w-3 h-3 animate-spin"/> Pendente</span>}
                                        {isBlocked && <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20"><Lock className="w-3 h-3"/> Bloqueado</span>}
                                        {isUnread && <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span> Não Lido</span>}
                                    </div>
                                )}

                                {isAuthor && card.metrics && (
                                    <div className="mb-4 py-3 border-t border-b border-slate-100 dark:border-white/5 grid grid-cols-4 gap-1 text-center">
                                        <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Enviados</span><span className="text-xs font-black text-slate-700 dark:text-slate-200">{card.metrics.total}</span></div>
                                        <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Abertos</span><span className="text-xs font-black text-blue-600 dark:text-blue-400">{card.metrics.lidos}</span></div>
                                        <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Ok</span><span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{card.metrics.concluidos}</span></div>
                                        <div className="flex flex-col"><span className="text-[8px] font-black text-rose-400 uppercase tracking-widest">Block</span><span className="text-xs font-black text-rose-600 dark:text-rose-400">{card.metrics.bloqueados}</span></div>
                                    </div>
                                )}

                                <div className="flex items-center justify-end gap-2 mt-auto">
                                    <button onClick={() => abrirViewer(card)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-1.5">
                                        <Eye className="w-3.5 h-3.5" /> Ver
                                    </button>
                                    
                                    {isAuthor && (
                                        <>
                                            <button onClick={(e) => abrirRelatorio(e, com)} className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:hover:bg-indigo-500/20 dark:text-indigo-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-1.5">
                                                <BarChart3 className="w-3.5 h-3.5" /> Relatório
                                            </button>
                                            <button onClick={(e) => excluirComunicado(e, com.id, getTextoLocalizado(com, 'titulo'))} className="p-2 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-transparent hover:border-rose-100 dark:bg-transparent dark:hover:bg-rose-500/10 dark:hover:border-rose-500/20 dark:hover:text-rose-400 rounded-xl transition-all" title="Excluir">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {visualizando && (() => {
                const com = visualizando.comunicado;
                const getEmbedUrl = (url) => {
                    if (!url) return null;
                    try {
                        const urlObj = new URL(url);
                        if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) return `https://www.youtube.com/embed/${urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop()}`;
                        if (urlObj.hostname.includes('vimeo.com')) return `https://player.vimeo.com/video/${urlObj.pathname.split('/').pop()}`;
                        return null;
                    } catch (e) { return null; }
                };
                const urlVideoExterno = getEmbedUrl(com.video_externo);

                return (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 dark:bg-slate-950/95 backdrop-blur-xl p-4 sm:p-8 animate-[fadeIn_0.2s_ease-out]">
                        <div className="bg-white dark:bg-[#0c101a] w-full max-w-4xl max-h-[90vh] rounded-[32px] shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden animate-[slideDown_0.3s_ease-out]">
                            
                            <div className="flex justify-between items-center p-6 border-b border-slate-200/50 dark:border-white/5 bg-slate-50/50 dark:bg-[#090b11]/50 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl"><Eye className="w-5 h-5" /></div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">VISUALIZAÇÃO DE CONTEÚDO</p>
                                        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{new Date(com.inicio_em).toLocaleString(langAtual)}</p>
                                    </div>
                                </div>
                                <button onClick={() => setVisualizando(null)} className="p-2 bg-slate-200/50 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-500 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 bg-white dark:bg-transparent">
                                <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-6">{getTextoLocalizado(com, 'titulo')}</h1>
                                <div className="text-sm md:text-base font-semibold text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap mb-10">{getTextoLocalizado(com, 'conteudo')}</div>

                                <div className="space-y-6 mb-10">
                                    {com.imagem_url && <img src={com.imagem_url} alt="Banner" className="w-full h-auto rounded-3xl shadow-md object-cover border border-slate-200 dark:border-white/5" />}
                                    {com.pdf_url && (
                                        <div className="flex items-center justify-between p-5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 rounded-xl flex items-center justify-center"><FileText className="w-6 h-6" /></div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-800 dark:text-white uppercase">Documento Anexo</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Formato PDF</p>
                                                </div>
                                            </div>
                                            <a href={com.pdf_url} target="_blank" rel="noreferrer" className="px-5 py-2.5 bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-colors shadow-sm">Abrir Arquivo</a>
                                        </div>
                                    )}
                                    {com.video_url && (
                                        <div className="rounded-3xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-md bg-black">
                                            <video controls className="w-full h-auto max-h-[500px]"><source src={com.video_url} type="video/mp4" /></video>
                                        </div>
                                    )}
                                    {urlVideoExterno && (
                                        <div className="relative w-full overflow-hidden rounded-3xl border border-slate-200 dark:border-white/10 shadow-md bg-black" style={{ paddingTop: '56.25%' }}>
                                            <iframe className="absolute top-0 left-0 w-full h-full" src={urlVideoExterno} title="Video" frameBorder="0" allowFullScreen></iframe>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-8 p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest text-center">
                                    <Info className="w-5 h-5" />
                                    Esta é apenas a visualização de mídia.<br/>A interação com o comunicado (Confirmação/Prova) ocorre no momento do Bloqueio de Tela do Usuário.
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}