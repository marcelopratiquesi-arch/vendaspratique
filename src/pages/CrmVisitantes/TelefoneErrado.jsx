import React, { useState, useEffect, useCallback } from 'react';
import { PhoneOff, Pencil, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient.js';
import Janela from '../../components/celular/Janela.jsx';
import { avisar } from '../../components/avisar.js';
import { telefoneSem55 } from '../CadastroGeral/utilsAlunos.js';
import { telefoneUtilizavel, sugerirTelefone } from './telefoneValido.js';
import { tx } from '../../i18n/traduzir.js';

// ==========================================
// NÚMERO ERRADO (27/11/2026, decisão do dono 1-A)
// Contato com telefone que não dá para usar: etiqueta vermelha, Ligar e WhatsApp desligados (nada é gravado)
// e o botão "Corrigir número". A janela é UMA só, montada no CRM; qualquer tela abre por pedirCorrigirTelefone.
// ==========================================
const EVENTO = 'crm-corrigir-telefone';
const pedirCorrigirTelefone = (lead) => window.dispatchEvent(new CustomEvent(EVENTO, { detail: lead }));

// lead = contato do funil (sem ele, como no aniversariante, só a etiqueta aparece)
const NumeroErrado = ({ lead, className = '' }) => (
    <span className={`flex flex-wrap items-center gap-1.5 ${className}`} onClick={(e) => e.stopPropagation()}>
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-black uppercase tracking-widest bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30">
            <PhoneOff className="w-3 h-3 shrink-0" />{tx('Número errado')}
        </span>
        {lead && (
            <button type="button" onClick={() => pedirCorrigirTelefone(lead)}
                className="inline-flex items-center gap-1 h-7 max-md:h-10 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest">
                <Pencil className="w-3 h-3 shrink-0" />{tx('Corrigir número')}
            </button>
        )}
    </span>
);

export default NumeroErrado;

export const JanelaCorrigirTelefone = ({ operador, onCorrigido }) => {
    const [lead, setLead] = useState(null);
    const [numero, setNumero] = useState('');
    const [salvando, setSalvando] = useState(false);

    useEffect(() => {
        const abrir = (e) => {
            setLead(e.detail);
            setNumero(sugerirTelefone(e.detail)?.numero || '');
        };
        window.addEventListener(EVENTO, abrir);
        return () => window.removeEventListener(EVENTO, abrir);
    }, []);

    const fechar = useCallback(() => setLead(null), []);
    if (!lead) return null;

    const sugestao = sugerirTelefone(lead);
    const pronto = telefoneUtilizavel(numero);

    const salvar = async () => {
        if (!pronto || salvando) return;
        const novo = telefoneSem55(numero);
        const campos = { telefone: novo };
        // O celular estava no lugar do CPF: o campo CPF fica vazio (aquilo não era um CPF)
        const limpaCpf = telefoneSem55(lead.cpf) === novo;
        if (limpaCpf) campos.cpf = null;
        setSalvando(true);
        const { data, error } = await supabase.from('leads').update(campos).eq('id', lead.id).select('id, status');
        setSalvando(false);
        if (error || !data?.length) return avisar(tx('Não foi possível salvar.\n\n{v1}', { v1: error?.message || '' }), 'erro');
        const { error: erroHist } = await supabase.from('historico_leads').insert([{
            lead_id: String(lead.id), tipo_acao: 'Reciclagem', consultor: operador || 'Sistema',
            observacao: `Telefone corrigido: de "${lead.telefone || 'vazio'}" para "${novo}"${limpaCpf ? ' (o número estava no campo CPF)' : ''}.`
        }]);
        if (erroHist) console.warn('Corrigir telefone: histórico não gravado', erroHist.message);
        if (onCorrigido) onCorrigido(lead.id, { ...campos, status: data[0].status });
        if (data[0].status === 'Arquivado') avisar(tx('Salvo, mas esta pessoa (CPF ou telefone) está no "Não contatar" e continua arquivada.'), 'atencao');
        else avisar(tx('Número corrigido.'), 'sucesso');
        fechar();
    };

    return (
        <Janela titulo={tx('Corrigir número')} subtitulo={lead.nome} icone={PhoneOff} onFechar={fechar} largura={440} modoCelular="baixo" camada="z-[230]"
            rodape={(
                <>
                    <button type="button" onClick={fechar} className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-black uppercase tracking-widest">{tx('Cancelar')}</button>
                    <button type="button" onClick={salvar} disabled={!pronto || salvando} className="h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                        {salvando && <Loader2 className="w-4 h-4 animate-spin" />}{tx('Salvar número')}
                    </button>
                </>
            )}>
            <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 break-words">{tx('Hoje está escrito:')}{' '}<strong className="text-rose-600 dark:text-rose-400">{lead.telefone || tx('Sem telefone')}</strong></p>
            <input type="tel" inputMode="numeric" autoFocus value={numero} onChange={(e) => setNumero(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') salvar(); }}
                placeholder={tx('Telefone certo com DDD')} aria-label={tx('Telefone certo com DDD')}
                className="mt-3 w-full h-12 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-base font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/30" />
            {sugestao && (
                <p className="mt-2 text-[12px] font-bold text-amber-700 dark:text-amber-300">
                    {sugestao.origem === 'CAMPO_CPF'
                        ? tx('Já preenchi com o número que estava no campo CPF. Confira antes de salvar.')
                        : tx('Havia mais de um telefone no campo. Já preenchi com um deles. Confira antes de salvar.')}
                </p>
            )}
            {numero.trim() !== '' && !pronto && <p className="mt-2 text-[12px] font-bold text-rose-600 dark:text-rose-400">{tx('Digite o telefone certo, com DDD.')}</p>}
        </Janela>
    );
};
