import React, { useEffect, useState } from 'react';
import { avisar } from '../../../components/avisar.js';
import { tx } from '../../../i18n/traduzir.js';
import { podeVer } from '../../../permissoes/catalogoPermissoes.js';
import { unidadePermitida } from '../../../components/centralUnidade.js';
import { EVENTO_CENTRAL_COLABORADOR, CODIGO_PERMISSAO_CENTRAL_COLABORADOR } from '../../../components/centralColaborador.js';
import FichaColaborador from './FichaColaborador.jsx';

// ==========================================
// CENTRAL DO COLABORADOR ABERTA DE QUALQUER TELA (montada uma vez no App; 11/11/2026, decisão do dono)
// Quem abre (permissão 809): Admin todas as unidades; Mentor só as dele; Líder só a própria. A Recepção NUNCA
// abre (decisão do dono: a Central mostra comissão). O banco também garante: cada leitura volta só com as
// unidades da pessoa.
// ==========================================

const CentralColaboradorGlobal = ({ usuario, unidadesPermitidas = null, planos = [], produtos = [] }) => {
    const [aberta, setAberta] = useState(null); // { colaborador, onEditar }
    const papel = String(usuario?.roleReal || usuario?.role || '').toUpperCase();
    const ehAdmin = papel === 'ADMIN';

    useEffect(() => {
        const aoPedir = (e) => {
            const colaborador = e.detail?.colaborador;
            if (!colaborador?.nome) return;
            if (papel === 'RECEPCAO' || !podeVer(usuario, CODIGO_PERMISSAO_CENTRAL_COLABORADOR)) { avisar(tx('Você não tem acesso à Central do Colaborador.'), 'atencao'); return; }
            if (!ehAdmin && !unidadePermitida({ papel, nome: colaborador.unidade, unidadesPermitidas })) {
                avisar(tx('{nome} não é de uma das suas unidades.', { nome: colaborador.nome }), 'atencao');
                return;
            }
            setAberta({ colaborador, onEditar: typeof e.detail?.onEditar === 'function' ? e.detail.onEditar : null });
        };
        window.addEventListener(EVENTO_CENTRAL_COLABORADOR, aoPedir);
        return () => window.removeEventListener(EVENTO_CENTRAL_COLABORADOR, aoPedir);
    }, [usuario, papel, ehAdmin, unidadesPermitidas]);

    if (!aberta) return null;
    return (
        <FichaColaborador
            key={`${aberta.colaborador.id ?? 'nome'}|${aberta.colaborador.nome}`}
            colaborador={aberta.colaborador}
            planos={planos}
            produtos={produtos}
            ehAdmin={ehAdmin}
            onEditar={aberta.onEditar ? (c) => { setAberta(null); aberta.onEditar(c); } : null}
            onFechar={() => setAberta(null)}
        />
    );
};

export default CentralColaboradorGlobal;
