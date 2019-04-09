import {UrlInterface} from "./urlInterface";

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
