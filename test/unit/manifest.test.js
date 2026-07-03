import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test, expect } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const manifest = JSON.parse(
  await readFile(path.join(ROOT, 'manifest.json'), 'utf8')
);

describe('manifest.json — MV3 compliance (spec §5.1, AC8)', () => {
  test('is Manifest V3', () => {
    expect(manifest.manifest_version).toBe(3);
  });

  test('uses "action" not "browser_action"', () => {
    expect(manifest.action).toBeDefined();
    expect(manifest.browser_action).toBeUndefined();
  });

  test('popup is data/panel.html', () => {
    expect(manifest.action?.default_popup).toBe('data/panel.html');
  });

  test('permissions are exactly ["activeTab", "scripting"] — no extras', () => {
    const perms = [...(manifest.permissions ?? [])].sort();
    expect(perms).toEqual(['activeTab', 'scripting']);
  });

  test('no host_permissions in the shipped manifest (AC8)', () => {
    expect(manifest.host_permissions).toBeUndefined();
  });

  test('no "key" field in the shipped manifest (AC8)', () => {
    expect(manifest.key).toBeUndefined();
  });

  test('web_accessible_resources declares both red-dot images (spec §6)', () => {
    const war = manifest.web_accessible_resources ?? [];
    const resources = war.flatMap((entry) => entry.resources ?? []);
    expect(resources).toContain('data/red-dot.PNG');
    expect(resources).toContain('data/red-dot2.PNG');
  });

  test('web_accessible_resources does NOT expose scripts or popup assets', () => {
    const war = manifest.web_accessible_resources ?? [];
    const resources = war.flatMap((entry) => entry.resources ?? []);
    expect(resources).not.toContain('data/submit.js');
    expect(resources.some((r) => r.endsWith('.js'))).toBe(false);
  });

  test('icons includes 128px entry', () => {
    expect(manifest.icons?.['128']).toBeDefined();
  });
});
