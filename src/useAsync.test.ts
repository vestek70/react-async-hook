import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useAsync } from "./useAsync";

const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("useAsync", () => {
  it("success: loading -> success", async () => {
    const { result } = renderHook(() => useAsync(async () => 42, []));
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toBe(42);
  });

  it("network failure: moves to error and keeps an Error instance", async () => {
    const { result } = renderHook(() =>
      useAsync(async () => {
        throw new Error("offline");
      }, [])
    );
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error?.message).toBe("offline");
  });

  it("wraps non-Error rejections into Error", async () => {
    const { result } = renderHook(() =>
      useAsync(() => Promise.reject("boom"), [])
    );
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("boom");
  });

  it("race condition: a late response for old deps is ignored", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const { result, rerender } = renderHook(
      ({ id }) =>
        useAsync(() => (id === 1 ? first.promise : second.promise), [id]),
      { initialProps: { id: 1 } }
    );
    rerender({ id: 2 });
    second.resolve("new");
    await waitFor(() => expect(result.current.data).toBe("new"));
    await act(async () => first.resolve("stale"));
    expect(result.current.data).toBe("new");
  });

  it("aborts the in-flight request on unmount", () => {
    const spy = vi.fn();
    const { unmount } = renderHook(() =>
      useAsync((signal) => {
        signal.addEventListener("abort", spy);
        return new Promise(() => {});
      }, [])
    );
    unmount();
    expect(spy).toHaveBeenCalledOnce();
  });

  it("aborts the previous request when deps change", () => {
    const spy = vi.fn();
    const { rerender } = renderHook(
      ({ id }) =>
        useAsync((signal) => {
          signal.addEventListener("abort", spy);
          return new Promise(() => {});
        }, [id]),
      { initialProps: { id: 1 } }
    );
    rerender({ id: 2 });
    expect(spy).toHaveBeenCalledOnce();
  });

  it("keeps previous data while reloading and after an error", async () => {
    const task = vi
      .fn()
      .mockResolvedValueOnce("v1")
      .mockRejectedValueOnce(new Error("fail"));
    const { result, rerender } = renderHook(
      ({ id }) => useAsync(task, [id]),
      { initialProps: { id: 1 } }
    );
    await waitFor(() => expect(result.current.data).toBe("v1"));
    rerender({ id: 2 });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.data).toBe("v1");
  });

  it("retry re-runs the task", async () => {
    const task = vi
      .fn()
      .mockRejectedValueOnce(new Error("x"))
      .mockResolvedValueOnce("ok");
    const { result } = renderHook(() => useAsync(task, []));
    await waitFor(() => expect(result.current.status).toBe("error"));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.data).toBe("ok"));
    expect(task).toHaveBeenCalledTimes(2);
  });
});
