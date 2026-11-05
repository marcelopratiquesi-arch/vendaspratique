import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';

// ==========================================
// 🧠 COMPONENTE REUTILIZÁVEL: Botão de Cópia
// ==========================================
const CopyButton = ({ textToCopy, label }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!textToCopy) return;

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(String(textToCopy).trim());
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = String(textToCopy).trim();
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                textArea.style.top = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                textArea.remove();
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Falha ao copiar conteúdo', err);
        }
    };

    if (!textToCopy) return null;

    return (
        <button
            type="button"
            onClick={handleCopy}
            onMouseDown={(e) => e.stopPropagation()} 
            onPointerDown={(e) => e.stopPropagation()} 
            className="p-1 text-slate-300 hover:text-blue-500 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500/40 rounded transition-all flex-shrink-0 dark:hover:bg-blue-500/10"
            title={copied ? tx("Copiado!") : label}
            aria-label={copied ? tx("Copiado") : label}
        >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
        </button>
    );
};

export default CopyButton;
