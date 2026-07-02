import { useCallback, useEffect, useState } from 'react';

import { loadPublicData } from '../services/publicData';
import type { Branch, FamilyEvent, PublicAffinityStats, TreeChild, TreeParent } from '../types';

type PublicDataState = {
  branches: Branch[];
  children: TreeChild[];
  error: string | null;
  events: FamilyEvent[];
  affinityStats: PublicAffinityStats;
  loading: boolean;
  parents: TreeParent[];
};

const initialState: PublicDataState = {
  branches: [],
  children: [],
  error: null,
  events: [],
  affinityStats: {
    total: 0,
    insideCount: 0,
    outsideCount: 0,
    unknownCount: 0,
    insidePct: 0,
    outsidePct: 0,
    unknownPct: 0,
    topInsideBranches: [],
  },
  loading: true,
  parents: [],
};

export function usePublicData() {
  const [state, setState] = useState<PublicDataState>(initialState);

  const reload = useCallback(async () => {
    setState((current) => ({ ...current, error: null, loading: true }));
    try {
      const data = await loadPublicData();
      setState({ ...data, error: null, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر تحميل البيانات العامة.';
      setState((current) => ({ ...current, error: message, loading: false }));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}
