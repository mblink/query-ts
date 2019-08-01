import escapeHtml from "escape-html";
import { flatten, last, zip } from "fp-ts/lib/Array";
import { flow } from "fp-ts/lib/function";
import { pipe } from "fp-ts/lib/pipeable";
import { fold, fromNullable } from "fp-ts/lib/Option";
import { invoke0 } from "../util/invoke";
import { wrapArr } from "../util/wrapArr";

export const UNSAFE_HTML_KIND = "unsafeHtml";

export interface UnsafeHtml<S extends string = string> {
  kind: typeof UNSAFE_HTML_KIND;
  toString(): S;
}

export function UnsafeHtml<S extends string>(s: S): UnsafeHtml<S> {
  return { kind: UNSAFE_HTML_KIND, toString: () => s };
}

export function isUnsafeHtml(a: any): a is UnsafeHtml {
  // tslint:disable-next-line no-unsafe-any
  return a && a.kind === UNSAFE_HTML_KIND && typeof a.toString === "function";
}

export function html(tsa: TemplateStringsArray, ...vars: any[]): UnsafeHtml {
  const fmt = (x: any): string => isUnsafeHtml(x) ? x.toString() : fold(() => "", flow(invoke0("toString"), escapeHtml))(fromNullable(x));
  const apply = (lits: string[]) => flatten(zip(lits, vars.map(fmt))).concat(pipe(
    last(lits),
    fold(() => [], wrapArr)
  ));
  return UnsafeHtml(apply(tsa.slice(0)).join(""));
}

export function joinHtml(hs: UnsafeHtml[]): UnsafeHtml {
  return UnsafeHtml(hs.map(invoke0("toString")).join(""));
}

export const htmlEquals = <S1 extends string>(h1: UnsafeHtml<S1>) => (h2: UnsafeHtml): h2 is UnsafeHtml<S1> =>
  h1.toString() === h2.toString();
