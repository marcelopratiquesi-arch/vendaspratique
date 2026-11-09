import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient.js';
import { avisar } from '../../components/avisar.js';
import { tx } from '../../i18n/traduzir.js';
import { resumoDaUnidade, mentoresDaUnidade, prontidaoDaUnidade, normalizarUnidade, unidadesDoMentorEm } from '../Configuracoes/conferenciaLogins.js';
import { metasDaUnidade } from '../Pendencias/pendencias.js';

// ==========================================
// DADOS E AÇÕES DAS UNIDADES — uma peça só, usada pela aba Cadastros → Unidades e pela Central da Unidade
// aberta de qualquer tela (Dashboard, Metas, Relatórios, Ranking; 09/11/2026). Assim as duas são a MESMA.
// completo = true (Admin): lê também os logins e os Mentores e libera as ações (Desativar, Excluir, Mentores,
// Personal Class). completo = false (Mentor/Líder): só a equipe, as metas e o Personal, para ver (o banco já
// entrega só as unidades da pessoa).
// ==========================================

export const useDadosUnidades = ({ ativo = true, completo = true, unidades = [], setUnidades, nomeUsuario = null, aoExcluir } = {}) => {
    const [usuarios, setUsuarios] = useState([]);
    const [colaboradores, setColaboradores] = useState([]);
    const [vinculos, setVinculos] = useState({});
    const [metas, setMetas] = useState(null); // null = não deu para ler (o item "metas" sai da conferência)
    const [semPersonal, setSemPersonal] = useState({});
    const [carregado, setCarregado] = useState(false);

    const carregarVinculos = useCallback(async () => {
        if (!completo) return;
        const { data, error } = await supabase.from('mentor_unidades').select('mentor_email, unidade');
        if (error) { console.warn('Unidades: não foi possível ler as unidades dos mentores.', error); return; }
        const mapa = {};
        (data || []).forEach(l => { const e = String(l.mentor_email || '').toLowerCase().trim(); (mapa[e] = mapa[e] || []).push(l.unidade); });
        setVinculos(mapa);
    }, [completo]);

    // Só leitura, para o resumo e a Central (logins e equipe de TODAS as unidades: o App guarda só a do topo)
    useEffect(() => {
        if (!ativo) return undefined;
        let vivo = true;
        const agora = new Date();
        (async () => {
            const [l, c, m, p] = await Promise.all([
                completo ? supabase.from('usuarios_sistema').select('email, nome, role, unidade') : Promise.resolve({ data: [] }),
                supabase.from('colaboradores').select('*'),
                supabase.from('metas_unidades').select('*').eq('mes', String(agora.getMonth() + 1).padStart(2, '0')).eq('ano', String(agora.getFullYear())),
                supabase.from('unidades_sem_personal').select('unidade, sem_personal'),
            ]);
            if (!vivo) return;
            if (l.error) console.warn('Unidades: não foi possível ler os logins.', l.error);
            if (c.error) console.warn('Unidades: não foi possível ler a equipe.', c.error);
            if (m.error) console.warn('Unidades: não foi possível ler as metas do mês.', m.error);
            setUsuarios(l.data || []);
            setColaboradores(c.data || []);
            setMetas(m.error ? null : (m.data || []));
            setSemPersonal(Object.fromEntries((p.error ? [] : (p.data || [])).filter(x => x.sem_personal).map(x => [normalizarUnidade(x.unidade), true])));
            setCarregado(true);
        })();
        carregarVinculos();
        return () => { vivo = false; };
    }, [ativo, completo, carregarVinculos]);

    // Uma linha por unidade, com tudo calculado (tabela, filtros, ordem e Central usam a mesma conta)
    const linhas = useMemo(() => {
        const agora = new Date();
        const metasPorUnidade = Object.fromEntries((metas || []).map(m => [normalizarUnidade(m.unidade), m]));
        return unidades.filter(u => u?.nome).map(u => {
            const k = normalizarUnidade(u.nome);
            const resumo = resumoDaUnidade(u.nome, { usuarios, colaboradores });
            const mentores = mentoresDaUnidade(u.nome, { usuarios, vinculos });
            const prontidao = prontidaoDaUnidade(u.nome, {
                usuarios, colaboradores, vinculos,
                metasPendentes: metas ? metasDaUnidade(metasPorUnidade[k], !!semPersonal[k], agora) : null,
                metasLidas: !!metas,
            });
            return { u, resumo, mentores, prontidao, desativada: u.ativa === false, semPersonal: !!semPersonal[k] };
        });
    }, [unidades, usuarios, colaboradores, vinculos, metas, semPersonal]);

    // ---------- AÇÕES (só no modo completo = Admin; o banco também confere) ----------
    const cadastrar = async (nome) => {
        if (unidades.some(u => normalizarUnidade(u.nome) === normalizarUnidade(nome))) {
            avisar(tx('A unidade {nome} já está cadastrada.', { nome }), 'atencao');
            return false;
        }
        const { data, error } = await supabase.from('unidades').insert([{ nome }]).select();
        if (error || !data?.[0]) { avisar(tx("Erro ao salvar unidade: {v2}", { v2: error?.message || '' }), 'erro'); return false; }
        setUnidades([...unidades, data[0]]);
        avisar(tx('Unidade cadastrada: {nome}.', { nome }), 'sucesso');
        return true;
    };

    // Desativar / reativar (decisão do dono, 04/11/2026): a unidade desativada some do seletor e das listas,
    // mas vendas, alunos, metas e contatos dela continuam guardados. Função segura unidade_definir_ativa (só Admin).
    const ativar = async (unidade, ativa) => {
        const pergunta = ativa
            ? tx("Reativar a unidade {nome}? Ela volta a aparecer no seletor e nas listas.", { nome: unidade.nome })
            : tx("Desativar a unidade {nome}?\n\nEla some do seletor do topo e das listas de escolha. As vendas, alunos, metas e contatos dela continuam guardados e é possível reativar depois.", { nome: unidade.nome });
        if (!window.confirm(pergunta)) return;
        const { error } = await supabase.rpc('unidade_definir_ativa', { p_id: String(unidade.id), p_ativa: ativa });
        if (error) {
            console.error('Erro ao desativar/reativar unidade:', error);
            avisar(tx("Não foi possível alterar a unidade (o SQL de unidades foi rodado?): {v1}", { v1: error.message }), 'erro');
            return;
        }
        setUnidades(unidades.map(u => (u.id === unidade.id ? { ...u, ativa } : u)));
        avisar(ativa ? tx("Unidade reativada.") : tx("Unidade desativada."), 'sucesso');
    };

    // Excluir de verdade só unidade SEM nenhum dado ligado (o banco também trava)
    const excluir = async (unidade) => {
        const { data: uso, error: erroUso } = await supabase.rpc('unidade_uso', { p_nome: unidade.nome });
        if (erroUso) {
            console.error('Erro ao conferir o uso da unidade:', erroUso);
            avisar(tx("Não foi possível conferir se a unidade tem dados (o SQL de unidades foi rodado?). Nada foi excluído."), 'erro');
            return;
        }
        const ROTULOS = { vendas: 'vendas', alunos: 'alunos', contatos: 'contatos do CRM', equipe: 'pessoas na equipe', logins: 'logins', avaliacoes: 'avaliações', metas: 'metas', movimentacao: 'lançamentos de movimentação' };
        const usados = Object.entries(uso || {}).filter(([, qtd]) => Number(qtd) > 0);
        if (usados.length > 0) {
            const listaUso = usados.map(([chave, qtd]) => `• ${qtd} ${tx(ROTULOS[chave] || chave)}`).join('\n');
            if (unidade.ativa !== false && window.confirm(tx("A unidade {nome} não pode ser excluída porque tem:\n\n{lista}\n\nDeseja DESATIVAR a unidade? (os dados continuam guardados)", { nome: unidade.nome, lista: listaUso }))) {
                const { error } = await supabase.rpc('unidade_definir_ativa', { p_id: String(unidade.id), p_ativa: false });
                if (error) { avisar(tx("Não foi possível desativar: {v1}", { v1: error.message }), 'erro'); return; }
                setUnidades(unidades.map(u => (u.id === unidade.id ? { ...u, ativa: false } : u)));
                avisar(tx("Unidade desativada."), 'sucesso');
            } else if (unidade.ativa === false) {
                avisar(tx("A unidade {nome} tem dados ligados a ela e não pode ser excluída. Ela continua desativada.", { nome: unidade.nome }), 'atencao');
            }
            return;
        }
        if (!window.confirm(tx("A unidade {nome} não tem nenhum dado ligado a ela. Excluir permanentemente?", { nome: unidade.nome }))) return;
        const { error } = await supabase.from('unidades').delete().eq('id', unidade.id);
        if (error) {
            console.error('Erro ao excluir unidade:', error);
            avisar(tx("Não foi possível excluir a unidade: {v1}", { v1: error.message }), 'erro');
            return;
        }
        setUnidades(unidades.filter(u => u.id !== unidade.id));
        aoExcluir?.(unidade);
        avisar(tx("Unidade excluída."), 'sucesso');
    };

    // Mentores marcados pela Central (o mesmo que o botão "Unidades" do Mentor em Configurações; tabela mentor_unidades)
    const salvarMentores = async (unidade, emailsMarcados) => {
        const chave = normalizarUnidade(unidade.nome);
        const marcados = new Set(emailsMarcados.map(e => String(e).toLowerCase().trim()));
        const mentores = usuarios.filter(u => String(u.role).toUpperCase() === 'MENTOR');
        const falhou = async (error) => { avisar(tx("Não foi possível salvar as unidades do mentor.\n\n{v2}", { v2: error?.message || '' }), 'erro'); await carregarVinculos(); return false; };
        for (const m of mentores) {
            const email = String(m.email).toLowerCase().trim();
            const nomesGravados = unidadesDoMentorEm(vinculos, email).filter(n => normalizarUnidade(n) === chave);
            if (marcados.has(email) && nomesGravados.length === 0) {
                const { error } = await supabase.from('mentor_unidades').insert({ mentor_email: m.email, unidade: unidade.nome });
                if (error) return falhou(error);
            } else if (!marcados.has(email) && nomesGravados.length > 0) {
                const { error } = await supabase.from('mentor_unidades').delete().eq('mentor_email', m.email).in('unidade', nomesGravados);
                if (error) return falhou(error);
            }
        }
        await carregarVinculos();
        avisar(tx('Mentores da unidade {nome} salvos.', { nome: unidade.nome }), 'sucesso');
        return true;
    };

    // "Não tem Personal Class": o mesmo campo da aba Metas (tabela unidades_sem_personal)
    const marcarPersonal = async (unidade, valor) => {
        const u = String(unidade.nome).toUpperCase();
        if (valor && !window.confirm(tx('Marcar que a unidade {unidade} NÃO TEM Personal Class? O Personal some das metas (Start e Mensal) e a gratificação mensal fica com 3 indicadores.', { unidade: u }))) return;
        const { error } = await supabase.from('unidades_sem_personal').upsert({ unidade: u, sem_personal: valor, atualizado_por: nomeUsuario || null, atualizado_em: new Date().toISOString() }, { onConflict: 'unidade' });
        if (error) { console.error('Unidades: erro ao gravar Personal', error); avisar(tx('Não foi possível gravar: {erro}', { erro: error.message }), 'erro'); return; }
        setSemPersonal(m => { const n = { ...m }; if (valor) n[normalizarUnidade(u)] = true; else delete n[normalizarUnidade(u)]; return n; });
        avisar(valor ? tx('Unidade marcada sem Personal Class.') : tx('Personal Class voltou para as metas.'), 'sucesso');
    };

    return { usuarios, colaboradores, vinculos, metas, semPersonal, linhas, carregado, carregarVinculos, acoes: { cadastrar, ativar, excluir, salvarMentores, marcarPersonal } };
};
