import { extrairLinhasPDF } from './pdfExtractor.js';
import { parseSuperbio } from './parseSuperbio.js';
import { parseInBody } from './parseInBody.js';

export async function processarExameBioimpedancia(file) {
  if (file.type !== 'application/pdf') {
    return { success: false, error: "Formato inválido. Por favor, envie um arquivo PDF." };
  }

  try {
    const linhasFisicas = await extrairLinhasPDF(file);
    
    // Regra 2: Console.log do Texto Bruto
    console.log("===== TEXTO BRUTO EXTRAÍDO (LINHAS FÍSICAS RECONSTRUÍDAS) =====");
    linhasFisicas.forEach((linha, index) => console.log(`Linha ${index}: ${linha}`));
    console.log("===== FIM TEXTO BRUTO =====");

    const textoBase = linhasFisicas.join(' ').toUpperCase();

    // Detecção
    if (textoBase.includes('PRATIQUE') || textoBase.includes('ANÁLISE SEGMENTAR') || textoBase.includes('SUPERBIO') || textoBase.includes('WHR')) {
       return parseSuperbio(linhasFisicas);
    } else if (textoBase.includes('INBODY') || textoBase.includes('MASSA MAGRA SEGMENTAR')) {
       return parseInBody(linhasFisicas);
    } else {
       return { success: false, error: "Modelo de exame não reconhecido ou documento inválido." };
    }

  } catch (error) {
    console.error(error);
    return { success: false, error: "Erro ao processar as coordenadas e extrair texto do documento." };
  }
}