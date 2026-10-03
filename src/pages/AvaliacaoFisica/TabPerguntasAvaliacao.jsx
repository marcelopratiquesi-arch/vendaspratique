import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import { Plus, Trash2, Save, ArrowUp, ArrowDown, Type, ListChecks, CheckSquare, AlignLeft, Loader2, X, Eye, Check } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext.jsx';

const TabPerguntasAvaliacao = ({ usuarioLogado }) => {
    const { t } = useI18n();
    const [perguntas, setPerguntas] = useState([]);
    const [perguntasRemovidas, setPerguntasRemovidas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const [showToastNovaPergunta, setShowToastNovaPergunta] = useState(false);

    const [showPreview, setShowPreview] = useState(false);
    const [previewRespostas, setPreviewRespostas] = useState({});
    const [previewOutros, setPreviewOutros] = useState({}); 

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
        const idTemp = `temp-${Date.now()}`;
        const nova = {
            id: idTemp, 
            pergunta: '',
            descricao: '', 
            tipo: 'SELECT', 
            opcoes: ['SIM', 'NÃO', 'OUTRO'],
            obrigatorio: true,
            ordem: perguntas.length
        };
        
        setPerguntas(prev => [...prev, nova]);

        setShowToastNovaPergunta(true);
        setTimeout(() => setShowToastNovaPergunta(false), 2500);

        setTimeout(() => {
            const novoElemento = document.getElementById(`pergunta-${idTemp}`);
            if (novoElemento) {
                novoElemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
                novoElemento.classList.add('ring-4', 'ring-blue-400', 'ring-offset-2', 'transition-all', 'duration-500');
                setTimeout(() => {
                    novoElemento.classList.remove('ring-4', 'ring-blue-400', 'ring-offset-2');
                }, 1500);
            }
        }, 100); 
    };

    const removerPergunta = (index, id) => {
        if (!String(id).startsWith('temp-')) setPerguntasRemovidas([...perguntasRemovidas, id]);
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

    // 🔥 CORREÇÃO: Separando novas perguntas (Insert) de perguntas antigas (Upsert)
    const salvarTudo = async () => {
        setSaving(true);
        try {
            if (perguntasRemovidas.length > 0) {
                await supabase.from('avaliacao_perguntas').update({ ativo: false }).in('id', perguntasRemovidas);
            }

            const paraInserir = [];
            const paraAtualizar = [];

            perguntas.forEach((p, i) => {
                const item = {
                    pergunta: p.pergunta,
                    descricao: p.descricao || '',
                    tipo: p.tipo,
                    opcoes: p.opcoes,
                    obrigatorio: p.obrigatorio,
                    ordem: i,
                    ativo: true
                };

                // Se tiver ID falso, vai pra fila de criação nova (sem ID)
                if (String(p.id).startsWith('temp-')) {
                    paraInserir.push(item);
                } else {
                    item.id = p.id;
                    paraAtualizar.push(item); // Fila de atualização
                }
            });

            if (paraAtualizar.length > 0) {
                const { error } = await supabase.from('avaliacao_perguntas').upsert(paraAtualizar);
                if (error) throw error;
            }
            if (paraInserir.length > 0) {
                const { error } = await supabase.from('avaliacao_perguntas').insert(paraInserir);
                if (error) throw error;
            }

            alert(t('students.paste.success', {defaultValue: 'Formulário atualizado com sucesso!'}));
            setPerguntasRemovidas([]);
            carregarPerguntas(); // Atualiza a tela para sumir com os IDs "temp" e mostrar os oficiais

        } catch (error) {
            console.error(error); alert("Erro ao salvar o formulário. Verifique o console.");
        } finally { setSaving(false); }
    };

    const handleRespostaPreview = (perguntaId, valor, tipo) => {
        setPreviewRespostas(prev => {
            if (tipo === 'CHECKBOX') {
                const atual = prev[perguntaId] || [];
                if (atual.includes(valor)) return { ...prev, [perguntaId]: atual.filter(v => v !== valor) };
                return { ...prev, [perguntaId]: [...atual, valor] };
            }
            return { ...prev, [perguntaId]: valor };
        });
    };

    if (!ehAdmin) return (<div className="bg-rose-50 p-8 text-center max-w-2xl mx-auto mt-10 rounded-[24px]"><h3 className="text-xl font-black text-rose-800">Acesso Restrito</h3></div>);
    if (loading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>;

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] max-w-5xl mx-auto pb-10">
            
            {showToastNovaPergunta && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] bg-emerald-500 text-white px-6 py-3.5 rounded-2xl shadow-2xl font-black uppercase tracking-widest text-xs flex items-center gap-3 animate-[slideDown_0.3s_ease-out]">
                    <div className="bg-white/20 p-1.5 rounded-lg"><Plus className="w-4 h-4" /></div> Nova Pergunta Adicionada!
                </div>
            )}
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200 p-6 rounded-[24px] shadow-sm sticky top-4 z-50">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-inner"><ListChecks className="w-6 h-6" /></div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Perguntas da Anamnese</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Defina a estrutura dinâmica do formulário</p>
                    </div>
                </div>
                <div className="flex flex-wrap md:flex-nowrap w-full md:w-auto gap-3">
                    <button onClick={adicionarPergunta} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors border border-slate-200 shadow-sm"><Plus className="w-4 h-4" /> Nova Pergunta</button>
                    <button onClick={() => { setPreviewRespostas({}); setPreviewOutros({}); setShowPreview(true); }} disabled={perguntas.length === 0} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 disabled:opacity-50 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors shadow-sm"><Eye className="w-4 h-4" /> Visualizar</button>
                    <button onClick={salvarTudo} disabled={saving} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors shadow-[0_4px_15px_rgba(249,115,22,0.3)]">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar Final</button>
                </div>
            </div>

            <div className="space-y-4">
                {perguntas.length === 0 ? (
                    <div className="bg-white border border-slate-200 p-10 rounded-[24px] text-center shadow-sm"><p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">O formulário está vazio. Clique em "Nova Pergunta" para começar.</p></div>
                ) : (
                    perguntas.map((p, index) => (
                        <div key={p.id} id={`pergunta-${p.id}`} className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm flex flex-col gap-4 relative group">
                            
                            <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-4 border-b border-slate-100 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
                                        <button onClick={() => moverPergunta(index, 'UP')} disabled={index === 0} className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30 transition-colors"><ArrowUp className="w-3 h-3" /></button>
                                        <button onClick={() => moverPergunta(index, 'DOWN')} disabled={index === perguntas.length - 1} className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30 transition-colors"><ArrowDown className="w-3 h-3" /></button>
                                    </div>
                                    <select value={p.tipo} onChange={(e) => atualizarPergunta(index, 'tipo', e.target.value)} className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-black uppercase tracking-widest px-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500">
                                        <option value="TEXTO_CURTO">Texto Curto</option>
                                        <option value="TEXTO_LONGO">Texto Longo</option>
                                        <option value="SELECT">Múltipla Escolha (Bolhinha)</option>
                                        <option value="CHECKBOX">Caixas de Seleção</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={p.obrigatorio} onChange={(e) => atualizarPergunta(index, 'obrigatorio', e.target.checked)} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500" />
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Obrigatório</span>
                                    </label>
                                    <button onClick={() => removerPergunta(index, p.id)} className="p-2.5 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>

                            <div>
                                <input type="text" value={p.pergunta} onChange={(e) => atualizarPergunta(index, 'pergunta', e.target.value)} placeholder="Digite o título da pergunta aqui..." className="w-full text-lg font-black text-slate-800 placeholder:text-slate-300 outline-none border-b border-transparent focus:border-blue-500 transition-colors py-2 bg-transparent"/>
                                <textarea value={p.descricao || ''} onChange={(e) => atualizarPergunta(index, 'descricao', e.target.value)} placeholder="Descrição ou explicação adicional (opcional)..." rows="2" className="w-full text-sm font-medium text-slate-500 placeholder:text-slate-300 outline-none border-b border-transparent focus:border-blue-400 transition-colors py-1 bg-transparent resize-none mt-1" />
                            </div>

                            {(p.tipo === 'SELECT' || p.tipo === 'CHECKBOX') && (
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3 mt-2">
                                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        {p.tipo === 'SELECT' ? <ListChecks className="w-3 h-3"/> : <CheckSquare className="w-3 h-3"/>} Opções de Resposta
                                    </h4>
                                    {p.opcoes.map((opcao, optIndex) => (
                                        <div key={optIndex} className="flex items-center gap-3">
                                            <div className={`w-4 h-4 shrink-0 border-2 border-slate-300 ${p.tipo === 'SELECT' ? 'rounded-full' : 'rounded'}`}></div>
                                            <input type="text" value={opcao} onChange={(e) => atualizarOpcao(index, optIndex, e.target.value)} placeholder={`Opção ${optIndex + 1}`} className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500"/>
                                            <button onClick={() => removerOpcao(index, optIndex)} className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"><X className="w-4 h-4"/></button>
                                        </div>
                                    ))}
                                    <button onClick={() => adicionarOpcao(index)} className="flex items-center gap-2 text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest mt-2 ml-1"><Plus className="w-3 h-3" /> Adicionar Opção</button>
                                    <p className="text-[9px] font-bold text-slate-400 mt-2 ml-1">💡 Dica: Se quiser um campo aberto para justificativa, cadastre uma opção chamada exatamente <strong className="text-slate-600">"Outro"</strong>.</p>
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

            {showPreview && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-slate-100 rounded-[32px] shadow-2xl w-full max-w-4xl flex flex-col h-full max-h-[85vh] overflow-hidden border border-slate-200">
                        <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-center shrink-0 shadow-sm z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><Eye className="w-5 h-5" /></div>
                                <div><h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Modo de Visualização</h3><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">É assim que o professor verá a Anamnese</p></div>
                            </div>
                            <button onClick={() => setShowPreview(false)} className="p-2 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                            <div className="bg-white p-8 rounded-[24px] border border-slate-200 shadow-sm space-y-8 max-w-3xl mx-auto">
                                <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-6"><ListChecks className="w-5 h-5 text-indigo-500" /><h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Questionário de Anamnese</h3></div>
                                <div className="flex flex-col gap-10">
                                    {perguntas.map((p) => (
                                        <div key={p.id} className="flex flex-col">
                                            <h4 className="text-base font-black text-slate-800 uppercase tracking-tight">
                                                {p.pergunta || 'Pergunta sem título'} {p.obrigatorio && <span className="text-rose-500">*</span>}
                                            </h4>
                                            {p.descricao && <p className="text-sm font-medium text-slate-500 mt-1 leading-relaxed">{p.descricao}</p>}
                                            
                                            {p.tipo === 'TEXTO_CURTO' && (
                                                <input type="text" placeholder="Sua resposta..." className="w-full sm:w-2/3 bg-transparent border-b-2 border-slate-300 focus:border-indigo-500 text-sm font-bold text-slate-800 outline-none py-2 px-1 transition-colors mt-3" value={previewRespostas[p.id] || ''} onChange={(e) => handleRespostaPreview(p.id, e.target.value, p.tipo)} />
                                            )}
                                            {p.tipo === 'TEXTO_LONGO' && (
                                                <textarea placeholder="Sua resposta detalhada..." className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl text-sm font-medium text-slate-800 outline-none p-4 transition-all resize-none mt-3 shadow-sm" rows="3" value={previewRespostas[p.id] || ''} onChange={(e) => handleRespostaPreview(p.id, e.target.value, p.tipo)} />
                                            )}
                                            {p.tipo === 'SELECT' && (
                                                <div className="flex flex-col gap-3 mt-4">
                                                    {p.opcoes.map(o => {
                                                        const isOutro = o.toLowerCase().trim().startsWith('outro');
                                                        const isChecked = previewRespostas[p.id] === o;
                                                        return (
                                                            <div key={o} className="flex flex-col sm:flex-row sm:items-center gap-2">
                                                                <label className="flex items-center gap-3 cursor-pointer group w-fit">
                                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isChecked ? 'border-indigo-600' : 'border-slate-300 group-hover:border-indigo-400'}`}>
                                                                        {isChecked && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></div>}
                                                                    </div>
                                                                    <input type="radio" name={p.id} value={o} checked={isChecked} onChange={(e) => handleRespostaPreview(p.id, e.target.value, p.tipo)} className="hidden" />
                                                                    <span className={`text-sm font-bold transition-colors ${isChecked ? 'text-slate-800' : 'text-slate-600 group-hover:text-slate-800'}`}>{o || 'Opção Vazia'}</span>
                                                                </label>
                                                                {isOutro && isChecked && (
                                                                    <input type="text" placeholder="Especifique..." className="w-full sm:w-auto flex-1 bg-transparent border-b-2 border-slate-300 focus:border-indigo-500 text-sm font-bold text-slate-800 outline-none py-1 px-2 transition-colors animate-[fadeIn_0.2s_ease-out]" value={previewOutros[p.id] || ''} onChange={(e) => setPreviewOutros({...previewOutros, [p.id]: e.target.value})} autoFocus />
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                            {p.tipo === 'CHECKBOX' && (
                                                <div className="flex flex-col gap-3 mt-4">
                                                    {p.opcoes.map(o => {
                                                        const isOutro = o.toLowerCase().trim().startsWith('outro');
                                                        const isChecked = (previewRespostas[p.id] || []).includes(o);
                                                        return (
                                                            <div key={o} className="flex flex-col sm:flex-row sm:items-center gap-2">
                                                                <label className="flex items-center gap-3 cursor-pointer group w-fit">
                                                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isChecked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 group-hover:border-indigo-400'}`}>
                                                                        {isChecked && <Check className="w-3.5 h-3.5 text-white stroke-[4]" />}
                                                                    </div>
                                                                    <input type="checkbox" checked={isChecked} onChange={() => handleRespostaPreview(p.id, o, p.tipo)} className="hidden" />
                                                                    <span className={`text-sm font-bold transition-colors ${isChecked ? 'text-slate-800' : 'text-slate-600 group-hover:text-slate-800'}`}>{o || 'Opção Vazia'}</span>
                                                                </label>
                                                                {isOutro && isChecked && (
                                                                    <input type="text" placeholder="Especifique..." className="w-full sm:w-auto flex-1 bg-transparent border-b-2 border-slate-300 focus:border-indigo-500 text-sm font-bold text-slate-800 outline-none py-1 px-2 transition-colors animate-[fadeIn_0.2s_ease-out]" value={previewOutros[p.id] || ''} onChange={(e) => setPreviewOutros({...previewOutros, [p.id]: e.target.value})} autoFocus />
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