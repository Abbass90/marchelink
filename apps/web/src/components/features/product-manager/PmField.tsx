interface PmFieldProps {
  id: string;
  label: string;
  testId: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: (() => void) | undefined;
  error?: string | undefined;
  errorTestId?: string | undefined;
  type?: 'text' | 'number' | undefined;
  disabled?: boolean | undefined;
  placeholder?: string | undefined;
  min?: number | undefined;
  step?: number | undefined;
}

/**
 * Champ texte/nombre du formulaire produit (label + input + message d'erreur).
 * Factorise les 5 champs identiques de la modale (SKU, nom, prix, stock, unité).
 */
export default function PmField({
  id, label, testId, value, onChange, onBlur,
  error, errorTestId, type = 'text', disabled, placeholder, min, step,
}: PmFieldProps) {
  return (
    <div className="pm-field">
      <label className="pm-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        className={`pm-input ${error ? 'pm-input--error' : ''}`}
        data-testid={testId}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        min={min}
        step={step}
      />
      {error && <span className="pm-error-hint" data-testid={errorTestId}>{error}</span>}
    </div>
  );
}
