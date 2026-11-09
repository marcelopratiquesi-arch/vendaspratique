// ==========================================
// REDE DE SEGURANÇA CONTRA TELA BRANCA (09/11/2026)
// Se uma tela tiver um erro de programação, só ela mostra o aviso "Esta tela teve um problema"; o menu e o
// resto do sistema continuam. Com telaInteira (usado no main.jsx), protege o sistema todo.
// ==========================================
import React from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { tx } from '../i18n/traduzir.js';
import { recarregarNaVersaoMaisNova } from './pausaSistema.js';

function AvisoErro({ erro, telaInteira, onTentar }) {
    return (
        <div className={`${telaInteira ? 'fixed inset-0 bg-slate-50 dark:bg-[#0a0f1c]' : 'h-full'} flex items-center justify-center p-4`}>
            <div className="w-[min(480px,100%)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-8 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-7 h-7 text-rose-500" />
                </div>
                <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">
                    {telaInteira ? tx('O sistema teve um problema') : tx('Esta tela teve um problema')}
                </h2>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                    {telaInteira
                        ? tx('Algo deu errado. Recarregue para continuar.')
                        : tx('Algo deu errado ao mostrar esta tela. O resto do sistema continua funcionando.')}
                </p>
                {erro?.message && (
                    <p className="mt-3 text-[10px] font-mono text-slate-400 dark:text-slate-500 break-words">{String(erro.message).slice(0, 200)}</p>
                )}
                <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
                    {!telaInteira && (
                        <button type="button" onClick={onTentar} className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2">
                            <RotateCcw className="w-4 h-4" /> {tx('Tentar de novo')}
                        </button>
                    )}
                    <button type="button" onClick={() => recarregarNaVersaoMaisNova()} className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4" /> {tx('Recarregar o sistema')}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default class ProtecaoTela extends React.Component {
    constructor(props) {
        super(props);
        this.state = { erro: null };
    }

    static getDerivedStateFromError(erro) {
        return { erro };
    }

    componentDidCatch(erro, info) {
        console.error('Erro ao mostrar a tela:', erro, info?.componentStack);
    }

    render() {
        if (!this.state.erro) return this.props.children;
        return <AvisoErro erro={this.state.erro} telaInteira={this.props.telaInteira} onTentar={() => this.setState({ erro: null })} />;
    }
}
