import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useAutoCapture } from './useAutoCapture';

describe('useAutoCapture', () => {
  const mockOnCapture = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with isCapturing false', () => {
    const { result } = renderHook(() => useAutoCapture(mockOnCapture));

    expect(result.current.isCapturing).toBe(false);
  });

  it('startCapture sets isCapturing to true', () => {
    const { result } = renderHook(() => useAutoCapture(mockOnCapture));

    act(() => {
      result.current.startCapture();
    });

    expect(result.current.isCapturing).toBe(true);
  });

  it('stopCapture sets isCapturing to false', () => {
    const { result } = renderHook(() => useAutoCapture(mockOnCapture));

    act(() => {
      result.current.startCapture();
    });

    act(() => {
      result.current.stopCapture();
    });

    expect(result.current.isCapturing).toBe(false);
  });

  it('calls onCapture at interval when capturing', () => {
    const { result } = renderHook(() => useAutoCapture(mockOnCapture));

    act(() => {
      result.current.startCapture();
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(mockOnCapture).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(mockOnCapture).toHaveBeenCalledTimes(2);
  });

  it('respects custom interval', () => {
    const { result } = renderHook(() =>
      useAutoCapture(mockOnCapture, { intervalMs: 1000 })
    );

    act(() => {
      result.current.startCapture();
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(mockOnCapture).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(mockOnCapture).toHaveBeenCalledTimes(1);
  });

  it('does not capture when enabled is false', () => {
    const { result } = renderHook(() =>
      useAutoCapture(mockOnCapture, { enabled: false })
    );

    act(() => {
      result.current.startCapture();
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockOnCapture).not.toHaveBeenCalled();
  });

  it('stops capturing when enabled changes to false', () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useAutoCapture(mockOnCapture, { enabled }),
      { initialProps: { enabled: true } }
    );

    act(() => {
      result.current.startCapture();
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(mockOnCapture).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Should still be 1, not 2
    expect(mockOnCapture).toHaveBeenCalledTimes(1);
  });
});
