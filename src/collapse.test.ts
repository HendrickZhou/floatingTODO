import { describe, it, expect, vi, beforeEach } from 'vitest';
import { COLLAPSED_KEY, getLocalCollapsed, setLocalCollapsed, clampYForExpand } from './collapse';

const mockStorage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => mockStorage[k] ?? null,
  setItem: (k: string, v: string) => { mockStorage[k] = v; },
  removeItem: (k: string) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
  length: 0,
  key: () => null,
};

vi.stubGlobal('localStorage', mockLocalStorage);

describe('collapse helpers', () => {
  beforeEach(() => mockLocalStorage.clear());

  it('getLocalCollapsed returns false when key absent', () => {
    expect(getLocalCollapsed()).toBe(false);
  });

  it('getLocalCollapsed returns true after setLocalCollapsed(true)', () => {
    setLocalCollapsed(true);
    expect(getLocalCollapsed()).toBe(true);
    expect(mockStorage[COLLAPSED_KEY]).toBe('true');
  });

  it('setLocalCollapsed(false) writes "false" — restores default', () => {
    setLocalCollapsed(true);
    setLocalCollapsed(false);
    expect(getLocalCollapsed()).toBe(false);
    expect(mockStorage[COLLAPSED_KEY]).toBe('false');
  });

  it('clampYForExpand returns currentY when window fits on screen', () => {
    // 1x display, screen 900px, window at y=200, expanded height 400 → fits
    expect(clampYForExpand(200, 1, 900)).toBe(200);
  });

  it('clampYForExpand clamps when expanding would go off-screen', () => {
    // 1x display, screen 900px, window at y=600, expanded height 400 → 600+400=1000 > 900
    expect(clampYForExpand(600, 1, 900)).toBe(500); // 900 - 400
  });

  it('clampYForExpand accounts for devicePixelRatio on Retina', () => {
    // 2x Retina: screen 1800 physical px, window at y=1400, expanded = 400*2=800 physical
    // 1400+800=2200 > 1800 → clamp to 1800-800=1000
    expect(clampYForExpand(1400, 2, 1800)).toBe(1000);
  });
});
