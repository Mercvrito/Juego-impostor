const CACHE_NAME = 'undercover-v4-pwa';
const urlsToCache = [
  '/',
  '/style.css',
  '/client.js',
  '/manifest.json',
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png'
];

// ===========================================
// INSTALL
// ===========================================
self.addEventListener('install', (event) => {
  console.log('🔄 Service Worker instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('✅ Cache abierto');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ Todos los recursos cacheados');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.log('❌ Error durante la instalación:', error);
      })
  );
});

// ===========================================
// ACTIVATE
// ===========================================
self.addEventListener('activate', (event) => {
  console.log('🔄 Service Worker activando...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Eliminando cache viejo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker activado');
      return self.clients.claim();
    })
  );
});

// ===========================================
// FETCH
// ===========================================
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Devuelve el recurso cacheado si existe
        if (response) return response;

        // Intenta hacer la petición de red
        return fetch(event.request)
          .catch(() => {
            // Si falla la petición (offline), devuelve un fallback
            if (event.request.destination === 'document') {
              return new Response(`
                <!DOCTYPE html>
                <html lang="es">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Undercover 88</title>
                  <style>
                    body {
                      display: flex;
                      justify-content: center;
                      align-items: center;
                      height: 100vh;
                      margin: 0;
                      font-family: sans-serif;
                      background-color: #1c1c1c;
                      color: #fff;
                      text-align: center;
                    }
                    h1 {
                      font-size: 3rem;
                    }
                  </style>
                </head>
                <body>
                  <h1>Undercover 88</h1>
                  <p>Estás offline o el recurso no está disponible.</p>
                </body>
                </html>
              `, { headers: { 'Content-Type': 'text/html' } });
            }
            // Si no es un documento, solo devuelve un fallo
            return new Response('', { status: 404, statusText: 'Not Found' });
          });
      })
  );
});
