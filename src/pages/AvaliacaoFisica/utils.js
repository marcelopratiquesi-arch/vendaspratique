// ==========================================
// UTILS: Cálculos e Lógica de Avaliação Física 
// (Arquitetura Padronizada 2026 - Confiabilidade e Integração Multi-Contrato)
// ==========================================

/**
 * Faz o parsing numérico seguro, suportando decimais brasileiros (vírgula e ponto).
 * CRÍTICO: Diferencia ausência de dado (null) do número zero (0).
 */
export const parseNum = (val) => {
    if (val === null || val === undefined || String(val).trim() === '') return null;
    const str = String(val).trim().replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
};

/**
 * Normaliza a entrada de sexo biológico para garantir que falhas no formulário 
 * não resultem em avaliações femininas silenciosas por default.
 */
const normalizeSex = (sexo) => {
    if (!sexo || typeof sexo !== 'string') return 'M'; // Fallback de segurança primário
    const s = sexo.trim().toUpperCase();
    return s.startsWith('F') ? 'F' : 'M';
};

// 1. SMI (Índice de Massa Muscular Esquelética)
// Protocolo Referência: AWGS (Asian Working Group for Sarcopenia) adaptado.
export const calcularSMI = (bracoEsq, bracoDir, pernaEsq, pernaDir, alturaInput, sexoInput, t) => {
    let altura = parseNum(alturaInput);
    
    // Converte automaticamente para metros se for preenchido em centímetros (ex: 175 -> 1.75)
    if (altura !== null && altura > 3) {
        altura = altura / 100;
    }

    if (altura === null || altura <= 0) {
        return { value: null, valor: 0, valid: false, severity: 'missing', status: t('assessment.status.fillHeight', { defaultValue: 'Preencha a altura' }), cor: 'text-slate-400', bg: 'bg-slate-100' };
    }

    const be = parseNum(bracoEsq);
    const bd = parseNum(bracoDir);
    const pe = parseNum(pernaEsq);
    const pd = parseNum(pernaDir);

    // Proteção Clínica: O cálculo só avança se OS QUATRO membros possuírem dados.
    if (be === null || bd === null || pe === null || pd === null) {
        return { value: null, valor: 0, valid: false, severity: 'missing', status: t('assessment.status.fillData', { defaultValue: 'Dados insuficientes' }), cor: 'text-slate-400', bg: 'bg-slate-100' };
    }

    const mma = be + bd + pe + pd;

    if (mma <= 0) {
        return { value: null, valor: 0, valid: false, severity: 'danger', status: t('assessment.status.fillData', { defaultValue: 'Dados inválidos' }), cor: 'text-slate-400', bg: 'bg-slate-100' };
    }

    const smi = mma / (altura * altura);
    const sexo = normalizeSex(sexoInput);
    
    const valueNum = parseFloat(smi.toFixed(2));
    const valueStr = smi.toFixed(2);

    if (sexo === 'M') {
        if (smi >= 7.0) return { value: valueNum, valor: valueStr, valid: true, severity: 'success', status: t('assessment.status.great', { defaultValue: 'Normal / Saudável' }), cor: 'text-emerald-700', bg: 'bg-emerald-100' };
        if (smi >= 6.0) return { value: valueNum, valor: valueStr, valid: true, severity: 'warning', status: t('assessment.status.lowGrade1', { defaultValue: 'Baixo Grau I' }), cor: 'text-amber-700', bg: 'bg-amber-100' };
        return { value: valueNum, valor: valueStr, valid: true, severity: 'danger', status: t('assessment.status.lowGrade2', { defaultValue: 'Baixo Grau II' }), cor: 'text-rose-700', bg: 'bg-rose-100' };
    } else {
        if (smi >= 5.7) return { value: valueNum, valor: valueStr, valid: true, severity: 'success', status: t('assessment.status.great', { defaultValue: 'Normal / Saudável' }), cor: 'text-emerald-700', bg: 'bg-emerald-100' };
        if (smi >= 5.1) return { value: valueNum, valor: valueStr, valid: true, severity: 'warning', status: t('assessment.status.lowGrade1', { defaultValue: 'Baixo Grau I' }), cor: 'text-amber-700', bg: 'bg-amber-100' };
        return { value: valueNum, valor: valueStr, valid: true, severity: 'danger', status: t('assessment.status.lowGrade2', { defaultValue: 'Baixo Grau II' }), cor: 'text-rose-700', bg: 'bg-rose-100' };
    }
};

