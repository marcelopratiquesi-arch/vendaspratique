import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient.js';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import {
    Zap, ShieldAlert, Mail, Lock, Loader2, ArrowRight, ShieldCheck, Eye, EyeOff,
    ShoppingCart, Coins, Users, ClipboardList, AlertTriangle, CheckCircle2, ArrowLeft, KeyRound
} from 'lucide-react';

// ==========================================
// CONFIGURAÇÕES
// ==========================================
const CHAVE_EMAIL_LEMBRADO = 'pratique_lembrar_email';
const LARGURA_TELA_GRANDE = '(min-width: 1024px)';
const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

// Animações da tela (nomes com prefixo "pl-" para não conflitar com o resto do sistema)
const CSS_ANIMACOES = `
@keyframes pl-girar{to{transform:rotate(360deg)}}
@keyframes pl-pulsar{0%{transform:scale(.9);opacity:.6}100%{transform:scale(1.8);opacity:0}}
@keyframes pl-surgir{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
.pl-energia{animation:pl-girar 18s linear infinite}
.pl-orbita{animation:pl-girar 60s linear infinite}
.pl-contra{animation:pl-girar 60s linear infinite reverse}
.pl-onda{animation:pl-pulsar 3s ease-out infinite}
.pl-surgir{animation:pl-surgir .7s ease-out both}
.pl-surgir-2{animation:pl-surgir .7s .15s ease-out both}
@media (prefers-reduced-motion: reduce){.pl-energia,.pl-orbita,.pl-contra,.pl-onda,.pl-surgir,.pl-surgir-2{animation:none}}
`;

// ==========================================
// HOOKS
// ==========================================
const useTelaGrande = () => {
    const [grande, setGrande] = useState(() => typeof window !== 'undefined' && window.matchMedia(LARGURA_TELA_GRANDE).matches);
    useEffect(() => {
        const mql = window.matchMedia(LARGURA_TELA_GRANDE);
        const aoMudar = (e) => setGrande(e.matches);
        mql.addEventListener('change', aoMudar);
        return () => mql.removeEventListener('change', aoMudar);
    }, []);
    return grande;
};

// Hora atual, atualizada a cada "intervalo" ms
const useAgora = (intervalo) => {
    const [agora, setAgora] = useState(() => new Date());
    useEffect(() => {
        const id = setInterval(() => setAgora(new Date()), intervalo);
        return () => clearInterval(id);
    }, [intervalo]);
    return agora;
};

// Diminui a órbita em telas mais baixas (notebook), para nunca cortar
const useEscalaOrbita = () => {
    const [escala, setEscala] = useState(1);
    useEffect(() => {
        const calcular = () => {
            const porAltura = (window.innerHeight - 200) / 560;
            const porLargura = (window.innerWidth / 2 - 96) / 600;
            setEscala(Math.max(0.6, Math.min(1, porAltura, porLargura)));
        };
        calcular();
        window.addEventListener('resize', calcular);
        return () => window.removeEventListener('resize', calcular);
    }, []);
    return escala;
};

