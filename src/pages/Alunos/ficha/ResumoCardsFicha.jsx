import React from 'react';
import { CalendarDays, Bookmark, ShoppingBag, Activity, MessageCircle, Loader2 } from 'lucide-react';
import { formatarDataBR } from '../utils.js';

const ResumoCardsFicha = ({ aluno, dadosFicha, loading }) => {
    
    const ultimaCompraExtra = dadosFicha.produtos.length > 0 ? dadosFicha.produtos[0].produto : 'NENHUMA';
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
            bgIcon: 'bg-blue-50 text-blue-600',
        },
        {
            titulo: 'Último Plano',
            valor: aluno.ultimo_plano || 'NENHUM',
            subvalor: aluno.ultimo_plano_data ? formatarDataBR(aluno.ultimo_plano_data) : 'Plano atual',
            icone: Bookmark,
            bgIcon: 'bg-emerald-50 text-emerald-600',
        },
        {
            titulo: 'Última Compra (Extra)',
            valor: loading ? '...' : ultimaCompraExtra,
            subvalor: loading ? '' : dataUltimaCompraExtra,
            icone: ShoppingBag,
            bgIcon: 'bg-amber-50 text-amber-600',
        },
        {
            titulo: 'Última Avaliação',
            valor: loading ? '...' : dataUltimaAvaliacao,
            subvalor: loading ? '' : profUltimaAvaliacao,
            icone: Activity,
            bgIcon: 'bg-rose-50 text-rose-600',
        },
        {
            titulo: 'Último Contato CRM',
            valor: loading ? '...' : ultimoCrm,
            subvalor: loading ? '' : dataUltimoCrm,
            icone: MessageCircle,
            bgIcon: 'bg-indigo-50 text-indigo-600',
        }
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {cards.map((c, i) => {
                const Icone = c.icone;
                return (
                    <div key={i} className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between min-h-[105px]">
                        <div className="flex items-center gap-2.5 mb-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${c.bgIcon}`}>
                                <Icone className="w-3.5 h-3.5" strokeWidth={2.5} />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">
                                {c.titulo}
                            </span>
                        </div>
                        
                        <div className="flex flex-col mt-1">
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin text-slate-300 mt-1" />
                            ) : (
                                <>
                                    <span className="text-[15px] font-extrabold uppercase tracking-tight text-slate-800 truncate" title={c.valor}>
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