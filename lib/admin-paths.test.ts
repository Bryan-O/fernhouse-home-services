import { describe, expect, it } from 'vitest';
import { safeAdminPath } from './admin-paths';

describe('safeAdminPath', () => {
  it('keeps admin pages', () => {
    expect(safeAdminPath('/admin')).toBe('/admin');
    expect(safeAdminPath('/admin/capacity')).toBe('/admin/capacity');
    expect(safeAdminPath('/admin/b/04817')).toBe('/admin/b/04817');
  });

  it('refuses anything that could leave /admin', () => {
    for (const bad of ['https://evil.example', '//evil.example', '/admin//evil.example', '/administrator', '/admin/../book', '/', '', null, undefined, '/admin/login']) {
      expect(safeAdminPath(bad)).toBe('/admin');
    }
  });
});
