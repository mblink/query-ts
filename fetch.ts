import { Bondlink } from "./bondlink";
import { constant, Function1 } from "fp-ts/lib/function";
import { none, Option, some } from "fp-ts/lib/Option";
import { fromEither, fromPredicate, TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
import * as iots from "io-ts";
import { invoke0 } from "./util/invoke";
import { mergeDeep } from "./util/merge";
import { parseJson } from "./util/parseJson";
import { prop } from "./util/prop";

export type FetchResp = TaskEither<Option<Response>, Response>;
export type FetchTextResp = TaskEither<Option<Response>, [Response, string]>;
export type FetchJsonResp<A> = TaskEither<Option<Response>, [Response, A]>;

const headers = mergeDeep({ headers: { "X-Requested-With": "XMLHttpRequest" } });
const credentials = mergeDeep({ credentials: "same-origin" });

const checkStatus: Function1<Response, FetchResp> = fromPredicate(prop("ok"), some);

const origFetch = window.fetch;

const blFetch = (url: string, opts?: RequestInit): FetchResp =>
  tryCatch(() => origFetch(url, headers(credentials(opts || {}))), constant<Option<Response>>(none)).chain(checkStatus);

const fetchTpe = <A>(f: Function1<Response, Promise<A>>) => (url: string, opts?: RequestInit): FetchJsonResp<A> =>
  blFetch(url, opts).chain((res: Response) => tryCatch(() => f(res), constant(some(res))).map((a: A): [Response, A] => [res, a]));

const fetchText = fetchTpe(invoke0("text"));

const fetchJson = <A>(tpe: iots.Type<A>) => (url: string, opts?: RequestInit): FetchJsonResp<A> =>
  fetchText(url, opts).chain(([res, s]: [Response, string]) => fromEither(parseJson(tpe)(s))
    .mapLeft(constant(some(res))).map((a: A): [Response, A] => [res, a]));

const postJson = (data: unknown) => (url: string, opts?: RequestInit): FetchResp =>
  blFetch(url, mergeDeep({
    method: "POST",
    cache: "no-cache",
    body: JSON.stringify(data),
    headers: {
      "Csrf-Token": Bondlink.config.csrf,
      "Content-Type": "application/json"
    }
  })(opts || {}));

declare global {
  const blFetch: (url: string, opts?: RequestInit) => FetchResp;
  const fetchText: (url: string, opts?: RequestInit) => FetchTextResp;
  const fetchJson: <A>(tpe: iots.Type<A>) => (url: string, opts?: RequestInit) => FetchJsonResp<A>;
  const postJson: (data: unknown) => (url: string, opts?: RequestInit) => FetchResp;

  interface Window {
    blFetch: (url: string, opts?: RequestInit) => FetchResp;
    fetchText: (url: string, opts?: RequestInit) => FetchTextResp;
    fetchJson: <A>(tpe: iots.Type<A>) => (url: string, opts?: RequestInit) => FetchJsonResp<A>;
    postJson: (data: unknown) => (url: string, opts?: RequestInit) => FetchResp;
  }
}

window.blFetch = blFetch;
window.fetchText = fetchText;
window.fetchJson = fetchJson;
window.postJson = postJson;
