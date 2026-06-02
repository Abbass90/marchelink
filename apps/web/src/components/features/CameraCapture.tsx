import { useRef, useState, useCallback, useEffect } from 'react';

type CaptureState = 'idle' | 'streaming' | 'captured';

interface Props {
  onCapture: (dataUrl: string) => void;
  onClear: () => void;
}

/** Détection de support getUserMedia (absent en HTTP non-localhost, vieux navigateurs…). */
function cameraSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

export default function CameraCapture({ onCapture, onClear }: Props) {
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [showFileFallback, setShowFileFallback] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  /* ── Démarrer la caméra ─────────────────────────────────
     On récupère le flux PUIS on passe en 'streaming'. L'attachement
     réel du flux à l'élément <video> se fait dans l'effet ci-dessous,
     car le <video> n'est monté qu'une fois l'état devenu 'streaming'.
     (C'était la cause du bug : videoRef.current était null ici.)        */
  const handleStart = useCallback(async () => {
    setStreamError(null);
    setVideoReady(false);

    if (!cameraSupported()) {
      setStreamError(
        "Votre navigateur ne permet pas l'accès à la caméra. Importez une photo à la place.",
      );
      setShowFileFallback(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      setCaptureState('streaming');
    } catch (err) {
      const name = (err as { name?: string })?.name ?? '';
      const msg = (err as { message?: string })?.message ?? '';
      if (name === 'NotAllowedError' || /NotAllowed|Permission/i.test(msg)) {
        setStreamError(
          "Accès à la caméra refusé. Autorisez la caméra dans votre navigateur, ou importez une photo.",
        );
      } else if (name === 'NotFoundError' || /NotFound/i.test(msg)) {
        setStreamError('Aucune caméra détectée. Importez une photo à la place.');
      } else {
        setStreamError("Impossible d'accéder à la caméra. Importez une photo à la place.");
      }
      setShowFileFallback(true);
    }
  }, []);

  /* ── Attacher le flux au <video> une fois celui-ci monté ── */
  useEffect(() => {
    if (captureState !== 'streaming') return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;

    const markReady = () => setVideoReady(true);
    video.addEventListener('loadedmetadata', markReady);
    video.addEventListener('canplay', markReady);

    // play() ne résout qu'une fois la lecture réellement démarrée → vidéo prête.
    void video.play().then(markReady).catch(() => {
      /* l'autoplay peut être différé ; les events ci-dessus prendront le relais */
    });

    return () => {
      video.removeEventListener('loadedmetadata', markReady);
      video.removeEventListener('canplay', markReady);
    };
  }, [captureState]);

  /* ── Capturer une frame ─────────────────────────────── */
  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Dimensions réelles du flux — évite le canvas noir / vide.
    const width = video.videoWidth || video.clientWidth || 640;
    const height = video.videoHeight || video.clientHeight || 480;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

    stopStream();
    setVideoReady(false);
    setPreviewUrl(dataUrl);
    setCaptureState('captured');
    onCapture(dataUrl);
  }, [onCapture, stopStream]);

  /* ── Fallback : import d'un fichier image ───────────── */
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        setStreamError('Veuillez sélectionner une image.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setStreamError(null);
        setShowFileFallback(false);
        setPreviewUrl(dataUrl);
        setCaptureState('captured');
        onCapture(dataUrl);
      };
      reader.onerror = () => setStreamError("Impossible de lire l'image sélectionnée.");
      reader.readAsDataURL(file);
    },
    [onCapture],
  );

  /* ── Annuler (retour idle depuis streaming) ─────────── */
  const handleCancel = useCallback(() => {
    stopStream();
    setVideoReady(false);
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

          {/* Fallback upload : visible uniquement si la caméra est indisponible */}
          {showFileFallback && (
            <>
              <button
                type="button"
                className="auth-submit auth-submit--ghost"
                data-testid="camera-file-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                Importer une photo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="user"
                style={{ display: 'none' }}
                data-testid="camera-file-input"
                onChange={handleFileChange}
              />
            </>
          )}

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
            autoPlay
          />
          <div className="camera-capture__stream-actions">
            <button
              type="button"
              className="auth-submit"
              data-testid="camera-capture-btn"
              onClick={handleCapture}
              disabled={!videoReady}
            >
              {videoReady ? 'Capturer' : 'Initialisation…'}
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
