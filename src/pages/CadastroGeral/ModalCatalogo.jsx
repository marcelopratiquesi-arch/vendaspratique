import React, { useState, useEffect } from 'react';
import { X, Bookmark, Package, Briefcase, Loader2, Check, Layers } from 'lucide-react';
import { avisar } from '../../components/avisar.js';
import { lerNumeroBR } from '../AnaliseVendas/movimentoDiario.js';
import { grupoDoItem } from './grupoCatalogo.js';
import { tx } from '../../i18n/traduzir.js';

// Valor guardado (número) → campo com vírgula ("5,00")
const valorEmTexto = (v) => (v === null || v === undefined || v === '' ? '' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const emReais = (v) => `R$ ${valorEmTexto(v)}`;

const ModalCatalogo = ({ isOpen, onClose, onSave, isSubmitting, dadosEdicao }) => {
    const [tipo, setTipo] = useState('plano');
    const [nome, setNome] = useState('');
    const [valor, setValor] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (dadosEdicao) {
                setTipo(dadosEdicao.tipo || 'plano');
                setNome(dadosEdicao.nome || '');
                setValor(valorEmTexto(dadosEdicao.valor));
            } else {
                setTipo('plano');
                setNome('');
                setValor('');
            }
        }
    }, [isOpen, dadosEdicao]);

    // Esc fecha a janela (revisão de 10/11/2026)
    useEffect(() => {
        if (!isOpen) return undefined;
        const aoTeclar = (e) => { if (e.key === 'Escape' && !isSubmitting) onClose(); };
        window.addEventListener('keydown', aoTeclar);
        return () => window.removeEventListener('keydown', aoTeclar);
    }, [isOpen, isSubmitting, onClose]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        
        const valorNumerico = lerNumeroBR(valor);
        if (valorNumerico === null || Number.isNaN(valorNumerico) || valorNumerico < 0) {
            return avisar(tx("Por favor, insira um valor válido."));
        }
        // Mudou a comissão de um item que já existe: vale só para as vendas lançadas daqui para frente (regra 12)
        if (dadosEdicao && Number(dadosEdicao.valor) !== valorNumerico
            && !window.confirm(tx('Comissão de "{nome}": {de} → {para}.\n\nVale só para as vendas lançadas a partir de agora. As vendas já lançadas continuam com o valor antigo.\n\nConfirmar?', { nome: dadosEdicao.nome, de: emReais(dadosEdicao.valor), para: emReais(valorNumerico) }))) {
            return;
        }

        onSave({
            id: dadosEdicao?.id,
            tipo,
            nome: nome.trim().toUpperCase(),
            valor: valorNumerico
        });
    };

    const inputBase = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none uppercase shadow-sm placeholder:normal-case placeholder:font-medium placeholder:text-slate-400 dark:bg-slate-800/60 dark:border-slate-800 dark:text-slate-200";
    const labelBase = "block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 dark:text-slate-400";

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={!isSubmitting ? onClose : undefined}></div>
            
            <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col relative z-10 animate-[slideUp_0.3s_ease-out] dark:bg-slate-900">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center dark:border-slate-800 dark:bg-slate-800/60">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner border ${dadosEdicao ? 'bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30' : 'bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30'}`}>
                            <Layers className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-800 tracking-tight dark:text-white">{dadosEdicao ? tx("Editar Item") : tx("Novo Item no Catálogo")}</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{tx("Comissão e Regras")}</p>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={isSubmitting} className="w-8 h-8 flex items-center justify-center bg-slate-200 text-slate-500 rounded-full hover:bg-rose-100 hover:text-rose-600 transition-colors disabled:opacity-50 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-rose-500/20 dark:hover:text-rose-400">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <form id="form-catalogo" onSubmit={handleSubmit} className="space-y-6">
                        
                        {/* Segmented Control de UX Avançada */}
                        <div>
                            <label className={labelBase}>{tx("Categoria do Item")}</label>
                            <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-inner dark:bg-slate-800 dark:border-slate-800">
                                <button type="button" disabled={!!dadosEdicao} onClick={() => setTipo('plano')} className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed ${tipo === 'plano' ? 'bg-white shadow-sm text-blue-600 border border-slate-200 dark:bg-slate-900 dark:text-blue-400 dark:border-slate-800' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}>
                                    <Bookmark className="w-3.5 h-3.5" />{' '}{tx("Plano")}
                                </button>
                                <button type="button" disabled={!!dadosEdicao} onClick={() => setTipo('produto')} className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed ${tipo === 'produto' ? 'bg-white shadow-sm text-emerald-600 border border-slate-200 dark:bg-slate-900 dark:text-emerald-400 dark:border-slate-800' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}>
                                    <Package className="w-3.5 h-3.5" />{' '}{tx("Produto")}
                                </button>
                                <button type="button" disabled={!!dadosEdicao} onClick={() => setTipo('servico')} className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed ${tipo === 'servico' ? 'bg-white shadow-sm text-violet-600 border border-slate-200 dark:bg-slate-900 dark:text-violet-400 dark:border-slate-800' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}>
                                    <Briefcase className="w-3.5 h-3.5" />{' '}{tx("Serviço")}
                                </button>
                            </div>
                            {dadosEdicao && <p className="text-[10px] font-bold text-amber-500 mt-1.5 ml-1">{tx("Não é possível alterar a categoria de um item já salvo.")}</p>}
                        </div>

                        <div>
                            <label className={labelBase}>{tx("Nome Oficial (Aparecerá nas Vendas)")}</label>
                            <input type="text" autoFocus={!dadosEdicao} value={nome} onChange={e => setNome(e.target.value)} required placeholder={tx("Ex: {v1}", { v1: tipo === 'plano' ? 'PLANO VIP' : tipo === 'produto' ? 'WHEY PROTEIN' : 'TAXA DE ADESÃO' })} className={inputBase} />
                        </div>

                        {nome.trim() && (
                            <p className="-mt-3 ml-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                {tx('Vai contar como:')}{' '}<span className="text-blue-700 dark:text-blue-400">{tx(grupoDoItem({ tipo, nome: nome.trim().toUpperCase() }).texto)}</span>
                            </p>
                        )}

                        <div>
                            <label className={labelBase}>{tx("Valor da Comissão (R$)")}</label>
                            <input type="text" inputMode="decimal" autoFocus={!!dadosEdicao} value={valor} onChange={e => setValor(e.target.value.replace(/[^\d.,]/g, ''))} required placeholder={tx("Ex: 5,00")} className={inputBase} />
                            <p className="text-[10px] font-semibold text-slate-400 mt-1.5 ml-1">{tx('É a comissão paga ao vendedor, não o preço do plano.')}</p>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3 justify-end dark:border-slate-800 dark:bg-slate-800/60">
                    <button type="button" onClick={onClose} disabled={isSubmitting} className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-200 transition-colors disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-700">
                        {tx("Cancelar")}
                    </button>
                    <button type="submit" form="form-catalogo" disabled={isSubmitting} className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-white shadow-md transition-all flex items-center gap-2 disabled:opacity-50 ${dadosEdicao ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {dadosEdicao ? tx("Atualizar") : tx("Salvar Item")}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModalCatalogo;