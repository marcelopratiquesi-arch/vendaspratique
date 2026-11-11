// ==========================================
// CADASTRO DA EQUIPE INCOMPLETO — aviso para o LÍDER e o MENTOR (decisão do dono, 11/11/2026)
// - O pagamento da comissão é PRINCIPALMENTE pelo Banco Inter; o PIX (sempre a chave CPF) é o secundário.
//   Quem está no PIX é cobrado até trocar para o Inter. Também cobra: sem conta, CPF vazio/inválido, sem telefone,
//   sem setor ou setor fora da lista (regra única em CadastroGeral/cadastroColaborador.js).
// - JANELA no meio da tela TODA VEZ que o Líder/Mentor entra no sistema, com os nomes e os campos para corrigir ali
//   mesmo (igual à janela do turno): "Atualizar agora" grava; "Lembrar depois" fecha.
// - CARTÃO no canto direito (lado oposto ao menu), SEM botão de fechar: fica até não sobrar ninguém com problema.
// - Líder = a unidade dele; Mentor = as unidades dele (leitura em useCadastroEquipe.js, não depende do seletor do topo).
// - Permissão 910 (padrão Líder e Mentor; dá para desligar em Configurações → Permissões).
// - Grava só os campos corrigidos em `colaboradores` (o banco confere a permissão 807 e a unidade; auditado em
//   auditoria_cadastros). Não mexe em vendas nem em comissão.
// ==========================================
import React, { useEffect, useState } from 'react';
import { AlertTriangle, Building, Loader2, X, Users } from 'lucide-react';
import { supabase } from '../../supabaseClient.js';
import { tx } from '../../i18n/traduzir.js';
import { avisar } from '../../components/avisar.js';
import { maskCpf, maskPhone, maskContaInter } from '../CadastroGeral/utils.js';
import { validarCPF } from '../CadastroGeral/utilsAlunos.js';
import { PROBLEMAS_CADASTRO, ehProblemaDeConta, resumoPorUnidade } from '../CadastroGeral/cadastroColaborador.js';

const soNumeros = (t) => String(t || '').replace(/\D/g, '');
const MAX_UNIDADES_CARTAO = 4;

// ------------------------------------------
// Texto fixo da regra de pagamento (aparece na janela)
// ------------------------------------------
const RegraPagamento = () => (
    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 dark:bg-blue-500/10 dark:border-blue-500/30">
        <p className="text-[12px] font-black text-blue-900 dark:text-blue-200 flex items-center gap-1.5"><Building className="w-4 h-4 shrink-0" />{tx('O pagamento das comissões é feito principalmente pelo Banco Inter.')}</p>
        <p className="text-[12px] font-semibold text-blue-800 mt-1 leading-snug dark:text-blue-300">
            {tx('O PIX é usado só quando a pessoa ainda não tem conta no Inter, e a chave PIX é sempre o CPF da pessoa (nunca o telefone ou o e-mail).')}
        </p>
    </div>
);

