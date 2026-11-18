import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';
import { valorPorExtenso } from './valorPorExtenso.js';

const moeda = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Nome e sobrenome (1º e último), como pediu o dono
const nomeCurto = (nome) => {
    const p = String(nome || '').trim().split(/\s+/).filter(Boolean);
    return p.length > 2 ? `${p[0]} ${p[p.length - 1]}` : p.join(' ');
};
const nomeProprio = (nome) => String(nome || '').toLowerCase()
    .replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase())
    .replace(/\s(De|Da|Do|Das|Dos|E)(?=\s)/g, (m) => m.toLowerCase());

const CSS_IMPRESSAO = `
@media print {
  body > *:not(#recibo-overlay) { display: none !important; }
  #recibo-overlay { position: static !important; background: #fff !important; padding: 0 !important; overflow: visible !important; display: block !important; }
  #recibo-overlay .recibo-barra { display: none !important; }
  #recibo-folha { box-shadow: none !important; border: 0 !important; margin: 0 auto !important; max-width: none !important; width: 100% !important; box-sizing: border-box !important; padding: 22mm 24mm !important; border-radius: 0 !important; }
  @page { size: A4; margin: 0; }
}`;

// Recibo de pagamento de comissão de UM consultor. Só leitura: usa os mesmos números da tabela de Comissões.
const ReciboComissao = ({ row, unidade, lider, periodo, onFechar }) => {
    useEffect(() => {
        const esc = (e) => { if (e.key === 'Escape') onFechar(); };
        window.addEventListener('keydown', esc);
        return () => window.removeEventListener('keydown', esc);
    }, [onFechar]);

    const itens = Object.entries(row.detalhe || {})
        .map(([nome, d]) => ({ nome, qtd: d.qtd, unit: d.qtd ? d.total / d.qtd : 0, total: d.total }))
        .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
    const totalGeral = Number(row.totalComissao) || 0;
    const totalQtd = itens.reduce((a, i) => a + i.qtd, 0);
    const nomeRecebedora = nomeProprio(row.vendedor);
    const nomeLider = lider ? nomeProprio(nomeCurto(lider)) : '';
    const unidadeTxt = nomeProprio(unidade);

    const hoje = new Date().toLocaleDateString('pt-BR');
    const cpfDig = String(row.cpf || '').replace(/D/g, '');
    const cpfTxt = cpfDig.length === 11 ? cpfDig.replace(/(d{3})(d{3})(d{3})(d{2})/, '$1.$2.$3-$4') : '';
    const pagamentoTxt = row.tipo_conta === 'INTER' && row.conta_inter ? `Banco Inter · conta ${row.conta_inter}` : row.tipo_conta === 'PIX_CPF' ? 'PIX (chave CPF)' : '';

    const th = { padding: '8px 10px', textAlign: 'left', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#fff', fontWeight: 700 };
    const td = { padding: '7px 10px', fontSize: 12, color: '#334155', borderBottom: '1px solid #e2e8f0' };

    return createPortal(
        <div id="recibo-overlay" className="fixed inset-0 z-[300] bg-slate-900/70 overflow-auto p-4 sm:p-8" onClick={onFechar}>
            <style>{CSS_IMPRESSAO}</style>
            <div className="recibo-barra max-w-[820px] mx-auto mb-3 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                <span className="text-xs font-black uppercase tracking-widest text-white">{tx("Recibo de pagamento")}</span>
                <div className="flex gap-2">
                    <button onClick={() => window.print()} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest">
                        <Printer className="w-4 h-4" />{tx("Imprimir / Salvar PDF")}
                    </button>
                    <button onClick={onFechar} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-black uppercase tracking-widest">
                        <X className="w-4 h-4" />{tx("Fechar")}
                    </button>
                </div>
            </div>

            <div id="recibo-folha" onClick={(e) => e.stopPropagation()} style={{ background: '#fff', color: '#0f172a', maxWidth: 820, margin: '0 auto', padding: '40px 44px', fontFamily: 'Inter, Arial, sans-serif', boxShadow: '0 10px 40px rgba(0,0,0,.35)', borderRadius: 8 }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#1e3a5f', letterSpacing: 0.5 }}>RECIBO DE PAGAMENTO</div>
                    <div style={{ fontSize: 11, color: '#64748b', letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 }}>Unidade Pratique {unidadeTxt}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{periodo ? `Período: ${periodo} · ` : ''}Emitido em {hoje}</div>
                </div>

                <div style={{ marginTop: 24, border: '1px solid #cbd5e1', background: '#f1f5f9', padding: '10px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#64748b', textAlign: 'left', textTransform: 'uppercase' }}>Valor total</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#1e3a5f' }}>{moeda(totalGeral)}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>({valorPorExtenso(totalGeral)})</div>
                </div>

                <div style={{ marginTop: 24, fontSize: 13, lineHeight: 1.7 }}>
                    <div>Recebedora: <b>{nomeRecebedora}</b></div>
                    {cpfTxt && <div>CPF: <b>{cpfTxt}</b></div>}
                    {pagamentoTxt && <div>Forma de pagamento: <b>{pagamentoTxt}</b></div>}
                    <div>Unidade: <b>Pratique {unidadeTxt}</b></div>
                    <div>Responsável pela conferência: <b>{nomeLider || '________________'}</b></div>
                </div>

                <p style={{ marginTop: 18, fontSize: 12.5, lineHeight: 1.6, color: '#334155' }}>
                    Referente às comissões apuradas no Sistema Pratique Vendas, com base nos lançamentos de planos, produtos e serviços da unidade, já conferidos pelo responsável, conforme discriminação abaixo.
                </p>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
                    <thead>
                        <tr style={{ background: '#3b4f7a' }}>
                            <th style={th}>Produto / Plano</th>
                            <th style={{ ...th, textAlign: 'center' }}>Qtd.</th>
                            <th style={{ ...th, textAlign: 'right' }}>Valor unit.</th>
                            <th style={{ ...th, textAlign: 'right' }}>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {itens.map((i, idx) => (
                            <tr key={i.nome} style={{ background: idx % 2 ? '#f8fafc' : '#fff' }}>
                                <td style={td}>{i.nome}</td>
                                <td style={{ ...td, textAlign: 'center' }}>{i.qtd}</td>
                                <td style={{ ...td, textAlign: 'right' }}>{moeda(i.unit)}</td>
                                <td style={{ ...td, textAlign: 'right' }}>{moeda(i.total)}</td>
                            </tr>
                        ))}
                        <tr style={{ background: '#e2e8f0' }}>
                            <td style={{ ...td, fontWeight: 800, borderBottom: 0 }}>TOTAL GERAL</td>
                            <td style={{ ...td, textAlign: 'center', fontWeight: 800, borderBottom: 0 }}>{totalQtd}</td>
                            <td style={{ ...td, borderBottom: 0 }} />
                            <td style={{ ...td, textAlign: 'right', fontWeight: 800, borderBottom: 0 }}>{moeda(totalGeral)}</td>
                        </tr>
                    </tbody>
                </table>

                <p style={{ marginTop: 22, fontSize: 12.5, lineHeight: 1.6, color: '#334155' }}>
                    Declaro ter recebido da Pratique {unidadeTxt} o valor acima, referente às comissões de vendas discriminadas neste recibo, dando plena quitação do período indicado. A confirmação do recebimento ocorre mediante assinatura abaixo.
                </p>

                <div style={{ marginTop: 26, fontSize: 13 }}>Data do pagamento: ____ / ____ / ________</div>

                <div style={{ marginTop: 56, display: 'flex', gap: 40 }}>
                    <div style={{ flex: 1, textAlign: 'center', borderTop: '1px solid #475569', paddingTop: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 800 }}>{nomeRecebedora}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Recebedora</div>
                    </div>
                    <div style={{ flex: 1, textAlign: 'center', borderTop: '1px solid #475569', paddingTop: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 800 }}>{nomeLider || 'Responsável pelo pagamento'}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Responsável pelo pagamento · Assinatura</div>
                    </div>
                </div>
                <div style={{ marginTop: 28, textAlign: 'center', fontSize: 10, color: '#94a3b8' }}>Documento gerado pelo Sistema Pratique Vendas · Vendas conferidas no sistema</div>
            </div>
        </div>,
        document.body
    );
};

export default ReciboComissao;
