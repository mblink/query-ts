import { none, Option, some } from "fp-ts/lib/Option";

export const parseBool = (x: string): Option<boolean> =>
  x === "true" ? some(true) : (x === "false" ? some(false) : none);
