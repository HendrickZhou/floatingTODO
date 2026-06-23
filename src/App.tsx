import { useEffect, useRef, useState } from 'react';
import { getCurrentWindow, LogicalSize, PhysicalPosition } from '@tauri-apps/api/window';
import { check, Update } from '@tauri-apps/plugin-updater';
import { loadTodos, saveTodos, createItem, Item } from './store';
import { restorePosition, startPositionPersistence } from './window';
import { getLocalCollapsed, setLocalCollapsed, clampYForExpand } from './collapse';
import './App.css';

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState('');
  const [saveError, setSaveError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [collapsed, setCollapsed] = useState(getLocalCollapsed);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInstalling, setUpdateInstalling] = useState(false);
  const [updateDone, setUpdateDone] = useState(false);
  const updateRef = useRef<Update | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isResizingRef = useRef(false);

  useEffect(() => {
    check().then(update => {
      if (update) { updateRef.current = update; setUpdateAvailable(true); }
    }).catch(() => {});

    const init = async () => {
      await restorePosition();
      if (getLocalCollapsed()) {
        try { await getCurrentWindow().setSize(new LogicalSize(280, 28)); } catch {}
      }
      try {
        setItems(await loadTodos());
      } catch {
        setLoadError(true);
      }
      setLoaded(true);
    };
    init();

    const win = getCurrentWindow();
    const unlistenFocus = win.onFocusChanged(({ payload: focused }) => {
      document.documentElement.style.opacity = focused ? '1' : '0.85';
    });
    const cleanupPosition = startPositionPersistence();

    return () => {
      if (saveErrorTimerRef.current) clearTimeout(saveErrorTimerRef.current);
      unlistenFocus.then(fn => fn()).catch(() => {});
      cleanupPosition();
    };
  }, []);

  const handleUpdateClick = async () => {
    if (!updateRef.current || updateInstalling || updateDone) return;
    setUpdateInstalling(true);
    try {
      await updateRef.current.downloadAndInstall();
      setUpdateDone(true);
      await getCurrentWindow().close();
    } catch {
      setUpdateInstalling(false);
    }
  };

  const toggleCollapse = async () => {
    if (isResizingRef.current) return;
    isResizingRef.current = true;
    const win = getCurrentWindow();
    try {
      if (collapsed) {
        const pos = await win.outerPosition();
        const safeY = clampYForExpand(
          pos.y,
          window.devicePixelRatio,
          window.screen.height * window.devicePixelRatio,
        );
        if (safeY !== pos.y) {
          await win.setPosition(new PhysicalPosition(pos.x, safeY));
        }
        await win.setSize(new LogicalSize(280, 400));
        setLocalCollapsed(false);
        setCollapsed(false);
      } else {
        await win.setSize(new LogicalSize(280, 28));
        setLocalCollapsed(true);
        setCollapsed(true);
      }
    } catch {
      // setSize/setPosition failed — leave state unchanged
    } finally {
      isResizingRef.current = false;
    }
  };

  const safeSave = (next: Item[]) => {
    if (loadError) return; // never overwrite a corrupted file
    saveQueueRef.current = saveQueueRef.current
      .catch(() => {})
      .then(() => saveTodos(next))
      .then(() => setSaveError(false))
      .catch(() => {
        if (saveErrorTimerRef.current) clearTimeout(saveErrorTimerRef.current);
        setSaveError(true);
        saveErrorTimerRef.current = setTimeout(() => setSaveError(false), 2000);
      });
  };

  const addItem = () => {
    const text = input.trim();
    if (!text) return;
    const next = [...items, createItem(text)];
    setItems(next);
    setInput('');
    safeSave(next);
  };

  const toggleItem = (id: string) => {
    const next = items.map(i => i.id === id ? { ...i, done: !i.done } : i);
    setItems(next);
    safeSave(next);
  };

  const deleteItem = (id: string) => {
    const next = items.filter(i => i.id !== id);
    setItems(next);
    safeSave(next);
  };

  const allDone = loaded && items.length > 0 && items.every(i => i.done);

  return (
    <div className={`app${allDone ? ' all-done' : ''}${collapsed ? ' collapsed' : ''}`}>
      <div
        className="drag-header"
        onMouseDown={(e) => { if (e.buttons === 1) getCurrentWindow().startDragging(); }}
      >
        <span className="drag-dot" />
        <span className="drag-dot" />
        <span className="drag-dot" />
        <span className="drag-dot" />
        <span className="drag-dot" />
        {updateAvailable && (
          <span
            className={`update-dot${updateInstalling ? ' update-dot--installing' : ''}`}
            title={updateInstalling ? 'Installing update…' : updateDone ? 'Restarting…' : 'Update available — click to install'}
            onClick={handleUpdateClick}
            onMouseDown={e => e.stopPropagation()}
            style={{ cursor: updateInstalling || updateDone ? 'default' : 'pointer' }}
          />
        )}
        <button
          className="collapse-btn"
          aria-label={collapsed ? 'Expand' : 'Minimize'}
          onClick={toggleCollapse}
          onMouseDown={e => e.stopPropagation()}
        >
          {collapsed ? '⌄' : '⌃'}
        </button>
      </div>

      <div inert={collapsed ? true : undefined}>
        <input
          className="add-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addItem()}
          placeholder="Add task..."
          autoFocus
        />

        <ul className="item-list">
          {loaded && items.length === 0 && (
            <li className="empty-state">What's on your plate today?</li>
          )}
          {items.map(item => (
            <li key={item.id} className={`item${item.done ? ' done' : ''}`}>
              <input
                type="checkbox"
                className="item-checkbox"
                checked={item.done}
                onChange={() => toggleItem(item.id)}
                aria-label={`Mark "${item.text}" complete`}
              />
              <span className="item-text">{item.text}</span>
              <button
                className="delete-btn"
                aria-label="Delete task"
                onClick={() => deleteItem(item.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>

        {loadError && (
          <div className="save-toast">⚠ todos.json is corrupted — data not loaded</div>
        )}
        {!loadError && saveError && (
          <div className="save-toast">Couldn't save — disk full?</div>
        )}
      </div>
    </div>
  );
}
