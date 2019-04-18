// tslint:disable strict-boolean-expressions

let lastTime = 0;

export const requestAnimFrame: (f: FrameRequestCallback) => number =
  (window.requestAnimationFrame ||
    (<any>window).webkitRequestAnimationFrame ||
    (<any>window).mozRequestAnimationFrame ||
    (<any>window).msRequestAnimationFrame ||
    (<any>window).oRequestAnimationFrame ||
    ((cb: FrameRequestCallback) => {
      const currTime = (new Date()).getTime();
      const timeToCall = Math.max(0, 16 - (currTime - lastTime));
      const id = setTimeout(() => cb(currTime + timeToCall), timeToCall);
      lastTime = currTime + timeToCall;
      return id;
    })).bind(window);

export const cancelAnimFrame: (handle: number) => void =
  (window.cancelAnimationFrame ||
    (<any>window).webkitCancelAnimationFrame ||
    (<any>window).webkitCancelRequestAnimationFrame ||
    (<any>window).mozCancelAnimationFrame ||
    (<any>window).mozCancelRequestAnimationFrame ||
    (<any>window).msCancelAnimationFrame ||
    (<any>window).msCancelRequestAnimationFrame ||
    (<any>window).oCancelAnimationFrame ||
    (<any>window).oCancelRequestAnimationFrame ||
    ((handle: number) => clearTimeout(handle))).bind(window);
