import React, { useState } from 'react';
import { X, Loader2, Ban, CheckCircle2 } from 'lucide-react';
import { MOTIVOS_NAO_CONTATAR, JUSTIFICATIVAS_SEM_WHATSAPP } from './utils';
import { colocarNaoContatar } from './contatosFeitos';

// ==========================================
// JANELAS PEQUENAS DO CRM
// - JanelaNaoContatar: coloca a pessoa em "Não contatar" (motivo obrigatório; data e quem colocou ficam gravados)
// - JanelaJustificativa: "Marcar como feito" SEM WhatsApp exige justificativa (fica em vermelho para o Líder)
// ==========================================

const Moldura = ({ titulo, subtitulo, icone: Icone, cor, onFechar, children }) => (
    <div className="fixed inset-0 z-[220] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${cor}`}><Icone className="w-4 h-4" /></div>
                    <div>
                        <p className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">{titulo}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase truncate max-w-[260px]">{subtitulo}</p>
                    </div>
                </div>
                <button type="button" onClick={onFechar} className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>
            </div>
            {children}
        </div>
    </div>
);

const EscolhaComOutro = ({ opcoes, valor, setValor, outro, setOutro }) => (
    <div className="p-5 space-y-2">
        {[...opcoes, 'Outro'].map(op => (
            <label key={op} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${valor === op ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}>
                <input type="radio" checked={valor === op} onChange={() => setValor(op)} className="accent-blue-600" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{op}</span>
            </label>
        ))}
        {valor === 'Outro' && (
            <textarea rows={2} value={outro} onChange={(e) => setOutro(e.target.value)} placeholder="Escreva o motivo..." className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" />
        )}
    </div>
);

const textoEscolhido = (valor, outro) => (valor === 'Outro' ? String(outro || '').trim() : valor);

export const JanelaNaoContatar = ({ pessoa, unidade, quem, onFechar, onFeito }) => {
    const [valor, setValor] = useState('');
    const [outro, setOutro] = useState('');
    const [salvando, setSalvando] = useState(false);

    const salvar = async () => {
        const motivo = textoEscolhido(valor, outro);
        if (!motivo) return alert('Escolha ou escreva o motivo.');
        setSalvando(true);
        try {
            await colocarNaoContatar({ unidade, cpf: pessoa.cpf, aluno_id: pessoa.aluno_id || null, lead_id: pessoa.lead_id || null, nome: pessoa.nome, motivo, colocado_por: quem });
            onFeito(pessoa);
            onFechar();
        } catch (err) {
            console.error('Erro ao colocar em Não contatar:', err);
            alert(`Não foi possível salvar.\n\n${err?.message || ''}`);
        } finally {
            setSalvando(false);
        }
    };

    return (
        <Moldura titulo="Não contatar" subtitulo={pessoa.nome} icone={Ban} cor="bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400" onFechar={onFechar}>
            <p className="px-5 pt-4 text-xs font-bold text-slate-500 dark:text-slate-400">A pessoa sai de todas as listas de contato da rede (Base, Kanban, Lista, Migração e Contatos de hoje). Só Líder e Admin podem tirar da lista depois.</p>
            <EscolhaComOutro opcoes={MOTIVOS_NAO_CONTATAR} valor={valor} setValor={setValor} outro={outro} setOutro={setOutro} />
            <div className="px-5 pb-5 flex justify-end gap-2">
                <button type="button" onClick={onFechar} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">Cancelar</button>
                <button type="button" onClick={salvar} disabled={salvando} className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />} Colocar em Não contatar
                </button>
            </div>
        </Moldura>
    );
};

export const JanelaJustificativa = ({ pessoa, onFechar, onConfirmar }) => {
    const [valor, setValor] = useState('');
    const [outro, setOutro] = useState('');
    const [salvando, setSalvando] = useState(false);

    const confirmar = async () => {
        const justificativa = textoEscolhido(valor, outro);
        if (!justificativa) return alert('Escolha ou escreva como o contato foi feito.');
        setSalvando(true);
        await onConfirmar(justificativa);
        setSalvando(false);
        onFechar();
    };

    return (
        <Moldura titulo="Feito sem WhatsApp" subtitulo={pessoa.nome} icone={CheckCircle2} cor="bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400" onFechar={onFechar}>
            <p className="px-5 pt-4 text-xs font-bold text-rose-600 dark:text-rose-400">Este contato vai aparecer em vermelho para o Líder, como "feito sem WhatsApp". Como ele foi feito?</p>
            <EscolhaComOutro opcoes={JUSTIFICATIVAS_SEM_WHATSAPP} valor={valor} setValor={setValor} outro={outro} setOutro={setOutro} />
            <div className="px-5 pb-5 flex justify-end gap-2">
                <button type="button" onClick={onFechar} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">Cancelar</button>
                <button type="button" onClick={confirmar} disabled={salvando} className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Confirmar
                </button>
            </div>
        </Moldura>
    );
};
