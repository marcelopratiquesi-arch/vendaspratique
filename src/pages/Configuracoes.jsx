import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import { ShieldCheck, Settings, Lock, Shield, MapPin, Key, UserCheck, Save, Eye, UserMinus, Building, Trash2 } from 'lucide-react';

const Configuracoes = ({ unidades = [], setUnidades }) => {
    const { t } = useI18n();
    const [abaAtiva, setAbaAtiva] = useState('acessos'); 
    const [sucesso, setSucesso] = useState(false);
    const [usuariosAcesso, setUsuariosAcesso] = useState([]);

    const [nomeUnidade, setNomeUnidade] = useState('');

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
            alert(t('settings.alert.errorSavingUnit') + error?.message);
        }
    };

    const handleDeleteUnidade = async (id) => {
        if(window.confirm(t('settings.alert.deleteUnitConfirm'))) {
            await supabase.from('unidades').delete().eq('id', id);
            setUnidades(unidades.filter(u => u.id !== id));
        }
    };

    const handleSalvarAcesso = async (e) => {
        e.preventDefault();
        if (!acessoEmail.trim() || !acessoSenha || !acessoRole || !acessoUnidade) return;

        const { error: authError } = await supabase.auth.signUp({
            email: acessoEmail.toLowerCase().trim(),
            password: acessoSenha
        });

        if (authError && !authError.message.includes('already registered')) {
            alert(t('settings.alert.errorSupabaseAuth') + authError.message);
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
            mostrarSucesso();
        } else {
            alert(t('settings.alert.errorSavingPermissions') + error?.message);
        }
    };

    const handleDeleteAcesso = async (email) => {
        if(window.confirm(t('settings.alert.revokeAccessConfirm', { email: email }))) {
            await supabase.from('usuarios_sistema').delete().eq('email', email);
            setUsuariosAcesso(usuariosAcesso.filter(u => u.email !== email));
        }
    };

    // Variável comum para os inputs glass
    const inputGlassCSS = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-semibold text-white placeholder-slate-500 focus:bg-white/10 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all [&:-webkit-autofill]:[Webkit-box-shadow:0_0_0_30px_#0f172a_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:white]";

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] max-w-[1400px] mx-auto relative font-sans">
            
            {sucesso && (
                <div className="absolute top-0 right-0 bg-emerald-500/20 border border-emerald-500/30 backdrop-blur-md text-emerald-400 px-6 py-3 rounded-2xl shadow-[0_10px_40px_-10px_rgba(16,185,129,0.5)] flex items-center gap-3 font-black uppercase tracking-wider text-[10px] z-50">
                    <ShieldCheck className="w-4 h-4" /> {t('settings.successSaved')}
                </div>
            )}

            {/* HEADER DO ADMIN PREMIUM */}
            <div className="bg-[#111827]/60 backdrop-blur-2xl rounded-[32px] shadow-2xl border border-white/5 p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
                <div className="absolute top-[-50%] right-[-10%] w-[300px] h-[300px] bg-blue-600/10 rounded-full blur-[80px] pointer-events-none"></div>

                <div className="flex items-center gap-5 relative z-10">
                    <div className="w-16 h-16 bg-white/5 text-slate-300 rounded-2xl flex items-center justify-center border border-white/10 shadow-inner flex-shrink-0">
                        <Settings className="w-8 h-8 drop-shadow-md" strokeWidth={1.5} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">{t('settings.adminPanel')}</h2>
                        <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                            <Lock className="w-3 h-3" /> {t('settings.restrictedAccess')}
                        </p>
                    </div>
                </div>

                <div className="flex bg-[#090b11]/80 p-1.5 rounded-2xl border border-white/5 w-full md:w-auto relative z-10 shadow-inner">
                    <button onClick={() => setAbaAtiva('acessos')} className={`flex-1 md:w-48 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${abaAtiva === 'acessos' ? 'bg-blue-600/20 shadow-md text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>
                        <Shield className="w-4 h-4" strokeWidth={2.5} /> {t('settings.logins')}
                    </button>
                    <button onClick={() => setAbaAtiva('unidades')} className={`flex-1 md:w-48 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${abaAtiva === 'unidades' ? 'bg-blue-600/20 shadow-md text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>
                        <MapPin className="w-4 h-4" strokeWidth={2.5} /> {t('settings.unitsManagement')}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* LADO ESQUERDO: FORMULÁRIOS */}
                <div className="lg:col-span-4 bg-[#111827]/60 backdrop-blur-2xl rounded-[32px] shadow-xl border border-white/5 p-6 md:p-8 relative overflow-hidden">
                    
                    {abaAtiva === 'acessos' && (
                        <form onSubmit={handleSalvarAcesso} className="space-y-5 animate-[fadeIn_0.3s_ease-out] relative z-10">
                            <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-3 border-b border-white/5 pb-4">
                                <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400"><Key className="w-4 h-4" /></div>
                                {t('settings.grantAccess')}
                            </h3>
                            
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">{t('settings.userEmail')}</label>
                                <input type="email" value={acessoEmail} onChange={(e) => setAcessoEmail(e.target.value)} required placeholder="email@pratique.com" className={`${inputGlassCSS} lowercase`} />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">{t('settings.permissionLevel')}</label>
                                <select value={acessoRole} onChange={(e) => setAcessoRole(e.target.value)} required className={`${inputGlassCSS} cursor-pointer appearance-none`}>
                                    <option value="" className="bg-slate-900">{t('settings.selectLevel')}</option>
                                    <option value="ADMIN" className="bg-slate-900">{t('settings.roleAdmin')}</option>
                                    <option value="MENTOR" className="bg-slate-900">{t('settings.roleMentor')}</option>
                                    <option value="LIDER" className="bg-slate-900">{t('settings.roleLeader')}</option>
                                    <option value="RECEPCAO" className="bg-slate-900">{t('settings.roleReception')}</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">{t('settings.password')}</label>
                                <input 
                                    type="text" 
                                    value={acessoSenha} 
                                    onChange={(e) => setAcessoSenha(e.target.value)} 
                                    required 
                                    placeholder={t('settings.definePassword')} 
                                    disabled={acessoRole === 'LIDER' || acessoRole === 'RECEPCAO'}
                                    className={`${inputGlassCSS} disabled:opacity-40 disabled:cursor-not-allowed`} 
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">{t('settings.displayName')}</label>
                                <input type="text" value={acessoNome} onChange={(e) => setAcessoNome(e.target.value)} required placeholder={t('settings.exName')} className={`${inputGlassCSS} uppercase`} />
                            </div>
                            
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">{t('settings.linkUnit')}</label>
                                <select value={acessoUnidade} onChange={(e) => setAcessoUnidade(e.target.value)} required className={`${inputGlassCSS} cursor-pointer uppercase appearance-none`}>
                                    <option value="" className="bg-slate-900">{t('settings.selectUnit')}</option>
                                    <option value="TODAS" className="bg-slate-900">{t('settings.allUnits')}</option>
                                    {unidades.map(u => <option key={u.id} value={u.nome} className="bg-slate-900">{u.nome}</option>)}
                                </select>
                            </div>

                            <button type="submit" className="w-full mt-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black uppercase tracking-widest py-4 px-4 rounded-xl shadow-[0_10px_30px_-10px_rgba(37,99,235,0.6)] active:scale-[0.98] transition-all flex justify-center items-center gap-2 text-xs border border-white/10">
                                <UserCheck className="w-4 h-4" /> {t('settings.createAccess')}
                            </button>
                        </form>
                    )}

                    {abaAtiva === 'unidades' && (
                        <form onSubmit={handleSalvarUnidade} className="space-y-5 animate-[fadeIn_0.3s_ease-out] relative z-10">
                            <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-3 border-b border-white/5 pb-4">
                                <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400"><MapPin className="w-4 h-4" /></div>
                                {t('settings.registerNewUnit')}
                            </h3>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">{t('settings.unitName')}</label>
                                <input type="text" value={nomeUnidade} onChange={(e) => setNomeUnidade(e.target.value)} required placeholder={t('settings.typeNome')} className={`${inputGlassCSS} uppercase`} />
                            </div>
                            <button type="submit" className="w-full mt-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black uppercase tracking-widest py-4 px-4 rounded-xl shadow-[0_10px_30px_-10px_rgba(16,185,129,0.6)] active:scale-[0.98] transition-all flex justify-center items-center gap-2 text-xs border border-white/10">
                                <Save className="w-4 h-4" /> {t('settings.registerUnit')}
                            </button>
                        </form>
                    )}
                </div>

                {/* LADO DIREITO: LISTAS */}
                <div className="lg:col-span-8 bg-[#111827]/60 backdrop-blur-2xl rounded-[32px] shadow-xl border border-white/5 flex flex-col h-[750px] relative overflow-hidden">
                    
                    <div className="p-6 md:p-8 border-b border-white/5 bg-[#090b11]/40 flex justify-between items-center shrink-0">
                        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                            <Shield className="w-4 h-4 text-slate-500" /> {t('settings.systemReport')}
                        </h3>
                    </div>

                    <div className="overflow-y-auto custom-scrollbar flex-1 p-2 md:p-4">
                        <div className="flex flex-col gap-2">
                            
                            {/* LISTA ACESSOS */}
                            {abaAtiva === 'acessos' && (
                                usuariosAcesso.map(u => (
                                    <div key={u.email} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/10 transition-colors group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-[#090b11]/80 border border-white/10 text-white flex items-center justify-center text-lg font-black shadow-inner shrink-0">
                                                {u.nome.charAt(0)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-black text-white uppercase truncate">{u.nome}</p>
                                                <p className="text-xs font-semibold text-slate-400 lowercase mt-0.5 truncate">{u.email}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-col sm:items-end gap-2 shrink-0">
                                            <span className={`w-fit px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border shadow-inner ${
                                                u.role === 'ADMIN' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 
                                                u.role === 'MENTOR' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                u.role === 'LIDER' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                            }`}>
                                                {u.role === 'RECEPCAO' ? t('settings.roleReception').split('(')[0] : u.role}
                                            </span>
                                            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                                                <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {u.unidade}</span>
                                                
                                                {u.role !== 'ADMIN' && (
                                                    <button onClick={() => handleDeleteAcesso(u.email)} className="text-slate-500 hover:text-rose-400 transition-colors p-1 bg-[#090b11]/50 hover:bg-rose-500/10 border border-white/5 rounded-md" title={t('settings.revokeAccess')}>
                                                        <UserMinus className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}

                            {/* LISTA UNIDADES */}
                            {abaAtiva === 'unidades' && (
                                unidades.map(u => (
                                    <div key={u.id} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-4 hover:bg-white/10 transition-colors group">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl shadow-inner"><Building className="w-5 h-5" /></div>
                                            <span className="text-sm font-black text-white uppercase tracking-wider">{u.nome}</span>
                                        </div>
                                        <button onClick={() => handleDeleteUnidade(u.id)} className="text-slate-500 hover:text-rose-400 transition-colors p-2 bg-[#090b11]/50 hover:bg-rose-500/10 border border-white/5 rounded-xl shadow-sm" title={t('settings.deleteUnit')}>
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}

                            {/* ESTADO VAZIO */}
                            {((abaAtiva === 'acessos' && usuariosAcesso.length === 0) || (abaAtiva === 'unidades' && unidades.length === 0)) && (
                                <div className="flex flex-col items-center justify-center py-20 opacity-50">
                                    <Shield className="w-16 h-16 text-slate-600 mb-4" strokeWidth={1} />
                                    <p className="text-sm font-bold text-slate-400">Nenhum registro encontrado.</p>
                                </div>
                            )}

                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Configuracoes;