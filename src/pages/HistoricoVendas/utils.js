export const safeNumber = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const str = String(val);
    if (str.includes(',')) return parseFloat(str.replace(/[^0-9,-]+/g, '').replace(',', '.')) || 0;
    return parseFloat(str.replace(/[^0-9.-]+/g, '')) || 0;
};

export const safeIsoDate = (dStr) => {
    if (!dStr) return '';
    if (dStr.includes('-')) return dStr.split('T')[0]; 
    if (dStr.includes('/')) {
        const [d, m, y] = dStr.split('/');
        return `${y}-${m}-${d}`; 
    }
    return dStr;
};

export const formatMoney = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(safeNumber(val));
};

export const formatDataBR = (dStr) => {
    if (!dStr) return '';
    if (dStr.includes('/')) return dStr; 
    const partes = dStr.split('-');
    if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
    return dStr;
};

export const extrairHoraCriacao = (isoString) => {
    if (!isoString) return '';
    const dataObj = new Date(isoString);
    return dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

// NOVO: Função para formatar nomes próprios (Remove o ALL CAPS)
export const toTitleCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().replace(/(?:^|\s)\w/g, match => match.toUpperCase());
};

export const meses = [
    { val: 'TODOS', label: 'Todos os Meses' }, { val: '01', label: '01 - Janeiro' }, { val: '02', label: '02 - Fevereiro' },
    { val: '03', label: '03 - Março' }, { val: '04', label: '04 - Abril' }, { val: '05', label: '05 - Maio' },
    { val: '06', label: '06 - Junho' }, { val: '07', label: '07 - Julho' }, { val: '08', label: '08 - Agosto' },
    { val: '09', label: '09 - Setembro' }, { val: '10', label: '10 - Outubro' }, { val: '11', label: '11 - Novembro' },
    { val: '12', label: '12 - Dezembro' }
];