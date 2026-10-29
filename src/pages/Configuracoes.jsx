import React, { useState, useEffect } from 'react';
import { supabase, conexaoParaCriarLogin } from '../supabaseClient.js';
import { ShieldCheck, Settings, Lock, Shield, MapPin, Key, UserCheck, Save, UserMinus, Building, Trash2, Building2, AlertTriangle } from 'lucide-react';
import ModalUnidadesMentor from '../components/Modals/ModalUnidadesMentor.jsx';

// Mentor: quantas etiquetas de unidade aparecem no cartão antes do "+N"
const MAX_ETIQUETAS_MENTOR = 4;
const normalizarUnidade = (texto) => String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();

const Configuracoes = ({ unidades = [], setUnidades }) => {
    const [abaAtiva, setAbaAtiva] = useState('acessos'); 
    const [sucesso, setSucesso] = useState(false);
    const [usuariosAcesso, setUsuariosAcesso] = useState([]);

    const [nomeUnidade, setNomeUnidade] = useState('');

    const [acessoEmail, setAcessoEmail] = useState('');
    const [acessoSenha, setAcessoSenha] = useState('');
    const [acessoNome, setAcessoNome] = useState('');
    const [acessoRole, setAcessoRole] = useState('');
    const [acessoUnidade, setAcessoUnidade] = useState('');

    // MENTOR ↔ UNIDADES: vínculos de todos os mentores numa consulta só (e-mail -> lista de unidades)
    const [vinculosMentor, setVinculosMentor] = useState({});
    const [mentorEditando, setMentorEditando] = useState(null);

    const carregarVinculosMentor = async () => {
        const { data, error } = await supabase.from('mentor_unidades').select('mentor_email, unidade');
        if (error) { console.error('Erro ao carregar as unidades dos mentores:', error); return; }
        const mapa = {};
        (data || []).forEach(l => {
            const email = String(l.mentor_email || '').toLowerCase().trim();
            (mapa[email] = mapa[email] || []).push(l.unidade);
        });
        setVinculosMentor(mapa);
    };
    const unidadesDoMentor = (email) => vinculosMentor[String(email || '').toLowerCase().trim()] || [];

    useEffect(() => {
        const carregarUsuarios = async () => {
            const { data } = await supabase.from('usuarios_sistema').select('*');
            if (data) setUsuariosAcesso(data);
        };
        carregarUsuarios();
        carregarVinculosMentor();
    }, []);

    useEffect(() => {
        if (acessoRole === 'LIDER' || acessoRole === 'RECEPCAO') {
            setAcessoSenha('123456');
        } else if (acessoRole === 'ADMIN' || acessoRole === 'MENTOR') {
            setAcessoSenha(''); 
        }
    }, [acessoRole]);

    const mostrarSucesso = () => {
        setSucesso(true); setTimeout(() => setSucesso(false), 3000);
    };

    const handleSalvarUnidade = async (e) => {
        e.preventDefault();
        if (!nomeUnidade.trim()) return;

        const { data, error } = await supabase.from('unidades').insert([{ nome: nomeUnidade.toUpperCase() }]).select();
        
        if (!error && data) {
            setUnidades([...unidades, data[0]]);
            setNomeUnidade('');
            mostrarSucesso();
        } else {
            alert('Erro ao salvar unidade: ' + error?.message);
        }
    };

    const handleDeleteUnidade = async (id) => {
        if(window.confirm('Atenção! Tem certeza que deseja excluir esta unidade permanentemente?')) {
            await supabase.from('unidades').delete().eq('id', id);
            setUnidades(unidades.filter(u => u.id !== id));
        }
    };

    const handleSalvarAcesso = async (e) => {
        e.preventDefault();
        if (!acessoEmail.trim() || !acessoSenha || !acessoRole || !acessoUnidade) return;

        // Mentor que muda de perfil perde as unidades vinculadas (o banco apaga sozinho e registra)
        const existente = usuariosAcesso.find(u => u.email === acessoEmail.toLowerCase().trim());
        const qtdVinculos = unidadesDoMentor(acessoEmail).length;
        if (existente?.role === 'MENTOR' && acessoRole.toUpperCase() !== 'MENTOR' && qtdVinculos > 0
            && !window.confirm(`Este login tem ${qtdVinculos} ${qtdVinculos === 1 ? 'unidade vinculada' : 'unidades vinculadas'} como Mentor. Elas serão removidas.\n\nContinuar?`)) return;

        // Conexão separada: o Admin continua conectado como ele mesmo (quem grava a permissão abaixo é o Admin)
        const { error: authError } = await conexaoParaCriarLogin().auth.signUp({
            email: acessoEmail.toLowerCase().trim(),
            password: acessoSenha
        });

        if (authError && !authError.message.includes('already registered')) {
            alert('Erro na autenticação do Supabase: ' + authError.message);
            return;
        }

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
            carregarVinculosMentor();
            mostrarSucesso();
        } else {
            alert('Erro ao salvar permissões: ' + error?.message);
        }
    };

    const handleDeleteAcesso = async (email) => {
        if(window.confirm(`Atenção! Deseja realmente revogar o acesso de ${email}? Ele não poderá mais fazer login no sistema.`)) {
            await supabase.from('usuarios_sistema').delete().eq('email', email);
            setUsuariosAcesso(usuariosAcesso.filter(u => u.email !== email));
            carregarVinculosMentor();
        }
    };

    // Salva as unidades marcadas para o mentor: tira as desmarcadas e inclui as novas (só Admin; o banco confere)
    const salvarUnidadesMentor = async (nomesMarcados) => {
        if (!mentorEditando) return false;
        const atuais = unidadesDoMentor(mentorEditando.email);
        const marcadasNorm = new Set(nomesMarcados.map(normalizarUnidade));
        const atuaisNorm = new Set(atuais.map(normalizarUnidade));
        const remover = atuais.filter(n => !marcadasNorm.has(normalizarUnidade(n)));
        const incluir = nomesMarcados.filter(n => !atuaisNorm.has(normalizarUnidade(n)));

        const falhou = async (error) => {
            alert('Não foi possível salvar as unidades do mentor.\n\n' + (error?.message || ''));
            await carregarVinculosMentor();
            return false;
        };
        if (remover.length > 0) {
            const { error } = await supabase.from('mentor_unidades').delete()
                .eq('mentor_email', mentorEditando.email).in('unidade', remover);
            if (error) return falhou(error);
        }
        if (incluir.length > 0) {
            const { error } = await supabase.from('mentor_unidades')
                .insert(incluir.map(unidade => ({ mentor_email: mentorEditando.email, unidade })));
            if (error) return falhou(error);
        }
        await carregarVinculosMentor();
        setMentorEditando(null);
        mostrarSucesso();
        return true;
    };

    // Estilo unificado para inputs claros (Minimalismo Vivo TECACE)
    const inputCSS = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all";

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] max-w-[1400px] mx-auto relative pb-10">
            
            {sucesso && (
                <div className="absolute top-0 right-0 bg-emerald-50 border border-emerald-200 text-emerald-600 px-6 py-3 rounded-2xl shadow-[0_10px_40px_-10px_rgba(16,185,129,0.2)] flex items-center gap-3 font-black uppercase tracking-wider text-[10px] z-50">
                    <ShieldCheck className="w-4 h-4" /> Alterações salvas com sucesso!
                </div>
            )}

            {/* HEADER DO PAINEL ADMIN (CLARO E MODERNO) */}
            <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
                <div className="flex items-center gap-5 relative z-10">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100 shadow-inner flex-shrink-0">
                        <Settings className="w-8 h-8" strokeWidth={2} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Painel de Administração</h2>
                        <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                            <Lock className="w-3 h-3" /> Acesso Restrito do Sistema
                        </p>
                    </div>
                </div>

                <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-full md:w-auto relative z-10 shadow-inner">
                    <button onClick={() => setAbaAtiva('acessos')} className={`flex-1 md:w-48 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${abaAtiva === 'acessos' ? 'bg-white shadow-sm text-blue-700 border border-slate-200/50' : 'text-slate-500 hover:text-slate-800 border border-transparent'}`}>
                        <Shield className="w-4 h-4" strokeWidth={2.5} /> Logins e Permissões
                    </button>
                    <button onClick={() => setAbaAtiva('unidades')} className={`flex-1 md:w-48 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${abaAtiva === 'unidades' ? 'bg-white shadow-sm text-blue-700 border border-slate-200/50' : 'text-slate-500 hover:text-slate-800 border border-transparent'}`}>
                        <MapPin className="w-4 h-4" strokeWidth={2.5} /> Gestão de Unidades
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* LADO ESQUERDO: FORMULÁRIOS */}
                <div className="lg:col-span-4 bg-white rounded-[32px] shadow-sm border border-slate-200 p-6 md:p-8 relative overflow-hidden">
                    
                    {abaAtiva === 'acessos' && (
                        <form onSubmit={handleSalvarAcesso} className="space-y-5 animate-[fadeIn_0.3s_ease-out] relative z-10">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
                                <div className="p-2 bg-blue-50 rounded-lg border border-blue-100 text-blue-600 shadow-inner"><Key className="w-4 h-4" /></div>
                                Conceder Novo Acesso
                            </h3>
                            
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">E-mail do Usuário</label>
                                <input type="email" value={acessoEmail} onChange={(e) => setAcessoEmail(e.target.value)} required placeholder="email@pratique.com" className={`${inputCSS} lowercase`} />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Nível de Permissão</label>
                                <select value={acessoRole} onChange={(e) => setAcessoRole(e.target.value)} required className={`${inputCSS} cursor-pointer appearance-none`}>
                                    <option value="" disabled>Selecione o Nível...</option>
                                    <option value="ADMIN">Administrador Global (Admin)</option>
                                    <option value="MENTOR">Mentor (unidades vinculadas)</option>
                                    <option value="LIDER">Líder de Unidade</option>
                                    <option value="RECEPCAO">Recepção / Consultor</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Senha Inicial</label>
                                <input 
                                    type="text" 
                                    value={acessoSenha} 
                                    onChange={(e) => setAcessoSenha(e.target.value)} 
                                    required 
                                    placeholder="Defina uma senha segura" 
                                    disabled={acessoRole === 'LIDER' || acessoRole === 'RECEPCAO'}
                                    className={`${inputCSS} disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed`} 
                                />
                                {(acessoRole === 'LIDER' || acessoRole === 'RECEPCAO') && (
                                    <p className="text-[9px] font-bold text-slate-400 mt-1 ml-1 uppercase tracking-widest">Senha padrão "123456" aplicada automaticamente.</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Nome de Exibição</label>
                                <input type="text" value={acessoNome} onChange={(e) => setAcessoNome(e.target.value)} required placeholder="Ex: Marcelo de Paula" className={`${inputCSS} uppercase`} />
                            </div>
                            
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Vincular à Unidade</label>
                                <select value={acessoUnidade} onChange={(e) => setAcessoUnidade(e.target.value)} required className={`${inputCSS} cursor-pointer uppercase appearance-none`}>
                                    <option value="" disabled>Selecione a Unidade...</option>
                                    <option value="TODAS">Todas as Unidades (Global)</option>
                                    {unidades.map(u => <option key={u.id} value={u.nome}>{u.nome}</option>)}
                                </select>
                            </div>

                            <button type="submit" className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest py-3.5 px-4 rounded-xl shadow-md active:scale-[0.98] transition-all flex justify-center items-center gap-2 text-[10px]">
                                <UserCheck className="w-4 h-4" /> Criar Acesso Seguro
                            </button>
                        </form>
                    )}

                    {abaAtiva === 'unidades' && (
                        <form onSubmit={handleSalvarUnidade} className="space-y-5 animate-[fadeIn_0.3s_ease-out] relative z-10">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
                                <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100 text-emerald-600 shadow-inner"><MapPin className="w-4 h-4" /></div>
                                Cadastrar Nova Unidade
                            </h3>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Nome Oficial da Unidade</label>
                                <input type="text" value={nomeUnidade} onChange={(e) => setNomeUnidade(e.target.value)} required placeholder="Ex: SANTA INÊS 2" className={`${inputCSS} uppercase`} />
                            </div>
                            <button type="submit" className="w-full mt-6 bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest py-3.5 px-4 rounded-xl shadow-md active:scale-[0.98] transition-all flex justify-center items-center gap-2 text-[10px]">
                                <Save className="w-4 h-4" /> Salvar Nova Unidade
                            </button>
                        </form>
                    )}
                </div>

                {/* LADO DIREITO: LISTAS DE AUDITORIA */}
                <div className="lg:col-span-8 bg-slate-50/50 rounded-[32px] shadow-inner border border-slate-200 flex flex-col h-[750px] relative overflow-hidden">
                    
                    <div className="p-6 md:p-8 border-b border-slate-200 bg-white flex justify-between items-center shrink-0">
                        <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                            <Shield className="w-4 h-4 text-slate-400" /> Diretório do Sistema
                        </h3>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {abaAtiva === 'acessos' ? `${usuariosAcesso.length} Usuários Cadastrados` : `${unidades.length} Unidades Cadastradas`}
                        </div>
                    </div>

                    <div className="overflow-y-auto custom-scrollbar flex-1 p-4 md:p-6">
                        <div className="flex flex-col gap-3">
                            
                            {/* LISTA ACESSOS */}
                            {abaAtiva === 'acessos' && (
                                usuariosAcesso.map(u => (
                                    <div key={u.email} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-3 hover:shadow-md transition-all group">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center text-lg font-black shadow-inner shrink-0">
                                                {u.nome.charAt(0)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-black text-slate-800 uppercase truncate">{u.nome}</p>
                                                <p className="text-xs font-semibold text-slate-400 lowercase mt-0.5 truncate">{u.email}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-col sm:items-end gap-2 shrink-0">
                                            <span className={`w-fit px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border shadow-sm ${
                                                u.role === 'ADMIN' ? 'bg-rose-100 text-rose-700 border-rose-200' : 
                                                u.role === 'MENTOR' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                                u.role === 'LIDER' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                'bg-blue-100 text-blue-700 border-blue-200'
                                            }`}>
                                                {u.role === 'RECEPCAO' ? 'RECEPÇÃO / CONSULTOR' : u.role}
                                            </span>
                                            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">
                                                <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-slate-400" /> {u.unidade}</span>
                                                
                                                {u.role === 'MENTOR' && (
                                                    <button onClick={() => setMentorEditando(u)} className="flex items-center gap-1.5 text-blue-600 dark:text-blue-300 hover:text-blue-700 transition-colors px-2.5 py-1.5 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 rounded-md shadow-sm text-[10px] font-black uppercase tracking-widest" title="Escolher as unidades deste mentor">
                                                        <Building2 className="w-3.5 h-3.5" /> Unidades
                                                    </button>
                                                )}
                                                {u.role !== 'ADMIN' && (
                                                    <button onClick={() => handleDeleteAcesso(u.email)} className="text-slate-400 hover:text-rose-600 transition-colors p-1.5 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-md shadow-sm" title="Revogar Acesso">
                                                        <UserMinus className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {u.role === 'MENTOR' && (() => {
                                        const lista = unidadesDoMentor(u.email);
                                        if (lista.length === 0) return (
                                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-[10px] font-black uppercase tracking-widest">
                                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Sem unidades: este mentor não vê nada no sistema
                                            </div>
                                        );
                                        const ordenada = [...lista].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true }));
                                        const extras = ordenada.length - MAX_ETIQUETAS_MENTOR;
                                        return (
                                            <div className="flex flex-wrap items-center gap-1.5" title={ordenada.join(', ')}>
                                                {ordenada.slice(0, MAX_ETIQUETAS_MENTOR).map(nome => (
                                                    <span key={nome} className="px-2 py-1 rounded-md bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 text-purple-700 dark:text-purple-300 text-[9px] font-black uppercase tracking-widest">{nome}</span>
                                                ))}
                                                {extras > 0 && <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[9px] font-black uppercase tracking-widest">+{extras}</span>}
                                            </div>
                                        );
                                    })()}
                                    </div>
                                ))
                            )}

                            {/* LISTA UNIDADES */}
                            {abaAtiva === 'unidades' && (
                                unidades.map(u => (
                                    <div key={u.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-4 hover:shadow-md transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl shadow-inner"><Building className="w-5 h-5" /></div>
                                            {/* 🔥 O PROBLEMA ESTAVA AQUI: text-white removido. Adicionado text-slate-800 forte */}
                                            <span className="text-sm font-black text-slate-800 uppercase tracking-wider">{u.nome}</span>
                                        </div>
                                        <button onClick={() => handleDeleteUnidade(u.id)} className="text-slate-400 hover:text-rose-600 transition-colors p-2 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl shadow-sm" title="Excluir Unidade">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}

                            {/* ESTADO VAZIO */}
                            {((abaAtiva === 'acessos' && usuariosAcesso.length === 0) || (abaAtiva === 'unidades' && unidades.length === 0)) && (
                                <div className="flex flex-col items-center justify-center py-20 opacity-60">
                                    <Shield className="w-16 h-16 text-slate-300 mb-4" strokeWidth={1} />
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nenhum registro encontrado no diretório.</p>
                                </div>
                            )}

                        </div>
                    </div>
                </div>

            </div>

            {mentorEditando && (
                <ModalUnidadesMentor
                    mentor={mentorEditando}
                    unidades={unidades}
                    marcadasIniciais={unidadesDoMentor(mentorEditando.email)}
                    onCancelar={() => setMentorEditando(null)}
                    onSalvar={salvarUnidadesMentor}
                />
            )}
        </div>
    );
};

export default Configuracoes;