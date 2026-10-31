// Lista personalizada do "Consultor responsável" (tela Lançar venda, desenho aprovado pelo dono em 30/10/2026)
// - Nome curto (1º e 2º nome) com o nome completo no tooltip; o valor gravado continua o nome completo.
// - Agrupada por setor (ordem e cores em setoresEquipe.js); avatar na cor do setor; ✓ no selecionado.
import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { tx } from '../../../i18n/traduzir.js';
import { combinaBusca, useFecharAoClicarFora, tratarTeclado, lerUltimoConsultor, guardarUltimoConsultor, useModoEscuro, CLASSE_CAMPO, CLASSE_PAINEL } from './comum.js';
import { setorDoColaborador, ordemDoSetor, montarNomesCurtos, iniciaisDoConsultor } from './setoresEquipe.js';

const Avatar = ({ nome, setor, escuro }) => (
    <span className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0" aria-hidden="true"
        style={{ background: escuro ? setor.fundoEscuro : setor.fundo, color: escuro ? setor.textoEscuro : setor.texto }}>
        {iniciaisDoConsultor(nome)}
    </span>
);

const SeletorConsultor = ({ consultores = [], valor, onEscolher, aberto, setAberto, desabilitado, idCampo }) => {
    const [busca, setBusca] = useState('');
    const [ativo, setAtivo] = useState(0);
    const [ultimo, setUltimo] = useState(lerUltimoConsultor);
    const caixaRef = useRef(null);
    const buscaRef = useRef(null);
    const listaRef = useRef(null);
    const escuro = useModoEscuro();

    const fechar = useCallback(() => setAberto(false), [setAberto]);
    useFecharAoClicarFora(aberto, caixaRef, fechar);
    useEffect(() => {
        if (!aberto) return;
        setBusca('');
        setUltimo(lerUltimoConsultor());
        setTimeout(() => buscaRef.current?.focus(), 20);
    }, [aberto]);

    // Nome curto de cada pessoa (com desempate entre homônimos da mesma unidade)
    const nomesCurtos = useMemo(() => montarNomesCurtos(consultores), [consultores]);
    const curto = (nome) => nomesCurtos.get(nome) || nome;

    const { secoes, plana } = useMemo(() => {
        const comSetor = consultores.map(c => ({ ...c, setorInfo: setorDoColaborador(c), curto: nomesCurtos.get(c.nome) || c.nome }));
        // A busca procura no nome completo e no nome curto
        const filtrados = comSetor.filter(c => !busca || combinaBusca(c.nome, busca) || combinaBusca(c.curto, busca));
        const ultimoNaLista = !busca ? filtrados.find(c => c.nome === ultimo) : null;

        const grupos = new Map();
        filtrados.forEach(c => {
            const g = grupos.get(c.setorInfo.chave) || { chave: c.setorInfo.chave, rotulo: c.setorInfo.rotulo, setor: c.setorInfo, itens: [] };
            g.itens.push(c);
            grupos.set(c.setorInfo.chave, g);
        });
        const gruposOrdenados = [...grupos.values()]
            .map(g => ({ ...g, itens: g.itens.sort((a, b) => a.curto.localeCompare(b.curto)) }))
            .sort((a, b) => (ordemDoSetor(a.setor) - ordemDoSetor(b.setor)) || a.rotulo.localeCompare(b.rotulo));

        const montadas = [
            ...(ultimoNaLista ? [{ chave: 'ULTIMO', rotulo: 'Último usado', itens: [ultimoNaLista] }] : []),
            ...gruposOrdenados,
        ];
        return { secoes: montadas, plana: montadas.flatMap(s => s.itens) };
    }, [consultores, busca, ultimo, nomesCurtos]);

    useEffect(() => {
        const i = plana.findIndex(x => x.nome === valor);
        setAtivo(i >= 0 ? i : 0);
    }, [busca, aberto, plana, valor]);
    useEffect(() => {
        if (!aberto) return;
        listaRef.current?.querySelector(`[data-indice="${ativo}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [ativo, aberto]);

    const escolher = (c) => { guardarUltimoConsultor(c.nome); onEscolher(c.nome); setAberto(false); };
    const escolhido = consultores.find(c => c.nome === valor);
    const setorEscolhido = escolhido ? setorDoColaborador(escolhido) : null;

    return (
        <div ref={caixaRef} className="relative">
            <button
                type="button"
                id={idCampo}
                disabled={desabilitado}
                onClick={() => setAberto(!aberto)}
                aria-haspopup="listbox"
                aria-expanded={aberto}
                title={valor || undefined}
                className={`${CLASSE_CAMPO} ${aberto ? 'border-[#1D4FD8] ring-2 ring-[#1D4FD8]/20' : ''}`}
            >
                {valor ? (
                    <>
                        {setorEscolhido ? <Avatar nome={valor} setor={setorEscolhido} escuro={escuro} /> : null}
                        <span className="flex-1 min-w-0 truncate whitespace-nowrap font-semibold text-[#0F172A] dark:text-white">{curto(valor)}</span>
                    </>
                ) : (
                    <span className="flex-1 min-w-0 truncate whitespace-nowrap text-[#5B6478] dark:text-slate-400">{desabilitado ? tx('Escolha a unidade primeiro') : tx('Selecione o consultor…')}</span>
                )}
                <ChevronDown className={`w-4 h-4 text-[#5B6478] shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} />
            </button>

            {aberto && (
                <div className={`${CLASSE_PAINEL} min-w-[260px]`}>
                    <div className="p-3 border-b border-[#EEF1F6] dark:border-slate-800">
                        <label className="h-11 px-3 bg-[#F3F5FA] rounded-xl flex items-center gap-2 dark:bg-slate-800">
                            <Search className="w-4 h-4 text-[#5B6478] shrink-0" />
                            <span className="sr-only">{tx('Buscar consultor…')}</span>
                            <input
                                ref={buscaRef}
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                onKeyDown={(e) => tratarTeclado(e, { total: plana.length, ativo, setAtivo, escolher: (i) => escolher(plana[i]), fechar })}
                                placeholder={tx('Buscar consultor…')}
                                role="combobox"
                                aria-expanded="true"
                                aria-controls={`${idCampo}-lista`}
                                className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-[#0F172A] placeholder:text-[#5B6478] dark:text-white"
                            />
                        </label>
                    </div>
                    <ul ref={listaRef} id={`${idCampo}-lista`} role="listbox" className="max-h-72 overflow-y-auto overflow-x-hidden py-1 custom-scrollbar">
                        {plana.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-[#5B6478] dark:text-slate-400">{consultores.length === 0 ? tx('Nenhum consultor ativo nesta unidade.') : tx('Nada encontrado.')}</li>}
                        {secoes.map(secao => (
                            <li key={secao.chave} role="presentation">
                                {secao.setor ? (
                                    <p className="px-4 pt-3 pb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.07em]" style={{ color: escuro ? secao.setor.textoEscuro : secao.setor.texto }}>
                                        <span className="w-1 h-3.5 rounded-full shrink-0" style={{ background: secao.setor.cor }} aria-hidden="true" />
                                        {secao.setor.outro ? secao.rotulo : tx(secao.rotulo)}
                                    </p>
                                ) : (
                                    <p className="px-4 pt-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.07em] text-[#5B6478] dark:text-slate-400">{tx(secao.rotulo)}</p>
                                )}
                                <ul role="presentation">
                                    {secao.itens.map(c => {
                                        const indice = plana.indexOf(c);
                                        const marcado = c.nome === valor;
                                        return (
                                            <li key={`${secao.chave}-${c.id || c.nome}`} role="option" aria-selected={marcado} data-indice={indice} title={c.nome}
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => escolher(c)}
                                                onMouseEnter={() => setAtivo(indice)}
                                                className={`min-h-11 px-4 py-1.5 flex items-center gap-2.5 cursor-pointer ${marcado ? 'bg-[#EEF3FF] dark:bg-blue-500/15' : indice === ativo ? 'bg-[#F3F5FA] dark:bg-slate-800' : ''}`}
                                            >
                                                <Avatar nome={c.nome} setor={c.setorInfo} escuro={escuro} />
                                                <span className="flex-1 min-w-0 truncate text-[14px] font-semibold text-[#0F172A] dark:text-white">{c.curto}</span>
                                                {marcado && <Check className="w-4 h-4 shrink-0 text-[#1D4FD8] dark:text-blue-300" strokeWidth={3} aria-hidden="true" />}
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

export default SeletorConsultor;
