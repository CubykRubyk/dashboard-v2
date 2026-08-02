export class DocumentError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_FILE"
      | "FILE_NOT_FOUND"
      | "NOT_FOUND"
      | "UNAUTHORIZED",
  ) {
    super(message);
    this.name = "DocumentError";
  }
}
