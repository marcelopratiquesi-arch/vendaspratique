import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import { Database, Users, LayoutGrid, Layers, UserCircle } from 'lucide-react';

import TabEquipe from './TabEquipe.jsx';
import ModalColaborador from './ModalColaborador.jsx';
import TabCatalogo from './TabCatalogo.jsx';
import ModalCatalogo from './ModalCatalogo.jsx';
import TabSetores from './TabSetores.jsx';
import ModalSetor from './ModalSetor.jsx';
import AlunosTab from './AlunosTab.jsx'; // 🔥 NOVO: Aba de Alunos importada
import { useI18n } from '../../i18n/I18nContext.jsx';

const CadastroGeral = ({ usuarioLogado, unidades = [], planos, setPlanos, produtos, setProdutos, servicos, setServicos, colaboradores, setColaboradores }) => {
    const { t } = useI18n(); // Pegar traduções
    const [abaAtiva, setAbaAtiva] = useState('alunos'); // Começa na aba de alunos por padrão
    const [listaSetores, setListaSetores] = useState([]);
    
    const [modalColabAberto, setModalColabAberto] = useState(false);
    const [colabEditando, setColabEditando] = useState(null);
    
    const [modalCatAberto, setModalCatAberto] = useState(false);
    const [catEditando, setCatEditando] = useState(null);

    const [modalSetorAberto, setModalSetorAberto] = useState(false);
    const [setorEditando, setSetorEditando] = useState(null);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';
    const podeEditarEquipe = temVisaoGlobal || usuarioLogado?.role === 'LIDER';
    const ehAdmin = usuarioLogado?.role === 'ADMIN';

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
            const unidadeFinal = temVisaoGlobal ? payload.unidade : usuarioLogado?.unidade;
            const finalPayload = { ...payload, unidade: unidadeFinal };

            if (payload.id) {
                const { data, error } = await supabase.from('colaboradores').update(finalPayload).eq('id', payload.id).select();
                if (error) throw error;
                if (data) setColaboradores(colaboradores.map(c => c.id === payload.id ? data[0] : c));
            } else {
                delete finalPayload.id;
                // Força o status ativo na criação
                finalPayload.ativo = true;
                const { data, error } = await supabase.from('colaboradores').insert([finalPayload]).select();
                if (error) throw error;
                if (data) setColaboradores([...colaboradores, data[0]]);
            }
            setModalColabAberto(false);
        } catch (error) {
            alert(`Erro ao salvar: ${error.message}`);
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

        if (!window.confirm(`Atenção! ${msg}`)) return;

        setIsSubmitting(true);
        try {
            const { data, error } = await supabase.from('colaboradores').update({ ativo: novoStatus }).eq('id', colab.id).select();
            if (error) throw error;
            if (data) setColaboradores(colaboradores.map(c => c.id === colab.id ? data[0] : c));
        } catch (error) {
            alert(`Erro ao atualizar status: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- CRUD: CATÁLOGO (AGORA COM SOFT DELETE / DESCONTINUAÇÃO) ---
    const handleSaveCatalogo = async (payload) => {
        setIsSubmitting(true);
        try {
            const jaExiste = catalogoCompleto.find(item => item.nome === payload.nome && item.tipo === payload.tipo && item.id !== payload.id);
            if (jaExiste) {
                alert(`Atenção: O item "${payload.nome}" já está cadastrado nesta categoria!`);
                setIsSubmitting(false);
                return;
            }

            if (payload.id) {
                const { data, error } = await supabase.from('catalogo').update(payload).eq('id', payload.id).select();
                if (error) throw error;
                if (data) atualizaArrayLocal(payload.tipo, data[0], 'UPDATE');
            } else {
                delete payload.id;
                // Força o status ativo na criação do catálogo
                payload.ativo = true;
                const { data, error } = await supabase.from('catalogo').insert([payload]).select();
                if (error) throw error;
                if (data) atualizaArrayLocal(payload.tipo, data[0], 'INSERT');
            }
            setModalCatAberto(false);
        } catch (error) {
            alert(`Erro ao salvar no catálogo: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // 🔥 NOVA FUNÇÃO: Inativação Lógica do Catálogo (Soft Delete)
    const handleToggleStatusCatalogo = async (item) => {
        const statusAtual = item.ativo !== false; 
        const novoStatus = !statusAtual;
        
        const msg = novoStatus 
            ? `Deseja REATIVAR a oferta "${item.nome}"? Ela voltará a aparecer para vendas.` 
            : `Deseja DESCONTINUAR a oferta "${item.nome}"? Ela sairá da tela de vendas, mas o histórico financeiro continuará preservado.`;

        if (!window.confirm(`Atenção! ${msg}`)) return;

        setIsSubmitting(true);
        try {
            const { data, error } = await supabase.from('catalogo').update({ ativo: novoStatus }).eq('id', item.id).select();
            if (error) throw error;
            if (data) atualizaArrayLocal(item.tipo, data[0], 'UPDATE');
        } catch (error) {
            alert(`Erro ao atualizar status: ${error.message}`);
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
                alert(`Atenção: O setor "${payload.nome}" já existe!`);
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
            alert(`Erro ao salvar setor: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteSetor = async (id, nome) => {
        if (!window.confirm(`Atenção! Tem certeza que deseja apagar o setor: ${nome}?`)) return;
        try {
            const { error } = await supabase.from('setores').delete().eq('id', id);
            if (error) throw error;
            setListaSetores(listaSetores.filter(s => s.id !== id));
        } catch (error) {
            alert(`Erro ao excluir setor: ${error.message}`);
        }
    };

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] max-w-[1400px] mx-auto relative pb-10">
            <ModalColaborador isOpen={modalColabAberto} onClose={() => setModalColabAberto(false)} onSave={handleSaveColaborador} isSubmitting={isSubmitting} dadosEdicao={colabEditando} listaSetores={listaSetores} unidades={unidades} temVisaoGlobal={temVisaoGlobal} />
            <ModalCatalogo isOpen={modalCatAberto} onClose={() => setModalCatAberto(false)} onSave={handleSaveCatalogo} isSubmitting={isSubmitting} dadosEdicao={catEditando} />
            <ModalSetor isOpen={modalSetorAberto} onClose={() => setModalSetorAberto(false)} onSave={handleSaveSetor} isSubmitting={isSubmitting} dadosEdicao={setorEditando} />

            <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 p-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner border border-blue-100 flex-shrink-0">
                        <Database className="w-7 h-7" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Gestão de Cadastros</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configuração Modular do Sistema</p>
                    </div>
                </div>

                <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full xl:w-auto overflow-x-auto custom-scrollbar">
                    <button onClick={() => setAbaAtiva('alunos')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${abaAtiva === 'alunos' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        <UserCircle className="w-4 h-4" /> {t('management.tabs.students', {defaultValue: 'Alunos'})}
                    </button>
                    <button onClick={() => setAbaAtiva('equipe')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${abaAtiva === 'equipe' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        <Users className="w-4 h-4" /> Equipe
                    </button>
                    <button onClick={() => setAbaAtiva('catalogo')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${abaAtiva === 'catalogo' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        <Layers className="w-4 h-4" /> Catálogo Geral
                    </button>
                    <button onClick={() => setAbaAtiva('setores')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${abaAtiva === 'setores' ? 'bg-white shadow-sm text-blue-700 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        <LayoutGrid className="w-4 h-4" /> Setores
                    </button>
                </div>
            </div>

            <div className="w-full">
                {abaAtiva === 'alunos' && (
                    <AlunosTab />
                )}

                {abaAtiva === 'equipe' && (
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

                {abaAtiva === 'catalogo' && (
                    <TabCatalogo 
                        catalogoCompleto={catalogoCompleto} ehAdmin={ehAdmin}
                        onEdit={(item) => { setCatEditando(item); setModalCatAberto(true); }}
                        onToggleStatus={handleToggleStatusCatalogo} 
                        onOpenModal={() => { setCatEditando(null); setModalCatAberto(true); }}
                    />
                )}

                {abaAtiva === 'setores' && (
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