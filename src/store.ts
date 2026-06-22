import { appDataDir } from '@tauri-apps/api/path';
import { writeTextFile, readTextFile, rename, mkdir } from '@tauri-apps/plugin-fs';

export type Item = { id: string; text: string; done: boolean };
export type Store = { items: Item[] };

const FILENAME = 'todos.json';

function isFileNotFound(e: unknown): boolean {
  const msg = String(e instanceof Error ? e.message : e).toLowerCase();
  return msg.includes('os error 2') || msg.includes('no such file') || msg.includes('path not found');
}

function isValidItem(x: unknown): x is Item {
  return (
    typeof x === 'object' && x !== null &&
    typeof (x as Item).id === 'string' && (x as Item).id.length > 0 &&
    typeof (x as Item).text === 'string' &&
    typeof (x as Item).done === 'boolean'
  );
}

export async function loadTodos(): Promise<Item[]> {
  try {
    const dir = await appDataDir();
    const raw = await readTextFile(`${dir}/${FILENAME}`);
    const parsed = JSON.parse(raw) as Store;
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return items.filter(isValidItem);
  } catch (e) {
    if (isFileNotFound(e)) return [];
    throw e;
  }
}

export async function saveTodos(items: Item[]): Promise<void> {
  const dir = await appDataDir();
  await mkdir(dir, { recursive: true });
  const tmp = `${dir}/${FILENAME}.tmp`;
  await writeTextFile(tmp, JSON.stringify({ items }));
  await rename(tmp, `${dir}/${FILENAME}`);
}

export function createItem(text: string): Item {
  return { id: crypto.randomUUID(), text, done: false };
}
