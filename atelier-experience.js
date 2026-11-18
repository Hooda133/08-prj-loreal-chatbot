// Decorative, progressive enhancement only. No network calls or product state.
// A fine reading-progress rail and a gentle studio-light follow the pointer.
(function () {
  "use strict";
  const rail = document.getElementById("readingProgressBar");
  const cover = document.getElementById("consultation");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let scheduled = false;

  function paintScrollProgress() {
    scheduled = false;
    if (!rail) return;
    const maximum = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const percentage = maximum > 0 ? Math.min(1, Math.max(0, window.scrollY / maximum)) : 0;
    rail.style.transform = "scaleX(" + percentage.toFixed(4) + ")";
  }

  function scheduleProgressPaint() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(paintScrollProgress);
  }

  window.addEventListener("scroll", scheduleProgressPaint, { passive: true });
  window.addEventListener("resize", scheduleProgressPaint, { passive: true });
  paintScrollProgress();

  // On fine-pointer devices the dark hero has a restrained, moving
  // champagne highlight. Touchscreen devices and reduced-motion users
  // get an attractive static background instead.
  if (!cover || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  cover.addEventListener("pointermove", event => {
    if (reducedMotion.matches || document.body.classList.contains("motion-paused")) return;
    const rect = cover.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.round((event.clientX - rect.left) * 100 / rect.width);
    const y = Math.round((event.clientY - rect.top) * 100 / rect.height);
    cover.style.setProperty("--light-x", x + "%");
    cover.style.setProperty("--light-y", y + "%");
  }, { passive: true });
  cover.addEventListener("pointerleave", () => {
    cover.style.removeProperty("--light-x");
    cover.style.removeProperty("--light-y");
  });
})();
