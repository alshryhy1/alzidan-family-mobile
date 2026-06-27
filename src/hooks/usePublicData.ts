import { useCallback, useEffect, useState } from 'react';

import { loadPublicData } from '../services/publicData';
import type { Branch, FamilyEvent, TreeChild, TreeParent } from '../types';

type PublicDataState = {
  branches: Branch[];
  children: TreeChild[];
  error: string | null;
  events: FamilyEvent[];
  loading: boolean;
  parents: TreeParent[];
};

const initialState: PublicDataState = {
  branches: [],
  children: [],
  error: null,
  events: [],
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
