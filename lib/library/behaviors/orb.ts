// ── orb behavior runtime ──────────────────────────────────────────
// The orb stick: one round controller for a site and a game, by touch, mouse and keys. Zones by where a pointer goes
// down on [data-role="orb"]: inside 70% of its radius is the stick (a tap there — up within 250ms and under 6px of
// travel — is button 1; anything else steers), the ring within ±50° of 12 o'clock is button 2, the rest of the ring
// nothing. [data-role="b2"] and [data-role="side"] are real buttons; [data-role="stick"] is button 1's real button
// (Enter/Space on it = button 1), drawn as the disc that follows the pointer.
//
// It tells the page what happened with a bubbling, cancelable `orb` event on the root, detail:
//   { kind: 'stick', x, y, mag }       steering, x/y in −1…1 (0.12 dead zone), mag > 0.85 = full (a game's thruster)
//   { kind: 'aim', section }           site: the section the stick points at (null: none)
//   { kind: 'go', section }            site: released while pointing at one
//   { kind: 'release' }                the stick let go
//   { kind: 'button1' | 'button2' | 'side' }
// A game listens and calls preventDefault() to take a press over. Unless one does, with data-orb-mode="site" (the
// default) the orb runs the site: the stick dials the page's in-place sections (notches around the ring, the label
// names the one aimed at; letting go goes there by #hash); button 1 presses the lit (data-alive) button of the
// section showing (LAUNCH), else opens the next tab of a Menu + Detail, else scrolls down a step; button 2 the
// previous tab, else scrolls up. The side button only tells (a guide listens). data-orb-mode="game": events only.
// A pressed zone is lit (data-alive) for a moment; a 10ms vibration where supported.
//
// SELF-CONTAINED ON PURPOSE (source is copied into exported pages) — see carousel.ts.

