import React, { useState, useEffect, useRef, useCallback } from 'react';
import FiltrosAlunos from './FiltrosAlunos.jsx';
import ListaAlunos from './ListaAlunos.jsx';
import { ModalConfirmarExclusaoAluno } from './ModaisAlunos.jsx';
import ModalAluno from '../../components/Modals/ModalAluno.jsx';
import { buscarAlunosPaginado } from './utils.js';
import { CheckCircle2 } from 'lucide-react';
import FichaAluno from './ficha/index.jsx';
import { supabase } from '../../supabaseClient.js';
import { addRecente } from '../../components/layout/recentesAlunos.js';

const getBRDateString = () => {
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const ModuloAlunos360 = ({
    usuarioLogado,
    usuarioReal,
    unidadeGlobal = 'TODAS',
    setUnidadeGlobal,
    unidades = [],
    planos = [],
    vendas = [],
    avaliacoes = [],
    visitantes = [],
    onIniciarVendaAluno,
    onIniciarAvaliacaoAluno,
    alunoParaAbrir,
    limparAlunoParaAbrir
}) => {
    const roleReal = String(usuarioReal?.role || usuarioLogado?.role || '').toUpperCase().trim();
    const temVisaoGlobal = roleReal === 'ADMIN' || roleReal === 'MENTOR';
    const ehAdmin = roleReal === 'ADMIN';

    const unidadeTravada = temVisaoGlobal
        ? (unidadeGlobal || 'TODAS')
        : String(usuarioLogado?.unidade || '').toUpperCase().trim();

    const hojeStr = getBRDateString();

    const [buscaInput, setBuscaInput] = useState('');
    const [buscaDebounced, setBuscaDebounced] = useState('');
    const [filtroPlano, setFiltroPlano] = useState('TODOS');
    const [filtroUnidade, setFiltroUnidade] = useState(unidadeTravada);
    
    const [filtroPeriodo, setFiltroPeriodo] = useState('Hoje');
    const [dataInicio, setDataInicio] = useState(hojeStr);
    const [dataFim, setDataFim] = useState(hojeStr);

    const [ultimaAtualizacao, setUltimaAtualizacao] = useState(new Date());

    const [ordemColuna, setOrdemColuna] = useState('nome');
    const [ordemDirecao, setOrdemDirecao] = useState('ASC');
    const [pagina, setPagina] = useState(1);
    const [itensPorPagina, setItensPorPagina] = useState(25);

    const [alunos, setAlunos] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState(null);

    const [alunoFichaAberta, setAlunoFichaAberta] = useState(null);

    const [modalAlunoOpen, setModalAlunoOpen] = useState(false);
    const [alunoEditando, setAlunoEditando] = useState(null);
    const [alunoExcluindo, setAlunoExcluindo] = useState(null);
    const [toastMsg, setToastMsg] = useState('');

    const abortControllerRef = useRef(null);

    const dispararToast = (msg) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(''), 2000);
    };
    
    const emailGlobalUsuario = usuarioReal?.email || usuarioLogado?.email || usuarioLogado?.id || 'local_user';

    useEffect(() => {
        if (alunoParaAbrir) {
            setAlunoFichaAberta(alunoParaAbrir);
            if (limparAlunoParaAbrir) limparAlunoParaAbrir();
        }
    }, [alunoParaAbrir, limparAlunoParaAbrir]);

    const handleSelecionarAluno = (aluno) => {
        setAlunoFichaAberta(aluno);
        addRecente(emailGlobalUsuario, aluno, 'Visitado recentemente');
    };
    
    // Interceptadores para gravar Recentes com acao especifica
    const handleIniciarVenda = (aluno) => {
        addRecente(emailGlobalUsuario, aluno, 'Venda recente');
        if (onIniciarVendaAluno) onIniciarVendaAluno(aluno);
    };

    const handleIniciarAvaliacao = (aluno) => {
        addRecente(emailGlobalUsuario, aluno, 'Avaliação recente');
        if (onIniciarAvaliacaoAluno) onIniciarAvaliacaoAluno(aluno);
    };

    useEffect(() => {
        if (temVisaoGlobal) {
            setFiltroUnidade(unidadeGlobal || 'TODAS');
        } else {
            setFiltroUnidade(String(usuarioLogado?.unidade || '').toUpperCase().trim());
        }
    }, [unidadeGlobal, temVisaoGlobal, usuarioLogado?.unidade]);

    const handleChangeUnidade = (novaUni) => {
        setFiltroUnidade(novaUni);
        if (temVisaoGlobal && typeof setUnidadeGlobal === 'function') {
            setUnidadeGlobal(novaUni);
        }
        setPagina(1);
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            setBuscaDebounced(buscaInput);
            setPagina(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [buscaInput]);

    const carregarListaServidor = useCallback(async (silencioso = false) => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        if (!silencioso) setLoading(true);
        setErro(null);

        try {
            const isSearching = buscaDebounced.trim().length > 0;

            const { alunos: rows, totalCount: count } = await buscarAlunosPaginado({
                busca: buscaDebounced,
                unidade: temVisaoGlobal ? filtroUnidade : unidadeTravada,
                plano: isSearching ? 'TODOS' : filtroPlano,
                dataInicio: isSearching ? '' : dataInicio,
                dataFim: isSearching ? '' : dataFim,
                ordemColuna,
                ordemDirecao,
                pagina,
                limite: itensPorPagina,
                roleUsuario: roleReal,
                unidadeUsuario: usuarioLogado?.unidade || '',
                signal: controller.signal
            });

            if (!controller.signal.aborted) {
                setAlunos(rows);
                setTotalCount(count);
                setUltimaAtualizacao(new Date());
            }
        } catch (err) {
            if (err?.name === 'AbortError' || controller.signal.aborted) return;
            setErro(err?.message || 'Erro ao consultar alunos no servidor.');
        } finally {
            if (!controller.signal.aborted && !silencioso) {
                setLoading(false);
            }
        }
    }, [
        buscaDebounced, filtroUnidade, unidadeTravada, filtroPlano, dataInicio,
        dataFim, ordemColuna, ordemDirecao, pagina, itensPorPagina,
        temVisaoGlobal, roleReal, usuarioLogado?.unidade
    ]);

    useEffect(() => {
        carregarListaServidor();
    }, [carregarListaServidor]);

    useEffect(() => {
        const handleFocus = () => carregarListaServidor(true);
        window.addEventListener('focus', handleFocus);

        const channel = supabase.channel('alunos_sincronizacao')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'alunos' }, () => {
                carregarListaServidor(true);
            })
            .subscribe();

        return () => {
            window.removeEventListener('focus', handleFocus);
            supabase.removeChannel(channel);
        };
    }, [carregarListaServidor]);

    const handleOrdenar = (coluna) => {
        if (ordemColuna === coluna) {
            setOrdemDirecao((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'));
        } else {
            setOrdemColuna(coluna);
            setOrdemDirecao('ASC');
        }
        setPagina(1);
    };

    const limparFiltros = () => {
        setBuscaInput('');
        setBuscaDebounced('');
        setFiltroPlano('TODOS');
        const hojeStrReset = getBRDateString();
        setFiltroPeriodo('Hoje');
        setDataInicio(hojeStrReset);
        setDataFim(hojeStrReset);
        if (temVisaoGlobal) handleChangeUnidade('TODAS');
        setOrdemColuna('nome');
        setOrdemDirecao('ASC');
        setPagina(1);
    };

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto animate-[fadeIn_0.25s_ease-out] pb-10">
            {toastMsg && (
                <div className="fixed bottom-6 right-6 z-[500] bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2.5 animate-[fadeIn_0.15s_ease-out]">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-black uppercase tracking-widest">{toastMsg}</span>
                </div>
            )}

            <ModalAluno
                isOpen={modalAlunoOpen}
                onClose={() => setModalAlunoOpen(false)}
                alunoInicial={alunoEditando}
                onSaveSuccess={(alunoSalvo) => {
                    dispararToast('Registo atualizado!');
                    carregarListaServidor();
                    if (alunoFichaAberta && alunoSalvo?.id === alunoFichaAberta.id) {
                        setAlunoFichaAberta((prev) => ({ ...prev, ...alunoSalvo }));
                    }
                }}
                usuarioLogado={usuarioLogado}
                unidadeDestino={temVisaoGlobal && filtroUnidade !== 'TODAS' ? filtroUnidade : usuarioLogado?.unidade}
            />

            <ModalConfirmarExclusaoAluno
                isOpen={Boolean(alunoExcluindo)}
                aluno={alunoExcluindo}
                onClose={() => setAlunoExcluindo(null)}
                usuarioLogado={usuarioReal || usuarioLogado}
                onExcluidoSucesso={() => {
                    dispararToast('Aluno excluído com sucesso!');
                    setAlunoFichaAberta(null);
                    carregarListaServidor();
                }}
            />

            {!alunoFichaAberta ? (
                <>
                    <FiltrosAlunos
                        buscaInput={buscaInput}
                        setBuscaInput={setBuscaInput}
                        filtroPlano={filtroPlano}
                        setFiltroPlano={(val) => { setFiltroPlano(val); setPagina(1); }}
                        filtroUnidade={filtroUnidade}
                        setFiltroUnidade={handleChangeUnidade}
                        filtroPeriodo={filtroPeriodo}
                        setFiltroPeriodo={setFiltroPeriodo}
                        dataInicio={dataInicio}
                        setDataInicio={(val) => { setDataInicio(val); setPagina(1); }}
                        dataFim={dataFim}
                        setDataFim={(val) => { setDataFim(val); setPagina(1); }}
                        limparFiltros={limparFiltros}
                        temVisaoGlobal={temVisaoGlobal}
                        unidades={unidades}
                        planos={planos}
                        totalFiltrados={totalCount}
                        loading={loading}
                        onNovoAluno={() => {
                            setAlunoEditando(null);
                            setModalAlunoOpen(true);
                        }}
                        ultimaAtualizacao={ultimaAtualizacao}
                    />

                    <ListaAlunos
                        alunos={alunos}
                        totalCount={totalCount}
                        loading={loading}
                        erro={erro}
                        onTentarNovamente={() => carregarListaServidor(false)}
                        onLimparFiltros={limparFiltros}
                        temVisaoGlobal={temVisaoGlobal}
                        ehAdmin={ehAdmin}
                        ordemColuna={ordemColuna}
                        ordemDirecao={ordemDirecao}
                        onOrdenar={handleOrdenar}
                        pagina={pagina}
                        setPagina={setPagina}
                        itensPorPagina={itensPorPagina}
                        setItensPorPagina={setItensPorPagina}
                        onSelecionarAluno={handleSelecionarAluno}
                        onEditarAluno={(aluno) => {
                            setAlunoEditando({ ...aluno, unidade_vinculo: aluno.unidade });
                            setModalAlunoOpen(true);
                        }}
                        onExcluirAluno={(aluno) => setAlunoExcluindo(aluno)}
                        onToastCopiado={() => dispararToast('Copiado!')}
                        onIniciarVendaAluno={handleIniciarVenda}
                        onIniciarAvaliacaoAluno={handleIniciarAvaliacao}
                    />
                </>
            ) : (
                <FichaAluno 
                    aluno={alunoFichaAberta}
                    onVoltar={() => setAlunoFichaAberta(null)}
                    onEditar={() => {
                        setAlunoEditando({ ...alunoFichaAberta, unidade_vinculo: alunoFichaAberta.unidade });
                        setModalAlunoOpen(true);
                    }}
                    onVender={handleIniciarVenda}
                    onAvaliar={handleIniciarAvaliacao}
                    usuarioLogado={usuarioReal || usuarioLogado}
                />
            )}
        </div>
    );
};

export default ModuloAlunos360;