import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { ShieldAlert, CheckCircle, HelpCircle, Loader2, AlertTriangle, FileText, Lock } from 'lucide-react';

export default function BlockingGate({ comunicadoBloqueante, onConcluido }) {
    const { t, locale, language } = useI18n(); // 🛡️ Proteção dupla de idioma
    const langAtual = locale || language || 'pt-BR';

    const [respostasSelecionadas, setRespostasSelecionadas] = useState({});
    const [validando, setValidando] = useState(false);
    
    const [resultado, setResultado] = useState(null);
    const [bloqueioFatal, setBloqueioFatal] = useState(false);

    useEffect(() => {
        setResultado(null);
        setRespostasSelecionadas({});
        setBloqueioFatal(false);
    }, [comunicadoBloqueante?.id]);

    if (!comunicadoBloqueante) return null;

    // 🔥 BLINDAGEM DE TEXTO 
    const getTextoLocalizado = (campo) => {
        if (!comunicadoBloqueante) return '';
        try {
            const currentLang = langAtual.split('-')[0];
            if (currentLang === 'en' && comunicadoBloqueante[`${campo}_en`]) return comunicadoBloqueante[`${campo}_en`];
            if (currentLang === 'es' && comunicadoBloqueante[`${campo}_es`]) return comunicadoBloqueante[`${campo}_es`];
            return comunicadoBloqueante[`${campo}_pt`] || comunicadoBloqueante[campo] || '';
        } catch (e) {
            return comunicadoBloqueante[campo] || '';
        }
    };

    const getEmbedUrl = (url) => {
        if (!url) return null;
        try {
            const urlObj = new URL(url);
            if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
                const videoId = urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop();
                return `https://www.youtube.com/embed/${videoId}`;
            }
            if (urlObj.hostname.includes('vimeo.com')) {
                const videoId = urlObj.pathname.split('/').pop();
                return `https://player.vimeo.com/video/${videoId}`;
            }
            return null;
        } catch (e) { return null; }
    };

    const isQuestionario = comunicadoBloqueante.tipo === 'QUESTIONARIO';
    
    let perguntas = [];
    if (isQuestionario) {
        if (comunicadoBloqueante.perguntas_json && comunicadoBloqueante.perguntas_json.length > 0) {
            perguntas = comunicadoBloqueante.perguntas_json;
        } else if (comunicadoBloqueante.alternativas && comunicadoBloqueante.alternativas.length > 0) {
            perguntas = [{ id: 'legacy', pergunta: 'Selecione a resposta correta para o comunicado acima:', alternativas: comunicadoBloqueante.alternativas }];
        }
    }

    const formularioCompleto = isQuestionario ? Object.keys(respostasSelecionadas).length === perguntas.length && perguntas.length > 0 : true;

    const toggleResposta = (perguntaId, alternativa) => {
        if (bloqueioFatal) return;
        setRespostasSelecionadas(prev => ({ ...prev, [perguntaId]: alternativa }));
        setResultado(null);
    };

    const submeter = async () => {
        setValidando(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const payloadRespostas = isQuestionario ? respostasSelecionadas : { confirmacao: 'CIENTE' };

            const { data, error } = await supabase.rpc('validar_resposta_comunicado', {
                p_comunicado_id: comunicadoBloqueante.id,
                p_email_usuario: user.email,
                p_respostas: payloadRespostas
            });

            if (error) throw error;
            setResultado(data);

            if (data.bloqueado) {
                setBloqueioFatal(true);
            }

            if (data.sucesso && onConcluido) {
                setTimeout(() => { onConcluido(); }, 1200);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setValidando(false);
        }
    };

    const urlVideoExterno = getEmbedUrl(comunicadoBloqueante.video_externo);

    return (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] bg-slate-900/90 dark:bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-8 animate-[fadeIn_0.3s_ease-out]">
            <div className={`bg-white dark:bg-[#0c101a] w-full max-w-4xl max-h-full rounded-[32px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)] border transition-colors flex flex-col overflow-hidden animate-[slideDown_0.4s_ease-out] ${bloqueioFatal ? 'border-rose-500/50' : 'border-blue-500/30'}`}>
                
                <div className={`flex items-center gap-4 p-6 border-b shrink-0 transition-colors ${bloqueioFatal ? 'border-rose-200 dark:border-rose-900/30 bg-rose-50 dark:bg-rose-500/10' : 'border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-500/5'}`}>
                    <div className={`p-3 rounded-2xl animate-pulse shadow-inner ${bloqueioFatal ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'}`}>
                        {bloqueioFatal ? <Lock className="w-7 h-7" /> : <AlertTriangle className="w-7 h-7" />}
                    </div>
                    <div>
                        <h2 className={`text-base font-black uppercase tracking-widest leading-none mb-1 ${bloqueioFatal ? 'text-rose-700 dark:text-rose-400' : 'text-blue-700 dark:text-blue-400'}`}>
                            {bloqueioFatal ? 'SISTEMA BLOQUEADO' : t('communications.mandatoryNotice', { defaultValue: 'Aviso Operacional Obrigatório' })}
                        </h2>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            {bloqueioFatal ? 'Você atingiu o limite de tentativas de resposta.' : 'A navegação foi interrompida para leitura deste documento.'}
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 bg-white dark:bg-transparent">
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-6">
                        {getTextoLocalizado('titulo')}
                    </h1>
                    <div className="text-sm md:text-base font-semibold text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap mb-10">
                        {getTextoLocalizado('conteudo')}
                    </div>

                    <div className="space-y-6 mb-10">
                        {comunicadoBloqueante.imagem_url && <img src={comunicadoBloqueante.imagem_url} alt="Comunicado" className="w-full h-auto rounded-3xl shadow-md object-cover border border-slate-200 dark:border-white/5" />}

                        {comunicadoBloqueante.pdf_url && (
                            <div className="flex items-center justify-between p-5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 rounded-xl flex items-center justify-center">
                                        <FileText className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-slate-800 dark:text-white uppercase">Documento Anexo</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Formato PDF</p>
                                    </div>
                                </div>
                                <a href={comunicadoBloqueante.pdf_url} target="_blank" rel="noreferrer" className="px-5 py-2.5 bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-colors shadow-sm">Abrir Documento</a>
                            </div>
                        )}

                        {comunicadoBloqueante.video_url && (
                            <div className="rounded-3xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-md bg-black">
                                <video controls className="w-full h-auto max-h-[500px]">
                                    <source src={comunicadoBloqueante.video_url} type="video/mp4" />
                                </video>
                            </div>
                        )}

                        {urlVideoExterno && (
                            <div className="relative w-full overflow-hidden rounded-3xl border border-slate-200 dark:border-white/10 shadow-md bg-black" style={{ paddingTop: '56.25%' }}>
                                <iframe className="absolute top-0 left-0 w-full h-full" src={urlVideoExterno} title="YouTube video" frameBorder="0" allowFullScreen></iframe>
                            </div>
                        )}
                    </div>

                    <div className="bg-slate-50/80 dark:bg-[#121826] p-8 rounded-[32px] border border-slate-200/80 dark:border-white/5 shadow-inner">
                        
                        {isQuestionario && (
                            <div className="space-y-8">
                                <div className="border-b border-slate-200 dark:border-white/5 pb-4 mb-4">
                                    <p className="text-sm font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest flex items-center gap-2">
                                        <HelpCircle className="w-5 h-5" /> Responda para liberar o acesso:
                                    </p>
                                </div>
                                
                                {perguntas.map((perg, pIdx) => {
                                    const temErro = resultado && !resultado.sucesso && resultado.erros?.includes(perg.id);
                                    
                                    return (
                                        <div key={perg.id} className={`p-6 rounded-2xl border transition-all ${temErro ? 'bg-rose-50/50 border-rose-300 dark:bg-rose-500/5 dark:border-rose-500/50' : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10'}`}>
                                            <p className={`text-sm font-black uppercase tracking-tight mb-5 ${temErro ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                                <span className="opacity-50 mr-2">{pIdx + 1}.</span>{perg.pergunta}
                                            </p>
                                            
                                            <div className="space-y-3">
                                                {perg.alternativas?.map((alt, aIdx) => {
                                                    const isSelecionada = respostasSelecionadas[perg.id] === alt;
                                                    return (
                                                        <div key={aIdx} onClick={() => toggleResposta(perg.id, alt)} className={`flex items-center gap-4 p-4 border rounded-xl transition-all ${bloqueioFatal ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${isSelecionada ? 'bg-purple-50 border-purple-500 dark:bg-purple-500/10' : 'bg-white dark:bg-transparent border-slate-200 dark:border-white/10 hover:border-purple-300'}`}>
                                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelecionada ? 'border-purple-600 bg-purple-600 dark:border-purple-500 dark:bg-purple-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                                                {isSelecionada && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                                            </div>
                                                            <span className={`text-sm font-bold ${isSelecionada ? 'text-purple-900 dark:text-purple-300' : 'text-slate-600 dark:text-slate-400'}`}>{alt}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}

                                {resultado && !resultado.sucesso && (
                                    <div className={`p-5 rounded-2xl flex items-start gap-4 text-sm font-bold border animate-[shake_0.4s_ease-in-out] ${bloqueioFatal ? 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40' : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                                        <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5" />
                                        <div className="flex-1 leading-relaxed">
                                            {resultado.mensagem}
                                        </div>
                                    </div>
                                )}

                                {!bloqueioFatal && (
                                    <button 
                                        onClick={submeter}
                                        disabled={validando || !formularioCompleto || resultado?.sucesso}
                                        className="w-full mt-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black uppercase tracking-widest py-5 rounded-2xl shadow-lg transition-all flex justify-center items-center gap-3 text-sm disabled:opacity-50 active:scale-[0.98]"
                                    >
                                        {validando ? <Loader2 className="w-5 h-5 animate-spin" /> : resultado?.sucesso ? 'Acesso Liberado!' : 'Confirmar Respostas'}
                                    </button>
                                )}
                            </div>
                        )}

                        {!isQuestionario && (
                            <div className="text-center space-y-6">
                                {resultado && !resultado.sucesso && (
                                    <div className="p-4 rounded-xl flex items-center justify-center gap-3 text-sm font-bold bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400">
                                        <ShieldAlert className="w-5 h-5" /> Erro ao registrar confirmação.
                                    </div>
                                )}
                                
                                <button 
                                    onClick={submeter}
                                    disabled={validando || resultado?.sucesso}
                                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black uppercase tracking-widest py-5 rounded-2xl shadow-lg transition-all flex justify-center items-center gap-3 text-sm disabled:opacity-50 active:scale-[0.98]"
                                >
                                    {validando ? <Loader2 className="w-5 h-5 animate-spin" /> : resultado?.sucesso ? <><CheckCircle className="w-5 h-5" /> Acesso Liberado!</> : <><CheckCircle className="w-5 h-5" /> Li e estou ciente</>}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}