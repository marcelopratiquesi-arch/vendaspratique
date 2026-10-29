import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import ptBR from './locales/pt-BR.js';
import enUS from './locales/en-US.js';
import esAR from './locales/es-AR.js';
import { setGlobalLocale } from '../pages/AnaliseVendas/utils.js'; // Ajuste o caminho se seu utils estiver em outro lugar
import { definirIdioma } from './traduzir.js';

const dicionarios = {
    'pt-BR': ptBR,
    'en-US': enUS,
    'es-AR': esAR
};

const I18nContext = createContext();

export const I18nProvider = ({ children }) => {
    const [locale, setLocale] = useState(() => {
        // Tenta recuperar do cache, senão lê o navegador, senão vai pro BR padrão
        const salvo = localStorage.getItem('pratique_locale');
        if (salvo && dicionarios[salvo]) return salvo;
        
        const langBrowser = navigator.language;
        if (langBrowser.startsWith('en')) return 'en-US';
        if (langBrowser.startsWith('es')) return 'es-AR';
        return 'pt-BR';
    });

    // A tradução por frase (tx) precisa saber o idioma ANTES de as telas serem desenhadas
    definirIdioma(locale);

    useEffect(() => {
        // Persiste a escolha, avisa o HTML (para Screen Readers) e avisa nosso utils.js
        localStorage.setItem('pratique_locale', locale);
        document.documentElement.lang = locale;
        setGlobalLocale(locale);
    }, [locale]);

    const t = useCallback((chave, variaveis = {}) => {
        // Procura no idioma atual, depois no Português, depois usa a frase reserva (defaultValue).
        // Nunca mostra o código da chave na tela quando existe uma frase reserva.
        const { defaultValue, ...valores } = variaveis || {};
        let texto = dicionarios[locale]?.[chave] ?? dicionarios['pt-BR']?.[chave] ?? defaultValue ?? chave;

        // Interpolação dinâmica. Ex: t('ola', { name: 'João' }) -> "Olá João" (troca todas as ocorrências)
        Object.keys(valores).forEach(variavel => {
            texto = String(texto).split(`{${variavel}}`).join(valores[variavel]);
        });

        return texto;
    }, [locale]);

    return (
        <I18nContext.Provider value={{ locale, setLocale, t }}>
            {children}
        </I18nContext.Provider>
    );
};

export const useI18n = () => useContext(I18nContext);