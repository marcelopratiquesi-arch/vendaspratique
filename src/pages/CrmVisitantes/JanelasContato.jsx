import React, { useState } from 'react';
import { X, Loader2, Ban, CheckCircle2, Snowflake, CalendarClock } from 'lucide-react';
import { MOTIVOS_NAO_CONTATAR, JUSTIFICATIVAS_SEM_WHATSAPP, MOTIVOS_PERDA, PREFIXO_MOTIVO_OUTRO, diaISO, formatarDiaCurto } from './utils';
import { colocarNaoContatar } from './contatosFeitos';
import { avisar } from '../../components/avisar.js';

// ==========================================
// JANELAS PEQUENAS DO CRM
// - JanelaNaoContatar: coloca a pessoa em "Não contatar" (motivo obrigatório; data e quem colocou ficam gravados)
// - JanelaJustificativa: "Marcar como feito" SEM WhatsApp exige justificativa (fica em vermelho para o Líder)
// - JanelaMotivoPerda: mover para Perdido (sozinho ou em lote) pede o motivo
// - JanelaProximoContato: marca a data do próximo contato (atalhos ou outra data)
// ==========================================

// semFechar: a janela só sai pelos botões dela (usado depois de um contato, para a data não ficar esquecida)
const Moldura = ({ titulo, subtitulo, icone: Icone, cor, onFechar, children, semFechar = false }) => (
    <div className="fixed inset-0 z-[260] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(e) => { if (!semFechar && e.target === e.currentTarget) onFechar(); }}>
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${cor}`}><Icone className="w-4 h-4" /></div>
                    <div>
                        <p className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">{titulo}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase truncate max-w-[260px]">{subtitulo}</p>
                    </div>
                </div>
                {!semFechar && <button type="button" onClick={onFechar} className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>}
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
        if (!motivo) return avisar('Escolha ou escreva o motivo.');
        setSalvando(true);
        try {
            await colocarNaoContatar({ unidade, cpf: pessoa.cpf, aluno_id: pessoa.aluno_id || null, lead_id: pessoa.lead_id || null, nome: pessoa.nome, motivo, colocado_por: quem });
            onFeito(pessoa);
            onFechar();
        } catch (err) {
            console.error('Erro ao colocar em Não contatar:', err);
            avisar(`Não foi possível salvar.\n\n${err?.message || ''}`);
        } finally {
            setSalvando(false);
        }
    };

    return (
        <Moldura titulo="Não contatar" subtitulo={pessoa.nome} icone={Ban} cor="bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400" onFechar={onFechar}>
            <p className="px-5 pt-4 text-xs font-bold text-slate-500 dark:text-slate-400">A pessoa sai de todas as listas de contato da rede (Base, Kanban, Lista, Migração e Contatos de hoje). Só Líder, Mentor e Admin podem tirar da lista depois.</p>
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
        if (!justificativa) return avisar('Escolha ou escreva como o contato foi feito.');
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

// Mover para Perdido: o motivo é obrigatório. "Outro" é gravado como "Outro: texto escrito".
export const JanelaMotivoPerda = ({ quantidade = 1, nome, onFechar, onConfirmar }) => {
    const [valor, setValor] = useState('');
    const [outro, setOutro] = useState('');
    const [salvando, setSalvando] = useState(false);

    const confirmar = async () => {
        const escolhido = textoEscolhido(valor, outro);
        if (!escolhido) return avisar('Escolha ou escreva o motivo da perda.');
        setSalvando(true);
        await onConfirmar(valor === 'Outro' ? `${PREFIXO_MOTIVO_OUTRO}${escolhido}` : escolhido);
        setSalvando(false);
        onFechar();
    };

    return (
        <Moldura titulo="Motivo da perda" subtitulo={quantidade > 1 ? `${quantidade} contatos selecionados` : nome} icone={Snowflake} cor="bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400" onFechar={onFechar}>
            <p className="px-5 pt-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                {quantidade > 1 ? `Os ${quantidade} contatos vão para a Geladeira (espera de 30 dias) com este motivo.` : 'O contato vai para a Geladeira (espera de 30 dias).'} Por que não fechou?
            </p>
            <EscolhaComOutro opcoes={MOTIVOS_PERDA} valor={valor} setValor={setValor} outro={outro} setOutro={setOutro} />
            <div className="px-5 pb-5 flex justify-end gap-2">
                <button type="button" onClick={onFechar} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">Cancelar</button>
                <button type="button" onClick={confirmar} disabled={salvando} className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Snowflake className="w-4 h-4" />} Mover para Perdido
                </button>
            </div>
        </Moldura>
    );
};

// Data do próximo contato. Depois de um contato (posContato), a janela pergunta "quando é o próximo?"
// e só fecha escolhendo uma data ou "Sem próximo contato" (assim nenhum contato fica esquecido).
const ATALHOS_PROXIMO = [{ dias: 1, rotulo: 'Amanhã' }, { dias: 3, rotulo: 'Em 3 dias' }, { dias: 7, rotulo: 'Em 7 dias' }];

export const JanelaProximoContato = ({ nome, dataAtual = '', posContato = false, onFechar, onSalvar }) => {
    const [data, setData] = useState(posContato ? '' : String(dataAtual || '').slice(0, 10));
    const [salvando, setSalvando] = useState(false);
    // Se salvar falhar (ex.: internet caiu), a janela passa a poder ser fechada
    const [falhou, setFalhou] = useState(false);
    const hoje = diaISO(0);

    const salvar = async (valor) => {
        if (valor && valor < hoje) return avisar('Escolha hoje ou uma data futura.');
        setSalvando(true);
        const ok = await onSalvar(valor || null);
        setSalvando(false);
        if (ok !== false) onFechar(); else setFalhou(true);
    };

    return (
        <Moldura titulo={posContato ? 'Quando é o próximo contato?' : 'Próximo contato'} subtitulo={nome} icone={CalendarClock} cor="bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400" onFechar={onFechar} semFechar={posContato && !falhou}>
            <div className="p-5 space-y-4">
                {posContato && <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Contato registrado. Marque quando falar de novo com esta pessoa.</p>}
                {!posContato && dataAtual && <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Marcado para:<strong className="text-blue-600 dark:text-blue-400">{formatarDiaCurto(dataAtual)}</strong></p>}
                <div className="grid grid-cols-3 gap-2">
                    {ATALHOS_PROXIMO.map(a => (
                        <button key={a.dias} type="button" disabled={salvando} onClick={() => salvar(diaISO(a.dias))} className="py-3 rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-600 hover:text-white text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-60">
                            {a.rotulo}
                            <span className="block text-[10px] font-bold opacity-70 mt-0.5">{formatarDiaCurto(diaISO(a.dias))}</span>
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <input type="date" min={hoje} value={data} onChange={(e) => setData(e.target.value)} className="flex-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/30" />
                    <button type="button" disabled={salvando || !data} onClick={() => salvar(data)} className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Salvar
                    </button>
                </div>
            </div>
            <div className="px-5 pb-5 flex justify-between gap-2">
                {(posContato || dataAtual) ? (
                    <button type="button" disabled={salvando} onClick={() => salvar(null)} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                        {posContato ? 'Sem próximo contato' : 'Tirar a data'}
                    </button>
                ) : <span />}
                {(!posContato || falhou) && <button type="button" onClick={onFechar} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">Cancelar</button>}
            </div>
        </Moldura>
    );
};
