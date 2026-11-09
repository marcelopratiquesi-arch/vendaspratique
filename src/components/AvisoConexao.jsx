// ==========================================
// AVISO DE CONEXÃO (decisão do dono, 09/11/2026)
// Antes, se a internet caía, nada avisava: a tela ficava parada como se estivesse tudo certo.
//  - Vermelho: o computador está SEM INTERNET (o navegador avisa na hora).
//  - Amarelo: tem internet, mas o "ao vivo" do banco caiu há mais de 20 s (está tentando voltar sozinho).
//  - Verde por 4 s: voltou (o App já recarrega o que mudou enquanto estava fora).
// Pausado por inatividade: não mostra (o "ao vivo" foi desligado de propósito).
// ==========================================
import React, { useEffect, useRef, useState } from 'react';
import { WifiOff, RefreshCw, Wifi } from 'lucide-react';
import { tx } from '../i18n/traduzir.js';

const ESPERA_AMARELO_MS = 20000; // quedas rápidas do "ao vivo" (ex.: troca de unidade) não assustam ninguém
const TEMPO_VERDE_MS = 4000;

export default function AvisoConexao({ semInternet, aoVivoOk, pausado }) {
    const [amarelo, setAmarelo] = useState(false);
    const [verde, setVerde] = useState(false);
    const teveProblema = useRef(false);

    // "Ao vivo" fora há mais de 20 s (com internet): amarelo
    useEffect(() => {
        if (aoVivoOk || semInternet) { setAmarelo(false); return undefined; }
        const t = setTimeout(() => setAmarelo(true), ESPERA_AMARELO_MS);
        return () => clearTimeout(t);
    }, [aoVivoOk, semInternet]);

    const problema = !pausado && (semInternet || amarelo);
    // Saiu do problema: verde por alguns segundos
    useEffect(() => {
        if (problema) { teveProblema.current = true; setVerde(false); return undefined; }
        if (!teveProblema.current || !aoVivoOk) return undefined;
        teveProblema.current = false;
        setVerde(true);
        const t = setTimeout(() => setVerde(false), TEMPO_VERDE_MS);
        return () => clearTimeout(t);
    }, [problema, aoVivoOk]);

    if (pausado || (!problema && !verde)) return null;

    let cor, Icone, titulo, texto;
    if (semInternet) {
        cor = 'bg-rose-600 text-white ring-rose-300/40 dark:ring-rose-500/30';
        Icone = WifiOff;
        titulo = tx('Sem internet');
        texto = tx('Os dados não estão atualizando. Confira a internet deste computador.');
    } else if (amarelo) {
        cor = 'bg-amber-400 text-amber-950 ring-amber-200/60 dark:ring-amber-500/30';
        Icone = RefreshCw;
        titulo = tx('Reconectando...');
        texto = tx('A atualização ao vivo caiu. Os dados podem estar desatualizados até voltar.');
    } else {
        cor = 'bg-emerald-600 text-white ring-emerald-300/40 dark:ring-emerald-500/30';
        Icone = Wifi;
        titulo = tx('Conexão de volta');
        texto = tx('Os dados foram atualizados.');
    }

    return (
        <div role="status" aria-live="polite" className={`fixed top-3 left-1/2 -translate-x-1/2 z-[110] w-[min(520px,calc(100%-32px))] flex items-center gap-3 rounded-2xl shadow-xl ring-4 px-4 py-2.5 animate-[fadeIn_0.3s_ease-out] ${cor}`}>
            <Icone className={`w-5 h-5 shrink-0 ${amarelo && !semInternet ? 'animate-spin' : ''}`} />
            <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-widest">{titulo}</p>
                <p className="text-[11px] font-semibold opacity-90">{texto}</p>
            </div>
        </div>
    );
}
