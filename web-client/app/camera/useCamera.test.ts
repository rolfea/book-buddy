import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useCamera } from './useCamera';

describe('useCamera', () => {
  const mockGetUserMedia = vi.fn();
  const mockGrabFrame = vi.fn();
  const mockTrack = { id: 'mock-track', stop: vi.fn() };
  const mockMediaStream = {
    getVideoTracks: () => [mockTrack],
    getTracks: () => [mockTrack],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetUserMedia.mockResolvedValue(mockMediaStream);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      writable: true,
      configurable: true,
    });

    mockGrabFrame.mockResolvedValue({ width: 640, height: 480 });
    // @ts-ignore - ImageCapture needs to be a constructor
    global.ImageCapture = class {
      grabFrame = mockGrabFrame;
    };
  });

  it('requests camera permission on mount', async () => {
    renderHook(() => useCamera());

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith({ video: true });
    });
  });

  it('sets isReady to true when stream is available', async () => {
    const { result } = renderHook(() => useCamera());

    expect(result.current.isReady).toBe(false);

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
  });

  it('starts with null latestFrame', () => {
    const { result } = renderHook(() => useCamera());

    expect(result.current.latestFrame).toBeNull();
  });

  it('starts with isCapturing false', () => {
    const { result } = renderHook(() => useCamera());

    expect(result.current.isCapturing).toBe(false);
  });

  it('starts with isCoolingDown false', () => {
    const { result } = renderHook(() => useCamera());

    expect(result.current.isCoolingDown).toBe(false);
  });

  it('starts with null error', () => {
    const { result } = renderHook(() => useCamera());

    expect(result.current.error).toBeNull();
  });

  it('sets error state when getUserMedia fails', async () => {
    mockGetUserMedia.mockRejectedValueOnce(new Error('Permission denied'));

    const { result } = renderHook(() => useCamera());

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.error?.message).toBe('Permission denied');
    expect(result.current.isReady).toBe(false);
  });

  it('provides a videoRef for attaching to video element', () => {
    const { result } = renderHook(() => useCamera());

    expect(result.current.videoRef).toBeDefined();
    expect(result.current.videoRef.current).toBeNull();
  });

  it('startCapture sets isCapturing to true', async () => {
    const { result } = renderHook(() => useCamera());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    act(() => {
      result.current.startCapture();
    });

    expect(result.current.isCapturing).toBe(true);
  });

  it('stopCapture sets isCapturing to false', async () => {
    const { result } = renderHook(() => useCamera());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    act(() => {
      result.current.startCapture();
    });

    expect(result.current.isCapturing).toBe(true);

    act(() => {
      result.current.stopCapture();
    });

    expect(result.current.isCapturing).toBe(false);
  });

  it('triggerCooldown sets isCoolingDown to true then false after timeout', async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useCamera());

    act(() => {
      result.current.triggerCooldown();
    });

    expect(result.current.isCoolingDown).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.isCoolingDown).toBe(false);

    vi.useRealTimers();
  });

  it('captures frames at interval when isCapturing is true', async () => {
    const { result } = renderHook(() => useCamera());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    act(() => {
      result.current.startCapture();
    });

    // Wait for interval to fire
    await waitFor(() => {
      expect(mockGrabFrame).toHaveBeenCalled();
    }, { timeout: 1000 });

    act(() => {
      result.current.stopCapture();
    });
  });

  it('does not capture during cooldown', async () => {
    const { result } = renderHook(() => useCamera());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    // Start capturing
    act(() => {
      result.current.startCapture();
    });

    // Wait for at least one capture
    await waitFor(() => {
      expect(mockGrabFrame).toHaveBeenCalled();
    }, { timeout: 1000 });

    const callCountBeforeCooldown = mockGrabFrame.mock.calls.length;

    // Trigger cooldown
    act(() => {
      result.current.triggerCooldown();
    });

    expect(result.current.isCoolingDown).toBe(true);

    // Wait a bit - captures should be paused during cooldown
    await new Promise((r) => setTimeout(r, 600));

    // Call count should not have increased during cooldown
    expect(mockGrabFrame.mock.calls.length).toBe(callCountBeforeCooldown);

    act(() => {
      result.current.stopCapture();
    });
  });
});
