// ── carousel behavior runtime ─────────────────────────────────────
// Adds prev/next arrows and dots to a native scroll-snap track. Progressive enhancement: the
// track already swipes without this; the controls ship `hidden` and are revealed here.
//
// Finds, inside the root: [data-role="track"] (required), [data-role="prev"], [data-role="next"],
// [data-role="dots"] (container, revealed) and [data-role="dot"] (one per slide).
// Reads data-loop="true" and data-autoplay="<seconds>" on the root. Marks the current dot
// aria-current="true" and disables prev/next at the ends when not looping. Autoplay always wraps,
// pauses while hovered / focused inside / the tab is hidden, and never runs when the user asks
// for reduced motion.
//
// SELF-CONTAINED ON PURPOSE: no imports, no outside references — its source text is copied
// verbatim into exported pages (Function.prototype.toString). Only long-established browser
// APIs (querySelector, addEventListener, requestAnimationFrame, Element.scrollTo).
// Returns a cleanup function; calling it again on the same root first cleans up the last run.

export function alchemyCarousel(root: HTMLElement): () => void {
  const prevCleanup = (root as unknown as { __alCarousel?: () => void }).__alCarousel;
  if (prevCleanup) prevCleanup();

  const track = root.querySelector('[data-role="track"]') as HTMLElement | null;
  if (!track) return function () {};
  const prev = root.querySelector('[data-role="prev"]') as HTMLButtonElement | null;
  const next = root.querySelector('[data-role="next"]') as HTMLButtonElement | null;
  const dotBox = root.querySelector('[data-role="dots"]') as HTMLElement | null;
  const dots = Array.prototype.slice.call(root.querySelectorAll('[data-role="dot"]')) as HTMLElement[];
  const loop = root.getAttribute('data-loop') === 'true';

  const slides = function () { return Array.prototype.slice.call(track.children) as HTMLElement[]; };
  const offsetOf = function (i: number) { const s = slides(); return s[i].offsetLeft - s[0].offsetLeft; };

  // The slide whose start is closest to the current scroll position
  let index = 0;
  const current = function () {
    const s = slides();
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < s.length; i++) {
      const d = Math.abs(offsetOf(i) - track.scrollLeft);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  };

  const update = function () {
    index = current();
    const atStart = track.scrollLeft <= 2;
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    for (let i = 0; i < dots.length; i++) dots[i].setAttribute('aria-current', i === index ? 'true' : 'false');
    if (prev) prev.disabled = !loop && atStart;
    if (next) next.disabled = !loop && atEnd;
  };

  const go = function (i: number) {
    const n = slides().length;
    if (!n) return;
    if (loop) i = (i % n + n) % n;
    else i = Math.max(0, Math.min(n - 1, i));
    track.scrollTo({ left: offsetOf(i), behavior: 'smooth' });
  };

  let frame = 0;
  const onScroll = function () {
    if (frame) return;
    frame = requestAnimationFrame(function () { frame = 0; update(); });
  };
  const onPrev = function () {
    // looping from the first slide wraps to the last
    if (loop && track.scrollLeft <= 2) go(slides().length - 1); else go(index - 1);
  };
  const onNext = function () {
    if (loop && track.scrollLeft + track.clientWidth >= track.scrollWidth - 2) go(0); else go(index + 1);
  };
  const dotHandlers = dots.map(function (_d, i) { return function () { go(i); }; });

  // ── Autoplay ──
  const seconds = parseFloat(root.getAttribute('data-autoplay') || '');
  const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let timer = 0;
  let paused = false;
  const tick = function () {
    if (paused || document.hidden) return;
    if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 2) go(0); else go(index + 1);
  };
  const pause  = function () { paused = true; };
  const resume = function () { paused = false; };
  const onFocusOut = function (e: FocusEvent) { if (!root.contains(e.relatedTarget as Node | null)) resume(); };
  if (seconds > 0 && !reduced) {
    timer = window.setInterval(tick, seconds * 1000);
    root.addEventListener('pointerenter', pause);
    root.addEventListener('pointerleave', resume);
    root.addEventListener('focusin', pause);
    root.addEventListener('focusout', onFocusOut);
  }

  track.addEventListener('scroll', onScroll, { passive: true });
  if (prev) { prev.addEventListener('click', onPrev); prev.removeAttribute('hidden'); }
  if (next) { next.addEventListener('click', onNext); next.removeAttribute('hidden'); }
  if (dotBox) dotBox.removeAttribute('hidden');
  for (let i = 0; i < dots.length; i++) { dots[i].addEventListener('click', dotHandlers[i]); dots[i].removeAttribute('hidden'); }
  update();

  const cleanup = function () {
    track.removeEventListener('scroll', onScroll);
    if (prev) prev.removeEventListener('click', onPrev);
    if (next) next.removeEventListener('click', onNext);
    for (let i = 0; i < dots.length; i++) dots[i].removeEventListener('click', dotHandlers[i]);
    if (frame) cancelAnimationFrame(frame);
    if (timer) {
      window.clearInterval(timer);
      root.removeEventListener('pointerenter', pause);
      root.removeEventListener('pointerleave', resume);
      root.removeEventListener('focusin', pause);
      root.removeEventListener('focusout', onFocusOut);
    }
    (root as unknown as { __alCarousel?: () => void }).__alCarousel = undefined;
  };
  (root as unknown as { __alCarousel?: () => void }).__alCarousel = cleanup;
  return cleanup;
}
