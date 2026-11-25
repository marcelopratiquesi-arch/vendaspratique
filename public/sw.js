// Ajudante do navegador (service worker) do app "Vendas Pratique" (25/11/2026, decisão do dono).
// Só existe para o celular aceitar instalar o sistema como aplicativo.
// NÃO guarda telas nem dados em cache (o sistema muda toda hora): tudo continua vindo da internet.
// Avisos no celular (Fase B da receita) ainda não existem aqui.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
