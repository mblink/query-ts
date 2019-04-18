import { Q } from "./q";
import { constVoid } from "fp-ts/lib/function";
import { MainNav } from "../../../sites/assets/scripts/mainNav";
import MoveTo from "moveto";

export const scrollTo = (el: Q, cb?: () => void): void =>
  (new MoveTo({ callback: cb || constVoid, tolerance: MainNav.blBarHeight + Q.remToPx(1) })).move(<HTMLElement>el.element);
