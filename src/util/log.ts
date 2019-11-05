import { sentry, BLError } from "../sentry";

// tslint:disable-next-line variable-name
export const Log = {
  // tslint:disable:no-console
  info: (msg: string, ...args: any[]): void => console.log(msg, ...args),
  warn: (msg: string, ...args: any[]): void => console.warn(msg, ...args),
  error: (msg: string, ...args: any[]): void => {
    console.error(msg, ...args);
    sentry.capture(new BLError(msg, args, "BConsoleError"));
  },
  // tslint:enable:no-console
};
