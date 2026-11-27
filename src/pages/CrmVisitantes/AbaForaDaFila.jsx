import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PhoneOff, Search, X, Loader2, Undo2 } from 'lucide-react';
import { supabase } from '../../supabaseClient.js';
import { contatoCombinaComBusca } from './utils';
import { telefoneSem55 } from '../CadastroGeral/utilsAlunos.js';
import { telefoneUtilizavel } from './telefoneValido.js';
import { MOTIVOS_FORA_DA_FILA, MOTIVO_TELEFONE, camposVoltaBanco } from './foraDaFila.js';
import CopyButton from '../HistoricoVendas/CopyButton.jsx';
import { avisar } from '../../components/avisar.js';
import { tx } from '../../i18n/traduzir.js';

// ABA "FORA DA FILA" (27/11/2026): telefone com problema, já é aluno e personal trainer.
// Telefone com problema só volta DEPOIS de corrigir o número. Ninguém aqui está bloqueado.
const POR_PAGINA = 50;
const TAMANHO_LEITURA = 1000;

const AbaForaDaFila = ({ unidade, operador, onVoltou }) => {
    const [lista, setLista] = useState(null);
    const [carregando, setCarregando] = useState(true);
    const [motivo, setMotivo] = useState(MOTIVO_TELEFONE);
    const [busca, setBusca] = useState('');
    const [pagina, setPagina] = useState(1);
    const [numeros, setNumeros] = useState({});
    const [salvando, setSalvando] = useState(null);
    const unidadeChave = String(unidade || '').toUpperCase().trim();

    const carregar = useCallback(async () => {
        setCarregando(true);
        let tudo = [];
        for (let inicio = 0; ; inicio += TAMANHO_LEITURA) {
            const { data, error } = await supabase.from('leads')
                .select('id, nome, cpf, telefone, origem, vendedor, unidade, motivo_perda')
                .eq('status', 'Arquivado').in('motivo_perda', MOTIVOS_FORA_DA_FILA).ilike('unidade', unidadeChave)
                .order('id', { ascending: true }).range(inicio, inicio + TAMANHO_LEITURA - 1);
            if (error) { console.error('Fora da fila: erro ao ler', error); tudo = null; break; }
            tudo = tudo.concat(data || []);
            if ((data || []).length < TAMANHO_LEITURA) break;
        }
        setLista(tudo);
        setCarregando(false);
    }, [unidadeChave]);
    useEffect(() => { if (unidadeChave) carregar(); }, [carregar, unidadeChave]);
    useEffect(() => { setPagina(1); }, [motivo, busca]);

    const filtrados = useMemo(() => (lista || []).filter(l => l.motivo_perda === motivo && (!busca.trim() || contatoCombinaComBusca(l, busca))), [lista, motivo, busca]);
    const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
    const paginaAtual = Math.min(pagina, totalPaginas);
    const daPagina = filtrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

    const devolver = async (lead) => {
        const precisaTelefone = lead.motivo_perda === MOTIVO_TELEFONE;
        const novo = telefoneSem55(numeros[lead.id] || '');
        if (precisaTelefone) {
            if (!telefoneUtilizavel(numeros[lead.id])) return avisar(tx('Digite o telefone certo, com DDD.'), 'erro');
            if (novo === telefoneSem55(lead.telefone)) return avisar(tx('Este é o mesmo número com problema. Digite o número certo.'), 'erro');
        } else if (!window.confirm(tx('Devolver {nome} para o Banco Bruto?', { nome: lead.nome }))) return;
        setSalvando(lead.id);
        const campos = { ...camposVoltaBanco(lead), ...(precisaTelefone ? { telefone: novo } : {}) };
        const { data, error } = await supabase.from('leads').update(campos).eq('id', lead.id).select('id, status');
        setSalvando(null);
        if (error || !data?.length) return avisar(tx('Não foi possível salvar.\n\n{v1}', { v1: error?.message || '' }), 'erro');
        setLista(prev => (prev || []).filter(l => l.id !== lead.id));
        if (data[0].status === 'Arquivado') return avisar(tx('Salvo, mas esta pessoa (CPF ou telefone) está no "Não contatar" e continua arquivada.'), 'atencao');
        const { error: erroHist } = await supabase.from('historico_leads').insert([{
            lead_id: String(lead.id), tipo_acao: 'Reciclagem', consultor: operador || 'Sistema',
            observacao: precisaTelefone ? 'Telefone corrigido: voltou para o Banco Bruto.' : `Voltou para o Banco Bruto (estava como "${lead.motivo_perda}").`
        }]);
        if (erroHist) console.warn('Fora da fila: histórico não gravado', erroHist.message);
        avisar(tx('{nome} voltou para o Banco Bruto.', { nome: lead.nome }), 'sucesso');
        if (onVoltou) onVoltou();
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-3 md:p-6">
            <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
                <div>
                    <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                        <PhoneOff className="w-5 h-5 text-blue-600 dark:text-blue-400" />{' '}{tx('Fora da fila')}
                        {carregando && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                    </h3>
                    <p className="text-xs font-bold text-slate-400 mt-1">{tx('Não estão bloqueados. Voltam para o Banco Bruto por aqui; telefone com problema só depois de corrigido.')}</p>
                </div>
                <div className="relative max-md:w-full">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={tx('Buscar por nome ou CPF')} className="w-full sm:w-56 max-md:h-11 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/30" />
                    {busca && <button type="button" onClick={() => setBusca('')} aria-label={tx('Fechar')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400"><X className="w-3.5 h-3.5" /></button>}
                </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
                {MOTIVOS_FORA_DA_FILA.map(m => (
                    <button key={m} type="button" onClick={() => setMotivo(m)} className={`max-md:min-h-10 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${motivo === m ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}>
                        {tx(m)} ({(lista || []).filter(l => l.motivo_perda === m).length})
                    </button>
                ))}
            </div>

            {lista === null && !carregando && <p className="py-8 text-center text-xs font-bold text-rose-600 dark:text-rose-400">{tx('Não foi possível ler a lista. Tente de novo.')}</p>}
            {lista !== null && filtrados.length === 0 && !carregando && <p className="py-10 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">{tx('Ninguém na lista.')}</p>}

            <div className="space-y-2">
                {daPagina.map(l => (
                    <div key={l.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex flex-col md:flex-row md:items-center gap-2">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-black uppercase text-slate-800 dark:text-white break-words">{l.nome} <CopyButton textToCopy={l.nome} /></p>
                            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 break-all">
                                {l.cpf ? <>{l.cpf} <CopyButton textToCopy={l.cpf} /> · </> : ''}{tx('Telefone')}: {l.telefone || 'S/N'}
                            </p>
                        </div>
                        {l.motivo_perda === MOTIVO_TELEFONE && (
                            <input type="tel" inputMode="numeric" value={numeros[l.id] || ''} onChange={(e) => setNumeros(prev => ({ ...prev, [l.id]: e.target.value }))} placeholder={tx('Telefone certo com DDD')} className="w-full md:w-52 max-md:h-11 max-md:text-base bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/30" />
                        )}
                        <button type="button" onClick={() => devolver(l)} disabled={salvando === l.id} className="max-md:h-11 shrink-0 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5">
                            {salvando === l.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
                            {l.motivo_perda === MOTIVO_TELEFONE ? tx('Corrigir e devolver') : tx('Devolver ao Banco Bruto')}
                        </button>
                    </div>
                ))}
            </div>

            {totalPaginas > 1 && (
                <div className="mt-4 flex items-center justify-center gap-3 text-xs font-bold text-slate-500 dark:text-slate-400">
                    <button type="button" disabled={paginaAtual <= 1} onClick={() => setPagina(paginaAtual - 1)} className="max-md:min-h-10 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-40">{tx('Anterior')}</button>
                    <span>{paginaAtual} / {totalPaginas}</span>
                    <button type="button" disabled={paginaAtual >= totalPaginas} onClick={() => setPagina(paginaAtual + 1)} className="max-md:min-h-10 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-40">{tx('Próxima')}</button>
                </div>
            )}
        </div>
    );
};

export default AbaForaDaFila;
