type PK = PropertyKey;
type R<K extends PK, V> = Record<K, V>;

export function path<K1 extends PK, K2 extends PK>([k1, k2]: [K1, K2]): <A extends R<K1, R<K2, any>>>(a: A) => A[K1][K2];
export function path<K1 extends PK, K2 extends PK, K3 extends PK>([k1, k2, k3]: [K1, K2, K3]): <A extends R<K1, R<K2, R<K3, any>>>>(a: A) => A[K1][K2][K3];
export function path<K1 extends PK, K2 extends PK, K3 extends PK, K4 extends PK>([k1, k2, k3, k4]: [K1, K2, K3, K4]): <A extends R<K1, R<K2, R<K3, R<K4, any>>>>>(a: A) => A[K1][K2][K3][K4];
export function path<K1 extends PK, K2 extends PK, K3 extends PK, K4 extends PK, K5 extends PK>([k1, k2, k3, k4, k5]: [K1, K2, K3, K4, K5]): <A extends R<K1, R<K2, R<K3, R<K4, R<K5, any>>>>>>(a: A) => A[K1][K2][K3][K4][K5];
export function path<K1 extends PK, K2 extends PK, K3 extends PK, K4 extends PK, K5 extends PK, K6 extends PK>([k1, k2, k3, k4, k5, k6]: [K1, K2, K3, K4, K5, K6]): <A extends R<K1, R<K2, R<K3, R<K4, R<K5, R<K6, any>>>>>>>(a: A) => A[K1][K2][K3][K4][K5][K6];
export function path<K1 extends PK, K2 extends PK, K3 extends PK, K4 extends PK, K5 extends PK, K6 extends PK, K7 extends PK>([k1, k2, k3, k4, k5, k6, k7]: [K1, K2, K3, K4, K5, K6, K7]): <A extends R<K1, R<K2, R<K3, R<K4, R<K5, R<K6, R<K7, any>>>>>>>>(a: A) => A[K1][K2][K3][K4][K5][K6][K7];
export function path<K1 extends PK, K2 extends PK, K3 extends PK, K4 extends PK, K5 extends PK, K6 extends PK, K7 extends PK, K8 extends PK>([k1, k2, k3, k4, k5, k6, k7, k8]: [K1, K2, K3, K4, K5, K6, K7, K8]): <A extends R<K1, R<K2, R<K3, R<K4, R<K5, R<K6, R<K7, R<K8, any>>>>>>>>>(a: A) => A[K1][K2][K3][K4][K5][K6][K7][K8];
export function path<K1 extends PK, K2 extends PK, K3 extends PK, K4 extends PK, K5 extends PK, K6 extends PK, K7 extends PK, K8 extends PK, K9 extends PK>([k1, k2, k3, k4, k5, k6, k7, k8, k9]: [K1, K2, K3, K4, K5, K6, K7, K8, K9]): <A extends R<K1, R<K2, R<K3, R<K4, R<K5, R<K6, R<K7, R<K8, R<K9, any>>>>>>>>>>(a: A) => A[K1][K2][K3][K4][K5][K6][K7][K8][K9];
export function path<K1 extends PK, K2 extends PK, K3 extends PK, K4 extends PK, K5 extends PK, K6 extends PK, K7 extends PK, K8 extends PK, K9 extends PK, K10 extends PK>([k1, k2, k3, k4, k5, k6, k7, k8, k9, k10]: [K1, K2, K3, K4, K5, K6, K7, K8, K9, K10]): <A extends R<K1, R<K2, R<K3, R<K4, R<K5, R<K6, R<K7, R<K8, R<K9, R<K10, any>>>>>>>>>>>(a: A) => A[K1][K2][K3][K4][K5][K6][K7][K8][K9][K10];
export function path<K extends PK, A>(ks: K[]): (a: A) => any {
  return (a: A) => ks.reduce((acc: R<K, any>, k: K) => acc[k], a);
}

export const mkDeepObj = (ks: string[], v: any): { [k: string]: any } =>
  ({ [ks[0]]: ks.length === 1 ? v : mkDeepObj(ks.slice(1), v) });
