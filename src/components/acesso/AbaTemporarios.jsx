import React, { useEffect, useMemo, useState } from 'react';
import { Clock, Loader2, Plus, CalendarPlus, Power, MessageCircle, Check, AlertTriangle } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';
import { avisar } from '../avisar.js';
import CopyButton from '../../pages/HistoricoVendas/CopyButton.jsx';
import { abrirNoWhatsApp } from '../whatsapp.js';
import { liberarTemporario, prorrogarTemporario, encerrarTemporario, previaTemporario } from './acessoBanco.js';
import { PRAZOS_TEMPORARIO, calcularValeAte, hojeEmBrasilia, dataBr, telefoneValido, juntarTelefone, telefoneBonito, normalizarEmail } from './regrasAcesso.js';

// ==========================================
// ACESSOS → TEMPORÁRIOS (13/11/2026, decisão do dono). Quem cobre férias ou ausência ganha um acesso com data
// para acabar: Líder (ou Mentor, só o Admin libera) em 1 ou várias unidades. O acesso SÓ SOMA ao que a pessoa já
// tem. A pessoa entra com o Google no e-mail cadastrado aqui (nada de senha). A data final é calculada pelo banco
// (horário de Brasília; hoje conta como dia 1) e aparece antes de confirmar. Prorrogar/Encerrar: quem liberou ou o
// Admin. O banco confere tudo (acesso_temp_liberar / _prorrogar / _encerrar).
// ==========================================

const DDIS = [['55', '+55'], ['54', '+54'], ['1', '+1'], ['351', '+351']];
const campo = 'w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-[13px] font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white';
const rotulo = 'block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 dark:text-slate-400';
const TIPO = { LIDER: 'Líder', MENTOR: 'Mentor' };

const mensagemParaPessoa = (t, dias) => {
    const nome = String(t.nome || '').split(' ')[0];
    const tipo = t.tipo === 'MENTOR' ? 'MENTOR' : 'LÍDER';
    const unidades = (t.unidades || []).join(', ');
    let txt = `Olá${nome ? `, ${nome}` : ''}! 👋\n\n`;
    if (dias !== null && dias <= 7) {
        txt += `Seu acesso temporário de *${tipo}* ao sistema Pratique Vendas (${unidades}) `;
        txt += dias <= 0 ? '*vence hoje* às 23:59.' : `vence em *${dias} dia${dias === 1 ? '' : 's'}* (${dataBr(t.vale_ate)} às 23:59).`;
        txt += '\nSe precisar continuar, fale com quem liberou o acesso.';
    } else {
        txt += `Seu acesso temporário de *${tipo}* ao sistema Pratique Vendas foi liberado.\n`;
        txt += `• Unidade${(t.unidades || []).length > 1 ? 's' : ''}: ${unidades}\n`;
        txt += `• Vale até: ${dataBr(t.vale_ate)} às 23:59 (horário de Brasília)\n\n`;
        txt += `Para entrar: abra o sistema e clique em *Entrar com Google* usando o e-mail ${t.email}.`;
        if ((t.unidades || []).length > 1) txt += '\nVocê escolhe a unidade no topo da tela.';
    }
    return txt;
};

// Prévia da data final: pede ao banco (hora do servidor); sem resposta, mostra a conta local avisando
const usePrevia = (prazo, data, id = null) => {
    const [previa, setPrevia] = useState(null);
    useEffect(() => {
        let vivo = true;
        if (!prazo || (prazo === 'data' && !data)) { setPrevia(null); return undefined; }
        previaTemporario(prazo, data, id)
            .then(r => { if (vivo) setPrevia({ ...r, doBanco: true }); })
            .catch(e => {
                if (!vivo) return;
                const hoje = hojeEmBrasilia();
                const fim = id ? null : calcularValeAte(prazo, hoje, data);
                setPrevia(fim ? { inicio: hoje, vale_ate: fim, doBanco: false } : { erro: e.message || tx('Data inválida.') });
            });
        return () => { vivo = false; };
    }, [prazo, data, id]);
    return previa;
};

