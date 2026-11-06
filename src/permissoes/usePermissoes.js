import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { temPermissao } from './catalogoPermissoes.js';
import { avisar } from '../components/avisar.js';
import { tx } from '../i18n/traduzir.js';

// ==========================================
// Carrega as mudanças de permissão feitas pelo Admin (aba Configurações → Permissões, 06/11/2026)
// e devolve pode(codigo). Sem as tabelas no banco (SQL ainda não rodado) ou com erro, vale o padrão
// do catálogo — o sistema funciona exatamente como antes. Atualiza sozinho quando o Admin muda algo.
// ==========================================

const ESPERA_RECARREGAR_MS = 1500;

export const carregarRegrasPapel = async () => {
    const { data, error } = await supabase.from('permissoes_papel').select('papel, codigo, permitido');
    if (error) return { erro: error, mapa: new Map() };
    return { erro: null, mapa: new Map((data || []).map(l => [`${String(l.papel).toUpperCase()}|${l.codigo}`, !!l.permitido])) };
};

// A função seg_pode (Etapa 2, sql/2026-11-06-permissoes-acoes/) já existe no banco?
// Sem ela, as ações que o banco confere ficam no padrão (senão o botão apareceria e o banco recusaria).
export const verificarBancoPronto = async () => {
    const { error } = await supabase.rpc('seg_pode', { p_codigo: '101' });
    if (error) console.warn('Permissões: a função seg_pode ainda não existe no banco; as ações ficam no padrão (rode sql/2026-11-06-permissoes-acoes/).', error.message || error);
    return !error;
};

export const usePermissoes = (usuarioLogado) => {
    const email = String(usuarioLogado?.email || '').toLowerCase().trim();
    const papel = String(usuarioLogado?.role || '').toUpperCase().trim();
    const [regrasPapel, setRegrasPapel] = useState(() => new Map());
    const [excecoes, setExcecoes] = useState(() => new Map());
    const [bancoPronto, setBancoPronto] = useState(false);

    useEffect(() => {
        if (!email || papel === 'ADMIN') { setRegrasPapel(new Map()); setExcecoes(new Map()); setBancoPronto(false); return undefined; }
        let ativo = true;
        let timer = null;
        let assinaturaAnterior = null; // para avisar a pessoa quando AS PERMISSÕES DELA mudarem (não as de outros níveis)
        const carregar = async () => {
            const [regras, exc, pronto] = await Promise.all([
                carregarRegrasPapel(),
                supabase.from('permissoes_excecao').select('codigo, permitido').eq('email', email),
                verificarBancoPronto(),
            ]);
            if (!ativo) return;
            if (regras.erro || exc.error) {
                console.warn('Permissões: usando o padrão do sistema (rode o SQL de sql/2026-11-06-permissoes/ no Supabase).', regras.erro || exc.error);
            }
            const mapaExc = new Map((exc.data || []).map(l => [l.codigo, !!l.permitido]));
            const assinatura = JSON.stringify([
                [...regras.mapa].filter(([k]) => k.startsWith(`${papel}|`)).sort(),
                [...mapaExc].sort(),
            ]);
            if (assinaturaAnterior !== null && assinatura !== assinaturaAnterior) {
                avisar(tx('Suas permissões foram atualizadas pelo administrador. Algumas telas ou botões podem ter mudado.'), 'atencao');
            }
            assinaturaAnterior = assinatura;
            setBancoPronto(pronto);
            setRegrasPapel(regras.mapa);
            setExcecoes(mapaExc);
        };
        carregar();
        const canal = supabase.channel(`permissoes-${email}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'permissoes_papel' }, () => { clearTimeout(timer); timer = setTimeout(carregar, ESPERA_RECARREGAR_MS); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'permissoes_excecao' }, () => { clearTimeout(timer); timer = setTimeout(carregar, ESPERA_RECARREGAR_MS); })
            .subscribe();
        return () => { ativo = false; clearTimeout(timer); supabase.removeChannel(canal); };
    }, [email, papel]);

    return useCallback((codigo) => temPermissao({ codigo, papel, regrasPapel, excecoes, bancoPronto }), [papel, regrasPapel, excecoes, bancoPronto]);
};
