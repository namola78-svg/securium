export class MigrationGuardError extends Error {
  constructor(code, options) {
    super(code, options);
    this.name = "MigrationGuardError";
    this.code = code;
  }
}
