import { filter, Option, tryCatch } from "fp-ts/lib/Option";

export const parseNumber = (x: any): Option<number> =>
  // tslint:disable-next-line:no-unsafe-any
  filter((n: number) => !isNaN(n))(tryCatch(() => parseInt(x)));