// ==========================================
// SELETOR DE IDIOMA (PT · EN · ES, sem bandeira)
// ==========================================
const SeletorIdioma = ({ tema }) => {
    const ctx = useI18n() || {};
    const atual = String(ctx.locale || ctx.language || ctx.idioma || '').toLowerCase();
    const mudar = ctx.setLocale || ctx.setLanguage || ctx.changeLanguage || ctx.setIdioma;
    const listaBruta = ctx.availableLocales || ctx.languages || ctx.idiomas || ctx.locales || [];
    const codigos = (Array.isArray(listaBruta) ? listaBruta : Object.keys(listaBruta))
        .map((item) => (typeof item === 'string' ? item : item?.code || item?.codigo || item?.id || ''))
        .filter(Boolean);
    const opcoes = ['pt', 'en', 'es']
        .map((prefixo) => ({ rotulo: prefixo.toUpperCase(), codigo: codigos.find((c) => String(c).toLowerCase().startsWith(prefixo)) }))
        .filter((o) => o.codigo);

    // Se o sistema de idiomas não expõe o necessário, usa o seletor que já existe
    if (typeof mudar !== 'function' || opcoes.length < 2) {
        return <LanguageSwitcher compact={true} posicao="abaixo-direita" />;
    }

    const escuro = tema === 'escuro';
    return (
        <div role="group" aria-label="Idioma" className={`flex gap-0.5 p-[3px] rounded-[11px] ${escuro ? 'bg-white/[0.07]' : 'bg-slate-100'}`}>
            {opcoes.map(({ rotulo, codigo }) => {
                const ativo = atual.startsWith(rotulo.toLowerCase());
                return (
                    <button
                        key={codigo}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() => mudar(codigo)}
                        className={`h-[30px] px-[11px] rounded-lg text-[11px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                            ativo
                                ? `font-extrabold text-slate-900 bg-white ${escuro ? '' : 'shadow-sm'}`
                                : `font-bold ${escuro ? 'text-slate-300 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`
                        }`}
                    >
                        {rotulo}
                    </button>
                );
            })}
        </div>
    );
};

// ==========================================
// ÓRBITA COM RELÓGIO (só no computador)
// ==========================================
const MODULOS = [
    { rotulo: 'Vendas', icone: ShoppingCart, cor: 'ciano', pos: { top: -26, left: '50%', marginLeft: -50 } },
    { rotulo: 'Comissões', icone: Coins, cor: 'lilas', pos: { top: '50%', right: -50, marginTop: -40 } },
    { rotulo: 'Alunos', icone: Users, cor: 'ciano', pos: { bottom: -26, left: '50%', marginLeft: -50 } },
    { rotulo: 'Avaliações', icone: ClipboardList, cor: 'lilas', pos: { top: '50%', left: -50, marginTop: -40 } },
];

const Ponteiro = ({ angulo, largura, altura, cor, brilho }) => (
    <div className="absolute inset-0" style={{ transform: `rotate(${angulo}deg)` }} aria-hidden="true">
        <div
            className="absolute left-1/2 bottom-1/2"
            style={{ width: largura, height: altura, marginLeft: -largura / 2, borderRadius: largura, background: cor, boxShadow: `0 0 12px ${brilho}` }}
        />
    </div>
);

const RelogioOrbital = ({ escala }) => {
    const agora = useAgora(1000);
    const h = agora.getHours();
    const m = agora.getMinutes();
    const s = agora.getSeconds();
    const anguloHoras = (h % 12) * 30 + m * 0.5;
    const anguloMinutos = m * 6 + s * 0.1;
    const anguloSegundos = s * 6;
    const horaTexto = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const dataTexto = `${DIAS[agora.getDay()]} ${String(agora.getDate()).padStart(2, '0')} ${MESES[agora.getMonth()]}`;
    const fonteMono = { fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace" };

    return (
        <div style={{ width: 500 * escala, height: 500 * escala }}>
            <div
                className="relative"
                style={{ width: 500, height: 500, transform: `scale(${escala})`, transformOrigin: 'top left' }}
                role="img"
                aria-label={`Relógio marcando ${horaTexto}, com vendas, comissões, alunos e avaliações em órbita`}
            >
                <div className="absolute inset-0 rounded-full border border-dashed border-white/[0.14]" aria-hidden="true" />

                {/* Mostrador */}
                <div
                    className="absolute rounded-full"
                    style={{
                        inset: 72,
                        background: 'radial-gradient(circle at 50% 40%, #121c33 0%, #0a1020 70%)',
                        border: '1px solid rgba(103,232,249,0.28)',
                        boxShadow: '0 0 0 10px rgba(103,232,249,0.04), 0 30px 80px rgba(2,6,23,0.6), inset 0 0 40px rgba(59,130,246,0.15)',
                    }}
                    aria-hidden="true"
                />
                {/* Marcação dos minutos */}
                <div
                    className="absolute rounded-full"
                    style={{
                        inset: 84,
                        background: 'repeating-conic-gradient(from -0.6deg, rgba(226,232,240,0.38) 0 1.2deg, transparent 1.2deg 6deg)',
                        WebkitMask: 'radial-gradient(circle, transparent 0 63%, #000 63.5% 67%, transparent 67.5%)',
                        mask: 'radial-gradient(circle, transparent 0 63%, #000 63.5% 67%, transparent 67.5%)',
                    }}
                    aria-hidden="true"
                />
                {/* Marcação das horas */}
                <div
                    className="absolute rounded-full"
                    style={{
                        inset: 84,
                        background: 'repeating-conic-gradient(from -1.2deg, #67e8f9 0 2.4deg, transparent 2.4deg 30deg)',
                        WebkitMask: 'radial-gradient(circle, transparent 0 59%, #000 59.5% 67%, transparent 67.5%)',
                        mask: 'radial-gradient(circle, transparent 0 59%, #000 59.5% 67%, transparent 67.5%)',
                    }}
                    aria-hidden="true"
                />

                {/* Números */}
                <span className="absolute left-1/2 -translate-x-1/2 text-[14px] font-bold text-slate-200" style={{ top: 132, ...fonteMono }} aria-hidden="true">12</span>
                <span className="absolute top-1/2 -translate-y-1/2 text-[14px] font-bold text-slate-200" style={{ right: 134, ...fonteMono }} aria-hidden="true">3</span>
                <span className="absolute left-1/2 -translate-x-1/2 text-[14px] font-bold text-slate-200" style={{ bottom: 132, ...fonteMono }} aria-hidden="true">6</span>
                <span className="absolute top-1/2 -translate-y-1/2 text-[14px] font-bold text-slate-200" style={{ left: 134, ...fonteMono }} aria-hidden="true">9</span>

                {/* Janela digital */}
                <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5" style={{ bottom: 170 }} aria-hidden="true">
                    <span className="text-[18px] font-bold text-white tracking-[0.04em]" style={fonteMono}>{horaTexto}</span>
                    <span className="text-[10px] font-medium text-slate-400 tracking-[0.18em]" style={fonteMono}>{dataTexto}</span>
                </div>

                {/* Ponteiros */}
                <Ponteiro angulo={anguloHoras} largura={8} altura={82} cor="#e2e8f0" brilho="rgba(226,232,240,0.4)" />
                <Ponteiro angulo={anguloMinutos} largura={5} altura={128} cor="#c4b5fd" brilho="rgba(196,181,253,0.5)" />
                <div className="absolute inset-0" style={{ transform: `rotate(${anguloSegundos}deg)` }} aria-hidden="true">
                    <div className="absolute left-1/2 bottom-1/2" style={{ width: 2, height: 150, marginLeft: -1, background: '#67e8f9', boxShadow: '0 0 10px #22d3ee' }} />
                    <div className="absolute left-1/2 top-1/2" style={{ width: 2, height: 30, marginLeft: -1, background: '#67e8f9' }} />
                </div>

                {/* Centro: raio pulsando */}
                <div className="absolute top-1/2 left-1/2 w-16 h-16 -mt-8 -ml-8 flex items-center justify-center" aria-hidden="true">
                    <div className="pl-onda absolute inset-0 rounded-full border-2 border-cyan-300/70" />
                    <div className="w-[52px] h-[52px] rounded-full bg-blue-500 flex items-center justify-center" style={{ boxShadow: '0 0 40px rgba(59,130,246,0.8)' }}>
                        <Zap className="w-6 h-6 text-white" fill="currentColor" strokeWidth={1} />
                    </div>
                </div>

                {/* Módulos em órbita */}
                <div className="pl-orbita absolute inset-0" aria-hidden="true">
                    {MODULOS.map(({ rotulo, icone: Icone, cor, pos }) => (
                        <div key={rotulo} className="absolute w-[100px]" style={pos}>
                            <div className="pl-contra flex flex-col items-center gap-1.5">
                                <span className={`w-[52px] h-[52px] rounded-2xl bg-[#111a2e] border flex items-center justify-center ${cor === 'ciano' ? 'border-cyan-300/45 text-cyan-300' : 'border-violet-300/50 text-violet-300'}`}>
                                    <Icone className="w-[22px] h-[22px]" />
                                </span>
                                <span className="text-[12px] font-extrabold text-slate-200">{rotulo}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ==========================================
// TELA DE LOGIN
// ==========================================
export default function Login({ onLogin }) {
    const { t } = useI18n();
    const telaGrande = useTelaGrande();
    const escalaOrbita = useEscalaOrbita();
    const agoraMinuto = useAgora(60000);

    // Tradução com reserva em português (chaves novas podem não existir no arquivo de idiomas)
    const tr = useCallback((chave, padrao) => {
        const res = t(chave);
        return res && res !== chave && String(res).trim() !== '' ? res : padrao;
    }, [t]);

    const [modo, setModo] = useState('login'); // login | esqueci | nova
    const [email, setEmail] = useState(() => {
        try { return localStorage.getItem(CHAVE_EMAIL_LEMBRADO) || ''; } catch { return ''; }
    });
    const [lembrar, setLembrar] = useState(() => {
        try { return Boolean(localStorage.getItem(CHAVE_EMAIL_LEMBRADO)); } catch { return false; }
    });
    const [password, setPassword] = useState('');
    const [novaSenha, setNovaSenha] = useState('');
    const [confirmarSenha, setConfirmarSenha] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [capsLock, setCapsLock] = useState(false);
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');
    const [aviso, setAviso] = useState('');

    // Link de "esqueci minha senha": o Supabase volta para o sistema em modo de recuperação
    useEffect(() => {
        if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) setModo('nova');
        const { data } = supabase.auth.onAuthStateChange((evento) => {
            if (evento === 'PASSWORD_RECOVERY') setModo('nova');
        });
        return () => data?.subscription?.unsubscribe();
    }, []);

    const trocarModo = (novo) => {
        setModo(novo);
        setErro('');
        setAviso('');
        setPassword('');
        setNovaSenha('');
        setConfirmarSenha('');
    };

    const verificarCapsLock = (e) => {
        if (typeof e.getModifierState === 'function') setCapsLock(e.getModifierState('CapsLock'));
    };

    // ---------- ENTRAR (mesma lógica de antes) ----------
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErro('');
        setAviso('');

        try {
            const emailLimpo = email.toLowerCase().trim();
            const { error: authError } = await supabase.auth.signInWithPassword({ email: emailLimpo, password });
            if (authError) throw new Error(t('auth.error.credentials'));

            const { data: perfilData, error: perfilError } = await supabase
                .from('usuarios_sistema')
                .select('nome, role, unidade')
                .eq('email', emailLimpo)
                .single();

            if (perfilError || !perfilData) {
                await supabase.auth.signOut();
                throw new Error(t('auth.error.permission'));
            }

            try {
                if (lembrar) localStorage.setItem(CHAVE_EMAIL_LEMBRADO, emailLimpo);
                else localStorage.removeItem(CHAVE_EMAIL_LEMBRADO);
            } catch { /* navegador sem acesso ao armazenamento: segue normalmente */ }

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

    // ---------- ESQUECI MINHA SENHA ----------
    const handleEsqueci = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErro('');
        setAviso('');
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
                redirectTo: window.location.origin
            });
            if (error) throw error;
            // Mensagem igual exista ou não o e-mail (não revela quem tem cadastro)
            setAviso(tr('auth.resetSent', 'Se este e-mail estiver cadastrado, você vai receber um link para criar uma nova senha. Confira também a caixa de spam.'));
        } catch (error) {
            console.error('Erro ao enviar recuperação de senha:', error);
            setErro(tr('auth.resetError', 'Não foi possível enviar o link agora. Tente novamente em alguns minutos.'));
        } finally {
            setLoading(false);
        }
    };

    // ---------- CRIAR NOVA SENHA (depois de clicar no link do e-mail) ----------
    const handleNovaSenha = async (e) => {
        e.preventDefault();
        setErro('');
        setAviso('');
        if (novaSenha.length < 6) return setErro(tr('auth.passwordTooShort', 'A senha precisa ter pelo menos 6 caracteres.'));
        if (novaSenha !== confirmarSenha) return setErro(tr('auth.passwordMismatch', 'As duas senhas não são iguais.'));

        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: novaSenha });
            if (error) throw error;
            await supabase.auth.signOut();
            if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
            trocarModo('login');
            setAviso(tr('auth.passwordChanged', 'Senha alterada! Agora entre com a nova senha.'));
        } catch (error) {
            console.error('Erro ao salvar nova senha:', error);
            setErro(tr('auth.passwordChangeError', 'Não foi possível salvar a nova senha. O link pode ter expirado: peça um novo em "Esqueci minha senha".'));
        } finally {
            setLoading(false);
        }
    };

    // ---------- TEXTOS ----------
    const hora = agoraMinuto.getHours();
    const saudacao = hora < 12 ? tr('auth.goodMorning', 'Bom dia') : hora < 18 ? tr('auth.goodAfternoon', 'Boa tarde') : tr('auth.goodEvening', 'Boa noite');
    const titulos = {
        login: tr('auth.title', 'Entrar'),
        esqueci: tr('auth.forgotTitle', 'Recuperar senha'),
        nova: tr('auth.newPasswordTitle', 'Criar nova senha'),
    };
    const subtitulos = {
        login: tr('auth.tagline', 'Vendas e comissões da rede em um só lugar.'),
        esqueci: tr('auth.forgotSubtitle', 'Informe seu e-mail corporativo. Vamos enviar um link para você criar uma nova senha.'),
        nova: tr('auth.newPasswordSubtitle', 'Escolha uma nova senha para acessar o sistema.'),
    };

    // ---------- ESTILOS POR TEMA (escuro = computador, claro = celular) ----------
    const escuro = telaGrande;
    const c = escuro
        ? {
            saudacao: 'text-violet-300',
            titulo: 'text-white text-5xl',
            sub: 'text-slate-400',
            rotulo: 'text-slate-300',
            campo: 'bg-white/5 border border-white/15 focus-within:border-cyan-300 focus-within:ring-4 focus-within:ring-cyan-300/15',
            input: 'text-white placeholder-slate-500',
            icone: 'text-slate-400 group-focus-within:text-cyan-300',
            olho: 'text-slate-400 hover:text-white',
            link: 'text-cyan-300 hover:text-cyan-200',
            check: 'accent-cyan-400',
            textoCheck: 'text-slate-300',
            botao: 'bg-blue-500 hover:bg-blue-400 shadow-[0_14px_40px_rgba(59,130,246,0.45)]',
            alturaCampo: 'h-[58px]',
            alturaBotao: 'h-[60px]',
        }
        : {
            saudacao: 'text-blue-600',
            titulo: 'text-slate-900 text-[34px]',
            sub: 'text-slate-500',
            rotulo: 'text-slate-700',
            campo: 'bg-white border border-slate-300 focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-600/10',
            input: 'text-slate-900 placeholder-slate-400',
            icone: 'text-slate-400 group-focus-within:text-blue-600',
            olho: 'text-slate-500 hover:text-slate-800',
            link: 'text-blue-600 hover:text-blue-700',
            check: 'accent-blue-600',
            textoCheck: 'text-slate-700',
            botao: 'bg-blue-600 hover:bg-blue-700',
            alturaCampo: 'h-[52px]',
            alturaBotao: 'h-[54px]',
        };

    // Funções de desenho (não componentes): assim os campos não perdem o foco a cada tecla digitada
    const renderCampo = (id, rotulo, Icone, children) => (
        <div className="flex flex-col gap-2">
            <label htmlFor={id} className={`text-[12px] font-bold cursor-pointer ${c.rotulo}`}>{rotulo}</label>
            <div className={`group ${c.alturaCampo} rounded-2xl flex items-center gap-3 pl-[18px] pr-2 transition-all ${c.campo}`}>
                <Icone className={`w-[18px] h-[18px] shrink-0 transition-colors ${c.icone}`} />
                {children}
            </div>
        </div>
    );

    const classeInput = `flex-1 min-w-0 bg-transparent border-none outline-none text-[15px] font-semibold ${c.input}`;

    const renderBotao = (texto, textoCarregando) => (
        <button
            type="submit"
            disabled={loading}
            className={`${c.alturaBotao} mt-1.5 rounded-2xl text-white text-[15px] font-extrabold flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] disabled:opacity-60 outline-none focus-visible:ring-4 focus-visible:ring-blue-400/40 ${c.botao}`}
        >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> {textoCarregando}</> : <>{texto} <ArrowRight className="w-4 h-4" strokeWidth={2.5} /></>}
        </button>
    );

    const formulario = (
        <div className="w-full max-w-[420px] flex flex-col gap-8">
            <div className="flex flex-col gap-2.5">
                {modo === 'login' && <span className={`text-[14px] font-extrabold ${c.saudacao}`}>{saudacao}, {tr('auth.team', 'equipe Pratique')}.</span>}
                <h1 className={`m-0 font-black tracking-[-0.04em] leading-none ${c.titulo}`}>{titulos[modo]}</h1>
                <p className={`m-0 text-[15px] leading-relaxed ${c.sub}`}>{subtitulos[modo]}</p>
            </div>

            {erro && (
                <div role="alert" className={`flex items-start gap-3 p-4 rounded-2xl text-[13px] font-bold ${escuro ? 'bg-rose-500/10 border border-rose-400/25 text-rose-300' : 'bg-rose-50 border border-rose-200 text-rose-700'}`}>
                    <ShieldAlert className="w-5 h-5 shrink-0 mt-px" />
                    <p className="m-0 leading-snug">{erro}</p>
                </div>
            )}
            {aviso && (
                <div role="status" className={`flex items-start gap-3 p-4 rounded-2xl text-[13px] font-bold ${escuro ? 'bg-emerald-500/10 border border-emerald-400/25 text-emerald-300' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-px" />
                    <p className="m-0 leading-snug">{aviso}</p>
                </div>
            )}

            {modo === 'login' && (
                <form onSubmit={handleLogin} className="flex flex-col gap-[18px]">
                    {renderCampo("login-email", t('auth.emailLabel'), Mail, (<>
                        <input id="login-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="nome@pratique.com" className={classeInput} />
                    </>))}

                    <div className="flex flex-col gap-2">
                        {renderCampo("login-password", t('auth.passwordLabel'), Lock, (<>
                            <input
                                id="login-password"
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={verificarCapsLock}
                                onKeyUp={verificarCapsLock}
                                onBlur={() => setCapsLock(false)}
                                required
                                placeholder="••••••••"
                                className={classeInput}
                            />
                            <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${c.olho}`}>
                                {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                            </button>
                        </>))}
                        {capsLock && (
                            <span className={`flex items-center gap-1.5 text-[12px] font-semibold ${escuro ? 'text-amber-300' : 'text-amber-700'}`}>
                                <AlertTriangle className="w-3.5 h-3.5" /> {tr('auth.capsLock', 'Caps Lock está ativado')}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <label className={`flex items-center gap-2 text-[13px] font-semibold cursor-pointer min-h-[44px] ${c.textoCheck}`}>
                            <input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} className={`w-[18px] h-[18px] m-0 ${c.check}`} />
                            {tr('auth.rememberEmail', 'Lembrar meu e-mail')}
                        </label>
                        <button type="button" onClick={() => trocarModo('esqueci')} className={`text-[13px] font-bold min-h-[44px] transition-colors ${c.link}`}>
                            {tr('auth.forgotPassword', 'Esqueci minha senha')}
                        </button>
                    </div>

                    {renderBotao(tr('auth.enter', 'Entrar no sistema'), t('auth.authenticating'))}
                </form>
            )}

            {modo === 'esqueci' && (
                <form onSubmit={handleEsqueci} className="flex flex-col gap-[18px]">
                    {renderCampo("reset-email", t('auth.emailLabel'), Mail, (<>
                        <input id="reset-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="nome@pratique.com" className={classeInput} />
                    </>))}
                    {renderBotao(tr('auth.sendLink', 'Enviar link'), tr('auth.sending', 'Enviando...'))}
                    <button type="button" onClick={() => trocarModo('login')} className={`flex items-center justify-center gap-1.5 text-[13px] font-bold min-h-[44px] transition-colors ${c.link}`}>
                        <ArrowLeft className="w-4 h-4" /> {tr('auth.backToLogin', 'Voltar para o login')}
                    </button>
                </form>
            )}

            {modo === 'nova' && (
                <form onSubmit={handleNovaSenha} className="flex flex-col gap-[18px]">
                    {renderCampo("nova-senha", tr('auth.newPassword', 'Nova senha'), KeyRound, (<>
                        <input id="nova-senha" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} required minLength={6} className={classeInput} />
                        <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${c.olho}`}>
                            {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                        </button>
                    </>))}
                    {renderCampo("confirmar-senha", tr('auth.confirmPassword', 'Repita a nova senha'), KeyRound, (<>
                        <input id="confirmar-senha" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} required minLength={6} className={classeInput} />
                    </>))}
                    {renderBotao(tr('auth.saveNewPassword', 'Salvar nova senha'), tr('auth.saving', 'Salvando...'))}
                </form>
            )}
        </div>
    );

    const rodapeSeguro = (
        <span className={`flex items-center gap-1.5 text-[12px] font-semibold ${escuro ? 'text-slate-400' : 'text-slate-500'}`}>
            <ShieldCheck className={`w-3.5 h-3.5 ${escuro ? 'text-emerald-400' : 'text-emerald-600'}`} />
            {tr('auth.secure', 'Conexão segura')}
        </span>
    );

    const logo = (
        <div className="flex items-center gap-2.5">
            {escuro ? (
                <Zap className="w-[22px] h-[22px] text-cyan-300" fill="currentColor" strokeWidth={1} />
            ) : (
                <div className="w-9 h-9 rounded-[11px] bg-blue-600 flex items-center justify-center">
                    <Zap className="w-[18px] h-[18px] text-white" fill="currentColor" strokeWidth={1} />
                </div>
            )}
            <div className={escuro ? 'flex items-center gap-2.5' : 'flex flex-col gap-px'}>
                <span className={`text-[16px] font-black tracking-[-0.02em] ${escuro ? 'text-white' : 'text-slate-900'}`}>PRATIQUE</span>
                <span className={`text-[9px] font-extrabold tracking-[0.24em] ${escuro ? 'text-cyan-300' : 'text-blue-600'}`}>VENDAS</span>
            </div>
        </div>
    );

    // ==========================================
    // CELULAR: branco e enxuto (sem animações pesadas)
    // ==========================================
    if (!telaGrande) {
        return (
            <div className="min-h-dvh bg-white text-slate-900 font-sans flex flex-col px-6 pt-5 pb-7">
                <div className="flex items-center justify-between">
                    {logo}
                    <SeletorIdioma tema="claro" />
                </div>
                <main className="flex-1 flex flex-col justify-center py-8">{formulario}</main>
                <div className="flex justify-center">{rodapeSeguro}</div>
            </div>
        );
    }

    // ==========================================
    // COMPUTADOR: órbita com relógio + login
    // ==========================================
    return (
        <div className="relative min-h-dvh overflow-hidden bg-[#070a16] text-slate-200 font-sans">
            <style>{CSS_ANIMACOES}</style>

            {/* Fundo: luz girando atrás da órbita + textura de pontos */}
            <div
                className="pl-energia absolute rounded-full pointer-events-none"
                style={{ top: '50%', left: '30%', width: 900, height: 900, margin: '-450px 0 0 -450px', background: 'conic-gradient(from 0deg, #2563eb, #22d3ee, #7c3aed, #2563eb, transparent 72%, #2563eb)', filter: 'blur(140px)', opacity: 0.34 }}
                aria-hidden="true"
            />
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '30px 30px' }} aria-hidden="true" />

            <header className="absolute top-10 left-16 right-16 z-20 flex items-center justify-between">
                {logo}
                <SeletorIdioma tema="escuro" />
            </header>

            <main className="relative z-10 min-h-dvh px-16 py-28 grid grid-cols-2 items-center gap-12">
                <div className="pl-surgir flex justify-center">
                    <RelogioOrbital escala={escalaOrbita} />
                </div>
                <div className="pl-surgir-2 flex justify-center">{formulario}</div>
            </main>

            <footer className="absolute bottom-8 left-16 right-16 z-20 flex items-center justify-between">
                {rodapeSeguro}
            </footer>
        </div>
    );
}