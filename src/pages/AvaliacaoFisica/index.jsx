import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ListChecks, ArrowLeft } from 'lucide-react';
import { FaixaAvaliacao, BotaoFaixa } from './FaixaAvaliacao.jsx';
import { usePerguntasAvaliacao } from './carregarAvaliacoes.js';
import TabPerguntasAvaliacao from './TabPerguntasAvaliacao.jsx';
import ModalEvolucaoAluno from './ModalEvolucaoAluno.jsx';
import { FundoGlobalComFotos } from './FundoGlobal.jsx';
import PainelInicial from './PainelInicial.jsx';
import PainelAvaliador from './PainelAvaliador.jsx';
import LixeiraAvaliacoes from './LixeiraAvaliacoes.jsx';
import { tx } from '../../i18n/traduzir.js';
import { consumirSubaba, avisarSubabaAtual, EVENTO_PEDIR_SUBABA } from '../../components/subAbas.js';

const AvaliacaoFisica = ({ usuarioLogado, avaliacoes = [], colaboradores = [], alunoPreSelecionado = null, limparPreSelecao, onVoltarParaAluno }) => {
    const [professorAtivo, setProfessorAtivo] = useState(null); 
    const [abaAtiva, setAbaAtiva] = useState('relatorio');
    const [avaliacaoEditando, setAvaliacaoEditando] = useState(null);
    const [alunoEvolucaoModal, setAlunoEvolucaoModal] = useState(null);

    // Menu lateral (subabas, 10/11/2026). Os "lugares" da Avaliação: painel dos avaliadores, Dashboard da Unidade,
    // Dashboard Global e Lixeira (os mesmos botões da tela inicial). No meio de uma avaliação, pergunta antes de sair.
    const irParaSubaba = (destino) => {
        if (abaAtivaRef.current === 'nova' && !window.confirm(tx('Sair da avaliação sem salvar?'))) return;
        setAvaliacaoEditando(null);
        if (destino === 'lixeira') { setProfessorAtivo(null); setAbaAtiva('lixeira'); return; }
        setAbaAtiva('relatorio');
        if (destino === 'unidade') setProfessorAtivo({ id: 'GERAL', nome: `DASHBOARD - ${usuarioLogado?.unidade}`, unidade: usuarioLogado?.unidade });
        else if (destino === 'global') setProfessorAtivo({ id: 'GLOBAL', nome: 'VISÃO GLOBAL DA REDE' });
        else setProfessorAtivo(null);
    };
    const abaAtivaRef = useRef(abaAtiva);
    useEffect(() => { abaAtivaRef.current = abaAtiva; }, [abaAtiva]);
    const irParaSubabaRef = useRef(irParaSubaba);
    useEffect(() => { irParaSubabaRef.current = irParaSubaba; });
    useEffect(() => {
        const pedida = consumirSubaba('avaliacao');
        if (pedida) irParaSubabaRef.current(pedida);
        const aoPedir = (e) => { if (e.detail?.tela !== 'avaliacao') return; const aba = consumirSubaba('avaliacao'); if (aba) irParaSubabaRef.current(aba); };
        window.addEventListener(EVENTO_PEDIR_SUBABA, aoPedir);
        return () => window.removeEventListener(EVENTO_PEDIR_SUBABA, aoPedir);
    }, []);
    const subabaMostrada = abaAtiva === 'lixeira' ? 'lixeira'
        : abaAtiva !== 'relatorio' ? null
            : professorAtivo?.id === 'GERAL' ? 'unidade'
                : professorAtivo?.id === 'GLOBAL' ? 'global'
                    : professorAtivo ? null : 'avaliadores';
    useEffect(() => { avisarSubabaAtual('avaliacao', subabaMostrada); }, [subabaMostrada]);
    // Número de perguntas ativas na faixa do Configurar Formulário (mesma lista lida uma vez para a Avaliação)
    const { perguntas: perguntasAvaliacao, carregando: carregandoPerguntas } = usePerguntasAvaliacao();
    const perguntasAtivas = perguntasAvaliacao.filter(p => p.ativo === true).length;

    // ⚡ Caminho rápido: aluno vindo da ficha (botão "Avaliação")
    const [alunoParaAvaliar, setAlunoParaAvaliar] = useState(null);
    const [unidadeAvaliacao, setUnidadeAvaliacao] = useState('');

    useEffect(() => {
        if (!alunoPreSelecionado) return;
        const unidadeUsuario = usuarioLogado?.unidade && usuarioLogado.unidade !== 'TODAS' ? usuarioLogado.unidade : '';
        const unidade = unidadeUsuario || alunoPreSelecionado.unidade || '';
        setAlunoParaAvaliar(alunoPreSelecionado);
        setUnidadeAvaliacao(unidade);
        setAvaliacaoEditando(null);
        setProfessorAtivo({ id: 'FICHA', nome: 'NOVA AVALIAÇÃO', unidade, avaliadorAberto: true });
        setAbaAtiva('nova');
        if (limparPreSelecao) limparPreSelecao();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [alunoPreSelecionado]);

    const handleVoltar = () => {
        setAvaliacaoEditando(null);
        setAbaAtiva('relatorio');
        // Se veio da ficha, ao salvar ou cancelar volta para a ficha do aluno
        if (alunoParaAvaliar) {
            const aluno = alunoParaAvaliar;
            setAlunoParaAvaliar(null);
            setUnidadeAvaliacao('');
            setProfessorAtivo(null);
            if (onVoltarParaAluno) onVoltarParaAluno(aluno);
        }
    };

    // 🔥 FILTRO BLINDADO CORRIGIDO: Lê a coluna "role" (onde o setor é salvo) e ajusta o status
    const colaboradoresValidos = useMemo(() => {
        return (colaboradores || []).filter(c => {
            // 1. Status: Se vier vazio do banco, assumimos 'ATIVO'. Só excluímos se for explicitamente inativo/desligado.
            const statusStr = String(c.status || c.situacao || c.situacao_cadastral || 'ATIVO').toUpperCase();
            const isInativo = statusStr.includes('INATIVO') || statusStr.includes('DESLIGADO') || statusStr === 'FALSE';
            // Desligado no Cadastro Geral (ativo = false) também sai da lista (correção de 04/11/2026)
            if (c.ativo === false) return false;
            
            // 2. Setor/Cargo: No ModalColaborador, o setor é salvo na coluna 'role'
            const cargoStr = String(c.role || c.setor || c.cargo || '').toUpperCase();
            const isSaverOuLider = cargoStr.includes('SAVER') || cargoStr.includes('LIDER') || cargoStr.includes('LÍDER');
            
            // Retorna apenas se NÃO for inativo E for Saver ou Líder
            return !isInativo && isSaverOuLider;
        });
    }, [colaboradores]);

    // Lixeira das avaliações excluídas (botão "Lixeira" da tela inicial)
    if (abaAtiva === 'lixeira') {
        return (
            <div className="min-h-screen relative pb-12 font-sans animate-[fadeIn_0.3s_ease-out]">
                <FundoGlobalComFotos />
                <LixeiraAvaliacoes usuarioLogado={usuarioLogado} onVoltar={() => setAbaAtiva('relatorio')} />
            </div>
        );
    }

    if (abaAtiva === 'construtor') {
        return (
            <div className="min-h-screen relative pb-12 font-sans animate-[fadeIn_0.3s_ease-out]">
                <FundoGlobalComFotos />
                <div className="space-y-4 max-w-[1400px] mx-auto relative pb-10 z-10">
                    {/* Faixa de destaque da Avaliação (peça única, 09/11/2026) */}
                    <FaixaAvaliacao
                        antes={<BotaoFaixa onClick={() => setAbaAtiva('relatorio')}><ArrowLeft className="w-3.5 h-3.5" />{tx("Voltar ao Painel")}</BotaoFaixa>}
                        icone={<ListChecks className="w-6 h-6 text-orange-300" />}
                        titulo={tx("Construtor de Anamnese")}
                        subtitulo={tx("Perguntas do questionário da avaliação")}
                        numeros={[{ rotulo: tx("Perguntas ativas"), valor: carregandoPerguntas ? '…' : perguntasAtivas }]}
                    />
                    <TabPerguntasAvaliacao usuarioLogado={usuarioLogado} />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen relative pb-12 font-sans animate-[fadeIn_0.3s_ease-out]">
            <FundoGlobalComFotos />
            
            {alunoEvolucaoModal && (
                <ModalEvolucaoAluno aluno={alunoEvolucaoModal} onClose={() => setAlunoEvolucaoModal(null)} />
            )}

            {!professorAtivo ? (
                <PainelInicial 
                    usuarioLogado={usuarioLogado} 
                    colaboradores={colaboradoresValidos} 
                    setProfessorAtivo={setProfessorAtivo} 
                    setAbaAtiva={setAbaAtiva} 
                />
            ) : (
                <PainelAvaliador 
                    usuarioLogado={usuarioLogado}
                    professorAtivo={professorAtivo}
                    setProfessorAtivo={setProfessorAtivo}
                    abaAtiva={abaAtiva}
                    setAbaAtiva={setAbaAtiva}
                    avaliacaoEditando={avaliacaoEditando}
                    setAvaliacaoEditando={setAvaliacaoEditando}
                    handleVoltar={handleVoltar}
                    setAlunoEvolucaoModal={setAlunoEvolucaoModal}
                    avaliacoes={avaliacoes}
                    colaboradores={colaboradoresValidos} 
                    alunoParaAvaliar={alunoParaAvaliar}
                    unidadeAvaliacao={unidadeAvaliacao}
                />
            )}
        </div>
    );
};

export default AvaliacaoFisica;