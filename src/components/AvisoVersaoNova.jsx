// ==========================================
// AVISO DE VERSÃO NOVA (decisão do dono, 05/11/2026 — opção "aviso com botão"; maior desde 07/11/2026)
// A cada 5 minutos (e quando a pessoa volta para a aba) o sistema baixa a página inicial publicada e compara o
// arquivo principal (/assets/index-XXXX.js, que muda a cada publicação no Vercel) com o que está rodando.
// Se mudou, aparece um aviso grande no topo: "Sistema atualizado — Recarregar". Com a pessoa usando, NÃO
// recarrega sozinho (para não apagar o que ela está digitando). Com o sistema PAUSADO por inatividade
// (pausaSistema.js) não confere nem recarrega (09/11/2026; de 07/11 a 09/11 recarregava sozinho): a cortina já abre
// na versão mais nova quando a pessoa volta, e recarregar com o login guardado baixaria tudo sem ninguém usando.
// No modo de desenvolvimento (npm run dev) não há arquivo com código, então nunca avisa.
// ==========================================
import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { tx } from '../i18n/traduzir.js';
import { sistemaPausado, recarregarNaVersaoMaisNova } from './pausaSistema.js';

const CINCO_MIN = 5 * 60 * 1000;
const scriptPrincipal = (html) => (String(html).match(/\/assets\/index-[\w-]+\.js/) || [])[0] || null;
const scriptAtual = () => {
    const s = [...document.querySelectorAll('script[src]')].map(x => x.getAttribute('src')).find(src => /\/assets\/index-[\w-]+\.js/.test(src || ''));
    return s ? scriptPrincipal(s) : null;
};

const AvisoVersaoNova = () => {
    const [temNova, setTemNova] = useState(false);
    const [recarregando, setRecarregando] = useState(false);
    const temNovaRef = useRef(false);

    useEffect(() => {
        const atual = scriptAtual();
        if (!atual) return undefined; // desenvolvimento: nada a comparar
        let parar = false;
        const conferir = async () => {
            if (parar || temNovaRef.current) return;
            // Pausado ou aba escondida: não confere. O computador pausado NÃO recarrega sozinho (09/11/2026): com o
            // login guardado, recarregar entraria baixando tudo sem ninguém na frente, a cada publicação. Quem volta
            // clica "Continuar" na cortina e já abre na versão mais nova.
            if (document.hidden || sistemaPausado()) return;
            try {
                const resp = await fetch(`/index.html?v=${Date.now()}`, { cache: 'no-store' });
                if (!resp.ok) return;
                const publicado = scriptPrincipal(await resp.text());
                if (publicado && publicado !== atual) {
                    temNovaRef.current = true;
                    setTemNova(true);
                }
            } catch { /* sem internet: tenta de novo depois */ }
        };
        const id = setInterval(conferir, CINCO_MIN);
        window.addEventListener('focus', conferir);
        document.addEventListener('visibilitychange', conferir);
        return () => { parar = true; clearInterval(id); window.removeEventListener('focus', conferir); document.removeEventListener('visibilitychange', conferir); };
    }, []);

    if (!temNova) return null;
    const recarregar = () => { setRecarregando(true); recarregarNaVersaoMaisNova(); };
    return (
        <div role="status" className="fixed top-4 left-1/2 -translate-x-1/2 z-[120] w-[min(640px,calc(100%-32px))] flex flex-wrap sm:flex-nowrap items-center gap-4 bg-blue-600 text-white rounded-2xl shadow-[0_10px_40px_rgba(37,99,235,0.45)] ring-4 ring-blue-300/40 dark:ring-blue-500/30 px-5 py-4 animate-[fadeIn_0.3s_ease-out]">
            <div className="w-12 h-12 shrink-0 rounded-full bg-white/15 flex items-center justify-center">
                <RefreshCw className={`w-6 h-6 ${recarregando ? 'animate-spin' : ''}`} />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-black uppercase tracking-widest">{tx('Sistema atualizado')}</p>
                <p className="text-xs font-semibold opacity-90 mt-0.5">{tx('Saiu uma versão nova. Recarregue para usar as novidades.')}</p>
                <p className="text-[11px] font-semibold opacity-75 mt-0.5">{tx('Se estiver no meio de um lançamento, termine e salve antes.')}</p>
            </div>
            <button type="button" onClick={recarregar} disabled={recarregando} className="w-full sm:w-auto shrink-0 h-11 px-5 rounded-xl bg-white text-blue-700 hover:bg-blue-50 disabled:opacity-70 text-xs font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">
                {recarregando ? tx('Atualizando...') : tx('Recarregar agora')}
            </button>
        </div>
    );
};

export default AvisoVersaoNova;
