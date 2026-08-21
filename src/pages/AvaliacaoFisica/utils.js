// ==========================================
// UTILS: Cálculos e Lógica de Avaliação Física (Blindado com i18n e suporte a vírgula)
// ==========================================

const parseNum = (val) => {
    if (!val && val !== 0) return 0;
    const str = String(val).trim().replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
};

// 1. SMI (Índice de Massa Muscular Esquelética)
export const calcularSMI = (bracoEsq, bracoDir, pernaEsq, pernaDir, alturaInput, sexo, t) => {
    let altura = parseNum(alturaInput);
    if (!altura || altura <= 0) {
        return { valor: 0, status: t('assessment.status.fillHeight', { defaultValue: 'Preencha a altura' }), cor: 'text-slate-400', bg: 'bg-slate-100' };
    }
    
    // Converte automaticamente para metros se for preenchido em centímetros (ex: 175 -> 1.75)
    if (altura > 3) {
        altura = altura / 100;
    }

    const be = parseNum(bracoEsq);
    const bd = parseNum(bracoDir);
    const pe = parseNum(pernaEsq);
    const pd = parseNum(pernaDir);
    const mma = be + bd + pe + pd;

    if (mma <= 0) {
        return { valor: 0, status: t('assessment.status.fillData', { defaultValue: 'Aguardando membros' }), cor: 'text-slate-400', bg: 'bg-slate-100' };
    }

    const smi = mma / (altura * altura);

    if (sexo === 'M') {
        if (smi >= 7.0) return { valor: smi.toFixed(2), status: t('assessment.status.great', { defaultValue: 'Normal / Saudável' }), cor: 'text-emerald-700', bg: 'bg-emerald-100' };
        if (smi >= 6.0) return { valor: smi.toFixed(2), status: t('assessment.status.lowGrade1', { defaultValue: 'Baixo Grau I' }), cor: 'text-amber-700', bg: 'bg-amber-100' };
        return { valor: smi.toFixed(2), status: t('assessment.status.lowGrade2', { defaultValue: 'Baixo Grau II' }), cor: 'text-rose-700', bg: 'bg-rose-100' };
    } else {
        if (smi >= 5.7) return { valor: smi.toFixed(2), status: t('assessment.status.great', { defaultValue: 'Normal / Saudável' }), cor: 'text-emerald-700', bg: 'bg-emerald-100' };
        if (smi >= 5.1) return { valor: smi.toFixed(2), status: t('assessment.status.lowGrade1', { defaultValue: 'Baixo Grau I' }), cor: 'text-amber-700', bg: 'bg-amber-100' };
        return { valor: smi.toFixed(2), status: t('assessment.status.lowGrade2', { defaultValue: 'Baixo Grau II' }), cor: 'text-rose-700', bg: 'bg-rose-100' };
    }
};

// 2. Hidratação
export const calcularHidratacao = (aguaTotal, peso, sexo, t) => {
    const p = parseNum(peso);
    const a = parseNum(aguaTotal);
    if (!p || p <= 0 || !a || a <= 0) {
        return { valor: 0, status: t('assessment.status.awaitWeightWater', { defaultValue: 'Aguardando peso/água' }), cor: 'text-slate-400', bg: 'bg-slate-100' };
    }
    
    const pct = (a / p) * 100;

    if (sexo === 'M') {
        if (pct > 60) return { valor: pct.toFixed(1), status: t('assessment.status.great', { defaultValue: 'Ótimo' }), cor: 'text-emerald-700', bg: 'bg-emerald-100' };
        if (pct >= 50) return { valor: pct.toFixed(1), status: t('assessment.status.adequate', { defaultValue: 'Adequado' }), cor: 'text-amber-700', bg: 'bg-amber-100' };
        return { valor: pct.toFixed(1), status: t('assessment.status.low', { defaultValue: 'Baixo' }), cor: 'text-rose-700', bg: 'bg-rose-100' };
    } else {
        if (pct > 55) return { valor: pct.toFixed(1), status: t('assessment.status.great', { defaultValue: 'Ótimo' }), cor: 'text-emerald-700', bg: 'bg-emerald-100' };
        if (pct >= 45) return { valor: pct.toFixed(1), status: t('assessment.status.adequate', { defaultValue: 'Adequado' }), cor: 'text-amber-700', bg: 'bg-amber-100' };
        return { valor: pct.toFixed(1), status: t('assessment.status.low', { defaultValue: 'Baixo' }), cor: 'text-rose-700', bg: 'bg-rose-100' };
    }
};

