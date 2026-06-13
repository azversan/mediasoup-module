export class MediasoupException extends Error {
  readonly name = 'MediasoupException';
  constructor(
    message: string,

    /**
     * The original error that triggered this exception, if any.
     * Useful for logging / debugging without losing the root cause.
     */
    public readonly cause?: unknown,
  ) {
    super(message);

    /**
     * Restore the prototype chain so `instanceof MediasoupException` works
     * correctly after TypeScript transpilation to ES5.
     */
    Object.setPrototypeOf(this, new.target.prototype);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
