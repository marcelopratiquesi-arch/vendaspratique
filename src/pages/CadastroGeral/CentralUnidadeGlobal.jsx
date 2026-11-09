import React, { useEffect, useMemo, useState } from 'react';
import { avisar } from '../../components/avisar.js';
import { tx } from '../../i18n/traduzir.js';
import { podeVer } from '../../permissoes/catalogoPermissoes.js';
import { EVENTO_CENTRAL_UNIDADE, CODIGO_PERMISSAO_CENTRAL, unidadePermitida } from '../../components/centralUnidade.js';
import { normalizarUnidade } from '../Configuracoes/conferenciaLogins.js';
import { useDadosUnidades } from './dadosUnidades.js';
import FichaUnidade from './FichaUnidade.jsx';

// ==========================================
// CENTRAL DA UNIDADE ABERTA DE QUALQUER TELA (montada uma vez no App; 09/11/2026, decisão do dono)
// - Admin: Central completa (a mesma de Cadastros → Unidades), qualquer unidade.
// - Mentor: só as unidades dele · Líder: só a própria. Os dois veem só Panorama e Equipe (modo leitura).
// O banco também garante: cada leitura já volta só com as unidades da pessoa.
// ==========================================

const CentralUnidadeGlobal = ({ usuario, unidades = [], unidadesPermitidas = null, setUnidades, planos = [], produtos = [], pendencias = [], pendenciasCarregadas = true, abrirTela }) => {
    const [aberta, setAberta] = useState(null); // { nome, aba }
    const papel = String(usuario?.roleReal || usuario?.role || '').toUpperCase();
    const ehAdmin = papel === 'ADMIN';

    useEffect(() => {
        const aoPedir = (e) => {
            const nome = e.detail?.nome;
            if (!nome) return;
            if (!podeVer(usuario, CODIGO_PERMISSAO_CENTRAL)) { avisar(tx('Você não tem acesso à Central da Unidade.'), 'atencao'); return; }
            const permitida = unidadePermitida({ papel, nome, unidadesPermitidas });
            if (!permitida) { avisar(tx('A unidade {nome} não está entre as suas unidades.', { nome }), 'atencao'); return; }
            setAberta({ nome, aba: e.detail?.aba || 'panorama' });
        };
        window.addEventListener(EVENTO_CENTRAL_UNIDADE, aoPedir);
        return () => window.removeEventListener(EVENTO_CENTRAL_UNIDADE, aoPedir);
    }, [usuario, papel, unidadesPermitidas]);

    // A unidade aberta (com a linha de cadastro; se não estiver na lista, monta uma só com o nome)
    const unidadeAberta = useMemo(() => {
        if (!aberta) return null;
        return unidades.find(u => normalizarUnidade(u.nome) === normalizarUnidade(aberta.nome)) || { id: `nome:${aberta.nome}`, nome: aberta.nome };
    }, [aberta, unidades]);

    const dados = useDadosUnidades({
        ativo: !!aberta, completo: ehAdmin, unidades: unidadeAberta ? [unidadeAberta] : [], setUnidades: (lista) => {
            // Ações do Admin (desativar/excluir) atualizam a lista inteira do App
            if (!setUnidades || !unidadeAberta) return;
            const nova = lista.find(u => u.id === unidadeAberta.id);
            if (!nova) setUnidades(unidades.filter(u => u.id !== unidadeAberta.id));
            else setUnidades(unidades.map(u => (u.id === nova.id ? nova : u)));
        },
        nomeUsuario: usuario?.nome, aoExcluir: () => setAberta(null),
    });

    if (!aberta || !unidadeAberta) return null;
    const linha = dados.linhas[0] || null;
    const recepcionistasDaUnidade = dados.colaboradores; // a Central filtra pela unidade

    return (
        <FichaUnidade
            key={`${unidadeAberta.nome}|${aberta.aba}`}
            unidade={unidadeAberta}
            usuarios={dados.usuarios}
            colaboradores={recepcionistasDaUnidade}
            vinculos={dados.vinculos}
            prontidao={linha?.prontidao}
            semPersonal={!!linha?.semPersonal}
            onSalvarMentores={(emails) => dados.acoes.salvarMentores(unidadeAberta, emails)}
            onMarcarPersonal={(valor) => dados.acoes.marcarPersonal(unidadeAberta, valor)}
            onAtivar={dados.acoes.ativar}
            onExcluir={dados.acoes.excluir}
            onFechar={() => setAberta(null)}
            planos={planos}
            produtos={produtos}
            pendencia={pendenciasCarregadas ? (pendencias.find(p => normalizarUnidade(p.unidade) === normalizarUnidade(unidadeAberta.nome)) || null) : undefined}
            abrirTela={abrirTela ? (nome, tela, opcoes) => { setAberta(null); abrirTela(nome, tela, opcoes); } : null}
            modo={ehAdmin ? 'completo' : 'leitura'}
            abaInicial={aberta.aba}
            rotuloVoltar={tx('Fechar')}
        />
    );
};

export default CentralUnidadeGlobal;
