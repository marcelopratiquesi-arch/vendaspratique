import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../supabaseClient.js';
import { safeNumber, safeIsoDate, formatMoney, formatDataBR, formatarCPF, extrairHoraCriacao, toTitleCase, buildCatalogoMap, normalizeString, pedirMotivoExclusao, excluirVendaComMotivo } from './utils.js';
import { anexarUnidades } from '../Alunos/utils.js';
import { agruparDuplicidades } from './duplicidades/motorDuplicidades.js';
import AbaDuplicidades from './duplicidades/AbaDuplicidades.jsx';
import { carregarLegitimas, marcarComoLegitima, desfazerLegitima } from './duplicidades/legitimas.js';
import AbaLixeira from './lixeira/AbaLixeira.jsx';
import { History, ChevronUp, ChevronDown, ChevronsUpDown, User, Edit3, Trash2, Check, X, FilterX, Loader2, Copy } from 'lucide-react';
import { avisar } from '../../components/avisar.js';
import { tx } from '../../i18n/traduzir.js';

// ==========================================
// 🧠 COMPONENTE REUTILIZÁVEL: Botão de Cópia
// ==========================================
const CopyButton = ({ textToCopy, label }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!textToCopy) return;

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(String(textToCopy).trim());
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = String(textToCopy).trim();
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                textArea.style.top = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                textArea.remove();
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Falha ao copiar conteúdo', err);
        }
    };

    if (!textToCopy) return null;

    return (
        <button
            type="button"
            onClick={handleCopy}
            onMouseDown={(e) => e.stopPropagation()} 
            onPointerDown={(e) => e.stopPropagation()} 
            className="p-1 text-slate-300 hover:text-blue-500 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500/40 rounded transition-all flex-shrink-0 dark:hover:bg-blue-500/10"
            title={copied ? tx("Copiado!") : label}
            aria-label={copied ? tx("Copiado") : label}
        >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
        </button>
    );
};

// ==========================================
// 🧩 FORMATADOR SEGURO DE NOME CURTO
// ==========================================
const shortName = (name) => {
    if (!name || name === '-') return '-';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length <= 1) return name;
    const filtered = parts.filter(p => !['de', 'da', 'do', 'dos', 'das'].includes(p.toLowerCase()));
    if (filtered.length >= 2) return `${filtered[0]} ${filtered[1]}`;
    return name;
};

