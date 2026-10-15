import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient.js';
import { Search, Users, FileText, X, Loader2, Save, UserRoundPen, ShieldAlert, CheckCircle2, Link, RefreshCcw, ClipboardPaste, Info, AlertTriangle } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { parseSmartPaste, mascaraCPF, formatarTelefone } from './utilsAlunos.js';
import ModalAluno from '../../components/Modals/ModalAluno.jsx';

const AlunosTab = (props) => {
    const { usuarioLogado, usuarioVirtual } = props;
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
    // 4. SMART PASTE MULTIUNIDADE E "TECACE" (COM MEMÓRIA DE DADOS)
    // ==========================================
    const analisarDados = async () => {
        if (!rawText.trim()) return;
        if (isVisaoGlobal) return alert('Selecione uma unidade específica de destino no menu superior da tela.');

        setAnalisando(true);
        try {
            const parsed = parseSmartPaste(rawText);
            const cpfsParaChecar = parsed.filter(p => p.status === 'NOVO').map(p => p.cpf);
            const matriculasParaChecar = parsed.filter(p => p.status === 'NOVO' && p.matricula).map(p => String(p.matricula).trim());
            
            if (cpfsParaChecar.length > 0) {
                const chunkSize = 200;
                let existentesGlobais = [];
                let existentesLocais = [];
                let matriculasOcupadas = [];

                const uniAcento = unidadeAtiva.replace('INES', 'INÊS');
                const uniSemAcento = unidadeAtiva.replace('INÊS', 'INES');

                for (let i = 0; i < cpfsParaChecar.length; i += chunkSize) {
                    const chunk = cpfsParaChecar.slice(i, i + chunkSize);
                    
                    // 🔥 BURACO 1 FECHADO: Puxamos telefone e email antigos também para não perder dados!
                    const { data: globalData } = await supabase.from('alunos').select('cpf, telefone, email').in('cpf', chunk);
                    if (globalData) existentesGlobais = [...existentesGlobais, ...globalData];

                    const { data: localData } = await supabase.from('alunos')
                        .select('cpf, alunos_unidades!inner(unidade, matricula)')
                        .in('cpf', chunk)
                        .in('alunos_unidades.unidade', [unidadeAtiva, uniAcento, uniSemAcento]);
                    
                    if (localData) existentesLocais = [...existentesLocais, ...localData];
                }

                for (let i = 0; i < matriculasParaChecar.length; i += chunkSize) {
                    const chunk = matriculasParaChecar.slice(i, i + chunkSize);
                    const { data } = await supabase.from('alunos_unidades')
                        .select('matricula, alunos!inner(cpf, nome)')
                        .in('matricula', chunk)
                        .in('unidade', [unidadeAtiva, uniAcento, uniSemAcento]);
                    
                    if (data) matriculasOcupadas = [...matriculasOcupadas, ...data];
                }

                const mapGlobais = new Map();
                existentesGlobais.forEach(e => mapGlobais.set(e.cpf, e));
                
                const mapMatriculasLocais = new Map();
                existentesLocais.forEach(aluno => {
                    const dbMatricula = aluno.alunos_unidades[0]?.matricula || '';
                    mapMatriculasLocais.set(aluno.cpf, dbMatricula);
                });

                const mapOcupantes = new Map();
                matriculasOcupadas.forEach(mo => {
                    mapOcupantes.set(String(mo.matricula).trim(), { cpf: mo.alunos.cpf, nome: mo.alunos.nome });
                });

                parsed.forEach(p => {
                    if (p.status !== 'NOVO') return;

                    // 🔥 BURACO 1 FECHADO: Se o TECACE mandou sem fone/email, resgata o antigo
                    const dadosAntigos = mapGlobais.get(p.cpf);
                    if (dadosAntigos) {
                        if (!p.telefone && dadosAntigos.telefone) p.telefone = dadosAntigos.telefone;
                        if (!p.email && dadosAntigos.email) p.email = dadosAntigos.email;
                    }

                    const matriculaColada = String(p.matricula).trim();
                    const ocupanteAtual = matriculaColada ? mapOcupantes.get(matriculaColada) : null;

                    // CONFLITO GRAVE (Erro 409 Evitado)
                    if (ocupanteAtual && ocupanteAtual.cpf !== p.cpf) {
                        p.status = 'CONFLITO GRAVE';
                        p.conflitoMsg = `O aluno ${ocupanteAtual.nome} (CPF: ${mascaraCPF(ocupanteAtual.cpf)}) já usa a matrícula ${matriculaColada} no sistema antigo.`;
                        p.forcarTroca = false; 
                        return;
                    }

                    if (mapMatriculasLocais.has(p.cpf)) {
                        const matriculaBanco = String(mapMatriculasLocais.get(p.cpf)).trim();
                        
                        if (matriculaColada && matriculaColada !== matriculaBanco) {
                            p.status = 'ATUALIZAR MATRÍCULA';
                            p.matriculaAntiga = matriculaBanco;
                        } else {
                            p.status = 'JÁ NESTA UNIDADE';
                        }
                    } else if (mapGlobais.has(p.cpf)) {
                        p.status = 'NOVO VÍNCULO';
                    } else {
                        p.status = 'NOVO ALUNO';
                    }
                });
            }
            setPreviewData(parsed);
            setFiltroDashboard('TODOS');
        } catch (err) {
            console.error(err);
            alert('Erro ao analisar os dados cruzados com a nuvem.');
        } finally {
            setAnalisando(false);
        }
    };

    const handleForcarTroca = (indexOriginal) => {
        const newData = [...previewData];
        newData[indexOriginal].forcarTroca = !newData[indexOriginal].forcarTroca;
        setPreviewData(newData);
    };

    const importarAlunosValidos = async () => {
        const validos = previewData.filter(p => 
            p.status === 'NOVO ALUNO' || 
            p.status === 'NOVO VÍNCULO' || 
            p.status === 'ATUALIZAR MATRÍCULA' || 
            (p.status === 'CONFLITO GRAVE' && p.forcarTroca)
        );

        if (validos.length === 0) return;
        if (isVisaoGlobal) return alert('Selecione uma unidade específica de destino.');

        setImportando(true);
        setProgresso(0);
        
        try {
            // PASSO 1: Desvincular matrículas conflituosas (O "Roubo" autorizado)
            // 🔥 BURACO 2 FECHADO: Math.random() garante que o milissegundo não colida
            const conflitosAprovados = validos.filter(p => p.status === 'CONFLITO GRAVE');
            for (const conflito of conflitosAprovados) {
                const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
                await supabase.from('alunos_unidades')
                    .update({ matricula: `LIVRE-${Date.now()}-${randomId}` }) 
                    .eq('unidade', unidadeAtiva)
                    .eq('matricula', String(conflito.matricula).trim());
            }

            // PASSO 2: Inserir em Lotes (Seguro contra limites de API)
            const insertChunkSize = 100;
            let gravados = 0;

            for (let i = 0; i < validos.length; i += insertChunkSize) {
                const chunkValidos = validos.slice(i, i + insertChunkSize);
                
                const payloadAlunos = chunkValidos.map(v => {
                    const obj = {
                        nome: v.nome,
                        cpf: v.cpf,
                        telefone: v.telefone || null,
                        email: v.email || null,
                        matricula: v.matricula || null
                    };
                    if (v.data_nascimento) obj.data_nascimento = v.data_nascimento;
                    return obj;
                });

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
                    matricula: v.matricula || null,
                    status: 'ATIVO'
                })).filter(v => v.aluno_id);

                const { error: errVinculos } = await supabase
                    .from('alunos_unidades')
                    .upsert(payloadVinculos, { onConflict: 'aluno_id,unidade' });
                
                if (errVinculos) throw errVinculos;

                // 🔥 BURACO 3 FECHADO: Feed de progresso ao vivo
                gravados += chunkValidos.length;
                setProgresso(Math.round((gravados / validos.length) * 100));
            }

            alert('Integração de alunos e correção de matrículas processada com sucesso!');
            setModalPasteOpen(false);
            setRawText('');
            setPreviewData([]);
            setFiltroDashboard('TODOS');
            setProgresso(0);
            carregarAlunos(); 
        } catch (error) {
            console.error("Erro na importação:", error);
            alert('Erro crítico ao gravar os dados. Verifique a conexão com a internet.');
        } finally {
            setImportando(false);
            setProgresso(0);
        }
    };

    const totalPaginas = Math.ceil(totalItems / ITENS_POR_PAGINA);

    const dashboardStats = {
        novos: previewData.filter(p => p.status === 'NOVO ALUNO').length,
        vinculos: previewData.filter(p => p.status === 'NOVO VÍNCULO').length,
        atualizacoes: previewData.filter(p => p.status === 'ATUALIZAR MATRÍCULA').length,
        conflitosGerais: previewData.filter(p => p.status === 'CONFLITO GRAVE').length,
        errosIniciais: previewData.filter(p => p.status === 'CPF INVÁLIDO' || p.status === 'DUPLICADO NA LISTA').length,
        totalParaImportar: previewData.filter(p => p.status === 'NOVO ALUNO' || p.status === 'NOVO VÍNCULO' || p.status === 'ATUALIZAR MATRÍCULA' || (p.status === 'CONFLITO GRAVE' && p.forcarTroca)).length
    };

    // Filtra a exibição da tabela baseado no Card clicado
    const dadosExibicao = useMemo(() => {
        if (filtroDashboard === 'TODOS') return previewData;
        if (filtroDashboard === 'NOVOS') return previewData.filter(p => p.status === 'NOVO ALUNO');
        if (filtroDashboard === 'VINCULOS') return previewData.filter(p => p.status === 'NOVO VÍNCULO');
        if (filtroDashboard === 'ATUALIZACOES') return previewData.filter(p => p.status === 'ATUALIZAR MATRÍCULA');
        if (filtroDashboard === 'CONFLITOS') return previewData.filter(p => p.status === 'CONFLITO GRAVE');
        if (filtroDashboard === 'ERROS') return previewData.filter(p => p.status === 'CPF INVÁLIDO' || p.status === 'DUPLICADO NA LISTA');
        return previewData;
    }, [previewData, filtroDashboard]);

    const handleCloseModal = () => {
        setModalPasteOpen(false);
        setPreviewData([]);
        setRawText('');
        setFiltroDashboard('TODOS');
        setProgresso(0);
    };

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
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                UNIDADE ATUAL: <span className="text-blue-600">{isVisaoGlobal ? 'VISÃO GLOBAL' : unidadeAtiva}</span>
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex w-full sm:w-auto gap-3">
                    <button 
                        onClick={() => {
                            if (isVisaoGlobal) return alert("Selecione uma unidade específica no menu do cabeçalho da página antes de colar dados.");
                            setModalPasteOpen(true);
                        }} 
                        disabled={isVisaoGlobal}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors border border-emerald-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ClipboardPaste className="w-4 h-4" /> Smart Paste (Colar Dados)
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
                        {totalItems} {isVisaoGlobal ? 'ALUNOS NA REDE' : `ALUNOS REGISTRADOS EM ${unidadeAtiva}`}
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
                                                    NENHUM ALUNO CADASTRADO PARA A UNIDADE: <span className="text-blue-600">{unidadeAtiva}</span>
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

            {/* MODAL SMART PASTE COM DASHBOARD INTERATIVO */}
            {modalPasteOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 sm:p-8 animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-slate-50 rounded-[32px] shadow-2xl w-full max-w-7xl flex flex-col h-full max-h-[90vh] overflow-hidden border border-slate-200">
                        
                        <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl shadow-inner"><ClipboardPaste className="w-6 h-6" /></div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Smart Paste: Importação TECACE</h3>
                                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1 flex items-center gap-1.5">
                                        Importando dados para: <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{unidadeAtiva}</span>
                                    </p>
                                </div>
                            </div>
                            <button onClick={handleCloseModal} className="p-2 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 rounded-full transition-colors shadow-sm"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto flex flex-col">
                            {previewData.length === 0 ? (
                                <div className="p-8 flex flex-col h-full max-w-4xl mx-auto w-full">
                                    <div className="bg-blue-50 border border-blue-200 p-5 rounded-2xl text-blue-800 text-sm font-semibold shadow-inner mb-6 flex gap-4 items-start">
                                        <Info className="w-6 h-6 text-blue-500 shrink-0" />
                                        <div>
                                            <span className="font-black tracking-tight block mb-1 text-base">Como Copiar e Colar (Integração TECACE)?</span>
                                            Exporte a lista de alunos do TECACE, copie as linhas do Excel (com o cabeçalho) e <strong>cole diretamente na caixa abaixo</strong>. O motor lerá as colunas de "Documento" (CPF) e "Matrícula" e ajustará a sua base de dados automaticamente. Se houver divergência de matrícula antiga, o sistema pedirá a sua confirmação.
                                        </div>
                                    </div>
                                    <textarea 
                                        value={rawText} 
                                        onChange={(e) => setRawText(e.target.value)} 
                                        className="flex-1 w-full bg-white border border-slate-200 rounded-2xl p-6 text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-500 resize-none shadow-sm transition-all"
                                        placeholder="Cole as colunas copiadas do Excel do TECACE aqui (Ctrl+V)..."
                                    ></textarea>
                                    <div className="flex justify-end mt-6">
                                        <button onClick={analisarDados} disabled={!rawText.trim() || analisando} className="bg-slate-800 hover:bg-slate-900 text-white px-8 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md flex items-center gap-2 disabled:opacity-50 border border-slate-700">
                                            {analisando ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />} Auditar Dados
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-6 flex flex-col h-full">
                                    {/* DASHBOARD DE RESUMO INTERATIVO */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6 shrink-0">
                                        <button 
                                            onClick={() => setFiltroDashboard(filtroDashboard === 'NOVOS' ? 'TODOS' : 'NOVOS')}
                                            className={`text-left border rounded-2xl p-5 shadow-sm relative overflow-hidden transition-all cursor-pointer ${filtroDashboard === 'NOVOS' ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200 scale-[1.02]' : 'bg-white border-emerald-200 hover:border-emerald-400'}`}
                                        >
                                            <div className="absolute right-[-10px] bottom-[-10px] text-emerald-50/50"><CheckCircle2 className="w-24 h-24" /></div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1 relative z-10">Novos Alunos</p>
                                            <p className="text-3xl font-black text-slate-800 relative z-10">{dashboardStats.novos}</p>
                                        </button>
                                        
                                        <button 
                                            onClick={() => setFiltroDashboard(filtroDashboard === 'VINCULOS' ? 'TODOS' : 'VINCULOS')}
                                            className={`text-left border rounded-2xl p-5 shadow-sm relative overflow-hidden transition-all cursor-pointer ${filtroDashboard === 'VINCULOS' ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-200 scale-[1.02]' : 'bg-white border-blue-200 hover:border-blue-400'}`}
                                        >
                                            <div className="absolute right-[-10px] bottom-[-10px] text-blue-50/50"><Link className="w-24 h-24" /></div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-1 relative z-10">Novos Vínculos</p>
                                            <p className="text-3xl font-black text-slate-800 relative z-10">{dashboardStats.vinculos}</p>
                                        </button>
                                        
                                        <button 
                                            onClick={() => setFiltroDashboard(filtroDashboard === 'ATUALIZACOES' ? 'TODOS' : 'ATUALIZACOES')}
                                            className={`text-left border rounded-2xl p-5 shadow-sm relative overflow-hidden transition-all cursor-pointer ${filtroDashboard === 'ATUALIZACOES' ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-200 scale-[1.02]' : 'bg-white border-amber-200 hover:border-amber-400'}`}
                                        >
                                            <div className="absolute right-[-10px] bottom-[-10px] text-amber-50/50"><RefreshCcw className="w-24 h-24" /></div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1 relative z-10">Matrículas Novas</p>
                                            <p className="text-3xl font-black text-slate-800 relative z-10">{dashboardStats.atualizacoes}</p>
                                        </button>
                                        
                                        <button 
                                            onClick={() => setFiltroDashboard(filtroDashboard === 'CONFLITOS' ? 'TODOS' : 'CONFLITOS')}
                                            className={`text-left border rounded-2xl p-5 shadow-sm relative overflow-hidden transition-all cursor-pointer ${filtroDashboard === 'CONFLITOS' ? 'bg-rose-100 border-rose-500 ring-2 ring-rose-300 scale-[1.02]' : dashboardStats.conflitosGerais > 0 ? 'bg-rose-50 border-rose-300 hover:border-rose-400 ring-2 ring-rose-100' : 'bg-white border-rose-200 hover:border-rose-300'}`}
                                        >
                                            <div className="absolute right-[-10px] bottom-[-10px] text-rose-500/10"><AlertTriangle className="w-24 h-24" /></div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 mb-1 relative z-10">Ação Necessária</p>
                                            <p className="text-3xl font-black text-rose-700 relative z-10">{dashboardStats.conflitosGerais}</p>
                                        </button>
                                        
                                        <button 
                                            onClick={() => setFiltroDashboard(filtroDashboard === 'ERROS' ? 'TODOS' : 'ERROS')}
                                            className={`text-left border rounded-2xl p-5 shadow-sm relative overflow-hidden transition-all cursor-pointer ${filtroDashboard === 'ERROS' ? 'bg-slate-100 border-slate-500 ring-2 ring-slate-200 scale-[1.02]' : 'bg-white border-slate-200 hover:border-slate-400'}`}
                                        >
                                            <div className="absolute right-[-10px] bottom-[-10px] text-slate-100"><ShieldAlert className="w-24 h-24" /></div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 relative z-10">Erros de Leitura</p>
                                            <p className="text-3xl font-black text-slate-800 relative z-10">{dashboardStats.errosIniciais}</p>
                                        </button>
                                    </div>

                                    {/* TABELA DE AUDITORIA FILTRÁVEL */}
                                    <div className="flex-1 overflow-auto custom-scrollbar border border-slate-200 rounded-2xl bg-white shadow-sm mb-6">
                                        <table className="w-full text-left text-[10px] whitespace-nowrap">
                                            <thead className="bg-slate-100 font-black text-slate-500 uppercase tracking-widest sticky top-0 z-10 shadow-sm border-b border-slate-200">
                                                <tr>
                                                    <th className="p-4 pl-6">Relatório de Decisão</th>
                                                    <th className="p-4">CPF Analisado</th>
                                                    <th className="p-4">Matrícula (TECACE)</th>
                                                    <th className="p-4">Nome do Aluno</th>
                                                    <th className="p-4">Ação Especial</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {dadosExibicao.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="5" className="p-10 text-center text-slate-400 font-bold uppercase tracking-widest">
                                                            Nenhum registro encontrado para este filtro.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    dadosExibicao.map((linha) => {
                                                        const i = previewData.indexOf(linha);
                                                        
                                                        const isNovo = linha.status === 'NOVO ALUNO' || linha.status === 'NOVO VÍNCULO';
                                                        const isAtualizar = linha.status === 'ATUALIZAR MATRÍCULA';
                                                        const isConflito = linha.status === 'CONFLITO GRAVE';
                                                        const isIgnorado = linha.status === 'JÁ NESTA UNIDADE';
                                                        
                                                        let rowBg = isNovo ? 'bg-emerald-50/20 hover:bg-emerald-50/50' 
                                                                  : isAtualizar ? 'bg-amber-50/30 hover:bg-amber-50/60' 
                                                                  : isIgnorado ? 'bg-slate-50/50' 
                                                                  : 'bg-rose-50 hover:bg-rose-100';

                                                        let badgeColor = isNovo ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                                                         : isAtualizar ? 'bg-amber-100 text-amber-700 border-amber-300'
                                                                         : isIgnorado ? 'bg-slate-100 text-slate-500 border-slate-200'
                                                                         : 'bg-rose-600 text-white border-rose-700';

                                                        if (isConflito && linha.forcarTroca) {
                                                            rowBg = 'bg-emerald-50 border-emerald-200';
                                                            badgeColor = 'bg-emerald-500 text-white border-emerald-600';
                                                        }

                                                        const displayStatus = (isConflito && linha.forcarTroca) ? 'TROCA APROVADA' : linha.status;

                                                        return (
                                                            <tr key={i} className={`transition-colors ${rowBg}`}>
                                                                <td className="p-4 pl-6">
                                                                    <span className={`px-2.5 py-1 rounded-md border font-black uppercase tracking-widest text-[9px] shadow-sm ${badgeColor}`}>
                                                                        {displayStatus}
                                                                    </span>
                                                                </td>
                                                                <td className="p-4 font-mono font-bold text-slate-700">{linha.cpf_mascarado || '—'}</td>
                                                                <td className="p-4">
                                                                    <div className="flex flex-col gap-1">
                                                                        <span className={`font-black ${isAtualizar ? 'text-amber-600' : isConflito ? 'text-rose-600' : 'text-slate-600'}`}>
                                                                            {linha.matricula || '-'}
                                                                        </span>
                                                                        {linha.matriculaAntiga && (
                                                                            <span className="text-[9px] font-bold text-slate-400 line-through">Antiga: {linha.matriculaAntiga}</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="p-4 font-bold text-slate-800 uppercase">{linha.nome}</td>
                                                                
                                                                <td className="p-4">
                                                                    {isConflito && (
                                                                        <div className="flex flex-col gap-1.5 items-start">
                                                                            <span className="text-rose-600 font-bold text-[9px] max-w-xs whitespace-normal leading-tight">
                                                                                {linha.conflitoMsg}
                                                                            </span>
                                                                            <button 
                                                                                onClick={() => handleForcarTroca(i)}
                                                                                className={`px-3 py-1.5 rounded font-black text-[9px] uppercase tracking-widest transition-all ${linha.forcarTroca ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm'}`}
                                                                            >
                                                                                {linha.forcarTroca ? 'Desfazer' : 'Confirmar e Roubar Matrícula'}
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                    {!isConflito && <span className="text-slate-300">-</span>}
                                                                </td>
                                                            </tr>
                                                        )
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* RODAPÉ E AÇÕES DE IMPORTAÇÃO */}
                                    <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-sm shrink-0 gap-4">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            {previewData.length} Linhas • {dashboardStats.totalParaImportar} prontas para aplicar na nuvem.
                                        </div>
                                        <div className="flex gap-3 w-full sm:w-auto">
                                            <button onClick={handleCloseModal} className="flex-1 sm:flex-none px-6 py-3.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors">Voltar</button>
                                            <button onClick={importarAlunosValidos} disabled={importando || dashboardStats.totalParaImportar === 0} className="flex-1 sm:flex-none px-8 py-3.5 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                                {importando ? (
                                                    <><Loader2 className="w-4 h-4 animate-spin" /> SALVANDO: {progresso}%</>
                                                ) : (
                                                    <><Save className="w-4 h-4" /> APLICAR ATUALIZAÇÕES</>
                                                )}
                                            </button>
                                        </div>
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