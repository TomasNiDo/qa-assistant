import { describe, expect, it } from 'vitest';
import { buildRendererCsp, isAllowedNavigationUrl, validateRendererDevUrl } from './security';

describe('security helpers', () => {
  it('accepts local renderer dev urls', () => {
    const parsed = validateRendererDevUrl('http://localhost:5173');
    expect(parsed.origin).toBe('http://localhost:5173');
  });

  it('rejects non-local renderer dev urls', () => {
    expect(() => validateRendererDevUrl('https://example.com')).toThrow(
      'Only local http(s) dev servers are allowed.',
    );
  });

  it('allows same-origin navigation for dev server windows', () => {
    expect(isAllowedNavigationUrl('http://localhost:5173/projects', 'http://localhost:5173')).toBe(
      true,
    );
    expect(isAllowedNavigationUrl('https://example.com', 'http://localhost:5173')).toBe(false);
  });

  it('allows only file urls in packaged mode', () => {
    expect(isAllowedNavigationUrl('file:///tmp/index.html')).toBe(true);
    expect(isAllowedNavigationUrl('https://example.com')).toBe(false);
  });

  it('builds a strict CSP baseline', () => {
    const csp = buildRendererCsp();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
