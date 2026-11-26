import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';

// ==========================================
// JANELA PADRÃO (26/11/2026, projeto celular)
// Computador: caixa no meio da tela, largura `largura` (px, cabe no celular com min(..., 100%)), até 90% da altura, corpo rola.
// Celular: TELA CHEIA (modo 'cheia', padrão) ou FOLHA QUE SOBE DE BAIXO (modo 'baixo', para janelas curtas: escolher uma opção).
// O rodapé (botões) fica sempre visível, com o espaço da barra do iPhone. Esc fecha. X de 40px.
// Use em toda janela nova. As antigas vão sendo trocadas tela por tela (sem mudar o que fazem).
//
// <Janela titulo="Editar venda" icone={Pencil} onFechar={fechar} rodape={<>...botões...</>}>conteúdo</Janela>
// ==========================================
const Janela = ({
    titulo, subtitulo, icone: Icone, onFechar, children, rodape,
    largura = 560, modoCelular = 'cheia', camada = 'z-[200]', fecharNoFundo = true, semCabecalho = false, classeCorpo = 'p-4 md:p-5',
}) => {
    useEffect(() => {
        if (!onFechar) return undefined;
        const aoTeclar = (e) => { if (e.key === 'Escape') onFechar(); };
        document.addEventListener('keydown', aoTeclar);
        return () => document.removeEventListener('keydown', aoTeclar);
    }, [onFechar]);

    const baixo = modoCelular === 'baixo';
    return (
        <div
            className={`fixed inset-0 ${camada} flex justify-center ${baixo ? 'items-end' : 'items-stretch'} md:items-center md:p-4 bg-slate-900/60 backdrop-blur-[2px]`}
            onMouseDown={(e) => { if (fecharNoFundo && onFechar && e.target === e.currentTarget) onFechar(); }}
            role="dialog" aria-modal="true"
        >
            <div
                style={{ '--largura-janela': `${largura}px` }}
                className={`w-full md:w-[min(var(--largura-janela),100%)] flex flex-col bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden
                    ${baixo ? 'max-h-[90dvh] rounded-t-2xl' : 'h-[100dvh] rounded-none'} md:h-auto md:max-h-[90dvh] md:rounded-2xl`}
            >
                {!semCabecalho && (
                    <div className="shrink-0 flex items-start gap-3 px-4 py-3 md:px-5 md:py-4 border-b border-slate-200 dark:border-slate-800">
                        {Icone && <Icone className="w-5 h-5 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />}
                        <div className="min-w-0 flex-1">
                            {titulo && <h2 className="text-[13px] font-black uppercase tracking-widest text-slate-800 dark:text-white break-words">{titulo}</h2>}
                            {subtitulo && <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 break-words">{subtitulo}</p>}
                        </div>
                        {onFechar && (
                            <button type="button" onClick={onFechar} aria-label={tx('Fechar')}
                                className="shrink-0 -m-1 w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                )}
                <div className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar ${classeCorpo}`}>{children}</div>
                {rodape && (
                    <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 px-4 pt-3 md:px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:flex-wrap">
                        {rodape}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Janela;
