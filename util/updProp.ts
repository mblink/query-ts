export function updProp<K extends PropertyKey>(k: K): <A extends Record<K, any>>(f: (v: A[K]) => A[K]) => (a: A) => A {
  return <A extends Record<K, any>>(f: (v: A[K]) => A[K]) => (a: A): A => Object.assign({}, a, { [k]: f(a[k]) });
}
