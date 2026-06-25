import { RegexSyntaxError } from "./errors";
import type { CharPredicate, OpValue, Token } from "./lexer";

export type AstNode =
  | { type: "Empty" }
  | { type: "Char"; matches: CharPredicate; label: string }
  | { type: "Concat"; parts: AstNode[] }
  | { type: "Alternate"; options: AstNode[] }
  | { type: "Star"; node: AstNode }
  | { type: "Plus"; node: AstNode }
  | { type: "Optional"; node: AstNode };

export function parse(tokens: Token[]): AstNode {
  const parser = new Parser(tokens);
  const ast = parser.parseAlternation();
  parser.expectEnd();
  return ast;
}

class Parser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private advance(): void {
    this.pos++;
  }

  private isOp(value: OpValue): boolean {
    const t = this.peek();
    return t !== undefined && t.type === "op" && t.value === value;
  }

  parseAlternation(): AstNode {
    const options: AstNode[] = [this.parseConcat()];
    while (this.isOp("|")) {
      this.advance();
      options.push(this.parseConcat());
    }
    return options.length === 1 ? options[0] : { type: "Alternate", options };
  }

  parseConcat(): AstNode {
    const parts: AstNode[] = [];
    while (true) {
      const t = this.peek();
      if (t === undefined) break;
      if (t.type === "op" && (t.value === "|" || t.value === ")")) break;
      parts.push(this.parseRepeat());
    }
    if (parts.length === 0) return { type: "Empty" };
    if (parts.length === 1) return parts[0];
    return { type: "Concat", parts };
  }

  parseRepeat(): AstNode {
    let node = this.parseAtom();
    while (true) {
      if (this.isOp("*")) {
        this.advance();
        node = { type: "Star", node };
      } else if (this.isOp("+")) {
        this.advance();
        node = { type: "Plus", node };
      } else if (this.isOp("?")) {
        this.advance();
        node = { type: "Optional", node };
      } else {
        break;
      }
    }
    return node;
  }

  parseAtom(): AstNode {
    const t = this.peek();
    if (t === undefined) {
      throw new RegexSyntaxError("Unexpected end of pattern, expected an expression");
    }

    if (t.type === "char") {
      this.advance();
      return { type: "Char", matches: t.matches, label: t.label };
    }

    if (t.value === "(") {
      this.advance();
      const inner = this.parseAlternation();
      if (!this.isOp(")")) {
        throw new RegexSyntaxError("Unbalanced '(', expected ')'");
      }
      this.advance();
      return inner;
    }

    throw new RegexSyntaxError(`Unexpected '${t.value}' — nothing for it to apply to`);
  }

  expectEnd(): void {
    const t = this.peek();
    if (t !== undefined) {
      const shown = t.type === "op" ? t.value : t.label;
      throw new RegexSyntaxError(`Unexpected trailing token '${shown}'`);
    }
  }
}
