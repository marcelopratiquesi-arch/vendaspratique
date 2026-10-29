// ==========================================
// UTILS: ALUNOS, CPF E SMART PASTE (DATA QUALITY ENGINE)
// ==========================================

export const normalizarNumeros = (str) => {
    if (!str) return '';
    return String(str).replace(/\D/g, '');
};

// --- NOME ---
export const normalizarNome = (str) => {
    if (!str) return '';
    return String(str).toUpperCase().trim().replace(/\s+/g, ' '); 
};

// --- CPF ---
export const mascaraCPF = (value) => {
    return normalizarNumeros(value)
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2')
        .replace(/(-\d{2})\d+?$/, '$1'); 
};

export const validarCPF = (cpf) => {
    const limpo = normalizarNumeros(cpf);
    if (limpo.length !== 11 || /^(\d)\1+$/.test(limpo)) return false;
    let soma = 0; let resto;
    for (let i = 1; i <= 9; i++) soma += parseInt(limpo.substring(i - 1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(limpo.substring(9, 10))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(limpo.substring(i - 1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(limpo.substring(10, 11))) return false;
    return true;
};

// --- TELEFONE ---
export const validarTelefone = (tel) => {
    const limpo = normalizarNumeros(tel);
    if (limpo.length >= 10 && limpo.length <= 13) return true;
    return false;
};

// Telefone como fica no banco: só números e SEM o 55 do Brasil (o TECACE exporta "55 31 9...").
export const telefoneSem55 = (tel) => {
    const limpo = normalizarNumeros(tel);
    return /^55\d{10,11}$/.test(limpo) ? limpo.slice(2) : limpo;
};

// Telefone de preenchimento, não é número de verdade (ex.: 9999999999, 31999999999, 31000000000)
export const telefoneFalso = (tel) => {
    const limpo = telefoneSem55(tel);
    return /^(\d)\1+$/.test(limpo) || /^\d{2}(\d)\1{7,8}$/.test(limpo);
};

// E-mail de preenchimento usado quando o aluno não informou (ex.: naoinformou@gmail.com)
export const emailFalso = (email) => {
    const usuario = String(email || '').toLowerCase().trim().split('@')[0];
    return ['naoinformou', 'naoinformado', 'naousar', 'naotem', 'sememail', 'confirmar', 'teste', 'nao', 'nt'].includes(usuario);
};

export const formatarTelefone = (tel) => {
    const limpo = normalizarNumeros(tel);
    if (limpo.length === 11) return limpo.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    if (limpo.length === 10) return limpo.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    if (limpo.length === 13 && limpo.startsWith('55')) return limpo.replace(/55(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    if (limpo.length === 12 && limpo.startsWith('55')) return limpo.replace(/55(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    return tel; 
};

// --- EMAIL ---
export const normalizarEmail = (email) => {
    if (!email) return '';
    return String(email).toLowerCase().trim();
};

export const validarEmail = (email) => {
    if (!email) return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};

// --- DATAS E IDADE ---
export const parseDataBrParaIso = (dataStr) => {
    if (!dataStr) return null;
    const parts = String(dataStr).split('/');
    if (parts.length === 3) {
        let dia = parts[0].trim().padStart(2, '0');
        let mes = parts[1].trim().padStart(2, '0');
        let ano = parts[2].trim();
        if (ano.length === 2) {
            ano = parseInt(ano, 10) > 50 ? '19' + ano : '20' + ano;
        }
        
        const anoNum = parseInt(ano, 10);
        const mesNum = parseInt(mes, 10);
        const diaNum = parseInt(dia, 10);
        if (anoNum < 1900 || anoNum > new Date().getFullYear()) return null;
        if (mesNum < 1 || mesNum > 12) return null;
        if (diaNum < 1 || diaNum > 31) return null;
        
        return `${ano}-${mes}-${dia}`;
    }
    if (dataStr.includes('-') && dataStr.length >= 10) {
        return dataStr.substring(0, 10);
    }
    return null;
};

export const calcularIdade = (dataNascimentoIso, dataReferencia = new Date()) => {
    if (!dataNascimentoIso) return null;
    const nasc = new Date(dataNascimentoIso + 'T00:00:00'); 
    if (isNaN(nasc)) return null;
    
    let idade = dataReferencia.getFullYear() - nasc.getFullYear();
    const mes = dataReferencia.getMonth() - nasc.getMonth();
    
    if (mes < 0 || (mes === 0 && dataReferencia.getDate() < nasc.getDate())) {
        idade--;
    }
    return idade;
};

// ==========================================
// PARSER DO EXCEL (SMART PASTE) - BLINDADO TECACE
// ==========================================
export const parseSmartPaste = (rawText) => {
    if (!rawText) return [];
    
    const lines = rawText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return [];

    let startIndex = 0;
    // Mapa padrão TECACE caso não tenha cabeçalho na cópia 
    let colMap = { matricula: 0, nome: 1, email: 2, telefone: 3, status: 4, cpf: 5, nascimento: -1 }; 

    const firstLine = lines[0].toUpperCase();
    
    if (firstLine.includes('NOME') || firstLine.includes('DOCUMENTO') || firstLine.includes('CPF') || firstLine.includes('MATRÍCULA') || firstLine.includes('MATRICULA')) {
        startIndex = 1; 
        const headers = firstLine.split('\t');
        
        colMap = {
            nome: headers.findIndex(h => h.includes('NOME')),
            cpf: headers.findIndex(h => h.includes('DOCUMENTO') || h.includes('CPF')),
            matricula: headers.findIndex(h => h.includes('MATRÍCULA') || h.includes('MATRICULA') || h.includes('ID')),
            telefone: headers.findIndex(h => h.includes('TELEFONE') || h.includes('CELULAR')),
            email: headers.findIndex(h => h.includes('EMAIL') || h.includes('E-MAIL')),
            status: headers.findIndex(h => h.trim() === 'STATUS' || h.trim() === 'SITUAÇÃO' || h.trim() === 'SITUACAO'),
            nascimento: headers.findIndex(h => h === 'NASCIMENTO' || h === 'DATA DE NASCIMENTO')
        };
    }

    const parsedData = [];
    const cpfSet = new Set(); 

    for (let i = startIndex; i < lines.length; i++) {
        const cols = lines[i].split('\t');
        
        const rawCpf = colMap.cpf >= 0 ? cols[colMap.cpf] : cols[5];
        let cleanCpf = normalizarNumeros(rawCpf || '');
        // O Excel apaga o zero da frente quando trata o CPF como número (04447961695 → 4447961695).
        // Completa com zeros e só aceita se o CPF continuar válido pelos dígitos verificadores.
        if (cleanCpf.length >= 9 && cleanCpf.length < 11 && validarCPF(cleanCpf.padStart(11, '0'))) {
            cleanCpf = cleanCpf.padStart(11, '0');
        }
        
        const rawNome = colMap.nome >= 0 ? cols[colMap.nome] : cols[1];
        const nome = normalizarNome(rawNome);

        if (!nome && !cleanCpf) continue; 

        // Extração Bruta baseada no TECACE
        const matricula = (colMap.matricula >= 0 ? cols[colMap.matricula] : cols[0])?.trim() || '';
        const telBruto = colMap.telefone >= 0 ? cols[colMap.telefone] : cols[3];
        const emailBruto = colMap.email >= 0 ? cols[colMap.email] : cols[2];
        const nascBruto = colMap.nascimento >= 0 ? cols[colMap.nascimento] : '';

        // Telefone sem o 55 (como fica no banco). Número de preenchimento (9999999999...) vira vazio:
        // o aluno fica com "cadastro incompleto" até a recepção pedir o número real.
        let telefone = telefoneSem55(telBruto || '');
        if (telefone && telefoneFalso(telefone)) telefone = '';
        let email = normalizarEmail(emailBruto);
        if (email && emailFalso(email)) email = '';
        let dataNascimento = parseDataBrParaIso(nascBruto || '');

        let status = 'NOVO';
        let avisos = [];

        if (!cleanCpf || !validarCPF(cleanCpf)) {
            status = 'CPF INVÁLIDO';
        } else if (cpfSet.has(cleanCpf)) {
            status = 'DUPLICADO NA LISTA';
        }

        if (cleanCpf) cpfSet.add(cleanCpf);

        if (telefone && !validarTelefone(telefone)) {
            avisos.push('Telefone');
            telefone = ''; 
        }
        if (email && !validarEmail(email)) {
            avisos.push('E-mail');
            email = ''; 
        }
        if (nascBruto && !dataNascimento) {
            avisos.push('Nascimento');
        }

        parsedData.push({
            status,
            avisos, 
            cpf: cleanCpf,
            cpf_mascarado: mascaraCPF(cleanCpf),
            nome: nome,
            matricula: matricula, 
            telefone: telefone,
            telefone_formatado: telefone ? formatarTelefone(telefone) : '',
            email: email,
            data_nascimento: dataNascimento,
            idade: calcularIdade(dataNascimento),
            // Status do TECACE como veio na lista (ATIVO, INATIVO, FINALIZADO...); usado pelo Smart Paste do CRM
            status_tecace: String((colMap.status >= 0 ? cols[colMap.status] : cols[4]) || '').trim().toUpperCase()
        });
    }
    
    return parsedData;
};