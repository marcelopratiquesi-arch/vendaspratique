import React, { useState, useEffect } from 'react';
import { X, Bookmark, Package, Briefcase, Loader2, Check, Layers } from 'lucide-react';

const ModalCatalogo = ({ isOpen, onClose, onSave, isSubmitting, dadosEdicao }) => {
    const [tipo, setTipo] = useState('plano');
    const [nome, setNome] = useState('');
    const [valor, setValor] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (dadosEdicao) {
                setTipo(dadosEdicao.tipo || 'plano');
                setNome(dadosEdicao.nome || '');
                setValor(dadosEdicao.valor || '');
            } else {
                setTipo('plano');
                setNome('');
                setValor('');
            }
        }
    }, [isOpen, dadosEdicao]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        
        const valorNumerico = parseFloat(valor);
        if (isNaN(valorNumerico) || valorNumerico < 0) {
            return alert("Por favor, insira um valor válido.");
        }

        onSave({
            id: dadosEdicao?.id,
            tipo,
            nome: nome.trim().toUpperCase(),
            valor: valorNumerico
        });
    };

    const inputBase = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none uppercase shadow-sm placeholder:normal-case placeholder:font-medium placeholder:text-slate-400";
    const labelBase = "block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1";

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={!isSubmitting ? onClose : undefined}></div>
            
            <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col relative z-10 animate-[slideUp_0.3s_ease-out]">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner border ${dadosEdicao ? 'bg-amber-100 text-amber-600 border-amber-200' : 'bg-blue-100 text-blue-600 border-blue-200'}`}>
                            <Layers className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-800 tracking-tight">{dadosEdicao ? 'Editar Item' : 'Novo Item no Catálogo'}</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Precificação e Regras</p>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={isSubmitting} className="w-8 h-8 flex items-center justify-center bg-slate-200 text-slate-500 rounded-full hover:bg-rose-100 hover:text-rose-600 transition-colors disabled:opacity-50">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <form id="form-catalogo" onSubmit={handleSubmit} className="space-y-6">
                        
                        {/* Segmented Control de UX Avançada */}
                        <div>
                            <label className={labelBase}>Categoria do Item</label>
                            <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-inner">
                                <button type="button" disabled={!!dadosEdicao} onClick={() => setTipo('plano')} className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed ${tipo === 'plano' ? 'bg-white shadow-sm text-blue-600 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                                    <Bookmark className="w-3.5 h-3.5" /> Plano
                                </button>
                                <button type="button" disabled={!!dadosEdicao} onClick={() => setTipo('produto')} className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed ${tipo === 'produto' ? 'bg-white shadow-sm text-emerald-600 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                                    <Package className="w-3.5 h-3.5" /> Produto
                                </button>
                                <button type="button" disabled={!!dadosEdicao} onClick={() => setTipo('servico')} className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed ${tipo === 'servico' ? 'bg-white shadow-sm text-violet-600 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                                    <Briefcase className="w-3.5 h-3.5" /> Serviço
                                </button>
                            </div>
                            {dadosEdicao && <p className="text-[9px] font-bold text-amber-500 mt-1.5 ml-1">Não é possível alterar a categoria de um item já salvo.</p>}
                        </div>

                        <div>
                            <label className={labelBase}>Nome Oficial (Aparecerá nas Vendas)</label>
                            <input type="text" value={nome} onChange={e => setNome(e.target.value)} required placeholder={`Ex: ${tipo === 'plano' ? 'PLANO VIP' : tipo === 'produto' ? 'WHEY PROTEIN' : 'TAXA DE ADESÃO'}`} className={inputBase} />
                        </div>

                        <div>
                            <label className={labelBase}>Valor de Tabela (R$)</label>
                            <input type="number" step="0.01" min="0" value={valor} onChange={e => setValor(e.target.value)} required placeholder="Ex: 99.90" className={inputBase} />
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3 justify-end">
                    <button type="button" onClick={onClose} disabled={isSubmitting} className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-200 transition-colors disabled:opacity-50">
                        Cancelar
                    </button>
                    <button type="submit" form="form-catalogo" disabled={isSubmitting} className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-white shadow-md transition-all flex items-center gap-2 disabled:opacity-50 ${dadosEdicao ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {dadosEdicao ? 'Atualizar' : 'Salvar Item'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModalCatalogo;