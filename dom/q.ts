import autobind from "autobind-decorator";
import { Do } from "fp-ts-contrib/lib/Do";
import { flatten } from "fp-ts/lib/Array";
import { Filterable, Filterable1, Filterable2, Filterable3 } from "fp-ts/lib/Filterable";
import { constVoid, not, flow } from "fp-ts/lib/function";
import { pipe } from "fp-ts/lib/pipeable";
import { HKT, Kind2, Kind3, URIS, URIS2, URIS3, Kind } from "fp-ts/lib/HKT";
import { IORef } from "fp-ts/lib/IORef";
import { insertAt, lookup, toArray } from "fp-ts/lib/Map";
import {
  fromNullable,
  getOrElse,
  none,
  Option,
  some,
  tryCatch as tryCatchO,
  chain,
  map,
  fold,
  filter,
  mapNullable, alt, isSome
} from "fp-ts/lib/Option";
import { Eq } from "fp-ts/lib/Eq";
import { map as mapTE, TaskEither, taskEither } from "fp-ts/lib/TaskEither";
import xs, { Listener, Producer, Stream } from "xstream";
import { Bondlink } from "../bondlink";
import { AttrProxy } from "../util/attrProxy";
import { CachedElements } from "../util/cachedElements";
import { eq } from "../util/eq";
import { eqOrd, eqSetoid } from "../util/instances";
import * as invoke from "../util/invoke";
import { Log } from "../util/log";
import { parseNumber } from "../util/parseNumber";
import { prop } from "../util/prop";
import { cancelAnimFrame, requestAnimFrame } from "../util/requestAnimFrame";
import { wrapArr } from "../util/wrapArr";
import { UnsafeHtml } from "./unsafeHtml";

export type QElement = HTMLElement | SVGElement;

let [readyFired, readyEventsBound, readyFns]: [boolean, boolean, (() => void)[]] = [false, false, []];

const docReady = () => document.readyState === "complete";

const ready = () => {
  if (readyFired) { return; }

  readyFired = true;
  readyFns.forEach(invoke.invokeSelf0);
  readyFns = [];
};

export interface QPosition {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * The base type of a triggered event
 */
@autobind
export abstract class QBaseEvent<
  Ev extends Event,
  SE extends QElement = QElement,
  TE extends QElement = QElement
> extends AttrProxy<Ev> {
  readonly event: Ev;
  readonly selectedElement: Q<SE>;
  readonly thisElement: Q<TE>;
  readonly originationElement: Option<Q>;

  constructor(event: Ev, selectedElement: Q<SE>, thisElement: Q<TE>, originationElement: Option<Q>) {
    super(event);
    this.event = event;
    this.selectedElement = selectedElement;
    this.thisElement = thisElement;
    this.originationElement = originationElement;
  }

  preventDefault(): this {
    this.event.preventDefault();
    return this;
  }

  stopPropagation(): this {
    this.event.stopPropagation();
    return this;
  }

  which(this: QBaseEvent<MouseEvent | KeyboardEvent>): number {
    // tslint:disable:deprecation no-bitwise one-line strict-boolean-expressions
    return pipe(
      fromNullable(this.event.which),
      getOrElse(() => {
      if (this.event instanceof MouseEvent) {
        if (this.event.button & 1) { return 1; }
        else if (this.event.button & 2) { return 3; }
        else if (this.event.button & 4) { return 2; }
        else { return 0; }
      } else {
        return this.event.charCode || this.event.keyCode;
      }
    }));
    // tslint:enable:deprecation no-bitwise one-line strict-boolean-expressions
  }
}

/**
 * A wrapper around a triggered event type
 * @typeparam Ev The type of the underlying event
 * @typeparam SE The type of the selected event element
 * @typeparam TE The type of the element where the event was bound to the DOM
 */
export class QEvent<
  Ev extends keyof WindowEventMap = keyof WindowEventMap,
  SE extends QElement = QElement,
  TE extends QElement = QElement
> extends QBaseEvent<WindowEventMap[Ev], SE, TE> {} // tslint:disable-line:no-empty

/**
 * A wrapper around a triggered custom event type
 * @typeparam SE The type of the selected event element
 * @typeparam TE The type of the element where the event was bound to the DOM
 */
export class QCustomEvent<
  SE extends QElement = QElement,
  TE extends QElement = QElement
> extends QBaseEvent<CustomEvent, SE, TE> {} // tslint:disable-line:no-empty

/**
 * An event listener function
 * @typeparam Ev The type of the underlying event
 * @typeparam SE The type of the selected event element
 * @typeparam TE The type of the element where the event was bound to the DOM
 */
export type QListener<
  Ev extends keyof WindowEventMap = keyof WindowEventMap,
  SE extends QElement = QElement,
  TE extends QElement = QElement
  > = (event: QEvent<Ev, SE, TE>) => void;

export type QCustomListener<
  SE extends QElement = QElement,
  TE extends QElement = QElement
> = (event: QCustomEvent<SE, TE>) => void;

type StreamAndListeners<A> = [Stream<A>, Listener<A>[]];

/**
 * Create an xstream Producer to handle adding and removing event listeners
 */
const qListenerProducer = <Ev extends Event>(element: QElement, eventName: string, uc: boolean): Producer<Ev> => {
  let fn: ((event: Event) => void) | undefined;
  return {
    start: (listener: Listener<Ev>) => {
      fn = (event: Event) => listener.next(<Ev>event);
      element.addEventListener(eventName, fn, uc);
    },
    stop: () => fn && element.removeEventListener(eventName, fn, uc)
  };
};

const addQListener = (element: QElement, eventName: string, uc: boolean) => <Ev extends Event>(next: (e: Ev) => void) => (streamO: Option<StreamAndListeners<unknown>>): [Stream<Ev>, Listener<Ev>, Listener<Ev>[]] => {
  const [stream, listeners] = pipe(
    (<Option<StreamAndListeners<Ev>>>streamO),
    getOrElse(() => [xs.create(qListenerProducer<Ev>(element, eventName, uc)), [] as Listener<Ev>[]]));
  const listener: Listener<Ev> = {
    next,
    error: (e: any) => Log.error(`Error occurred in ${eventName} event stream`, e),
    complete: () => Log.info(`Stream completed for ${eventName} event`)
  };
  stream.addListener(listener);
  return [stream, listener, listeners.concat([listener])];
};

type RootCache = IORef<Map<QElement, Map<string, Stream<unknown>>>>;
type DelegateCache = IORef<Map<QElement, Map<string, Map<string, Stream<unknown>>>>>;

type QEvCtor = new <Ev extends Event, SE extends QElement, TE extends QElement>(e: Ev, se: Q<SE>, te: Q<TE>, oe: Option<Q>) => QBaseEvent<Ev, SE, TE>;
type MkQ = <E2 extends QElement>(e: E2) => Q<E2>;

/**
 * A helper class to handle binding and removing event listeners
 */
export class QListeners {
  private static readonly rootCache: RootCache = new IORef(new Map());
  private static readonly delegateCache: DelegateCache = new IORef(new Map());

