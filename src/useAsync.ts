import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncState<T> =
  | { status: "loading"; data: T | null; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "error"; data: T | null; error: Error };

/**
 * Runs an async task whenever `deps` change.
 * - Stale responses are ignored (race-condition safe).
 * - The task receives an AbortSignal, cancelled on dep change and unmount.
 * - Last successful data is kept while reloading or after an error.
 */
export function useAsync<T>(
  task: (signal: AbortSignal) => Promise<T>,
  deps: ReadonlyArray<unknown>
) {
  const [state, setState] = useState<AsyncState<T>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);

  // Always call the latest task without forcing callers to memoize it.
  const taskRef = useRef(task);
  taskRef.current = task;

  useEffect(() => {
    const controller = new AbortController();

    setState((prev) => ({ status: "loading", data: prev.data, error: null }));

    taskRef
      .current(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setState({ status: "success", data, error: null });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setState((prev) => ({
          status: "error",
          data: prev.data,
          error: err instanceof Error ? err : new Error(String(err)),
        }));
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return { ...state, retry };
}
