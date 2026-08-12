import React, { useState, useEffect } from 'react';
import { X, UserPlus, Edit3, Building, Zap, Loader2, Check } from 'lucide-react';
import { maskCpf, maskPhone, maskContaInter } from './utils.js';

const ModalColaborador = ({ isOpen, onClose, onSave, isSubmitting, dadosEdicao, listaSetores, unidades, temVisaoGlobal }) => {
    const [nome, setNome] = useState('');
    const [cpf, setCpf] = useState('');
    const [telefone, setTelefone] = useState('');
    const [role, setRole] = useState('');
    const [unidade, setUnidade] = useState('');
    const [tipoConta, setTipoConta] = useState('INTER');
    const [contaInter, setContaInter] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (dadosEdicao) {
                setNome(dadosEdicao.nome || '');
                setCpf(dadosEdicao.cpf || '');
                setTelefone(dadosEdicao.telefone || '');
                setRole(dadosEdicao.role || '');
                setUnidade(dadosEdicao.unidade || '');
                setTipoConta(dadosEdicao.tipo_conta || 'INTER');
                setContaInter(dadosEdicao.conta_inter || '');
            } else {
                setNome(''); setCpf(''); setTelefone(''); setRole('');
                setUnidade(''); setTipoConta('INTER'); setContaInter('');
            }
        }
    }, [isOpen, dadosEdicao]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (cpf.length !== 14) return alert("Preencha o CPF corretamente.");
        if (telefone.length < 14) return alert("Preencha o Telefone/WhatsApp corretamente.");
        if (tipoConta === 'INTER' && !contaInter.trim()) return alert("Preencha a conta Inter.");
        
        onSave({
            id: dadosEdicao?.id,
            nome: nome.trim().toUpperCase(),
            cpf,
            telefone,
            role: role.toUpperCase(),
            unidade: unidade.toUpperCase(),
            tipo_conta: tipoConta,
            conta_inter: tipoConta === 'INTER' ? contaInter.trim() : null
        });
    };

    const inputBase = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none uppercase shadow-sm placeholder:normal-case placeholder:font-medium placeholder:text-slate-400";
    const labelBase = "block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1";

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={!isSubmitting ? onClose : undefined}></div>
            
            <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col relative z-10 animate-[slideUp_0.3s_ease-out]">
                {/* Header do Modal */}
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner border ${dadosEdicao ? 'bg-amber-100 text-amber-600 border-amber-200' : 'bg-blue-100 text-blue-600 border-blue-200'}`}>
                            {dadosEdicao ? <Edit3 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-800 tracking-tight">{dadosEdicao ? 'Editar Colaborador' : 'Novo Colaborador'}</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Preencha os dados oficiais</p>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={isSubmitting} className="w-8 h-8 flex items-center justify-center bg-slate-200 text-slate-500 rounded-full hover:bg-rose-100 hover:text-rose-600 transition-colors disabled:opacity-50">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Corpo do Formulário */}
                <div className="overflow-y-auto custom-scrollbar p-6">
                    <form id="form-colab" onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                                <label className={labelBase}>Nome Completo</label>
                                <input type="text" value={nome} onChange={e => setNome(e.target.value)} required placeholder="Ex: Lucas Mendes" className={inputBase} />
                            </div>
                            
                            <div>
                                <label className={labelBase}>CPF</label>
                                <input type="text" value={cpf} onChange={e => setCpf(maskCpf(e.target.value))} required placeholder="000.000.000-00" className={inputBase} />
                            </div>

                            <div>
                                <label className={labelBase}>WhatsApp</label>
                                <input type="text" value={telefone} onChange={e => setTelefone(maskPhone(e.target.value))} required placeholder="(00) 00000-0000" className={inputBase} />
                            </div>

                            <div className={temVisaoGlobal ? "sm:col-span-1" : "sm:col-span-2"}>
                                <label className={labelBase}>Setor / Cargo</label>
                                <select value={role} onChange={e => setRole(e.target.value)} required className={`${inputBase} cursor-pointer`}>
                                    <option value="" disabled className="text-slate-400">Selecione...</option>
                                    {listaSetores.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                                </select>
                            </div>

                            {temVisaoGlobal && (
                                <div className="sm:col-span-1">
                                    <label className="block text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1.5 ml-1">Unidade Vínculo</label>
                                    <select value={unidade} onChange={e => setUnidade(e.target.value)} required className="w-full bg-rose-50/20 border border-rose-200 rounded-xl px-4 py-3 text-sm font-black text-rose-700 focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer uppercase shadow-sm">
                                        <option value="" disabled className="text-rose-300">Selecione...</option>
                                        {unidades.map(u => <option key={u.id} value={u.nome}>{u.nome}</option>)}
                                    </select>
                                </div>
                            )}

                            <div className="sm:col-span-2 border-t border-slate-100 pt-4 mt-2">
                                <label className={labelBase}>Conta de Recebimento (Comissões)</label>
                                <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 mt-2 shadow-inner">
                                    <button type="button" onClick={() => setTipoConta('INTER')} className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${tipoConta === 'INTER' ? 'bg-white shadow-sm text-orange-600 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                                        <Building className="w-3.5 h-3.5" /> Banco Inter
                                    </button>
                                    <button type="button" onClick={() => { setTipoConta('PIX_CPF'); setContaInter(''); }} className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${tipoConta === 'PIX_CPF' ? 'bg-white shadow-sm text-emerald-600 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                                        <Zap className="w-3.5 h-3.5" /> PIX (CPF)
                                    </button>
                                </div>
                                
                                {tipoConta === 'INTER' && (
                                    <div className="mt-4 bg-orange-50 border border-orange-100 p-4 rounded-xl animate-[fadeIn_0.2s_ease-out]">
                                        <label className="block text-[10px] font-black text-orange-700 uppercase tracking-widest mb-1.5 ml-1">Número da Conta com Dígito *</label>
                                        <input type="text" value={contaInter} onChange={e => setContaInter(maskContaInter(e.target.value))} required placeholder="Ex: 1234567-8" className="w-full bg-white border border-orange-200 rounded-lg px-4 py-3 text-sm font-bold text-orange-900 focus:ring-2 focus:ring-orange-500 outline-none shadow-sm placeholder:text-orange-300" />
                                    </div>
                                )}

                                {tipoConta === 'PIX_CPF' && (
                                    <div className="mt-4 bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-start gap-3 animate-[fadeIn_0.2s_ease-out]">
                                        <Zap className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[10px] font-black text-emerald-800 uppercase tracking-wide">Chave PIX Travada</p>
                                            <p className="text-xs font-semibold text-emerald-600 mt-1">A chave será estritamente o CPF: <strong className="font-mono text-emerald-900">{cpf || 'Preencha o CPF acima'}</strong></p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer / Ações */}
                <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3 justify-end">
                    <button type="button" onClick={onClose} disabled={isSubmitting} className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-200 transition-colors disabled:opacity-50">
                        Cancelar
                    </button>
                    <button type="submit" form="form-colab" disabled={isSubmitting} className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-white shadow-md transition-all flex items-center gap-2 disabled:opacity-50 ${dadosEdicao ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {dadosEdicao ? 'Atualizar Dados' : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModalColaborador;