"use client";

import { useEffect, useRef } from "react";

let audio: AudioContext | null = null;

/**
 * Browsers keep an AudioContext suspended until the page has seen a user
 * gesture. The first click or key press anywhere resumes it, so a later
 * arrival (driven by the poll, not by a gesture) can still play.
 */
function unlockAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
  } catch {
    audio = null;
  }
}

/** Two-tone chime synthesized in place, so there is no audio asset to ship. */
function playChime() {
  if (!audio || audio.state !== "running") return;
  const start = audio.currentTime;
  for (const [offset, frequency] of [
    [0, 880],
    [0.16, 1318.5],
  ] as const) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start + offset);
    gain.gain.linearRampToValueAtTime(0.18, start + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.5);
    osc.connect(gain).connect(audio.destination);
    osc.start(start + offset);
    osc.stop(start + offset + 0.55);
  }
}

/**
 * Rings the bell and plays a chime once per arrival of a notification the
 * page has not seen before. The unread rows already present on first mount
 * never trigger it, and the bell stays still between arrivals.
 */
export function useBellAlert(ids: string[]) {
  const ref = useRef<HTMLButtonElement>(null);
  const seen = useRef<Set<string> | null>(null);
  const key = ids.join(",");

  useEffect(() => {
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  useEffect(() => {
    const current = key ? key.split(",") : [];
    const previous = seen.current;
    seen.current = new Set(current);
    if (!previous || !current.some((id) => !previous.has(id))) return;

    const el = ref.current;
    if (el) {
      // Restart the animation even if a previous ring is still playing.
      el.classList.remove("bell-alerting");
      void el.offsetWidth;
      el.classList.add("bell-alerting");
    }
    playChime();
  }, [key]);

  return ref;
}
