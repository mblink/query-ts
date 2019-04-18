import { not, pipe } from "fp-ts/lib/function";
import { Option, some } from "fp-ts/lib/Option";
import { isUnsafeHtml, UnsafeHtml } from "../dom/unsafeHtml";
import { eq } from "./eq";
import { invoke0 } from "./invoke";

export function trimFilter(o: string | Option<string>): Option<string>;
export function trimFilter(o: UnsafeHtml | Option<UnsafeHtml>): Option<UnsafeHtml>;
export function trimFilter(o: string | UnsafeHtml | Option<string | UnsafeHtml>): Option<string | UnsafeHtml> {
  const trim = (a: string | UnsafeHtml): Option<string | UnsafeHtml> => typeof a === "string"
    ? some(a.trim()).filter(not(eq("")))
    : some(a).filter(pipe(invoke0("toString"), invoke0("trim"), not(eq(""))));
  return (typeof o === "string" || isUnsafeHtml(o)) ? trim(o) : o.chain(trim);
}
