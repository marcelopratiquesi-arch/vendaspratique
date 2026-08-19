import React, { useState, useRef, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { ChevronDown, Check } from 'lucide-react';

const languages = [
    { code: 'pt-BR', flagUrl: 'https://flagcdn.com/w40/br.png', label: 'Português', region: 'Brasil' },
    { code: 'en-US', flagUrl: 'https://flagcdn.com/w40/us.png', label: 'English', region: 'US' },
    { code: 'es-AR', flagUrl: 'https://flagcdn.com/w40/ar.png', label: 'Español', region: 'Argentina' }
];

export default function LanguageSwitcher({ compact = false }) {
    const { locale, setLocale } = useI18n();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const activeLanguage = languages.find(l => l.code === locale) || languages[0];

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
        };
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') setIsOpen(false);
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const handleSelect = (code) => {
        setLocale(code);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${compact ? 'flex justify-center w-full' : 'w-full'}`} ref={dropdownRef}>
            
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-label={`Idioma: ${activeLanguage.label}`}
                title={compact ? `Idioma: ${activeLanguage.label}` : ''}
                className={`flex items-center transition-all duration-300 outline-none focus:ring-2 focus:ring-blue-500/50 group ${
                    compact 
                    ? 'w-10 h-10 justify-center rounded-xl hover:bg-slate-200/50 dark:hover:bg-white/5' 
                    : 'w-full justify-between px-3 py-2 rounded-xl bg-slate-200/50 dark:bg-white/[0.03] hover:bg-slate-300/50 dark:hover:bg-white/[0.08] border border-slate-300/30 dark:border-white/5 shadow-sm'
                }`}
            >
                <div className="flex items-center gap-3">
                    <img src={activeLanguage.flagUrl} alt={activeLanguage.label} className="w-5 h-auto rounded-[3px] shadow-[0_2px_4px_rgba(0,0,0,0.1)]" />
                    {!compact && (
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{activeLanguage.label}</span>
                    )}
                </div>
                {!compact && (
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} strokeWidth={2.5} />
                )}
            </button>

            {/* DROPDOWN GLASS PREMIUM */}
            {isOpen && (
                <div 
                    role="listbox"
                    className={`absolute z-50 ${compact ? 'left-full top-0 ml-4' : 'left-0 top-full mt-2'} w-[200px] bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-slate-200/60 dark:border-white/10 rounded-2xl shadow-[0_15px_40px_-10px_rgba(0,0,0,0.15)] dark:shadow-[0_15px_50px_-10px_rgba(0,0,0,0.6)] overflow-hidden animate-[fadeIn_0.2s_ease-out]`}
                >
                    <div className="px-4 py-2.5 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/20">
                        <p className="text-[9px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase">
                            Idioma / Language
                        </p>
                    </div>

                    <div className="flex flex-col p-2 gap-1">
                        {languages.map(lang => {
                            const isSelected = locale === lang.code;
                            
                            return (
                                <button
                                    key={lang.code}
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => handleSelect(lang.code)}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all outline-none focus:bg-slate-100 dark:focus:bg-white/10 ${
                                        isSelected 
                                        ? 'bg-blue-50/80 dark:bg-blue-600/10'
                                        : 'hover:bg-slate-50 dark:hover:bg-white/5'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <img src={lang.flagUrl} alt={lang.label} className="w-5 h-auto rounded-[2px] opacity-90" />
                                        <div className="flex flex-col text-left">
                                            <span className={`text-[13px] font-bold leading-none ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                {lang.label}
                                            </span>
                                            <span className={`text-[9px] font-bold mt-1 ${isSelected ? 'text-blue-500/80 dark:text-blue-500' : 'text-slate-400 dark:text-slate-500'}`}>
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