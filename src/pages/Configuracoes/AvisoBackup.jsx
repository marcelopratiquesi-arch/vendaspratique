// ==========================================
// AVISO DE BACKUP AO ENTRAR — só o Admin (decisão do dono, 19/11/2026; permissão 912)
// Se a última cópia dos dados (Configurações → Backup) tem mais de 7 dias, ou nunca foi feita, abre uma janela
// uma vez por entrada no sistema: "Fazer cópia agora" (abre a aba Backup) ou "Lembrar depois".
// Sem a tabela backups_log no banco (SQL de 19/11/2026 não rodado) não aparece nada.
// ==========================================
import React, { useEffect, useState } from 'react';
import { DatabaseBackup, X } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';
import { podeFazer } from '../../permissoes/catalogoPermissoes.js';
import { ultimaCopiaDados, precisaAvisarBackup, situacaoBackup } from './backup.js';

const CHAVE_VISTO = 'pratique_aviso_backup_visto';
const jaViuNestaEntrada = () => { try { return sessionStorage.getItem(CHAVE_VISTO) === '1'; } catch { return false; } };
const marcarVisto = () => { try { sessionStorage.setItem(CHAVE_VISTO, '1'); } catch { /* sem armazenamento: some só nesta tela */ } };

const AvisoBackup = ({ usuario, aoFazerBackup }) => {
    const ehAdmin = String(usuario?.role || '').toUpperCase() === 'ADMIN' && podeFazer(usuario, '912');
    const [ultima, setUltima] = useState(undefined); // undefined = carregando ou não mostra
    const [fechado, setFechado] = useState(() => jaViuNestaEntrada());

    useEffect(() => {
        if (!ehAdmin || fechado) return undefined;
        let ativo = true;
        ultimaCopiaDados().then(r => {
            if (!ativo || r.semTabela) return;
            setUltima(r.ultima || null);
        });
        return () => { ativo = false; };
    }, [ehAdmin, fechado]);

    if (!ehAdmin || fechado || ultima === undefined) return null;
    if (!precisaAvisarBackup(ultima?.criado_em)) return null;

    const situacao = situacaoBackup(ultima?.criado_em);
    const fechar = () => { marcarVisto(); setFechado(true); };
    const fazer = () => { fechar(); aoFazerBackup?.(); };

    return (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]" role="dialog" aria-modal="true" aria-labelledby="aviso-backup-titulo">
            <div className="bg-white rounded-2xl shadow-2xl w-[min(480px,100%)] max-h-[92dvh] overflow-y-auto border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                <div className={`px-6 py-5 flex items-start gap-3 text-white ${situacao.nivel === 'atencao' ? 'bg-amber-500' : 'bg-rose-600'}`}>
                    <DatabaseBackup className="w-6 h-6 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                        <h2 id="aviso-backup-titulo" className="text-base font-black uppercase tracking-widest leading-tight">{tx('Hora de fazer o backup')}</h2>
                        <p className="text-[12px] font-bold uppercase tracking-widest opacity-90 mt-1">
                            {situacao.nivel === 'nunca' ? tx('Nenhuma cópia feita ainda') : tx('Última cópia há {dias} dias', { dias: situacao.dias })}
                        </p>
                    </div>
                    <button type="button" onClick={fechar} aria-label={tx('Fechar')} className="shrink-0 p-2.5 -m-2.5 opacity-80 hover:opacity-100"><X className="w-5 h-5" /></button>
                </div>
                <div className="px-6 py-5 space-y-2">
                    <p className="text-sm font-bold text-slate-700 leading-snug dark:text-slate-200">
                        {tx('Faça a cópia de segurança dos dados em Configurações → Backup e guarde o arquivo no Google Drive. Leva poucos minutos.')}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tx('O aviso volta na próxima entrada enquanto a cópia tiver mais de 7 dias.')}</p>
                </div>
                <div className="px-6 py-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 dark:border-slate-800">
                    <button type="button" onClick={fechar} className="h-11 px-3 rounded-xl bg-slate-100 text-slate-700 text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">{tx('Lembrar depois')}</button>
                    <button type="button" onClick={fazer} autoFocus className="h-11 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-md">
                        <DatabaseBackup className="w-4 h-4" />{tx('Fazer cópia agora')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AvisoBackup;
