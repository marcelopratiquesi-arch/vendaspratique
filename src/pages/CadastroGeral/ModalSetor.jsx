import React, { useState, useEffect } from 'react';
import { X, LayoutGrid, Loader2, Check } from 'lucide-react';

const ModalSetor = ({ isOpen, onClose, onSave, isSubmitting, dadosEdicao }) => {
    const [nome, setNome] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (dadosEdicao) {
                setNome(dadosEdicao.nome || '');
            } else {
                setNome('');
            }
        }
    }, [isOpen, dadosEdicao]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!nome.trim()) return alert("O nome do setor é obrigatório.");
        
        onSave({
            id: dadosEdicao?.id,
            nome: nome.trim().toUpperCase()
        });
    };

    const inputBase = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none uppercase shadow-sm placeholder:normal-case placeholder:font-medium placeholder:text-slate-400";
    const labelBase = "block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1";

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={!isSubmitting ? onClose : undefined}></div>
            
            <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col relative z-10 animate-[slideUp_0.3s_ease-out]">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner border ${dadosEdicao ? 'bg-amber-100 text-amber-600 border-amber-200' : 'bg-blue-100 text-blue-600 border-blue-200'}`}>
                            <LayoutGrid className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-800 tracking-tight">{dadosEdicao ? 'Editar Setor' : 'Novo Setor'}</h2>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={isSubmitting} className="w-8 h-8 flex items-center justify-center bg-slate-200 text-slate-500 rounded-full hover:bg-rose-100 hover:text-rose-600 transition-colors disabled:opacity-50">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <form id="form-setor" onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className={labelBase}>Nome do Setor / Cargo</label>
                            <input type="text" value={nome} onChange={e => setNome(e.target.value)} required placeholder="Ex: RECEPÇÃO" className={inputBase} />
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3 justify-end">
                    <button type="button" onClick={onClose} disabled={isSubmitting} className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-200 transition-colors disabled:opacity-50">
                        Cancelar
                    </button>
                    <button type="submit" form="form-setor" disabled={isSubmitting} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white shadow-md transition-all flex items-center gap-2 disabled:opacity-50 ${dadosEdicao ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {dadosEdicao ? 'Atualizar' : 'Salvar Setor'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModalSetor;