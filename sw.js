// =====================================================================
//  ZELO — Service Worker
//  - Habilita instalação como PWA
//  - Recebe conteúdo compartilhado de outros apps (Web Share Target)
// =====================================================================

const CACHE_VERSION = 'zelo-v1';

// Install básico — não pré-cacheia nada (queremos sempre a versão atual online)
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Intercepta o POST do Share Target e guarda o conteúdo pra app consumir
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Share Target handler: POST em ./share-target
  if (event.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith(handleShare(event.request));
    return;
  }
});

async function handleShare(request) {
  try {
    const formData = await request.formData();
    const title = formData.get('title') || '';
    const text  = formData.get('text') || '';
    const link  = formData.get('url') || '';
    const files = formData.getAll('image');

    // Salva num IndexedDB simples pra app pegar na próxima tela
    const shared = {
      title: title.toString(),
      text: text.toString(),
      url: link.toString(),
      ts: Date.now(),
      files: []
    };

    // Converte arquivos pra blob+type e salva
    for (const f of files) {
      if (f && f.size > 0) {
        shared.files.push({ name: f.name || 'foto.jpg', type: f.type || 'image/jpeg', blob: f });
      }
    }

    await idbSet('lastShare', shared);

    // Redireciona pra abertura da tela de gasto
    return Response.redirect('./?shared=1', 303);
  } catch (e) {
    console.error('share handler:', e);
    return Response.redirect('./?share_error=1', 303);
  }
}

// ------- IndexedDB mini-helper (sem libs) -------
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('zelo-share', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}
async function idbSet(key, val) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(val, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = () => reject(tx.error);
  });
}
