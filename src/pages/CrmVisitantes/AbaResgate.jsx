import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { LifeBuoy, Search, X, MessageCircle, Check, Ban, Loader2, AlertTriangle, ChevronDown, ArrowRightCircle, Undo2, PhoneCall, PhoneOff, Copy, PencilLine } from 'lucide-react';
import { abrirNoWhatsApp, contatoCombinaComBusca, dataLocalISO, diaISO, somarDiasISO, mesmoNome, normalizarNome, marcaFeitoPor, apenasDigitos } from './utils';
import { montarMensagem } from './embaralhador.js';
import {
    carregarAndamentoResgate, salvarAndamentoResgate, puxarParaFilaResgate, devolverDaFilaResgate,
    carregarMensagensProntas, registrarContatoFeito, carregarMigracaoContatadosHoje, estaNaoContatar, ligarPeloSip
} from './contatosFeitos';
import { carregarAlunosDoCadastro, tipoDoStatus } from './regrasPuxarCadastro.js';
import { buscarComprasDePlano } from './compraDePlano.js';
import { JanelaNaoContatar } from './JanelasContato';
import FichaAlunoPopup from './FichaAlunoPopup';
import JanelaResultadoContato from './JanelaResultadoContato';
import BotoesResultadoLinha from './BotoesResultadoLinha';
import {
    ANDAMENTOS_BASE, VISOES_FILA, QUANTIDADES_PUXAR, DIAS_PARA_DEVOLVER, DIAS_GELADEIRA, MAX_TENTATIVAS,
    semTelefoneValido, calcularEtapa, camposDoResultado, detalheEtapa, ordenarFila, registrarResultadoContato, dataBR
} from './resultadoContato.js';
import { avisar } from '../../components/avisar.js';
import { tx } from '../../i18n/traduzir.js';

// ==========================================
// ABA RESGATE (decisão do dono, 07/11/2026)
// Alunos FINALIZADOS / INATIVOS da unidade (status do cadastro, vindo da importação do TECACE: alunos.status_aluno),
// numa aba separada para o Kanban e a Conversa não ficarem compridos. Funciona igual à Migração:
//   - a recepcionista PUXA 10/15/20/50 (cadastrados mais recentemente primeiro) para a "Minha fila";
//   - WhatsApp (mensagem "Cancelado / inativo" do embaralhador) · Ligar (MicroSIP) · Resultado;
//   - "Como foi o contato?" (resultadoContato.js): vai pensar 3 dias · não respondeu 2 dias, na 3ª tentativa geladeira ·
//     Interessado vai para o FUNIL da recepcionista em "Em Contato", igual à Migração (decisão do dono, 09/11/2026;
//     antes ficava aqui e voltava amanhã) · Não quer = geladeira 30 dias (não vai para o "Não contatar");
//   - 09/11/2026: botões Não respondeu · Vai pensar · Interessado na linha (+ "Mais" = janela); janela obrigatória
//     depois do WhatsApp/Ligar; "Pegar para mim" nos Disponíveis/Todos; puxado e não contatado volta em 3 dias;
//   - VOLTOU (automático): comprou plano depois de entrar no Resgate (consulta segura crm_compras_de_plano).
// Ficam de fora: Não contatar, quem comprou plano nos últimos 30 dias e quem já está em aberto no funil do CRM.
// Contato conta na meta (crm_contatos_feitos tipo RESGATE; sem o SQL grava com o tipo CANCELADO/INATIVO).
// Tabelas: crm_resgate, crm_puxar_resgate, crm_resultados_contato (sql/2026-11-07-crm-resgate).
// ==========================================

