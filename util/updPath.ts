// tslint:disable no-unsafe-any

type PK = PropertyKey;
type R<K extends PK, V> = Record<K, V>;

export function updPath<K1 extends PK, K2 extends PK>([k1, k2]: [K1, K2]): <A extends R<K1, R<K2, any>>>(f: (v: A[K1][K2]) => A[K1][K2]) => (a: A) => A;
export function updPath<K1 extends PK, K2 extends PK, K3 extends PK>([k1, k2, k3]: [K1, K2, K3]): <A extends R<K1, R<K2, R<K3, any>>>>(f: (v: A[K1][K2][K3]) => A[K1][K2][K3]) => (a: A) => A;
export function updPath<K1 extends PK, K2 extends PK, K3 extends PK, K4 extends PK>([k1, k2, k3, k4]: [K1, K2, K3, K4]): <A extends R<K1, R<K2, R<K3, R<K4, any>>>>>(f: (v: A[K1][K2][K3][K4]) => A[K1][K2][K3][K4]) => (a: A) => A;
export function updPath<K1 extends PK, K2 extends PK, K3 extends PK, K4 extends PK, K5 extends PK>([k1, k2, k3, k4, k5]: [K1, K2, K3, K4, K5]): <A extends R<K1, R<K2, R<K3, R<K4, R<K5, any>>>>>>(f: (v: A[K1][K2][K3][K4][K5]) => A[K1][K2][K3][K4][K5]) => (a: A) => A;
export function updPath<K1 extends PK, K2 extends PK, K3 extends PK, K4 extends PK, K5 extends PK, K6 extends PK>([k1, k2, k3, k4, k5, k6]: [K1, K2, K3, K4, K5, K6]): <A extends R<K1, R<K2, R<K3, R<K4, R<K5, R<K6, any>>>>>>>(f: (v: A[K1][K2][K3][K4][K5][K6]) => A[K1][K2][K3][K4][K5][K6]) => (a: A) => A;
export function updPath<K1 extends PK, K2 extends PK, K3 extends PK, K4 extends PK, K5 extends PK, K6 extends PK, K7 extends PK>([k1, k2, k3, k4, k5, k6, k7]: [K1, K2, K3, K4, K5, K6, K7]): <A extends R<K1, R<K2, R<K3, R<K4, R<K5, R<K6, R<K7, any>>>>>>>>(f: (v: A[K1][K2][K3][K4][K5][K6][K7]) => A[K1][K2][K3][K4][K5][K6][K7]) => (a: A) => A;
export function updPath<K1 extends PK, K2 extends PK, K3 extends PK, K4 extends PK, K5 extends PK, K6 extends PK, K7 extends PK, K8 extends PK>([k1, k2, k3, k4, k5, k6, k7, k8]: [K1, K2, K3, K4, K5, K6, K7, K8]): <A extends R<K1, R<K2, R<K3, R<K4, R<K5, R<K6, R<K7, R<K8, any>>>>>>>>>(f: (v: A[K1][K2][K3][K4][K5][K6][K7][K8]) => A[K1][K2][K3][K4][K5][K6][K7][K8]) => (a: A) => A;
export function updPath<K1 extends PK, K2 extends PK, K3 extends PK, K4 extends PK, K5 extends PK, K6 extends PK, K7 extends PK, K8 extends PK, K9 extends PK>([k1, k2, k3, k4, k5, k6, k7, k8, k9]: [K1, K2, K3, K4, K5, K6, K7, K8, K9]): <A extends R<K1, R<K2, R<K3, R<K4, R<K5, R<K6, R<K7, R<K8, R<K9, any>>>>>>>>>>(f: (v: A[K1][K2][K3][K4][K5][K6][K7][K8][K9]) => A[K1][K2][K3][K4][K5][K6][K7][K8][K9]) => (a: A) => A;
export function updPath<K1 extends PK, K2 extends PK, K3 extends PK, K4 extends PK, K5 extends PK, K6 extends PK, K7 extends PK, K8 extends PK, K9 extends PK, K10 extends PK>([k1, k2, k3, k4, k5, k6, k7, k8, k9, k10]: [K1, K2, K3, K4, K5, K6, K7, K8, K9, K10]): <A extends R<K1, R<K2, R<K3, R<K4, R<K5, R<K6, R<K7, R<K8, R<K9, R<K10, any>>>>>>>>>>>(f: (v: A[K1][K2][K3][K4][K5][K6][K7][K8][K9][K10]) => A[K1][K2][K3][K4][K5][K6][K7][K8][K9][K10]) => (a: A) => A;
export function updPath(_ks: any[]): (f: (v: any) => any) => (_a: any) => any {
  return (f: (v: any) => any) => (_a: any) => {
    const rec = (ks: any, a: any): any => Object.assign({}, a, { [ks[0]]: ks.length === 1 ? f(a[ks[0]]) : rec(ks.slice(1), a[ks[0]]) });
    return rec(_ks, _a);
  };
}
