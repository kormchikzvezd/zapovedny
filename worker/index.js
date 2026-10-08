import * as pages from './entry.js';
import { saveLead } from './leads.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/leads') {
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
      return saveLead(request, env);
    }

    if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/images/') || url.pathname === '/favicon.ico') {
      if (env?.ASSETS) {
        const response = await env.ASSETS.fetch(request);

        if (response.ok && url.pathname.endsWith('.webp')) {
          const headers = new Headers(response.headers);
          headers.set('Content-Type', 'image/webp');
          headers.set('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
          return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
        }

        return response;
      }

      return new Response('Asset not found', { status: 404 });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }

    return pages.renderPage(request, url.pathname, {});
  },
};
