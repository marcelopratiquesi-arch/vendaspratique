import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import { safeNumber, formatMoney, getLocalDateISO } from './utils.js';
import { mascaraCPF, validarCPF } from '../CadastroGeral/utilsAlunos.js';
import ModalAluno from '../../components/Modals/ModalAluno.jsx';
import EtiquetasUnidade from '../../components/EtiquetasUnidade.jsx';
import { buscarUnidadesDoAluno } from '../Alunos/utils.js';
import { User, Package, BookOpen, Box, Briefcase, LayoutGrid, Trash2, Plus, MessageSquare, Receipt, Loader2, Check, CheckCircle2, AlertTriangle, UserRoundPen, UserPlus, CreditCard } from 'lucide-react';

const apenasDigitos = (valor) => String(valor || '').replace(/\D/g, '');

const FormVenda = ({ 
    usuarioLogado, unidades, onAddMultiple, planos, produtos, servicos, 
    colaboradores, voltarHub, alunoPreSelecionado, limparPreSelecao,
    onIrParaAluno // Nova propriedade para o redirecionamento automático
}) => {
    // 🔥 Libera a escolha de unidade para quem não é recepção pura
    const roleUsuario = String(usuarioLogado?.role || '').toUpperCase().trim();
    const podeEscolherUnidade = ['ADMIN', 'MENTOR', 'LIDER', 'VENDEDOR'].includes(roleUsuario);

    const [formData, setFormData] = useState({ 
        unidade: usuarioLogado?.unidade || '', 
        data: getLocalDateISO(), 
        observacao: '' 
    });

    const [cpfBusca, setCpfBusca] = useState('');
    const [cpfErro, setCpfErro] = useState(false);
    const [buscandoCpf, setBuscandoCpf] = useState(false);
    const [alunoEncontrado, setAlunoEncontrado] = useState(null); 
    const [statusCpf, setStatusCpf] = useState(null); 
    const [modalAlunoAberto, setModalAlunoAberto] = useState(false);
    
    const debounceRef = useRef(null);
    const cpfAtualRef = useRef('');
    const envioTravadoRef = useRef(false);

    const getInitialItem = (vendedorPadrao = '') => ({ 
        id: Date.now(), tipo: '', nomeItem: '', vendedor: vendedorPadrao, quantidade: 1, valor: 'R$ 0,00', valorUnitario: 0, valorCalculado: 0 
    });
    
    const [itensForm, setItensForm] = useState([getInitialItem()]);
    const [sucesso, setSucesso] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (alunoPreSelecionado) {
            cpfAtualRef.current = apenasDigitos(alunoPreSelecionado.cpf);
            setCpfBusca(mascaraCPF(alunoPreSelecionado.cpf));
            setAlunoEncontrado(alunoPreSelecionado);
            setStatusCpf('encontrado');
            setCpfErro(false);
            // A venda fica na unidade de quem vende, nunca na unidade de origem do aluno (regra 8 do CLAUDE.md)

            if (limparPreSelecao) limparPreSelecao();
        }
    }, [alunoPreSelecionado, limparPreSelecao]);

    // Unidade(s) de origem do aluno, só para a recepção saber de onde ele é
    const [unidadesAluno, setUnidadesAluno] = useState([]);
    useEffect(() => {
        const id = alunoEncontrado?.id;
        if (!id) { setUnidadesAluno([]); return undefined; }
        let ativo = true;
        buscarUnidadesDoAluno(id).then(lista => { if (ativo) setUnidadesAluno(lista); });
        return () => { ativo = false; };
    }, [alunoEncontrado?.id]);

    // 🔥 Filtra os consultores com base na unidade selecionada na tela
    const vendedoresDaUnidade = colaboradores.filter(c => {
        const isAtivo = c.ativo !== false;
        const matchUnidade = c.unidade?.toUpperCase() === formData.unidade?.toUpperCase();
        return isAtivo && matchUnidade;
    });

    const planosAtivos = planos.filter(p => p.ativo !== false);
    const produtosAtivos = produtos.filter(p => p.ativo !== false);
    const servicosAtivos = servicos.filter(s => s.ativo !== false);

    const cpfConfere = Boolean(alunoEncontrado) && apenasDigitos(alunoEncontrado.cpf) === apenasDigitos(cpfBusca);

    const buscarAlunoPorCpf = async (cpfLimpo) => {
        setBuscandoCpf(true);
        setStatusCpf(null);
        try {
            const cpfFormatado = mascaraCPF(cpfLimpo);
            const { data, error } = await supabase
                .from('alunos')
                .select('*')
                .or(`cpf.eq.${cpfLimpo},cpf.eq."${cpfFormatado}"`)
                .limit(2);

            if (cpfAtualRef.current !== cpfLimpo) return;
            if (error) throw error;

            const encontrados = data || [];
            if (encontrados.length > 1) {
                setAlunoEncontrado(null);
                setStatusCpf('duplicado');
            } else if (encontrados.length === 1) {
                setAlunoEncontrado(encontrados[0]);
                setStatusCpf('encontrado');
            } else {
                setAlunoEncontrado(null);
                setStatusCpf('novo');
            }
        } catch (error) {
            if (cpfAtualRef.current !== cpfLimpo) return;
            console.error(error);
            setAlunoEncontrado(null);
            setStatusCpf('erro');
        } finally {
            if (cpfAtualRef.current === cpfLimpo) setBuscandoCpf(false);
        }
    };

    const handleCpfChange = (e) => {
        const masked = mascaraCPF(e.target.value);
        setCpfBusca(masked);
        setAlunoEncontrado(null); 
        setStatusCpf(null);
        setBuscandoCpf(false);
        cpfAtualRef.current = '';
        
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (masked.length === 14) {
            if (!validarCPF(masked)) {
                setCpfErro(true);
            } else {
                setCpfErro(false);
                const limpo = masked.replace(/\D/g, '');
                cpfAtualRef.current = limpo;
                debounceRef.current = setTimeout(() => buscarAlunoPorCpf(limpo), 500);
            }
        } else {
            setCpfErro(false);
        }
    };

    const handleSaveAlunoSuccess = (alunoAtualizado) => {
        cpfAtualRef.current = apenasDigitos(alunoAtualizado.cpf);
        setAlunoEncontrado(alunoAtualizado);
        setCpfBusca(mascaraCPF(alunoAtualizado.cpf)); 
        setStatusCpf('encontrado');
    };

    const handleMainChange = (e) => {
        const { name, value } = e.target;
        if (name === 'unidade') {
            setFormData({ ...formData, unidade: value });
            setItensForm(itensForm.map(item => ({ ...item, vendedor: '' }))); // Reseta vendedores se mudar a unidade
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

    const handleSubmitVenda = async (e) => {
        e.preventDefault();

        if (envioTravadoRef.current || isSubmitting || sucesso) return;
        
        if (!alunoEncontrado) return alert('Localize ou cadastre o aluno pelo CPF primeiro.');
        if (!cpfConfere) return alert('O CPF digitado não corresponde ao aluno carregado. Confira o CPF antes de continuar.');
        if (!formData.unidade) return alert('Atenção: Selecione a Unidade da venda.');
        
        const itensValidos = itensForm.filter(item => item.nomeItem !== '' && item.tipo !== '');
        if (itensValidos.length === 0) return alert('Adicione pelo menos um item válido.');

        const temItemSemVendedor = itensValidos.some(item => !item.vendedor);
        if (temItemSemVendedor) return alert('Selecione o Consultor Responsável para TODOS os itens adicionados.');

        envioTravadoRef.current = true;
        setIsSubmitting(true);

        try {
            const novosLancamentos = itensValidos.map(item => {
                const valorPuro = safeNumber(item.valorCalculado); 
                return {
                    unidade: formData.unidade.toUpperCase(), 
                    data: formData.data, 
                    matricula: alunoEncontrado.matricula || '', 
                    nome_aluno: alunoEncontrado.nome.toUpperCase(),
                    cpf: alunoEncontrado.cpf.replace(/\D/g, ''),
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
                
                // 🔥 Redirecionamento Automático
                setTimeout(() => {
                    setSucesso(false);
                    if (onIrParaAluno) {
                        onIrParaAluno(alunoEncontrado);
                    } else if (voltarHub) {
                        voltarHub();
                    } else {
                        envioTravadoRef.current = false;
                    }
                }, 1500); // 1.5s para o usuário ver o check verde antes de viajar de tela
            } else {
                envioTravadoRef.current = false;
            }
        } catch (error) {
            envioTravadoRef.current = false;
            console.error("Erro:", error); alert("Erro ao salvar venda. Tente novamente.");
        } finally { 
            setIsSubmitting(false); 
        }
    };

    const labelClass = "block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1";
    const inputClassBase = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm placeholder:text-slate-400";
    const sectionClass = "bg-white p-6 md:p-8 rounded-[24px] border border-slate-200 shadow-sm";

    return (
        <>
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
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">Lançamento salvo no Caixa.</p>
                            {onIrParaAluno && (
                                <div className="flex items-center gap-2 text-blue-600 font-bold text-xs bg-blue-50 px-5 py-2.5 rounded-xl border border-blue-100">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Abrindo ficha do aluno...
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
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
                                    {cpfConfere && <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2" />}
                                    {(statusCpf === 'erro' || statusCpf === 'duplicado') && <AlertTriangle className="w-4 h-4 text-rose-500 absolute right-3 top-1/2 -translate-y-1/2" />}
                                </div>
                                {cpfErro && <span className="text-rose-500 text-[9px] font-bold uppercase mt-1 ml-1">CPF Inválido</span>}
                                {statusCpf === 'encontrado' && <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mt-1.5 ml-1">Cadastro localizado</p>}
                                {statusCpf === 'novo' && <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mt-1.5 ml-1">Cliente Novo (Cadastrar)</p>}
                                {statusCpf === 'duplicado' && <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest mt-1.5 ml-1">CPF com mais de um cadastro</p>}
                            </div>

                            <div className="flex-1 w-full max-w-xs">
                                <label className={labelClass}>Data da Venda *</label>
                                <input type="date" name="data" value={formData.data} onChange={handleMainChange} required className={inputClassBase} />
                            </div>

                            {/* 🔥 MOSTRA A UNIDADE APENAS PARA QUEM TEM PERMISSÃO */}
                            {podeEscolherUnidade && (
                                <div className="flex-1 w-full max-w-xs">
                                    <label className={labelClass}>Unidade da Venda *</label>
                                    <select name="unidade" value={formData.unidade} onChange={handleMainChange} required className={inputClassBase}>
                                        <option value="">Selecione...</option>
                                        {unidades.map(u => <option key={u.id || u.nome} value={u.nome}>{u.nome}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>

                        {!buscandoCpf && statusCpf === 'duplicado' && (
                            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 shadow-inner flex items-start gap-3 animate-[fadeIn_0.3s_ease-out]">
                                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="text-sm font-black text-rose-800 uppercase tracking-tight mb-1">CPF com mais de um cadastro</h4>
                                    <p className="text-xs font-bold text-rose-700/80">Existe mais de um aluno com este CPF. Para não lançar a venda no cadastro errado, peça ao gestor para corrigir os cadastros antes de continuar.</p>
                                </div>
                            </div>
                        )}

                        {!buscandoCpf && cpfBusca.length === 14 && !cpfErro && statusCpf !== 'erro' && statusCpf !== 'duplicado' && statusCpf !== null && (
                            cpfConfere ? (
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-inner flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-[fadeIn_0.3s_ease-out]">
                                    <div>
                                        <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 mb-2">{alunoEncontrado.nome} <CheckCircle2 className="w-4 h-4 text-emerald-500" /></h4>
                                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold text-slate-500">
                                            {alunoEncontrado.matricula && <span className="flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" /> Mat: {alunoEncontrado.matricula}</span>}
                                            {alunoEncontrado.telefone && <span className="flex items-center gap-1">📞 {alunoEncontrado.telefone}</span>}
                                            {alunoEncontrado.email && <span className="flex items-center gap-1">✉️ {alunoEncontrado.email}</span>}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                            Unidade de origem: <EtiquetasUnidade unidades={unidadesAluno} unidadeMinha={formData.unidade} />
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => {
                                        if(!formData.unidade) return alert('Selecione a unidade antes de cadastrar/editar o aluno.');
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
                                        if(!formData.unidade) return alert('Selecione a unidade antes de cadastrar o aluno.');
                                        setModalAlunoAberto(true);
                                    }} className="w-full md:w-auto px-5 py-2.5 bg-amber-500 text-white hover:bg-amber-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-sm shrink-0">
                                        <UserPlus className="w-4 h-4" /> Cadastrar Cliente Rápido
                                    </button>
                                </div>
                            )
                        )}
                    </div>
                </div>

                <div className={`transition-all duration-500 ${!cpfConfere ? 'opacity-30 pointer-events-none grayscale-[50%]' : 'opacity-100'}`}>
                    
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

                                    {/* 🔥 O CONSULTOR É FILTRADO PELA UNIDADE SELECIONADA NO TOPO */}
                                    <div className="lg:col-span-3">
                                        <label className="block text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1.5 ml-1">Consultor Responsável *</label>
                                        <select value={item.vendedor} onChange={(e) => handleItemChange(item.id, 'vendedor', e.target.value)} required disabled={!formData.unidade} className={`w-full bg-blue-50/50 border border-blue-200 rounded-xl px-3 py-3 text-xs focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all duration-200 disabled:bg-slate-50 disabled:cursor-not-allowed ${item.vendedor === '' ? 'text-blue-400' : 'text-blue-700 font-bold uppercase'}`}>
                                            <option value="" disabled hidden>{!formData.unidade ? 'Escolha a unidade primeiro...' : 'Selecione o consultor...'}</option>
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
                            
                            <button type="submit" disabled={isSubmitting || sucesso} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 font-black uppercase tracking-widest py-4 rounded-2xl shadow-sm transition-all duration-200 flex justify-center items-center gap-2 mt-8 text-xs active:scale-[0.98]">
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