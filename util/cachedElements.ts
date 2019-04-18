import autobind from "autobind-decorator";
import { apply } from "fp-ts/lib/function";
import { fromNullable, Option, some } from "fp-ts/lib/Option";
import { TSMap } from "typescript-map";
import { Q, QElement } from "../dom/q";
import { invoke1 } from "./invoke";
import { map } from "fp-ts/lib/Record";

interface HasElement<E extends QElement = QElement> {
  getElement(): Q<E>;
  setElement(e: Q<E>): void;
}

@autobind
export class CachedElements<E extends QElement = QElement, A extends HasElement<E> = HasElement<E>> {
  static readonly allCaches: { [name: string]: CachedElements } = {};

  readonly name: string;
  readonly ctor: new (element: Q<E>) => A;
  readonly selector: string;
  readonly cache: TSMap<QElement, A> = new TSMap();

  static modifyCachedElements(other: Q, f: (cache: CachedElements, oldEl: Q, newEl: Q, value: HasElement) => void): void {
    map(CachedElements.allCaches, (cache: CachedElements) =>
      cache.cache.forEach((value: HasElement, eo?: QElement) => fromNullable(eo).map((oldEl: QElement) =>
        some(other).filter(invoke1("matches")(CachedElements.elementIdSelector(oldEl)))
          .orElse(() => other.one(CachedElements.elementIdSelector(oldEl)))
          .map((newEl: Q) => f(cache, Q.of(oldEl), newEl, value)))));
  }

  static addCachedElements(added: Q): void {
    map(CachedElements.allCaches, (cache: CachedElements) => {
      cache.maybeCacheElement(added);
      cache.cacheElementsIn(added);
    });
  }

  static removeCachedElements(removed: Q): void {
    CachedElements.modifyCachedElements(removed,
      (cache: CachedElements<QElement, any>, oldEl: Q, _n: Q, _v: HasElement) => cache.cache.delete(oldEl.element));
  }

  static replaceCachedElements(replacement: Q): void {
    CachedElements.modifyCachedElements(replacement, (cache: CachedElements<QElement, any>, oldEl: Q, newEl: Q, value: HasElement) => {
      cache.cache.delete(oldEl.element);
      cache.cache.set(newEl.element, value);
      value.setElement(newEl);
    });
  }

  static normalizeId(id: string): string {
    return id.replace(/^#/, "");
  }

  static elementId(el: Q | QElement): string {
    return CachedElements.normalizeId((Q.isQ(el) ? el : Q.of(el)).getAttr("id"));
  }

  static elementIdSelector(el: Q | QElement): string {
    return `#${CachedElements.elementId(el)}`;
  }

  constructor(name: string, selector: string, ctor: new (element: Q<E>) => A) {
    this.name = name;
    this.ctor = ctor;
    this.selector = selector;

    CachedElements.allCaches[name] = (<CachedElements>(<unknown>this));
  }

  cacheElement(e: Q<E>): void {
    apply((a: A) => this.cache.set(a.getElement().element, a))(new this.ctor(e));
  }

  maybeCacheElement(e: Q<E>): void {
    some(e).filter(invoke1("matches")(this.selector)).map(this.cacheElement);
  }

  cacheElementsIn(root: Q): void {
    root.all<E>(this.selector).forEach(this.cacheElement);
  }

  init(): void {
    this.cacheElementsIn(Q.body);
  }

  get(elOrId: Q | string): Option<A> {
    return (Q.isQ(elOrId) ? some(elOrId) : Q.one(`#${CachedElements.normalizeId(elOrId)}`))
      .chain((e: Q) => fromNullable(this.cache.get(e.element)));
  }
}

// For debugging - TODO - remove when we go live?
(<any>window).cachedElements = CachedElements.allCaches;
