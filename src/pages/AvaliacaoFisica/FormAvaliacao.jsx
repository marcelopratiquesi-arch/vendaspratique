import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import { useI18n } from '../../i18n/I18nContext.jsx'; 
import { calcularSMI, calcularHidratacao, classificarRCQ, classificarGV, classificarPressao } from './utils.js';
import { mascaraCPF, validarCPF, formatarTelefone, calcularIdade } from '../CadastroGeral/utilsAlunos.js'; 
import { processarExameBioimpedancia } from './bioimpedancia/index.js'; // INJEÇÃO DO PARSER
import { Activity, HeartPulse, CheckSquare, Send, Loader2, CheckCircle2, AlertCircle, Search, UserRoundPen, UserPlus, CreditCard, AlertTriangle, ListChecks, Check, Ruler, User, Mail, Phone, CalendarDays, Copy, IdCard, Info, Droplet, Apple, Dumbbell, MessageCircle, Smartphone, Users, Zap, Scale, PersonStanding, BarChart3, Percent, Sparkles, UploadCloud, FileText } from 'lucide-react';
import ModalAluno from '../../components/Modals/ModalAluno.jsx'; 

const IconBraco = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.2 10.4a4.1 4.1 0 0 0-1.8-1.8 19 19 0 0 0-6.1-1.7c-2.4-.3-4.6-.2-6.5.6a4.1 4.1 0 0 0-2.3 2.3 4.1 4.1 0 0 0 .5 3.6c.9 1.4 2.5 2.4 4.5 2.8 1.9.4 4.1.2 6.5-.6.5-.2 1-.3 1.5-.5.6-.2 1.3-.4 1.9-.7a11.1 11.1 0 0 0 3-2 4 4 0 0 0 .6-3.8z" /></svg>);
const IconPerna = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v9l-3 4-2 6h4l1-3 3-1V2h-3z" /></svg>);

const CopyButton = ({ textToCopy, label }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = async (e) => {
        e.preventDefault(); e.stopPropagation();
        if (!textToCopy) return;
        try {
            await navigator.clipboard.writeText(String(textToCopy).trim());
            setCopied(true); setTimeout(() => setCopied(false), 2000);
        } catch (err) { console.error('Erro ao copiar', err); }
    };
    return (
        <button type="button" onClick={handleCopy} className="p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100" title={label}>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
    );
};

const InfoTooltip = ({ text }) => (
    <div className="relative flex items-center group cursor-pointer">
        <Info className="w-3.5 h-3.5 text-blue-400 hover:text-blue-600 transition-colors" />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900 text-white text-[11px] leading-relaxed rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all shadow-xl font-medium normal-case pointer-events-none z-[9999]">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900"></div>
        </div>
    </div>
);

const getLocalIsoDate = () => { const d = new Date(); return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0]; };
const getBorderClass = (textClass) => { if (!textClass) return 'border-slate-200'; if (textClass.includes('emerald')) return 'border-emerald-200'; if (textClass.includes('amber')) return 'border-amber-200'; if (textClass.includes('rose')) return 'border-rose-200'; if (textClass.includes('orange')) return 'border-orange-200'; if (textClass.includes('blue')) return 'border-blue-200'; return 'border-slate-200'; };

const anamneseIcons = [
    { Icon: Droplet, bg: 'bg-rose-50', text: 'text-rose-500' }, { Icon: HeartPulse, bg: 'bg-rose-50', text: 'text-rose-500' }, { Icon: Apple, bg: 'bg-emerald-50', text: 'text-emerald-500' }, { Icon: Dumbbell, bg: 'bg-orange-50', text: 'text-orange-500' }, { Icon: MessageCircle, bg: 'bg-purple-50', text: 'text-purple-500' }, { Icon: Smartphone, bg: 'bg-teal-50', text: 'text-teal-500' }, { Icon: Users, bg: 'bg-amber-50', text: 'text-amber-500' }, { Icon: Zap, bg: 'bg-indigo-50', text: 'text-indigo-500' }
];

const labelClass = "block text-[11px] font-black text-slate-700 uppercase tracking-widest mb-2 ml-1";
const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm";
const sectionClass = "bg-white p-6 md:p-8 rounded-[24px] border border-slate-200 shadow-sm relative";

const InputComIcone = ({ label, name, value, onChange, icon: Icon, placeholder, disabled, req, example }) => (
    <div className="flex flex-col relative">
        <label className={labelClass}>
            {label} {req && <span className="text-rose-500">*</span>}
        </label>
        <div className="relative">
            <input type="text" inputMode="decimal" name={name} value={value} onChange={onChange} className={`${inputClass} pr-10`} placeholder={placeholder} disabled={disabled} />
            {Icon && <Icon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />}
        </div>
        {example && <span className="text-[10px] font-bold text-slate-400 mt-1.5 ml-1">{example}</span>}
    </div>
);

