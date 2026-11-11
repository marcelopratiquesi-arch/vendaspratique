// ==========================================
// APROVAR PAGAMENTO DAS COMISSÕES (11/11/2026, decisão do dono)
// O Líder confere as vendas toda sexta; quando o mês fecha e está tudo conferido, o MENTOR ou o ADMIN aprova o
// pagamento daquela UNIDADE naquele MÊS. Depois disso a conferência desse mês fica INALTERÁVEL (o banco trava:
// gatilho vendas_trava_pagamento_gatilho). Só o ADMIN reabre, com motivo.
// Banco: tabela comissoes_pagamentos e funções comissao_aprovar_pagamento / comissao_reabrir_pagamento
// (sql/2026-11-11-equipe-cpf-pagamento/, passo 2). Sem o SQL a tela avisa e nada trava.
// Regras sem tela (mesDaFaixa, mesJaTerminou, vendaTravada) dá para testar com node.
// ==========================================
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient.js';
export { mesDaFaixa, mesJaTerminou, vendaTravada, pagamentoDe, mensagemDaTrava } from './regrasPagamento.js';


// Lê as aprovações dos meses do período (ativas e reabertas). O banco só devolve as unidades da pessoa.
export const usePagamentosComissao = ({ mesInicio, mesFim, ativo = true }) => {
    const [lista, setLista] = useState([]);
    const [semTabela, setSemTabela] = useState(false);
    const [versao, setVersao] = useState(0);
    const recarregar = useCallback(() => setVersao(v => v + 1), []);

    useEffect(() => {
        if (!ativo) return undefined;
        let vivo = true;
        (async () => {
            let q = supabase.from('comissoes_pagamentos').select('*').order('aprovado_em', { ascending: false }).limit(2000);
            if (mesInicio) q = q.gte('mes', mesInicio);
            if (mesFim) q = q.lte('mes', mesFim);
            const { data, error } = await q;
            if (!vivo) return;
            if (error) {
                // Tabela ainda não criada (falta o SQL do passo 2): nada trava e a tela avisa
                console.warn('Pagamentos de comissão indisponíveis (rode sql/2026-11-11-equipe-cpf-pagamento):', error.message || error);
                setSemTabela(true);
                setLista([]);
                return;
            }
            setSemTabela(false);
            setLista(data || []);
        })();
        return () => { vivo = false; };
    }, [mesInicio, mesFim, ativo, versao]);

    const aprovar = useCallback(async (unidade, mes) => {
        const { data, error } = await supabase.rpc('comissao_aprovar_pagamento', { p_unidade: unidade, p_mes: mes });
        if (error) return { error };
        recarregar();
        return { data };
    }, [recarregar]);

    const reabrir = useCallback(async (id, motivo) => {
        const { data, error } = await supabase.rpc('comissao_reabrir_pagamento', { p_id: id, p_motivo: motivo });
        if (error) return { error };
        recarregar();
        return { data };
    }, [recarregar]);

    return { lista, ativos: lista.filter(p => p.ativo !== false), semTabela, aprovar, reabrir, recarregar };
};
