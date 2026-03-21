import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useFrameCapture } from './useFrameCapture';

describe('useFrameCapture', () => {
  const mockGrabFrame = vi.fn();
  const mockTrack = { id: 'mock-track' };
  const mockMediaStream = {
    getVideoTracks: () => [mockTrack],
  } as unknown as MediaStream;

  beforeEach(() => {
    vi.clearAllMocks();

    mockGrabFrame.mockResolvedValue({ width: 640, height: 480, close: vi.fn() });
    // @ts-ignore - ImageCapture needs to be a constructor
    global.ImageCapture = class {
      grabFrame = mockGrabFrame;
    };
  });

  it('starts with null latestFrame', () => {
    const { result } = renderHook(() => useFrameCapture(null));

    expect(result.current.latestFrame).toBeNull();
  });

  it('does nothing when grabFrame is called with null stream', async () => {
    const { result } = renderHook(() => useFrameCapture(null));

    await act(async () => {
      await result.current.grabFrame();
    });

    expect(mockGrabFrame).not.toHaveBeenCalled();
    expect(result.current.latestFrame).toBeNull();
  });

  it('captures frame when stream is available', async () => {
    const { result } = renderHook(() => useFrameCapture(mockMediaStream));

    await act(async () => {
      await result.current.grabFrame();
    });

    expect(mockGrabFrame).toHaveBeenCalled();
    expect(result.current.latestFrame).not.toBeNull();
  });

  it('closes previous frame when capturing new one', async () => {
    const mockClose = vi.fn();
    const mockFrame1 = { width: 640, height: 480, close: mockClose };
    const mockFrame2 = { width: 640, height: 480, close: vi.fn() };

    mockGrabFrame.mockResolvedValueOnce(mockFrame1).mockResolvedValueOnce(mockFrame2);

    const { result } = renderHook(() => useFrameCapture(mockMediaStream));

    await act(async () => {
      await result.current.grabFrame();
    });

    await act(async () => {
      await result.current.grabFrame();
    });

    expect(mockClose).toHaveBeenCalled();
  });
});