export function alchemyOrb(root: HTMLElement): () => void {
  const prevCleanup = (root as unknown as { __alOrb?: () => void }).__alOrb;
  if (prevCleanup) prevCleanup();

  const orb = (root.querySelector('[data-role="orb"]') || root) as HTMLElement;
  const stick = root.querySelector('[data-role="stick"]') as HTMLElement | null;
  const b2 = root.querySelector('[data-role="b2"]') as HTMLElement | null;
  const side = root.querySelector('[data-role="side"]') as HTMLElement | null;
  const label = root.querySelector('[data-role="dial-label"]') as HTMLElement | null;
  const site = (root.getAttribute('data-orb-mode') || 'site') === 'site';
  const calm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const DEAD = 0.12, AIM = 0.35, TAP_MS = 250, TAP_PX = 6;

  orb.style.touchAction = 'none';
  orb.setAttribute('data-own-swipe', '');   // a drag on it steers; the sections don't swipe
  orb.style.userSelect = 'none';

  const tell = function (detail: Record<string, unknown>): boolean {   // true: nobody took it over
    return root.dispatchEvent(new CustomEvent('orb', { bubbles: true, cancelable: true, detail: detail }));
  };
  const flash = function (el: HTMLElement | null) {
    if (!el) return;
    el.setAttribute('data-alive', '');
    setTimeout(function () { el.removeAttribute('data-alive'); }, 200);
    if (navigator.vibrate) { try { navigator.vibrate(10); } catch { /* not allowed here */ } }
  };

  // ── The site: sections around the ring, entries in the section showing ──
  const sections = function (): HTMLElement[] {
    return Array.prototype.slice.call(document.querySelectorAll('.page-main > .page-sec[id]')) as HTMLElement[];
  };
  // The section showing, else the page's main; null off an exported page (a Workbench preview): the site actions wait
  const showing = function (): HTMLElement | null {
    const all = sections(), h = location.hash.slice(1);
    for (let i = 0; i < all.length; i++) if (all[i].id === h) return all[i];
    return all[0] || (document.querySelector('.page-main') as HTMLElement | null);
  };
  const nameOf = function (id: string): string {
    const a = document.querySelector('a[href="#' + id + '"]');
    return (a && (a.getAttribute('aria-label') || (a.textContent || '').trim())) || id;
  };
  let notches: HTMLElement[] = [];
  const placeNotches = function () {
    notches.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    notches = [];
    if (!site) return;
    const all = sections();
    for (let i = 0; i < all.length; i++) {
      const a = (i / all.length) * 2 * Math.PI, n = document.createElement('span');
      n.setAttribute('aria-hidden', 'true');
      n.style.cssText = 'position:absolute;width:4px;height:4px;margin:-2px 0 0 -2px;border-radius:50%;background:currentColor;opacity:.35;pointer-events:none;' +
        'left:' + (50 + 46 * Math.sin(a)) + '%;top:' + (50 - 46 * Math.cos(a)) + '%;';
      orb.appendChild(n);
      notches.push(n);
    }
  };
  const step = function (d: number) {
    const scope = showing();
    if (!scope) return;
    if (d > 0) {
      const lit = scope.querySelector('button[data-alive], a[data-alive]') as HTMLElement | null;
      if (lit && !root.contains(lit)) { lit.click(); return; }
    }
    const tabsRoot = scope.querySelector('[data-behavior~="tabs"]');
    if (tabsRoot) {
      const tabs = Array.prototype.slice.call(tabsRoot.querySelectorAll('[data-role="tab"]')) as HTMLElement[];
      let i = -1;
      for (let j = 0; j < tabs.length; j++) if (tabs[j].getAttribute('aria-selected') === 'true') i = j;
      const to = tabs[i + d];
      if (to) { to.click(); return; }
    }
    // A Readout: scroll what scrolls in the section (else the page) a step
    const els = scope.querySelectorAll('*');
    let box: Element | null = null;
    for (let j = 0; j < els.length && !box; j++) {
      const o = getComputedStyle(els[j]).overflowY;
      if ((o === 'auto' || o === 'scroll') && els[j].scrollHeight > els[j].clientHeight + 1) box = els[j];
    }
    const target = box || document.scrollingElement || document.documentElement;
    target.scrollBy({ top: d * target.clientHeight * 0.8, behavior: calm && calm.matches ? 'auto' : 'smooth' });
  };

  const press = function (kind: 'button1' | 'button2' | 'side', el: HTMLElement | null) {
    flash(el);
    if (!tell({ kind: kind }) || !site) return;
    if (kind === 'button1') step(1);
    else if (kind === 'button2') step(-1);
  };

  // ── The stick ──
  let drag: { id: number; x: number; y: number; t: number; moved: boolean; zone: 'stick' | 'b2' } | null = null;
  let aimed: string | null = null;
  const geom = function () {
    const r = orb.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, R: r.width / 2 };
  };
  const moveStick = function (dx: number, dy: number) {
    if (!stick) return;
    stick.style.transition = 'none';
    stick.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  };
  const homeStick = function () {
    if (!stick) return;
    stick.style.transition = calm && calm.matches ? 'none' : 'transform 200ms cubic-bezier(0, 0, 0.2, 1)';
    stick.style.transform = '';
  };
  const aim = function (id: string | null) {
    if (id === aimed) return;
    aimed = id;
    const all = sections();
    for (let i = 0; i < notches.length; i++) {
      const on = !!all[i] && all[i].id === id;
      notches[i].style.opacity = on ? '1' : '.35';
      notches[i].style.transform = on ? 'scale(1.6)' : '';
    }
    if (label) { label.textContent = id ? nameOf(id) : ''; if (id) label.removeAttribute('hidden'); else label.setAttribute('hidden', ''); }
    tell({ kind: 'aim', section: id });
  };

  const onDown = function (e: PointerEvent) {
    if (drag || e.button > 0) return;
    const t = e.target as Element;
    if ((b2 && b2.contains(t)) || (side && side.contains(t))) return;   // real buttons: their own click
    const g = geom(), dx = e.clientX - g.cx, dy = e.clientY - g.cy, dist = Math.hypot(dx, dy) / g.R;
    if (dist > 1) return;
    let zone: 'stick' | 'b2' | null = null;
    if (dist <= 0.7) zone = 'stick';
    else if (Math.abs(Math.atan2(dx, -dy)) <= (50 * Math.PI) / 180) zone = 'b2';
    if (!zone) return;
    e.preventDefault();
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, moved: false, zone: zone };
    try { orb.setPointerCapture(e.pointerId); } catch { /* already released */ }
    if (zone === 'stick' && stick) stick.setAttribute('data-alive', '');
  };
  const onMove = function (e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < TAP_PX) return;
    drag.moved = true;
    if (drag.zone !== 'stick') return;
    const g = geom(), inner = g.R * 0.7;
    let vx = (e.clientX - g.cx) / inner, vy = (e.clientY - g.cy) / inner;
    const m = Math.hypot(vx, vy);
    if (m > 1) { vx /= m; vy /= m; }
    const mag = Math.min(1, m);
    moveStick(vx * g.R * 0.3, vy * g.R * 0.3);
    tell({ kind: 'stick', x: mag < DEAD ? 0 : vx, y: mag < DEAD ? 0 : vy, mag: mag < DEAD ? 0 : mag });
    if (site && notches.length) {
      if (mag < AIM) aim(null);
      else {
        const all = sections(), turn = (Math.atan2(vx, -vy) + 2 * Math.PI) % (2 * Math.PI);
        aim(all[Math.round((turn / (2 * Math.PI)) * all.length) % all.length].id);
      }
    }
  };
  const onUp = function (e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag, quick = e.timeStamp - d.t <= TAP_MS && !d.moved && e.type === 'pointerup';
    drag = null;
    if (stick) stick.removeAttribute('data-alive');
    try { orb.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    if (d.zone === 'b2') { if (!d.moved && e.type === 'pointerup') press('button2', b2); return; }
    homeStick();
    if (quick) { press('button1', stick); return; }
    if (d.moved) {
      tell({ kind: 'stick', x: 0, y: 0, mag: 0 });
      const go = aimed;
      aim(null);
      tell({ kind: 'release' });
      if (go && tell({ kind: 'go', section: go }) && site) location.hash = go;
    }
  };
  // Keys: Enter/Space on a real button (a click with no pointer). Pointer presses are handled above
  const onStickClick = function (e: MouseEvent) { if (e.detail === 0) press('button1', stick); };
  const onB2Click = function () { press('button2', b2); };
  const onSideClick = function () { press('side', side); };

  orb.addEventListener('pointerdown', onDown);
  orb.addEventListener('pointermove', onMove);
  orb.addEventListener('pointerup', onUp);
  orb.addEventListener('pointercancel', onUp);
  if (stick) stick.addEventListener('click', onStickClick);
  if (b2) b2.addEventListener('click', onB2Click);
  if (side) side.addEventListener('click', onSideClick);
  if (label) label.setAttribute('hidden', '');
  placeNotches();

  const cleanup = function () {
    orb.removeEventListener('pointerdown', onDown);
    orb.removeEventListener('pointermove', onMove);
    orb.removeEventListener('pointerup', onUp);
    orb.removeEventListener('pointercancel', onUp);
    if (stick) stick.removeEventListener('click', onStickClick);
    if (b2) b2.removeEventListener('click', onB2Click);
    if (side) side.removeEventListener('click', onSideClick);
    notches.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    homeStick();
    orb.removeAttribute('data-own-swipe');
    (root as unknown as { __alOrb?: () => void }).__alOrb = undefined;
  };
  (root as unknown as { __alOrb?: () => void }).__alOrb = cleanup;
  return cleanup;
}
