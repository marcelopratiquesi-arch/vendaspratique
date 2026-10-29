import React, { useState, useRef } from 'react';
import { AlertTriangle, Check, Copy, Clock, User, Loader2, X, Edit3, Trash2, ShieldCheck, Undo2, Info, BadgeCheck, MessageSquare, Search } from 'lucide-react';
import { supabase } from '../../../supabaseClient.js';
import { formatMoney, formatarCPF, formatDataBR, extrairHoraCriacao, toTitleCase, normalizeString } from '../utils.js';
import { comissaoDaVenda } from './motorDuplicidades.js';

// ==========================================
// ABA "DUPLICIDADES" DO HISTÓRICO (arquivo próprio, para evoluir a auditoria separada da tabela)
// Mostra os grupos achados pelo motor (motorDuplicidades.js): mesma unidade, mesmo dia, mesmo CPF
// e mesmo produto (venda antiga sem CPF: matrícula ou nome, com a etiqueta "Regra antiga (sem CPF)"). Editar e excluir usam as mesmas ações da tabela do Histórico
// (excluir = lixeira com motivo, pela função segura do banco). "Não é duplicidade" fica gravado
// em vendas_duplicidade_legitima (legitimas.js).
// ==========================================

const mascaraCpf = (valor) => {
    const d = String(valor || '').replace(/\D/g, '').slice(0, 11);
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const dataHoraBR = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const inputEdicao = "w-full bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-500/40 text-blue-800 dark:text-blue-200 rounded-md px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-[11px] shadow-sm";

// Aluno da venda pelo CPF completo (igual à Nova Venda): acha o cadastro e preenche nome, CPF e matrícula
const CampoAlunoPorCpf = ({ dadosEdicao, onAplicarAluno }) => {
    const cpfAtualRef = useRef('');
    const status = dadosEdicao.alunoStatus || '';

    const buscar = async (cpfLimpo) => {
        cpfAtualRef.current = cpfLimpo;
        onAplicarAluno({ alunoStatus: 'buscando' });
        try {
            const { data, error } = await supabase.from('alunos').select('*')
                .or(`cpf.eq.${cpfLimpo},cpf.eq."${mascaraCpf(cpfLimpo)}"`).limit(2);
            if (cpfAtualRef.current !== cpfLimpo) return;
            if (error) throw error;
            if (!data || data.length === 0) return onAplicarAluno({ alunoStatus: 'nao_encontrado' });
            if (data.length > 1) return onAplicarAluno({ alunoStatus: 'duplicado' });
            const aluno = data[0];
            onAplicarAluno({
                alunoStatus: 'encontrado',
                cpf: cpfLimpo,
                nome_aluno: String(aluno.nome || '').toUpperCase(),
                matricula: aluno.matricula || ''
            });
        } catch (err) {
            if (cpfAtualRef.current !== cpfLimpo) return;
            console.error('Erro ao buscar aluno pelo CPF:', err);
            onAplicarAluno({ alunoStatus: 'erro' });
        }
    };

    const aoDigitar = (valor) => {
        const limpo = String(valor || '').replace(/\D/g, '').slice(0, 11);
        cpfAtualRef.current = '';
        onAplicarAluno({ cpf: limpo, alunoStatus: limpo.length === 11 ? 'buscando' : 'incompleto' });
        if (limpo.length === 11) buscar(limpo);
    };

    const avisos = {
        buscando: { cor: 'text-slate-500 dark:text-slate-400', texto: 'Buscando aluno...' },
        encontrado: { cor: 'text-emerald-600 dark:text-emerald-300', texto: 'Aluno encontrado' },
        nao_encontrado: { cor: 'text-rose-600 dark:text-rose-300', texto: 'CPF não cadastrado' },
        duplicado: { cor: 'text-rose-600 dark:text-rose-300', texto: 'Mais de um aluno com este CPF' },
        incompleto: { cor: 'text-amber-600 dark:text-amber-300', texto: 'Digite o CPF completo' },
        erro: { cor: 'text-rose-600 dark:text-rose-300', texto: 'Erro ao buscar. Tente de novo' }
    };
    const aviso = avisos[status];

    return (
        <div className="flex flex-col gap-1">
            <div className="relative">
                <input type="text" inputMode="numeric" placeholder="CPF do aluno" value={mascaraCpf(dadosEdicao.cpf)} onChange={e => aoDigitar(e.target.value)} maxLength="14" className={`${inputEdicao} pr-7`} />
                {status === 'buscando'
                    ? <Loader2 className="w-3 h-3 text-blue-500 animate-spin absolute right-2 top-1/2 -translate-y-1/2" />
                    : <Search className="w-3 h-3 text-blue-400 absolute right-2 top-1/2 -translate-y-1/2" />}
            </div>
            {aviso && <span className={`text-[9px] font-black uppercase tracking-widest ${aviso.cor}`}>{aviso.texto}</span>}
        </div>
    );
};

const CartaoGrupo = ({
    grupo, mapCatalogo, temVisaoGlobal, podeEditar, colaboradores, catalogoGeral,
    editandoId, dadosEdicao, isSubmitting, onEditar, onAlterarCampo, onAplicarAluno, onSalvar, onCancelar, onExcluir,
    onMarcarLegitima, onDesfazerLegitima, marcandoChave
}) => {
    const amostra = grupo.linhas[0];
    const legitimo = Boolean(grupo.marcacao);

    // Plano (ou item fora do catálogo) = vermelho; produto/serviço = amarelo; grupo legítimo = verde
    const itemCatalogo = mapCatalogo.get(normalizeString(amostra.produto || ''));
    const tipoItem = itemCatalogo && itemCatalogo.tipo ? itemCatalogo.tipo.toLowerCase().trim() : 'plano';
    const isPlano = tipoItem === 'plano' || (!['produto', 'servico', 'serviço'].includes(tipoItem));

    const cores = legitimo
        ? { borda: 'hover:border-emerald-300', cabecalho: 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20', icone: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300', tag: 'bg-emerald-600' }
        : isPlano
            ? { borda: 'hover:border-rose-400', cabecalho: 'bg-rose-50/50 border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20', icone: 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300', tag: 'bg-rose-600' }
            : { borda: 'hover:border-amber-300', cabecalho: 'bg-amber-50/50 border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20', icone: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300', tag: 'bg-amber-500' };
    const AlertIcon = legitimo ? ShieldCheck : (isPlano ? AlertTriangle : Copy);
    const nomeAluno = amostra.nome_aluno || amostra.nome || '';

    return (
        <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md ${cores.borda}`}>
            <div className={`border-b p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${cores.cabecalho}`}>
                <div className="flex items-start gap-4 w-full min-w-0">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${cores.icone}`}>
                        <AlertIcon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <h4 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight truncate" title={nomeAluno}>
                            {toTitleCase(nomeAluno)}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            {grupo.regraAntiga ? (
                                <>
                                    <span className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded text-[9px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest font-mono">
                                        MAT: {amostra.matricula || 'N/A'}
                                    </span>
                                    <span className="bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest" title="Venda antiga sem CPF: agrupada pela matrícula (ou pelo nome, se não tiver matrícula)">
                                        Regra antiga (sem CPF)
                                    </span>
                                </>
                            ) : (
                                <span className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded text-[9px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest font-mono">
                                    CPF: {formatarCPF(amostra.cpf || amostra.cpf_aluno)}
                                </span>
                            )}
                            <span className="bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/30 px-2 py-0.5 rounded text-[9px] font-black text-blue-600 dark:text-blue-300 uppercase tracking-widest truncate max-w-[180px]" title={amostra.produto}>
                                {amostra.produto}
                            </span>
                            {temVisaoGlobal && (
                                <span className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/30 px-2 py-0.5 rounded text-[9px] font-black text-rose-600 dark:text-rose-300 uppercase tracking-widest">
                                    {amostra.unidade}
                                </span>
                            )}
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                {formatDataBR(amostra.data || amostra.created_at)}
                            </span>
                        </div>
                    </div>
                </div>
                <div className={`${cores.tag} text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest whitespace-nowrap shadow-sm`}>
                    {grupo.linhas.length} lançamentos
                </div>
            </div>

            {legitimo && (
                <div className="px-5 py-2.5 bg-emerald-50/60 dark:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-500/20 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-widest">
                        Não é duplicidade · marcado por {grupo.marcacao.decidido_por || '—'} em {dataHoraBR(grupo.marcacao.decidido_em)}
                    </span>
                    {podeEditar && (
                        <button disabled={isSubmitting} onClick={() => onDesfazerLegitima(grupo.marcacao)} className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 disabled:opacity-50 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all">
                            <Undo2 className="w-3 h-3" /> Desfazer
                        </button>
                    )}
                </div>
            )}

            <div className="p-5 flex flex-col gap-4 flex-1">
                {grupo.linhas.map((row, posicao) => {
                    const isEditing = !legitimo && editandoId === row.id;
                    const original = posicao === grupo.linhas.length - 1;

                    let vendedoresDaUnidade = [];
                    if (isEditing) {
                        vendedoresDaUnidade = colaboradores
                            .filter(c => (c.unidade || '').toUpperCase() === (row.unidade || '').toUpperCase())
                            .map(c => c.nome.toUpperCase());

                        const vendedorAtualFormatado = (dadosEdicao.vendedor || '').toUpperCase();
                        if (vendedorAtualFormatado && !vendedoresDaUnidade.includes(vendedorAtualFormatado)) {
                            vendedoresDaUnidade.push(vendedorAtualFormatado);
                        }
                    }

                    return (
                        <div key={row.id} className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border rounded-xl transition-colors ${isEditing ? 'bg-blue-50/50 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/40 shadow-md' : 'bg-slate-50/50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>

                            <div className="flex items-start gap-4 flex-1 w-full min-w-0">
                                <div className="flex flex-col items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 min-w-[84px] shadow-sm shrink-0">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nº {row.id}</span>
                                    <Clock className="w-3.5 h-3.5 text-slate-400 my-1" />
                                    <span className="text-xs font-black text-slate-700 dark:text-slate-200 font-mono">{extrairHoraCriacao(row.created_at, true) || '--:--:--'}</span>
                                </div>

                                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                                    {isEditing ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                                            <input type="date" required value={dadosEdicao.data || ''} onChange={e => onAlterarCampo('data', e.target.value)} className={inputEdicao} title="Data da venda" />
                                            <CampoAlunoPorCpf dadosEdicao={dadosEdicao} onAplicarAluno={onAplicarAluno} />
                                            <input type="text" placeholder="Nome do Aluno" value={dadosEdicao.nome_aluno} onChange={e => onAlterarCampo('nome_aluno', e.target.value)} className={`${inputEdicao} uppercase sm:col-span-2`} />
                                            <select value={dadosEdicao.produto} onChange={e => onAlterarCampo('produto', e.target.value)} className={`${inputEdicao} uppercase cursor-pointer`}>
                                                <option value="" disabled>Selecione...</option>
                                                {catalogoGeral.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                                            </select>
                                            <select value={(dadosEdicao.vendedor || '').toUpperCase()} onChange={e => onAlterarCampo('vendedor', e.target.value)} className={`${inputEdicao} uppercase cursor-pointer`}>
                                                <option value="" disabled>Selecione o Vendedor...</option>
                                                {vendedoresDaUnidade.sort().map(v => <option key={v} value={v}>{toTitleCase(v)}</option>)}
                                            </select>
                                            <input type="number" min="1" placeholder="Qtd" value={dadosEdicao.quantidade} onChange={e => onAlterarCampo('quantidade', e.target.value)} className={inputEdicao} />
                                            <div className="flex items-center px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-black text-emerald-600 dark:text-emerald-300" title="A comissão vem do catálogo (valor do item × quantidade)">
                                                Comissão: {formatMoney(dadosEdicao.valorCalculado)}
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-[11px] font-black text-slate-800 dark:text-slate-100">Qtd: {row.quantidade || '1'}</span>
                                                <span className="text-[10px] text-slate-300">•</span>
                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Valor {formatMoney(row.valor)}</span>
                                                <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded">Comissão {formatMoney(comissaoDaVenda(row))}</span>
                                                {row.conferiu && (
                                                    <span className="flex items-center gap-1 text-[9px] font-black text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/30 px-1.5 py-0.5 rounded uppercase tracking-widest" title={row.conferido_por ? `Conferida por ${row.conferido_por}` : 'Conferida no Fechamento'}>
                                                        <BadgeCheck className="w-3 h-3" /> Conferida
                                                    </span>
                                                )}
                                                {original && (
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest" title="O lançamento mais antigo do grupo é considerado o original">Original</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                                <User className="w-3 h-3 text-slate-400" /> Consultor: <span className="text-slate-700 dark:text-slate-200">{toTitleCase(row.vendedor)}</span>
                                            </div>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                Lançado por: {toTitleCase(row.criado_por ? row.criado_por.split(' ')[0] : 'Sistema')}
                                            </p>
                                            {row.observacao && String(row.observacao).trim() && (
                                                <p className="flex items-start gap-1.5 text-[10px] font-medium text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/30 rounded-md px-2 py-1 mt-0.5">
                                                    <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" /> {row.observacao}
                                                </p>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {podeEditar && !legitimo && (
                                <div className="flex sm:flex-col gap-2 w-full sm:w-auto shrink-0 mt-3 sm:mt-0">
                                    {isEditing ? (
                                        <>
                                            <button disabled={isSubmitting} onClick={() => onSalvar(row)} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 rounded text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
                                                {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Salvar
                                            </button>
                                            <button disabled={isSubmitting} onClick={onCancelar} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 rounded text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
                                                <X className="w-3 h-3" /> Cancelar
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button disabled={isSubmitting} onClick={() => onEditar(row)} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:border-blue-300 dark:hover:text-blue-300 rounded text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
                                                <Edit3 className="w-3 h-3" /> Editar
                                            </button>
                                            <button disabled={isSubmitting} onClick={() => onExcluir(row.id)} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
                                                <Trash2 className="w-3 h-3" /> Excluir
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {podeEditar && !legitimo && (
                <div className="px-5 pb-5 -mt-1 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Sob suspeita: <span className="text-rose-600 dark:text-rose-300">{formatMoney(grupo.comissaoSuspeita)}</span>
                    </span>
                    <button disabled={isSubmitting || marcandoChave === grupo.chaveBase} onClick={() => onMarcarLegitima(grupo)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 disabled:opacity-50 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
                        {marcandoChave === grupo.chaveBase ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />} Não é duplicidade
                    </button>
                </div>
            )}
        </div>
    );
};

const AbaDuplicidades = ({
    resultado, mapCatalogo, temVisaoGlobal, podeEditar, colaboradores = [], catalogoGeral = [],
    editandoId, dadosEdicao, isSubmitting, onEditar, onAlterarCampo, onAplicarAluno, onSalvar, onCancelar, onExcluir,
    onMarcarLegitima, onDesfazerLegitima, marcandoChave
}) => {
    const [verLegitimos, setVerLegitimos] = useState(false);
    const { grupos, gruposLegitimos, excedentes, comissaoSuspeita } = resultado;
    const lista = verLegitimos ? gruposLegitimos : grupos;

    const propsCartao = {
        mapCatalogo, temVisaoGlobal, podeEditar, colaboradores, catalogoGeral,
        editandoId, dadosEdicao, isSubmitting, onEditar, onAlterarCampo, onAplicarAluno, onSalvar, onCancelar, onExcluir,
        onMarcarLegitima, onDesfazerLegitima, marcandoChave
    };

    return (
        <div className="p-6 md:p-8 bg-slate-50/50 dark:bg-slate-950/40 min-h-[50vh]">

            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-8 pb-6 border-b border-slate-200 dark:border-slate-800">
                <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
                        <AlertTriangle className="w-6 h-6 text-amber-500" />
                        Auditoria de possíveis duplicidades
                    </h3>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-2 max-w-2xl leading-relaxed">
                        Mesma <strong>unidade</strong>, mesmo <strong>dia</strong>, mesmo <strong>CPF</strong> e mesmo <strong>produto</strong>. Avalie cada caso: relançamento por engano ou venda legítima.
                    </p>
                    <p className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                        <Info className="w-3 h-3" /> Analisando os últimos 90 dias · vendas antigas sem CPF seguem a regra antiga (matrícula ou nome)
                    </p>
                </div>

                <div className="flex flex-col items-start lg:items-end gap-2">
                    {!verLegitimos && grupos.length > 0 && (
                        <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl px-4 py-2 text-right">
                            <p className="text-lg font-black text-rose-600 dark:text-rose-300 leading-none">{formatMoney(comissaoSuspeita)}</p>
                            <p className="text-[9px] font-black text-rose-500 dark:text-rose-300/80 uppercase tracking-widest mt-1">em comissão sob suspeita · {excedentes} {excedentes === 1 ? 'lançamento excedente' : 'lançamentos excedentes'}</p>
                        </div>
                    )}
                    <button onClick={() => setVerLegitimos(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-300 hover:border-blue-300 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
                        {verLegitimos ? <><AlertTriangle className="w-3 h-3" /> Voltar às possíveis duplicidades</> : <><ShieldCheck className="w-3 h-3" /> Ver grupos marcados como legítimos ({gruposLegitimos.length})</>}
                    </button>
                </div>
            </div>

            {lista.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center opacity-80">
                    <Check className="w-16 h-16 text-emerald-400 mb-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-full p-3 shadow-inner" />
                    <h4 className="text-lg font-black text-slate-700 dark:text-slate-200">{verLegitimos ? 'Nenhum grupo marcado' : 'Tudo limpo por aqui!'}</h4>
                    <p className="text-sm font-bold text-slate-400 mt-2">
                        {verLegitimos ? 'Nenhum grupo marcado como "Não é duplicidade" nos filtros selecionados.' : 'Nenhuma duplicidade encontrada para os filtros selecionados.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {lista.map(grupo => <CartaoGrupo key={grupo.chaveBase} grupo={grupo} {...propsCartao} />)}
                </div>
            )}
        </div>
    );
};

export default AbaDuplicidades;
