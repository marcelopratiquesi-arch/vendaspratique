import React, { useState, useRef, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { ChevronDown, Check } from 'lucide-react';
import { tx } from '../i18n/traduzir.js';

// ==========================================
// BANDEIRAS EMBUTIDAS
// ==========================================
const BandeiraBR = (props) => (
    <svg viewBox="0 0 20 14" {...props}>
        <rect width="20" height="14" fill="#009C3B" />
        <path d="M10 1.6 18 7l-8 5.4L2 7z" fill="#FFDF00" />
        <circle cx="10" cy="7" r="2.9" fill="#002776" />
    </svg>
);

const BandeiraUS = (props) => (
    <svg viewBox="0 0 20 14" {...props}>
        <rect width="20" height="14" fill="#FFFFFF" />
        {[0, 2, 4, 6, 8, 10, 12].map((i) => (
            <rect key={i} y={(i * 14) / 13} width="20" height={14 / 13} fill="#B22234" />
        ))}
        <rect width="8" height={(14 / 13) * 7} fill="#3C3B6E" />
    </svg>
);

const BandeiraAR = (props) => (
    <svg viewBox="0 0 20 14" {...props}>
        <rect width="20" height="14" fill="#74ACDF" />
        <rect y="4.67" width="20" height="4.66" fill="#FFFFFF" />
        <circle cx="10" cy="7" r="1.5" fill="#F6B40E" />
    </svg>
);

const languages = [
    { code: 'pt-BR', Bandeira: BandeiraBR, label: 'Português', region: 'Brasil' },
    { code: 'en-US', Bandeira: BandeiraUS, label: 'English', region: 'US' },
    { code: 'es-AR', Bandeira: BandeiraAR, label: 'Español', region: 'Argentina' }
];

export default function LanguageSwitcher({ compact = false, variant = 'dropdown', posicao = 'esquerda' }) {
    const { locale, setLocale } = useI18n();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const activeLanguage = languages.find((l) => l.code === locale) || languages[0];
    const BandeiraAtiva = activeLanguage.Bandeira;

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
        };
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const handleSelect = (code) => {
        setLocale(code);
        setIsOpen(false);
    };

    if (variant === 'lista') {
        return (
            <div role="radiogroup" aria-label={tx("Idioma / Language")} className="flex flex-col gap-0.5">
                {languages.map((lang) => {
                    const isSelected = locale === lang.code;
                    const Bandeira = lang.Bandeira;
                    return (
                        <button
                            key={lang.code}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => handleSelect(lang.code)}
                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                isSelected
                                    ? 'bg-blue-50 dark:bg-blue-500/15'
                                    : 'hover:bg-slate-100 dark:hover:bg-white/5'
                            }`}
                        >
                            <span className="flex items-center gap-2.5">
                                <Bandeira className="w-5 h-[14px] rounded-[2px] shrink-0" aria-hidden="true" />
                                <span className={`text-[13px] font-semibold ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {lang.label}
                                </span>
                            </span>
                            {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" strokeWidth={2.5} />}
                        </button>
                    );
                })}
            </div>
        );
    }

    // 🔥 LOGICA CORRIGIDA: Se for abaixo-direita, o menu encosta na direita (right-0) e cresce para a esquerda!
    let dropdownPositionClass = 'left-0 top-full mt-2 origin-top-left';
    if (compact) {
        if (posicao === 'abaixo-direita') {
            dropdownPositionClass = 'right-0 top-full mt-2 origin-top-right';
        } else {
            dropdownPositionClass = 'left-full top-0 ml-3 origin-top-left';
        }
    }

    return (
        <div className={`relative ${compact ? 'inline-flex shrink-0' : 'w-full'}`} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-label={tx("Idioma: {label}", { label: activeLanguage.label })}
                title={compact ? tx("Idioma: {label}", { label: activeLanguage.label }) : ''}
                className={`flex items-center transition-colors outline-none group ${
                    compact
                        ? 'w-9 h-9 justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500'
                        : 'w-full justify-between px-3 py-2 rounded-xl bg-slate-200/50 dark:bg-white/[0.03] hover:bg-slate-300/50 dark:hover:bg-white/[0.08] border border-slate-300/30 dark:border-white/5 shadow-sm focus:ring-2 focus:ring-blue-500/50'
                }`}
            >
                <div className="flex items-center gap-3">
                    <BandeiraAtiva className={compact ? 'w-[18px] h-[13px] rounded-[2px] ring-1 ring-black/10' : 'w-5 h-[14px] rounded-[3px] shadow-[0_2px_4px_rgba(0,0,0,0.1)]'} aria-hidden="true" />
                    {!compact && (
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{activeLanguage.label}</span>
                    )}
                </div>
                {!compact && (
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} strokeWidth={2.5} />
                )}
            </button>

            {isOpen && (
                <div
                    role="listbox"
                    className={`absolute z-50 ${dropdownPositionClass} w-[200px] bg-white/95 dark:bg-slate-900/95 border border-slate-200/60 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden animate-[fadeIn_0.15s_ease-out]`}
                >
                    <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                        <p className="text-[10px] font-black tracking-widest text-slate-500 dark:text-slate-400 uppercase">
                            {tx("Idioma / Language")}
                        </p>
                    </div>

                    <div className="flex flex-col p-2 gap-1">
                        {languages.map((lang) => {
                            const isSelected = locale === lang.code;
                            const Bandeira = lang.Bandeira;
                            return (
                                <button
                                    key={lang.code}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => handleSelect(lang.code)}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all outline-none focus:bg-slate-100 dark:focus:bg-slate-700 ${
                                        isSelected
                                            ? 'bg-blue-50/80 dark:bg-blue-500/15'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Bandeira className="w-5 h-[14px] rounded-[2px] opacity-90" aria-hidden="true" />
                                        <div className="flex flex-col text-left">
                                            <span className={`text-[13px] font-bold leading-none ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                {lang.label}
                                            </span>
                                            <span className={`text-[10px] font-bold mt-1 ${isSelected ? 'text-blue-500/80 dark:text-blue-500' : 'text-slate-500 dark:text-slate-400'}`}>
                                                {lang.region}
                                            </span>
                                        </div>
                                    </div>
                                    {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" strokeWidth={3} />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}