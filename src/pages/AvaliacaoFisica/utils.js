// ==========================================
// UTILS: Cálculos e Lógica de Avaliação Física
// ==========================================

// 1. SMI (Índice de Massa Muscular Esquelética)
export const calcularSMI = (bracoEsq, bracoDir, pernaEsq, pernaDir, alturaM, sexo) => {
    const altura = parseFloat(alturaM);
    if (!altura || altura <= 0) return { valor: 0, status: 'Preencha a altura', cor: 'text-slate-400', bg: 'bg-slate-100' };
    
    const mma = parseFloat(bracoEsq || 0) + parseFloat(bracoDir || 0) + parseFloat(pernaEsq || 0) + parseFloat(pernaDir || 0);
    const smi = mma / (altura * altura);

    if (sexo === 'M') {
        if (smi > 7.0) return { valor: smi.toFixed(2), status: 'Ótimo', cor: 'text-emerald-700', bg: 'bg-emerald-100' };
        if (smi >= 6.0) return { valor: smi.toFixed(2), status: 'Baixo Grau I', cor: 'text-amber-700', bg: 'bg-amber-100' };
        return { valor: smi.toFixed(2), status: 'Baixo Grau II', cor: 'text-rose-700', bg: 'bg-rose-100' };
    } else {
        if (smi > 5.7) return { valor: smi.toFixed(2), status: 'Ótimo', cor: 'text-emerald-700', bg: 'bg-emerald-100' };
        if (smi >= 5.1) return { valor: smi.toFixed(2), status: 'Baixo Grau I', cor: 'text-amber-700', bg: 'bg-amber-100' };
        return { valor: smi.toFixed(2), status: 'Baixo Grau II', cor: 'text-rose-700', bg: 'bg-rose-100' };
    }
};

// 2. Hidratação
export const calcularHidratacao = (aguaTotal, peso, sexo) => {
    const p = parseFloat(peso);
    const a = parseFloat(aguaTotal);
    if (!p || p <= 0 || !a) return { valor: 0, status: 'Aguardando peso/água', cor: 'text-slate-400', bg: 'bg-slate-100' };
    
    const pct = (a / p) * 100;

    if (sexo === 'M') {
        if (pct > 60) return { valor: pct.toFixed(1), status: 'Ótimo', cor: 'text-emerald-700', bg: 'bg-emerald-100' };
        if (pct >= 50) return { valor: pct.toFixed(1), status: 'Adequado', cor: 'text-amber-700', bg: 'bg-amber-100' };
        return { valor: pct.toFixed(1), status: 'Baixo', cor: 'text-rose-700', bg: 'bg-rose-100' };
    } else {
        if (pct > 55) return { valor: pct.toFixed(1), status: 'Ótimo', cor: 'text-emerald-700', bg: 'bg-emerald-100' };
        if (pct >= 45) return { valor: pct.toFixed(1), status: 'Adequado', cor: 'text-amber-700', bg: 'bg-amber-100' };
        return { valor: pct.toFixed(1), status: 'Baixo', cor: 'text-rose-700', bg: 'bg-rose-100' };
    }
};

// 3. RCQ (Relação Cintura-Quadril)
export const classificarRCQ = (rcqNum, sexo) => {
    const rcq = parseFloat(rcqNum);
    if (!rcq || rcq <= 0) return { valor: 0, status: 'Aguardando RCQ', cor: 'text-slate-400', bg: 'bg-slate-100' };

    if (sexo === 'M') {
        if (rcq < 0.9) return { valor: rcq.toFixed(2), status: 'Normal', cor: 'text-emerald-700', bg: 'bg-emerald-100' };
        if (rcq <= 1.0) return { valor: rcq.toFixed(2), status: 'Moderado', cor: 'text-amber-700', bg: 'bg-amber-100' };
        return { valor: rcq.toFixed(2), status: 'Alto', cor: 'text-rose-700', bg: 'bg-rose-100' };
    } else {
        if (rcq < 0.8) return { valor: rcq.toFixed(2), status: 'Normal', cor: 'text-emerald-700', bg: 'bg-emerald-100' };
        if (rcq <= 0.85) return { valor: rcq.toFixed(2), status: 'Moderado', cor: 'text-amber-700', bg: 'bg-amber-100' };
        return { valor: rcq.toFixed(2), status: 'Alto', cor: 'text-rose-700', bg: 'bg-rose-100' };
    }
};

// 4. Gordura Visceral
export const classificarGV = (gvNum) => {
    const gv = parseFloat(gvNum);
    if (!gv || gv <= 0) return { valor: 0, status: 'Aguardando GV', cor: 'text-slate-400', bg: 'bg-slate-100' };
    if (gv <= 9) return { valor: gv, status: 'Normal', cor: 'text-emerald-700', bg: 'bg-emerald-100' };
    if (gv <= 14) return { valor: gv, status: 'Moderado', cor: 'text-amber-700', bg: 'bg-amber-100' };
    return { valor: gv, status: 'Alto', cor: 'text-rose-700', bg: 'bg-rose-100' };
};

// 5. Pressão Arterial
export const classificarPressao = (sistolica, diastolica) => {
    const sis = parseInt(sistolica);
    const dia = parseInt(diastolica);
    if (!sis || !dia) return { status: 'Aguardando aferição', cor: 'text-slate-400', bg: 'bg-slate-100' };

    if (sis >= 180 || dia >= 110) return { status: 'Hipertensão Estágio 3', cor: 'text-rose-700', bg: 'bg-rose-200' };
    if (sis >= 160 || dia >= 100) return { status: 'Hipertensão Estágio 2', cor: 'text-rose-700', bg: 'bg-rose-100' };
    if (sis >= 140 || dia >= 90) return { status: 'Hipertensão Estágio 1', cor: 'text-orange-700', bg: 'bg-orange-100' };
    if (sis >= 130 || dia >= 85) return { status: 'Limítrofe', cor: 'text-amber-700', bg: 'bg-amber-100' };
    if (sis >= 120 || dia >= 80) return { status: 'Normal', cor: 'text-emerald-700', bg: 'bg-emerald-100' };
    
    return { status: 'Ótima', cor: 'text-blue-700', bg: 'bg-blue-100' };
};