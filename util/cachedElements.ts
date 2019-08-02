import autobind from "autobind-decorator";
import { insertAt, map as mapM, toArray } from "fp-ts/lib/Map";
import { chain, filter, fold, fromNullable, map as mapO, Option, some, alt } from "fp-ts/lib/Option";
import { reduce,  } from "fp-ts/lib/Array";
import { pipe } from "fp-ts/lib/pipeable";
import { eqString } from "fp-ts/lib/Eq";
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
    const mapI = toArray(eqOrd<QElement>());
    pipe(
      CachedElements.allCaches,
      mapM((m) => pipe(
        mapI(m.cache),
        (acc: [QElement, HasElement][]) => reduce(acc, (a: [QElement, HasElement][], kv: [QElement, HasElement]) => pipe(
          some(other),
          filter((x: Q) => fold(() => false, x.matches)(CachedElements.elementIdSelector(kv[0]))),
          alt(() => chain(other.one)(CachedElements.elementIdSelector(kv[0]))),
          fold(() => a, (newEl: Q) => Array.from(f(new Map(a), Q.of(kv[0]), newEl, kv[1]).entries()))
        )
      )))
    );
  }

  static addCachedElements(added: Q): void {
    mapM((cache: CachedElements) => {
      cache.maybeCacheElement(added);
      cache.cacheElementsIn(added);
    })(CachedElements.allCaches);
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
    return mapO((x: string) => `#${x}`)(CachedElements.elementId(el));
  }

  private static addCache(name: string, cache: CachedElements): void {
    CachedElements._allCaches = insertAt(eqString)(name, cache)(CachedElements.allCaches);
  }

  constructor(name: string, selector: string, ctor: new (element: Q<E>) => A) {
    this.name = name;
    this.ctor = ctor;
    this.selector = selector;

    CachedElements.addCache(name, <CachedElements>(<unknown>this));
  }

  get cache(): Map<QElement, A> { return this._cache; }

  cacheElement(e: Q<E>): void {
    const apply = (a: A) => this._cache = insertAt(qElSetoid)(a.getElement().element, a)(this.cache);
    apply(new this.ctor(e));
  }

  maybeCacheElement(e: Q<E>): void {
    pipe(
      some(e),
      filter(invoke1("matches")(this.selector)),
      mapO(this.cacheElement)
    );
  }

  cacheElementsIn(root: Q): void {
    root.all<E>(this.selector).forEach(this.cacheElement);
  }

  init(): void {
    this.cacheElementsIn(Q.body);
  }

  get(elOrId: Q | string): Option<A> {
    return chain((e: Q) => fromNullable(this.cache.get(e.element)))(Q.isQ(elOrId) ? some(elOrId) : Q.one(`#${CachedElements.normalizeId(elOrId)}`));
  }
}
