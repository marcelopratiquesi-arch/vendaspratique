import React, { useMemo } from 'react';
import { RotateCcw, Layers, UserCog, CheckCircle2, AlertTriangle } from 'lucide-react';
import { tx } from '../i18n/traduzir.js';
import { CATALOGO_PERMISSOES, NOME_PAPEL, podeMudar } from './catalogoPermissoes.js';

// ==========================================
// PERMISSÕES → "O QUE ESTÁ DIFERENTE DO PADRÃO" (09/11/2026, decisão do dono)
// Uma lista só com tudo o que o Admin mudou: por nível (permissoes_papel) e por login (permissoes_excecao).
// Cada linha tem "Voltar ao padrão" (apaga a mudança). Exceção que não vale mais (nível do login mudou, permissão
// travada ou que deixou de existir) aparece como "sem efeito", para poder limpar.
// ==========================================

const porCodigo = new Map(CATALOGO_PERMISSOES.map(p => [p.codigo, p]));
const papelDe = (u) => String(u?.role || '').toUpperCase().trim();
const emailDe = (u) => String(u?.email || '').toLowerCase().trim();

const Estado = ({ ligado }) => (ligado
    ? <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wide dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30">{tx('Liberado')}</span>
    : <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black uppercase tracking-wide dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30">{tx('Bloqueado')}</span>);

const DiferencasPadrao = ({ regras, excecoes, usuarios = [], termo = '', bancoPronto = true, gravando = '', onVoltarNivel, onVoltarExcecao }) => {
    const combina = (codigo) => {
        if (!termo) return true;
        const p = porCodigo.get(codigo);
        return codigo.includes(termo) || (p && (p.nome.toLowerCase().includes(termo) || tx(p.nome).toLowerCase().includes(termo)));
    };

    const porNivel = [...regras.entries()]
        .map(([k, ligado]) => { const [papel, codigo] = k.split('|'); return { k, papel, codigo, ligado, p: porCodigo.get(codigo) }; })
        .filter(l => combina(l.codigo))
        .sort((a, b) => a.codigo.localeCompare(b.codigo) || a.papel.localeCompare(b.papel));

    const loginsPorEmail = useMemo(() => new Map(usuarios.map(u => [emailDe(u), u])), [usuarios]);
    const porLogin = (() => {
        const grupos = new Map();
        [...excecoes.entries()].forEach(([k, ligado]) => {
            const i = k.lastIndexOf('|');
            const email = k.slice(0, i); const codigo = k.slice(i + 1);
            // A busca também acha pelo nome ou e-mail do login
            const dono = loginsPorEmail.get(email);
            const achouLogin = !!termo && (email.includes(termo) || String(dono?.nome || '').toLowerCase().includes(termo));
            if (!achouLogin && !combina(codigo)) return;
            if (!grupos.has(email)) grupos.set(email, []);
            grupos.get(email).push({ k, email, codigo, ligado, p: porCodigo.get(codigo) });
        });
        return [...grupos.entries()]
            .map(([email, itens]) => ({ email, login: loginsPorEmail.get(email) || null, itens: itens.sort((a, b) => a.codigo.localeCompare(b.codigo)) }))
            .sort((a, b) => String(a.login?.nome || a.email).localeCompare(String(b.login?.nome || b.email), 'pt-BR'));
    })();

    const qtdLogin = porLogin.reduce((s, g) => s + g.itens.length, 0);
    const linha = 'flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-t border-slate-100 dark:border-slate-800';
    const nomePerm = (l) => (l.p ? tx(l.p.nome) : tx('Permissão que não existe mais'));
    const botaoVoltar = (k, onClick) => (
        <button type="button" onClick={onClick} disabled={gravando === k}
            className="h-8 px-3 rounded-lg border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 inline-flex items-center gap-1.5 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            <RotateCcw className="w-3 h-3" />{tx('Voltar ao padrão')}
        </button>
    );

    if (porNivel.length === 0 && qtdLogin === 0) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 py-12 flex flex-col items-center gap-2 dark:bg-slate-900 dark:border-slate-800">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    {termo ? tx('Nenhuma mudança encontrada com essa busca.') : tx('Tudo no padrão do sistema: nada foi mudado.')}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
                <h4 className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-700 flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 dark:text-slate-200">
                    <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />{tx('Por nível ({qtd})', { qtd: porNivel.length })}
                </h4>
                {porNivel.length === 0 && <p className="px-4 py-3 border-t border-slate-100 text-[12px] font-bold text-slate-400 dark:border-slate-800">{tx('Nenhum nível mudado.')}</p>}
                {porNivel.map(l => (
                    <div key={l.k} className={linha}>
                        <div className="min-w-0 flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[12px] font-black text-slate-700 dark:text-slate-200">{l.codigo}</span>
                            <span className="text-[13px] font-bold text-slate-800 dark:text-white">{nomePerm(l)}</span>
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">· {tx(NOME_PAPEL[l.papel] || l.papel)}</span>
                            <Estado ligado={l.ligado} />
                            {l.p && <span className="text-[11px] font-semibold text-slate-400">{tx('padrão: {estado}', { estado: l.p.padrao.includes(l.papel) ? tx('liberado') : tx('bloqueado') })}</span>}
                        </div>
                        {botaoVoltar(l.k, () => onVoltarNivel(l.papel, l.codigo))}
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
                <h4 className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-700 flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 dark:text-slate-200">
                    <UserCog className="w-4 h-4 text-blue-600 dark:text-blue-400" />{tx('Por login ({qtd})', { qtd: qtdLogin })}
                </h4>
                {porLogin.length === 0 && <p className="px-4 py-3 border-t border-slate-100 text-[12px] font-bold text-slate-400 dark:border-slate-800">{tx('Nenhuma exceção por login.')}</p>}
                {porLogin.map(g => {
                    const papel = papelDe(g.login);
                    return (
                        <div key={g.email} className="border-t border-slate-200 dark:border-slate-800">
                            <p className="px-4 pt-3 pb-1 text-[12px] font-black text-slate-800 uppercase dark:text-white">
                                {g.login?.nome || g.email}
                                <span className="normal-case font-semibold text-slate-400"> · {g.login ? `${tx(NOME_PAPEL[papel] || papel)}${g.login.unidade ? ` · ${g.login.unidade}` : ''}` : tx('login que não existe mais')} · {g.email}</span>
                            </p>
                            {g.itens.map(l => {
                                const semEfeito = !g.login || !l.p || !podeMudar(l.p, papel, bancoPronto);
                                const doNivel = l.p && g.login ? (regras.has(`${papel}|${l.codigo}`) ? regras.get(`${papel}|${l.codigo}`) : l.p.padrao.includes(papel)) : null;
                                return (
                                    <div key={l.k} className={linha}>
                                        <div className="min-w-0 flex flex-wrap items-center gap-2">
                                            <span className="font-mono text-[12px] font-black text-slate-700 dark:text-slate-200">{l.codigo}</span>
                                            <span className="text-[13px] font-bold text-slate-800 dark:text-white">{nomePerm(l)}</span>
                                            <Estado ligado={l.ligado} />
                                            {doNivel !== null && <span className="text-[11px] font-semibold text-slate-400">{tx('o nível dele: {estado}', { estado: doNivel ? tx('liberado') : tx('bloqueado') })}</span>}
                                            {semEfeito && <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-600 dark:text-amber-400" title={tx('Esta exceção não vale para o nível atual do login (ou a permissão não existe mais). Pode voltar ao padrão sem mudar nada.')}><AlertTriangle className="w-3 h-3" />{tx('sem efeito')}</span>}
                                        </div>
                                        {botaoVoltar(l.k, () => onVoltarExcecao(l.email, l.codigo))}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default DiferencasPadrao;
