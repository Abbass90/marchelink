import { useRef, useState } from 'react';
import { X, ImageIcon, Camera, Loader } from 'lucide-react';
import { uploadProductImage, ApiError } from '../../api/client.js';

interface Props {
  value: string;          // URL actuelle (vide si pas d'image)
  onChange: (url: string) => void;
}

/**
 * Bouton "📷 Choisir une photo" + aperçu immédiat + upload Cloudinary.
 * Sur mobile, `capture="environment"` ouvre directement la caméra arrière.
 */
export default function ProductImageUpload({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError('');
    try {
      const { url } = await uploadProductImage(file);
      onChange(url);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Erreur lors de l\'upload';
      setUploadError(msg);
    } finally {
      setUploading(false);
      // Réinitialise l'input pour permettre de re-sélectionner le même fichier
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="pm-image-upload">
      {/* Aperçu ou placeholder */}
      {value ? (
        <div className="pm-image-preview">
          <img src={value} alt="Aperçu produit" className="pm-image-thumb" />
          <button
            type="button"
            className="pm-image-remove"
            onClick={() => onChange('')}
            aria-label="Supprimer l'image"
            data-testid="pm-image-remove"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="pm-image-placeholder" aria-hidden="true"><ImageIcon size={40} /></div>
      )}

      {/* Input caché — ouvert par le bouton */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="pm-image-input-hidden"
        data-testid="pm-image-file-input"
        onChange={(e) => void handleFileChange(e)}
        disabled={uploading}
        aria-label="Sélectionner une photo"
      />

      <button
        type="button"
        className="ws-btn ws-btn--secondary pm-image-btn"
        data-testid="pm-image-upload-btn"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading
          ? <><Loader size={16} className="pm-btn-icon" /> Envoi en cours…</>
          : <><Camera size={16} className="pm-btn-icon" /> Choisir une photo</>
        }
      </button>

      {uploadError && (
        <p className="pm-error-hint" data-testid="pm-image-error">{uploadError}</p>
      )}
    </div>
  );
}
