import React, { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';

export default function CopyButton({ value, label = 'Copiar', className = '' }) {
    const [copiado, setCopiado] = useState(false);

    useEffect(() => {
        if (copiado) {
            const timer = setTimeout(() => setCopiado(false), 1500);
            return () => clearTimeout(timer);
        }
    }, [copiado]);

    const handleCopy = async (e) => {
        e.stopPropagation();
        if (!value) return;
        
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(String(value));
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = String(value);
                textArea.style.position = "absolute";
                textArea.style.left = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                textArea.remove();
            }
            setCopiado(true);
        } catch (err) {
            console.error('Falha ao copiar:', err);
        }
    };

    if (!value) return null;

    return (
        <button
            type="button"
            onClick={handleCopy}
            title={copiado ? 'Copiado!' : label}
            aria-label={copiado ? 'Copiado!' : label}
            aria-live="polite"
            // Reduzido para w-6 h-6 (24x24px) - Bem pequeno e sutil
            className={`flex items-center justify-center shrink-0 w-6 h-6 rounded-md bg-white border border-slate-200 text-slate-400 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors focus:outline-none shadow-sm ${className}`}
        >
            {copiado ? (
                <Check className="w-3 h-3 text-emerald-500" strokeWidth={3} />
            ) : (
                <Copy className="w-3 h-3" strokeWidth={2} />
            )}
        </button>
    );
}