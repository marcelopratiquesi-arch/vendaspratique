import React from 'react';

export const FundoGlobalComFotos = () => (
    <div className="fixed inset-0 w-full h-full overflow-hidden pointer-events-none z-[-1] bg-[#f4f7fb]">
        {/* Camadas de Cores e Luzes */}
        <div className="absolute top-[-15%] left-[-10%] w-[70vw] h-[70vw] max-w-[1000px] max-h-[1000px] bg-gradient-to-br from-blue-300/40 via-blue-200/20 to-transparent rounded-full blur-[120px]"></div>
        <div className="absolute top-[-10%] right-[-5%] w-[60vw] h-[60vw] max-w-[900px] max-h-[900px] bg-gradient-to-bl from-orange-300/20 via-amber-200/10 to-transparent rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[5%] left-[25%] w-[50vw] h-[50vw] max-w-[800px] max-h-[800px] bg-gradient-to-tr from-indigo-200/20 via-blue-100/10 to-transparent rounded-full blur-[100px]"></div>
        
        {/* Foto Mulher Fitness (Esquerda) */}
        <div className="absolute top-0 left-0 w-[50vw] max-w-[800px] h-[100vh] opacity-[0.6] mix-blend-multiply"
             style={{
                 backgroundImage: 'url("https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=1200&auto=format&fit=crop")',
                 backgroundSize: 'cover', backgroundPosition: 'top right',
                 WebkitMaskImage: 'radial-gradient(ellipse 90% 100% at left 20%, black 25%, transparent 75%)',
                 maskImage: 'radial-gradient(ellipse 90% 100% at left 20%, black 25%, transparent 75%)'
             }}>
        </div>
        
        {/* Foto Homem Fitness (Direita) */}
        <div className="absolute top-0 right-0 w-[50vw] max-w-[800px] h-[100vh] opacity-[0.5] mix-blend-multiply"
             style={{
                 backgroundImage: 'url("https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=1200&auto=format&fit=crop")',
                 backgroundSize: 'cover', backgroundPosition: 'top left',
                 WebkitMaskImage: 'radial-gradient(ellipse 90% 100% at right 20%, black 25%, transparent 75%)',
                 maskImage: 'radial-gradient(ellipse 90% 100% at right 20%, black 25%, transparent 75%)'
             }}>
        </div>
        
        {/* Overlay Ultra Sutil */}
        <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px]"></div>
    </div>
);