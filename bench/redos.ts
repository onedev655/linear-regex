import { Regex } from "../src/index";

const PATTERN = "(a+)+$";
const NATIVE = /^(a+)+$/;
const ABORT_MS = 2000;

function timeNative(n: number): number | null {
  const input = "a".repeat(n) + "!";
  const started = performance.now();
  NATIVE.test(input);
  const elapsed = performance.now() - started;
  return elapsed;
}

function timeOurs(n: number): number {
  const re = new Regex(PATTERN);
  const input = "a".repeat(n) + "!";
  const started = performance.now();
  re.test(input);
  return performance.now() - started;
}

function fmt(ms: number): string {
  if (ms < 1) return ms.toFixed(3) + " ms";
  if (ms < 1000) return ms.toFixed(2) + " ms";
  return (ms / 1000).toFixed(2) + " s";
}

console.log(`Pattern: /${PATTERN}/   (input = "aaa...a!" of length n+1)\n`);

console.log("Native JS RegExp — backtracking (exponential):");
console.log("  n     time");
for (const n of [10, 15, 20, 24, 26, 28, 30, 32, 34]) {
  const t = timeNative(n);
  if (t === null) break;
  console.log(`  ${String(n).padStart(3)}   ${fmt(t)}`);
  if (t > ABORT_MS) {
    console.log(`  ...aborting: native engine already over ${ABORT_MS} ms\n`);
    break;
  }
}

console.log("\nThis engine — Thompson NFA (linear):");
console.log("  n          time");
for (const n of [10, 30, 100, 1_000, 10_000, 100_000, 1_000_000]) {
  const t = timeOurs(n);
  console.log(`  ${String(n).padStart(9)}   ${fmt(t)}`);
}

console.log(
  "\nNote how doubling n roughly doubles this engine's time, while the native\n" +
    "engine's time roughly doubles for every +1 to n. That gap is the difference\n" +
    "between O(n*m) and O(2^n)."
);
