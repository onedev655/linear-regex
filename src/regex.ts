import { compile, type State } from "./compiler";
import { tokenize } from "./lexer";
import { parse } from "./parser";
import { test as runMatch } from "./matcher";

export class Regex {
  readonly source: string;
  private readonly start: State;

  constructor(pattern: string) {
    this.source = pattern;
    const tokens = tokenize(pattern);
    const ast = parse(tokens);
    this.start = compile(ast);
  }

  test(input: string): boolean {
    return runMatch(this.start, input);
  }
}

export function compileRegex(pattern: string): Regex {
  return new Regex(pattern);
}
