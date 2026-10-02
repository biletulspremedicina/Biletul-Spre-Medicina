import { useEffect, useState } from 'react';

const STORAGE_KEY = 'bsm-exercise-visual-comfort';

type Preference = { enabled: boolean; remember: boolean };

function readPreference(): Preference {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      return { enabled: saved === 'dark', remember: true };
    }
  } catch {
    // The switch still works for this visit when storage is unavailable.
  }
  return { enabled: false, remember: false };
}

export function useVisualComfort() {
  const [preference, setPreference] = useState<Preference>(readPreference);

  useEffect(() => {
    try {
      if (preference.remember) {
        window.localStorage.setItem(STORAGE_KEY, preference.enabled ? 'dark' : 'light');
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Keep the current screen usable even if storage is blocked.
    }
  }, [preference]);

  return {
    comfortMode: preference.enabled,
    rememberComfort: preference.remember,
    toggleComfort: () => setPreference((current) => ({ ...current, enabled: !current.enabled })),
    setRememberComfort: (remember: boolean) => setPreference((current) => ({ ...current, remember })),
  };
}
