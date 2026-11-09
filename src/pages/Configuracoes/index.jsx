import React, { useCallback, useEffect, useState } from 'react';
import { Settings, Shield, KeyRound, UserPlus } from 'lucide-react';
import { supabase, conexaoParaCriarLogin } from '../../supabaseClient.js';
import ModalUnidadesMentor from '../../components/Modals/ModalUnidadesMentor.jsx';
import AbaPermissoes from '../../permissoes/AbaPermissoes.jsx';
import { avisar } from '../../components/avisar.js';
import { tx } from '../../i18n/traduzir.js';
import AbaLogins from './AbaLogins.jsx';
import JanelaLogin from './JanelaLogin.jsx';
import { normalizarUnidade, unidadesDoMentorEm } from './conferenciaLogins.js';

// ==========================================
// CONFIGURAÇÕES (só o Admin) — visual novo de 09/11/2026 (decisão do dono):
// - Fica só com Logins e Permissões. A Gestão de Unidades foi para Cadastros → Unidades (TabUnidades.jsx).
// - Topo compacto; "Novo login" e "Editar" numa janela (JanelaLogin.jsx); lista em tabela (AbaLogins.jsx).
// - As regras de gravar são as mesmas de antes (signUp numa conexão separada + usuarios_sistema;
//   unidades do Mentor em mentor_unidades). Novo: Editar sem redigitar a senha e o atalho "Permissões deste login".
// ==========================================

