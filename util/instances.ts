import { Ord, unsafeCompare } from "fp-ts/lib/Ord";
import { Setoid, strictEqual } from "fp-ts/lib/Setoid";
import { merge } from "./merge";

export const eqSetoid = <A>(): Setoid<A> => ({ equals: strictEqual });
export const eqOrd = <A>(): Ord<A> => merge(eqSetoid<A>())({ compare: unsafeCompare });
