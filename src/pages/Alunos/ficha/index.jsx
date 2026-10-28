import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../supabaseClient.js';
import { ArrowLeft, User, Bookmark, ShoppingBag, Dumbbell, MessageCircle, Clock, Loader2, UserPlus, ShoppingCart } from 'lucide-react';
import CabecalhoFicha from './CabecalhoFicha.jsx';
import ResumoCardsFicha from './ResumoCardsFicha.jsx';
import TabDados from './TabDados.jsx';
import TabPlanos from './TabPlanos.jsx';
import TabProdutos from './TabProdutos.jsx';
import TabAvaliacoes from './TabAvaliacoes.jsx';
import TabContatosCrm from './TabContatosCrm.jsx';
import TabLinhaTempo from './TabLinhaTempo.jsx';
import { limparApenasDigitos } from '../utils.js';

const FichaAluno = ({ aluno, onVoltar, rotuloVoltar = 'Voltar para Lista', onEditar, onVender, onAvaliar, usuarioLogado }) => {
    const [abaAtiva, setAbaAtiva] = useState('dados');
    const [loadingDados, setLoadingDados] = useState(true);
    const [dadosFicha, setDadosFicha] = useState({
        planos: [], produtos: [], avaliacoes: [], crm: [], timeline: []
    });
    // Textos das perguntas do questionário (tabela avaliacao_perguntas), por id
    const [perguntasAvaliacao, setPerguntasAvaliacao] = useState({});
    
    const roleReal = String(usuarioLogado?.role || '').toUpperCase().trim();
    const temVisaoGlobal = roleReal === 'ADMIN' || roleReal === 'MENTOR';
    // Recepção só visualiza; excluir é para gestão
    const podeGerenciarAvaliacoes = ['ADMIN', 'MENTOR', 'LIDER'].includes(roleReal);

    // Sobe quando chega venda/avaliação nova deste aluno ou quando a aba do navegador volta ao foco:
    // a ficha busca tudo de novo, sem precisar sair e entrar
    const [versaoDados, setVersaoDados] = useState(0);
    const alunoJaCarregado = useRef(null);

    useEffect(() => {
        if (!aluno?.id) return undefined;
        const cpfLimpo = limparApenasDigitos(aluno.cpf);
        let timer = null;
        const atualizar = () => {
            clearTimeout(timer);
            timer = setTimeout(() => setVersaoDados(v => v + 1), 800);
        };
        let canal = supabase.channel(`ficha_aluno_${aluno.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'avaliacoes_realizadas', filter: `aluno_id=eq.${aluno.id}` }, atualizar);
        if (cpfLimpo) canal = canal.on('postgres_changes', { event: '*', schema: 'public', table: 'vendas', filter: `cpf=eq.${cpfLimpo}` }, atualizar);
        canal.subscribe();
        window.addEventListener('focus', atualizar);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('focus', atualizar);
            supabase.removeChannel(canal);
        };
    }, [aluno?.id, aluno?.cpf]);

    useEffect(() => {
        const buscarTudo = async () => {
            // Atualização do mesmo aluno é silenciosa (sem a tela de "Sincronizando...")
            const silencioso = alunoJaCarregado.current === aluno.id;
            if (!silencioso) setLoadingDados(true);
            try {
                const cpfLimpo = limparApenasDigitos(aluno.cpf);
                const telLimpo = limparApenasDigitos(aluno.telefone);

                const queries = [];
                queries.push(supabase.from('catalogo').select('nome, tipo'));
                queries.push(cpfLimpo ? supabase.from('vendas').select('*').or(`cpf.eq.${cpfLimpo},cpf.eq.${aluno.cpf}`).order('data', { ascending: false }).order('created_at', { ascending: false }) : { data: [] });
                queries.push(aluno.id ? supabase.from('avaliacoes_realizadas').select('*').eq('aluno_id', aluno.id).order('created_at', { ascending: false }) : { data: [] });
                
                let queryOrCrm = [];
                if (cpfLimpo) queryOrCrm.push(`cpf.eq.${cpfLimpo}`, `cpf.eq.${aluno.cpf}`);
                if (telLimpo) queryOrCrm.push(`telefone.ilike.%${telLimpo.length > 8 ? telLimpo.slice(-8) : telLimpo}%`);
                queries.push(queryOrCrm.length > 0 ? supabase.from('leads').select('*').or(queryOrCrm.join(',')).order('created_at', { ascending: false }) : { data: [] });
                // Todas as perguntas, inclusive as desativadas, para as avaliações antigas continuarem com o texto
                queries.push(supabase.from('avaliacao_perguntas').select('id, pergunta, ordem, descricao'));

                const [resCat, resVendas, resAval, resLeads, resPerguntas] = await Promise.all(queries);

                const mapaPerguntas = {};
                (resPerguntas?.data || []).forEach(p => {
                    if (p?.id) mapaPerguntas[p.id] = { pergunta: p.pergunta, ordem: p.ordem, descricao: p.descricao };
                });
                setPerguntasAvaliacao(mapaPerguntas);

                const mapCat = new Map();
                (resCat.data || []).forEach(c => mapCat.set(c.nome.toUpperCase().trim(), c.tipo.toLowerCase()));

                const vendasAll = resVendas.data || [];
                const avaliacoesAll = resAval.data || [];
                const leadsAll = resLeads.data || [];

                const planos = vendasAll.filter(v => {
                    const tipo = mapCat.get((v.produto || '').toUpperCase().trim()) || 'plano';
                    return tipo === 'plano' && (v.produto || '').toUpperCase().indexOf('DIARIA') === -1;
                });
                
                const produtos = vendasAll.filter(v => {
                    const nomeStr = (v.produto || '').toUpperCase().trim();
                    const tipo = mapCat.get(nomeStr) || 'produto';
                    return tipo !== 'plano' || nomeStr.indexOf('DIARIA') !== -1 || nomeStr.indexOf('AVALIACAO') !== -1 || nomeStr.indexOf('TAXA') !== -1;
                });

                let historicoCrm = [];
                if (leadsAll.length > 0) {
                    const leadIds = leadsAll.map(l => l.id);
                    // A data do histórico do CRM fica em "data_registro" (ordenar por created_at dava erro 400).
                    // O lead_id é texto nessa tabela.
                    const { data: hist, error: erroHist } = await supabase.from('historico_leads').select('*')
                        .in('lead_id', leadIds.map(String)).order('data_registro', { ascending: false });
                    if (erroHist) console.error('Erro ao buscar contatos do CRM do aluno:', erroHist);
                    // A aba Contatos e o cartão "Último Contato CRM" usam created_at / descricao / autor
                    historicoCrm = (hist || []).map(h => ({
                        ...h,
                        created_at: h.created_at || h.data_registro,
                        descricao: h.descricao || h.observacao,
                        autor: h.autor || h.consultor
                    }));
                }

                if (historicoCrm.length === 0 && leadsAll.length > 0) {
                    historicoCrm = leadsAll.map(l => ({
                        id: `lead_${l.id}`,
                        created_at: l.created_at || l.data,
                        tipo_acao: l.status || l.fase || 'CONTATO',
                        descricao: l.observacao || 'Lead inserido no funil.',
                        autor: l.vendedor || l.consultor || 'Sistema'
                    }));
                }

                const timeline = [];
                timeline.push({ id: `cad_${aluno.id}`, data_real: new Date(aluno.created_at), tipo: 'CADASTRO', titulo: 'Cadastro Realizado', descricao: `Aluno cadastrado no sistema (${aluno.unidade || 'Sem Vínculo'}).`, icone: UserPlus, corBg: 'bg-indigo-500' });
                vendasAll.forEach(v => timeline.push({ id: `venda_${v.id}`, data_real: new Date(v.data || v.created_at), tipo: 'VENDA', titulo: `Compra: ${v.produto}`, descricao: `Por ${v.vendedor || 'Sistema'} na unidade ${v.unidade}.`, icone: ShoppingCart, corBg: 'bg-blue-500' }));
                avaliacoesAll.forEach(av => timeline.push({ id: `aval_${av.id}`, data_real: new Date(av.data || av.created_at), tipo: 'AVALIACAO', titulo: 'Avaliação Física', descricao: `Avaliador: ${av.professor || 'N/I'}. Peso: ${av.peso}kg | Gordura: ${av.pgc}%`, icone: Dumbbell, corBg: 'bg-emerald-500' }));
                leadsAll.forEach(l => timeline.push({ id: `crm_lead_${l.id}`, data_real: new Date(l.created_at || l.data), tipo: 'CRM', titulo: `Funil CRM: ${l.status || l.fase || 'CONTATO'}`, descricao: `Consultor: ${l.vendedor || l.consultor || 'N/I'}.`, icone: MessageCircle, corBg: 'bg-amber-500' }));
                timeline.sort((a, b) => b.data_real - a.data_real);

                setDadosFicha({ planos, produtos, avaliacoes: avaliacoesAll, crm: historicoCrm, timeline });
                alunoJaCarregado.current = aluno.id;

            } catch (err) {
                console.error("Erro ao carregar Ficha 360:", err);
            } finally {
                setLoadingDados(false);
            }
        };

        if (aluno?.id) buscarTudo();
    }, [aluno.id, aluno.cpf, aluno.telefone, aluno.created_at, aluno.unidade, versaoDados]);

    const excluirAvaliacao = async (id) => {
        if (!window.confirm('Tem certeza que deseja excluir esta avaliação? Essa ação não pode ser desfeita.')) return;
        const { error } = await supabase.from('avaliacoes_realizadas').delete().eq('id', id);
        if (error) {
            console.error('Erro ao excluir avaliação:', error);
            alert('Não foi possível excluir a avaliação. Tente novamente.');
            return;
        }
        // Remove da aba Avaliações e também do Histórico, sem precisar recarregar
        setDadosFicha(prev => ({
            ...prev,
            avaliacoes: prev.avaliacoes.filter(a => a.id !== id),
            timeline: prev.timeline.filter(ev => ev.id !== `aval_${id}`)
        }));
    };

    const abasMenu = [
        { id: 'dados', label: 'Dados', icon: User },
        { id: 'planos', label: 'Planos', icon: Bookmark },
        { id: 'produtos', label: 'Produtos', icon: ShoppingBag },
        { id: 'avaliacoes', label: 'Avaliações', icon: Dumbbell },
        { id: 'crm', label: 'Contatos', icon: MessageCircle },
        { id: 'timeline', label: 'Histórico', icon: Clock }
    ];

    return (
        <div className="bg-[#F8FAFC] dark:bg-slate-900 rounded-[20px] p-5 md:p-6 flex flex-col min-h-[70vh] animate-[slideDown_0.2s_ease-out]">
            
            <div className="mb-5 flex items-center">
                <button 
                    onClick={onVoltar} 
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50 transition-colors shadow-sm focus:outline-none"
                >
                    <ArrowLeft className="w-3.5 h-3.5" /> {rotuloVoltar}
                </button>
            </div>

            <CabecalhoFicha aluno={aluno} onEditar={onEditar} onVender={() => onVender(aluno)} onAvaliar={() => onAvaliar(aluno)} />

            <ResumoCardsFicha aluno={aluno} dadosFicha={dadosFicha} loading={loadingDados} />

            <div className="flex bg-white p-1.5 rounded-xl border border-slate-200/80 overflow-x-auto custom-scrollbar mb-6 shadow-sm">
                {abasMenu.map(aba => {
                    const Icone = aba.icon;
                    const ativo = abaAtiva === aba.id;
                    return (
                        <button 
                            key={aba.id} 
                            onClick={() => setAbaAtiva(aba.id)} 
                            className={`flex-1 min-w-[100px] px-3 py-2.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 whitespace-nowrap outline-none ${
                                ativo 
                                ? 'bg-blue-50 text-blue-700' 
                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                            }`}
                        >
                            <Icone className="w-3.5 h-3.5" strokeWidth={ativo ? 2.5 : 2} /> {aba.label}
                        </button>
                    )
                })}
            </div>

            <div className="flex-1">
                {loadingDados ? (
                    <div className="py-16 flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sincronizando...</p>
                    </div>
                ) : (
                    <>
                        {abaAtiva === 'dados' && <TabDados aluno={aluno} onEditar={onEditar} temVisaoGlobal={temVisaoGlobal} />}
                        {abaAtiva === 'planos' && <TabPlanos planos={dadosFicha.planos} temVisaoGlobal={temVisaoGlobal} />}
                        {abaAtiva === 'produtos' && <TabProdutos produtos={dadosFicha.produtos} temVisaoGlobal={temVisaoGlobal} />}
                        {abaAtiva === 'avaliacoes' && (
                            <TabAvaliacoes 
                                avaliacoes={dadosFicha.avaliacoes}
                                alunoNome={aluno.nome}
                                perguntasPorId={perguntasAvaliacao}
                                podeExcluir={podeGerenciarAvaliacoes}
                                onExcluir={excluirAvaliacao}
                            />
                        )}
                        {abaAtiva === 'crm' && <TabContatosCrm historico={dadosFicha.crm} />}
                        {abaAtiva === 'timeline' && <TabLinhaTempo eventos={dadosFicha.timeline} alunoNome={aluno.nome} />}
                    </>
                )}
            </div>
        </div>
    );
};

export default FichaAluno;