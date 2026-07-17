import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js';

const LancamentoVendas = ({ usuarioLogado, unidades = [], onAddMultiple, planos = [], produtos = [], colaboradores = [] }) => {
    
    // ==========================================
    // TRADUTORES UNIVERSAIS (BLINDAGEM DE DADOS)
    // ==========================================
    const safeNumber = (val) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        const str = String(val).replace(/[^0-9,-]+/g, ''); 
        if (str.includes(',')) return parseFloat(str.replace(',', '.')) || 0;
        return parseFloat(str) || 0;
    };

    const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(safeNumber(val));
    
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
        valor: 'R$ 0,00', 
        valorUnitario: 0,
        valorCalculado: 0 
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
                    
                    const precoNumericoLimpo = safeNumber(selecionado.valor); 
                    
                    updatedItem.quantidade = 1;
                    updatedItem.valorUnitario = precoNumericoLimpo;
                    updatedItem.valorCalculado = precoNumericoLimpo;
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

    const totalVenda = itensForm.reduce((acc, curr) => acc + safeNumber(curr.valorCalculado), 0);

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
                    comissao: valorPuro * percComissao,
                    criado_por: usuarioLogado?.nome || 'SISTEMA' 
                };
            });

            const { data, error } = await supabase.from('vendas').insert(novosLancamentos).select();

            if (error) throw error;

            if (data) {
                onAddMultiple(data.reverse()); 
                setSucesso(true);
                setTimeout(() => setSucesso(false), 4000);
                setFormData({ ...formData, matricula: '', nome: '', observacao: '', vendedor: '' });
                setItensForm([getInitialItem()]);
            }
        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Erro ao salvar. Tente atualizar a página (F5).");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-[1200px] mx-auto animate-[fadeIn_0.3s_ease-out] pb-10">
            
            {/* ALERTA DE SUCESSO COMPACTO */}
            {sucesso && (
                <div className="fixed top-6 right-6 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 font-black uppercase tracking-widest text-xs z-50 border border-slate-700 animate-[slideDown_0.3s_ease-out]">
                    <i data-lucide="check-circle-2" className="w-4 h-4 text-emerald-400"></i>
                    <span>Lançamento registrado!</span>
                </div>
            )}

            {/* HEADER DA PÁGINA */}
            <div className="mb-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-md shadow-emerald-500/20 flex-shrink-0">
                    <i data-lucide="shopping-bag" className="w-6 h-6"></i>
                </div>
                <div>
                    <h1 className="text-xl font-black text-slate-800 tracking-tight uppercase">Novo Lançamento</h1>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Terminal de Vendas Pratique</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* SESSÃO 1: DADOS DO ALUNO E UNIDADE */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                        <i data-lucide="user" className="w-4 h-4 text-blue-500"></i>
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Informações do Cliente</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="md:col-span-3">
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Data da Venda</label>
                            <input type="date" name="data" value={formData.data} onChange={handleMainChange} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all cursor-pointer" />
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nº Matrícula</label>
                            <input type="text" name="matricula" value={formData.matricula} onChange={handleMainChange} required placeholder="Ex: 00456" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all" />
                        </div>
                        <div className="md:col-span-6">
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nome Completo</label>
                            <input type="text" name="nome" value={formData.nome} onChange={handleMainChange} required placeholder="Nome do aluno" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none uppercase transition-all" />
                        </div>

                        {temVisaoGlobal && (
                            <div className="md:col-span-6">
                                <label className="block text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1.5 ml-1">Unidade da Venda</label>
                                <select name="unidade" value={formData.unidade} onChange={handleMainChange} required className="w-full bg-rose-50/20 border border-rose-200 rounded-xl px-3 py-2.5 text-xs font-black text-rose-700 focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none cursor-pointer uppercase transition-all">
                                    <option value="">Selecione a Unidade...</option>
                                    {unidades.map(u => <option key={u.id || u.nome} value={u.nome}>{u.nome}</option>)}
                                </select>
                            </div>
                        )}

                        <div className={temVisaoGlobal ? "md:col-span-6" : "md:col-span-12"}>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Vendedor / SDR</label>
                            <select 
                                name="vendedor" 
                                value={formData.vendedor} 
                                onChange={handleMainChange} 
                                required 
                                disabled={temVisaoGlobal && !formData.unidade}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none cursor-pointer uppercase transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <option value="">{(temVisaoGlobal && !formData.unidade) ? 'Escolha a unidade antes...' : 'Selecione quem realizou a venda...'}</option>
                                {vendedoresDaUnidade.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* SESSÃO 2: CARRINHO DE ITENS */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <i data-lucide="package" className="w-4 h-4 text-amber-500"></i>
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Carrinho de Compras</h3>
                        </div>
                        <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">{itensForm.length} {itensForm.length === 1 ? 'Item' : 'Itens'}</span>
                    </div>
                    
                    <div className="space-y-3">
                        {itensForm.map((item, index) => (
                            <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-slate-50 p-4 rounded-xl border border-slate-200 group">
                                
                                <div className="md:col-span-3">
                                    {index === 0 && <label className="hidden md:block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Categoria</label>}
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            {item.tipo === 'plano' && <i data-lucide="book-open" className="w-3.5 h-3.5 text-blue-500"></i>}
                                            {item.tipo === 'produto' && <i data-lucide="box" className="w-3.5 h-3.5 text-amber-500"></i>}
                                            {item.tipo === '' && <i data-lucide="layout-grid" className="w-3.5 h-3.5 text-slate-400"></i>}
                                        </div>
                                        <select value={item.tipo} onChange={(e) => handleItemChange(item.id, 'tipo', e.target.value)} required className={`w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none cursor-pointer ${item.tipo === '' ? 'text-slate-400' : 'text-slate-800'}`}>
                                            <option value="" disabled hidden>Selecione...</option>
                                            <option value="plano">Assinatura / Plano</option>
                                            <option value="produto">Produto / Complemento</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div className="md:col-span-4">
                                    {index === 0 && <label className="hidden md:block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nome do Item</label>}
                                    <select 
                                        value={item.nomeItem} 
                                        onChange={(e) => handleItemChange(item.id, 'nomeItem', e.target.value)} 
                                        required
                                        disabled={!item.tipo}
                                        className={`w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none cursor-pointer uppercase ${!item.tipo ? 'bg-slate-100/50 text-slate-400 cursor-not-allowed border-dashed' : item.nomeItem === '' ? 'text-slate-400' : 'text-slate-800'}`}
                                    >
                                        <option value="" disabled hidden>{!item.tipo ? 'Aguarde categoria...' : 'Selecione no catálogo...'}</option>
                                        {item.tipo === 'plano' && planos.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                                        {item.tipo === 'produto' && produtos.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                                    </select>
                                </div>
                                
                                <div className="md:col-span-2">
                                    {index === 0 && <label className="hidden md:block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 text-center">Quantidade</label>}
                                    <input 
                                        type="number" 
                                        min="1" 
                                        disabled={!item.nomeItem} 
                                        value={item.quantidade} 
                                        onChange={(e) => handleItemChange(item.id, 'quantidade', e.target.value)} 
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-black text-center text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none disabled:bg-slate-100/50 disabled:text-slate-400 transition-all" 
                                    />
                                </div>
                                
                                <div className="md:col-span-2">
                                    {index === 0 && <label className="hidden md:block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 text-right">Subtotal</label>}
                                    <input type="text" value={item.valor} readOnly className="w-full bg-transparent border-none text-sm font-black text-emerald-600 text-left md:text-right pr-2 cursor-default py-2 focus:outline-none" />
                                </div>

                                <div className="md:col-span-1 flex justify-center items-center pt-2 md:pt-0">
                                    {itensForm.length > 1 && (
                                        <button 
                                            type="button" 
                                            onClick={() => handleRemoveItem(item.id)} 
                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors" 
                                            title="Remover Item"
                                        >
                                            <i data-lucide="trash-2" className="w-4 h-4"></i>
                                        </button>
                                    )}
                                </div>

                            </div>
                        ))}

                        <button type="button" onClick={handleAddItem} className="w-full border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-bold text-xs py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2">
                            <i data-lucide="plus" className="w-3.5 h-3.5"></i> Adicionar outro item
                        </button>
                    </div>
                </div>

                {/* SESSÃO 3: CHECKOUT E OBSERVAÇÃO */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                    <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-full">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                            <i data-lucide="message-square" className="w-3.5 h-3.5"></i> Observação (Opcional)
                        </label>
                        <textarea 
                            name="observacao" 
                            value={formData.observacao} 
                            onChange={handleMainChange} 
                            rows="3" 
                            placeholder="Ex: Pagamento no PIX..." 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-semibold text-slate-700 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none transition-all"
                        ></textarea>
                    </div>
                    
                    {/* CHECKOUT COMPACTO E DIRETO */}
                    <div className="lg:col-span-5 bg-slate-900 rounded-2xl p-6 flex flex-col justify-between shadow-lg relative overflow-hidden h-full border border-slate-800">
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
                                <i data-lucide="receipt" className="w-4 h-4 text-emerald-400"></i>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resumo</span>
                            </div>

                            <div className="mb-5">
                                <span className="text-slate-400 font-bold text-xs block mb-1">Total a Receber</span>
                                <span className="text-3xl font-black text-white tracking-tighter leading-none">{formatMoney(totalVenda)}</span>
                            </div>
                        </div>
                        
                        <button type="submit" disabled={isSubmitting} className="relative z-10 w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 disabled:opacity-50 font-black uppercase tracking-widest py-3.5 rounded-xl shadow-md transition-colors flex justify-center items-center gap-2 text-xs">
                            {isSubmitting ? (
                                <><i data-lucide="loader-2" className="w-4 h-4 animate-spin"></i> Salvando...</>
                            ) : (
                                <><i data-lucide="check" className="w-4 h-4"></i> Confirmar</>
                            )}
                        </button>
                    </div>
                </div>

            </form>
        </div>
    );
};

export default LancamentoVendas;