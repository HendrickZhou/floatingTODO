import { getCurrentWindow, LogicalPosition } from '@tauri-apps/api/window';
import { TauriEvent } from '@tauri-apps/api/event';
import { appDataDir } from '@tauri-apps/api/path';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';

const STATE_FILE = 'window-state.json';

export async function restorePosition(): Promise<void> {
  const win = getCurrentWindow();
  try {
    const dir = await appDataDir();
    const pos = JSON.parse(await readTextFile(`${dir}/${STATE_FILE}`));
    await win.setPosition(new LogicalPosition(pos.x, pos.y));
  } catch {
    // first launch — use tauri.conf.json defaults
  }
}

export function startPositionPersistence(): () => void {
  const win = getCurrentWindow();
  let timer: ReturnType<typeof setTimeout>;

  const unlisten = win.listen(TauriEvent.WINDOW_MOVED, async ({ payload }) => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const dir = await appDataDir();
        await writeTextFile(`${dir}/${STATE_FILE}`, JSON.stringify(payload));
      } catch {
        // non-critical: position persistence failure is silent
      }
    }, 300);
  });

  return () => {
    clearTimeout(timer);
    unlisten.then(fn => fn()).catch(() => {});
  };
}
