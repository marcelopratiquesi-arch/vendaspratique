// Painel de acessos para Admin e Mentor (pedidos, sem acesso, unidades sem líder, temporários...). Lido ao entrar e
// quando alguém aprova/rejeita/libera (recarregar). Sem o SQL de 12/11/2026: semSql = true e nada aparece.
// Temporários (13/11/2026): lidos junto; sem o SQL de 13/11/2026 a lista fica vazia (temporariosSemSql).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { painelDeAcessos, listarTemporarios } from './acessoBanco.js';
import { montarPainelAcessos } from './regrasAcesso.js';

export const useAcessos = ({ ativo, unidades = [] }) => {
    const [painel, setPainel] = useState(null);
    const [temporarios, setTemporarios] = useState(null);
    const [semSql, setSemSql] = useState(false);
    const [carregando, setCarregando] = useState(false);
    const [versao, setVersao] = useState(0);
    const recarregar = useCallback(() => setVersao(v => v + 1), []);

    useEffect(() => {
        if (!ativo) { setPainel(null); setTemporarios(null); return undefined; }
        let vivo = true;
        setCarregando(true);
        Promise.all([painelDeAcessos(), listarTemporarios()]).then(([p, t]) => {
            if (!vivo) return;
            setSemSql(p === null);
            setPainel(p);
            setTemporarios(t);
            setCarregando(false);
        });
        return () => { vivo = false; };
    }, [ativo, versao]);

    const contas = useMemo(() => (painel ? montarPainelAcessos({ painel, unidades, temporarios }) : null), [painel, unidades, temporarios]);
    return { painel, contas, carregando, recarregar, semSql };
};
