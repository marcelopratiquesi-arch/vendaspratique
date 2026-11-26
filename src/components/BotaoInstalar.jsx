import React, { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { tx } from '../i18n/traduzir.js';
import { ehAppInstalado } from './appInstalado.js';

// ==========================================
// FAIXA "INSTALAR O APLICATIVO" (25/11/2026, decisão do dono: aparece para TODOS)
// Só no celular e só quando o sistema ainda não está instalado. Fica embaixo, para não tapar a barra do topo.
// Android/Chrome: o botão instala direto. iPhone: mostra o passo a passo (Compartilhar > Adicionar à Tela de Início).
// "Agora não" esconde por 7 dias (guardado no celular).
// Também registra o ajudante do navegador (public/sw.js), sem o qual o Android não oferece instalar.
// ==========================================
const CHAVE = 'pratique_instalar_dispensado_em';
const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

const ehIphone = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);
const ehCelular = () => Boolean(window.matchMedia?.('(max-width: 767px)').matches);
const foiDispensado = () => {
    try { return Date.now() - (Number(localStorage.getItem(CHAVE)) || 0) < SEMANA_MS; } catch { return false; }
};

export default function BotaoInstalar() {
    const [evento, setEvento] = useState(null);
    // O iPhone não avisa sozinho que dá para instalar: a faixa aparece direto
    const [mostrar, setMostrar] = useState(() => ehIphone() && ehCelular() && !ehAppInstalado() && !foiDispensado());
    const [ajudaIphone, setAjudaIphone] = useState(false);

    useEffect(() => {
        if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
        if (ehAppInstalado() || !ehCelular() || foiDispensado()) return undefined;
        const aoOferecer = (e) => { e.preventDefault(); setEvento(e); setMostrar(true); };
        const aoInstalar = () => setMostrar(false);
        window.addEventListener('beforeinstallprompt', aoOferecer);
        window.addEventListener('appinstalled', aoInstalar);
        return () => {
            window.removeEventListener('beforeinstallprompt', aoOferecer);
            window.removeEventListener('appinstalled', aoInstalar);
        };
    }, []);

    const dispensar = () => {
        try { localStorage.setItem(CHAVE, String(Date.now())); } catch { /* sem armazenamento */ }
        setMostrar(false);
    };

    const instalar = async () => {
        if (evento) {
            evento.prompt();
            await evento.userChoice.catch(() => {});
            setEvento(null);
            setMostrar(false);
        } else {
            setAjudaIphone(true);
        }
    };

    // Avisa as outras peças (cartões do canto, fim da tela) da altura da faixa, para ela não tapar nada (26/11/2026)
    useEffect(() => {
        const raiz = document.documentElement;
        raiz.style.setProperty('--faixa-instalar', mostrar ? (ajudaIphone ? '104px' : '68px') : '0px');
        return () => raiz.style.setProperty('--faixa-instalar', '0px');
    }, [mostrar, ajudaIphone]);

    if (!mostrar) return null;

    return (
        <div role="dialog" className="fixed bottom-0 inset-x-0 z-[9998] bg-[#0B1F4B] text-white px-4 pt-3 shadow-2xl border-t border-blue-500/40"
            style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
            <div className="flex items-center gap-3">
                <img src="/icons/icon-192.png" alt="" className="w-9 h-9 rounded-xl shrink-0" />
                <span className="flex-1 text-xs font-black uppercase tracking-widest leading-snug">
                    {tx('Instale o Vendas Pratique no seu celular')}
                </span>
                <button type="button" onClick={instalar}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-3 h-10 text-xs font-black uppercase tracking-widest">
                    <Download size={14} /> {tx('Instalar')}
                </button>
                <button type="button" onClick={dispensar} aria-label={tx('Agora não')} title={tx('Agora não')} className="shrink-0 -mr-1 p-2.5 text-white/70 hover:text-white">
                    <X size={18} />
                </button>
            </div>
            {ajudaIphone && (
                <p className="mt-2 flex flex-wrap items-center gap-1 text-[11px] font-bold">
                    {tx('No iPhone: toque em')} <Share size={14} className="inline" /> {tx('Compartilhar e depois em "Adicionar à Tela de Início".')}
                </p>
            )}
        </div>
    );
}
