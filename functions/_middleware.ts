// Kipu's address is kipu.eight1fivedesign.com. The old kipu-games host stays
// attached to this Pages project so existing links and installs keep working,
// and every request to it is sent to the same path on the new host.
const OLD_HOST = 'kipu-games.eight1fivedesign.com';
const NEW_HOST = 'kipu.eight1fivedesign.com';

export function onRequest({ request, next }: { request: Request; next: () => Promise<Response> }): Response | Promise<Response> {
  const url = new URL(request.url);
  if (url.hostname !== OLD_HOST) return next();
  url.hostname = NEW_HOST;
  return Response.redirect(url.toString(), 301);
}
