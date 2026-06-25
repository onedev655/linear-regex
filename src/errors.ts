export class RegexSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegexSyntaxError";
  }
}
