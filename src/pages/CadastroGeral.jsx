import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js';

const CadastroGeral = ({ usuarioLogado, unidades = [], planos, setPlanos, produtos, setProdutos, colaboradores, setColaboradores }) => {
    // ==========================================
    // 1. ESTADOS GLOBAIS E DE UI
    // ==========================================
    const [abaAtiva, setAbaAtiva] = useState('equipe'); 
    const [sucesso, setSucesso] = useState(false);
    const [erroBanco, setErroBanco] = useState('');
    const [editandoId, setEditandoId] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false); 

    // Modal Customizado
    const [modal, setModal] = useState({ isOpen: false, tipo: 'alert', titulo: '', mensagem: '', onConfirm: null });

    // ==========================================
    // 2. ESTADOS DOS FORMULÁRIOS E LISTAS
    // ==========================================
    const [listaSetores, setListaSetores] = useState([]);
    const [servicos, setServicos] = useState([]); 

    const [nomeSetor, setNomeSetor] = useState('');
    
    // Estados do Colaborador
    const [nomeColaborador, setNomeColaborador] = useState('');
    const [cpfColaborador, setCpfColaborador] = useState('');
    const [telefoneColaborador, setTelefoneColaborador] = useState('');
    const [cargoColaborador, setCargoColaborador] = useState('');
    const [unidadeColaborador, setUnidadeColaborador] = useState('');
    const [tipoContaColaborador, setTipoContaColaborador] = useState('INTER');
    const [contaColaborador, setContaColaborador] = useState(''); 
    
    const [nomePlano, setNomePlano] = useState('');
    const [valorPlano, setValorPlano] = useState('');
    
    const [nomeProduto, setNomeProduto] = useState('');
    const [valorProduto, setValorProduto] = useState('');

    const [nomeServico, setNomeServico] = useState('');
    const [valorServico, setValorServico] = useState('');

    // Filtros
    const [filtroUnidadeLista, setFiltroUnidadeLista] = useState('TODOS');
    const [termoBusca, setTermoBusca] = useState(''); 

    // ==========================================
    // 3. CONTROLE DE ACESSO AVANÇADO
    // ==========================================
    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';
    const ehAdmin = usuarioLogado?.role === 'ADMIN';
    const podeEditarEquipe = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR' || usuarioLogado?.role === 'LIDER';
    const mostraFormulario = (abaAtiva === 'equipe' && podeEditarEquipe) || (abaAtiva !== 'equipe' && ehAdmin);

    // ==========================================
    // 4. EFFECTS & HELPERS
    // ==========================================
    useEffect(() => {
        const fetchDadosExtras = async () => {
            const [resSetores, resServicos] = await Promise.all([
                supabase.from('setores').select('*'),
                supabase.from('catalogo').select('*').eq('tipo', 'servico')
            ]);
            if (resSetores.data) setListaSetores(resSetores.data);
            if (resServicos.data) setServicos(resServicos.data);
        };
        fetchDadosExtras();
    }, []);

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [abaAtiva, planos, produtos, servicos, colaboradores, listaSetores, sucesso, erroBanco, editandoId, unidades, filtroUnidadeLista, mostraFormulario, modal, termoBusca, tipoContaColaborador]);

    const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    
    const mostrarSucesso = () => {
        setSucesso(true); setErroBanco('');
        setTimeout(() => setSucesso(false), 3000);
    };

    const cancelarEdicao = () => {
        setEditandoId(null);
        setNomeColaborador(''); setCpfColaborador(''); setTelefoneColaborador(''); setCargoColaborador(''); 
        setUnidadeColaborador(''); setTipoContaColaborador('INTER'); setContaColaborador('');
        setNomeSetor(''); 
        setNomePlano(''); setValorPlano(''); 
        setNomeProduto(''); setValorProduto('');
        setNomeServico(''); setValorServico('');
    };

    const changeTab = (tab) => {
        setAbaAtiva(tab);
        cancelarEdicao();
        setErroBanco('');
        setTermoBusca(''); 
    };

    // --- MÁSCARAS DE INPUT AVANÇADAS ---
    const handleCpfChange = (e) => {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length <= 11) {
            v = v.replace(/(\d{3})(\d)/, '$1.$2');
            v = v.replace(/(\d{3})(\d)/, '$1.$2');
            v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            setCpfColaborador(v);
        }
    };

    const handlePhoneChange = (e) => {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length <= 11) {
            v = v.replace(/(\d{2})(\d)/, '($1) $2');
            v = v.replace(/(\d{4,5})(\d{4})$/, '$1-$2');
            setTelefoneColaborador(v);
        }
    };

    // Máscara Inteligente para Conta Banco Inter (Último dígito separado por traço)
    const handleContaInterChange = (e) => {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length > 1) {
            v = v.replace(/(\d+)(\d)$/, '$1-$2'); // Pega todos os números exceto o último, insere traço, insere o último.
        }
        setContaColaborador(v);
    };

    // --- FUNÇÕES DE MODAL CUSTOMIZADO ---
    const showAlert = (titulo, mensagem) => setModal({ isOpen: true, tipo: 'alert', titulo, mensagem, onConfirm: null });
    const showConfirm = (titulo, mensagem, onConfirm) => setModal({ isOpen: true, tipo: 'confirm', titulo, mensagem, onConfirm });
    const closeModal = () => setModal({ ...modal, isOpen: false });

    // ==========================================
    // 5. MOTORES GENÉRICOS DE CRUD
    // ==========================================
    const handleSalvarGenerico = async (tabela, payload, listaAtual, setLista) => {
        setIsSubmitting(true);
        try {
            if (editandoId) {
                const { data, error } = await supabase.from(tabela).update(payload).eq('id', editandoId).select();
                if (error) throw error;
                if (data) setLista(listaAtual.map(item => item.id === editandoId ? data[0] : item));
            } else {
                const { data, error } = await supabase.from(tabela).insert([payload]).select();
                if (error) throw error;
                if (data) setLista([...listaAtual, data[0]]);
            }
            cancelarEdicao();
            mostrarSucesso();
        } catch (error) {
            setErroBanco(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const executarDelecao = async (tabela, id, listaAtual, setLista) => {
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from(tabela).delete().eq('id', id);
            if (error) throw error;
            setLista(listaAtual.filter(item => item.id !== id));
        } catch (error) {
            setErroBanco(error.message);
        } finally {
            setIsSubmitting(false);
            closeModal();
        }
    };

    const handleDeleteGenerico = (tabela, id, listaAtual, setLista, msgConfirm) => {
        showConfirm('Confirmar Exclusão', msgConfirm, () => executarDelecao(tabela, id, listaAtual, setLista));
    };

    // ==========================================
    // 6. WRAPPERS DOS FORMULÁRIOS
    // ==========================================
    const wrapperSalvarColaborador = (e) => {
        e.preventDefault();
        const nomeFormatado = nomeColaborador.trim().toUpperCase();
        
        if (!nomeFormatado || !cargoColaborador.trim() || !podeEditarEquipe) return;
        if (cpfColaborador.length !== 14) return showAlert("Atenção", "Preencha o CPF corretamente.");
        if (telefoneColaborador.length < 14) return showAlert("Atenção", "Preencha o Telefone/WhatsApp corretamente.");
        
        if (tipoContaColaborador === 'INTER' && !contaColaborador.trim()) {
            return showAlert("Atenção", "Preencha o número da Conta do Banco Inter com dígito.");
        }

        const unidadeFinal = temVisaoGlobal ? unidadeColaborador : usuarioLogado?.unidade;
        if (!unidadeFinal) return showAlert("Atenção", "Por favor, selecione uma unidade válida.");

        const payload = { 
            nome: nomeFormatado, 
            cpf: cpfColaborador,
            telefone: telefoneColaborador,
            role: cargoColaborador.toUpperCase(), 
            unidade: unidadeFinal.toUpperCase(),
            tipo_conta: tipoContaColaborador,
            conta_inter: tipoContaColaborador === 'INTER' ? contaColaborador.trim() : null
        };

        handleSalvarGenerico('colaboradores', payload, colaboradores, setColaboradores);
    };

    const wrapperSalvarSetor = (e) => {
        e.preventDefault();
        const nomeFormatado = nomeSetor.trim().toUpperCase();
        if (!nomeFormatado || !ehAdmin) return;
        handleSalvarGenerico('setores', { nome: nomeFormatado }, listaSetores, setListaSetores);
    };

    const wrapperSalvarPlano = (e) => {
        e.preventDefault();
        const nomeFormatado = nomePlano.trim().toUpperCase();
        if (!nomeFormatado || !valorPlano || !ehAdmin) return;
        const jaExiste = planos.find(p => p.nome === nomeFormatado && p.id !== editandoId);
        if (jaExiste) return showAlert("Plano Duplicado", `O plano "${nomeFormatado}" já está cadastrado.`);
        handleSalvarGenerico('catalogo', { tipo: 'plano', nome: nomeFormatado, valor: parseFloat(valorPlano) }, planos, setPlanos);
    };

    const wrapperSalvarProduto = (e) => {
        e.preventDefault();
        const nomeFormatado = nomeProduto.trim().toUpperCase();
        if (!nomeFormatado || !valorProduto || !ehAdmin) return;
        const jaExiste = produtos.find(p => p.nome === nomeFormatado && p.id !== editandoId);
        if (jaExiste) return showAlert("Produto Duplicado", `O produto "${nomeFormatado}" já está cadastrado.`);
        handleSalvarGenerico('catalogo', { tipo: 'produto', nome: nomeFormatado, valor: parseFloat(valorProduto) }, produtos, setProdutos);
    };

    const wrapperSalvarServico = (e) => {
        e.preventDefault();
        const nomeFormatado = nomeServico.trim().toUpperCase();
        if (!nomeFormatado || !valorServico || !ehAdmin) return;
        const jaExiste = servicos.find(s => s.nome === nomeFormatado && s.id !== editandoId);
        if (jaExiste) return showAlert("Serviço Duplicado", `O serviço "${nomeFormatado}" já está cadastrado.`);
        handleSalvarGenerico('catalogo', { tipo: 'servico', nome: nomeFormatado, valor: parseFloat(valorServico) }, servicos, setServicos);
    };

    // ==========================================
    // 7. ORDENAÇÃO (A-Z) E PESQUISA
    // ==========================================
    const aplicarFiltroEOrdenacao = (lista) => {
        if (!lista) return [];
        let resultado = [...lista];
        
        if (termoBusca.trim() !== '') {
            const termo = termoBusca.toLowerCase();
            resultado = resultado.filter(item => item.nome?.toLowerCase().includes(termo));
        }
        return resultado.sort((a, b) => a.nome?.localeCompare(b.nome));
    };

    const colabFiltradosUnid = colaboradores.filter(c => filtroUnidadeLista === 'TODOS' || c.unidade?.toUpperCase() === filtroUnidadeLista.toUpperCase());

    const equipeExibicao = aplicarFiltroEOrdenacao(colabFiltradosUnid);
    const setoresExibicao = aplicarFiltroEOrdenacao(listaSetores);
    const planosExibicao = aplicarFiltroEOrdenacao(planos);
    const produtosExibicao = aplicarFiltroEOrdenacao(produtos);
    const servicosExibicao = aplicarFiltroEOrdenacao(servicos);

    // Variáveis auxiliares de estilização
    const inputClassBase = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none uppercase shadow-sm placeholder:normal-case placeholder:font-medium placeholder:text-slate-400";
    const labelClassBase = "block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1";

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] max-w-[1400px] mx-auto relative">
            
            {/* COMPONENTE MODAL CUSTOMIZADO */}
            {modal.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-[slideUp_0.2s_ease-out]">
                        <div className={`p-6 border-b ${modal.tipo === 'alert' ? 'bg-amber-50 border-amber-100' : 'bg-rose-50 border-rose-100'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-inner ${modal.tipo === 'alert' ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}`}>
                                    <i data-lucide={modal.tipo === 'alert' ? "alert-triangle" : "trash-2"} className="w-5 h-5"></i>
                                </div>
                                <h3 className="text-lg font-black text-slate-800 tracking-tight">{modal.titulo}</h3>
                            </div>
                        </div>
                        <div className="p-6 text-sm font-bold text-slate-600 leading-relaxed">
                            {modal.mensagem}
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3 justify-end">
                            {modal.tipo === 'confirm' && (
                                <button onClick={closeModal} disabled={isSubmitting} className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-200 transition-colors disabled:opacity-50">Cancelar</button>
                            )}
                            <button 
                                onClick={() => { modal.onConfirm ? modal.onConfirm() : closeModal(); if(modal.tipo === 'alert') closeModal(); }} 
                                disabled={isSubmitting}
                                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white shadow-md transition-all disabled:opacity-50 flex items-center gap-2 ${modal.tipo === 'alert' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-rose-500 hover:bg-rose-600'}`}
                            >
                                {isSubmitting ? <i data-lucide="loader-2" className="w-4 h-4 animate-spin"></i> : null}
                                {modal.tipo === 'confirm' ? 'Excluir' : 'Entendi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {sucesso && (
                <div className="absolute top-0 right-0 bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-[0_8px_20px_rgba(16,185,129,0.4)] flex items-center gap-3 font-black uppercase tracking-wider text-xs z-50">
                    <i data-lucide="check-circle-2" className="w-5 h-5"></i> Salvo com sucesso!
                </div>
            )}
            {erroBanco && (
                <div className="absolute top-0 right-0 bg-rose-500 text-white px-6 py-3 rounded-2xl shadow-lg flex items-center gap-3 font-black uppercase tracking-wider text-xs z-50">
                    <i data-lucide="alert-triangle" className="w-5 h-5"></i> Erro: {erroBanco}
                </div>
            )}

            {/* CABEÇALHO */}
            <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 p-6 md:p-8 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner border border-blue-100 flex-shrink-0">
                        <i data-lucide="database" className="w-7 h-7"></i>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Gestão de Cadastros</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configuração Geral do Sistema</p>
                    </div>
                </div>

                <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full xl:w-auto overflow-x-auto custom-scrollbar">
                    <button onClick={() => changeTab('equipe')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${abaAtiva === 'equipe' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        <i data-lucide="users" className="w-4 h-4"></i> Equipe
                    </button>
                    <button onClick={() => changeTab('setores')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${abaAtiva === 'setores' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        <i data-lucide="layout-grid" className="w-4 h-4"></i> Setores
                    </button>
                    <button onClick={() => changeTab('planos')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${abaAtiva === 'planos' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        <i data-lucide="bookmark" className="w-4 h-4"></i> Planos
                    </button>
                    <button onClick={() => changeTab('produtos')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${abaAtiva === 'produtos' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        <i data-lucide="package" className="w-4 h-4"></i> Produtos
                    </button>
                    <button onClick={() => changeTab('servicos')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${abaAtiva === 'servicos' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        <i data-lucide="briefcase" className="w-4 h-4"></i> Serviços
                    </button>
                </div>
            </div>

            <div className={`grid grid-cols-1 ${mostraFormulario ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} gap-6 items-start transition-all`}>
                
                {/* LADO ESQUERDO: FORMULÁRIOS */}
                {mostraFormulario && (
                    <div className="lg:col-span-1 bg-white rounded-[24px] shadow-sm border border-slate-200 p-6 md:p-8 relative overflow-hidden animate-[fadeIn_0.3s_ease-out]">
                        {editandoId && <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-400"></div>}

                        {/* FORM: EQUIPE - REFATORADO */}
                        {abaAtiva === 'equipe' && podeEditarEquipe && (
                            <form onSubmit={wrapperSalvarColaborador} className="space-y-5 animate-[fadeIn_0.3s_ease-out]">
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                                    <i data-lucide={editandoId ? "edit-3" : "user-plus"} className={`w-5 h-5 ${editandoId ? 'text-amber-500' : 'text-blue-500'}`}></i> 
                                    {editandoId ? 'Editar Colaborador' : 'Novo Colaborador'}
                                </h3>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* DADOS BÁSICOS */}
                                    <div className="sm:col-span-2">
                                        <label className={labelClassBase}>Nome Completo</label>
                                        <input type="text" value={nomeColaborador} onChange={(e) => setNomeColaborador(e.target.value)} required placeholder="Ex: Lucas Mendes" className={inputClassBase} />
                                    </div>
                                    
                                    <div>
                                        <label className={labelClassBase}>CPF</label>
                                        <input type="text" value={cpfColaborador} onChange={handleCpfChange} required placeholder="000.000.000-00" className={inputClassBase} />
                                    </div>

                                    <div>
                                        <label className={labelClassBase}>WhatsApp</label>
                                        <input type="text" value={telefoneColaborador} onChange={handlePhoneChange} required placeholder="(00) 00000-0000" className={inputClassBase} />
                                    </div>

                                    {/* DADOS OPERACIONAIS */}
                                    <div className={temVisaoGlobal ? "sm:col-span-1" : "sm:col-span-2"}>
                                        <label className={labelClassBase}>Setor / Cargo</label>
                                        <select value={cargoColaborador} onChange={(e) => setCargoColaborador(e.target.value)} required className={`${inputClassBase} cursor-pointer`}>
                                            <option value="" className="text-slate-400">Selecione...</option>
                                            {listaSetores.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                                        </select>
                                    </div>

                                    {temVisaoGlobal && (
                                        <div className="sm:col-span-1">
                                            <label className="block text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1.5 ml-1">Unidade Vínculo</label>
                                            <select value={unidadeColaborador} onChange={(e) => setUnidadeColaborador(e.target.value)} required className="w-full bg-rose-50/10 border border-rose-200 rounded-xl px-4 py-3 text-sm font-black text-rose-700 focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer uppercase shadow-sm">
                                                <option value="" className="text-rose-300">Selecione...</option>
                                                {unidades.map(u => <option key={u.id} value={u.nome}>{u.nome}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    {/* FORMA DE RECEBIMENTO */}
                                    <div className="sm:col-span-2 border-t border-slate-100 pt-4 mt-2">
                                        <label className={labelClassBase}>Conta de Recebimento (Comissões)</label>
                                        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 mt-2 shadow-inner">
                                            <button 
                                                type="button" 
                                                onClick={() => { setTipoContaColaborador('INTER'); }} 
                                                className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoContaColaborador === 'INTER' ? 'bg-white shadow-sm text-orange-600 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
                                            >
                                                Banco Inter
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={() => { setTipoContaColaborador('PIX_CPF'); setContaColaborador(''); }} 
                                                className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoContaColaborador === 'PIX_CPF' ? 'bg-white shadow-sm text-emerald-600 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
                                            >
                                                PIX (Chave CPF)
                                            </button>
                                        </div>
                                        
                                        {/* Input Auto-formatado para Banco Inter */}
                                        {tipoContaColaborador === 'INTER' && (
                                            <div className="mt-3 bg-orange-50 border border-orange-100 p-4 rounded-xl flex flex-col gap-3 animate-[fadeIn_0.2s_ease-out]">
                                                <div className="flex items-start gap-2">
                                                    <i data-lucide="building" className="w-4 h-4 text-orange-500 shrink-0 mt-0.5"></i>
                                                    <div>
                                                        <p className="text-[10px] font-black text-orange-800 uppercase tracking-wide">Transferência Direta (Inter)</p>
                                                        <p className="text-[10px] font-semibold text-orange-600 leading-tight mt-0.5">O colaborador deve possuir conta no Banco Inter associada ao CPF informado.</p>
                                                    </div>
                                                </div>
                                                <div className="mt-1">
                                                    <label className="block text-[10px] font-black text-orange-700 uppercase tracking-widest mb-1.5 ml-1">Número da Conta com Dígito *</label>
                                                    <input 
                                                        type="text" 
                                                        value={contaColaborador} 
                                                        onChange={handleContaInterChange} 
                                                        required 
                                                        placeholder="Ex: 1234567-8" 
                                                        className="w-full bg-white border border-orange-200 rounded-lg px-3 py-2.5 text-xs font-bold text-orange-900 focus:ring-2 focus:ring-orange-500 outline-none shadow-sm placeholder:text-orange-300"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {tipoContaColaborador === 'PIX_CPF' && (
                                            <div className="mt-3 bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-start gap-2 animate-[fadeIn_0.2s_ease-out]">
                                                <i data-lucide="info" className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5"></i>
                                                <div>
                                                    <p className="text-[10px] font-black text-emerald-800 uppercase tracking-wide">Chave PIX Travada</p>
                                                    <p className="text-[10px] font-semibold text-emerald-600 leading-tight mt-0.5">A chave será estritamente o CPF digitado: <strong className="font-mono text-emerald-900">{cpfColaborador || 'Preencha o CPF acima'}</strong></p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-2">
                                    {editandoId && <button type="button" onClick={cancelarEdicao} disabled={isSubmitting} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black uppercase tracking-widest py-3.5 px-4 rounded-xl transition-all text-xs disabled:opacity-50">Cancelar</button>}
                                    <button type="submit" disabled={isSubmitting} className={`flex-[2] text-white font-black uppercase tracking-widest py-3.5 px-4 rounded-xl shadow-[0_4px_15px_rgba(37,99,235,0.3)] transition-all flex justify-center items-center gap-2 text-xs disabled:opacity-50 ${editandoId ? 'bg-amber-500 hover:bg-amber-600 shadow-[0_4px_15px_rgba(245,158,11,0.3)]' : 'bg-blue-600 hover:bg-blue-700'}`}>
                                        {isSubmitting ? <i data-lucide="loader-2" className="w-4 h-4 animate-spin"></i> : <i data-lucide="check" className="w-4 h-4"></i>} 
                                        {editandoId ? 'Atualizar Dados' : 'Salvar Colaborador'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* OUTROS FORMS (Setores, Planos, Produtos, Serviços) */}
                        {abaAtiva === 'setores' && ehAdmin && (
                            <form onSubmit={wrapperSalvarSetor} className="space-y-5 animate-[fadeIn_0.3s_ease-out]">
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                                    <i data-lucide={editandoId ? "edit-3" : "layout-grid"} className={`w-5 h-5 ${editandoId ? 'text-amber-500' : 'text-blue-500'}`}></i> 
                                    {editandoId ? 'Editar Setor' : 'Criar Setor/Cargo'}
                                </h3>
                                <div>
                                    <label className={labelClassBase}>Nome do Setor</label>
                                    <input type="text" value={nomeSetor} onChange={(e) => setNomeSetor(e.target.value)} required placeholder="Ex: ATENDIMENTO ONLINE" className={inputClassBase} />
                                </div>
                                <div className="pt-2 flex gap-2">
                                    {editandoId && <button type="button" onClick={cancelarEdicao} disabled={isSubmitting} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black uppercase tracking-widest py-3.5 px-4 rounded-xl transition-all text-xs disabled:opacity-50">Cancelar</button>}
                                    <button type="submit" disabled={isSubmitting} className={`flex-[2] text-white font-black uppercase tracking-widest py-3.5 px-4 rounded-xl shadow-md transition-all flex justify-center items-center gap-2 text-xs disabled:opacity-50 ${editandoId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                                        {isSubmitting ? <i data-lucide="loader-2" className="w-4 h-4 animate-spin"></i> : <i data-lucide="check" className="w-4 h-4"></i>} 
                                        {editandoId ? 'Atualizar' : 'Salvar Setor'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {abaAtiva === 'planos' && ehAdmin && (
                            <form onSubmit={wrapperSalvarPlano} className="space-y-5 animate-[fadeIn_0.3s_ease-out]">
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                                    <i data-lucide={editandoId ? "edit-3" : "bookmark"} className={`w-5 h-5 ${editandoId ? 'text-amber-500' : 'text-blue-500'}`}></i> 
                                    {editandoId ? 'Editar Plano' : 'Novo Plano'}
                                </h3>
                                <div>
                                    <label className={labelClassBase}>Nome do Plano</label>
                                    <input type="text" value={nomePlano} onChange={(e) => setNomePlano(e.target.value)} required placeholder="Ex: PLANO VIP ANUAL" className={inputClassBase} />
                                </div>
                                <div>
                                    <label className={labelClassBase}>Valor Limpo (R$)</label>
                                    <input type="number" step="0.01" min="0" value={valorPlano} onChange={(e) => setValorPlano(e.target.value)} required placeholder="Ex: 119.90" className={inputClassBase} />
                                </div>
                                <div className="pt-2 flex gap-2">
                                    {editandoId && <button type="button" onClick={cancelarEdicao} disabled={isSubmitting} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black uppercase tracking-widest py-3.5 px-4 rounded-xl transition-all text-xs disabled:opacity-50">Cancelar</button>}
                                    <button type="submit" disabled={isSubmitting} className={`flex-[2] text-white font-black uppercase tracking-widest py-3.5 px-4 rounded-xl shadow-md transition-all flex justify-center items-center gap-2 text-xs disabled:opacity-50 ${editandoId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                                        {isSubmitting ? <i data-lucide="loader-2" className="w-4 h-4 animate-spin"></i> : <i data-lucide="check" className="w-4 h-4"></i>} 
                                        {editandoId ? 'Atualizar' : 'Salvar Plano'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {abaAtiva === 'produtos' && ehAdmin && (
                            <form onSubmit={wrapperSalvarProduto} className="space-y-5 animate-[fadeIn_0.3s_ease-out]">
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                                    <i data-lucide={editandoId ? "edit-3" : "package"} className={`w-5 h-5 ${editandoId ? 'text-amber-500' : 'text-emerald-500'}`}></i> 
                                    {editandoId ? 'Editar Produto' : 'Novo Produto'}
                                </h3>
                                <div>
                                    <label className={labelClassBase}>Nome do Produto</label>
                                    <input type="text" value={nomeProduto} onChange={(e) => setNomeProduto(e.target.value)} required placeholder="Ex: WHEY PROTEIN" className={inputClassBase} />
                                </div>
                                <div>
                                    <label className={labelClassBase}>Valor Limpo (R$)</label>
                                    <input type="number" step="0.01" min="0" value={valorProduto} onChange={(e) => setValorProduto(e.target.value)} required placeholder="Ex: 89.90" className={inputClassBase} />
                                </div>
                                <div className="pt-2 flex gap-2">
                                    {editandoId && <button type="button" onClick={cancelarEdicao} disabled={isSubmitting} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black uppercase tracking-widest py-3.5 px-4 rounded-xl transition-all text-xs disabled:opacity-50">Cancelar</button>}
                                    <button type="submit" disabled={isSubmitting} className={`flex-[2] text-white font-black uppercase tracking-widest py-3.5 px-4 rounded-xl shadow-md transition-all flex justify-center items-center gap-2 text-xs disabled:opacity-50 ${editandoId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
                                        {isSubmitting ? <i data-lucide="loader-2" className="w-4 h-4 animate-spin"></i> : <i data-lucide="check" className="w-4 h-4"></i>} 
                                        {editandoId ? 'Atualizar' : 'Salvar Produto'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {abaAtiva === 'servicos' && ehAdmin && (
                            <form onSubmit={wrapperSalvarServico} className="space-y-5 animate-[fadeIn_0.3s_ease-out]">
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                                    <i data-lucide={editandoId ? "edit-3" : "briefcase"} className={`w-5 h-5 ${editandoId ? 'text-amber-500' : 'text-violet-500'}`}></i> 
                                    {editandoId ? 'Editar Serviço' : 'Novo Serviço'}
                                </h3>
                                <div>
                                    <label className={labelClassBase}>Nome do Serviço</label>
                                    <input type="text" value={nomeServico} onChange={(e) => setNomeServico(e.target.value)} required placeholder="Ex: DIÁRIA / AVALIAÇÃO" className={inputClassBase} />
                                </div>
                                <div>
                                    <label className={labelClassBase}>Valor Limpo (R$)</label>
                                    <input type="number" step="0.01" min="0" value={valorServico} onChange={(e) => setValorServico(e.target.value)} required placeholder="Ex: 30.00" className={inputClassBase} />
                                </div>
                                <div className="pt-2 flex gap-2">
                                    {editandoId && <button type="button" onClick={cancelarEdicao} disabled={isSubmitting} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black uppercase tracking-widest py-3.5 px-4 rounded-xl transition-all text-xs disabled:opacity-50">Cancelar</button>}
                                    <button type="submit" disabled={isSubmitting} className={`flex-[2] text-white font-black uppercase tracking-widest py-3.5 px-4 rounded-xl shadow-md transition-all flex justify-center items-center gap-2 text-xs disabled:opacity-50 ${editandoId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-violet-600 hover:bg-violet-700'}`}>
                                        {isSubmitting ? <i data-lucide="loader-2" className="w-4 h-4 animate-spin"></i> : <i data-lucide="check" className="w-4 h-4"></i>} 
                                        {editandoId ? 'Atualizar' : 'Salvar Serviço'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                )}

                {/* LADO DIREITO: LISTAS COM FILTRO GERAL E ORDENAÇÃO A-Z */}
                <div className={`${mostraFormulario ? 'lg:col-span-2' : 'lg:col-span-1'} bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[650px] transition-all`}>
                    
                    {/* Header Inteligente */}
                    <div className="p-6 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 min-w-max">
                            <i data-lucide="list" className="w-4 h-4 text-slate-400"></i> Registros A-Z
                        </h3>

                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                            <div className="relative w-full sm:w-56 animate-[fadeIn_0.2s_ease-out]">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <i data-lucide="search" className="w-4 h-4 text-slate-400"></i>
                                </div>
                                <input 
                                    type="text" 
                                    placeholder={`Pesquisar ${abaAtiva}...`}
                                    value={termoBusca}
                                    onChange={(e) => setTermoBusca(e.target.value)}
                                    className="w-full bg-white border border-slate-200 text-slate-700 rounded-xl pl-10 pr-3 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm uppercase placeholder:normal-case"
                                />
                            </div>

                            {abaAtiva === 'equipe' && temVisaoGlobal && (
                                <div className="w-full sm:w-48 animate-[fadeIn_0.2s_ease-out]">
                                    <select 
                                        value={filtroUnidadeLista} 
                                        onChange={(e) => setFiltroUnidadeLista(e.target.value)} 
                                        className="w-full bg-white border border-rose-200 text-rose-700 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wider outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer shadow-sm"
                                    >
                                        <option value="TODOS">Filtrar: TODAS</option>
                                        {unidades.map(u => <option key={u.id || u.nome} value={u.nome}>{u.nome}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="overflow-y-auto custom-scrollbar flex-1 p-2">
                        <table className="w-full text-left border-collapse">
                            
                            {/* TABELA EQUIPE (COM VISUALIZAÇÃO DE DADOS OPERACIONAIS) */}
                            {abaAtiva === 'equipe' && (
                                <>
                                    <thead className="bg-white sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Colaborador</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Contato & Documento</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Dados de Recebimento</th>
                                            {podeEditarEquipe && <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-right">Ações</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {equipeExibicao.map(c => (
                                            <tr key={c.id} className="hover:bg-slate-50 group transition-colors border-b border-slate-50">
                                                {/* COLUNA 1: Avatar, Nome, Unidade */}
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-black shrink-0">{c.nome.charAt(0)}</div>
                                                        <div>
                                                            <p className="text-sm font-black text-slate-800 uppercase">{c.nome}</p>
                                                            <p className="text-[10px] font-black text-slate-400 uppercase mt-0.5">{c.role}</p>
                                                            {temVisaoGlobal && (
                                                                <p className="text-[9px] font-bold text-rose-500 uppercase tracking-wider mt-1 flex items-center gap-1">
                                                                    <i data-lucide="map-pin" className="w-3 h-3"></i> {c.unidade || 'MATRIZ'}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                {/* COLUNA 2: Telefone e CPF visíveis */}
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1.5">
                                                        <p className="text-xs font-bold text-slate-600 flex items-center gap-2">
                                                            <i data-lucide="phone" className="w-3.5 h-3.5 text-slate-400"></i> {c.telefone || 'Sem contato'}
                                                        </p>
                                                        <p className="text-[10px] font-bold text-slate-500 flex items-center gap-2 tracking-wider">
                                                            <i data-lucide="credit-card" className="w-3.5 h-3.5 text-slate-400"></i> {c.cpf || 'Sem CPF'}
                                                        </p>
                                                    </div>
                                                </td>
                                                {/* COLUNA 3: Recebimento (Inter ou PIX) */}
                                                <td className="px-6 py-4">
                                                    {c.tipo_conta === 'PIX_CPF' ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black uppercase tracking-widest shadow-sm">
                                                            <i data-lucide="zap" className="w-3.5 h-3.5"></i> PIX (CPF)
                                                        </span>
                                                    ) : c.tipo_conta === 'INTER' ? (
                                                        <div className="flex flex-col gap-1.5">
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 w-fit rounded-lg bg-orange-50 text-orange-700 border border-orange-200 text-[9px] font-black uppercase tracking-widest shadow-sm">
                                                                <i data-lucide="building" className="w-3.5 h-3.5"></i> Banco Inter
                                                            </span>
                                                            <span className="text-[10px] font-bold text-slate-600 flex items-center gap-1.5">
                                                                <i data-lucide="corner-down-right" className="w-3 h-3 text-slate-400"></i> Conta: {c.conta_inter || 'Não informada'}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Não Definido</span>
                                                    )}
                                                </td>
                                                {/* COLUNA 4: Ações */}
                                                {podeEditarEquipe && (
                                                    <td className="px-6 py-4 text-right align-middle">
                                                        <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button 
                                                                type="button" 
                                                                disabled={isSubmitting}
                                                                onClick={() => { 
                                                                    setEditandoId(c.id); 
                                                                    setNomeColaborador(c.nome); 
                                                                    setCargoColaborador(c.role); 
                                                                    setUnidadeColaborador(c.unidade || ''); 
                                                                    setCpfColaborador(c.cpf || '');
                                                                    setTelefoneColaborador(c.telefone || '');
                                                                    setTipoContaColaborador(c.tipo_conta || 'INTER');
                                                                    setContaColaborador(c.conta_inter || ''); 
                                                                }} 
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 border border-blue-100"
                                                            >
                                                                <i data-lucide="edit-3" className="w-3.5 h-3.5"></i> Editar
                                                            </button>
                                                            <button 
                                                                type="button" 
                                                                disabled={isSubmitting}
                                                                onClick={() => handleDeleteGenerico('colaboradores', c.id, colaboradores, setColaboradores, `Excluir definitivamente o colaborador ${c.nome}?`)} 
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 border border-rose-100"
                                                            >
                                                                <i data-lucide="trash-2" className="w-3.5 h-3.5"></i> Excluir
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                        {equipeExibicao.length === 0 && (
                                            <tr>
                                                <td colSpan="4" className="text-center py-16 text-slate-400 uppercase tracking-widest text-[10px] font-bold opacity-60">
                                                    Nenhum colaborador encontrado.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </>
                            )}

                            {/* DEMAIS TABELAS: SETORES, PLANOS, PRODUTOS E SERVIÇOS (MANTIDAS INTACTAS) */}
                            {abaAtiva === 'setores' && (
                                <tbody className="divide-y divide-slate-50">
                                    {setoresExibicao.map(s => (
                                        <tr key={s.id} className="hover:bg-slate-50 group transition-colors border-b border-slate-50">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <i data-lucide="layout-grid" className="w-5 h-5 text-indigo-400"></i>
                                                    <span className="text-sm font-black text-slate-800 uppercase">{s.nome}</span>
                                                </div>
                                            </td>
                                            {ehAdmin && (
                                                <td className="px-6 py-4 text-right align-middle">
                                                    <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button type="button" disabled={isSubmitting} onClick={() => { setEditandoId(s.id); setNomeSetor(s.nome); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50">
                                                            <i data-lucide="edit-3" className="w-3.5 h-3.5"></i> Editar
                                                        </button>
                                                        <button type="button" disabled={isSubmitting} onClick={() => handleDeleteGenerico('setores', s.id, listaSetores, setListaSetores, `Excluir o setor ${s.nome}?`)} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50">
                                                            <i data-lucide="trash-2" className="w-3.5 h-3.5"></i> Excluir
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                    {setoresExibicao.length === 0 && <tr><td colSpan="2" className="text-center py-16 text-slate-400 uppercase tracking-widest text-[10px] font-bold opacity-60">Nenhum setor encontrado.</td></tr>}
                                </tbody>
                            )}

                            {abaAtiva === 'planos' && (
                                <tbody className="divide-y divide-slate-50">
                                    {planosExibicao.map(p => (
                                        <tr key={p.id} className="hover:bg-slate-50 group transition-colors border-b border-slate-50">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <i data-lucide="bookmark" className="w-5 h-5 text-blue-400"></i>
                                                    <span className="text-sm font-black text-slate-800 uppercase block">{p.nome}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-black text-emerald-600 text-right">{formatMoney(p.valor)}</td>
                                            {ehAdmin && (
                                                <td className="px-6 py-4 text-right align-middle">
                                                    <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button type="button" disabled={isSubmitting} onClick={() => { setEditandoId(p.id); setNomePlano(p.nome); setValorPlano(p.valor); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50">
                                                            <i data-lucide="edit-3" className="w-3.5 h-3.5"></i> Editar
                                                        </button>
                                                        <button type="button" disabled={isSubmitting} onClick={() => handleDeleteGenerico('catalogo', p.id, planos, setPlanos, `Excluir o plano ${p.nome}?`)} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50">
                                                            <i data-lucide="trash-2" className="w-3.5 h-3.5"></i> Excluir
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                    {planosExibicao.length === 0 && <tr><td colSpan="3" className="text-center py-16 text-slate-400 uppercase tracking-widest text-[10px] font-bold opacity-60">Nenhum plano encontrado.</td></tr>}
                                </tbody>
                            )}

                            {abaAtiva === 'produtos' && (
                                <tbody className="divide-y divide-slate-50">
                                    {produtosExibicao.map(p => (
                                        <tr key={p.id} className="hover:bg-slate-50 group transition-colors border-b border-slate-50">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <i data-lucide="package" className="w-5 h-5 text-emerald-500"></i>
                                                    <span className="text-sm font-black text-slate-800 uppercase block">{p.nome}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-black text-emerald-600 text-right">{formatMoney(p.valor)}</td>
                                            {ehAdmin && (
                                                <td className="px-6 py-4 text-right align-middle">
                                                    <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button type="button" disabled={isSubmitting} onClick={() => { setEditandoId(p.id); setNomeProduto(p.nome); setValorProduto(p.valor); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50">
                                                            <i data-lucide="edit-3" className="w-3.5 h-3.5"></i> Editar
                                                        </button>
                                                        <button type="button" disabled={isSubmitting} onClick={() => handleDeleteGenerico('catalogo', p.id, produtos, setProdutos, `Excluir o produto ${p.nome}?`)} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50">
                                                            <i data-lucide="trash-2" className="w-3.5 h-3.5"></i> Excluir
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                    {produtosExibicao.length === 0 && <tr><td colSpan="3" className="text-center py-16 text-slate-400 uppercase tracking-widest text-[10px] font-bold opacity-60">Nenhum produto encontrado.</td></tr>}
                                </tbody>
                            )}

                            {abaAtiva === 'servicos' && (
                                <tbody className="divide-y divide-slate-50">
                                    {servicosExibicao.map(s => (
                                        <tr key={s.id} className="hover:bg-slate-50 group transition-colors border-b border-slate-50">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <i data-lucide="briefcase" className="w-5 h-5 text-violet-500"></i>
                                                    <span className="text-sm font-black text-slate-800 uppercase block">{s.nome}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-black text-emerald-600 text-right">{formatMoney(s.valor)}</td>
                                            {ehAdmin && (
                                                <td className="px-6 py-4 text-right align-middle">
                                                    <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button type="button" disabled={isSubmitting} onClick={() => { setEditandoId(s.id); setNomeServico(s.nome); setValorServico(s.valor); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50">
                                                            <i data-lucide="edit-3" className="w-3.5 h-3.5"></i> Editar
                                                        </button>
                                                        <button type="button" disabled={isSubmitting} onClick={() => handleDeleteGenerico('catalogo', s.id, servicos, setServicos, `Excluir o serviço ${s.nome}?`)} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50">
                                                            <i data-lucide="trash-2" className="w-3.5 h-3.5"></i> Excluir
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                    {servicosExibicao.length === 0 && <tr><td colSpan="3" className="text-center py-16 text-slate-400 uppercase tracking-widest text-[10px] font-bold opacity-60">Nenhum serviço encontrado.</td></tr>}
                                </tbody>
                            )}

                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default CadastroGeral;