import { RegexSyntaxError } from "./errors";

export type CharPredicate = (codePoint: number) => boolean;

export type OpValue = "*" | "+" | "?" | "|" | "(" | ")";

export type Token =
  | { type: "char"; matches: CharPredicate; label: string }
  | { type: "op"; value: OpValue };

const NEWLINE = 0x0a;

const isDigit = (cp: number): boolean => cp >= 0x30 && cp <= 0x39;
const isWord = (cp: number): boolean =>
  isDigit(cp) ||
  (cp >= 0x41 && cp <= 0x5a) ||
  (cp >= 0x61 && cp <= 0x7a) ||
  cp === 0x5f;
const isSpace = (cp: number): boolean =>
  cp === 0x20 ||
  cp === 0x09 ||
  cp === 0x0a ||
  cp === 0x0d ||
  cp === 0x0c ||
  cp === 0x0b;

function shorthandClass(ch: string): CharPredicate | null {
  switch (ch) {
    case "d":
      return isDigit;
    case "D":
      return (cp) => !isDigit(cp);
    case "w":
      return isWord;
    case "W":
      return (cp) => !isWord(cp);
    case "s":
      return isSpace;
    case "S":
      return (cp) => !isSpace(cp);
    default:
      return null;
  }
}

export function tokenize(pattern: string): Token[] {
  const chars = Array.from(pattern);
  const tokens: Token[] = [];
  let i = 0;

  while (i < chars.length) {
    const c = chars[i];

    switch (c) {
      case "*":
      case "+":
      case "?":
      case "|":
      case "(":
      case ")":
        tokens.push({ type: "op", value: c });
        i++;
        break;

      case ".":
        tokens.push({ type: "char", matches: (cp) => cp !== NEWLINE, label: "." });
        i++;
        break;

      case "\\": {
        const next = chars[i + 1];
        if (next === undefined) {
          throw new RegexSyntaxError("Dangling '\\' at end of pattern");
        }
        const shorthand = shorthandClass(next);
        if (shorthand) {
          tokens.push({ type: "char", matches: shorthand, label: "\\" + next });
        } else {
          const cp = next.codePointAt(0)!;
          tokens.push({ type: "char", matches: (x) => x === cp, label: next });
        }
        i += 2;
        break;
      }

      case "[": {
        const [matches, label, consumed] = lexCharClass(chars, i);
        tokens.push({ type: "char", matches, label });
        i += consumed;
        break;
      }

      default: {
        const cp = c.codePointAt(0)!;
        tokens.push({ type: "char", matches: (x) => x === cp, label: c });
        i++;
      }
    }
  }

  return tokens;
}

function lexCharClass(
  chars: string[],
  start: number
): [CharPredicate, string, number] {
  let i = start + 1;

  let negated = false;
  if (chars[i] === "^") {
    negated = true;
    i++;
  }

  const ranges: Array<[number, number]> = [];
  const subPredicates: CharPredicate[] = [];
  let inner = "";

  while (i < chars.length && chars[i] !== "]") {
    let lo: number;

    if (chars[i] === "\\") {
      const nx = chars[i + 1];
      if (nx === undefined) {
        throw new RegexSyntaxError("Dangling '\\' inside character class");
      }
      const shorthand = shorthandClass(nx);
      if (shorthand) {
        subPredicates.push(shorthand);
        inner += "\\" + nx;
        i += 2;
        continue;
      }
      lo = nx.codePointAt(0)!;
      inner += "\\" + nx;
      i += 2;
    } else {
      lo = chars[i].codePointAt(0)!;
      inner += chars[i];
      i++;
    }

    if (chars[i] === "-" && chars[i + 1] !== undefined && chars[i + 1] !== "]") {
      i++;
      let hi: number;
      if (chars[i] === "\\") {
        const nx = chars[i + 1];
        if (nx === undefined) {
          throw new RegexSyntaxError("Dangling '\\' inside character class");
        }
        hi = nx.codePointAt(0)!;
        inner += "-\\" + nx;
        i += 2;
      } else {
        hi = chars[i].codePointAt(0)!;
        inner += "-" + chars[i];
        i++;
      }
      if (hi < lo) {
        throw new RegexSyntaxError(`Reversed range in character class: ${inner}`);
      }
      ranges.push([lo, hi]);
    } else {
      ranges.push([lo, lo]);
    }
  }

  if (chars[i] !== "]") {
    throw new RegexSyntaxError("Unterminated character class, expected ']'");
  }
  i++;

  const consumed = i - start;
  const label = "[" + (negated ? "^" : "") + inner + "]";

  const matches: CharPredicate = (cp) => {
    let hit = false;
    for (const [lo, hi] of ranges) {
      if (cp >= lo && cp <= hi) {
        hit = true;
        break;
      }
    }
    if (!hit) {
      for (const p of subPredicates) {
        if (p(cp)) {
          hit = true;
          break;
        }
      }
    }
    return negated ? !hit : hit;
  };

  return [matches, label, consumed];
}
