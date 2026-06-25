import type { State } from "./compiler";

export function test(start: State, input: string): boolean {
  let current = new Set<State>();
  addState(current, start);

  for (const ch of input) {
    if (current.size === 0) return false;
    const cp = ch.codePointAt(0)!;

    const next = new Set<State>();
    for (const s of current) {
      if (s.kind === "char" && s.matches!(cp)) {
        addState(next, s.out);
      }
    }
    current = next;
  }

  for (const s of current) {
    if (s.kind === "match") return true;
  }
  return false;
}

function addState(set: Set<State>, s: State | null): void {
  if (s === null || set.has(s)) return;
  set.add(s);
  if (s.kind === "split") {
    addState(set, s.out1);
    addState(set, s.out2);
  }
}
