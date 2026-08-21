import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import { Search, Users, FileText, X, Loader2, Save, UploadCloud, UserRoundPen, Building2, ShieldAlert } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { parseSmartPaste, mascaraCPF, formatarTelefone } from './utilsAlunos.js';
import ModalAluno from '../../components/Modals/ModalAluno.jsx';

const AlunosTab = (props) => {
    const { usuarioLogado } = props;
    const { t, locale, language } = useI18n();
    const langAtual = locale || language || 'pt-BR';

    // ==========================================
    // 1. A FONTE ÚNICA DE VERDADE (SSOT)
    // ==========================================
    const propUnidade = props.unidadeAtiva || props.unidadeSelecionada || props.unidade || '';
    const storageUnidade = localStorage.getItem('unidadeAtiva') || localStorage.getItem('unidadeSelecionada') || localStorage.getItem('unidade') || '';
    
    const unidadeRaw = propUnidade || usuarioLogado?.unidade || storageUnidade || '';
    const unidadeAtiva = unidadeRaw.toUpperCase().trim();

    // ==========================================
    // 2. REGRAS DE PERMISSÃO
    // ==========================================
    const role = (usuarioLogado?.role || '').toUpperCase().trim();
    const temPermissaoGlobal = role === 'ADMIN' || role === 'MENTOR';
    
    // Visão Global
    const isVisaoGlobal = temPermissaoGlobal && (!unidadeAtiva || unidadeAtiva === 'TODAS' || unidadeAtiva.includes('GLOBAL'));
    const erroUnidadePerdida = !temPermissaoGlobal && !unidadeAtiva;

    // Estados da UI
    const [alunos, setAlunos] = useState([]);
    const [totalItems, setTotalItems] = useState(0);
    const [loading, setLoading] = useState(true);
    const [pagina, setPagina] = useState(1);
    const ITENS_POR_PAGINA = 15;

    // Estados de Busca
    const [busca, setBusca] = useState('');
    const [termoBusca, setTermoBusca] = useState('');

    // Estados do Smart Paste
    const [modalPasteOpen, setModalPasteOpen] = useState(false);
    const [rawText, setRawText] = useState('');
    const [previewData, setPreviewData] = useState([]);
    const [analisando, setAnalisando] = useState(false);
    const [importando, setImportando] = useState(false);

    // Estados do Modal
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
    // 3. BUSCA BLINDADA (VOLTANDO AO PADRÃO SEGURO)
    // ==========================================
    const carregarAlunos = async () => {
        if (erroUnidadePerdida) {
            setLoading(false); return;
        }

        setLoading(true);
        try {
            // Tratamento de acentuação da unidade
            const uniAcento = unidadeAtiva.replace('INES', 'INÊS');
            const uniSemAcento = unidadeAtiva.replace('INÊS', 'INES');

            let query = supabase.from('alunos');

            if (isVisaoGlobal) {
                // VISAO GLOBAL
                query = query.select(`*, alunos_unidades(unidade, matricula, status)`, { count: 'exact' });
            } else {
                // VISAO LOCAL: A tabela mãe é "alunos", filtramos garantindo que tenha o vínculo da unidade
                query = query.select(`*, alunos_unidades!inner(unidade, matricula, status)`, { count: 'exact' })
                             .in('alunos_unidades.unidade', [unidadeAtiva, uniAcento, uniSemAcento]);
            }

            // Filtro de busca na tabela mãe
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
            
            if (error) {
                console.error("Erro do Supabase:", error);
                throw error;
            }

            // Planificamos para renderizar na tabela perfeitamente
            const alunosPlanificados = (data || []).map(item => {
                const vinculoArray = item.alunos_unidades || [];
                let vinculoLocal = vinculoArray[0] || {};
                
                if (!isVisaoGlobal) {
                    // Na visão local, pegamos o vínculo exato para renderizar a matrícula correta
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
    // 4. SMART PASTE MULTIUNIDADE
    // ==========================================
    const analisarDados = async () => {
        if (!rawText.trim()) return;
        if (isVisaoGlobal) return alert('Selecione uma unidade específica de destino no menu superior da tela.');

        setAnalisando(true);
        try {
            const parsed = parseSmartPaste(rawText);
            const cpfsParaChecar = parsed.filter(p => p.status === 'NOVO').map(p => p.cpf);
            
            if (cpfsParaChecar.length > 0) {
                const chunkSize = 200;
                let existentesGlobais = [];
                let existentesLocais = [];

                const uniAcento = unidadeAtiva.replace('INES', 'INÊS');
                const uniSemAcento = unidadeAtiva.replace('INÊS', 'INES');

                for (let i = 0; i < cpfsParaChecar.length; i += chunkSize) {
                    const chunk = cpfsParaChecar.slice(i, i + chunkSize);
                    
                    const { data: globalData } = await supabase.from('alunos').select('cpf').in('cpf', chunk);
                    if (globalData) existentesGlobais = [...existentesGlobais, ...globalData];

                    // Busca segura de vínculos
                    const { data: localData } = await supabase.from('alunos')
                        .select('cpf, alunos_unidades!inner(unidade)')
                        .in('cpf', chunk)
                        .in('alunos_unidades.unidade', [unidadeAtiva, uniAcento, uniSemAcento]);
                    
                    if (localData) existentesLocais = [...existentesLocais, ...localData];
                }

                const setGlobal = new Set(existentesGlobais.map(e => e.cpf));
                const setLocal = new Set(existentesLocais.map(e => e.cpf));

                parsed.forEach(p => {
                    if (p.status === 'NOVO') {
                        if (setLocal.has(p.cpf)) {
                            p.status = t('students.paste.statusExistUnit', {defaultValue: 'JÁ NESTA UNIDADE'});
                        } else if (setGlobal.has(p.cpf)) {
                            p.status = t('students.paste.statusNewLink', {defaultValue: 'NOVO VÍNCULO'});
                        } else {
                            p.status = t('students.paste.statusNew', {defaultValue: 'NOVO ALUNO'});
                        }
                    }
                });
            }
            setPreviewData(parsed);
        } catch (err) {
            console.error(err);
            alert(t('students.paste.errorAnalyze', {defaultValue: 'Erro ao analisar dados.'}));
        } finally {
            setAnalisando(false);
        }
    };

    const importarAlunosValidos = async () => {
        const validos = previewData.filter(p => p.status === t('students.paste.statusNew', {defaultValue: 'NOVO ALUNO'}) || p.status === t('students.paste.statusNewLink', {defaultValue: 'NOVO VÍNCULO'}));
        if (validos.length === 0) return;
        if (isVisaoGlobal) return alert('Selecione uma unidade específica de destino.');

        setImportando(true);
        try {
            const insertChunkSize = 200;
            for (let i = 0; i < validos.length; i += insertChunkSize) {
                const chunkValidos = validos.slice(i, i + insertChunkSize);
                
                const payloadAlunos = chunkValidos.map(v => ({
                    nome: v.nome,
                    cpf: v.cpf,
                    telefone: v.telefone,
                    email: v.email,
                    data_nascimento: v.data_nascimento,
                    matricula: v.matricula 
                }));

                const { data: insertedAlunos, error: errAlunos } = await supabase
                    .from('alunos')
                    .upsert(payloadAlunos, { onConflict: 'cpf' })
                    .select('id, cpf');
                
                if (errAlunos) throw errAlunos;

                const mapCpfToId = {};
                insertedAlunos.forEach(a => { mapCpfToId[a.cpf] = a.id; });

                const payloadVinculos = chunkValidos.map(v => ({
                    aluno_id: mapCpfToId[v.cpf],
                    unidade: unidadeAtiva,
                    matricula: v.matricula || '',
                    status: 'ATIVO'
                }));

                const { error: errVinculos } = await supabase
                    .from('alunos_unidades')
                    .upsert(payloadVinculos, { onConflict: 'aluno_id, unidade' });
                
                if (errVinculos) throw errVinculos;
            }

            alert(t('students.paste.success', {defaultValue: 'Importação concluída com sucesso!'}));
            setModalPasteOpen(false);
            setRawText('');
            setPreviewData([]);
            carregarAlunos(); 
        } catch (error) {
            console.error("Erro na importação:", error);
            alert(t('students.paste.errorImport', {defaultValue: 'Erro crítico ao importar.'}));
        } finally {
            setImportando(false);
        }
    };

    const totalPaginas = Math.ceil(totalItems / ITENS_POR_PAGINA);

    // ==========================================
    // RENDERIZAÇÃO DE SEGURANÇA
    // ==========================================
    if (erroUnidadePerdida) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] bg-rose-50 border-2 border-dashed border-rose-200 rounded-[32px] p-8 text-center animate-[fadeIn_0.3s_ease-out]">
                <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-6 shadow-inner"><ShieldAlert className="w-10 h-10" /></div>
                <h2 className="text-2xl font-black text-rose-800 uppercase tracking-tight">FALHA DE AUTORIZAÇÃO</h2>
                <p className="text-sm font-bold text-rose-600 mt-2 max-w-md">Não foi possível identificar a sua unidade de trabalho ativa. Por motivos de segurança, o acesso ao banco de alunos foi bloqueado.</p>
                <button onClick={() => window.location.reload()} className="mt-8 px-6 py-3 bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md hover:bg-rose-700 transition-colors">Recarregar Sistema</button>
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

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-inner">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">{t('students.title', {defaultValue: 'Banco de Alunos'})}</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">UNIDADE ATUAL: <span className="text-blue-600">{isVisaoGlobal ? 'VISÃO GLOBAL' : unidadeAtiva}</span></p>
                        </div>
                    </div>
                </div>

                <div className="flex w-full sm:w-auto gap-3">
                    <button 
                        onClick={() => {
                            if (isVisaoGlobal) return alert("Selecione uma unidade específica no menu do cabeçalho da página antes de importar planilhas.");
                            setModalPasteOpen(true);
                        }} 
                        disabled={isVisaoGlobal}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors border border-emerald-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <UploadCloud className="w-4 h-4" /> {t('students.import', {defaultValue: 'IMPORTAR PLANILHA'})}
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
                <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-4 bg-slate-50 shrink-0">
                    <div className="relative w-full sm:w-96">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t('students.search', {defaultValue: 'Buscar por Nome ou CPF...'})} className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all" />
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest self-end sm:self-center">
                        {totalItems} {isVisaoGlobal ? 'ALUNOS NA REDE' : `ALUNOS REGISTRADOS`}
                    </div>
                </div>
                
                <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative">
                    {loading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead className="bg-white sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">{t('students.table.name')}</th>
                                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">{t('students.table.cpf')}</th>
                                    {isVisaoGlobal && <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-center">VÍNCULOS</th>}
                                    {!isVisaoGlobal && <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">{t('students.table.enrollment')}</th>}
                                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">{t('students.table.contact')}</th>
                                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">{t('students.table.created')}</th>
                                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-center">{t('students.table.actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {alunos.length > 0 ? (
                                    alunos.map(a => (
                                        <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <span className="text-sm font-black text-slate-800 uppercase">{a.nome}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-bold text-slate-600 tracking-widest">{a.cpf ? mascaraCPF(a.cpf) : '—'}</span>
                                            </td>
                                            
                                            {isVisaoGlobal && (
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md border ${a.total_vinculos > 1 ? 'text-purple-700 bg-purple-100 border-purple-200' : a.total_vinculos === 1 ? 'text-blue-700 bg-blue-100 border-blue-200' : 'text-slate-500 bg-slate-100 border-slate-200'}`}>
                                                        {a.total_vinculos === 0 ? 'SEM VÍNCULO' : a.total_vinculos > 1 ? 'MULTIPLO' : a.unidade_vinculo}
                                                    </span>
                                                </td>
                                            )}

                                            {!isVisaoGlobal && (
                                                <td className="px-6 py-4">
                                                    <span className="text-xs font-bold text-slate-500">{a.matricula || '—'}</span>
                                                </td>
                                            )}

                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-slate-700">{a.telefone ? formatarTelefone(a.telefone) : '—'}</span>
                                                    <span className="text-[10px] font-semibold text-slate-400 truncate max-w-[200px]" title={a.email}>{a.email || '—'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-bold text-slate-500">{a.created_at ? new Date(a.created_at).toLocaleDateString(langAtual) : '—'}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button onClick={() => { setAlunoEditando(a); setModalAlunoAberto(true); }} className="p-2 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-lg transition-colors">
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
                                                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                                                    {t('students.empty', {defaultValue: 'NENHUM ALUNO CADASTRADO PARA A UNIDADE:'})} <span className="text-blue-600">{unidadeAtiva}</span>
                                                </p>
                                                <p className="text-slate-400 font-medium text-xs mt-1 max-w-xs">
                                                    Clique no botão verde acima para importar sua planilha pelo Smart Paste.
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
                    <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('students.pagination.page')} {pagina} {t('students.pagination.of')} {totalPaginas}</span>
                        <div className="flex gap-2">
                            <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1} className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 disabled:opacity-50 hover:bg-slate-100 text-[10px] font-black uppercase tracking-widest transition-colors">{t('students.pagination.prev')}</button>
                            <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas} className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 disabled:opacity-50 hover:bg-slate-100 text-[10px] font-black uppercase tracking-widest transition-colors">{t('students.pagination.next')}</button>
                        </div>
                    </div>
                )}
            </div>

            {modalPasteOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 sm:p-8 animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-6xl flex flex-col h-full max-h-[90vh] overflow-hidden">
                        
                        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl"><UploadCloud className="w-5 h-5" /></div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{t('students.paste.title')}</h3>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                                        IMPORTANDO PARA: <span className="text-emerald-600">{unidadeAtiva}</span>
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => {setModalPasteOpen(false); setPreviewData([]); setRawText('');}} className="p-2 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4 bg-slate-50/50">
                            {previewData.length === 0 ? (
                                <>
                                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl text-blue-700 text-xs font-bold">
                                        <span className="uppercase tracking-widest text-[9px] block mb-1">{t('students.paste.pattern')}</span>
                                        {t('students.paste.instructions')}
                                    </div>
                                    <textarea 
                                        value={rawText} 
                                        onChange={(e) => setRawText(e.target.value)} 
                                        className="flex-1 w-full bg-white border border-slate-200 rounded-2xl p-5 text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-500 resize-none shadow-inner"
                                        placeholder={t('students.paste.placeholder')}
                                    ></textarea>
                                    <div className="flex justify-end">
                                        <button onClick={analisarDados} disabled={!rawText.trim() || analisando} className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md flex items-center gap-2 disabled:opacity-50">
                                            {analisando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} {t('students.paste.analyze')}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b pb-2">{t('students.paste.preview')}</h4>
                                    <div className="flex-1 overflow-auto custom-scrollbar border border-slate-200 rounded-2xl bg-white shadow-inner">
                                        <table className="w-full text-left text-[10px] whitespace-nowrap">
                                            <thead className="bg-slate-100 font-black text-slate-500 uppercase tracking-widest sticky top-0 z-10">
                                                <tr>
                                                    <th className="p-3">{t('students.paste.statusHeader')}</th>
                                                    <th className="p-3">CPF</th>
                                                    <th className="p-3">{t('students.table.enrollment')}</th>
                                                    <th className="p-3">{t('students.table.name')}</th>
                                                    <th className="p-3">{t('students.table.contact')}</th>
                                                    <th className="p-3">E-mail</th>
                                                    <th className="p-3">{t('students.form.birth')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {previewData.map((linha, i) => (
                                                    <tr key={i} className={linha.status === t('students.paste.statusNew', {defaultValue: 'NOVO ALUNO'}) || linha.status === t('students.paste.statusNewLink', {defaultValue: 'NOVO VÍNCULO'}) ? 'bg-emerald-50/30' : linha.status === t('students.paste.statusExistUnit', {defaultValue: 'JÁ NESTA UNIDADE'}) ? 'bg-slate-50' : 'bg-rose-50/50'}>
                                                        <td className="p-3">
                                                            <div className="flex flex-col gap-1 items-start">
                                                                <span className={`px-2 py-1 rounded border font-black uppercase tracking-widest text-[8px] ${
                                                                    (linha.status === t('students.paste.statusNew', {defaultValue: 'NOVO ALUNO'}) || linha.status === t('students.paste.statusNewLink', {defaultValue: 'NOVO VÍNCULO'})) ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                                    linha.status === t('students.paste.statusExistUnit', {defaultValue: 'JÁ NESTA UNIDADE'}) ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                                                    'bg-rose-100 text-rose-700 border-rose-200'
                                                                }`}>{linha.status}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-3 font-mono font-bold text-slate-700">{linha.cpf_mascarado || '—'}</td>
                                                        <td className="p-3 text-slate-600 font-bold">{linha.matricula || '-'}</td>
                                                        <td className="p-3 font-bold text-slate-800 truncate max-w-[200px] uppercase">{linha.nome}</td>
                                                        <td className="p-3 text-slate-600 font-bold">{linha.telefone_formatado || '-'}</td>
                                                        <td className="p-3 text-slate-600 truncate max-w-[150px]" title={linha.email}>{linha.email || '-'}</td>
                                                        <td className="p-3 text-slate-600 font-bold">
                                                            {linha.data_nascimento ? new Date(linha.data_nascimento + 'T12:00:00').toLocaleDateString(langAtual) : '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm shrink-0 mt-2 gap-4">
                                        <div className="flex flex-wrap gap-4 text-[10px] font-black uppercase tracking-widest">
                                            <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">NOVOS VÍNCULOS: {previewData.filter(p => p.status === t('students.paste.statusNew', {defaultValue: 'NOVO ALUNO'}) || p.status === t('students.paste.statusNewLink', {defaultValue: 'NOVO VÍNCULO'})).length}</span>
                                            <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">JÁ NA UNIDADE: {previewData.filter(p => p.status === t('students.paste.statusExistUnit', {defaultValue: 'JÁ NESTA UNIDADE'})).length}</span>
                                            <span className="text-rose-600 bg-rose-50 px-2 py-1 rounded-lg">BLOQUEADOS: {previewData.filter(p => p.status === 'ERRO').length}</span>
                                        </div>
                                        <div className="flex gap-2 w-full sm:w-auto">
                                            <button onClick={() => setPreviewData([])} className="flex-1 sm:flex-none px-5 py-3 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors">{t('communications.back', {defaultValue: 'Voltar'})}</button>
                                            <button onClick={importarAlunosValidos} disabled={importando || previewData.filter(p => p.status === t('students.paste.statusNew', {defaultValue: 'NOVO ALUNO'}) || p.status === t('students.paste.statusNewLink', {defaultValue: 'NOVO VÍNCULO'})).length === 0} className="flex-1 sm:flex-none px-5 py-3 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                                {importando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} IMPORTAR PARA {unidadeAtiva}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AlunosTab;