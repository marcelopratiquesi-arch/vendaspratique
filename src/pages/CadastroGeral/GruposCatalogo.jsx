import React, { useEffect, useMemo, useState } from 'react';
import { PlusCircle, Edit3, Trash2, X, Loader2, Check, Wand2, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../../supabaseClient.js';
import { avisar } from '../../components/avisar.js';
import { tx } from '../../i18n/traduzir.js';
import { normalizeString } from '../AnaliseVendas/utils.js';
import { CONTA_COMO, infoContaComo } from '../AnaliseVendas/regrasGrupos.js';
import { grupoDoItem, contaComoAutomatico, corDoContaComo, NOME_GRUPO_PADRAO } from './grupoCatalogo.js';

// ==========================================
// CADASTROS → CATÁLOGO GERAL → GRUPOS (decisão do dono, 14/11/2026)
// O lugar único que diz como cada item conta no sistema inteiro (regrasGrupos.js).
// Cada grupo tem um NOME livre e "COMO CONTA" (lista fixa). Os itens são colocados no grupo pela janela do item
// ou pelo botão "Colocar nos grupos" (usa a regra antiga pelo nome). Só o Admin altera (é a regra das metas).
// ==========================================

const CATEGORIAS = { plano: 'Planos', produto: 'Produtos', servico: 'Serviços' };

// Janela do grupo (novo / editar)
const JanelaGrupo = ({ grupo, qtdItens, onClose, onSalvo }) => {
    const [nome, setNome] = useState(grupo?.nome || '');
    const [contaComo, setContaComo] = useState(grupo?.conta_como || '');
    const [salvando, setSalvando] = useState(false);

    useEffect(() => {
        const aoTeclar = (e) => { if (e.key === 'Escape' && !salvando) onClose(); };
        window.addEventListener('keydown', aoTeclar);
        return () => window.removeEventListener('keydown', aoTeclar);
    }, [salvando, onClose]);

    const salvar = async (e) => {
        e.preventDefault();
        const nomeLimpo = nome.trim().replace(/\s+/g, ' ');
        if (!nomeLimpo) return avisar(tx('Digite o nome do grupo.'), 'erro');
        if (!contaComo) return avisar(tx('Escolha como o grupo conta no sistema.'), 'erro');
        if (grupo && grupo.conta_como !== contaComo && qtdItens > 0
            && !window.confirm(tx('O grupo "{nome}" tem {qtd} itens. Mudar "como conta" muda a contagem desses itens em todas as telas (Dashboard, Metas, Relatórios), inclusive nos meses que já passaram. Vendas e comissões não mudam.\n\nConfirmar?', { nome: grupo.nome, qtd: qtdItens }))) return;
        setSalvando(true);
        const dados = { nome: nomeLimpo, conta_como: contaComo };
        const { error } = grupo
            ? await supabase.from('catalogo_grupos').update(dados).eq('id', grupo.id)
            : await supabase.from('catalogo_grupos').insert([dados]);
        setSalvando(false);
        if (error) {
            const repetido = error.code === '23505';
            return avisar(repetido ? tx('Já existe um grupo com o nome "{nome}".', { nome: nomeLimpo }) : tx('Erro ao salvar o grupo: {message}', { message: error.message }), 'erro');
        }
        avisar(tx('Grupo salvo.'), 'sucesso');
        onSalvo();
    };

    const info = infoContaComo(contaComo);
    const inputBase = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm dark:bg-slate-800/60 dark:border-slate-800 dark:text-slate-200';
    const labelBase = 'block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 dark:text-slate-400';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={!salvando ? onClose : undefined}></div>
            <form onSubmit={salvar} className="bg-white rounded-2xl shadow-2xl w-[min(460px,100%)] overflow-hidden relative z-10 dark:bg-slate-900">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center dark:border-slate-800 dark:bg-slate-800/60">
                    <h2 className="text-base font-black text-slate-800 dark:text-white">{grupo ? tx('Editar grupo') : tx('Novo grupo')}</h2>
                    <button type="button" onClick={onClose} disabled={salvando} aria-label={tx('Fechar')} className="w-8 h-8 flex items-center justify-center bg-slate-200 text-slate-500 rounded-full hover:bg-rose-100 hover:text-rose-600 dark:bg-slate-700 dark:text-slate-400"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-5 space-y-5">
                    <div>
                        <label className={labelBase}>{tx('Nome do grupo')}</label>
                        <input type="text" autoFocus value={nome} onChange={e => setNome(e.target.value)} placeholder={tx('Ex: PraticMed, Nutri adicional')} className={inputBase} />
                    </div>
                    <div>
                        <label className={labelBase}>{tx('Como conta no sistema')}</label>
                        <select value={contaComo} onChange={e => setContaComo(e.target.value)} className={inputBase}>
                            <option value="">{tx('Escolha…')}</option>
                            {CONTA_COMO.map(c => <option key={c.chave} value={c.chave}>{tx(c.rotulo)}</option>)}
                        </select>
                        <p className="text-[11px] font-semibold text-slate-500 mt-1.5 ml-1 dark:text-slate-400">
                            {info
                                ? <>{tx('Serve para: {categorias}.', { categorias: info.tipos.map(t => tx(CATEGORIAS[t])).join(', ') })}{' '}{tx(EXPLICACAO[info.chave] || '')}</>
                                : tx('É isto que diz em qual meta e em qual contagem o item entra.')}
                        </p>
                    </div>
                </div>
                <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex gap-3 justify-end dark:border-slate-800 dark:bg-slate-800/60">
                    <button type="button" onClick={onClose} disabled={salvando} className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700">{tx('Cancelar')}</button>
                    <button type="submit" disabled={salvando} className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-700 inline-flex items-center gap-2 disabled:opacity-50">
                        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{tx('Salvar grupo')}
                    </button>
                </div>
            </form>
        </div>
    );
};