  /**
   * Add an event listener to a given element
   */
  static add<Ev extends Event, E extends QElement, E_ extends QElement, QEv1 extends QBaseEvent<Ev, E, E>, QEv2 extends QBaseEvent<Ev, E_, E>>(
    ctor: QEvCtor,
    mkQ: MkQ,
    element: Q<E>,
    eventName: string,
    selectorOrListener: string | ((e: QEv1) => void),
    listener?: (e: QEv2) => void
  ): [Stream<Ev>, Listener<Ev>] {
    const [cache, ks, next]: [IORef<Map<any, any>>, any[], (e: Ev) => void] = typeof selectorOrListener === "string"
      ? [
        QListeners.delegateCache,
        [element.element, eventName, selectorOrListener],
        (e: Ev) => pipe(
          fromNullable(<HTMLElement>e.target),
          chain((el: HTMLElement) => element.buildNext(el).closest<E_>(selectorOrListener)),
          map((delegateTarget: Q<E_>) => listener!(<QEv2>(new ctor(e, delegateTarget,
              QListeners.thisElement(e, mkQ, element), QListeners.originationElement(e, mkQ))))))
      ]
      : [
        QListeners.rootCache,
        [element.element, eventName],
        (e: Ev) => {
          const t = QListeners.thisElement(e, mkQ, element);
          selectorOrListener(<QEv1>(new ctor(e, t, t, QListeners.originationElement(e, mkQ))));
        }
      ];

    const [stream, addedListener, allListeners] = addQListener(element.element, eventName,
      typeof selectorOrListener === "string")(next)(QListeners.getStream(cache, <any>ks));
    QListeners.setStream(cache, <any>ks, [stream, allListeners]);
    return [stream, addedListener];
  }

  /**
   * Add a one-time event listener to a given element
   */
  static addOnce<Ev extends Event, E extends QElement, E_ extends QElement, QEv1 extends QBaseEvent<Ev, E, E>, QEv2 extends QBaseEvent<Ev, E_, E>>(
    ctor: QEvCtor,
    mkQ: MkQ,
    element: Q<E>,
    eventName: string,
    selectorOrListener: string | ((e: QEv1) => void),
    listener?: (e: QEv2) => void
  ): void {
    if (typeof selectorOrListener === "string") {
      const t = QListeners.add(ctor, mkQ, element, eventName, selectorOrListener, (e: QEv2) => {
        QListeners.remove(element, eventName, some(t[1]), selectorOrListener);
        listener!(e);
      });
    } else {
      const t = QListeners.add(ctor, mkQ, element, eventName, (e: QEv1) => {
        QListeners.remove(element, eventName, some(t[1]));
        selectorOrListener(e);
      });
    }
  }

  /**
   * Remove all event listeners for a given event from a given element
   */
  static remove(element: Q, eventName: string, listener: Option<Listener<any>>, selector?: string): void {
    fold(
      () => {
        QListeners.stopStream(QListeners.rootCache, [element.element, eventName], listener);
        QListeners.stopStream(QListeners.delegateCache, [element.element, eventName], listener);
      },
      (s: string) => QListeners.stopStream(QListeners.delegateCache, [element.element, eventName, s], listener)
    )(fromNullable(selector));
  }

  private static thisElement<E extends QElement>(event: Event, mkQ: MkQ, fallback: Q<E>): Q<E> {
    return pipe(
      fromNullable(<E>event.currentTarget),
      map(mkQ),
      getOrElse(() => fallback));
  }

  private static originationElement(event: Event, mkQ: MkQ): Option<Q> {
    return map(mkQ)(fromNullable(<QElement>event.target));
  }

  private static isMap(u: unknown): u is Map<unknown, unknown> {
    return u instanceof Map;
  }

  private static getStream(m: RootCache, ks: [QElement, string]): Option<StreamAndListeners<unknown>>;
  private static getStream(m: DelegateCache, ks: [QElement, string]): Option<Map<string, StreamAndListeners<unknown>>>;
  private static getStream(m: DelegateCache, ks: [QElement, string, string]): Option<StreamAndListeners<unknown>>;
  private static getStream(_m: IORef<Map<unknown, unknown>>, _ks: unknown[]): Option<unknown> {
    const go = (ks: unknown[]) => (m: Map<any, any>): Option<unknown> =>
      ks.length === 0 ? some(m) : chain(go(ks.slice(1)))(lookup(eqSetoid<unknown>())(ks[0], m));

    return go(_ks)(_m.read());
  }

  private static setStream(m: RootCache, ks: [QElement, string], v: StreamAndListeners<any>): void;
  private static setStream(m: DelegateCache, ks: [QElement, string, string], v: StreamAndListeners<any>): void;
  private static setStream(_m: IORef<Map<unknown, unknown>>, _ks: unknown[], v: StreamAndListeners<any>): void {
    const go = (ks: unknown[]) => (m: Map<unknown, unknown>): any => {
      if (ks.length === 0) {
        return v;
      } else {
        const k = ks[0];
        return insertAt(eqSetoid<unknown>())(k, go(ks.slice(1))(
          pipe(
            lookup<unknown>(eqSetoid())(k, m),
            filter(QListeners.isMap),
            getOrElse(() => new Map()))))(m);
      }
    };

    _m.modify(go(_ks))();
  }

  private static stopStream(m: RootCache | DelegateCache, ks: [QElement, string], listener: Option<Listener<unknown>>): void;
  private static stopStream(m: DelegateCache, ks: [QElement, string, string], listener: Option<Listener<unknown>>): void;
  private static stopStream(m: IORef<Map<any, any>>, ks: unknown[], listener: Option<Listener<unknown>>): void {
    const [anyM, anyKs]: [IORef<any>, any] = [m, ks];
    const remove = ([stream, listeners]: StreamAndListeners<unknown>): StreamAndListeners<unknown> =>
      [stream, fold(
        () => {
          listeners.forEach((l: Listener<unknown>) => stream.removeListener(l));
          return [];
        },
        (l: Listener<unknown>) => {
          stream.removeListener(l);
          return listeners.filter((a) => not(eq(l.next))(prop("next")(a)));
        })(listener)];

    // tslint:disable no-unsafe-any
    pipe(
      QListeners.getStream(anyM, anyKs),
      fold(constVoid, (x: unknown) => {
        if (QListeners.isMap(x)) {
          toArray<unknown>(eqOrd())(x).forEach(([k, t]: [unknown, unknown]) =>
            QListeners.setStream(anyM, anyKs.concat([k]), remove(<StreamAndListeners<unknown>>t)));
        } else {
          QListeners.setStream(anyM, anyKs, remove(<StreamAndListeners<unknown>>x));
        }
      }));
    // tslint:enable no-unsafe-any
  }
}

/**
 * A wrapper around a queried HTML element type
 * @typeparam E The type of the underlying DOM element
 */
@autobind
export class Q<E extends QElement = QElement> extends AttrProxy<E> {
  static readonly eq: Eq<Q<any>> = { equals: (q1: Q<any>, q2: Q<any>): boolean => q1.equals(q2) };

  static readonly inputSelector = "input, select, textarea, *[contenteditable]";
  static readonly focusableSelector = `a[href], area[href], ${Q.inputSelector}, button, iframe, object, embed, *[tabindex]`;

  readonly element: E;
  readonly prev: Option<Q>;
  private readonly _isQ: boolean = true;

  /**
   * @returns The wrapped document root element
   */
  static get root(): Q<HTMLElement> {
    return Q.of(document.documentElement);
  }

  /**
   * @returns The wrapped document body
   */
  static get body(): Q<HTMLBodyElement> {
    return Q.of(<HTMLBodyElement>document.body);
  }

  static oneF<K extends keyof HTMLElementTagNameMap>(root: Pick<Document, "querySelector">, selector: K): Option<Q<HTMLElementTagNameMap[K]>>;
  static oneF<E extends QElement = QElement>(root: Pick<Document, "querySelector">, selector: string): Option<Q<E>>;
  static oneF<E extends QElement = QElement>(root: Pick<Document, "querySelector">, selector: string): Option<Q<E>> {
    return map(Q.of)(fromNullable(root.querySelector<E>(selector)));
  }

  /**
   * Query for a single element matching a given selector within the document body
   * @typeparam E The type of DOM element being queried for
   * @returns The wrapped element, if found, otherwise none
   */
  static one<K extends keyof HTMLElementTagNameMap>(selector: K): Option<Q<HTMLElementTagNameMap[K]>>;
  static one<E_ extends QElement = QElement>(selector: string): Option<Q<E_>>;
  static one<E_ extends QElement = QElement>(selector: string): Option<Q<E_>> {
    return Q.body.one(selector);
  }

  /**
   * Query for all elements matching a given selector within the document body
   * @typeparam E The type of DOM element being queried for
   * @returns An array of wrapped elements
   */
  static all<K extends keyof HTMLElementTagNameMap>(selector: K): Q<HTMLElementTagNameMap[K]>[];
  static all<E_ extends QElement = QElement>(selector: string): Q<E_>[];
  static all<E_ extends QElement = QElement>(selector: string): Q<E_>[] {
    return Q.body.all(selector);
  }


  static not<F extends URIS3>(F: Filterable3<F>): (selector: string) => <U, L, E extends QElement>(elements: Kind3<F, U, L, Q<E>>) => Kind3<F, U, L, Q<E>>;
  static not<F extends URIS2>(F: Filterable2<F>): (selector: string) => <L, E extends QElement>(elements: Kind2<F, L, E>) => Kind2<F, L, Q<E>>;
  static not<F extends URIS>(F: Filterable1<F>): (selector: string) => <E extends QElement>(elements: Kind<F, Q<E>>) => Kind<F, Q<E>>;
  static not<F>(F: Filterable<F>): (selector: string) => <E extends QElement>(elements: HKT<F, Q<E>>) => HKT<F, Q<E>> {
    return (selector: string) => <E_ extends QElement>(elements: HKT<F, Q<E_>>) => F.filter(elements, invoke.invoke1("matches")(selector));
  }

  /**
   * Wrap a DOM element into a {@linkcode Q}
   * @typeparam E The type of DOM element being wrapped
   * @param element The DOM element being wrapped
   * @param prev The element queried for previous to this element
   */
  static of<E extends QElement = QElement>(element: E, prev: Option<Q> = none): Q<E> {
    return new Q<E>(element, prev);
  }

  /**
   * Optionally filter elements by a selector
   * @typeparam E The type of DOM elements being filtered
   * @param selector An optional selector to filter by
   * @param elements The elements to filter
   */
  static filtered = <E extends QElement = QElement>(selector?: string) => (elements: Q<E>[]): Q<E>[] => {
    return fold(() => elements, (s: string) => elements.filter(invoke.invoke1("matches")(s)))(fromNullable(selector));
  }

  /**
   * Check if a node is an element
   * @param element The node to check
   */
  static nodeIsElement = <E extends QElement = QElement>(element: Node): element is E => element.nodeType === Node.ELEMENT_NODE;

  static mutationElements(mutations: MutationRecord[]): Q[] {
    return flatten(mutations.map((m: MutationRecord) => (<Node[]>[].slice.call(m.addedNodes)
      .concat([].slice.call(m.removedNodes))).filter(Q.nodeIsElement).map((e: QElement) => Q.of(e))));
  }

  static waitFor(cond: () => boolean, tries: number = 5): Promise<void> {
    return new Promise((resolve: () => void, reject: () => void) => {
      let retries = 1;
      let interval: Option<number> = none;
      const cancel = (cb: () => void) => {
        map(cancelAnimFrame)(interval);
        cb();
      };

      const retry = () => {
        if (cond()) {
          cancel(resolve);
        } else if (retries >= tries) {
          cancel(reject);
        } else {
          retries++;
          interval = some(requestAnimFrame(retry));
        }
      };

      interval = some(requestAnimFrame(retry));
    });
  }

  static remToPx(rems: number): number {
    return rems * getOrElse(() => 16)(parseNumber(Q.root.getComputedStyle("fontSize")));
  }

  /**
   * Check if a given value is a {@linkcode Q}
   * @typeparam E The type of DOM element
   */
  static isQ(x: any): x is Q<any> {
    return (<Q<any>>x)._isQ;
  }

  static isOfType<T extends keyof HTMLElementTagNameMap>(tpe: T): (q: Q) => q is Q<HTMLElementTagNameMap[T]> {
    return (q: Q): q is Q<HTMLElementTagNameMap[T]> => q.element.nodeName.toLowerCase() === tpe.toLowerCase();
  }

  /**
   * Create a DOM element
   */
  static createElement<T extends keyof HTMLElementTagNameMap>(
    tpe: T,
    fns: ((e: Q<HTMLElementTagNameMap[T]>) => Q<HTMLElementTagNameMap[T]>)[],
    children: Q[]
  ): Q<HTMLElementTagNameMap[T]> {
    const el: HTMLElementTagNameMap[T] = document.createElement(tpe);
    children.forEach(flow(prop("element"), el.appendChild.bind(el)));
    return fns.reduce((acc: Q<HTMLElementTagNameMap[T]>, f: (e: Q<HTMLElementTagNameMap[T]>) => Q<HTMLElementTagNameMap[T]>) => f(acc), Q.of(el));
  }

