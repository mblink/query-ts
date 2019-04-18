// tslint:disable-next-line variable-name
export const Log = {
  // tslint:disable:no-console
  info: (msg: string, ...args: any[]): void => console.log(msg, ...args),
  warn: (msg: string, ...args: any[]): void => console.warn(msg, ...args),
  error: (msg: string, ...args: any[]): void => console.error(msg, ...args),
  // tslint:enable:no-console
};
