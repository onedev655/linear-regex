import type { CharPredicate } from "./lexer";
import type { AstNode } from "./parser";

export type StateKind = "char" | "split" | "match";

export interface State {
  readonly id: number;
  kind: StateKind;
  matches: CharPredicate | null;
  out: State | null;
  out1: State | null;
  out2: State | null;
}

type Patch = (target: State) => void;

interface Fragment {
  start: State;
  outs: Patch[];
}

function applyPatches(outs: Patch[], target: State): void {
  for (const p of outs) p(target);
}

export function compile(ast: AstNode): State {
  const builder = new NfaBuilder();
  const frag = builder.build(ast);
  const accept = builder.createMatch();
  applyPatches(frag.outs, accept);
  return frag.start;
}

class NfaBuilder {
  private counter = 0;

  private createChar(matches: CharPredicate): State {
    return { id: this.counter++, kind: "char", matches, out: null, out1: null, out2: null };
  }

  private createSplit(): State {
    return { id: this.counter++, kind: "split", matches: null, out: null, out1: null, out2: null };
  }

  createMatch(): State {
    return { id: this.counter++, kind: "match", matches: null, out: null, out1: null, out2: null };
  }

  build(node: AstNode): Fragment {
    switch (node.type) {
      case "Empty": {
        const s = this.createSplit();
        return {
          start: s,
          outs: [(t) => (s.out1 = t), (t) => (s.out2 = t)],
        };
      }

      case "Char": {
        const s = this.createChar(node.matches);
        return { start: s, outs: [(t) => (s.out = t)] };
      }

      case "Concat": {
        let first: Fragment | null = null;
        let prev: Fragment | null = null;
        for (const part of node.parts) {
          const frag = this.build(part);
          if (first === null) first = frag;
          if (prev !== null) applyPatches(prev.outs, frag.start);
          prev = frag;
        }
        return { start: first!.start, outs: prev!.outs };
      }

      case "Alternate": {
        const frags = node.options.map((o) => this.build(o));
        let combined = frags[0];
        for (let k = 1; k < frags.length; k++) {
          const s = this.createSplit();
          s.out1 = combined.start;
          s.out2 = frags[k].start;
          combined = { start: s, outs: [...combined.outs, ...frags[k].outs] };
        }
        return combined;
      }

      case "Star": {
        const s = this.createSplit();
        const child = this.build(node.node);
        s.out1 = child.start;
        applyPatches(child.outs, s);
        return { start: s, outs: [(t) => (s.out2 = t)] };
      }

      case "Plus": {
        const s = this.createSplit();
        const child = this.build(node.node);
        s.out1 = child.start;
        applyPatches(child.outs, s);
        return { start: child.start, outs: [(t) => (s.out2 = t)] };
      }

      case "Optional": {
        const s = this.createSplit();
        const child = this.build(node.node);
        s.out1 = child.start;
        return { start: s, outs: [...child.outs, (t) => (s.out2 = t)] };
      }
    }
  }
}
