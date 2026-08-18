// ==========================================
// 🧠 UTILITÁRIOS GLOBAIS DE SISTEMA (B2B SaaS)
// Otimizado para Performance e Segurança
// ==========================================

export const safeNumber = (val) => {
    if (typeof val === 'number') return val;
    if (val === null || val === undefined || val === '') return 0;
    
    const str = String(val).trim();
    if (str.includes(',')) {
        // Brasileiro: 1.000,50 -> 1000.50
        return parseFloat(str.replace(/[^0-9,-]+/g, '').replace(',', '.')) || 0;
    }
    // Americano / Default: 1000.50 -> 1000.50
    return parseFloat(str.replace(/[^0-9.-]+/g, '')) || 0;
};

// 🔥 BLINDAGEM DE DATAS (O Bug Catcher)
export const safeIsoDate = (dInput) => {
    if (!dInput) return '';

    // Se receber um Objeto Date nativo (O causador do bug de exportação)
    if (dInput instanceof Date && !isNaN(dInput)) {
        const year = dInput.getFullYear();
        const month = String(dInput.getMonth() + 1).padStart(2, '0');
        const day = String(dInput.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    const dStr = String(dInput);
    if (dStr.includes('T')) return dStr.split('T')[0]; 
    if (dStr.includes('/')) {
        // Assume formato Brasileiro (DD/MM/YYYY)
        const partes = dStr.split('/');
        if(partes.length === 3) {
            const [d, m, y] = partes;
            return `${y}-${m}-${d}`; 
        }
    }
    return dStr;
};

// 🔥 PERFORMANCE: Formatter instanciado uma única vez na memória global (Cache)
const brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatMoney = (val) => {
    return brlFormatter.format(safeNumber(val));
};

export const formatDataBR = (dInput) => {
    if (!dInput) return '';
    
    const dStr = String(dInput);
    if (dStr.includes('/')) return dStr; // Já está no formato
    
    const partes = dStr.split('-');
    if (partes.length === 3) {
        // Ignora a hora caso venha junto com o traceço
        const day = partes[2].split('T')[0].split(' ')[0];
        return `${day}/${partes[1]}/${partes[0]}`;
    }
    return dStr;
};

export const extrairHoraCriacao = (isoString) => {
    if (!isoString) return '';
    const dataObj = new Date(isoString);
    // Valida se a conversão do Date falhou
    if (isNaN(dataObj)) return '';
    return dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

export const toTitleCase = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.toLowerCase().replace(/(?:^|\s)\w/g, match => match.toUpperCase());
};

// Transformação de Array do Catálogo em Dicionário O(1) de alta performance
export const buildCatalogoMap = (catalogoArray) => {
    const map = new Map();
    if (!Array.isArray(catalogoArray)) return map;

    catalogoArray.forEach(item => {
        if (item && item.nome && typeof item.nome === 'string') {
            map.set(item.nome.toUpperCase().trim(), item);
        }
    });
    return map;
};

// ==========================================
// 🚨 NOVO: MOTOR DE AUDITORIA (DUPLICIDADES)
// ==========================================
export const gerarChaveDuplicidade = (venda) => {
    if (!venda) return null;

    const unidade = (venda.unidade || 'MATRIZ').toUpperCase().trim();
    const dataVenda = safeIsoDate(venda.data || venda.created_at);
    const produto = (venda.produto || '').toUpperCase().trim();
    
    let identificadorAluno = '';
    
    // Matrícula é Ouro. Se existe, ela é a lei.
    if (venda.matricula && String(venda.matricula).trim() !== '') {
        identificadorAluno = `MAT_${String(venda.matricula).trim()}`;
    } else {
        // Fallback cauteloso para o nome
        const nomeSujo = venda.nome_aluno || venda.nome || 'ALUNO_NAO_IDENTIFICADO';
        identificadorAluno = `NOME_${nomeSujo.toUpperCase().trim().replace(/\s+/g, ' ')}`;
    }

    return `${unidade}|${dataVenda}|${identificadorAluno}|${produto}`;
};

export const meses = [
    { val: 'TODOS', label: 'Todos os Meses' }, 
    { val: '01', label: '01 - Janeiro' }, 
    { val: '02', label: '02 - Fevereiro' },
    { val: '03', label: '03 - Março' }, 
    { val: '04', label: '04 - Abril' }, 
    { val: '05', label: '05 - Maio' },
    { val: '06', label: '06 - Junho' }, 
    { val: '07', label: '07 - Julho' }, 
    { val: '08', label: '08 - Agosto' },
    { val: '09', label: '09 - Setembro' }, 
    { val: '10', label: '10 - Outubro' }, 
    { val: '11', label: '11 - Novembro' },
    { val: '12', label: '12 - Dezembro' }
];