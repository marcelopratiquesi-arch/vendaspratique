// Ajudante do navegador (service worker) do app "Vendas Pratique".
// (1) Deixa o celular instalar o sistema como aplicativo (25/11/2026).
// (2) Mostra os AVISOS NO CELULAR mandados pelo Admin (Fase B, 25/11/2026) e, ao tocar, abre a tela do aviso.
// NÃO guarda telas nem dados em cache (o sistema muda toda hora): tudo continua vindo da internet.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

// Chegou um aviso (o servidor manda só título, texto e link)
self.addEventListener('push', (e) => {
    let d = {};
    try { d = e.data ? e.data.json() : {}; } catch { d = { texto: e.data ? e.data.text() : '' }; }
    const titulo = d.titulo || 'Vendas Pratique';
    e.waitUntil(self.registration.showNotification(titulo, {
        body: d.texto || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-96.png', // desenho branco sem fundo (barra do Android)
        data: { link: d.link || '/' },
    }));
});

// Tocou no aviso: traz o sistema para a frente (ou abre) já na tela do aviso
self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    const destino = new URL(e.notification.data?.link || '/', self.location.origin).href;
    e.waitUntil((async () => {
        const abas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const aba of abas) {
            if (new URL(aba.url).origin === self.location.origin && 'focus' in aba) {
                await aba.focus();
                if ('navigate' in aba) await aba.navigate(destino).catch(() => {});
                return;
            }
        }
        await self.clients.openWindow(destino);
    })());
});