const EscolhaPrazo = ({ prazo, setPrazo, data, setData }) => (
    <div>
        <div className="flex flex-wrap gap-1.5">
            {PRAZOS_TEMPORARIO.map(([v, r]) => (
                <button key={v} type="button" onClick={() => setPrazo(v)} aria-pressed={prazo === v}
                    className={`h-9 px-3 rounded-lg border text-[11px] font-black uppercase tracking-wide ${prazo === v ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300'}`}>{tx(r)}</button>
            ))}
        </div>
        {prazo === 'data' && <input type="date" value={data} onChange={e => setData(e.target.value)} className={`${campo} mt-2 max-w-[220px]`} aria-label={tx('Data final')} />}
    </div>
);

const LinhaPrevia = ({ previa }) => {
    if (!previa) return null;
    if (previa.erro) return <p className="text-[12px] font-bold text-rose-600 dark:text-rose-400">{previa.erro}</p>;
    return (
        <p className="text-[13px] font-black text-blue-700 dark:text-blue-300">
            {tx('Vale de {inicio} até {fim} às 23:59 (horário de Brasília)', { inicio: dataBr(previa.inicio), fim: dataBr(previa.vale_ate) })}
            {previa.dias ? ` · ${tx('{qtd} dias', { qtd: previa.dias })}` : ''}
            {!previa.doBanco && <span className="block text-[11px] font-semibold text-amber-600 dark:text-amber-400">{tx('Conta feita no computador: o banco confere ao gravar.')}</span>}
        </p>
    );
};

