// Augmentation ambiante globale de la Request Express.
// Centralise les champs injectés par nos middlewares (auth, correlation-id)
// pour qu'ils soient typés dans tous les controllers (rootDir: src).
// On augmente le namespace global `Express` (et non `express-serve-static-core`
// par nom de module, non résoluble sous pnpm) : @types/express fusionne ce
// namespace dans la Request de base.
export {};

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        organization_id: string | null;
      };
      correlationId: string;
    }
  }
}