  /**
   * Parse an HTML fragment to a single element
   * @typeparam E The type of DOM element expected
   */
  static parseFragment<E extends HTMLElement>(fragment: UnsafeHtml, contentType: "text/html"): Option<Q<E>>;
  static parseFragment<E extends SVGElement>(fragment: UnsafeHtml, contentType: "image/svg+xml"): Option<Q<E>>;
  static parseFragment<E extends QElement = QElement>(fragment: UnsafeHtml, contentType: "text/html" | "image/svg+xml"): Option<Q<E>> {
    return pipe(
      Q.parseDocument(fragment, contentType),
      chain((doc: Document) => contentType === "text/html" ? mapNullable<Node, ChildNode>(prop("firstChild"))(fromNullable(doc.body)) : fromNullable(doc.firstChild)),
      filter(Q.nodeIsElement),
      map((e: QElement) => Q.of(<E>e)));
  }

  static parseDocument(document: UnsafeHtml, contentType: "text/html" | "image/svg+xml"): Option<Document> {
    return tryCatchO(() => (new DOMParser()).parseFromString(document.toString(), contentType));
  }

  /**
   * Register a callback for when the document has finished loading
   */
  static ready(f: () => void): void {
    if (readyFired) {
      setTimeout(f, 1);
      return;
    }

    readyFns.push(f);

    if (docReady()) {
      setTimeout(ready, 1);
    } else if (!readyEventsBound) {
      readyEventsBound = true;
      if (typeof document.addEventListener === "function") {
        document.addEventListener("DOMContentLoaded", ready, false);
        window.addEventListener("load", ready, false);
      } else if (typeof (<any>document).attachEvent === "function") { // tslint:disable-line no-unsafe-any
        (<any>document).attachEvent("onreadystatechange", () => docReady() && ready()); // tslint:disable-line no-unsafe-any
        (<any>window).attachEvent("onload", ready); // tslint:disable-line no-unsafe-any
      }
    }
  }

  /**
   * Get the current scrollTop value
   */
  static getScrollTop(): number {
    return pipe(
      fromNullable(window.scrollY),
      alt(() => pipe(
        fromNullable(document.documentElement),
        mapNullable(prop("scrollTop")))),
      getOrElse(() => document.body.scrollTop));
  }

  /**
   * Create an event handler where the event's default behavior is prevented
   */
  static prevented<Ev extends keyof WindowEventMap, E extends QElement, E_ extends QElement>(handler: (e: QEvent<Ev, E, E_>) => void): (e: QEvent<Ev, E, E_>) => void;
  static prevented<E extends QElement, E_ extends QElement>(handler: (e: QCustomEvent<E, E_>) => void): (e: QCustomEvent<E, E_>) => void;
  static prevented<Ev extends keyof WindowEventMap, E extends QElement, E_ extends QElement>(
    handler: ((e: QEvent<Ev, E, E_>) => void) | ((e: QCustomEvent<E, E_>) => void)
  ): (e: QEvent<Ev, E, E_> | QCustomEvent<E, E_>) => void {
    return (e: QEvent<Ev, E, E_> | QCustomEvent<E, E_>) => {
      e.preventDefault();
      (<any>handler)(e);
    };
  }

  /**
   * Wrap a DOM element into a {@linkcode Q}, passing the current element as {@linkcode Q.prev}
   * @typeparam E_ The type of DOM element being wrapped
   */
  buildNext<E_ extends QElement = QElement>(next: E_): Q<E_> {
    return Q.of<E_>(next, some(this));
  }


  /**
   * Query for a single element matching a given selector within the current element
   * @typeparam E The type of DOM element being queried for
   * @returns The wrapped element, if found, otherwise none
   */
  one<K extends keyof HTMLElementTagNameMap>(selector: K): Option<Q<HTMLElementTagNameMap[K]>>;
  one<E_ extends QElement = QElement>(selector: string): Option<Q<E_>>;
  one<E_ extends QElement = QElement>(selector: string): Option<Q<E_>> {
    return pipe(
      fromNullable(this.element.querySelector<E_>(selector)),
      map(this.buildNext.bind(this)));
  }

  /**
   * Query for all elements matching a given selector within the current element
   * @typeparam E The type of DOM element being queried for
   * @returns An array of wrapped elements
   */
  all<K extends keyof HTMLElementTagNameMap>(selector: K): Q<HTMLElementTagNameMap[K]>[];
  all<E_ extends QElement = QElement>(selector: string): Q<E_>[];
  all<E_ extends QElement = QElement>(selector: string): Q<E_>[] {
    return [].slice.call(this.element.querySelectorAll<E_>(selector)).map(this.buildNext.bind(this));
  }

  /**
   * Check if the current element is the same as another element
   */
  equals(other: Q<E>): boolean {
    return this.element === other.element;
  }

  /**
   * Get the raw href from the current element
   * NOTE: This is only available when the element is an HTMLAnchorElement
   */
  getRawHref(this: Q<HTMLAnchorElement>): string {
    return pipe(
      this.getAttrO("href"),
      getOrElse(() => ""));
  }

  /**
   * Get the full href from the current element
   * NOTE: This is only available when the element is an HTMLAnchorElement
   */
  getFullHref(this: Q<HTMLAnchorElement>): string {
    return this.element.href;
  }

  /**
   * Get any attribute from the current element
   * @returns The optional attribute value
   */
  getAttrO(key: string): Option<string> {
    return fromNullable(this.element.getAttribute(key));
  }

  /**
   * Set any attribute on the current element
   */
  setAttrUnsafe(key: string, value: string): this {
    this.element.setAttribute(key, value);
    return this;
  }

