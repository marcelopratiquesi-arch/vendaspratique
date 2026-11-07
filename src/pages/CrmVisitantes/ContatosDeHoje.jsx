import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { CalendarCheck, X, MessageCircle, Check, Loader2, Cake, UserCheck, Repeat, PenSquare, Ban, AlarmClock, PhoneCall } from 'lucide-react';
import { JanelaNaoContatar, JanelaJustificativa } from './JanelasContato';
import {
    ehVisitanteRecepcao, dataDaVisita, diaISO, MENSAGENS_PADRAO,
    abrirNoWhatsApp, marcaFeitoPor, podeEditarMensagensProntas, textoMensagemEnviada
} from './utils';
import {
    carregarMensagensProntas, carregarContatosFeitos, registrarContatoFeito,
    carregarNaoContatar, carregarAniversariantes, chaveContatoFeito, estaNaoContatar, incluirNaoContatar, ligarPeloSip
} from './contatosFeitos';
import MensagensProntas from './MensagensProntas';
import { montarMensagem, previaMensagem, ROTULOS_MENSAGENS } from './embaralhador.js';
import { avisar } from '../../components/avisar.js';
import { tx, localeAtual } from '../../i18n/traduzir.js';

// ==========================================
// POP-UP "CONTATOS DE HOJE"
// Visitantes 24h (visitaram ontem), Visitantes 48h (anteontem) e aniversariantes do dia da unidade.
// Atrasados: visitaram de 3 a 7 dias atrás e ainda não tiveram o 2º contato (ex.: o prazo caiu num domingo).
// Todas as recepcionistas veem todos os pendentes da unidade; quem marcar primeiro tira da lista.
// Fica sempre montado (calcula os pendentes para o botão do CRM) e só desenha a janela quando aberto.
// "embutido" (06/11/2026): aparece dentro da aba Hoje do CRM, sem janela por cima e sem botão de fechar.
// "onDados" (06/11/2026): manda para a Conversa (botão Hoje) todos os contatos do dia, FEITOS e pendentes
// (com hora, quem fez e o meio), e as ações (WhatsApp, Ligar, marcar feito) para tudo contar igual.
// Botão Ligar (MicroSIP): registra o contato do dia com o meio LIGACAO (não fica vermelho).
// ==========================================

