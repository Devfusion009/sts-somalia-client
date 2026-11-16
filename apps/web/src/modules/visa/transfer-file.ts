/** Signed Storage transfer with actual byte progress; cancellation never finalises the document. */
export function transferFile(url: string, file: File, signal: AbortSignal, progress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let stalled: ReturnType<typeof setTimeout> | undefined;
    const abort = () => { xhr.abort(); reject(new DOMException("Upload cancelled", "AbortError")); };
    if (signal.aborted) { abort(); return; }
    const cleanup = () => { signal.removeEventListener("abort", abort); clearTimeout(stalled); };
    const watchProgress = () => {
      clearTimeout(stalled);
      stalled = setTimeout(() => { cleanup(); reject(new Error("Upload stalled. Check your connection and try again.")); xhr.abort(); }, 45000);
    };
    signal.addEventListener("abort", abort, { once: true });
    xhr.open("PUT", url);
    xhr.timeout = 300000;
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = event => { watchProgress(); if (event.lengthComputable) progress(Math.min(100, Math.round(event.loaded / event.total * 100))); };
    xhr.upload.onload = () => watchProgress();
    xhr.onload = () => { cleanup(); if (xhr.status >= 200 && xhr.status < 300) resolve(); else reject(new Error("Upload failed. Please try again.")); };
    xhr.onerror = () => { cleanup(); reject(new Error("Connection interrupted. Please try again.")); };
    xhr.ontimeout = () => { cleanup(); reject(new Error("Upload timed out. Please try again.")); };
    xhr.onabort = () => { cleanup(); reject(new DOMException("Upload cancelled", "AbortError")); };
    const body = new FormData(); body.append("cacheControl", "3600"); body.append("", file);
    watchProgress(); xhr.send(body);
  });
}
