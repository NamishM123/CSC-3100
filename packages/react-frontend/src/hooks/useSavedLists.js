import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { getSupabaseClient } from "../lib/supabase.js";
import {
  listDocument,
  SavedListRepository
} from "../lib/savedLists.js";

export function useSavedLists(userId, state, setState) {
  const repository = useMemo(
    () => new SavedListRepository(getSupabaseClient(), userId),
    [userId]
  );
  const [sync, setSync] = useState({
    status: "loading",
    ready: false
  });
  const [retry, setRetry] = useState(0);
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);
  const serialized = JSON.stringify(listDocument(state));

  useEffect(() => {
    if (!userId) return;
    let active = true;
    repository
      .load()
      .then((document) => {
        if (!active) return;
        setState((current) => ({
          ...current,
          ...listDocument(document || current)
        }));
        setSync({ status: "saved", ready: true });
      })
      .catch((error) => {
        if (active)
          setSync({
            status: "error",
            ready: false,
            message: error.message
          });
      });
    return () => {
      active = false;
    };
  }, [repository, userId, retry, setState]);

  useEffect(() => {
    if (!sync.ready) return;
    let active = true;
    const timer = setTimeout(() => {
      setSync({ status: "saving", ready: true });
      repository
        .save(JSON.parse(serialized))
        .then(() => {
          if (active) setSync({ status: "saved", ready: true });
        })
        .catch((error) => {
          if (active)
            setSync({
              status: "error",
              ready: true,
              message: error.message,
              conflict: error.name === "ListConflictError"
            });
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [serialized, repository, sync.ready]);

  const flush = useCallback(async () => {
    try {
      await repository.save(latest.current);
      setSync({ status: "saved", ready: true });
    } catch (error) {
      setSync({
        status: "error",
        ready: true,
        message: error.message,
        conflict: error.name === "ListConflictError"
      });
      throw error;
    }
  }, [repository]);

  useEffect(() => {
    if (!userId) return;
    const warn = (event) => {
      if (
        repository.baseline !==
        JSON.stringify(listDocument(latest.current))
      )
        event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () =>
      window.removeEventListener("beforeunload", warn);
  }, [repository, userId]);

  return {
    ...sync,
    pending: sync.ready && repository.baseline !== serialized,
    flush,
    reload() {
      setSync({ status: "loading", ready: false });
      setRetry((value) => value + 1);
    }
  };
}
