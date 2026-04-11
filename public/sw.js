self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Base mínima para que el navegador reconozca el service worker.
  // Más adelante podemos agregar caché offline si quieres.
});
