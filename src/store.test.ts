import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Tauri APIs before importing store ──
const mockFiles: Record<string, string> = {};
let renameError = false;

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(() => Promise.resolve('/mock/appdata')),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn((path: string) => {
    if (mockFiles[path] !== undefined) return Promise.resolve(mockFiles[path]);
    return Promise.reject(new Error('File not found'));
  }),
  writeTextFile: vi.fn((path: string, content: string) => {
    mockFiles[path] = content;
    return Promise.resolve();
  }),
  rename: vi.fn((src: string, dst: string) => {
    if (renameError) return Promise.reject(new Error('disk full'));
    mockFiles[dst] = mockFiles[src];
    delete mockFiles[src];
    return Promise.resolve();
  }),
}));

import { loadTodos, saveTodos, createItem } from './store';

beforeEach(() => {
  Object.keys(mockFiles).forEach(k => delete mockFiles[k]);
  renameError = false;
});

describe('createItem', () => {
  it('creates item with unique id, given text, done=false', () => {
    const a = createItem('hello');
    const b = createItem('world');
    expect(a.text).toBe('hello');
    expect(a.done).toBe(false);
    expect(typeof a.id).toBe('string');
    expect(a.id.length).toBeGreaterThan(0);
    expect(a.id).not.toBe(b.id);
  });
});

describe('loadTodos', () => {
  it('returns empty array on first launch (no file)', async () => {
    const items = await loadTodos();
    expect(items).toEqual([]);
  });

  it('returns empty array on corrupt JSON', async () => {
    mockFiles['/mock/appdata/todos.json'] = 'not-json{{{{';
    const items = await loadTodos();
    expect(items).toEqual([]);
  });

  it('returns items from valid file', async () => {
    const stored = [{ id: '1', text: 'hello', done: false }];
    mockFiles['/mock/appdata/todos.json'] = JSON.stringify({ items: stored });
    const items = await loadTodos();
    expect(items).toEqual(stored);
  });

  it('returns empty array when items key is missing', async () => {
    mockFiles['/mock/appdata/todos.json'] = JSON.stringify({ other: 'data' });
    const items = await loadTodos();
    expect(items).toEqual([]);
  });
});

describe('saveTodos', () => {
  it('writes items atomically (via tmp rename)', async () => {
    const items = [{ id: '1', text: 'task', done: false }];
    await saveTodos(items);
    const saved = JSON.parse(mockFiles['/mock/appdata/todos.json']);
    expect(saved.items).toEqual(items);
    // tmp file should be cleaned up
    expect(mockFiles['/mock/appdata/todos.json.tmp']).toBeUndefined();
  });

  it('throws when rename fails (disk full simulation)', async () => {
    renameError = true;
    await expect(saveTodos([{ id: '1', text: 'x', done: false }])).rejects.toThrow();
  });

  it('round-trips add → save → load', async () => {
    const item = createItem('buy milk');
    await saveTodos([item]);
    const loaded = await loadTodos();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].text).toBe('buy milk');
    expect(loaded[0].done).toBe(false);
  });

  it('round-trips toggle → save → load', async () => {
    const item = createItem('exercise');
    await saveTodos([item]);
    const toggled = [{ ...item, done: true }];
    await saveTodos(toggled);
    const loaded = await loadTodos();
    expect(loaded[0].done).toBe(true);
  });

  it('round-trips delete → save → load', async () => {
    const a = createItem('a');
    const b = createItem('b');
    await saveTodos([a, b]);
    await saveTodos([a]);
    const loaded = await loadTodos();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe(a.id);
  });
});