  /**
   * Remove any attribute on the current element
   */
  removeAttrUnsafe(key: string): this {
    this.element.removeAttribute(key);
    return this;
  }

  /**
   * Check if the current element has a given attribute
   */
  hasAttr(key: string): boolean {
    return this.element.hasAttribute(key);
  }

  /**
   * Get a data attribute from the current element
   */
  getData(key: string): Option<string> {
    return this.getAttrO(`data-${key}`);
  }

  /**
   * Set a data attribute on the current element
   */
  setData(key: string, value: string): this {
    this.setAttrUnsafe(`data-${key}`, value);
    return this;
  }

  /**
   * Remove a data attribute from the current element
   */
  removeData(key: string): this {
    this.removeAttrUnsafe(`data-${key}`);
    return this;
  }

  /**
   * Get the computed style from the current element
   * @typeparam K A known CSS property
   */
  getComputedStyle<K extends keyof CSSStyleDeclaration>(key: K): CSSStyleDeclaration[K] {
    return getComputedStyle(this.element)[key];
  }

  /**
   * Get an inline style from the current element
   * @typeparam K A known CSS property
   */
  getInlineStyle<K extends keyof CSSStyleDeclaration>(key: K): CSSStyleDeclaration[K] {
    return this.element.style[key];
  }

  /**
   * Set a style on the current element
   * @typeparam K A known CSS property
   * @param key A known CSS property
   * @param value A well-typed value for the given CSS property
   */
  setInlineStyle<K extends keyof CSSStyleDeclaration>(key: K, value: CSSStyleDeclaration[K]): this {
    this.setInlineStyles({ [key]: value });
    return this;
  }

  /**
   * Set multiple styles on the current element
   * @param styles A partial object of known CSS properties and values
   */
  setInlineStyles(styles: Partial<CSSStyleDeclaration>): this {
    Object.assign(this.element.style, styles);
    return this;
  }

  /**
   * Remove a style on the current element
   * @param style A known CSS property
   */
  removeInlineStyle(style: keyof CSSStyleDeclaration): this {
    this.removeInlineStyles([style]);
    return this;
  }

  /**
   * Remove multiple styles from the current element
   * @param styles An array of known CSS properties
   */
  removeInlineStyles(styles: (keyof CSSStyleDeclaration)[]): this {
    // tslint:disable-next-line:no-unsafe-any
    this.setInlineStyles(Object.assign({}, ...styles.map((key: keyof CSSStyleDeclaration) => ({ [key]: "" }))));
    return this;
  }

  /**
   * Get the height of the current element without margin
   */
  getHeightNoMargin(): number {
    return (<any>this.element).offsetHeight ? (<HTMLElement>this.element).offsetHeight : this.element.getBoundingClientRect().height;
  }

  /**
   * Get the height of the current element with margin
   */
  getHeightWithMargin(): number {
    return this.getHeightNoMargin() +
      getOrElse(() => 0)(parseNumber(this.getComputedStyle("marginTop"))) +
      getOrElse(() => 0)(parseNumber(this.getComputedStyle("marginBottom")));
  }

  /**
   * Get the width of the current element without margin
   */
  getWidthNoMargin(): number {
    return (<any>this.element).offsetWidth ? (<HTMLElement>this.element).offsetWidth : this.element.getBoundingClientRect().width;
  }

  /**
   * Get the width of the current element with margin
   */
  getWidthWithMargin(): number {
    return this.getWidthNoMargin() +
      getOrElse(() => 0)(parseNumber(this.getComputedStyle("marginLeft"))) +
      getOrElse(() => 0)(parseNumber(this.getComputedStyle("marginRight")));
  }

  /**
   * Get the offset of the current element without margin
   */
  getOffsetNoMargin(): QPosition {
    const [rect, st] = [this.element.getBoundingClientRect(), Q.getScrollTop()];
    return {
      top: rect.top + st,
      right: rect.right,
      bottom: rect.bottom + st,
      left: rect.left
    };
  }

  /**
   * Get the offset of the current element with margin
   */
  getOffsetWithMargin(): QPosition {
    const base = this.getOffsetNoMargin();
    return {
      top: base.top - getOrElse(() => 0)(parseNumber(this.getComputedStyle("marginTop"))),
      right: base.right - getOrElse(() => 0)(parseNumber(this.getComputedStyle("marginRight"))),
      bottom: base.bottom - getOrElse(() => 0)(parseNumber(this.getComputedStyle("marginBottom"))),
      left: base.left - getOrElse(() => 0)(parseNumber(this.getComputedStyle("marginLeft")))
    };
  }

  /**
   * Returns whether the element is currently visible in the viewport.
   */
  isInViewport(): boolean {
    const { left, top, bottom, right } = this.element.getBoundingClientRect();
    return (top >= 0
      && left >= 0
      && bottom <= window.innerHeight
      && right <= window.innerWidth);
  }

  /**
   * Check if the current element matches a given selector
   */
  matches(selector: string): boolean {
    // tslint:disable-next-line strict-boolean-expressions
    return (this.element.matches || (<any>this.element).matchesSelector || (<any>this.element).msMatchesSelector).call(this.element, selector);
  }

