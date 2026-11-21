// ── alive behavior runtime ────────────────────────────────────────
// Lights a part without a hover: sets data-alive on the root, which the recipe's `alive` state styles (glow, a
// brighter line). Other runtimes may set data-alive too (the orb, a typewriter); this one covers the plain cases.
//
// Reads data-alive-while on the root:
//   always   — lit from the start (the launch button)
//   section  — lit while the in-place section it's in (or its pinned block came with) is showing (#hash, or the first)
//   focus    — lit while focus is inside it (a Plate while typing)
//   off / "" — never (the default, so a prop can switch it per use)
//
// SELF-CONTAINED ON PURPOSE (source is copied into exported pages) — see carousel.ts.

export function alchemyAlive(root: HTMLElement): () => void {
  const prevCleanup = (root as unknown as { __alAlive?: () => void }).__alAlive;
  if (prevCleanup) prevCleanup();

  const mode = root.getAttribute('data-alive-while') || '';
  const set = function (on: boolean) { if (on) root.setAttribute('data-alive', ''); else root.removeAttribute('data-alive'); };
  const offs: (() => void)[] = [];

  if (mode === 'always') set(true);
  else if (mode === 'focus') {
    const check = function () { set(root.contains(document.activeElement)); };
    const later = function () { setTimeout(check, 0); };   // focus has moved on only after focusout
    root.addEventListener('focusin', check);
    root.addEventListener('focusout', later);
    offs.push(function () { root.removeEventListener('focusin', check); root.removeEventListener('focusout', later); });
    check();
  } else if (mode === 'section') {
    // Its section: the one it's in, or the one its pinned block came with (data-sec)
    const inSec = root.closest('.page-sec'), pin = root.closest('[data-sec]');
    const secId = inSec ? inSec.id : pin ? pin.getAttribute('data-sec') : null;
    const check = function () {
      const all = document.querySelectorAll('.page-main > .page-sec');
      if (!secId || !all.length) { set(true); return; }
      const h = location.hash.slice(1), hit = h ? document.getElementById(h) : null;
      const shown = hit && hit.classList.contains('page-sec') ? hit : all[0];
      set(shown.id === secId);
    };
    window.addEventListener('hashchange', check);
    offs.push(function () { window.removeEventListener('hashchange', check); });
    check();
  } else set(false);

  const cleanup = function () {
    offs.forEach(function (f) { f(); });
    (root as unknown as { __alAlive?: () => void }).__alAlive = undefined;
  };
  (root as unknown as { __alAlive?: () => void }).__alAlive = cleanup;
  return cleanup;
}
