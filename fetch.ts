import { Bondlink } from "./bondlink";
import { constant } from "fp-ts/lib/function";
import { none, Option, some } from "fp-ts/lib/Option";
import { chain, fromEither, fromPredicate, map, mapLeft, TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/pipeable";
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

const checkStatus = fromPredicate(prop("ok"), some);

const origFetch = window.fetch;

export const blFetch = (url: string, opts?: RequestInit): FetchResp =>
  chain(checkStatus)(tryCatch(() => origFetch(url, headers(credentials(opts || {}))), constant<Option<Response>>(none)));

const fetchTpe = <A>(f: (r: Response) => Promise<A>) => (url: string, opts?: RequestInit): FetchJsonResp<A> =>
  chain((res: Response) => map((a: A): [Response, A] => [res, a])(tryCatch(() => f(res), constant(some(res)))))(blFetch(url, opts));

export const fetchText = fetchTpe(invoke0("text"));

export const fetchJson = <A, O, I>(tpe: iots.Type<A, O, I>) => (url: string, opts?: RequestInit): FetchJsonResp<iots.TypeOf<iots.Type<A, O, I>>> =>
  chain(([res, s]: [Response, string]) => pipe(
    fromEither(parseJson(tpe)(s)),
    mapLeft(constant(some(res))),
    map((a: A): [Response, A] => [res, a])
  ))(fetchText(url, opts));

export const postJson = (data: unknown) => (url: string, opts?: RequestInit): FetchResp =>
  blFetch(url, mergeDeep({
    method: "POST",
    cache: "no-cache",
    body: JSON.stringify(data),
    headers: {
      "Csrf-Token": Bondlink.config.csrf,
      "Content-Type": "application/json"
    }
  })(opts || {}));
