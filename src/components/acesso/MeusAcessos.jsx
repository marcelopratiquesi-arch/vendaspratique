import React, { useEffect, useState } from 'react';
import { History, X, Loader2, AlertOctagon } from 'lucide-react';
import { tx, localeAtual } from '../../i18n/traduzir.js';
import { avisar } from '../avisar.js';
import { meusAcessos, avisarNaoFuiEu } from './acessoBanco.js';

// ==========================================
// MEUS ACESSOS (12/11/2026): os últimos acessos de quem está logado (quando, como, de qual aparelho) e o botão
// "Não fui eu", que avisa a diretoria (aparece em Pendências → Acessos).
// ==========================================

const EVENTO = { LOGIN: 'Entrou', LOGOUT: 'Saiu', EXPIROU: 'Sessão expirou', NEGADO: 'Acesso negado' };
const quando = (v) => { const d = new Date(v); return isNaN(d) ? '—' : d.toLocaleString(localeAtual(), { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); };

const MeusAcessos = ({ onFechar }) => {
    const [lista, setLista] = useState(null);
    const [avisados, setAvisados] = useState(new Set());

    useEffect(() => {
        meusAcessos().then(setLista).catch(e => { setLista([]); avisar(e.message || tx('Não foi possível carregar os acessos.'), 'erro'); });
    }, []);
    useEffect(() => {
        const aoTeclar = (e) => { if (e.key === 'Escape') onFechar(); };
        window.addEventListener('keydown', aoTeclar);
        return () => window.removeEventListener('keydown', aoTeclar);
    }, [onFechar]);

    const naoFuiEu = async (l) => {
        const texto = window.prompt(tx('Conte o que aconteceu (opcional). A diretoria será avisada.'));
        if (texto === null) return;
        try { await avisarNaoFuiEu(l.id, texto); setAvisados(s => new Set([...s, l.id])); avisar(tx('Aviso enviado à diretoria.'), 'sucesso'); }
        catch (e) { avisar(e.message || tx('Não foi possível enviar.'), 'erro'); }
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-meus-acessos" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-[min(560px,100%)] max-h-[85vh] overflow-hidden flex flex-col dark:bg-slate-900">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-3 dark:border-slate-800">
                    <History className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h2 id="titulo-meus-acessos" className="flex-1 text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">{tx('Meus acessos')}</h2>
                    <button type="button" onClick={onFechar} aria-label={tx('Fechar')} className="text-slate-500 hover:text-slate-800 dark:text-slate-400"><X className="w-5 h-5" /></button>
                </div>
                <div className="overflow-y-auto custom-scrollbar">
                    {lista === null && <p className="p-6 text-[12px] font-semibold text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{tx('Carregando...')}</p>}
                    {lista?.length === 0 && <p className="p-6 text-[12px] font-semibold text-slate-400">{tx('Nenhum acesso registrado ainda.')}</p>}
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {(lista || []).map(l => (
                            <li key={l.id} className="px-6 py-3 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[13px] font-bold text-slate-800 dark:text-white">{tx(EVENTO[l.evento] || l.evento)} · {quando(l.quando)}</p>
                                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{[l.metodo === 'google' ? 'Google' : l.metodo === 'senha' ? tx('Senha') : l.metodo, l.dispositivo].filter(Boolean).join(' · ')}</p>
                                </div>
                                {l.evento === 'LOGIN' && (avisados.has(l.id)
                                    ? <span className="text-[11px] font-black text-rose-600 dark:text-rose-400">{tx('Avisado')}</span>
                                    : <button type="button" onClick={() => naoFuiEu(l)} className="shrink-0 h-8 px-3 rounded-lg border border-rose-200 text-rose-600 text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-400"><AlertOctagon className="w-3.5 h-3.5" />{tx('Não fui eu')}</button>)}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default MeusAcessos;
