export function prop<K extends PropertyKey>(k: K): <A extends Record<K, any>>(a: A) => A[K] {
  return <A extends Record<K, any>>(a: A): A[K] => a[k];
}
