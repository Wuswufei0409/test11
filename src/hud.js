// HUD: crosshair, hotbar, hearts/food/armor bars, coords, FPS, seed, and block highlight label.

export function buildHUD() {
  const root = document.createElement('div');
  root.id = 'hud';
  root.innerHTML = `
    <div id="crosshair"><div class="ch"></div></div>
    <div id="hotbar"></div>
    <div id="stats">
      <div id="hearts" class="bar-row"></div>
      <div id="food" class="bar-row"></div>
      <div id="armor" class="bar-row"></div>
      <div id="oxygen" class="bar-row"></div>
    </div>
    <div id="coords"></div>
    <div id="fps"></div>
    <div id="seedbox"></div>
    <div id="block-label"></div>
    <div id="help"></div>
    <div id="mining-bar"></div>
    <div id="inventory-panel" style="display:none"></div>
  `;
  document.body.appendChild(root);

  const hotbarEl = root.querySelector('#hotbar');
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'slot' + (i === 0 ? ' selected' : '');
    cell.dataset.i = i;
    cell.innerHTML = '<span class="icon"></span><span class="count"></span><span class="num">' + (i + 1) + '</span>';
    hotbarEl.appendChild(cell);
  }
  const hearts = root.querySelector('#hearts');
  for (let i = 0; i < 10; i++) hearts.innerHTML += '<span class="cell"></span>';
  const food = root.querySelector('#food');
  for (let i = 0; i < 10; i++) food.innerHTML += '<span class="cell"></span>';
  const armor = root.querySelector('#armor');
  for (let i = 0; i < 4; i++) armor.innerHTML += '<span class="cell"></span>';
  const oxygen = root.querySelector('#oxygen');
  for (let i = 0; i < 10; i++) oxygen.innerHTML += '<span class="cell"></span>';

  return {
    root,
    selectSlot(i) {
      hotbarEl.querySelectorAll('.slot').forEach((s) => s.classList.toggle('selected', +s.dataset.i === i));
    },
    setHotbar(stacks, sel) {
      const slots = hotbarEl.querySelectorAll('.slot');
      slots.forEach((s, i) => {
        const icon = s.querySelector('.icon');
        const count = s.querySelector('.count');
        const st = stacks[i];
        const idv = st ? (st.id !== undefined ? st.id : st.item) : 0;
        const cnt = st ? (st.count || 0) : 0;
        const has = idv !== 0 && cnt > 0;
        icon.style.background = has ? (st.color || '#fff') : 'transparent';
        icon.classList.toggle('has', has);
        count.textContent = has ? (cnt > 1 ? cnt : '') : '';
        s.classList.toggle('selected', i === sel);
      });
    },
    setHearts(v) { this.setBar('#hearts', v, 10); },
    setFood(v) { this.setBar('#food', v, 10); },
    setArmor(v) { this.setBar('#armor', v, 4); },
    setOxygen(v) { this.setBar('#oxygen', v, 10); },
    oxygenVisible(show) { root.querySelector('#oxygen').style.display = show ? 'flex' : 'none'; },
    setBar(sel, val, max) {
      const cells = root.querySelector(sel).querySelectorAll('.cell');
      const filled = Math.round(val / 20 * max);
      cells.forEach((c, i) => c.classList.toggle('full', i < filled));
    },
    setArmorBar(v) { this.setBar('#armor', Math.min(20, v), 4); },
    setInfo(html) { root.querySelector('#seedbox').textContent = html || ''; },
    message(text) {
      let el = root.querySelector('#game-msg');
      if (!el) {
        el = document.createElement('div');
        el.id = 'game-msg';
        root.appendChild(el);
      }
      el.textContent = text;
      el.classList.remove('show');
      void el.offsetWidth; // restart animation
      el.classList.add('show');
    },
    setCoords(p) { root.querySelector('#coords').textContent = `XYZ ${Math.floor(p.x)} / ${Math.floor(p.y)} / ${Math.floor(p.z)}`; },
    setFps(f) { root.querySelector('#fps').textContent = f + ' FPS'; },
    setSeed(s) { root.querySelector('#seedbox').textContent = 'Seed ' + s; },
    setBlock(label) { root.querySelector('#block-label').textContent = label; },
    setMining(frac, active) {
      const bar = root.querySelector('#mining-bar');
      if (!active) { bar.style.display = 'none'; bar.textContent = ''; return; }
      bar.style.display = 'block';
      const pct = Math.round(frac * 100);
      bar.textContent = 'Mining ' + Math.min(100, pct) + '%';
      bar.style.width = (28 + frac * 100) + 'px';
    },
    // Inventory panel binding (population done by game layer)
    invPanel() { return root.querySelector('#inventory-panel'); },
  };
}

