export const wrapArr = <A>(a: A | A[]): A[] => Array.isArray(a) ? a : [a];
