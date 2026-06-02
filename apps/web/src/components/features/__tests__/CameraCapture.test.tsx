import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CameraCapture from '../CameraCapture.js';

/* ── Helpers ─────────────────────────────────────────── */

const FAKE_DATA_URL = 'data:image/jpeg;base64,/9j/fakeBase64==';

function makeStream() {
  const track = { stop: vi.fn() };
  return {
    getTracks: vi.fn().mockReturnValue([track]),
    _track: track,
  };
}

/** Installe les mocks DOM qui ne sont pas disponibles en jsdom */
function setupBrowserMocks(stream: ReturnType<typeof makeStream>) {
  // getUserMedia
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    writable: true,
    configurable: true,
  });

  // video.play() n'existe pas en jsdom
  Object.defineProperty(HTMLVideoElement.prototype, 'play', {
    value: vi.fn().mockResolvedValue(undefined),
    writable: true,
    configurable: true,
  });

  // canvas.getContext + drawImage + toDataURL
  const ctx = {
    drawImage: vi.fn(),
  };
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: vi.fn().mockReturnValue(ctx),
    writable: true,
    configurable: true,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    value: vi.fn().mockReturnValue(FAKE_DATA_URL),
    writable: true,
    configurable: true,
  });
}

/* ── Tests ───────────────────────────────────────────── */

describe('CameraCapture', () => {
  let onCapture: ReturnType<typeof vi.fn>;
  let onClear: ReturnType<typeof vi.fn>;
  let stream: ReturnType<typeof makeStream>;

  beforeEach(() => {
    onCapture = vi.fn();
    onClear = vi.fn();
    stream = makeStream();
    setupBrowserMocks(stream);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders in idle state with start button', () => {
    render(<CameraCapture onCapture={onCapture} onClear={onClear} />);
    expect(screen.getByTestId('camera-capture')).toBeInTheDocument();
    expect(screen.getByTestId('camera-start-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('camera-video')).not.toBeInTheDocument();
    expect(screen.queryByTestId('camera-preview')).not.toBeInTheDocument();
  });

  it('transitions to streaming state after clicking start', async () => {
    render(<CameraCapture onCapture={onCapture} onClear={onClear} />);
    const user = userEvent.setup();

    await user.click(screen.getByTestId('camera-start-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('camera-video')).toBeInTheDocument();
    });
    expect(screen.getByTestId('camera-capture-btn')).toBeInTheDocument();
    expect(screen.getByTestId('camera-cancel-btn')).toBeInTheDocument();
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ video: true });
  });

  it('transitions to captured state and calls onCapture', async () => {
    render(<CameraCapture onCapture={onCapture} onClear={onClear} />);
    const user = userEvent.setup();

    await user.click(screen.getByTestId('camera-start-btn'));
    await waitFor(() => screen.getByTestId('camera-video'));

    await user.click(screen.getByTestId('camera-capture-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('camera-preview')).toBeInTheDocument();
    });
    expect(onCapture).toHaveBeenCalledWith(FAKE_DATA_URL);
    expect(screen.getByTestId('camera-retake-btn')).toBeInTheDocument();
  });

  it('stops the stream when capture is taken', async () => {
    render(<CameraCapture onCapture={onCapture} onClear={onClear} />);
    const user = userEvent.setup();

    await user.click(screen.getByTestId('camera-start-btn'));
    await waitFor(() => screen.getByTestId('camera-video'));
    await user.click(screen.getByTestId('camera-capture-btn'));

    await waitFor(() => screen.getByTestId('camera-preview'));
    expect(stream._track.stop).toHaveBeenCalled();
  });

  it('returns to idle state and calls onClear when retaking', async () => {
    render(<CameraCapture onCapture={onCapture} onClear={onClear} />);
    const user = userEvent.setup();

    await user.click(screen.getByTestId('camera-start-btn'));
    await waitFor(() => screen.getByTestId('camera-video'));
    await user.click(screen.getByTestId('camera-capture-btn'));
    await waitFor(() => screen.getByTestId('camera-preview'));

    await user.click(screen.getByTestId('camera-retake-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('camera-start-btn')).toBeInTheDocument();
    });
    expect(onClear).toHaveBeenCalled();
    expect(screen.queryByTestId('camera-preview')).not.toBeInTheDocument();
  });

  it('returns to idle and stops stream when cancel is clicked during streaming', async () => {
    render(<CameraCapture onCapture={onCapture} onClear={onClear} />);
    const user = userEvent.setup();

    await user.click(screen.getByTestId('camera-start-btn'));
    await waitFor(() => screen.getByTestId('camera-video'));

    await user.click(screen.getByTestId('camera-cancel-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('camera-start-btn')).toBeInTheDocument();
    });
    expect(stream._track.stop).toHaveBeenCalled();
    expect(screen.queryByTestId('camera-video')).not.toBeInTheDocument();
  });

  it('shows error message if getUserMedia is rejected', async () => {
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('NotAllowedError'),
    );

    render(<CameraCapture onCapture={onCapture} onClear={onClear} />);
    const user = userEvent.setup();

    await user.click(screen.getByTestId('camera-start-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('camera-error')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('camera-video')).not.toBeInTheDocument();
  });

  it('offre le fallback fichier quand la caméra est rejetée', async () => {
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error('refused'), { name: 'NotAllowedError' }),
    );

    render(<CameraCapture onCapture={onCapture} onClear={onClear} />);
    const user = userEvent.setup();

    await user.click(screen.getByTestId('camera-start-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('camera-file-btn')).toBeInTheDocument();
    });
  });

  it('offre le fallback fichier si getUserMedia est indisponible', async () => {
    // Simule un navigateur sans support caméra (ex: HTTP non sécurisé)
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {},
      writable: true,
      configurable: true,
    });

    render(<CameraCapture onCapture={onCapture} onClear={onClear} />);
    const user = userEvent.setup();

    await user.click(screen.getByTestId('camera-start-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('camera-file-btn')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('camera-video')).not.toBeInTheDocument();
  });

  it('importe une image via le fallback fichier et appelle onCapture', async () => {
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('NotAllowedError'),
    );

    render(<CameraCapture onCapture={onCapture} onClear={onClear} />);
    const user = userEvent.setup();

    await user.click(screen.getByTestId('camera-start-btn'));
    await waitFor(() => screen.getByTestId('camera-file-input'));

    const file = new File(['fake-bytes'], 'photo.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByTestId('camera-file-input'), file);

    await waitFor(() => {
      expect(screen.getByTestId('camera-preview')).toBeInTheDocument();
    });
    expect(onCapture).toHaveBeenCalledTimes(1);
    expect((onCapture.mock.calls[0]?.[0] as string)).toMatch(/^data:/);
  });
});
