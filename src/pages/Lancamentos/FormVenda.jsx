import React, { useState } from 'react';
import { supabase } from '../../supabaseClient.js';
import { safeNumber, formatMoney, getLocalDateISO } from './utils.js';
import { User, Package, BookOpen, Box, Briefcase, LayoutGrid, Trash2, Plus, MessageSquare, Receipt, Loader2, Check, CheckCircle2 } from 'lucide-react';

const FormVenda = ({ usuarioLogado, unidades, onAddMultiple, planos, produtos, servicos, colaboradores, voltarHub }) => {
    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';

    const [formData, setFormData] = useState({ 
        unidade: temVisaoGlobal ? '' : (usuarioLogado?.unidade || ''), 
        data: getLocalDateISO(), 
        matricula: '', 
        nome: '', 
        vendedor: '', 
        observacao: '' 
    });

    const getInitialItem = () => ({ 
        id: Date.now(), tipo: '', nomeItem: '', quantidade: 1, valor: 'R$ 0,00', valorUnitario: 0, valorCalculado: 0 
    });
    
    const [itensForm, setItensForm] = useState([getInitialItem()]);
    const [sucesso, setSucesso] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const vendedoresDaUnidade = colaboradores.filter(c => 
        temVisaoGlobal 
            ? c.unidade?.toUpperCase() === formData.unidade?.toUpperCase()
            : c.unidade?.toUpperCase() === usuarioLogado?.unidade?.toUpperCase()
    );

    const handleMainChange = (e) => {
        const { name, value } = e.target;
        if (name === 'unidade') setFormData({ ...formData, unidade: value, vendedor: '' });
        else setFormData({ ...formData, [name]: value });
    };

    const handleItemChange = (id, field, value) => {
        setItensForm(itensForm.map(item => {
            if (item.id === id) {
                const updatedItem = { ...item, [field]: value };
                
                if (field === 'tipo') {
                    updatedItem.nomeItem = ''; updatedItem.valorUnitario = 0; updatedItem.quantidade = 1;
                    updatedItem.valorCalculado = 0; updatedItem.valor = 'R$ 0,00';
                } 
                else if (field === 'nomeItem') {
                    const listaRef = updatedItem.tipo === 'plano' ? planos : (updatedItem.tipo === 'produto' ? produtos : servicos);
                    const selecionado = listaRef.find(x => x.nome === value) || { valor: 0 };
                    const precoNumericoLimpo = safeNumber(selecionado.valor); 
                    
                    updatedItem.quantidade = 1; updatedItem.valorUnitario = precoNumericoLimpo;
                    updatedItem.valorCalculado = precoNumericoLimpo; updatedItem.valor = formatMoney(updatedItem.valorCalculado);
                } 
                else if (field === 'quantidade') {
                    const qtd = parseInt(value) || 1;
                    updatedItem.quantidade = qtd; updatedItem.valorCalculado = updatedItem.valorUnitario * qtd;
                    updatedItem.valor = formatMoney(updatedItem.valorCalculado);
                }
                return updatedItem;
            }
            return item;
        }));
    };

    const handleRemoveItem = (id) => itensForm.length > 1 && setItensForm(itensForm.filter(item => item.id !== id));
    const handleAddItem = () => setItensForm([...itensForm, getInitialItem()]);
    const totalVenda = itensForm.reduce((acc, curr) => acc + safeNumber(curr.valorCalculado), 0);

    const handleSubmitVenda = async (e) => {
        e.preventDefault();
        
        if (temVisaoGlobal && !formData.unidade) return alert('Atenção: Selecione a Unidade da venda.');
        
        const itensValidos = itensForm.filter(item => item.nomeItem !== '' && item.tipo !== '');
        if (itensValidos.length === 0) return alert('Adicione pelo menos um item válido.');

        setIsSubmitting(true);

        try {
            const novosLancamentos = itensValidos.map(item => {
                const valorPuro = safeNumber(item.valorCalculado); 
                return {
                    unidade: formData.unidade.toUpperCase(), 
                    data: formData.data, 
                    matricula: formData.matricula, 
                    nome_aluno: formData.nome.toUpperCase(),
                    produto: item.nomeItem, 
                    vendedor: formData.vendedor.toUpperCase(), 
                    valor: valorPuro, 
                    observacao: formData.observacao, 
                    conferiu: false, 
                    quantidade: parseInt(item.quantidade) || 1, 
                    comissao: valorPuro,
                    criado_por: usuarioLogado?.nome || 'SISTEMA' 
                };
            });

            const { data, error } = await supabase.from('vendas').insert(novosLancamentos).select();
            if (error) throw error;

            if (data) {
                if(onAddMultiple) onAddMultiple(data.reverse()); 
                setSucesso(true);
                setTimeout(() => {
                    setSucesso(false);
                    voltarHub();
                }, 1200); // <-- Tempo reduzido para 1.2s para ficar muito mais rápido!
            }
        } catch (error) {
            console.error("Erro:", error); alert("Erro ao salvar venda.");
        } finally { setIsSubmitting(false); }
    };

    const labelClass = "block text-sm font-semibold text-slate-700 mb-1.5";
    const inputClass = "w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all duration-200";

    return (
        <form onSubmit={handleSubmitVenda} className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
            
            {/* === NOVO POP-UP CENTRAL === */}
            {sucesso && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center animate-[zoomIn_0.2s_ease-out] max-w-sm w-full mx-4 border border-slate-200">
                        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-inner border border-emerald-200">
                            <CheckCircle2 className="w-10 h-10" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Venda Confirmada!</h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lançamento salvo no Caixa.</p>
                    </div>
                </div>
            )}
            
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-6">
                    <User className="w-5 h-5 text-slate-400" /> Informações do Cliente
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className={labelClass}>Data da Venda *</label>
                        <input type="date" name="data" value={formData.data} onChange={handleMainChange} required className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>Nº Matrícula *</label>
                        <input type="text" name="matricula" value={formData.matricula} onChange={handleMainChange} required placeholder="Ex: 00456" className={inputClass} />
                    </div>
                    <div className="md:col-span-2">
                        <label className={labelClass}>Nome Completo do Aluno *</label>
                        <input type="text" name="nome" value={formData.nome} onChange={handleMainChange} required placeholder="Ex: João da Silva" className={inputClass} />
                    </div>

                    {temVisaoGlobal && (
                        <div>
                            <label className={labelClass}>Unidade da Venda *</label>
                            <select name="unidade" value={formData.unidade} onChange={handleMainChange} required className={inputClass}>
                                <option value="">Selecione a Unidade...</option>
                                {unidades.map(u => <option key={u.id || u.nome} value={u.nome}>{u.nome}</option>)}
                            </select>
                        </div>
                    )}

                    <div className={temVisaoGlobal ? "" : "md:col-span-2"}>
                        <label className={labelClass}>Consultor Responsável *</label>
                        <select name="vendedor" value={formData.vendedor} onChange={handleMainChange} required disabled={temVisaoGlobal && !formData.unidade} className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`}>
                            <option value="">{(temVisaoGlobal && !formData.unidade) ? 'Escolha a unidade antes...' : 'Selecione o vendedor...'}</option>
                            {vendedoresDaUnidade.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <Package className="w-5 h-5 text-slate-400" /> Itens da Venda
                    </h3>
                </div>
                
                <div className="space-y-4">
                    {itensForm.map((item, index) => (
                        <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-slate-50/50 p-5 rounded-xl border border-slate-100">
                            
                            <div className="md:col-span-3">
                                <label className="text-xs font-semibold text-slate-600 mb-1.5 block text-left">Categoria *</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        {item.tipo === 'plano' && <BookOpen className="w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />}
                                        {item.tipo === 'produto' && <Box className="w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />}
                                        {item.tipo === 'servico' && <Briefcase className="w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />}
                                        {item.tipo === '' && <LayoutGrid className="w-4 h-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />}
                                    </div>
                                    <select value={item.tipo} onChange={(e) => handleItemChange(item.id, 'tipo', e.target.value)} required className={`w-full bg-white border border-slate-300 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all duration-200 ${item.tipo === '' ? 'text-slate-500' : 'text-slate-900'}`}>
                                        <option value="" disabled hidden>Selecione...</option>
                                        <option value="plano">Plano / Assinatura</option>
                                        <option value="produto">Produto</option>
                                        <option value="servico">Serviço</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div className="md:col-span-4">
                                <label className="text-xs font-semibold text-slate-600 mb-1.5 block text-left">Item do Catálogo *</label>
                                <select value={item.nomeItem} onChange={(e) => handleItemChange(item.id, 'nomeItem', e.target.value)} required disabled={!item.tipo} className={`w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all duration-200 disabled:cursor-not-allowed ${!item.tipo ? 'bg-slate-50 text-slate-400' : item.nomeItem === '' ? 'text-slate-500' : 'text-slate-900'}`}>
                                    <option value="" disabled hidden>{!item.tipo ? 'Aguarde categoria' : 'Selecione...'}</option>
                                    {item.tipo === 'plano' && planos.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                                    {item.tipo === 'produto' && produtos.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                                    {item.tipo === 'servico' && servicos.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                                </select>
                            </div>
                            
                            <div className="md:col-span-2">
                                <label className="text-xs font-semibold text-slate-600 mb-1.5 block text-left">Quantidade</label>
                                <input type="number" min="1" disabled={!item.nomeItem} value={item.quantidade} onChange={(e) => handleItemChange(item.id, 'quantidade', e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all duration-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed" />
                            </div>
                            
                            <div className="md:col-span-2">
                                <label className="text-xs font-semibold text-slate-600 mb-1.5 block text-right">Subtotal</label>
                                <input type="text" value={item.valor} readOnly className="w-full bg-transparent border-none text-base font-bold text-slate-900 text-right pr-2 cursor-default py-2 focus:outline-none" />
                            </div>

                            <div className="md:col-span-1 flex justify-center pb-2">
                                {itensForm.length > 1 && (
                                    <button type="button" onClick={() => handleRemoveItem(item.id)} className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500 rounded-lg transition-colors" title="Remover Item">
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                )}
                            </div>

                        </div>
                    ))}

                    <button type="button" onClick={handleAddItem} className="w-full bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 text-slate-600 font-semibold text-sm py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 mt-4">
                        <Plus className="w-4 h-4" /> Adicionar outro item
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                <div className="lg:col-span-2 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
                        <MessageSquare className="w-4 h-4 text-slate-400" /> Observação de Caixa (Opcional)
                    </label>
                    <textarea name="observacao" value={formData.observacao} onChange={handleMainChange} rows="5" placeholder="Ex: Pagamento no PIX, Isento de taxa..." className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none transition-all duration-200"></textarea>
                </div>
                
                <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 flex flex-col justify-between lg:sticky lg:top-28">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-6">
                            <Receipt className="w-4 h-4 text-slate-400" /> Resumo Financeiro
                        </h3>
                        <span className="text-slate-500 text-sm block mb-1">Total a Receber</span>
                        <span className="text-4xl font-extrabold text-slate-900 tracking-tight">{formatMoney(totalVenda)}</span>
                    </div>
                    
                    <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 font-bold py-4 rounded-xl shadow-sm transition-all duration-200 flex justify-center items-center gap-2 mt-8 active:scale-[0.98]">
                        {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Salvando...</> : <><Check className="w-5 h-5" /> Confirmar Venda</>}
                    </button>
                </div>

            </div>
        </form>
    );
};

export default FormVenda;