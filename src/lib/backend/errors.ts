export class BackendError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function safeError(error: unknown) {
  if (error instanceof BackendError)
    return { status: error.status, message: error.message };
  return {
    status: 503,
    message:
      "The archive could not be reached. Please try again; your original files have not been changed.",
  };
}
export function safeNext(value: string | null) {
  return value &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !value.startsWith("/auth/") &&
    !/[\r\n]/.test(value)
    ? value
    : "/";
}
