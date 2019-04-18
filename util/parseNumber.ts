import {Option, tryCatch} from "fp-ts/lib/Option";

export const parseNumber = (x: any): Option<number> =>
  // tslint:disable-next-line:no-unsafe-any
  tryCatch(() => parseInt(x)).filter((n: number) => !isNaN(n));
