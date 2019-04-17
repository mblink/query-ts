import { UrlInterface } from "./urlInterface";
import { Bondlink } from "../../sites/assets/scripts/bondlink";
import { Newtype, iso, prism } from "newtype-ts";
import { Prism, Iso } from "monocle-ts";

export interface RouteInterface {
  method: string;
  url: string;
}

export abstract class Router {

  static routes: {};

  protected static _wA(route: RouteInterface): UrlInterface {
    return {
      method: route.method,
      url: route.url,
    };
  }

  protected static _qS(items: any): string {
    let qs = "";
    for (let i = 0; i < items.length; i++) { // tslint:disable-line:prefer-for-of
      if (items[i]) {
        qs += (qs ? "&" : "") + items[i];
      }
    }
    return qs ? ("?" + qs) : "";
  }
}



interface AbsolutePath extends Newtype<{ readonly AbsolutePath: unique symbol }, string> {}
const isAbsolutePath = (s: string) => s.charAt(0) === "/";

/**
 * Example of potential usage when dealing with an unknown value
 *
 * const apO = apPrism.getOption("foo");
 */
export const apPrism: Prism<string, AbsolutePath> = prism<AbsolutePath>(isAbsolutePath);
export const apIso: Iso<AbsolutePath, string> = iso<AbsolutePath>();

export function absPathToUrl(rp: AbsolutePath): (origin?: string | URL) => URL {
  return (origin?: string | URL) => new URL(apIso.unwrap(rp), origin ? origin : new URL(Bondlink.currentOrigin));
}
