import { getMonoid } from "fp-ts/lib/Record";
import { getLastSemigroup, Semigroup } from "fp-ts/lib/Semigroup";
import { wrapArr } from "./wrapArr";
import { fromNullable } from "fp-ts/lib/Option";
import { prop } from "./prop";
import { pipe } from "fp-ts/lib/function";
import { invoke0 } from "./invoke";
import { eq } from "./eq";

const fToS = ({}).hasOwnProperty.toString;

export const isObj = (a: any): a is object => fromNullable(a)
  .filter(pipe(invoke0("toString"), eq("[object Object]")))
  .fold(false, (x: any) => fromNullable(Object.getPrototypeOf(x)).mapNullable(prop("constructor")).fold(true,
    (ctor: any) => typeof ctor === "function" && fToS.call(ctor) === fToS.call(Object)));

export const mergeWith = (sg: Semigroup<any>) => <A extends object>(a: A) => <B extends object>(b: B): A & B =>
  <A & B>(<unknown>getMonoid(sg).concat(a, b));

export const defaultSg: Semigroup<any> = getLastSemigroup();
export const deepSg: Semigroup<any> = {
  concat: (x: any, y: any) => {
    if (Array.isArray(x) && Array.isArray(y)) {
      return x.concat(y);
    } else if (isObj(x) && isObj(y)) {
      return mergeWith(deepSg)(x)(y);
    } else {
      return defaultSg.concat(x, y);
    }
  }
};
export const deepArrSg: Semigroup<any> = {
  concat: (x: any, y: any) => {
    if (Array.isArray(x) || Array.isArray(y)) {
      return wrapArr(x).concat(wrapArr(y));
    } else if (isObj(x) && isObj(y)) {
      return mergeWith(deepArrSg)(x)(y);
    } else {
      return [x, y];
    }
  }
};

export const merge = mergeWith(defaultSg);
export const mergeDeep = mergeWith(deepSg);
