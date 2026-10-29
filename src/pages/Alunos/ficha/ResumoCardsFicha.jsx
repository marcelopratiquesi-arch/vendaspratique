import React from 'react';
import { CalendarDays, Bookmark, ShoppingBag, Activity, MessageCircle, Loader2 } from 'lucide-react';
import { formatarDataBR } from '../utils.js';

const ResumoCardsFicha = ({ aluno, dadosFicha, loading }) => {
    
    // Último plano tirado das vendas buscadas agora (aparece na hora da venda). O "ultimo_plano" do cadastro
    // é recalculado pelo banco de tempos em tempos: só é usado se o aluno não tiver venda de plano no sistema.
    const planoMaisRecente = dadosFicha.planos[0] || null;
    const ultimoPlano = planoMaisRecente ? planoMaisRecente.produto : (aluno.ultimo_plano || 'NENHUM');
    const dataUltimoPlano = planoMaisRecente
        ? formatarDataBR(planoMaisRecente.data || planoMaisRecente.created_at)
        : (aluno.ultimo_plano_data ? formatarDataBR(aluno.ultimo_plano_data) : 'Plano atual');

    const ultimaCompraExtra =dadosFicha.produtos.length > 0 ? dadosFicha.produtos[0].produto : 'NENHUMA';
    const dataUltimaCompraExtra = dadosFicha.produtos.length > 0 ? formatarDataBR(dadosFicha.produtos[0].data || dadosFicha.produtos[0].created_at) : 'Produto adicional';
    
    const dataUltimaAvaliacao = dadosFicha.avaliacoes.length > 0 ? formatarDataBR(dadosFicha.avaliacoes[0].data || dadosFicha.avaliacoes[0].created_at) : 'NENHUMA';
    const profUltimaAvaliacao = dadosFicha.avaliacoes.length > 0 ? dadosFicha.avaliacoes[0].professor : 'Sem avaliação';

    const ultimoCrm = dadosFicha.crm.length > 0 ? (dadosFicha.crm[0].tipo_acao || 'CONTATO') : 'NENHUM';
    const dataUltimoCrm = dadosFicha.crm.length > 0 ? formatarDataBR(dadosFicha.crm[0].created_at) : 'Registro de contato';

    const cards = [
        {
            titulo: 'Cadastro',
            valor: formatarDataBR(aluno.created_at),
            subvalor: 'Data de cadastro',
            icone: CalendarDays,
            bgIcon: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
        },
        {
            titulo: 'Último Plano',
            valor: loading ? '...' : ultimoPlano,
            subvalor: loading ? '' : dataUltimoPlano,
            icone: Bookmark,
            bgIcon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
        },
        {
            titulo: 'Última Compra (Extra)',
            valor: loading ? '...' : ultimaCompraExtra,
            subvalor: loading ? '' : dataUltimaCompraExtra,
            icone: ShoppingBag,
            bgIcon: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
        },
        {
            titulo: 'Última Avaliação',
            valor: loading ? '...' : dataUltimaAvaliacao,
            subvalor: loading ? '' : profUltimaAvaliacao,
            icone: Activity,
            bgIcon: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
        },
        {
            titulo: 'Último Contato CRM',
            valor: loading ? '...' : ultimoCrm,
            subvalor: loading ? '' : dataUltimoCrm,
            icone: MessageCircle,
            bgIcon: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
        }
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {cards.map((c, i) => {
                const Icone = c.icone;
                return (
                    <div key={i} className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between min-h-[105px] dark:bg-slate-900 dark:border-slate-800">
                        <div className="flex items-center gap-2.5 mb-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${c.bgIcon}`}>
                                <Icone className="w-3.5 h-3.5" strokeWidth={2.5} />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate dark:text-slate-400">
                                {c.titulo}
                            </span>
                        </div>
                        
                        <div className="flex flex-col mt-1">
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin text-slate-300 mt-1" />
                            ) : (
                                <>
                                    <span className="text-[15px] font-extrabold uppercase tracking-tight text-slate-800 truncate dark:text-white" title={c.valor}>
                                        {c.valor}
                                    </span>
                                    <span className="text-[10px] font-medium text-slate-400 mt-0.5 truncate" title={c.subvalor}>
                                        {c.subvalor}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ResumoCardsFicha;