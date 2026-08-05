export const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

export const formatDataBR = (dataIso) => {
    if (!dataIso) return '';
    const partes = dataIso.split('-');
    if (partes.length !== 3) return dataIso;
    return `${partes[2]}/${partes[1]}/${partes[0]}`; // Formata YYYY-MM-DD para DD/MM/YYYY
};

export const formatarDataHora = (isoString) => {
    if (!isoString) return '';
    const data = new Date(isoString);
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' às ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

export const mesesLista = [
    { val: '01', label: '01 - Janeiro' }, { val: '02', label: '02 - Fevereiro' },
    { val: '03', label: '03 - Março' }, { val: '04', label: '04 - Abril' }, { val: '05', label: '05 - Maio' },
    { val: '06', label: '06 - Junho' }, { val: '07', label: '07 - Julho' }, { val: '08', label: '08 - Agosto' },
    { val: '09', label: '09 - Setembro' }, { val: '10', label: '10 - Outubro' }, { val: '11', label: '11 - Novembro' },
    { val: '12', label: '12 - Dezembro' }
];

export const getUltimos6Meses = () => {
    const mesesH = [];
    const hoje = new Date();
    for(let i=0; i<6; i++) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const mesStr = String(d.getMonth() + 1).padStart(2, '0');
        const anoStr = d.getFullYear();
        mesesH.push({ label: `${mesStr}/${anoStr}`, mes: mesStr, ano: anoStr.toString() });
    }
    return mesesH; 
};