export function concat(s1: string, s2: string): string;
export function concat(s1: string): (s2: string) => string;
export function concat(s1: string, s2o?: string): string | ((s2: string) => string) {
  return typeof s2o === "string" ? s1 + s2o : (s2: string) => s1 + s2;
}
