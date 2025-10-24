export class AuthorizationError extends Error {
  constructor(message = "Accès non autorisé") {
    super(message);
    this.name = "AuthorizationError";
  }
}
