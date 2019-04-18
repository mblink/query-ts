import autobind from "autobind-decorator";

type Unsupported = "href";

@autobind
export class AttrProxy<A> {
  underlying: A;

  constructor(underlying: A) {
    this.underlying = underlying;
  }

  /**
   * Get a known attribute of the underlying type
   * @typeparam K A known attribute key
   * @returns The well-typed attribute value
   */
  getAttr<K extends Exclude<keyof A, Unsupported>>(key: K): A[K] {
    return this.underlying[key];
  }

  /**
   * Set a known attribute on the underlying type
   * @param key A known attribute key
   * @param value The well-typed attribute value
   */
  setAttr<K extends keyof A>(key: K, value: A[K]): this {
    this.underlying[key] = value;
    return this;
  }
}
