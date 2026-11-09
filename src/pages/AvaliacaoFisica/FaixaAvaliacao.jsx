import React from 'react';
import { Dumbbell, HeartPulse } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';
import { nivelSaude } from './utils.js';

// ==========================================
// Visual "cara de academia" da Avaliação Física (decisão do dono, 09/11/2026: "pode colocar esse visual em
// todas as abas"). Exceção ao visual compacto SÓ na área da Avaliação. Uma peça só, usada pela tela inicial,
// painel do avaliador, Dashboards, formulário, Lixeira e Configurar formulário.
// ==========================================

// Desenho leve de academia (feito no próprio sistema: não baixa nada de fora)
export const DesenhoAcademia = ({ className }) => (
    <svg className={className} viewBox="0 0 260 120" fill="currentColor" aria-hidden="true">
        {/* haltere */}
        <rect x="8" y="58" width="9" height="32" rx="3" />
        <rect x="19" y="50" width="12" height="48" rx="3" />
        <rect x="31" y="70" width="72" height="8" rx="4" />
        <rect x="103" y="50" width="12" height="48" rx="3" />
        <rect x="117" y="58" width="9" height="32" rx="3" />
        {/* pessoa levantando a barra */}
        <rect x="150" y="14" width="100" height="5" rx="2.5" />
        <rect x="144" y="4" width="9" height="25" rx="2" />
        <rect x="247" y="4" width="9" height="25" rx="2" />
        <circle cx="200" cy="34" r="9" />
        <path d="M168 17 l20 26 h4 l-16 -26 z M232 17 l-20 26 h-4 l16 -26 z" />
        <path d="M191 45 h18 c4 0 7 3 7 7 v26 l-6 0 l6 40 h-10 l-6 -34 h-2 l-6 34 h-10 l6 -40 l-6 0 v-26 c0 -4 3 -7 7 -7 z" />
    </svg>
);

// Botão claro sobre a faixa escura
export const BotaoFaixa = ({ children, className = '', ...props }) => (
    <button type="button" className={`flex items-center gap-1.5 h-10 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-[10px] font-black uppercase tracking-widest text-white transition-colors ${className}`} {...props}>
        {children}
    </button>
);

// Botão laranja (ação principal: Nova Avaliação). O dono quer laranja para ser enxergado.
export const BotaoLaranjaFaixa = ({ children, className = '', ...props }) => (
    <button type="button" className={`flex items-center gap-1.5 h-10 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 border border-orange-300/60 text-[10px] font-black uppercase tracking-widest text-white shadow-[0_4px_15px_rgba(249,115,22,0.35)] transition-colors ${className}`} {...props}>
        {children}
    </button>
);

// Abas da área da Avaliação. Só aparecem as que têm ação (permissão) ou a que está aberta.
export const AbasAvaliacao = ({ ativa, onAvaliadores, onUnidade, onGlobal }) => {
    const abas = [
        { id: 'avaliadores', rotulo: 'Avaliadores', acao: onAvaliadores },
        { id: 'unidade', rotulo: 'Dashboard da Unidade', acao: onUnidade },
        { id: 'global', rotulo: 'Dashboard Global', acao: onGlobal },
    ].filter(a => a.id === ativa || a.acao);
    if (abas.length === 0) return null;
    return (
        <div className="flex flex-wrap items-center gap-1 rounded-xl bg-black/20 p-1">
            {abas.map(a => (a.id === ativa ? (
                <span key={a.id} className="px-3 py-1.5 rounded-lg bg-white text-[#0B1F4B] text-[10px] font-black uppercase tracking-widest">{tx(a.rotulo)}</span>
            ) : (
                <button key={a.id} type="button" onClick={a.acao} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-white/90 hover:bg-white/15 transition-colors">{tx(a.rotulo)}</button>
            )))}
        </div>
    );
};

// Número dentro da faixa
const NumeroFaixa = ({ rotulo, valor, extra, amarelo }) => (
    <div className={`rounded-xl border px-3 py-2 min-w-[120px] ${amarelo ? 'bg-amber-400/20 border-amber-300/50' : 'bg-white/10 border-white/15'}`}>
        <span className={`block text-[10px] font-black uppercase tracking-widest ${amarelo ? 'text-amber-200' : 'text-blue-100/80'}`}>{rotulo}</span>
        <strong className={`block text-xl font-black leading-tight ${amarelo ? 'text-amber-200' : ''}`}>
            {valor}
            {extra && <span className="text-[12px] font-bold text-blue-100/70"> {extra}</span>}
        </strong>
    </div>
);

// A faixa. antes = botão Voltar; icone = o que vai no quadradinho (padrão: haltere);
// acoes = botões da direita; numeros = [{ rotulo, valor, extra, amarelo }]; abas = <AbasAvaliacao />.
export const FaixaAvaliacao = ({ antes, icone, titulo, subtitulo, acoes, numeros = [], abas, children }) => (
    <div className="relative z-30 rounded-2xl bg-gradient-to-r from-[#0B1F4B] via-[#14336f] to-orange-500 dark:from-[#071530] dark:via-[#0e2552] dark:to-orange-600 text-white shadow-md">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
            <DesenhoAcademia className="absolute -bottom-2 right-3 h-[115%] w-auto text-white opacity-[0.16]" />
            <div className="absolute -left-16 -top-20 w-64 h-64 rounded-full bg-white/5" />
        </div>
        <div className="relative px-4 py-4 sm:px-5 flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    {antes}
                    <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0 text-lg font-black text-orange-200">
                        {icone || <Dumbbell className="w-6 h-6 text-orange-300" />}
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-xl font-black uppercase tracking-tight leading-none truncate">{titulo}</h1>
                        {subtitulo && <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-blue-100/80 truncate">{subtitulo}</p>}
                    </div>
                </div>
                {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
            </div>
            {(numeros.length > 0 || abas) && (
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="flex flex-wrap items-stretch gap-2">
                        {numeros.map((n, i) => <NumeroFaixa key={i} {...n} />)}
                    </div>
                    {abas}
                </div>
            )}
            {children}
        </div>
    </div>
);

// Etiqueta de saúde (Saudável / Atenção / Alerta) e o título da coluna com o "?"
export const EtiquetaSaude = ({ avaliacao }) => {
    const saude = nivelSaude(avaliacao);
    if (!saude) return <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600">—</span>;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${saude.classe}`}>
            <span className={`w-2 h-2 rounded-full ${saude.bolinha}`} />{tx(saude.rotulo)}
        </span>
    );
};

export const TituloSaude = () => (
    <span className="inline-flex items-center gap-1">
        <HeartPulse className="w-3.5 h-3.5 text-rose-500" />{tx("Saúde")}
        <span title={tx("Junta pressão, gordura visceral, RCQ, SMI e hidratação. Alerta = algum resultado ruim; Atenção = algum no limite; Saudável = todos bons.")} className="cursor-help w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-black flex items-center justify-center">?</span>
    </span>
);
