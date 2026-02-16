const LOCAL_DEV_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
type BuildRendererCspOptions = {
  allowUnsafeInlineScripts?: boolean;
};

export function validateRendererDevUrl(rawUrl: string): URL {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid ELECTRON_RENDERER_URL: ${rawUrl}`);
  }

  const isHttp = parsed.protocol === 'http:' || parsed.protocol === 'https:';
  if (!isHttp || !LOCAL_DEV_HOSTS.has(parsed.hostname)) {
    throw new Error(
      `Refusing untrusted ELECTRON_RENDERER_URL (${rawUrl}). Only local http(s) dev servers are allowed.`,
    );
  }

  return parsed;
}

export function isAllowedNavigationUrl(targetUrl: string, allowedDevOrigin?: string): boolean {
  let parsed: URL;

  try {
    parsed = new URL(targetUrl);
  } catch {
    return false;
  }

  if (allowedDevOrigin) {
    return parsed.origin === allowedDevOrigin;
  }

  return parsed.protocol === 'file:';
}

export function buildRendererCsp(options: BuildRendererCspOptions = {}): string {
  const scriptSrc = options.allowUnsafeInlineScripts
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self'";

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
  ].join('; ');
}
