// ==========================================
// AVISO DE VERSÃO NOVA (decisão do dono, 05/11/2026 — opção "aviso com botão")
// A cada 5 minutos (e quando a pessoa volta para a aba) o sistema baixa a página inicial publicada e compara o
// arquivo principal (/assets/index-XXXX.js, que muda a cada publicação no Vercel) com o que está rodando.
// Se mudou, aparece um aviso no topo: "Sistema atualizado — Recarregar". Não recarrega sozinho.
// No modo de desenvolvimento (npm run dev) não há arquivo com código, então nunca avisa.
// ==========================================
import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { tx } from '../i18n/traduzir.js';

const CINCO_MIN = 5 * 60 * 1000;
const scriptPrincipal = (html) => (String(html).match(/\/assets\/index-[\w-]+\.js/) || [])[0] || null;
const scriptAtual = () => {
    const s = [...document.querySelectorAll('script[src]')].map(x => x.getAttribute('src')).find(src => /\/assets\/index-[\w-]+\.js/.test(src || ''));
    return s ? scriptPrincipal(s) : null;
};

const AvisoVersaoNova = () => {
    const [temNova, setTemNova] = useState(false);

    useEffect(() => {
        const atual = scriptAtual();
        if (!atual) return undefined; // desenvolvimento: nada a comparar
        let parar = false;
        const conferir = async () => {
            if (parar || document.hidden) return;
            try {
                const resp = await fetch(`/index.html?v=${Date.now()}`, { cache: 'no-store' });
                if (!resp.ok) return;
                const publicado = scriptPrincipal(await resp.text());
                if (publicado && publicado !== atual) { setTemNova(true); parar = true; }
            } catch { /* sem internet: tenta de novo depois */ }
        };
        const id = setInterval(conferir, CINCO_MIN);
        window.addEventListener('focus', conferir);
        document.addEventListener('visibilitychange', conferir);
        return () => { parar = true; clearInterval(id); window.removeEventListener('focus', conferir); document.removeEventListener('visibilitychange', conferir); };
    }, []);

    if (!temNova) return null;
    return (
        <div role="status" className="fixed top-3 left-1/2 -translate-x-1/2 z-[120] w-[min(460px,calc(100%-32px))] flex items-center gap-3 bg-blue-600 text-white rounded-2xl shadow-2xl px-4 py-3 animate-[fadeIn_0.3s_ease-out]">
            <RefreshCw className="w-5 h-5 shrink-0" />
            <div className="min-w-0 flex-1">
                <p className="text-[12px] font-black uppercase tracking-widest">{tx('Sistema atualizado')}</p>
                <p className="text-[11px] font-semibold opacity-90">{tx('Saiu uma versão nova. Recarregue para usar as novidades.')}</p>
            </div>
            <button type="button" onClick={() => window.location.reload()} className="shrink-0 h-9 px-3 rounded-xl bg-white text-blue-700 hover:bg-blue-50 text-[11px] font-black uppercase tracking-widest">
                {tx('Recarregar')}
            </button>
        </div>
    );
};

export default AvisoVersaoNova;