const FormAvaliacao = ({ usuarioLogado, professorAtivo, voltar, avaliacaoEditando }) => {
    const { t, locale, language } = useI18n(); const langAtual = locale || language || 'pt-BR';
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sucesso, setSucesso] = useState(false);
    const fileInputRef = useRef(null);
    const [isImportingIA, setIsImportingIA] = useState(false);
    const [iaProgress, setIaProgress] = useState(0);
    const [iaStatusText, setIaStatusText] = useState('A ler documento...');
    const [arquivoInBody, setArquivoInBody] = useState(null);

    const [cpfBusca, setCpfBusca] = useState(''); const [cpfErro, setCpfErro] = useState(false); const [buscandoCpf, setBuscandoCpf] = useState(false);
    const [alunoEncontrado, setAlunoEncontrado] = useState(null); const [statusCpf, setStatusCpf] = useState(null); const [modalAlunoAberto, setModalAlunoAberto] = useState(false);

    const [form, setForm] = useState({
        peso: '', altura: '', sistolica: '', diastolica: '',
        bracoEsq: '', bracoDir: '', pernaEsq: '', pernaDir: '', aguaTotal: '', rcq: '', gv: '', mme: '', pgc: '',
        checklist: { diagnose: false, email: false, treino: false, apenasAvaliacao: false }
    });

    const [perguntasDinamicas, setPerguntasDinamicas] = useState([]);
    const [respostasDinamicas, setRespostasDinamicas] = useState({});
    const [respostasOutros, setRespostasOutros] = useState({}); 
    const [loadingPerguntas, setLoadingPerguntas] = useState(true);
    const debounceRef = useRef(null);

    useEffect(() => {
        const carregarPerguntas = async () => {
            try {
                const { data, error } = await supabase.from('avaliacao_perguntas').select('*').eq('ativo', true).order('ordem', { ascending: true });
                if (error) throw error;
                setPerguntasDinamicas(data || []);
            } catch (err) { console.error(err); } finally { setLoadingPerguntas(false); }
        };
        carregarPerguntas();
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, []);

    useEffect(() => {
        if (avaliacaoEditando && perguntasDinamicas.length > 0) {
            const fetchAluno = async () => {
                const { data } = await supabase.from('alunos').select('*').eq('id', avaliacaoEditando.aluno_id).maybeSingle();
                if (data) {
                    setAlunoEncontrado(data);
                    if (data.cpf) { setCpfBusca(mascaraCPF(data.cpf)); setStatusCpf('encontrado'); } 
                    else { setAlunoEncontrado({ ...data, nome: avaliacaoEditando.aluno }); setStatusCpf('encontrado'); }
                } else { setAlunoEncontrado({ id: avaliacaoEditando.aluno_id, nome: avaliacaoEditando.aluno }); setStatusCpf('encontrado'); }
            };
            fetchAluno();

            setForm({
                peso: avaliacaoEditando.peso || '', altura: avaliacaoEditando.altura || '', 
                sistolica: avaliacaoEditando.sistolica || '', diastolica: avaliacaoEditando.diastolica || '',
                bracoEsq: avaliacaoEditando.braco_esq || '', bracoDir: avaliacaoEditando.braco_dir || '',
                pernaEsq: avaliacaoEditando.perna_esq || '', pernaDir: avaliacaoEditando.perna_dir || '',
                aguaTotal: avaliacaoEditando.agua_total || '', rcq: avaliacaoEditando.rcq || '', gv: avaliacaoEditando.gv || '',
                mme: avaliacaoEditando.mme || '', pgc: avaliacaoEditando.pgc || '',
                checklist: avaliacaoEditando.checklist || { diagnose: false, email: false, treino: false, apenasAvaliacao: false }
            });

            const respDinamicas = {}; const respOutros = {}; const salvas = avaliacaoEditando.respostas_dinamicas || {};

            perguntasDinamicas.forEach(p => {
                const val = salvas[p.id];
                if (!val) return;
                if (p.tipo === 'SELECT') {
                    const isOutro = p.opcoes.find(o => o.toLowerCase().trim().startsWith('outro'));
                    if (isOutro && String(val).startsWith(isOutro)) { respDinamicas[p.id] = isOutro; respOutros[p.id] = String(val).replace(isOutro, '').trim(); } 
                    else { respDinamicas[p.id] = val; }
                } else if (p.tipo === 'CHECKBOX') {
                    const isOutro = p.opcoes.find(o => o.toLowerCase().trim().startsWith('outro'));
                    const list = Array.isArray(val) ? val : [val]; const finalList = [];
                    list.forEach(item => {
                        if (isOutro && String(item).startsWith(isOutro)) { finalList.push(isOutro); respOutros[p.id] = String(item).replace(isOutro, '').trim(); } 
                        else { finalList.push(item); }
                    });
                    respDinamicas[p.id] = finalList;
                } else { respDinamicas[p.id] = val; }
            });
            setRespostasDinamicas(respDinamicas); setRespostasOutros(respOutros);
            
            if(avaliacaoEditando.arquivo_inbody_url) { setArquivoInBody({ name: 'Exame Anterior Anexado' }); }
        }
    }, [avaliacaoEditando, perguntasDinamicas]);

    const buscarAlunoPorCpf = async (cpfLimpo) => {
        setBuscandoCpf(true); setStatusCpf(null);
        try {
            const { data, error } = await supabase.from('alunos').select('*').eq('cpf', cpfLimpo).maybeSingle();
            if (error && error.code !== 'PGRST116') throw error;
            if (data) { setAlunoEncontrado(data); setStatusCpf('encontrado'); } 
            else { setAlunoEncontrado(null); setStatusCpf('novo'); }
        } catch (error) { console.error(error); setStatusCpf('erro'); } finally { setBuscandoCpf(false); }
    };

    const handleCpfChange = (e) => {
        const masked = mascaraCPF(e.target.value); setCpfBusca(masked); setAlunoEncontrado(null); setStatusCpf(null);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (masked.length === 14) {
            if (!validarCPF(masked)) { setCpfErro(true); } 
            else { setCpfErro(false); debounceRef.current = setTimeout(() => buscarAlunoPorCpf(masked.replace(/\D/g, '')), 500); }
        } else { setCpfErro(false); }
    };

    const handleSaveAlunoSuccess = (alunoAtualizado) => { setAlunoEncontrado(alunoAtualizado); setCpfBusca(mascaraCPF(alunoAtualizado.cpf)); setStatusCpf('encontrado'); };
    const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleRespostaDinamica = (perguntaId, valor, tipo) => {
        setRespostasDinamicas(prev => {
            if (tipo === 'CHECKBOX') {
                const atual = prev[perguntaId] || [];
                if (atual.includes(valor)) return { ...prev, [perguntaId]: atual.filter(v => v !== valor) };
                return { ...prev, [perguntaId]: [...atual, valor] };
            }
            return { ...prev, [perguntaId]: valor };
        });
    };

    // 🔥 LÓGICA DE EXTRAÇÃO SUBSTITUÍDA PELO CÓDIGO REAL
    const handleUploadInBody = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setArquivoInBody(file); 
        setIsImportingIA(true); 
        setIaProgress(20); 
        setIaStatusText('A ler estrutura do ficheiro PDF...');

        try {
            const resultado = await processarExameBioimpedancia(file);
            setIaProgress(60);

            if (!resultado.success) {
                alert(resultado.error);
                setArquivoInBody(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
                setIsImportingIA(false);
                return;
            }

            setIaStatusText(`Layout ${resultado.reportType} identificado. A extrair métricas...`);
            setIaProgress(90);

            console.log('[Bioimpedancia] tipo:', resultado.reportType);
            console.log('[Bioimpedancia] campos encontrados:', Object.keys(resultado.data));
            if (resultado.warnings?.length > 0) console.log('[Bioimpedancia] warnings:', resultado.warnings);

            // Preenchimento Seguro: Ignora nulls para não apagar dados já preenchidos
            setForm(prev => {
                const newData = { ...prev };
                Object.entries(resultado.data).forEach(([key, value]) => {
                    if (value !== null && value !== undefined) {
                        newData[key] = String(value); // Mantemos string para compatibilidade
                    }
                });
                return newData;
            });

            setIaProgress(100);
            setIaStatusText('Extração concluída com sucesso!');

        } catch (error) {
            console.error("Erro na leitura do arquivo:", error);
            alert("Falha inesperada ao ler o documento. Verifique a consola.");
            setArquivoInBody(null);
        } finally {
            setTimeout(() => { 
                setIsImportingIA(false); 
                setIaProgress(0); 
                if (fileInputRef.current) fileInputRef.current.value = ''; 
            }, 800);
        }
    };

    const removerArquivo = () => { setArquivoInBody(null); if (fileInputRef.current) fileInputRef.current.value = ''; };

    const parseVal = (v) => {
        if (v === null || v === undefined || v === '') return null;
        const num = parseFloat(String(v).replace(',', '.'));
        return isNaN(num) ? null : num;
    };

    const sexoAluno = alunoEncontrado?.sexo || 'M';
    
    let alt = parseVal(form.altura); 
    if (alt !== null && alt > 3) alt = alt / 100; 
    const p = parseVal(form.peso);

    const pressao = classificarPressao(form.sistolica, form.diastolica, t);
    const smi = calcularSMI(form.bracoEsq, form.bracoDir, form.pernaEsq, form.pernaDir, form.altura, sexoAluno, t);
    const hidratacao = calcularHidratacao(form.aguaTotal, form.peso, sexoAluno, t);
    const rcq = classificarRCQ(form.rcq, sexoAluno, t);
    const gv = classificarGV(form.gv, t);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!alunoEncontrado) return alert(t('assessment.form.alertFindStudent', {defaultValue: 'Você precisa localizar ou cadastrar o aluno primeiro!'}));
        if (!usuarioLogado?.unidade) return alert(t('assessment.form.alertUnit', {defaultValue: 'Erro de sessão: Unidade não identificada.'}));

        if (p === null || p <= 0 || p > 300) return alert(t('assessment.form.alertWeight', {defaultValue: 'Peso inválido ou não informado.'}));
        if (alt === null || alt < 0.5 || alt > 2.5) return alert(t('assessment.form.alertHeight', {defaultValue: 'Altura inválida ou não informada.'}));

        const respostasFinais = { ...respostasDinamicas };
        for (const p of perguntasDinamicas) {
            if (p.tipo === 'SELECT') {
                const resp = respostasFinais[p.id];
                if (resp && resp.toLowerCase().trim().startsWith('outro') && respostasOutros[p.id]) { respostasFinais[p.id] = `${resp} ${respostasOutros[p.id]}`; }
            } else if (p.tipo === 'CHECKBOX') {
                const respArray = respostasFinais[p.id];
                if (Array.isArray(respArray)) {
                    respostasFinais[p.id] = respArray.map(r => {
                        if (r.toLowerCase().trim().startsWith('outro') && respostasOutros[p.id]) return `${r} ${respostasOutros[p.id]}`; return r;
                    });
                }
            }
            if (p.obrigatorio) {
                const resp = respostasFinais[p.id];
                if (!resp || (Array.isArray(resp) && resp.length === 0)) { alert(`A pergunta "${p.pergunta}" é obrigatória.`); return; }
            }
        }

        setIsSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            
            let urlArquivoInBody = avaliacaoEditando?.arquivo_inbody_url || null;

            if (arquivoInBody && arquivoInBody instanceof File) {
                const extensao = arquivoInBody.name.split('.').pop();
                const nomeArquivo = `${alunoEncontrado.id}_${Date.now()}.${extensao}`;
                const { data: uploadData, error: uploadError } = await supabase.storage.from('exames_inbody').upload(`avaliacoes/${nomeArquivo}`, arquivoInBody);
                if (uploadError) {
                    console.error("Erro ao subir arquivo no Storage:", uploadError);
                    alert("A avaliação será salva, mas houve um erro ao guardar o anexo PDF/Imagem. Confirme as permissões do Bucket.");
                } else if (uploadData) {
                    const { data: { publicUrl } } = supabase.storage.from('exames_inbody').getPublicUrl(`avaliacoes/${nomeArquivo}`);
                    urlArquivoInBody = publicUrl;
                }
            }

            const novaAvaliacao = {
                aluno_id: alunoEncontrado.id, aluno: alunoEncontrado.nome, unidade: usuarioLogado.unidade,
                professor: professorAtivo.nome, usuario_responsavel: usuarioLogado?.nome || user?.email || 'SISTEMA',
                sexo: sexoAluno, peso: p, altura: alt, 
                sistolica: parseInt(form.sistolica || 0, 10), diastolica: parseInt(form.diastolica || 0, 10),
                braco_esq: parseVal(form.bracoEsq), braco_dir: parseVal(form.bracoDir), 
                perna_esq: parseVal(form.pernaEsq), perna_dir: parseVal(form.pernaDir),
                agua_total: parseVal(form.aguaTotal), rcq: parseVal(form.rcq), gv: parseVal(form.gv),
                mme: parseVal(form.mme), pgc: parseVal(form.pgc),
                smi_resultado: smi.valor, smi_status: smi.status, hidratacao_resultado: hidratacao.valor, hidratacao_status: hidratacao.status,
                rcq_status: rcq.status, gv_status: gv.status, pressao_status: pressao.status,
                disponibilidade: '', objetivo: '', restricoes: '', checklist: form.checklist, respostas_dinamicas: respostasFinais, 
                data: avaliacaoEditando ? avaliacaoEditando.data : getLocalIsoDate(), hora: avaliacaoEditando ? avaliacaoEditando.hora : new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                arquivo_inbody_url: urlArquivoInBody
            };
            
            if (avaliacaoEditando) {
                const { error } = await supabase.from('avaliacoes_realizadas').update(novaAvaliacao).eq('id', avaliacaoEditando.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('avaliacoes_realizadas').insert([novaAvaliacao]);
                if (error) throw error;
            }
            
            setSucesso(true); setTimeout(() => { setSucesso(false); voltar(); }, 2000);
        } catch (err) { console.error(err); alert(t('assessment.form.errorSave', {defaultValue: 'Erro ao salvar avaliação.'})); } finally { setIsSubmitting(false); }
    };

    return (
        <>
            <ModalAluno isOpen={modalAlunoAberto} onClose={() => setModalAlunoAberto(false)} alunoInicial={alunoEncontrado || { cpf: cpfBusca }} onSaveSuccess={handleSaveAlunoSuccess} usuarioLogado={usuarioLogado}/>
            
            {isImportingIA && (
                <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-white p-8 rounded-[32px] shadow-2xl flex flex-col items-center text-center max-w-sm w-full mx-4 border border-blue-200 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-100 overflow-hidden">
                            <div className="h-full bg-blue-500 transition-all duration-300 ease-out" style={{ width: `${iaProgress}%` }}></div>
                        </div>
                        <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-6 shadow-inner border border-blue-100">
                            <Sparkles className="w-10 h-10 animate-pulse" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">Análise IA Multi-Escala</h3>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-relaxed min-h-[32px]">{iaStatusText}</p>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-6 animate-[fadeIn_0.3s_ease-out] pb-10">
                {sucesso && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out] z-[9999]">
                        <div className="bg-white p-8 rounded-[32px] shadow-2xl flex flex-col items-center text-center animate-[zoomIn_0.2s_ease-out] max-w-sm w-full mx-4 border border-slate-200">
                            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-inner border border-emerald-200"><CheckCircle2 className="w-10 h-10" /></div>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">
                                {avaliacaoEditando ? 'Avaliação Atualizada!' : t('assessment.form.savedTitle')}
                            </h3>
                        </div>
                    </div>
                )}

                <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-slate-900 rounded-[24px] p-6 shadow-md gap-4">
                    <div>
                        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                            {avaliacaoEditando ? 'Editar Avaliação Física' : t('assessment.form.title')}
                        </h2>
                        <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{t('assessment.prof')}: {professorAtivo.nome}</p>
                    </div>
                    <button type="button" onClick={voltar} className="bg-white/10 hover:bg-white/20 text-white border border-white/10 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors w-full md:w-auto">{t('assessment.form.cancel')}</button>
                </div>

                <div className={sectionClass}>
                    <div className="flex items-center gap-4 border-b border-slate-100 pb-5 mb-6">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-inner shrink-0">
                            <User className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Dados do Aluno</h3>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Digite o CPF para localizar o aluno no sistema</p>
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-6 items-start">
                        <div className="w-full lg:w-64 shrink-0">
                            <label className="block text-[11px] font-black text-slate-700 uppercase tracking-widest mb-2 ml-1">
                                CPF do Aluno <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                                <input 
                                    type="text" value={cpfBusca} onChange={handleCpfChange} maxLength="14" disabled={!!avaliacaoEditando} 
                                    className={`w-full bg-white border-2 rounded-2xl px-4 py-3 text-base font-black text-slate-800 outline-none transition-all shadow-sm
                                        ${cpfErro ? 'border-rose-400 focus:ring-4 focus:ring-rose-500/20' : 
                                          statusCpf === 'encontrado' ? 'border-blue-500 focus:ring-4 focus:ring-blue-500/20 text-blue-900' : 
                                          'border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20'}
                                          ${avaliacaoEditando ? 'opacity-70 cursor-not-allowed' : ''}`} 
                                    placeholder="000.000.000-00" 
                                />
                                {buscandoCpf && <Loader2 className="w-5 h-5 text-blue-500 animate-spin absolute right-4 top-1/2 -translate-y-1/2" />}
                                {statusCpf === 'encontrado' && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-sm"><Check className="w-4 h-4 text-white stroke-[3]" /></div>}
                                {statusCpf === 'erro' && <AlertTriangle className="w-5 h-5 text-rose-500 absolute right-4 top-1/2 -translate-y-1/2" />}
                            </div>
                            <div className="mt-3">
                                {cpfErro && <span className="text-rose-500 text-[10px] font-black uppercase tracking-widest ml-1">CPF Inválido</span>}
                                {statusCpf === 'encontrado' && (
                                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2.5 rounded-xl border border-emerald-100 animate-[fadeIn_0.2s_ease-out]">
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span className="text-[11px] font-black uppercase tracking-widest">Cadastro localizado</span>
                                    </div>
                                )}
                                {statusCpf === 'novo' && (
                                    <div className="flex flex-col gap-3 bg-amber-50 border border-amber-200 p-4 rounded-xl animate-[fadeIn_0.2s_ease-out]">
                                        <div className="flex items-start gap-2 text-amber-700">
                                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="text-[11px] font-black uppercase tracking-widest block">Aluno não encontrado</span>
                                                <span className="text-[10px] font-bold opacity-80 leading-tight">Proceda com o cadastro rápido.</span>
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => setModalAlunoAberto(true)} className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors shadow-sm">Cadastrar Aluno</button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 w-full min-h-[140px]">
                            {alunoEncontrado ? (
                                <div className="bg-slate-50/80 border border-slate-200 rounded-3xl p-6 shadow-[inset_0_2px_10px_rgba(0,0,0,0.01)] animate-[slideLeft_0.3s_ease-out]">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200/80 pb-5 mb-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center shrink-0 border-2 border-white shadow-sm"><User className="w-6 h-6" /></div>
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-2 group">
                                                    <h4 className="text-base font-black text-slate-800 uppercase tracking-tight">{alunoEncontrado.nome}</h4>
                                                    <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shrink-0"><Check className="w-3 h-3 text-white stroke-[3]" /></div>
                                                    <CopyButton textToCopy={alunoEncontrado.nome} label="Copiar Nome" />
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                                                    {alunoEncontrado.matricula ? (<span className="flex items-center gap-1.5"><IdCard className="w-3.5 h-3.5 text-slate-400" /> Matrícula: {alunoEncontrado.matricula}</span>) : (<span className="flex items-center gap-1.5 opacity-50"><IdCard className="w-3.5 h-3.5" /> Sem Matrícula</span>)}
                                                    <span className="text-slate-300 hidden sm:block">|</span>
                                                    {alunoEncontrado.data_nascimento ? (<span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-slate-400" /> {new Date(alunoEncontrado.data_nascimento + 'T12:00:00').toLocaleDateString(langAtual)}</span>) : (<span className="flex items-center gap-1.5 opacity-50"><CalendarDays className="w-3.5 h-3.5" /> Data N/I</span>)}
                                                </div>
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => setModalAlunoAberto(true)} className="w-full sm:w-auto px-5 py-2.5 bg-white border-2 border-blue-100 text-blue-600 hover:bg-blue-50 hover:border-blue-300 rounded-[14px] text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm shrink-0"><UserRoundPen className="w-4 h-4" /> Editar Dados</button>
                                    </div>

                                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-0 sm:divide-x divide-slate-200/80">
                                        <div className="flex items-center gap-3 sm:pr-5 shrink-0">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center shrink-0"><Phone className="w-4 h-4" /></div>
                                            <div className="flex flex-col group">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Telefone</span>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[13px] font-bold text-slate-700 whitespace-nowrap">{alunoEncontrado.telefone ? formatarTelefone(alunoEncontrado.telefone) : 'N/I'}</span>
                                                    {alunoEncontrado.telefone && <CopyButton textToCopy={alunoEncontrado.telefone} label="Copiar Telefone" />}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 sm:px-5 flex-1 min-w-0">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center shrink-0"><Mail className="w-4 h-4" /></div>
                                            <div className="flex flex-col min-w-0 group">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">E-mail</span>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[13px] font-bold text-slate-700 truncate">{alunoEncontrado.email || 'N/I'}</span>
                                                    {alunoEncontrado.email && <CopyButton textToCopy={alunoEncontrado.email} label="Copiar E-mail" />}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 sm:pl-5 shrink-0">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center shrink-0"><User className="w-4 h-4" /></div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Idade</span>
                                                <span className="text-[13px] font-bold text-slate-700 whitespace-nowrap">{alunoEncontrado.data_nascimento ? `${calcularIdade(alunoEncontrado.data_nascimento)} anos` : 'N/I'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center px-4">Localize o aluno para iniciar a avaliação</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className={`transition-all duration-500 ${!alunoEncontrado ? 'opacity-30 pointer-events-none grayscale-[50%]' : 'opacity-100'}`}>
                    
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200/60 p-6 md:p-8 rounded-[24px] shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                        <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-200/20 rounded-full blur-3xl"></div>
                        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-indigo-200/20 rounded-full blur-3xl"></div>
                        
                        <div className="flex items-center gap-5 relative z-10">
                            <div className="w-14 h-14 bg-white text-blue-600 rounded-2xl flex items-center justify-center shadow-sm shrink-0 border border-blue-100">
                                <Sparkles className="w-7 h-7 animate-pulse" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                    Preenchimento Inteligente Multi-Escalas <span className="bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded uppercase tracking-widest shadow-sm">IA</span>
                                </h3>
                                <p className="text-xs font-bold text-slate-500 mt-1 max-w-lg leading-relaxed">Faça o upload do exame InBody ou Superbio. A IA extrairá e padronizará todas as medidas automaticamente.</p>
                            </div>
                        </div>
                        
                        <div className="relative z-10 w-full md:w-auto shrink-0 flex flex-col items-center gap-2">
                            <input type="file" accept="image/*,application/pdf" ref={fileInputRef} onChange={handleUploadInBody} className="hidden" />
                            {!arquivoInBody ? (
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full md:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-[16px] text-xs font-black uppercase tracking-widest transition-all shadow-[0_4px_15px_rgba(37,99,235,0.3)] flex items-center justify-center gap-3 hover:-translate-y-0.5">
                                    <UploadCloud className="w-5 h-5" /> Anexar Exame
                                </button>
                            ) : (
                                <div className="flex flex-col items-center gap-2 w-full">
                                    <div className="bg-emerald-50 border border-emerald-200 px-6 py-3 rounded-[16px] flex items-center justify-center gap-3 w-full shadow-sm">
                                        <FileText className="w-5 h-5 text-emerald-600" />
                                        <span className="text-[11px] font-black text-emerald-700 uppercase tracking-widest truncate max-w-[150px]">
                                            {arquivoInBody.name}
                                        </span>
                                    </div>
                                    <button type="button" onClick={removerArquivo} className="text-[10px] font-bold text-rose-500 hover:text-rose-700 uppercase tracking-widest transition-colors">
                                        Remover Arquivo
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                        <div className={sectionClass}>
                            <div className="flex items-center gap-4 border-b border-slate-100 pb-5 mb-6">
                                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-inner shrink-0">
                                    <Ruler className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Medidas Iniciais</h3>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Registre o peso e a altura atual do aluno.</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-5">
                                <InputComIcone label="Peso (Kg)" name="peso" value={form.peso} onChange={handleChange} disabled={!alunoEncontrado} req={true} icon={Scale} example="Ex.: 75.5" />
                                <InputComIcone label="Altura (m)" name="altura" value={form.altura} onChange={handleChange} disabled={!alunoEncontrado} req={true} icon={PersonStanding} example="Ex.: 1.75" />
                            </div>
                        </div>

                        <div className={sectionClass}>
                            <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center shadow-inner shrink-0">
                                        <HeartPulse className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Pressão Arterial</h3>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Registre a pressão arterial do aluno.</p>
                                    </div>
                                </div>
                                {form.sistolica && form.diastolica ? (
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border shadow-sm transition-colors ${pressao.bg} ${pressao.cor} ${getBorderClass(pressao.cor)} shrink-0`}>{pressao.status}</span>
                                ) : (
                                    <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border bg-slate-50 text-slate-400 border-slate-200 shrink-0">Não Aferida</span>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-5">
                                <InputComIcone label="Sistólica (mmHg)" name="sistolica" value={form.sistolica} onChange={handleChange} disabled={!alunoEncontrado} req={true} icon={HeartPulse} example="Ex.: 120" />
                                <InputComIcone label="Diastólica (mmHg)" name="diastolica" value={form.diastolica} onChange={handleChange} disabled={!alunoEncontrado} req={true} icon={HeartPulse} example="Ex.: 80" />
                            </div>
                        </div>
                    </div>

                    <div className={`${sectionClass} mt-6`}>
                        <div className="flex items-center gap-4 border-b border-slate-100 pb-5 mb-8">
                            <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center shadow-inner shrink-0">
                                <Activity className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Bioimpedância (Massa e Gordura)</h3>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Preencha os valores obtidos na avaliação de bioimpedância.</p>
                            </div>
                        </div>
                        
                        <div className="mb-10">
                            <div className="flex items-center gap-3 mb-5 border-b border-slate-50 pb-3">
                                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-black shrink-0">1</div>
                                <div>
                                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Massa Segmentar</h4>
                                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">Informe a massa (kg) de cada segmento corporal.</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                                <InputComIcone label="Braço Esquerdo (Kg)" name="bracoEsq" value={form.bracoEsq} onChange={handleChange} disabled={!alunoEncontrado} icon={IconBraco} />
                                <InputComIcone label="Braço Direito (Kg)" name="bracoDir" value={form.bracoDir} onChange={handleChange} disabled={!alunoEncontrado} icon={IconBraco} />
                                <InputComIcone label="Perna Esquerda (Kg)" name="pernaEsq" value={form.pernaEsq} onChange={handleChange} disabled={!alunoEncontrado} icon={IconPerna} />
                                <InputComIcone label="Perna Direita (Kg)" name="pernaDir" value={form.pernaDir} onChange={handleChange} disabled={!alunoEncontrado} icon={IconPerna} />
                            </div>
                        </div>

                        <div className="mb-10">
                            <div className="flex items-center gap-3 mb-5 border-b border-slate-50 pb-3">
                                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-black shrink-0">2</div>
                                <div>
                                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Composição Corporal</h4>
                                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">Informe os dados de composição corporal gerais.</p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
                                <div className="flex flex-col">
                                    <label className="flex items-center gap-1.5 text-[11px] font-black text-slate-700 uppercase tracking-widest mb-2 ml-1">
                                        Água Total (L)
                                        <InfoTooltip text="Água Corporal Total: Pode sinalizar tanto para um quadro de desidratação quanto de retenção de líquidos." />
                                    </label>
                                    <div className="relative">
                                        <input type="text" inputMode="decimal" name="aguaTotal" value={form.aguaTotal} onChange={handleChange} className={`${inputClass} pr-10`} disabled={!alunoEncontrado}/>
                                        <Droplet className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    </div>
                                </div>
                                <div className="flex flex-col">
                                    <label className="flex items-center gap-1.5 text-[11px] font-black text-slate-700 uppercase tracking-widest mb-2 ml-1">
                                        Relação Cintura Quadril
                                        <InfoTooltip text="RCQ: Cálculo feito a partir das medidas da cintura e do quadril para verificar risco cardiovascular." />
                                    </label>
                                    <div className="relative">
                                        <input type="text" inputMode="decimal" name="rcq" value={form.rcq} onChange={handleChange} className={`${inputClass} pr-10`} disabled={!alunoEncontrado}/>
                                        <BarChart3 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    </div>
                                </div>
                                <div className="flex flex-col">
                                    <label className="flex items-center gap-1.5 text-[11px] font-black text-slate-700 uppercase tracking-widest mb-2 ml-1">
                                        Gordura Visceral
                                        <InfoTooltip text="GV: Gordura que se acumula na cavidade abdominal, entre órgãos como estômago, fígado e pâncreas." />
                                    </label>
                                    <div className="relative">
                                        <input type="text" inputMode="decimal" name="gv" value={form.gv} onChange={handleChange} className={`${inputClass} pr-10`} disabled={!alunoEncontrado}/>
                                        <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <InputComIcone label="Massa Muscular Esquelética (MME)" name="mme" value={form.mme} onChange={handleChange} disabled={!alunoEncontrado} icon={Dumbbell} example="Ex.: 24.3" />
                                <InputComIcone label="Percentual de Gordura (PGC)" name="pgc" value={form.pgc} onChange={handleChange} disabled={!alunoEncontrado} icon={Percent} example="Ex.: 47.0" />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-3 mb-5 border-b border-slate-50 pb-3">
                                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-black shrink-0">3</div>
                                <div>
                                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Resultados Calculados</h4>
                                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">Os resultados são calculados automaticamente com base nos dados informados.</p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-orange-50/30 border border-orange-100 rounded-[20px] p-6 shadow-sm flex flex-col justify-between">
                                    <div className="flex items-start gap-5 mb-5">
                                        <div className="w-16 h-16 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center shrink-0 shadow-inner"><Dumbbell className="w-8 h-8" /></div>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Resultado SMI</p>
                                                <InfoTooltip text="SMI (Skeletal Muscle Index): Aponta para um quadro clínico de sarcopenia e baixa tolerância ao exercício." />
                                            </div>
                                            <p className={`text-4xl font-black tracking-tighter mb-2 ${parseFloat(smi.valor) > 0 ? 'text-slate-800' : 'text-slate-300'}`}>{parseFloat(smi.valor) > 0 ? smi.valor : '0.00'}</p>
                                            <div className="self-start">
                                                <span className={`px-3 py-1 rounded-md border font-black uppercase text-[10px] tracking-widest shadow-sm ${smi.bg} ${smi.cor} ${getBorderClass(smi.cor)}`}>{smi.status}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mt-auto">
                                        <div className={`h-full ${smi.valor > 0 ? 'bg-orange-500' : 'bg-transparent'} transition-all duration-700`} style={{ width: `${Math.min((parseFloat(smi.valor || 0) / 10) * 100, 100)}%` }}></div>
                                    </div>
                                </div>
                                
                                <div className="bg-rose-50/30 border border-rose-100 rounded-[20px] p-6 shadow-sm flex flex-col justify-between">
                                    <div className="flex items-start gap-5 mb-5">
                                        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center shrink-0 shadow-inner"><Droplet className="w-8 h-8" /></div>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Hidratação</p>
                                                <InfoTooltip text="Níveis ideais de água corporal garantem a correta função metabólica. Avalie retenção ou desidratação." />
                                            </div>
                                            <p className={`text-4xl font-black tracking-tighter mb-2 ${parseFloat(hidratacao.valor) > 0 ? 'text-slate-800' : 'text-slate-300'}`}>{parseFloat(hidratacao.valor) > 0 ? `${hidratacao.valor}%` : '0.0%'}</p>
                                            <div className="self-start">
                                                <span className={`px-3 py-1 rounded-md border font-black uppercase text-[10px] tracking-widest shadow-sm ${hidratacao.bg} ${hidratacao.cor} ${getBorderClass(hidratacao.cor)}`}>{hidratacao.status}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mt-auto">
                                        <div className={`h-full ${hidratacao.valor > 0 ? 'bg-rose-500' : 'bg-transparent'} transition-all duration-700`} style={{ width: `${Math.min(parseFloat(hidratacao.valor || 0), 100)}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={`${sectionClass} mt-6 !p-8`}>
                        <div className="flex items-center gap-4 border-b border-slate-100 pb-5 mb-6">
                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-inner shrink-0">
                                <ListChecks className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Questionário de Anamnese</h3>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Responda as perguntas abaixo para conhecermos melhor o perfil e a saúde do aluno.</p>
                            </div>
                        </div>

                        {loadingPerguntas ? (
                            <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
                        ) : perguntasDinamicas.length === 0 ? (
                            <p className="text-xs font-bold text-slate-400 text-center py-6">Nenhuma pergunta configurada pelo administrador.</p>
                        ) : (
                            <div className="flex flex-col">
                                {perguntasDinamicas.map((p, index) => {
                                    const iconObj = anamneseIcons[index % anamneseIcons.length];
                                    const IconComp = iconObj.Icon;

                                    return (
                                        <div key={p.id} className="flex gap-5 items-start border-b border-slate-100 pb-8 pt-6 first:pt-2 last:border-0 last:pb-0">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${iconObj.bg} ${iconObj.text} shadow-sm hidden sm:flex mt-1`}><IconComp className="w-6 h-6" /></div>
                                            <div className="flex-1 w-full min-w-0">
                                                <div className="flex items-start sm:items-center gap-3 mb-2 flex-col sm:flex-row">
                                                    <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md text-[11px] font-black tracking-widest shrink-0 shadow-sm border border-slate-200">{String(index + 1).padStart(2, '0')}</span>
                                                    <h4 className="text-[14px] font-black text-slate-800 tracking-tight leading-snug">{p.pergunta} {p.obrigatorio && <span className="text-rose-500">*</span>}</h4>
                                                </div>
                                                {p.descricao && (<p className="text-xs font-medium text-slate-500 mb-4 leading-relaxed pr-4">{p.descricao}</p>)}
                                                <div className="mt-3">
                                                    {p.tipo === 'TEXTO_CURTO' && (
                                                        <input type="text" className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 rounded-xl text-sm font-bold text-slate-700 outline-none py-3 px-4 transition-all shadow-sm placeholder:text-slate-400" 
                                                            disabled={!alunoEncontrado} placeholder="Digite sua resposta..." value={respostasDinamicas[p.id] || ''} onChange={(e) => handleRespostaDinamica(p.id, e.target.value, p.tipo)} />
                                                    )}
                                                    {p.tipo === 'TEXTO_LONGO' && (
                                                        <div className="relative">
                                                            <textarea className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 rounded-2xl text-sm font-medium text-slate-700 outline-none p-4 transition-all resize-none shadow-sm placeholder:text-slate-400 pb-8" 
                                                                rows="3" disabled={!alunoEncontrado} placeholder="Ex.: observações sobre lesões, acompanhamento..." value={respostasDinamicas[p.id] || ''} onChange={(e) => handleRespostaDinamica(p.id, e.target.value, p.tipo)} />
                                                            <span className="absolute bottom-3 right-4 text-[10px] font-black text-slate-300 tracking-widest">{respostasDinamicas[p.id]?.length || 0}/200</span>
                                                        </div>
                                                    )}
                                                    {(p.tipo === 'SELECT' || p.tipo === 'CHECKBOX') && (
                                                        <div className="flex flex-wrap items-center gap-3">
                                                            {p.opcoes.map(o => {
                                                                const isOutro = o.toLowerCase().trim().startsWith('outro');
                                                                let isChecked = false;
                                                                if (p.tipo === 'SELECT') isChecked = respostasDinamicas[p.id] === o; else if (p.tipo === 'CHECKBOX') isChecked = (respostasDinamicas[p.id] || []).includes(o);

                                                                return (
                                                                    <React.Fragment key={o}>
                                                                        <label className={`cursor-pointer px-5 py-2.5 rounded-full border text-xs font-bold transition-all select-none flex items-center justify-center min-w-[80px] gap-2 ${isChecked ? 'bg-blue-100/50 border-blue-500 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
                                                                            <input type={p.tipo === 'SELECT' ? 'radio' : 'checkbox'} name={p.tipo === 'SELECT' ? p.id : undefined} value={o} checked={isChecked} onChange={(e) => handleRespostaDinamica(p.id, e.target.value, p.tipo)} className="hidden" disabled={!alunoEncontrado} />
                                                                            {isChecked && <CheckCircle2 className="w-4 h-4 fill-blue-500 text-white shrink-0" />} {o || 'Opção Vazia'}
                                                                        </label>
                                                                        {isOutro && isChecked && (<input type="text" placeholder="Especifique a resposta..." disabled={!alunoEncontrado} className="w-full sm:w-auto flex-1 min-w-[250px] bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 rounded-xl text-sm font-bold text-slate-700 outline-none py-2 px-4 transition-all shadow-sm placeholder:text-slate-400 animate-[fadeIn_0.2s_ease-out]" value={respostasOutros[p.id] || ''} onChange={(e) => setRespostasOutros({...respostasOutros, [p.id]: e.target.value})} autoFocus />)}
                                                                    </React.Fragment>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    <button type="submit" disabled={isSubmitting || !alunoEncontrado} className="w-full mt-6 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black py-5 rounded-[20px] shadow-[0_4px_15px_rgba(249,115,22,0.3)] transition-all uppercase tracking-widest flex items-center justify-center gap-2 text-sm">
                        {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> {t('assessment.form.savingBtn', {defaultValue: 'Salvando...'})}</> : <><Send className="w-5 h-5" /> {avaliacaoEditando ? 'Atualizar Avaliação Física' : t('assessment.form.saveBtn', {defaultValue: 'Salvar Avaliação Física'})}</>}
                    </button>
                </div>
            </form>
        </>
    );
};

export default FormAvaliacao;