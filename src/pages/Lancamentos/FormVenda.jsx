import React, { useState, useRef } from 'react';
import { supabase } from '../../supabaseClient.js';
import { safeNumber, formatMoney, getLocalDateISO } from './utils.js';
import { mascaraCPF, validarCPF } from '../CadastroGeral/utilsAlunos.js';
import ModalAluno from '../../components/Modals/ModalAluno.jsx';
import { User, Package, BookOpen, Box, Briefcase, LayoutGrid, Trash2, Plus, MessageSquare, Receipt, Loader2, Check, CheckCircle2, Search, AlertTriangle, UserRoundPen, UserPlus, CreditCard } from 'lucide-react';

const FormVenda = ({ usuarioLogado, unidades, onAddMultiple, planos, produtos, servicos, colaboradores, voltarHub }) => {
    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';

    const [formData, setFormData] = useState({ 
        unidade: temVisaoGlobal ? '' : (usuarioLogado?.unidade || ''), 
        data: getLocalDateISO(), 
        observacao: '' 
    });

    // 🔥 IDENTIDADE BLINDADA DO ALUNO (Padrão Avaliação)
    const [cpfBusca, setCpfBusca] = useState('');
    const [cpfErro, setCpfErro] = useState(false);
    const [buscandoCpf, setBuscandoCpf] = useState(false);
    const [alunoEncontrado, setAlunoEncontrado] = useState(null); 
    const [statusCpf, setStatusCpf] = useState(null); 
    const [modalAlunoAberto, setModalAlunoAberto] = useState(false);
    const debounceRef = useRef(null);

    // Itens do Carrinho
    const getInitialItem = (vendedorPadrao = '') => ({ 
        id: Date.now(), tipo: '', nomeItem: '', vendedor: vendedorPadrao, quantidade: 1, valor: 'R$ 0,00', valorUnitario: 0, valorCalculado: 0 
    });
    const [itensForm, setItensForm] = useState([getInitialItem()]);
    const [sucesso, setSucesso] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const vendedoresDaUnidade = colaboradores.filter(c => {
        const isAtivo = c.ativo !== false;
        const matchUnidade = temVisaoGlobal 
            ? c.unidade?.toUpperCase() === formData.unidade?.toUpperCase()
            : c.unidade?.toUpperCase() === usuarioLogado?.unidade?.toUpperCase();
        return isAtivo && matchUnidade;
    });

    const planosAtivos = planos.filter(p => p.ativo !== false);
    const produtosAtivos = produtos.filter(p => p.ativo !== false);
    const servicosAtivos = servicos.filter(s => s.ativo !== false);

    // ==========================================
    // BUSCA INTELIGENTE DE CPF
    // ==========================================
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

    // ==========================================
    // MANIPULAÇÃO DO CARRINHO E FORMULÁRIO
    // ==========================================
    const handleMainChange = (e) => {
        const { name, value } = e.target;
        if (name === 'unidade') {
            setFormData({ ...formData, unidade: value });
            setItensForm(itensForm.map(item => ({ ...item, vendedor: '' })));
        }
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
    
    const handleAddItem = () => {
        const lastVendedor = itensForm.length > 0 ? itensForm[itensForm.length - 1].vendedor : '';
        setItensForm([...itensForm, getInitialItem(lastVendedor)]);
    };

    const totalVenda = itensForm.reduce((acc, curr) => acc + safeNumber(curr.valorCalculado), 0);

    // ==========================================
    // SUBMIT DA VENDA
    // ==========================================
    const handleSubmitVenda = async (e) => {
        e.preventDefault();
        
        // 🔥 TRAVAS DE SEGURANÇA
        if (!alunoEncontrado) return alert('Localize ou cadastre o aluno pelo CPF primeiro.');
        if (temVisaoGlobal && !formData.unidade) return alert('Atenção: Selecione a Unidade da venda.');
        
        const itensValidos = itensForm.filter(item => item.nomeItem !== '' && item.tipo !== '');
        if (itensValidos.length === 0) return alert('Adicione pelo menos um item válido.');

        const temItemSemVendedor = itensValidos.some(item => !item.vendedor);
        if (temItemSemVendedor) return alert('Selecione o Consultor Responsável para TODOS os itens adicionados.');

        setIsSubmitting(true);

        try {
            const novosLancamentos = itensValidos.map(item => {
                const valorPuro = safeNumber(item.valorCalculado); 
                return {
                    unidade: formData.unidade.toUpperCase(), 
                    data: formData.data, 
                    matricula: alunoEncontrado.matricula || '', 
                    nome_aluno: alunoEncontrado.nome.toUpperCase(), 
                    produto: item.nomeItem, 
                    vendedor: item.vendedor.toUpperCase(), 
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
                }, 1200);
            }
        } catch (error) {
            console.error("Erro:", error); alert("Erro ao salvar venda. Tente novamente.");
        } finally { setIsSubmitting(false); }
    };

    const labelClass = "block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1";
    const inputClassBase = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm placeholder:text-slate-400";
    const sectionClass = "bg-white p-6 md:p-8 rounded-[24px] border border-slate-200 shadow-sm";

    return (
        <>
            {/* 🔥 CONEXÃO CIRÚRGICA: unidadeDestino adicionada */}
            <ModalAluno 
                isOpen={modalAlunoAberto} 
                onClose={() => setModalAlunoAberto(false)} 
                alunoInicial={alunoEncontrado || { cpf: cpfBusca }} 
                onSaveSuccess={handleSaveAlunoSuccess} 
                usuarioLogado={usuarioLogado}
                unidadeDestino={formData.unidade} 
            />

            <form onSubmit={handleSubmitVenda} className="space-y-6 animate-[fadeIn_0.3s_ease-out] pb-10">
                {sucesso && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
                        <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center animate-[zoomIn_0.2s_ease-out] max-w-sm w-full mx-4 border border-slate-200">
                            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-inner border border-emerald-200"><CheckCircle2 className="w-10 h-10" /></div>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Venda Confirmada!</h3>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lançamento salvo no Caixa.</p>
                        </div>
                    </div>
                )}
                
                {/* 1. SEÇÃO DO ALUNO */}
                <div className={sectionClass}>
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-6">
                        <User className="w-5 h-5 text-emerald-500" />
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Identificação do Cliente</h3>
                    </div>

                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col md:flex-row md:items-end gap-6">
                            <div className="relative w-full max-w-sm">
                                <label className={labelClass}>CPF do Cliente *</label>
                                <div className="relative">
                                    <input type="text" value={cpfBusca} onChange={handleCpfChange} maxLength="14" className={`${inputClassBase} ${cpfErro ? 'border-rose-300 bg-rose-50 focus:ring-rose-500' : 'focus:ring-emerald-500'}`} placeholder="000.000.000-00" />
                                    {buscandoCpf && <Loader2 className="w-4 h-4 text-emerald-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
                                    {alunoEncontrado && <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2" />}
                                    {statusCpf === 'erro' && <AlertTriangle className="w-4 h-4 text-rose-500 absolute right-3 top-1/2 -translate-y-1/2" />}
                                </div>
                                {cpfErro && <span className="text-rose-500 text-[9px] font-bold uppercase mt-1 ml-1">CPF Inválido</span>}
                                {statusCpf === 'encontrado' && <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mt-1.5 ml-1">Cadastro localizado</p>}
                                {statusCpf === 'novo' && <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mt-1.5 ml-1">Cliente Novo (Cadastrar)</p>}
                            </div>

                            <div className="flex-1 w-full max-w-xs">
                                <label className={labelClass}>Data da Venda *</label>
                                <input type="date" name="data" value={formData.data} onChange={handleMainChange} required className={inputClassBase} />
                            </div>

                            {temVisaoGlobal && (
                                <div className="flex-1 w-full max-w-xs">
                                    <label className={labelClass}>Unidade da Venda *</label>
                                    <select name="unidade" value={formData.unidade} onChange={handleMainChange} required className={inputClassBase}>
                                        <option value="">Selecione...</option>
                                        {unidades.map(u => <option key={u.id || u.nome} value={u.nome}>{u.nome}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>

                        {!buscandoCpf && cpfBusca.length === 14 && !cpfErro && statusCpf !== 'erro' && (
                            alunoEncontrado ? (
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-inner flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-[fadeIn_0.3s_ease-out]">
                                    <div>
                                        <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 mb-2">{alunoEncontrado.nome} <CheckCircle2 className="w-4 h-4 text-emerald-500" /></h4>
                                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold text-slate-500">
                                            {alunoEncontrado.matricula && <span className="flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" /> Mat: {alunoEncontrado.matricula}</span>}
                                            {alunoEncontrado.telefone && <span className="flex items-center gap-1">📞 {alunoEncontrado.telefone}</span>}
                                            {alunoEncontrado.email && <span className="flex items-center gap-1">✉️ {alunoEncontrado.email}</span>}
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => {
                                        if(temVisaoGlobal && !formData.unidade) return alert('Selecione a unidade antes de cadastrar/editar o aluno.');
                                        setModalAlunoAberto(true);
                                    }} className="w-full md:w-auto px-5 py-2.5 bg-white border border-slate-200 text-blue-600 hover:bg-blue-50 hover:border-blue-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-sm shrink-0">
                                        <UserRoundPen className="w-4 h-4" /> Editar Cadastro
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-inner flex flex-col md:flex-row justify-between items-center gap-4 animate-[fadeIn_0.3s_ease-out]">
                                    <div>
                                        <h4 className="text-sm font-black text-amber-800 uppercase tracking-tight mb-1">Registro Inexistente</h4>
                                        <p className="text-xs font-bold text-amber-700/70">Nenhum cliente localizado para este CPF.</p>
                                    </div>
                                    <button type="button" onClick={() => {
                                        if(temVisaoGlobal && !formData.unidade) return alert('Selecione a unidade antes de cadastrar o aluno.');
                                        setModalAlunoAberto(true);
                                    }} className="w-full md:w-auto px-5 py-2.5 bg-amber-500 text-white hover:bg-amber-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-sm shrink-0">
                                        <UserPlus className="w-4 h-4" /> Cadastrar Cliente Rápido
                                    </button>
                                </div>
                            )
                        )}
                    </div>
                </div>

                {/* SÓ MOSTRA O CARRINHO SE O ALUNO FOR ENCONTRADO E CONFIRMADO */}
                <div className={`transition-all duration-500 ${!alunoEncontrado ? 'opacity-30 pointer-events-none grayscale-[50%]' : 'opacity-100'}`}>
                    
                    <div className={sectionClass}>
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-6">
                            <Package className="w-5 h-5 text-blue-500" />
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Itens da Venda e Atribuição</h3>
                        </div>
                        
                        <div className="space-y-4">
                            {itensForm.map((item) => (
                                <div key={item.id} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end bg-slate-50/50 p-5 rounded-2xl border border-slate-200 relative">
                                    <div className="lg:col-span-2">
                                        <label className={labelClass}>Categoria *</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                {item.tipo === 'plano' && <BookOpen className="w-4 h-4 text-emerald-500" />}
                                                {item.tipo === 'produto' && <Box className="w-4 h-4 text-emerald-500" />}
                                                {item.tipo === 'servico' && <Briefcase className="w-4 h-4 text-emerald-500" />}
                                                {item.tipo === '' && <LayoutGrid className="w-4 h-4 text-slate-300" />}
                                            </div>
                                            <select value={item.tipo} onChange={(e) => handleItemChange(item.id, 'tipo', e.target.value)} required className={`${inputClassBase} pl-10 pr-3 py-2 text-xs !py-3`}>
                                                <option value="" disabled hidden>Selecione...</option>
                                                <option value="plano">Plano</option>
                                                <option value="produto">Produto</option>
                                                <option value="servico">Serviço</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div className="lg:col-span-3">
                                        <label className={labelClass}>Item do Catálogo *</label>
                                        <select value={item.nomeItem} onChange={(e) => handleItemChange(item.id, 'nomeItem', e.target.value)} required disabled={!item.tipo} className={`${inputClassBase} px-3 py-2 text-xs !py-3 disabled:bg-slate-100 disabled:cursor-not-allowed`}>
                                            <option value="" disabled hidden>{!item.tipo ? 'Aguarde...' : 'Selecione o item...'}</option>
                                            {item.tipo === 'plano' && planosAtivos.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                                            {item.tipo === 'produto' && produtosAtivos.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                                            {item.tipo === 'servico' && servicosAtivos.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                                        </select>
                                    </div>

                                    <div className="lg:col-span-3">
                                        <label className="block text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1.5 ml-1">Consultor Responsável *</label>
                                        <select value={item.vendedor} onChange={(e) => handleItemChange(item.id, 'vendedor', e.target.value)} required disabled={temVisaoGlobal && !formData.unidade} className={`w-full bg-blue-50/50 border border-blue-200 rounded-xl px-3 py-3 text-xs focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all duration-200 disabled:bg-slate-50 disabled:cursor-not-allowed ${item.vendedor === '' ? 'text-blue-400' : 'text-blue-700 font-bold uppercase'}`}>
                                            <option value="" disabled hidden>{(temVisaoGlobal && !formData.unidade) ? 'Escolha a unidade...' : 'Selecione o consultor...'}</option>
                                            {vendedoresDaUnidade.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                                        </select>
                                    </div>
                                    
                                    <div className="lg:col-span-1">
                                        <label className={labelClass}>Qtd</label>
                                        <input type="number" min="1" disabled={!item.nomeItem} value={item.quantidade} onChange={(e) => handleItemChange(item.id, 'quantidade', e.target.value)} className={`${inputClassBase} px-2 py-3 text-center disabled:bg-slate-100 disabled:cursor-not-allowed`} />
                                    </div>
                                    
                                    <div className="lg:col-span-2">
                                        <label className={`${labelClass} text-right mr-1`}>Subtotal</label>
                                        <input type="text" value={item.valor} readOnly className="w-full bg-slate-200/50 border border-slate-200 text-sm font-black text-slate-700 rounded-xl text-right pr-4 cursor-not-allowed py-3 outline-none" title="Calculado automaticamente" />
                                    </div>

                                    <div className="lg:col-span-1 flex justify-center pb-2">
                                        {itensForm.length > 1 && (
                                            <button type="button" onClick={() => handleRemoveItem(item.id)} className="p-2.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 rounded-xl border border-transparent hover:border-rose-200 transition-colors" title="Remover Item">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}

                            <button type="button" onClick={handleAddItem} className="w-full bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 text-blue-600 font-bold text-xs uppercase tracking-widest py-4 rounded-2xl transition-colors flex items-center justify-center gap-2 mt-4">
                                <Plus className="w-4 h-4" /> Adicionar Múltiplos Itens / Consultores
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start mt-6">
                        <div className={`${sectionClass} lg:col-span-2`}>
                            <label className={`${labelClass} flex items-center gap-2 mb-3`}><MessageSquare className="w-4 h-4 text-slate-400" /> Observação de Caixa (Opcional)</label>
                            <textarea name="observacao" value={formData.observacao} onChange={handleMainChange} rows="5" placeholder="Ex: Pagamento no PIX, Isento de taxa..." className={`${inputClassBase} resize-none`}></textarea>
                        </div>
                        
                        <div className="bg-slate-50 p-8 rounded-[24px] border border-slate-200 flex flex-col justify-between lg:sticky lg:top-28 shadow-sm">
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6"><Receipt className="w-4 h-4 text-slate-400" /> Resumo Financeiro</h3>
                                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block mb-1">Total a Receber</span>
                                <span className="text-4xl font-black text-slate-900 tracking-tight">{formatMoney(totalVenda)}</span>
                            </div>
                            
                            <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 font-black uppercase tracking-widest py-4 rounded-2xl shadow-sm transition-all duration-200 flex justify-center items-center gap-2 mt-8 text-xs active:scale-[0.98]">
                                {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Processando Caixa...</> : <><Check className="w-5 h-5" /> Confirmar Venda Final</>}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </>
    );
};

export default FormVenda;