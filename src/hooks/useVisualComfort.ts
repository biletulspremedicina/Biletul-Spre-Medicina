import { useState } from 'react';

export type VisualComfortTheme = 'light' | 'dark' | 'vanilla' | 'blue';

export function useVisualComfort() {
  const [comfortTheme, setComfortTheme] = useState<VisualComfortTheme>('light');
  return { comfortTheme, setComfortTheme };
}
