import React from 'react';

export const Badge = ({ type, text }) => {
    let colors = "bg-slate-100 text-slate-700";
    if (type === 'produto') {
        if (text && text.includes('NUTRI')) colors = "bg-emerald-100 text-emerald-800";
        else if (text && text.includes('PLUS')) colors = "bg-blue-100 text-blue-800";
        else if (text && text.includes('FIT')) colors = "bg-cyan-100 text-cyan-800";
        else colors = "bg-amber-100 text-amber-800";
    } else if (type === 'vendedor') {
        colors = "bg-[#0f172a] text-white";
    }
    return <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wider uppercase whitespace-nowrap shadow-sm ${colors}`}>{text}</span>;
};

// Exatamente o Card do seu Print!
export const Card = ({ title, value, icon, subtitle }) => (
    <div className="bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 flex items-center space-x-5 transition-transform hover:-translate-y-1">
        {/* Caixa do Ícone com Sombra Azul Brilhante */}
        <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-[0_8px_20px_rgba(37,99,235,0.4)] flex-shrink-0">
            {icon}
        </div>
        <div>
            {/* Textos com a formatação igual ao print */}
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</h3>
            <p className="text-3xl font-black text-slate-800 tracking-tight">{value}</p>
            {subtitle && <p className="text-[10px] text-blue-500 mt-1 font-bold uppercase tracking-wider">{subtitle}</p>}
        </div>
    </div>
);