// 3. RCQ (Relação Cintura-Quadril)
export const classificarRCQ = (rcqNum, sexo, t) => {
    const rcq = parseNum(rcqNum);
    if (!rcq || rcq <= 0) return { valor: 0, status: t('assessment.status.awaitRcq', { defaultValue: 'Aguardando RCQ' }), cor: 'text-slate-400', bg: 'bg-slate-100' };

    if (sexo === 'M') {
        if (rcq < 0.9) return { valor: rcq.toFixed(2), status: t('assessment.status.normal', { defaultValue: 'Normal' }), cor: 'text-emerald-700', bg: 'bg-emerald-100' };
        if (rcq <= 1.0) return { valor: rcq.toFixed(2), status: t('assessment.status.moderate', { defaultValue: 'Moderado' }), cor: 'text-amber-700', bg: 'bg-amber-100' };
        return { valor: rcq.toFixed(2), status: t('assessment.status.high', { defaultValue: 'Alto' }), cor: 'text-rose-700', bg: 'bg-rose-100' };
    } else {
        if (rcq < 0.8) return { valor: rcq.toFixed(2), status: t('assessment.status.normal', { defaultValue: 'Normal' }), cor: 'text-emerald-700', bg: 'bg-emerald-100' };
        if (rcq <= 0.85) return { valor: rcq.toFixed(2), status: t('assessment.status.moderate', { defaultValue: 'Moderado' }), cor: 'text-amber-700', bg: 'bg-amber-100' };
        return { valor: rcq.toFixed(2), status: t('assessment.status.high', { defaultValue: 'Alto' }), cor: 'text-rose-700', bg: 'bg-rose-100' };
    }
};

// 4. Gordura Visceral
export const classificarGV = (gvNum, t) => {
    const gv = parseNum(gvNum);
    if (!gv || gv <= 0) return { valor: 0, status: t('assessment.status.awaitGv', { defaultValue: 'Aguardando GV' }), cor: 'text-slate-400', bg: 'bg-slate-100' };
    if (gv <= 9) return { valor: gv, status: t('assessment.status.normal', { defaultValue: 'Normal' }), cor: 'text-emerald-700', bg: 'bg-emerald-100' };
    if (gv <= 14) return { valor: gv, status: t('assessment.status.moderate', { defaultValue: 'Moderado' }), cor: 'text-amber-700', bg: 'bg-amber-100' };
    return { valor: gv, status: t('assessment.status.high', { defaultValue: 'Alto' }), cor: 'text-rose-700', bg: 'bg-rose-100' };
};

// 5. Pressão Arterial
export const classificarPressao = (sistolica, diastolica, t) => {
    const sis = parseInt(sistolica, 10);
    const dia = parseInt(diastolica, 10);
    if (!sis || !dia) return { status: t('assessment.status.awaitMeasurement', { defaultValue: 'Aguardando aferição' }), cor: 'text-slate-400', bg: 'bg-slate-100' };

    if (sis >= 180 || dia >= 110) return { status: t('assessment.status.hypertension3', { defaultValue: 'Hipertensão Estágio 3' }), cor: 'text-rose-700', bg: 'bg-rose-200' };
    if (sis >= 160 || dia >= 100) return { status: t('assessment.status.hypertension2', { defaultValue: 'Hipertensão Estágio 2' }), cor: 'text-rose-700', bg: 'bg-rose-100' };
    if (sis >= 140 || dia >= 90) return { status: t('assessment.status.hypertension1', { defaultValue: 'Hipertensão Estágio 1' }), cor: 'text-orange-700', bg: 'bg-orange-100' };
    if (sis >= 130 || dia >= 85) return { status: t('assessment.status.borderline', { defaultValue: 'Limítrofe' }), cor: 'text-amber-700', bg: 'bg-amber-100' };
    if (sis >= 120 || dia >= 80) return { status: t('assessment.status.normal', { defaultValue: 'Normal' }), cor: 'text-emerald-700', bg: 'bg-emerald-100' };
    
    return { status: t('assessment.status.optimal', { defaultValue: 'Ótima' }), cor: 'text-blue-700', bg: 'bg-blue-100' };
};