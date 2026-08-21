import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import { useI18n } from '../../i18n/I18nContext.jsx'; 
import { calcularSMI, calcularHidratacao, classificarRCQ, classificarGV, classificarPressao } from './utils.js';
import { mascaraCPF, validarCPF, formatarTelefone, calcularIdade } from '../CadastroGeral/utilsAlunos.js'; 
import { Activity, HeartPulse, CheckSquare, Send, Loader2, CheckCircle2, AlertCircle, Search, UserRoundPen, UserPlus, CreditCard, AlertTriangle, ListChecks } from 'lucide-react';
import ModalAluno from '../../components/Modals/ModalAluno.jsx'; 

const getLocalIsoDate = () => {
    const d = new Date();
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
};

const getBorderClass = (textClass) => {
    if (!textClass) return 'border-slate-200';
    if (textClass.includes('emerald')) return 'border-emerald-200';
    if (textClass.includes('amber')) return 'border-amber-200';
    if (textClass.includes('rose')) return 'border-rose-200';
    if (textClass.includes('orange')) return 'border-orange-200';
    if (textClass.includes('blue')) return 'border-blue-200';
    return 'border-slate-200';
};

const FormAvaliacao = ({ usuarioLogado, professorAtivo, voltar, setAvaliacoes }) => {
    const { t, locale, language } = useI18n(); 
    const langAtual = locale || language || 'pt-BR';

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sucesso, setSucesso] = useState(false);
    
    const [cpfBusca, setCpfBusca] = useState('');
    const [cpfErro, setCpfErro] = useState(false);
    const [buscandoCpf, setBuscandoCpf] = useState(false);
    const [alunoEncontrado, setAlunoEncontrado] = useState(null); 
    const [statusCpf, setStatusCpf] = useState(null); 
    const [modalAlunoAberto, setModalAlunoAberto] = useState(false);

    const [form, setForm] = useState({
        peso: '', altura: '', sistolica: '', diastolica: '',
        bracoEsq: '', bracoDir: '', pernaEsq: '', pernaDir: '', aguaTotal: '', rcq: '', gv: '',
        checklist: { diagnose: false, email: false, treino: false, apenasAvaliacao: false }
    });

    // Estados do Formulário Dinâmico
    const [perguntasDinamicas, setPerguntasDinamicas] = useState([]);
    const [respostasDinamicas, setRespostasDinamicas] = useState({});
    const [respostasOutros, setRespostasOutros] = useState({}); // 🔥 Texto digitado no "Outro"
    const [loadingPerguntas, setLoadingPerguntas] = useState(true);

    const debounceRef = useRef(null);

    useEffect(() => {
        const carregarPerguntas = async () => {
            try {
                const { data, error } = await supabase
                    .from('avaliacao_perguntas')
                    .select('*')
                    .eq('ativo', true)
                    .order('ordem', { ascending: true });
                if (error) throw error;
                setPerguntasDinamicas(data || []);
            } catch (err) {
                console.error("Erro ao carregar anamnese dinâmica:", err);
            } finally {
                setLoadingPerguntas(false);
            }
        };
        carregarPerguntas();

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    const buscarAlunoPorCpf = async (cpfLimpo) => {
        setBuscandoCpf(true);
        setStatusCpf(null);
        try {
            const { data, error } = await supabase.from('alunos').select('*').eq('cpf', cpfLimpo).maybeSingle();
            if (error && error.code !== 'PGRST116') throw error;

            if (data) {
                setAlunoEncontrado(data);
                setStatusCpf('encontrado');
            } else {
                setAlunoEncontrado(null);
                setStatusCpf('novo');
            }
        } catch (error) {
            console.error(error);
            setStatusCpf('erro');
        } finally {
            setBuscandoCpf(false);
        }
    };

    const handleCpfChange = (e) => {
        const masked = mascaraCPF(e.target.value);
        setCpfBusca(masked);
        setAlunoEncontrado(null); 
        setStatusCpf(null);
        
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (masked.length === 14) {
            if (!validarCPF(masked)) {
                setCpfErro(true);
            } else {
                setCpfErro(false);
                const limpo = masked.replace(/\D/g, '');
                debounceRef.current = setTimeout(() => buscarAlunoPorCpf(limpo), 500);
            }
        } else {
            setCpfErro(false);
        }
    };

    const handleSaveAlunoSuccess = (alunoAtualizado) => {
        setAlunoEncontrado(alunoAtualizado);
        setCpfBusca(mascaraCPF(alunoAtualizado.cpf)); 
        setStatusCpf('encontrado');
    };

    const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleCheck = (e) => setForm(prev => ({ ...prev, checklist: { ...prev.checklist, [e.target.name]: e.target.checked } }));

    const handleRespostaDinamica = (perguntaId, valor, tipo) => {
        setRespostasDinamicas(prev => {
            if (tipo === 'CHECKBOX') {
                const atual = prev[perguntaId] || [];
                if (atual.includes(valor)) {
                    return { ...prev, [perguntaId]: atual.filter(v => v !== valor) };
                } else {
                    return { ...prev, [perguntaId]: [...atual, valor] };
                }
            } else {
                return { ...prev, [perguntaId]: valor };
            }
        });
    };

    const sexoAluno = alunoEncontrado?.sexo || 'M';
    const pressao = classificarPressao(form.sistolica, form.diastolica, t);
    const smi = calcularSMI(form.bracoEsq, form.bracoDir, form.pernaEsq, form.pernaDir, form.altura, sexoAluno, t);
    const hidratacao = calcularHidratacao(form.aguaTotal, form.peso, sexoAluno, t);
    const rcq = classificarRCQ(form.rcq, sexoAluno, t);
    const gv = classificarGV(form.gv, t);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!alunoEncontrado) return alert(t('assessment.form.alertFindStudent', {defaultValue: 'Você precisa localizar ou cadastrar o aluno primeiro!'}));
        if (!usuarioLogado?.unidade) return alert(t('assessment.form.alertUnit', {defaultValue: 'Erro de sessão: Unidade não identificada.'}));

        const parseVal = (v) => parseFloat(String(v || 0).replace(',', '.')) || 0;
        let alt = parseVal(form.altura);
        if (alt > 3) alt = alt / 100; 
        const p = parseVal(form.peso);

        if (p <= 0 || p > 300) return alert(t('assessment.form.alertWeight', {defaultValue: 'Peso inválido.'}));
        if (alt < 0.5 || alt > 2.5) return alert(t('assessment.form.alertHeight', {defaultValue: 'Altura inválida.'}));

        // 🔥 FUSÃO DAS RESPOSTAS COM OS TEXTOS DE "OUTRO"
        const respostasFinais = { ...respostasDinamicas };
        for (const p of perguntasDinamicas) {
            if (p.tipo === 'SELECT') {
                const resp = respostasFinais[p.id];
                if (resp && resp.toLowerCase().trim().startsWith('outro') && respostasOutros[p.id]) {
                    respostasFinais[p.id] = `${resp} ${respostasOutros[p.id]}`;
                }
            } else if (p.tipo === 'CHECKBOX') {
                const respArray = respostasFinais[p.id];
                if (Array.isArray(respArray)) {
                    respostasFinais[p.id] = respArray.map(r => {
                        if (r.toLowerCase().trim().startsWith('outro') && respostasOutros[p.id]) {
                            return `${r} ${respostasOutros[p.id]}`;
                        }
                        return r;
                    });
                }
            }
            
            // Validação de Obrigatoriedade
            if (p.obrigatorio) {
                const resp = respostasFinais[p.id];
                if (!resp || (Array.isArray(resp) && resp.length === 0)) {
                    alert(`A pergunta "${p.pergunta}" é obrigatória.`);
                    return;
                }
            }
        }

        setIsSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const novaAvaliacao = {
                aluno_id: alunoEncontrado.id,
                aluno: alunoEncontrado.nome, 
                email: alunoEncontrado.email, 
                cpf: alunoEncontrado.cpf, 
                unidade: usuarioLogado.unidade,
                professor_id: professorAtivo.id, 
                professor: professorAtivo.nome,
                registrado_por_id: user?.id || null, 
                registrado_por_nome: usuarioLogado?.nome || user?.email || 'SISTEMA',
                registrado_por_email: user?.email || '',
                sexo: sexoAluno, 
                peso: p, 
                altura: alt,
                sistolica: parseInt(form.sistolica || 0, 10), 
                diastolica: parseInt(form.diastolica || 0, 10),
                braco_esq: parseVal(form.bracoEsq), 
                braco_dir: parseVal(form.bracoDir),
                perna_esq: parseVal(form.pernaEsq), 
                perna_dir: parseVal(form.pernaDir),
                agua_total: parseVal(form.aguaTotal), 
                rcq: parseVal(form.rcq), 
                gv: parseVal(form.gv),
                smi_resultado: smi.valor, 
                smi_status: smi.status,
                hidratacao_resultado: hidratacao.valor, 
                hidratacao_status: hidratacao.status,
                rcq_status: rcq.status, 
                gv_status: gv.status, 
                pressao_status: pressao.status,
                disponibilidade: '', objetivo: '', restricoes: '', 
                checklist: form.checklist,
                respostas_dinamicas: respostasFinais, // 🔥 SALVA TUDO FUNDIDO E PROCESSADO
                data: getLocalIsoDate() 
            };

            const { data, error } = await supabase.from('avaliacoes_realizadas').insert([novaAvaliacao]).select();
            if (error) throw error;
            
            if (data && setAvaliacoes) setAvaliacoes(prev => [data[0], ...prev]);
            setSucesso(true);
            setTimeout(() => { setSucesso(false); voltar(); }, 2000);

        } catch (err) {
            alert(t('assessment.form.errorSave', {defaultValue: 'Erro ao salvar avaliação.'}));
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const labelClass = "block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1";
    const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 transition-all shadow-sm placeholder:text-slate-300";
    const sectionClass = "bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 relative overflow-hidden";

    return (
        <>
            <ModalAluno isOpen={modalAlunoAberto} onClose={() => setModalAlunoAberto(false)} alunoInicial={alunoEncontrado || { cpf: cpfBusca }} onSaveSuccess={handleSaveAlunoSuccess} usuarioLogado={usuarioLogado}/>

            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6 animate-[fadeIn_0.3s_ease-out] pb-10">
                {sucesso && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
                        <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center animate-[zoomIn_0.2s_ease-out] max-w-sm w-full mx-4 border border-slate-200">
                            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-inner border border-emerald-200"><CheckCircle2 className="w-10 h-10" /></div>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">{t('assessment.form.savedTitle')}</h3>
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between bg-slate-900 rounded-[24px] p-6 shadow-md">
                    <div>
                        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">{t('assessment.form.title')}</h2>
                        <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{t('assessment.prof')}: {professorAtivo.nome}</p>
                    </div>
                    <button type="button" onClick={voltar} className="bg-white/10 hover:bg-white/20 text-white border border-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors">{t('assessment.form.cancel')}</button>
                </div>

                <div className={sectionClass}>
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-2">
                        <Search className="w-5 h-5 text-blue-500" />
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">{t('assessment.form.studentData', {defaultValue: 'Localizar Aluno'})}</h3>
                    </div>
                    
                    <div className="flex flex-col gap-6">
                        <div className="relative max-w-sm">
                            <label className={labelClass}>{t('assessment.form.cpf')}</label>
                            <div className="relative">
                                <input type="text" value={cpfBusca} onChange={handleCpfChange} maxLength="14" className={`${inputClass} ${cpfErro ? 'border-rose-300 bg-rose-50 focus:ring-rose-500' : 'focus:ring-blue-500'}`} placeholder="000.000.000-00" />
                                {buscandoCpf && <Loader2 className="w-4 h-4 text-blue-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
                                {alunoEncontrado && <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2" />}
                                {statusCpf === 'erro' && <AlertTriangle className="w-4 h-4 text-rose-500 absolute right-3 top-1/2 -translate-y-1/2" />}
                            </div>
                            {cpfErro && <span className="text-rose-500 text-[9px] font-bold uppercase mt-1 ml-1">{t('assessment.form.invalidCpf')}</span>}
                            {statusCpf === 'encontrado' && <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mt-1.5 ml-1">{t('assessment.form.studentFound')}</p>}
                            {statusCpf === 'novo' && <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mt-1.5 ml-1">{t('assessment.form.studentNotFound')}</p>}
                            {statusCpf === 'erro' && <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest mt-1.5 ml-1">{t('assessment.form.studentError')}</p>}
                        </div>

                        {!buscandoCpf && cpfBusca.length === 14 && !cpfErro && statusCpf !== 'erro' && (
                            alunoEncontrado ? (
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-inner flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 mb-2">{alunoEncontrado.nome} <CheckCircle2 className="w-4 h-4 text-emerald-500" /></h4>
                                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold text-slate-500">
                                            {alunoEncontrado.matricula && <span className="flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" /> Mat: {alunoEncontrado.matricula}</span>}
                                            {alunoEncontrado.telefone && <span className="flex items-center gap-1">📞 {formatarTelefone(alunoEncontrado.telefone)}</span>}
                                            {alunoEncontrado.email && <span className="flex items-center gap-1">✉️ {alunoEncontrado.email}</span>}
                                            {alunoEncontrado.data_nascimento && <span className="flex items-center gap-1">📅 {new Date(alunoEncontrado.data_nascimento + 'T12:00:00').toLocaleDateString(langAtual)} • {calcularIdade(alunoEncontrado.data_nascimento)} {t('students.ageYearsText')}</span>}
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => setModalAlunoAberto(true)} className="w-full md:w-auto px-5 py-2.5 bg-white border border-slate-200 text-blue-600 hover:bg-blue-50 hover:border-blue-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-sm shrink-0">
                                        <UserRoundPen className="w-4 h-4" /> {t('assessment.form.editData')}
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-inner flex flex-col md:flex-row justify-between items-center gap-4">
                                    <div>
                                        <h4 className="text-sm font-black text-amber-800 uppercase tracking-tight mb-1">{t('assessment.form.notFoundTitle')}</h4>
                                        <p className="text-xs font-bold text-amber-700/70">{t('assessment.form.notFoundSub')}</p>
                                    </div>
                                    <button type="button" onClick={() => setModalAlunoAberto(true)} className="w-full md:w-auto px-5 py-2.5 bg-amber-500 text-white hover:bg-amber-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-sm shrink-0">
                                        <UserPlus className="w-4 h-4" /> {t('assessment.form.registerStudent')}
                                    </button>
                                </div>
                            )
                        )}
                    </div>
                </div>

                <div className={`transition-all duration-500 ${!alunoEncontrado ? 'opacity-30 pointer-events-none grayscale-[50%]' : 'opacity-100'}`}>
                    
                    <div className={sectionClass}>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className={labelClass}>{t('assessment.form.weight')}</label><input type="text" inputMode="decimal" name="peso" value={form.peso} onChange={handleChange} required className={inputClass} placeholder="Ex: 75.5" disabled={!alunoEncontrado}/></div>
                            <div><label className={labelClass}>{t('assessment.height')}</label><input type="text" inputMode="decimal" name="altura" value={form.altura} onChange={handleChange} required className={inputClass} placeholder="Ex: 1.75 ou 175" disabled={!alunoEncontrado}/></div>
                        </div>
                    </div>

                    <div className={`${sectionClass} mt-6`}>
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-2">
                            <div className="flex items-center gap-2"><HeartPulse className="w-5 h-5 text-rose-500" /><h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">{t('assessment.form.bloodPressure')}</h3></div>
                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-md border shadow-sm transition-colors ${pressao.bg} ${pressao.cor} ${getBorderClass(pressao.cor)}`}>{pressao.status}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className={labelClass}>{t('assessment.form.systolic')}</label><input type="number" name="sistolica" value={form.sistolica} onChange={handleChange} className={inputClass} disabled={!alunoEncontrado}/></div>
                            <div><label className={labelClass}>{t('assessment.form.diastolic')}</label><input type="number" name="diastolica" value={form.diastolica} onChange={handleChange} className={inputClass} disabled={!alunoEncontrado}/></div>
                        </div>
                    </div>

                    <div className={`${sectionClass} mt-6`}>
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-4"><Activity className="w-5 h-5 text-blue-500" /><h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">{t('assessment.form.bioimpedance')}</h3></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            <div><label className={labelClass}>{t('assessment.form.leftArm')}</label><input type="text" inputMode="decimal" name="bracoEsq" value={form.bracoEsq} onChange={handleChange} className={inputClass} placeholder="0.0" disabled={!alunoEncontrado}/></div>
                            <div><label className={labelClass}>{t('assessment.form.rightArm')}</label><input type="text" inputMode="decimal" name="bracoDir" value={form.bracoDir} onChange={handleChange} className={inputClass} placeholder="0.0" disabled={!alunoEncontrado}/></div>
                            <div><label className={labelClass}>{t('assessment.form.leftLeg')}</label><input type="text" inputMode="decimal" name="pernaEsq" value={form.pernaEsq} onChange={handleChange} className={inputClass} placeholder="0.0" disabled={!alunoEncontrado}/></div>
                            <div><label className={labelClass}>{t('assessment.form.rightLeg')}</label><input type="text" inputMode="decimal" name="pernaDir" value={form.pernaDir} onChange={handleChange} className={inputClass} placeholder="0.0" disabled={!alunoEncontrado}/></div>
                            
                            <div className="lg:col-span-2"><label className={labelClass}>{t('assessment.form.totalWater')}</label><input type="text" inputMode="decimal" name="aguaTotal" value={form.aguaTotal} onChange={handleChange} className={inputClass} placeholder="0.0" disabled={!alunoEncontrado}/></div>
                            <div className="lg:col-span-1"><label className={labelClass}>RCQ</label><input type="text" inputMode="decimal" name="rcq" value={form.rcq} onChange={handleChange} className={inputClass} placeholder="Ex: 0.85" disabled={!alunoEncontrado}/></div>
                            <div className="lg:col-span-1"><label className={labelClass}>GV</label><input type="text" inputMode="decimal" name="gv" value={form.gv} onChange={handleChange} className={inputClass} placeholder="Ex: 9" disabled={!alunoEncontrado}/></div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
                            <div className="flex flex-col gap-4">
                                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col items-center justify-center text-center relative overflow-hidden h-36 shadow-sm">
                                    <div className="absolute bottom-0 left-0 h-1.5 bg-slate-200 w-full"><div className={`h-full ${smi.valor > 0 ? smi.bg.replace('-100', '-500') : 'bg-transparent'} transition-all duration-700`} style={{ width: `${Math.min((parseFloat(smi.valor || 0) / 10) * 100, 100)}%` }}></div></div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('assessment.smiResult')}</p>
                                    <p className={`text-4xl font-black tracking-tighter mb-2 ${parseFloat(smi.valor) > 0 ? 'text-slate-800' : 'text-slate-300'}`}>{parseFloat(smi.valor) > 0 ? smi.valor : '0.00'}</p>
                                    <div className={`px-4 py-1.5 rounded-lg border font-black uppercase text-[10px] tracking-widest shadow-sm ${smi.bg} ${smi.cor} ${getBorderClass(smi.cor)}`}>{smi.status}</div>
                                </div>
                            </div>
                            <div className="flex flex-col gap-4">
                                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col items-center justify-center text-center relative overflow-hidden h-36 shadow-sm">
                                    <div className="absolute bottom-0 left-0 h-1.5 bg-slate-200 w-full"><div className={`h-full ${hidratacao.valor > 0 ? hidratacao.bg.replace('-100', '-500') : 'bg-transparent'} transition-all duration-700`} style={{ width: `${Math.min(parseFloat(hidratacao.valor || 0), 100)}%` }}></div></div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Hidratação</p>
                                    <p className={`text-4xl font-black tracking-tighter mb-2 ${parseFloat(hidratacao.valor) > 0 ? 'text-slate-800' : 'text-slate-300'}`}>{parseFloat(hidratacao.valor) > 0 ? `${hidratacao.valor}%` : '0.0%'}</p>
                                    <div className={`px-4 py-1.5 rounded-lg border font-black uppercase text-[10px] tracking-widest shadow-sm ${hidratacao.bg} ${hidratacao.cor} ${getBorderClass(hidratacao.cor)}`}>{hidratacao.status}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 🔥 O QUESTIONÁRIO FINAL DO PROFESSOR (COM SUPORTE A "OUTRO") */}
                    <div className={`${sectionClass} mt-6`}>
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-4">
                            <ListChecks className="w-5 h-5 text-indigo-500" />
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Questionário de Anamnese</h3>
                        </div>

                        {loadingPerguntas ? (
                            <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 text-indigo-500 animate-spin" /></div>
                        ) : perguntasDinamicas.length === 0 ? (
                            <p className="text-xs font-bold text-slate-400 text-center py-4">Nenhuma pergunta configurada pelo administrador.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {perguntasDinamicas.map((p) => (
                                    <div key={p.id} className={p.tipo === 'TEXTO_LONGO' || p.tipo === 'CHECKBOX' ? 'md:col-span-2' : 'col-span-1'}>
                                        <label className={labelClass}>
                                            {p.pergunta} {p.obrigatorio && <span className="text-rose-500">*</span>}
                                        </label>
                                        
                                        {p.tipo === 'TEXTO_CURTO' && (
                                            <input 
                                                type="text" className={inputClass} disabled={!alunoEncontrado} placeholder="Sua resposta"
                                                value={respostasDinamicas[p.id] || ''} 
                                                onChange={(e) => handleRespostaDinamica(p.id, e.target.value, p.tipo)} 
                                            />
                                        )}

                                        {p.tipo === 'TEXTO_LONGO' && (
                                            <textarea 
                                                className={`${inputClass} resize-none`} rows="3" disabled={!alunoEncontrado} placeholder="Sua resposta detalhada"
                                                value={respostasDinamicas[p.id] || ''} 
                                                onChange={(e) => handleRespostaDinamica(p.id, e.target.value, p.tipo)} 
                                            />
                                        )}

                                        {p.tipo === 'SELECT' && (
                                            <div className="flex flex-col gap-2 mt-2">
                                                <select 
                                                    className={inputClass} disabled={!alunoEncontrado}
                                                    value={respostasDinamicas[p.id] || ''} 
                                                    onChange={(e) => handleRespostaDinamica(p.id, e.target.value, p.tipo)}
                                                >
                                                    <option value="">Selecione...</option>
                                                    {p.opcoes.map(o => <option key={o} value={o}>{o || 'Opção Vazia'}</option>)}
                                                </select>
                                                {(respostasDinamicas[p.id] || '').toLowerCase().trim().startsWith('outro') && (
                                                    <input 
                                                        type="text" placeholder="Especifique..." disabled={!alunoEncontrado}
                                                        className={`${inputClass} !py-2 animate-[fadeIn_0.2s_ease-out]`}
                                                        value={respostasOutros[p.id] || ''}
                                                        onChange={(e) => setRespostasOutros({...respostasOutros, [p.id]: e.target.value})}
                                                    />
                                                )}
                                            </div>
                                        )}

                                        {p.tipo === 'CHECKBOX' && (
                                            <div className="flex flex-col gap-2 mt-2">
                                                {p.opcoes.map(o => {
                                                    const isOutro = o.toLowerCase().trim().startsWith('outro');
                                                    const isChecked = (respostasDinamicas[p.id] || []).includes(o);
                                                    return (
                                                        <div key={o} className="flex flex-col sm:flex-row sm:items-center gap-2">
                                                            <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl hover:bg-slate-100 transition-colors w-fit">
                                                                <input 
                                                                    type="checkbox" disabled={!alunoEncontrado}
                                                                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 disabled:opacity-50" 
                                                                    checked={isChecked}
                                                                    onChange={() => handleRespostaDinamica(p.id, o, p.tipo)}
                                                                />
                                                                <span className="text-xs font-bold text-slate-700">{o || 'Opção Vazia'}</span>
                                                            </label>
                                                            {isOutro && isChecked && (
                                                                <input 
                                                                    type="text" placeholder="Especifique..." disabled={!alunoEncontrado}
                                                                    className={`${inputClass} !py-2 flex-1 min-w-[200px] animate-[fadeIn_0.2s_ease-out]`}
                                                                    value={respostasOutros[p.id] || ''}
                                                                    onChange={(e) => setRespostasOutros({...respostasOutros, [p.id]: e.target.value})}
                                                                />
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <button type="submit" disabled={isSubmitting || !alunoEncontrado} className="w-full mt-6 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black py-4 rounded-2xl shadow-[0_4px_15px_rgba(249,115,22,0.3)] transition-all uppercase text-xs tracking-widest flex items-center justify-center gap-2">
                        {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> {t('assessment.form.savingBtn')}</> : <><Send className="w-5 h-5" /> {t('assessment.form.saveBtn')}</>}
                    </button>
                </div>
            </form>
        </>
    );
};

export default FormAvaliacao;