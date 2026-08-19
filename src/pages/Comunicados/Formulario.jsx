import React, { useState } from 'react';
import { supabase } from '../../supabaseClient.js';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { 
    Send, Image as ImageIcon, CheckCircle, HelpCircle, 
    Info, Calendar, Clock, ArrowLeft, Loader2, Plus, Trash2, ShieldAlert
} from 'lucide-react';

export default function FormularioComunicado({ unidades = [], onVoltar, onSalvo }) {
    const { t } = useI18n();
    const [loading, setLoading] = useState(false);

    const [titulo, setTitulo] = useState('');
    const [conteudo, setConteudo] = useState('');
    const [tipo, setTipo] = useState('INFORMATIVO'); 
    const [obrigatorio, setObrigatorio] = useState(false);
    const [bloqueiaOperacao, setBloqueiaOperacao] = useState(false);
    const [alternativas, setAlternativas] = useState(['', '']);
    const [respostaCorreta, setRespostaCorreta] = useState('');
    const [tipoAlvo, setTipoAlvo] = useState('GLOBAL');
    const [valorAlvo, setValorAlvo] = useState('TODOS');
    const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
    const [horaInicio, setHoraInicio] = useState(new Date().toTimeString().slice(0, 5));
    const [dataExpira, setDataExpira] = useState('');
    const [arquivoBanner, setArquivoBanner] = useState(null);
    const [previewBanner, setPreviewBanner] = useState(null);

    const handleAdicionarAlternativa = () => { if (alternativas.length < 5) setAlternativas([...alternativas, '']); };
    const handleRemoverAlternativa = (idx) => {
        if (alternativas.length > 2) {
            const novas = alternativas.filter((_, i) => i !== idx);
            setAlternativas(novas);
            if (respostaCorreta === alternativas[idx]) setRespostaCorreta('');
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setArquivoBanner(file);
            setPreviewBanner(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!titulo.trim() || !conteudo.trim()) { alert('Preencha o título e o conteúdo.'); return; }
        if (tipo === 'QUESTIONARIO') {
            if (alternativas.filter(a => a.trim() !== '').length < 2) { alert('Mínimo de 2 alternativas.'); return; }
            if (!respostaCorreta.trim()) { alert('Selecione a alternativa correta.'); return; }
        }

        setLoading(true);

        try {
            // 🔥 SOLUÇÃO DEFINITIVA DO BUG 23502: Busca o e-mail real da sessão do Supabase (Impossível ser null se estiver logado)
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user?.email) throw new Error("Falha ao recuperar identidade de segurança. Refaça o login.");
            const emailReal = user.email;

            let imagemUrl = null;
            if (arquivoBanner) {
                const extensao = arquivoBanner.name.split('.').pop();
                const nomeArquivo = `${Date.now()}_${Math.random().toString(36).substring(7)}.${extensao}`;
                const { error: uploadError } = await supabase.storage.from('comunicados-media').upload(nomeArquivo, arquivoBanner);
                if (uploadError) throw uploadError;
                const { data: publicUrlData } = supabase.storage.from('comunicados-media').getPublicUrl(nomeArquivo);
                imagemUrl = publicUrlData.publicUrl;
            }

            const inicioEm = new Date(`${dataInicio}T${horaInicio}:00`).toISOString();
            const expiraEm = dataExpira ? new Date(`${dataExpira}T23:59:59`).toISOString() : null;

            const payloadComunicado = {
                tipo, obrigatorio,
                bloqueia_operacao: obrigatorio ? bloqueiaOperacao : false,
                titulo_pt: titulo.trim(), conteudo_pt: conteudo.trim(),
                alternativas: tipo === 'QUESTIONARIO' ? alternativas.filter(a => a.trim() !== '') : [],
                resposta_correta: tipo === 'QUESTIONARIO' ? respostaCorreta : null,
                imagem_url: imagemUrl, inicio_em: inicioEm, expira_em: expiraEm,
                criado_por: emailReal, status: 'ATIVO'
            };

            const { data: comData, error: comError } = await supabase.from('comunicados').insert([payloadComunicado]).select().single();
            if (comError) throw comError;

            const valorFinal = tipoAlvo === 'GLOBAL' ? 'TODOS' : valorAlvo;
            const { error: rpcError } = await supabase.rpc('gerar_snapshot_comunicado', { p_comunicado_id: comData.id, p_tipo_alvo: tipoAlvo, p_valor_alvo: valorFinal });
            if (rpcError) throw rpcError;

            onSalvo();
        } catch (err) {
            console.error(err);
            alert('Erro ao publicar: ' + (err.message || err));
        } finally {
            setLoading(false);
        }
    };

    const inputClasses = "w-full bg-white/70 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-white/10 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 outline-none transition-all shadow-sm";

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] max-w-4xl mx-auto pb-12 font-sans">
            <div className="flex flex-col gap-2 mb-8">
                <button onClick={onVoltar} className="w-fit flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 transition-colors bg-white/60 dark:bg-white/5 px-4 py-2 rounded-lg border border-slate-200/50 dark:border-white/5 shadow-sm backdrop-blur-md">
                    <ArrowLeft className="w-3.5 h-3.5" /> {t('communications.back', {defaultValue: 'Voltar'})}
                </button>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mt-2">{t('communications.new', {defaultValue: 'Novo Comunicado'})}</h2>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t('communications.subtitleAdmin', {defaultValue: 'Crie mensagens informativas, termos de aceite ou avaliações operacionais.'})}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                <section className="bg-white/70 dark:bg-[#111827]/65 backdrop-blur-2xl rounded-[32px] border border-white/80 dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] p-8">
                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-6 border-b border-slate-200/50 dark:border-white/5 pb-4 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center text-xs">1</span>
                        {t('communications.form.contentSection', {defaultValue: 'Conteúdo da Mensagem'})}
                    </h3>
                    <div className="space-y-5">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">{t('communications.form.titleLabel', {defaultValue: 'Título Principal'})}</label>
                            <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} required placeholder={t('communications.form.titlePlaceholder', {defaultValue: 'Ex: Nova Campanha de Vendas'})} className={inputClasses} />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">{t('communications.form.bodyLabel', {defaultValue: 'Conteúdo Detalhado'})}</label>
                            <textarea rows="5" value={conteudo} onChange={(e) => setConteudo(e.target.value)} required placeholder={t('communications.form.bodyPlaceholder', {defaultValue: 'Descreva as diretrizes...'})} className={`${inputClasses} resize-none`}></textarea>
                        </div>
                        <div className="pt-2">
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">{t('communications.form.bannerLabel', {defaultValue: 'Banner / Imagem (Opcional)'})}</label>
                            <div className="flex flex-col sm:flex-row items-center gap-4">
                                <label className="w-full sm:w-auto cursor-pointer border-2 border-dashed border-slate-300 dark:border-white/20 hover:border-blue-400 dark:hover:border-blue-400 bg-white/50 dark:bg-white/5 px-6 py-4 rounded-2xl flex items-center justify-center gap-3 transition-all text-sm font-bold text-slate-600 dark:text-slate-300 shadow-sm">
                                    <ImageIcon className="w-5 h-5 text-blue-500" /> {t('communications.form.selectFile', {defaultValue: 'Selecionar Arquivo'})}
                                    <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} className="hidden" />
                                </label>
                                {previewBanner && (
                                    <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-4 py-2 rounded-xl animate-[fadeIn_0.2s_ease-out]">
                                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{t('communications.form.fileSelected', {defaultValue: 'Imagem pronta'})}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="bg-white/70 dark:bg-[#111827]/65 backdrop-blur-2xl rounded-[32px] border border-white/80 dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] p-8">
                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-6 border-b border-slate-200/50 dark:border-white/5 pb-4 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center text-xs">2</span>
                        {t('communications.form.typeSection', {defaultValue: 'Comportamento do Comunicado'})}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                        <button type="button" onClick={() => setTipo('INFORMATIVO')} className={`p-5 rounded-2xl border text-left flex flex-col gap-2.5 transition-all ${tipo === 'INFORMATIVO' ? 'bg-blue-50 dark:bg-blue-600/10 border-blue-400 shadow-md shadow-blue-500/10 text-slate-900 dark:text-white' : 'bg-white/80 dark:bg-white/5 border-slate-200/70 dark:border-white/10 text-slate-500 hover:border-blue-300 dark:hover:border-white/30 shadow-sm'}`}>
                            <div className={`p-2 w-fit rounded-xl ${tipo === 'INFORMATIVO' ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-slate-100 dark:bg-white/10 text-slate-400'}`}>
                                <Info className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-black uppercase tracking-tight">{t('communications.form.typeInfo', {defaultValue: 'Informativo'})}</span>
                            <span className="text-[11px] font-semibold leading-tight opacity-80">{t('communications.form.typeInfoDesc', {defaultValue: 'Apenas leitura livre.'})}</span>
                        </button>
                        <button type="button" onClick={() => setTipo('CONFIRMACAO')} className={`p-5 rounded-2xl border text-left flex flex-col gap-2.5 transition-all ${tipo === 'CONFIRMACAO' ? 'bg-emerald-50 dark:bg-emerald-600/10 border-emerald-400 shadow-md shadow-emerald-500/10 text-slate-900 dark:text-white' : 'bg-white/80 dark:bg-white/5 border-slate-200/70 dark:border-white/10 text-slate-500 hover:border-emerald-300 dark:hover:border-white/30 shadow-sm'}`}>
                            <div className={`p-2 w-fit rounded-xl ${tipo === 'CONFIRMACAO' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-slate-100 dark:bg-white/10 text-slate-400'}`}>
                                <CheckCircle className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-black uppercase tracking-tight">{t('communications.form.typeConfirm', {defaultValue: 'Confirmação'})}</span>
                            <span className="text-[11px] font-semibold leading-tight opacity-80">{t('communications.form.typeConfirmDesc', {defaultValue: 'Exige confirmação.'})}</span>
                        </button>
                        <button type="button" onClick={() => setTipo('QUESTIONARIO')} className={`p-5 rounded-2xl border text-left flex flex-col gap-2.5 transition-all ${tipo === 'QUESTIONARIO' ? 'bg-amber-50 dark:bg-amber-600/10 border-amber-400 shadow-md shadow-amber-500/10 text-slate-900 dark:text-white' : 'bg-white/80 dark:bg-white/5 border-slate-200/70 dark:border-white/10 text-slate-500 hover:border-amber-300 dark:hover:border-white/30 shadow-sm'}`}>
                            <div className={`p-2 w-fit rounded-xl ${tipo === 'QUESTIONARIO' ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-slate-100 dark:bg-white/10 text-slate-400'}`}>
                                <HelpCircle className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-black uppercase tracking-tight">{t('communications.form.typeQuiz', {defaultValue: 'Questionário'})}</span>
                            <span className="text-[11px] font-semibold leading-tight opacity-80">{t('communications.form.typeQuizDesc', {defaultValue: 'Exige resposta correta.'})}</span>
                        </button>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-6 p-5 bg-slate-50/80 dark:bg-black/20 border border-slate-200/70 dark:border-white/5 rounded-2xl">
                        <label className="flex items-center gap-3 cursor-pointer group select-none">
                            <div className={`w-6 h-6 flex items-center justify-center rounded border transition-colors ${obrigatorio ? 'bg-blue-600 border-blue-600' : 'bg-white dark:bg-white/5 border-slate-300 dark:border-white/20 group-hover:border-blue-400'}`}>
                                {obrigatorio && <CheckCircle className="w-4 h-4 text-white" />}
                            </div>
                            <input type="checkbox" checked={obrigatorio} onChange={(e) => setObrigatorio(e.target.checked)} className="hidden" />
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">{t('communications.form.requireRead', {defaultValue: 'Tornar leitura obrigatória'})}</span>
                        </label>
                        {obrigatorio && (
                            <label className="flex items-center gap-3 cursor-pointer group select-none animate-[fadeIn_0.2s_ease-out]">
                                <div className={`w-6 h-6 flex items-center justify-center rounded border transition-colors ${bloqueiaOperacao ? 'bg-rose-500 border-rose-500' : 'bg-white dark:bg-white/5 border-slate-300 dark:border-white/20 group-hover:border-rose-400'}`}>
                                    {bloqueiaOperacao && <ShieldAlert className="w-4 h-4 text-white" />}
                                </div>
                                <input type="checkbox" checked={bloqueiaOperacao} onChange={(e) => setBloqueiaOperacao(e.target.checked)} className="hidden" />
                                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">{t('communications.form.blockScreen', {defaultValue: 'Bloquear navegação'})}</span>
                            </label>
                        )}
                    </div>
                    {tipo === 'QUESTIONARIO' && (
                        <div className="mt-6 space-y-4 animate-[fadeIn_0.3s_ease-out]">
                            <label className="block text-[11px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest mb-3 ml-1">{t('communications.form.quizLabel', {defaultValue: 'Alternativas'})}</label>
                            {alternativas.map((alt, idx) => (
                                <div key={idx} className="flex items-center gap-3">
                                    <div onClick={() => setRespostaCorreta(alt)} className={`w-6 h-6 flex-shrink-0 rounded-full border-2 cursor-pointer transition-all flex items-center justify-center ${respostaCorreta === alt && alt.trim() !== '' ? 'border-amber-500 bg-amber-500' : 'border-slate-300 dark:border-white/20 hover:border-amber-400'}`} title="Marcar como correta">
                                        {respostaCorreta === alt && alt.trim() !== '' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                    </div>
                                    <input type="text" value={alt} onChange={(e) => handleAlternativaChange(idx, e.target.value)} placeholder={`Opção ${idx + 1}`} className={inputClasses} />
                                    {alternativas.length > 2 && (
                                        <button type="button" onClick={() => handleRemoverAlternativa(idx)} className="p-3 bg-white/50 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors shadow-sm">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {alternativas.length < 5 && (
                                <button type="button" onClick={handleAdicionarAlternativa} className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest flex items-center gap-2 mt-4 hover:opacity-80 transition-opacity bg-amber-50 dark:bg-amber-500/10 px-4 py-2.5 rounded-lg border border-amber-200 dark:border-amber-500/20">
                                    <Plus className="w-4 h-4" /> {t('communications.form.quizAdd', {defaultValue: 'Adicionar'})}
                                </button>
                            )}
                        </div>
                    )}
                </section>

                <section className="bg-white/70 dark:bg-[#111827]/65 backdrop-blur-2xl rounded-[32px] border border-white/80 dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] p-8">
                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-6 border-b border-slate-200/50 dark:border-white/5 pb-4 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center text-xs">3</span>
                        {t('communications.form.targetSection', {defaultValue: 'Público e Agendamento'})}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">{t('communications.form.targetLabel', {defaultValue: 'Destinatários:'})}</label>
                            <select value={tipoAlvo} onChange={(e) => setTipoAlvo(e.target.value)} className={`${inputClasses} cursor-pointer`}>
                                <option value="GLOBAL" className="bg-white dark:bg-slate-900">{t('communications.form.targetAll', {defaultValue: 'Todos'})}</option>
                                <option value="ROLE" className="bg-white dark:bg-slate-900">{t('communications.form.targetRole', {defaultValue: 'Por Cargo'})}</option>
                                <option value="UNIDADE" className="bg-white dark:bg-slate-900">{t('communications.form.targetUnit', {defaultValue: 'Por Unidade'})}</option>
                            </select>
                        </div>
                        {tipoAlvo === 'ROLE' && (
                            <div className="animate-[fadeIn_0.2s_ease-out]">
                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Selecione o Cargo:</label>
                                <select value={valorAlvo} onChange={(e) => setValorAlvo(e.target.value)} className={`${inputClasses} cursor-pointer`}>
                                    <option value="RECEPCAO" className="bg-white dark:bg-slate-900">Recepção / Operacional</option>
                                    <option value="LIDER" className="bg-white dark:bg-slate-900">Líderes</option>
                                    <option value="MENTOR" className="bg-white dark:bg-slate-900">Mentores</option>
                                </select>
                            </div>
                        )}
                        {tipoAlvo === 'UNIDADE' && (
                            <div className="animate-[fadeIn_0.2s_ease-out]">
                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Selecione a Unidade:</label>
                                <select value={valorAlvo} onChange={(e) => setValorAlvo(e.target.value)} className={`${inputClasses} cursor-pointer uppercase`}>
                                    {unidades.map(u => <option key={u.id} value={u.nome} className="bg-white dark:bg-slate-900">{u.nome}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-6 border-t border-slate-200/50 dark:border-white/5">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {t('communications.form.startDate', {defaultValue: 'Início'})}</label>
                            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} required className={inputClasses} />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {t('communications.form.startTime', {defaultValue: 'Hora'})}</label>
                            <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} required className={inputClasses} />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1 flex items-center gap-1.5 opacity-70"><Calendar className="w-3.5 h-3.5" /> {t('communications.form.expireDate', {defaultValue: 'Expiração'})}</label>
                            <input type="date" value={dataExpira} onChange={(e) => setDataExpira(e.target.value)} className={inputClasses} />
                        </div>
                    </div>
                </section>

                <button 
                    type="submit" disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black uppercase tracking-widest py-5 rounded-[20px] shadow-[0_10px_40px_-10px_rgba(37,99,235,0.6)] active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-sm disabled:opacity-50"
                >
                    {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> {t('communications.form.saving', {defaultValue: 'Salvando...'})}</> : <><Send className="w-5 h-5" /> {t('communications.form.publish', {defaultValue: 'Publicar'})}</>}
                </button>
            </form>
        </div>
    );
}