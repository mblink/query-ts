import { flow, not } from "fp-ts/lib/function";
import { chain, filter, Option, some } from "fp-ts/lib/Option";
import { isUnsafeHtml, UnsafeHtml } from "../dom/unsafeHtml";
import { eq } from "./eq";
import { invoke0 } from "./invoke";

export function trimFilter(o: string | Option<string>): Option<string>;
export function trimFilter(o: UnsafeHtml | Option<UnsafeHtml>): Option<UnsafeHtml>;
export function trimFilter(o: string | UnsafeHtml | Option<string | UnsafeHtml>): Option<string | UnsafeHtml> {
  const trim = (a: string | UnsafeHtml): Option<string | UnsafeHtml> => typeof a === "string"
    ? filter(not(eq("")))(some(a.trim()))
    : filter<string | UnsafeHtml>(flow(invoke0("toString"), invoke0("trim"), not(eq(""))))(some(a));
  return (typeof o === "string" || isUnsafeHtml(o)) ? trim(o) : chain(trim)(o);
}
