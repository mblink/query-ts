import { Bondlink } from "./bondlink";
import { none, Option, some, map } from "fp-ts/lib/Option";
import {
  chain as chainTE,
  fromPredicate,
  fold as foldTE,
  TaskEither,
  tryCatch as tryCatchTE,
  map as mapTE,
  mapLeft as mapLeftTE
} from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/pipeable";
import * as t from "io-ts";
import { invoke0 } from "./util/invoke";
import { mergeDeep } from "./util/merge";
import { parseJson } from "./util/parseJson";
import { Either, fold as foldE, left, right } from "fp-ts/lib/Either";
import { task } from "fp-ts/lib/Task";
import { Log } from "./util/log";
import { Method, UrlInterface } from "./routes/urlInterface";
import { tap } from "./util/tap";
import { Unauthorized } from "ts-http-status-codes";

export type RespOrErrors = Either<Option<Response>, t.Errors>;

export type FetchResp = TaskEither<Option<Response>, Response>;
export type FetchTextResp = TaskEither<Option<Response>, [Response, string]>;
export type FetchJsonResp<A> = TaskEither<RespOrErrors, [Response, A]>;

const headers = mergeDeep({ headers: { "X-Requested-With": "XMLHttpRequest" } });
const credentials = mergeDeep({ credentials: "same-origin" });
const checkStatus = fromPredicate((r: Response) => r.status < 300, some);
const origFetch = window.fetch;

export const blFetch = (url: UrlInterface<Method>, opts?: RequestInit): FetchResp =>
  pipe(
    tryCatchTE(
      () => origFetch(url.url, headers(credentials(Object.assign(opts || {}, {method: url.method})))),
      (e: unknown) => {
        Log.error("BLFetch Failed", e);
        return none;
      }
    ),
    chainTE(checkStatus),
    mapLeftTE(map(tap((r: Response) =>
      (r.status === Unauthorized ? Log.info : Log.error)(`BLFetch Failed With Status: ${r.status} -- ${r.statusText}`, r)
    )))
  );

const fetchTpe = (f: (r: Response) => Promise<string>) => (url: UrlInterface<Method>, opts?: RequestInit): FetchTextResp =>
  pipe(
    blFetch(url, opts),
    chainTE((res: Response) =>
      mapTE((a: string): [Response, string] => [res, a])(tryCatchTE(
        () => f(res),
        (e: unknown) => {
          Log.error("FetchTpe Failed", e);
          return some(res);
        }
      )
    ))
  );

export const fetchText = fetchTpe(invoke0("text"));

export const textToJsonResp = <A, O, I>(tpe: t.Type<A, O, I>): (t: FetchTextResp) => FetchJsonResp<A> =>
  foldTE(
    (or: Option<Response>) => task.of(left(left(or))),
    ([res, s]: [Response, string]) => pipe(
      parseJson(tpe)(s),
      foldE(
        (e: t.Errors) => task.of(left(right(e))),
        (a: A) => task.of(right([res, a]))
      )
    )
  );

export const fetchJson = <A, O, I>(tpe: t.Type<A, O, I>) => (url: UrlInterface<"GET">, opts?: RequestInit): FetchJsonResp<t.TypeOf<t.Type<A, O, I>>> =>
  pipe(
    fetchText(url, opts),
    textToJsonResp(tpe)
  );

export const fetchJsonUnsafe = (data: unknown) => (url: UrlInterface<"POST" | "DELETE">, opts?: RequestInit): FetchTextResp =>
  fetchText(url, mergeDeep({
    cache: "no-cache",
    body: JSON.stringify(data),
    headers: {
      "Csrf-Token": Bondlink.config.csrf,
      "Content-Type": "application/json"
    }
  })(opts || {}));
