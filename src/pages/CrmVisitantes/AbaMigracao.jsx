import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Repeat, Search, X, MessageCircle, Check, Ban, Loader2, AlertTriangle, ChevronDown, ArrowRightCircle, Undo2, PhoneCall, PhoneOff, Copy, PencilLine } from 'lucide-react';
import { decomporPlano } from '../AnaliseVendas/utils.js';
import { MENSAGENS_PADRAO, abrirNoWhatsApp, contatoCombinaComBusca, dataLocalISO, diaISO, mesmoNome, normalizarNome, marcaFeitoPor } from './utils';
import { montarMensagem } from './embaralhador.js';
import {
    carregarUltimoPlanoAlunos, carregarAndamentoMigracao, salvarAndamentoMigracao, puxarParaFilaMigracao,
    devolverDaFilaMigracao, carregarMensagensProntas, registrarContatoFeito, carregarMigracaoContatadosHoje, estaNaoContatar, ligarPeloSip
} from './contatosFeitos';
import { JanelaNaoContatar } from './JanelasContato';
import FichaAlunoPopup from './FichaAlunoPopup';
import JanelaResultadoContato from './JanelaResultadoContato';
import BotoesResultadoLinha from './BotoesResultadoLinha';
import {
    ANDAMENTOS_BASE, VISOES_FILA as VISOES, QUANTIDADES_PUXAR, DIAS_PARA_DEVOLVER, DIAS_GELADEIRA, MAX_TENTATIVAS,
    semTelefoneValido, calcularEtapa, camposDoResultado, detalheEtapa, ordenarFila, registrarResultadoContato
} from './resultadoContato.js';
import { avisar } from '../../components/avisar.js';
import { tx } from '../../i18n/traduzir.js';

// ==========================================
// ABA MIGRAÇÃO
// Alunos da unidade cujo ÚLTIMO PLANO comprado no sistema NÃO tem nutricionista.
// Regra do NUTRI: decomporPlano(nome).nutri (função única de AnaliseVendas/utils.js; Nutri é adicional, decisão do dono 30/10/2026).
// REAVALIAÇÃO e FÉRIAS não contam como "último plano" (a consulta do banco já ignora).
//
// FILA DE TRABALHO (igual à Base): a recepcionista PUXA alunos (plano + quantidade, os que compraram mais
// recentemente primeiro) para a "Minha fila". Quem está na fila de alguém sai dos "Disponíveis".
// Volta sozinho para os Disponíveis (calculado na hora, sem rotina no banco):
//   - puxado e NÃO contatado há 7 dias ou mais;
//   - puxado e NÃO contatado por recepcionista desligada (ativo = false no Cadastro Geral);
//   - "Devolver" (sem dono).
// Andamento: Não contatado → Contatado → Interessado → Migrou (Migrou é automático: venda de plano com
// NUTRI depois que o aluno entrou no andamento).
// Um contato de Migração por aluno por dia: repetir o WhatsApp abre a conversa, mas não soma de novo.
// 06/11/2026 (decisão do dono): botões WhatsApp · Ligar (MicroSIP, canal LIGACAO) · Interessado. Saiu o
// "Registrar contato" (feito sem WhatsApp). Marcar Interessado leva o aluno para o funil do CRM em "Em Contato"
// (Kanban/Conversa/Lista da recepcionista), pela função onInteressado do index.jsx.
// Aba "Sem telefone" (decisão do dono, 06/11/2026): aluno sem telefone válido (vazio, curto ou de preenchimento,
// ex.: 31999999999 — telefoneFalso do Cadastro) sai de Minha fila/Disponíveis/Todos e o "Puxar" não pega.
// Ali só dá para "Atualizar telefone" (abre a ficha com Editar); ao fechar a ficha a lista recarrega e,
// com telefone bom, o aluno volta para os Disponíveis. "Copiar lista" copia nome, CPF e último plano.
// RESULTADO DO CONTATO (decisão do dono, 06/11/2026): depois do WhatsApp/Ligar abre "Como foi o contato?":
//   Respondeu, vai pensar → volta para ela em 3 dias · Não respondeu/atendeu → volta em 2 dias (tentativa X de 3;
//   na 3ª vai para a GELADEIRA da Migração como "Sem resposta") · Interessado → funil (como antes) ·
//   Não quer → GELADEIRA da Migração por 30 dias (NÃO vai para o "Não contatar").
// Da geladeira, depois de 30 dias, volta para a fila dela em "Para hoje" (tentativas zeradas).
// Contatado sem data marcada (os antigos, de antes desta mudança) volta 2 dias depois do último contato.
// Topo: Para hoje · Aguardando · Interessados · Migraram no mês · Desistiram (clicar filtra).
// Campos no banco: crm_migracao.volta_em / tentativas / resultado (sql/2026-11-06-crm-migracao-resultado).
// 09/11/2026 (decisão do dono): botões Não respondeu · Vai pensar · Interessado direto na linha (+ "Mais" = janela,
// onde fica o "Não quer"); a janela que abre depois do WhatsApp/Ligar é obrigatória (sem "Decidir depois");
// "Pegar para mim" na linha dos Disponíveis/Todos; puxado e não contatado volta em 3 dias (DIAS_PARA_DEVOLVER).
// ==========================================

