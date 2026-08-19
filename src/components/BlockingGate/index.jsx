import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { ShieldAlert, CheckCircle, HelpCircle, Loader2, AlertTriangle, Info } from 'lucide-react';

export default function BlockingGate() {
    const { t, locale } = useI18n();
    const [comunicado, setComunicado] = useState(null);
    const [respostaSelecionada, setRespostaSelecionada] = useState('');
    const [validando, setValidando] = useState(false);
    const [resultado, setResultado] = useState(null);

    useEffect(() => {
        let isMounted = true;
        let timeoutId = null;

        const checkComunicados = async () => {
            try {
                // 1. Identidade Blindada: Busca do Supabase Auth, ignora atrasos de state do React
                const { data: authData, error: authError } = await supabase.auth.getUser();
                if (authError || !authData?.user?.email) return;
                const emailReal = authData.user.email;

                // 2. Busca comunicados obrigatórios da Caixa de Entrada do usuário
                const { data, error } = await supabase
                    .from('comunicado_inbox')
                    .select(`
                        id, status_leitura,
                        comunicados!inner (
                            id, titulo_pt, conteudo_pt, titulo_en, conteudo_en, titulo_es, conteudo_es,
                            imagem_url, tipo, obrigatorio, bloqueia_operacao, alternativas, inicio_em, deleted_at, status
                        )
                    `)
                    .eq('email_usuario', emailReal)
                    .eq('comunicados.obrigatorio', true)
                    .eq('comunicados.status', 'ATIVO')
                    .is('comunicados.deleted_at', null)
                    .in('status_leitura', ['NAO_LIDO', 'PENDENTE']);

                if (error || !isMounted) return;

                const agora = new Date();
                const pendentes = [];
                let proximoAgendamento = null;

                data.forEach(inboxItem => {
                    const com = inboxItem.comunicados;
                    const inicio = new Date(com.inicio_em);
                    
                    if (inicio <= agora) {
                        pendentes.push({ inbox_id: inboxItem.id, ...com });
                    } else {
                        // Calcula o futuro mais próximo
                        if (!proximoAgendamento || inicio < proximoAgendamento) {
                            proximoAgendamento = inicio;
                        }
                    }
                });

                // Ordena: os que estão esperando há mais tempo aparecem primeiro
                pendentes.sort((a, b) => new Date(a.inicio_em) - new Date(b.inicio_em));

                if (pendentes.length > 0) {
                    // SE NÃO BLOQUEIA OPERAÇÃO, não mostra o Gate global de cárcere (a regra atual diz que Gate é só pra bloqueantes)
                    // Se você quer que obrigatórios não-bloqueantes também saltem no login, remova o `.eq('comunicados.bloqueia_operacao', true)` da query.
                    // Para respeitar o "bloqueia_operacao", filtramos:
                    const bloqueantes = pendentes.filter(p => p.bloqueia_operacao);
                    if (bloqueantes.length > 0) {
                        setComunicado(bloqueantes[0]); 
                    } else {
                        setComunicado(null);
                    }
                } else {
                    setComunicado(null);
                    setResultado(null);
                    setRespostaSelecionada('');
                }

                // 3. Temporizador Inteligente (O usuário está logado às 12h59 e o aviso é 13h)
                if (pendentes.length === 0 && proximoAgendamento) {
                    const delay = proximoAgendamento.getTime() - Date.now() + 1000;
                    if (delay > 0 && delay < 2147483647) { 
                        timeoutId = setTimeout(checkComunicados, delay);
                    }
                }

            } catch (err) {
                console.error("Erro no BlockingGate:", err);
            }
        };

        checkComunicados();

        // 4. Realtime: Reage se o Admin apagar um aviso enquanto o usuário lê
        const channel = supabase.channel('gate-realtime-global')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'comunicados' }, checkComunicados)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'comunicado_inbox' }, checkComunicados)
            .subscribe();

        return () => {
            isMounted = false;
            if (timeoutId) clearTimeout(timeoutId);
            supabase.removeChannel(channel);
        };
    }, []);

    if (!comunicado) return null;

    const getTextoLocalizado = (campo) => {
        const lang = locale.split('-')[0];
        if (lang === 'en' && comunicado[`${campo}_en`]) return comunicado[`${campo}_en`];
        if (lang === 'es' && comunicado[`${campo}_es`]) return comunicado[`${campo}_es`];
        return comunicado[`${campo}_pt`];
    };

    const submeter = async (respostaStr) => {
        setValidando(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data, error } = await supabase.rpc('validar_resposta_comunicado', {
                p_comunicado_id: comunicado.id,
                p_email_usuario: user.email,
                p_resposta: respostaStr
            });

            if (error) throw error;
            
            setResultado(data);
            if (data.sucesso) {
                setTimeout(() => {
                    setComunicado(null);
                    setResultado(null);
                }, 1500);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setValidando(false);
        }
    };

    return (
        <div role="dialog" aria-modal="true" className="absolute inset-0 z-[40] bg-slate-900/70 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-[fadeIn_0.3s_ease-out]">
            <div className="bg-white dark:bg-[#111827] w-full max-w-2xl max-h-full rounded-[32px] shadow-[0_20px_60px_-15px_rgba(37,99,235,0.3)] border border-blue-500/20 dark:border-blue-500/30 flex flex-col overflow-hidden animate-[slideDown_0.4s_ease-out]">
                
                <div className="flex items-center gap-3 p-6 border-b border-blue-100 dark:border-white/5 bg-blue-50/50 dark:bg-blue-500/5 shrink-0">
                    <div className="p-2 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl animate-pulse">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest">
                            {t('communications.mandatoryNotice', { defaultValue: 'COMUNICADO IMPORTANTE' })}
                        </h2>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            {t('communications.operationalLock', { defaultValue: 'Ação obrigatória requerida' })}
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 bg-white dark:bg-transparent">
                    {comunicado.imagem_url && (
                        <img src={comunicado.imagem_url} alt="Comunicado" className="w-full h-auto rounded-2xl mb-6 shadow-md object-cover border border-slate-200 dark:border-white/5" />
                    )}

                    <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-4">
                        {getTextoLocalizado('titulo')}
                    </h1>
                    
                    <div className="text-sm md:text-base font-medium text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap mb-8">
                        {getTextoLocalizado('conteudo')}
                    </div>

                    <div className="bg-slate-50 dark:bg-[#0c101a] p-6 rounded-2xl border border-slate-200 dark:border-white/5">
                        
                        {/* Se for Questionário */}
                        {comunicado.tipo === 'QUESTIONARIO' && (
                            <div className="space-y-4">
                                <p className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                                    <HelpCircle className="w-4 h-4" /> {t('communications.quizSelect', {defaultValue: 'Selecione a resposta correta:'})}
                                </p>
                                
                                {comunicado.alternativas?.map((alt, idx) => (
                                    <label key={idx} className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${respostaSelecionada === alt ? 'bg-purple-50 border-purple-500 dark:bg-purple-500/10' : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-purple-300'}`}>
                                        <input type="radio" name="resposta" value={alt} checked={respostaSelecionada === alt} onChange={() => setRespostaSelecionada(alt)} className="w-4 h-4 text-purple-600 cursor-pointer" />
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{alt}</span>
                                    </label>
                                ))}

                                {resultado && (
                                    <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-bold ${resultado.sucesso ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400'}`}>
                                        {resultado.sucesso ? <CheckCircle className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                                        {resultado.mensagem}
                                    </div>
                                )}

                                <button 
                                    onClick={() => submeter(respostaSelecionada)}
                                    disabled={validando || !respostaSelecionada || resultado?.sucesso}
                                    className="w-full mt-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black uppercase tracking-widest py-4 rounded-xl shadow-md transition-all flex justify-center items-center gap-2 text-xs disabled:opacity-50"
                                >
                                    {validando ? <Loader2 className="w-4 h-4 animate-spin" /> : resultado?.sucesso ? t('communications.unlocked', {defaultValue: 'Concluído'}) : t('communications.btnSubmit', {defaultValue: 'Responder'})}
                                </button>
                            </div>
                        )}

                        {/* Se for Confirmação ou Informativo Obrigatório */}
                        {comunicado.tipo !== 'QUESTIONARIO' && (
                            <div className="text-center">
                                {resultado?.sucesso ? (
                                    <div className="p-4 bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                                        <CheckCircle className="w-5 h-5" /> {t('communications.unlocked', {defaultValue: 'Acesso Liberado'})}
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => submeter('CIENTE')}
                                        disabled={validando}
                                        className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black uppercase tracking-widest py-4 rounded-xl shadow-md transition-all flex justify-center items-center gap-2 text-xs disabled:opacity-50"
                                    >
                                        {validando ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4" /> {t('communications.btnUnderstand', {defaultValue: 'Li e estou ciente'})}</>}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}