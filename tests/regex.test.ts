import { describe, it, expect } from "vitest";
import { Regex, RegexSyntaxError } from "../src/index";

const matches = (pattern: string, input: string): boolean =>
  new Regex(pattern).test(input);

describe("literals and concatenation", () => {
  it("matches an exact string", () => {
    expect(matches("abc", "abc")).toBe(true);
  });

  it("is a full match, not a substring search", () => {
    expect(matches("abc", "abcd")).toBe(false);
    expect(matches("abc", "zabc")).toBe(false);
  });

  it("matches the empty pattern against the empty string only", () => {
    expect(matches("", "")).toBe(true);
    expect(matches("", "a")).toBe(false);
  });
});

describe("alternation", () => {
  it("matches either branch", () => {
    const re = new Regex("cat|dog");
    expect(re.test("cat")).toBe(true);
    expect(re.test("dog")).toBe(true);
    expect(re.test("cow")).toBe(false);
  });

  it("supports an empty branch", () => {
    const re = new Regex("a|");
    expect(re.test("a")).toBe(true);
    expect(re.test("")).toBe(true);
    expect(re.test("b")).toBe(false);
  });
});

describe("quantifiers", () => {
  it("'*' matches zero or more", () => {
    const re = new Regex("ab*c");
    expect(re.test("ac")).toBe(true);
    expect(re.test("abc")).toBe(true);
    expect(re.test("abbbbc")).toBe(true);
    expect(re.test("abx")).toBe(false);
  });

  it("'+' matches one or more", () => {
    const re = new Regex("ab+c");
    expect(re.test("ac")).toBe(false);
    expect(re.test("abc")).toBe(true);
    expect(re.test("abbc")).toBe(true);
  });

  it("'?' matches zero or one", () => {
    const re = new Regex("colou?r");
    expect(re.test("color")).toBe(true);
    expect(re.test("colour")).toBe(true);
    expect(re.test("colouur")).toBe(false);
  });

  it("stacks quantifiers", () => {
    expect(matches("a*", "")).toBe(true);
    expect(matches("a*", "aaaa")).toBe(true);
  });
});

describe("grouping", () => {
  it("applies a quantifier to a group", () => {
    const re = new Regex("(ab)+");
    expect(re.test("ab")).toBe(true);
    expect(re.test("ababab")).toBe(true);
    expect(re.test("aba")).toBe(false);
  });

  it("combines grouping and alternation", () => {
    const re = new Regex("(a|b)+c");
    expect(re.test("abbabac")).toBe(true);
    expect(re.test("c")).toBe(false);
  });
});

describe("character classes", () => {
  it("matches a range", () => {
    const re = new Regex("[a-z]+");
    expect(re.test("hello")).toBe(true);
    expect(re.test("Hello")).toBe(false);
  });

  it("matches a negated class", () => {
    const re = new Regex("[^0-9]+");
    expect(re.test("abc")).toBe(true);
    expect(re.test("ab1")).toBe(false);
  });

  it("mixes ranges and singletons", () => {
    const re = new Regex("[A-Za-z0-9_]+");
    expect(re.test("Foo_42")).toBe(true);
    expect(re.test("Foo-42")).toBe(false);
  });
});

describe("shorthand classes and dot", () => {
  it("matches \\d, \\w and \\s", () => {
    expect(matches("\\d+", "2026")).toBe(true);
    expect(matches("\\w+", "snake_case99")).toBe(true);
    expect(matches("a\\sb", "a b")).toBe(true);
    expect(matches("\\d+", "20a6")).toBe(false);
  });

  it("'.' matches any character except newline", () => {
    expect(matches("a.c", "axc")).toBe(true);
    expect(matches("a.c", "a\nc")).toBe(false);
  });
});

describe("escapes", () => {
  it("escapes metacharacters into literals", () => {
    expect(matches("a\\.b", "a.b")).toBe(true);
    expect(matches("a\\.b", "axb")).toBe(false);
    expect(matches("\\(\\)", "()")).toBe(true);
  });
});

describe("unicode", () => {
  it("treats astral characters as single units", () => {
    expect(matches("a.c", "a😀c")).toBe(true);
    expect(matches("😀+", "😀😀😀")).toBe(true);
  });
});

describe("syntax errors", () => {
  it("rejects unbalanced parentheses", () => {
    expect(() => new Regex("(a")).toThrow(RegexSyntaxError);
    expect(() => new Regex("a)")).toThrow(RegexSyntaxError);
  });

  it("rejects a dangling quantifier", () => {
    expect(() => new Regex("*a")).toThrow(RegexSyntaxError);
  });

  it("rejects a dangling escape", () => {
    expect(() => new Regex("a\\")).toThrow(RegexSyntaxError);
  });

  it("rejects an unterminated character class", () => {
    expect(() => new Regex("[a-z")).toThrow(RegexSyntaxError);
  });

  it("rejects a reversed range", () => {
    expect(() => new Regex("[z-a]")).toThrow(RegexSyntaxError);
  });
});

describe("no catastrophic backtracking (the whole point)", () => {
  it("answers a pathological pattern correctly and instantly", () => {
    const re = new Regex("(a*)*c");
    const evil = "a".repeat(50_000);

    const started = performance.now();
    const result = re.test(evil);
    const elapsedMs = performance.now() - started;

    expect(result).toBe(false);
    expect(elapsedMs).toBeLessThan(250);
  });

  it("still matches when it should", () => {
    const re = new Regex("(a*)*c");
    expect(re.test("aaaaaaaaaac")).toBe(true);
    expect(re.test("c")).toBe(true);
  });
});
