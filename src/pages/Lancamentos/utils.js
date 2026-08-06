export const safeNumber = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const str = String(val).replace(/[^0-9,-]+/g, ''); 
    if (str.includes(',')) return parseFloat(str.replace(',', '.')) || 0;
    return parseFloat(str) || 0;
};

export const formatMoney = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(safeNumber(val));
};

// ESSA FUNÇÃO SALVA SUA VIDA CONTRA O BUG DO FUSO HORÁRIO
export const getLocalDateISO = () => {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
};