export class MigrationGuardError extends Error {
  constructor(code) {
    super(code);
    this.name = "MigrationGuardError";
    this.code = code;
  }
}
