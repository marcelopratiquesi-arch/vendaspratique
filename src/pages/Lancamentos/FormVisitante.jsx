import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import { getLocalDateISO } from './utils.js';
import { mascaraCPF, validarCPF } from '../CadastroGeral/utilsAlunos.js';
import { buscarAlunosNaRede, buscarUnidadesDoAluno } from '../Alunos/utils.js';
import ModalAluno from '../../components/Modals/ModalAluno.jsx';
import EtiquetasUnidade from '../../components/EtiquetasUnidade.jsx';
import { UserPlus, Target, Send, Loader2, CheckCircle2, Briefcase, AlertTriangle, UserRoundPen, Search, RefreshCw, PhoneOff } from 'lucide-react';
import { avisar } from '../../components/avisar.js';

const apenasDigitos = (valor) => String(valor || '').replace(/\D/g, '');

// Só para exibir na lista de sugestões (nunca mostra o CPF inteiro)
const cpfParcial = (cpf) => {
    const n = apenasDigitos(cpf);
    if (n.length !== 11) return '';
    return `***.${n.slice(3, 6)}.${n.slice(6, 9)}-**`;
};

// Atalhos para o campo "Interesse principal"
const INTERESSES_RAPIDOS = ['MUSCULAÇÃO', 'EMAGRECIMENTO', 'HIPERTROFIA', 'AULAS COLETIVAS', 'QUALIDADE DE VIDA'];

