import React, { useState, useEffect } from 'react';

const CadastroGeral = ({ planos, setPlanos, produtos, setProdutos, colaboradores, setColaboradores }) => {
    // ==========================================
    // 1. ESTADOS DA PÁGINA E FORMULÁRIOS
    // ==========================================
    const [abaAtiva, setAbaAtiva] = useState('equipe'); // 'equipe', 'planos', 'produtos'
    const [sucesso, setSucesso] = useState(false);

    // Estados dos inputs de cadastro
    const [nomeColaborador, setNomeColaborador] = useState('');
    const [cargoColaborador, setCargoColaborador] = useState('RECEPCAO');

    const [nomePlano, setNomePlano] = useState('');
    const [valorPlano, setValorPlano] = useState('');

    const [nomeProduto, setNomeProduto] = useState('');
    const [valorProduto, setValorProduto] = useState('');

    // Atualiza os ícones quando as abas mudam
    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [abaAtiva, planos, produtos, colaboradores, sucesso]);

    // ==========================================
    // 2. FUNÇÕES AUXILIARES
    // ==========================================
    const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    
    const mostrarSucesso = () => {
        setSucesso(true);
        setTimeout(() => setSucesso(false), 3000);
    };

    // ==========================================
    // 3. FUNÇÕES DE CADASTRO (CRUD)
    // ==========================================
    
    // --- COLABORADORES (Apenas vitrine operacional) ---
    const handleAddColaborador = (e) => {
        e.preventDefault();
        if (!nomeColaborador.trim()) return;
        const novo = { id: Date.now(), nome: nomeColaborador.toUpperCase(), role: cargoColaborador };
        setColaboradores([...colaboradores, novo]);
        setNomeColaborador('');
        mostrarSucesso();
    };

    const handleDeleteColaborador = (id) => {
        if(window.confirm('Excluir este colaborador da equipe? (Isso o removerá das listas de vendas e CRM, mas não apaga o histórico financeiro antigo dele).')) {
            setColaboradores(colaboradores.filter(c => c.id !== id));
        }
    };

    // --- PLANOS ---
    const handleAddPlano = (e) => {
        e.preventDefault();
        if (!nomePlano.trim() || !valorPlano) return;
        const novo = { id: Date.now(), nome: nomePlano.toUpperCase(), valor: parseFloat(valorPlano) };
        setPlanos([...planos, novo]);
        setNomePlano('');
        setValorPlano('');
        mostrarSucesso();
    };

    const handleDeletePlano = (id) => {
        if(window.confirm('Excluir este plano do catálogo?')) {
            setPlanos(planos.filter(p => p.id !== id));
        }
    };

    // --- PRODUTOS ---
    const handleAddProduto = (e) => {
        e.preventDefault();
        if (!nomeProduto.trim() || !valorProduto) return;
        const novo = { id: Date.now(), nome: nomeProduto.toUpperCase(), valor: parseFloat(valorProduto) };
        setProdutos([...produtos, novo]);
        setNomeProduto('');
        setValorProduto('');
        mostrarSucesso();
    };

    const handleDeleteProduto = (id) => {
        if(window.confirm('Excluir este produto do catálogo?')) {
            setProdutos(produtos.filter(p => p.id !== id));
        }
    };

    // ==========================================
    // 4. RENDERIZAÇÃO
    // ==========================================
    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] max-w-[1000px] mx-auto relative">
            
            {/* ALERTA DE SUCESSO */}
            {sucesso && (
                <div className="absolute top-0 right-0 bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-[0_8px_20px_rgba(16,185,129,0.4)] flex items-center gap-3 font-black uppercase tracking-wider text-xs z-50">
                    <i data-lucide="check-circle-2" className="w-5 h-5"></i> Cadastrado com sucesso!
                </div>
            )}

            {/* CABEÇALHO DO PAINEL DE CONTROLE */}
            <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-inner border border-slate-700 flex-shrink-0">
                        <i data-lucide="sliders" className="w-7 h-7"></i>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Sala de Comando</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gestão de Equipe e Catálogo</p>
                    </div>
                </div>

                {/* Switcher de Abas */}
                <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full md:w-auto">
                    <button onClick={() => setAbaAtiva('equipe')} className={`flex-1 px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${abaAtiva === 'equipe' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        <i data-lucide="users" className="w-4 h-4"></i> Equipe
                    </button>
                    <button onClick={() => setAbaAtiva('planos')} className={`flex-1 px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${abaAtiva === 'planos' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        <i data-lucide="clipboard-check" className="w-4 h-4"></i> Planos
                    </button>
                    <button onClick={() => setAbaAtiva('produtos')} className={`flex-1 px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${abaAtiva === 'produtos' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        <i data-lucide="package" className="w-4 h-4"></i> Produtos
                    </button>
                </div>
            </div>

            {/* CONTEÚDO DINÂMICO DAS ABAS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* LADO ESQUERDO: FORMULÁRIO DE ADIÇÃO */}
                <div className="lg:col-span-1 bg-white rounded-[24px] shadow-sm border border-slate-200 p-6 md:p-8">
                    
                    {/* FORM: EQUIPE */}
                    {abaAtiva === 'equipe' && (
                        <form onSubmit={handleAddColaborador} className="space-y-5 animate-[fadeIn_0.3s_ease-out]">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                                <i data-lucide="user-plus" className="w-5 h-5 text-blue-500"></i> Novo Colaborador
                            </h3>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Nome Completo</label>
                                <input type="text" value={nomeColaborador} onChange={(e) => setNomeColaborador(e.target.value)} required placeholder="Ex: Lucas Mendes" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Setor / Cargo</label>
                                <select value={cargoColaborador} onChange={(e) => setCargoColaborador(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer">
                                    <option value="RECEPCAO">Recepção / SDR</option>
                                    <option value="BEM ESTAR">Bem Estar</option>
                                    <option value="LIDER">Líder de Unidade</option>
                                </select>
                            </div>
                            <button type="submit" className="w-full mt-4 bg-slate-900 hover:bg-black text-white font-black uppercase tracking-widest py-3.5 px-4 rounded-xl shadow-md transition-all hover:-translate-y-0.5 flex justify-center items-center gap-2 text-xs">
                                <i data-lucide="plus" className="w-4 h-4"></i> Cadastrar na Equipe
                            </button>
                        </form>
                    )}

                    {/* FORM: PLANOS */}
                    {abaAtiva === 'planos' && (
                        <form onSubmit={handleAddPlano} className="space-y-5 animate-[fadeIn_0.3s_ease-out]">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                                <i data-lucide="folder-plus" className="w-5 h-5 text-blue-500"></i> Novo Plano
                            </h3>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Nome do Plano</label>
                                <input type="text" value={nomePlano} onChange={(e) => setNomePlano(e.target.value)} required placeholder="Ex: PLANO VIP ANUAL" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none uppercase" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Valor (R$)</label>
                                <input type="number" step="0.01" min="0" value={valorPlano} onChange={(e) => setValorPlano(e.target.value)} required placeholder="Ex: 119.90" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <button type="submit" className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest py-3.5 px-4 rounded-xl shadow-md transition-all hover:-translate-y-0.5 flex justify-center items-center gap-2 text-xs">
                                <i data-lucide="save" className="w-4 h-4"></i> Salvar Plano
                            </button>
                        </form>
                    )}

                    {/* FORM: PRODUTOS */}
                    {abaAtiva === 'produtos' && (
                        <form onSubmit={handleAddProduto} className="space-y-5 animate-[fadeIn_0.3s_ease-out]">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                                <i data-lucide="box" className="w-5 h-5 text-blue-500"></i> Novo Produto
                            </h3>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Nome do Produto</label>
                                <input type="text" value={nomeProduto} onChange={(e) => setNomeProduto(e.target.value)} required placeholder="Ex: WHEY PROTEIN" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none uppercase" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Valor Unitário (R$)</label>
                                <input type="number" step="0.01" min="0" value={valorProduto} onChange={(e) => setValorProduto(e.target.value)} required placeholder="Ex: 89.90" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <button type="submit" className="w-full mt-4 bg-amber-500 hover:bg-amber-600 text-white font-black uppercase tracking-widest py-3.5 px-4 rounded-xl shadow-md transition-all hover:-translate-y-0.5 flex justify-center items-center gap-2 text-xs">
                                <i data-lucide="save" className="w-4 h-4"></i> Salvar Produto
                            </button>
                        </form>
                    )}

                </div>

                {/* LADO DIREITO: LISTA DE DADOS ATUAIS */}
                <div className="lg:col-span-2 bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[500px]">
                    
                    <div className="p-6 md:px-8 md:py-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                            <i data-lucide="database" className="w-4 h-4 text-slate-400"></i> Base de Dados Operacional
                        </h3>
                        <span className="text-[10px] font-black bg-white border border-slate-200 text-slate-500 px-3 py-1.5 rounded-lg shadow-sm">
                            {abaAtiva === 'equipe' ? colaboradores.length : abaAtiva === 'planos' ? planos.length : produtos.length} REGISTROS
                        </span>
                    </div>

                    <div className="overflow-y-auto custom-scrollbar flex-1 p-2">
                        <table className="w-full text-left border-collapse">
                            
                            {/* TABELA: EQUIPE */}
                            {abaAtiva === 'equipe' && (
                                <tbody className="divide-y divide-slate-50 animate-[fadeIn_0.3s_ease-out]">
                                    {colaboradores.map(c => (
                                        <tr key={c.id} className="hover:bg-slate-50 group transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-black shadow-sm">
                                                        {c.nome.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-slate-800 uppercase tracking-wide">{c.nome}</p>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{c.role}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => handleDeleteColaborador(c.id)} className="text-slate-300 hover:text-rose-500 transition-colors p-2 md:opacity-0 md:group-hover:opacity-100" title="Remover da Equipe">
                                                    <i data-lucide="trash-2" className="w-5 h-5"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            )}

                            {/* TABELA: PLANOS */}
                            {abaAtiva === 'planos' && (
                                <tbody className="divide-y divide-slate-50 animate-[fadeIn_0.3s_ease-out]">
                                    {planos.map(p => (
                                        <tr key={p.id} className="hover:bg-slate-50 group transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <i data-lucide="bookmark" className="w-5 h-5 text-blue-300"></i>
                                                    <span className="text-sm font-black text-slate-800 uppercase tracking-wide">{p.nome}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-black text-emerald-600 text-right">
                                                {formatMoney(p.valor)}
                                            </td>
                                            <td className="px-6 py-4 text-right w-16">
                                                <button onClick={() => handleDeletePlano(p.id)} className="text-slate-300 hover:text-rose-500 transition-colors p-2 md:opacity-0 md:group-hover:opacity-100" title="Excluir Plano">
                                                    <i data-lucide="trash-2" className="w-4 h-4"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            )}

                            {/* TABELA: PRODUTOS */}
                            {abaAtiva === 'produtos' && (
                                <tbody className="divide-y divide-slate-50 animate-[fadeIn_0.3s_ease-out]">
                                    {produtos.map(p => (
                                        <tr key={p.id} className="hover:bg-amber-50/30 group transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <i data-lucide="package" className="w-5 h-5 text-amber-400"></i>
                                                    <span className="text-sm font-black text-slate-800 uppercase tracking-wide">{p.nome}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-black text-emerald-600 text-right">
                                                {formatMoney(p.valor)}
                                            </td>
                                            <td className="px-6 py-4 text-right w-16">
                                                <button onClick={() => handleDeleteProduto(p.id)} className="text-slate-300 hover:text-rose-500 transition-colors p-2 md:opacity-0 md:group-hover:opacity-100" title="Excluir Produto">
                                                    <i data-lucide="trash-2" className="w-4 h-4"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            )}

                        </table>
                        
                        {/* Empty States */}
                        {abaAtiva === 'equipe' && colaboradores.length === 0 && <div className="text-center py-20 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhum colaborador cadastrado.</div>}
                        {abaAtiva === 'planos' && planos.length === 0 && <div className="text-center py-20 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhum plano cadastrado no catálogo.</div>}
                        {abaAtiva === 'produtos' && produtos.length === 0 && <div className="text-center py-20 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhum produto físico cadastrado.</div>}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default CadastroGeral;