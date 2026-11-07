import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient.js';
import { Search, Users, FileText, X, Loader2, Save, UserRoundPen, ShieldAlert, ClipboardPaste, Info, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { parseSmartPaste, mascaraCPF, formatarTelefone } from './utilsAlunos.js';
import { SITUACAO, SITUACOES_COM_CONFIRMACAO, SITUACOES_ERRO, auditarImportacao, aplicarImportacao, linhaVaiGravar, unidadesDaPlanilha, lembrarUnidades, statusEhAtivo } from './importacaoAlunos.js';
import ModalAluno from '../../components/Modals/ModalAluno.jsx';
import { avisar } from '../../components/avisar.js';
import { tx } from '../../i18n/traduzir.js';

const AlunosTab = (props) => {
    const { usuarioLogado, usuarioVirtual, unidades } = props;
    const { t, locale, language } = useI18n();
    const langAtual = locale || language || 'pt-BR';

    // ==========================================
    // 1. A FONTE ÚNICA DE VERDADE (SSOT)
    // ==========================================
    const propUnidade = props.unidadeAtiva || props.unidadeSelecionada || props.unidade || '';
    const storageUnidade = localStorage.getItem('unidadeAtiva') || localStorage.getItem('unidadeSelecionada') || localStorage.getItem('unidade') || '';
    
    const unidadeRaw = usuarioVirtual?.unidade || propUnidade || usuarioLogado?.unidade || storageUnidade || '';
    const unidadeAtiva = unidadeRaw.toUpperCase().trim();

    // ==========================================
    // 2. REGRAS DE PERMISSÃO
    // ==========================================
    const roleBaseApp = (usuarioVirtual?.role || usuarioLogado?.role || '').toUpperCase().trim();
    const temPermissaoGlobal = roleBaseApp === 'ADMIN' || roleBaseApp === 'MENTOR';
    
    const isVisaoGlobal = temPermissaoGlobal && (!unidadeAtiva || unidadeAtiva === 'TODAS' || unidadeAtiva.includes('GLOBAL'));
    const erroUnidadePerdida = !temPermissaoGlobal && !unidadeAtiva;

    const [alunos, setAlunos] = useState([]);
    const [totalItems, setTotalItems] = useState(0);
    const [loading, setLoading] = useState(true);
    const [pagina, setPagina] = useState(1);
    const ITENS_POR_PAGINA = 15;

    const [busca, setBusca] = useState('');
    const [termoBusca, setTermoBusca] = useState('');

    const [modalPasteOpen, setModalPasteOpen] = useState(false);
    const [rawText, setRawText] = useState('');
    const [previewData, setPreviewData] = useState([]);
    const [analisando, setAnalisando] = useState(false);
    const [importando, setImportando] = useState(false);
    
    // 🔥 NOVO: Controle de progresso real da importação
    const [progresso, setProgresso] = useState(0);
    const [filtroDashboard, setFiltroDashboard] = useState('TODOS');
    // Etapas da janela: colar → unidades (só se alguma unidade da planilha não foi reconhecida) → previa → resultado
    const [etapa, setEtapa] = useState('colar');
    const [parsedBase, setParsedBase] = useState([]);
    const [mapaUnidades, setMapaUnidades] = useState([]);
    const [camposNovos, setCamposNovos] = useState(true);
    const [resultado, setResultado] = useState(null);

    const [modalAlunoAberto, setModalAlunoAberto] = useState(false);
    const [alunoEditando, setAlunoEditando] = useState(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            setTermoBusca(busca);
            setPagina(1); 
        }, 500); 
        return () => clearTimeout(timer);
    }, [busca]);

    // ==========================================
    // 3. BUSCA BLINDADA
    // ==========================================
    const carregarAlunos = async () => {
        if (erroUnidadePerdida) {
            setLoading(false); return;
        }

        setLoading(true);
        try {
            const uniAcento = unidadeAtiva.replace('INES', 'INÊS');
            const uniSemAcento = unidadeAtiva.replace('INÊS', 'INES');

            let query = supabase.from('alunos');

            if (isVisaoGlobal) {
                query = query.select(`*, alunos_unidades(unidade, matricula, status)`, { count: 'exact' });
            } else {
                query = query.select(`*, alunos_unidades!inner(unidade, matricula, status)`, { count: 'exact' })
                             .in('alunos_unidades.unidade', [unidadeAtiva, uniAcento, uniSemAcento]);
            }

            if (termoBusca) {
                const bNumeros = termoBusca.replace(/\D/g, '');
                if (bNumeros) {
                    query = query.or(`nome.ilike.%${termoBusca}%,cpf.ilike.%${bNumeros}%`);
                } else {
                    query = query.ilike('nome', `%${termoBusca}%`);
                }
            }

            query = query.order('created_at', { ascending: false });

            const from = (pagina - 1) * ITENS_POR_PAGINA;
            const to = from + ITENS_POR_PAGINA - 1;
            query = query.range(from, to);

            const { data, count, error } = await query;
            
            if (error) throw error;

            const alunosPlanificados = (data || []).map(item => {
                const vinculoArray = item.alunos_unidades || [];
                let vinculoLocal = vinculoArray[0] || {};
                
                if (!isVisaoGlobal) {
                    vinculoLocal = vinculoArray.find(v => {
                        const uni = v.unidade?.toUpperCase().trim() || '';
                        return uni === unidadeAtiva || uni === uniAcento || uni === uniSemAcento;
                    }) || vinculoArray[0] || {};
                }

                return {
                    ...item,
                    matricula: vinculoLocal.matricula || '',
                    unidade_vinculo: vinculoLocal.unidade || '',
                    status_unidade: vinculoLocal.status || 'ATIVO',
                    total_vinculos: vinculoArray.length
                };
            });

            setAlunos(alunosPlanificados);
            setTotalItems(count || 0);
        } catch (error) {
            console.error("Erro ao buscar alunos:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarAlunos();
    }, [pagina, termoBusca, unidadeAtiva, isVisaoGlobal, erroUnidadePerdida]);

    const handleSaveAlunoSuccess = () => { carregarAlunos(); };

    // ==========================================
    // 4. SMART PASTE (decisões do dono, 06/11/2026 — regras em importacaoAlunos.js)
    // Cada linha vai para a unidade da coluna "Unidade" da planilha (sem ela, a unidade do topo).
    // ==========================================
    const nomesUnidadesSistema = useMemo(() => (unidades || []).map(u => u?.nome).filter(Boolean), [unidades]);
    // Onde a pessoa pode importar: Admin/Mentor = as unidades dela (Mentor: só as dele); Líder = a dele
    const unidadesPermitidas = useMemo(() => {
        const papel = String(usuarioLogado?.roleReal || roleBaseApp).toUpperCase();
        if (papel === 'ADMIN' || papel === 'MENTOR') return nomesUnidadesSistema;
        return [usuarioLogado?.unidade].filter(u => u && String(u).toUpperCase() !== 'TODAS');
    }, [usuarioLogado?.roleReal, usuarioLogado?.unidade, roleBaseApp, nomesUnidadesSistema]);

    const rodarAuditoria = async (base, lista) => {
        setAnalisando(true);
        try {
            const destinoPorChave = Object.fromEntries(lista.filter(u => u.destino).map(u => [u.chave, u.destino]));
            lembrarUnidades(lista.filter(u => !u.automatico));
            const { linhas, camposNovos: temCampos } = await auditarImportacao({
                parsed: base.map(p => ({ ...p })),
                destinoPorChave,
                unidadeTopo: isVisaoGlobal ? '' : unidadeAtiva,
                unidadesPermitidas,
            });
            setCamposNovos(temCampos);
            setPreviewData(linhas);
            setFiltroDashboard('TODOS');
            setEtapa('previa');
        } catch (err) {
            console.error(err);
            avisar(tx("Erro ao analisar os dados cruzados com a nuvem.{v1}", { v1: err?.message ? `\n\n${err.message}` : '' }));
        } finally {
            setAnalisando(false);
        }
    };

    const analisarDados = async () => {
        if (!rawText.trim()) return;
        const parsed = parseSmartPaste(rawText);
        if (parsed.length === 0) return avisar(tx("Nenhuma linha reconhecida na planilha colada."), 'atencao');
        const lista = unidadesDaPlanilha(parsed, nomesUnidadesSistema);
        setParsedBase(parsed);
        setMapaUnidades(lista);
        // Unidade da planilha que o sistema não reconheceu: pergunta antes de auditar
        if (lista.some(u => !u.destino)) { setEtapa('unidades'); return; }
        await rodarAuditoria(parsed, lista);
    };

    const escolherDestino = (chave, destino) => {
        setMapaUnidades(lista => lista.map(u => u.chave === chave ? { ...u, destino, automatico: false } : u));
    };

    const handleForcarTroca = (indexOriginal) => {
        const newData = [...previewData];
        newData[indexOriginal] = { ...newData[indexOriginal], forcarTroca: !newData[indexOriginal].forcarTroca };
        setPreviewData(newData);
    };

    const confirmarTodasTransferencias = () => {
        setPreviewData(lista => lista.map(p => p.status === SITUACAO.CONFIRMAR_TRANSFERENCIA ? { ...p, forcarTroca: true } : p));
    };

    const importarAlunosValidos = async () => {
        if (!previewData.some(p => linhaVaiGravar(p, camposNovos))) return;
        setImportando(true);
        setProgresso(0);
        try {
            const { total, falhas } = await aplicarImportacao({ linhas: previewData, camposNovos, onProgresso: setProgresso });
            carregarAlunos();
            if (falhas.length > 0) {
                console.warn('Importação: linhas não gravadas', falhas);
                setResultado({ total, falhas });
                setEtapa('resultado');
                avisar(tx("{ok} de {total} linhas gravadas. {qtd} não foram gravadas: veja a lista.", { ok: total - falhas.length, total, qtd: falhas.length }), 'atencao');
            } else {
                avisar(tx("Importação concluída: {total} linhas gravadas.", { total }), 'sucesso');
                handleCloseModal();
            }
        } catch (error) {
            console.error("Erro na importação:", error);
            avisar(tx("Erro crítico ao gravar os dados. Verifique a conexão com a internet.{v1}", { v1: error?.message ? `\n\n${error.message}` : '' }));
        } finally {
            setImportando(false);
            setProgresso(0);
        }
    };

    const totalPaginas = Math.ceil(totalItems / ITENS_POR_PAGINA);

    const contar = (...situacoes) => previewData.filter(p => situacoes.includes(p.status)).length;
    const origensTransferidos = Object.entries(previewData.filter(p => p.origem && (p.status === SITUACAO.TRANSFERIR || p.status === SITUACAO.CONFIRMAR_TRANSFERENCIA))
        .reduce((acc, p) => { acc[p.origem] = (acc[p.origem] || 0) + 1; return acc; }, {}))
        .sort((a, b) => b[1] - a[1]);
    const totalParaImportar = previewData.filter(p => linhaVaiGravar(p, camposNovos)).length;
    const qtdConfirmarTransferencia = previewData.filter(p => p.status === SITUACAO.CONFIRMAR_TRANSFERENCIA && !p.forcarTroca).length;
    const destinosDaPrevia = useMemo(() => {
        const mapa = {};
        previewData.forEach(p => { if (p.destino) mapa[p.destino] = (mapa[p.destino] || 0) + 1; });
        return Object.entries(mapa).sort((a, b) => b[1] - a[1]);
    }, [previewData]);

    // Filtros da prévia (cada um é um botão da faixa de resumo)
    const FILTROS_PREVIA = [
        { id: 'NOVOS', rotulo: tx("Novos alunos"), situacoes: [SITUACAO.NOVO_ALUNO], cor: 'emerald' },
        { id: 'VINCULOS', rotulo: tx("Novos vínculos"), situacoes: [SITUACAO.NOVO_VINCULO], cor: 'blue', dica: tx("Já cadastrados, sem unidade") },
        { id: 'TRANSFERIR', rotulo: tx("Transferidos"), situacoes: [SITUACAO.TRANSFERIR], cor: 'blue', dica: tx("Ativos na planilha e não ativos na unidade antiga") },
        { id: 'ATUALIZACOES', rotulo: tx("Matrículas novas"), situacoes: [SITUACAO.ATUALIZAR_MATRICULA], cor: 'amber' },
        { id: 'JA', rotulo: tx("Só atualizar dados"), situacoes: [SITUACAO.JA_NESTA_UNIDADE], cor: 'slate', dica: tx("Já estão na unidade: atualiza só status, sexo e data de cadastro") },
        { id: 'CONFLITOS', rotulo: tx("Ação necessária"), situacoes: SITUACOES_COM_CONFIRMACAO, cor: 'rose', dica: tx("Só entram depois de confirmar na linha") },
        { id: 'OUTRA', rotulo: tx("Aluno de outra unidade"), situacoes: [SITUACAO.OUTRA_UNIDADE], cor: 'rose', dica: tx("Não ativo na planilha e já ligado a outra unidade: não importa. Verificar.") },
        { id: 'ERROS', rotulo: tx("Erros e dados repetidos"), situacoes: SITUACOES_ERRO, cor: 'slate' },
    ];

    const dadosExibicao = useMemo(() => {
        const filtro = FILTROS_PREVIA.find(f => f.id === filtroDashboard);
        return filtro ? previewData.filter(p => filtro.situacoes.includes(p.status)) : previewData;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [previewData, filtroDashboard]);

    const handleCloseModal = () => {
        setModalPasteOpen(false);
        setPreviewData([]);
        setParsedBase([]);
        setMapaUnidades([]);
        setResultado(null);
        setEtapa('colar');
        setRawText('');
        setFiltroDashboard('TODOS');
        setProgresso(0);
    };

    const corDoStatus = (s) => {
        if (!s) return 'text-slate-400';
        if (statusEhAtivo(s)) return 'text-emerald-600 dark:text-emerald-400';
        return 'text-amber-600 dark:text-amber-400';
    };
    const dataBR = (iso) => iso ? iso.split('-').reverse().join('/') : '—';


    if (erroUnidadePerdida) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] bg-rose-50 border-2 border-dashed border-rose-200 rounded-[32px] p-8 text-center animate-[fadeIn_0.3s_ease-out] dark:bg-rose-500/10 dark:border-rose-500/30">
                <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-6 shadow-inner dark:bg-rose-500/20 dark:text-rose-400"><ShieldAlert className="w-10 h-10" /></div>
                <h2 className="text-2xl font-black text-rose-800 uppercase tracking-tight dark:text-rose-300">{tx("FALHA DE AUTORIZAÇÃO")}</h2>
                <p className="text-sm font-bold text-rose-600 mt-2 max-w-md dark:text-rose-400">{tx("Não foi possível identificar a sua unidade de trabalho ativa. Por motivos de segurança, o acesso ao banco de alunos foi bloqueado.")}</p>
                <button onClick={() => window.location.reload()} className="mt-8 px-6 py-3 bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md hover:bg-rose-700 transition-colors">{tx("Recarregar Sistema")}</button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
            
            <ModalAluno 
                isOpen={modalAlunoAberto} 
                onClose={() => setModalAlunoAberto(false)} 
                alunoInicial={alunoEditando} 
                onSaveSuccess={handleSaveAlunoSuccess}
                usuarioLogado={usuarioLogado}
                unidadeDestino={isVisaoGlobal ? '' : unidadeAtiva} 
            />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-inner dark:bg-blue-500/10 dark:text-blue-400">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight dark:text-white">{t('students.title', {defaultValue: 'Banco de Alunos'})}</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {tx("UNIDADE ATUAL:")}{' '}<span className="text-blue-600 dark:text-blue-400">{isVisaoGlobal ? tx("VISÃO GLOBAL") : unidadeAtiva}</span>
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex w-full sm:w-auto gap-3">
                    <button 
                        onClick={() => setModalPasteOpen(true)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors border border-emerald-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30"
                    >
                        <ClipboardPaste className="w-4 h-4" />{' '}{tx("Smart Paste (Colar Dados)")}
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px] dark:bg-slate-900 dark:border-slate-800">
                <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-4 bg-slate-50 shrink-0 dark:border-slate-800 dark:bg-slate-800/60">
                    <div className="relative w-full sm:w-96">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t('students.search', {defaultValue: 'Buscar por Nome ou CPF...'})} className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200" />
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest self-end sm:self-center">
                        {totalItems} {isVisaoGlobal ? tx("ALUNOS NA REDE") : tx("ALUNOS REGISTRADOS EM {unidadeAtiva}", { unidadeAtiva: unidadeAtiva })}
                    </div>
                </div>
                
                <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative">
                    {loading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10 dark:bg-slate-900/50">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead className="bg-white sticky top-0 z-10 shadow-sm dark:bg-slate-900">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">{t('students.table.name')}</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">{t('students.table.cpf')}</th>
                                    {isVisaoGlobal && <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-center dark:border-slate-800">{tx("VÍNCULOS")}</th>}
                                    {!isVisaoGlobal && <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">{t('students.table.enrollment')}</th>}
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">{t('students.table.contact')}</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">{t('students.table.created')}</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-center dark:border-slate-800">{t('students.table.actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                                {alunos.length > 0 ? (
                                    alunos.map(a => (
                                        <tr key={a.id} className="hover:bg-slate-50/50 transition-colors dark:hover:bg-slate-800/40">
                                            <td className="px-6 py-4">
                                                <span className="text-sm font-black text-slate-800 uppercase dark:text-white">{a.nome}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-bold text-slate-600 tracking-widest dark:text-slate-300">{a.cpf ? mascaraCPF(a.cpf) : '—'}</span>
                                            </td>
                                            
                                            {isVisaoGlobal && (
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md border ${a.total_vinculos > 1 ? 'text-purple-700 bg-purple-100 border-purple-200 dark:text-purple-400 dark:bg-purple-500/20 dark:border-purple-500/30' : a.total_vinculos === 1 ? 'text-blue-700 bg-blue-100 border-blue-200 dark:text-blue-400 dark:bg-blue-500/20 dark:border-blue-500/30' : 'text-slate-500 bg-slate-100 border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-800'}`}>
                                                        {a.total_vinculos === 0 ? tx("SEM VÍNCULO") : a.total_vinculos > 1 ? tx("MULTIPLO") : a.unidade_vinculo}
                                                    </span>
                                                </td>
                                            )}

                                            {!isVisaoGlobal && (
                                                <td className="px-6 py-4">
                                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{a.matricula || '—'}</span>
                                                </td>
                                            )}

                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{a.telefone ? formatarTelefone(a.telefone) : '—'}</span>
                                                    <span className="text-[10px] font-semibold text-slate-400 truncate max-w-[200px]" title={a.email}>{a.email || '—'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{a.created_at ? new Date(a.created_at).toLocaleDateString(langAtual) : '—'}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button onClick={() => { setAlunoEditando(a); setModalAlunoAberto(true); }} className="p-2 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-lg transition-colors dark:bg-slate-800/60 dark:hover:text-blue-400 dark:hover:bg-blue-500/10 dark:border-slate-800 dark:hover:border-blue-500/30">
                                                    <UserRoundPen className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={isVisaoGlobal ? "7" : "6"} className="text-center py-20">
                                            <div className="flex flex-col items-center justify-center">
                                                <Users className="w-12 h-12 text-slate-200 mb-3" />
                                                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] dark:text-slate-400">
                                                    {tx("NENHUM ALUNO CADASTRADO PARA A UNIDADE:")}{' '}<span className="text-blue-600 dark:text-blue-400">{unidadeAtiva}</span>
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
                
                {totalPaginas > 1 && (
                    <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0 dark:border-slate-800 dark:bg-slate-800/60">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('students.pagination.page')} {pagina} {t('students.pagination.of')} {totalPaginas}</span>
                        <div className="flex gap-2">
                            <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1} className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 disabled:opacity-50 hover:bg-slate-100 text-[10px] font-black uppercase tracking-widest transition-colors dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800">{t('students.pagination.prev')}</button>
                            <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas} className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 disabled:opacity-50 hover:bg-slate-100 text-[10px] font-black uppercase tracking-widest transition-colors dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800">{t('students.pagination.next')}</button>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL SMART PASTE: colar → (ligar unidades) → prévia → (resultado) */}
            {modalPasteOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 sm:p-8 animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-slate-50 rounded-[32px] shadow-2xl w-full max-w-7xl flex flex-col h-full max-h-[90vh] overflow-hidden border border-slate-200 dark:bg-slate-900 dark:border-slate-800">

                        <div className="p-5 border-b border-slate-200 bg-white flex justify-between items-center shrink-0 dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl shadow-inner dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400"><ClipboardPaste className="w-6 h-6" /></div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 tracking-tight dark:text-white">{tx("Smart Paste: Importação de alunos")}</h3>
                                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1 flex flex-wrap items-center gap-1.5 dark:text-slate-400">
                                        {tx("Destino:")}{' '}
                                        {destinosDaPrevia.length > 0 ? destinosDaPrevia.map(([d, q]) => (
                                            <span key={d} className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded dark:text-emerald-400 dark:bg-emerald-500/10">{d} · {q}</span>
                                        )) : (
                                            <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded dark:text-emerald-400 dark:bg-emerald-500/10">{tx("unidade da coluna \"Unidade\" de cada linha")}</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                            <button onClick={handleCloseModal} className="p-2 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 rounded-full transition-colors shadow-sm dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-rose-500/10 dark:hover:border-rose-500/30"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto flex flex-col">
                            {etapa === 'colar' && (
                                <div className="p-8 flex flex-col h-full max-w-4xl mx-auto w-full">
                                    <div className="bg-blue-50 border border-blue-200 p-5 rounded-2xl text-blue-800 text-sm font-semibold mb-6 flex gap-4 items-start dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-300">
                                        <Info className="w-6 h-6 text-blue-500 shrink-0" />
                                        <div className="space-y-1">
                                            <span className="font-black tracking-tight block mb-1 text-base">{tx("Como copiar e colar?")}</span>
                                            <p>{tx("Exporte a lista de alunos, copie as linhas do Excel (com o cabeçalho) e cole na caixa abaixo.")}</p>
                                            <p>{tx("Colunas lidas: Matrícula, Nome, Email, Telefone, Status, Documento (CPF), Data de Cadastro, Unidade e Sexo.")}</p>
                                            <p>{tx("Cada aluno vai para a unidade da coluna \"Unidade\" (pode colar várias unidades de uma vez). Sem essa coluna, vai para a unidade do topo.")}</p>
                                            <p>{tx("Aluno finalizado, inativo, cancelado ou visitante que já é de outra unidade NÃO é importado: aparece para verificar.")}</p>
                                        </div>
                                    </div>
                                    <textarea
                                        value={rawText}
                                        onChange={(e) => setRawText(e.target.value)}
                                        className="flex-1 min-h-[200px] w-full bg-white border border-slate-200 rounded-2xl p-6 text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-500 resize-none shadow-sm transition-all dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200"
                                        placeholder={tx("Cole as colunas copiadas do Excel aqui (Ctrl+V)...")}
                                    ></textarea>
                                    <div className="flex justify-end mt-6">
                                        <button onClick={analisarDados} disabled={!rawText.trim() || analisando} className="bg-slate-800 hover:bg-slate-900 text-white px-8 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md flex items-center gap-2 disabled:opacity-50 border border-slate-700">
                                            {analisando ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}{' '}{tx("Auditar Dados")}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {etapa === 'unidades' && (
                                <div className="p-8 flex flex-col max-w-3xl mx-auto w-full">
                                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-amber-800 text-xs font-bold mb-5 flex gap-3 items-start dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">
                                        <AlertTriangle className="w-5 h-5 shrink-0" />
                                        <span>{tx("Ligue cada unidade da planilha a uma unidade do sistema. A escolha fica guardada neste computador para as próximas importações. Sem unidade escolhida, as linhas não são importadas.")}</span>
                                    </div>
                                    <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:divide-slate-800">
                                        {mapaUnidades.map(u => (
                                            <div key={u.chave} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3">
                                                <div>
                                                    <p className="text-sm font-black text-slate-800 uppercase dark:text-white">{u.nome}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                        {u.codigo ? `${tx("código")} ${u.codigo} · ` : ''}{tx("{qtd} linhas", { qtd: u.qtd })}
                                                    </p>
                                                </div>
                                                <select
                                                    value={u.destino}
                                                    onChange={(e) => escolherDestino(u.chave, e.target.value)}
                                                    className={`h-10 px-3 rounded-xl border text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 ${u.destino ? 'border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-200' : 'border-rose-300 text-rose-600 dark:border-rose-500/40 dark:text-rose-400'}`}
                                                >
                                                    <option value="">{tx("Escolha a unidade do sistema…")}</option>
                                                    {nomesUnidadesSistema.map(n => <option key={n} value={n}>{n}</option>)}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-between mt-6 gap-3">
                                        <button onClick={() => setEtapa(previewData.length ? 'previa' : 'colar')} className="px-6 py-3.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">{tx("Voltar")}</button>
                                        <button onClick={() => rodarAuditoria(parsedBase, mapaUnidades)} disabled={analisando} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md flex items-center gap-2 disabled:opacity-50">
                                            {analisando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}{' '}{tx("Continuar auditoria")}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {etapa === 'previa' && (
                                <div className="p-5 flex flex-col h-full">
                                    {!camposNovos && (
                                        <div className="mb-3 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">
                                            {tx("Status, sexo e data de cadastro não serão gravados: falta rodar o SQL 2026-11-06-alunos-importacao no banco.")}
                                        </div>
                                    )}

                                    {mapaUnidades.length > 0 && (
                                        <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                            <span>{tx("Unidades da planilha:")}</span>
                                            {mapaUnidades.map(u => (
                                                <span key={u.chave} className={`px-2 py-1 rounded-md border ${u.destino ? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900' : 'border-rose-300 text-rose-600 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400'}`}>
                                                    {u.nome}{u.codigo ? ` (${u.codigo})` : ''} → {u.destino || tx("não ligada")}
                                                </span>
                                            ))}
                                            <button onClick={() => setEtapa('unidades')} className="text-blue-600 hover:underline normal-case tracking-normal font-black dark:text-blue-400">{tx("Trocar unidades")}</button>
                                        </div>
                                    )}

                                    {/* FAIXA DE RESUMO (clicar filtra a tabela) */}
                                    <div className="flex flex-wrap gap-2 mb-4 shrink-0">
                                        {FILTROS_PREVIA.map(f => {
                                            const qtd = contar(...f.situacoes);
                                            const ativo = filtroDashboard === f.id;
                                            const destaque = f.cor === 'rose' && qtd > 0;
                                            return (
                                                <button
                                                    key={f.id}
                                                    title={f.dica || ''}
                                                    onClick={() => setFiltroDashboard(ativo ? 'TODOS' : f.id)}
                                                    className={`text-left px-3 py-2 rounded-xl border transition-all ${ativo ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-200 dark:bg-blue-500/10 dark:ring-blue-500/30' : destaque ? 'bg-rose-50 border-rose-300 dark:bg-rose-500/10 dark:border-rose-500/30' : 'bg-white border-slate-200 hover:border-blue-300 dark:bg-slate-900 dark:border-slate-800'}`}
                                                >
                                                    <p className={`text-[10px] font-black uppercase tracking-widest ${destaque ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>{f.rotulo}</p>
                                                    <p className={`text-lg font-black leading-tight ${destaque ? 'text-rose-700 dark:text-rose-400' : 'text-slate-800 dark:text-white'}`}>{qtd}</p>
                                                    {f.id === 'TRANSFERIR' && origensTransferidos.length > 0 && (
                                                        <p className="text-[10px] font-bold text-blue-500 uppercase truncate max-w-[180px]" title={origensTransferidos.map(([o, q]) => `${q} ${tx("de")} ${o}`).join(' · ')}>
                                                            {origensTransferidos.slice(0, 2).map(([o, q]) => `${q} ${tx("de")} ${o}`).join(' · ')}
                                                        </p>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* TABELA DE AUDITORIA */}
                                    <div className="flex-1 overflow-auto custom-scrollbar border border-slate-200 rounded-2xl bg-white shadow-sm mb-4 dark:border-slate-800 dark:bg-slate-900">
                                        <table className="w-full text-left text-[10px] whitespace-nowrap">
                                            <thead className="bg-slate-100 font-black text-slate-500 uppercase tracking-widest sticky top-0 z-10 shadow-sm border-b border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-800">
                                                <tr>
                                                    <th className="p-3 pl-5">{tx("Situação")}</th>
                                                    <th className="p-3">{tx("Nome do Aluno")}</th>
                                                    <th className="p-3">{tx("CPF")}</th>
                                                    <th className="p-3">{tx("Matrícula")}</th>
                                                    <th className="p-3">{tx("Status")}</th>
                                                    <th className="p-3">{tx("Sexo")}</th>
                                                    <th className="p-3">{tx("Data de cadastro")}</th>
                                                    <th className="p-3">{tx("Unidade")}</th>
                                                    <th className="p-3">{tx("Observação / ação")}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {dadosExibicao.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="9" className="p-10 text-center text-slate-400 font-bold uppercase tracking-widest">
                                                            {tx("Nenhum registro encontrado para este filtro.")}
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    dadosExibicao.map((linha) => {
                                                        const i = previewData.indexOf(linha);
                                                        const s = linha.status;
                                                        const confirmavel = SITUACOES_COM_CONFIRMACAO.includes(s);
                                                        const aprovado = confirmavel && linha.forcarTroca;
                                                        const ehErro = SITUACOES_ERRO.includes(s) || s === SITUACAO.OUTRA_UNIDADE;

                                                        let badge = 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
                                                        let fundo = '';
                                                        if (s === SITUACAO.NOVO_ALUNO || s === SITUACAO.NOVO_VINCULO) { badge = 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30'; fundo = 'bg-emerald-50/20 dark:bg-emerald-500/5'; }
                                                        else if (s === SITUACAO.TRANSFERIR) { badge = 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30'; fundo = 'bg-blue-50/30 dark:bg-blue-500/5'; }
                                                        else if (s === SITUACAO.ATUALIZAR_MATRICULA) { badge = 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30'; fundo = 'bg-amber-50/30 dark:bg-amber-500/5'; }
                                                        else if (aprovado) { badge = 'bg-emerald-500 text-white border-emerald-600'; fundo = 'bg-emerald-50 dark:bg-emerald-500/10'; }
                                                        else if (confirmavel || ehErro) { badge = 'bg-rose-600 text-white border-rose-700'; fundo = 'bg-rose-50 dark:bg-rose-500/10'; }

                                                        const rotulo = aprovado ? tx("CONFIRMADO") : tx(s);
                                                        return (
                                                            <tr key={i} className={`transition-colors ${fundo}`}>
                                                                <td className="p-3 pl-5">
                                                                    <span className={`px-2 py-1 rounded-md border font-black uppercase tracking-widest text-[10px] ${badge}`}>{rotulo}</span>
                                                                </td>
                                                                <td className="p-3 font-bold text-slate-800 uppercase dark:text-white">{linha.nome}</td>
                                                                <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-200">{linha.cpf_mascarado || '—'}</td>
                                                                <td className="p-3">
                                                                    <div className="flex flex-col">
                                                                        <span className={`font-black ${s === SITUACAO.ATUALIZAR_MATRICULA ? 'text-amber-600 dark:text-amber-400' : s === SITUACAO.CONFLITO_MATRICULA ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'}`}>{linha.matricula || '—'}</span>
                                                                        {linha.matriculaAntiga && <span className="text-[10px] font-bold text-slate-400 line-through">{tx("Antiga:")}{' '}{linha.matriculaAntiga}</span>}
                                                                    </div>
                                                                </td>
                                                                <td className={`p-3 font-black uppercase ${corDoStatus(linha.status_tecace)}`}>{linha.status_tecace || '—'}</td>
                                                                <td className="p-3 font-bold text-slate-600 uppercase dark:text-slate-300">{linha.sexo || '—'}</td>
                                                                <td className="p-3 font-bold text-slate-600 dark:text-slate-300">{dataBR(linha.data_cadastro)}</td>
                                                                <td className="p-3 font-black text-blue-600 uppercase dark:text-blue-400">{linha.destino || '—'}</td>
                                                                <td className="p-3">
                                                                    <div className="flex flex-col gap-1.5 items-start">
                                                                        {linha.conflitoMsg && (
                                                                            <span className={`font-bold text-[10px] max-w-sm whitespace-normal leading-tight ${aprovado ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{linha.conflitoMsg}</span>
                                                                        )}
                                                                        {s === SITUACAO.TRANSFERIR && linha.origem && (
                                                                            <span className="inline-flex items-center gap-1 text-blue-600 font-black text-[10px] uppercase tracking-widest dark:text-blue-400">
                                                                                <ArrowRightLeft className="w-3 h-3" />{' '}{tx("Sai de")}{' '}{linha.origem}
                                                                            </span>
                                                                        )}
                                                                        {confirmavel && (
                                                                            <button
                                                                                onClick={() => handleForcarTroca(i)}
                                                                                className={`px-3 py-1.5 rounded font-black text-[10px] uppercase tracking-widest transition-all ${aprovado ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm'}`}
                                                                            >
                                                                                {aprovado ? tx("Desfazer") : s === SITUACAO.CONFLITO_MATRICULA ? tx("Confirmar e Roubar Matrícula") : tx("Confirmar transferência")}
                                                                            </button>
                                                                        )}
                                                                        {!linha.conflitoMsg && !(s === SITUACAO.TRANSFERIR && linha.origem) && !confirmavel && <span className="text-slate-300 dark:text-slate-600">—</span>}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* RODAPÉ */}
                                    <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm shrink-0 gap-3 dark:bg-slate-900 dark:border-slate-800">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            {tx("{linhas} linhas · {prontas} prontas para gravar", { linhas: previewData.length, prontas: totalParaImportar })}
                                        </div>
                                        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                                            {qtdConfirmarTransferencia > 0 && (
                                                <button onClick={confirmarTodasTransferencias} className="flex-1 sm:flex-none px-5 py-3.5 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30">
                                                    {tx("Confirmar todas as transferências ({qtd})", { qtd: qtdConfirmarTransferencia })}
                                                </button>
                                            )}
                                            <button onClick={handleCloseModal} className="flex-1 sm:flex-none px-6 py-3.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">{tx("Voltar")}</button>
                                            <button onClick={importarAlunosValidos} disabled={importando || totalParaImportar === 0} className="flex-1 sm:flex-none px-8 py-3.5 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                                {importando ? (
                                                    <><Loader2 className="w-4 h-4 animate-spin" />{' '}{tx("SALVANDO:")}{' '}{progresso}%</>
                                                ) : (
                                                    <><Save className="w-4 h-4" />{' '}{tx("APLICAR ATUALIZAÇÕES")}</>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {etapa === 'resultado' && resultado && (
                                <div className="p-8 flex flex-col max-w-4xl mx-auto w-full">
                                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-amber-800 text-sm font-bold mb-5 flex gap-3 items-start dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">
                                        <AlertTriangle className="w-5 h-5 shrink-0" />
                                        <span>{tx("{ok} de {total} linhas gravadas. As linhas abaixo NÃO foram gravadas (o banco recusou). Corrija e importe de novo só elas.", { ok: resultado.total - resultado.falhas.length, total: resultado.total })}</span>
                                    </div>
                                    <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:divide-slate-800">
                                        {resultado.falhas.map((f, idx) => (
                                            <div key={idx} className="px-5 py-3">
                                                <p className="text-xs font-black text-slate-800 uppercase dark:text-white">{f.nome} · <span className="font-mono">{mascaraCPF(f.cpf)}</span></p>
                                                <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 whitespace-normal">{f.erro}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-end mt-6">
                                        <button onClick={handleCloseModal} className="px-8 py-3.5 bg-slate-800 text-white hover:bg-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest">{tx("Fechar")}</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AlunosTab;