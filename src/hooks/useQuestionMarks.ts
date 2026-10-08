import { useCallback, useEffect, useState } from 'react';

const marksKey = (attemptId: string) => `bsm-question-marks:${attemptId}`;

export function useQuestionMarks(attemptId: string | null) {
  const [markedIds, setMarkedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!attemptId) {
      setMarkedIds(new Set());
      return;
    }
    try {
      const saved = JSON.parse(window.localStorage.getItem(marksKey(attemptId)) || '[]');
      setMarkedIds(new Set(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : []));
    } catch {
      setMarkedIds(new Set());
    }
  }, [attemptId]);

  const toggleMark = useCallback((questionId: string) => {
    if (!attemptId) return;
    setMarkedIds((current) => {
      const next = new Set(current);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      try {
        window.localStorage.setItem(marksKey(attemptId), JSON.stringify([...next]));
      } catch {
        // The mark remains available for this session if storage is unavailable.
      }
      return next;
    });
  }, [attemptId]);

  return { markedIds, toggleMark };
}
