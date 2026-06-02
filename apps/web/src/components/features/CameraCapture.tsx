import { useRef, useState, useCallback, useEffect } from 'react';

type CaptureState = 'idle' | 'streaming' | 'captured';

interface Props {
  onCapture: (dataUrl: string) => void;
  onClear: () => void;
}

export default function CameraCapture({ onCapture, onClear }: Props) {
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /* ── Cleanup : stopper le stream à l'unmount ─────────── */
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  /* ── Démarrer la caméra ─────────────────────────────── */
  const handleStart = useCallback(async () => {
    setStreamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCaptureState('streaming');
    } catch {
      setStreamError("Impossible d'accéder à la caméra. Vérifiez les permissions.");
    }
  }, []);

  /* ── Capturer une frame ─────────────────────────────── */
  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

    stopStream();
    setPreviewUrl(dataUrl);
    setCaptureState('captured');
    onCapture(dataUrl);
  }, [onCapture, stopStream]);

  /* ── Annuler (retour idle depuis streaming) ─────────── */
  const handleCancel = useCallback(() => {
    stopStream();
    setCaptureState('idle');
  }, [stopStream]);

  /* ── Reprendre (retour idle depuis captured) ────────── */
  const handleRetake = useCallback(() => {
    setPreviewUrl(null);
    setCaptureState('idle');
    onClear();
  }, [onClear]);

  return (
    <div className="camera-capture" data-testid="camera-capture">

      {/* ── Idle ─────────────────────────────────────────── */}
      {captureState === 'idle' && (
        <div className="camera-capture__idle">
          <button
            type="button"
            className="auth-submit auth-submit--secondary"
            data-testid="camera-start-btn"
            onClick={() => void handleStart()}
          >
            Prendre une photo
          </button>
          {streamError && (
            <p className="auth-field-error camera-capture__error" data-testid="camera-error">
              {streamError}
            </p>
          )}
        </div>
      )}

      {/* ── Streaming ────────────────────────────────────── */}
      {captureState === 'streaming' && (
        <div className="camera-capture__stream">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            className="camera-capture__video"
            data-testid="camera-video"
            playsInline
            muted
          />
          <div className="camera-capture__stream-actions">
            <button
              type="button"
              className="auth-submit"
              data-testid="camera-capture-btn"
              onClick={handleCapture}
            >
              Capturer
            </button>
            <button
              type="button"
              className="auth-submit auth-submit--ghost"
              data-testid="camera-cancel-btn"
              onClick={handleCancel}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* ── Captured ─────────────────────────────────────── */}
      {captureState === 'captured' && previewUrl && (
        <div className="camera-capture__preview">
          <img
            src={previewUrl}
            className="camera-capture__img"
            data-testid="camera-preview"
            alt="Votre photo de profil"
          />
          <button
            type="button"
            className="auth-submit auth-submit--secondary"
            data-testid="camera-retake-btn"
            onClick={handleRetake}
          >
            Reprendre
          </button>
        </div>
      )}

      {/* Canvas caché pour la capture ────────────────────── */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
