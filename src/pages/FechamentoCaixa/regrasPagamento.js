// Regras do pagamento das comissões SEM banco (testáveis com node: scripts/teste-central-colaborador.mjs).
// A leitura e a gravação ficam em pagamentosComissao.js.
const normalizarUnidade = (u) => String(u || '').trim().toUpperCase();
const mesAtualIso = (agora = new Date()) => `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
const diaAnterior = (iso) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// O período escolhido é um mês só (começa no dia 1º e termina no mesmo mês)? Devolve 'AAAA-MM' ou null.
// fimExclusivo = o dia seguinte ao último dia (como o Fechamento guarda).
export const mesDaFaixa = (inicioIso, fimExclusivo) => {
    if (!inicioIso || !fimExclusivo || inicioIso.slice(8, 10) !== '01') return null;
    const ultimo = diaAnterior(fimExclusivo);
    return ultimo.slice(0, 7) === inicioIso.slice(0, 7) ? inicioIso.slice(0, 7) : null;
};
export const mesJaTerminou = (mes, agora = new Date()) => !!mes && mes < mesAtualIso(agora);

// PAGAMENTO POR SETOR (16/11/2026, decisão do dono): a aprovação pode ser da UNIDADE INTEIRA (setor vazio) ou de UM
// SETOR (campo "setor" = chave do setor, ver setorDaVenda.js). A do setor guarda os números das vendas pagas
// (venda_ids) e trava só elas; a da unidade trava o mês inteiro.
const mesmoLugar = (p, unidade, mes) => p.ativo !== false && p.mes === mes && normalizarUnidade(p.unidade) === normalizarUnidade(unidade);
export const ehPagamentoDeSetor = (p) => !!String(p?.setor || '').trim();
const temVenda = (p, id) => Array.isArray(p.venda_ids) && p.venda_ids.some(x => String(x) === String(id));

// A venda está paga/travada? Mês com pagamento da unidade inteira, ou venda dentro de um pagamento de setor.
export const vendaTravada = (venda, pagamentos = []) => {
    const mes = String(venda?.data || '').slice(0, 7);
    return pagamentos.some(p => mesmoLugar(p, venda?.unidade, mes) && (!ehPagamentoDeSetor(p) || temVenda(p, venda?.id)));
};
// Aprovação da unidade inteira (sem setor) ou, com setor, a daquele setor
export const pagamentoDe = (unidade, mes, pagamentos = [], setor = null) =>
    pagamentos.find(p => mesmoLugar(p, unidade, mes) && (setor ? p.setor === setor : !ehPagamentoDeSetor(p))) || null;
// Aprovações por setor daquela unidade e mês
export const pagamentosDeSetor = (unidade, mes, pagamentos = []) => pagamentos.filter(p => mesmoLugar(p, unidade, mes) && ehPagamentoDeSetor(p));
// Números das vendas já pagas por setor naquela unidade e mês (para não pagar duas vezes)
export const idsPagosPorSetor = (unidade, mes, pagamentos = []) => {
    const ids = new Set();
    pagamentosDeSetor(unidade, mes, pagamentos).forEach(p => (p.venda_ids || []).forEach(id => ids.add(String(id))));
    return ids;
};

// Mensagem do banco quando a trava recusa (para mostrar ao usuário em vez de "erro de conexão")
export const mensagemDaTrava = (error) => (/pagamento/i.test(String(error?.message || '')) ? error.message : null);
