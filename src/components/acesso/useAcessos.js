// Painel de acessos para Admin e Mentor (pedidos, sem acesso, unidades sem líder...). Lido ao entrar e quando
// alguém aprova/rejeita (recarregar). Sem o SQL de 12/11/2026: semSql = true e nada aparece.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { painelDeAcessos } from './acessoBanco.js';
import { montarPainelAcessos } from './regrasAcesso.js';

export const useAcessos = ({ ativo, unidades = [] }) => {
    const [painel, setPainel] = useState(null);
    const [semSql, setSemSql] = useState(false);
    const [carregando, setCarregando] = useState(false);
    const [versao, setVersao] = useState(0);
    const recarregar = useCallback(() => setVersao(v => v + 1), []);

    useEffect(() => {
        if (!ativo) { setPainel(null); return undefined; }
        let vivo = true;
        setCarregando(true);
        painelDeAcessos().then(p => {
            if (!vivo) return;
            setSemSql(p === null);
            setPainel(p);
            setCarregando(false);
        });
        return () => { vivo = false; };
    }, [ativo, versao]);

    const contas = useMemo(() => (painel ? montarPainelAcessos({ painel, unidades }) : null), [painel, unidades]);
    return { painel, contas, carregando, recarregar, semSql };
};
