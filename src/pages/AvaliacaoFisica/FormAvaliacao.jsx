import React, { useState } from 'react';
import { supabase } from '../../supabaseClient.js';
import { calcularSMI, calcularHidratacao, classificarRCQ, classificarGV, classificarPressao } from './utils.js';
import { User, Activity, HeartPulse, Droplets, CheckSquare, Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const FormAvaliacao = ({ usuarioLogado, professorAtivo, voltar, setAvaliacoes }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sucesso, setSucesso] = useState(false);

    const [form, setForm] = useState({
        nome: '', email: '', sexo: 'M', peso: '', altura: '',
        sistolica: '', diastolica: '',
        bracoEsq: '', bracoDir: '', pernaEsq: '', pernaDir: '',
        aguaTotal: '', rcq: '', gv: '',
        disponibilidade: '', objetivo: '', restricoes: '', historicoCardiaco: '', acucar: '', nutrologo: '',
        checklist: { diagnose: false, email: false, treino: false, apenasAvaliacao: false }
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleCheck = (e) => {
        const { name, checked } = e.target;
        setForm(prev => ({
            ...prev,
            checklist: { ...prev.checklist, [name]: checked }
        }));
    };

    // ==========================================
    // CÁLCULOS EM TEMPO REAL
    // ==========================================
    const pressao = classificarPressao(form.sistolica, form.diastolica);
    const smi = calcularSMI(form.bracoEsq, form.bracoDir, form.pernaEsq, form.pernaDir, form.altura, form.sexo);
    const hidratacao = calcularHidratacao(form.aguaTotal, form.peso, form.sexo);
    const rcq = classificarRCQ(form.rcq, form.sexo);
    const gv = classificarGV(form.gv);

    // ==========================================
    // SALVAR NO BANCO
    // ==========================================
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        const novaAvaliacao = {
            unidade: usuarioLogado?.unidade || 'MATRIZ',
            professor: professorAtivo.nome,
            aluno: form.nome.toUpperCase(),
            email: form.email,
            sexo: form.sexo,
            peso: parseFloat(form.peso || 0),
            altura: parseFloat(form.altura || 0),
            sistolica: parseInt(form.sistolica || 0),
            diastolica: parseInt(form.diastolica || 0),
            braco_esq: parseFloat(form.bracoEsq || 0),
            braco_dir: parseFloat(form.bracoDir || 0),
            perna_esq: parseFloat(form.pernaEsq || 0),
            perna_dir: parseFloat(form.pernaDir || 0),
            agua_total: parseFloat(form.aguaTotal || 0),
            rcq: parseFloat(form.rcq || 0),
            gv: parseFloat(form.gv || 0),
            smi_resultado: smi.valor,
            smi_status: smi.status,
            hidratacao_resultado: hidratacao.valor,
            hidratacao_status: hidratacao.status,
            rcq_status: rcq.status,
            gv_status: gv.status,
            pressao_status: pressao.status,
            disponibilidade: form.disponibilidade,
            objetivo: form.objetivo,
            restricoes: form.restricoes,
            historico_cardiaco: form.historicoCardiaco,
            acucar: form.acucar,
            nutrologo: form.nutrologo,
            checklist: form.checklist,
            data: new Date().toISOString().split('T')[0],
            criado_em: new Date().toISOString()
        };

        const { data, error } = await supabase.from('avaliacoes_fisicas').insert([novaAvaliacao]).select();

        if (error) {
            alert('Erro ao salvar avaliação. Certifique-se de que a tabela "avaliacoes_fisicas" existe no Supabase e permite inserção.');
            console.error(error);
        } else if (data) {
            if (setAvaliacoes) setAvaliacoes(prev => [data[0], ...prev]);
            setSucesso(true);
            setTimeout(() => {
                setSucesso(false);
                voltar(); // Retorna para a tela de relatórios após o sucesso
            }, 2000);
        }
        setIsSubmitting(false);
    };

    const labelClass = "block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1";
    const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 transition-all shadow-sm placeholder:font-medium placeholder:text-slate-300";
    const sectionClass = "bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 relative overflow-hidden";

    return (
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6 animate-[fadeIn_0.3s_ease-out] pb-10">
            
            {sucesso && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center animate-[zoomIn_0.2s_ease-out] max-w-sm w-full mx-4 border border-slate-200">
                        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-inner border border-emerald-200">
                            <CheckCircle2 className="w-10 h-10" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Avaliação Salva!</h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Registrada com sucesso no banco.</p>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between bg-slate-900 rounded-[24px] p-6 shadow-md">
                <div>
                    <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                        Nova Avaliação Física
                    </h2>
                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Professor: {professorAtivo.nome}</p>
                </div>
                <button type="button" onClick={voltar} className="bg-white/10 hover:bg-white/20 text-white border border-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors">
                    Cancelar
                </button>
            </div>

            {/* SEÇÃO 1: DADOS DO ALUNO */}
            <div className={sectionClass}>
                <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-2">
                    <User className="w-5 h-5 text-orange-500" />
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Dados do Aluno</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className={labelClass}>Nome Completo *</label>
                        <input type="text" name="nome" value={form.nome} onChange={handleChange} required className={inputClass} placeholder="Ex: João da Silva" />
                    </div>
                    <div>
                        <label className={labelClass}>Gênero Biológico *</label>
                        <select name="sexo" value={form.sexo} onChange={handleChange} className={inputClass}>
                            <option value="M">Masculino</option>
                            <option value="F">Feminino</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>E-mail</label>
                        <input type="email" name="email" value={form.email} onChange={handleChange} className={inputClass} placeholder="joao@email.com" />
                    </div>
                    <div>
                        <label className={labelClass}>Peso (kg) *</label>
                        <input type="number" step="0.01" name="peso" value={form.peso} onChange={handleChange} required className={inputClass} placeholder="Ex: 75.5" />
                    </div>
                    <div>
                        <label className={labelClass}>Altura (m) *</label>
                        <input type="number" step="0.01" name="altura" value={form.altura} onChange={handleChange} required className={inputClass} placeholder="Ex: 1.75" />
                    </div>
                </div>
            </div>

            {/* SEÇÃO 2: PRESSÃO ARTERIAL */}
            <div className={sectionClass}>
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-2">
                    <div className="flex items-center gap-2">
                        <HeartPulse className="w-5 h-5 text-rose-500" />
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Pressão Arterial</h3>
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-md border shadow-sm transition-colors ${pressao.bg} ${pressao.cor} border-${pressao.cor.split('-')[1]}-200`}>
                        {pressao.status}
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>Sistólica (mmHg)</label>
                        <input type="number" name="sistolica" value={form.sistolica} onChange={handleChange} className={inputClass} placeholder="Ex: 120" />
                    </div>
                    <div>
                        <label className={labelClass}>Diastólica (mmHg)</label>
                        <input type="number" name="diastolica" value={form.diastolica} onChange={handleChange} className={inputClass} placeholder="Ex: 80" />
                    </div>
                </div>
            </div>

            {/* SEÇÃO 3: COMPOSIÇÃO CORPORAL (BIOIMPEDÂNCIA) */}
            <div className={sectionClass}>
                <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-2">
                    <Activity className="w-5 h-5 text-blue-500" />
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Bioimpedância (Massa e Gordura)</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className={labelClass}>Braço Esquerdo (kg)</label><input type="number" step="0.01" name="bracoEsq" value={form.bracoEsq} onChange={handleChange} className={inputClass} placeholder="0.00" /></div>
                    <div><label className={labelClass}>Braço Direito (kg)</label><input type="number" step="0.01" name="bracoDir" value={form.bracoDir} onChange={handleChange} className={inputClass} placeholder="0.00" /></div>
                    <div><label className={labelClass}>Perna Esquerda (kg)</label><input type="number" step="0.01" name="pernaEsq" value={form.pernaEsq} onChange={handleChange} className={inputClass} placeholder="0.00" /></div>
                    <div><label className={labelClass}>Perna Direita (kg)</label><input type="number" step="0.01" name="pernaDir" value={form.pernaDir} onChange={handleChange} className={inputClass} placeholder="0.00" /></div>
                    
                    <div className="md:col-span-2 grid grid-cols-3 gap-4 mt-2">
                        <div><label className={labelClass}>Água Total (L)</label><input type="number" step="0.01" name="aguaTotal" value={form.aguaTotal} onChange={handleChange} className={inputClass} placeholder="0.00" /></div>
                        <div><label className={labelClass}>RCQ</label><input type="number" step="0.01" name="rcq" value={form.rcq} onChange={handleChange} className={inputClass} placeholder="Ex: 0.85" /></div>
                        <div><label className={labelClass}>GV (Gordura Visceral)</label><input type="number" step="0.01" name="gv" value={form.gv} onChange={handleChange} className={inputClass} placeholder="Nível" /></div>
                    </div>
                </div>

                {/* CARDS DE RESULTADO EM TEMPO REAL */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
                    <div className={`p-4 rounded-xl border flex flex-col justify-center items-center text-center transition-colors ${smi.bg} border-${smi.cor.split('-')[1]}-200`}>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Índice SMI</span>
                        <span className={`text-2xl font-black ${smi.cor}`}>{smi.valor || '-'}</span>
                        <span className={`text-[10px] font-bold uppercase mt-1 ${smi.cor}`}>{smi.status}</span>
                    </div>
                    <div className={`p-4 rounded-xl border flex flex-col justify-center items-center text-center transition-colors ${hidratacao.bg} border-${hidratacao.cor.split('-')[1]}-200`}>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Hidratação</span>
                        <span className={`text-2xl font-black ${hidratacao.cor}`}>{hidratacao.valor ? `${hidratacao.valor}%` : '-'}</span>
                        <span className={`text-[10px] font-bold uppercase mt-1 ${hidratacao.cor}`}>{hidratacao.status}</span>
                    </div>
                    <div className={`p-4 rounded-xl border flex flex-col justify-center items-center text-center transition-colors ${rcq.bg} border-${rcq.cor.split('-')[1]}-200`}>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Relação RCQ</span>
                        <span className={`text-2xl font-black ${rcq.cor}`}>{rcq.valor || '-'}</span>
                        <span className={`text-[10px] font-bold uppercase mt-1 ${rcq.cor}`}>{rcq.status}</span>
                    </div>
                    <div className={`p-4 rounded-xl border flex flex-col justify-center items-center text-center transition-colors ${gv.bg} border-${gv.cor.split('-')[1]}-200`}>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Gord. Visceral</span>
                        <span className={`text-2xl font-black ${gv.cor}`}>{gv.valor || '-'}</span>
                        <span className={`text-[10px] font-bold uppercase mt-1 ${gv.cor}`}>{gv.status}</span>
                    </div>
                </div>
            </div>

            {/* SEÇÃO 4: ANAMNESE */}
            <div className={sectionClass}>
                <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-2">
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Anamnese e Objetivos</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>Objetivo Principal</label>
                        <select name="objetivo" value={form.objetivo} onChange={handleChange} className={inputClass}>
                            <option value="">Selecione...</option>
                            <option value="Emagrecimento (SLIM)">Emagrecimento (SLIM)</option>
                            <option value="Hipertrofia (RESIST)">Hipertrofia (RESIST)</option>
                            <option value="Qualidade de Vida (START)">Qualidade de Vida (START)</option>
                            <option value="Outro">Outro</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Disponibilidade Semanal</label>
                        <select name="disponibilidade" value={form.disponibilidade} onChange={handleChange} className={inputClass}>
                            <option value="">Selecione...</option>
                            <option value="1 a 3 vezes">1 a 3 vezes por semana</option>
                            <option value="4 a 6 vezes">4 a 6 vezes por semana</option>
                            <option value="Todos os dias">Todos os dias</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className={labelClass}>Restrições Físicas / Lesões</label>
                        <input type="text" name="restricoes" value={form.restricoes} onChange={handleChange} className={inputClass} placeholder="Ex: Dor no joelho direito, Hérnia na lombar..." />
                    </div>
                </div>
            </div>

            {/* SEÇÃO 5: CHECKLIST ADMINISTRATIVO */}
            <div className={sectionClass}>
                <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-2">
                    <CheckSquare className="w-5 h-5 text-emerald-500" />
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Checklist Administrativo</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Object.keys(form.checklist).map(key => (
                        <label key={key} className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${form.checklist[key] ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
                            <input type="checkbox" name={key} checked={form.checklist[key]} onChange={handleCheck} className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer" />
                            <span className={`text-xs font-black uppercase tracking-widest ${form.checklist[key] ? 'text-emerald-700' : 'text-slate-600'}`}>
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                            </span>
                        </label>
                    ))}
                </div>
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black py-4 rounded-2xl shadow-[0_4px_15px_rgba(249,115,22,0.3)] transition-all uppercase text-xs tracking-widest flex items-center justify-center gap-2">
                {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Salvando Avaliação...</> : <><Send className="w-5 h-5" /> Salvar Avaliação Física</>}
            </button>
        </form>
    );
};

export default FormAvaliacao;