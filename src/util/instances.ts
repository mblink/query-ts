import { Ord } from "fp-ts/lib/Ord";
import { Eq, strictEqual } from "fp-ts/lib/Eq";
import { merge } from "./merge";
import { Ordering } from "fp-ts/lib/Ordering";

export const eqSetoid = <A>(): Eq<A> => ({ equals: strictEqual });
export const eqOrd = <A>(): Ord<A> => merge(eqSetoid<A>())({ compare: unsafeCompare });


function unsafeCompare(x: any, y: any): Ordering {
  return x < y ? -1 : x > y ? 1 : 0; // tslint:disable-line:no-unsafe-any
}