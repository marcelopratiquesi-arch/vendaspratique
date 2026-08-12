export const maskCpf = (v) => {
    let text = v.replace(/\D/g, '');
    if (text.length > 11) text = text.substring(0, 11);
    text = text.replace(/(\d{3})(\d)/, '$1.$2');
    text = text.replace(/(\d{3})(\d)/, '$1.$2');
    text = text.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    return text;
};

export const maskPhone = (v) => {
    let text = v.replace(/\D/g, '');
    if (text.length > 11) text = text.substring(0, 11);
    text = text.replace(/(\d{2})(\d)/, '($1) $2');
    text = text.replace(/(\d{4,5})(\d{4})$/, '$1-$2');
    return text;
};

export const maskContaInter = (v) => {
    let text = v.replace(/\D/g, '');
    if (text.length > 1) {
        text = text.replace(/(\d+)(\d)$/, '$1-$2');
    }
    return text;
};

export const formatMoney = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};