const Configuracoes = ({ unidades = [], emailLogado = '' }) => {
    const [abaAtiva, setAbaAtiva] = useState('logins'); // 'logins' | 'permissoes'
    const [usuariosAcesso, setUsuariosAcesso] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [vinculosMentor, setVinculosMentor] = useState({});
    const [mentorEditando, setMentorEditando] = useState(null);
    const [janela, setJanela] = useState(null); // null | { login: null (novo) | objeto (editar) }
    const [loginPermissoes, setLoginPermissoes] = useState('');
    const [excecoesPorEmail, setExcecoesPorEmail] = useState({});

    // Quantas exceções de permissão cada login tem (etiqueta na lista; 09/11/2026). Sem a tabela, fica sem etiqueta.
    const carregarExcecoes = useCallback(async () => {
        const { data, error } = await supabase.from('permissoes_excecao').select('email');
        if (error) { console.warn('Logins: não foi possível ler as exceções de permissão.', error); return; }
        const mapa = {};
        (data || []).forEach(l => { const e = String(l.email || '').toLowerCase().trim(); mapa[e] = (mapa[e] || 0) + 1; });
        setExcecoesPorEmail(mapa);
    }, []);

    const carregarVinculosMentor = useCallback(async () => {
        const { data, error } = await supabase.from('mentor_unidades').select('mentor_email, unidade');
        if (error) { console.error('Erro ao carregar as unidades dos mentores:', error); return; }
        const mapa = {};
        (data || []).forEach(l => {
            const email = String(l.mentor_email || '').toLowerCase().trim();
            (mapa[email] = mapa[email] || []).push(l.unidade);
        });
        setVinculosMentor(mapa);
    }, []);
    const unidadesDoMentor = (email) => unidadesDoMentorEm(vinculosMentor, email);

    useEffect(() => {
        let ativo = true;
        (async () => {
            const { data, error } = await supabase.from('usuarios_sistema').select('*');
            if (!ativo) return;
            if (error) { console.error('Erro ao carregar os logins:', error); avisar(tx('Não foi possível carregar os logins: {erro}', { erro: error.message }), 'erro'); }
            if (data) setUsuariosAcesso(data);
            setCarregando(false);
        })();
        carregarVinculosMentor();
        carregarExcecoes();
        return () => { ativo = false; };
    }, [carregarVinculosMentor, carregarExcecoes]);

    const confirmarSaidaDeMentor = (existente, novoPapel) => {
        const qtd = unidadesDoMentor(existente?.email).length;
        if (existente?.role !== 'MENTOR' || novoPapel === 'MENTOR' || qtd === 0) return true;
        return window.confirm(tx("Este login tem {qtdVinculos} {v2} como Mentor. Elas serão removidas.\n\nContinuar?", { qtdVinculos: qtd, v2: qtd === 1 ? tx('unidade vinculada') : tx('unidades vinculadas') }));
    };

    // Novo login: igual a antes (cria o login numa conexão separada; o Admin continua conectado como ele mesmo)
    const criarLogin = async ({ email, senha, nome, role, unidade }) => {
        if (usuariosAcesso.some(u => String(u.email).toLowerCase().trim() === email)) {
            avisar(tx('Este e-mail já tem login. Use o botão Editar na lista.'), 'atencao');
            return false;
        }
        const { error: authError } = await conexaoParaCriarLogin().auth.signUp({ email, password: senha });
        if (authError && !authError.message.includes('already registered')) {
            avisar(tx("Erro na autenticação do Supabase: {message}", { message: authError.message }), 'erro');
            return false;
        }
        const { data, error } = await supabase.from('usuarios_sistema').upsert({ email, nome, role, unidade }).select();
        if (error || !data?.[0]) { avisar(tx("Erro ao salvar permissões: {v2}", { v2: error?.message || '' }), 'erro'); return false; }
        setUsuariosAcesso(lista => [...lista.filter(u => u.email !== email), data[0]]);
        avisar(tx('Login criado: {nome}.', { nome }), 'sucesso');
        if (role === 'MENTOR') avisar(tx('Agora marque as unidades deste Mentor (botão "Unidades" na linha dele).'), 'atencao');
        return true;
    };

    // Editar: troca nível, nome e unidade (o e-mail e a senha não mudam)
    const editarLogin = async (existente, { nome, role, unidade }) => {
        const email = String(existente.email).toLowerCase().trim();
        if (email === String(emailLogado || '').toLowerCase().trim() && role !== String(existente.role).toUpperCase()) {
            avisar(tx('Você não pode mudar o nível do seu próprio login (para não ficar sem acesso às Configurações).'), 'erro');
            return false;
        }
        if (!confirmarSaidaDeMentor(existente, role)) return false;
        const { data, error } = await supabase.from('usuarios_sistema').update({ nome, role, unidade }).eq('email', existente.email).select();
        if (error || !data?.[0]) { avisar(tx("Erro ao salvar permissões: {v2}", { v2: error?.message || tx('nenhuma linha alterada') }), 'erro'); return false; }
        setUsuariosAcesso(lista => lista.map(u => (u.email === existente.email ? data[0] : u)));
        carregarVinculosMentor();
        avisar(tx('Login atualizado: {nome}.', { nome }), 'sucesso');
        return true;
    };

    const aoSalvarJanela = async (dados) => {
        const ok = janela?.login ? await editarLogin(janela.login, dados) : await criarLogin(dados);
        if (ok) setJanela(null);
        return ok;
    };

    const revogar = async (u) => {
        if (!window.confirm(tx("Atenção! Deseja realmente revogar o acesso de {email}? Ele não poderá mais fazer login no sistema.", { email: u.email }))) return;
        const { error } = await supabase.from('usuarios_sistema').delete().eq('email', u.email);
        if (error) { avisar(tx('Não foi possível revogar o acesso: {erro}', { erro: error.message }), 'erro'); return; }
        setUsuariosAcesso(lista => lista.filter(x => x.email !== u.email));
        carregarVinculosMentor();
        avisar(tx('Acesso revogado: {email}.', { email: u.email }), 'sucesso');
    };

    // Salva as unidades marcadas para o mentor: tira as desmarcadas e inclui as novas (só Admin; o banco confere)
    const salvarUnidadesMentor = async (nomesMarcados) => {
        if (!mentorEditando) return false;
        const atuais = unidadesDoMentor(mentorEditando.email);
        const marcadasNorm = new Set(nomesMarcados.map(normalizarUnidade));
        const atuaisNorm = new Set(atuais.map(normalizarUnidade));
        const remover = atuais.filter(n => !marcadasNorm.has(normalizarUnidade(n)));
        const incluir = nomesMarcados.filter(n => !atuaisNorm.has(normalizarUnidade(n)));

        const falhou = async (error) => {
            avisar(tx("Não foi possível salvar as unidades do mentor.\n\n{v2}", { v2: error?.message || '' }), 'erro');
            await carregarVinculosMentor();
            return false;
        };
        if (remover.length > 0) {
            const { error } = await supabase.from('mentor_unidades').delete()
                .eq('mentor_email', mentorEditando.email).in('unidade', remover);
            if (error) return falhou(error);
        }
        if (incluir.length > 0) {
            const { error } = await supabase.from('mentor_unidades')
                .insert(incluir.map(unidade => ({ mentor_email: mentorEditando.email, unidade })));
            if (error) return falhou(error);
        }
        await carregarVinculosMentor();
        setMentorEditando(null);
        avisar(tx("Alterações salvas com sucesso!"), 'sucesso');
        return true;
    };

    const abrirPermissoesDo = (u) => { setLoginPermissoes(String(u.email || '').toLowerCase().trim()); setAbaAtiva('permissoes'); };
    // Voltando para Logins, relê as exceções (podem ter mudado na aba Permissões)
    const trocarAba = (aba) => { if (aba === 'permissoes') setLoginPermissoes(''); else carregarExcecoes(); setAbaAtiva(aba); };

    const ABAS = [['logins', tx('Logins'), Shield], ['permissoes', tx('Permissões'), KeyRound]];

    return (
        <div className="space-y-4 animate-[fadeIn_0.3s_ease-out] max-w-[1400px] mx-auto pb-10">
            {/* Topo compacto: título + abas pequenas | botão Novo login */}
            <div className="bg-white rounded-[20px] border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3 dark:bg-slate-900 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-3 min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30"><Settings className="w-4 h-4" /></span>
                        <div className="min-w-0">
                            <h2 className="text-xl font-black text-slate-800 tracking-tight leading-tight dark:text-white">{tx('Configurações')}</h2>
                            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tx('Logins e permissões · só o Admin')}</p>
                        </div>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-xl gap-1 dark:bg-slate-800" role="tablist" aria-label={tx('Configurações')}>
                        {ABAS.map(([id, rotulo, Icone]) => (
                            <button key={id} type="button" role="tab" aria-selected={abaAtiva === id} onClick={() => trocarAba(id)}
                                className={`h-8 px-3 rounded-lg text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 transition-colors ${abaAtiva === id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}>
                                <Icone className="w-3.5 h-3.5" />{rotulo}
                            </button>
                        ))}
                    </div>
                </div>
                {abaAtiva === 'logins' && (
                    <button type="button" onClick={() => setJanela({ login: null })}
                        className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-2 shadow-sm">
                        <UserPlus className="w-4 h-4" />{tx('Novo login')}
                    </button>
                )}
            </div>

            {abaAtiva === 'logins' ? (
                <AbaLogins
                    usuarios={usuariosAcesso}
                    unidades={unidades}
                    vinculos={vinculosMentor}
                    excecoesPorEmail={excecoesPorEmail}
                    carregando={carregando}
                    onEditar={(u) => setJanela({ login: u })}
                    onUnidadesMentor={setMentorEditando}
                    onPermissoes={abrirPermissoesDo}
                    onRevogar={revogar}
                />
            ) : (
                <AbaPermissoes key={loginPermissoes || 'nivel'} usuarios={usuariosAcesso} loginInicial={loginPermissoes} />
            )}

            {janela && (
                <JanelaLogin
                    key={janela.login?.email || 'novo'}
                    login={janela.login}
                    unidades={unidades}
                    onCancelar={() => setJanela(null)}
                    onSalvar={aoSalvarJanela}
                />
            )}

            {mentorEditando && (
                <ModalUnidadesMentor
                    mentor={mentorEditando}
                    unidades={unidades}
                    marcadasIniciais={unidadesDoMentor(mentorEditando.email)}
                    onCancelar={() => setMentorEditando(null)}
                    onSalvar={salvarUnidadesMentor}
                />
            )}
        </div>
    );
};

export default Configuracoes;
