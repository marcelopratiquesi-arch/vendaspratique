import React, { useEffect, useMemo, useState } from 'react';
import { Search, Edit3, Power, PowerOff, Bookmark, Package, Briefcase, PlusCircle, LayoutList, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient.js';
import { formatMoney } from './utils.js';
import { tx } from '../../i18n/traduzir.js';
import { normalizeString } from '../AnaliseVendas/utils.js';
import { grupoDoItem } from './grupoCatalogo.js';
import { ORDEM_NORMAL, proximaOrdem, ordenarLinhas } from '../../components/ordenacao.js';
import TituloOrdenavel from '../../components/TituloOrdenavel.jsx';

// ==========================================
// CADASTROS → CATÁLOGO — revisão 360 de 09/11/2026 (decisão do dono)
// - Faixa fina: planos, produtos, serviços e descontinuados (clicar filtra).
// - Coluna GRUPO: como cada item conta nas metas (decomporPlano para planos; dose única Whey/Energy nos produtos).
// - Coluna VENDAS: em quantas vendas o item já foi usado (nas unidades que a pessoa vê; só leitura, ao abrir a aba).
// - Botões sempre visíveis e ordenar clicando no título. Só o Admin altera (o valor é a comissão; regra 12).
// ==========================================

const TIPOS = {
    plano: { label: 'PLANO', icone: Bookmark, cor: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/30' },
    produto: { label: 'PRODUTO', icone: Package, cor: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/30' },
    servico: { label: 'SERVIÇO', icone: Briefcase, cor: 'text-violet-700 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10', border: 'border-violet-200 dark:border-violet-500/30' },
};
const OUTRO = { label: 'OUTRO', icone: LayoutList, cor: 'text-slate-700 dark:text-slate-200', bg: 'bg-slate-50 dark:bg-slate-800/60', border: 'border-slate-200 dark:border-slate-800' };

// Quantas vendas usaram cada item (nome normalizado → quantidade de lançamentos). Lê só o nome do produto.
const useUsoNasVendas = () => {
    const [uso, setUso] = useState(null);
    useEffect(() => {
        let vivo = true;
        (async () => {
            const mapa = new Map();
            for (let de = 0; de < 60000; de += 1000) {
                const { data, error } = await supabase.from('vendas').select('produto').order('id', { ascending: true }).range(de, de + 999);
                if (error) { console.warn('Catálogo: não deu para contar as vendas de cada item.', error); if (vivo) setUso(undefined); return; }
                (data || []).forEach(v => { const k = normalizeString(v.produto); mapa.set(k, (mapa.get(k) || 0) + 1); });
                if (!data || data.length < 1000) break;
            }
            if (vivo) setUso(mapa);
        })();
        return () => { vivo = false; };
    }, []);
    return uso; // null = contando · undefined = não deu · Map = pronto
};

const TabCatalogo = ({ catalogoCompleto = [], onEdit, onToggleStatus, onOpenModal, ehAdmin }) => {
    const [termoBusca, setTermoBusca] = useState('');
    const [filtroTipo, setFiltroTipo] = useState('TODOS');
    const [filtroStatus, setFiltroStatus] = useState('ATIVOS');
    const [ordem, setOrdem] = useState(ORDEM_NORMAL);
    const ordenar = (coluna, texto) => setOrdem(atual => proximaOrdem(atual, coluna, texto));
    const uso = useUsoNasVendas();
    const usoDe = (item) => (uso instanceof Map ? (uso.get(normalizeString(item.nome)) || 0) : null);

    const ativos = catalogoCompleto.filter(i => i.ativo !== false);
    const resumo = {
        plano: ativos.filter(i => i.tipo === 'plano').length,
        produto: ativos.filter(i => i.tipo === 'produto').length,
        servico: ativos.filter(i => i.tipo === 'servico').length,
        descontinuados: catalogoCompleto.length - ativos.length,
    };

    const lista = useMemo(() => {
        const termo = normalizeString(termoBusca);
        const filtrados = catalogoCompleto.filter(item => {
            const isAtivo = item.ativo !== false;
            if (filtroStatus === 'ATIVOS' && !isAtivo) return false;
            if (filtroStatus === 'DESCONTINUADOS' && isAtivo) return false;
            if (filtroTipo !== 'TODOS' && item.tipo !== filtroTipo) return false;
            return !termo || normalizeString(item.nome).includes(termo);
        });
        const normal = [...filtrados].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
        const valores = {
            nome: i => i.nome || null,
            tipo: i => i.tipo || null,
            grupo: i => tx(grupoDoItem(i).texto),
            valor: i => Number(i.valor) || 0,
            vendas: i => usoDe(i),
        };
        return ordenarLinhas(normal, ordem, valores, i => i.nome);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- usoDe depende só de "uso"
    }, [catalogoCompleto, termoBusca, filtroTipo, filtroStatus, ordem, uso]);

    const temFiltro = !!(termoBusca.trim() || filtroTipo !== 'TODOS' || filtroStatus !== 'ATIVOS');
    const limpar = () => { setTermoBusca(''); setFiltroTipo('TODOS'); setFiltroStatus('ATIVOS'); };
    const th = 'px-4 py-2.5 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap dark:text-slate-400';
    const chip = (id, rotulo, qtd, Icone, corAtiva) => {
        const ativo = filtroTipo === id && filtroStatus === 'ATIVOS';
        return (
            <button key={id} type="button" onClick={() => { setFiltroStatus('ATIVOS'); setFiltroTipo(ativo ? 'TODOS' : id); }} aria-pressed={ativo}
                className={`h-8 px-2.5 rounded-lg text-[11px] font-black uppercase tracking-wide inline-flex items-center gap-1.5 transition-colors ${ativo ? `${corAtiva} text-white` : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                <Icone className="w-3.5 h-3.5" />{tx(rotulo)} <span className="text-[13px]">{qtd}</span>
            </button>
        );
    };

    return (
        <div className="space-y-3 animate-[fadeIn_0.3s_ease-out]">
            {/* FAIXA FINA */}
            <div className="bg-white rounded-2xl border border-slate-200 px-4 py-2.5 flex flex-wrap items-center gap-2 dark:bg-slate-900 dark:border-slate-800">
                {chip('plano', 'Planos', resumo.plano, Bookmark, 'bg-blue-600')}
                {chip('produto', 'Produtos', resumo.produto, Package, 'bg-emerald-600')}
                {chip('servico', 'Serviços', resumo.servico, Briefcase, 'bg-violet-600')}
                {resumo.descontinuados > 0 && (
                    <button type="button" onClick={() => { setFiltroTipo('TODOS'); setFiltroStatus(filtroStatus === 'DESCONTINUADOS' ? 'ATIVOS' : 'DESCONTINUADOS'); }} aria-pressed={filtroStatus === 'DESCONTINUADOS'}
                        className={`h-8 px-2.5 rounded-lg text-[11px] font-black uppercase tracking-wide inline-flex items-center gap-1.5 ${filtroStatus === 'DESCONTINUADOS' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                        <PowerOff className="w-3.5 h-3.5" />{tx('Descontinuados')} <span className="text-[13px]">{resumo.descontinuados}</span>
                    </button>
                )}
                <div className="flex-1" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{tx('O valor de cada item é a comissão')}</span>
            </div>

            {/* BUSCA + FILTROS + NOVO */}
            <div className="flex flex-wrap items-center gap-2">
                <label className="flex-[2] min-w-[min(220px,100%)] h-10 px-3 bg-white border border-slate-200 rounded-xl flex items-center gap-2 focus-within:ring-2 focus-within:ring-blue-500 dark:bg-slate-900 dark:border-slate-800">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input type="text" value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)} placeholder={tx('Buscar item...')} aria-label={tx('Buscar item...')}
                        className="flex-1 min-w-0 bg-transparent outline-none text-[13px] font-bold text-slate-800 placeholder-slate-400 uppercase dark:text-white" />
                </label>
                <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} aria-label={tx('Categoria')}
                    className="flex-1 min-w-[140px] h-10 px-3 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200">
                    <option value="TODOS">{tx('Todas as categorias')}</option>
                    <option value="plano">{tx('Planos')}</option>
                    <option value="produto">{tx('Produtos')}</option>
                    <option value="servico">{tx('Serviços')}</option>
                </select>
                <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} aria-label={tx('Situação')}
                    className="flex-1 min-w-[140px] h-10 px-3 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200">
                    <option value="ATIVOS">{tx('Ativos (ofertas)')}</option>
                    <option value="DESCONTINUADOS">{tx('Descontinuados')}</option>
                    <option value="TODOS">{tx('Todos os itens')}</option>
                </select>
                {temFiltro && (
                    <button type="button" onClick={limpar} className="h-10 px-3 rounded-xl text-[12px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 inline-flex items-center gap-1.5 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800">
                        <RefreshCw className="w-3.5 h-3.5" />{tx('Limpar filtros')}
                    </button>
                )}
                {ehAdmin && (
                    <button type="button" onClick={onOpenModal} className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-2 shadow-sm">
                        <PlusCircle className="w-4 h-4" />{tx('Novo Item')}
                    </button>
                )}
            </div>

            {(temFiltro || ordem.coluna) && (
                <div className="flex flex-wrap items-center gap-3 px-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    <span>{tx('{qtd} de {total} itens', { qtd: lista.length, total: catalogoCompleto.length })}</span>
                    {ordem.coluna && <button type="button" onClick={() => setOrdem(ORDEM_NORMAL)} className="text-blue-700 hover:underline dark:text-blue-400">{tx('Voltar à ordem normal')}</button>}
                </div>
            )}

            {/* TABELA */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full min-w-[760px]">
                        <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-800/60 dark:border-slate-800">
                            <tr>
                                <TituloOrdenavel coluna="nome" texto ordem={ordem} onOrdenar={ordenar} className={th}>{tx('Nome Oficial')}</TituloOrdenavel>
                                <TituloOrdenavel coluna="tipo" texto ordem={ordem} onOrdenar={ordenar} className={th}>{tx('Categoria')}</TituloOrdenavel>
                                <TituloOrdenavel coluna="grupo" texto ordem={ordem} onOrdenar={ordenar} className={th} dica={tx('Como o item conta nas metas: plano base (Plus, Fit, Personal, Outros), Nutri adicional ou dose única (Whey/Energy, até 10 por mês contam).')}>{tx('Grupo')}</TituloOrdenavel>
                                <TituloOrdenavel coluna="valor" ordem={ordem} onOrdenar={ordenar} className={`${th} text-right`} alinhar="right">{tx('Comissão Padrão')}</TituloOrdenavel>
                                <TituloOrdenavel coluna="vendas" ordem={ordem} onOrdenar={ordenar} className={`${th} text-right`} alinhar="right" dica={tx('Em quantas vendas o item já foi lançado (nas unidades que você vê). Ajuda a decidir se pode descontinuar.')}>{tx('Vendas')}</TituloOrdenavel>
                                {ehAdmin && <th className={`${th} text-right`}>{tx('Ações')}</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {lista.map(item => {
                                const meta = TIPOS[item.tipo] || OUTRO;
                                const Icone = meta.icone;
                                const isAtivo = item.ativo !== false;
                                const grupo = grupoDoItem(item);
                                const qtdVendas = usoDe(item);
                                return (
                                    <tr key={item.id} className={`transition-colors ${isAtivo ? 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40' : 'bg-slate-50/60 opacity-70 hover:opacity-100 dark:bg-slate-800/40'}`}>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-3">
                                                <span className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${isAtivo ? `${meta.bg} ${meta.cor} ${meta.border}` : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}><Icone className="w-4 h-4" /></span>
                                                <span>
                                                    <span className={`block text-[13px] font-black uppercase tracking-tight ${isAtivo ? 'text-slate-800 dark:text-white' : 'text-slate-500 line-through decoration-slate-300 dark:text-slate-400'}`}>{item.nome}</span>
                                                    {!isAtivo && <span className="block text-[10px] font-black text-rose-500 uppercase tracking-widest">{tx('DESCONTINUADO')}</span>}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border ${isAtivo ? `${meta.bg} ${meta.cor} ${meta.border}` : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>{tx(meta.label)}</span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wide whitespace-nowrap ${grupo.cor}`}>{tx(grupo.texto)}</span>
                                        </td>
                                        <td className={`px-4 py-2.5 text-right text-[13px] font-black tabular-nums ${isAtivo ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>{formatMoney(item.valor)}</td>
                                        <td className="px-4 py-2.5 text-right text-[13px] font-black tabular-nums text-slate-700 dark:text-slate-200">
                                            {uso === null ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300 inline" /> : uso === undefined ? '—' : qtdVendas ? qtdVendas.toLocaleString('pt-BR') : <span className="text-slate-300 dark:text-slate-600">0</span>}
                                        </td>
                                        {ehAdmin && (
                                            <td className="px-4 py-2.5 text-right">
                                                <div className="flex justify-end gap-1.5">
                                                    <button type="button" onClick={() => onEdit(item)} className="w-8 h-8 inline-flex items-center justify-center bg-white text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors dark:bg-slate-900 dark:text-blue-400 dark:hover:bg-blue-500/10 dark:border-blue-500/30" title={tx('Editar Oferta')} aria-label={tx('Editar Oferta')}>
                                                        <Edit3 className="w-3.5 h-3.5" />
                                                    </button>
                                                    {isAtivo ? (
                                                        <button type="button" onClick={() => onToggleStatus(item)} className="w-8 h-8 inline-flex items-center justify-center bg-white text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-500/10 dark:border-rose-500/30" title={tx('Descontinuar Oferta')} aria-label={tx('Descontinuar Oferta')}>
                                                            <PowerOff className="w-3.5 h-3.5" />
                                                        </button>
                                                    ) : (
                                                        <button type="button" onClick={() => onToggleStatus(item)} className="w-8 h-8 inline-flex items-center justify-center bg-white text-emerald-600 hover:bg-emerald-50 border border-emerald-200 rounded-lg transition-colors dark:bg-slate-900 dark:text-emerald-400 dark:hover:bg-emerald-500/10 dark:border-emerald-500/30" title={tx('Reativar Oferta')} aria-label={tx('Reativar Oferta')}>
                                                            <Power className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                            {lista.length === 0 && (
                                <tr><td colSpan={ehAdmin ? 6 : 5} className="text-center py-16 text-slate-400 uppercase tracking-widest text-[10px] font-bold">{tx('Nenhum item encontrado no catálogo.')}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TabCatalogo;
