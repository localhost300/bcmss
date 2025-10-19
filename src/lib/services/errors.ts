export class InvalidIdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidIdError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