const FormVisitante = ({ usuarioLogado, unidades, colaboradores, voltarHub }) => {
    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';

    const [leadForm, setLeadForm] = useState({
        unidade: temVisaoGlobal ? '' : (usuarioLogado?.unidade || ''), 
        interesse: '', 
        vendedor: '', 
        observacao: ''
    });

    // 🔥 IDENTIDADE BLINDADA DO VISITANTE
    // "cpfBusca" é o texto do campo: nome, matrícula ou CPF. Ao escolher alguém, passa a mostrar o CPF.
    const [cpfBusca, setCpfBusca] = useState('');
    const [cpfErro, setCpfErro] = useState(false);
    const [buscandoCpf, setBuscandoCpf] = useState(false);
    const [alunoEncontrado, setAlunoEncontrado] = useState(null); 
    const [statusCpf, setStatusCpf] = useState(null); 
    const [modalAlunoAberto, setModalAlunoAberto] = useState(false);
    const debounceRef = useRef(null);
    const cpfAtualRef = useRef('');          // descarta respostas de buscas antigas
    const envioTravadoRef = useRef(false);   // impede envio em dobro

    // 🔎 Sugestões por nome / matrícula
    const [sugestoes, setSugestoes] = useState([]);
    const [buscandoLista, setBuscandoLista] = useState(false);
    const [listaAberta, setListaAberta] = useState(false);
    const [indiceLista, setIndiceLista] = useState(0);
    const [erroLista, setErroLista] = useState(false);
    const listaDebounceRef = useRef(null);
    const listaAbortRef = useRef(null);
    const inputClienteRef = useRef(null);
    const campoClienteRef = useRef(null);

    const [sucesso, setSucesso] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Unidade(s) de origem da pessoa escolhida (só para mostrar; a visita fica na unidade de quem atende)
    const [unidadesAluno, setUnidadesAluno] = useState([]);
    const unidadeMinha = temVisaoGlobal ? leadForm.unidade : (usuarioLogado?.unidade || '');

    useEffect(() => {
        const id = alunoEncontrado?.id;
        if (!id) { setUnidadesAluno([]); return undefined; }
        if (Array.isArray(alunoEncontrado.unidades)) { setUnidadesAluno(alunoEncontrado.unidades); return undefined; }
        let ativo = true;
        buscarUnidadesDoAluno(id).then(lista => { if (ativo) setUnidadesAluno(lista); });
        return () => { ativo = false; };
    }, [alunoEncontrado]);

    // Cursor no campo ao abrir; limpa temporizadores ao sair
    useEffect(() => {
        inputClienteRef.current?.focus();
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (listaDebounceRef.current) clearTimeout(listaDebounceRef.current);
            listaAbortRef.current?.abort();
        };
    }, []);

    useEffect(() => {
        if (!listaAberta) return undefined;
        const aoClicar = (e) => {
            if (campoClienteRef.current && !campoClienteRef.current.contains(e.target)) setListaAberta(false);
        };
        document.addEventListener('mousedown', aoClicar);
        return () => document.removeEventListener('mousedown', aoClicar);
    }, [listaAberta]);

    const vendedoresDaUnidade = colaboradores.filter(c => {
        const isAtivo = c.ativo !== false;
        const matchUnidade = temVisaoGlobal 
            ? c.unidade?.toUpperCase() === leadForm.unidade?.toUpperCase()
            : c.unidade?.toUpperCase() === usuarioLogado?.unidade?.toUpperCase();
        return isAtivo && matchUnidade;
    });

    // O visitante carregado precisa ter CPF válido e bater com o campo
    const cpfConfere = Boolean(alunoEncontrado)
        && apenasDigitos(alunoEncontrado.cpf).length === 11
        && apenasDigitos(alunoEncontrado.cpf) === apenasDigitos(cpfBusca);

    const semTelefone = cpfConfere && apenasDigitos(alunoEncontrado.telefone).length < 10;

    // ==========================================
    // BUSCA POR CPF (dois formatos + detecção de cadastro duplicado)
    // ==========================================
    const buscarAlunoPorCpf = async (cpfLimpo) => {
        setBuscandoCpf(true);
        setStatusCpf(null);
        try {
            const cpfFormatado = mascaraCPF(cpfLimpo);
            const { data, error } = await supabase
                .from('alunos')
                .select('*')
                .or(`cpf.eq.${cpfLimpo},cpf.eq."${cpfFormatado}"`)
                .limit(2);

            if (cpfAtualRef.current !== cpfLimpo) return;
            if (error) throw error;

            const encontrados = data || [];
            if (encontrados.length > 1) {
                setAlunoEncontrado(null);
                setStatusCpf('duplicado');
            } else if (encontrados.length === 1) {
                setAlunoEncontrado(encontrados[0]);
                setStatusCpf('encontrado');
            } else {
                setAlunoEncontrado(null);
                setStatusCpf('novo');
            }
        } catch (error) {
            if (cpfAtualRef.current !== cpfLimpo) return;
            console.error(error);
            setAlunoEncontrado(null);
            setStatusCpf('erro');
        } finally {
            if (cpfAtualRef.current === cpfLimpo) setBuscandoCpf(false);
        }
    };

    // ==========================================
    // 🔎 BUSCA POR NOME / MATRÍCULA
    // ==========================================
    const fecharLista = () => {
        if (listaDebounceRef.current) clearTimeout(listaDebounceRef.current);
        listaAbortRef.current?.abort();
        setListaAberta(false);
        setSugestoes([]);
        setBuscandoLista(false);
        setErroLista(false);
    };

    const buscarLista = (termo) => {
        if (listaDebounceRef.current) clearTimeout(listaDebounceRef.current);
        listaAbortRef.current?.abort();

        const minimo = /^\d+$/.test(termo) ? 3 : 2;
        if (!termo || termo.length < minimo) {
            setSugestoes([]);
            setBuscandoLista(false);
            setErroLista(false);
            setListaAberta(false);
            return;
        }

        setBuscandoLista(true);
        setErroLista(false);
        setListaAberta(true);

        listaDebounceRef.current = setTimeout(async () => {
            const controller = new AbortController();
            listaAbortRef.current = controller;
            try {
                const role = String(usuarioLogado?.role || '').toUpperCase().trim();
                // Rede inteira, com a unidade de quem atende primeiro (regra 8 do CLAUDE.md)
                const { alunos } = await buscarAlunosNaRede({
                    busca: termo,
                    unidadePreferida: unidadeMinha,
                    limite: 6,
                    roleUsuario: role,
                    signal: controller.signal,
                });
                if (controller.signal.aborted) return;
                setSugestoes(alunos || []);
                setIndiceLista(0);
            } catch (err) {
                if (controller.signal.aborted || err?.name === 'AbortError') return;
                console.error('Erro na busca de visitantes:', err);
                setSugestoes([]);
                setErroLista(true);
            } finally {
                if (!controller.signal.aborted) setBuscandoLista(false);
            }
        }, 300);
    };

    const selecionarDaLista = (aluno) => {
        fecharLista();
        if (!aluno) return;

        // A unidade da visita é sempre a de quem atende, nunca a de origem do aluno (regra 8 do CLAUDE.md)
        const cpfDig = apenasDigitos(aluno.cpf);
        cpfAtualRef.current = cpfDig.length === 11 ? cpfDig : '';
        setCpfBusca(cpfDig.length === 11 ? mascaraCPF(cpfDig) : (aluno.nome || ''));
        setAlunoEncontrado(aluno);
        setStatusCpf(cpfDig.length === 11 ? 'encontrado' : 'semcpf');
        setCpfErro(false);
    };

    const trocarPessoa = () => {
        fecharLista();
        if (debounceRef.current) clearTimeout(debounceRef.current);
        cpfAtualRef.current = '';
        setCpfBusca('');
        setAlunoEncontrado(null);
        setStatusCpf(null);
        setBuscandoCpf(false);
        setCpfErro(false);
        requestAnimationFrame(() => inputClienteRef.current?.focus());
    };

    const handleClienteChange = (e) => {
        const bruto = e.target.value;
        const digitos = apenasDigitos(bruto);
        const temLetra = /[a-zA-ZÀ-ÿ]/.test(bruto);

        setAlunoEncontrado(null); 
        setStatusCpf(null);
        setBuscandoCpf(false);
        setCpfErro(false);
        cpfAtualRef.current = '';
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (!temLetra && digitos.length === 11) {
            const masked = mascaraCPF(digitos);
            setCpfBusca(masked);
            if (!validarCPF(masked)) {
                setCpfErro(true);
                buscarLista(digitos);
                return;
            }
            fecharLista();
            cpfAtualRef.current = digitos;
            debounceRef.current = setTimeout(() => buscarAlunoPorCpf(digitos), 500);
            return;
        }

        setCpfBusca(bruto);
        buscarLista(temLetra ? bruto.trim() : digitos);
    };

    const aoTeclarCliente = (e) => {
        if (e.key === 'Enter') e.preventDefault(); // Enter aqui nunca envia o formulário
        if (!listaAberta || sugestoes.length === 0) {
            if (e.key === 'Escape') fecharLista();
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIndiceLista(i => (i + 1) % sugestoes.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setIndiceLista(i => (i - 1 + sugestoes.length) % sugestoes.length);
        } else if (e.key === 'Enter') {
            selecionarDaLista(sugestoes[indiceLista] || sugestoes[0]);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            fecharLista();
        }
    };

    const abrirCadastro = () => {
        if (temVisaoGlobal && !leadForm.unidade) return avisar('Selecione a unidade da visita antes de cadastrar ou editar.');
        setModalAlunoAberto(true);
    };

    const handleSaveAlunoSuccess = (alunoAtualizado) => {
        cpfAtualRef.current = apenasDigitos(alunoAtualizado.cpf);
        setAlunoEncontrado(alunoAtualizado);
        setCpfBusca(mascaraCPF(alunoAtualizado.cpf)); 
        setStatusCpf('encontrado');
    };

    const handleLeadChange = (e) => {
        const { name, value } = e.target;
        if (name === 'unidade') {
            setLeadForm({ ...leadForm, unidade: value, vendedor: '' });
            return;
        }
        setLeadForm({ ...leadForm, [name]: value });
    };

    const escolherInteresse = (valor) => {
        setLeadForm(prev => ({ ...prev, interesse: prev.interesse === valor ? '' : valor }));
    };

    const handleSubmitVisitante = async (e) => {
        e.preventDefault();
        if (envioTravadoRef.current || isSubmitting || sucesso) return;

        if (!alunoEncontrado) return avisar('Busque o visitante pelo nome, CPF ou matrícula primeiro.');
        if (!cpfConfere) return avisar('O visitante precisa ter um CPF válido no cadastro. Complete o cadastro antes de continuar.');
        if (temVisaoGlobal && !leadForm.unidade) return avisar('Selecione a Unidade do visitante.');
        if (!leadForm.vendedor) return avisar('Selecione o consultor que atendeu o visitante.');

        envioTravadoRef.current = true;
        setIsSubmitting(true);
        try {
            const agora = new Date().toISOString();
            const vendedorSelecionado = leadForm.vendedor.toUpperCase();

            const novoLead = {
                unidade: leadForm.unidade.toUpperCase(),
                data: getLocalDateISO(), 
                nome: String(alunoEncontrado.nome || '').toUpperCase(),
                cpf: apenasDigitos(alunoEncontrado.cpf), 
                telefone: alunoEncontrado.telefone || '',
                interesse: leadForm.interesse.trim().toUpperCase(), 
                vendedor: vendedorSelecionado, 
                observacao: leadForm.observacao,
                origem: 'RECEPCAO', 
                status: 'Novo', 
                data_criacao: agora,
                criado_por: usuarioLogado?.nome || 'SISTEMA',
                puxado_em: agora,
                puxado_por: vendedorSelecionado
            };

            const { error } = await supabase.from('leads').insert([novoLead]);
            
            if (error) {
                envioTravadoRef.current = false;
                if (error.code === '23505') {
                    avisar(`🚨 BLOQUEADO: este CPF já está no funil do CRM.\n\nSe for um retorno, peça ao consultor responsável para procurá-lo na aba "Base" ou "Geladeira" do CRM.`);
                    return; 
                }
                throw error; 
            }
            
            setSucesso(true);
            setTimeout(() => {
                setSucesso(false);
                if (voltarHub) voltarHub();
                else envioTravadoRef.current = false;
            }, 1200); 

        } catch (error) {
            envioTravadoRef.current = false;
            console.error("Erro:", error); 
            avisar("Não foi possível salvar o visitante. Tente novamente.");
        } finally { 
            setIsSubmitting(false); 
        }
    };

    const labelClass = "block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 dark:text-slate-400";
    const inputClassBase = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all shadow-sm placeholder:text-slate-400 dark:bg-slate-800/60 dark:border-slate-800 dark:text-white dark:focus:bg-slate-900";
    const sectionClass = "bg-white p-6 md:p-8 rounded-[24px] border border-slate-200 shadow-sm dark:bg-slate-900 dark:border-slate-800";

    const mostrarLista = listaAberta && !alunoEncontrado;

    return (
        <>
            <ModalAluno 
                isOpen={modalAlunoAberto} 
                onClose={() => setModalAlunoAberto(false)} 
                alunoInicial={alunoEncontrado || { cpf: cpfBusca }} 
                onSaveSuccess={handleSaveAlunoSuccess} 
                usuarioLogado={usuarioLogado}
                unidadeDestino={leadForm.unidade}
            />

            <form onSubmit={handleSubmitVisitante} className="max-w-3xl mx-auto space-y-6 animate-[fadeIn_0.3s_ease-out] pb-10">
                
                {sucesso && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
                        <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center animate-[zoomIn_0.2s_ease-out] max-w-sm w-full mx-4 border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                            <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-inner border border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30">
                                <CheckCircle2 className="w-10 h-10" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2 dark:text-white">Visitante registrado!</h3>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest dark:text-slate-400">Enviado direto para o Funil CRM.</p>
                        </div>
                    </div>
                )}

                {/* 1. IDENTIFICAÇÃO */}
                <div className={sectionClass}>
                    <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100 dark:border-slate-800">
                        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 dark:text-white">
                            <UserPlus className="w-6 h-6 text-blue-500" /> Cadastro de Visitante
                        </h3>
                        <span className="bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-blue-200 shadow-sm dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30">Vai para CRM</span>
                    </div>

                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col md:flex-row md:items-start gap-6">
                            <div className="relative w-full md:flex-1" ref={campoClienteRef}>
                                <label className={labelClass}>Visitante * <span className="normal-case tracking-normal font-bold text-slate-400">(nome, CPF ou matrícula)</span></label>
                                <div className="relative">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    <input
                                        ref={inputClienteRef}
                                        type="text"
                                        value={cpfBusca}
                                        onChange={handleClienteChange}
                                        onKeyDown={aoTeclarCliente}
                                        onFocus={() => { if (sugestoes.length > 0 && !alunoEncontrado) setListaAberta(true); }}
                                        maxLength="80"
                                        autoComplete="off"
                                        role="combobox"
                                        aria-expanded={mostrarLista}
                                        aria-controls="lista-visitantes"
                                        className={`${inputClassBase} pl-10 pr-10 ${cpfErro ? 'border-rose-300 bg-rose-50 focus:ring-rose-500 dark:border-rose-500/30 dark:bg-rose-500/10' : ''}`}
                                        placeholder="Para visitante novo, digite o CPF"
                                    />
                                    {(buscandoCpf || buscandoLista) && <Loader2 className="w-4 h-4 text-blue-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
                                    {!buscandoCpf && !buscandoLista && cpfConfere && <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2" />}
                                    {!buscandoCpf && (statusCpf === 'erro' || statusCpf === 'duplicado') && <AlertTriangle className="w-4 h-4 text-rose-500 absolute right-3 top-1/2 -translate-y-1/2" />}
                                </div>

                                {mostrarLista && (
                                    <div id="lista-visitantes" role="listbox" className="absolute left-0 right-0 top-full mt-2 z-30 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden dark:bg-slate-900 dark:border-slate-800">
                                        {buscandoLista && sugestoes.length === 0 && (
                                            <p className="px-4 py-4 text-[11px] font-bold text-slate-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando...</p>
                                        )}
                                        {!buscandoLista && erroLista && (
                                            <p className="px-4 py-4 text-[11px] font-bold text-rose-600 dark:text-rose-400">Não foi possível buscar agora. Tente de novo ou digite o CPF completo.</p>
                                        )}
                                        {!buscandoLista && !erroLista && sugestoes.length === 0 && (
                                            <p className="px-4 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400">Ninguém encontrado. Para cadastrar um visitante novo, digite o CPF completo.</p>
                                        )}
                                        {sugestoes.map((aluno, i) => (
                                            <button
                                                key={aluno.id ?? `${aluno.nome}-${i}`}
                                                type="button"
                                                role="option"
                                                aria-selected={i === indiceLista}
                                                onMouseEnter={() => setIndiceLista(i)}
                                                onClick={() => selecionarDaLista(aluno)}
                                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${i === indiceLista ? 'bg-blue-50 dark:bg-blue-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'} ${buscandoLista ? 'opacity-60' : ''}`}
                                            >
                                                <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center text-xs font-black shrink-0 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-300">
                                                    {String(aluno.nome || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[13px] font-black text-slate-800 uppercase truncate dark:text-white">{aluno.nome}</p>
                                                    <p className="text-[10px] font-bold text-slate-500 flex flex-wrap items-center gap-x-3 mt-0.5 dark:text-slate-400">
                                                        {aluno.matricula && <span>Mat: {aluno.matricula}</span>}
                                                        {cpfParcial(aluno.cpf) && <span>{cpfParcial(aluno.cpf)}</span>}
                                                        <EtiquetasUnidade unidades={aluno.unidades || (aluno.unidade ? [aluno.unidade] : [])} unidadeMinha={unidadeMinha} />
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {cpfErro && <span className="text-rose-500 text-[10px] font-bold uppercase mt-1 ml-1">CPF Inválido</span>}
                                {statusCpf === 'encontrado' && <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1.5 ml-1 dark:text-emerald-400">Visitante / Aluno localizado</p>}
                                {statusCpf === 'novo' && <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mt-1.5 ml-1 dark:text-amber-400">Pessoa nova (cadastrar)</p>}
                                {statusCpf === 'duplicado' && <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mt-1.5 ml-1 dark:text-rose-400">CPF com mais de um cadastro</p>}
                            </div>

                            {/* Unidade fica aqui em cima: é preciso escolher antes de cadastrar alguém novo */}
                            {temVisaoGlobal && (
                                <div className="w-full md:w-64">
                                    <label className={labelClass}>Unidade da Visita *</label>
                                    <select name="unidade" value={leadForm.unidade} onChange={handleLeadChange} required className={inputClassBase}>
                                        <option value="">Selecione...</option>
                                        {unidades.map(u => <option key={u.id || u.nome} value={u.nome}>{u.nome}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>

                        {statusCpf === 'semcpf' && alunoEncontrado && (
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-inner flex flex-col md:flex-row justify-between items-center gap-4 animate-[fadeIn_0.3s_ease-out] dark:bg-amber-500/10 dark:border-amber-500/30">
                                <div>
                                    <h4 className="text-sm font-black text-amber-800 uppercase tracking-tight mb-1 dark:text-amber-300">{alunoEncontrado.nome}</h4>
                                    <p className="text-xs font-bold text-amber-700/80">Esta pessoa não tem CPF no cadastro. Complete o cadastro para enviar ao CRM.</p>
                                    <EtiquetasUnidade unidades={unidadesAluno} unidadeMinha={unidadeMinha} className="mt-2" />
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto shrink-0">
                                    <button type="button" onClick={trocarPessoa} className="px-5 py-2.5 bg-white border border-amber-200 text-amber-700 hover:bg-amber-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-sm dark:bg-slate-900 dark:border-amber-500/30 dark:text-amber-400 dark:hover:bg-amber-500/20">
                                        <RefreshCw className="w-4 h-4" /> Trocar pessoa
                                    </button>
                                    <button type="button" onClick={abrirCadastro} className="px-5 py-2.5 bg-amber-500 text-white hover:bg-amber-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-sm">
                                        <UserRoundPen className="w-4 h-4" /> Completar cadastro
                                    </button>
                                </div>
                            </div>
                        )}

                        {!buscandoCpf && statusCpf === 'duplicado' && (
                            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 shadow-inner flex items-start gap-3 animate-[fadeIn_0.3s_ease-out] dark:bg-rose-500/10 dark:border-rose-500/30">
                                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 dark:text-rose-400" />
                                <div>
                                    <h4 className="text-sm font-black text-rose-800 uppercase tracking-tight mb-1 dark:text-rose-300">CPF com mais de um cadastro</h4>
                                    <p className="text-xs font-bold text-rose-700/80">Existe mais de um cadastro com este CPF. Para não enviar a pessoa errada ao CRM, peça ao gestor para corrigir os cadastros antes de continuar.</p>
                                </div>
                            </div>
                        )}

                        {!buscandoCpf && cpfBusca.length === 14 && !cpfErro && (statusCpf === 'encontrado' || statusCpf === 'novo') && (
                            cpfConfere ? (
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-inner flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-[fadeIn_0.3s_ease-out] dark:bg-slate-800/60 dark:border-slate-800">
                                    <div>
                                        <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 mb-2 dark:text-white">{alunoEncontrado.nome} <CheckCircle2 className="w-4 h-4 text-emerald-500" /></h4>
                                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                                            {alunoEncontrado.telefone && <span className="flex items-center gap-1">📞 {alunoEncontrado.telefone}</span>}
                                            {alunoEncontrado.email && <span className="flex items-center gap-1">✉️ {alunoEncontrado.email}</span>}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest dark:text-slate-400">
                                            Unidade de origem: <EtiquetasUnidade unidades={unidadesAluno} unidadeMinha={unidadeMinha} />
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto shrink-0">
                                        <button type="button" onClick={trocarPessoa} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800">
                                            <RefreshCw className="w-4 h-4" /> Trocar pessoa
                                        </button>
                                        <button type="button" onClick={abrirCadastro} className="px-5 py-2.5 bg-white border border-slate-200 text-blue-600 hover:bg-blue-50 hover:border-blue-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-sm dark:bg-slate-900 dark:border-slate-800 dark:text-blue-400 dark:hover:bg-blue-500/10 dark:hover:border-blue-500/30">
                                            <UserRoundPen className="w-4 h-4" /> Editar Cadastro
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-inner flex flex-col md:flex-row justify-between items-center gap-4 animate-[fadeIn_0.3s_ease-out] dark:bg-amber-500/10 dark:border-amber-500/30">
                                    <div>
                                        <h4 className="text-sm font-black text-amber-800 uppercase tracking-tight mb-1 dark:text-amber-300">Registro Inexistente</h4>
                                        <p className="text-xs font-bold text-amber-700/70">Esta pessoa ainda não possui cadastro.</p>
                                    </div>
                                    <button type="button" onClick={abrirCadastro} className="w-full md:w-auto px-5 py-2.5 bg-amber-500 text-white hover:bg-amber-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-sm shrink-0">
                                        <UserPlus className="w-4 h-4" /> Cadastrar Visitante Rápido
                                    </button>
                                </div>
                            )
                        )}

                        {semTelefone && (
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 dark:bg-amber-500/10 dark:border-amber-500/30">
                                <p className="text-xs font-bold text-amber-800 flex items-center gap-2 dark:text-amber-300">
                                    <PhoneOff className="w-4 h-4 shrink-0" /> Sem telefone no cadastro: o consultor não vai conseguir retornar o contato.
                                </p>
                                <button type="button" onClick={abrirCadastro} className="px-4 py-2 bg-white border border-amber-200 text-amber-700 hover:bg-amber-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors shrink-0 dark:bg-slate-900 dark:border-amber-500/30 dark:text-amber-400 dark:hover:bg-amber-500/20">
                                    Adicionar telefone
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. DADOS DA VISITA */}
                <div className={`transition-all duration-500 ${!cpfConfere ? 'opacity-30 pointer-events-none grayscale-[50%]' : 'opacity-100'}`}>
                    <div className={sectionClass}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <label className={labelClass}>Interesse Principal</label>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {INTERESSES_RAPIDOS.map(op => {
                                        const ativo = leadForm.interesse.trim().toUpperCase() === op;
                                        return (
                                            <button
                                                key={op}
                                                type="button"
                                                onClick={() => escolherInteresse(op)}
                                                disabled={!cpfConfere}
                                                aria-pressed={ativo}
                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-colors ${ativo ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:border-blue-500/30 dark:hover:text-blue-400'}`}
                                            >
                                                {op}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <Target className="w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                    </div>
                                    <input type="text" name="interesse" value={leadForm.interesse} onChange={handleLeadChange} placeholder="Ou escreva: Ex. Musculação com foco em pernas..." className={`${inputClassBase} pl-10 pr-4 uppercase disabled:opacity-50`} disabled={!cpfConfere} />
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className={labelClass}>Consultor Responsável *</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <Briefcase className="w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                    </div>
                                    <select name="vendedor" value={leadForm.vendedor} onChange={handleLeadChange} required disabled={!cpfConfere || (temVisaoGlobal && !leadForm.unidade)} className={`${inputClassBase} pl-10 pr-4 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed uppercase dark:disabled:bg-slate-800`}>
                                        <option value="">{(temVisaoGlobal && !leadForm.unidade) ? 'Escolha a unidade...' : 'Quem atendeu?'}</option>
                                        {vendedoresDaUnidade.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className={labelClass}>Detalhes da Conversa / Observação</label>
                                <textarea name="observacao" value={leadForm.observacao} onChange={handleLeadChange} disabled={!cpfConfere} rows="3" placeholder="Anotações importantes sobre o que o cliente procura..." className={`${inputClassBase} px-4 resize-none`}></textarea>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end dark:border-slate-800">
                            <button type="submit" disabled={isSubmitting || sucesso || !cpfConfere} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 font-black uppercase tracking-widest py-4 px-10 rounded-2xl shadow-sm transition-all duration-200 flex justify-center items-center gap-2 text-xs active:scale-[0.98]">
                                {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Inserindo no CRM...</> : <><Send className="w-5 h-5" /> Enviar para o Funil CRM</>}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </>
    );
};

export default FormVisitante;