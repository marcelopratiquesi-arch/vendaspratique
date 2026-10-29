import React, { useState } from 'react';
import { X, Save, Loader2, RotateCcw } from 'lucide-react';
import { MENSAGENS_PADRAO, preencherMensagem } from './utils';
import { salvarMensagemPronta, TIPOS_CONTATO } from './contatosFeitos';
import { avisar } from '../../components/avisar.js';

// ==========================================
// EDITOR DAS MENSAGENS PRONTAS DO WHATSAPP (só Admin e Líder)
// {nome} vira o primeiro nome da pessoa e {unidade} o nome da unidade.
// ==========================================
const CHAVES = ['VISITANTE_24H', 'VISITANTE_48H', 'ANIVERSARIO', 'MIGRACAO'];

const MensagensProntas = ({ mensagens, usuarioLogado, onFechar, onSalvo }) => {
    const [textos, setTextos] = useState(() => ({ ...MENSAGENS_PADRAO, ...mensagens }));
    const [salvando, setSalvando] = useState(false);

    const salvar = async () => {
        if (CHAVES.some(c => !String(textos[c] || '').trim())) return avisar('Nenhuma mensagem pode ficar vazia.');
        setSalvando(true);
        const erros = [];
        for (const chave of CHAVES) {
            if (textos[chave] === mensagens[chave]) continue;
            const erro = await salvarMensagemPronta(chave, textos[chave], usuarioLogado?.nome || 'SISTEMA');
            if (erro) erros.push(`${TIPOS_CONTATO[chave]}: ${erro.message}`);
        }
        setSalvando(false);
        if (erros.length) return avisar(`Não foi possível salvar:\n\n${erros.join('\n')}`);
        onSalvo({ ...mensagens, ...textos });
        onFechar();
    };

    return (
        <div className="fixed inset-0 z-[160] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-3 md:p-8 overflow-y-auto" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
            <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 my-auto overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-black uppercase tracking-widest text-slate-800 dark:text-white">Mensagens prontas</h3>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">Use <strong>{'{nome}'}</strong> para o primeiro nome e <strong>{'{unidade}'}</strong> para a unidade. Vale para todas as unidades.</p>
                    </div>
                    <button type="button" onClick={onFechar} className="p-2 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {CHAVES.map(chave => (
                        <div key={chave}>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{TIPOS_CONTATO[chave]}</label>
                                <button type="button" onClick={() => setTextos(prev => ({ ...prev, [chave]: MENSAGENS_PADRAO[chave] }))} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 flex items-center gap-1 dark:hover:text-blue-400">
                                    <RotateCcw className="w-3 h-3" /> Texto padrão
                                </button>
                            </div>
                            <textarea
                                rows={4}
                                value={textos[chave]}
                                onChange={(e) => setTextos(prev => ({ ...prev, [chave]: e.target.value }))}
                                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none"
                            />
                            <p className="text-[10px] text-slate-400 mt-1"><strong>Exemplo:</strong> {preencherMensagem(textos[chave], { nome: 'MARIA SILVA', unidade: 'SANTA INES 2' })}</p>
                        </div>
                    ))}
                </div>
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                    <button type="button" onClick={onFechar} className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancelar</button>
                    <button type="button" onClick={salvar} disabled={salvando} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-black uppercase tracking-widest flex items-center gap-2">
                        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MensagensProntas;
