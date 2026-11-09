import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import { Database, Users, LayoutGrid, Layers, UserCircle, Building } from 'lucide-react';

import TabEquipe from './TabEquipe.jsx';
import ModalColaborador from './ModalColaborador.jsx';
import TabCatalogo from './TabCatalogo.jsx';
import ModalCatalogo from './ModalCatalogo.jsx';
import TabSetores from './TabSetores.jsx';
import ModalSetor from './ModalSetor.jsx';
import AlunosTab from './AlunosTab.jsx';
import TabUnidades from './TabUnidades.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { avisar } from '../../components/avisar.js';
import { tx } from '../../i18n/traduzir.js';
import { podeVer, podeFazer } from '../../permissoes/catalogoPermissoes.js';

// 🔥 CORREÇÃO: Adicionado 'usuarioVirtual' à assinatura de props para espelhar a unidade da TopBar
// todasUnidades/setUnidades (09/11/2026): a aba Unidades mostra também as desativadas (o "unidades" daqui são só as visíveis)
const CadastroGeral = ({ usuarioLogado, usuarioVirtual, unidades = [], todasUnidades, setUnidades, planos, setPlanos, produtos, setProdutos, servicos, setServicos, colaboradores, setColaboradores }) => {
    const { t } = useI18n(); 
    const [abaAtiva, setAbaAtiva] = useState('alunos'); 
    const [listaSetores, setListaSetores] = useState([]);
    
    const [modalColabAberto, setModalColabAberto] = useState(false);
    const [colabEditando, setColabEditando] = useState(null);
    
    const [modalCatAberto, setModalCatAberto] = useState(false);
    const [catEditando, setCatEditando] = useState(null);

    const [modalSetorAberto, setModalSetorAberto] = useState(false);
    const [setorEditando, setSetorEditando] = useState(null);

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Contexto de Permissão Global
    const roleBaseApp = usuarioVirtual?.role || usuarioLogado?.role || '';
    const temVisaoGlobal = roleBaseApp === 'ADMIN' || roleBaseApp === 'MENTOR';
    // Editar a equipe: permissão 807 (padrão: Admin, Mentor e Líder; o banco confere, só nas unidades da pessoa)
    const podeEditarEquipe = podeFazer(usuarioVirtual || usuarioLogado, '807');
    // Catálogo e setores: Admin de verdade, mesmo com uma unidade escolhida no topo (corrigido em 06/11/2026;
    // antes o Admin virava "Líder" ao escolher a unidade e perdia o botão de alterar)
    const ehAdmin = (usuarioLogado?.roleReal || roleBaseApp) === 'ADMIN';

    // Abas pelas permissões (Configurações → Permissões, 06/11/2026; padrão = como era)
    const abaLiberada = {
        alunos: podeVer(usuarioLogado, '801'),
        equipe: podeVer(usuarioLogado, '802'),
        catalogo: podeVer(usuarioLogado, '803'),
        setores: podeVer(usuarioLogado, '804'),
        // Unidades (09/11/2026, veio de Configurações): só o Admin de verdade, mesmo com uma unidade no topo
        unidades: ehAdmin && podeVer(usuarioLogado, '808') && typeof setUnidades === 'function',
    };
    const ABAS = [
        ['alunos', t('management.tabs.students', { defaultValue: 'Alunos' }), UserCircle],
        ['equipe', tx("Equipe"), Users],
        ['catalogo', tx("Catálogo Geral"), Layers],
        ['setores', tx("Setores"), LayoutGrid],
        ['unidades', tx("Unidades"), Building],
    ];
    const abaMostrada = abaLiberada[abaAtiva] ? abaAtiva : (Object.keys(abaLiberada).find(id => abaLiberada[id]) || null);

    const catalogoCompleto = [...(planos || []), ...(produtos || []), ...(servicos || [])];

    useEffect(() => {
        const fetchSetores = async () => {
            const { data } = await supabase.from('setores').select('*');
            if (data) setListaSetores(data);
        };
        fetchSetores();
    }, []);

    // --- CRUD: EQUIPE (COM SOFT DELETE / INATIVAÇÃO) ---
    const handleSaveColaborador = async (payload) => {
        setIsSubmitting(true);
        try {
            const unidadeFinal = temVisaoGlobal ? payload.unidade : (usuarioVirtual?.unidade || usuarioLogado?.unidade);
            const finalPayload = { ...payload, unidade: unidadeFinal };
            // Sem o campo "turno" no banco (falta rodar sql/2026-11-05-relatorio-fechamento), grava o resto e avisa
            const semTurno = (error) => /turno/i.test(error?.message || '');
            const avisarSemTurno = () => { console.warn('Equipe: campo turno não existe no banco — rode sql/2026-11-05-relatorio-fechamento/1_envios_e_turno.sql'); if (payload.turno) avisar(tx('O turno não foi gravado: falta criar o campo no banco (SQL do relatório de fechamento).'), 'atencao'); };

            if (payload.id) {
                let { data, error } = await supabase.from('colaboradores').update(finalPayload).eq('id', payload.id).select();
                if (error && semTurno(error)) { delete finalPayload.turno; avisarSemTurno(); ({ data, error } = await supabase.from('colaboradores').update(finalPayload).eq('id', payload.id).select()); }
                if (error) throw error;
                if (data) setColaboradores(colaboradores.map(c => c.id === payload.id ? data[0] : c));
            } else {
                delete finalPayload.id;
                finalPayload.ativo = true;
                let { data, error } = await supabase.from('colaboradores').insert([finalPayload]).select();
                if (error && semTurno(error)) { delete finalPayload.turno; avisarSemTurno(); ({ data, error } = await supabase.from('colaboradores').insert([finalPayload]).select()); }
                if (error) throw error;
                if (data) setColaboradores([...colaboradores, data[0]]);
            }
            setModalColabAberto(false);
        } catch (error) {
            avisar(tx("Erro ao salvar: {message}", { message: error.message }));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleStatusColaborador = async (colab) => {
        const statusAtual = colab.ativo !== false; 
        const novoStatus = !statusAtual;
        
        const msg = novoStatus 
            ? `Deseja REATIVAR o acesso de ${colab.nome}? Ele voltará a aparecer nas listas de vendas.` 
            : `Deseja DESLIGAR o colaborador ${colab.nome}? Ele não aparecerá mais para novas vendas, mas seu histórico financeiro será preservado.`;

        if (!window.confirm(tx("Atenção! {msg}", { msg: msg }))) return;

        setIsSubmitting(true);
        try {
            const { data, error } = await supabase.from('colaboradores').update({ ativo: novoStatus }).eq('id', colab.id).select();
            if (error) throw error;
            if (data) setColaboradores(colaboradores.map(c => c.id === colab.id ? data[0] : c));
        } catch (error) {
            avisar(tx("Erro ao atualizar status: {message}", { message: error.message }));
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- CRUD: CATÁLOGO ---
    const handleSaveCatalogo = async (payload) => {
        setIsSubmitting(true);
        try {
            const jaExiste = catalogoCompleto.find(item => item.nome === payload.nome && item.tipo === payload.tipo && item.id !== payload.id);
            if (jaExiste) {
                avisar(tx("Atenção: O item \"{nome}\" já está cadastrado nesta categoria!", { nome: payload.nome }));
                setIsSubmitting(false);
                return;
            }

            if (payload.id) {
                const { data, error } = await supabase.from('catalogo').update(payload).eq('id', payload.id).select();
                if (error) throw error;
                if (data) atualizaArrayLocal(payload.tipo, data[0], 'UPDATE');
            } else {
                delete payload.id;
                payload.ativo = true;
                const { data, error } = await supabase.from('catalogo').insert([payload]).select();
                if (error) throw error;
                if (data) atualizaArrayLocal(payload.tipo, data[0], 'INSERT');
            }
            setModalCatAberto(false);
        } catch (error) {
            avisar(tx("Erro ao salvar no catálogo: {message}", { message: error.message }));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleStatusCatalogo = async (item) => {
        const statusAtual = item.ativo !== false; 
        const novoStatus = !statusAtual;
        
        const msg = novoStatus 
            ? `Deseja REATIVAR a oferta "${item.nome}"? Ela voltará a aparecer para vendas.` 
            : `Deseja DESCONTINUAR a oferta "${item.nome}"? Ela sairá da tela de vendas, mas o histórico financeiro continuará preservado.`;

        if (!window.confirm(tx("Atenção! {msg}", { msg: msg }))) return;

        setIsSubmitting(true);
        try {
            const { data, error } = await supabase.from('catalogo').update({ ativo: novoStatus }).eq('id', item.id).select();
            if (error) throw error;
            if (data) atualizaArrayLocal(item.tipo, data[0], 'UPDATE');
        } catch (error) {
            avisar(tx("Erro ao atualizar status: {message}", { message: error.message }));
        } finally {
            setIsSubmitting(false);
        }
    };

    const atualizaArrayLocal = (tipo, item, operacao) => {
        const updater = (listaAtual) => {
            if (operacao === 'INSERT') return [...listaAtual, item];
            if (operacao === 'UPDATE') return listaAtual.map(i => i.id === item.id ? item : i);
            if (operacao === 'DELETE') return listaAtual.filter(i => i.id !== item.id);
        };
        if (tipo === 'plano') setPlanos(updater);
        else if (tipo === 'produto') setProdutos(updater);
        else if (tipo === 'servico') setServicos(updater);
    };

    // --- CRUD: SETORES ---
    const handleSaveSetor = async (payload) => {
        setIsSubmitting(true);
        try {
            const jaExiste = listaSetores.find(s => s.nome === payload.nome && s.id !== payload.id);
            if (jaExiste) {
                avisar(tx("Atenção: O setor \"{nome}\" já existe!", { nome: payload.nome }));
                setIsSubmitting(false);
                return;
            }

            if (payload.id) {
                const { data, error } = await supabase.from('setores').update(payload).eq('id', payload.id).select();
                if (error) throw error;
                if (data) setListaSetores(listaSetores.map(s => s.id === payload.id ? data[0] : s));
            } else {
                delete payload.id;
                const { data, error } = await supabase.from('setores').insert([payload]).select();
                if (error) throw error;
                if (data) setListaSetores([...listaSetores, data[0]]);
            }
            setModalSetorAberto(false);
        } catch (error) {
            avisar(tx("Erro ao salvar setor: {message}", { message: error.message }));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteSetor = async (id, nome) => {
        if (!window.confirm(tx("Atenção! Tem certeza que deseja apagar o setor: {nome}?", { nome: nome }))) return;
        try {
            const { error } = await supabase.from('setores').delete().eq('id', id);
            if (error) throw error;
            setListaSetores(listaSetores.filter(s => s.id !== id));
        } catch (error) {
            avisar(tx("Erro ao excluir setor: {message}", { message: error.message }));
        }
    };

    return (
        <div className="space-y-4 animate-[fadeIn_0.3s_ease-out] max-w-[1400px] mx-auto relative pb-10">
            <ModalColaborador isOpen={modalColabAberto} onClose={() => setModalColabAberto(false)} onSave={handleSaveColaborador} isSubmitting={isSubmitting} dadosEdicao={colabEditando} listaSetores={listaSetores} unidades={unidades} temVisaoGlobal={temVisaoGlobal} />
            <ModalCatalogo isOpen={modalCatAberto} onClose={() => setModalCatAberto(false)} onSave={handleSaveCatalogo} isSubmitting={isSubmitting} dadosEdicao={catEditando} />
            <ModalSetor isOpen={modalSetorAberto} onClose={() => setModalSetorAberto(false)} onSave={handleSaveSetor} isSubmitting={isSubmitting} dadosEdicao={setorEditando} />

            {/* Topo compacto (09/11/2026): título + abas pequenas; a aba Unidades veio de Configurações (só o Admin) */}
            <div className="bg-white rounded-[20px] border border-slate-200 p-4 flex flex-wrap items-center gap-x-5 gap-y-3 dark:bg-slate-900 dark:border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30"><Database className="w-4 h-4" /></span>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight dark:text-white">{tx("Gestão de Cadastros")}</h2>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1 max-w-full overflow-x-auto custom-scrollbar dark:bg-slate-800" role="tablist" aria-label={tx("Gestão de Cadastros")}>
                    {ABAS.filter(([id]) => abaLiberada[id]).map(([id, rotulo, Icone]) => (
                        <button key={id} type="button" role="tab" aria-selected={abaMostrada === id} onClick={() => setAbaAtiva(id)}
                            className={`h-8 px-3 rounded-lg text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${abaMostrada === id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}>
                            <Icone className="w-3.5 h-3.5" />{rotulo}
                        </button>
                    ))}
                </div>
            </div>

            <div className="w-full">
                {/* 🔥 CORREÇÃO SINTÁTICA CIRÚRGICA (Parse Error Resolvido) */}
                {abaMostrada === 'alunos' && (
                    <AlunosTab 
                        usuarioLogado={usuarioLogado} 
                        usuarioVirtual={usuarioVirtual}
                        unidades={unidades}
                    />
                )}

                {abaMostrada === 'equipe' && (
                    <TabEquipe 
                        colaboradores={colaboradores} 
                        temVisaoGlobal={temVisaoGlobal} 
                        unidades={unidades} 
                        podeEditarEquipe={podeEditarEquipe}
                        onEdit={(colab) => { setColabEditando(colab); setModalColabAberto(true); }}
                        onToggleStatus={handleToggleStatusColaborador}
                        onOpenModal={() => { setColabEditando(null); setModalColabAberto(true); }}
                    />
                )}

                {abaMostrada === 'catalogo' && (
                    <TabCatalogo 
                        catalogoCompleto={catalogoCompleto} ehAdmin={ehAdmin}
                        onEdit={(item) => { setCatEditando(item); setModalCatAberto(true); }}
                        onToggleStatus={handleToggleStatusCatalogo} 
                        onOpenModal={() => { setCatEditando(null); setModalCatAberto(true); }}
                    />
                )}

                {abaMostrada === 'unidades' && (
                    <TabUnidades unidades={todasUnidades || unidades} setUnidades={setUnidades} nomeUsuario={usuarioLogado?.nome} />
                )}

                {abaMostrada === 'setores' && (
                    <TabSetores 
                        listaSetores={listaSetores} ehAdmin={ehAdmin}
                        onEdit={(setor) => { setSetorEditando(setor); setModalSetorAberto(true); }}
                        onDelete={handleDeleteSetor}
                        onOpenModal={() => { setSetorEditando(null); setModalSetorAberto(true); }}
                    />
                )}
            </div>
        </div>
    );
};

export default CadastroGeral;