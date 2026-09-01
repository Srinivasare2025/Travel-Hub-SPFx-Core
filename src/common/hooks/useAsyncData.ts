import { useCallback, useEffect, useRef, useState } from 'react';
import { AsyncStatus } from '../../models';

export interface IAsyncData<T> {
  status: AsyncStatus;
  data: T | undefined;
  error: Error | undefined;
  /** Re-run the loader (e.g. from an ErrorState retry button). */
  retry: () => void;
}

interface IState<T> {
  status: AsyncStatus;
  data: T | undefined;
  error: Error | undefined;
}

/** A resolved array of length 0 is treated as the `empty` state. */
function isEmpty(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}

/**
 * Runs `loader` and exposes a loading / success / empty / error state machine.
 * Cancels state updates after unmount. Re-runs when `deps` change or `retry()`
 * is called. Every dynamic section uses this (ARCHITECTURE.md §7).
 */
export function useAsyncData<T>(loader: () => Promise<T>, deps: readonly unknown[]): IAsyncData<T> {
  const [state, setState] = useState<IState<T>>({
    status: 'loading',
    data: undefined,
    error: undefined
  });
  const mountedRef = useRef(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', data: undefined, error: undefined });

    loader()
      .then((result) => {
        if (cancelled || !mountedRef.current) {
          return;
        }
        setState({
          status: isEmpty(result) ? 'empty' : 'success',
          data: result,
          error: undefined
        });
      })
      .catch((err: unknown) => {
        if (cancelled || !mountedRef.current) {
          return;
        }
        setState({
          status: 'error',
          data: undefined,
          error: err instanceof Error ? err : new Error('Failed to load data')
        });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  return { status: state.status, data: state.data, error: state.error, retry };
}