const FormularioLiberar = ({ ehAdmin, unidades, onFeito, onCancelar, unidadesIniciais = [], pessoas = [] }) => {
    const [email, setEmail] = useState('');
    const [nome, setNome] = useState('');
    const [ddi, setDdi] = useState('55');
    const [numero, setNumero] = useState('');
    const [tipo, setTipo] = useState('LIDER');
    const [escolhidas, setEscolhidas] = useState(() => unidades.filter(u => unidadesIniciais.some(i => String(i).trim().toUpperCase() === String(u).trim().toUpperCase())));
    // Pessoa já cadastrada (login ativo): preenche e-mail, nome e WhatsApp de uma vez
    const escolherPessoa = (em) => {
        const p = pessoas.find(x => normalizarEmail(x.email) === em);
        if (!p) return;
        setEmail(normalizarEmail(p.email));
        setNome(String(p.nome || '').toUpperCase());
        const tel = String(p.telefone || '').replace(/\D/g, '');
        const d = DDIS.find(([v]) => tel.startsWith(v) && tel.length - v.length >= 10);
        if (d) { setDdi(d[0]); setNumero(tel.slice(d[0].length)); } else if (tel) setNumero(tel);
    };
    const [prazo, setPrazo] = useState('10d');
    const [data, setData] = useState('');
    const [motivo, setMotivo] = useState('');
    const [gravando, setGravando] = useState(false);
    const previa = usePrevia(prazo, data);

    const alternar = (u) => setEscolhidas(l => (l.includes(u) ? l.filter(x => x !== u) : [...l, u]));
    const gravar = async () => {
        const telefone = juntarTelefone(ddi, numero);
        const em = normalizarEmail(email);
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { avisar(tx('E-mail inválido.'), 'atencao'); return; }
        if (nome.trim().split(/\s+/).length < 2) { avisar(tx('Informe o nome completo.'), 'atencao'); return; }
        if (!telefoneValido(telefone)) { avisar(tx('WhatsApp inválido: digite o DDD e o número.'), 'atencao'); return; }
        if (!escolhidas.length) { avisar(tx('Escolha pelo menos uma unidade.'), 'atencao'); return; }
        if (!previa || previa.erro) { avisar(tx('Escolha um prazo válido.'), 'atencao'); return; }
        if (motivo.trim().length < 5) { avisar(tx('Informe o motivo (mínimo 5 letras).'), 'atencao'); return; }
        const resumo = tx('Liberar acesso temporário de {tipo} para {nome} ({email}) em {unidades}, até {fim} às 23:59?', {
            tipo: tx(TIPO[tipo]), nome: nome.trim().toUpperCase(), email: em, unidades: escolhidas.join(', '), fim: dataBr(previa.vale_ate),
        });
        if (!window.confirm(resumo)) return;
        setGravando(true);
        try {
            const r = await liberarTemporario({ email: em, nome: nome.trim(), telefone, tipo, unidades: escolhidas, prazo, data: prazo === 'data' ? data : null, motivo: motivo.trim() });
            avisar(tx('Acesso liberado até {fim}. A pessoa entra com o Google no e-mail {email}.', { fim: dataBr(r?.vale_ate), email: em }), 'sucesso');
            onFeito?.({ email: em, nome: nome.trim().toUpperCase(), telefone, tipo, unidades: escolhidas, vale_ate: r?.vale_ate });
        } catch (e) { avisar(e.message || tx('Não foi possível liberar.'), 'erro'); } finally { setGravando(false); }
    };

    return (
        <div className="bg-white rounded-2xl border border-blue-200 p-4 space-y-4 dark:bg-slate-900 dark:border-blue-500/30">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-[12px] font-black uppercase tracking-widest text-slate-800 dark:text-white">{tx('Liberar acesso temporário')}</h3>
                <button type="button" onClick={onCancelar} className="h-8 px-2 rounded-lg text-[11px] font-black uppercase text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">{tx('Cancelar')}</button>
            </div>
            {pessoas.length > 0 && (
                <label className="block">
                    <span className={rotulo}>{tx('Pessoa já cadastrada no sistema (opcional)')}</span>
                    <select defaultValue="" onChange={e => escolherPessoa(e.target.value)} className={`${campo} max-w-md`}>
                        <option value="">{tx('Escolher para preencher e-mail, nome e WhatsApp...')}</option>
                        {[...pessoas].sort((a, b) => String(a.nome).localeCompare(String(b.nome))).map(p => (
                            <option key={p.email} value={normalizarEmail(p.email)}>{p.nome} · {p.role === 'LIDER' && p.posto === 'ASPIRA' ? tx('Aspira') : p.role}{p.unidade && p.unidade !== 'TODAS' ? ` · ${p.unidade}` : ''}</option>
                        ))}
                    </select>
                </label>
            )}
            <div className="grid gap-3 md:grid-cols-3">
                <label className="block md:col-span-1">
                    <span className={rotulo}>{tx('E-mail (Google) da pessoa')}</span>
                    <input value={email} onChange={e => setEmail(e.target.value)} type="email" autoFocus placeholder="nome@gmail.com" className={campo} />
                </label>
                <label className="block">
                    <span className={rotulo}>{tx('Nome completo')}</span>
                    <input value={nome} onChange={e => setNome(e.target.value)} className={`${campo} uppercase`} />
                </label>
                <div>
                    <span className={rotulo}>{tx('WhatsApp')}</span>
                    <div className="flex gap-2">
                        <select value={ddi} onChange={e => setDdi(e.target.value)} className={`${campo} w-20 px-1`} aria-label={tx('Código do país')}>
                            {DDIS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                        </select>
                        <input value={numero} onChange={e => setNumero(e.target.value)} inputMode="tel" placeholder={tx('DDD + número')} className={campo} />
                    </div>
                </div>
            </div>
            <div className="grid gap-3 md:grid-cols-[auto_1fr]">
                <div>
                    <span className={rotulo}>{tx('Tipo de acesso')}</span>
                    <div className="flex gap-1.5">
                        {['LIDER', 'MENTOR'].filter(v => v === 'LIDER' || ehAdmin).map(v => (
                            <button key={v} type="button" onClick={() => setTipo(v)} aria-pressed={tipo === v}
                                className={`h-9 px-3 rounded-lg border text-[11px] font-black uppercase tracking-wide ${tipo === v ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300'}`}>{tx(TIPO[v])}</button>
                        ))}
                    </div>
                    {!ehAdmin && <p className="mt-1 text-[11px] font-semibold text-slate-400">{tx('Mentor temporário: só o Admin libera.')}</p>}
                </div>
                <div>
                    <span className={rotulo}>{tx('Unidades ({qtd} escolhidas)', { qtd: escolhidas.length })}</span>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto custom-scrollbar">
                        {unidades.map(u => {
                            const sel = escolhidas.includes(u);
                            return (
                                <button key={u} type="button" onClick={() => alternar(u)} aria-pressed={sel}
                                    className={`h-8 px-2.5 rounded-lg border text-[11px] font-black uppercase inline-flex items-center gap-1 ${sel ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300'}`}>
                                    {sel && <Check className="w-3 h-3" />}{u}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
            <div>
                <span className={rotulo}>{tx('Prazo (hoje conta como dia 1)')}</span>
                <EscolhaPrazo prazo={prazo} setPrazo={setPrazo} data={data} setData={setData} />
                <div className="mt-2"><LinhaPrevia previa={previa} /></div>
            </div>
            <label className="block">
                <span className={rotulo}>{tx('Motivo')}</span>
                <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder={tx('Ex.: cobrir as férias do José')} className={campo} />
            </label>
            <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={gravar} disabled={gravando} className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-1.5">
                    {gravando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{tx('Liberar acesso')}
                </button>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tx('O acesso temporário não muda o acesso que a pessoa já tem: só soma. No fim do prazo o sistema corta sozinho.')}</p>
            </div>
        </div>
    );
};

const PainelProrrogar = ({ t, onFeito, onCancelar }) => {
    const [prazo, setPrazo] = useState('10d');
    const [data, setData] = useState('');
    const [motivo, setMotivo] = useState('');
    const [gravando, setGravando] = useState(false);
    const previa = usePrevia(prazo, data, t.id);
    const gravar = async () => {
        if (!previa || previa.erro || !previa.doBanco) { avisar(tx('Escolha um prazo válido.'), 'atencao'); return; }
        if (motivo.trim().length < 5) { avisar(tx('Informe o motivo (mínimo 5 letras).'), 'atencao'); return; }
        if (!window.confirm(tx('Prorrogar o acesso de {nome} até {fim}?', { nome: t.nome, fim: dataBr(previa.vale_ate) }))) return;
        setGravando(true);
        try { const r = await prorrogarTemporario(t.id, prazo, prazo === 'data' ? data : null, motivo.trim()); avisar(tx('Prorrogado até {fim}.', { fim: dataBr(r?.vale_ate) }), 'sucesso'); onFeito?.(); }
        catch (e) { avisar(e.message || tx('Não foi possível prorrogar.'), 'erro'); } finally { setGravando(false); }
    };
    return (
        <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-2 dark:bg-blue-500/5 dark:border-blue-500/30">
            <p className="text-[11px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">{tx('Prorrogar (conta a partir do dia seguinte ao fim atual)')}</p>
            <EscolhaPrazo prazo={prazo} setPrazo={setPrazo} data={data} setData={setData} />
            <LinhaPrevia previa={previa} />
            <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder={tx('Motivo da prorrogação')} className={campo} />
            <div className="flex gap-2">
                <button type="button" onClick={gravar} disabled={gravando} className="h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-black uppercase inline-flex items-center gap-1">{gravando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}{tx('Prorrogar')}</button>
                <button type="button" onClick={onCancelar} className="h-9 px-3 rounded-lg text-[11px] font-black uppercase text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">{tx('Cancelar')}</button>
            </div>
        </div>
    );
};

const corDias = (t) => {
    if (t.situacao !== 'ATIVO') return 'text-slate-400';
    const d = Number(t.dias_para_vencer);
    return d <= 1 ? 'text-rose-600 dark:text-rose-400' : d <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
};
const textoDias = (t) => {
    if (t.situacao === 'ENCERRADO') return tx('encerrado');
    if (t.situacao === 'VENCIDO') return tx('vencido');
    const d = Number(t.dias_para_vencer);
    return d <= 0 ? tx('vence hoje') : d === 1 ? tx('vence amanhã') : tx('faltam {qtd} dias', { qtd: d });
};

const AbaTemporarios = ({ contas, ehAdmin, unidades = [], podeLiberar = true, onMudou, inicial = null, pessoas = [] }) => {
    const [novo, setNovo] = useState(!!inicial && podeLiberar); // "Cobrir com temporário" (Líderes por unidade) abre direto
    const [filtro, setFiltro] = useState('ativos');
    const [prorrogando, setProrrogando] = useState(null);
    const lista = useMemo(() => (contas?.temporarios || []).filter(t => (filtro === 'ativos' ? t.situacao === 'ATIVO' : t.situacao !== 'ATIVO')), [contas, filtro]);

    if (contas?.temporariosSemSql) {
        return <div className="bg-white rounded-2xl border border-slate-200 p-6 text-[14px] font-bold text-amber-700 dark:bg-slate-900 dark:border-slate-800 dark:text-amber-300">{tx('Para liberar acessos temporários, rode no Supabase os passos 0 a 3 de sql/2026-11-13-aspira-temporario.')}</div>;
    }

    const encerrar = async (t) => {
        const motivo = window.prompt(tx('Encerrar AGORA o acesso temporário de {nome}? Motivo:', { nome: t.nome }));
        if (motivo === null) return;
        if (motivo.trim().length < 5) { avisar(tx('Cancelado: o motivo precisa ter pelo menos 5 letras.'), 'atencao'); return; }
        try { await encerrarTemporario(t.id, motivo.trim()); avisar(tx('Acesso de {nome} encerrado.', { nome: t.nome }), 'sucesso'); onMudou?.(); }
        catch (e) { avisar(e.message || tx('Não foi possível encerrar.'), 'erro'); }
    };
    const avisarWhats = (t) => abrirNoWhatsApp(String(t.telefone || '').replace(/\D/g, ''), mensagemParaPessoa(t, t.situacao === 'ATIVO' ? Number(t.dias_para_vencer) : null));

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                {[['ativos', tx('Valendo ({qtd})', { qtd: contas?.tempAtivos?.length || 0 })], ['antigos', tx('Vencidos e encerrados')]].map(([v, r]) => (
                    <button key={v} type="button" onClick={() => setFiltro(v)} aria-pressed={filtro === v}
                        className={`h-9 px-3 rounded-lg text-[11px] font-black uppercase tracking-wide ${filtro === v ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300'}`}>{r}</button>
                ))}
                {contas?.tempVencendo?.length > 0 && <span className="text-[12px] font-black text-amber-600 inline-flex items-center gap-1 dark:text-amber-400"><AlertTriangle className="w-4 h-4" />{tx('{qtd} vencendo em até 7 dias', { qtd: contas.tempVencendo.length })}</span>}
                <span className="flex-1" />
                {podeLiberar && !novo && (
                    <button type="button" onClick={() => setNovo(true)} className="h-9 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-1.5"><Plus className="w-4 h-4" />{tx('Liberar acesso temporário')}</button>
                )}
            </div>

            {novo && <FormularioLiberar ehAdmin={ehAdmin} unidades={unidades} onCancelar={() => setNovo(false)} unidadesIniciais={inicial?.unidades || []} pessoas={pessoas}
                onFeito={(t) => { setNovo(false); onMudou?.(); if (window.confirm(tx('Mandar agora a mensagem no WhatsApp para {nome} com o e-mail e o prazo?', { nome: t.nome }))) abrirNoWhatsApp(t.telefone, mensagemParaPessoa(t, null)); }} />}

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
                <div className="hidden md:grid gap-3 px-4 py-2 bg-slate-50 border-b border-slate-200 dark:bg-slate-800/60 dark:border-slate-800 md:grid-cols-[minmax(0,1.6fr)_90px_minmax(0,1.2fr)_140px_minmax(0,1fr)_auto]">
                    {[tx('Pessoa'), tx('Tipo'), tx('Unidades'), tx('Vale até'), tx('Liberado por'), ''].map((t, i) => <span key={i} className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{t}</span>)}
                </div>
                {lista.length ? lista.map(t => (
                    <div key={t.id} className={`px-4 py-3 border-b border-slate-100 last:border-0 dark:border-slate-800 ${t.situacao !== 'ATIVO' ? 'opacity-70' : ''}`}>
                        <div className="grid grid-cols-1 gap-1.5 md:gap-3 md:items-center md:grid-cols-[minmax(0,1.6fr)_90px_minmax(0,1.2fr)_140px_minmax(0,1fr)_auto]">
                            <div className="min-w-0">
                                <p className="text-[14px] font-bold text-slate-800 uppercase truncate dark:text-white">{t.nome}</p>
                                <p className="text-[13px] font-medium text-slate-600 flex items-center gap-1 truncate dark:text-slate-300">{t.email}<CopyButton textToCopy={t.email} label={tx('Copiar e-mail')} /></p>
                                {t.telefone && <p className="text-[12px] font-semibold text-slate-500 flex items-center gap-1 dark:text-slate-400">{telefoneBonito(t.telefone)}<CopyButton textToCopy={String(t.telefone).replace(/\D/g, '')} label={tx('Copiar telefone')} /></p>}
                                {t.acesso_fixo?.role && <p className="text-[11px] font-bold text-slate-400">{tx('Acesso fixo: {papel} · {unidade}', { papel: t.acesso_fixo.role, unidade: t.acesso_fixo.unidade || '—' })}{t.acesso_fixo.status === 'INATIVO' ? ` (${tx('inativo')})` : ''}</p>}
                            </div>
                            <span className="text-[12px] font-black uppercase text-blue-700 dark:text-blue-300">{tx(TIPO[t.tipo] || t.tipo)}</span>
                            <span className="text-[12px] font-bold uppercase text-slate-700 dark:text-slate-200">{(t.unidades || []).join(' · ')}</span>
                            <span className="text-[13px] font-bold tabular-nums text-slate-700 dark:text-slate-200">{dataBr(t.vale_ate)}<span className={`block text-[11px] font-black ${corDias(t)}`}>{textoDias(t)}</span>
                                {t.ultimo_login ? null : t.situacao === 'ATIVO' && <span className="block text-[11px] font-semibold text-slate-400">{tx('ainda não entrou')}</span>}</span>
                            <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-300" title={t.motivo}>{t.liberado_por_nome || t.liberado_por_email}
                                <span className="block text-[11px] text-slate-400 truncate">{t.motivo}</span>
                                {t.situacao === 'ENCERRADO' && <span className="block text-[11px] text-rose-500">{tx('Encerrado por {quem}: {motivo}', { quem: t.encerrado_por || '—', motivo: t.motivo_encerramento || '' })}</span>}
                                {(t.prorrogacoes || []).length > 0 && <span className="block text-[11px] text-blue-500">{tx('Prorrogado {qtd} vez(es)', { qtd: t.prorrogacoes.length })}</span>}
                            </span>
                            <span className="inline-flex flex-wrap gap-1.5 md:justify-end">
                                {t.telefone && <button type="button" onClick={() => avisarWhats(t)} title={tx('Mandar a mensagem no WhatsApp (e-mail, unidades e prazo)')} className="h-8 px-2.5 rounded-lg border border-emerald-200 text-emerald-700 text-[11px] font-black uppercase inline-flex items-center gap-1 hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-300"><MessageCircle className="w-3.5 h-3.5" />{tx('Avisar')}</button>}
                                {t.pode_gerir && t.situacao !== 'ENCERRADO' && <button type="button" onClick={() => setProrrogando(p => (p === t.id ? null : t.id))} className="h-8 px-2.5 rounded-lg border border-blue-200 text-blue-700 text-[11px] font-black uppercase inline-flex items-center gap-1 hover:bg-blue-50 dark:border-blue-500/30 dark:text-blue-300"><CalendarPlus className="w-3.5 h-3.5" />{tx('Prorrogar')}</button>}
                                {t.pode_gerir && t.situacao === 'ATIVO' && <button type="button" onClick={() => encerrar(t)} className="h-8 px-2.5 rounded-lg border border-rose-200 text-rose-600 text-[11px] font-black uppercase inline-flex items-center gap-1 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300"><Power className="w-3.5 h-3.5" />{tx('Encerrar')}</button>}
                            </span>
                        </div>
                        {prorrogando === t.id && <PainelProrrogar t={t} onCancelar={() => setProrrogando(null)} onFeito={() => { setProrrogando(null); onMudou?.(); }} />}
                    </div>
                )) : (
                    <p className="px-4 py-8 text-center text-[14px] font-bold text-slate-400 flex items-center justify-center gap-2"><Clock className="w-4 h-4" />{filtro === 'ativos' ? tx('Nenhum acesso temporário valendo.') : tx('Nenhum acesso temporário nos últimos 60 dias.')}</p>
                )}
            </div>
            <p className="text-[12px] font-semibold text-slate-400 flex items-start gap-1.5"><Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />{tx('Avisos de vencimento: a pessoa vê no sistema faltando 7, 3 e 1 dia; aqui fica amarelo a partir de 7 dias. O botão Avisar abre o WhatsApp com a mensagem pronta.')}</p>
        </div>
    );
};

export default AbaTemporarios;
