/** Limit simultaneous transfers without letting a failed file block the rest. */
export function createUploadQueue(concurrency = 1) {
  const limit = Math.max(1, Math.floor(concurrency) || 1);
  let active = 0;
  const waiting: Array<() => void> = [];
  function drain() {
    while (active < limit && waiting.length) waiting.shift()!();
  }
  return function enqueue<T>(upload: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      waiting.push(() => {
        active += 1;
        Promise.resolve().then(upload).then(resolve, reject).finally(() => { active -= 1; drain(); });
      });
      drain();
    });
  };
}
