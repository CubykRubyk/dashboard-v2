export class BackupError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_FILE"
      | "FILE_NOT_FOUND"
      | "TOOL_MISSING"
      | "COMMAND_FAILED"
      | "UNAUTHORIZED",
  ) {
    super(message);
    this.name = "BackupError";
  }
}
