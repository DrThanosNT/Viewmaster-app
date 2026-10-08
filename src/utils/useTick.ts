import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

// Re-renders the calling screen every `ms` milliseconds (and the moment the
// app returns to the foreground), so an item flips to "Εκπρόθεσμο" on its own
// while the screen stays open. It changes nothing but how things look -
// nothing is moved or removed when a return time passes.
export default function useTick(ms: number = 30000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const id = setInterval(bump, ms);
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') bump(); });
    return () => { clearInterval(id); sub.remove(); };
  }, [ms]);
}
