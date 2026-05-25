// Classes d'erreur typées — cf. CLAUDE.md Naming Conventions.
export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(422, 'VALIDATION_ERROR', message);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Forbidden in this tenant') {
    // CLAUDE.md §14 : 403 uniquement pour défaut de droits intra-tenant.
    super(403, 'AUTHORIZATION_ERROR', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, 'NOT_FOUND', message);
  }
}

export class CrossTenantError extends NotFoundError {
  // CLAUDE.md §14 : tentative cross-tenant → 404, jamais 403.
  constructor() {
    super('Not found');
  }
}