const ANDAMENTOS = {
    ...ANDAMENTOS_BASE,
    VOLTOU: { rotulo: 'Voltou', classe: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30' }
};
const FILTROS_ANDAMENTO = [
    { val: 'HOJE', label: 'Para hoje' },
    { val: 'AGUARDANDO', label: 'Aguardando' },
    { val: 'INTERESSADO', label: 'Interessados' },
    { val: 'GELADEIRA', label: 'Geladeira (desistiram)' },
    { val: 'VOLTOU', label: 'Voltaram' },
    { val: 'TODOS', label: 'Todos' }
];
const CONTADORES = [
    { chave: 'HOJE', filtro: 'HOJE', rotulo: 'Para hoje', classe: ANDAMENTOS.PARA_HOJE.classe },
    { chave: 'AGUARDANDO', filtro: 'AGUARDANDO', rotulo: 'Aguardando', classe: ANDAMENTOS.AGUARDANDO.classe },
    { chave: 'INTERESSADO', filtro: 'INTERESSADO', rotulo: 'Interessados', classe: ANDAMENTOS.INTERESSADO.classe },
    { chave: 'VOLTOU_MES', filtro: 'VOLTOU', rotulo: 'Voltaram no mês', classe: ANDAMENTOS.VOLTOU.classe },
    { chave: 'DESISTIRAM', filtro: 'GELADEIRA', rotulo: 'Desistiram', classe: ANDAMENTOS.GELADEIRA.classe }
];
const TIPOS_RESGATE = [
    { val: '', label: 'Finalizados e inativos' },
    { val: 'CANCELADO', label: 'Só finalizados' },
    { val: 'INATIVO', label: 'Só inativos' }
];
const ETIQUETA_TIPO = {
    CANCELADO: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30',
    INATIVO: 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/30'
};
const DIAS_SEM_COMPRA = 30;
const POR_PAGINA = 50;

const AbaResgate = ({ unidade, operador, usuarioLogado, colaboradores = [], naoContatar = new Set(), leads = [], onNaoContatar, onContatoFeito, onInteressado }) => {
    const [alunos, setAlunos] = useState(null);
    const [andamento, setAndamento] = useState(new Map());
    const [compras, setCompras] = useState(new Map()); // cpf -> compra de plano mais recente
    const [mensagens, setMensagens] = useState(null);
    const [carregando, setCarregando] = useState(true);
    const [faltaSql, setFaltaSql] = useState('');
    const [visao, setVisao] = useState('FILA');
    const [filtroAndamento, setFiltroAndamento] = useState('HOJE');
    const [filtroTipo, setFiltroTipo] = useState('');
    const [busca, setBusca] = useState('');
    const [limite, setLimite] = useState(POR_PAGINA);
    const [tipoPuxar, setTipoPuxar] = useState('');
    const [qtdPuxar, setQtdPuxar] = useState(10);
    const [puxando, setPuxando] = useState(false);
    const [salvando, setSalvando] = useState('');
    const [contatoFicha, setContatoFicha] = useState(null);
    const [bloqueando, setBloqueando] = useState(null);
    const [contatadosHoje, setContatadosHoje] = useState(new Set());
    const [resultadoPara, setResultadoPara] = useState(null);

    const unidadeChave = String(unidade || '').toUpperCase().trim();
    const hoje = diaISO(0);
    const inicioMes = `${hoje.slice(0, 8)}01`;
    const desligadas = useMemo(() => new Set(colaboradores.filter(c => c.ativo === false).map(c => normalizarNome(c.nome))), [colaboradores]);
    // CPFs com contato EM ABERTO no funil do CRM (Novo / Em Contato): não entram no Resgate para não chamar duas vezes
    const cpfsNoFunil = useMemo(() => new Set(leads.filter(l => ['Novo', 'Em Contato'].includes(l.status)).map(l => apenasDigitos(l.cpf)).filter(c => c.length === 11)), [leads]);

    const carregar = useCallback(async () => {
        if (!unidadeChave) return;
        setCarregando(true);
        const [cad, mapa, msgs, contatados] = await Promise.all([
            carregarAlunosDoCadastro(unidadeChave), carregarAndamentoResgate(), carregarMensagensProntas(), carregarMigracaoContatadosHoje('RESGATE')
        ]);
        setMensagens(msgs);
        setContatadosHoje(contatados);
        if (cad.erro) { setFaltaSql(cad.erro === 'SQL_CADASTRO' ? 'CADASTRO' : 'ERRO'); setAlunos([]); setCarregando(false); return; }
        setFaltaSql(mapa === null ? 'RESGATE' : '');
        const lista = (cad.alunos || []).filter(a => ['CANCELADO', 'INATIVO'].includes(tipoDoStatus(a.status_aluno)));
        const andamentoMapa = mapa || new Map();
        // Compras de plano: últimos 30 dias, ou desde que o aluno mais antigo entrou no Resgate
        let desde = somarDiasISO(hoje, -DIAS_SEM_COMPRA);
        andamentoMapa.forEach(r => { const d = dataLocalISO(r.criado_em); if (d && d < desde) desde = d; });
        const cpfs = lista.map(a => apenasDigitos(a.cpf)).filter(c => c.length === 11);
        const linhasCompra = await buscarComprasDePlano(cpfs, desde);
        const porCpf = new Map();
        (linhasCompra || []).forEach(c => {
            const cpf = apenasDigitos(c.cpf);
            const atual = porCpf.get(cpf);
            if (!atual || String(c.dia || '') > String(atual.dia || '')) porCpf.set(cpf, c);
        });
        setCompras(porCpf);
        setAlunos(lista);
        setAndamento(andamentoMapa);
        setCarregando(false);
    }, [unidadeChave, hoje]);

    useEffect(() => { carregar(); }, [carregar]);
    useEffect(() => { setLimite(POR_PAGINA); }, [visao, filtroAndamento, filtroTipo, busca]);

    const linhas = useMemo(() => {
        const limiteFila = new Date();
        limiteFila.setDate(limiteFila.getDate() - DIAS_PARA_DEVOLVER);
        const corteCompra = somarDiasISO(hoje, -DIAS_SEM_COMPRA);
        return (alunos || [])
            .map(a => {
                const cpf = apenasDigitos(a.cpf);
                const aluno_id = a.id;
                const registro = andamento.get(aluno_id);
                if (estaNaoContatar(naoContatar, { cpf, alunoId: aluno_id })) return null;
                const compra = compras.get(cpf);
                const entrouEm = registro ? dataLocalISO(registro.criado_em) : null;
                let situacao;
                if (compra && registro && registro.status !== 'NA_FILA' && String(compra.dia || '') >= entrouEm) situacao = 'VOLTOU';
                else if (compra && String(compra.dia || '') >= corteCompra) return null; // comprou há pouco: não é resgate
                else if (!registro && cpfsNoFunil.has(cpf)) return null; // já está em aberto no funil
                else situacao = !registro || registro.status === 'NA_FILA' ? 'NAO_CONTATADO' : registro.status;

                const naFilaSemContato = registro?.status === 'NA_FILA';
                const filaVencida = naFilaSemContato && (
                    !registro.puxado_por
                    || (registro.puxado_em && new Date(registro.puxado_em) < limiteFila)
                    || desligadas.has(normalizarNome(registro.puxado_por))
                );
                const dono = filaVencida ? '' : (registro?.puxado_por || registro?.atualizado_por || '');
                const disponivel = situacao !== 'VOLTOU' && (!registro || filaVencida);
                const semTel = semTelefoneValido(a.telefone);
                const { etapa, voltaEm, paraHoje } = situacao === 'VOLTOU' ? { etapa: 'VOLTOU', voltaEm: null, paraHoje: false } : calcularEtapa(situacao, registro, hoje);
                return {
                    ...a, aluno_id, tipo: tipoDoStatus(a.status_aluno), matricula: a.alunos_unidades?.[0]?.matricula || '',
                    situacao, etapa, voltaEm, paraHoje, registro, dono, semTel, compra,
                    disponivel: disponivel && !semTel, minhaFila: !semTel && !disponivel && mesmoNome(dono, operador)
                };
            })
            .filter(Boolean);
    }, [alunos, andamento, compras, naoContatar, cpfsNoFunil, desligadas, operador, hoje]);

    const daVisao = useMemo(() => linhas.filter(l => (
        visao === 'SEM_TELEFONE' ? l.semTel && l.situacao !== 'VOLTOU'
            : visao === 'FILA' ? l.minhaFila : visao === 'DISPONIVEIS' ? l.disponivel : !l.semTel
    )), [linhas, visao]);
    const totalSemTelefone = useMemo(() => linhas.filter(l => l.semTel && l.situacao !== 'VOLTOU').length, [linhas]);
    const totalDisponiveis = useMemo(() => linhas.filter(l => l.disponivel && (!tipoPuxar || l.tipo === tipoPuxar)).length, [linhas, tipoPuxar]);

    const filtradas = useMemo(() => daVisao.filter(l => {
        if (filtroAndamento === 'HOJE' && !l.paraHoje) return false;
        if (!['HOJE', 'TODOS'].includes(filtroAndamento) && l.etapa !== filtroAndamento) return false;
        if (filtroTipo && l.tipo !== filtroTipo) return false;
        return contatoCombinaComBusca(l, busca);
    }).sort((a, b) => ordenarFila(a, b) || String(b.data_cadastro || '').localeCompare(String(a.data_cadastro || ''))), [daVisao, filtroAndamento, filtroTipo, busca]);

    const contagem = useMemo(() => {
        const c = { HOJE: 0, AGUARDANDO: 0, INTERESSADO: 0, VOLTOU_MES: 0, DESISTIRAM: 0 };
        daVisao.forEach(l => {
            if (l.paraHoje) c.HOJE++;
            else if (l.etapa === 'AGUARDANDO') c.AGUARDANDO++;
            else if (l.etapa === 'INTERESSADO') c.INTERESSADO++;
            else if (l.etapa === 'GELADEIRA') c.DESISTIRAM++;
            if (l.situacao === 'VOLTOU' && String(l.compra?.dia || '') >= inicioMes) c.VOLTOU_MES++;
        });
        return c;
    }, [daVisao, inicioMes]);

    const atualizarLocal = (alunoId, campos) => setAndamento(prev => {
        const novo = new Map(prev);
        novo.set(alunoId, { ...(prev.get(alunoId) || { criado_em: new Date().toISOString() }), aluno_id: alunoId, ...campos });
        return novo;
    });

    // umAluno = "Pegar para mim" na linha (09/11/2026)
    const puxar = async (umAluno) => {
        const candidatos = umAluno ? [umAluno] : linhas
            .filter(l => l.disponivel && (!tipoPuxar || l.tipo === tipoPuxar))
            .sort((a, b) => String(b.data_cadastro || '').localeCompare(String(a.data_cadastro || '')))
            .slice(0, qtdPuxar);
        if (candidatos.length === 0) return avisar(tx("Não há alunos disponíveis para puxar com esse filtro."));
        setPuxando(true);
        try {
            const confirmados = await puxarParaFilaResgate({ alunoIds: candidatos.map(c => c.aluno_id), unidade: unidadeChave, operador });
            const mapa = await carregarAndamentoResgate();
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
            else if (perdidos > 0) avisar(tx("{length} aluno(s) puxado(s). {perdidos} já tinha(m) sido puxado(s) por outra pessoa.", { length: confirmados.length, perdidos }));
        } catch (err) {
            console.error('Erro ao puxar alunos do resgate:', err);
            avisar(tx("Não foi possível puxar.\n\n{v1}", { v1: err?.message || '' }), 'erro');
        } finally {
            setPuxando(false);
        }
    };

    // Registra o contato (conta na meta) e passa para "Contatado" quem ainda não tinha sido contatado
    const registrarContato = async (linha, { canal }) => {
        if (contatadosHoje.has(linha.aluno_id)) return;
        setSalvando(linha.aluno_id);
        try {
            const base = {
                unidade: unidadeChave, consultor: operador, tipo: 'RESGATE',
                aluno_id: linha.aluno_id, nome: linha.nome, referencia: diaISO(0), canal,
                observacao: marcaFeitoPor(usuarioLogado, operador) || null
            };
            let gravou;
            try {
                gravou = await registrarContatoFeito(base);
            } catch (err) {
                // Sem o SQL de 07/11 o banco ainda não aceita o tipo RESGATE: grava como Cancelado/Inativo
                if (err?.code !== '23514') throw err;
                gravou = await registrarContatoFeito({ ...base, tipo: linha.tipo });
            }
            setContatadosHoje(prev => new Set(prev).add(linha.aluno_id));
            if (gravou && onContatoFeito) onContatoFeito(`Contato de resgate ${canal === 'WHATSAPP' ? 'via WhatsApp' : 'por ligação'}`, `aluno:${linha.aluno_id}`);
            if (linha.situacao === 'NAO_CONTATADO') {
                const dono = linha.dono || operador;
                const puxadoEm = linha.registro?.puxado_em && !linha.disponivel ? linha.registro.puxado_em : new Date().toISOString();
                await salvarAndamentoResgate({ aluno_id: linha.aluno_id, unidade: unidadeChave, status: 'CONTATADO', quem: operador, puxado_por: dono, puxado_em: puxadoEm });
                atualizarLocal(linha.aluno_id, { status: 'CONTATADO', puxado_por: dono, puxado_em: puxadoEm, atualizado_em: new Date().toISOString() });
            }
        } catch (err) {
            console.error('Erro ao registrar contato de resgate:', err);
            avisar(tx("Não foi possível registrar o contato.\n\n{v1}", { v1: err?.message || '' }), 'erro');
        } finally {
            setSalvando('');
        }
    };

    const abrirWhatsApp = async (linha) => {
        if (linha.semTel) return avisar(tx("Este aluno está sem telefone cadastrado."));
        abrirNoWhatsApp(linha.telefone, montarMensagem('FASE_NOVO_INATIVO', { nome: linha.nome, unidade: unidadeChave }, mensagens || undefined));
        await registrarContato(linha, { canal: 'WHATSAPP' });
        setResultadoPara({ ...linha, _obrigatorio: true });
    };

    const ligar = async (linha) => {
        if (linha.semTel) return avisar(tx("Este aluno está sem telefone cadastrado."));
        ligarPeloSip(linha.telefone);
        await registrarContato(linha, { canal: 'LIGACAO' });
        setResultadoPara({ ...linha, _obrigatorio: true });
    };

    const aplicarResultado = async (linha, tipo) => {
        setResultadoPara(null);
        const reg = andamento.get(linha.aluno_id) || linha.registro || {};
        // Interessado vai para o funil (sem data de volta aqui), igual à Migração (09/11/2026)
        const { status, extras, foiParaGeladeira } = camposDoResultado(tipo, reg, hoje);
        const dono = reg.puxado_por ? undefined : (linha.dono || operador);
        setSalvando(linha.aluno_id);
        try {
            await salvarAndamentoResgate({ aluno_id: linha.aluno_id, unidade: unidadeChave, status, quem: operador, puxado_por: dono, extras });
            registrarResultadoContato({ unidade: unidadeChave, consultor: operador, origem: 'RESGATE', aluno_id: linha.aluno_id, resultado: tipo });
            atualizarLocal(linha.aluno_id, { status, ...extras, atualizado_em: new Date().toISOString(), ...(dono ? { puxado_por: dono } : {}) });
            if (foiParaGeladeira) avisar(tx("{nome}: {qtd} tentativas sem resposta. Foi para a geladeira e volta em {dias} dias.", { nome: linha.nome, qtd: MAX_TENTATIVAS, dias: DIAS_GELADEIRA }));
            if (tipo === 'INTERESSADO' && onInteressado) await onInteressado(linha);
        } catch (err) {
            avisar(tx("Não foi possível salvar.\n\n{v1}", { v1: err?.message || '' }), 'erro');
        } finally {
            setSalvando('');
        }
    };

    // Desmarcar o Interessado (clicar de novo no botão): volta para "Contatado", sem data
    const desmarcarInteresse = async (linha) => {
        setSalvando(linha.aluno_id);
        try {
            await salvarAndamentoResgate({ aluno_id: linha.aluno_id, unidade: unidadeChave, status: 'CONTATADO', quem: operador, extras: { volta_em: null } });
            atualizarLocal(linha.aluno_id, { status: 'CONTATADO', volta_em: null, atualizado_em: new Date().toISOString() });
        } catch (err) {
            avisar(tx("Não foi possível salvar.\n\n{v1}", { v1: err?.message || '' }), 'erro');
        } finally {
            setSalvando('');
        }
    };

    const devolver = async (linha) => {
        setSalvando(linha.aluno_id);
        try {
            await devolverDaFilaResgate({ aluno_id: linha.aluno_id, unidade: unidadeChave, quem: operador });
            atualizarLocal(linha.aluno_id, { status: 'NA_FILA', puxado_por: null, puxado_em: null, volta_em: null, tentativas: 0, resultado: null });
        } catch (err) {
            avisar(tx("Não foi possível devolver.\n\n{v1}", { v1: err?.message || '' }), 'erro');
        } finally {
            setSalvando('');
        }
    };

    const copiarSemTelefone = async () => {
        const texto = filtradas.map(l => [l.nome, l.cpf || '', l.matricula || ''].join('\t')).join('\n');
        try {
            await navigator.clipboard.writeText(`${tx("Nome")}\t${tx("CPF")}\t${tx("Matrícula")}\n${texto}`);
            avisar(tx("Lista copiada ({qtd} alunos).", { qtd: filtradas.length }), 'sucesso');
        } catch {
            avisar(tx("Não foi possível copiar a lista."), 'erro');
        }
    };

    const th = 'px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap';
    const seletor = 'bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 outline-none cursor-pointer';

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm p-6 animate-[fadeIn_0.3s_ease-out]">
            <div className="flex flex-wrap justify-between items-start gap-4 mb-5 border-b border-slate-100 dark:border-slate-800 pb-5">
                <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                        <LifeBuoy className="w-6 h-6 text-blue-500" />{' '}{tx("Resgate de alunos")}
                        {carregando && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                    </h3>
                    <p className="text-xs font-bold text-slate-400 mt-1">{tx("Alunos finalizados e inativos de {unidade}. Puxe alguns para a sua fila e chame de volta aos poucos.", { unidade: unidadeChave })}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {CONTADORES.map(c => (
                        <button key={c.chave} type="button" onClick={() => setFiltroAndamento(c.filtro)} className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border hover:brightness-95 ${c.classe} ${filtroAndamento === c.filtro ? 'ring-2 ring-blue-500/40' : ''}`}>{contagem[c.chave]} {tx(c.rotulo)}</button>
                    ))}
                </div>
            </div>

            {faltaSql && (
                <div className="mb-4 px-4 py-2.5 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />{' '}
                    {faltaSql === 'CADASTRO'
                        ? tx("Falta rodar o SQL 2026-11-06-alunos-importacao no Supabase: sem ele o sistema não sabe quem está finalizado ou inativo.")
                        : faltaSql === 'RESGATE'
                            ? tx("Falta rodar o SQL 2026-11-07-crm-resgate no Supabase: sem ele não dá para puxar nem guardar o andamento do Resgate.")
                            : tx("Não foi possível carregar os alunos do cadastro.")}
                </div>
            )}

            {/* PUXAR PARA A MINHA FILA */}
            <div className="mb-5 bg-blue-50/60 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-2xl p-4 flex flex-wrap items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">{tx("Puxar para a minha fila:")}</span>
                <select value={tipoPuxar} onChange={(e) => setTipoPuxar(e.target.value)} className={seletor}>
                    {TIPOS_RESGATE.map(t => <option key={t.val} value={t.val}>{tx(t.label)}</option>)}
                </select>
                <select value={qtdPuxar} onChange={(e) => setQtdPuxar(Number(e.target.value))} className={seletor}>
                    {QUANTIDADES_PUXAR.map(q => <option key={q} value={q}>{q}{' '}{tx("alunos")}</option>)}
                </select>
                <button type="button" onClick={() => puxar()} disabled={puxando || totalDisponiveis === 0 || faltaSql === 'RESGATE'} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                    {puxando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightCircle className="w-4 h-4" />}{' '}{tx("Puxar")}
                </button>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{totalDisponiveis}{' '}{tx("disponível(is)")}{' '}{tx("· os cadastrados mais recentemente vêm primeiro")}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    {VISOES_FILA.map(v => (
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
                <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className={seletor}>
                    {TIPOS_RESGATE.map(t => <option key={t.val} value={t.val}>{tx(t.label)}</option>)}
                </select>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{filtradas.length}{' '}{tx("aluno(s)")}</span>
                {visao === 'SEM_TELEFONE' && filtradas.length > 0 && (
                    <button type="button" onClick={copiarSemTelefone} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5" title={tx("Copia nome, CPF e matrícula para procurar os telefones no TECACE")}>
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
                            <th className={th}>{tx("Situação no cadastro")}</th>
                            <th className={th}>{tx("Telefone")}</th>
                            <th className={th}>{tx("Andamento")}</th>
                            {visao === 'TODOS' && <th className={th}>{tx("Na fila de")}</th>}
                            <th className={`${th} text-right`}>{tx("Ações")}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filtradas.length === 0 ? (
                            <tr><td colSpan={visao === 'TODOS' ? 6 : 5} className="text-center py-12 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {carregando ? tx("Carregando...") : visao === 'FILA' ? tx("Sua fila está vazia. Use \"Puxar\" para pegar alunos para trabalhar.") : tx("Nenhum aluno neste filtro.")}
                            </td></tr>
                        ) : filtradas.slice(0, limite).map(l => {
                            const a = ANDAMENTOS[l.etapa] || ANDAMENTOS.NAO_CONTATADO;
                            const ocupado = salvando === l.aluno_id;
                            const podeTrabalhar = l.minhaFila && l.etapa !== 'VOLTOU' && l.etapa !== 'GELADEIRA';
                            const jaHoje = contatadosHoje.has(l.aluno_id);
                            const detalhe = l.etapa === 'VOLTOU' ? tx('comprou {plano} em {dia}', { plano: l.compra?.produto || '', dia: dataBR(l.compra?.dia) }) : detalheEtapa(l);
                            return (
                                <tr key={l.aluno_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                    <td className="px-4 py-3">
                                        <button type="button" onClick={() => setContatoFicha(l)} className="text-xs font-black text-slate-800 dark:text-white uppercase text-left hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-2" title={tx("Abrir a ficha do aluno")}>{l.nome}</button>
                                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">{[l.cpf && `CPF ${l.cpf}`, l.matricula && `${tx("Matrícula")} ${l.matricula}`].filter(Boolean).join(' · ')}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${ETIQUETA_TIPO[l.tipo] || ''}`}>{l.status_aluno}</span>
                                        {l.data_cadastro && <p className="text-[10px] font-bold text-slate-400 mt-1">{tx("cadastro {dia}", { dia: String(l.data_cadastro).slice(0, 10).split('-').reverse().join('/') })}</p>}
                                    </td>
                                    <td className={`px-4 py-3 text-xs font-bold whitespace-nowrap ${l.semTel ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'}`}>
                                        {l.semTel ? (l.telefone ? <span title={tx("Número de preenchimento ou incompleto")}>{l.telefone} ✗</span> : tx("sem telefone")) : l.telefone}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${a.classe}`}>{tx(a.rotulo)}</span>
                                        {detalhe && <p className={`text-[10px] font-bold mt-1 ${l.paraHoje && l.voltaEm && l.voltaEm < hoje ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>{detalhe}</p>}
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
                                                    <button type="button" onClick={() => abrirWhatsApp(l)} disabled={ocupado} className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1" title={tx("Abre o WhatsApp com a mensagem e já registra o contato")}>
                                                        {ocupado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}{' '}{tx("WhatsApp")}
                                                    </button>
                                                    <button type="button" onClick={() => ligar(l)} disabled={ocupado} className="px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-600 hover:text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1 disabled:opacity-60" title={tx("Ligar (MicroSIP) e já registrar o contato")}>
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
                                                            onDesmarcarInteressado={() => desmarcarInteresse(l)}
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
                                                <button type="button" onClick={() => puxar(l)} disabled={puxando || faltaSql === 'RESGATE'} className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1" title={tx("Passa este aluno para a sua fila (Minha fila)")}>
                                                    <ArrowRightCircle className="w-3.5 h-3.5" />{' '}{tx("Pegar para mim")}
                                                </button>
                                            )}
                                            {l.situacao !== 'VOLTOU' && (
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
                    aluno={{ ...resultadoPara, registro: andamento.get(resultadoPara.aluno_id) || resultadoPara.registro }}
                    hoje={hoje}
                    textoInteressado={tx('Vai para o seu funil (Em Espera, volta amanhã).')}
                    obrigatorio={!!resultadoPara._obrigatorio}
                    textoNaoQuer={tx('Vai para a geladeira do Resgate e volta em {dias} dias. Não entra no "Não contatar".', { dias: DIAS_GELADEIRA })}
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

export default AbaResgate;
