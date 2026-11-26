import React, { useCallback, useEffect, useState } from 'react';
import { BellRing, BellOff, Share, Loader2, Smartphone } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';
import { avisar } from '../avisar.js';
import { situacaoDoAparelho, ativarAvisos, religarAparelhoEmSilencio, lerModoAvisos, EVENTO_AVISOS_ATIVADOS, ERRO_PERGUNTA_NAO_APARECEU } from './avisosPush.js';

// ==========================================
// FAIXA "ATIVE OS AVISOS" (25/11/2026, decisão do dono: ninguém pode ignorar os avisos)
// Fica no topo de todas as telas até este aparelho estar recebendo. Não tem botão de fechar.
// Modo teste: só o Admin vê. Modo ligado: todos. Desligado ou sem o SQL: ninguém.
// O sistema não consegue impedir alguém de bloquear nas configurações do aparelho: aí a faixa fica vermelha
// ensinando a liberar.
// ==========================================
export default function FaixaAvisos({ papelReal }) {
    const [modo, setModo] = useState(null);
    const [situacao, setSituacao] = useState(null);
    const [ativando, setAtivando] = useState(false);
    const [problema, setProblema] = useState(''); // o que travou na última tentativa (fica escrito na faixa)

    const conferir = useCallback(async () => {
        const m = await lerModoAvisos();
        setModo(m);
        if (m === 'desligado') { setSituacao(null); return; }
        await religarAparelhoEmSilencio();
        setSituacao(await situacaoDoAparelho());
    }, []);

    useEffect(() => {
        conferir();
        const aoVoltar = () => { if (!document.hidden) conferir(); };
        document.addEventListener('visibilitychange', aoVoltar);
        window.addEventListener(EVENTO_AVISOS_ATIVADOS, conferir);
        return () => {
            document.removeEventListener('visibilitychange', aoVoltar);
            window.removeEventListener(EVENTO_AVISOS_ATIVADOS, conferir);
        };
    }, [conferir]);

    const vale = modo === 'ligado' || (modo === 'teste' && String(papelReal || '').toUpperCase() === 'ADMIN');
    if (!vale || !situacao || situacao === 'ativo') return null;

    const ativar = async () => {
        setAtivando(true);
        setProblema('');
        try {
            await ativarAvisos();
            avisar(tx('Avisos ativados neste aparelho.'), 'sucesso');
        } catch (e) {
            if (e.message !== 'BLOQUEADO') setProblema(e.message);
            if (e.message !== 'BLOQUEADO') avisar(tx('Não foi possível ativar os avisos: {erro}', { erro: tx(e.message) }), 'erro');
        } finally {
            setAtivando(false);
            setSituacao(await situacaoDoAparelho());
        }
    };

    const vermelha = situacao === 'bloqueado';
    return (
        <div role="status" className={`shrink-0 px-3 sm:px-5 py-2.5 border-b flex flex-wrap items-center gap-x-3 gap-y-2 ${vermelha
            ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300'
            : 'bg-blue-600 border-blue-700 text-white'}`}>
            {vermelha ? <BellOff className="w-4 h-4 shrink-0" /> : situacao === 'instalar' ? <Smartphone className="w-4 h-4 shrink-0" /> : <BellRing className="w-4 h-4 shrink-0" />}
            <div className="flex-1 min-w-[200px] text-xs font-bold leading-snug">
                {situacao === 'ativar' && <><span className="font-black uppercase tracking-widest">{tx('Ative os avisos do sistema neste aparelho.')}</span> {tx('Os comunicados e cobranças da diretoria chegam aqui, como mensagem.')}</>}
                {situacao === 'instalar' && <><span className="font-black uppercase tracking-widest">{tx('Para receber os avisos no iPhone, instale o app.')}</span> {tx('Toque em')} <Share className="w-3.5 h-3.5 inline -mt-0.5" /> {tx('Compartilhar → "Adicionar à Tela de Início" e abra o sistema pelo ícone "Vendas".')}</>}
                {situacao === 'sem_suporte' && <><span className="font-black uppercase tracking-widest">{tx('Este navegador não recebe avisos.')}</span> {tx('Use o Google Chrome no computador ou no Android, ou o app instalado no iPhone.')}</>}
                {situacao === 'ativar' && problema && (
                    <span className="block mt-1.5 rounded-lg bg-white/15 px-2 py-1.5">
                        ⚠️ {tx(problema)}{' '}
                        {problema === ERRO_PERGUNTA_NAO_APARECEU
                            ? tx('Libere à mão: Configurações do celular → Apps → Vendas → Notificações → Permitir. Depois volte aqui e toque em "Ativar avisos" de novo.')
                            : tx('Toque em "Ativar avisos" de novo. Se repetir, mande um print para o Admin.')}
                    </span>
                )}
                {situacao === 'bloqueado' && <><span className="font-black uppercase tracking-widest">{tx('Os avisos estão bloqueados neste aparelho.')}</span> {tx('Libere nas configurações: no Android, Configurações → Apps → Vendas (ou Chrome) → Notificações; no iPhone, Ajustes → Notificações → Vendas; no computador, o cadeado ao lado do endereço → Notificações → Permitir.')}</>}
            </div>
            {situacao === 'ativar' && (
                <button type="button" onClick={ativar} disabled={ativando}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-white text-blue-700 px-4 py-2 text-xs font-black uppercase tracking-widest hover:bg-blue-50 disabled:opacity-60">
                    {ativando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellRing className="w-3.5 h-3.5" />} {tx('Ativar avisos')}
                </button>
            )}
            {situacao === 'bloqueado' && (
                <button type="button" onClick={conferir}
                    className="shrink-0 rounded-xl border border-rose-300 dark:border-rose-500/40 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest hover:bg-rose-100 dark:hover:bg-rose-500/20">
                    {tx('Já liberei')}
                </button>
            )}
        </div>
    );
}