// 2. Hidratação Corporal Total
export const calcularHidratacao = (aguaTotal, pesoInput, sexoInput, t) => {
    const p = parseNum(pesoInput);
    const a = parseNum(aguaTotal);
    
    if (p === null || p <= 0 || a === null || a <= 0) {
        return { value: null, valor: 0, valid: false, severity: 'missing', status: t('assessment.status.awaitWeightWater', { defaultValue: 'Aguardando peso/água' }), cor: 'text-slate-400', bg: 'bg-slate-100' };
    }
    
    const pct = (a / p) * 100;
    const sexo = normalizeSex(sexoInput);
    
    const valueNum = parseFloat(pct.toFixed(1));
    const valueStr = pct.toFixed(1);

    // Teto Fisiológico: Impede que anomalias ou falhas de input (+75%) sejam elogiadas como "Ótimas"
    if (pct > 75) {
        return { value: valueNum, valor: valueStr, valid: true, severity: 'warning', status: t('assessment.status.atypical', { defaultValue: 'Atípico / Revisar' }), cor: 'text-orange-700', bg: 'bg-orange-100' };
    }

    if (sexo === 'M') {
        if (pct >= 60) return { value: valueNum, valor: valueStr, valid: true, severity: 'success', status: t('assessment.status.great', { defaultValue: 'Ótimo' }), cor: 'text-emerald-700', bg: 'bg-emerald-100' };
        if (pct >= 50) return { value: valueNum, valor: valueStr, valid: true, severity: 'warning', status: t('assessment.status.adequate', { defaultValue: 'Adequado' }), cor: 'text-amber-700', bg: 'bg-amber-100' };
        return { value: valueNum, valor: valueStr, valid: true, severity: 'danger', status: t('assessment.status.low', { defaultValue: 'Baixo' }), cor: 'text-rose-700', bg: 'bg-rose-100' };
    } else {
        if (pct >= 55) return { value: valueNum, valor: valueStr, valid: true, severity: 'success', status: t('assessment.status.great', { defaultValue: 'Ótimo' }), cor: 'text-emerald-700', bg: 'bg-emerald-100' };
        if (pct >= 45) return { value: valueNum, valor: valueStr, valid: true, severity: 'warning', status: t('assessment.status.adequate', { defaultValue: 'Adequado' }), cor: 'text-amber-700', bg: 'bg-amber-100' };
        return { value: valueNum, valor: valueStr, valid: true, severity: 'danger', status: t('assessment.status.low', { defaultValue: 'Baixo' }), cor: 'text-rose-700', bg: 'bg-rose-100' };
    }
};

// 3. RCQ (Relação Cintura-Quadril)
export const classificarRCQ = (rcqNum, sexoInput, t) => {
    const rcq = parseNum(rcqNum);
    
    if (rcq === null || rcq <= 0) {
        return { value: null, valor: 0, valid: false, severity: 'missing', status: t('assessment.status.awaitRcq', { defaultValue: 'Aguardando RCQ' }), cor: 'text-slate-400', bg: 'bg-slate-100' };
    }

    const sexo = normalizeSex(sexoInput);
    const valueNum = parseFloat(rcq.toFixed(2));
    const valueStr = rcq.toFixed(2);

    if (sexo === 'M') {
        if (rcq <= 0.90) return { value: valueNum, valor: valueStr, valid: true, severity: 'success', status: t('assessment.status.normal', { defaultValue: 'Normal' }), cor: 'text-emerald-700', bg: 'bg-emerald-100' };
        if (rcq <= 1.00) return { value: valueNum, valor: valueStr, valid: true, severity: 'warning', status: t('assessment.status.moderate', { defaultValue: 'Moderado' }), cor: 'text-amber-700', bg: 'bg-amber-100' };
        return { value: valueNum, valor: valueStr, valid: true, severity: 'danger', status: t('assessment.status.high', { defaultValue: 'Alto' }), cor: 'text-rose-700', bg: 'bg-rose-100' };
    } else {
        if (rcq <= 0.80) return { value: valueNum, valor: valueStr, valid: true, severity: 'success', status: t('assessment.status.normal', { defaultValue: 'Normal' }), cor: 'text-emerald-700', bg: 'bg-emerald-100' };
        if (rcq <= 0.85) return { value: valueNum, valor: valueStr, valid: true, severity: 'warning', status: t('assessment.status.moderate', { defaultValue: 'Moderado' }), cor: 'text-amber-700', bg: 'bg-amber-100' };
        return { value: valueNum, valor: valueStr, valid: true, severity: 'danger', status: t('assessment.status.high', { defaultValue: 'Alto' }), cor: 'text-rose-700', bg: 'bg-rose-100' };
    }
};

