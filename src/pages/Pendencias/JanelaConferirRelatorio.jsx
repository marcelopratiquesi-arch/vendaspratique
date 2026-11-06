// ==========================================
// JANELA "CONFERIU NO GRUPO?" (decisão do dono, 06/11/2026)
// Quando o sistema marca o relatório de fechamento da recepção como "não enviado", o Líder (na unidade dele),
// o Mentor (nas dele) ou o Admin — permissão 313 — confere no GRUPO DE VENDAS da unidade e responde:
// "Sim, foi enviado" (conta como enviado) ou "Não foi enviado" (confirmado). Nos dois casos sai da cobrança.
// Montada UMA vez no App; qualquer tela abre com pedirConferirRelatorio (relatorioFechamento.js)({ unidade, data, turno, rotulo, nomes }).
// ==========================================
import React, { useEffect, useState } from 'react';
import { Send, X, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';
import { avisar } from '../../components/avisar.js';
import { gravarConferenciaRelatorio, EVENTO_CONFERIR_RELATORIO as EVENTO } from './relatorioFechamento.js';

const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const JanelaConferirRelatorio = ({ usuario }) => {
    const [dados, setDados] = useState(null);
    const [gravando, setGravando] = useState('');

    useEffect(() => {
        const abrir = (e) => { setGravando(''); setDados(e.detail || null); };
        window.addEventListener(EVENTO, abrir);
        return () => window.removeEventListener(EVENTO, abrir);
    }, []);
    useEffect(() => {
        if (!dados) return undefined;
        const tecla = (e) => { if (e.key === 'Escape' && !gravando) setDados(null); };
        window.addEventListener('keydown', tecla);
        return () => window.removeEventListener('keydown', tecla);
    }, [dados, gravando]);

    if (!dados) return null;
    const hojeIso = new Date().toLocaleDateString('sv-SE');
    const dia = dados.data === hojeIso ? tx('de hoje') : ddmm(dados.data);
    const quem = dados.nomes?.length ? dados.nomes.join(' / ') : tx('a recepção');

    const responder = async (resultado) => {
        setGravando(resultado);
        const erro = await gravarConferenciaRelatorio({ usuario, unidade: dados.unidade, data: dados.data, turno: dados.turno, resultado });
        setGravando('');
        if (erro) {
            console.error('Relatório de fechamento: erro ao gravar a conferência', erro);
            avisar(tx('Não foi possível gravar a conferência: {erro}', { erro: erro.message || '' }), 'erro');
            return;
        }
        avisar(resultado === 'ENVIADO' ? tx('Registrado: relatório enviado (conferido no grupo).') : tx('Registrado: relatório NÃO enviado (confirmado).'), resultado === 'ENVIADO' ? 'sucesso' : 'atencao');
        setDados(null);
    };

    return (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="conferir-relatorio-titulo"
            onClick={() => !gravando && setDados(null)}>
            <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-[min(480px,100%)] overflow-hidden border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                <div className="px-6 py-5 bg-blue-600 text-white flex items-start gap-3">
                    <Send className="w-6 h-6 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                        <h2 id="conferir-relatorio-titulo" className="text-base font-black uppercase tracking-widest leading-tight">{tx('Conferiu no grupo de vendas?')}</h2>
                        <p className="text-[12px] font-bold uppercase tracking-widest opacity-90 mt-1">{dados.unidade}</p>
                    </div>
                    <button type="button" onClick={() => setDados(null)} disabled={!!gravando} aria-label={tx('Fechar')} className="opacity-80 hover:opacity-100"><X className="w-5 h-5" /></button>
                </div>
                <div className="px-6 py-5 space-y-3">
                    <p className="text-[15px] font-bold text-slate-800 leading-snug dark:text-white">
                        {tx('Abra o grupo de vendas da unidade {unidade} e confira: {quem} enviou o relatório de fechamento do turno da {turno} {dia}?', { unidade: dados.unidade, quem, turno: tx(dados.rotulo || ''), dia })}
                    </p>
                    <p className="text-[12px] font-semibold text-slate-500 leading-snug dark:text-slate-400">
                        {tx('O sistema não registrou o envio (o registro automático só conta o clique em Copiar ou Enviar no WhatsApp Fechamento, pelo login da Recepção, dentro do horário). A sua resposta fica registrada com o seu nome.')}
                    </p>
                </div>
                <div className="px-6 py-4 border-t border-slate-200 flex flex-col gap-2 dark:border-slate-800">
                    <div className="flex flex-col sm:flex-row gap-2">
                        <button type="button" onClick={() => responder('ENVIADO')} disabled={!!gravando}
                            className="flex-1 h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-[11px] font-black uppercase tracking-widest inline-flex items-center justify-center gap-2">
                            {gravando === 'ENVIADO' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}{tx('Sim, foi enviado')}
                        </button>
                        <button type="button" onClick={() => responder('NAO_ENVIADO')} disabled={!!gravando}
                            className="flex-1 h-11 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-[11px] font-black uppercase tracking-widest inline-flex items-center justify-center gap-2">
                            {gravando === 'NAO_ENVIADO' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}{tx('Não foi enviado')}
                        </button>
                    </div>
                    <button type="button" onClick={() => setDados(null)} disabled={!!gravando}
                        className="h-10 px-4 rounded-xl bg-slate-100 text-slate-600 text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                        {tx('Ainda não conferi')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default JanelaConferirRelatorio;
