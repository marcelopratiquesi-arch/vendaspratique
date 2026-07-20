import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js'; 

import { formatarCPF, cpfValido } from './utils';
import Metricas from './Metricas';
import Kanban from './Kanban';
import Lista from './Lista';
import Modais from './Modais';
import { Database, Download, Users, ArrowRightCircle, ClipboardPaste, ListPlus, Trash2, CheckCircle2, Info, CheckSquare, AlertTriangle, Snowflake, RotateCcw } from 'lucide-react';

const CrmVisitantes = ({ usuarioLogado, visitantes = [], setVisitantes, colaboradores = [] }) => {
    const [formData, setFormData] = useState({ nome: '', cpf: '', telefone: '', email: '', tipo_lead: '', vendedor: '', observacao: '' });
    const [visaoAtiva, setVisaoAtiva] = useState('base'); 
    const [sucesso, setSucesso] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ==========================================
    // ESTADOS: SMART PASTE & SELEÇÃO NA BASE
    // ==========================================
    const [textoSmartPaste, setTextoSmartPaste] = useState('');
    const [previewLeads, setPreviewLeads] = useState([]);
    const [tipoLeadSmartPaste, setTipoLeadSmartPaste] = useState('CANCELADO/INATIVO');
    const [processandoPaste, setProcessandoPaste] = useState(false);
    const [estatisticasPaste, setEstatisticasPaste] = useState({ novos: 0, duplicados: 0 }); 
    
    const [selecionadosBase, setSelecionadosBase] = useState([]);

    // MODAIS E HISTÓRICO
    const [modalWpp, setModalWpp] = useState({ show: false, lead: null, texto: '' });
    const [modalDetalhe, setModalDetalhe] = useState({ show: false, lead: null });
    const [historicoLead, setHistoricoLead] = useState([]);
    const [loadingHistorico, setLoadingHistorico] = useState(false);

    const [consultorAtivo, setConsultorAtivo] = useState(null);

    const META_DIARIA = 150; 
    const [progressoHoje, setProgressoHoje] = useState([]);
    const [mostrarRelatorio, setMostrarRelatorio] = useState(false);

    useEffect(() => {
        if (usuarioLogado?.role === 'RECEPCAO' && !consultorAtivo) return;
        const dataHoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
        const nomeOperador = consultorAtivo ? consultorAtivo.nome : usuarioLogado?.nome;
        const chaveLocal = `crm_meta_${nomeOperador}_${dataHoje}`;
        const salvo = localStorage.getItem(chaveLocal);
        if (salvo) setProgressoHoje(JSON.parse(salvo));
        else setProgressoHoje([]); 
    }, [usuarioLogado, consultorAtivo]);

    useEffect(() => { 
        if (window.lucide) window.lucide.createIcons(); 
    }, [visaoAtiva, visitantes, sucesso, isSubmitting, modalWpp.show, modalDetalhe.show, historicoLead, progressoHoje, mostrarRelatorio, consultorAtivo, previewLeads, selecionadosBase]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'cpf') setFormData({ ...formData, cpf: formatarCPF(value) });
        else setFormData({ ...formData, [name]: value });
    };

    // 🤖 AUDITORIA EM TEMPO REAL: Verifica se o CPF digitado manualmente já existe no banco
    const cpfDigitadoLimpo = formData.cpf.replace(/\D/g, '');
    const leadDuplicadoManual = cpfDigitadoLimpo.length === 11 
        ? visitantes.find(v => v.cpf && v.cpf.replace(/\D/g, '') === cpfDigitadoLimpo) 
        : null;

    const registrarHistorico = async (leadId, tipoAcao, observacao, ignorarMeta = false) => {
        const consultorAtual = consultorAtivo ? consultorAtivo.nome : (usuarioLogado?.nome || 'Sistema');
        
        const novoRegistro = {
            id: Date.now().toString(),
            lead_id: String(leadId),
            tipo_acao: tipoAcao,
            consultor: consultorAtual,
            observacao: observacao,
            data_registro: new Date().toISOString()
        };

        if (modalDetalhe.show && modalDetalhe.lead?.id === leadId) {
            setHistoricoLead(prev => [novoRegistro, ...prev]);
        }

        if (!ignorarMeta) {
            setProgressoHoje(prev => {
                const novaLista = [...prev, { tipo: tipoAcao, observacao: observacao, data_contato: novoRegistro.data_registro }];
                const dataHoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
                localStorage.setItem(`crm_meta_${consultorAtual}_${dataHoje}`, JSON.stringify(novaLista));
                return novaLista;
            });
        }

        await supabase.from('historico_leads').insert([{
            lead_id: String(leadId),
            tipo_acao: tipoAcao,
            consultor: consultorAtual,
            observacao: observacao
        }]);
    };

    const carregarHistoricoLead = async (leadId) => {
        setLoadingHistorico(true);
        const { data } = await supabase.from('historico_leads').select('*').eq('lead_id', String(leadId)).order('data_registro', { ascending: false });
        if (data) setHistoricoLead(data);
        setLoadingHistorico(false);
    };

    // ==========================================
    // CAPTURA MANUAL BLINDADA
    // ==========================================
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (leadDuplicadoManual) {
            alert(`🚨 BLOQUEADO: Este CPF já está registrado no sistema para o aluno ${leadDuplicadoManual.nome}.`);
            return;
        }

        if (!formData.nome.trim() || !cpfValido(formData.cpf) || !formData.telefone.trim() || !formData.tipo_lead || !formData.vendedor) { 
            alert('Preencha todos os campos corretamente.'); return; 
        }

        setIsSubmitting(true);

        const novoLead = {
            unidade: usuarioLogado?.unidade || 'MATRIZ',
            nome: formData.nome.toUpperCase(),
            cpf: formData.cpf,
            telefone: formData.telefone,
            email: formData.email.trim() || null, 
            tipo_lead: formData.tipo_lead, 
            vendedor: formData.vendedor,
            observacao: formData.observacao,
            data: new Date().toLocaleDateString('pt-BR'), 
            criado_em: new Date().toISOString(), 
            status: 'Novo',
            puxado_em: null,
            puxado_por: null,
            perdido_em: null
        };

        const { data, error } = await supabase.from('leads').insert([novoLead]).select();

        if (error) {
            alert("Erro do Banco de Dados: Este CPF já está registrado na nuvem de forma definitiva.");
        } else if (data && data[0]) {
            setVisitantes(prev => [data[0], ...prev]);
            setSucesso(true);
            
            await registrarHistorico(data[0].id, 'Captura', `Lead inserido na Base como ${formData.tipo_lead}.`, true);
            if(formData.observacao) await registrarHistorico(data[0].id, 'Observação', formData.observacao, true);

            setTimeout(() => setSucesso(false), 3000);
            setFormData({ nome: '', cpf: '', telefone: '', email: '', tipo_lead: '', vendedor: '', observacao: '' });
        }
        setIsSubmitting(false);
    };

    // ==========================================
    // O MOTOR DO SMART PASTE 
    // ==========================================
    const processarColagem = (texto) => {
        setTextoSmartPaste(texto);
        if (!texto.trim()) { 
            setPreviewLeads([]); 
            setEstatisticasPaste({ novos: 0, duplicados: 0 });
            return; 
        }

        const linhas = texto.split('\n');
        const mapeados = [];
        let qtdNovos = 0;
        let qtdDuplicados = 0;

        linhas.forEach(linha => {
            if (!linha.trim()) return;
            const colunas = linha.split('\t');
            let nome = '', telefone = '', cpf = '';
            
            const isMatricula = /^\d{4,8}$/.test(colunas[0]?.trim());

            if (isMatricula) {
                nome = colunas[1]?.trim().toUpperCase() || '';
                telefone = colunas[2]?.trim() || '';
            } else {
                nome = colunas[0]?.trim().toUpperCase() || '';
                telefone = colunas[1]?.trim() || '';
                cpf = colunas[2]?.trim() || '';
            }
            
            let cpfLimpo = cpf.replace(/\D/g, '');
            let cpfFormatado = cpfLimpo.length === 11 ? formatarCPF(cpfLimpo) : '';
            let telLimpo = telefone.replace(/\D/g, '');

            if (nome) {
                let motivoDuplicidade = null;

                const jaExisteBanco = visitantes.some(v => {
                    const vCpfLimpo = v.cpf ? v.cpf.replace(/\D/g, '') : '';
                    const vTelLimpo = v.telefone ? v.telefone.replace(/\D/g, '') : '';

                    if (cpfLimpo && vCpfLimpo && cpfLimpo === vCpfLimpo) {
                        motivoDuplicidade = 'CPF CADASTRADO';
                        return true;
                    }
                    if (telLimpo && vTelLimpo && telLimpo === vTelLimpo && telLimpo.length >= 10) {
                        motivoDuplicidade = 'TELEFONE CADASTRADO';
                        return true;
                    }
                    return false;
                });

                const jaExisteLista = mapeados.some(m => {
                    const mTelLimpo = m.telefone.replace(/\D/g, '');
                    if (cpfLimpo && m.cpf.replace(/\D/g, '') === cpfLimpo) {
                         motivoDuplicidade = 'CPF DUPLICADO NA LISTA';
                         return true;
                    }
                    if (telLimpo && mTelLimpo === telLimpo && telLimpo.length >= 10) {
                         motivoDuplicidade = 'TELEFONE DUPLICADO NA LISTA';
                         return true;
                    }
                    return false;
                });

                const isDuplicado = jaExisteBanco || jaExisteLista;

                if (isDuplicado) qtdDuplicados++; else qtdNovos++;

                mapeados.push({ 
                    id_temp: Math.random().toString(), 
                    nome, 
                    telefone: telefone || 'S/N', 
                    cpf: cpfFormatado,
                    isDuplicado,
                    motivo: motivoDuplicidade
                });
            }
        });

        setEstatisticasPaste({ novos: qtdNovos, duplicados: qtdDuplicados });
        setPreviewLeads(mapeados);
    };

    const confirmarSmartPaste = async () => {
        const leadsValidos = previewLeads.filter(l => !l.isDuplicado);
        
        if (leadsValidos.length === 0) {
            alert("Nenhum lead novo para salvar. Todos os registros colados já existem na base.");
            setTextoSmartPaste('');
            setPreviewLeads([]);
            setEstatisticasPaste({ novos: 0, duplicados: 0 });
            return;
        }

        setProcessandoPaste(true);

        const agora = new Date().toISOString();
        const dataBR = new Date().toLocaleDateString('pt-BR');

        const loteDeLeads = leadsValidos.map(lead => ({
            unidade: usuarioLogado?.unidade || 'MATRIZ',
            nome: lead.nome,
            telefone: lead.telefone,
            cpf: lead.cpf || null,
            tipo_lead: tipoLeadSmartPaste,
            vendedor: 'Importação',
            status: 'Novo',
            data: dataBR,
            criado_em: agora,
            puxado_em: null,
            puxado_por: null,
            perdido_em: null
        }));

        const { data, error } = await supabase.from('leads').insert(loteDeLeads).select();

        if (error) {
            alert("Ocorreu um erro ao importar o lote. Detalhe: " + error.message);
        } else if (data) {
            setVisitantes(prev => [...data, ...prev]);
            for (const leadSalvo of data) {
                await registrarHistorico(leadSalvo.id, 'Importação em Lote', `Inserido na Base via Smart Paste.`, true);
            }
            alert(`${data.length} leads inseridos na Base com sucesso!`);
            setTextoSmartPaste('');
            setPreviewLeads([]);
            setEstatisticasPaste({ novos: 0, duplicados: 0 });
        }
        setProcessandoPaste(false);
    };

    // ==========================================
    // EXCLUSÃO REAL E DEFINITIVA (HARD DELETE)
    // ==========================================
    const excluirSelecionadosBase = async () => {
        if (selecionadosBase.length === 0) return;
        
        if(window.confirm(`ATENÇÃO DELETAR DADOS: Deseja EXCLUIR DEFINITIVAMENTE os ${selecionadosBase.length} contatos da base bruta do Supabase?\n\nIsso apagará os dados do banco e liberará os CPFs. Esta ação NÃO pode ser desfeita.`)) {
            const backupVisitantes = [...visitantes];
            // Remove imediatamente da tela para a UX ficar fluida
            setVisitantes(prev => prev.filter(v => !selecionadosBase.includes(v.id)));
            
            // Dispara a deleção real no banco de dados
            const { error } = await supabase.from('leads').delete().in('id', selecionadosBase);
            
            if (error) {
                setVisitantes(backupVisitantes);
                alert("Erro ao excluir os contatos no banco. Ação revertida.");
            } else {
                alert(`${selecionadosBase.length} leads foram apagados definitivamente do sistema!`);
                setSelecionadosBase([]);
            }
        }
    };

    const deletarLeadsEmLote = async (ids) => {
        if(window.confirm(`ATENÇÃO LIXEIRA: Deseja EXCLUIR DEFINITIVAMENTE os ${ids.length} leads selecionados do banco de dados?\n\nEles sumirão do funil, os CPFs serão liberados e o histórico apagado.`)) {
            const backupVisitantes = [...visitantes];
            setVisitantes(prev => prev.filter(v => !ids.includes(v.id)));
            
            const { error } = await supabase.from('leads').delete().in('id', ids);
            
            if (error) {
                setVisitantes(backupVisitantes);
                alert("Erro ao excluir. Ação revertida.");
            } else {
                alert(`${ids.length} leads foram apagados permanentemente!`);
            }
        }
    };

    const deletarLead = async (id) => {
        if(window.confirm('EXCLUIR DEFINITIVAMENTE este Lead do banco de dados?\nEle desaparecerá do funil e o CPF ficará livre para um novo cadastro no futuro.')) {
            const backupVisitantes = [...visitantes];
            setVisitantes(visitantes.filter(v => v.id !== id));
            
            const { error } = await supabase.from('leads').delete().eq('id', id);
            
            if (error) {
                setVisitantes(backupVisitantes);
                alert("Erro ao excluir do banco de dados.");
            } else {
                if (modalDetalhe.show && modalDetalhe.lead?.id === id) setModalDetalhe({ show: false, lead: null });
            }
        }
    };

    // ==========================================
    // PUXAR FILA E ALTERAR STATUS
    // ==========================================
    const executarPuxada = async (idsParaPuxar, msgSucesso) => {
        const consultorAtual = consultorAtivo ? consultorAtivo.nome : usuarioLogado?.nome;
        if (!consultorAtual) return alert("Selecione um operador primeiro!");

        const agora = new Date().toISOString();
        setVisitantes(prev => prev.map(v => idsParaPuxar.includes(v.id) ? { ...v, puxado_em: agora, puxado_por: consultorAtual, vendedor: consultorAtual } : v));

        const { error } = await supabase.from('leads').update({ puxado_em: agora, puxado_por: consultorAtual, vendedor: consultorAtual }).in('id', idsParaPuxar);

        if (error) {
            alert("Erro de conexão. A fila não foi puxada corretamente.");
        } else {
            idsParaPuxar.forEach(id => registrarHistorico(id, 'Fila de Trabalho', `Lead puxado da base para atendimento.`, true));
            alert(msgSucesso);
            setSelecionadosBase([]); 
            setVisaoAtiva('kanban'); 
        }
    };

    const puxarLote = async (quantidade) => {
        const leadsLivres = visitantes.filter(v => !v.puxado_em && v.status !== 'Arquivado').sort((a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime()).slice(0, quantidade);
        if (leadsLivres.length === 0) return alert("A Base de Leads está vazia!");
        const ids = leadsLivres.map(l => l.id);
        executarPuxada(ids, `${leadsLivres.length} leads foram enviados para o seu Kanban!`);
    };

    const puxarSelecionados = async () => {
        if (selecionadosBase.length === 0) return;
        executarPuxada(selecionadosBase, `${selecionadosBase.length} leads selecionados foram para o Kanban!`);
    };

    const alterarStatusEmLote = async (ids, novoStatus) => {
        const confirmacao = novoStatus === 'Perdido' 
            ? `Enviar ${ids.length} contatos para a Geladeira (Espera de 30 dias)?` 
            : `Mover ${ids.length} contatos para a fase ${novoStatus}?`;

        if(window.confirm(confirmacao)) {
            const dataPerdido = novoStatus === 'Perdido' ? new Date().toISOString() : null;
            const backupVisitantes = [...visitantes];

            setVisitantes(prev => prev.map(v => ids.includes(v.id) ? { ...v, status: novoStatus, perdido_em: dataPerdido } : v));
            const { error } = await supabase.from('leads').update({ status: novoStatus, perdido_em: dataPerdido }).in('id', ids);

            if (error) {
                setVisitantes(backupVisitantes);
                alert("Erro de conexão. Ação revertida.");
            } else {
                ids.forEach(id => registrarHistorico(id, 'Mudança de Fase', `Movido em lote para "${novoStatus}".`, true));
                alert("Operação em lote concluída com sucesso!");
            }
        }
    };

    const alterarStatus = async (id, novoStatus) => {
        const leadAtual = visitantes.find(v => v.id === id);
        const statusAntigo = leadAtual ? leadAtual.status : null;
        if (statusAntigo === novoStatus) return;

        const dataPerdido = novoStatus === 'Perdido' ? new Date().toISOString() : null;

        setVisitantes(visitantes.map(v => v.id === id ? { ...v, status: novoStatus, perdido_em: dataPerdido } : v));
        if (modalDetalhe.show && modalDetalhe.lead?.id === id) setModalDetalhe({ ...modalDetalhe, lead: { ...modalDetalhe.lead, status: novoStatus, perdido_em: dataPerdido } });

        await registrarHistorico(id, 'Mudança de Fase', `Movido de "${statusAntigo}" para "${novoStatus}"`);
        const { error } = await supabase.from('leads').update({ status: novoStatus, perdido_em: dataPerdido }).eq('id', id);

        if (error) {
            setVisitantes(visitantes.map(v => v.id === id ? { ...v, status: statusAntigo } : v));
            alert("Erro de conexão. Revertendo ação.");
        }
    };

    // ==========================================
    // CATRACA DE IDENTIFICAÇÃO E RENDERIZAÇÃO
    // ==========================================
    if (usuarioLogado?.role === 'RECEPCAO' && !consultorAtivo) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] animate-[fadeIn_0.3s_ease-out] px-4">
                <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-inner border border-blue-200">
                    <i data-lucide="users" className="w-10 h-10"></i>
                </div>
                <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tight text-center">Quem está operando o CRM?</h2>
                <p className="text-slate-500 mb-10 font-medium text-center">Selecione seu nome para iniciar o turno.</p>
                
                {colaboradores.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl text-center max-w-md">
                        <p className="text-amber-700 font-bold">Nenhum consultor cadastrado nesta unidade.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 w-full max-w-4xl">
                        {colaboradores.map(c => (
                            <button key={c.id} onClick={() => setConsultorAtivo(c)} className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm hover:border-blue-500 hover:shadow-lg hover:-translate-y-1 transition-all group flex flex-col items-center gap-4">
                                <div className="w-14 h-14 bg-slate-100 text-slate-500 group-hover:bg-blue-500 group-hover:text-white rounded-full flex items-center justify-center font-black text-xl transition-colors shadow-inner">{c.nome.charAt(0)}</div>
                                <div className="text-center">
                                    <span className="font-black text-slate-700 group-hover:text-blue-700 block leading-tight">{c.nome.split(' ')[0]}</span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 block">{c.nome.split(' ').slice(1).join(' ')}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    const consultorLogado = consultorAtivo ? consultorAtivo.nome : usuarioLogado?.nome;
    const leadsNaBase = visitantes.filter(v => !v.puxado_em && v.status !== 'Arquivado').sort((a,b) => new Date(b.criado_em) - new Date(a.criado_em));
    const meusLeadsAtivos = visitantes.filter(v => v.puxado_em && v.puxado_por === consultorLogado && v.status !== 'Arquivado' && v.status !== 'Perdido');
    const meusLeadsGeladeira = visitantes.filter(v => v.puxado_por === consultorLogado && v.status === 'Perdido');

    const vendedoresPermitidos = colaboradores.filter(c => {
        const role = String(c.role || c.cargo || '').toUpperCase();
        return role.includes('LIDER') || role.includes('LÍDER') || role.includes('RECEP');
    });
    const opcoesVendedor = vendedoresPermitidos.length > 0 ? vendedoresPermitidos : colaboradores;

    const pctMeta = Math.min(100, Math.round((progressoHoje.length / META_DIARIA) * 100));
    const metaBatida = progressoHoje.length >= META_DIARIA;

    return (
        <div className="space-y-6 animate-[fadeIn_0.4s_ease-out] max-w-[1400px] mx-auto relative">

            {/* HEADER DE PRODUTIVIDADE */}
            <div className="bg-white rounded-[24px] border border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm flex-wrap gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-[300px]">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors shrink-0 ${metaBatida ? 'bg-emerald-100 text-emerald-600 shadow-inner' : 'bg-orange-100 text-orange-600 shadow-inner'}`}>
                        {metaBatida ? <i data-lucide="trophy" className="w-6 h-6"></i> : <i data-lucide="target" className="w-6 h-6 animate-pulse"></i>}
                    </div>
                    <div className="flex-1 max-w-xl">
                        <div className="flex justify-between items-end mb-1.5">
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Operador: <strong className="text-blue-600">{consultorLogado}</strong></span>
                            <span className={`text-xs font-black transition-colors ${metaBatida ? 'text-emerald-600' : 'text-orange-600'}`}>{progressoHoje.length} / {META_DIARIA} Ações Reais</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden shadow-inner">
                            <div className={`h-2.5 rounded-full transition-all duration-500 ease-out ${metaBatida ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{ width: `${pctMeta}%` }}></div>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    {consultorAtivo && (
                        <button onClick={() => setConsultorAtivo(null)} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center gap-2 bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200">
                            <i data-lucide="log-out" className="w-4 h-4"></i> Trocar
                        </button>
                    )}
                    <button onClick={() => setMostrarRelatorio(true)} className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center gap-2 ${metaBatida ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-[0_4px_15px_rgba(16,185,129,0.3)]' : 'bg-slate-800 text-white hover:bg-black border border-slate-700 shadow-md'}`}>
                        <i data-lucide="file-text" className="w-4 h-4"></i> Fechar Turno
                    </button>
                </div>
            </div>

            {/* BARRA DE NAVEGAÇÃO / ABAS */}
            <div className="flex bg-slate-200 p-1.5 rounded-xl border border-slate-300/60 shadow-inner w-full max-w-4xl mx-auto overflow-x-auto custom-scrollbar">
                <button onClick={() => setVisaoAtiva('base')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${visaoAtiva === 'base' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:text-slate-800'}`}>
                    <Database className="w-4 h-4" /> Base ({leadsNaBase.length})
                </button>
                <button onClick={() => setVisaoAtiva('kanban')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${visaoAtiva === 'kanban' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}>
                    <i data-lucide="kanban" className="w-4 h-4"></i> Kanban
                </button>
                <button onClick={() => setVisaoAtiva('lista')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${visaoAtiva === 'lista' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}>
                    <i data-lucide="list" className="w-4 h-4"></i> Lista
                </button>
                <button onClick={() => setVisaoAtiva('geladeira')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${visaoAtiva === 'geladeira' ? 'bg-cyan-500 shadow-sm text-white' : 'text-slate-500 hover:text-slate-800'}`}>
                    <Snowflake className="w-4 h-4" /> Geladeira ({meusLeadsGeladeira.length})
                </button>
                <button onClick={() => setVisaoAtiva('dashboard')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${visaoAtiva === 'dashboard' ? 'bg-slate-900 shadow-sm text-white' : 'text-slate-500 hover:text-slate-800'}`}>
                    <i data-lucide="pie-chart" className="w-4 h-4"></i> Métricas
                </button>
            </div>

            {/* ABA GELADEIRA (RECUPERAÇÃO) */}
            {visaoAtiva === 'geladeira' && (
                <div className="bg-white rounded-[24px] border border-cyan-200 shadow-sm p-6 lg:p-8 animate-[fadeIn_0.3s_ease-out]">
                    <div className="flex items-center gap-4 mb-8 border-b border-slate-100 pb-6">
                        <div className="w-14 h-14 bg-cyan-50 text-cyan-500 rounded-2xl flex items-center justify-center shadow-inner">
                            <Snowflake className="w-7 h-7" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Geladeira de Contatos (30 Dias)</h2>
                            <p className="text-sm text-slate-500 font-medium">Contatos que deram "Perdido". Aguarde o tempo de maturação para tentar resgatá-los para o Kanban.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {meusLeadsGeladeira.length === 0 ? (
                            <p className="text-slate-400 font-bold col-span-3 text-center py-10 uppercase tracking-widest text-xs">Sua geladeira está vazia.</p>
                        ) : (
                            meusLeadsGeladeira.map(v => {
                                const diasNaGeladeira = Math.floor((new Date() - new Date(v.perdido_em)) / (1000 * 60 * 60 * 24));
                                const liberado = diasNaGeladeira >= 30;

                                return (
                                    <div key={v.id} className={`p-5 rounded-2xl border ${liberado ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'} relative flex flex-col`}>
                                        <h4 className="font-black text-slate-800 uppercase text-sm mb-1 pr-10">{v.nome}</h4>
                                        <p className="text-xs font-bold text-slate-500 mb-4">{v.telefone}</p>
                                        
                                        <div className="mt-auto pt-4 border-t border-slate-200/60 flex items-center justify-between">
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${liberado ? 'text-emerald-700 bg-emerald-200/50' : 'text-slate-500 bg-slate-200'}`}>
                                                {diasNaGeladeira} / 30 Dias
                                            </span>
                                            
                                            <button 
                                                onClick={() => alterarStatus(v.id, 'Novo')}
                                                disabled={!liberado}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${liberado ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                                                title={liberado ? "Resgatar para o Kanban" : "Ainda em maturação"}
                                            >
                                                <RotateCcw className="w-3.5 h-3.5" /> Resgatar
                                            </button>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            )}

            {/* ABA BASE DE LEADS */}
            {visaoAtiva === 'base' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    
                    <div className="space-y-6">
                        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden animate-[fadeIn_0.3s_ease-out] p-6 lg:p-8 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mb-4 border border-indigo-100">
                                <Users className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">Fila de Trabalho Automática</h3>
                            <p className="text-sm text-slate-500 font-medium mb-6">
                                <strong className="text-indigo-600">{leadsNaBase.length} leads</strong> aguardando na Piscina. Puxe um lote para começar a vender.
                            </p>

                            <div className="flex items-center gap-3 w-full bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <select id="qtdPuxar" className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-xs font-black text-slate-700 outline-none uppercase tracking-widest cursor-pointer shadow-sm">
                                    <option value="10">Puxar 10 contatos</option>
                                    <option value="20">Puxar 20 contatos</option>
                                    <option value="50">Puxar 50 contatos</option>
                                    <option value="100">Puxar 100 contatos</option>
                                </select>
                                <button onClick={() => puxarLote(Number(document.getElementById('qtdPuxar').value))} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-3.5 rounded-xl shadow-[0_4px_15px_rgba(79,70,229,0.3)] transition-all flex items-center justify-center gap-2 uppercase text-[10px] tracking-widest">
                                    <ArrowRightCircle className="w-5 h-5" /> Iniciar
                                </button>
                            </div>
                        </div>

                        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-6 lg:p-8">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><i data-lucide="user-plus" className="w-4 h-4"></i> Inserção Manual (1 Lead)</h3>
                            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                                <div className="flex gap-4">
                                    <select name="tipo_lead" value={formData.tipo_lead} onChange={handleChange} required className="w-1/3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-xs font-black text-slate-700 outline-none uppercase shadow-sm">
                                        <option value="" disabled hidden>Tipo...</option>
                                        <option value="VISITANTE">VISITANTE</option>
                                        <option value="CANCELADO/INATIVO">CANCELADO/INATIVO</option>
                                    </select>
                                    <input type="text" name="nome" value={formData.nome} onChange={handleChange} required placeholder="Nome do Lead" className="w-2/3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 outline-none uppercase shadow-sm" />
                                </div>
                                <div className="flex gap-4">
                                    <div className="w-1/2 flex flex-col">
                                        <input type="text" name="cpf" value={formData.cpf} onChange={handleChange} placeholder="CPF" maxLength={14} className={`bg-slate-50 border ${leadDuplicadoManual ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-200'} rounded-xl px-4 py-3 text-xs font-bold text-slate-700 outline-none shadow-sm transition-colors`} />
                                        {leadDuplicadoManual && (
                                            <span className="text-[9px] text-rose-500 font-black uppercase mt-1.5 flex items-center gap-1 animate-[fadeIn_0.2s_ease-out]">
                                                <AlertTriangle className="w-3 h-3"/> Já Existe: {leadDuplicadoManual.nome} ({leadDuplicadoManual.status})
                                            </span>
                                        )}
                                    </div>
                                    <div className="w-1/2 flex flex-col">
                                        <input type="text" name="telefone" value={formData.telefone} onChange={handleChange} required placeholder="Telefone/Zap" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 outline-none shadow-sm" />
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <select name="vendedor" value={formData.vendedor} onChange={handleChange} required className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-xs font-bold text-slate-700 outline-none uppercase shadow-sm">
                                        <option value="">Consultor...</option>
                                        {opcoesVendedor.map(c => <option key={c.id} value={c.nome}>{c.nome.split(' ')[0]}</option>)}
                                    </select>
                                    <input type="text" name="observacao" value={formData.observacao} onChange={handleChange} placeholder="Observação..." className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 outline-none shadow-sm" />
                                </div>
                                <button type="submit" disabled={isSubmitting || !!leadDuplicadoManual} className="w-full mt-2 bg-slate-800 hover:bg-black disabled:opacity-50 disabled:bg-slate-300 disabled:text-slate-500 text-white font-black py-3.5 rounded-xl shadow-md transition-all uppercase text-[10px] tracking-widest flex items-center justify-center gap-2">
                                    {isSubmitting ? <i data-lucide="loader-2" className="w-4 h-4 animate-spin"></i> : 'Salvar na Base'}
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="bg-white rounded-[24px] border-2 border-emerald-500/30 shadow-lg shadow-emerald-500/10 overflow-hidden animate-[slideUp_0.4s_ease-out] p-6 lg:p-8 flex flex-col h-full relative">
                        <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest px-4 py-1 rounded-bl-2xl shadow-sm">Mais Rápido ⚡</div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                                <ClipboardPaste className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 tracking-tight">Smart Paste</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Injeção em Lote</p>
                            </div>
                        </div>

                        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl mb-4 text-xs font-medium text-emerald-800 flex items-start gap-3">
                            <Info className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                            <p>Copie as linhas na Pacto, dê <kbd className="bg-white px-1.5 py-0.5 rounded border border-emerald-200 shadow-sm font-mono text-[10px]">Ctrl+C</kbd> e cole abaixo com <kbd className="bg-white px-1.5 py-0.5 rounded border border-emerald-200 shadow-sm font-mono text-[10px]">Ctrl+V</kbd>.</p>
                        </div>

                        <select value={tipoLeadSmartPaste} onChange={(e) => setTipoLeadSmartPaste(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-black text-slate-700 outline-none uppercase shadow-sm mb-4 cursor-pointer">
                            <option value="VISITANTE">Classificar lote como: VISITANTE</option>
                            <option value="CANCELADO/INATIVO">Classificar lote como: CANCELADO/INATIVO</option>
                        </select>

                        <textarea 
                            value={textoSmartPaste} onChange={(e) => processarColagem(e.target.value)} placeholder="Cole aqui..."
                            className="w-full flex-1 min-h-[180px] bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-5 text-sm font-mono text-slate-600 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all resize-none custom-scrollbar whitespace-pre"
                        />

                        {previewLeads.length > 0 && (
                            <div className="mt-4 animate-[zoomIn_0.2s_ease-out]">
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md">{estatisticasPaste.novos} Novos</span>
                                        {estatisticasPaste.duplicados > 0 && (
                                            <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 bg-rose-50 border border-rose-100 px-2 py-1 rounded-md flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3"/> {estatisticasPaste.duplicados} Ignorados
                                            </span>
                                        )}
                                    </div>
                                    <button onClick={() => {setTextoSmartPaste(''); setPreviewLeads([]); setEstatisticasPaste({novos:0, duplicados:0});}} className="text-[10px] font-black uppercase text-rose-500 hover:text-rose-700 flex items-center gap-1 transition-colors"><Trash2 className="w-3 h-3"/> Limpar</button>
                                </div>
                                
                                <div className="max-h-[140px] overflow-y-auto custom-scrollbar bg-slate-50 border border-slate-200 rounded-xl mb-4">
                                    <table className="w-full text-left">
                                        <tbody>
                                            {previewLeads.slice(0,50).map((l) => (
                                                <tr key={l.id_temp} className={`border-b border-slate-100 last:border-0 text-[10px] uppercase font-bold transition-opacity ${l.isDuplicado ? 'text-slate-400 opacity-60 bg-slate-100/50' : 'text-slate-700'}`}>
                                                    <td className="px-3 py-2 truncate max-w-[140px] flex items-center">
                                                        {l.isDuplicado && <span className="mr-2 text-[8px] bg-rose-100 border border-rose-200 text-rose-600 px-1.5 py-0.5 rounded shadow-sm font-black whitespace-nowrap">{l.motivo}</span>}
                                                        <span className="truncate">{l.nome}</span>
                                                    </td>
                                                    <td className="px-3 py-2">{l.telefone}</td>
                                                </tr>
                                            ))}
                                            {previewLeads.length > 50 && (
                                                <tr><td colSpan="2" className="px-3 py-2 text-center text-[10px] font-bold text-slate-400">...e mais {previewLeads.length - 50} linhas</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                
                                <button onClick={confirmarSmartPaste} disabled={processandoPaste || estatisticasPaste.novos === 0} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:bg-slate-300 disabled:text-slate-500 text-white font-black py-4 rounded-xl shadow-[0_4px_15px_rgba(16,185,129,0.3)] transition-all uppercase text-[10px] tracking-widest flex items-center justify-center gap-2">
                                    {processandoPaste ? <i data-lucide="loader-2" className="w-5 h-5 animate-spin"></i> : <><CheckCircle2 className="w-5 h-5" /> Salvar {estatisticasPaste.novos} Novos no Banco</>}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-6 lg:p-8 col-span-1 lg:col-span-2 mt-2">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 tracking-tight">
                                    <Database className="w-5 h-5 text-indigo-500"/> Banco Bruto 
                                    <span className="text-[10px] bg-slate-100 px-2.5 py-1 rounded-md text-slate-500 uppercase tracking-widest ml-2 border border-slate-200">{leadsNaBase.length} Registros</span>
                                </h3>
                            </div>
                            
                            {selecionadosBase.length > 0 && (
                                <div className="flex items-center gap-3 animate-[fadeIn_0.2s_ease-out]">
                                    <button onClick={excluirSelecionadosBase} className="bg-rose-100 hover:bg-rose-200 text-rose-600 font-black px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 uppercase text-[10px] tracking-widest">
                                        <Trash2 className="w-4 h-4" /> Apagar do Banco ({selecionadosBase.length})
                                    </button>
                                    <button onClick={puxarSelecionados} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-2.5 rounded-xl shadow-[0_4px_15px_rgba(79,70,229,0.3)] transition-all flex items-center gap-2 uppercase text-[10px] tracking-widest">
                                        <CheckSquare className="w-4 h-4" /> Puxar para Fila
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="overflow-x-auto custom-scrollbar border border-slate-200 rounded-xl max-h-[400px]">
                            <table className="w-full text-left border-collapse min-w-max relative">
                                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-3 text-center w-12 border-b border-slate-200">
                                            <input 
                                                type="checkbox" 
                                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                checked={selecionadosBase.length === leadsNaBase.length && leadsNaBase.length > 0}
                                                onChange={(e) => e.target.checked ? setSelecionadosBase(leadsNaBase.map(l => l.id)) : setSelecionadosBase([])}
                                            />
                                        </th>
                                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Aluno / Lead</th>
                                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Contato</th>
                                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Tipo</th>
                                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Data Base</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {leadsNaBase.length > 0 ? leadsNaBase.map(v => (
                                        <tr key={v.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => {
                                            if (selecionadosBase.includes(v.id)) setSelecionadosBase(prev => prev.filter(id => id !== v.id));
                                            else setSelecionadosBase(prev => [...prev, v.id]);
                                        }}>
                                            <td className="px-4 py-3 text-center border-b border-slate-100">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                    checked={selecionadosBase.includes(v.id)}
                                                    onChange={() => {}}
                                                    onClick={(e) => e.stopPropagation()} 
                                                />
                                            </td>
                                            <td className="px-6 py-3 border-b border-slate-100">
                                                <p className="text-xs font-black text-slate-800 uppercase">{v.nome}</p>
                                                {v.cpf && <p className="text-[10px] font-bold text-slate-400 mt-0.5 tracking-wider">CPF: {v.cpf}</p>}
                                            </td>
                                            <td className="px-6 py-3 border-b border-slate-100">
                                                <p className="text-xs font-bold text-slate-600">{v.telefone}</p>
                                            </td>
                                            <td className="px-6 py-3 border-b border-slate-100">
                                                <span className={`px-2 py-1 rounded text-[9px] font-black tracking-widest uppercase border ${v.tipo_lead === 'VISITANTE' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : v.tipo_lead === 'CANCELADO/INATIVO' ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                    {v.tipo_lead || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase">
                                                {new Date(v.criado_em).toLocaleDateString('pt-BR')}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="5" className="text-center py-10 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                                A piscina de leads está vazia. Cole dados no Smart Paste para começar.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MÓDULOS EXTERNOS */}
            {visaoAtiva === 'dashboard' && <Metricas visitantes={meusLeadsAtivos} colaboradores={colaboradores} />}
            
            {visaoAtiva === 'kanban' && (
                <Kanban 
                    visitantes={meusLeadsAtivos} 
                    alterarStatus={alterarStatus} 
                    deletarLead={deletarLead} 
                    setModalWpp={setModalWpp} 
                    setModalDetalhe={setModalDetalhe} 
                    carregarHistoricoLead={carregarHistoricoLead} 
                    registrarHistorico={registrarHistorico} 
                    usuarioLogado={usuarioLogado}
                />
            )}
            
            {visaoAtiva === 'lista' && (
                <Lista 
                    visitantes={meusLeadsAtivos} 
                    alterarStatus={alterarStatus} 
                    deletarLead={deletarLead} 
                    alterarStatusEmLote={alterarStatusEmLote}
                    deletarLeadsEmLote={deletarLeadsEmLote}
                    setModalWpp={setModalWpp} 
                    setModalDetalhe={setModalDetalhe} 
                    carregarHistoricoLead={carregarHistoricoLead} 
                />
            )}

            <Modais 
                modalWpp={modalWpp} setModalWpp={setModalWpp} modalDetalhe={modalDetalhe} setModalDetalhe={setModalDetalhe}
                historicoLead={historicoLead} loadingHistorico={loadingHistorico} registrarHistorico={registrarHistorico} alterarStatus={alterarStatus}
                mostrarRelatorio={mostrarRelatorio} setMostrarRelatorio={setMostrarRelatorio} progressoHoje={progressoHoje} consultorAtivo={consultorAtivo}
                usuarioLogado={usuarioLogado} META_DIARIA={META_DIARIA} visitantes={meusLeadsAtivos} setConsultorAtivo={setConsultorAtivo}
            />

        </div>
    );
};

export default CrmVisitantes;