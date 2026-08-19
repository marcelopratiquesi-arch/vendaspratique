import React, { useState } from 'react';
import { supabase } from '../supabaseClient.js';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { Zap, ShieldAlert, Mail, Lock, Loader2, LogIn, ShieldCheck, Eye, EyeOff } from 'lucide-react';

export default function Login({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');
    const { t } = useI18n();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErro('');

        try {
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: email.toLowerCase().trim(),
                password: password
            });

            if (authError) throw new Error(t('auth.error.credentials'));

            const { data: perfilData, error: perfilError } = await supabase
                .from('usuarios_sistema')
                .select('nome, role, unidade') 
                .eq('email', email.toLowerCase().trim())
                .single();

            if (perfilError || !perfilData) {
                await supabase.auth.signOut();
                throw new Error(t('auth.error.permission'));
            }

            onLogin({
                nome: perfilData.nome,
                role: perfilData.role,
                unidade: perfilData.unidade || 'MATRIZ'
            });

        } catch (error) {
            setErro(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-dvh bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans">
            
            {/* AMBIENTAÇÃO PREMIUM: Imagem de Academia */}
            <img 
                src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1920&auto=format&fit=crop" 
                alt="Ambiente Pratique" 
                className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none mix-blend-overlay"
            />

            {/* OVERLAY LÍQUIDO E LUZES AMBIENTAIS */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/80 to-slate-950/95 pointer-events-none"></div>
            
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" style={{ animationDelay: '2s' }}></div>

            {/* GLASS CARD PREMIUM */}
            <div className="w-full max-w-[440px] bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-[32px] shadow-[0_30px_80px_rgba(0,0,0,0.6)] p-8 sm:p-10 relative z-10 animate-[fadeIn_0.5s_ease-out] flex flex-col">
                
                {/* SELETOR DE IDIOMA INCORPORADO AO CARD */}
                <div className="absolute top-6 right-6 z-50">
                    <LanguageSwitcher />
                </div>

                {/* LOGO E TÍTULO */}
                <div className="text-center mb-8 mt-2">
                    <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(37,99,235,0.2)]">
                        <Zap className="w-8 h-8 text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.8)]" strokeWidth={2.5} />
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight mb-1">PRATIQUE <span className="text-blue-500">OS</span></h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('auth.portal')}</p>
                </div>

                {/* FORMULÁRIO */}
                <form onSubmit={handleLogin} className="space-y-5">
                    
                    {erro && (
                        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl flex items-start gap-3 text-sm font-bold shadow-lg backdrop-blur-sm">
                            <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <p className="leading-snug">{erro}</p>
                        </div>
                    )}

                    {/* INPUT DE E-MAIL (AGORA CLARO COM LETRA ESCURA) */}
                    <div>
                        <label htmlFor="login-email" className="block text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-2 ml-1 cursor-pointer">
                            {t('auth.emailLabel')}
                        </label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                                <Mail className="w-5 h-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                            </div>
                            <input 
                                id="login-email" 
                                type="email" 
                                value={email} 
                                onChange={(e) => setEmail(e.target.value)} 
                                required 
                                placeholder="nome@pratique.com" 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3.5 text-sm font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all shadow-inner"
                            />
                        </div>
                    </div>

                    {/* INPUT DE SENHA (AGORA CLARO COM LETRA ESCURA) */}
                    <div>
                        <label htmlFor="login-password" className="block text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-2 ml-1 cursor-pointer">
                            {t('auth.passwordLabel')}
                        </label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                                <Lock className="w-5 h-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                            </div>
                            <input 
                                id="login-password" 
                                type={showPassword ? "text" : "password"} 
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)} 
                                required 
                                placeholder="••••••••" 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-12 py-3.5 text-sm font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all shadow-inner"
                            />
                            {/* BOTÃO MOSTRAR SENHA (UX) */}
                            <button 
                                type="button" 
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-700 transition-colors z-10"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* BOTÃO PREMIUM GRADIENTE */}
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 text-white font-black uppercase tracking-widest py-4 rounded-xl shadow-[0_10px_30px_-10px_rgba(37,99,235,0.6)] hover:shadow-[0_10px_40px_-10px_rgba(37,99,235,0.8)] active:scale-[0.98] transition-all flex justify-center items-center gap-2 mt-8 text-xs border border-white/10"
                    >
                        {loading ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> {t('auth.authenticating')}</>
                        ) : (
                            <><LogIn className="w-4 h-4" /> {t('auth.button')}</>
                        )}
                    </button>
                </form>

                {/* SUPABASE BADGE */}
                <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-center gap-1.5 opacity-80">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {t('auth.protected')}
                    </span>
                </div>

            </div>
        </div>
    );
}