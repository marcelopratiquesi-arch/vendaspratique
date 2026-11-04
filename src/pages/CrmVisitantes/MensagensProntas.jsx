import React, { useState, useMemo } from 'react';
import { X, Save, Loader2, RotateCcw, RefreshCw, Info } from 'lucide-react';
import { salvarMensagemPronta } from './contatosFeitos';
import { MENSAGENS_PADRAO, ROTULOS_MENSAGENS, separarVersoes, montarMensagem, definirMensagensEmUso, mensagensAtuais } from './embaralhador.js';
import { avisar } from '../../components/avisar.js';
import { tx } from '../../i18n/traduzir.js';

// ==========================================
// EDITOR DAS MENSAGENS PRONTAS DO WHATSAPP (Admin, Líder e Mentor) — 04/11/2026
// Cada situação tem várias versões, uma embaixo da outra, separadas por uma linha "---".
// A cada clique no WhatsApp o CRM sorteia uma versão diferente da anterior (embaralhador.js).
// [Oi|Olá|E aí] sorteia uma das palavras · {saudacao} · {nome} · {unidade}. Vale para todas as unidades.
// ==========================================
const CHAVES = Object.keys(ROTULOS_MENSAGENS);

const MensagensProntas = ({ mensagens, usuarioLogado, onFechar, onSalvo, chaveInicial }) => {
    const base = useMemo(() => ({ ...MENSAGENS_PADRAO, ...mensagensAtuais(), ...(mensagens || {}) }), [mensagens]);
    const [textos, setTextos] = useState(base);
    const [chave, setChave] = useState(CHAVES.includes(chaveInicial) ? chaveInicial : CHAVES[0]);
    const [exemplo, setExemplo] = useState(() => montarMensagem(CHAVES.includes(chaveInicial) ? chaveInicial : CHAVES[0], { nome: 'MARIA SILVA', unidade: 'SANTA INES 2' }, base));
    const [salvando, setSalvando] = useState(false);

    const novoExemplo = (c = chave, fonte = textos) => setExemplo(montarMensagem(c, { nome: 'MARIA SILVA', unidade: 'SANTA INES 2' }, fonte));
    const escolher = (c) => { setChave(c); novoExemplo(c); };
    const qtdVersoes = (c) => separarVersoes(textos[c]).length;

    const salvar = async () => {
        if (CHAVES.some(c => qtdVersoes(c) === 0)) return avisar(tx("Nenhuma mensagem pode ficar vazia."), 'erro');
        setSalvando(true);
        const erros = [];
        for (const c of CHAVES) {
            if (textos[c] === base[c]) continue;
            const erro = await salvarMensagemPronta(c, textos[c], usuarioLogado?.nome || 'SISTEMA');
            if (erro) erros.push(`${ROTULOS_MENSAGENS[c]}: ${erro.message}`);
        }
        setSalvando(false);
        if (erros.length) return avisar(tx("Não foi possível salvar:\n\n{v1}", { v1: erros.join('\n') }), 'erro');
        const novas = { ...base, ...textos };
        definirMensagensEmUso(novas);
        avisar(tx("Mensagens salvas."), 'sucesso');
        if (onSalvo) onSalvo(novas);
        onFechar();
    };

    return (
        <div className="fixed inset-0 z-[260] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-3 md:p-8 overflow-y-auto" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 my-auto overflow-hidden" style={{ width: 'min(980px, 100%)' }}>
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">{tx("Mensagens prontas")}</h3>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">{tx("A cada clique no WhatsApp o CRM sorteia uma versão diferente. Vale para todas as unidades.")}</p>
                    </div>
                    <button type="button" onClick={onFechar} aria-label={tx("Fechar")} className="p-2 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400"><X className="w-4 h-4" /></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[240px_1fr]">
                    {/* Situações */}
                    <div className="p-3 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 flex md:flex-col gap-1.5 overflow-x-auto md:max-h-[64vh] md:overflow-y-auto custom-scrollbar">
                        {CHAVES.map(c => (
                            <button key={c} type="button" onClick={() => escolher(c)}
                                className={`shrink-0 text-left px-3 py-2 rounded-xl border text-[11px] font-black transition-colors flex items-center justify-between gap-2 ${c === chave ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                                <span className="whitespace-nowrap md:whitespace-normal">{tx(ROTULOS_MENSAGENS[c])}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${c === chave ? 'bg-white/20' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{qtdVersoes(c)}</span>
                            </button>
                        ))}
                    </div>

                    {/* Versões da situação escolhida */}
                    <div className="p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
                                {tx(ROTULOS_MENSAGENS[chave])} · <span className="text-blue-600 dark:text-blue-400">{tx("{qtd} versões", { qtd: qtdVersoes(chave) })}</span>
                            </p>
                            <button type="button" onClick={() => { const novos = { ...textos, [chave]: MENSAGENS_PADRAO[chave] }; setTextos(novos); novoExemplo(chave, novos); }}
                                className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 flex items-center gap-1 dark:hover:text-blue-400">
                                <RotateCcw className="w-3 h-3" />{tx("Voltar ao padrão")}
                            </button>
                        </div>
                        <textarea
                            rows={14}
                            value={textos[chave]}
                            onChange={(e) => setTextos(prev => ({ ...prev, [chave]: e.target.value }))}
                            className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-[13px] leading-relaxed text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-y custom-scrollbar"
                        />
                        <p className="flex items-start gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>{tx("Uma versão embaixo da outra, separadas por uma linha só com")} <strong>---</strong>. <strong>[Oi|Olá|E aí]</strong> {tx("sorteia uma das palavras.")} <strong>{'{saudacao}'}</strong> = {tx("Bom dia/Boa tarde/Boa noite")} · <strong>{'{nome}'}</strong> = {tx("primeiro nome")} · <strong>{'{unidade}'}</strong> = {tx("unidade")}.</span>
                        </p>
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">{tx("Exemplo de como sai")}</span>
                                <button type="button" onClick={() => novoExemplo()} className="text-[10px] font-black uppercase tracking-widest text-emerald-700 hover:text-emerald-900 flex items-center gap-1 dark:text-emerald-300 dark:hover:text-emerald-200">
                                    <RefreshCw className="w-3 h-3" />{tx("Gerar outro")}
                                </button>
                            </div>
                            <p className="text-[13px] text-slate-700 dark:text-slate-200 whitespace-pre-line leading-relaxed">{exemplo}</p>
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                    <button type="button" onClick={onFechar} className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">{tx("Cancelar")}</button>
                    <button type="button" onClick={salvar} disabled={salvando} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-black uppercase tracking-widest flex items-center gap-2">
                        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{' '}{tx("Salvar")}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MensagensProntas;
