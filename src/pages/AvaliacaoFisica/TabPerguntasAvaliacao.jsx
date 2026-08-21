import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import { Plus, Trash2, Save, ArrowUp, ArrowDown, Type, ListChecks, CheckSquare, AlignLeft, Loader2, X, Eye } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext.jsx';

const TabPerguntasAvaliacao = ({ usuarioLogado }) => {
    const { t } = useI18n();
    const [perguntas, setPerguntas] = useState([]);
    const [perguntasRemovidas, setPerguntasRemovidas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Estados para o Modo de Visualização (Preview)
    const [showPreview, setShowPreview] = useState(false);
    const [previewRespostas, setPreviewRespostas] = useState({});
    const [previewOutros, setPreviewOutros] = useState({}); // 🔥 Guarda o texto digitado na opção "Outro"

    const ehAdmin = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';

    useEffect(() => {
        carregarPerguntas();
    }, []);

    const carregarPerguntas = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('avaliacao_perguntas')
                .select('*')
                .eq('ativo', true)
                .order('ordem', { ascending: true });
            
            if (error) throw error;
            setPerguntas(data || []);
        } catch (error) {
            console.error(error);
            alert("Erro ao carregar perguntas.");
        } finally {
            setLoading(false);
        }
    };

    const adicionarPergunta = () => {
        const nova = {
            id: `temp-${Date.now()}`, 
            pergunta: '',
            tipo: 'TEXTO_CURTO',
            opcoes: [],
            obrigatorio: false,
            ordem: perguntas.length
        };
        setPerguntas([...perguntas, nova]);
    };

    const removerPergunta = (index, id) => {
        if (!String(id).startsWith('temp-')) {
            setPerguntasRemovidas([...perguntasRemovidas, id]);
        }
        const novaLista = [...perguntas];
        novaLista.splice(index, 1);
        setPerguntas(novaLista);
    };

    const moverPergunta = (index, direcao) => {
        if (direcao === 'UP' && index === 0) return;
        if (direcao === 'DOWN' && index === perguntas.length - 1) return;

        const novaLista = [...perguntas];
        const novaPosicao = direcao === 'UP' ? index - 1 : index + 1;
        
        const temp = novaLista[index];
        novaLista[index] = novaLista[novaPosicao];
        novaLista[novaPosicao] = temp;
        
        setPerguntas(novaLista);
    };

    const atualizarPergunta = (index, campo, valor) => {
        const novaLista = [...perguntas];
        novaLista[index][campo] = valor;
        setPerguntas(novaLista);
    };

    const adicionarOpcao = (index) => {
        const novaLista = [...perguntas];
        novaLista[index].opcoes.push('');
        setPerguntas(novaLista);
    };

    const atualizarOpcao = (perguntaIndex, opcaoIndex, valor) => {
        const novaLista = [...perguntas];
        novaLista[perguntaIndex].opcoes[opcaoIndex] = valor;
        setPerguntas(novaLista);
    };

    const removerOpcao = (perguntaIndex, opcaoIndex) => {
        const novaLista = [...perguntas];
        novaLista[perguntaIndex].opcoes.splice(opcaoIndex, 1);
        setPerguntas(novaLista);
    };

    const salvarTudo = async () => {
        setSaving(true);
        try {
            if (perguntasRemovidas.length > 0) {
                await supabase.from('avaliacao_perguntas').update({ ativo: false }).in('id', perguntasRemovidas);
            }

            const payload = perguntas.map((p, i) => {
                const item = {
                    pergunta: p.pergunta,
                    tipo: p.tipo,
                    opcoes: p.opcoes,
                    obrigatorio: p.obrigatorio,
                    ordem: i 
                };
                if (!String(p.id).startsWith('temp-')) item.id = p.id; 
                return item;
            });

            if (payload.length > 0) {
                const { error } = await supabase.from('avaliacao_perguntas').upsert(payload);
                if (error) throw error;
            }

            alert(t('students.paste.success', {defaultValue: 'Formulário atualizado com sucesso!'}));
            setPerguntasRemovidas([]);
            carregarPerguntas(); 

        } catch (error) {
            console.error(error);
            alert("Erro ao salvar o formulário.");
        } finally {
            setSaving(false);
        }
    };

    const handleRespostaPreview = (perguntaId, valor, tipo) => {
        setPreviewRespostas(prev => {
            if (tipo === 'CHECKBOX') {
                const atual = prev[perguntaId] || [];
                if (atual.includes(valor)) {
                    return { ...prev, [perguntaId]: atual.filter(v => v !== valor) };
                } else {
                    return { ...prev, [perguntaId]: [...atual, valor] };
                }
            } else {
                return { ...prev, [perguntaId]: valor };
            }
        });
    };

    if (!ehAdmin) {
        return (
            <div className="bg-rose-50 border border-rose-200 p-8 rounded-[24px] text-center max-w-2xl mx-auto mt-10">
                <h3 className="text-xl font-black text-rose-800 uppercase tracking-tight mb-2">Acesso Restrito</h3>
                <p className="text-sm font-bold text-rose-600">Apenas Administradores podem editar a estrutura do Formulário de Avaliação.</p>
            </div>
        );
    }

    if (loading) {
        return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>;
    }

    const labelClass = "block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1";
    const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm placeholder:text-slate-300";

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] max-w-5xl mx-auto pb-10">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200 p-6 rounded-[24px] shadow-sm sticky top-4 z-50">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-inner">
                        <ListChecks className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Perguntas da Anamnese</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Defina a estrutura dinâmica do formulário</p>
                    </div>
                </div>
                <div className="flex flex-wrap md:flex-nowrap w-full md:w-auto gap-3">
                    <button onClick={adicionarPergunta} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors border border-slate-200 shadow-sm">
                        <Plus className="w-4 h-4" /> Nova Pergunta
                    </button>
                    <button onClick={() => { setPreviewRespostas({}); setPreviewOutros({}); setShowPreview(true); }} disabled={perguntas.length === 0} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 disabled:opacity-50 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors shadow-sm">
                        <Eye className="w-4 h-4" /> Visualizar
                    </button>
                    <button onClick={salvarTudo} disabled={saving} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors shadow-[0_4px_15px_rgba(249,115,22,0.3)]">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar Final
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {perguntas.length === 0 ? (
                    <div className="bg-white border border-slate-200 p-10 rounded-[24px] text-center shadow-sm">
                        <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">O formulário está vazio. Clique em "Nova Pergunta" para começar.</p>
                    </div>
                ) : (
                    perguntas.map((p, index) => (
                        <div key={p.id} className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm flex flex-col gap-4 relative group">
                            
                            <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-4 border-b border-slate-100 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
                                        <button onClick={() => moverPergunta(index, 'UP')} disabled={index === 0} className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30 transition-colors"><ArrowUp className="w-3 h-3" /></button>
                                        <button onClick={() => moverPergunta(index, 'DOWN')} disabled={index === perguntas.length - 1} className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30 transition-colors"><ArrowDown className="w-3 h-3" /></button>
                                    </div>
                                    <select 
                                        value={p.tipo} 
                                        onChange={(e) => atualizarPergunta(index, 'tipo', e.target.value)}
                                        className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-black uppercase tracking-widest px-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="TEXTO_CURTO">Texto Curto</option>
                                        <option value="TEXTO_LONGO">Texto Longo</option>
                                        <option value="SELECT">Múltipla Escolha (Lista)</option>
                                        <option value="CHECKBOX">Caixas de Seleção</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={p.obrigatorio} onChange={(e) => atualizarPergunta(index, 'obrigatorio', e.target.checked)} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500" />
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Obrigatório</span>
                                    </label>
                                    <button onClick={() => removerPergunta(index, p.id)} className="p-2.5 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-xl transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div>
                                <input 
                                    type="text" 
                                    value={p.pergunta} 
                                    onChange={(e) => atualizarPergunta(index, 'pergunta', e.target.value)}
                                    placeholder="Digite sua pergunta aqui..."
                                    className="w-full text-lg font-black text-slate-800 placeholder:text-slate-300 outline-none border-b border-transparent focus:border-blue-500 transition-colors py-2 bg-transparent"
                                />
                            </div>

                            {(p.tipo === 'SELECT' || p.tipo === 'CHECKBOX') && (
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3 mt-2">
                                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        {p.tipo === 'SELECT' ? <ListChecks className="w-3 h-3"/> : <CheckSquare className="w-3 h-3"/>} 
                                        Opções de Resposta
                                    </h4>
                                    {p.opcoes.map((opcao, optIndex) => (
                                        <div key={optIndex} className="flex items-center gap-3">
                                            <div className={`w-4 h-4 shrink-0 border-2 border-slate-300 ${p.tipo === 'SELECT' ? 'rounded-full' : 'rounded'}`}></div>
                                            <input 
                                                type="text" 
                                                value={opcao} 
                                                onChange={(e) => atualizarOpcao(index, optIndex, e.target.value)}
                                                placeholder={`Opção ${optIndex + 1}`}
                                                className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
                                            />
                                            <button onClick={() => removerOpcao(index, optIndex)} className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"><X className="w-4 h-4"/></button>
                                        </div>
                                    ))}
                                    <button onClick={() => adicionarOpcao(index)} className="flex items-center gap-2 text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest mt-2 ml-1">
                                        <Plus className="w-3 h-3" /> Adicionar Opção
                                    </button>
                                </div>
                            )}

                            {(p.tipo === 'TEXTO_CURTO' || p.tipo === 'TEXTO_LONGO') && (
                                <div className="mt-2 ml-1 flex items-center gap-2 opacity-50 pointer-events-none">
                                    {p.tipo === 'TEXTO_CURTO' ? <Type className="w-4 h-4 text-slate-400" /> : <AlignLeft className="w-4 h-4 text-slate-400" />}
                                    <div className="flex-1 border-b border-dashed border-slate-300 pb-1 text-xs font-bold text-slate-400">Texto de resposta do aluno</div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* PREVIEW INTERATIVO */}
            {showPreview && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-slate-100 rounded-[32px] shadow-2xl w-full max-w-4xl flex flex-col h-full max-h-[85vh] overflow-hidden border border-slate-200">
                        
                        <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-center shrink-0 shadow-sm z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><Eye className="w-5 h-5" /></div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Modo de Visualização</h3>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">É assim que o professor verá a Anamnese</p>
                                </div>
                            </div>
                            <button onClick={() => setShowPreview(false)} className="p-2 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                            <div className="bg-white p-8 rounded-[24px] border border-slate-200 shadow-sm space-y-6 max-w-3xl mx-auto">
                                <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-4">
                                    <ListChecks className="w-5 h-5 text-indigo-500" />
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Questionário de Anamnese</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {perguntas.map((p) => (
                                        <div key={p.id} className={p.tipo === 'TEXTO_LONGO' || p.tipo === 'CHECKBOX' ? 'md:col-span-2' : 'col-span-1'}>
                                            <label className={labelClass}>
                                                {p.pergunta || 'Pergunta sem título'} {p.obrigatorio && <span className="text-rose-500">*</span>}
                                            </label>
                                            
                                            {p.tipo === 'TEXTO_CURTO' && (
                                                <input 
                                                    type="text" 
                                                    className={inputClass} 
                                                    placeholder="Sua resposta"
                                                    value={previewRespostas[p.id] || ''} 
                                                    onChange={(e) => handleRespostaPreview(p.id, e.target.value, p.tipo)} 
                                                />
                                            )}

                                            {p.tipo === 'TEXTO_LONGO' && (
                                                <textarea 
                                                    className={`${inputClass} resize-none`} 
                                                    rows="3" 
                                                    placeholder="Sua resposta detalhada"
                                                    value={previewRespostas[p.id] || ''} 
                                                    onChange={(e) => handleRespostaPreview(p.id, e.target.value, p.tipo)} 
                                                />
                                            )}

                                            {/* 🔥 MAGIA DO "OUTRO" NO SELECT */}
                                            {p.tipo === 'SELECT' && (
                                                <div className="flex flex-col gap-2 mt-2">
                                                    <select 
                                                        className={inputClass} 
                                                        value={previewRespostas[p.id] || ''} 
                                                        onChange={(e) => handleRespostaPreview(p.id, e.target.value, p.tipo)}
                                                    >
                                                        <option value="">Selecione...</option>
                                                        {p.opcoes.map(o => <option key={o} value={o}>{o || 'Opção Vazia'}</option>)}
                                                    </select>
                                                    {(previewRespostas[p.id] || '').toLowerCase().trim().startsWith('outro') && (
                                                        <input 
                                                            type="text"
                                                            placeholder="Especifique..."
                                                            className={`${inputClass} !py-2 animate-[fadeIn_0.2s_ease-out]`}
                                                            value={previewOutros[p.id] || ''}
                                                            onChange={(e) => setPreviewOutros({...previewOutros, [p.id]: e.target.value})}
                                                        />
                                                    )}
                                                </div>
                                            )}

                                            {/* 🔥 MAGIA DO "OUTRO" NO CHECKBOX */}
                                            {p.tipo === 'CHECKBOX' && (
                                                <div className="flex flex-col gap-2 mt-2">
                                                    {p.opcoes.map(o => {
                                                        const isOutro = o.toLowerCase().trim().startsWith('outro');
                                                        const isChecked = (previewRespostas[p.id] || []).includes(o);
                                                        return (
                                                            <div key={o} className="flex flex-col sm:flex-row sm:items-center gap-2">
                                                                <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl hover:bg-slate-100 transition-colors w-fit">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" 
                                                                        checked={isChecked}
                                                                        onChange={() => handleRespostaPreview(p.id, o, p.tipo)}
                                                                    />
                                                                    <span className="text-xs font-bold text-slate-700">{o || 'Opção Vazia'}</span>
                                                                </label>
                                                                {isOutro && isChecked && (
                                                                    <input 
                                                                        type="text"
                                                                        placeholder="Especifique..."
                                                                        className={`${inputClass} !py-2 flex-1 min-w-[200px] animate-[fadeIn_0.2s_ease-out]`}
                                                                        value={previewOutros[p.id] || ''}
                                                                        onChange={(e) => setPreviewOutros({...previewOutros, [p.id]: e.target.value})}
                                                                    />
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TabPerguntasAvaliacao;