const Etiqueta = ({ problema }) => (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide ${problema === 'pix' ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'}`}>
        {tx(PROBLEMAS_CADASTRO[problema])}
    </span>
);

const campo = 'h-9 w-full px-3 rounded-lg border border-slate-200 bg-white text-[12px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 placeholder:font-medium placeholder:text-slate-400 dark:bg-slate-900 dark:border-slate-700 dark:text-white';
const rotulo = 'block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 dark:text-slate-400';

// ------------------------------------------
// JANELA (ao entrar no sistema)
// ------------------------------------------
export const JanelaCadastroEquipe = ({ itens = [], setores = [], ehMentor, unidadeTitulo, podeEditar, salvar, onFechar, aoAbrirEquipe }) => {
    const [valores, setValores] = useState({}); // id → { conta, cpf, telefone, setor }
    const [salvando, setSalvando] = useState(false);

    useEffect(() => {
        const aoTeclar = (e) => { if (e.key === 'Escape' && !salvando) onFechar(); };
        window.addEventListener('keydown', aoTeclar);
        return () => window.removeEventListener('keydown', aoTeclar);
    }, [salvando, onFechar]);

    if (!itens.length) return null;

    const mudar = (id, chave, valor) => setValores(v => ({ ...v, [id]: { ...(v[id] || {}), [chave]: valor } }));
    const qtdPix = itens.filter(i => i.problemas.includes('pix')).length;
    const unidadesNaLista = new Set(itens.map(i => i.c.unidade)).size;

    const atualizar = async () => {
        const preenchidos = itens
            .map(({ c }) => ({ c, v: valores[c.id] || {} }))
            .filter(({ v }) => Object.values(v).some(s => String(s || '').trim()));
        if (!preenchidos.length) { avisar(tx('Preencha pelo menos um campo antes de atualizar.'), 'atencao'); return; }

        // 1) Confere tudo antes de gravar
        const mudancas = [];
        for (const { c, v } of preenchidos) {
            const campos = {};
            if (String(v.conta || '').trim()) {
                if (soNumeros(v.conta).length < 2) { avisar(tx('Conta do Banco Inter de {nome}: digite o número com o dígito.', { nome: c.nome }), 'erro'); return; }
                campos.tipo_conta = 'INTER';
                campos.conta_inter = v.conta.trim();
            }
            if (String(v.cpf || '').trim()) {
                if (!validarCPF(v.cpf)) { avisar(tx('CPF de {nome} inválido: confira os números.', { nome: c.nome }), 'erro'); return; }
                campos.cpf = maskCpf(v.cpf);
            }
            if (String(v.telefone || '').trim()) {
                if (soNumeros(v.telefone).length < 10) { avisar(tx('Telefone de {nome} incompleto: digite o DDD e o número.', { nome: c.nome }), 'erro'); return; }
                campos.telefone = v.telefone;
            }
            if (String(v.setor || '').trim()) campos.role = String(v.setor).toUpperCase();
            mudancas.push({ c, campos });
        }

        setSalvando(true);
        try {
            // 2) CPF repetido na Equipe (a mesma pessoa duas vezes duplicaria o consultor e a comissão)
            const cpfs = mudancas.filter(m => m.campos.cpf);
            const vistos = new Map();
            for (const m of cpfs) {
                const num = soNumeros(m.campos.cpf);
                if (vistos.has(num)) { avisar(tx('O mesmo CPF foi digitado para {a} e {b}.', { a: vistos.get(num), b: m.c.nome }), 'erro'); return; }
                vistos.set(num, m.c.nome);
                const { data: mesmos } = await supabase.from('colaboradores').select('id, nome, unidade').in('cpf', [m.campos.cpf, num]);
                const outro = (mesmos || []).find(x => x.id !== m.c.id);
                if (outro) { avisar(tx('O CPF digitado para {nome} já é de {outro} ({unidade}). Confira.', { nome: m.c.nome, outro: outro.nome, unidade: outro.unidade || '—' }), 'erro'); return; }
            }

            // 3) Grava um por um
            let ok = 0;
            const gravados = [];
            for (const m of mudancas) {
                const r = await salvar(m.c.id, m.campos);
                if (r.error) {
                    avisar(tx('Não foi possível atualizar {nome}: {message}', { nome: m.c.nome, message: r.error.message }), 'erro');
                    break;
                }
                ok += 1;
                gravados.push(m.c.id);
            }
            if (gravados.length) setValores(v => { const n = { ...v }; gravados.forEach(id => delete n[id]); return n; });
            if (ok) avisar(ok === 1 ? tx('Cadastro de 1 colaborador atualizado.') : tx('Cadastro de {qtd} colaboradores atualizado.', { qtd: ok }), 'sucesso');
        } finally {
            setSalvando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[92] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]" role="dialog" aria-modal="true" aria-labelledby="janela-cadastro-equipe-titulo">
            <div className="bg-white rounded-2xl shadow-2xl w-[min(720px,100%)] max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                <div className="px-6 py-5 flex items-start gap-3 bg-blue-600 text-white">
                    <Users className="w-6 h-6 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                        <h2 id="janela-cadastro-equipe-titulo" className="text-base font-black uppercase tracking-widest leading-tight">{tx('Atualize o cadastro da sua equipe')}</h2>
                        <p className="text-[12px] font-bold uppercase tracking-widest opacity-90 mt-1">
                            {ehMentor ? (unidadesNaLista === 1 ? tx('1 unidade') : tx('{qtd} unidades', { qtd: unidadesNaLista })) : unidadeTitulo}
                            {' · '}{itens.length === 1 ? tx('1 colaborador') : tx('{qtd} colaboradores', { qtd: itens.length })}
                        </p>
                    </div>
                    <button type="button" onClick={onFechar} disabled={salvando} aria-label={tx('Fechar')} className="opacity-80 hover:opacity-100 disabled:opacity-40"><X className="w-5 h-5" /></button>
                </div>

                <div className="px-6 py-5 overflow-y-auto custom-scrollbar space-y-4">
                    <RegraPagamento />
                    <p className="text-sm font-bold text-slate-700 leading-snug dark:text-slate-200">
                        {qtdPix > 0
                            ? (qtdPix === 1
                                ? tx('1 colaborador está recebendo por PIX. Peça o número da conta do Banco Inter e preencha abaixo.')
                                : tx('{qtd} colaboradores estão recebendo por PIX. Peça o número da conta do Banco Inter de cada um e preencha abaixo.', { qtd: qtdPix }))
                            : tx('Os colaboradores abaixo estão com dados faltando no cadastro. Preencha abaixo.')}
                        {' '}{tx('Não precisa preencher todos de uma vez: quem for atualizado sai da lista.')}
                    </p>
                    {!podeEditar && (
                        <p className="text-[12px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">
                            {tx('Seu acesso não pode editar a equipe. Peça para o administrador atualizar estes cadastros.')}
                        </p>
                    )}

                    <ul className="space-y-2">
                        {itens.map(({ c, problemas }) => {
                            const v = valores[c.id] || {};
                            const precisaConta = problemas.some(ehProblemaDeConta);
                            const precisaSetor = problemas.includes('semSetor') || problemas.includes('setorForaDaLista');
                            return (
                                <li key={c.id} className={`rounded-xl border px-3 py-3 ${problemas.includes('pix') ? 'border-rose-200 dark:border-rose-500/30' : 'border-amber-200 dark:border-amber-500/30'}`}>
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <span className="text-[12px] font-black uppercase text-slate-800 dark:text-white">{c.nome}</span>
                                        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{[c.role, ehMentor ? c.unidade : null].filter(Boolean).join(' · ')}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-1.5">{problemas.map(p => <Etiqueta key={p} problema={p} />)}</div>
                                    {podeEditar && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2.5">
                                            {precisaConta && (
                                                <label className="block">
                                                    <span className={rotulo}>{tx('Conta Banco Inter (com dígito)')}</span>
                                                    <input type="text" inputMode="numeric" value={v.conta || ''} onChange={e => mudar(c.id, 'conta', maskContaInter(e.target.value))} placeholder={tx('Ex: 1234567-8')} className={campo} />
                                                </label>
                                            )}
                                            {problemas.includes('cpf') && (
                                                <label className="block">
                                                    <span className={rotulo}>CPF</span>
                                                    <input type="text" inputMode="numeric" value={v.cpf || ''} onChange={e => mudar(c.id, 'cpf', maskCpf(e.target.value))} placeholder="000.000.000-00" className={campo} />
                                                </label>
                                            )}
                                            {problemas.includes('telefone') && (
                                                <label className="block">
                                                    <span className={rotulo}>{tx('WhatsApp')}</span>
                                                    <input type="text" inputMode="numeric" value={v.telefone || ''} onChange={e => mudar(c.id, 'telefone', maskPhone(e.target.value))} placeholder="(00) 00000-0000" className={campo} />
                                                </label>
                                            )}
                                            {precisaSetor && (
                                                <label className="block">
                                                    <span className={rotulo}>{tx('Setor / Cargo')}</span>
                                                    <select value={v.setor || ''} onChange={e => mudar(c.id, 'setor', e.target.value)} className={`${campo} cursor-pointer uppercase`}>
                                                        <option value="">{tx('Selecione...')}</option>
                                                        {setores.map(s => <option key={s.id || s.nome} value={s.nome}>{s.nome}</option>)}
                                                    </select>
                                                </label>
                                            )}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                    {aoAbrirEquipe && (
                        <button type="button" onClick={aoAbrirEquipe} className="text-[11px] font-black uppercase tracking-widest text-blue-700 hover:underline dark:text-blue-400">
                            {tx('Abrir Cadastros → Equipe')}
                        </button>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 dark:border-slate-800">
                    <button type="button" onClick={onFechar} disabled={salvando} className="h-11 px-4 rounded-xl bg-slate-100 text-slate-600 text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">{tx('Lembrar depois')}</button>
                    <button type="button" onClick={atualizar} disabled={salvando || !podeEditar} className="h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-md">
                        {salvando && <Loader2 className="w-4 h-4 animate-spin" />}{tx('Atualizar agora')}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ------------------------------------------
// CARTÃO NO CANTO (sem fechar: fica até resolver). Vai dentro da coluna de cartões do canto (App.jsx).
// ------------------------------------------
export const CartaoCadastroEquipe = ({ itens = [], ehMentor, aoAbrir }) => {
    if (!itens.length) return null;
    const resumo = resumoPorUnidade(itens);
    const pix = itens.filter(i => i.problemas.includes('pix')).length;
    const outros = itens.filter(i => i.problemas.some(p => p !== 'pix')).length;
    const visiveis = resumo.slice(0, MAX_UNIDADES_CARTAO);
    const resto = resumo.length - visiveis.length;

    return (
        <div role="alert" className="pointer-events-auto w-full rounded-2xl shadow-xl p-4 border bg-rose-50 border-rose-300 dark:bg-slate-900 dark:border-rose-500/40">
            <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black uppercase tracking-widest text-rose-800 dark:text-rose-300">{tx('Cadastro da equipe incompleto')}</p>
                    {ehMentor ? (
                        <ul className="mt-2 space-y-1">
                            {visiveis.map(r => (
                                <li key={r.unidade} className="text-[12px] font-semibold leading-snug text-rose-800 dark:text-rose-200">
                                    <span className="font-black uppercase">{r.unidade}</span>{': '}
                                    {[r.pix ? tx('{qtd} no PIX', { qtd: r.pix }) : null, r.outros ? (r.outros === 1 ? tx('1 com dados faltando') : tx('{qtd} com dados faltando', { qtd: r.outros })) : null].filter(Boolean).join(' · ')}
                                </li>
                            ))}
                            {resto > 0 && <li className="text-[11px] font-bold text-rose-700 dark:text-rose-300">{tx('e mais {qtd} unidade(s)', { qtd: resto })}</li>}
                        </ul>
                    ) : (
                        <div className="mt-2 space-y-1">
                            {pix > 0 && (
                                <p className="text-[12px] font-semibold leading-snug text-rose-800 dark:text-rose-200">
                                    {pix === 1 ? tx('1 colaborador recebe por PIX.') : tx('{qtd} colaboradores recebem por PIX.', { qtd: pix })}
                                    {' '}<strong>{tx('Troque para o Banco Inter, que é o pagamento principal.')}</strong>
                                </p>
                            )}
                            {outros > 0 && (
                                <p className="text-[12px] font-semibold leading-snug text-rose-800 dark:text-rose-200">
                                    {outros === 1 ? tx('1 colaborador com dados faltando (CPF, telefone, setor ou conta).') : tx('{qtd} colaboradores com dados faltando (CPF, telefone, setor ou conta).', { qtd: outros })}
                                </p>
                            )}
                        </div>
                    )}
                    {ehMentor && pix > 0 && <p className="text-[11px] font-bold text-rose-700 mt-1.5 dark:text-rose-300">{tx('Troque para o Banco Inter, que é o pagamento principal.')}</p>}
                    <button type="button" onClick={aoAbrir} className="mt-3 h-9 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest">
                        {tx('Atualizar agora')}
                    </button>
                </div>
            </div>
        </div>
    );
};
