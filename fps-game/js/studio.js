'use strict';
// Skin Studio: a 360° turntable for any weapon in any skin. Drag to spin, scroll to zoom, click a skin to
// preview it, then equip it (or buy it with candy corn during the Halloween event).

const studio = (() => {
  const E = id => document.getElementById(id);
  const canvas = E('stCanvas');
  let r = null, scene, cam, holder, back = 'menu', sel = null, preview = null, spin = true, raf = 0;
  let yaw = -0.6, pitch = 0.18, dist = 2.0, drag = null, lastT = 0;
  const previews = {}, swatches = {};

  function init() {
    if (r) return;
    r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.25;
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    scene = new THREE.Scene();
    cam = new THREE.PerspectiveCamera(32, 4 / 3, 0.01, 50);
    scene.add(new THREE.HemisphereLight(0xc8d4ff, 0x2a1a20, 1.0));
    const key = new THREE.DirectionalLight(0xfff0e0, 2.2); key.position.set(2, 3, 2); scene.add(key);
    const rim = new THREE.DirectionalLight(0xff8a3a, 1.6); rim.position.set(-3, 1, -2); scene.add(rim);
    const fill = new THREE.DirectionalLight(0x8aa0ff, 0.6); fill.position.set(0, -2, 3); scene.add(fill);
    holder = new THREE.Group(); scene.add(holder);
    // soft floor glow under the weapon
    const [c, g] = cv(128, 128); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,140,40,.35)'); gr.addColorStop(1, 'rgba(255,140,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: tex(c, 1, 1), transparent: true, depthWrite: false })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.32; scene.add(floor);
    canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => { if (!drag) return; yaw += (e.clientX - drag.x) * 0.01; pitch = clamp(pitch + (e.clientY - drag.y) * 0.006, -0.9, 0.9); drag = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('pointerup', () => { drag = null; });
    canvas.addEventListener('wheel', e => { e.preventDefault(); dist = clamp(dist * (1 + Math.sign(e.deltaY) * 0.1), 1.1, 4); }, { passive: false });
    E('stSpin').addEventListener('click', () => { spin = !spin; E('stSpin').textContent = spin ? 'Auto-spin on' : 'Auto-spin off'; SFX.ui(); });
    E('stBack').addEventListener('click', close);
    E('stGuns').addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (!b) return; SFX.ui(); select(b.dataset.g); });
    E('stSkins').addEventListener('click', onSkinClick);
  }

  // a fresh copy of the gun's viewmodel without the arms, centred on the turntable
  function previewGun(id) {
    if (previews[id]) return previews[id];
    const gun = BUILDERS[id](newGun(WEAPON_BY_ID[id]));
    vmRoot.remove(gun.g); gun.g.visible = true; gun.flash.visible = false;
    gun.g.traverse(o => { if (o.isMesh && (o.material === VMS_MAT.glove || o.material === VMS_MAT.sleeve)) o.visible = false; });
    configureGun(gun, id);
    const box = new THREE.Box3().setFromObject(gun.g), size = box.getSize(new V3()), ctr = box.getCenter(new V3());
    const pivot = new THREE.Group(); gun.g.position.sub(ctr); pivot.add(gun.g);
    pivot.scale.setScalar(1.7 / Math.max(size.x, size.y, size.z));
    gun.pivot = pivot;
    return (previews[id] = gun);
  }
  function swatch(k) {
    if (swatches[k]) return swatches[k];
    const s = SKINS[k];
    if (s.pattern) return (swatches[k] = `url(${skinTexture(k).image.toDataURL()})`);
    return (swatches[k] = `linear-gradient(135deg,#${s.poly.toString(16).padStart(6, '0')} 0 45%,#${s.metal.toString(16).padStart(6, '0')} 45% 80%,#${s.accent.toString(16).padStart(6, '0')} 80%)`);
  }
  function gunsList() {
    return WEAPONS.filter(w => weaponOwned(w.id) || (w.event && halloweenActive()) || (!w.event)).map(w => {
      const owned = weaponOwned(w.id), hw = Object.keys(SKINS).filter(k => SKINS[k].only === w.id && SKINS[k].event).length;
      return `<button class="witem${sel === w.id ? ' on' : ''}" data-g="${w.id}"><b>${escapeHtml(w.name)}</b><small>${escapeHtml(SKINS[weaponSkin(w.id)].name)}</small><span class="tag ${owned ? '' : 'lk'}">${owned ? (hw ? `+${hw} event` : 'Owned') : w.event ? 'Event' : 'Locked'}</span></button>`;
    }).join('');
  }
  function skinRows() {
    const id = sel, keys = Object.keys(SKINS).filter(k => skinFits(k, id) && (!SKINS[k].event || halloweenActive() || skinOwned(k)));
    // Halloween skins first, then the gun's own finish, then the standard collection
    keys.sort((a, b) => (SKINS[b].event ? 2 : SKINS[b].only ? 1 : 0) - (SKINS[a].event ? 2 : SKINS[a].only ? 1 : 0));
    const ownedGun = weaponOwned(id);
    return keys.map(k => {
      const s = SKINS[k], has = skinOwned(k), on = weaponSkin(id) === k;
      let act = '';
      if (has && ownedGun) act = on ? '<span class="note">Equipped</span>' : `<button class="btn sm primary" data-equip="${k}">Equip</button>`;
      else if (has) act = '<span class="note">Owned</span>';
      else if (s.candy) act = `<button class="btn sm${(profile.candy || 0) >= s.candy ? ' primary' : ''}" data-buy="${k}"><span class="candy"></span>${s.candy}</button>`;
      else act = `<span class="note">${escapeHtml(s.how)}</span>`;
      return `<div class="st-skin${on ? ' on' : ''}${preview === k ? ' sel' : ''}" data-prev="${k}"><i style="background:${swatch(k)};background-size:cover"></i><div><b>${escapeHtml(s.name)}</b><small class="${s.event ? 'hw' : ''}">${s.event ? 'Halloween · ' : ''}${s.pattern ? escapeHtml(s.pattern) + ' pattern' : s.glow ? 'glowing accents' : s.shiny ? 'polished' : 'standard finish'}</small></div><div class="price">${act}</div></div>`;
    }).join('');
  }
  function render() {
    E('stCoins').textContent = fmt(profile.coins); E('stCandy').textContent = fmt(profile.candy || 0);
    E('stCandy').parentElement.hidden = !halloweenActive() && !(profile.candy > 0);
    E('stGuns').innerHTML = gunsList();
    E('stSkins').innerHTML = skinRows();
    const w = WEAPON_BY_ID[sel], s = SKINS[preview || weaponSkin(sel)];
    E('stName').innerHTML = `${escapeHtml(w.name)}<small>${escapeHtml(s.name)}${weaponOwned(sel) ? '' : ' · weapon not owned yet'}</small>`;
  }
  function select(id) {
    sel = id; preview = weaponSkin(id);
    holder.clear(); const g = previewGun(id); configureGun(g, id, preview); holder.add(g.pivot);
    render();
  }
  function onSkinClick(e) {
    const t = e.target.closest('button'), row = e.target.closest('[data-prev]');
    if (t && t.dataset.buy) {
      const k = t.dataset.buy, s = SKINS[k];
      if (!spendCandy(s.candy)) { SFX.deny(); ui.toast('Not enough candy corn', `${fmt(s.candy - (profile.candy || 0))} more needed. Earn it in Night of Terror and Trick-or-Treat quests.`); return; }
      profile.skins[k] = true;
      if (weaponOwned(sel)) { profile.skin[sel] = k; refreshViewmodel(sel); }
      saveProfile(); SFX.buy(); ui.toast('Skin unlocked', `${s.name} for the ${WEAPON_BY_ID[sel].name}`, 'drop');
      preview = k; configureGun(previewGun(sel), sel, k); render(); return;
    }
    if (t && t.dataset.equip) { profile.skin[sel] = t.dataset.equip; saveProfile(); refreshViewmodel(sel); SFX.ui(); preview = t.dataset.equip; configureGun(previewGun(sel), sel, preview); render(); return; }
    if (row) { preview = row.dataset.prev; configureGun(previewGun(sel), sel, preview); SFX.ui(); render(); }
  }
  function frame(t) {
    if (ui.screens.studio.hidden) { raf = 0; return; }
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - (lastT || t)) / 1000); lastT = t;
    if (spin && !drag) yaw += dt * 0.6;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w && h && (canvas.width !== Math.round(w * r.getPixelRatio()) || canvas.height !== Math.round(h * r.getPixelRatio()))) { r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    cam.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist); cam.lookAt(0, 0, 0);
    if (preview) { const g = previews[sel]; if (g && g.coils) g.coils.forEach((c, i) => { c.rotation.z = t / 1000 * (3 + i); }); }
    r.render(scene, cam);
  }
  function open(from = 'menu', id) {
    init(); back = from;
    const pick = id || (WEAPON_BY_ID[sel] ? sel : profile.loadout.primary);
    ui.show('studio'); select(pick);
    if (!raf) { lastT = 0; raf = requestAnimationFrame(frame); }
  }
  function close() {
    SFX.ui(); ui.show(back);
    if (back === 'menu') ui.renderProfile(); else if (back === 'armory') ui.renderArmory();
  }
  return { open, get selected() { return sel; }, get previewSkin() { return preview; } };
})();