const TabelaHistorico = ({ data, setData, vendasFiltradas, temVisaoGlobal, podeEditar, catalogoGeral, usuarioLogado, colaboradores = [], onAbrirAluno, unidadeHistorico, lixeira = [], lixeiraErro = '', carregandoLixeira = false, onLixeiraMudou, descricaoPeriodo }) => {
    // Clique no nome do aluno: acha o cadastro pelo CPF da venda e abre a ficha
    const [abrindoAlunoId, setAbrindoAlunoId] = useState(null);
    const abrirFichaDoAluno = async (vendaId, cpf) => {
        if (!onAbrirAluno || abrindoAlunoId) return;
        const cpfLimpo = String(cpf || '').replace(/\D/g, '');
        if (cpfLimpo.length !== 11) return avisar(tx("Esta venda não tem um CPF completo. Não dá para abrir a ficha do aluno."));
        setAbrindoAlunoId(vendaId);
        try {
            const { data: achados, error } = await supabase.from('alunos').select('*')
                .or(`cpf.eq.${cpfLimpo},cpf.eq."${formatarCPF(cpfLimpo)}"`).limit(2);
            if (error) throw error;
            if (!achados || achados.length === 0) return avisar(tx("Aluno não encontrado no cadastro para este CPF."));
            if (achados.length > 1) return avisar(tx("Existe mais de um aluno com este CPF. Peça ao gestor para corrigir os cadastros."));
            const [comUnidade] = await anexarUnidades(achados);
            onAbrirAluno(comUnidade || achados[0]);
        } catch (err) {
            console.error('Erro ao abrir a ficha do aluno:', err);
            avisar(tx("Não foi possível abrir a ficha do aluno. Tente novamente."));
        } finally {
            setAbrindoAlunoId(null);
        }
    };

    const [ordenacao, setOrdenacao] = useState({ coluna: 'data', direcao: 'desc' });
    const [editandoId, setEditandoId] = useState(null);
    const [dadosEdicao, setDadosEdicao] = useState({});
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // ✅ ESTADOS DE NAVEGAÇÃO E PAGINAÇÃO
    const [visaoAtual, setVisaoAtual] = useState('registros'); // 'registros' | 'duplicidades' | 'lixeira'
    const [paginaAtual, setPaginaAtual] = useState(1);
    const [itensPorPagina, setItensPorPagina] = useState(50); 

    const scrollContainerRef = useRef(null);
    const isDragging = useRef(false);
    const startX = useRef(0);
    const scrollLeft = useRef(0);

    const mapCatalogo = useMemo(() => buildCatalogoMap(catalogoGeral), [catalogoGeral]);

    // Duplicidades: a regra fica no arquivo próprio (duplicidades/motorDuplicidades.js).
    // "Não é duplicidade" fica gravado no banco (duplicidades/legitimas.js) e esconde o grupo.
    const [legitimas, setLegitimas] = useState([]);
    const [marcandoChave, setMarcandoChave] = useState(null);
    useEffect(() => {
        let ativo = true;
        carregarLegitimas(supabase).then(lista => { if (ativo) setLegitimas(lista); });
        return () => { ativo = false; };
    }, []);
    const resultadoDuplicidades = useMemo(() => agruparDuplicidades(vendasFiltradas, legitimas), [vendasFiltradas, legitimas]);
    const gruposDuplicados = resultadoDuplicidades.grupos;

    // Lixeira: Admin e Mentor (papel verdadeiro, mesmo escolhendo uma unidade no topo) restauram
    const papelReal = String(usuarioLogado?.roleReal || usuarioLogado?.role || '').toUpperCase();
    const podeRestaurar = papelReal === 'ADMIN' || papelReal === 'MENTOR';
    // A lista da Lixeira vem pronta do index.jsx (mesmos filtros do Histórico); aqui só recarrega
    const recarregarLixeira = () => { if (onLixeiraMudou) onLixeiraMudou(); };

    // ==========================================
    // FUNÇÕES DA TABELA E MOUSE DRAG
    // ==========================================
    const handleMouseDown = (e) => {
        const targetTag = e.target.tagName;
        if (targetTag === 'INPUT' || targetTag === 'SELECT' || targetTag === 'BUTTON' || targetTag === 'TH' || e.target.closest('button') || e.target.closest('th')) {
            return;
        }
        isDragging.current = true;
        scrollContainerRef.current.style.userSelect = 'none'; 
        scrollContainerRef.current.classList.add('cursor-grabbing');
        scrollContainerRef.current.classList.remove('cursor-grab');
        startX.current = e.pageX - scrollContainerRef.current.offsetLeft;
        scrollLeft.current = scrollContainerRef.current.scrollLeft;
    };

    const handleMouseLeaveOrUp = () => {
        isDragging.current = false;
        if (scrollContainerRef.current) {
            scrollContainerRef.current.style.userSelect = 'auto';
            scrollContainerRef.current.classList.remove('cursor-grabbing');
            scrollContainerRef.current.classList.add('cursor-grab');
        }
    };

    const handleMouseMove = (e) => {
        if (!isDragging.current) return;
        e.preventDefault(); 
        const x = e.pageX - scrollContainerRef.current.offsetLeft;
        const walk = (x - startX.current) * 1.5; 
        scrollContainerRef.current.scrollLeft = scrollLeft.current - walk;
    };

    // ==========================================
    // AÇÕES DE DADOS (USADAS EM AMBAS AS ABAS)
    // ==========================================
    const removerLancamento = async (id) => {
        if(!podeEditar || isSubmitting) return;
        // Venda já conferida no Fechamento: confirmação a mais antes de pedir o motivo
        const venda = data.find(v => v.id === id);
        if (venda?.conferiu && !window.confirm(tx("ATENÇÃO: esta venda já foi CONFERIDA no Fechamento{v1}.\n\nExcluir mesmo assim? Ela sai das comissões e do Fechamento.", { v1: venda.conferido_por ? ` por ${venda.conferido_por}` : '' }))) return;
        // Pede o motivo (vale como confirmação) e manda para a lixeira pela função segura do banco
        const motivo = pedirMotivoExclusao();
        if (!motivo) return;
        setIsSubmitting(true);
        const backupDados = [...data];

        setData(data.filter(v => v.id !== id));

        const error = await excluirVendaComMotivo(supabase, id, motivo);

        if (error) {
            console.error("Erro ao excluir venda:", error);
            avisar(tx("Não foi possível excluir a venda. A ação foi revertida.\n\n{v1}", { v1: error.message || '' }));
            setData(backupDados);
        } else {
            recarregarLixeira();
        }
        setIsSubmitting(false);
    };

    const iniciarEdicao = (venda) => {
        if (isSubmitting) return;
        const valorNumericoBanco = safeNumber(venda.valor);
        const qtd = parseInt(venda.quantidade) || 1;
        let unitario = 0;
        
        const itemCatalogo = mapCatalogo.get(normalizeString(venda.produto));
        if (itemCatalogo) unitario = safeNumber(itemCatalogo.valor);
        else unitario = valorNumericoBanco / qtd;

        setEditandoId(venda.id);
        setDadosEdicao({
            data: safeIsoDate(venda.data || venda.created_at),
            matricula: venda.matricula || '',
            nome_aluno: venda.nome_aluno || venda.nome || '',
            cpf: venda.cpf || '', 
            produto: venda.produto || '',
            vendedor: venda.vendedor || '',
            unidade: venda.unidade || 'MATRIZ',
            quantidade: qtd,
            valorUnitario: unitario,
            valorCalculado: valorNumericoBanco,
            alunoStatus: '' // só a aba Duplicidades usa (troca de aluno pelo CPF)
        });
    };

    const handleEdicaoChange = (field, value) => {
        setDadosEdicao(atual => {
            let novosDados = { ...atual, [field]: value };
            if (field === 'produto') {
                const item = mapCatalogo.get(normalizeString(value));
                if (item) {
                    const novoUnitario = safeNumber(item.valor);
                    novosDados.valorUnitario = novoUnitario;
                    novosDados.valorCalculado = novoUnitario * novosDados.quantidade;
                }
            }
            if (field === 'quantidade') {
                const qtd = parseInt(value) || 1;
                novosDados.quantidade = qtd;
                novosDados.valorCalculado = novosDados.valorUnitario * qtd;
            }
            return novosDados;
        });
    };

    // Aba Duplicidades: o aluno achado pelo CPF preenche nome, CPF e matrícula de uma vez
    const aplicarAlunoNaEdicao = (campos) => setDadosEdicao(atual => ({ ...atual, ...campos }));

    const cancelarEdicao = () => {
        setEditandoId(null);
        setDadosEdicao({});
    };

    const salvarEdicao = async (vendaOriginal) => {
        if (isSubmitting) return;
        if (!dadosEdicao.data) return avisar(tx("Informe a data da venda."));
        if (['buscando', 'nao_encontrado', 'duplicado', 'incompleto', 'erro'].includes(dadosEdicao.alunoStatus || '')) {
            return avisar(tx("Não é possível salvar: confira o CPF do aluno. Ele precisa estar completo e cadastrado no sistema."));
        }
        setIsSubmitting(true);

        const valorPuro = safeNumber(dadosEdicao.valorCalculado);
        
        const payload = {
            data: dadosEdicao.data, 
            matricula: dadosEdicao.matricula,
            nome_aluno: dadosEdicao.nome_aluno.toUpperCase(),
            cpf: dadosEdicao.cpf ? dadosEdicao.cpf.replace(/\D/g, '') : null,
            produto: dadosEdicao.produto.toUpperCase(),
            vendedor: dadosEdicao.vendedor.toUpperCase(),
            quantidade: parseInt(dadosEdicao.quantidade) || 1,
            valor: valorPuro, 
            comissao: valorPuro 
        };

        const backupDados = [...data];
        
        setData(data.map(v => v.id === vendaOriginal.id ? { ...v, ...payload } : v));
        setEditandoId(null);

        let query = supabase.from('vendas').update(payload).eq('id', vendaOriginal.id);
        if (!temVisaoGlobal) {
            query = query.eq('unidade', usuarioLogado?.unidade);
        }

        const { error } = await query;
        
        if (error) {
            console.error("Erro ao editar venda:", error);
            avisar(tx("Falha de conexão com o servidor. As alterações não foram salvas."));
            setData(backupDados); 
            setEditandoId(vendaOriginal.id); 
        }
        setIsSubmitting(false);
    };

    const marcarLegitima = async (grupo) => {
        if (!podeEditar || marcandoChave) return;
        const ok = window.confirm(tx("Marcar como \"Não é duplicidade\"?\n\nOs {length} lançamentos deste grupo são vendas legítimas. O grupo sai da lista (volta se entrar um lançamento novo igual). Fica registrado quem decidiu e quando.", { length: grupo.linhas.length }));
        if (!ok) return;
        setMarcandoChave(grupo.chaveBase);
        const { marcacao, error } = await marcarComoLegitima(supabase, grupo, usuarioLogado);
        setMarcandoChave(null);
        if (error || !marcacao) {
            console.error('Erro ao marcar como legítima:', error);
            avisar(tx("Não foi possível salvar a marcação.\n\n{v1}", { v1: error?.message || '' }));
            return;
        }
        setLegitimas(atual => [marcacao, ...atual]);
    };

    const desfazerMarcacao = async (marcacao) => {
        if (!podeEditar || !marcacao) return;
        if (!window.confirm(tx("Desfazer a marcação \"Não é duplicidade\"? O grupo volta para a lista de possíveis duplicidades."))) return;
        const error = await desfazerLegitima(supabase, marcacao.id);
        if (error) {
            avisar(tx("Não foi possível desfazer.\n\n{v1}", { v1: error.message || '' }));
            return;
        }
        setLegitimas(atual => atual.filter(m => m.id !== marcacao.id));
    };

    const handleOrdenar = (colunaClicada) => {
        let novaDirecao = 'asc';
        if (ordenacao.coluna === colunaClicada && ordenacao.direcao === 'asc') novaDirecao = 'desc';
        setOrdenacao({ coluna: colunaClicada, direcao: novaDirecao });
    };

    const vendasOrdenadas = useMemo(() => {
        return [...vendasFiltradas].sort((a, b) => {
            let valorA, valorB;
            if (ordenacao.coluna === 'nome_aluno') {
                valorA = (a.nome_aluno || a.nome || '').toUpperCase();
                valorB = (b.nome_aluno || b.nome || '').toUpperCase();
            } else if (ordenacao.coluna === 'cpf') {
                valorA = String(a.cpf || '').replace(/\D/g, '');
                valorB = String(b.cpf || '').replace(/\D/g, '');
            } else if (ordenacao.coluna === 'data') {
                valorA = a.created_at ? new Date(a.created_at).getTime() : new Date(safeIsoDate(a.data)).getTime();
                valorB = b.created_at ? new Date(b.created_at).getTime() : new Date(safeIsoDate(b.data)).getTime();
            } else if (ordenacao.coluna === 'valor') {
                valorA = safeNumber(a.valor);
                valorB = safeNumber(b.valor);
            } else {
                valorA = String(a[ordenacao.coluna] || '').toUpperCase();
                valorB = String(b[ordenacao.coluna] || '').toUpperCase();
            }

            if (valorA < valorB) return ordenacao.direcao === 'asc' ? -1 : 1;
            if (valorA > valorB) return ordenacao.direcao === 'asc' ? 1 : -1;
            return 0;
        });
    }, [vendasFiltradas, ordenacao]);

    const totalPaginas = Math.ceil(vendasOrdenadas.length / itensPorPagina);
    const vendasPaginadas = vendasOrdenadas.slice((paginaAtual - 1) * itensPorPagina, paginaAtual * itensPorPagina);

    useEffect(() => {
        setPaginaAtual(1);
    }, [vendasFiltradas, itensPorPagina, visaoAtual]);

    const RenderSortIcon = ({ coluna }) => {
        if (ordenacao.coluna !== coluna) return <ChevronsUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-400" />;
        return ordenacao.direcao === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-500" /> : <ChevronDown className="w-3 h-3 text-blue-500" />;
    };
    
    const thClass = "px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 bg-slate-50/50 select-none group whitespace-nowrap align-top dark:border-slate-800 dark:bg-slate-800/40";

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col animate-[fadeIn_0.3s_ease-out]">

            {/* CABEÇALHO COM ABAS DE NAVEGAÇÃO */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 w-full sm:w-auto overflow-x-auto custom-scrollbar">
                    <button
                        onClick={() => setVisaoAtual('registros')}
                        className={`flex-1 sm:w-48 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${visaoAtual === 'registros' ? 'bg-white dark:bg-slate-900 shadow-sm text-blue-700 dark:text-blue-300' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white dark:text-slate-400'}`}
                    >
                        <History className="w-4 h-4" />{' '}{tx("Registros de Vendas")}
                    </button>
                    <button
                        onClick={() => setVisaoAtual('duplicidades')}
                        title={gruposDuplicados.length > 0
                            ? `${gruposDuplicados.length} ${gruposDuplicados.length === 1 ? 'grupo' : 'grupos'} · ${resultadoDuplicidades.excedentes} ${resultadoDuplicidades.excedentes === 1 ? 'lançamento excedente' : 'lançamentos excedentes'}`
                            : tx("Nenhuma possível duplicidade encontrada")}
                        className={`flex-1 sm:w-48 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${visaoAtual === 'duplicidades' ? 'bg-white dark:bg-slate-900 shadow-sm text-blue-700 dark:text-blue-300' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white dark:text-slate-400'}`}
                    >
                        <Copy className="w-4 h-4" />{' '}{tx("Duplicidades")}

                        {gruposDuplicados.length > 0 && (
                            <span className="ml-1 bg-amber-500 text-white px-2 py-0.5 rounded-md text-[10px] animate-pulse shadow-sm">
                                {gruposDuplicados.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setVisaoAtual('lixeira')}
                        title={lixeira.length > 0
                            ? tx("{length} {v2} no período", { length: lixeira.length, v2: lixeira.length === 1 ? 'venda excluída' : 'vendas excluídas' })
                            : tx("Nenhuma venda excluída no período")}
                        className={`flex-1 sm:w-40 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${visaoAtual === 'lixeira' ? 'bg-white dark:bg-slate-900 shadow-sm text-blue-700 dark:text-blue-300' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white dark:text-slate-400'}`}
                    >
                        <Trash2 className="w-4 h-4" />{' '}{tx("Lixeira")}

                        {lixeira.length > 0 && (
                            <span className="ml-1 bg-rose-600 dark:bg-rose-500 text-white px-2 py-0.5 rounded-md text-[10px] shadow-sm">
                                {lixeira.length}
                            </span>
                        )}
                    </button>
                </div>

                {visaoAtual === 'registros' && (
                    <div className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-slate-200 shadow-inner text-center sm:text-right w-full sm:w-auto dark:bg-slate-800 dark:text-slate-300 dark:border-slate-800">
                        {vendasOrdenadas.length}{' '}{tx("de")}{' '}{data.length}{' '}{tx("Encontrados")}
                    </div>
                )}
            </div>

            {/* CONTEÚDO: ABA REGISTROS DE VENDAS */}
            {visaoAtual === 'registros' && (
                <>
                    <div 
                        ref={scrollContainerRef}
                        onMouseDown={handleMouseDown}
                        onMouseLeave={handleMouseLeaveOrUp}
                        onMouseUp={handleMouseLeaveOrUp}
                        onMouseMove={handleMouseMove}
                        className="overflow-x-auto custom-scrollbar cursor-grab" 
                        style={{ maxHeight: '65vh' }}
                    >
                        <table className="w-full text-left border-collapse min-w-max">
                            <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 shadow-sm border-b border-slate-200 dark:bg-slate-800/40 dark:border-slate-800">
                                <tr>
                                    <th className={thClass}>
                                        <div className="flex flex-col gap-2">
                                            <div onClick={() => handleOrdenar('data')} className="flex items-center gap-1 cursor-pointer hover:text-blue-500 w-fit transition-colors">
                                                DATA {<RenderSortIcon coluna="data" />}
                                            </div>
                                            {temVisaoGlobal && (
                                                <div onClick={() => handleOrdenar('unidade')} className="flex items-center gap-1 cursor-pointer hover:text-rose-500 text-[10px] w-fit transition-colors">
                                                    {tx("UNIDADE")}{' '}{<RenderSortIcon coluna="unidade" />}
                                                </div>
                                            )}
                                        </div>
                                    </th>
                                    
                                    <th className={thClass}>
                                        <div className="flex flex-col gap-2">
                                            <div onClick={() => handleOrdenar('nome_aluno')} className="flex items-center gap-1 cursor-pointer hover:text-blue-500 w-fit transition-colors">
                                                {tx("ALUNO")}{' '}{<RenderSortIcon coluna="nome_aluno" />}
                                            </div>
                                            <div onClick={() => handleOrdenar('cpf')} className="flex items-center gap-1 cursor-pointer hover:text-blue-500 text-[10px] w-fit transition-colors">
                                                CPF {<RenderSortIcon coluna="cpf" />}
                                            </div>
                                        </div>
                                    </th>
                                    
                                    <th className={thClass}>
                                        <div className="flex flex-col gap-2">
                                            <div onClick={() => handleOrdenar('produto')} className="flex items-center gap-1 cursor-pointer hover:text-blue-500 w-fit transition-colors">
                                                {tx("ITEM VENDIDO (QTD)")}{' '}{<RenderSortIcon coluna="produto" />}
                                            </div>
                                        </div>
                                    </th>

                                    <th className={thClass}>
                                        <div className="flex flex-col gap-2">
                                            <div onClick={() => handleOrdenar('vendedor')} className="flex items-center gap-1 cursor-pointer hover:text-blue-500 w-fit transition-colors">
                                                {tx("VENDEDOR")}{' '}{<RenderSortIcon coluna="vendedor" />}
                                            </div>
                                        </div>
                                    </th>
                                    
                                    <th className={`${thClass} w-32`}>
                                        <div className="flex flex-col gap-2">
                                            <div onClick={() => handleOrdenar('valor')} className="flex items-center gap-1 cursor-pointer hover:text-blue-500 w-fit transition-colors">
                                                {tx("VALOR")}{' '}{<RenderSortIcon coluna="valor" />}
                                            </div>
                                        </div>
                                    </th>
                                    
                                    {podeEditar && <th className={`${thClass} sticky right-0 z-20 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] border-l border-slate-200 text-center w-28 dark:border-slate-800`}>{tx("Gestão")}</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                                {vendasPaginadas.map((row) => {
                                    const isEditing = editandoId === row.id;

                                    let vendedoresDaUnidade = [];
                                    if (isEditing) {
                                        vendedoresDaUnidade = colaboradores
                                            .filter(c => (c.unidade || 'MATRIZ').toUpperCase() === (row.unidade || 'MATRIZ').toUpperCase())
                                            .map(c => c.nome.toUpperCase());

                                        const vendedorAtualFormatado = (dadosEdicao.vendedor || '').toUpperCase();
                                        if (vendedorAtualFormatado && !vendedoresDaUnidade.includes(vendedorAtualFormatado)) {
                                            vendedoresDaUnidade.push(vendedorAtualFormatado);
                                        }
                                    }

                                    const rawCpf = row.cpf || row.cpf_aluno;
                                    const rawMatricula = row.matricula ? String(row.matricula).trim() : '';
                                    const rawName = row.nome_aluno || row.nome || '';
                                    
                                    const nomeExibicao = toTitleCase(rawName);
                                    const cpfExibicao = formatarCPF(rawCpf);

                                    return (
                                        <tr key={row.id} className={`group transition-colors ${isEditing ? 'bg-blue-50/30 dark:bg-blue-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}>
                                            
                                            {/* COLUNA 1: DATA E UNIDADE */}
                                            <td className="px-5 py-3 align-middle whitespace-nowrap">
                                                {isEditing ? (
                                                    <input type="date" value={dadosEdicao.data} onChange={e => handleEdicaoChange('data', e.target.value)} className="w-36 bg-white border border-blue-300 text-blue-800 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm shadow-sm dark:bg-slate-900 dark:border-blue-500/30 dark:text-blue-300" />
                                                ) : (
                                                    <div>
                                                        <p className="text-xs font-semibold text-slate-700 whitespace-nowrap dark:text-slate-200">{formatDataBR(row.data || row.created_at)}</p>
                                                        {row.created_at && (
                                                            <div className="flex items-center gap-1.5 mt-1 text-slate-500 w-max dark:text-slate-400">
                                                                <User className="w-3 h-3 text-slate-400" />
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                                    {toTitleCase(row.criado_por ? row.criado_por.split(' ')[0] : 'Sistema')} • {extrairHoraCriacao(row.created_at)}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {temVisaoGlobal && (
                                                            <div className="text-[10px] font-black text-rose-500 uppercase mt-2">
                                                                {row.unidade || tx("MATRIZ")}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            
                                            {/* COLUNA 2: ALUNO E CPF */}
                                            <td className="px-5 py-3 align-middle no-drag">
                                                {isEditing ? (
                                                    <div className="flex flex-col gap-2">
                                                        <input type="text" placeholder={tx("Nome do Aluno")} value={dadosEdicao.nome_aluno} onChange={e => handleEdicaoChange('nome_aluno', e.target.value)} className="w-full bg-white border border-blue-300 text-blue-800 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-bold uppercase text-sm shadow-sm dark:bg-slate-900 dark:border-blue-500/30 dark:text-blue-300" />
                                                        <input type="text" placeholder={tx("CPF (Apenas números)")} value={dadosEdicao.cpf} onChange={e => handleEdicaoChange('cpf', e.target.value)} maxLength="14" className="w-36 bg-white border border-blue-300 text-blue-800 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm shadow-sm dark:bg-slate-900 dark:border-blue-500/30 dark:text-blue-300" />
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5">
                                                            {onAbrirAluno && rawCpf ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => abrirFichaDoAluno(row.id, rawCpf)}
                                                                    disabled={Boolean(abrindoAlunoId)}
                                                                    className="text-xs font-black text-slate-800 max-w-[200px] truncate uppercase text-left hover:text-blue-600 hover:underline underline-offset-2 transition-colors cursor-pointer disabled:cursor-wait dark:text-white dark:hover:text-blue-400"
                                                                    title={tx("Abrir a ficha de {rawName}", { rawName: rawName })}
                                                                >
                                                                    {nomeExibicao}
                                                                </button>
                                                            ) : (
                                                                <p className="text-xs font-black text-slate-800 max-w-[200px] truncate uppercase dark:text-white" title={rawName}>
                                                                    {nomeExibicao}
                                                                </p>
                                                            )}
                                                            {abrindoAlunoId === row.id && <Loader2 className="w-3 h-3 text-blue-500 animate-spin shrink-0" />}
                                                            {rawName && <CopyButton textToCopy={nomeExibicao} label={tx("Copiar nome do aluno")} />}
                                                        </div>

                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
                                                                    {cpfExibicao}
                                                                </span>
                                                                {rawCpf && <CopyButton textToCopy={cpfExibicao} label={tx("Copiar CPF do aluno")} />}
                                                            </div>

                                                        </div>
                                                    </div>
                                                )}
                                            </td>

                                            {/* COLUNA 3: ITEM VENDIDO */}
                                            <td className="px-5 py-3 align-middle whitespace-nowrap">
                                                {isEditing ? (
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex gap-2">
                                                            <input type="number" min="1" value={dadosEdicao.quantidade} onChange={e => handleEdicaoChange('quantidade', e.target.value)} className="w-16 text-center bg-white border border-blue-300 text-blue-800 rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm shadow-sm dark:bg-slate-900 dark:border-blue-500/30 dark:text-blue-300" />
                                                            <select value={dadosEdicao.produto} onChange={e => handleEdicaoChange('produto', e.target.value)} className="w-full min-w-[180px] bg-white border border-blue-300 text-blue-800 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-bold uppercase cursor-pointer text-sm shadow-sm dark:bg-slate-900 dark:border-blue-500/30 dark:text-blue-300">
                                                                <option value="" disabled>{tx("Selecione...")}</option>
                                                                {catalogoGeral.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                                                            </select>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-xs font-bold text-blue-600 uppercase flex items-center gap-1.5 dark:text-blue-400">
                                                        <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-[10px] dark:bg-blue-500/20 dark:text-blue-300">{row.quantidade || '1'}x</span>
                                                        {row.produto}
                                                    </div>
                                                )}
                                            </td>

                                            {/* COLUNA 4: VENDEDOR */}
                                            <td className="px-5 py-3 align-middle whitespace-nowrap">
                                                {isEditing ? (
                                                    <select 
                                                        value={(dadosEdicao.vendedor || '').toUpperCase()} 
                                                        onChange={e => handleEdicaoChange('vendedor', e.target.value)} 
                                                        className="w-full min-w-[150px] bg-white border border-blue-300 text-blue-800 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-bold uppercase cursor-pointer text-sm shadow-sm dark:bg-slate-900 dark:border-blue-500/30 dark:text-blue-300"
                                                    >
                                                        <option value="" disabled>{tx("Selecione o Vendedor...")}</option>
                                                        {vendedoresDaUnidade.sort().map(v => (
                                                            <option key={v} value={v}>{toTitleCase(v)}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 bg-slate-100 w-fit px-2 py-1 rounded-md border border-slate-200 dark:bg-slate-800 dark:border-slate-800" title={row.vendedor}>
                                                        <User className="w-3 h-3 text-slate-400" />
                                                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest dark:text-slate-300">{shortName(row.vendedor)}</span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* COLUNA 5: VALOR */}
                                            <td className="px-5 py-3 align-middle no-drag whitespace-nowrap">
                                                {isEditing ? (
                                                    <input type="text" value={formatMoney(dadosEdicao.valorCalculado)} readOnly className="w-28 text-left bg-slate-100 border border-slate-300 text-slate-500 rounded-lg px-3 py-2 cursor-not-allowed font-black text-sm shadow-inner dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400" title={tx("O valor calcula sozinho")} />
                                                ) : (
                                                    <div className="text-sm font-black text-slate-800 dark:text-white">
                                                        {formatMoney(row.valor)}
                                                    </div>
                                                )}
                                            </td>

                                            {/* COLUNA 6: GESTÃO */}
                                            {podeEditar && (
                                                <td className={`px-5 py-3 align-middle no-drag border-l border-slate-100 sticky right-0 z-10 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] bg-white dark:border-slate-800 dark:bg-slate-900`}>
                                                    {isEditing ? (
                                                        <div className="flex flex-col gap-2 items-center justify-center">
                                                            <button disabled={isSubmitting} onClick={() => salvarEdicao(row)} title={tx("Salvar Alterações")} className="flex items-center justify-center gap-1.5 w-full px-3 py-2 bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-md">
                                                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{' '}{tx("Salvar")}
                                                            </button>
                                                            <button disabled={isSubmitting} onClick={cancelarEdicao} title={tx("Cancelar")} className="flex items-center justify-center gap-1.5 w-full px-3 py-2 bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-50 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-sm dark:bg-slate-700 dark:text-slate-200">
                                                                <X className="w-4 h-4" />{' '}{tx("Cancelar")}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col gap-1.5">
                                                            <button 
                                                                onClick={() => iniciarEdicao(row)} 
                                                                title={tx("Editar Registro")}
                                                                className="flex items-center justify-center gap-1 w-full py-1 bg-white hover:bg-blue-50 text-blue-600 rounded transition-all border border-blue-200 hover:border-blue-400 text-[10px] font-black uppercase tracking-widest shadow-sm dark:bg-slate-900 dark:hover:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30"
                                                            >
                                                                <Edit3 className="w-3 h-3" />{' '}{tx("Editar")}
                                                            </button>
                                                            <button 
                                                                onClick={() => removerLancamento(row.id)} 
                                                                title={tx("Excluir Registro")}
                                                                className="flex items-center justify-center gap-1 w-full py-1 bg-white hover:bg-rose-50 text-rose-500 rounded transition-all border border-rose-200 hover:border-rose-400 text-[10px] font-black uppercase tracking-widest shadow-sm dark:bg-slate-900 dark:hover:bg-rose-500/10 dark:border-rose-500/30"
                                                            >
                                                                <Trash2 className="w-3 h-3" />{' '}{tx("Apagar")}
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                                {vendasOrdenadas.length === 0 && (
                                    <tr>
                                        <td colSpan="100%" className="px-5 py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                                            <FilterX className="w-12 h-12 mx-auto text-slate-300 mb-4 opacity-60" />
                                            {tx("Nenhuma venda encontrada para estes filtros.")}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* PAGINAÇÃO PADRÃO */}
                    <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 dark:bg-slate-800/60 dark:border-slate-800">
                        <div className="flex items-center gap-4">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest dark:text-slate-400">
                                {tx("Página")}{' '}{paginaAtual}{' '}{tx("de")}{' '}{totalPaginas || 1}
                            </p>
                            <div className="h-4 w-px bg-slate-300 hidden sm:block"></div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tx("Exibir:")}</span>
                                <select 
                                    value={itensPorPagina} 
                                    onChange={(e) => setItensPorPagina(Number(e.target.value))}
                                    className="bg-white border border-slate-200 text-slate-700 rounded-lg px-2 py-1 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200"
                                >
                                    <option value={10}>{tx("10 linhas")}</option>
                                    <option value={50}>{tx("50 linhas")}</option>
                                    <option value={100}>{tx("100 linhas")}</option>
                                    <option value={500}>{tx("500 linhas")}</option>
                                    <option value={1000}>{tx("1000 linhas")}</option>
                                </select>
                            </div>
                        </div>

                        {totalPaginas > 1 && (
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button 
                                    onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                                    disabled={paginaAtual === 1}
                                    className="flex-1 sm:flex-none px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-black uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors shadow-sm dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    {tx("Anterior")}
                                </button>
                                <button 
                                    onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                                    disabled={paginaAtual === totalPaginas}
                                    className="flex-1 sm:flex-none px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-black uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors shadow-sm dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    {tx("Próxima")}
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* CONTEÚDO: ABA CENTRAL DE DUPLICIDADES (arquivo próprio: duplicidades/AbaDuplicidades.jsx) */}
            {visaoAtual === 'duplicidades' && (
                <AbaDuplicidades
                    resultado={resultadoDuplicidades} mapCatalogo={mapCatalogo} temVisaoGlobal={temVisaoGlobal}
                    podeEditar={podeEditar} colaboradores={colaboradores} catalogoGeral={catalogoGeral}
                    editandoId={editandoId} dadosEdicao={dadosEdicao} isSubmitting={isSubmitting}
                    onEditar={iniciarEdicao} onAlterarCampo={handleEdicaoChange} onAplicarAluno={aplicarAlunoNaEdicao}
                    onSalvar={salvarEdicao} onCancelar={cancelarEdicao} onExcluir={removerLancamento}
                    onMarcarLegitima={marcarLegitima} onDesfazerLegitima={desfazerMarcacao} marcandoChave={marcandoChave}
                />
            )}

            {/* CONTEÚDO: ABA LIXEIRA (arquivo próprio: lixeira/AbaLixeira.jsx) */}
            {visaoAtual === 'lixeira' && (
                <AbaLixeira
                    linhas={lixeira} erro={lixeiraErro} carregando={carregandoLixeira}
                    unidade={unidadeHistorico} temVisaoGlobal={temVisaoGlobal} descricaoPeriodo={descricaoPeriodo}
                    podeRestaurar={podeRestaurar} onRestaurada={recarregarLixeira}
                />
            )}

        </div>
    );
};

export default TabelaHistorico;