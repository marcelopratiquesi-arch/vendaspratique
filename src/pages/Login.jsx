import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js';

export default function Login({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');

    // Ícones Lucide
    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [erro, loading]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErro('');

        try {
            // 1. Tenta autenticar a senha criptografada no Supabase
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password: password
            });

            if (authError) throw new Error('E-mail ou senha incorretos.');

            // 2. Se a senha está certa, busca qual é o cargo da pessoa na nossa lista VIP
            const { data: perfilData, error: perfilError } = await supabase
                .from('usuarios_sistema')
                .select('*')
                .eq('email', email.trim())
                .single();

            if (perfilError || !perfilData) {
                // Se a pessoa tem conta mas não tem cargo configurado, bloqueia.
                await supabase.auth.signOut();
                throw new Error('Usuário sem permissão de acesso configurada pelo Admin.');
            }

            // 3. Libera as chaves da cidade para o App.jsx
            onLogin({
                nome: perfilData.nome,
                role: perfilData.role,
                unidade: perfilData.unidade
            });

        } catch (error) {
            setErro(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
            
            {/* Elementos de Fundo (Design Premium) */}
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-600/30 rounded-full blur-[100px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-emerald-600/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }}></div>

            <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-[32px] shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-8 relative z-10 animate-[fadeIn_0.5s_ease-out]">
                
                <div className="text-center mb-10">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg border border-white/20">
                        <i data-lucide="zap" className="w-10 h-10 text-white"></i>
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight mb-2">PRATIQUE <span className="text-blue-400">OS</span></h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Portal do Colaborador</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    
                    {erro && (
                        <div className="bg-rose-500/20 border border-rose-500/50 text-rose-300 p-4 rounded-xl flex items-center gap-3 text-sm font-bold animate-[fadeIn_0.3s_ease-out]">
                            <i data-lucide="shield-alert" className="w-5 h-5 flex-shrink-0"></i>
                            {erro}
                        </div>
                    )}

                    <div>
                        <label className="block text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2 ml-1">E-mail Corporativo</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <i data-lucide="mail" className="w-5 h-5 text-slate-400"></i>
                            </div>
                            <input 
                                type="email" 
                                value={email} 
                                onChange={(e) => setEmail(e.target.value)} 
                                required 
                                placeholder="nome@pratique.com" 
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-12 pr-4 py-4 text-sm font-bold text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2 ml-1">Senha de Acesso</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <i data-lucide="lock" className="w-5 h-5 text-slate-400"></i>
                            </div>
                            <input 
                                type="password" 
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)} 
                                required 
                                placeholder="••••••••" 
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-12 pr-4 py-4 text-sm font-bold text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-black uppercase tracking-widest py-4 rounded-xl shadow-[0_4px_15px_rgba(37,99,235,0.4)] disabled:shadow-none transition-all flex justify-center items-center gap-2 mt-4 text-sm border border-blue-400/30"
                    >
                        {loading ? (
                            <><i data-lucide="loader-2" className="w-5 h-5 animate-spin"></i> Autenticando...</>
                        ) : (
                            <><i data-lucide="log-in" className="w-5 h-5"></i> Acessar Sistema</>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center border-t border-slate-700/50 pt-6">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center justify-center gap-1.5">
                        <i data-lucide="shield-check" className="w-3.5 h-3.5 text-emerald-500"></i> Protegido por Supabase Auth
                    </p>
                </div>
            </div>
        </div>
    );
}