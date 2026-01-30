import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useCamera } from './useCamera';

describe('useCamera', () => {
  const mockGetUserMedia = vi.fn();
  const mockGrabFrame = vi.fn();
  const mockTrack = { id: 'mock-track' };
  const mockMediaStream = {
    getVideoTracks: () => [mockTrack],
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

  it('starts with empty capturedFrames', () => {
    const { result } = renderHook(() => useCamera());

    expect(result.current.capturedFrames).toEqual([]);
  });

  it('grabFrame captures a frame and adds to array', async () => {
    const { result } = renderHook(() => useCamera());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(async () => {
      await result.current.grabFrame();
    });

    expect(mockGrabFrame).toHaveBeenCalled();
    expect(result.current.capturedFrames).toHaveLength(1);
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
});
