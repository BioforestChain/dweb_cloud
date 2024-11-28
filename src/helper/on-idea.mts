
type OnIdea = (cb: () => void) => void;
declare const requestIdleCallback: OnIdea | undefined;
export const onIdea: OnIdea =
  typeof requestIdleCallback === "function"
    ? requestIdleCallback
    : (cb) => {
        const delay = 1000;
        let pre = Date.now();
        setInterval(() => {
          const now = Date.now();
          const diff = now - pre;
          pre = now;
          if (Math.abs(diff - delay) < 16) {
            cb();
          }
        }, delay);
      };
