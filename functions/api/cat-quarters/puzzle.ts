import { generatePuzzle } from '../../../server/catQuarters/generatePuzzle';

export function onRequest({ request }: { request: Request }): Response {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (request.method !== 'GET') {
    return Response.json({ type: 'about:blank', title: 'Method Not Allowed', status: 405 }, {
      status: 405,
      headers: { ...headers, 'Content-Type': 'application/problem+json', Allow: 'GET' },
    });
  }

  const rows = generatePuzzle();
  if (!rows) {
    return Response.json({ type: 'about:blank', title: 'Puzzle generation timed out', status: 503 }, {
      status: 503,
      headers: { ...headers, 'Content-Type': 'application/problem+json' },
    });
  }

  return Response.json({ rows }, { headers });
}
