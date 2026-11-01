export class DomainError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fieldErrors?: Record<string, string>;
  constructor(code: string, status: number, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}
