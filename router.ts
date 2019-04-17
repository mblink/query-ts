import { UrlInterface } from "./urlInterface";
import { Bondlink } from "../../sites/assets/scripts/bondlink";
import { Newtype, iso, prism } from "newtype-ts";
import { Prism } from "monocle-ts";

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



interface RelativePath extends Newtype<{ readonly RelativePath: unique symbol }, string> {}

const isRelativePath = (s: string) => s.charAt(0) === "/";

export const relativePathPrism: Prism<string, RelativePath> = prism<RelativePath>(isRelativePath);
// const rpO = relativePathPrism.getOption("foo");

export const relativePathIso = iso<RelativePath>();

export function relPathToUrl(rp: RelativePath): (origin?: string | URL) => URL {
  return (origin?: string | URL) => new URL(relativePathIso.unwrap(rp), origin ? origin : new URL(Bondlink.currentOrigin));
}
