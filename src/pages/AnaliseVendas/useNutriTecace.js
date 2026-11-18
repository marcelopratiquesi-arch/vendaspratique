// Hook do Nutri/Tecace (regras puras em nutriTecace.js): lê o Tecace de um mês e acompanha em tempo real.
import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient.js';
import { sistemaPausado } from '../../components/pausaSistema.js';
import { tecaceVigentePorUnidade } from './nutriTecace.js';

const campoNaoExiste = (erro) => /nutri_tecace/i.test(`${erro?.message || ''}`) || erro?.code === '42703';
const ultimoDiaDoMes = (ano, mes) => new Date(Number(ano), Number(mes), 0).getDate();

// Lê o Tecace de um mês (todas as unidades que a pessoa pode ver; o banco filtra) e acompanha em tempo real.
// ativo=false (período que não é um mês) → devolve null: as telas ficam só com as vendas do sistema.
export const useNutriTecaceMes = ({ ano, mes, ativo = true }) => {
    const [mapa, setMapa] = useState(null);
    const [versao, setVersao] = useState(0);
    useEffect(() => {
        if (!ativo || !ano || !mes) { setMapa(null); return undefined; }
        let vivo = true;
        const inicio = `${ano}-${mes}-01`;
        const fim = `${ano}-${mes}-${String(ultimoDiaDoMes(ano, mes)).padStart(2, '0')}`;
        (async () => {
            const { data, error } = await supabase.from('movimento_diario').select('unidade, data, nutri_tecace')
                .gte('data', inicio).lte('data', fim).not('nutri_tecace', 'is', null);
            if (!vivo) return;
            if (error) {
                if (!campoNaoExiste(error)) console.warn('Nutri/Tecace: erro ao ler', error.message || error);
                setMapa(new Map()); // sem o campo no banco: nada de adicional (só as vendas do sistema)
                return;
            }
            setMapa(tecaceVigentePorUnidade(data || []));
        })();
        return () => { vivo = false; };
    }, [ano, mes, ativo, versao]);
    useEffect(() => {
        if (!ativo) return undefined;
        const canal = supabase.channel(`nutri-tecace-${Math.random().toString(36).slice(2, 8)}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'movimento_diario' }, () => { if (!sistemaPausado()) setVersao(v => v + 1); })
            .subscribe();
        return () => { supabase.removeChannel(canal); };
    }, [ativo]);
    return mapa;
};
