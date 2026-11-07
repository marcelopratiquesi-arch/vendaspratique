import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient.js';
import { Building2, IdCard, Calendar, User, Phone, Mail, MessageCircle, Clock, Edit2 } from 'lucide-react';
import { formatarTelefone, formatarDataBR, limparApenasDigitos } from '../utils.js';
import CopyButton from './CopyButton.jsx';
import { tx, localeAtual } from '../../../i18n/traduzir.js';

const TabDados = ({ aluno, onEditar, temVisaoGlobal }) => {
    const [cpfReal, setCpfReal] = useState(aluno.cpf || '');
    const [telefoneReal, setTelefoneReal] = useState(aluno.telefone || '');
    const [emailReal, setEmailReal] = useState(aluno.email || '');

    useEffect(() => {
        const buscarDadosReais = async () => {
            if (aluno.id && (String(aluno.cpf).includes('*') || !aluno.cpf)) {
                try {
                    const { data } = await supabase
                        .from('alunos')
                        .select('cpf, telefone, email')
                        .eq('id', aluno.id)
                        .single();
                    if (data) {
                        if (data.cpf) setCpfReal(data.cpf);
                        if (data.telefone) setTelefoneReal(data.telefone);
                        if (data.email) setEmailReal(data.email);
                    }
                } catch (err) {}
            } else {
                setCpfReal(aluno.cpf);
                setTelefoneReal(aluno.telefone);
                setEmailReal(aluno.email);
            }
        };
        buscarDadosReais();
    }, [aluno]);

    // Dados da importação (Cadastro → Alunos → Smart Paste, 06/11/2026): status, desde quando, data de cadastro e sexo.
    // Sem os campos no banco (sql/2026-11-06-alunos-importacao), o bloco não aparece.
    const [importado, setImportado] = useState(null);
    useEffect(() => {
        let ativo = true;
        setImportado(null);
        if (!aluno?.id) return undefined;
        supabase.from('alunos').select('status_aluno, status_atualizado_em, data_cadastro, sexo').eq('id', aluno.id).maybeSingle()
            .then(({ data, error }) => { if (ativo && !error && data) setImportado(data); });
        return () => { ativo = false; };
    }, [aluno?.id]);
    const statusAluno = String(importado?.status_aluno || '').toUpperCase();
    const statusAtivo = ['ATIVO', 'CLIENTE'].includes(statusAluno);

    const calcularIdade = (data) => {
        if (!data) return '—';
        const hoje = new Date();
        const nasc = new Date(data + 'T12:00:00');
        let idade = hoje.getFullYear() - nasc.getFullYear();
        const m = hoje.getMonth() - nasc.getMonth();
        if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
        return idade;
    };

    const telefoneLimpo = limparApenasDigitos(telefoneReal);
    const linkWhatsApp = telefoneLimpo ? `https://wa.me/55${telefoneLimpo}` : null;
    
    const cpfLimpo = limparApenasDigitos(cpfReal);
    const cpfCompletoExibicao = cpfLimpo.length === 11 
        ? cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") 
        : (cpfReal || 'S/ CPF');

    const rowClass = "flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3";
    const rowBorder = "border-b border-slate-200/50 dark:border-slate-700/50";
    const labelContainer = "flex items-center gap-2.5 text-slate-500 dark:text-slate-400 shrink-0";
    const labelText = "text-[11px] font-bold uppercase tracking-wider";
    const valueContainer = "flex items-center gap-3 self-end sm:self-auto min-w-0";
    const valueText = "text-[13px] font-bold text-slate-800 dark:text-slate-100";
    const nestedContainer = "bg-[#F8FAFC] dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl flex flex-col";
    const pillButton = "flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors shadow-sm dark:text-slate-400 dark:hover:text-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-800/60";

    return (
        <div className="space-y-5 animate-[fadeIn_0.2s_ease-out]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                
                <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 flex items-center gap-2 dark:text-white">
                            <User className="w-4 h-4 text-slate-400" />{' '}{tx("Pessoal")}
                        </h3>
                        <button type="button" className={pillButton} title={tx("Funcionalidade em breve")}>
                            <Clock className="w-3 h-3" />{' '}{tx("Histórico")}
                        </button>
                    </div>
                    
                    <div className={nestedContainer}>
                        <div className={`${rowClass} ${rowBorder}`}>
                            <div className={labelContainer}>
                                <IdCard className="w-3.5 h-3.5" /> <span className={labelText}>CPF</span>
                            </div>
                            <div className={valueContainer}>
                                <span className={valueText}>{cpfCompletoExibicao}</span>
                                {cpfLimpo && <CopyButton value={cpfLimpo} label={tx("Copiar CPF")} className="!w-7 !h-7 !min-w-[28px] !bg-white !rounded-md shadow-sm" />}
                            </div>
                        </div>

                        <div className={`${rowClass} ${rowBorder}`}>
                            <div className={labelContainer}>
                                <Calendar className="w-3.5 h-3.5" /> <span className={labelText}>{tx("Nascimento")}</span>
                            </div>
                            <div className={valueContainer}>
                                <div className="text-right flex flex-col items-end">
                                    <span className={valueText}>{formatarDataBR(aluno.data_nascimento)}</span>
                                    <span className="text-[10px] font-medium text-slate-400 mt-0.5">{calcularIdade(aluno.data_nascimento)}{' '}{tx("anos")}</span>
                                </div>
                                <div className="w-7 h-7 shrink-0"></div>
                            </div>
                        </div>

                        <div className={rowClass}>
                            <div className={labelContainer}>
                                <User className="w-3.5 h-3.5" /> <span className={labelText}>{tx("Gênero")}</span>
                            </div>
                            <div className={valueContainer}>
                                <span className={`${valueText} uppercase`}>{aluno.genero || aluno.sexo || importado?.sexo || 'N/I'}</span>
                                <div className="w-7 h-7 shrink-0"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 flex items-center gap-2 dark:text-white">
                            <Phone className="w-4 h-4 text-slate-400" />{' '}{tx("Contatos")}
                        </h3>
                        {onEditar && <button onClick={onEditar} type="button" className={pillButton}>
                            <Edit2 className="w-3 h-3" />{' '}{tx("Editar")}
                        </button>}
                    </div>
                    
                    <div className={nestedContainer}>
                        <div className={`${rowClass} ${rowBorder}`}>
                            <div className={labelContainer}>
                                <Phone className="w-3.5 h-3.5" /> <span className={labelText}>{tx("Telemóvel")}</span>
                            </div>
                            <div className={valueContainer}>
                                <span className={valueText}>{formatarTelefone(telefoneReal)}</span>
                                {linkWhatsApp ? (
                                    <a href={linkWhatsApp} target="_blank" rel="noopener noreferrer" title={tx("Abrir no WhatsApp")} className="flex items-center justify-center shrink-0 w-7 h-7 bg-emerald-500 hover:bg-emerald-600 rounded-md text-white shadow-sm transition-colors">
                                        <MessageCircle className="w-3.5 h-3.5" />
                                    </a>
                                ) : (
                                    <CopyButton value={telefoneLimpo} label={tx("Copiar Telefone")} className="!w-7 !h-7 !min-w-[28px] !bg-white !rounded-md shadow-sm" />
                                )}
                            </div>
                        </div>

                        <div className={rowClass}>
                            <div className={labelContainer}>
                                <Mail className="w-3.5 h-3.5" /> <span className={labelText}>{tx("E-mail")}</span>
                            </div>
                            <div className={valueContainer}>
                                <span className={`${valueText} lowercase truncate`}>{emailReal || '—'}</span>
                                {emailReal ? (
                                    <CopyButton value={emailReal} label={tx("Copiar E-mail")} className="!w-7 !h-7 !min-w-[28px] !bg-white !rounded-md shadow-sm" />
                                ) : (
                                    <div className="w-7 h-7 shrink-0"></div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {importado && (importado.status_aluno || importado.data_cadastro) && (
                <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl px-5 py-4 shadow-sm flex flex-wrap items-center gap-x-8 gap-y-3">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 flex items-center gap-2 dark:text-white">
                        <IdCard className="w-4 h-4 text-slate-400" />{' '}{tx("Situação na academia")}
                    </h3>
                    <div className="flex flex-col">
                        <span className={labelText + ' text-slate-500 dark:text-slate-400'}>{tx("Status")}</span>
                        <span className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-md border text-[11px] font-black uppercase tracking-widest ${statusAluno ? (statusAtivo ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30' : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30') : 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800/60 dark:border-slate-700'}`}>
                                {statusAluno || '—'}
                            </span>
                            {importado.status_atualizado_em && (
                                <span className="text-[10px] font-bold text-slate-400">
                                    {tx("desde {data}", { data: new Date(importado.status_atualizado_em).toLocaleDateString(localeAtual()) })}
                                </span>
                            )}
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className={labelText + ' text-slate-500 dark:text-slate-400'}>{tx("Data de cadastro")}</span>
                        <span className={valueText}>{importado.data_cadastro ? formatarDataBR(importado.data_cadastro) : '—'}</span>
                    </div>
                </div>
            )}

            {temVisaoGlobal && (
                <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 dark:bg-blue-500/10 dark:text-blue-400">
                            <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                            <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-800 dark:text-white">{tx("Vínculo de Unidade")}</h4>
                            <p className="text-[11px] font-medium text-slate-500 mt-0.5 dark:text-slate-400">{tx("Unidade onde o aluno está matriculado e ativo.")}</p>
                        </div>
                    </div>
                    <div className="bg-[#F8FAFC] border border-slate-200/80 px-4 py-2 rounded-lg shadow-sm shrink-0 text-center dark:border-slate-800">
                        <span className="text-xs font-bold text-blue-600 uppercase tracking-widest dark:text-blue-400">
                            {aluno.unidade || tx("SEM VÍNCULO")}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TabDados;