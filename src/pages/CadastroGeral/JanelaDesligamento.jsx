import React, { useEffect, useState } from 'react';
import { PowerOff, Loader2, X } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';
import { avisar } from '../../components/avisar.js';

// ==========================================
// DESLIGAR COLABORADOR COM DATA E MOTIVO (11/11/2026, decisão do dono)
// Substituiu a pergunta simples de "Desligar". A pessoa some das listas de venda, mas o histórico e as comissões
// continuam. Reativar apaga a data e o motivo. Quem grava é o CadastroGeral/index.jsx (confirmarDesligamento).
// ==========================================

const MOTIVOS_DESLIGAMENTO = ['Pediu para sair', 'Dispensado', 'Fim de contrato', 'Outro'];
const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const JanelaDesligamento = ({ colaborador, salvando, onConfirmar, onCancelar }) => {
    const [data, setData] = useState(hojeIso());
    const [motivo, setMotivo] = useState('');
    const [outro, setOutro] = useState('');

    useEffect(() => {
        const aoTeclar = (e) => { if (e.key === 'Escape' && !salvando) onCancelar(); };
        window.addEventListener('keydown', aoTeclar);
        return () => window.removeEventListener('keydown', aoTeclar);
    }, [salvando, onCancelar]);

    if (!colaborador) return null;

    const confirmar = () => {
        if (!data) { avisar(tx('Informe a data do desligamento.'), 'atencao'); return; }
        if (data > hojeIso()) { avisar(tx('A data do desligamento não pode ser no futuro.'), 'atencao'); return; }
        if (!motivo) { avisar(tx('Escolha o motivo do desligamento.'), 'atencao'); return; }
        if (motivo === 'Outro' && outro.trim().length < 3) { avisar(tx('Escreva o motivo.'), 'atencao'); return; }
        onConfirmar({ data, motivo: motivo === 'Outro' ? `Outro: ${outro.trim()}` : motivo });
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-desligamento">
            <div className="bg-white rounded-2xl shadow-2xl w-[min(460px,100%)] overflow-hidden dark:bg-slate-900">
                <div className="px-6 py-4 bg-rose-600 text-white flex items-start gap-3">
                    <PowerOff className="w-5 h-5 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                        <h2 id="titulo-desligamento" className="text-sm font-black uppercase tracking-widest">{tx('Desligar colaborador')}</h2>
                        <p className="text-[12px] font-bold uppercase tracking-wide opacity-90 truncate">{colaborador.nome}</p>
                    </div>
                    <button type="button" onClick={onCancelar} disabled={salvando} aria-label={tx('Fechar')}><X className="w-5 h-5" /></button>
                </div>
                <div className="px-6 py-5 space-y-4">
                    <p className="text-[12px] font-semibold text-slate-600 dark:text-slate-300">{tx('A pessoa não aparece mais para novas vendas, mas o histórico e as comissões continuam guardados. Dá para reativar depois.')}</p>
                    <label className="block">
                        <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 dark:text-slate-400">{tx('Data do desligamento')}</span>
                        <input type="date" value={data} max={hojeIso()} onChange={(e) => setData(e.target.value)}
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800/60 dark:border-slate-800 dark:text-white" />
                    </label>
                    <div>
                        <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 dark:text-slate-400">{tx('Motivo')}</span>
                        <div className="grid grid-cols-2 gap-2">
                            {MOTIVOS_DESLIGAMENTO.map(m => (
                                <button key={m} type="button" onClick={() => setMotivo(m)} aria-pressed={motivo === m}
                                    className={`h-10 px-3 rounded-xl border text-[11px] font-black uppercase tracking-wide ${motivo === m ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                                    {tx(m)}
                                </button>
                            ))}
                        </div>
                        {motivo === 'Outro' && (
                            <input type="text" autoFocus value={outro} onChange={(e) => setOutro(e.target.value)} placeholder={tx('Escreva o motivo')}
                                className="mt-2 w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800/60 dark:border-slate-800 dark:text-white" />
                        )}
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-slate-200 grid grid-cols-2 gap-3 dark:border-slate-800">
                    <button type="button" onClick={onCancelar} disabled={salvando} className="h-11 rounded-xl bg-slate-100 text-slate-600 text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300">{tx('Cancelar')}</button>
                    <button type="button" onClick={confirmar} disabled={salvando} className="h-11 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-widest inline-flex items-center justify-center gap-2">
                        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <PowerOff className="w-4 h-4" />}{tx('Desligar')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default JanelaDesligamento;