// Etapa mostrada na linha (regras em resultadoContato.js, as mesmas do Resgate)
const ANDAMENTOS = {
    ...ANDAMENTOS_BASE,
    MIGROU: { rotulo: 'Migrou', classe: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30' }
};
const FILTROS_ANDAMENTO = [
    { val: 'HOJE', label: 'Para hoje' },
    { val: 'AGUARDANDO', label: 'Aguardando' },
    { val: 'INTERESSADO', label: 'Interessados' },
    { val: 'GELADEIRA', label: 'Geladeira (desistiram)' },
    { val: 'MIGROU', label: 'Migrou' },
    { val: 'TODOS', label: 'Todos' }
];
// Contadores do topo (clicar filtra a lista)
const CONTADORES = [
    { chave: 'HOJE', filtro: 'HOJE', rotulo: 'Para hoje', classe: ANDAMENTOS.PARA_HOJE.classe },
    { chave: 'AGUARDANDO', filtro: 'AGUARDANDO', rotulo: 'Aguardando', classe: ANDAMENTOS.AGUARDANDO.classe },
    { chave: 'INTERESSADO', filtro: 'INTERESSADO', rotulo: 'Interessados', classe: ANDAMENTOS.INTERESSADO.classe },
    { chave: 'MIGROU_MES', filtro: 'MIGROU', rotulo: 'Migraram no mês', classe: ANDAMENTOS.MIGROU.classe },
    { chave: 'DESISTIRAM', filtro: 'GELADEIRA', rotulo: 'Desistiram', classe: ANDAMENTOS.GELADEIRA.classe }
];
const POR_PAGINA = 50;

const AbaMigracao = ({ unidade, operador, usuarioLogado, colaboradores = [], naoContatar = new Set(), onNaoContatar, onContatoFeito, onInteressado }) => {
    const [alunos, setAlunos] = useState(null);
    const [andamento, setAndamento] = useState(new Map());
    const [mensagem, setMensagem] = useState(MENSAGENS_PADRAO.MIGRACAO);
    const [carregando, setCarregando] = useState(true);
    const [indisponivel, setIndisponivel] = useState(false);
    const [visao, setVisao] = useState('FILA');
    const [filtroAndamento, setFiltroAndamento] = useState('HOJE');
    const [filtroPlano, setFiltroPlano] = useState('');
    const [busca, setBusca] = useState('');
    const [limite, setLimite] = useState(POR_PAGINA);
    const [planoPuxar, setPlanoPuxar] = useState('');
    const [qtdPuxar, setQtdPuxar] = useState(10);
    const [puxando, setPuxando] = useState(false);
    const [salvando, setSalvando] = useState('');
    const [contatoFicha, setContatoFicha] = useState(null);
    const [bloqueando, setBloqueando] = useState(null);
    const [contatadosHoje, setContatadosHoje] = useState(new Set());
    const [resultadoPara, setResultadoPara] = useState(null); // aluno da janela "Como foi o contato?"
    const [semCamposNovos, setSemCamposNovos] = useState(false);

    const unidadeChave = String(unidade || '').toUpperCase().trim();

    // Nomes de quem foi desligado (ativo = false): a fila não contatada dessas pessoas volta para os Disponíveis
    const desligadas = useMemo(() => new Set(colaboradores.filter(c => c.ativo === false).map(c => normalizarNome(c.nome))), [colaboradores]);

    const carregar = useCallback(async () => {
        if (!unidadeChave) return;
        setCarregando(true);
        const [lista, mapa, msgs, hoje] = await Promise.all([carregarUltimoPlanoAlunos(unidadeChave), carregarAndamentoMigracao(), carregarMensagensProntas(), carregarMigracaoContatadosHoje()]);
        setContatadosHoje(hoje);
        setIndisponivel(lista === null || mapa === null);
        setAlunos(lista || []);
        setAndamento(mapa || new Map());
        const algum = mapa && mapa.size ? mapa.values().next().value : null;
        setSemCamposNovos(!!algum && !('volta_em' in algum));
        setMensagem(msgs.MIGRACAO);
        setCarregando(false);
    }, [unidadeChave]);

    useEffect(() => { carregar(); }, [carregar]);
    useEffect(() => { setLimite(POR_PAGINA); }, [visao, filtroAndamento, filtroPlano, busca]);

    const hoje = diaISO(0);
    const inicioMes = `${hoje.slice(0, 8)}01`;

    // Monta cada aluno com: situação (andamento), dono da fila e se está disponível para puxar
    const linhas = useMemo(() => {
        const limiteFila = new Date();
        limiteFila.setDate(limiteFila.getDate() - DIAS_PARA_DEVOLVER);
        return (alunos || [])
            .filter(a => !estaNaoContatar(naoContatar, { cpf: a.cpf, alunoId: a.aluno_id }))
            .map(a => {
                const registro = andamento.get(a.aluno_id);
                let situacao;
                if (decomporPlano(a.ultimo_plano).nutri) {
                    // Só aparece como "Migrou" quem entrou no andamento e depois comprou plano com NUTRI
                    if (!registro || !a.data_compra || String(a.data_compra) < dataLocalISO(registro.criado_em || registro.atualizado_em)) return null;
                    situacao = 'MIGROU';
                } else {
                    situacao = !registro || registro.status === 'NA_FILA' ? 'NAO_CONTATADO' : registro.status;
                }
                // Puxado e ainda não contatado: devolve se passou de DIAS_PARA_DEVOLVER dias, se a dona foi desligada ou se não tem dono
                const naFilaSemContato = registro?.status === 'NA_FILA';
                const filaVencida = naFilaSemContato && (
                    !registro.puxado_por
                    || (registro.puxado_em && new Date(registro.puxado_em) < limiteFila)
                    || desligadas.has(normalizarNome(registro.puxado_por))
                );
                const dono = filaVencida ? '' : (registro?.puxado_por || registro?.atualizado_por || '');
                const disponivel = situacao !== 'MIGROU' && (!registro || filaVencida);
                const semTel = semTelefoneValido(a.telefone);
                // Etapa e dia de volta: contatado volta na data marcada (sem data: 2 dias depois do último contato);
                // geladeira (Não quer / Sem resposta) volta em 30 dias
                const { etapa, voltaEm, paraHoje } = calcularEtapa(situacao, registro, hoje);
                return { ...a, situacao, etapa, voltaEm, paraHoje, registro, dono, semTel, disponivel: disponivel && !semTel, minhaFila: !semTel && !disponivel && mesmoNome(dono, operador) };
            })
            .filter(Boolean);
    }, [alunos, andamento, naoContatar, desligadas, operador, hoje]);

    const daVisao = useMemo(() => linhas.filter(l => (
        visao === 'SEM_TELEFONE' ? l.semTel && l.situacao !== 'MIGROU'
            : visao === 'FILA' ? l.minhaFila : visao === 'DISPONIVEIS' ? l.disponivel : !l.semTel
    )), [linhas, visao]);
    const totalSemTelefone = useMemo(() => linhas.filter(l => l.semTel && l.situacao !== 'MIGROU').length, [linhas]);

    const planosDisponiveis = useMemo(() => [...new Set(linhas.filter(l => l.disponivel).map(l => l.ultimo_plano))].sort(), [linhas]);
    const planosDaVisao = useMemo(() => [...new Set(daVisao.map(l => l.ultimo_plano))].sort(), [daVisao]);
    const totalDisponiveis = useMemo(() => linhas.filter(l => l.disponivel && (!planoPuxar || l.ultimo_plano === planoPuxar)).length, [linhas, planoPuxar]);

    // "Para hoje" = não contatados + os que voltam hoje ou estão atrasados. Ordem: atrasados primeiro,
    // depois os que voltam hoje, depois os não contatados (compra mais recente primeiro); nos outros, pela data de volta.
    const filtradas = useMemo(() => daVisao.filter(l => {
        if (filtroAndamento === 'HOJE' && !l.paraHoje) return false;
        if (!['HOJE', 'TODOS'].includes(filtroAndamento) && l.etapa !== filtroAndamento) return false;
        if (filtroPlano && l.ultimo_plano !== filtroPlano) return false;
        return contatoCombinaComBusca(l, busca);
    }).sort((a, b) => ordenarFila(a, b) || String(b.data_compra || '').localeCompare(String(a.data_compra || ''))), [daVisao, filtroAndamento, filtroPlano, busca]);

    // Copia a lista dos sem telefone (nome, CPF, último plano) para procurar os números no TECACE
    const copiarSemTelefone = async () => {
        const texto = filtradas.map(l => [l.nome, l.cpf || '', l.ultimo_plano || ''].join('\t')).join('\n');
        try {
            await navigator.clipboard.writeText(`${tx("Nome")}\t${tx("CPF")}\t${tx("Último plano")}\n${texto}`);
            avisar(tx("Lista copiada ({qtd} alunos).", { qtd: filtradas.length }), 'sucesso');
        } catch {
            avisar(tx("Não foi possível copiar a lista."), 'erro');
        }
    };

    const contagem = useMemo(() => {
        const c = { HOJE: 0, AGUARDANDO: 0, INTERESSADO: 0, MIGROU_MES: 0, DESISTIRAM: 0 };
        daVisao.forEach(l => {
            if (l.paraHoje) c.HOJE++;
            else if (l.etapa === 'AGUARDANDO') c.AGUARDANDO++;
            else if (l.etapa === 'INTERESSADO') c.INTERESSADO++;
            else if (l.etapa === 'GELADEIRA') c.DESISTIRAM++;
            if (l.situacao === 'MIGROU' && String(l.data_compra || '') >= inicioMes) c.MIGROU_MES++;
        });
        return c;
    }, [daVisao, inicioMes]);

    const atualizarLocal = (alunoId, campos) => setAndamento(prev => {
        const novo = new Map(prev);
        novo.set(alunoId, { ...(prev.get(alunoId) || { criado_em: new Date().toISOString() }), aluno_id: alunoId, ...campos });
        return novo;
    });

    // Puxa os N mais recentes (pela data da compra) do plano escolhido para a minha fila.
    // "Pegar para mim" (09/11/2026): passa um aluno só (escolhido na linha dos Disponíveis/Todos).
    const puxar = async (umAluno) => {
        const candidatos = umAluno ? [umAluno] : linhas
            .filter(l => l.disponivel && (!planoPuxar || l.ultimo_plano === planoPuxar))
            .sort((a, b) => String(b.data_compra || '').localeCompare(String(a.data_compra || '')))
            .slice(0, qtdPuxar);
        if (candidatos.length === 0) return avisar(tx("Não há alunos disponíveis para puxar com esse filtro."));
        setPuxando(true);
        try {
            const confirmados = await puxarParaFilaMigracao({ alunoIds: candidatos.map(c => c.aluno_id), unidade: unidadeChave, operador });
            // Recarrega o andamento do banco: a tela mostra exatamente quem ficou com cada aluno
            const mapa = await carregarAndamentoMigracao();
            if (mapa) setAndamento(mapa);
            if (umAluno) {
                if (confirmados.length) avisar(tx("{nome} foi para a sua fila.", { nome: umAluno.nome }), 'sucesso');
                else avisar(tx("Este aluno já foi pego por outra pessoa. A lista foi atualizada."));
                return;
            }
            setVisao('FILA');
            setFiltroAndamento('HOJE');
            const perdidos = candidatos.length - confirmados.length;
            if (confirmados.length === 0) avisar(tx("Nenhum aluno foi puxado: todos já tinham sido puxados por outra pessoa. A lista foi atualizada."));
            else if (perdidos > 0) avisar(tx("{length} aluno(s) puxado(s). {perdidos} já tinha(m) sido puxado(s) por outra pessoa.", { length: confirmados.length, perdidos: perdidos }));
        } catch (err) {
            console.error('Erro ao puxar alunos da migração:', err);
            avisar(tx("Não foi possível puxar.\n\n{v1}", { v1: err?.message || '' }));
        } finally {
            setPuxando(false);
        }
    };

    // Registra o contato de Migração (relatório) e passa o andamento para "Contatado" (sem rebaixar quem já é Interessado)
    const registrarContato = async (linha, { canal, justificativa = null }) => {
        // Já contatado hoje: não grava de novo (não infla meta, planilha nem relatório)
        if (contatadosHoje.has(linha.aluno_id)) return;
        setSalvando(linha.aluno_id);
        try {
            const gravou = await registrarContatoFeito({
                unidade: unidadeChave, consultor: operador, tipo: 'MIGRACAO',
                aluno_id: linha.aluno_id, nome: linha.nome, referencia: diaISO(0), canal, justificativa,
                observacao: marcaFeitoPor(usuarioLogado, operador) || null
            });
            setContatadosHoje(prev => new Set(prev).add(linha.aluno_id));
            if (gravou && onContatoFeito) onContatoFeito(`Contato de migração ${canal === 'WHATSAPP' ? 'via WhatsApp' : canal === 'LIGACAO' ? 'por ligação' : 'sem WhatsApp'}`, `aluno:${linha.aluno_id}`);
            if (linha.situacao === 'NAO_CONTATADO') {
                const dono = linha.dono || operador;
                const puxadoEm = linha.registro?.puxado_em && !linha.disponivel ? linha.registro.puxado_em : new Date().toISOString();
                await salvarAndamentoMigracao({ aluno_id: linha.aluno_id, unidade: unidadeChave, status: 'CONTATADO', quem: operador, puxado_por: dono, puxado_em: puxadoEm });
                atualizarLocal(linha.aluno_id, { status: 'CONTATADO', puxado_por: dono, puxado_em: puxadoEm });
            }
        } catch (err) {
            console.error('Erro ao registrar contato de migração:', err);
            avisar(tx("Não foi possível registrar o contato.\n\n{v1}", { v1: err?.message || '' }));
        } finally {
            setSalvando('');
        }
    };

    const abrirWhatsApp = async (linha) => {
        if (!linha.telefone) return avisar(tx("Este aluno está sem telefone cadastrado."));
        // Cada clique monta uma versão nova da mensagem de migração (embaralhador)
        abrirNoWhatsApp(linha.telefone, montarMensagem('MIGRACAO', { nome: linha.nome, unidade: unidadeChave }, { MIGRACAO: mensagem }));
        await registrarContato(linha, { canal: 'WHATSAPP' });
        setResultadoPara({ ...linha, _obrigatorio: true });
    };

    // Ligar pelo MicroSIP: registra o contato de migração (canal LIGACAO, não fica vermelho)
    const ligar = async (linha) => {
        if (!linha.telefone) return avisar(tx("Este aluno está sem telefone cadastrado."));
        ligarPeloSip(linha.telefone);
        await registrarContato(linha, { canal: 'LIGACAO' });
        setResultadoPara({ ...linha, _obrigatorio: true });
    };

    // Resultado do contato (1 clique). "Não respondeu" marcado de novo no mesmo dia não soma outra tentativa.
    const aplicarResultado = async (linha, tipo) => {
        setResultadoPara(null);
        const reg = linha.registro || {};
        const { status, extras } = camposDoResultado(tipo, reg, hoje);
        const dono = reg.puxado_por ? undefined : (linha.dono || operador);
        setSalvando(linha.aluno_id);
        try {
            const r = await salvarAndamentoMigracao({ aluno_id: linha.aluno_id, unidade: unidadeChave, status, quem: operador, puxado_por: dono, extras });
            if (r?.semCamposNovos) setSemCamposNovos(true);
            registrarResultadoContato({ unidade: unidadeChave, consultor: operador, origem: 'MIGRACAO', aluno_id: linha.aluno_id, resultado: tipo });
            atualizarLocal(linha.aluno_id, { status, ...(r?.semCamposNovos ? {} : extras), atualizado_em: new Date().toISOString(), ...(dono ? { puxado_por: dono } : {}) });
            if (status === 'SEM_RESPOSTA') avisar(tx("{nome}: {qtd} tentativas sem resposta. Foi para a geladeira e volta em {dias} dias.", { nome: linha.nome, qtd: MAX_TENTATIVAS, dias: DIAS_GELADEIRA }));
            if (tipo === 'INTERESSADO' && onInteressado) await onInteressado(linha);
        } catch (err) {
            avisar(err?.code === '23514'
                ? tx("O banco ainda não aceita \"Não quer\" / \"Sem resposta\". Peça para rodar o SQL 2026-11-06-crm-migracao-resultado no Supabase.")
                : tx("Não foi possível salvar.\n\n{v1}", { v1: err?.message || '' }), 'erro');
        } finally {
            setSalvando('');
        }
    };

    const mudarInteresse = async (linha) => {
        const novo = linha.situacao === 'INTERESSADO' ? 'CONTATADO' : 'INTERESSADO';
        setSalvando(linha.aluno_id);
        try {
            await salvarAndamentoMigracao({ aluno_id: linha.aluno_id, unidade: unidadeChave, status: novo, quem: operador });
            atualizarLocal(linha.aluno_id, { status: novo });
            // Interessado: vai para o funil do CRM em "Em Contato" para continuar a conversa
            if (novo === 'INTERESSADO' && onInteressado) await onInteressado(linha);
        } catch (err) {
            avisar(tx("Não foi possível salvar.\n\n{v1}", { v1: err?.message || '' }));
        } finally {
            setSalvando('');
        }
    };

    const devolver = async (linha) => {
        setSalvando(linha.aluno_id);
        try {
            await devolverDaFilaMigracao({ aluno_id: linha.aluno_id, unidade: unidadeChave, quem: operador });
            atualizarLocal(linha.aluno_id, { status: 'NA_FILA', puxado_por: null, puxado_em: null });
        } catch (err) {
            avisar(tx("Não foi possível devolver.\n\n{v1}", { v1: err?.message || '' }));
        } finally {
            setSalvando('');
        }
    };

    const th = 'px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap';
    const seletor = 'bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 outline-none cursor-pointer';

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm p-6 animate-[fadeIn_0.3s_ease-out]">
            <div className="flex flex-wrap justify-between items-start gap-4 mb-5 border-b border-slate-100 dark:border-slate-800 pb-5">
                <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                        <Repeat className="w-6 h-6 text-blue-500" />{' '}{tx("Migração para plano com nutricionista")}
                        {carregando && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                    </h3>
                    <p className="text-xs font-bold text-slate-400 mt-1">{tx("Alunos de")}{' '}{unidadeChave}{' '}{tx("cujo último plano comprado não tem NUTRI. Puxe alguns para a sua fila e trabalhe aos poucos.")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {CONTADORES.map(c => (
                        <button key={c.chave} type="button" onClick={() => setFiltroAndamento(c.filtro)} className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border hover:brightness-95 ${c.classe} ${filtroAndamento === c.filtro ? 'ring-2 ring-blue-500/40' : ''}`}>{contagem[c.chave]} {tx(c.rotulo)}</button>
                    ))}
                </div>
            </div>

            {indisponivel && (
                <div className="mb-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-xl px-4 py-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />{' '}{tx("A Migração precisa dos comandos da Etapa C no Supabase (tabela crm_migracao e consulta crm_migracao_alunos).")}
                </div>
            )}

            {semCamposNovos && (
                <div className="mb-4 px-4 py-2.5 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />{' '}{tx("Falta rodar o SQL 2026-11-06-crm-migracao-resultado no Supabase: sem ele o sistema não guarda as tentativas nem a data de volta.")}
                </div>
            )}

            {/* PUXAR PARA A MINHA FILA */}
            <div className="mb-5 bg-blue-50/60 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-2xl p-4 flex flex-wrap items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">{tx("Puxar para a minha fila:")}</span>
                <select value={planoPuxar} onChange={(e) => setPlanoPuxar(e.target.value)} className={seletor}>
                    <option value="">{tx("Todos os planos")}</option>
                    {planosDisponiveis.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={qtdPuxar} onChange={(e) => setQtdPuxar(Number(e.target.value))} className={seletor}>
                    {QUANTIDADES_PUXAR.map(q => <option key={q} value={q}>{q}{' '}{tx("alunos")}</option>)}
                </select>
                <button type="button" onClick={() => puxar()} disabled={puxando || totalDisponiveis === 0} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                    {puxando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightCircle className="w-4 h-4" />}{' '}{tx("Puxar")}
                </button>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{totalDisponiveis}{' '}{tx("disponível(is)")}{planoPuxar ? " " + tx("em {planoPuxar}", { planoPuxar: planoPuxar }) + "" : ''}{' '}{tx("· os que compraram mais recentemente vêm primeiro")}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    {VISOES.map(v => (
                        <button key={v.val} type="button" onClick={() => setVisao(v.val)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${visao === v.val ? 'bg-white dark:bg-slate-900 shadow-sm text-blue-700 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}>
                            {v.val === 'SEM_TELEFONE' && <PhoneOff className="w-3.5 h-3.5" />}
                            {tx(v.label)}
                            {v.val === 'SEM_TELEFONE' && totalSemTelefone > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center">{totalSemTelefone}</span>}
                        </button>
                    ))}
                </div>
                <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={tx("Buscar por nome, CPF ou telefone")} className="w-64 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/30" />
                    {busca && <button type="button" onClick={() => setBusca('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X className="w-3.5 h-3.5" /></button>}
                </div>
                <select value={filtroAndamento} onChange={(e) => setFiltroAndamento(e.target.value)} className={seletor}>
                    {FILTROS_ANDAMENTO.map(f => <option key={f.val} value={f.val}>{tx(f.label)}</option>)}
                </select>
                <select value={filtroPlano} onChange={(e) => setFiltroPlano(e.target.value)} className={seletor}>
                    <option value="">{tx("Todos os planos")}</option>
                    {planosDaVisao.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{filtradas.length}{' '}{tx("aluno(s)")}</span>
                {visao === 'SEM_TELEFONE' && filtradas.length > 0 && (
                    <button type="button" onClick={copiarSemTelefone} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5" title={tx("Copia nome, CPF e último plano para procurar os telefones no TECACE")}>
                        <Copy className="w-3.5 h-3.5" />{' '}{tx("Copiar lista")}
                    </button>
                )}
            </div>
            {visao === 'SEM_TELEFONE' && (
                <p className="mb-4 text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl px-4 py-2.5">
                    {tx("Alunos sem telefone válido: não dá para ligar nem mandar WhatsApp, e eles não entram no \"Puxar\". Atualize o telefone no cadastro: o aluno volta sozinho para os Disponíveis.")}
                </p>
            )}

            <div className="overflow-x-auto custom-scrollbar border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left border-collapse min-w-max">
                    <thead className="bg-slate-50 dark:bg-slate-800/60">
                        <tr>
                            <th className={th}>{tx("Aluno")}</th>
                            <th className={th}>{tx("Último plano")}</th>
                            <th className={th}>{tx("Compra")}</th>
                            <th className={th}>{tx("Telefone")}</th>
                            <th className={th}>{tx("Andamento")}</th>
                            {visao === 'TODOS' && <th className={th}>{tx("Na fila de")}</th>}
                            <th className={`${th} text-right`}>{tx("Ações")}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filtradas.length === 0 ? (
                            <tr><td colSpan={visao === 'TODOS' ? 7 : 6} className="text-center py-12 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {carregando ? tx("Carregando...") : visao === 'FILA' ? tx("Sua fila está vazia. Use \"Puxar\" para pegar alunos para trabalhar.") : tx("Nenhum aluno neste filtro.")}
                            </td></tr>
                        ) : filtradas.slice(0, limite).map(l => {
                            const a = ANDAMENTOS[l.etapa] || ANDAMENTOS.NAO_CONTATADO;
                            const ocupado = salvando === l.aluno_id;
                            // Só trabalha (WhatsApp, registrar, interessado) quem está na própria fila
                            const podeTrabalhar = l.minhaFila && l.situacao !== 'MIGROU' && l.etapa !== 'GELADEIRA';
                            const jaHoje = contatadosHoje.has(l.aluno_id);
                            return (
                                <tr key={l.aluno_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                    <td className="px-4 py-3">
                                        <button type="button" onClick={() => setContatoFicha(l)} className="text-xs font-black text-slate-800 dark:text-white uppercase text-left hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-2" title={tx("Abrir a ficha do aluno")}>{l.nome}</button>
                                        {l.semTel && (l.cpf || l.matricula) && (
                                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">{[l.cpf && `CPF ${l.cpf}`, l.matricula && `${tx("Matrícula")} ${l.matricula}`].filter(Boolean).join(' · ')}</p>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">{l.ultimo_plano}</td>
                                    <td className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">{l.data_compra ? String(l.data_compra).split('-').reverse().join('/') : '—'}</td>
                                    <td className={`px-4 py-3 text-xs font-bold whitespace-nowrap ${l.semTel ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'}`}>
                                        {l.semTel ? (l.telefone ? <span title={tx("Número de preenchimento ou incompleto")}>{l.telefone} ✗</span> : tx("sem telefone")) : (l.telefone || '—')}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${a.classe}`}>{tx(a.rotulo)}</span>
                                        {detalheEtapa(l) && <p className={`text-[10px] font-bold mt-1 ${l.paraHoje && l.voltaEm && l.voltaEm < hoje ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>{detalheEtapa(l)}</p>}
                                    </td>
                                    {visao === 'TODOS' && <td className="px-4 py-3 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">{l.disponivel ? tx("Disponível") : (l.dono ? String(l.dono).split(' ')[0] : '—')}</td>}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1.5">
                                            {l.semTel && (
                                                <button type="button" onClick={() => setContatoFicha(l)} className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1" title={tx("Abre a ficha do aluno: clique em Editar e coloque o telefone")}>
                                                    <PencilLine className="w-3.5 h-3.5" />{' '}{tx("Atualizar telefone")}
                                                </button>
                                            )}
                                            {podeTrabalhar && (
                                                <>
                                                    <button type="button" onClick={() => abrirWhatsApp(l)} disabled={ocupado} className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1" title={tx("Abre o WhatsApp com a mensagem de migração e já registra o contato")}>
                                                        {ocupado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}{' '}{tx("WhatsApp")}
                                                    </button>
                                                    <button type="button" onClick={() => ligar(l)} disabled={ocupado || !l.telefone} className="px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-600 hover:text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1 disabled:opacity-60" title={tx("Ligar (MicroSIP) e já registrar o contato")}>
                                                        <PhoneCall className="w-3.5 h-3.5" />{' '}{tx("Ligar")}
                                                    </button>
                                                    {jaHoje && (
                                                        <span className="px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase tracking-widest flex items-center gap-1" title={tx("O contato de hoje já foi registrado. Abrir o WhatsApp de novo não soma outra vez.")}>
                                                            <Check className="w-3.5 h-3.5" />{' '}{tx("Contatado hoje")}
                                                        </span>
                                                    )}
                                                    {/* Resultado direto na linha (09/11/2026): Não respondeu · Vai pensar · Interessado · Mais */}
                                                    {l.situacao !== 'NAO_CONTATADO' && (
                                                        <BotoesResultadoLinha
                                                            linha={l}
                                                            ocupado={ocupado}
                                                            onEscolher={(tipo) => aplicarResultado(l, tipo)}
                                                            onMais={() => setResultadoPara(l)}
                                                            onDesmarcarInteressado={() => mudarInteresse(l)}
                                                        />
                                                    )}
                                                    {l.situacao === 'NAO_CONTATADO' && (
                                                        <button type="button" onClick={() => devolver(l)} disabled={ocupado} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 disabled:opacity-60 dark:hover:text-blue-400" title={tx("Devolver para os Disponíveis")}>
                                                            <Undo2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                            {/* Pegar para mim (09/11/2026): aluno disponível vai direto para a minha fila */}
                                            {l.disponivel && visao !== 'FILA' && (
                                                <button type="button" onClick={() => puxar(l)} disabled={puxando} className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1" title={tx("Passa este aluno para a sua fila (Minha fila)")}>
                                                    <ArrowRightCircle className="w-3.5 h-3.5" />{' '}{tx("Pegar para mim")}
                                                </button>
                                            )}
                                            {l.situacao !== 'MIGROU' && (
                                                <button type="button" onClick={() => setBloqueando(l)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 dark:hover:text-rose-400" title={tx("Não contatar")}>
                                                    <Ban className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {filtradas.length > limite && (
                <button type="button" onClick={() => setLimite(n => n + POR_PAGINA)} className="w-full mt-3 py-3 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl flex items-center justify-center gap-1.5">
                    <ChevronDown className="w-4 h-4" />{' '}{tx("Ver mais (")}{filtradas.length - limite}{' '}{tx("restantes)")}
                </button>
            )}

            {resultadoPara && (
                <JanelaResultadoContato
                    aluno={resultadoPara}
                    hoje={hoje}
                    textoInteressado={tx('Vai para o seu funil (Em Espera, volta amanhã).')}
                    textoNaoQuer={tx('Vai para a geladeira da Migração e volta em {dias} dias. Não entra no "Não contatar".', { dias: DIAS_GELADEIRA })}
                    obrigatorio={!!resultadoPara._obrigatorio}
                    onEscolher={(tipo) => aplicarResultado(resultadoPara, tipo)}
                    onFechar={() => setResultadoPara(null)}
                />
            )}
            {contatoFicha && <FichaAlunoPopup contato={contatoFicha} usuarioLogado={usuarioLogado} onFechar={() => { const eraSemTel = contatoFicha.semTel; setContatoFicha(null); if (eraSemTel) carregar(); }} />}
            {bloqueando && (
                <JanelaNaoContatar
                    pessoa={bloqueando}
                    unidade={unidadeChave}
                    quem={operador}
                    onFechar={() => setBloqueando(null)}
                    onFeito={(p) => { if (onNaoContatar) onNaoContatar(p); }}
                />
            )}
        </div>
    );
};

export default AbaMigracao;
