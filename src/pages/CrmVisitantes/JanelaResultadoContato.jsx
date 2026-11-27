import React from 'react';
import { createPortal } from 'react-dom';
import { X, Star, ClipboardCheck, Clock3, ThumbsDown, PhoneMissed, MessageSquareText, CheckCircle2, Dumbbell, PhoneOff, MessageCircleOff, XCircle, UserCheck, IdCard } from 'lucide-react';
import { somarDiasISO } from './utils';
import { caixaDoApp } from '../../components/caixaDoApp.js';
import { tx } from '../../i18n/traduzir.js';
import { DIAS_VOLTA_PENSANDO, DIAS_VOLTA_SEM_RESPOSTA, DIAS_GELADEIRA, MAX_TENTATIVAS, dataBR } from './resultadoContato.js';

// Janela "Como foi o contato?" (Migração e Resgate). Abre depois do WhatsApp/Ligar ou pelo botão Resultado.
// textoInteressado / textoNaoQuer: o que acontece em cada aba.
// obrigatorio (funil, decisão do dono 09/11/2026): todo contato precisa de um caminho → sem "Decidir depois" e sem fechar.
// textoFechou: mostra a opção "Comprou / fechou" (só no funil).
// textoWellhub (16/11/2026, decisão do dono): mostra a opção "Wellhub / Gympass" (só no funil): o contato sai do funil e vai
// para o grupo WELLHUB / GYMPASS da aba Migração (a única coisa a oferecer é o Nutri).
// textoNaoFunciona / textoNaoContatar (26/11/2026, decisão do dono; só no funil): "Telefone / WhatsApp não funciona" e
// "Não contatar" (cliente pediu para não entrar mais em contato). Os dois vão para Perdido E para o "Não contatar":
// ficam impedidos para sempre (a Geladeira libera em 30 dias; o "Não contatar" não).
// Desenho (27/11/2026, escolha do dono): computador = faixas deitadas com 4 opções lado a lado (frase completa);
// celular = botões em 2 colunas com texto curto. Desenhada fora do <main> (caixaDoApp), senão a barra do topo tampa o título.
const JanelaResultadoContato = ({ aluno, hoje, onEscolher, onFechar, textoInteressado, textoNaoQuer, obrigatorio = false, textoFechou, textoWellhub, textoNaoFunciona, textoNaoContatar, textoJaAluno, textoPersonal }) => {
    const tentativas = Number(aluno.registro?.tentativas) || 0;
    const proxima = Math.min(tentativas + 1, MAX_TENTATIVAS);
    const vaiParaGeladeira = proxima >= MAX_TENTATIVAS;
    const volta = (dias) => dataBR(somarDiasISO(hoje, dias));
    // curto = texto do celular · texto = frase completa do computador
    const opcoes = [
        { tipo: 'PENSANDO', icone: MessageSquareText, titulo: tx('Respondeu, vai pensar'), curto: tx('Volta {dia}', { dia: volta(DIAS_VOLTA_PENSANDO) }), texto: tx('Volta para você em {dias} dias ({dia}).', { dias: DIAS_VOLTA_PENSANDO, dia: volta(DIAS_VOLTA_PENSANDO) }), cor: 'border-blue-200 dark:border-blue-500/30 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-blue-700 dark:text-blue-300' },
        { tipo: 'SEM_RESPOSTA', icone: PhoneMissed, titulo: tx('Não respondeu / não atendeu'), curto: vaiParaGeladeira ? tx('{n}ª vez: geladeira', { n: proxima }) : tx('Volta {dia} · {n} de {max}', { dia: volta(DIAS_VOLTA_SEM_RESPOSTA), n: proxima, max: MAX_TENTATIVAS }), texto: vaiParaGeladeira ? tx('{n}ª tentativa: vai para a geladeira e volta em {dias} dias.', { n: proxima, dias: DIAS_GELADEIRA }) : tx('Tentativa {n} de {max}. Volta em {dias} dias ({dia}).', { n: proxima, max: MAX_TENTATIVAS, dias: DIAS_VOLTA_SEM_RESPOSTA, dia: volta(DIAS_VOLTA_SEM_RESPOSTA) }), cor: 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200' },
        { tipo: 'INTERESSADO', icone: Star, titulo: tx('Interessado'), curto: tx('Volta amanhã'), texto: textoInteressado, cor: 'border-amber-200 dark:border-amber-500/30 hover:bg-amber-50 dark:hover:bg-amber-500/10 text-amber-700 dark:text-amber-300' },
        { tipo: 'NAO_QUER', icone: ThumbsDown, titulo: tx('Não quer'), curto: tx('Geladeira'), texto: textoNaoQuer, cor: 'border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300' },
        textoWellhub && { tipo: 'WELLHUB', icone: Dumbbell, titulo: tx('Wellhub / Gympass'), curto: tx('Vai para Migração'), texto: textoWellhub, cor: 'border-fuchsia-200 dark:border-fuchsia-500/30 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300' },
        textoNaoFunciona && { tipo: 'NAO_FUNCIONA', icones: [PhoneOff, MessageCircleOff], titulo: tx('Telefone com problema'), curto: tx('Corrigir número'), texto: textoNaoFunciona, cor: 'border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200' },
        textoJaAluno && { tipo: 'JA_ALUNO', icone: UserCheck, titulo: tx('Já é aluno'), curto: tx('Sai da fila'), texto: textoJaAluno, cor: 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200' },
        textoPersonal && { tipo: 'PERSONAL', icone: IdCard, titulo: tx('É personal trainer'), curto: tx('Sai da fila'), texto: textoPersonal, cor: 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200' },
        textoNaoContatar && { tipo: 'NAO_CONTATAR', icone: XCircle, titulo: tx('Não contatar'), curto: tx('Bloqueia na rede'), texto: textoNaoContatar, cor: 'border-rose-200 dark:border-rose-500/30 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-700 dark:text-rose-300' },
        textoFechou && { tipo: 'FECHOU', icone: CheckCircle2, titulo: tx('Comprou / fechou'), curto: tx('Vai para Fechado'), texto: textoFechou, cor: 'border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' }
    ].filter(Boolean);
    const opcao = (tipo) => opcoes.find(o => o.tipo === tipo);
    // Faixas: do melhor para o pior resultado; quem sai da fila fica separado das opções de venda
    const faixas = [
        { titulo: tx('Falei com a pessoa'), itens: ['FECHOU', 'INTERESSADO', 'PENSANDO', 'NAO_QUER'].map(opcao).filter(Boolean) },
        { titulo: tx('Falei, e sai desta fila'), itens: ['WELLHUB', 'JA_ALUNO', 'PERSONAL', 'NAO_CONTATAR'].map(opcao).filter(Boolean) }
    ].filter(f => f.itens.length);
    const semFalar = [
        { titulo: tx('Não consegui falar'), item: opcao('SEM_RESPOSTA') },
        { titulo: tx('O número está errado?'), item: opcao('NAO_FUNCIONA'), semTituloNoCelular: true }
    ].filter(c => c.item);
    const classeTitulo = 'text-[10px] font-black uppercase tracking-widest text-slate-400';
    // Função (e não componente) para os botões não serem recriados a cada atualização da tela
    const botao = (o, deitado = false) => (
        <button key={o.tipo} type="button" onClick={() => onEscolher(o.tipo)} className={`w-full h-full text-left rounded-xl border p-3 flex flex-col items-start gap-1.5 transition-colors ${deitado ? 'md:flex-row md:gap-3' : ''} ${o.cor}`}>
            {o.icones
                ? <span className="flex items-center gap-0.5 shrink-0">{o.icones.map((Ic, i) => <Ic key={i} className="w-5 h-5" />)}</span>
                : <o.icone className="w-5 h-5 shrink-0" />}
            <span className="min-w-0">
                <span className="block text-[11px] md:text-xs font-black uppercase tracking-wide md:tracking-wider leading-snug">{o.titulo}</span>
                <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    <span className="md:hidden">{o.curto}</span>
                    <span className="hidden md:inline">{o.texto}</span>
                </span>
            </span>
        </button>
    );
    return createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center max-md:items-end bg-slate-900/60 backdrop-blur-sm p-4 max-md:p-0 max-md:pb-[var(--faixa-instalar)]" role="dialog" aria-modal="true">
            <div className="flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-[min(820px,100%)] border border-slate-200 dark:border-slate-800 overflow-hidden max-h-full max-md:w-full max-md:max-h-[92dvh] max-md:rounded-b-none">
                <div className="shrink-0 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-start gap-3">
                    <ClipboardCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">{tx('Como foi o contato?')}</h3>
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 truncate max-md:whitespace-normal">{aluno.nome}</p>
                    </div>
                    {!obrigatorio && <button type="button" onClick={onFechar} aria-label={tx('Fechar')} className="p-2.5 -m-2 shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X className="w-5 h-5" /></button>}
                </div>
                <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-3 space-y-3">
                    {faixas.map(f => (
                        <div key={f.titulo} className="space-y-2">
                            <p className={classeTitulo}>{f.titulo}</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{f.itens.map(o => botao(o))}</div>
                        </div>
                    ))}
                    {semFalar.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                            {semFalar.map(c => (
                                <div key={c.item.tipo} className="flex flex-col gap-2">
                                    <p className={`${classeTitulo} ${c.semTituloNoCelular ? 'max-md:invisible' : ''}`}>{c.titulo}</p>
                                    <div className="flex-1">{botao(c.item, true)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                {obrigatorio ? (
                    <p className="shrink-0 px-5 py-3 border-t border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))]">{tx('Escolha um caminho: todo contato precisa de um destino.')}</p>
                ) : (
                    <div className="shrink-0 px-4 py-3 border-t border-slate-100 dark:border-slate-800 max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                        <button type="button" onClick={onFechar} className="w-full h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center gap-1.5" title={tx('Fecha sem marcar o resultado (não conta tentativa)')}>
                            <Clock3 className="w-3.5 h-3.5" />{' '}{tx('Decidir depois')}
                        </button>
                    </div>
                )}
            </div>
        </div>,
        caixaDoApp()
    );
};

export default JanelaResultadoContato;
