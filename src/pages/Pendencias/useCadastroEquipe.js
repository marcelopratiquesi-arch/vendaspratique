// ==========================================
// Leitura do aviso "cadastro da equipe incompleto" (11/11/2026; tela em AvisoCadastroEquipe.jsx).
// A equipe das unidades da pessoa é lida UMA vez por login (o banco só devolve as unidades dela: Líder a dele,
// Mentor as dele), à parte do seletor do topo. O que o App já tem por cima (é mais novo: edições feitas em Cadastros).
// ==========================================
import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../../supabaseClient.js';
import { tx } from '../../i18n/traduzir.js';
import { conjuntoDeSetores, colaboradoresComProblema } from '../CadastroGeral/cadastroColaborador.js';

export const useCadastroEquipe = ({ ativo, unidades = [], colaboradoresApp = [], setColaboradoresApp }) => {
    const [lidos, setLidos] = useState(null);
    const [setores, setSetores] = useState(null);
    const chaveUnidades = unidades.join('|');

    useEffect(() => {
        if (!ativo || !chaveUnidades) { setLidos(null); return undefined; }
        let vivo = true;
        (async () => {
            const [equipe, listaSetores] = await Promise.all([
                supabase.from('colaboradores').select('*'),
                supabase.from('setores').select('id, nome'),
            ]);
            if (!vivo) return;
            if (equipe.error) { console.warn('Aviso de cadastro da equipe: não deu para ler a equipe.', equipe.error); return; }
            if (listaSetores.error) console.warn('Aviso de cadastro da equipe: não deu para ler os setores (não confere setor fora da lista).', listaSetores.error);
            setLidos(equipe.data || []);
            setSetores(listaSetores.error ? null : (listaSetores.data || []));
        })();
        return () => { vivo = false; };
    }, [ativo, chaveUnidades]);

    const itens = useMemo(() => {
        if (!ativo || !lidos) return [];
        const mapa = new Map(lidos.map(c => [c.id, c]));
        (colaboradoresApp || []).forEach(c => { if (c?.id != null) mapa.set(c.id, c); });
        return colaboradoresComProblema([...mapa.values()], chaveUnidades ? chaveUnidades.split('|') : [], conjuntoDeSetores(setores));
    }, [ativo, lidos, colaboradoresApp, setores, chaveUnidades]);

    const salvar = useCallback(async (id, campos) => {
        const { data, error } = await supabase.from('colaboradores').update(campos).eq('id', id).select();
        if (error) return { error };
        const novo = data?.[0];
        if (!novo) return { error: { message: tx('O banco não deixou gravar (confira a permissão de editar a equipe).') } };
        setLidos(l => (l || []).map(c => (c.id === id ? novo : c)));
        setColaboradoresApp?.(l => (l || []).map(c => (c.id === id ? novo : c)));
        return { data: novo };
    }, [setColaboradoresApp]);

    return { itens, setores: setores || [], carregado: lidos !== null, salvar };
};
