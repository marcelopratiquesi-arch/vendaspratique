// ==========================================
// CARTÃO DE PENDÊNCIAS NO CANTO (decisão do dono, 05/11/2026) — Líder e Mentor.
// Substituiu o antigo aviso só da Movimentação (AvisoMovimentoLider): agora mostra Conferência, Movimentação
// e Metas, em todas as telas, enquanto houver o que fazer. Cada linha some sozinha quando a pessoa preenche
// (o banco avisa em tempo real). "Depois" esconde por 1 hora. Fica escondido enquanto a janela do login está aberta.
// ==========================================
import React, { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';
import { pedirConferirRelatorio } from './relatorioFechamento.js';

const UMA_HORA = 60 * 60 * 1000;
const MAX_UNIDADES_MENTOR = 4;
const juntarCampos = (lista) => lista.map(c => tx(c)).join(', ');
const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const Link = ({ onClick, children }) => (
    <button type="button" onClick={onClick} className="shrink-0 text-[10px] font-black uppercase tracking-widest text-blue-700 hover:underline dark:text-blue-400">{children}</button>
);

// Linhas curtas de uma unidade
const Linhas = ({ u, aoIr, podeConferirRelatorio }) => {
    const itens = [];
    const c = u.conferencia;
    if (c) itens.push({
        k: 'c', atrasado: c.atrasado,
        texto: c.atrasado ? tx('Conferência: {qtd} vendas atrasadas', { qtd: c.qtd }) : tx('Hoje é dia de conferência ({qtd} vendas)', { qtd: c.semanaAtual?.qtd || 0 }),
        botao: tx('Conferir'), tipo: 'conferencia',
    });
    if (u.movimento.length) {
        const so = u.movimento.length === 1 ? u.movimento[0] : null;
        itens.push({
            k: 'm', atrasado: u.movimento.some(d => !d.hoje),
            texto: so
                ? (so.semLancamento
                    ? tx('Movimentação {dia}: não lançou', { dia: so.hoje ? tx('de hoje') : ddmm(so.data) })
                    : tx('Movimentação {dia}: falta {campos}', { dia: so.hoje ? tx('de hoje') : ddmm(so.data), campos: juntarCampos(so.falta) }))
                : tx('Movimentação: {qtd} dias pendentes', { qtd: u.movimento.length }),
            botao: tx('Lançar'), tipo: 'movimento',
        });
    }
    if (u.metas) {
        const partes = [u.metas.start && tx('Meta Start'), u.metas.mensal && tx('Meta Mensal')].filter(Boolean).join(' · ');
        itens.push({ k: 'g', atrasado: u.metas.atrasado, texto: tx('Metas de {mes}: {cards}', { mes: tx(u.metas.mes), cards: partes }), botao: tx('Preencher'), tipo: 'metas' });
    }
    // Relatório da recepção: quem envia é o login da Recepção; o Líder/Mentor confere no grupo (botão Conferir, permissão 313)
    (u.relatorio || []).forEach(r => itens.push({
        k: `r-${r.data}-${r.turno}`, atrasado: r.situacao !== 'cobrando',
        texto: tx('Relatório {dia} ({turno}): não enviado{nomes}', { dia: r.hoje ? tx('de hoje') : ddmm(r.data), turno: tx(r.rotulo), nomes: r.nomes?.length ? ` — ${r.nomes.join(' / ')}` : '' }),
        ...(podeConferirRelatorio ? { botao: tx('Conferir'), acao: () => pedirConferirRelatorio({ unidade: u.unidade, data: r.data, turno: r.turno, rotulo: r.rotulo, nomes: r.nomes }) } : {}),
    }));
    return (
        <ul className="space-y-1.5">
            {itens.map(i => (
                <li key={i.k} className="flex items-start justify-between gap-2">
                    <span className={`text-[12px] font-semibold leading-snug ${i.atrasado ? 'text-rose-700 dark:text-rose-300' : 'text-amber-900 dark:text-amber-200'}`}>{i.texto}</span>
                    {(i.tipo || i.acao) && <Link onClick={() => (i.acao ? i.acao() : aoIr(i.tipo, u))}>{i.botao}</Link>}
                </li>
            ))}
        </ul>
    );
};

const CartaoPendencias = ({ lista = [], ehMentor, escondido, aoIr, aoVerTodas, podeConferirRelatorio = false }) => {
    const [escondidoAte, setEscondidoAte] = useState(0);
    // O relógio de 1 minuto faz o cartão voltar depois de 1 hora
    const [, setTique] = useState(0);
    useEffect(() => { const id = setInterval(() => setTique(t => t + 1), 60 * 1000); return () => clearInterval(id); }, []);

    const comAlgo = lista.filter(u => u.total > 0 || u.lembretes > 0);
    if (escondido || !comAlgo.length || Date.now() < escondidoAte) return null;
    const temAtraso = comAlgo.some(u => u.atrasado);
    const visiveis = ehMentor ? comAlgo.slice(0, MAX_UNIDADES_MENTOR) : comAlgo.slice(0, 1);
    const resto = comAlgo.length - visiveis.length;
    const depois = () => setEscondidoAte(Date.now() + UMA_HORA);

    return (
        <div role="alert" className={`fixed bottom-4 right-4 z-[70] w-[min(360px,calc(100%-32px))] max-h-[70vh] overflow-y-auto custom-scrollbar rounded-2xl shadow-xl p-4 border ${temAtraso ? 'bg-rose-50 border-rose-300 dark:bg-slate-900 dark:border-rose-500/40' : 'bg-amber-50 border-amber-300 dark:bg-slate-900 dark:border-amber-500/40'}`}>
            <div className="flex items-start gap-3">
                <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${temAtraso ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`} />
                <div className="min-w-0 flex-1">
                    <p className={`text-[11px] font-black uppercase tracking-widest ${temAtraso ? 'text-rose-800 dark:text-rose-300' : 'text-amber-800 dark:text-amber-300'}`}>
                        {ehMentor ? tx('Pendências das suas unidades') : tx('Pendências da unidade')}
                    </p>
                    <div className="mt-2 space-y-3">
                        {visiveis.map(u => (
                            <div key={u.unidade}>
                                {ehMentor && <p className="text-[11px] font-black uppercase tracking-widest text-slate-700 mb-1 dark:text-slate-200">{u.unidade}</p>}
                                <Linhas u={u} aoIr={aoIr} podeConferirRelatorio={podeConferirRelatorio} />
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                        {ehMentor && (
                            <button type="button" onClick={aoVerTodas} className="h-9 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest">
                                {resto > 0 ? tx('Ver todas ({qtd})', { qtd: comAlgo.length }) : tx('Abrir Pendências')}
                            </button>
                        )}
                        <button type="button" onClick={depois} className="h-9 px-3 rounded-xl border border-slate-300 bg-white text-slate-700 text-[11px] font-black uppercase tracking-widest hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{tx('Depois')}</button>
                    </div>
                </div>
                <button type="button" onClick={depois} aria-label={tx('Fechar')} className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"><X className="w-4 h-4" /></button>
            </div>
        </div>
    );
};

export default CartaoPendencias;
