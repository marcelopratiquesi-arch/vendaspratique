import React, { useState, useRef, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient.js';
import { safeNumber, formatMoney, getLocalDateISO } from './utils.js';
import { mascaraCPF, validarCPF } from '../CadastroGeral/utilsAlunos.js';
import ModalAluno from '../../components/Modals/ModalAluno.jsx';
import EtiquetasUnidade from '../../components/EtiquetasUnidade.jsx';
import { buscarUnidadesDoAluno, moverVinculoAlunos, mesmaUnidade, pendenciasCadastroAluno } from '../Alunos/utils.js';
import AvisoCadastroIncompleto from '../../components/AvisoCadastroIncompleto.jsx';
import SeletorCatalogo from './seletores/SeletorCatalogo.jsx';
import SeletorConsultor from './seletores/SeletorConsultor.jsx';
import { BookOpen, Box, Briefcase, Trash2, Plus, Minus, MessageSquare, Loader2, Check, CheckCircle2, AlertTriangle, UserRoundPen, UserPlus, CreditCard, CalendarDays, Building2, ChevronDown, Phone, Mail } from 'lucide-react';
import { avisar } from '../../components/avisar.js';
import { tx, localeAtual } from '../../i18n/traduzir.js';
import { ehDoseUnica, dosesValidasNoMes, LIMITE_DOSES_POR_UNIDADE_MES, INICIO_LIMITE_DOSES } from '../AnaliseVendas/limiteDoses.js';

const apenasDigitos = (valor) => String(valor || '').replace(/\D/g, '');

const FormVenda = ({ 
    usuarioLogado, unidades, onAddMultiple, planos, produtos, servicos, 
    colaboradores, voltarHub, alunoPreSelecionado, limparPreSelecao,
    onIrParaAluno, // Nova propriedade para o redirecionamento automático
    onEtapas, // Etapas da venda (Cliente → Itens → Finalizar) para o indicador do topo
    vendas = [] // vendas já carregadas (só leitura), para o aviso do limite de doses únicas
}) => {
    // 🔥 Libera a escolha de unidade para quem não é recepção pura
    const roleUsuario = String(usuarioLogado?.role || '').toUpperCase().trim();
    const podeEscolherUnidade = ['ADMIN', 'MENTOR', 'LIDER', 'VENDEDOR'].includes(roleUsuario);

    const [formData, setFormData] = useState({ 
        unidade: usuarioLogado?.unidade || '', 
        data: getLocalDateISO(), 
        observacao: '' 
    });

    const [cpfBusca, setCpfBusca] = useState('');
    const [cpfErro, setCpfErro] = useState(false);
    const [buscandoCpf, setBuscandoCpf] = useState(false);
    const [alunoEncontrado, setAlunoEncontrado] = useState(null); 
    const [statusCpf, setStatusCpf] = useState(null); 
    const [modalAlunoAberto, setModalAlunoAberto] = useState(false);
    
    const debounceRef = useRef(null);
    const cpfAtualRef = useRef('');
    const envioTravadoRef = useRef(false);

    const getInitialItem = (vendedorPadrao = '') => ({ 
        id: Date.now(), tipo: '', nomeItem: '', vendedor: vendedorPadrao, quantidade: 1, valor: 'R$ 0,00', valorUnitario: 0, valorCalculado: 0 
    });
    
    const [itensForm, setItensForm] = useState([getInitialItem()]);
    const [sucesso, setSucesso] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (alunoPreSelecionado) {
            cpfAtualRef.current = apenasDigitos(alunoPreSelecionado.cpf);
            setCpfBusca(mascaraCPF(alunoPreSelecionado.cpf));
            setAlunoEncontrado(alunoPreSelecionado);
            setStatusCpf('encontrado');
            setCpfErro(false);
            // A venda fica na unidade de quem vende, nunca na unidade de origem do aluno (regra 8 do CLAUDE.md)

            // O aluno vindo da Central/ficha pode não trazer todos os campos: recarrega o cadastro completo
            // (senão a etiqueta "cadastro incompleto" acusaria falta de dado que existe)
            if (alunoPreSelecionado.id) {
                supabase.from('alunos').select('*').eq('id', alunoPreSelecionado.id).maybeSingle()
                    .then(({ data }) => { if (data) setAlunoEncontrado(prev => (prev?.id === data.id ? { ...prev, ...data } : prev)); });
            }

            if (limparPreSelecao) limparPreSelecao();
        }
    }, [alunoPreSelecionado, limparPreSelecao]);

    // Unidade(s) de origem do aluno, só para a recepção saber de onde ele é
    const [unidadesAluno, setUnidadesAluno] = useState([]);
    useEffect(() => {
        const id = alunoEncontrado?.id;
        if (!id) { setUnidadesAluno([]); return undefined; }
        let ativo = true;
        buscarUnidadesDoAluno(id).then(lista => { if (ativo) setUnidadesAluno(lista); });
        return () => { ativo = false; };
    }, [alunoEncontrado?.id]);

    // 🔥 Filtra os consultores com base na unidade selecionada na tela
    const vendedoresDaUnidade = colaboradores.filter(c => {
        const isAtivo = c.ativo !== false;
        const matchUnidade = c.unidade?.toUpperCase() === formData.unidade?.toUpperCase();
        return isAtivo && matchUnidade;
    });

    const planosAtivos = planos.filter(p => p.ativo !== false);
    const produtosAtivos = produtos.filter(p => p.ativo !== false);
    const servicosAtivos = servicos.filter(s => s.ativo !== false);

    const cpfConfere = Boolean(alunoEncontrado) && apenasDigitos(alunoEncontrado.cpf) === apenasDigitos(cpfBusca);
    // Decisão do dono: venda só com cadastro completo (telefone, e-mail, nascimento...)
    const pendenciasCadastro = cpfConfere ? pendenciasCadastroAluno(alunoEncontrado) : [];
    const vendaLiberada = cpfConfere && pendenciasCadastro.length === 0;

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

    const handleCpfChange = (e) => {
        const masked = mascaraCPF(e.target.value);
        setCpfBusca(masked);
        setAlunoEncontrado(null); 
        setStatusCpf(null);
        setBuscandoCpf(false);
        cpfAtualRef.current = '';
        
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (masked.length === 14) {
            if (!validarCPF(masked)) {
                setCpfErro(true);
            } else {
                setCpfErro(false);
                const limpo = masked.replace(/\D/g, '');
                cpfAtualRef.current = limpo;
                debounceRef.current = setTimeout(() => buscarAlunoPorCpf(limpo), 500);
            }
        } else {
            setCpfErro(false);
        }
    };

    const handleSaveAlunoSuccess = (alunoAtualizado) => {
        cpfAtualRef.current = apenasDigitos(alunoAtualizado.cpf);
        setAlunoEncontrado(alunoAtualizado);
        setCpfBusca(mascaraCPF(alunoAtualizado.cpf)); 
        setStatusCpf('encontrado');
    };

    const handleMainChange = (e) => {
        const { name, value } = e.target;
        if (name === 'unidade') {
            setFormData({ ...formData, unidade: value });
            setItensForm(itensForm.map(item => ({ ...item, vendedor: '' }))); // Reseta vendedores se mudar a unidade
        }
        else setFormData({ ...formData, [name]: value });
    };

    const handleItemChange = (id, field, value) => {
        setItensForm(itensForm.map(item => {
            if (item.id === id) {
                const updatedItem = { ...item, [field]: value };
                if (field === 'tipo') {
                    updatedItem.nomeItem = ''; updatedItem.valorUnitario = 0; updatedItem.quantidade = 1;
                    updatedItem.valorCalculado = 0; updatedItem.valor = 'R$ 0,00';
                } 
                else if (field === 'nomeItem') {
                    const listaRef = updatedItem.tipo === 'plano' ? planos : (updatedItem.tipo === 'produto' ? produtos : servicos);
                    const selecionado = listaRef.find(x => x.nome === value) || { valor: 0 };
                    const precoNumericoLimpo = safeNumber(selecionado.valor); 
                    updatedItem.quantidade = 1; updatedItem.valorUnitario = precoNumericoLimpo;
                    updatedItem.valorCalculado = precoNumericoLimpo; updatedItem.valor = formatMoney(updatedItem.valorCalculado);
                } 
                else if (field === 'quantidade') {
                    const qtd = parseInt(value) || 1;
                    updatedItem.quantidade = qtd; updatedItem.valorCalculado = updatedItem.valorUnitario * qtd;
                    updatedItem.valor = formatMoney(updatedItem.valorCalculado);
                }
                return updatedItem;
            }
            return item;
        }));
    };

    const handleRemoveItem = (id) => itensForm.length > 1 && setItensForm(itensForm.filter(item => item.id !== id));
    
    const handleAddItem = () => {
        const lastVendedor = itensForm.length > 0 ? itensForm[itensForm.length - 1].vendedor : '';
        setItensForm([...itensForm, getInitialItem(lastVendedor)]);
    };

    const totalVenda = itensForm.reduce((acc, curr) => acc + safeNumber(curr.valorCalculado), 0);

    const handleSubmitVenda = async (e) => {
        e.preventDefault();

        if (envioTravadoRef.current || isSubmitting || sucesso) return;
        
        if (!alunoEncontrado) return avisar(tx("Localize ou cadastre o aluno pelo CPF primeiro."));
        if (!cpfConfere) return avisar(tx("O CPF digitado não corresponde ao aluno carregado. Confira o CPF antes de continuar."));
        if (pendenciasCadastro.length > 0) return avisar(tx("Cadastro incompleto. Falta: {v1}. Clique em \"Completar cadastro\" antes de lançar a venda.", { v1: pendenciasCadastro.join(', ') }));
        if (!formData.unidade) return avisar(tx("Atenção: Selecione a Unidade da venda."));
        
        const itensValidos = itensForm.filter(item => item.nomeItem !== '' && item.tipo !== '');
        if (itensValidos.length === 0) return avisar(tx("Adicione pelo menos um item válido."));

        const temItemSemVendedor = itensValidos.some(item => !item.vendedor);
        if (temItemSemVendedor) return avisar(tx("Selecione o Consultor Responsável para TODOS os itens adicionados."));

        envioTravadoRef.current = true;
        setIsSubmitting(true);

        try {
            const novosLancamentos = itensValidos.map(item => {
                const valorPuro = safeNumber(item.valorCalculado); 
                return {
                    unidade: formData.unidade.toUpperCase(), 
                    data: formData.data, 
                    matricula: alunoEncontrado.matricula || '', 
                    nome_aluno: alunoEncontrado.nome.toUpperCase(),
                    cpf: alunoEncontrado.cpf.replace(/\D/g, ''),
                    produto: item.nomeItem, 
                    vendedor: item.vendedor.toUpperCase(), 
                    valor: valorPuro, 
                    observacao: formData.observacao, 
                    conferiu: false, 
                    quantidade: parseInt(item.quantidade) || 1, 
                    comissao: valorPuro,
                    criado_por: usuarioLogado?.nome || 'SISTEMA' 
                };
            });

            const { data, error } = await supabase.from('vendas').insert(novosLancamentos).select();
            if (error) throw error;

            if (data) {
                if(onAddMultiple) onAddMultiple(data.reverse());

                // REGRA: o vínculo do aluno é a unidade onde ele compra. Qualquer venda MOVE o vínculo para a
                // unidade da venda (nunca soma). A matrícula da unidade nova fica em branco até a próxima
                // importação do TECACE ou até alguém editar. Se falhar, a venda continua salva.
                const jaEstaNaUnidade = unidadesAluno.length === 1 && mesmaUnidade(unidadesAluno[0], formData.unidade);
                if (alunoEncontrado?.id && !jaEstaNaUnidade) {
                    const resultado = await moverVinculoAlunos(formData.unidade, [alunoEncontrado.id]);
                    if (resultado.ok) setUnidadesAluno([formData.unidade.toUpperCase()]);
                    else avisar(tx("A venda foi salva. Mas o vínculo do aluno NÃO foi movido para {v1}.\n\nMotivo: {erro}", { v1: formData.unidade.toUpperCase(), erro: resultado.erro }));
                }

                setSucesso(true);
                
                // 🔥 Redirecionamento Automático
                setTimeout(() => {
                    setSucesso(false);
                    if (onIrParaAluno) {
                        onIrParaAluno(alunoEncontrado);
                    } else if (voltarHub) {
                        voltarHub();
                    } else {
                        envioTravadoRef.current = false;
                    }
                }, 1500); // 1.5s para o usuário ver o check verde antes de viajar de tela
            } else {
                envioTravadoRef.current = false;
            }
        } catch (error) {
            envioTravadoRef.current = false;
            console.error("Erro:", error); avisar(tx("Erro ao salvar venda. Tente novamente."));
        } finally { 
            setIsSubmitting(false); 
        }
    };

    // ==========================================
    // VISUAL NOVO (desenho aprovado pelo dono, 30/10/2026) — a lógica acima não mudou
    // ==========================================
    // Uma lista aberta por vez: { id do item, campo: 'catalogo' | 'consultor' }
    const [listaAberta, setListaAberta] = useState(null);
    const controleLista = (id, campo) => ({
        aberto: listaAberta?.id === id && listaAberta?.campo === campo,
        setAberto: (abrir) => setListaAberta(prev => (abrir ? { id, campo } : (prev && prev.id === id && prev.campo === campo ? null : prev))),
    });

    // O botão Confirmar exige os MESMOS campos que antes eram obrigatórios no formulário:
    // cliente localizado com cadastro completo, unidade, data e, em CADA item, categoria + item + consultor.
    const itensCompletos = itensForm.length > 0 && itensForm.every(i => i.tipo && i.nomeItem && i.vendedor);
    const oQueFalta = (() => {
        if (!cpfConfere) return tx('Localize o cliente pelo CPF para confirmar');
        if (pendenciasCadastro.length > 0) return tx('Complete o cadastro do cliente para confirmar');
        if (!formData.unidade) return tx('Escolha a unidade da venda para confirmar');
        if (!formData.data) return tx('Escolha a data da venda para confirmar');
        const incompleto = itensForm.find(i => !i.tipo || !i.nomeItem || !i.vendedor);
        if (incompleto) {
            if (!incompleto.nomeItem && !incompleto.vendedor) return tx('Escolha o item e o consultor para confirmar');
            if (!incompleto.nomeItem) return tx('Escolha o item para confirmar');
            return tx('Escolha o consultor para confirmar');
        }
        return null;
    })();
    const podeConfirmar = !oQueFalta && !isSubmitting && !sucesso;

    // Aviso do limite de doses únicas (limiteDoses.js, a partir de 01/11/2026). Só avisa, NUNCA bloqueia.
    // Soma as doses já válidas da unidade no mês da venda + as doses das linhas anteriores desta mesma venda.
    const avisosDoses = useMemo(() => {
        const avisos = {};
        if (!formData.unidade || !formData.data || formData.data < INICIO_LIMITE_DOSES) return avisos;
        const temDose = itensForm.some(i => i.tipo === 'produto' && i.nomeItem && ehDoseUnica(i.nomeItem));
        if (!temDose) return avisos;
        let usadas = dosesValidasNoMes(vendas, planos, produtos, formData.unidade, formData.data.slice(0, 7));
        itensForm.forEach(item => {
            if (item.tipo !== 'produto' || !item.nomeItem || !ehDoseUnica(item.nomeItem)) return;
            const qtd = parseInt(item.quantidade) || 1;
            const restante = Math.max(0, LIMITE_DOSES_POR_UNIDADE_MES - usadas);
            if (restante === 0) avisos[item.id] = { tipo: 'esgotado' };
            else if (qtd > restante) avisos[item.id] = { tipo: 'parcial', n: restante };
            usadas += Math.min(qtd, restante);
        });
        return avisos;
    }, [formData.unidade, formData.data, itensForm, vendas, planos, produtos]);
    const nomeMesDaVenda = formData.data
        ? new Date(Number(formData.data.slice(0, 4)), Number(formData.data.slice(5, 7)) - 1, 1).toLocaleDateString(localeAtual(), { month: 'long' })
        : '';

    // Etapas (Cliente → Itens → Finalizar) para o indicador do topo
    useEffect(() => {
        if (onEtapas) onEtapas({ cliente: cpfConfere, itens: itensCompletos, finalizado: sucesso });
    }, [onEtapas, cpfConfere, itensCompletos, sucesso]);

    const ehHoje = formData.data === getLocalDateISO();
    const nomeIniciais = (nome) => {
        const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
        return partes.length ? (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase() : '?';
    };

    const rotulo = 'block text-[12px] font-bold uppercase tracking-[0.07em] text-[#3B4458] mb-2 dark:text-slate-300';
    const campoBase = 'w-full h-12 bg-white border border-[#D6DCE8] rounded-xl px-3.5 text-[14px] font-medium text-[#0F172A] outline-none focus:border-[#1D4FD8] focus:ring-2 focus:ring-[#1D4FD8]/20 transition-colors placeholder:text-[#5B6478] dark:bg-slate-900 dark:border-slate-700 dark:text-white';
    const cartao = 'bg-white rounded-[20px] border border-[#E4E8F0] p-5 md:p-6 dark:bg-slate-900 dark:border-slate-800';
    const TituloSecao = ({ numero, texto }) => (
        <div className="flex items-center gap-3 mb-5">
            <span className="w-8 h-8 rounded-lg bg-[#0B1F4B] text-white text-[14px] font-extrabold flex items-center justify-center shrink-0 dark:bg-blue-600">{numero}</span>
            <h3 className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#0F172A] dark:text-white">{texto}</h3>
        </div>
    );
    const abrirCadastro = (mensagem) => {
        if (!formData.unidade) return avisar(mensagem);
        setModalAlunoAberto(true);
    };

    return (
        <>
            <ModalAluno
                isOpen={modalAlunoAberto}
                onClose={() => setModalAlunoAberto(false)}
                alunoInicial={alunoEncontrado || { cpf: cpfBusca }}
                onSaveSuccess={handleSaveAlunoSuccess}
                usuarioLogado={usuarioLogado}
                unidadeDestino={formData.unidade}
            />

            <form onSubmit={handleSubmitVenda} className="space-y-4 animate-[fadeIn_0.3s_ease-out] pb-10">
                {sucesso && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
                        <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center animate-[zoomIn_0.2s_ease-out] max-w-sm w-full mx-4 border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-inner border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30"><CheckCircle2 className="w-10 h-10" /></div>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2 dark:text-white">{tx("Venda Confirmada!")}</h3>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6 dark:text-slate-400">{tx("Lançamento salvo no Caixa.")}</p>
                            {onIrParaAluno && (
                                <div className="flex items-center gap-2 text-blue-600 font-bold text-xs bg-blue-50 px-5 py-2.5 rounded-xl border border-blue-100 dark:text-blue-400 dark:bg-blue-500/10 dark:border-blue-500/30">
                                    <Loader2 className="w-4 h-4 animate-spin" />{' '}{tx("Abrindo ficha do aluno...")}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ===== 1. IDENTIFICAÇÃO DO CLIENTE ===== */}
                <section className={cartao}>
                    <TituloSecao numero="1" texto={tx('Identificação do Cliente')} />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label htmlFor="venda-cpf" className={rotulo}>{tx('CPF do cliente')} *</label>
                            <div className="relative">
                                <input id="venda-cpf" type="text" inputMode="numeric" value={cpfBusca} onChange={handleCpfChange} maxLength="14" placeholder="000.000.000-00"
                                    className={`${campoBase} pr-10 tabular-nums ${cpfErro ? '!border-rose-400 !bg-rose-50 dark:!bg-rose-500/10' : cpfConfere ? '!border-2 !border-[#0E9F6E]' : ''}`} />
                                {buscandoCpf && <Loader2 className="w-4 h-4 text-[#1D4FD8] animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />}
                                {cpfConfere && !buscandoCpf && <CheckCircle2 className="w-5 h-5 text-[#0E9F6E] absolute right-3 top-1/2 -translate-y-1/2" />}
                                {(statusCpf === 'erro' || statusCpf === 'duplicado') && <AlertTriangle className="w-4 h-4 text-rose-500 absolute right-3.5 top-1/2 -translate-y-1/2" />}
                            </div>
                            {cpfErro && <p className="text-[12px] font-semibold text-rose-600 mt-1.5 dark:text-rose-400">{tx("CPF Inválido")}</p>}
                            {statusCpf === 'encontrado' && <p className="text-[12px] font-semibold text-[#0B7A52] mt-1.5 dark:text-emerald-400">{tx("Cadastro localizado")}</p>}
                            {statusCpf === 'novo' && <p className="text-[12px] font-semibold text-amber-700 mt-1.5 dark:text-amber-400">{tx("Cliente Novo (Cadastrar)")}</p>}
                            {statusCpf === 'duplicado' && <p className="text-[12px] font-semibold text-rose-600 mt-1.5 dark:text-rose-400">{tx("CPF com mais de um cadastro")}</p>}
                        </div>

                        <div>
                            <label htmlFor="venda-data" className={rotulo}>{tx('Data da venda')} *</label>
                            <div className="relative">
                                <CalendarDays className="w-4 h-4 text-[#5B6478] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input id="venda-data" type="date" name="data" value={formData.data} onChange={handleMainChange} required className={`${campoBase} pl-10 ${ehHoje ? 'pr-20' : ''}`} />
                                {ehHoje && <span className="absolute right-10 top-1/2 -translate-y-1/2 h-6 px-2 rounded-full bg-[#E7F7EF] text-[#0B7A52] text-[11px] font-bold flex items-center pointer-events-none dark:bg-emerald-500/15 dark:text-emerald-300">{tx('Hoje')}</span>}
                            </div>
                        </div>

                        <div>
                            <label htmlFor="venda-unidade" className={rotulo}>{tx('Unidade da venda')} *</label>
                            <div className="relative">
                                <Building2 className="w-4 h-4 text-[#5B6478] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                {/* Só quem tem permissão escolhe a unidade; a Recepção vê a própria, sem trocar */}
                                {podeEscolherUnidade ? (
                                    <>
                                        <select id="venda-unidade" name="unidade" value={formData.unidade} onChange={handleMainChange} required className={`${campoBase} pl-10 pr-9 appearance-none cursor-pointer`}>
                                            <option value="">{tx("Selecione...")}</option>
                                            {unidades.map(u => <option key={u.id || u.nome} value={u.nome}>{u.nome}</option>)}
                                        </select>
                                        <ChevronDown className="w-4 h-4 text-[#5B6478] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </>
                                ) : (
                                    <input id="venda-unidade" type="text" value={formData.unidade} readOnly className={`${campoBase} pl-10 bg-[#F3F5FA] cursor-default dark:bg-slate-800`} />
                                )}
                            </div>
                        </div>
                    </div>

                    {!buscandoCpf && statusCpf === 'duplicado' && (
                        <div className="mt-4 bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 dark:bg-rose-500/10 dark:border-rose-500/30">
                            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 dark:text-rose-400" />
                            <div>
                                <h4 className="text-[14px] font-bold text-rose-800 dark:text-rose-300">{tx("CPF com mais de um cadastro")}</h4>
                                <p className="text-[13px] text-rose-700 dark:text-rose-300/80">{tx("Existe mais de um aluno com este CPF. Para não lançar a venda no cadastro errado, peça ao gestor para corrigir os cadastros antes de continuar.")}</p>
                            </div>
                        </div>
                    )}

                    {!buscandoCpf && cpfBusca.length === 14 && !cpfErro && statusCpf !== 'erro' && statusCpf !== 'duplicado' && statusCpf !== null && (
                        cpfConfere ? (
                            /* Cartão do cliente localizado */
                            <div className="mt-4 bg-[#F8FAFD] border border-[#E4E8F0] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 dark:bg-slate-800/60 dark:border-slate-700">
                                <span className="w-14 h-14 rounded-full bg-[#E8EEFF] text-[#0B1F4B] text-[18px] font-extrabold flex items-center justify-center shrink-0 dark:bg-blue-500/15 dark:text-blue-200">{nomeIniciais(alunoEncontrado.nome)}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="text-[17px] font-extrabold text-[#0F172A] uppercase dark:text-white">{alunoEncontrado.nome}</h4>
                                        {pendenciasCadastro.length === 0
                                            ? <span className="h-6 px-2.5 rounded-full bg-[#E7F7EF] text-[#0B7A52] text-[11px] font-bold uppercase tracking-wide flex items-center dark:bg-emerald-500/15 dark:text-emerald-300">{tx('Cadastro completo')}</span>
                                            : <span className="h-6 px-2.5 rounded-full bg-amber-50 text-amber-800 text-[11px] font-bold uppercase tracking-wide flex items-center dark:bg-amber-500/15 dark:text-amber-300">{tx('Cadastro incompleto')}</span>}
                                    </div>
                                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[#3B4458] dark:text-slate-300">
                                        {alunoEncontrado.matricula && <span className="inline-flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-[#5B6478]" />{tx("Mat:")} {alunoEncontrado.matricula}</span>}
                                        {alunoEncontrado.telefone && <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-[#5B6478]" />{alunoEncontrado.telefone}</span>}
                                        {alunoEncontrado.email && <span className="inline-flex items-center gap-1.5 min-w-0"><Mail className="w-3.5 h-3.5 text-[#5B6478] shrink-0" /><span className="truncate">{alunoEncontrado.email}</span></span>}
                                        <span className="inline-flex items-center gap-1.5">{tx('Origem:')} <EtiquetasUnidade unidades={unidadesAluno} unidadeMinha={formData.unidade} /></span>
                                    </div>
                                </div>
                                <button type="button" onClick={() => abrirCadastro(tx("Selecione a unidade antes de cadastrar/editar o aluno."))}
                                    className="h-11 px-4 rounded-xl border border-[#D6DCE8] bg-white text-[#0F172A] text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#F3F5FA] transition-colors shrink-0 dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800">
                                    <UserRoundPen className="w-4 h-4" />{tx("Editar Cadastro")}
                                </button>
                            </div>
                        ) : (
                            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 dark:bg-amber-500/10 dark:border-amber-500/30">
                                <div>
                                    <h4 className="text-[14px] font-bold text-amber-900 dark:text-amber-300">{tx("Registro Inexistente")}</h4>
                                    <p className="text-[13px] text-amber-800 dark:text-amber-300/80">{tx("Nenhum cliente localizado para este CPF.")}</p>
                                </div>
                                <button type="button" onClick={() => abrirCadastro(tx("Selecione a unidade antes de cadastrar o aluno."))}
                                    className="h-11 px-4 rounded-xl bg-[#1D4FD8] text-white text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#1A45BF] transition-colors shrink-0">
                                    <UserPlus className="w-4 h-4" />{tx("Cadastrar Cliente Rápido")}
                                </button>
                            </div>
                        )
                    )}

                    {!buscandoCpf && cpfConfere && (
                        <div className="mt-4">
                            <AvisoCadastroIncompleto
                                pendencias={pendenciasCadastro}
                                liberar="a venda"
                                onCompletar={() => abrirCadastro(tx("Selecione a unidade antes de editar o aluno."))}
                            />
                        </div>
                    )}
                </section>

                {/* ===== 2. ITENS DA VENDA E ATRIBUIÇÃO (liberado só com cliente localizado e cadastro completo) ===== */}
                <section className={`${cartao} transition-opacity duration-300 ${!vendaLiberada ? 'opacity-40 pointer-events-none' : ''}`} aria-disabled={!vendaLiberada}>
                    <TituloSecao numero="2" texto={tx('Itens da Venda e Atribuição')} />

                    {/* Cada item numa LINHA SÓ: Categoria · Item · Consultor · Qtd · Comissão · lixeira (como uma tabela).
                        Rótulos só na 1ª linha no computador; no celular (< 900px) a linha quebra e todos têm rótulo. */}
                    <div className="divide-y divide-[#EEF1F6] dark:divide-slate-800">
                        {itensForm.map((item, indice) => {
                            // Rótulo visível na 1ª linha; nas outras, só no celular (e sempre para leitor de tela)
                            const rotuloLinha = `${rotulo} ${indice > 0 ? 'min-[900px]:sr-only' : ''}`;
                            return (
                                <div key={item.id} className="py-3 first:pt-0 flex flex-wrap items-end gap-2.5">
                                    {/* Categoria: segmento de 3 botões com ícone */}
                                    <div className="w-full min-[900px]:w-auto shrink-0 flex items-end justify-between gap-2">
                                        <div>
                                        <span className={rotuloLinha}>{tx('Categoria')} *</span>
                                        <div className="h-11 inline-flex items-center p-1 bg-[#F3F5FA] rounded-xl gap-1 dark:bg-slate-800" role="radiogroup" aria-label={tx('Categoria')}>
                                            {[['plano', 'Plano', BookOpen], ['produto', 'Produto', Box], ['servico', 'Serviço', Briefcase]].map(([valorTipo, nome, Icone]) => {
                                                const ativo = item.tipo === valorTipo;
                                                return (
                                                    <button key={valorTipo} type="button" role="radio" aria-checked={ativo}
                                                        onClick={() => { if (!ativo) { handleItemChange(item.id, 'tipo', valorTipo); setListaAberta({ id: item.id, campo: 'catalogo' }); } }}
                                                        className={`h-9 px-2.5 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1D4FD8] ${ativo ? 'bg-white text-[#0B1F4B] shadow-sm dark:bg-slate-900 dark:text-white' : 'text-[#3B4458] hover:text-[#0F172A] dark:text-slate-300 dark:hover:text-white'}`}>
                                                        <Icone className="w-4 h-4" />{tx(nome)}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        </div>
                                        {/* Celular: lixeira ao lado da categoria */}
                                        {itensForm.length > 1 && (
                                            <button type="button" onClick={() => handleRemoveItem(item.id)} title={tx("Remover Item")} aria-label={tx("Remover Item")}
                                                className="flex min-[900px]:hidden w-10 h-10 mb-0.5 shrink-0 rounded-xl border border-[#D6DCE8] text-[#5B6478] items-center justify-center hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors dark:border-slate-700 dark:hover:bg-rose-500/10">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Item do catálogo: largura flexível com limite */}
                                    <div className="flex-1 min-w-[200px] max-w-[340px] basis-[200px]">
                                        <label htmlFor={`venda-item-${item.id}`} className={rotuloLinha}>{tx('Item do catálogo')} *</label>
                                        <SeletorCatalogo
                                            idCampo={`venda-item-${item.id}`}
                                            tipo={item.tipo}
                                            itens={item.tipo === 'plano' ? planosAtivos : item.tipo === 'produto' ? produtosAtivos : item.tipo === 'servico' ? servicosAtivos : []}
                                            valor={item.nomeItem}
                                            desabilitado={!item.tipo}
                                            onEscolher={(nome) => {
                                                handleItemChange(item.id, 'nomeItem', nome);
                                                // Sem consultor ainda: abre a lista de consultores sozinha
                                                if (!item.vendedor && formData.unidade) setListaAberta({ id: item.id, campo: 'consultor' });
                                            }}
                                            {...controleLista(item.id, 'catalogo')}
                                        />
                                    </div>

                                    {/* Consultor (filtrado pela unidade escolhida no topo) */}
                                    <div className="flex-1 min-w-[180px] max-w-[280px] basis-[180px]">
                                        <label htmlFor={`venda-consultor-${item.id}`} className={rotuloLinha}>{tx('Consultor')} *</label>
                                        <SeletorConsultor
                                            idCampo={`venda-consultor-${item.id}`}
                                            consultores={vendedoresDaUnidade}
                                            valor={item.vendedor}
                                            desabilitado={!formData.unidade}
                                            onEscolher={(nome) => handleItemChange(item.id, 'vendedor', nome)}
                                            {...controleLista(item.id, 'consultor')}
                                        />
                                    </div>

                                    {/* Qtd − 1 + */}
                                    <div className="w-[108px] shrink-0">
                                        <span className={rotuloLinha}>{tx("Qtd")}</span>
                                        <div className="h-11 flex items-stretch border border-[#D6DCE8] rounded-xl overflow-hidden bg-white dark:bg-slate-900 dark:border-slate-700">
                                            <button type="button" disabled={!item.nomeItem || item.quantidade <= 1} onClick={() => handleItemChange(item.id, 'quantidade', String(Math.max(1, (parseInt(item.quantidade) || 1) - 1)))}
                                                aria-label={tx('Diminuir quantidade')} className="w-9 shrink-0 flex items-center justify-center text-[#0F172A] hover:bg-[#F3F5FA] disabled:text-[#C3CAD8] disabled:hover:bg-transparent dark:text-white dark:hover:bg-slate-800 dark:disabled:text-slate-600">
                                                <Minus className="w-4 h-4" />
                                            </button>
                                            <input type="number" min="1" disabled={!item.nomeItem} value={item.quantidade} aria-label={tx('Quantidade')}
                                                onChange={(e) => handleItemChange(item.id, 'quantidade', e.target.value)}
                                                className="w-full min-w-0 text-center bg-transparent text-[14px] font-bold text-[#0F172A] outline-none tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:text-[#C3CAD8] dark:text-white" />
                                            <button type="button" disabled={!item.nomeItem} onClick={() => handleItemChange(item.id, 'quantidade', String((parseInt(item.quantidade) || 1) + 1))}
                                                aria-label={tx('Aumentar quantidade')} className="w-9 shrink-0 flex items-center justify-center text-[#0F172A] hover:bg-[#F3F5FA] disabled:text-[#C3CAD8] disabled:hover:bg-transparent dark:text-white dark:hover:bg-slate-800 dark:disabled:text-slate-600">
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Comissão do item (valor × quantidade) */}
                                    <div className="w-[108px] shrink-0">
                                        <span className={`${rotuloLinha} text-right`}>{tx('Comissão')}</span>
                                        <div className="h-11 px-3 bg-[#F3F5FA] rounded-xl flex items-center justify-end text-[14px] font-extrabold text-[#0F172A] tabular-nums whitespace-nowrap dark:bg-slate-800 dark:text-white" title={tx("Calculado automaticamente")} aria-label={tx('Comissão do item {n}', { n: indice + 1 })}>
                                            {item.valor}
                                        </div>
                                    </div>

                                    {/* Aviso do limite de doses únicas (só avisa; a venda continua liberada) */}
                                    {avisosDoses[item.id] && (
                                        <p role="status" className="order-last w-full basis-full text-[12px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/30">
                                            {avisosDoses[item.id].tipo === 'esgotado'
                                                ? tx('⚠️ A unidade já atingiu as {limite} doses únicas que contam para a meta em {mes}. Esta venda gera comissão normalmente, mas não conta para a meta nem para o ranking. Que tal oferecer Drybelly, Retention ou Force?', { limite: LIMITE_DOSES_POR_UNIDADE_MES, mes: nomeMesDaVenda })
                                                : tx('⚠️ Só {n} destas doses conta(m) para a meta; as outras geram comissão, mas não contam.', { n: avisosDoses[item.id].n })}
                                        </p>
                                    )}

                                    {/* Lixeira: só com mais de um item */}
                                    {itensForm.length > 1 && (
                                        <button type="button" onClick={() => handleRemoveItem(item.id)} title={tx("Remover Item")} aria-label={tx("Remover Item")}
                                            className="hidden min-[900px]:flex w-10 h-10 mb-0.5 shrink-0 rounded-xl border border-[#D6DCE8] text-[#5B6478] items-center justify-center hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors dark:border-slate-700 dark:hover:bg-rose-500/10">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-3">
                        <button type="button" onClick={handleAddItem}
                            className="w-full h-12 border-2 border-dashed border-[#D6DCE8] rounded-2xl text-[#1D4FD8] text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#F8FAFD] hover:border-[#1D4FD8]/40 transition-colors dark:border-slate-700 dark:text-blue-300 dark:hover:bg-slate-800/60">
                            <Plus className="w-4 h-4" />{tx('Adicionar outro item ou consultor')}
                        </button>
                    </div>
                </section>

                {/* ===== 3. FINALIZAR (faixa compacta) ===== */}
                <section className={`${cartao} !py-4 flex flex-col lg:flex-row lg:items-center gap-4 transition-opacity duration-300 ${!vendaLiberada ? 'opacity-40' : ''}`}>
                    <label className="flex-1 min-w-0 relative block">
                        <span className="sr-only">{tx('Observação de caixa (opcional)')}</span>
                        <MessageSquare className="w-4 h-4 text-[#5B6478] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input type="text" name="observacao" value={formData.observacao} onChange={handleMainChange} disabled={!vendaLiberada}
                            placeholder={tx('Observação de caixa (opcional) — ex.: pagamento no PIX')} className={`${campoBase} pl-10`} />
                    </label>
                    <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0">
                        <div className="text-right">
                            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#5B6478] dark:text-slate-400">{tx('Comissão total')}</p>
                            <p className="text-[24px] leading-tight font-extrabold text-[#0F172A] tabular-nums dark:text-white">{formatMoney(totalVenda)}</p>
                        </div>
                        <span title={oQueFalta || ''} className="inline-flex">
                            <button type="submit" disabled={!podeConfirmar}
                                className={`h-12 px-5 rounded-xl text-[15px] font-bold flex items-center gap-2 transition-colors ${podeConfirmar ? 'bg-[#0E9F6E] text-white hover:bg-[#0B7A52]' : 'bg-[#E4E8F0] text-[#5B6478] cursor-not-allowed dark:bg-slate-700 dark:text-slate-400'}`}>
                                {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" />{tx("Processando Caixa...")}</> : <><Check className="w-5 h-5" />{tx('Confirmar venda')}</>}
                            </button>
                        </span>
                    </div>
                </section>
                {oQueFalta && vendaLiberada && <p className="text-right text-[12px] font-semibold text-[#5B6478] -mt-2 dark:text-slate-400">{oQueFalta}</p>}
            </form>
        </>
    );
};

export default FormVenda;
