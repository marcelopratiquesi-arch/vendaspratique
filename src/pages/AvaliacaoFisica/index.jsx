import React, { useState } from 'react';
import { ListChecks } from 'lucide-react';
import TabPerguntasAvaliacao from './TabPerguntasAvaliacao.jsx';
import ModalEvolucaoAluno from './ModalEvolucaoAluno.jsx';
import { FundoGlobalComFotos } from './FundoGlobal.jsx';
import PainelInicial from './PainelInicial.jsx';
import PainelAvaliador from './PainelAvaliador.jsx';

const AvaliacaoFisica = ({ usuarioLogado, avaliacoes = [], colaboradores = [] }) => {
    const [professorAtivo, setProfessorAtivo] = useState(null); 
    const [abaAtiva, setAbaAtiva] = useState('relatorio');
    const [avaliacaoEditando, setAvaliacaoEditando] = useState(null);
    const [alunoEvolucaoModal, setAlunoEvolucaoModal] = useState(null);

    const handleVoltar = () => { setAvaliacaoEditando(null); setAbaAtiva('relatorio'); };

    if (abaAtiva === 'construtor') {
        return (
            <div className="min-h-screen relative pb-12 font-sans animate-[fadeIn_0.3s_ease-out]">
                <FundoGlobalComFotos />
                <div className="space-y-6 max-w-[1400px] mx-auto relative pt-6 pb-10 z-10">
                    <div className="flex items-center justify-between bg-slate-900 dark:bg-slate-800/90 dark:backdrop-blur-xl dark:border dark:border-slate-700/50 rounded-[24px] p-6 shadow-md transition-colors">
                        <div>
                            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
                                <ListChecks className="w-6 h-6 text-blue-400" /> Construtor de Anamnese
                            </h2>
                        </div>
                        <button type="button" onClick={() => setAbaAtiva('relatorio')} className="bg-white/10 hover:bg-white/20 dark:bg-slate-700/50 dark:hover:bg-slate-600/60 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors border border-white/5 dark:border-white/10">
                            Voltar ao Painel
                        </button>
                    </div>
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
                    colaboradores={colaboradores} 
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
                />
            )}
        </div>
    );
};

export default AvaliacaoFisica;