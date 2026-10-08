function normalizarNumero(str) {
  if (!str) return null;
  const num = parseFloat(str.replace(',', '.'));
  return isNaN(num) ? null : num;
}

export function parseSuperbio(linhas) {
  const data = {
    peso: null, altura: null, bracoEsq: null, bracoDir: null,
    pernaEsq: null, pernaDir: null, aguaTotal: null, rcq: null,
    gv: null, mme: null, pgc: null
  };
  
  const debug = {};

  const registrar = (campo, valor, origem) => {
    if (valor !== null && data[campo] === null && !isNaN(valor)) {
        data[campo] = valor;
        debug[campo] = { value: valor, source: origem, parser: "SUPERBIO_VISBODY" };
    }
  };

  // Junta todas as linhas numa string única para facilitar a busca
  const txt = linhas.join(' ');

  // 1. ALTURA (Ex: "Altura | ： | 184 cm")
  const mAlt = txt.match(/Altura\s*\|\s*[：:]\s*([\d.,]+)\s*cm/i) || txt.match(/Height[^\d]*([\d.,]+)\s*cm/i);
  if (mAlt) {
     let alt = normalizarNumero(mAlt[1]);
     if (alt > 3) alt = alt / 100; // Converte 184 para 1.84m
     registrar('altura', alt, mAlt[0]);
  }

  // 2. PESO (Ex: "Peso | 98.9")
  const mPeso = txt.match(/Peso\s*\|\s*([\d.,]+)/i) || 
                txt.match(/\d{2}\/\d{2}\/\d{4}\s*\|\s*([\d.,]+)/i) ||
                txt.match(/(?:Massa corporal atual|Current body mass).*?([\d.,]+)\s*kg/i);
  if (mPeso) registrar('peso', normalizarNumero(mPeso[1]), mPeso[0]);

  // 3. PGC (Percentual de Gordura - Pega da tabela de tendências ex: "08/10/2026 | 101.9 | 19.3")
  const mPgc = txt.match(/\d{2}\/\d{2}\/\d{4}\s*\|\s*[\d.,]+\s*\|\s*([\d.,]+)/i) || 
               txt.match(/(?:corporal\s*\(\%\)|Percent Body Fat\(\%\))\s*\|\s*([\d.,]+)/i) || 
               txt.match(/(?:gordura\s*corporal|Percent Body Fat)\s*\|\s*([\d.,]+)/i);
  if (mPgc) registrar('pgc', normalizarNumero(mPgc[1]), mPgc[0]);

  // 4. RELAÇÃO CINTURA-QUADRIL (RCQ)
  const mRcq = txt.match(/Relação Cintura-Quadril\s*\|\s*([0-1][.,]\d{2})/i) || txt.match(/WHR\s*\|?\s*([0-1][.,]\d{2})/i);
  if (mRcq) registrar('rcq', normalizarNumero(mRcq[1]), mRcq[0]);

  // 5. GORDURA VISCERAL (GV)
  const txtSemPadrao = txt.replace(/(?:Padrão|Standard):\s*1[.,]0[~-]9[.,]0/gi, '');
  const mGv = txtSemPadrao.match(/VIS-Gordura.*?(\d{1,2}[.,]\d)/i) || txtSemPadrao.match(/(?:Gordura visceral|Visceral Fat)[^\d]*(\d{1,2}[.,]\d)/i);
  if (mGv) registrar('gv', normalizarNumero(mGv[1]), mGv[0]);

  // 6. MASSA MUSCULAR ESQUELÉTICA (MME)
  const mMme = txt.match(/Peso Muscular.*?([\d.,]+)\s*kg/i) || txt.match(/(?:Músculo\s*Esquelético|Skeletal Muscle).*?([\d.,]+)\s*kg/i);
  if (mMme) registrar('mme', normalizarNumero(mMme[1]), mMme[0]);

  // 7. SEGMENTAÇÃO
  const musculos = [...txt.matchAll(/Muscul:\s*\|\s*([\d.,]+)\s*kg/gi)];
  if (musculos.length >= 4) {
      registrar('bracoDir', normalizarNumero(musculos[0][1]), musculos[0][0]);
      registrar('bracoEsq', normalizarNumero(musculos[1][1]), musculos[1][0]);
      registrar('pernaEsq', normalizarNumero(musculos[2][1]), musculos[2][0]); // Atenção à ordem invertida no PDF
      registrar('pernaDir', normalizarNumero(musculos[3][1]), musculos[3][0]);
  }

  // 8. ÁGUA
  const mAgua = txt.match(/(?:ÁGUA|Water).*?([\d.,]+)\s*%/i);
  if (mAgua && data.peso) {
      let percent = normalizarNumero(mAgua[1]);
      let litros = parseFloat(((percent / 100) * data.peso).toFixed(1));
      registrar('aguaTotal', litros, `Calculado: ${percent}% de ${data.peso}kg`);
  }

  // LOG PARA AUDITORIA
  console.log("\n[SUPERBIO] - RESULTADO DA EXTRAÇÃO (NOVO MODELO)");
  Object.keys(data).forEach(campo => {
      console.log(`Campo: ${campo} -> Valor: ${debug[campo] ? debug[campo].value : 'null'}`);
  });
  console.log("==================================\n");

  return { success: true, reportType: 'SUPERBIO', data, warnings: [] };
}