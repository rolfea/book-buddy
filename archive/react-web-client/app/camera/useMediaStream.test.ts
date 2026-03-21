import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useMediaStream } from './useMediaStream';

describe('useMediaStream', () => {
  const mockGetUserMedia = vi.fn();
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
  });

  it('requests camera permission on mount', async () => {
    renderHook(() => useMediaStream());

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith({ video: true });
    });
  });

  it('sets isReady to true when stream is available', async () => {
    const { result } = renderHook(() => useMediaStream());

    expect(result.current.isReady).toBe(false);

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
  });

  it('provides videoStream when ready', async () => {
    const { result } = renderHook(() => useMediaStream());

    await waitFor(() => {
      expect(result.current.videoStream).toBe(mockMediaStream);
    });
  });

  it('starts with null error', () => {
    const { result } = renderHook(() => useMediaStream());

    expect(result.current.error).toBeNull();
  });

  it('sets error state when getUserMedia fails', async () => {
    mockGetUserMedia.mockRejectedValueOnce(new Error('Permission denied'));

    const { result } = renderHook(() => useMediaStream());

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.error?.message).toBe('Permission denied');
    expect(result.current.isReady).toBe(false);
  });

  it('provides a videoRef for attaching to video element', () => {
    const { result } = renderHook(() => useMediaStream());

    expect(result.current.videoRef).toBeDefined();
    expect(result.current.videoRef.current).toBeNull();
  });
});
