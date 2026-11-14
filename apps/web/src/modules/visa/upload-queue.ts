/** Keep document mutations and their page revalidations in selection order. */
export function createUploadQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(upload: () => Promise<T>): Promise<T> {
    const result = tail.then(upload);
    // A failed upload must not prevent later documents from being saved.
    tail = result.catch(() => undefined);
    return result;
  };
}
