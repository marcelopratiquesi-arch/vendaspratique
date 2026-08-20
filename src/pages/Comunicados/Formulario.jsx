import React, { useState } from 'react';
import { supabase } from '../../supabaseClient.js';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { 
    Send, Image as ImageIcon, CheckCircle, HelpCircle, 
    Info, Calendar, Clock, ArrowLeft, Loader2, Plus, Trash2, 
    FileText, Video, Link as LinkIcon, X 
} from 'lucide-react';

export default function FormularioComunicado({ usuarioLogado, unidades = [], onVoltar, onSalvo }) {
    const { t } = useI18n();
    const [loading, setLoading] = useState(false);

    // 1. CONTEÚDO
    const [titulo, setTitulo] = useState('');
    const [conteudo, setConteudo] = useState('');

    // 2. MÍDIA RICA
    const [arquivoBanner, setArquivoBanner] = useState(null);
    const [previewBanner, setPreviewBanner] = useState(null);
    
    const [arquivoPdf, setArquivoPdf] = useState(null);
    const [nomePdf, setNomePdf] = useState('');
    
    const [arquivoVideo, setArquivoVideo] = useState(null);
    const [nomeVideo, setNomeVideo] = useState('');
    
    const [videoExterno, setVideoExterno] = useState('');

    // 3. COMPORTAMENTO E MICRO-LMS
    const [tipo, setTipo] = useState('INFORMATIVO'); // INFORMATIVO (Aviso) ou QUESTIONARIO
    
    // Construtor de Múltiplas Perguntas
    const [perguntas, setPerguntas] = useState([
        { id: Date.now().toString(), texto: '', alternativas: ['', ''], correta: '' }
    ]);

    // 4. PÚBLICO ALVO E AGENDAMENTO
    const [tipoAlvo, setTipoAlvo] = useState('GLOBAL');
    const [valorAlvo, setValorAlvo] = useState('TODOS');
    const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
    const [horaInicio, setHoraInicio] = useState(new Date().toTimeString().slice(0, 5));
    const [dataExpira, setDataExpira] = useState('');

    // === HANDLERS DE UPLOAD ===
    const handleFileChange = (e, tipoMedia) => {
        const file = e.target.files[0];
        if (!file) return;

        if (tipoMedia === 'banner') {
            setArquivoBanner(file);
            setPreviewBanner(URL.createObjectURL(file));
        } else if (tipoMedia === 'pdf') {
            setArquivoPdf(file);
            setNomePdf(file.name);
        } else if (tipoMedia === 'video') {
            if (file.size > 25 * 1024 * 1024) { // Limite de 25MB
                alert('O vídeo deve ter no máximo 25MB. Para vídeos maiores, use um link do YouTube.');
                return;
            }
            setArquivoVideo(file);
            setNomeVideo(file.name);
        }
    };

    // === HANDLERS DO QUESTIONÁRIO MÚLTIPLO ===
    const adicionarPergunta = () => {
        if (perguntas.length >= 10) return alert('Máximo de 10 perguntas atingido.');
        setPerguntas([...perguntas, { id: Date.now().toString(), texto: '', alternativas: ['', ''], correta: '' }]);
    };

    const removerPergunta = (id) => {
        if (perguntas.length > 1) {
            setPerguntas(perguntas.filter(p => p.id !== id));
        }
    };

    const atualizarPergunta = (id, campo, valor) => {
        setPerguntas(perguntas.map(p => p.id === id ? { ...p, [campo]: valor } : p));
    };

    const adicionarAlternativa = (perguntaId) => {
        setPerguntas(perguntas.map(p => {
            if (p.id === perguntaId && p.alternativas.length < 5) {
                return { ...p, alternativas: [...p.alternativas, ''] };
            }
            return p;
        }));
    };

    const removerAlternativa = (perguntaId, altIdx) => {
        setPerguntas(perguntas.map(p => {
            if (p.id === perguntaId && p.alternativas.length > 2) {
                const novas = p.alternativas.filter((_, i) => i !== altIdx);
                // Se apagou a correta, reseta o gabarito desta pergunta
                const novaCorreta = p.correta === p.alternativas[altIdx] ? '' : p.correta;
                return { ...p, alternativas: novas, correta: novaCorreta };
            }
            return p;
        }));
    };

    const atualizarAlternativa = (perguntaId, altIdx, valor) => {
        setPerguntas(perguntas.map(p => {
            if (p.id === perguntaId) {
                const novas = [...p.alternativas];
                novas[altIdx] = valor;
                // Atualiza a resposta correta se ela foi editada
                const novaCorreta = p.correta === p.alternativas[altIdx] ? valor : p.correta;
                return { ...p, alternativas: novas, correta: novaCorreta };
            }
            return p;
        }));
    };

    // === PUBLICAÇÃO CENTRAL ===
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!titulo.trim() || !conteudo.trim()) return alert('Preencha o título e o conteúdo principal.');

        // Validação estrita do Questionário
        if (tipo === 'QUESTIONARIO') {
            for (let i = 0; i < perguntas.length; i++) {
                const p = perguntas[i];
                if (!p.texto.trim()) return alert(`A Pergunta ${i + 1} está vazia.`);
                const altPreenchidas = p.alternativas.filter(a => a.trim() !== '');
                if (altPreenchidas.length < 2) return alert(`A Pergunta ${i + 1} precisa de pelo menos 2 alternativas preenchidas.`);
                if (!p.correta.trim()) return alert(`Selecione a resposta correta para a Pergunta ${i + 1}.`);
            }
        }

        setLoading(true);

        try {
            // Identidade Blindada
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user?.email) throw new Error("Falha de identidade. Refaça o login.");
            const emailReal = user.email;

            // Função helper de upload
            const uploadMidia = async (arquivo, prefixo) => {
                if (!arquivo) return null;
                const ext = arquivo.name.split('.').pop();
                const nome = `${prefixo}_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
                const { error } = await supabase.storage.from('comunicados-media').upload(nome, arquivo);
                if (error) throw error;
                return supabase.storage.from('comunicados-media').getPublicUrl(nome).data.publicUrl;
            };

            // Processamento paralelo de uploads para ganhar velocidade
            const [imgUrl, pdfUrl, vidUrl] = await Promise.all([
                uploadMidia(arquivoBanner, 'img'),
                uploadMidia(arquivoPdf, 'doc'),
                uploadMidia(arquivoVideo, 'vid')
            ]);

            const inicioEm = new Date(`${dataInicio}T${horaInicio}:00`).toISOString();
            const expiraEm = dataExpira ? new Date(`${dataExpira}T23:59:59`).toISOString() : null;

            // Constrói os JSONs do Questionário Múltiplo
            let perguntasJson = [];
            let gabaritoJson = {};

            if (tipo === 'QUESTIONARIO') {
                perguntas.forEach((p, index) => {
                    const idStr = String(index + 1); // ID simples sequencial 1, 2, 3...
                    perguntasJson.push({
                        id: idStr,
                        pergunta: p.texto.trim(),
                        alternativas: p.alternativas.filter(a => a.trim() !== '')
                    });
                    gabaritoJson[idStr] = p.correta; // O Segredo protegido
                });
            }

            // O INSERT PAI: Todo comunicado agora nasce OBRIGATÓRIO E BLOQUEANTE.
            const payloadComunicado = {
                tipo, 
                obrigatorio: true, 
                bloqueia_operacao: true,
                titulo_pt: titulo.trim(), 
                conteudo_pt: conteudo.trim(),
                imagem_url: imgUrl,
                pdf_url: pdfUrl,
                video_url: vidUrl,
                video_externo: videoExterno.trim() || null,
                perguntas_json: perguntasJson,
                gabarito_json: gabaritoJson,
                inicio_em: inicioEm, 
                expira_em: expiraEm,
                criado_por: emailReal, 
                status: 'ATIVO'
            };

            const { data: comData, error: comError } = await supabase.from('comunicados').insert([payloadComunicado]).select().single();
            if (comError) throw comError;

            // Roteamento Instantâneo
            const valorFinal = tipoAlvo === 'GLOBAL' ? 'TODOS' : valorAlvo;
            const { error: rpcError } = await supabase.rpc('gerar_snapshot_comunicado', { 
                p_comunicado_id: comData.id, 
                p_tipo_alvo: tipoAlvo, 
                p_valor_alvo: valorFinal 
            });
            
            if (rpcError) throw rpcError;

            onSalvo();
        } catch (err) {
            console.error(err);
            alert('Erro ao publicar: ' + (err.message || err));
        } finally {
            setLoading(false);
        }
    };

    const inputClasses = "w-full bg-white/70 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-white/10 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 outline-none transition-all shadow-sm";

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] max-w-4xl mx-auto pb-12 font-sans">
            
            {/* HEADER COMPACTO */}
            <div className="flex flex-col gap-2 mb-8">
                <button onClick={onVoltar} className="w-fit flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 transition-colors bg-white/60 dark:bg-white/5 px-4 py-2 rounded-lg border border-slate-200/50 dark:border-white/5 shadow-sm backdrop-blur-md">
                    <ArrowLeft className="w-3.5 h-3.5" /> {t('communications.back', {defaultValue: 'Voltar'})}
                </button>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mt-2">{t('communications.new', {defaultValue: 'Novo Comunicado Operacional'})}</h2>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Todo comunicado publicado interromperá a navegação do destinatário e exigirá confirmação para liberar o sistema.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                
                {/* 1. SECTION: CONTEÚDO */}
                <section className="bg-white/70 dark:bg-[#111827]/65 backdrop-blur-2xl rounded-[32px] border border-white/80 dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] p-6 md:p-8">
                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-6 border-b border-slate-200/50 dark:border-white/5 pb-4 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center text-xs">1</span>
                        {t('communications.form.contentSection', {defaultValue: 'Mensagem e Mídia'})}
                    </h3>
                    
                    <div className="space-y-5">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Título Principal (Obrigatório)</label>
                            <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} required placeholder="Ex: Treinamento de Vendas Q3" className={inputClasses} />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Conteúdo Detalhado (Obrigatório)</label>
                            <textarea rows="4" value={conteudo} onChange={(e) => setConteudo(e.target.value)} required placeholder="Descreva as instruções..." className={`${inputClasses} resize-none`}></textarea>
                        </div>
                        
                        {/* ANEXOS RICOS */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200/50 dark:border-white/5">
                            
                            <label className={`cursor-pointer border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-4 transition-all text-center ${previewBanner ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-500/10' : 'border-slate-300 dark:border-white/10 hover:border-blue-300 bg-slate-50/50 dark:bg-white/5'}`}>
                                <ImageIcon className={`w-6 h-6 mb-2 ${previewBanner ? 'text-blue-500' : 'text-slate-400'}`} />
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{previewBanner ? 'Imagem Anexada' : 'Adicionar Banner/Imagem'}</span>
                                <input type="file" accept="image/png, image/jpeg, image/webp" onChange={(e) => handleFileChange(e, 'banner')} className="hidden" />
                            </label>

                            <label className={`cursor-pointer border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-4 transition-all text-center ${nomePdf ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-500/10' : 'border-slate-300 dark:border-white/10 hover:border-rose-300 bg-slate-50/50 dark:bg-white/5'}`}>
                                <FileText className={`w-6 h-6 mb-2 ${nomePdf ? 'text-rose-500' : 'text-slate-400'}`} />
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate px-2 w-full">{nomePdf || 'Anexar Documento (PDF)'}</span>
                                <input type="file" accept="application/pdf" onChange={(e) => handleFileChange(e, 'pdf')} className="hidden" />
                            </label>

                            <label className={`cursor-pointer border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-4 transition-all text-center ${nomeVideo ? 'border-indigo-400 bg-indigo-50/50 dark:bg-indigo-500/10' : 'border-slate-300 dark:border-white/10 hover:border-indigo-300 bg-slate-50/50 dark:bg-white/5'}`}>
                                <Video className={`w-6 h-6 mb-2 ${nomeVideo ? 'text-indigo-500' : 'text-slate-400'}`} />
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate px-2 w-full">{nomeVideo || 'Vídeo Curto (Até 25MB)'}</span>
                                <input type="file" accept="video/mp4, video/webm" onChange={(e) => handleFileChange(e, 'video')} className="hidden" />
                            </label>

                            <div className="flex flex-col justify-center gap-2 border-2 border-dashed border-slate-300 dark:border-white/10 p-4 rounded-2xl bg-slate-50/50 dark:bg-white/5">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center gap-1.5"><LinkIcon className="w-4 h-4 text-slate-400" /> Link do YouTube</span>
                                <input type="url" placeholder="https://youtu.be/..." value={videoExterno} onChange={(e) => setVideoExterno(e.target.value)} className="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500 font-medium" />
                            </div>

                        </div>
                    </div>
                </section>

                {/* 2. SECTION: COMPORTAMENTO (Agora apenas Aviso ou Questionário) */}
                <section className="bg-white/70 dark:bg-[#111827]/65 backdrop-blur-2xl rounded-[32px] border border-white/80 dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] p-6 md:p-8">
                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-6 border-b border-slate-200/50 dark:border-white/5 pb-4 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center text-xs">2</span>
                        Requisito de Desbloqueio
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                        <button type="button" onClick={() => setTipo('INFORMATIVO')} className={`p-5 rounded-2xl border text-left flex flex-col gap-2.5 transition-all ${tipo === 'INFORMATIVO' ? 'bg-emerald-50 dark:bg-emerald-600/10 border-emerald-400 shadow-md shadow-emerald-500/10 text-slate-900 dark:text-white' : 'bg-white/80 dark:bg-white/5 border-slate-200/70 dark:border-white/10 text-slate-500 hover:border-emerald-300 dark:hover:border-white/30 shadow-sm'}`}>
                            <div className={`p-2 w-fit rounded-xl ${tipo === 'INFORMATIVO' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-slate-100 dark:bg-white/10 text-slate-400'}`}>
                                <CheckCircle className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-black uppercase tracking-tight">Aviso de Leitura</span>
                            <span className="text-[11px] font-semibold leading-tight opacity-80">Usuário destrava clicando em "Li e estou ciente".</span>
                        </button>

                        <button type="button" onClick={() => setTipo('QUESTIONARIO')} className={`p-5 rounded-2xl border text-left flex flex-col gap-2.5 transition-all ${tipo === 'QUESTIONARIO' ? 'bg-purple-50 dark:bg-purple-600/10 border-purple-400 shadow-md shadow-purple-500/10 text-slate-900 dark:text-white' : 'bg-white/80 dark:bg-white/5 border-slate-200/70 dark:border-white/10 text-slate-500 hover:border-purple-300 dark:hover:border-white/30 shadow-sm'}`}>
                            <div className={`p-2 w-fit rounded-xl ${tipo === 'QUESTIONARIO' ? 'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400' : 'bg-slate-100 dark:bg-white/10 text-slate-400'}`}>
                                <HelpCircle className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-black uppercase tracking-tight">Avaliação / Prova</span>
                            <span className="text-[11px] font-semibold leading-tight opacity-80">Usuário destrava ao acertar todas as perguntas.</span>
                        </button>
                    </div>

                    {/* CONSTRUTOR DE PROVAS (MICRO-LMS) */}
                    {tipo === 'QUESTIONARIO' && (
                        <div className="mt-6 space-y-6 pt-4 border-t border-slate-200/50 dark:border-white/5 animate-[fadeIn_0.3s_ease-out]">
                            
                            {perguntas.map((p, pIdx) => (
                                <div key={p.id} className="p-5 bg-slate-50/80 dark:bg-black/20 border border-slate-200/70 dark:border-white/10 rounded-2xl relative group">
                                    {perguntas.length > 1 && (
                                        <button type="button" onClick={() => removerPergunta(p.id)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-rose-500 transition-colors" title="Remover Pergunta"><Trash2 className="w-4 h-4" /></button>
                                    )}
                                    
                                    <label className="block text-[11px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-3">Pergunta {pIdx + 1}</label>
                                    <input type="text" value={p.texto} onChange={(e) => atualizarPergunta(p.id, 'texto', e.target.value)} placeholder="Ex: Qual é o desconto máximo permitido?" className={`${inputClasses} mb-4`} />
                                    
                                    <div className="space-y-3 pl-2 border-l-2 border-purple-200 dark:border-purple-500/30">
                                        {p.alternativas.map((alt, aIdx) => (
                                            <div key={aIdx} className="flex items-center gap-3">
                                                <div 
                                                    onClick={() => atualizarPergunta(p.id, 'correta', alt)}
                                                    className={`w-5 h-5 flex-shrink-0 rounded-full border-2 cursor-pointer transition-all flex items-center justify-center ${p.correta === alt && alt.trim() !== '' ? 'border-purple-600 bg-purple-600 dark:border-purple-500 dark:bg-purple-500' : 'border-slate-300 dark:border-white/20 hover:border-purple-400'}`}
                                                    title="Marcar como Resposta Certa"
                                                >
                                                    {p.correta === alt && alt.trim() !== '' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                                </div>
                                                <input type="text" value={alt} onChange={(e) => atualizarAlternativa(p.id, aIdx, e.target.value)} placeholder={`Alternativa ${aIdx + 1}`} className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 outline-none focus:border-purple-500" />
                                                {p.alternativas.length > 2 && (
                                                    <button type="button" onClick={() => removerAlternativa(p.id, aIdx)} className="text-slate-400 hover:text-rose-400 p-1"><X className="w-4 h-4" /></button>
                                                )}
                                            </div>
                                        ))}
                                        {p.alternativas.length < 6 && (
                                            <button type="button" onClick={() => adicionarAlternativa(p.id)} className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5 hover:text-purple-600 dark:hover:text-purple-400 transition-colors mt-2 ml-1">
                                                <Plus className="w-3 h-3" /> Adicionar Opção
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {perguntas.length < 10 && (
                                <button type="button" onClick={adicionarPergunta} className="w-full py-4 border-2 border-dashed border-purple-300 dark:border-purple-500/30 rounded-2xl text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors">
                                    <Plus className="w-4 h-4" /> Nova Pergunta
                                </button>
                            )}
                        </div>
                    )}
                </section>

                {/* 3. SECTION: PÚBLICO E DATA */}
                <section className="bg-white/70 dark:bg-[#111827]/65 backdrop-blur-2xl rounded-[32px] border border-white/80 dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] p-6 md:p-8">
                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-6 border-b border-slate-200/50 dark:border-white/5 pb-4 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center text-xs">3</span>
                        {t('communications.form.targetSection', {defaultValue: 'Público e Agendamento'})}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">{t('communications.form.targetLabel', {defaultValue: 'Destinatários:'})}</label>
                            <select value={tipoAlvo} onChange={(e) => setTipoAlvo(e.target.value)} className={`${inputClasses} cursor-pointer`}>
                                <option value="GLOBAL">Todos os Usuários da Empresa</option>
                                <option value="ROLE">Por Cargo / Permissão</option>
                                <option value="UNIDADE">Por Academia / Unidade</option>
                            </select>
                        </div>
                        {tipoAlvo === 'ROLE' && (
                            <div className="animate-[fadeIn_0.2s_ease-out]">
                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Selecione o Cargo:</label>
                                <select value={valorAlvo} onChange={(e) => setValorAlvo(e.target.value)} className={`${inputClasses} cursor-pointer`}>
                                    <option value="RECEPCAO">Recepção / Operacional</option>
                                    <option value="LIDER">Líderes de Unidade</option>
                                    <option value="MENTOR">Supervisores / Mentores</option>
                                </select>
                            </div>
                        )}
                        {tipoAlvo === 'UNIDADE' && (
                            <div className="animate-[fadeIn_0.2s_ease-out]">
                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Selecione a Unidade:</label>
                                <select value={valorAlvo} onChange={(e) => setValorAlvo(e.target.value)} className={`${inputClasses} cursor-pointer uppercase`}>
                                    {unidades.map(u => <option key={u.id} value={u.nome}>{u.nome}</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-6 border-t border-slate-200/50 dark:border-white/5">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Início do Bloqueio</label>
                            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} required className={inputClasses} />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Hora de Disparo</label>
                            <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} required className={inputClasses} />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1 flex items-center gap-1.5 opacity-70"><Calendar className="w-3.5 h-3.5" /> Fim (Opcional)</label>
                            <input type="date" value={dataExpira} onChange={(e) => setDataExpira(e.target.value)} className={inputClasses} />
                        </div>
                    </div>
                </section>

                <button 
                    type="submit" disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black uppercase tracking-widest py-5 rounded-[20px] shadow-[0_10px_40px_-10px_rgba(37,99,235,0.6)] active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-sm disabled:opacity-50"
                >
                    {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Publicando Interrupção...</> : <><Send className="w-5 h-5" /> Publicar e Bloquear Destinatários</>}
                </button>
            </form>
        </div>
    );
}