// ==========================================
// TELA CHEIA E RODAPÉ PRESO NO CELULAR (26/11/2026, projeto celular, grupo A)
// A área central do sistema (<main>) fica numa camada ABAIXO da barra do topo: uma janela "fixed" aberta ali
// dentro ficaria com o cabeçalho escondido. Por isso a peça é desenhada direto na caixa do app (fora do <main>),
// onde os z-index valem de igual para igual com o menu, os cartões do canto e as janelas do sistema.
// (Não pode ir para o <body>: a caixa do app é uma camada só, e a peça ficaria por cima de TUDO, até do menu.)
// ==========================================
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEhCelular } from '../../../components/celular/ehCelular.js';

const caixaDoApp = () => document.getElementById('root')?.firstElementChild || document.body;

// Só no celular desenha fora do <main>; no computador o filho fica exatamente onde sempre esteve
export const CamadaDoApp = ({ children }) => {
    const celular = useEhCelular();
    return celular ? createPortal(children, caixaDoApp()) : children;
};

// Altura da faixa "Instale o app" (gravada pelo BotaoInstalar na raiz da página)
const lerFaixaInstalar = () => parseFloat(document.documentElement.style.getPropertyValue('--faixa-instalar')) || 0;

const Rodape = ({ children }) => {
    const [barra, setBarra] = useState(null);
    const [altura, setAltura] = useState(0);
    const [faixa, setFaixa] = useState(lerFaixaInstalar);

    useEffect(() => {
        const obs = new MutationObserver(() => setFaixa(lerFaixaInstalar()));
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
        setFaixa(lerFaixaInstalar());
        return () => obs.disconnect();
    }, []);

    useEffect(() => {
        if (!barra) return undefined;
        const medir = () => setAltura(barra.offsetHeight);
        medir();
        if (typeof ResizeObserver === 'undefined') return undefined;
        const obs = new ResizeObserver(medir);
        obs.observe(barra);
        return () => obs.disconnect();
    }, [barra]);

    // Dentro da caixa do app, a mesma variável sobe o cartão "N pendências" e abre espaço no fim da tela,
    // para nada ficar em cima do botão do rodapé. Ao sair da tela, volta ao normal.
    useEffect(() => {
        const caixa = caixaDoApp();
        if (!altura || caixa === document.body) return undefined;
        caixa.style.setProperty('--faixa-instalar', `${faixa + altura}px`);
        return () => caixa.style.removeProperty('--faixa-instalar');
    }, [altura, faixa]);

    return (
        <>
            {/* Entre 640 e 767px o <main> não abre o espaço sozinho */}
            <div className="hidden sm:block md:hidden" style={{ height: altura }} aria-hidden="true" />
            {createPortal(
                <div ref={setBarra} style={{ bottom: faixa }}
                    className={`md:hidden fixed inset-x-0 z-[60] bg-white border-t border-slate-200 shadow-[0_-6px_20px_rgba(15,23,42,0.12)] px-4 pt-2.5 dark:bg-slate-900 dark:border-slate-800 ${faixa ? 'pb-2.5' : 'pb-[max(0.625rem,env(safe-area-inset-bottom))]'}`}>
                    {children}
                </div>,
                caixaDoApp()
            )}
        </>
    );
};

export const RodapeFixo = ({ children }) => (useEhCelular() ? <Rodape>{children}</Rodape> : null);
