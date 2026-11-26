import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DatabaseBackup, Download, FileSearch, Images, ShieldCheck, AlertTriangle, CheckCircle2, Loader2, HelpCircle, History } from 'lucide-react';
import { avisar } from '../../components/avisar.js';
import { tx, localeAtual } from '../../i18n/traduzir.js';
import {
    TABELAS_PRINCIPAIS, TABELAS_HISTORICO, TODAS_TABELAS_BACKUP, DIAS_AVISO_BACKUP, situacaoBackup, formatarTamanho,
    fazerBackupDados, listarArquivosNovos, fazerBackupArquivos, carregarHistoricoBackups, registrarBackup,
    lerArquivoBackup, contarLinhasHoje
} from './backup.js';

// ==========================================
// ABA BACKUP (Configurações, só o Admin; permissão 912; decisão do dono, 19/11/2026). Regras em backup.js.
// ==========================================

const COR_NIVEL = {
    ok: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
    atencao: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
    atrasado: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
    nunca: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30'
};

const dataHora = (iso) => (iso ? new Date(iso).toLocaleString(localeAtual(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const numero = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString(localeAtual()));

const Cartao = ({ icone: Icone, titulo, children, acao }) => (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-700 inline-flex items-center gap-2 dark:text-slate-200">
                <Icone className="w-4 h-4 text-blue-600 dark:text-blue-400" />{titulo}
            </h3>
            {acao}
        </div>
        {children}
    </div>
);

const Botao = ({ onClick, disabled, children, principal = true }) => (
    <button type="button" onClick={onClick} disabled={disabled}
        className={`h-10 px-4 rounded-xl text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${principal ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200'}`}>
        {children}
    </button>
);

const AbaBackup = ({ nomeLogado = '', emailLogado = '' }) => {
    const [historico, setHistorico] = useState({ ok: true, lista: [], carregado: false });
    const [progresso, setProgresso] = useState({}); // tabela → { feitos, total, situacao, erro }
    const [copiando, setCopiando] = useState(false);
    const [resultado, setResultado] = useState(null);
    const [arquivosPrevia, setArquivosPrevia] = useState(null); // { arquivos, tamanho, desde }
    const [arquivosProgresso, setArquivosProgresso] = useState(null);
    const [conferencia, setConferencia] = useState(null);
    const [conferindo, setConferindo] = useState(false);
    const [ajudaAberta, setAjudaAberta] = useState(false);

    const recarregarHistorico = useCallback(async () => {
        const r = await carregarHistoricoBackups(30);
        setHistorico({ ok: r.ok, lista: r.lista, carregado: true });
    }, []);
    useEffect(() => { recarregarHistorico(); }, [recarregarHistorico]);

    const ultimaDados = useMemo(() => historico.lista.find(l => l.tipo === 'DADOS') || null, [historico.lista]);
    const ultimaArquivos = useMemo(() => historico.lista.find(l => l.tipo === 'ARQUIVOS') || null, [historico.lista]);
    const situacao = situacaoBackup(ultimaDados?.criado_em);
    const quem = nomeLogado || emailLogado;
    const ocupado = copiando || Boolean(arquivosProgresso) || conferindo;

    const textoSituacao = situacao.nivel === 'nunca'
        ? tx('Nenhuma cópia dos dados registrada ainda')
        : situacao.dias === 0
            ? tx('Última cópia dos dados: hoje · por {quem}', { quem: ultimaDados?.criado_por_nome || ultimaDados?.criado_por || '—' })
            : tx('Última cópia dos dados: há {dias} dias · por {quem}', { dias: situacao.dias, quem: ultimaDados?.criado_por_nome || ultimaDados?.criado_por || '—' });

    // ---------- Cópia dos dados ----------
    const copiarDados = async () => {
        if (ocupado) return;
        setCopiando(true);
        setResultado(null);
        setProgresso({});
        try {
            const r = await fazerBackupDados({
                quem,
                aoProgresso: (p) => setProgresso(prev => ({ ...prev, [p.tabela]: p }))
            });
            setResultado(r);
            const gravou = await registrarBackup({ criado_por_nome: quem, tipo: 'DADOS', tamanho_bytes: r.tamanho, linhas: r.linhas, erros: Object.keys(r.erros).length ? r.erros : null });
            await recarregarHistorico();
            const qtdErros = Object.keys(r.erros).length;
            if (qtdErros) avisar(tx('Cópia baixada ({nome}), mas {qtd} tabelas não puderam ser lidas. Veja a lista.', { nome: r.nome, qtd: qtdErros }), 'atencao');
            else avisar(tx('Cópia baixada com sucesso: {nome}', { nome: r.nome }), 'sucesso');
            if (!gravou) avisar(tx('A cópia foi baixada, mas o histórico não foi guardado. Rode no Supabase o SQL sql/2026-11-19-backup/1_backups_log.sql.'), 'atencao');
        } catch (erro) {
            console.error('Erro ao fazer a cópia dos dados:', erro);
            avisar(tx('Não foi possível fazer a cópia: {erro}', { erro: erro?.message || '' }), 'erro');
        } finally {
            setCopiando(false);
        }
    };

    // ---------- Cópia dos arquivos ----------
    const prepararArquivos = async () => {
        if (ocupado) return;
        setArquivosProgresso({ feitos: 0, total: null, listando: true });
        try {
            const desde = ultimaArquivos?.arquivos_ate || null;
            const r = await listarArquivosNovos(desde);
            setArquivosPrevia({ ...r, desde });
        } catch (erro) {
            avisar(tx('Não foi possível listar os arquivos: {erro}', { erro: erro?.message || '' }), 'erro');
        } finally {
            setArquivosProgresso(null);
        }
    };

    const baixarArquivos = async () => {
        if (!arquivosPrevia?.arquivos?.length || ocupado) return;
        setArquivosProgresso({ feitos: 0, total: arquivosPrevia.arquivos.length });
        try {
            const r = await fazerBackupArquivos({ arquivos: arquivosPrevia.arquivos, aoProgresso: setArquivosProgresso });
            await registrarBackup({ criado_por_nome: quem, tipo: 'ARQUIVOS', tamanho_bytes: r.tamanho, linhas: { arquivos: r.quantidade, partes: r.partes.length }, erros: r.falhas.length ? { falhas: r.falhas } : null, arquivos_ate: r.arquivosAte || ultimaArquivos?.arquivos_ate || null });
            await recarregarHistorico();
            setArquivosPrevia(null);
            if (r.falhas.length) avisar(tx('{qtd} arquivos baixados em {partes} partes; {falhas} não puderam ser baixados.', { qtd: r.quantidade, partes: r.partes.length, falhas: r.falhas.length }), 'atencao');
            else avisar(tx('{qtd} arquivos baixados em {partes} partes.', { qtd: r.quantidade, partes: r.partes.length }), 'sucesso');
        } catch (erro) {
            avisar(tx('Não foi possível baixar os arquivos: {erro}', { erro: erro?.message || '' }), 'erro');
        } finally {
            setArquivosProgresso(null);
        }
    };

    // ---------- Conferir um arquivo ----------
    const conferirArquivo = async (evento) => {
        const arquivo = evento.target.files?.[0];
        evento.target.value = '';
        if (!arquivo) return;
        setConferindo(true);
        setConferencia(null);
        try {
            const lido = await lerArquivoBackup(arquivo);
            if (lido.tipo === 'ARQUIVOS') {
                setConferencia({ nome: arquivo.name, ...lido });
            } else {
                const tabelas = [...new Set([...Object.keys(lido.linhas), ...TODAS_TABELAS_BACKUP])];
                const hoje = await contarLinhasHoje(tabelas);
                setConferencia({ nome: arquivo.name, ...lido, tabelas, hoje });
            }
        } catch (erro) {
            avisar(tx('Não foi possível ler o arquivo: {erro}', { erro: erro?.message || '' }), 'erro');
        } finally {
            setConferindo(false);
        }
    };

    const linhasProgresso = TODAS_TABELAS_BACKUP.filter(t => progresso[t]);
    const totalLinhasResultado = resultado ? Object.values(resultado.linhas).reduce((s, n) => s + n, 0) : 0;

    return (
        <div className="space-y-4">
            {/* Faixa da situação */}
            <div className={`rounded-2xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${COR_NIVEL[situacao.nivel]}`}>
                <div className="flex items-center gap-2 min-w-0">
                    {situacao.nivel === 'ok' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
                    <div className="min-w-0">
                        <p className="text-sm font-black">{textoSituacao}</p>
                        <p className="text-[11px] font-semibold opacity-80">
                            {tx('Faça uma cópia por semana (o aviso ao entrar aparece depois de {dias} dias).', { dias: DIAS_AVISO_BACKUP })}
                            {ultimaArquivos ? ` ${tx('Arquivos: última cópia em {data}.', { data: dataHora(ultimaArquivos.criado_em) })}` : ` ${tx('Arquivos: nenhuma cópia ainda.')}`}
                        </p>
                    </div>
                </div>
                <button type="button" onClick={() => setAjudaAberta(a => !a)} className="max-md:h-10 text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-1 underline underline-offset-2">
                    <HelpCircle className="w-4 h-4" />{ajudaAberta ? tx('Fechar rotina') : tx('Rotina recomendada')}
                </button>
            </div>

            {historico.carregado && !historico.ok && (
                <div className="rounded-2xl border px-4 py-3 text-[12px] font-bold bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30">
                    {tx('O histórico das cópias ainda não existe no banco. A cópia funciona, mas para guardar o histórico e ter o aviso ao entrar, rode no Supabase (SQL Editor) o arquivo sql/2026-11-19-backup/1_backups_log.sql.')}
                </div>
            )}

            {ajudaAberta && (
                <Cartao icone={ShieldCheck} titulo={tx('Rotina recomendada')}>
                    <ul className="text-[12px] font-semibold text-slate-600 space-y-1.5 list-disc pl-5 dark:text-slate-300">
                        <li>{tx('Toda segunda de manhã: "Fazer cópia agora" (dados). Guardar na pasta "Backups Pratique" do Google Drive.')}</li>
                        <li>{tx('Dia 1º de cada mês: cópia dos arquivos (fotos e PDFs) e a cópia completa do banco feita no computador (pg_dump), que guarda também as funções e as regras de acesso.')}</li>
                        <li>{tx('Antes de rodar um SQL grande (vendas, comissão, correção em massa): uma cópia extra.')}</li>
                        <li>{tx('A cada 3 meses: "Conferir um arquivo" num backup antigo, para ter certeza de que ele abre.')}</li>
                        <li>{tx('Guardar as 8 últimas semanais e 1 por mês durante 12 meses; as outras podem ser apagadas.')}</li>
                        <li>{tx('O arquivo tem CPF, telefone e e-mail dos alunos: guardar só em pasta privada, nunca mandar por WhatsApp.')}</li>
                        <li>{tx('Cada cópia baixa o banco inteiro e conta no limite de dados do Supabase: uma por semana é o suficiente.')}</li>
                    </ul>
                </Cartao>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* Cópia dos dados */}
                <Cartao icone={DatabaseBackup} titulo={tx('Cópia dos dados')}
                    acao={<Botao onClick={copiarDados} disabled={ocupado}>{copiando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}{copiando ? tx('Copiando...') : tx('Fazer cópia agora')}</Botao>}>
                    <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">
                        {tx('Baixa um arquivo com {principais} tabelas do sistema e {historico} de histórico (auditoria e lixeira das vendas, cadastros, acessos, permissões). Não restaura nada e não muda nada no banco.', { principais: TABELAS_PRINCIPAIS.length, historico: TABELAS_HISTORICO.length })}
                    </p>
                    {linhasProgresso.length > 0 && (
                        <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                            <table className="w-full text-[12px]">
                                <tbody>
                                    {linhasProgresso.map(t => {
                                        const p = progresso[t];
                                        return (
                                            <tr key={t} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                                                <td className="px-3 py-1.5 font-bold text-slate-700 dark:text-slate-200 max-md:break-all">{t}</td>
                                                <td className="px-3 py-1.5 text-right font-semibold md:whitespace-nowrap">
                                                    {p.situacao === 'erro' ? <span className="text-amber-600 dark:text-amber-400">{tx(p.erro || 'erro ao ler')}</span>
                                                        : p.situacao === 'ok' ? <span className="text-emerald-600 dark:text-emerald-400">✓ {numero(p.feitos)}</span>
                                                            : <span className="text-slate-500 dark:text-slate-400">{numero(p.feitos)}{p.total ? ` / ${numero(p.total)}` : ''}…</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {resultado && (
                        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-[12px] font-bold text-slate-700 dark:bg-slate-800/60 dark:border-slate-800 dark:text-slate-200">
                            {tx('Arquivo {nome} · {tamanho} · {linhas} linhas em {tabelas} tabelas', { nome: resultado.nome, tamanho: formatarTamanho(resultado.tamanho), linhas: numero(totalLinhasResultado), tabelas: Object.keys(resultado.linhas).length })}
                            {Object.keys(resultado.erros).length > 0 && (
                                <p className="text-amber-700 mt-1 dark:text-amber-300">{tx('Não lidas: {lista}', { lista: Object.keys(resultado.erros).join(', ') })}</p>
                            )}
                            {Object.keys(resultado.avisos || {}).length > 0 && (
                                <p className="text-amber-700 mt-1 dark:text-amber-300">{tx('Conferir a contagem: {lista}', { lista: Object.keys(resultado.avisos).join(', ') })}</p>
                            )}
                        </div>
                    )}
                </Cartao>

                {/* Cópia dos arquivos */}
                <Cartao icone={Images} titulo={tx('Fotos e PDFs')}
                    acao={!arquivosPrevia && <Botao principal={false} onClick={prepararArquivos} disabled={ocupado}>{arquivosProgresso?.listando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />}{tx('Ver o que falta copiar')}</Botao>}>
                    <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">
                        {tx('Exames da Avaliação Física e imagens, PDFs e vídeos dos Comunicados. Pega só os arquivos novos desde a última cópia de arquivos. É pesado: uma vez por mês.')}
                    </p>
                    {arquivosPrevia && (
                        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 space-y-2 dark:bg-slate-800/60 dark:border-slate-800">
                            <p className="text-[12px] font-bold text-slate-700 dark:text-slate-200">
                                {arquivosPrevia.arquivos.length === 0
                                    ? tx('Nenhum arquivo novo desde a última cópia.')
                                    : tx('{qtd} arquivos · {tamanho} {desde}', { qtd: numero(arquivosPrevia.arquivos.length), tamanho: formatarTamanho(arquivosPrevia.tamanho), desde: arquivosPrevia.desde ? tx('(novos desde {data})', { data: dataHora(arquivosPrevia.desde) }) : tx('(primeira cópia: todos)') })}
                            </p>
                            {arquivosPrevia.arquivos.length > 0 && (
                                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tx('Os arquivos saem em partes de até 50 MB; o navegador pode pedir para permitir vários downloads.')}</p>
                            )}
                            <div className="flex flex-wrap gap-2">
                                {arquivosPrevia.arquivos.length > 0 && (
                                    <Botao onClick={baixarArquivos} disabled={ocupado}>
                                        {arquivosProgresso ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                        {arquivosProgresso ? tx('Baixando {feitos} de {total}...', { feitos: arquivosProgresso.feitos, total: arquivosProgresso.total }) : tx('Baixar arquivos')}
                                    </Botao>
                                )}
                                <Botao principal={false} onClick={() => setArquivosPrevia(null)} disabled={Boolean(arquivosProgresso)}>{tx('Cancelar')}</Botao>
                            </div>
                        </div>
                    )}
                </Cartao>
            </div>

            {/* Conferir um arquivo */}
            <Cartao icone={FileSearch} titulo={tx('Conferir um arquivo de backup')}
                acao={(
                    <label className={`h-10 px-4 rounded-xl text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-2 shadow-sm bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 ${ocupado ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
                        {conferindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />}{tx('Escolher arquivo')}
                        <input type="file" accept=".gz,.json,application/json,application/gzip" className="hidden" onChange={conferirArquivo} />
                    </label>
                )}>
                <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">
                    {tx('Abre um backup guardado no computador e mostra o que tem dentro, comparando com o banco de hoje. Não muda nada.')}
                </p>
                {conferencia && conferencia.tipo === 'ARQUIVOS' && (
                    <p className="text-[12px] font-bold text-slate-700 dark:text-slate-200">
                        {tx('{nome}: cópia de arquivos de {data}, parte {parte}, com {qtd} arquivos.', { nome: conferencia.nome, data: dataHora(conferencia.criado_em), parte: conferencia.parte, qtd: conferencia.quantidade })}
                    </p>
                )}
                {conferencia && conferencia.tipo === 'DADOS' && (
                    <div className="space-y-2">
                        <p className="text-[12px] font-bold text-slate-700 dark:text-slate-200">
                            {tx('{nome}: feito em {data} por {quem}.', { nome: conferencia.nome, data: dataHora(conferencia.criado_em), quem: conferencia.criado_por || '—' })}
                        </p>
                        <div className="max-h-80 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
                            <table className="tabela-arrasta w-full max-md:min-w-[520px] text-[12px]">
                                <thead className="bg-slate-50 sticky top-0 dark:bg-slate-800">
                                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                        <th className="px-3 py-2 text-left">{tx('Tabela')}</th>
                                        <th className="px-3 py-2 text-right">{tx('No arquivo')}</th>
                                        <th className="px-3 py-2 text-right">{tx('No banco hoje')}</th>
                                        <th className="px-3 py-2 text-right">{tx('Diferença')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {conferencia.tabelas.map(t => {
                                        const noArquivo = conferencia.linhas[t];
                                        const hoje = conferencia.hoje[t];
                                        const dif = Number.isFinite(noArquivo) && Number.isFinite(hoje) ? hoje - noArquivo : null;
                                        return (
                                            <tr key={t} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                                                <td className="px-3 py-1.5 font-bold text-slate-700 dark:text-slate-200 max-md:w-[150px] max-md:min-w-[150px] max-md:max-w-[150px] max-md:break-all">{t}</td>
                                                <td className="px-3 py-1.5 text-right font-semibold">{noArquivo === undefined ? <span className="text-amber-600 dark:text-amber-400">{tx('fora do arquivo')}</span> : numero(noArquivo)}</td>
                                                <td className="px-3 py-1.5 text-right font-semibold">{numero(hoje)}</td>
                                                <td className={`px-3 py-1.5 text-right font-black ${dif === null || dif === 0 ? 'text-slate-400' : dif > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                    {dif === null ? '—' : dif > 0 ? `+${numero(dif)}` : numero(dif)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tx('Diferença = linhas que entraram (verde) ou saíram (vermelho) do banco desde a cópia. Vermelho em vendas merece atenção.')}</p>
                    </div>
                )}
            </Cartao>

            {/* Histórico */}
            <Cartao icone={History} titulo={tx('Cópias feitas')}>
                {!historico.carregado ? (
                    <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">{tx('Carregando...')}</p>
                ) : historico.lista.length === 0 ? (
                    <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">{tx('Nenhuma cópia registrada.')}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="tabela-arrasta w-full max-md:min-w-[560px] text-[12px]">
                            <thead>
                                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:text-slate-400 dark:border-slate-800">
                                    <th className="px-3 py-2 text-left">{tx('Quando')}</th>
                                    <th className="px-3 py-2 text-left">{tx('Tipo')}</th>
                                    <th className="px-3 py-2 text-left">{tx('Quem')}</th>
                                    <th className="px-3 py-2 text-right">{tx('Tamanho')}</th>
                                    <th className="px-3 py-2 text-left">{tx('Observação')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historico.lista.map(l => {
                                    const qtdErros = l.erros ? (l.tipo === 'ARQUIVOS' ? (l.erros.falhas || []).length : Object.keys(l.erros).length) : 0;
                                    const detalhe = l.tipo === 'ARQUIVOS'
                                        ? tx('{qtd} arquivos', { qtd: numero(l.linhas?.arquivos) })
                                        : tx('{qtd} linhas', { qtd: numero(Object.values(l.linhas || {}).reduce((s, n) => s + (Number(n) || 0), 0)) });
                                    return (
                                        <tr key={l.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                                            <td className="px-3 py-1.5 font-bold text-slate-700 whitespace-nowrap dark:text-slate-200">{dataHora(l.criado_em)}</td>
                                            <td className="px-3 py-1.5 font-semibold">{l.tipo === 'ARQUIVOS' ? tx('Arquivos') : tx('Dados')}</td>
                                            <td className="px-3 py-1.5 font-semibold">{l.criado_por_nome || l.criado_por}</td>
                                            <td className="px-3 py-1.5 text-right font-semibold whitespace-nowrap">{formatarTamanho(l.tamanho_bytes)}</td>
                                            <td className="px-3 py-1.5 font-semibold">
                                                {detalhe}
                                                {qtdErros > 0 && <span className="text-amber-600 ml-2 dark:text-amber-400">{tx('· {qtd} com erro', { qtd: qtdErros })}</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Cartao>
        </div>
    );
};

export default AbaBackup;
