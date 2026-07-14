import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js';

const LancamentoVendas = ({ usuarioLogado, unidades = [], onAddMultiple, planos = [], produtos = [], colaboradores = [] }) => {
    // Utilitários de conversão visual e numérica (BLINDAGEM)
    const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);
    
    // Essa função arranca o "R$", os pontos e converte a vírgula para ponto matemático
    const parseCurrency = (str) => {
        if (typeof str === 'number') return str;
        if (!str) return 0;
        return parseFloat(String(str).replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
    };
    
    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';

    const [formData, setFormData] = useState({ 
        unidade: temVisaoGlobal ? '' : (usuarioLogado?.unidade || ''), 
        data: new Date().toISOString().split('T')[0], 
        matricula: '', 
        nome: '', 
        vendedor: '', 
        observacao: '' 
    });

    const getInitialItem = () => ({ 
        id: Date.now(), 
        tipo: '', 
        nomeItem: '', 
        quantidade: 1, 
        valor: 'R$ 0,00', // Apenas Visual
        valorUnitario: 0,
        valorCalculado: 0 // Numérico Puro
    });
    
    const [itensForm, setItensForm] = useState([getInitialItem()]);
    const [sucesso, setSucesso] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [itensForm.length, sucesso, isSubmitting, formData.unidade]);

    const handleMainChange = (e) => {
        const { name, value } = e.target;
        if (name === 'unidade') {
            setFormData({ ...formData, unidade: value, vendedor: '' });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleItemChange = (id, field, value) => {
        setItensForm(itensForm.map(item => {
            if (item.id === id) {
                const updatedItem = { ...item, [field]: value };
                
                if (field === 'tipo') {
                    updatedItem.nomeItem = '';
                    updatedItem.valorUnitario = 0;
                    updatedItem.quantidade = 1;
                    updatedItem.valorCalculado = 0;
                    updatedItem.valor = 'R$ 0,00';
                } 
                else if (field === 'nomeItem') {
                    const listaRef = updatedItem.tipo === 'plano' ? planos : produtos;
                    const selecionado = listaRef.find(x => x.nome === value) || { valor: 0 };
                    
                    // BLINDAGEM: Garante que o valor do catálogo vire número puro
                    const precoLimpo = parseCurrency(selecionado.valor);
                    
                    updatedItem.valorUnitario = precoLimpo;
                    updatedItem.valorCalculado = precoLimpo * updatedItem.quantidade;
                    updatedItem.valor = formatMoney(updatedItem.valorCalculado);
                } 
                else if (field === 'quantidade') {
                    const qtd = parseInt(value) || 1;
                    updatedItem.quantidade = qtd;
                    updatedItem.valorCalculado = updatedItem.valorUnitario * qtd;
                    updatedItem.valor = formatMoney(updatedItem.valorCalculado);
                }
                return updatedItem;
            }
            return item;
        }));
    };

    const handleRemoveItem = (id) => itensForm.length > 1 && setItensForm(itensForm.filter(item => item.id !== id));
    const handleAddItem = () => setItensForm([...itensForm, getInitialItem()]);

    const totalVenda = itensForm.reduce((acc, curr) => acc + curr.valorCalculado, 0);

    const vendedoresDaUnidade = colaboradores.filter(c => 
        temVisaoGlobal 
            ? c.unidade?.toUpperCase() === formData.unidade?.toUpperCase() 
            : c.unidade?.toUpperCase() === usuarioLogado?.unidade?.toUpperCase()
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (temVisaoGlobal && !formData.unidade) {
            alert('Atenção: Selecione a Unidade da venda antes de confirmar.');
            return;
        }

        const itensValidos = itensForm.filter(item => item.nomeItem !== '' && item.tipo !== '');
        
        if (itensValidos.length === 0) {
            alert('Por favor, adicione pelo menos um Plano ou Produto válido.');
            return;
        }

        setIsSubmitting(true);

        try {
            const novosLancamentos = itensValidos.map(item => {
                const percComissao = 1.00; 
                
                // BLINDAGEM FINAL: Força a extração do número antes de enviar ao Supabase
                let valorPuro = Number(item.valorCalculado);
                if (!valorPuro || isNaN(valorPuro)) {
                    valorPuro = parseCurrency(item.valor);
                }

                return {
                    unidade: formData.unidade.toUpperCase(), 
                    data: formData.data, // Data nativa YYYY-MM-DD
                    matricula: formData.matricula, 
                    nome_aluno: formData.nome.toUpperCase(),
                    produto: item.nomeItem, 
                    vendedor: formData.vendedor.toUpperCase(), 
                    valor: valorPuro, // NUMERO PURO GARANTIDO
                    observacao: formData.observacao, 
                    conferiu: false, 
                    quantidade: parseInt(item.quantidade) || 1, 
                    comissao: valorPuro * percComissao // NUMERO PURO GARANTIDO
                };
            });

            const { data, error } = await supabase.from('vendas').insert(novosLancamentos).select();

            if (error) throw error;

            if (data) {
                onAddMultiple(data.reverse()); 
                setSucesso(true);
                setTimeout(() => setSucesso(false), 3000);
                setFormData({ ...formData, matricula: '', nome: '', observacao: '', vendedor: '' });
                setItensForm([getInitialItem()]);
            }

        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Erro ao conectar com o banco. O sistema impediu o envio de dados corrompidos.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white rounded-3xl shadow-lg border border-slate-100 max-w-5xl mx-auto animate-[fadeIn_0.4s_ease-out] overflow-hidden relative">
            
            {sucesso && (
                <div className="absolute top-6 right-6 bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-[0_8px_20px_rgba(16,185,129,0.4)] flex items-center gap-3 font-black uppercase tracking-wider text-xs z-50">
                    <i data-lucide="check-circle-2" className="w-5 h-5"></i>
                    Venda Salva na Nuvem!
                </div>
            )}

            <div className="bg-[#ecfdf5] px-8 py-6 flex items-center gap-5 border-b border-[#d1fae5]">
                <div className="w-14 h-14 bg-[#d1fae5] text-[#059669] rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0">
                    <i data-lucide="shopping-cart" className="w-7 h-7"></i>
                </div>
                <div>
                    <h2 className="text-2xl font-black text-[#064e3b] tracking-tight">Nova Venda / Matrícula</h2>
                    <p className="text-[11px] font-bold text-[#059669] uppercase tracking-widest mt-1">
                        Lançamento protegido e sincronizado
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-10">
                
                <div className="bg-slate-50 p-6 md:p-8 rounded-2xl border border-slate-200">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mb-5">
                        <div className="md:col-span-3">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Data</label>
                            <input type="date" name="data" value={formData.data} onChange={handleMainChange} required className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer" />
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Matrícula</label>
                            <input type="text" name="matricula" value={formData.matricula} onChange={handleMainChange} required placeholder="Nº da Matrícula" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none" />
                        </div>
                        <div className="md:col-span-6">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Nome Completo do Aluno</label>
                            <input type="text" name="nome" value={formData.nome} onChange={handleMainChange} required placeholder="Digite o nome completo" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none uppercase" />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                        {temVisaoGlobal && (
                            <div className="md:col-span-4 animate-[fadeIn_0.3s_ease-out]">
                                <label className="block text-[10px] font-black text-rose-500 uppercase tracking-widest mb-2 ml-1">Unidade da Venda</label>
                                <select name="unidade" value={formData.unidade} onChange={handleMainChange} required className="w-full bg-rose-50/10 border border-rose-200 rounded-xl px-4 py-3 text-sm font-black text-rose-700 focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer uppercase">
                                    <option value="">Selecione a Unidade...</option>
                                    {unidades.map(u => <option key={u.id || u.nome} value={u.nome}>{u.nome}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="md:col-span-4">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Vendedor</label>
                            <select 
                                name="vendedor" 
                                value={formData.vendedor} 
                                onChange={handleMainChange} 
                                required 
                                disabled={temVisaoGlobal && !formData.unidade}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer uppercase disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                            >
                                <option value="">{(temVisaoGlobal && !formData.unidade) ? 'Escolha a unidade antes...' : 'Selecione...'}</option>
                                {vendedoresDaUnidade.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-4 px-1">
                        <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
                            <i data-lucide="package" className="w-5 h-5 text-slate-400"></i> Itens da Venda
                        </h3>
                        <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">{itensForm.length} item(ns)</span>
                    </div>
                    
                    <div className="space-y-4">
                        {itensForm.map((item, index) => (
                            <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm relative animate-[fadeIn_0.2s_ease-out]">
                                
                                <div className="md:col-span-3">
                                    {index === 0 && <label className="hidden md:block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Categoria</label>}
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            {item.tipo === 'plano' && <i data-lucide="book-open" className="w-4 h-4 text-blue-500"></i>}
                                            {item.tipo === 'produto' && <i data-lucide="box" className="w-4 h-4 text-amber-500"></i>}
                                            {item.tipo === '' && <i data-lucide="layout-grid" className="w-4 h-4 text-slate-400"></i>}
                                        </div>
                                        <select value={item.tipo} onChange={(e) => handleItemChange(item.id, 'tipo', e.target.value)} required className={`w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-3 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer ${item.tipo === '' ? 'text-slate-400' : 'text-slate-800'}`}>
                                            <option value="" disabled hidden>Selecione...</option>
                                            <option value="plano">Plano</option>
                                            <option value="produto">Produto</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div className="md:col-span-4">
                                    {index === 0 && <label className="hidden md:block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Item Selecionado</label>}
                                    <select 
                                        value={item.nomeItem} 
                                        onChange={(e) => handleItemChange(item.id, 'nomeItem', e.target.value)} 
                                        required
                                        disabled={!item.tipo}
                                        className={`w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer uppercase ${!item.tipo ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : item.nomeItem === '' ? 'text-slate-400' : 'text-slate-800'}`}
                                    >
                                        <option value="" disabled hidden>{!item.tipo ? 'Escolha a categoria primeiro' : 'Selecione o item...'}</option>
                                        {item.tipo === 'plano' && planos.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                                        {item.tipo === 'produto' && produtos.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                                    </select>
                                </div>
                                
                                <div className="md:col-span-2">
                                    {index === 0 && <label className="hidden md:block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Qtd.</label>}
                                    <input type="number" min="1" disabled={!item.nomeItem} value={item.quantidade} onChange={(e) => handleItemChange(item.id, 'quantidade', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-sm font-black text-center text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-slate-50 disabled:text-slate-400" title="Quantidade" />
                                </div>
                                
                                <div className="md:col-span-2">
                                    {index === 0 && <label className="hidden md:block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 text-right">Subtotal</label>}
                                    <input type="text" value={item.valor} readOnly className="w-full bg-transparent border-none text-sm font-black text-[#059669] text-left md:text-right pr-2 cursor-default py-3" title="Subtotal" />
                                </div>

                                <div className="md:col-span-1 flex justify-center items-center pt-2">
                                    {itensForm.length > 1 && (
                                        <button 
                                            type="button" 
                                            onClick={() => handleRemoveItem(item.id)} 
                                            className="bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-100 hover:border-transparent rounded-xl p-3 shadow-sm transition-all flex items-center justify-center w-full md:w-auto" 
                                            title="Remover este item"
                                        >
                                            <i data-lucide="trash-2" className="w-4 h-4"></i>
                                        </button>
                                    )}
                                </div>

                            </div>
                        ))}

                        <button type="button" onClick={handleAddItem} className="w-full border-2 border-dashed border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-700 font-bold text-sm py-4 rounded-2xl transition-all flex items-center justify-center gap-2 mt-4">
                            <i data-lucide="plus-circle" className="w-4 h-4"></i> Adicionar mais um item à venda
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start pt-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Observação (Opcional)</label>
                        <textarea 
                            name="observacao" 
                            value={formData.observacao} 
                            onChange={handleMainChange} 
                            rows="4" 
                            placeholder="Ex: Pagamento no PIX, primeira parcela..." 
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none resize-none transition-colors"
                        ></textarea>
                    </div>
                    
                    <div className="bg-[#059669] rounded-2xl p-6 md:p-8 flex flex-col justify-between shadow-[0_8px_30px_rgba(5,150,105,0.3)] h-full min-h-[160px]">
                        <div className="flex justify-between items-start mb-6">
                            <span className="text-emerald-100 font-bold text-sm">Total a Receber</span>
                            <span className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-none">{formatMoney(totalVenda)}</span>
                        </div>
                        
                        <button type="submit" disabled={isSubmitting} className="w-full bg-white hover:bg-slate-50 text-[#059669] disabled:opacity-70 font-black uppercase tracking-widest py-4 rounded-xl shadow-lg hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2.5 text-sm border border-emerald-100">
                            {isSubmitting ? (
                                <><i data-lucide="loader-2" className="w-5 h-5 animate-spin"></i> Gravando...</>
                            ) : (
                                <><i data-lucide="check" className="w-5 h-5"></i> Confirmar Lançamento</>
                            )}
                        </button>
                    </div>
                </div>

            </form>
        </div>
    );
};

export default LancamentoVendas;