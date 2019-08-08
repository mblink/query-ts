export const tap = <A>(f: (a: A) => any) => (a: A): A => {
  f(a);
  return a;
};
