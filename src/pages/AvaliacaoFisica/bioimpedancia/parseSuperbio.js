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
    if (valor !== null && data[campo] === null) {
        data[campo] = valor;
        debug[campo] = { value: valor, source: origem, parser: "SUPERBIO" };
    }
  };

  // Junta todas as linhas numa string única para facilitar a busca pelas palavras-chave exatas
  const txt = linhas.join(' ');

  // 1. ALTURA 
  const mAlt = txt.match(/Altura:\s*([\d.,]+)\s*cm/i) || txt.match(/Height[^\d]*([\d.,]+)\s*cm/i);
  if (mAlt) registrar('altura', normalizarNumero(mAlt[1]) > 3 ? normalizarNumero(mAlt[1])/100 : normalizarNumero(mAlt[1]), mAlt[0]);

  // 2. PESO (Pegando da tabela inferior para não confundir com o "Peso Alvo")
  const mPeso = txt.match(/\d{2}\/\d{2}\/\d{4}\s*\|\s*([\d.,]+)/i) || txt.match(/Massa corporal atual.*?([\d.,]+)\s*kg/i) || txt.match(/([\d.,]+)\s*kg\s*Análise da obesidade/i);
  if (mPeso) registrar('peso', normalizarNumero(mPeso[1]), mPeso[0]);

  // 3. PGC (Percentual de Gordura)
  const mPgc = txt.match(/corporal\s*\(\%\)\s*\|\s*([\d.,]+)/i) || txt.match(/gordura\s*corporal\s*\|\s*([\d.,]+)/i) || txt.match(/gordura corporal\s*(\d{1,2}[.,]\d+)\s*%/i);
  if (mPgc) registrar('pgc', normalizarNumero(mPgc[1]), mPgc[0]);

  // 4. RELAÇÃO CINTURA-QUADRIL (WHR)
  const mWHR = txt.match(/WHR\s*\|?\s*([0-1][.,]\d{2})/i) || txt.match(/WHR[^\d]*([0-1][.,]\d{2})/i);
  if (mWHR) registrar('rcq', normalizarNumero(mWHR[1]), mWHR[0]);

  // 5. GORDURA VISCERAL (GV)
  // Removemos temporariamente o texto do "Padrão: 1,0~9,0" da string de busca, para o regex não pegar o '1' ou '9' por acidente, capturando o 10.0 correto.
  const txtSemPadrao = txt.replace(/Padrão:\s*1[.,]0[~-]9[.,]0/gi, '');
  const mGV = txtSemPadrao.match(/Gordura visceral[^\d]*(\d{1,2}[.,]\d)/i);
  if (mGV) registrar('gv', normalizarNumero(mGV[1]), mGV[0]);

  // 6. MASSA MUSCULAR ESQUELÉTICA (MME)
  const mMME = txt.match(/Músculo\s*Esquelético.*?([\d.,]+)\s*kg/i) || txt.match(/Esquelético.*?([\d.,]+)\s*kg/i);
  if (mMME) registrar('mme', normalizarNumero(mMME[1]), mMME[0]);

  // 7. SEGMENTAÇÃO (BRAÇOS E PERNAS)
  // Conforme você instruiu, buscando exclusivamente a palavra "Músculo: X kg".
  // A ordem no PDF extraído sempre cai: [0] Braço Esq, [1] Braço Dir, [2] Perna Esq, [3] Perna Dir.
  const musculos = [...txt.matchAll(/Músculo:\s*\|?\s*([\d.,]+)\s*kg/gi)];
  if (musculos.length >= 4) {
      registrar('bracoEsq', normalizarNumero(musculos[0][1]), musculos[0][0]);
      registrar('bracoDir', normalizarNumero(musculos[1][1]), musculos[1][0]);
      registrar('pernaEsq', normalizarNumero(musculos[2][1]), musculos[2][0]);
      registrar('pernaDir', normalizarNumero(musculos[3][1]), musculos[3][0]);
  }

  // 8. ÁGUA (Convertida matematicamente porque a SuperBio só dá %)
  const mAgua = txt.match(/Água.*?([\d.,]+)\s*%/i);
  if (mAgua && data.peso) {
     let percent = normalizarNumero(mAgua[1]);
     let litros = parseFloat(((percent / 100) * data.peso).toFixed(1));
     registrar('aguaTotal', litros, `Calculado: ${percent}% de ${data.peso}kg`);
  }

  // LOG PARA AUDITORIA - FASE 1
  console.log("\n[SUPERBIO] - FASE 1: VALIDAÇÃO DAS CORREÇÕES");
  Object.keys(data).forEach(campo => {
     console.log(`Campo: ${campo} -> Valor: ${debug[campo] ? debug[campo].value : 'null'} (Origem: ${debug[campo] ? debug[campo].source : 'Não encontrado'})`);
  });
  console.log("==================================\n");

  return { success: true, reportType: 'SUPERBIO', data, warnings: [] };
}