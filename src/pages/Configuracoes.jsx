import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js';

const Configuracoes = ({ unidades = [], setUnidades }) => {
    const [abaAtiva, setAbaAtiva] = useState('acessos'); // 'acessos' ou 'unidades'
    const [sucesso, setSucesso] = useState(false);
    const [usuariosAcesso, setUsuariosAcesso] = useState([]);

    // Campos Unidade
    const [nomeUnidade, setNomeUnidade] = useState('');

    // Campos Acesso (Ordem Atualizada)
    const [acessoEmail, setAcessoEmail] = useState('');
    const [acessoSenha, setAcessoSenha] = useState('');
    const [acessoNome, setAcessoNome] = useState('');
    const [acessoRole, setAcessoRole] = useState('');
    const [acessoUnidade, setAcessoUnidade] = useState('');

    useEffect(() => {
        const carregarUsuarios = async () => {
            const { data } = await supabase.from('usuarios_sistema').select('*');
            if (data) setUsuariosAcesso(data);
        };
        carregarUsuarios();
    }, []);

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [abaAtiva, unidades, usuariosAcesso, sucesso]);

    // Automação da Senha Padrão
    useEffect(() => {
        if (acessoRole === 'LIDER' || acessoRole === 'RECEPCAO') {
            setAcessoSenha('123456');
        } else if (acessoRole === 'ADMIN' || acessoRole === 'MENTOR') {
            setAcessoSenha(''); // Limpa para a diretoria escolher
        }
    }, [acessoRole]);

    const mostrarSucesso = () => {
        setSucesso(true); setTimeout(() => setSucesso(false), 3000);
    };

    // --- GERENCIAMENTO DE UNIDADES ---
    const handleSalvarUnidade = async (e) => {
        e.preventDefault();
        if (!nomeUnidade.trim()) return;

        const { data, error } = await supabase.from('unidades').insert([{ nome: nomeUnidade.toUpperCase() }]).select();
        
        if (!error && data) {
            setUnidades([...unidades, data[0]]);
            setNomeUnidade('');
            mostrarSucesso();
        } else {
            alert("Erro ao salvar unidade: " + error?.message);
        }
    };

    const handleDeleteUnidade = async (id) => {
        if(window.confirm('Excluir esta unidade do sistema?')) {
            await supabase.from('unidades').delete().eq('id', id);
            setUnidades(unidades.filter(u => u.id !== id));
        }
    };

    // --- GERENCIAMENTO DE ACESSOS COM CRIAÇÃO DE SENHA ---
    const handleSalvarAcesso = async (e) => {
        e.preventDefault();
        if (!acessoEmail.trim() || !acessoSenha || !acessoRole || !acessoUnidade) return;

        // 1. Tenta criar o usuário no Supabase Auth (O motor de senhas)
        const { error: authError } = await supabase.auth.signUp({
            email: acessoEmail.toLowerCase().trim(),
            password: acessoSenha
        });

        if (authError && !authError.message.includes('already registered')) {
            alert("Erro ao registrar senha no Supabase: " + authError.message);
            return;
        }

        // 2. Salva as permissões na nossa tabela de controle
        const payload = {
            email: acessoEmail.toLowerCase().trim(),
            nome: acessoNome.toUpperCase(),
            role: acessoRole.toUpperCase(),
            unidade: acessoUnidade.toUpperCase()
        };

        const { data, error } = await supabase.from('usuarios_sistema').upsert(payload).select();

        if (!error && data) {
            const listaFiltrada = usuariosAcesso.filter(u => u.email !== payload.email);
            setUsuariosAcesso([...listaFiltrada, data[0]]);
            
            setAcessoEmail(''); setAcessoSenha(''); setAcessoNome(''); setAcessoRole(''); setAcessoUnidade('');
            mostrarSucesso();
        } else {
            alert("Erro ao salvar permissões: " + error?.message);
        }
    };

    const handleDeleteAcesso = async (email) => {
        if(window.confirm(`Revogar acesso do e-mail ${email}? Ele não poderá mais logar no sistema.`)) {
            await supabase.from('usuarios_sistema').delete().eq('email', email);
            setUsuariosAcesso(usuariosAcesso.filter(u => u.email !== email));
        }
    };

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] max-w-[1200px] mx-auto relative">
            
            {sucesso && (
                <div className="absolute top-0 right-0 bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-lg flex items-center gap-3 font-black uppercase tracking-wider text-xs z-50">
                    <i data-lucide="check-shield" className="w-5 h-5"></i> Configuração Salva!
                </div>
            )}

            {/* HEADER DO ADMIN */}
            <div className="bg-slate-900 rounded-[24px] shadow-xl border border-slate-800 p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-rose-500/20 text-rose-500 rounded-2xl flex items-center justify-center border border-rose-500/30 flex-shrink-0">
                        <i data-lucide="settings" className="w-7 h-7"></i>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">Painel do Administrador</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1">
                            <i data-lucide="lock" className="w-3 h-3 text-rose-500"></i> Acesso Restrito
                        </p>
                    </div>
                </div>

                <div className="flex bg-slate-800 p-1.5 rounded-xl border border-slate-700 w-full md:w-auto">
                    <button onClick={() => setAbaAtiva('acessos')} className={`flex-1 px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${abaAtiva === 'acessos' ? 'bg-slate-700 shadow-sm text-white border border-slate-600' : 'text-slate-400 hover:text-white'}`}>
                        <i data-lucide="shield" className="w-4 h-4"></i> Acessos (Logins)
                    </button>
                    <button onClick={() => setAbaAtiva('unidades')} className={`flex-1 px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${abaAtiva === 'unidades' ? 'bg-slate-700 shadow-sm text-white border border-slate-600' : 'text-slate-400 hover:text-white'}`}>
                        <i data-lucide="map-pin" className="w-4 h-4"></i> Gestão de Unidades
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* LADO ESQUERDO: FORMULÁRIOS */}
                <div className="lg:col-span-1 bg-white rounded-[24px] shadow-sm border border-slate-200 p-6 md:p-8">
                    
                    {abaAtiva === 'acessos' && (
                        <form onSubmit={handleSalvarAcesso} className="space-y-5 animate-[fadeIn_0.3s_ease-out]">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                                <i data-lucide="key" className="w-5 h-5 text-rose-500"></i> Conceder Acesso
                            </h3>
                            
                            {/* 1. E-MAIL */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">E-mail do Usuário</label>
                                <input type="email" value={acessoEmail} onChange={(e) => setAcessoEmail(e.target.value)} required placeholder="email@pratique.com" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-rose-500 outline-none lowercase" />
                            </div>

                            {/* 2. NÍVEL DE PERMISSÃO */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Nível de Permissão (Role)</label>
                                <select value={acessoRole} onChange={(e) => setAcessoRole(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-slate-700 focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer">
                                    <option value="">Selecione o nível...</option>
                                    <option value="ADMIN">ADMIN (Acesso Total)</option>
                                    <option value="MENTOR">MENTOR (Métricas e Auditoria)</option>
                                    <option value="LIDER">LÍDER (Visão da Unidade e Vendas)</option>
                                    <option value="RECEPCAO">RECEPÇÃO / COLABORADOR (Nova Venda, Histórico, Dashboard, CRM)</option>
                                </select>
                            </div>

                            {/* 3. SENHA VISÍVEL E TRAVÁVEL */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Senha de Acesso</label>
                                <input 
                                    type="text" 
                                    value={acessoSenha} 
                                    onChange={(e) => setAcessoSenha(e.target.value)} 
                                    required 
                                    placeholder="Defina a senha..." 
                                    disabled={acessoRole === 'LIDER' || acessoRole === 'RECEPCAO'}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-rose-500 outline-none disabled:bg-slate-200/60 disabled:text-slate-500 transition-colors" 
                                />
                            </div>

                            {/* 4. NOME DE EXIBIÇÃO */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Nome de Exibição</label>
                                <input type="text" value={acessoNome} onChange={(e) => setAcessoNome(e.target.value)} required placeholder="Ex: Felipe Mendes" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-rose-500 outline-none uppercase" />
                            </div>
                            
                            {/* 5. UNIDADE */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Vincular a qual Unidade?</label>
                                <select value={acessoUnidade} onChange={(e) => setAcessoUnidade(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer uppercase">
                                    <option value="">Selecione a unidade...</option>
                                    {unidades.map(u => <option key={u.id} value={u.nome}>{u.nome}</option>)}
                                    <option value="TODAS">MATRIZ / TODAS AS UNIDADES</option>
                                </select>
                            </div>

                            <button type="submit" className="w-full mt-4 bg-slate-900 hover:bg-black text-white font-black uppercase tracking-widest py-4 px-4 rounded-xl shadow-md transition-all flex justify-center items-center gap-2 text-xs">
                                <i data-lucide="user-check" className="w-4 h-4"></i> Criar Acesso
                            </button>
                        </form>
                    )}

                    {abaAtiva === 'unidades' && (
                        <form onSubmit={handleSalvarUnidade} className="space-y-5 animate-[fadeIn_0.3s_ease-out]">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                                <i data-lucide="map-pin" className="w-5 h-5 text-blue-500"></i> Cadastrar Nova Unidade
                            </h3>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Nome da Unidade (Ex: Floresta)</label>
                                <input type="text" value={nomeUnidade} onChange={(e) => setNomeUnidade(e.target.value)} required placeholder="Digite o nome..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none uppercase" />
                            </div>
                            <button type="submit" className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest py-4 px-4 rounded-xl shadow-md transition-all flex justify-center items-center gap-2 text-xs">
                                <i data-lucide="save" className="w-4 h-4"></i> Registrar Unidade
                            </button>
                        </form>
                    )}

                </div>

                {/* LADO DIREITO: LISTAS */}
                <div className="lg:col-span-2 bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[650px]">
                    <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                            <i data-lucide="shield" className="w-4 h-4 text-slate-400"></i> Relatório do Sistema
                        </h3>
                    </div>

                    <div className="overflow-y-auto custom-scrollbar flex-1 p-2">
                        <table className="w-full text-left border-collapse">
                            
                            {/* TABELA ACESSOS */}
                            {abaAtiva === 'acessos' && (
                                <tbody className="divide-y divide-slate-50">
                                    {usuariosAcesso.map(u => (
                                        <tr key={u.email} className="hover:bg-slate-50 group transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-black">{u.nome.charAt(0)}</div>
                                                    <div>
                                                        <p className="text-sm font-black text-slate-800 uppercase">{u.nome}</p>
                                                        <p className="text-xs font-bold text-slate-500 lowercase mt-0.5">{u.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border ${
                                                    u.role === 'ADMIN' ? 'bg-rose-100 text-rose-700 border-rose-200' : 
                                                    u.role === 'MENTOR' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                                    u.role === 'LIDER' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                    'bg-blue-100 text-blue-700 border-blue-200'
                                                }`}>
                                                    {u.role === 'RECEPCAO' ? 'RECEPÇÃO / COLABORADOR' : u.role}
                                                </span>
                                                <p className="text-[10px] font-bold text-slate-400 mt-2 flex items-center gap-1 uppercase">
                                                    <i data-lucide="map-pin" className="w-3 h-3"></i> {u.unidade}
                                                </p>
                                                {u.role === 'RECEPCAO' && (
                                                    <p className="text-[9px] font-bold text-blue-500 mt-1 flex items-center gap-1 uppercase">
                                                        <i data-lucide="eye" className="w-3 h-3"></i> Ver: Nova Venda, Histórico, Dashboard, CRM
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end md:opacity-0 md:group-hover:opacity-100">
                                                    {/* Impede o Admin de se excluir acidentalmente */}
                                                    {u.role !== 'ADMIN' && (
                                                        <button onClick={() => handleDeleteAcesso(u.email)} className="text-slate-400 hover:text-rose-500 p-2 bg-white border border-slate-200 rounded-lg shadow-sm" title="Revogar Acesso">
                                                            <i data-lucide="user-minus" className="w-4 h-4"></i>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            )}

                            {/* TABELA UNIDADES */}
                            {abaAtiva === 'unidades' && (
                                <tbody className="divide-y divide-slate-50">
                                    {unidades.map(u => (
                                        <tr key={u.id} className="hover:bg-slate-50 group transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-blue-50 text-blue-500 rounded-lg"><i data-lucide="building" className="w-5 h-5"></i></div>
                                                    <span className="text-sm font-black text-slate-800 uppercase">{u.nome}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end md:opacity-0 md:group-hover:opacity-100">
                                                    <button onClick={() => handleDeleteUnidade(u.id)} className="text-slate-400 hover:text-rose-500 p-2 bg-white border border-slate-200 rounded-lg shadow-sm" title="Excluir Unidade">
                                                        <i data-lucide="trash-2" className="w-4 h-4"></i>
                                                    </button>
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

export default Configuracoes;