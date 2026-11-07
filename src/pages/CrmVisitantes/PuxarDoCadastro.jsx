import React, { useState, useEffect, useMemo } from 'react';
import { UserCheck, Loader2, Search, Download, AlertTriangle } from 'lucide-react';
import { avisar } from '../../components/avisar.js';
import { tx } from '../../i18n/traduzir.js';
import { normalizarNome } from './utils.js';
import { QTDS_PUXAR, DIAS_SEM_COMPRA, tipoDoStatus, carregarAlunosDoCadastro, conferirAlunos, trazerParaBase } from './regrasPuxarCadastro.js';

// Base do CRM → "Puxar do cadastro" (decisão do dono, 06/11/2026; regras em regrasPuxarCadastro.js)
// onSalvos(leads, statusEscolhidos): o CRM coloca os contatos na tela e grava o histórico
const PuxarDoCadastro = ({ unidade, onSalvos }) => {
    const [carregando, setCarregando] = useState(true);
    const [alunos, setAlunos] = useState([]);
    const [erro, setErro] = useState('');
    const [escolhidos, setEscolhidos] = useState([]);
    const [qtd, setQtd] = useState(QTDS_PUXAR[0]);
    const [conferindo, setConferindo] = useState(false);
    const [conferencia, setConferencia] = useState(null);
    const [trazendo, setTrazendo] = useState(false);
    const [versao, setVersao] = useState(0);

    useEffect(() => {
        let cancelado = false;
        setCarregando(true); setErro(''); setConferencia(null);
        carregarAlunosDoCadastro(unidade).then(r => {
            if (cancelado) return;
            if (r.erro) { setErro(r.erro); setAlunos([]); }
            else setAlunos(r.alunos);
            setCarregando(false);
        });
        return () => { cancelado = true; };
    }, [unidade, versao]);

    // Status presentes na unidade, com quantos alunos
    const status = useMemo(() => {
        const mapa = new Map();
        alunos.forEach(a => { const s = normalizarNome(a.status_aluno); mapa.set(s, (mapa.get(s) || 0) + 1); });
        return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
    }, [alunos]);

    const alternar = (s) => {
        setConferencia(null);
        setEscolhidos(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    };

    const conferir = async () => {
        if (!escolhidos.length) return;
        setConferindo(true);
        const r = await conferirAlunos(alunos, escolhidos);
        setConferindo(false);
        if (r.erro === 'SQL_COMPRAS') { setErro('SQL_COMPRAS'); return; }
        setConferencia(r);
    };

    const quantosVem = conferencia ? Math.min(qtd, conferencia.prontos.length) : 0;

    const trazer = async () => {
        if (!quantosVem) return;
        if (!window.confirm(tx("Trazer {qtd} alunos para o Banco Bruto de {unidade}?", { qtd: quantosVem, unidade }))) return;
        setTrazendo(true);
        const { salvos, recusados } = await trazerParaBase(conferencia.prontos.slice(0, quantosVem), unidade);
        setTrazendo(false);
        if (salvos.length) onSalvos?.(salvos, escolhidos);
        let msg = tx("{qtd} alunos foram para o Banco Bruto.", { qtd: salvos.length });
        if (recusados.length) msg += '\n' + tx("{qtd} não entraram:", { qtd: recusados.length }) + '\n' + recusados.slice(0, 10).map(r => `${r.nome} — ${r.erro}`).join('\n');
        avisar(msg, recusados.length ? 'atencao' : 'sucesso');
        setConferencia(null);
        setVersao(v => v + 1);
    };

    const rotuloBotao = 'px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-50';

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm p-6 lg:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2"><UserCheck className="w-4 h-4" />{' '}{tx("Puxar do cadastro")}</h3>
                    <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 max-w-3xl">
                        {tx("Alunos de {unidade} pelo status da importação. Ficam de fora: quem já está no CRM, \"Não contatar\", sem telefone válido e quem comprou plano nos últimos {dias} dias.", { unidade, dias: DIAS_SEM_COMPRA })}
                    </p>
                </div>
            </div>

            {carregando ? (
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400"><Loader2 className="w-4 h-4 animate-spin" />{' '}{tx("Carregando o cadastro...")}</div>
            ) : erro ? (
                <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold flex items-start gap-2 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                        {erro === 'SQL_COMPRAS' ? tx("Falta rodar no banco o SQL 2026-11-06-crm-puxar-cadastro (conferência de compras). Sem ele não dá para puxar.")
                            : erro === 'SQL_CADASTRO' ? tx("Falta rodar no banco o SQL 2026-11-06-alunos-importacao (status do aluno).")
                            : tx("Não foi possível ler o cadastro: {erro}", { erro })}
                    </span>
                </div>
            ) : status.length === 0 ? (
                <p className="text-xs font-bold text-slate-400">{tx("Nenhum aluno desta unidade com status para puxar. Importe a lista em Cadastro → Alunos.")}</p>
            ) : (
                <>
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        {status.map(([s, n]) => {
                            const ativo = escolhidos.includes(s);
                            return (
                                <button key={s} type="button" onClick={() => alternar(s)}
                                    className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${ativo ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-blue-300 dark:bg-slate-800/60 dark:border-slate-800 dark:text-slate-300'}`}
                                    title={tx("Entra no CRM como {tipo}", { tipo: tx(tipoDoStatus(s)) })}>
                                    {s} <span className={ativo ? 'text-blue-100' : 'text-slate-400'}>· {n}</span>
                                </button>
                            );
                        })}
                        <select value={qtd} onChange={(e) => { setQtd(Number(e.target.value)); }} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 outline-none">
                            {QTDS_PUXAR.map(n => <option key={n} value={n}>{tx("{qtd} por vez", { qtd: n })}</option>)}
                        </select>
                        <button type="button" onClick={conferir} disabled={!escolhidos.length || conferindo} className={`${rotuloBotao} bg-slate-800 hover:bg-black text-white`}>
                            {conferindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}{' '}{tx("Conferir")}
                        </button>
                    </div>

                    {conferencia && (
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                <span><span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{conferencia.contagem.prontos}</span>{' '}{tx("prontos")}</span>
                                <span><span className="text-base font-black text-slate-700 dark:text-slate-200">{conferencia.contagem.noCrm}</span>{' '}{tx("já no CRM")}</span>
                                <span><span className="text-base font-black text-slate-700 dark:text-slate-200">{conferencia.contagem.naoContatar}</span>{' '}{tx("Não contatar")}</span>
                                <span><span className="text-base font-black text-slate-700 dark:text-slate-200">{conferencia.contagem.semTelefone}</span>{' '}{tx("sem telefone")}</span>
                                <span><span className="text-base font-black text-slate-700 dark:text-slate-200">{conferencia.contagem.comprou}</span>{' '}{tx("comprou plano (30 dias)")}</span>
                            </div>
                            <button type="button" onClick={trazer} disabled={!quantosVem || trazendo} className={`${rotuloBotao} bg-blue-600 hover:bg-blue-700 text-white`}>
                                {trazendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}{' '}{tx("Trazer {qtd} para o Banco Bruto", { qtd: quantosVem })}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default PuxarDoCadastro;
