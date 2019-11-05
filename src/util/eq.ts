export function eq<A>(a1: A, a2: A): boolean;
export function eq<A>(a1: A): (a2: A) => boolean;
export function eq<A>(a1: A, a2o?: A): boolean | ((a2: A) => boolean) {
  return a2o ? a1 === a2o : (a2: A) => a1 === a2;
}
