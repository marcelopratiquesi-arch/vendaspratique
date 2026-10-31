// Lista personalizada do "Item do catálogo" (tela Lançar venda, desenho aprovado pelo dono em 30/10/2026)
import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { tx } from '../../../i18n/traduzir.js';
import { normalizeString } from '../../AnaliseVendas/utils.js';
import { MAIS_VENDIDOS, GRUPOS_PLANO, COR_NEUTRA, grupoDoPlanoNaLista, corDoPlano, posicaoNaOrdem } from './gruposCatalogo.js';
// Mesmo cálculo de comissão da tela (Lancamentos/utils.js), só para mostrar o valor do catálogo
import { safeNumber, formatMoney } from '../utils.js';
import { combinaBusca, useFecharAoClicarFora, tratarTeclado, CLASSE_CAMPO, CLASSE_PAINEL } from './comum.js';

// As listas (mais vendidos, grupos e ordem dos planos) ficam em gruposCatalogo.js, fáceis de editar

const Quadradinho = ({ cor, tamanho = 8 }) => <span className="rounded-[2px] shrink-0" style={{ width: tamanho, height: tamanho, background: cor }} aria-hidden="true" />;

const SeletorCatalogo = ({ tipo, itens = [], valor, onEscolher, aberto, setAberto, desabilitado, idCampo }) => {
    const [busca, setBusca] = useState('');
    const [ativo, setAtivo] = useState(0);
    const caixaRef = useRef(null);
    const buscaRef = useRef(null);
    const listaRef = useRef(null);
    const ehPlano = tipo === 'plano';

    const fechar = useCallback(() => setAberto(false), [setAberto]);
    useFecharAoClicarFora(aberto, caixaRef, fechar);
    useEffect(() => {
        if (!aberto) return;
        setBusca('');
        setTimeout(() => buscaRef.current?.focus(), 20);
    }, [aberto]);

    // Seções da lista (com busca aplicada) e a lista "achatada" para o teclado
    const { secoes, plana } = useMemo(() => {
        const filtrados = itens.filter(i => !busca || combinaBusca(i.nome, busca));
        let secoesMontadas;
        if (ehPlano) {
            secoesMontadas = GRUPOS_PLANO.map(g => ({
                ...g,
                itens: filtrados
                    .filter(i => grupoDoPlanoNaLista(i.nome) === g.chave)
                    .sort((a, b) => (posicaoNaOrdem(g.ordem, a.nome) - posicaoNaOrdem(g.ordem, b.nome)) || a.nome.localeCompare(b.nome)),
            })).filter(g => g.itens.length > 0);
        } else {
            secoesMontadas = [{ chave: 'TODOS', itens: [...filtrados].sort((a, b) => a.nome.localeCompare(b.nome)) }];
        }
        return { secoes: secoesMontadas, plana: secoesMontadas.flatMap(s => s.itens) };
    }, [itens, busca, ehPlano]);

    const atalhos = useMemo(() => (ehPlano && !busca
        ? MAIS_VENDIDOS.map(n => itens.find(i => normalizeString(i.nome) === normalizeString(n))).filter(Boolean)
        : []), [ehPlano, busca, itens]);

    useEffect(() => {
        const i = plana.findIndex(x => x.nome === valor);
        setAtivo(i >= 0 ? i : 0);
    }, [busca, aberto, plana, valor]);

    // Mantém o item ativo visível ao andar com o teclado
    useEffect(() => {
        if (!aberto) return;
        listaRef.current?.querySelector(`[data-indice="${ativo}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [ativo, aberto]);

    const escolher = (item) => { onEscolher(item.nome); setAberto(false); };
    const selecionado = itens.find(i => i.nome === valor);
    const textoVazio = tipo === 'plano' ? tx('Selecione o plano…') : tipo === 'produto' ? tx('Selecione o produto…') : tx('Selecione o serviço…');
    const textoBusca = tipo === 'plano' ? tx('Buscar plano…') : tipo === 'produto' ? tx('Buscar produto…') : tx('Buscar serviço…');

    return (
        <div ref={caixaRef} className="relative">
            <button
                type="button"
                id={idCampo}
                disabled={desabilitado}
                onClick={() => setAberto(!aberto)}
                aria-haspopup="listbox"
                aria-expanded={aberto}
                className={`${CLASSE_CAMPO} ${aberto ? 'border-[#1D4FD8] ring-2 ring-[#1D4FD8]/20' : ''}`}
            >
                {selecionado ? (
                    <>
                        {ehPlano && <Quadradinho cor={corDoPlano(selecionado.nome)} tamanho={10} />}
                        <span className="flex-1 min-w-0 truncate font-semibold text-[#0F172A] dark:text-white">{selecionado.nome}</span>
                        <span className="text-[13px] text-[#5B6478] tabular-nums shrink-0 dark:text-slate-400">{formatMoney(safeNumber(selecionado.valor))}</span>
                    </>
                ) : (
                    <span className="flex-1 min-w-0 truncate text-[#5B6478] dark:text-slate-400">{desabilitado ? tx('Escolha a categoria primeiro') : textoVazio}</span>
                )}
                <ChevronDown className={`w-4 h-4 text-[#5B6478] shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} />
            </button>

            {aberto && (
                <div className={CLASSE_PAINEL}>
                    <div className="p-3 border-b border-[#EEF1F6] dark:border-slate-800">
                        <label className="h-11 px-3 bg-[#F3F5FA] rounded-xl flex items-center gap-2 dark:bg-slate-800">
                            <Search className="w-4 h-4 text-[#5B6478] shrink-0" />
                            <span className="sr-only">{textoBusca}</span>
                            <input
                                ref={buscaRef}
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                onKeyDown={(e) => tratarTeclado(e, { total: plana.length, ativo, setAtivo, escolher: (i) => escolher(plana[i]), fechar })}
                                placeholder={textoBusca}
                                role="combobox"
                                aria-expanded="true"
                                aria-controls={`${idCampo}-lista`}
                                className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-[#0F172A] placeholder:text-[#5B6478] dark:text-white"
                            />
                        </label>
                        {atalhos.length > 0 && (
                            <div className="mt-3">
                                <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#5B6478] mb-2 dark:text-slate-400">{tx('Mais vendidos')}</p>
                                <div className="flex flex-wrap gap-2">
                                    {atalhos.map(a => (
                                        <button key={a.nome} type="button" onClick={() => escolher(a)}
                                            className={`h-9 px-3 rounded-full border text-[13px] font-semibold inline-flex items-center gap-2 transition-colors ${a.nome === valor ? 'border-[#1D4FD8] bg-[#EEF3FF] text-[#0B1F4B] dark:bg-blue-500/15 dark:text-white' : 'border-[#D6DCE8] text-[#0F172A] hover:bg-[#F3F5FA] dark:border-slate-700 dark:text-white dark:hover:bg-slate-800'}`}>
                                            <Quadradinho cor={corDoPlano(a.nome)} />{a.nome}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <ul ref={listaRef} id={`${idCampo}-lista`} role="listbox" className="max-h-72 overflow-y-auto overflow-x-hidden py-1 custom-scrollbar">
                        {plana.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-[#5B6478] dark:text-slate-400">{tx('Nada encontrado.')}</li>}
                        {secoes.map(secao => (
                            <li key={secao.chave} role="presentation">
                                {ehPlano && (
                                    <p className="px-4 pt-3 pb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.07em]" style={{ color: secao.cor }}>
                                        <span className="w-1 h-3.5 rounded-full shrink-0" style={{ background: secao.cor }} aria-hidden="true" />
                                        {secao.rotulo}
                                        {secao.nota && <span className="normal-case tracking-normal font-semibold text-[#5B6478] dark:text-slate-400">{tx(secao.nota)}</span>}
                                    </p>
                                )}
                                <ul role="presentation">
                                    {secao.itens.map(item => {
                                        const indice = plana.indexOf(item);
                                        const marcado = item.nome === valor;
                                        const emFoco = indice === ativo;
                                        const cor = ehPlano ? corDoPlano(item.nome) : COR_NEUTRA;
                                        return (
                                            <li key={item.id || item.nome} role="option" aria-selected={marcado} data-indice={indice}
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => escolher(item)}
                                                onMouseEnter={() => setAtivo(indice)}
                                                className={`relative min-h-11 px-4 py-2 flex items-center gap-2.5 cursor-pointer ${marcado ? 'bg-[#EEF3FF] dark:bg-blue-500/15' : emFoco ? 'bg-[#F3F5FA] dark:bg-slate-800' : ''}`}
                                            >
                                                {marcado && <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full" style={{ background: cor }} aria-hidden="true" />}
                                                {ehPlano && <Quadradinho cor={cor} />}
                                                <span className="flex-1 min-w-0 truncate text-[14px] font-semibold text-[#0F172A] dark:text-white">{item.nome}</span>
                                                <span className="text-[13px] text-[#5B6478] tabular-nums shrink-0 dark:text-slate-400">{formatMoney(safeNumber(item.valor))}</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default SeletorCatalogo;