  /**
   * Get the parent of the current element
   * @typeparam E_ The type of DOM element expected
   */
  parent<E_ extends QElement = QElement>(): Option<Q<E_>> {
    return pipe(
      fromNullable(<E_>this.element.parentNode),
      filter(Q.nodeIsElement),
      map(this.buildNext.bind(this)));
  }

  /**
   * Get the closest element matching a given selector
   *
   * @remarks
   * Tests the current element first, then traverses up its ancestors.
   *
   * @typeparam E_ The type of DOM element expected
   */
  closest<E_ extends QElement = QElement>(selector: string): Option<Q<E_>> {
    return this.matches(selector)
      ? some(<Q<E_>>(<any>this))
      : pipe(
          this.parent<E_>(),
          chain((q: Q<E_>) => q.closest<E_>(selector)));
  }

  /**
   * Get the children of the current element, optionally filtered by a selector
   */
  children(selector?: string): Q[] {
    return Q.filtered(selector)([].slice.call(this.element.childNodes).filter(Q.nodeIsElement).map(this.buildNext.bind(this)));
  }

  /**
   * Check if a selector or other element is a child of the current element
   */
  contains(selectorOrOtherEl: string | Q): boolean {
    return typeof selectorOrOtherEl === "string"
      ? isSome(this.one(selectorOrOtherEl))
      : this.element.contains(selectorOrOtherEl.element);
  }

  /**
   * Get the siblings of the current element, optionally filtered by a selector
   */
  siblings(selector?: string): Q[] {
    return Q.filtered(selector)(fold(() => [], (p: Q) => p.children().filter((e: Q) => e.element !== this.element))(this.parent()));
  }

  prevSibling(): Option<Q> {
    return this.getSibling(prop("previousSibling"))(this.element);
  }

  nextSibling(): Option<Q> {
    return this.getSibling(prop("nextSibling"))(this.element);
  }

  /**
   * Clone the current element, including children
   */
  clone(): Q<E> {
    return Q.of(<E>this.element.cloneNode(true), this.prev);
  }

  /**
   * Replace the current element in the DOM with the given element
   * @typeparam E_ The type of DOM being inserted
   */
  replaceWith<E_ extends QElement = QElement>(other: Q<E_>): this {
    if (typeof this.element.replaceWith === "function") {
      this.element.replaceWith(other.element);
    } else {
      pipe(
        this.parent(),
        fold(
        // Last ditch effort if the element doesn't have a parent
        () => { this.setOuterHtml(other.getOuterHtml()); },
        (p: Q) => p.element.replaceChild(other.element, this.element)));
    }
    CachedElements.replaceCachedElements(other);
    return this;
  }

  /**
   * Removes this element from the DOM
   */
  remove(): void {
    map((p: Q) => p.element.removeChild(this.element))(this.parent());
    CachedElements.removeCachedElements(this);
  }

  /**
   * Get all classes on the current element
   */
  classes(): string[] {
    return [].slice.call(this.element.classList);
  }

  /**
   * Add classes to the current element
   */
  addClass(klasses: string | string[]): this {
    wrapArr(klasses).forEach((c: string) => this.element.classList.add(c));
    return this;
  }

  /**
   * Remove classes from the current element
   */
  removeClass(klasses: string | string[]): this {
    wrapArr(klasses).forEach((c: string) => this.element.classList.remove(c));
    return this;
  }

  /**
   * Toggle classes on the current element
   */
  toggleClass(klasses: string | string[], addOrRemove?: boolean): this {
    if (typeof addOrRemove === "boolean") {
      addOrRemove ? this.addClass(klasses) : this.removeClass(klasses);
    } else {
      wrapArr(klasses).forEach((c: string) => this.element.classList.toggle(c));
    }
    return this;
  }

  /**
   * Check if the current element has a given class
   */
  hasClass(klass: string): boolean {
    return this.element.classList.contains(klass);
  }

  /**
   * Add an id to the current element
   * @param id
   */
  setId(id: string): this {
    this.element.id = id;
    return this;
  }

  /**
   * Prepend a given element as a child to the current element
   */
  prepend(other: Q): this {
    return this.insertAdjacent("afterbegin", other);
  }

  /**
   * Append a given element as a child to the current element
   */
  append(other: Q): this {
    return this.insertAdjacent("beforeend", other);
  }

  /**
   * Insert a given element directly before the current element
   */
  before(other: Q): this {
    return this.insertAdjacent("beforebegin", other);
  }

  /**
   * Insert a given element directly after the current element
   */
  after(other: Q): this {
    return this.insertAdjacent("afterend", other);
  }

  /**
   * Get the inner HTML of the current element
   */
  getInnerHtml(): UnsafeHtml {
    return UnsafeHtml(this.element.innerHTML);
  }

  /**
   * Set the inner HTML of the current element
   */
  setInnerHtml(html: UnsafeHtml): this {
    this.element.innerHTML = html.toString();
    return this;
  }

  /**
   * Get the outer HTML of the current element
   */
  getOuterHtml(): UnsafeHtml {
    return UnsafeHtml(this.element.outerHTML);
  }

  /**
   * Set the outer HTML of the current element
   */
  setOuterHtml(html: UnsafeHtml): this {
    this.element.outerHTML = html.toString();
    return this;
  }

