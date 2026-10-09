# react-async-hook

A tiny, **zero-dependency** React hook for async tasks (only React as a peer dependency).
Race-condition safe, abortable, retryable.

I built it after noticing that the first, "working" version an AI assistant gave me
handled only the happy path. This repo is the version I would actually ship.

## Why

A naive `useFetch` breaks in production in quiet ways:

| Problem | What happens |
|---|---|
| No error state | The UI hangs on an empty screen |
| No cancellation | `setState` after unmount, wasted requests |
| Race condition | A slow response for an old param overwrites a newer one |
| No retry | Every network blip is a dead end |
| Hard-wired to `fetch` | Hard to reuse and hard to test |

## Usage

```ts
import { useAsync } from "./src/useAsync";

const { data, status, error, retry } = useAsync(
  (signal) =>
    fetch(`/api/lessons/${id}`, { signal }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<Lesson>;
    }),
  [id]
);
```

## Design decisions

- **Task injection.** The hook does not know about `fetch`, auth or base URLs.
  You pass a function, so it works with anything and is testable without global mocks.
- **Discriminated union state.** `success` always has `data`; `error` always has an `Error`.
  Impossible states are unrepresentable.
- **`AbortController`.** One mechanism solves cancellation, unmount safety and
  the race condition: stale results are dropped if their signal was aborted.
- **`taskRef`.** Callers do not need to wrap the task in `useCallback`.
- **Data preserved on reload/error.** No flicker back to an empty state.

## Tests

```bash
npm install
npm test
npm run typecheck
```

Tests (Vitest + Testing Library) cover success, failure, non-Error rejections,
the race condition, abort on unmount, abort on deps change, data retention and retry.

## License

MIT
