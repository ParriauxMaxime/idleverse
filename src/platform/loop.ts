const AUTOSAVE_INTERVAL_MS = 5000;

export function startLoop(frame: (elapsedSeconds: number) => void): () => void {
  let lastFrame = performance.now();
  let frameId = requestAnimationFrame(function loop(now) {
    frame((now - lastFrame) / 1000);
    lastFrame = now;
    frameId = requestAnimationFrame(loop);
  });

  return () => cancelAnimationFrame(frameId);
}

export function startAutosave(save: () => void): () => void {
  const intervalId = setInterval(save, AUTOSAVE_INTERVAL_MS);
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") save();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    clearInterval(intervalId);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    save();
  };
}
