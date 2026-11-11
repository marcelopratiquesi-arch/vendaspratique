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

// A venda está num mês com pagamento aprovado (ativo) da unidade dela?
export const vendaTravada = (venda, pagamentos = []) => {
    const mes = String(venda?.data || '').slice(0, 7);
    const un = normalizarUnidade(venda?.unidade);
    return pagamentos.some(p => p.ativo !== false && p.mes === mes && normalizarUnidade(p.unidade) === un);
};
export const pagamentoDe = (unidade, mes, pagamentos = []) => pagamentos.find(p => p.ativo !== false && p.mes === mes && normalizarUnidade(p.unidade) === normalizarUnidade(unidade)) || null;

// Mensagem do banco quando a trava recusa (para mostrar ao usuário em vez de "erro de conexão")
export const mensagemDaTrava = (error) => (/pagamento/i.test(String(error?.message || '')) ? error.message : null);