// CSS for the HUD (Bedrock-inspired layout, original styling)
export const HUD_CSS = `
#hud{position:fixed;inset:0;pointer-events:none;z-index:10;font-family:ui-sans-serif,system-ui,Arial;color:#fff;text-shadow:1px 1px 2px #000}
#crosshair{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)}
.ch{width:22px;height:22px;position:relative}
.ch::before,.ch::after{content:'';position:absolute;background:#fff;box-shadow:0 0 2px #000}
.ch::before{left:10px;top:0;width:2px;height:22px}
.ch::after{top:10px;left:0;height:2px;width:22px}
#hotbar{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);display:flex;gap:4px;background:rgba(20,20,20,0.72);border:2px solid rgba(255,255,255,0.6);padding:4px;border-radius:4px}
.slot{width:46px;height:46px;border:2px solid rgba(255,255,255,0.35);position:relative;background:rgba(0,0,0,0.25)}
.slot.selected{border-color:#fff}
.slot .icon{position:absolute;inset:6px;image-rendering:pixelated}
.slot .icon.has{border:2px solid rgba(255,255,255,0.3)}
.slot .num{position:absolute;top:-2px;left:2px;font-size:10px}
.slot .count{position:absolute;right:2px;bottom:0;font-weight:bold}
#stats{position:absolute;left:12px;bottom:12px;background:rgba(20,20,20,0.72);border:2px solid rgba(255,255,255,0.6);padding:6px;border-radius:4px}
.bar-row{display:flex;gap:2px;height:22px}
.bar-row .cell{width:11px;height:22px;background:rgba(255,255,255,0.12);border-radius:2px}
#hearts .cell.full{background:#e33}
#food .cell.full{background:#c78c3f}
#armor .cell.full{background:#b5c2cf}
#oxygen .cell.full{background:#4aa3df}
#oxygen{display:none}
#coords{position:absolute;right:12px;top:8px;font-size:14px;background:rgba(0,0,0,0.4);padding:4px 8px;border-radius:4px}
#fps{position:absolute;left:12px;top:8px;font-size:14px;background:rgba(0,0,0,0.4);padding:4px 8px;border-radius:4px}
#seedbox{position:absolute;left:12px;top:36px;font-size:12px;background:rgba(0,0,0,0.4);padding:4px 8px;border-radius:4px}
#block-label{position:absolute;top:40%;left:50%;transform:translateX(-50%);font-size:16px;background:rgba(0,0,0,0.45);padding:2px 10px;border-radius:4px}
#mining-bar{position:absolute;top:58%;left:50%;transform:translateX(-50%);height:6px;background:#fff;border:1px solid #000;border-radius:3px;display:none}
#inventory-panel{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(24,26,32,0.96);border:2px solid rgba(255,255,255,0.5);padding:12px;border-radius:6px;z-index:30;pointer-events:auto}
#inventory-panel .row{display:flex;gap:4px;margin-bottom:4px}
#inventory-panel .inv-slot{width:44px;height:44px;border:2px solid rgba(255,255,255,0.35);background:rgba(0,0,0,0.28);position:relative}
#inventory-panel .inv-slot.has{border-color:rgba(255,255,255,0.7)}
#inventory-panel .inv-slot .ic{position:absolute;inset:4px}
#inventory-panel .inv-slot .ct{position:absolute;right:3px;bottom:0;font-size:12px;font-weight:bold}
#inventory-panel .inv-slot .idx{position:absolute;left:2px;top:0;font-size:9px;opacity:0.6}
#inventory-panel .inv-title{font-size:14px;margin-bottom:6px;color:#ffd24a}
#help{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);bottom:74px;font-size:12px;background:rgba(0,0,0,0.5);padding:4px 10px;border-radius:4px;display:none}
#game-msg{position:absolute;top:12%;left:50%;transform:translateX(-50%);font-size:15px;background:rgba(0,0,0,0.55);padding:5px 12px;border-radius:4px;opacity:0;transition:opacity .3s}
#game-msg.show{opacity:1}
#daynightbar{position:absolute;top:8px;left:50%;transform:translateX(-50%);width:120px;height:10px;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.4);border-radius:5px}
#daynightbar .dot{position:absolute;top:-3px;width:14px;height:14px;border-radius:50%;background:#ffd24a;transform:translateX(-50%)}
#daynightbar .phase{position:absolute;top:-14px;left:50%;transform:translateX(-50%);font-size:11px}
#menu-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:20;display:flex;align-items:center;justify-content:center;color:#fff;font-family:ui-sans-serif,system-ui;text-align:center;cursor:pointer}
#menu-overlay .inner{background:rgba(30,30,40,0.92);padding:30px 40px;border-radius:8px;border:2px solid rgba(255,255,255,0.3)}
#menu-overlay h1{font-size:22px;margin:0 0 6px}
#menu-overlay p{color:#ccc;margin:4px 0}
`;
