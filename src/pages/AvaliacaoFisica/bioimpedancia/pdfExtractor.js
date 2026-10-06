import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function extrairLinhasPDF(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let todasAsLinhas = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      const linhasMap = new Map();
      const TOLERANCIA_Y = 5; // Margem de erro em pixels para considerar que estão na mesma linha física

      textContent.items.forEach(item => {
         // O transform do PDF.js contém: [scaleX, skewY, skewX, scaleY, X, Y]
         const x = item.transform[4];
         const y = item.transform[5];
         const str = item.str.trim();
         
         if (!str) return;

         // Agrupa fragmentos que estão na mesma "altura" (linha horizontal)
         let linhaChave = null;
         for (let key of linhasMap.keys()) {
            if (Math.abs(key - y) <= TOLERANCIA_Y) {
               linhaChave = key;
               break;
            }
         }

         if (linhaChave === null) {
            linhaChave = y;
            linhasMap.set(linhaChave, []);
         }

         linhasMap.get(linhaChave).push({ x, text: str });
      });

      // Ordena as linhas de cima para baixo (No PDF, o Y começa no rodapé e sobe)
      const yOrdenados = Array.from(linhasMap.keys()).sort((a, b) => b - a);

      yOrdenados.forEach(y => {
         const itens = linhasMap.get(y);
         // Ordena os itens da esquerda para a direita no eixo X
         itens.sort((a, b) => a.x - b.x);
         const linhaTexto = itens.map(i => i.text).join(' | '); // Usamos " | " como separador visual
         todasAsLinhas.push(linhaTexto);
      });
    }
    
    return todasAsLinhas; // Entrega o texto arrumado em linhas físicas
  } catch (error) {
    console.error('[Bioimpedancia] Erro crítico ao extrair PDF:', error);
    throw new Error('Falha ao extrair linhas do documento. O arquivo pode estar corrompido.');
  }
}