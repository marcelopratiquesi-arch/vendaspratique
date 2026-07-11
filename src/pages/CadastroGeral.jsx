import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js';

const CadastroGeral = ({ planos, setPlanos, produtos, setProdutos, colaboradores, setColaboradores }) => {
    // ==========================================
    // ESTADOS GLOBAIS
    // ==========================================
    const [abaAtiva, setAbaAtiva] = useState('equipe'); // 'equipe', 'setores', 'planos', 'produtos'
    const [sucesso, setSucesso] = useState(false);
    const [erroBando, setErroBanco] = useState('');
    const [editandoId, setEditandoId] = useState(null);

    // Estados de Setores (Puxados do banco de dados na hora)
    const [listaSetores, setListaSetores] = useState([]);
    const [nomeSetor, setNomeSetor] = useState('');

    // Estados dos outros formulários
    const [nomeColaborador, setNomeColaborador] = useState('');
    const [cargoColaborador, setCargoColaborador] = useState('');
    const [nomePlano, setNomePlano] = useState('');
    const [valorPlano, setValorPlano] = useState('');
    const [nomeProduto, setNomeProduto] = useState('');
    const [valorProduto, setValorProduto] = useState('');

    // Carregar setores assim que a página abre
    useEffect(() => {
        const fetchSetores = async () => {
            const { data } = await supabase.from('setores').select('*');
            if (data) setListaSetores(data);
        };
        fetchSetores();
    }, []);

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [abaAtiva, planos, produtos, colaboradores, listaSetores, sucesso, erroBando, editandoId]);

    const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    
    const mostrarSucesso = () => {
        setSucesso(true); setErroBanco('');
        setTimeout(() => setSucesso(false), 3000);
    };

    const cancelarEdicao = () => {
        setEditandoId(null);
        setNomeColaborador(''); setCargoColaborador('');
        setNomeSetor('');
        setNomePlano(''); setValorPlano('');
        setNomeProduto(''); setValorProduto('');
    };

    const changeTab = (tab) => {
        setAbaAtiva(tab);
        cancelarEdicao();
        setErroBanco('');
    };

    // ==========================================
    // FUNÇÕES DE CRUD (AGORA COM TRATAMENTO DE ERRO)
    // ==========================================
    
    // --- SETORES ---
    const handleSalvarSetor = async (e) => {
        e.preventDefault();
        if (!nomeSetor.trim()) return;
        
        const payload = { nome: nomeSetor.toUpperCase() };

        if (editandoId) {
            const { data, error } = await supabase.from('setores').update(payload).eq('id', editandoId).select();
            if (error) return setErroBanco(error.message);
            if (data) setListaSetores(listaSetores.map(s => s.id === editandoId ? data[0] : s));
        } else {
            const { data, error } = await supabase.from('setores').insert([payload]).select();
            if (error) return setErroBanco(error.message);
            if (data) setListaSetores([...listaSetores, data[0]]);
        }
        cancelarEdicao(); mostrarSucesso();
    };

    const handleDeleteSetor = async (id) => {
        if(window.confirm('Tem certeza que deseja excluir este setor?')) {
            const { error } = await supabase.from('setores').delete().eq('id', id);
            if (error) return setErroBanco(error.message);
            setListaSetores(listaSetores.filter(s => s.id !== id));
        }
    };

    // --- COLABORADORES ---
    const handleSalvarColaborador = async (e) => {
        e.preventDefault();
        if (!nomeColaborador.trim() || !cargoColaborador.trim()) return;
        
        const payload = { nome: nomeColaborador.toUpperCase(), role: cargoColaborador.toUpperCase() };

        if (editandoId) {
            const { data, error } = await supabase.from('colaboradores').update(payload).eq('id', editandoId).select();
            if (error) return setErroBanco(error.message);
            if (data) setColaboradores(colaboradores.map(c => c.id === editandoId ? data[0] : c));
        } else {
            const { data, error } = await supabase.from('colaboradores').insert([payload]).select();
            if (error) return setErroBanco(error.message);
            if (data) setColaboradores([...colaboradores, data[0]]);
        }
        cancelarEdicao(); mostrarSucesso();
    };

    const handleDeleteColaborador = async (id) => {
        if(window.confirm('Excluir este colaborador da equipe?')) {
            const { error } = await supabase.from('colaboradores').delete().eq('id', id);
            if (error) return setErroBanco(error.message);
            setColaboradores(colaboradores.filter(c => c.id !== id));
        }
    };

    // --- PLANOS ---
    const handleSalvarPlano = async (e) => {
        e.preventDefault();
        if (!nomePlano.trim() || !valorPlano) return;
        const payload = { tipo: 'plano', nome: nomePlano.toUpperCase(), valor: parseFloat(valorPlano) };

        if (editandoId) {
            const { data, error } = await supabase.from('catalogo').update(payload).eq('id', editandoId).select();
            if (error) return setErroBanco(error.message);
            if (data) setPlanos(planos.map(p => p.id === editandoId ? data[0] : p));
        } else {
            const { data, error } = await supabase.from('catalogo').insert([payload]).select();
            if (error) return setErroBanco(error.message);
            if (data) setPlanos([...planos, data[0]]);
        }
        cancelarEdicao(); mostrarSucesso();
    };

    const handleDeletePlano = async (id) => {
        if(window.confirm('Excluir este plano do catálogo?')) {
            const { error } = await supabase.from('catalogo').delete().eq('id', id);
            if (error) return setErroBanco(error.message);
            setPlanos(planos.filter(p => p.id !== id));
        }
    };

    // --- PRODUTOS ---
    const handleSalvarProduto = async (e) => {
        e.preventDefault();
        if (!nomeProduto.trim() || !valorProduto) return;
        const payload = { tipo: 'produto', nome: nomeProduto.toUpperCase(), valor: parseFloat(valorProduto) };

        if (editandoId) {
            const { data, error } = await supabase.from('catalogo').update(payload).eq('id', editandoId).select();
            if (error) return setErroBanco(error.message);
            if (data) setProdutos(produtos.map(p => p.id === editandoId ? data[0] : p));
        } else {
            const { data, error } = await supabase.from('catalogo').insert([payload]).select();
            if (error) return setErroBanco(error.message);
            if (data) setProdutos([...produtos, data[0]]);
        }
        cancelarEdicao(); mostrarSucesso();
    };

    const handleDeleteProduto = async (id) => {
        if(window.confirm('Excluir este produto do catálogo?')) {
            const { error } = await supabase.from('catalogo').delete().eq('id', id);
            if (error) return setErroBanco(error.message);
            setProdutos(produtos.filter(p => p.id !== id));
        }
    };

    // ==========================================
    // RENDERIZAÇÃO
    // ==========================================
    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] max-w-[1200px] mx-auto relative">
            
            {/* ALERTA DE SUCESSO OU ERRO NO BANCO */}
            {sucesso && (
                <div className="absolute top-0 right-0 bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-[0_8px_20px_rgba(16,185,129,0.4)] flex items-center gap-3 font-black uppercase tracking-wider text-xs z-50">
                    <i data-lucide="check-circle-2" className="w-5 h-5"></i> Cadastrado no Banco!
                </div>
            )}
            {erroBando && (
                <div className="absolute top-0 right-0 bg-rose-500 text-white px-6 py-3 rounded-2xl shadow-lg flex items-center gap-3 font-black uppercase tracking-wider text-xs z-50">
                    <i data-lucide="alert-triangle" className="w-5 h-5"></i> Erro Supabase: {erroBando}
                </div>
            )}

            {/* CABEÇALHO */}
            <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner border border-blue-100 flex-shrink-0">
                        <i data-lucide="database" className="w-7 h-7"></i>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Gestão de Cadastros</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configuração do Sistema</p>
                    </div>
                </div>

                <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full md:w-auto">
                    <button onClick={() => changeTab('equipe')} className={`flex-1 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${abaAtiva === 'equipe' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        <i data-lucide="users" className="w-4 h-4"></i> Equipe
                    </button>
                    <button onClick={() => changeTab('setores')} className={`flex-1 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${abaAtiva === 'setores' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        <i data-lucide="layout-grid" className="w-4 h-4"></i> Setores
                    </button>
                    <button onClick={() => changeTab('planos')} className={`flex-1 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${abaAtiva === 'planos' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        <i data-lucide="clipboard-check" className="w-4 h-4"></i> Planos
                    </button>
                    <button onClick={() => changeTab('produtos')} className={`flex-1 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${abaAtiva === 'produtos' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        <i data-lucide="package" className="w-4 h-4"></i> Produtos
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* LADO ESQUERDO: FORMULÁRIOS */}
                <div className="lg:col-span-1 bg-white rounded-[24px] shadow-sm border border-slate-200 p-6 md:p-8 relative overflow-hidden">
                    {editandoId && <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-400"></div>}

                    {/* FORM: EQUIPE */}
                    {abaAtiva === 'equipe' && (
                        <form onSubmit={handleSalvarColaborador} className="space-y-5 animate-[fadeIn_0.3s_ease-out]">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                                <i data-lucide={editandoId ? "edit-3" : "user-plus"} className={`w-5 h-5 ${editandoId ? 'text-amber-500' : 'text-blue-500'}`}></i> 
                                {editandoId ? 'Editar Colaborador' : 'Novo Colaborador'}
                            </h3>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Nome Completo</label>
                                <input type="text" value={nomeColaborador} onChange={(e) => setNomeColaborador(e.target.value)} required placeholder="Ex: Lucas Mendes" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none uppercase" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Setor / Cargo</label>
                                {/* AGORA PUXA DA TABELA DE SETORES */}
                                <select value={cargoColaborador} onChange={(e) => setCargoColaborador(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer uppercase">
                                    <option value="">Selecione um setor...</option>
                                    {listaSetores.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                                </select>
                            </div>
                            <div className="pt-2 flex gap-2">
                                {editandoId && <button type="button" onClick={cancelarEdicao} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black uppercase tracking-widest py-3.5 px-4 rounded-xl transition-all text-xs">Cancelar</button>}
                                <button type="submit" className={`flex-[2] text-white font-black uppercase tracking-widest py-3.5 px-4 rounded-xl shadow-md transition-all flex justify-center items-center gap-2 text-xs ${editandoId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                                    <i data-lucide="check" className="w-4 h-4"></i> {editandoId ? 'Atualizar' : 'Salvar'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* FORM: SETORES (NOVO) */}
                    {abaAtiva === 'setores' && (
                        <form onSubmit={handleSalvarSetor} className="space-y-5 animate-[fadeIn_0.3s_ease-out]">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                                <i data-lucide={editandoId ? "edit-3" : "layout-grid"} className={`w-5 h-5 ${editandoId ? 'text-amber-500' : 'text-blue-500'}`}></i> 
                                {editandoId ? 'Editar Setor' : 'Criar Setor/Cargo'}
                            </h3>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Nome do Setor</label>
                                <input type="text" value={nomeSetor} onChange={(e) => setNomeSetor(e.target.value)} required placeholder="Ex: ATENDIMENTO ONLINE" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none uppercase" />
                            </div>
                            <div className="pt-2 flex gap-2">
                                {editandoId && <button type="button" onClick={cancelarEdicao} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black uppercase tracking-widest py-3.5 px-4 rounded-xl transition-all text-xs">Cancelar</button>}
                                <button type="submit" className={`flex-[2] text-white font-black uppercase tracking-widest py-3.5 px-4 rounded-xl shadow-md transition-all flex justify-center items-center gap-2 text-xs ${editandoId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                                    <i data-lucide="check" className="w-4 h-4"></i> {editandoId ? 'Atualizar' : 'Salvar Setor'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* FORM: PLANOS */}
                    {abaAtiva === 'planos' && (
                        <form onSubmit={handleSalvarPlano} className="space-y-5 animate-[fadeIn_0.3s_ease-out]">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                                <i data-lucide={editandoId ? "edit-3" : "folder-plus"} className={`w-5 h-5 ${editandoId ? 'text-amber-500' : 'text-blue-500'}`}></i> 
                                {editandoId ? 'Editar Plano' : 'Novo Plano'}
                            </h3>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Nome do Plano</label>
                                <input type="text" value={nomePlano} onChange={(e) => setNomePlano(e.target.value)} required placeholder="Ex: PLANO VIP ANUAL" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none uppercase" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Valor (R$)</label>
                                <input type="number" step="0.01" min="0" value={valorPlano} onChange={(e) => setValorPlano(e.target.value)} required placeholder="Ex: 119.90" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div className="pt-2 flex gap-2">
                                {editandoId && <button type="button" onClick={cancelarEdicao} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black uppercase tracking-widest py-3.5 px-4 rounded-xl transition-all text-xs">Cancelar</button>}
                                <button type="submit" className={`flex-[2] text-white font-black uppercase tracking-widest py-3.5 px-4 rounded-xl shadow-md transition-all flex justify-center items-center gap-2 text-xs ${editandoId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                                    <i data-lucide="check" className="w-4 h-4"></i> {editandoId ? 'Atualizar' : 'Salvar Plano'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* FORM: PRODUTOS */}
                    {abaAtiva === 'produtos' && (
                        <form onSubmit={handleSalvarProduto} className="space-y-5 animate-[fadeIn_0.3s_ease-out]">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                                <i data-lucide={editandoId ? "edit-3" : "box"} className={`w-5 h-5 ${editandoId ? 'text-amber-500' : 'text-blue-500'}`}></i> 
                                {editandoId ? 'Editar Produto' : 'Novo Produto'}
                            </h3>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Nome do Produto</label>
                                <input type="text" value={nomeProduto} onChange={(e) => setNomeProduto(e.target.value)} required placeholder="Ex: WHEY PROTEIN" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none uppercase" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Valor Unitário (R$)</label>
                                <input type="number" step="0.01" min="0" value={valorProduto} onChange={(e) => setValorProduto(e.target.value)} required placeholder="Ex: 89.90" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div className="pt-2 flex gap-2">
                                {editandoId && <button type="button" onClick={cancelarEdicao} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black uppercase tracking-widest py-3.5 px-4 rounded-xl transition-all text-xs">Cancelar</button>}
                                <button type="submit" className={`flex-[2] text-white font-black uppercase tracking-widest py-3.5 px-4 rounded-xl shadow-md transition-all flex justify-center items-center gap-2 text-xs ${editandoId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
                                    <i data-lucide="check" className="w-4 h-4"></i> {editandoId ? 'Atualizar' : 'Salvar Produto'}
                                </button>
                            </div>
                        </form>
                    )}

                </div>

                {/* LADO DIREITO: LISTAS */}
                <div className="lg:col-span-2 bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[500px]">
                    <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                            <i data-lucide="list" className="w-4 h-4 text-slate-400"></i> Registros Salvos
                        </h3>
                    </div>

                    <div className="overflow-y-auto custom-scrollbar flex-1 p-2">
                        <table className="w-full text-left border-collapse">
                            
                            {/* TABELA EQUIPE */}
                            {abaAtiva === 'equipe' && (
                                <tbody className="divide-y divide-slate-50">
                                    {colaboradores.map(c => (
                                        <tr key={c.id} className="hover:bg-slate-50 group transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-black">{c.nome.charAt(0)}</div>
                                                    <div>
                                                        <p className="text-sm font-black text-slate-800 uppercase">{c.nome}</p>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase mt-0.5">{c.role}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2 md:opacity-0 md:group-hover:opacity-100">
                                                    <button onClick={() => { setEditandoId(c.id); setNomeColaborador(c.nome); setCargoColaborador(c.role); }} className="text-slate-400 hover:text-amber-500 p-2 bg-white border border-slate-200 rounded-lg shadow-sm"><i data-lucide="edit-2" className="w-4 h-4"></i></button>
                                                    <button onClick={() => handleDeleteColaborador(c.id)} className="text-slate-400 hover:text-rose-500 p-2 bg-white border border-slate-200 rounded-lg shadow-sm"><i data-lucide="trash-2" className="w-4 h-4"></i></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            )}

                            {/* TABELA SETORES */}
                            {abaAtiva === 'setores' && (
                                <tbody className="divide-y divide-slate-50">
                                    {listaSetores.map(s => (
                                        <tr key={s.id} className="hover:bg-slate-50 group transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <i data-lucide="layout-grid" className="w-5 h-5 text-indigo-400"></i>
                                                    <span className="text-sm font-black text-slate-800 uppercase">{s.nome}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2 md:opacity-0 md:group-hover:opacity-100">
                                                    <button onClick={() => { setEditandoId(s.id); setNomeSetor(s.nome); }} className="text-slate-400 hover:text-amber-500 p-2 bg-white border border-slate-200 rounded-lg shadow-sm"><i data-lucide="edit-2" className="w-4 h-4"></i></button>
                                                    <button onClick={() => handleDeleteSetor(s.id)} className="text-slate-400 hover:text-rose-500 p-2 bg-white border border-slate-200 rounded-lg shadow-sm"><i data-lucide="trash-2" className="w-4 h-4"></i></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            )}

                            {/* TABELA PLANOS */}
                            {abaAtiva === 'planos' && (
                                <tbody className="divide-y divide-slate-50">
                                    {planos.map(p => (
                                        <tr key={p.id} className="hover:bg-slate-50 group transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <i data-lucide="bookmark" className="w-5 h-5 text-blue-400"></i>
                                                    <span className="text-sm font-black text-slate-800 uppercase">{p.nome}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-black text-emerald-600 text-right">{formatMoney(p.valor)}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2 md:opacity-0 md:group-hover:opacity-100">
                                                    <button onClick={() => { setEditandoId(p.id); setNomePlano(p.nome); setValorPlano(p.valor); }} className="text-slate-400 hover:text-amber-500 p-2 bg-white border border-slate-200 rounded-lg shadow-sm"><i data-lucide="edit-2" className="w-4 h-4"></i></button>
                                                    <button onClick={() => handleDeletePlano(p.id)} className="text-slate-400 hover:text-rose-500 p-2 bg-white border border-slate-200 rounded-lg shadow-sm"><i data-lucide="trash-2" className="w-4 h-4"></i></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            )}

                            {/* TABELA PRODUTOS */}
                            {abaAtiva === 'produtos' && (
                                <tbody className="divide-y divide-slate-50">
                                    {produtos.map(p => (
                                        <tr key={p.id} className="hover:bg-slate-50 group transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <i data-lucide="package" className="w-5 h-5 text-emerald-500"></i>
                                                    <span className="text-sm font-black text-slate-800 uppercase">{p.nome}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-black text-emerald-600 text-right">{formatMoney(p.valor)}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2 md:opacity-0 md:group-hover:opacity-100">
                                                    <button onClick={() => { setEditandoId(p.id); setNomeProduto(p.nome); setValorProduto(p.valor); }} className="text-slate-400 hover:text-amber-500 p-2 bg-white border border-slate-200 rounded-lg shadow-sm"><i data-lucide="edit-2" className="w-4 h-4"></i></button>
                                                    <button onClick={() => handleDeleteProduto(p.id)} className="text-slate-400 hover:text-rose-500 p-2 bg-white border border-slate-200 rounded-lg shadow-sm"><i data-lucide="trash-2" className="w-4 h-4"></i></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
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