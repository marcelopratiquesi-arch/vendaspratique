// ==========================================
// DIMINUIR FOTO ANTES DE GUARDAR (economia de espaço no Supabase, 19/11/2026, decisão do dono)
// Foto tirada no celular chega com 3 a 5 MB. Antes de guardar, ela é redesenhada com no máximo `ladoMaximo` pixels
// no lado maior e salva em JPEG (fica com algumas centenas de KB e continua legível).
// Não mexe em: PDF, vídeo, GIF (pode ser animado), SVG, foto já pequena, ou se o resultado não ficar menor.
// Se qualquer coisa der errado, devolve o arquivo original (nunca impede de salvar).
// ==========================================

const TIPOS_QUE_REDUZEM = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'];
const TAMANHO_MINIMO_BYTES = 400 * 1024; // abaixo disso já está leve

const carregarImagem = (arquivo) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
});

/**
 * Devolve um File menor (JPEG) ou o próprio arquivo, se não for o caso de reduzir.
 * @param {File} arquivo
 * @param {{ ladoMaximo?: number, qualidade?: number }} opcoes
 */
export const reduzirImagem = async (arquivo, { ladoMaximo = 1600, qualidade = 0.82 } = {}) => {
    try {
        if (!(arquivo instanceof File)) return arquivo;
        if (!TIPOS_QUE_REDUZEM.includes(String(arquivo.type || '').toLowerCase())) return arquivo;
        if (arquivo.size < TAMANHO_MINIMO_BYTES) return arquivo;

        const img = await carregarImagem(arquivo);
        const escala = Math.min(1, ladoMaximo / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
        const largura = Math.max(1, Math.round(img.naturalWidth * escala));
        const altura = Math.max(1, Math.round(img.naturalHeight * escala));

        const canvas = document.createElement('canvas');
        canvas.width = largura;
        canvas.height = altura;
        const ctx = canvas.getContext('2d');
        if (!ctx) return arquivo;
        ctx.fillStyle = '#ffffff'; // PNG com fundo transparente não fica preto no JPEG
        ctx.fillRect(0, 0, largura, altura);
        ctx.drawImage(img, 0, 0, largura, altura);

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', qualidade));
        if (!blob || blob.size >= arquivo.size) return arquivo;

        const nomeBase = String(arquivo.name || 'imagem').replace(/\.[^.]+$/, '');
        return new File([blob], `${nomeBase}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
    } catch (erro) {
        console.warn('Não foi possível diminuir a imagem; guardando a original:', erro);
        return arquivo;
    }
};
