import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import { UserRoundPen, X, Loader2, Save, UserPlus, AlertTriangle, Link, ArrowRightLeft } from 'lucide-react';
import { normalizarNome, normalizarNumeros, formatarTelefone, validarEmail, validarTelefone, calcularIdade, mascaraCPF } from '../../pages/CadastroGeral/utilsAlunos.js';
import { buscarUnidadesDoAluno, moverVinculoAlunos, mesmaUnidade } from '../../pages/Alunos/utils.js';
import { useI18n } from '../../i18n/I18nContext.jsx'; 

const ModalAluno = ({ isOpen, onClose, alunoInicial, onSaveSuccess, usuarioLogado, unidadeDestino }) => {
    const { t } = useI18n(); 
    
    // 🔥 CORREÇÃO 2: DETERMINAÇÃO BLINDADA DA UNIDADE (Fim dos alunos "sem dono")
    const resolveUnidade = () => {
        let u = unidadeDestino || alunoInicial?.unidade_vinculo || usuarioLogado?.unidade || '';
        // Se a unidade vazou como 'TODAS', forçamos a pegar a do aluno ou retornar vazio
        if (u === 'TODAS' || u === 'GLOBAL') {
            u = alunoInicial?.unidade_vinculo || '';
        }
        return u.toUpperCase().trim();
    };
    const unidadeAtiva = resolveUnidade();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({ id: null, nome: '', cpf: '', matricula: '', telefone: '', email: '', data_nascimento: '' });
    const [idade, setIdade] = useState(null);

    // REGRA: um vínculo por aluno, na unidade onde ele consome. Editar aluno de outra unidade NÃO cria vínculo:
    // só atualiza os dados pessoais. Para mudar a unidade existe o botão "Transferir para minha unidade".
    const [vinculosAluno, setVinculosAluno] = useState([]); // nomes das unidades ligadas ao aluno
    const [carregandoVinculo, setCarregandoVinculo] = useState(false);
    const [modoTransferir, setModoTransferir] = useState(false);

    // ESTADOS PARA VALIDAÇÃO EM TEMPO REAL
    const [erroMatricula, setErroMatricula] = useState('');
    const [verificandoMatricula, setVerificandoMatricula] = useState(false);

    const [erroTelefone, setErroTelefone] = useState('');
    const [verificandoTelefone, setVerificandoTelefone] = useState(false);

    const [erroEmail, setErroEmail] = useState('');
    const [verificandoEmail, setVerificandoEmail] = useState(false);

    // 🔥 CORREÇÃO 1: FIM DO BUG "DIGITA E APAGA" (Dependency Array Ajustado)
    useEffect(() => {
        if (isOpen) {
            setFormData({
                id: alunoInicial?.id || null,
                nome: alunoInicial?.nome || '',
                cpf: alunoInicial?.cpf ? mascaraCPF(alunoInicial.cpf) : '',
                matricula: alunoInicial?.matricula || '',
                telefone: alunoInicial?.telefone ? formatarTelefone(alunoInicial.telefone) : '',
                email: (alunoInicial?.email || '').toLowerCase(),
                data_nascimento: alunoInicial?.data_nascimento || ''
            });
            setErroMatricula('');
            setErroTelefone('');
            setErroEmail('');
            setModoTransferir(false);
            setVinculosAluno([]);
        }
    }, [isOpen, alunoInicial?.id]); // 👈 A mágica está aqui: não dependemos mais da referência do objeto, apenas do ID.

    // Onde está o vínculo do aluno (consulta segura: enxerga também as outras unidades)
    useEffect(() => {
        if (!isOpen || !alunoInicial?.id) return undefined;
        let ativo = true;
        setCarregandoVinculo(true);
        buscarUnidadesDoAluno(alunoInicial.id)
            .then(lista => { if (ativo) setVinculosAluno(lista); })
            .finally(() => { if (ativo) setCarregandoVinculo(false); });
        return () => { ativo = false; };
    }, [isOpen, alunoInicial?.id]);

    // NOVO: aluno novo · SEM_VINCULO: existe mas não tem unidade · MINHA: vínculo nesta unidade
    // OUTRA: vínculo em outra unidade (só edita dados pessoais) · a etiqueta "multiplo" avisa casos antigos com 2+ vínculos
    const temVinculoAqui = vinculosAluno.some(u => mesmaUnidade(u, unidadeAtiva));
    const situacao = !formData.id ? 'NOVO'
        : carregandoVinculo ? 'CARREGANDO'
        : vinculosAluno.length === 0 ? 'SEM_VINCULO'
        : temVinculoAqui ? 'MINHA'
        : 'OUTRA';
    const vinculoMultiplo = vinculosAluno.length > 1;
    const unidadesDeFora = vinculosAluno.filter(u => !mesmaUnidade(u, unidadeAtiva));
    // Só edita dados pessoais (não mexe em vínculo nem em matrícula)
    const somenteDadosPessoais = situacao === 'OUTRA' && !modoTransferir;
    const podeTransferir = Boolean(unidadeAtiva) && (situacao === 'OUTRA' || (situacao === 'MINHA' && vinculoMultiplo));

    const iniciarTransferencia = () => {
        setModoTransferir(true);
        // A matrícula é da unidade nova: começa em branco quando o aluno vem de outra unidade
        if (situacao === 'OUTRA') setFormData(prev => ({ ...prev, matricula: '' }));
        setErroMatricula('');
    };

    const cancelarTransferencia = () => {
        setModoTransferir(false);
        setFormData(prev => ({ ...prev, matricula: alunoInicial?.matricula || '' }));
        setErroMatricula('');
    };

    useEffect(() => {
        setIdade(calcularIdade(formData.data_nascimento));
    }, [formData.data_nascimento]);

    // ==========================================
    // HELPERS CIRÚRGICOS PARA TELEFONE
    // ==========================================
    const validatePhoneStrict = (rawPhone) => {
        if (!rawPhone) return ''; 
        if (/^\s|\s$/.test(rawPhone) || /[\t\n\r]/.test(rawPhone)) return t('validation.phoneWhitespace', {defaultValue: '🚨 REMOVA OS ESPAÇOS INDEVIDOS DO TELEFONE.'});
        if (/[a-zA-Z]/.test(rawPhone) || /[^\d\s()+-]/.test(rawPhone)) return t('validation.phoneInvalidCharacters', {defaultValue: '🚨 INFORME APENAS UM NÚMERO DE TELEFONE VÁLIDO.'});
        const digitsOnly = rawPhone.replace(/\D/g, '');
        if (digitsOnly.length > 0 && digitsOnly.length < 10) return t('validation.phoneIncomplete', {defaultValue: '🚨 TELEFONE INCOMPLETO.'});
        if (digitsOnly.length > 11) return t('validation.phoneTooLong', {defaultValue: '🚨 TELEFONE POSSUI NÚMEROS DEMAIS.'});
        if (digitsOnly.length >= 10) {
            const ddd = parseInt(digitsOnly.substring(0, 2), 10);
            if (ddd < 11) return t('validation.phoneInvalidDDD', {defaultValue: '🚨 DDD INVÁLIDO.'});
        }
        return ''; 
    };

    const formatPhoneSmart = (val) => {
        if (!val) return '';
        if (
            /[a-zA-Z]/.test(val) || 
            /^\s|\s$/.test(val) || 
            /[\t\n\r]/.test(val) || 
            val.replace(/\D/g, '').length > 11 ||
            /[^\d\s()+-]/.test(val)
        ) {
            return val;
        }
        return formatarTelefone(val);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        
        if (name === 'telefone') {
            const smartVal = formatPhoneSmart(value);
            setFormData(prev => ({ ...prev, [name]: smartVal }));
            if (/[a-zA-Z]/.test(value) || /[^\d\s()+-]/.test(value)) {
                setErroTelefone(t('validation.phoneInvalidCharacters', {defaultValue: '🚨 INFORME APENAS NÚMEROS.'}));
            } else {
                setErroTelefone('');
            }
        } else if (name === 'cpf' && !formData.id) {
            setFormData(prev => ({ ...prev, [name]: mascaraCPF(value) }));
        } else if (name === 'email') {
            const rawEmail = value.toLowerCase(); 
            setFormData(prev => ({ ...prev, [name]: rawEmail }));
            if (/\s/.test(rawEmail)) setErroEmail(t('validation.emailWhitespace', {defaultValue: '🚨 REMOVA OS ESPAÇOS EM BRANCO DO E-MAIL.'}));
            else setErroEmail('');
        } else if (name === 'matricula') {
            setFormData(prev => ({ ...prev, [name]: value }));
            if (value.includes(' ')) setErroMatricula('🚨 A MATRÍCULA NÃO PODE TER ESPAÇOS.');
            else setErroMatricula('');
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    // ==========================================
    // BUSCAS BLINDADAS EM TEMPO REAL (ON BLUR)
    // ==========================================
    const handleBlurMatricula = async () => {
        if (somenteDadosPessoais) return; // a matrícula é da outra unidade e não é alterada aqui
        const matStr = formData.matricula;
        if (matStr.includes(' ')) return;
        if (!matStr || matStr.toUpperCase() === 'VISITANTE') {
            setErroMatricula(''); return;
        }

        const matNoZeros = matStr.replace(/^0+/, '');
        const matWithZero = '0' + matNoZeros;

        if (!unidadeAtiva) return; // Proteção extra

        setVerificandoMatricula(true);
        try {
            let query = supabase.from('alunos_unidades').select('id, aluno_id, alunos(nome)')
                .eq('unidade', unidadeAtiva)
                .or(`matricula.eq.${matStr},matricula.eq.${matNoZeros},matricula.eq.${matWithZero}`);
            
            if (formData.id) query = query.neq('aluno_id', formData.id);
            
            const { data, error } = await query;
            if (error) throw error;

            if (data && data.length > 0) {
                const nomeDono = data[0].alunos?.nome || 'Outro Aluno';
                setErroMatricula(`JÁ EM USO POR: ${nomeDono.toUpperCase()} (NESTA UNIDADE)`);
            } else setErroMatricula('');
        } catch (error) {
            console.error("Erro matricula:", error);
        } finally {
            setVerificandoMatricula(false);
        }
    };

    const handleBlurTelefone = async () => {
        const rawPhone = formData.telefone || '';
        const phoneError = validatePhoneStrict(rawPhone);
        if (phoneError) {
            setErroTelefone(phoneError); return;
        }
        if (!rawPhone) {
            setErroTelefone(''); return;
        }

        const telStr = rawPhone.replace(/\D/g, '');
        const telSemNove = telStr.length === 11 ? telStr.slice(0,2) + telStr.slice(3) : telStr;
        const telComNove = telStr.length === 10 ? telStr.slice(0,2) + '9' + telStr.slice(2) : telStr;

        setVerificandoTelefone(true);
        try {
            let query = supabase.from('alunos').select('id, nome')
                .or(`telefone.eq.${telStr},telefone.eq.${telSemNove},telefone.eq.${telComNove}`);
            if (formData.id) query = query.neq('id', formData.id);
            const { data, error } = await query;
            if (error) throw error;

            if (data && data.length > 0) setErroTelefone(`JÁ EM USO POR: ${data[0].nome.toUpperCase()}`);
            else setErroTelefone('');
        } catch (error) {
            console.error("Erro telefone:", error);
        } finally {
            setVerificandoTelefone(false);
        }
    };

    const handleBlurEmail = async () => {
        const rawEmail = formData.email || '';
        if (/\s/.test(rawEmail)) {
            setErroEmail(t('validation.emailWhitespace', {defaultValue: '🚨 REMOVA OS ESPAÇOS EM BRANCO DO E-MAIL.'})); return; 
        }
        if (!rawEmail) { setErroEmail(''); return; }
        if (!validarEmail(rawEmail)) { 
            setErroEmail(t('validation.emailInvalid', {defaultValue: '🚨 FORMATO DE E-MAIL INVÁLIDO.'})); return; 
        }

        setVerificandoEmail(true);
        try {
            let query = supabase.from('alunos').select('id, nome').ilike('email', rawEmail);
            if (formData.id) query = query.neq('id', formData.id);
            const { data, error } = await query;
            if (error) throw error;

            if (data && data.length > 0) setErroEmail(`JÁ EM USO POR: ${data[0].nome.toUpperCase()}`);
            else setErroEmail('');
        } catch (error) {
            console.error("Erro email:", error);
        } finally {
            setVerificandoEmail(false);
        }
    };

    // ==========================================
    // SUBMIT MULTIUNIDADE — ÚLTIMA BARREIRA
    // ==========================================
    const handleSave = async (e) => {
        e.preventDefault();
        
        if (erroMatricula || erroTelefone || erroEmail) {
            return alert("Corrija os erros apontados em vermelho antes de salvar.");
        }
        if (situacao === 'CARREGANDO') {
            return alert("Aguarde um instante: conferindo a unidade do aluno.");
        }
        
        // 🔥 BARREIRA CONTRA ALUNO "FANTASMA" SEM UNIDADE
        // (completar só os dados pessoais de um aluno de outra unidade não precisa de unidade escolhida)
        if (!unidadeAtiva && !somenteDadosPessoais) {
            return alert("🚨 ERRO CRÍTICO: Selecione uma unidade específica no topo da tela antes de cadastrar. Não é possível salvar um aluno na visão 'TODAS'.");
        }
        
        const rawEmail = formData.email || '';
        const rawMatricula = formData.matricula || '';
        const rawPhone = formData.telefone || '';

        if (/\s/.test(rawEmail)) return alert(t('validation.emailWhitespace', {defaultValue: "🚨 BLOQUEADO: Remova os espaços em branco do E-MAIL."}));
        if (!somenteDadosPessoais && /\s/.test(rawMatricula)) return alert("🚨 BLOQUEADO: Remova os espaços em branco da MATRÍCULA.");
        
        const phoneError = validatePhoneStrict(rawPhone);
        if (phoneError) return alert(`🚨 BLOQUEADO: ${phoneError}`);

        const nomeLimpo = normalizarNome(formData.nome);
        const cpfLimpo = normalizarNumeros(formData.cpf);
        const telefoneLimpo = rawPhone.replace(/\D/g, ''); 
        const dataNasc = formData.data_nascimento;

        if (!cpfLimpo) return alert("O CPF é obrigatório para o cadastro.");
        if (cpfLimpo.length !== 11) return alert("O CPF informado está incompleto.");
        if (!nomeLimpo) return alert("O nome completo é obrigatório.");
        if (!dataNasc) return alert("A data de nascimento é obrigatória.");
        if (!telefoneLimpo) return alert("O telefone de contato é obrigatório.");
        if (!somenteDadosPessoais && !rawMatricula) return alert(modoTransferir ? `Informe a matrícula do aluno em ${unidadeAtiva} para transferir.` : "A matrícula é obrigatória. (Se for um visitante, digite 'VISITANTE').");
        if (!rawEmail) return alert("O e-mail é obrigatório.");
        if (!validarEmail(rawEmail)) return alert(t('validation.emailInvalid', {defaultValue: "O formato do e-mail é inválido."}));

        setIsSubmitting(true);
        try {
            // 🔥 PRE-FLIGHT 0: CPF ÚNICO — aluno novo com CPF que já existe ganha um aviso claro (não o erro genérico)
            if (!formData.id) {
                const { data: dupCpf, error: errCpf } = await supabase.from('alunos').select('id, nome')
                    .or(`cpf.eq.${cpfLimpo},cpf.eq."${mascaraCPF(cpfLimpo)}"`).limit(1);
                if (errCpf) throw errCpf;
                if (dupCpf && dupCpf.length > 0) {
                    setIsSubmitting(false);
                    return alert(`🚨 BLOQUEADO: O CPF ${formData.cpf} já está cadastrado para ${String(dupCpf[0].nome || '').toUpperCase()}. Busque o aluno pelo CPF em vez de cadastrar de novo.`);
                }
            }

            // 🔥 PRE-FLIGHT 1: VERIFICA PESSOA GLOBAL
            const telSemNove = telefoneLimpo.length === 11 ? telefoneLimpo.slice(0,2) + telefoneLimpo.slice(3) : telefoneLimpo;
            const telComNove = telefoneLimpo.length === 10 ? telefoneLimpo.slice(0,2) + '9' + telefoneLimpo.slice(2) : telefoneLimpo;
            
            let queryGlobal = `telefone.eq.${telefoneLimpo},telefone.eq.${telSemNove},telefone.eq.${telComNove},email.ilike.${rawEmail}`;
            const { data: dupGlobal, error: errGlobal } = await supabase.from('alunos').select('id, telefone, email').or(queryGlobal);
            if (errGlobal) throw errGlobal;

            if (dupGlobal && dupGlobal.length > 0) {
                const conflitosGlobais = dupGlobal.filter(aluno => aluno.id !== formData.id);
                if (conflitosGlobais.length > 0) {
                    const conflitoTelefone = conflitosGlobais.find(a => [telefoneLimpo, telSemNove, telComNove].includes(a.telefone));
                    const conflitoEmail = conflitosGlobais.find(a => (a.email || '').toLowerCase() === rawEmail.toLowerCase());
                    
                    if (conflitoTelefone) { setIsSubmitting(false); return alert(`🚨 BLOQUEADO: O telefone ${formData.telefone} já existe no banco de dados!`); }
                    if (conflitoEmail) { setIsSubmitting(false); return alert(`🚨 BLOQUEADO: O e-mail ${rawEmail} já existe no banco de dados!`); }
                }
            }

            // 🔥 PRE-FLIGHT 2: VERIFICA MATRÍCULA LOCAL (não se aplica quando só os dados pessoais mudam)
            if (!somenteDadosPessoais && rawMatricula.toUpperCase() !== 'VISITANTE') {
                const matNoZeros = rawMatricula.replace(/^0+/, '');
                const matWithZero = '0' + matNoZeros;
                let queryLocal = `matricula.eq.${rawMatricula},matricula.eq.${matNoZeros},matricula.eq.${matWithZero}`;
                
                const { data: dupLocal, error: errLocal } = await supabase.from('alunos_unidades')
                    .select('id, aluno_id, matricula')
                    .eq('unidade', unidadeAtiva)
                    .or(queryLocal);
                
                if (errLocal) throw errLocal;

                if (dupLocal && dupLocal.length > 0) {
                    const conflitoMatricula = dupLocal.filter(link => link.aluno_id !== formData.id);
                    if (conflitoMatricula.length > 0) {
                        setIsSubmitting(false); return alert(`🚨 BLOQUEADO: A matrícula ${rawMatricula} já está em uso nesta unidade!`);
                    }
                }
            }

            // ==============================================
            // SUCESSO! HORA DE SALVAR NO BANCO DE DADOS
            // ==============================================
            const auditNome = usuarioLogado?.nome || 'SISTEMA';
            const auditEmail = usuarioLogado?.email || '';

            // PAYLOAD DA IDENTIDADE
            const payloadPessoa = {
                nome: nomeLimpo,
                cpf: cpfLimpo,
                telefone: telefoneLimpo, 
                email: rawEmail,
                data_nascimento: dataNasc
            };
            // Aluno de outra unidade: a matrícula é da unidade dele e não é alterada daqui
            if (!somenteDadosPessoais) payloadPessoa.matricula = rawMatricula;

            let alunoIdDestino = formData.id;
            let dataResultPessoa;

            // 1. SALVAR PESSOA
            if (alunoIdDestino) {
                payloadPessoa.updated_at = new Date().toISOString();
                payloadPessoa.atualizado_por_nome = auditNome;
                payloadPessoa.atualizado_por_email = auditEmail;
                const { data, error } = await supabase.from('alunos').update(payloadPessoa).eq('id', alunoIdDestino).select().single();
                if (error) throw error;
                dataResultPessoa = data;
            } else {
                const { data, error } = await supabase.from('alunos').insert([payloadPessoa]).select().single();
                if (error) throw error;
                alunoIdDestino = data.id;
                dataResultPessoa = data;
            }

            // 2. VÍNCULO (Tabela 'alunos_unidades') — um vínculo por aluno
            if (somenteDadosPessoais) {
                // Aluno de outra unidade: nenhum vínculo é criado ou alterado
            } else if (modoTransferir) {
                // Move o vínculo para esta unidade (apaga os das outras unidades) com a matrícula nova
                const resultado = await moverVinculoAlunos(unidadeAtiva, [alunoIdDestino], [rawMatricula]);
                if (!resultado.ok) {
                    alert(`Os dados pessoais foram salvos, mas a transferência para ${unidadeAtiva} NÃO foi feita.\n\nMotivo: ${resultado.erro}`);
                }
            } else {
                // Aluno novo, sem vínculo, ou já desta unidade: grava/atualiza o vínculo DESTA unidade
                const payloadVinculo = {
                    aluno_id: alunoIdDestino,
                    unidade: unidadeAtiva, // Garantidamente limpa e filtrada
                    matricula: rawMatricula,
                    status: 'ATIVO',
                    updated_at: new Date().toISOString()
                };

                const { error: errVinculo } = await supabase.from('alunos_unidades').upsert(payloadVinculo, { onConflict: 'aluno_id, unidade' });
                if (errVinculo) {
                    console.error("Erro de vínculo:", errVinculo);
                }
            }

            onSaveSuccess(dataResultPessoa);
            onClose();
        } catch (error) {
            console.error(error);
            alert('Erro interno ao salvar os dados do aluno. Verifique sua conexão.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const labelClass = "block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5";
    const inputClassBase = "w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-400 disabled:cursor-not-allowed font-medium";

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-white dark:bg-slate-900 rounded-[24px] shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-[zoomIn_0.2s_ease-out]">
                
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex justify-between items-center relative overflow-hidden">
                    <div className="flex items-center gap-3 relative z-10">
                        <div className={`p-2.5 rounded-lg border ${formData.id ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400'}`}>
                            {formData.id ? <UserRoundPen className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">{formData.id ? 'Editar Dados do Cliente' : 'Cadastrar Novo Cliente'}</h3>
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                                Vínculo: <span className="text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider text-[9px]">
                                    {situacao === 'CARREGANDO' ? '...'
                                        : (situacao === 'NOVO' || situacao === 'SEM_VINCULO' || modoTransferir) ? (unidadeAtiva || 'NENHUMA')
                                        : vinculosAluno.join(' + ')}
                                </span>
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 rounded-full transition-colors relative z-10"><X className="w-5 h-5" /></button>
                </div>

                {/* ALUNO DE OUTRA UNIDADE (ou ligado a mais de uma): editar não cria vínculo; transferir move */}
                {(situacao === 'OUTRA' || (situacao === 'MINHA' && vinculoMultiplo)) && (
                    <div className={`border-b p-4 flex items-start gap-3 ${modoTransferir ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30' : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'}`}>
                        {modoTransferir ? <ArrowRightLeft className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" /> : <Link className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />}
                        <div className="flex-1">
                            {modoTransferir ? (
                                <>
                                    <p className="text-sm font-bold text-blue-800 dark:text-blue-300 tracking-tight">TRANSFERIR PARA {unidadeAtiva}</p>
                                    <p className="text-xs font-medium text-blue-700 dark:text-blue-300 leading-snug mt-1">
                                        Ao salvar, o vínculo sai de <strong>{unidadesDeFora.join(' + ')}</strong> e passa a ser só de <strong>{unidadeAtiva}</strong>. Informe a matrícula do aluno nesta unidade.
                                    </p>
                                    <button type="button" onClick={cancelarTransferencia} className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors">
                                        Cancelar transferência
                                    </button>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm font-bold text-amber-800 dark:text-amber-300 tracking-tight">
                                        {vinculoMultiplo ? 'LIGADO A MAIS DE UMA UNIDADE, CONFERIR' : `ALUNO DE OUTRA UNIDADE · ${vinculosAluno[0]}`}
                                    </p>
                                    <p className="text-xs font-medium text-amber-700 dark:text-amber-300 leading-snug mt-1">
                                        {situacao === 'OUTRA'
                                            ? `Este aluno é de ${vinculosAluno.join(' + ')}. Salvar aqui só atualiza os dados pessoais e não muda a unidade dele.`
                                            : `Este aluno também está ligado a ${unidadesDeFora.join(' + ')}. Cada aluno deve ter um vínculo só.`}
                                    </p>
                                    {podeTransferir && (
                                        <button type="button" onClick={iniciarTransferencia} className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-2">
                                            <ArrowRightLeft className="w-4 h-4" /> {situacao === 'OUTRA' ? 'Transferir para minha unidade' : `Deixar só em ${unidadeAtiva}`}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}

                {situacao === 'SEM_VINCULO' && (
                    <div className="bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/30 p-4 flex items-start gap-3">
                        <Link className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-300 leading-snug">
                            Este aluno não está ligado a nenhuma unidade. Ao salvar, ele fica ligado a <strong>{unidadeAtiva || 'NENHUMA'}</strong>.
                        </p>
                    </div>
                )}

                <form onSubmit={handleSave} className="p-6 space-y-5" noValidate>
                    <div className="grid grid-cols-2 gap-5">
                        <div className="col-span-2">
                            <label className={labelClass}>CPF *</label>
                            <input type="text" name="cpf" value={formData.cpf} onChange={handleChange} disabled={!!formData.id} className={`${inputClassBase} uppercase`} placeholder="000.000.000-00" />
                        </div>
                        
                        <div className="col-span-2">
                            <label className={labelClass}>Nome Completo *</label>
                            <input type="text" name="nome" value={formData.nome} onChange={handleChange} className={`${inputClassBase} uppercase`} placeholder="Ex: João da Silva" />
                        </div>
                        
                        <div className="col-span-1">
                            <label className={labelClass}>Data de Nascimento *</label>
                            <input type="date" name="data_nascimento" value={formData.data_nascimento} onChange={handleChange} className={inputClassBase} />
                        </div>
                        
                        <div className="col-span-1">
                            <label className={labelClass}>Idade</label>
                            <div className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 flex items-center shadow-sm">
                                {idade !== null ? `${idade} anos` : '—'}
                            </div>
                        </div>

                        <div className="col-span-1 relative">
                            <label className={labelClass}>Telefone / WhatsApp *</label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    name="telefone" 
                                    value={formData.telefone} 
                                    onChange={handleChange} 
                                    onBlur={handleBlurTelefone} 
                                    className={`${inputClassBase} uppercase ${erroTelefone ? 'border-rose-500 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 focus:ring-rose-500/20 focus:border-rose-500' : ''}`} 
                                    placeholder="(00) 00000-0000" 
                                />
                                {verificandoTelefone && <Loader2 className="w-4 h-4 text-blue-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
                                {erroTelefone && <AlertTriangle className="w-4 h-4 text-rose-500 absolute right-3 top-1/2 -translate-y-1/2" />}
                            </div>
                            {erroTelefone && <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-tight mt-1.5 ml-1 animate-[fadeIn_0.2s_ease-out]">{erroTelefone}</p>}
                        </div>

                        <div className="col-span-1 relative">
                            <label className={labelClass}>
                                {somenteDadosPessoais ? `Matrícula (de ${vinculosAluno[0] || 'outra unidade'})` : modoTransferir ? `Matrícula em ${unidadeAtiva} *` : 'Matrícula (Nesta Unidade) *'}
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="matricula"
                                    value={formData.matricula}
                                    onChange={handleChange}
                                    onBlur={handleBlurMatricula}
                                    disabled={somenteDadosPessoais || situacao === 'CARREGANDO'}
                                    title={somenteDadosPessoais ? 'A matrícula é da unidade do aluno. Para mudar, use "Transferir para minha unidade".' : undefined}
                                    className={`${inputClassBase} uppercase ${erroMatricula ? 'border-rose-500 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 focus:ring-rose-500/20 focus:border-rose-500' : ''}`} 
                                    placeholder="Ex: 012345" 
                                />
                                {verificandoMatricula && <Loader2 className="w-4 h-4 text-blue-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
                                {erroMatricula && <AlertTriangle className="w-4 h-4 text-rose-500 absolute right-3 top-1/2 -translate-y-1/2" />}
                            </div>
                            {erroMatricula && <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-tight mt-1.5 ml-1 animate-[fadeIn_0.2s_ease-out]">{erroMatricula}</p>}
                        </div>

                        <div className="col-span-2 relative">
                            <label className={labelClass}>E-mail corporativo ou pessoal *</label>
                            <div className="relative">
                                <input 
                                    type="email" 
                                    name="email" 
                                    value={formData.email} 
                                    onChange={handleChange} 
                                    onBlur={handleBlurEmail}
                                    className={`${inputClassBase} lowercase ${erroEmail ? 'border-rose-500 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 focus:ring-rose-500/20 focus:border-rose-500' : ''}`} 
                                    placeholder="aluno@email.com" 
                                />
                                {verificandoEmail && <Loader2 className="w-4 h-4 text-blue-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
                                {erroEmail && <AlertTriangle className="w-4 h-4 text-rose-500 absolute right-3 top-1/2 -translate-y-1/2" />}
                            </div>
                            {erroEmail && <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-tight mt-1.5 ml-1 animate-[fadeIn_0.2s_ease-out]">{erroEmail}</p>}
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 mt-4">
                        <button type="button" onClick={onClose} className="px-6 py-2.5 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:text-slate-800 dark:hover:text-white rounded-lg text-sm font-semibold transition-colors">Cancelar</button>
                        
                        <button type="submit" disabled={isSubmitting || situacao === 'CARREGANDO' || !!erroMatricula || !!erroTelefone || !!erroEmail} className={`px-6 py-2.5 text-white rounded-lg text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${formData.id ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                            {isSubmitting || situacao === 'CARREGANDO' ? <Loader2 className="w-4 h-4 animate-spin" /> : modoTransferir ? <ArrowRightLeft className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                            {isSubmitting ? 'Processando...' : modoTransferir ? 'Salvar e Transferir' : somenteDadosPessoais ? 'Salvar Dados Pessoais' : 'Salvar Cliente'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ModalAluno;