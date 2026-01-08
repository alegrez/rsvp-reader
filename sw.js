const CACHE_NAME = 'rsvp-reader-v1';
const STATIC_ASSETS = [
    './',
    './index.html',
    './mobile.html',
    './css/style.css',
    './css/desktop.css',
    './css/mobile.css',
    './js/rsvp-core.js',
    './js/epub-bridge.js',
    './js/storage.js',
    './js/desktop.js',
    './js/mobile.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
];

// External CDN resources to cache
const CDN_ASSETS = [
    'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
    'https://cdn.jsdelivr.net/npm/epubjs/dist/epub.min.js',
    'https://cdn.jsdelivr.net/npm/idb-keyval@6/dist/umd.js',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Caching static assets');
            // Cache static assets first
            return cache.addAll(STATIC_ASSETS).then(() => {
                // Try to cache CDN assets, but don't fail if they're unavailable
                return Promise.allSettled(
                    CDN_ASSETS.map((url) =>
                        fetch(url, { mode: 'cors' })
                            .then((response) => {
                                if (response.ok) {
                                    return cache.put(url, response);
                                }
                            })
                            .catch(() => console.log('Could not cache:', url)),
                    ),
                );
            });
        }),
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)));
        }),
    );
    self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Handle navigation requests
    if (request.mode === 'navigate') {
        event.respondWith(
            caches
                .match(request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return fetch(request).then((response) => {
                        // Cache the new page
                        if (response.ok) {
                            const responseClone = response.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(request, responseClone);
                            });
                        }
                        return response;
                    });
                })
                .catch(() => {
                    // Return cached index.html for offline navigation
                    return caches.match('./index.html');
                }),
        );
        return;
    }

    // For other requests, try cache first, then network
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(request)
                .then((response) => {
                    // Don't cache non-successful responses
                    if (!response || response.status !== 200) {
                        return response;
                    }

                    // Clone the response
                    const responseClone = response.clone();

                    // Cache the fetched response
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });

                    return response;
                })
                .catch(() => {
                    // Return nothing for failed requests
                    return new Response('', {
                        status: 408,
                        statusText: 'Offline',
                    });
                });
        }),
    );
});