const EXPLICACAO = {
    PLUS: 'Conta como plano vendido e na meta Plus.',
    PLUS_NUTRI: 'Conta como plano Plus vendido e também como adicional Nutri (meta Plus e meta Nutri).',
    FIT: 'Conta como plano vendido; Fit não entra na produtividade.',
    FIT_NUTRI: 'Conta como plano Fit vendido e também como adicional Nutri.',
    PERSONAL: 'Conta como plano vendido e na meta Personal Class.',
    PERSONAL_NUTRI: 'Conta como plano Personal Class vendido e também como adicional Nutri.',
    OUTROS: 'Conta como plano vendido, em Outros planos.',
    NUTRI: 'Conta só como adicional Nutri (meta Nutri). Não conta como plano vendido nem como produto.',
    PRODUTO: 'Conta como produto (meta de produtos).',
    DOSE_UNICA: 'Conta como produto, com o limite de 10 doses únicas por unidade no mês.',
    SERVICO: 'Conta como serviço.',
};

const GruposCatalogo = ({ grupos, catalogoCompleto = [], ehAdmin, recarregar }) => {
    const [janela, setJanela] = useState(null); // { grupo } | { novo: true }
    const [abertos, setAbertos] = useState(() => new Set());
    const [organizando, setOrganizando] = useState(false);
    const lista = useMemo(() => grupos || [], [grupos]);

    const itensPorGrupo = useMemo(() => {
        const mapa = new Map();
        catalogoCompleto.forEach(item => {
            const g = grupoDoItem(item, lista);
            if (!g.manual) return;
            const k = String(g.grupo.id);
            if (!mapa.has(k)) mapa.set(k, []);
            mapa.get(k).push(item);
        });
        return mapa;
    }, [catalogoCompleto, lista]);
    const semGrupo = catalogoCompleto.filter(item => !grupoDoItem(item, lista).manual);

    if (grupos === null) {
        return (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 text-[13px] font-bold text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>{tx('Os grupos ainda não estão no banco. Rode o SQL da pasta sql/2026-11-14-grupos-catalogo (passos 0 e 1) no Supabase. Até lá, cada item continua contando pelo nome.')}</span>
            </div>
        );
    }

    // Coloca cada item SEM grupo no grupo da regra antiga (cria os grupos que faltarem). Não muda nenhum número.
    const organizar = async () => {
        if (!semGrupo.length) return;
        const porChave = new Map();
        semGrupo.forEach(item => {
            const chave = contaComoAutomatico(item);
            if (!porChave.has(chave)) porChave.set(chave, []);
            porChave.get(chave).push(item);
        });
        const resumo = [...porChave.entries()].map(([chave, itens]) => `• ${NOME_GRUPO_PADRAO[chave]}: ${itens.length}`).join('\n');
        if (!window.confirm(tx('Colocar {qtd} itens sem grupo nos grupos, pela regra de hoje (o nome). Nenhum número muda.\n\n{resumo}\n\nConfirmar?', { qtd: semGrupo.length, resumo }))) return;
        setOrganizando(true);
        try {
            for (const [chave, itens] of porChave.entries()) {
                // Reaproveita o grupo com o nome padrão; senão, o primeiro com o mesmo "como conta"; senão, cria
                let grupo = lista.find(g => normalizeString(g.nome) === normalizeString(NOME_GRUPO_PADRAO[chave]) && g.conta_como === chave)
                    || lista.find(g => g.conta_como === chave);
                if (!grupo) {
                    const { data, error } = await supabase.from('catalogo_grupos').insert([{ nome: NOME_GRUPO_PADRAO[chave], conta_como: chave }]).select();
                    if (error) throw error;
                    grupo = data[0];
                }
                const { error } = await supabase.from('catalogo').update({ grupo_id: grupo.id }).in('id', itens.map(i => i.id));
                if (error) throw error;
            }
            avisar(tx('Itens colocados nos grupos.'), 'sucesso');
        } catch (error) {
            avisar(tx('Erro ao organizar os grupos: {message}', { message: error.message }), 'erro');
        } finally {
            setOrganizando(false);
            recarregar();
        }
    };

    const excluir = async (grupo) => {
        if (!window.confirm(tx('Excluir o grupo "{nome}"?', { nome: grupo.nome }))) return;
        const { error } = await supabase.from('catalogo_grupos').delete().eq('id', grupo.id);
        if (error) return avisar(tx('Erro ao excluir o grupo: {message}', { message: error.message }), 'erro');
        avisar(tx('Grupo excluído.'), 'sucesso');
        recarregar();
    };

    const alternar = (id) => setAbertos(atual => { const n = new Set(atual); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const ordenados = [...lista].sort((a, b) => {
        const ia = CONTA_COMO.findIndex(c => c.chave === a.conta_como);
        const ib = CONTA_COMO.findIndex(c => c.chave === b.conta_como);
        return ia - ib || String(a.nome).localeCompare(String(b.nome), 'pt-BR');
    });
    const th = 'px-4 py-2.5 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap dark:text-slate-400';

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <p className="flex-1 min-w-[min(260px,100%)] text-[12px] font-semibold text-slate-500 dark:text-slate-400">
                    {tx('O grupo diz como cada item conta no sistema inteiro (Dashboard, Metas, Relatórios, Ranking). Item sem grupo conta pelo nome, como antes.')}
                </p>
                {ehAdmin && (
                    <button type="button" onClick={() => setJanela({ novo: true })} className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-2 shadow-sm">
                        <PlusCircle className="w-4 h-4" />{tx('Novo grupo')}
                    </button>
                )}
            </div>

            {semGrupo.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2.5 flex flex-wrap items-center gap-3 dark:bg-amber-500/10 dark:border-amber-500/30">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="flex-1 text-[12px] font-bold text-amber-800 dark:text-amber-300">
                        {tx('{qtd} itens ainda sem grupo (contam pelo nome).', { qtd: semGrupo.length })}
                    </span>
                    {ehAdmin && (
                        <button type="button" onClick={organizar} disabled={organizando} className="h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black uppercase tracking-wide inline-flex items-center gap-1.5 disabled:opacity-50">
                            {organizando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}{tx('Colocar nos grupos')}
                        </button>
                    )}
                </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full min-w-[640px]">
                        <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-800/60 dark:border-slate-800">
                            <tr>
                                <th className={th}>{tx('Grupo')}</th>
                                <th className={th}>{tx('Como conta')}</th>
                                <th className={`${th} text-right`}>{tx('Itens')}</th>
                                {ehAdmin && <th className={`${th} text-right`}>{tx('Ações')}</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {ordenados.map(grupo => {
                                const itens = itensPorGrupo.get(String(grupo.id)) || [];
                                const info = infoContaComo(grupo.conta_como);
                                const aberto = abertos.has(grupo.id);
                                return (
                                    <React.Fragment key={grupo.id}>
                                        <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                                            <td className="px-4 py-2.5">
                                                <button type="button" onClick={() => alternar(grupo.id)} disabled={!itens.length} className="inline-flex items-center gap-1.5 text-[13px] font-black uppercase tracking-tight text-slate-800 disabled:cursor-default dark:text-white">
                                                    {itens.length ? (aberto ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />) : <span className="w-3.5" />}
                                                    {grupo.nome}
                                                </button>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wide whitespace-nowrap ${corDoContaComo(grupo.conta_como)}`}>{info ? tx(info.rotulo) : grupo.conta_como}</span>
                                            </td>
                                            <td className="px-4 py-2.5 text-right text-[13px] font-black tabular-nums text-slate-700 dark:text-slate-200">{itens.length || <span className="text-slate-300 dark:text-slate-600">0</span>}</td>
                                            {ehAdmin && (
                                                <td className="px-4 py-2.5 text-right">
                                                    <div className="flex justify-end gap-1.5">
                                                        <button type="button" onClick={() => setJanela({ grupo })} title={tx('Editar grupo')} aria-label={tx('Editar grupo')} className="w-8 h-8 inline-flex items-center justify-center bg-white text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg dark:bg-slate-900 dark:text-blue-400 dark:hover:bg-blue-500/10 dark:border-blue-500/30"><Edit3 className="w-3.5 h-3.5" /></button>
                                                        <button type="button" onClick={() => excluir(grupo)} disabled={itens.length > 0} title={itens.length ? tx('Só dá para excluir grupo sem itens') : tx('Excluir grupo')} aria-label={tx('Excluir grupo')} className="w-8 h-8 inline-flex items-center justify-center bg-white text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-500/10 dark:border-rose-500/30"><Trash2 className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                        {aberto && itens.length > 0 && (
                                            <tr className="bg-slate-50/60 dark:bg-slate-800/30">
                                                <td colSpan={ehAdmin ? 4 : 3} className="px-4 py-2.5">
                                                    <div className="flex flex-wrap gap-1.5 pl-5">
                                                        {[...itens].sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR')).map(item => (
                                                            <span key={item.id} className={`px-2 py-0.5 rounded-md border border-slate-200 bg-white text-[11px] font-bold text-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 ${item.ativo === false ? 'line-through opacity-60' : ''}`}>{item.nome}</span>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                            {ordenados.length === 0 && (
                                <tr><td colSpan={ehAdmin ? 4 : 3} className="text-center py-12 text-slate-400 uppercase tracking-widest text-[10px] font-bold">{tx('Nenhum grupo cadastrado.')}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {janela && (
                <JanelaGrupo grupo={janela.grupo || null} qtdItens={janela.grupo ? (itensPorGrupo.get(String(janela.grupo.id)) || []).length : 0}
                    onClose={() => setJanela(null)} onSalvo={() => { setJanela(null); recarregar(); }} />
            )}
        </div>
    );
};

export default GruposCatalogo;
