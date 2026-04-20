// ============================================================
// Timer — thin setInterval wrapper.
// ============================================================

let intervalId: ReturnType<typeof setInterval> | null = null;
let ticks = 0;

export function start(onTick: (seconds: number) => void): void {
  if (intervalId !== null) return; // already running
  intervalId = setInterval(() => {
    ticks++;
    onTick(ticks);
  }, 1000);
}

export function stop(): void {
  if (intervalId === null) return;
  clearInterval(intervalId);
  intervalId = null;
}

export function reset(): void {
  stop();
  ticks = 0;
}