// 4. Gordura Visceral (Escala Referência: InBody 1 a 20+)
export const classificarGV = (gvNum, t) => {
    const gv = parseNum(gvNum);
    
    if (gv === null || gv <= 0) {
        return { value: null, valor: 0, valid: false, severity: 'missing', status: t('assessment.status.awaitGv', { defaultValue: 'Aguardando GV' }), cor: 'text-slate-400', bg: 'bg-slate-100' };
    }
    
    if (gv <= 9) return { value: gv, valor: gv, valid: true, severity: 'success', status: t('assessment.status.normal', { defaultValue: 'Normal' }), cor: 'text-emerald-700', bg: 'bg-emerald-100' };
    if (gv <= 14) return { value: gv, valor: gv, valid: true, severity: 'warning', status: t('assessment.status.moderate', { defaultValue: 'Moderado' }), cor: 'text-amber-700', bg: 'bg-amber-100' };
    return { value: gv, valor: gv, valid: true, severity: 'danger', status: t('assessment.status.high', { defaultValue: 'Alto' }), cor: 'text-rose-700', bg: 'bg-rose-100' };
};

// 5. Pressão Arterial
// Diretriz: SBC (Sociedade Brasileira de Cardiologia) adaptada - O pior cenário sobrepõe o melhor.
export const classificarPressao = (sistolica, diastolica, t) => {
    const sis = parseInt(sistolica, 10);
    const dia = parseInt(diastolica, 10);
    
    if (isNaN(sis) || isNaN(dia) || sis <= 0 || dia <= 0) {
        return { value: null, valor: '', valid: false, severity: 'missing', status: t('assessment.status.awaitMeasurement', { defaultValue: 'Aguardando aferição' }), cor: 'text-slate-400', bg: 'bg-slate-100' };
    }

    const valueStr = `${sis}/${dia}`;

    if (sis >= 180 || dia >= 110) return { value: valueStr, valor: valueStr, valid: true, severity: 'danger', status: t('assessment.status.hypertension3', { defaultValue: 'Hipertensão Estágio 3' }), cor: 'text-rose-700', bg: 'bg-rose-200' };
    if (sis >= 160 || dia >= 100) return { value: valueStr, valor: valueStr, valid: true, severity: 'danger', status: t('assessment.status.hypertension2', { defaultValue: 'Hipertensão Estágio 2' }), cor: 'text-rose-700', bg: 'bg-rose-100' };
    if (sis >= 140 || dia >= 90) return { value: valueStr, valor: valueStr, valid: true, severity: 'warning', status: t('assessment.status.hypertension1', { defaultValue: 'Hipertensão Estágio 1' }), cor: 'text-orange-700', bg: 'bg-orange-100' };
    if (sis >= 130 || dia >= 85) return { value: valueStr, valor: valueStr, valid: true, severity: 'warning', status: t('assessment.status.borderline', { defaultValue: 'Limítrofe' }), cor: 'text-amber-700', bg: 'bg-amber-100' };
    if (sis >= 120 || dia >= 80) return { value: valueStr, valor: valueStr, valid: true, severity: 'success', status: t('assessment.status.normal', { defaultValue: 'Normal' }), cor: 'text-emerald-700', bg: 'bg-emerald-100' };
    
    return { value: valueStr, valor: valueStr, valid: true, severity: 'success', status: t('assessment.status.optimal', { defaultValue: 'Ótima' }), cor: 'text-blue-700', bg: 'bg-blue-100' };
};