const GRUPOS = [
    { tipo: 'VISITANTE_24H', titulo: 'Visitantes 24h', sub: 'Visitaram ontem: primeiro contato', icone: UserCheck, cor: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/15' },
    { tipo: 'VISITANTE_48H', titulo: 'Visitantes 48h', sub: 'Visitaram anteontem: segundo contato', icone: Repeat, cor: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15' },
    { tipo: 'ATRASADOS', titulo: 'Atrasados (até 7 dias)', sub: 'Visitantes sem o 2º contato: o prazo já passou, ainda dá tempo', icone: AlarmClock, cor: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/15' },
    { tipo: 'ANIVERSARIO', titulo: 'Aniversariantes do dia', sub: 'Alunos da unidade', icone: Cake, cor: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/15' }
];

const ContatosDeHoje = ({ unidade, operador, leads = [], usuarioLogado, aberto, onFechar, onPendentes, registrarHistorico, onNaoContatar, onContatoFeito, versao = 0, embutido = false, onDados }) => {
    // Janelas: justificativa (feito sem WhatsApp) e "Não contatar"
    const [justificando, setJustificando] = useState(null);
    const [bloqueando, setBloqueando] = useState(null);
    const [mensagens, setMensagens] = useState(MENSAGENS_PADRAO);
    const [feitos, setFeitos] = useState(new Map()); // chave -> { criado_em, consultor, canal }
    const [naoContatar, setNaoContatar] = useState(new Set());
    const [aniversariantes, setAniversariantes] = useState([]);
    // Começa "carregando": só conta pendentes depois de saber quem já foi atendido
    const [carregando, setCarregando] = useState(true);
    const [marcando, setMarcando] = useState('');
    const [editandoMensagens, setEditandoMensagens] = useState(false);

    const hoje = diaISO(0);
    const ontem = diaISO(-1);
    const anteontem = diaISO(-2);
    const DIAS_ATRASADOS = 7;
    const inicioAtrasados = diaISO(-DIAS_ATRASADOS);
    const unidadeChave = String(unidade || '').toUpperCase().trim();
    const podeEditarMensagens = podeEditarMensagensProntas(usuarioLogado);

    const carregar = useCallback(async () => {
        if (!unidadeChave) return;
        setCarregando(true);
        const [msgs, linhasFeitas, bloqueados, aniv] = await Promise.all([
            carregarMensagensProntas(),
            carregarContatosFeitos({ tipos: ['VISITANTE_24H', 'VISITANTE_48H', 'ANIVERSARIO'], desde: inicioAtrasados }),
            carregarNaoContatar(),
            carregarAniversariantes(unidadeChave)
        ]);
        setMensagens(msgs);
        setFeitos(new Map((linhasFeitas || []).map(r => [chaveContatoFeito(r.tipo, r.lead_id || r.aluno_id, r.referencia), { criado_em: r.criado_em, consultor: r.consultor, canal: r.canal }])));
        setNaoContatar(bloqueados);
        setAniversariantes(aniv || []);
        setCarregando(false);
    }, [unidadeChave, inicioAtrasados]);

    useEffect(() => { carregar(); }, [carregar, versao]);

    // Contatos do dia de cada grupo (fora: Não contatar e quem já fechou plano); "pendentes" = ainda não feitos
    const todosDoDia = useMemo(() => {
        const visitantes = leads.filter(l =>
            ehVisitanteRecepcao(l)
            && String(l.unidade || '').toUpperCase().trim() === unidadeChave
            && !['Fechado', 'Arquivado'].includes(l.status)
            && !estaNaoContatar(naoContatar, { cpf: l.cpf, leadId: String(l.id) })
        );
        const pessoaDoLead = (l, tipo, dia, atrasado = false) => ({
            chave: chaveContatoFeito(tipo, String(l.id), dia),
            tipo, referencia: dia, lead: l, lead_id: String(l.id), aluno_id: null, atrasado,
            nome: l.nome, telefone: l.telefone, cpf: l.cpf,
            detalhe: `${atrasado ? tx('ATRASADO') + ' · ' : ''}${tx('Visitou em {dia}', { dia: dia.split('-').reverse().join('/') })}${l.vendedor ? ` · ${tx('atendido por {nome}', { nome: String(l.vendedor).split(' ')[0] })}` : ''}`
        });
        const v24 = visitantes.filter(l => dataDaVisita(l) === ontem).map(l => pessoaDoLead(l, 'VISITANTE_24H', ontem));
        const v48 = visitantes.filter(l => dataDaVisita(l) === anteontem).map(l => pessoaDoLead(l, 'VISITANTE_48H', anteontem));
        // Atrasado: o 2º contato (48h) não foi feito e o prazo já passou. Feito aqui, conta como atrasado na planilha.
        const atrasados = visitantes
            .filter(l => { const d = dataDaVisita(l); return d && d >= inicioAtrasados && d < anteontem; })
            .map(l => pessoaDoLead(l, 'VISITANTE_48H', dataDaVisita(l), true))
            .sort((a, b) => b.referencia.localeCompare(a.referencia));
        const aniv = aniversariantes
            .filter(a => !estaNaoContatar(naoContatar, { cpf: a.cpf, alunoId: a.aluno_id }))
            .map(a => ({
                chave: chaveContatoFeito('ANIVERSARIO', String(a.aluno_id), hoje),
                tipo: 'ANIVERSARIO', referencia: hoje, lead: null, lead_id: null, aluno_id: a.aluno_id,
                nome: a.nome, telefone: a.telefone, cpf: a.cpf,
                detalhe: a.data_nascimento ? tx('Faz {idade} anos hoje', { idade: new Date().getFullYear() - Number(String(a.data_nascimento).slice(0, 4)) }) : tx('Aniversário hoje')
            }));
        // Todos (feitos e pendentes), cada um com o registro do contato quando já foi feito
        const comFeito = (lista) => lista.map(p => ({ ...p, feito: feitos.get(p.chave) || null }));
        return { VISITANTE_24H: comFeito(v24), VISITANTE_48H: comFeito(v48), ATRASADOS: comFeito(atrasados), ANIVERSARIO: comFeito(aniv) };
    }, [leads, unidadeChave, naoContatar, aniversariantes, feitos, ontem, anteontem, hoje, inicioAtrasados]);
    // Atrasado que já foi feito sai da lista (o "feito" de um atrasado conta só nele)
    const pendentes = useMemo(() => Object.fromEntries(Object.entries(todosDoDia).map(([k, lista]) => [k, lista.filter(p => !p.feito)])), [todosDoDia]);

    const totalPendentes = GRUPOS.reduce((soma, g) => soma + pendentes[g.tipo].length, 0);
    useEffect(() => { if (onPendentes) onPendentes(totalPendentes, carregando); }, [totalPendentes, carregando, onPendentes]);

    // Cada clique monta uma versão nova da mensagem (embaralhador); a dica do botão mostra uma prévia fixa
    const textoDe = (pessoa) => montarMensagem(pessoa.tipo, { nome: pessoa.nome, unidade: unidadeChave }, mensagens);
    const previaDe = (pessoa) => previaMensagem(pessoa.tipo, { nome: pessoa.nome, unidade: unidadeChave }, mensagens);

    const rotuloDe = (pessoa) => `${ROTULOS_MENSAGENS[pessoa.tipo] || ''}${pessoa.atrasado ? ' · atrasado' : ''}`;

    // Ligar (MicroSIP): conta como feito com o meio LIGACAO e registra a ligação no funil (visitante)
    const ligar = async (pessoa) => {
        if (!pessoa.telefone) return avisar(tx("Este contato está sem telefone cadastrado."));
        ligarPeloSip(pessoa.telefone);
        if (pessoa.lead && registrarHistorico) await registrarHistorico(pessoa.lead.id, 'Ligação', `Tentativa de contato telefônico (MicroSIP) para o número ${pessoa.telefone}`);
        await marcarFeito(pessoa, { canal: 'LIGACAO' });
    };

    // Anti-golpe: abrir o WhatsApp JÁ conta como feito (canal WHATSAPP) e tira a pessoa da lista
    const abrirWhatsApp = async (pessoa) => {
        if (!pessoa.telefone) return avisar(tx("Este contato está sem telefone cadastrado."));
        const texto = textoDe(pessoa);
        abrirNoWhatsApp(pessoa.telefone, texto);
        if (pessoa.lead && registrarHistorico) await registrarHistorico(pessoa.lead.id, 'WhatsApp', textoMensagemEnviada(texto, rotuloDe(pessoa)));
        await marcarFeito(pessoa, { canal: 'WHATSAPP' });
    };

    // "Marcar como feito" sem WhatsApp: canal MANUAL + justificativa (aparece em vermelho para o Líder)
    const marcarFeito = async (pessoa, { canal, justificativa = null }) => {
        setMarcando(pessoa.chave);
        try {
            await registrarContatoFeito({
                unidade: unidadeChave,
                consultor: operador,
                tipo: pessoa.tipo,
                lead_id: pessoa.lead_id,
                aluno_id: pessoa.aluno_id,
                nome: pessoa.nome,
                referencia: pessoa.referencia,
                canal,
                justificativa,
                observacao: marcaFeitoPor(usuarioLogado, operador) || null
            });
            // Aniversário (sem contato no funil) soma na meta do dia; visitante já soma pelo histórico do funil
            if (!pessoa.lead && onContatoFeito) onContatoFeito(`Contato ${pessoa.tipo === 'ANIVERSARIO' ? 'de aniversário' : ''} ${canal === 'WHATSAPP' ? 'via WhatsApp' : canal === 'LIGACAO' ? 'por ligação' : 'sem WhatsApp'}`, `aluno:${pessoa.aluno_id}`);
            if (pessoa.lead && registrarHistorico && canal === 'MANUAL') {
                await registrarHistorico(pessoa.lead.id, 'Observação', `Contato de ${pessoa.tipo === 'VISITANTE_24H' ? '24h' : '48h'} do visitante marcado como feito SEM WhatsApp: ${justificativa}.`);
            }
            setFeitos(prev => new Map(prev).set(pessoa.chave, { criado_em: new Date().toISOString(), consultor: operador, canal }));
        } catch (err) {
            console.error('Erro ao marcar contato como feito:', err);
            avisar(tx("Não foi possível marcar como feito.\n\n{v1}", { v1: err?.message || '' }));
        } finally {
            setMarcando('');
        }
    };

    const acoesRef = useRef({});
    acoesRef.current = { abrirWhatsApp, ligar, marcarFeito, textoDe, rotuloDe };
    const acoes = useMemo(() => ({
        abrirWhatsApp: (p) => acoesRef.current.abrirWhatsApp(p),
        ligar: (p) => acoesRef.current.ligar(p),
        marcarFeito: (p, opcoes) => acoesRef.current.marcarFeito(p, opcoes),
        textoDe: (p) => acoesRef.current.textoDe(p),
        rotuloDe: (p) => acoesRef.current.rotuloDe(p),
    }), []);
    useEffect(() => { if (onDados) onDados({ grupos: todosDoDia, carregando, acoes }); }, [todosDoDia, carregando, acoes, onDados]);

    if (!aberto) return null;

    return (
        <div className={embutido ? '' : 'fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-3 md:p-8 overflow-y-auto animate-[fadeIn_0.15s_ease-out]'} onMouseDown={embutido ? undefined : (e) => { if (e.target === e.currentTarget) onFechar(); }}>
            <div className={embutido ? 'w-full bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden' : 'w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 my-auto overflow-hidden'}>
                <div className={`${embutido ? 'px-4 py-3' : 'px-6 py-5'} border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3`}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center"><CalendarCheck className="w-5 h-5" /></div>
                        <div>
                            <h3 className="text-base font-black uppercase tracking-widest text-slate-800 dark:text-white">{embutido ? tx("Visitantes e aniversariantes de hoje") : tx("Contatos de hoje")}</h3>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{unidadeChave} · {new Date().toLocaleDateString(localeAtual())} · {totalPendentes}{' '}{tx("pendente(s)")}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {podeEditarMensagens && (
                            <button type="button" onClick={() => setEditandoMensagens(true)} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 flex items-center gap-1.5 transition-colors">
                                <PenSquare className="w-3.5 h-3.5" />{' '}{tx("Mensagens")}
                            </button>
                        )}
                        {!embutido && <button type="button" onClick={onFechar} className="p-2 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400" title={tx("Fechar")}><X className="w-4 h-4" /></button>}
                    </div>
                </div>

                <div className={embutido ? 'p-4 space-y-5' : 'p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar'}>
                    {carregando && <div className="flex items-center gap-2 text-xs font-bold text-slate-400"><Loader2 className="w-4 h-4 animate-spin" />{' '}{tx("Atualizando...")}</div>}
                    {GRUPOS.map(g => {
                        const Icone = g.icone;
                        const lista = pendentes[g.tipo];
                        return (
                            <div key={g.tipo}>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${g.cor}`}><Icone className="w-4 h-4" /></div>
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">{tx(g.titulo)} <span className="text-slate-400">({lista.length})</span></p>
                                        <p className="text-[10px] font-bold text-slate-400">{tx(g.sub)}</p>
                                    </div>
                                </div>
                                {lista.length === 0 ? (
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600 pl-10">{tx("Nenhum pendente")}</p>
                                ) : (
                                    <div className="space-y-2">
                                        {lista.map(p => (
                                            <div key={p.chave} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-black text-slate-800 dark:text-white uppercase truncate">{p.nome}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 truncate">{p.telefone || tx("Sem telefone")} · {p.detalhe}</p>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <button type="button" onClick={() => abrirWhatsApp(p)} disabled={marcando === p.chave} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors" title={tx("Abre o WhatsApp e já registra o contato:\n\n{v1}", { v1: previaDe(p) })}>
                                                        {marcando === p.chave ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}{' '}{tx("WhatsApp")}
                                                    </button>
                                                    <button type="button" onClick={() => ligar(p)} disabled={marcando === p.chave || !p.telefone} className="px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-600 hover:text-white disabled:opacity-60 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors" title={tx("Ligar (MicroSIP) e já registrar o contato")}>
                                                        <PhoneCall className="w-3.5 h-3.5" />{' '}{tx("Ligar")}
                                                    </button>
                                                    <button type="button" onClick={() => setJustificando(p)} disabled={marcando === p.chave} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900 disabled:opacity-60 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors" title={tx("Para contato feito por ligação ou pessoalmente (fica em vermelho para o Líder)")}>
                                                        <Check className="w-3.5 h-3.5" />{' '}{tx("Feito sem WhatsApp")}
                                                    </button>
                                                    <button type="button" onClick={() => setBloqueando(p)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors dark:hover:text-rose-400" title={tx("Não contatar (a pessoa pediu para não receber contato)")}>
                                                        <Ban className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {justificando && (
                <JanelaJustificativa
                    pessoa={justificando}
                    onFechar={() => setJustificando(null)}
                    onConfirmar={(justificativa) => marcarFeito(justificando, { canal: 'MANUAL', justificativa })}
                />
            )}
            {bloqueando && (
                <JanelaNaoContatar
                    pessoa={bloqueando}
                    unidade={unidadeChave}
                    quem={operador}
                    onFechar={() => setBloqueando(null)}
                    onFeito={(p) => {
                        setNaoContatar(prev => incluirNaoContatar(prev, { cpf: p.cpf, leadId: p.lead_id, alunoId: p.aluno_id }));
                        if (onNaoContatar) onNaoContatar(p);
                    }}
                />
            )}

            {editandoMensagens && (
                <MensagensProntas
                    mensagens={mensagens}
                    usuarioLogado={usuarioLogado}
                    onFechar={() => setEditandoMensagens(false)}
                    onSalvo={(novas) => setMensagens(novas)}
                />
            )}
        </div>
    );
};

export default ContatosDeHoje;
