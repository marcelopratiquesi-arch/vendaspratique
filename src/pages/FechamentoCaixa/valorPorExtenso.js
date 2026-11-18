// Valor em reais por extenso: 273.38 → "duzentos e setenta e três reais e trinta e oito centavos"
const UN = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CEN = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

const ate999 = (n) => {
    if (n === 100) return 'cem';
    const partes = [];
    const c = Math.floor(n / 100), r = n % 100;
    if (c) partes.push(CEN[c]);
    if (r) {
        if (r < 20) partes.push(UN[r]);
        else { const d = Math.floor(r / 10), u = r % 10; partes.push(u ? `${DEZ[d]} e ${UN[u]}` : DEZ[d]); }
    }
    return partes.join(' e ');
};

const inteiroPorExtenso = (n) => {
    if (n === 0) return 'zero';
    const milhoes = Math.floor(n / 1000000), milhares = Math.floor((n % 1000000) / 1000), resto = n % 1000;
    const partes = [];
    if (milhoes) partes.push(milhoes === 1 ? 'um milhão' : `${ate999(milhoes)} milhões`);
    if (milhares) partes.push(milhares === 1 ? 'mil' : `${ate999(milhares)} mil`);
    if (resto) partes.push(ate999(resto));
    // "e" antes do último bloco quando ele é menor que 100 ou centena exata
    const ultimoSimples = resto ? (resto < 100 || resto % 100 === 0) : (milhares < 100 || milhares % 100 === 0);
    if (partes.length > 1 && ultimoSimples) {
        const ultimo = partes.pop();
        return `${partes.join(' ')} e ${ultimo}`;
    }
    return partes.join(' ');
};

export const valorPorExtenso = (valor) => {
    const centavosTotal = Math.round((Number(valor) || 0) * 100);
    const reais = Math.floor(centavosTotal / 100), cent = centavosTotal % 100;
    const txtReais = `${inteiroPorExtenso(reais)} ${reais === 1 ? 'real' : 'reais'}`;
    if (!cent) return txtReais;
    const txtCent = `${inteiroPorExtenso(cent)} ${cent === 1 ? 'centavo' : 'centavos'}`;
    return reais ? `${txtReais} e ${txtCent}` : txtCent;
};
