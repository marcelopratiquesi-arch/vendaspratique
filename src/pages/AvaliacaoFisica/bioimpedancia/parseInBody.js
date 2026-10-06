function normalizarNumero(str) {
  if (!str) return null;
  const num = parseFloat(str.replace(',', '.'));
  return isNaN(num) ? null : num;
}

export function parseInBody(linhas) {
  // Contrato Intocável
  const data = {
    peso: null, altura: null, bracoEsq: null, bracoDir: null,
    pernaEsq: null, pernaDir: null, aguaTotal: null, rcq: null,
    gv: null, mme: null, pgc: null
  };
  
  const debug = {};

  const registrar = (campo, valor, origem) => {
    if (valor !== null && data[campo] === null && !isNaN(valor)) {
        data[campo] = valor;
        debug[campo] = { value: valor, source: origem, parser: "INBODY" };
    }
  };

  let gvFound = false;
  let singleNumberCount = 0;
  let bracosEncontrados = false;
  let pernasEncontradas = false;

  for (let i = 0; i < linhas.length; i++) {
     const linha = linhas[i].trim();

     // 1. ALTURA (Pega o número que está colado em "cm", ex: 162cm)
     if (data.altura === null) {
        const mAlt = linha.match(/(\d{2,3}[.,]?\d*)\s*cm/i);
        if (mAlt) {
            let alt = normalizarNumero(mAlt[1]);
            registrar('altura', alt > 3 ? alt / 100 : alt, linha);
        }
     }

     // 2. ÁGUA CORPORAL TOTAL (L)
     // A linha sempre começa com "(L) | " seguido do valor. Ex: "(L) | 35,4 | ( | 28,1~34,3 | )"
     if (data.aguaTotal === null) {
        const mAgua = linha.match(/^\(L\)\s*\|\s*([\d.,]+)\s*\|/i);
        if (mAgua) registrar('aguaTotal', normalizarNumero(mAgua[1]), linha);
     }

     // 3. PESO
     // A linha de peso tem esse formato exato: "(kg) | 68,9 | ( | 46,8~63,4 | ) | 62,6 | kg"
     if (data.peso === null) {
        const mPeso = linha.match(/^\(kg\)\s*\|\s*([\d.,]+)\s*\|\s*\([\s\S]*?\|\s*kg$/i);
        if (mPeso) registrar('peso', normalizarNumero(mPeso[1]), linha);
     }

     // 4. MASSA MUSCULAR ESQUELÉTICA (MME)
     // Linha isolada: "26,8 | kg | 20,9~25,5"
     if (data.mme === null) {
        const mMme = linha.match(/^([\d.,]+)\s*\|\s*kg\s*\|\s*[\d.,]+~[\d.,]+$/i);
        if (mMme) registrar('mme', normalizarNumero(mMme[1]), linha);
     }

     // 5. RELAÇÃO CINTURA-QUADRIL (RCQ)
     // Fica no final de uma linha de régua que termina com "0,75~0,85"
     if (data.rcq === null) {
        const mRcq = linha.match(/\|\s*%\s*\|\s*([0-1][.,]\d{2})\s*\|\s*0,\d{2}~0,\d{2}/i);
        if (mRcq) registrar('rcq', normalizarNumero(mRcq[1]), linha);
     }

     // 6. GORDURA VISCERAL (GV)
     // Linha exata: "8 | 1~9"
     if (data.gv === null) {
        const mGv = linha.match(/^(\d{1,2}(?:[.,]\d+)?)\s*\|\s*1~9$/i);
        if (mGv) {
            registrar('gv', normalizarNumero(mGv[1]), linha);
            gvFound = true; // Ativa o gatilho para achar o PGC!
        }
     }

     // 7. PGC (PERCENTUAL DE GORDURA CORPORAL)
     // Estratégia Mestre: Após a GV, a 1ª linha que tem só um número é o IMC (26,3). A 2ª linha é o PGC (30,1)!
     if (gvFound && data.pgc === null) {
        const isSingleNumber = /^[\d.,]+$/.test(linha);
        if (isSingleNumber) {
            singleNumberCount++;
            if (singleNumberCount === 2) {
                registrar('pgc', normalizarNumero(linha), `Segundo valor isolado após a linha da GV: ${linha}`);
            }
        }
     }

     // 8. MEMBROS CORPORAIS (Braços e Pernas)
     // Formato exato: "2,51kg | 2,68kg | 1,4kg | 1,3kg"
     const kgs = [...linha.matchAll(/([\d.,]+)\s*kg/gi)];
     if (kgs.length >= 4) {
        const valEsq = normalizarNumero(kgs[0][1]);
        const valDir = normalizarNumero(kgs[1][1]);
        
        // A primeira linha que bate nesse padrão é o Braço
        if (!bracosEncontrados) {
            registrar('bracoEsq', valEsq, `[Braços] ${linha}`);
            registrar('bracoDir', valDir, `[Braços] ${linha}`);
            bracosEncontrados = true;
        } 
        // A segunda linha é a Perna
        else if (!pernasEncontradas) {
            registrar('pernaEsq', valEsq, `[Pernas] ${linha}`);
            registrar('pernaDir', valDir, `[Pernas] ${linha}`);
            pernasEncontradas = true;
        }
     }
  }

  // --- LOG DE AUDITORIA EXIGIDO ---
  console.log("\n[INBODY] - FASE 2: AUDITORIA DE EXTRAÇÃO DEFINITIVA");
  Object.keys(data).forEach(campo => {
     console.log(`Campo: ${campo} -> Valor: ${debug[campo] ? debug[campo].value : 'null'} (Origem: ${debug[campo] ? debug[campo].source : 'Não encontrado'})`);
  });
  console.log("==================================\n");

  return { success: true, reportType: 'INBODY', data, warnings: [] };
}