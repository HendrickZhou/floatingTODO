import { useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { loadTodos, saveTodos, createItem, Item } from './store';
import { restorePosition, startPositionPersistence } from './window';
import './App.css';

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState('');
  const [saveError, setSaveError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const init = async () => {
      await restorePosition();
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
      document.documentElement.style.opacity = focused ? '1' : '0.35';
    });
    const cleanupPosition = startPositionPersistence();

    return () => {
      if (saveErrorTimerRef.current) clearTimeout(saveErrorTimerRef.current);
      unlistenFocus.then(fn => fn()).catch(() => {});
      cleanupPosition();
    };
  }, []);

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

  const addItem = async () => {
    const text = input.trim();
    if (!text) return;
    const next = [...items, createItem(text)];
    setItems(next);
    setInput('');
    await safeSave(next);
  };

  const toggleItem = async (id: string) => {
    const next = items.map(i => i.id === id ? { ...i, done: !i.done } : i);
    setItems(next);
    await safeSave(next);
  };

  const deleteItem = async (id: string) => {
    const next = items.filter(i => i.id !== id);
    setItems(next);
    await safeSave(next);
  };

  const allDone = loaded && items.length > 0 && items.every(i => i.done);

  return (
    <div className={`app${allDone ? ' all-done' : ''}`}>
      <div
        className="drag-header"
        onMouseDown={(e) => { if (e.buttons === 1) getCurrentWindow().startDragging(); }}
      >
        <span className="drag-dot" />
        <span className="drag-dot" />
        <span className="drag-dot" />
        <span className="drag-dot" />
        <span className="drag-dot" />
      </div>

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
  );
}
