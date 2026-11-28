import { generatePuzzle } from '../../../server/catQuarters/generatePuzzle';
import { DEFAULT_SIZE, isPuzzleSize, MAX_SIZE, MIN_SIZE } from '../../../src/games/catQuarters/Puzzles';

export function onRequest({ request }: { request: Request }): Response {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  const problem = (status: number, title: string, extra: Record<string, string> = {}) =>
    Response.json({ type: 'about:blank', title, status }, {
      status,
      headers: { ...headers, 'Content-Type': 'application/problem+json', ...extra },
    });
  if (request.method !== 'GET') return problem(405, 'Method Not Allowed', { Allow: 'GET' });

  const requested = new URL(request.url).searchParams.get('size');
  const size = requested === null ? DEFAULT_SIZE : Number(requested);
  if (!isPuzzleSize(size)) return problem(400, `Size must be a whole number from ${MIN_SIZE} to ${MAX_SIZE}`);

  const rows = generatePuzzle(size);
  if (!rows) return problem(503, 'Puzzle generation timed out');
  return Response.json({ rows }, { headers });
}
