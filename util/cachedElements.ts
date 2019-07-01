import autobind from "autobind-decorator";
import { apply } from "fp-ts/lib/function";
import { getTraversableWithIndex, insert, map } from "fp-ts/lib/Map";
import { fromNullable, Option, some } from "fp-ts/lib/Option";
import { setoidString } from "fp-ts/lib/Setoid";
import { Q, QElement } from "../dom/q";
import { eqOrd, eqSetoid } from "./instances";
import { invoke1 } from "./invoke";
import {trimFilter} from "./trimFilter";

interface HasElement<E extends QElement = QElement> {
  getElement(): Q<E>;
  setElement(e: Q<E>): void;
}

const qElSetoid = eqSetoid<QElement>();

@autobind
export class CachedElements<E extends QElement = QElement, A extends HasElement<E> = HasElement<E>> {
  private static _allCaches: Map<string, CachedElements> = new Map();
  readonly name: string;
  readonly ctor: new (element: Q<E>) => A;
  readonly selector: string;
  private _cache: Map<QElement, A> = new Map();

  static get allCaches(): Map<string, CachedElements> { return CachedElements._allCaches; }

  static modifyCachedElements(other: Q, f: (cache: Map<QElement, HasElement>, oldEl: Q, newEl: Q, value: HasElement) => Map<QElement, HasElement>): void {
    const mapI = getTraversableWithIndex(eqOrd<QElement>());
    map.map(CachedElements.allCaches, (cache: CachedElements) =>
      mapI.reduceWithIndex(cache.cache, cache.cache, (oldEl: QElement, acc: Map<QElement, HasElement>, value: HasElement) =>
        some(other).filter((x: Q) => CachedElements.elementIdSelector(oldEl).fold(false, x.matches))
          .orElse(() => CachedElements.elementIdSelector(oldEl).chain(other.one))
          .fold(acc, (newEl: Q) => f(acc, Q.of(oldEl), newEl, value))));
  }

  static addCachedElements(added: Q): void {
    map.map(CachedElements.allCaches, (cache: CachedElements) => {
      cache.maybeCacheElement(added);
      cache.cacheElementsIn(added);
    });
  }

  static removeCachedElements(removed: Q): void {
    CachedElements.modifyCachedElements(removed, (cache: Map<QElement, HasElement>, oldEl: Q, _n: Q) => {
      cache.delete(oldEl.element);
      return cache;
    });
  }

  static replaceCachedElements(replacement: Q): void {
    CachedElements.modifyCachedElements(replacement, (cache: Map<QElement, HasElement>, oldEl: Q, newEl: Q, value: HasElement) => {
      cache.delete(oldEl.element);
      cache.set(newEl.element, value);
      value.setElement(newEl);
      return cache;
    });
  }

  static normalizeId(id: string): string {
    return id.replace(/^#/, "");
  }

  static elementId(el: Q | QElement): Option<string> {
    return trimFilter(CachedElements.normalizeId((Q.isQ(el) ? el : Q.of(el)).getAttr("id")));
  }

  static elementIdSelector(el: Q | QElement): Option<string> {
    return CachedElements.elementId(el).map((x: string) => `#${x}`);
  }

  private static addCache(name: string, cache: CachedElements): void {
    CachedElements._allCaches = insert(setoidString)(name, cache, CachedElements.allCaches);
  }

  constructor(name: string, selector: string, ctor: new (element: Q<E>) => A) {
    this.name = name;
    this.ctor = ctor;
    this.selector = selector;

    CachedElements.addCache(name, <CachedElements>(<unknown>this));
  }

  get cache(): Map<QElement, A> { return this._cache; }

  cacheElement(e: Q<E>): void {
    apply((a: A) => this._cache = insert(qElSetoid)(a.getElement().element, a, this.cache))(new this.ctor(e));
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