  /**
   * Get the inner text of the current element
   */
  getInnerText(): Option<string> {
    return fromNullable(this.element.textContent);
  }

  /**
   * Set the inner text of the current element
   */
  setInnerText(text: string): this {
    this.element.textContent = text;
    return this;
  }

  /**
   * Check if the current element is visible
   */
  isVisible(): boolean {
    return !!((<any>this.element).offsetWidth || (<any>this.element).offsetHeight || this.element.getClientRects().length > 0);
  }

  /**
   * Check if the current element is disabled
   */
  isDisabled(): boolean {
    return this.matches('[tabindex="-1"], [disabled]') || !this.isVisible();
  }

  /**
   * Listen for a given event on the current element
   * @typeparam Ev A known event type
   */
  listen<Ev extends keyof WindowEventMap, E_ extends QElement = QElement>(eventName: Ev, selector: string, listener: QListener<Ev, E_, E>): this;
  listen<Ev extends keyof WindowEventMap>(eventName: Ev, listener: QListener<Ev, E, E>): this;
  listen<E_ extends QElement = QElement>(eventName: string, selector: string, listener: QCustomListener<E_, E>): this;
  listen(eventName: string, listener: QCustomListener<E, E>): this;
  listen<Ev extends keyof WindowEventMap, E_ extends QElement = QElement>(
    eventName: Ev,
    selectorOrListener: string | ((ev: QCustomEvent<E, E>) => void),
    listener?: QListener<Ev, E_, E> | ((ev: QEvent<Ev, E_, E>) => void)
  ): this {
    QListeners.add(<QEvCtor>QEvent, Q.of, this, eventName, selectorOrListener, listener);
    return this;
  }

  /**
   * Listen for a given event a single time on the current element
   * @typeparam Ev A known event type
   */
  listenOnce<Ev extends keyof WindowEventMap, E_ extends QElement = QElement>(eventName: Ev, selector: string, listener: QListener<Ev, E_, E>): this;
  listenOnce<Ev extends keyof WindowEventMap>(eventName: Ev, listener: QListener<Ev, E, E>): this;
  listenOnce<E_ extends QElement = QElement>(eventName: string, selector: string, listener: QCustomListener<E_, E>): this;
  listenOnce(eventName: string, listener: QCustomListener<E, E>): this;
  listenOnce<Ev extends keyof WindowEventMap, E_ extends QElement = QElement>(
    eventName: Ev,
    selectorOrListener: string | ((ev: QCustomEvent<E, E>) => void),
    listener?: QListener<Ev, E_, E> | ((ev: QEvent<Ev, E_, E>) => void)
  ): this {
    QListeners.addOnce(<QEvCtor>QEvent, Q.of, this, eventName, selectorOrListener, listener);
    return this;
  }

  /**
   * Remove all event listeners for a given event from the current element
   * @typeparam Ev A known event type
   */
  off(eventName: string, selector?: string): this {
    QListeners.remove(this, eventName, none, selector);
    return this;
  }

  /**
   * Trigger a given event on the current element
   * @typeparam Ev A known event type
   */
  trigger<Ev extends keyof WindowEventMap>(eventName: Ev): this {
    const ev = document.createEvent("HTMLEvents");
    ev.initEvent(eventName, false, true);
    this.element.dispatchEvent(ev);
    return this;
  }

  triggerCustom(eventName: string, detail?: any): this {
    const ev = document.createEvent("CustomEvent");
    ev.initCustomEvent(eventName, true, false, detail);
    this.element.dispatchEvent(ev);
    return this;
  }

  /**
   * Observe the current element with a MutationObserver
   */
  observe(options: MutationObserverInit, handler: MutationCallback): this {
    if (typeof MutationObserver === "function") {
      (new MutationObserver(handler)).observe(this.element, options);
    }
    return this;
  }

  /**
   * Force the browser to rerender the current element by calculating its styles
   */
  reflow(): this {
    this.element.getClientRects();
    return this;
  }

  reload(this: Q<HTMLElement>): TaskEither<unknown, Q<HTMLElement>> {
    return Do(taskEither)
      .bind("text", pipe(fetchText(Bondlink.currentPath), mapTE(prop(1))))
      .bindL("e", ({ text }: { text: string; }) => taskEither.of(
        pipe(
          Q.parseDocument(UnsafeHtml(text), "text/html"),
          chain((doc: Document) => map(this.replaceWith)(Q.oneF(doc, `#${this.getAttr("id")}`))),
          getOrElse(() => this))))
      .return(prop("e"));
  }

  private constructor(element: E, prev: Option<Q>) {
    super(element);
    this.element = element;
    this.prev = prev;
  }

  private insertAdjacent(position: InsertPosition, other: Q): this {
    this.element.insertAdjacentElement(position, other.element);
    CachedElements.addCachedElements(other);
    return this;
  }

  private getSibling(fn: (n: Node) => Node | null): (node: Node) => Option<Q> {
    return (node: Node) => pipe(
      fromNullable(fn(node)),
      chain((n: Node) => Q.nodeIsElement(n) ? some(Q.of(n)) : this.getSibling(fn)(n)));
  }
}

function fixSafariClick(): void {
  if (/iphone|ipod|ipad/i.test(navigator.userAgent)) {
    Q.root.addClass("is-ios");
  }
}
