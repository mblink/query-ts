import { Bondlink } from "./bondlink";
import { none, Option, some } from "fp-ts/lib/Option";
import { chain, fromPredicate, fold as foldTE, map, TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/pipeable";
import * as iots from "io-ts";
import { invoke0 } from "./util/invoke";
import { mergeDeep } from "./util/merge";
import { parseJson } from "./util/parseJson";
import { prop } from "./util/prop";
import { Either, fold as foldE, left, right } from "fp-ts/lib/Either";
import { task } from "fp-ts/lib/Task";
import { Log } from "./util/log";

export type RespOrErrors = Either<Option<Response>, iots.Errors>;

export type FetchResp = TaskEither<Option<Response>, Response>;
export type FetchTextResp = TaskEither<Option<Response>, [Response, string]>;
export type FetchJsonResp<A> = TaskEither<RespOrErrors, [Response, A]>;

const headers = mergeDeep({ headers: { "X-Requested-With": "XMLHttpRequest" } });
const credentials = mergeDeep({ credentials: "same-origin" });

const checkStatus = fromPredicate(prop("ok"), some);

const origFetch = window.fetch;

export const blFetch = (url: string, opts?: RequestInit): FetchResp =>
  chain(checkStatus)(tryCatch(() => origFetch(url, headers(credentials(opts || {}))), (e: unknown) => {
    Log.error("BLFetch Failed", e);
    return none;
  }));

const fetchTpe = (f: (r: Response) => Promise<string>) => (url: string, opts?: RequestInit): FetchTextResp =>
  chain((res: Response) => map((a: string): [Response, string] => [res, a])(tryCatch(() => f(res), (e: unknown) => {
    Log.error("FetchTpe Failed", e);
    return some(res);
  })))(blFetch(url, opts));

export const fetchText = fetchTpe(invoke0("text"));

export const fetchJson = <A, O, I>(tpe: iots.Type<A, O, I>) => (url: string, opts?: RequestInit): FetchJsonResp<iots.TypeOf<iots.Type<A, O, I>>> =>
  pipe(
    fetchText(url, opts),
    foldTE(
      (or: Option<Response>) => task.of(left(left(or))),
      ([res, s]: [Response, string]) => pipe(
        parseJson(tpe)(s),
        foldE(
          (e: iots.Errors) => task.of(left(right(e))),
          (a: A) => task.of(right([res, a]))
        )
      )
    )
  );

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
