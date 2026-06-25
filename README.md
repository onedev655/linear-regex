# linear-regex

A small regular-expression engine that matches in **guaranteed linear time** by
compiling patterns to a Thompson NFA and simulating all states in parallel —
making it immune to the catastrophic backtracking (ReDoS) that affects most
mainstream engines.

No dependencies in the library itself. ~500 lines across four clearly separated
stages.

```ts
import { Regex } from "./src";

const re = new Regex("(a|b)+@\\w+\\.[a-z]+");
re.test("ab@example.com"); // true
re.test("@nope");          // false
```

## Why this is interesting

Most regex engines you use every day — including JavaScript's built-in
`RegExp`, Python's `re`, and Java's `Pattern` — match by **backtracking**. For
many patterns that is fine, but for a whole class of patterns it is
catastrophic. Consider:

```js
/^(a+)+$/.test("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!");
```

The backtracking engine tries to split those `a`s among the nested `+`
quantifiers in every possible way before concluding there is no match. The
number of ways grows as **2ⁿ**. On a modern laptop this single line takes
**seconds to minutes** as the string grows — a short, attacker-controlled input
that pins a CPU core. This is a real, catalogued vulnerability class:
**ReDoS (Regular Expression Denial of Service)**.

This engine takes the other classical route — the one Ken Thompson described in
1968 and Russ Cox popularised. It compiles the pattern into a non-deterministic
finite automaton and then simulates **every reachable state at once**, advancing
them in lock-step over the input. There is no backtracking to exploit. Matching
is **O(n · m)** (input length × pattern size) for *every* input.

See [`bench/redos.ts`](bench/redos.ts) for a side-by-side comparison; sample
output:

```
Native JS RegExp — backtracking (exponential):
  n     time
   10   0.05 ms
   20   2.97 ms
   26   173.91 ms
   28   704.65 ms
   30   2.86 s
  ...aborting: native engine already over 2000 ms

This engine — Thompson NFA (linear):
  n          time
         10   0.08 ms
      1,000   0.64 ms
    100,000   7.65 ms
  1,000,000   73.91 ms
```

The native engine needs **2.86 s** for a 31-character string; this engine
handles **a million characters in 74 ms** of the very same pattern.

## Architecture

The engine is a four-stage pipeline; each stage is one small, single-purpose
file:

```
pattern string
      │  src/lexer.ts      tokenize: escapes + character classes -> tokens
      ▼
   Token[]
      │  src/parser.ts     recursive-descent parse -> AST
      ▼
   AstNode
      │  src/compiler.ts   Thompson's construction -> NFA
      ▼
   State (NFA entry)
      │  src/matcher.ts    parallel state-set simulation -> boolean
      ▼
   true / false
```

| Stage      | File              | Responsibility |
| ---------- | ----------------- | -------------- |
| Lexer      | `src/lexer.ts`    | Handles the two context-sensitive parts of regex syntax: escapes (`\.`, `\d`, …) and character classes (`[a-z]`, `[^0-9]`). Emits a flat token stream where every literal/class is a single `char` token carrying a `matches(codePoint)` predicate. |
| Parser     | `src/parser.ts`   | Recursive-descent parser. Encodes precedence by grammar layering (`alternation` → `concat` → `repeat` → `atom`) and produces an AST. |
| Compiler   | `src/compiler.ts` | Builds the NFA via the "fragment with dangling outputs" technique, so combinators compose without ever needing a second pass to wire states together. |
| Matcher    | `src/matcher.ts`  | Simulates the NFA over the input as an evolving *set* of active states. The set deduplicates ε-cycles, which is exactly what guarantees linear time. |

### The key idea, concretely

A backtracking engine asks *"which single path through the pattern matches?"*
and tries paths one after another. This engine asks *"which set of states could
I be in right now?"* and tracks the whole set simultaneously. Because there are
at most `m` states and each is visited at most once per input character, total
work is bounded by `n · m` — no input can ever cause exponential blow-up.

## Supported syntax

- Literals and escapes: `abc`, `\.`, `\\`, `\(`
- `.` — any character except newline
- Alternation: `a|b`
- Grouping: `(ab)`
- Quantifiers: `*` (zero or more), `+` (one or more), `?` (zero or one)
- Character classes: `[a-z]`, `[^0-9]`, `[A-Za-z0-9_]`, `[\d.]`
- Shorthand classes: `\d \w \s` and their negations `\D \W \S`
- Unicode-aware: astral characters (emoji, …) are treated as single units

`test(input)` performs a **full match** (anchored at both ends, like `^…$`). To
search anywhere in the text, wrap the pattern: `new Regex(".*(" + p + ").*")`.

Invalid patterns throw a typed `RegexSyntaxError` (unbalanced parentheses,
dangling escape, reversed/unterminated character class, stray quantifier).

## Deliberate scope

This is a focused sample, not a drop-in `RegExp` replacement. Left out on
purpose, with a clear path to add each: capture-group *extraction* (the NFA
already groups, it just doesn't record spans), backreferences (not regular —
genuinely needs backtracking), lazy quantifiers, and anchors mid-pattern. The
goal was to implement the linear-time core correctly and clearly rather than to
cover every feature.

## Running

```bash
npm install
npm test        # unit tests, including the ReDoS-resistance test
npm run bench   # backtracking vs. linear, side by side
npm run typecheck
```

## References

- Ken Thompson, *Regular Expression Search Algorithm*, CACM 1968
- Russ Cox, [*Regular Expression Matching Can Be Simple And Fast*](https://swtch.com/~rsc/regexp/regexp1.html)
