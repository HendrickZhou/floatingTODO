import { appDataDir } from '@tauri-apps/api/path';
import { writeTextFile, readTextFile, rename } from '@tauri-apps/plugin-fs';

export type Item = { id: string; text: string; done: boolean };
export type Store = { items: Item[] };

const FILENAME = 'todos.json';

export async function loadTodos(): Promise<Item[]> {
  try {
    const dir = await appDataDir();
    const raw = await readTextFile(`${dir}/${FILENAME}`);
    return (JSON.parse(raw) as Store).items ?? [];
  } catch {
    return [];
  }
}

export async function saveTodos(items: Item[]): Promise<void> {
  const dir = await appDataDir();
  const tmp = `${dir}/${FILENAME}.tmp`;
  await writeTextFile(tmp, JSON.stringify({ items }));
  await rename(tmp, `${dir}/${FILENAME}`);
}

export function createItem(text: string): Item {
  return { id: crypto.randomUUID(), text, done: false };
}
