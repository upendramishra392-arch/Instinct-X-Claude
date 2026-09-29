// The "design" every blend demo sits on: an original vintage fruit-crate label drawn with
// canvas paths (sunburst, giant orange, orchard landscape, ribbon, arched slab lettering).
(function () {
  const BM = window.BM;
  const W = BM.W, H = BM.H;
  BM.art = {};

  // Where the demos push in (label coordinates).
  BM.art.GRAIN_SPOT = [600, 760]; // dark grain cluster planted in the crumple texture (on the orange)
  BM.art.SCRATCH_SPOT = [150, 760]; // bright scratch cluster planted in the grunge texture (navy sky)

  const C = {
    navy: '#1a3462', navy2: '#142a50', ray: 'rgba(255,226,160,0.075)',
    sun: '#f2b23c', sunRing: '#efd8a6', cream: '#f3e4bf', red: '#c7402c', redDark: '#8c2a1d',
    orange: '#ef7a1f', orangeLight: '#ffb04a', orangeDark: '#b94e14', ink: '#1a1410',
    leaf: '#2f7a3a', leafLight: '#46984a', leafVein: '#1c5126',
    hillFar: '#76a04f', hillMid: '#55893f', ground: '#3d6d34', tree: '#2b5a2d', treeHi: '#3f7c3c', road: '#e8d3a0',
  };

  function leaf(g, x, y, len, wid, ang) {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    const shape = () => {
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(len * 0.45, -wid, len, 0);
      g.quadraticCurveTo(len * 0.45, wid, 0, 0);
      g.closePath();
    };
    shape();
    g.fillStyle = C.leaf;
    g.fill();
    g.save();
    shape();
    g.clip();
    g.fillStyle = C.leafLight;
    g.fillRect(0, -wid, len, wid);
    g.restore();
    shape();
    g.lineWidth = 6;
    g.strokeStyle = C.ink;
    g.stroke();
    g.beginPath();
    g.moveTo(8, 0);
    g.quadraticCurveTo(len * 0.5, -4, len - 12, 0);
    g.lineWidth = 4;
    g.strokeStyle = C.leafVein;
    g.stroke();
    for (let i = 1; i < 5; i++) {
      const px = (len * i) / 5.5;
      g.beginPath();
      g.moveTo(px, -2);
      g.lineTo(px + len * 0.08, -wid * 0.45);
      g.moveTo(px, 2);
      g.lineTo(px + len * 0.08, wid * 0.45);
      g.lineWidth = 2.5;
      g.stroke();
    }
    g.restore();
  }

  function tree(g, x, y, s, rng) {
    g.fillStyle = '#5a3a22';
    g.fillRect(x - s * 0.12, y, s * 0.24, s * 0.7);
    g.beginPath();
    g.arc(x, y, s, 0, Math.PI * 2);
    g.fillStyle = C.tree;
    g.fill();
    g.beginPath();
    g.arc(x - s * 0.28, y - s * 0.3, s * 0.58, 0, Math.PI * 2);
    g.fillStyle = C.treeHi;
    g.fill();
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(x + (rng() - 0.5) * s * 1.2, y + (rng() - 0.4) * s * 1.1, s * 0.17, 0, Math.PI * 2);
      g.fillStyle = C.orange;
      g.fill();
    }
  }

  function hills(g, y0, amp, freq, phase, color, seed) {
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 10) {
      const y = y0 - Math.sin(x * freq + phase) * amp - Math.sin(x * freq * 2.3 + seed) * amp * 0.35;
      g.lineTo(x, y);
    }
    g.lineTo(W, H);
    g.closePath();
    g.fillStyle = color;
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(20,30,15,0.5)';
    g.stroke();
  }

  function archText(g, text, cx, cy, r, font, spacing) {
    g.font = font;
    const widths = [...text].map((ch) => g.measureText(ch).width + spacing);
    const total = widths.reduce((a, b) => a + b, 0) - spacing;
    let a = -Math.PI / 2 - total / r / 2;
    const glyphs = [];
    [...text].forEach((ch, i) => {
      const w = widths[i] - spacing;
      const mid = a + w / 2 / r;
      glyphs.push([ch, mid]);
      a += widths[i] / r;
    });
    const pass = (fn) =>
      glyphs.forEach(([ch, ang]) => {
        g.save();
        g.translate(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
        g.rotate(ang + Math.PI / 2);
        fn(ch);
        g.restore();
      });
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.lineJoin = 'round';
    pass((ch) => {
      g.lineWidth = 16;
      g.strokeStyle = C.ink;
      g.strokeText(ch, 7, 7);
      g.fillStyle = C.ink;
      g.fillText(ch, 7, 7);
    });
    pass((ch) => {
      g.fillStyle = C.red;
      g.fillText(ch, 5, 5);
    });
    pass((ch) => {
      g.lineWidth = 7;
      g.strokeStyle = C.ink;
      g.strokeText(ch, 0, 0);
      g.fillStyle = C.cream;
      g.fillText(ch, 0, 0);
    });
  }

  BM.art.build = function () {
    const c = BM.canvas(W, H);
    const g = c.getContext('2d');
    const rng = BM.rng(2024);

    // Sky + sunburst
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, C.navy);
    bg.addColorStop(1, C.navy2);
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    const SX = 540, SY = 900;
    for (let i = 0; i < 32; i += 2) {
      const a0 = (i / 32) * Math.PI * 2, a1 = ((i + 1) / 32) * Math.PI * 2;
      g.beginPath();
      g.moveTo(SX, SY);
      g.arc(SX, SY, 2000, a0, a1);
      g.closePath();
      g.fillStyle = C.ray;
      g.fill();
    }
    // Stars
    for (let i = 0; i < 40; i++) {
      const x = rng() * W, y = 330 + rng() * 700;
      if (Math.hypot(x - SX, y - SY) < 430) continue;
      g.fillStyle = 'rgba(243,228,191,0.55)';
      g.beginPath();
      g.arc(x, y, 1.5 + rng() * 2.5, 0, Math.PI * 2);
      g.fill();
    }
    // Sun
    g.beginPath();
    g.arc(SX, SY, 400, 0, Math.PI * 2);
    g.fillStyle = C.sunRing;
    g.fill();
    g.beginPath();
    g.arc(SX, SY, 376, 0, Math.PI * 2);
    const sg = g.createRadialGradient(SX, SY - 60, 60, SX, SY, 380);
    sg.addColorStop(0, '#f8cf63');
    sg.addColorStop(1, C.sun);
    g.fillStyle = sg;
    g.fill();

    // Landscape
    hills(g, 1150, 26, 0.006, 0.8, C.hillFar, 1.3);
    for (let x = 30; x < W; x += 58) tree(g, x + (rng() - 0.5) * 16, 1150 - Math.sin(x * 0.006 + 0.8) * 26 + 18, 16, rng);
    hills(g, 1250, 34, 0.0045, 2.2, C.hillMid, 0.4);
    for (let x = 10; x < W; x += 74) tree(g, x + (rng() - 0.5) * 20, 1250 - Math.sin(x * 0.0045 + 2.2) * 34 + 26, 23, rng);
    hills(g, 1400, 22, 0.004, 4.1, C.ground, 2.0);
    // Road
    g.beginPath();
    g.moveTo(330, H);
    g.bezierCurveTo(420, 1650, 700, 1500, 560, 1300);
    g.lineTo(592, 1300);
    g.bezierCurveTo(790, 1500, 620, 1690, 760, H);
    g.closePath();
    g.fillStyle = C.road;
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = 'rgba(80,60,30,0.55)';
    g.stroke();
    for (let i = 0; i < 9; i++) {
      const y = 1440 + i * 58;
      tree(g, 110 + (i % 2) * 60, y, 28 + i * 2, rng);
      tree(g, 960 - (i % 2) * 60, y + 20, 28 + i * 2, rng);
    }

    // The giant orange
    const OX = 540, OY = 900, OR = 322;
    g.save();
    g.beginPath();
    g.ellipse(OX + 30, OY + OR - 8, OR * 0.9, 46, 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(15,30,10,0.45)';
    g.fill();
    g.restore();
    g.save();
    g.beginPath();
    g.arc(OX, OY, OR, 0, Math.PI * 2);
    const og = g.createRadialGradient(OX - 110, OY - 120, 30, OX, OY, OR);
    og.addColorStop(0, C.orangeLight);
    og.addColorStop(0.55, C.orange);
    og.addColorStop(1, C.orangeDark);
    g.fillStyle = og;
    g.fill();
    g.clip();
    for (let i = 0; i < 1700; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * OR;
      g.beginPath();
      g.arc(OX + Math.cos(a) * r, OY + Math.sin(a) * r, 2 + rng() * 3.5, 0, Math.PI * 2);
      g.fillStyle = rng() > 0.5 ? 'rgba(150,55,10,0.2)' : 'rgba(255,215,150,0.2)';
      g.fill();
    }
    g.beginPath();
    g.ellipse(OX - 120, OY - 140, 90, 54, -0.7, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,245,220,0.35)';
    g.fill();
    g.restore();
    g.beginPath();
    g.arc(OX, OY, OR, 0, Math.PI * 2);
    g.lineWidth = 8;
    g.strokeStyle = C.ink;
    g.stroke();
    // Stem + leaves
    g.beginPath();
    g.moveTo(OX + 6, OY - OR + 10);
    g.quadraticCurveTo(OX + 16, OY - OR - 40, OX + 4, OY - OR - 64);
    g.lineWidth = 16;
    g.strokeStyle = '#4b3016';
    g.stroke();
    g.lineWidth = 5;
    g.strokeStyle = C.ink;
    g.stroke();
    leaf(g, OX + 8, OY - OR - 40, 230, 70, -0.42);
    leaf(g, OX, OY - OR - 30, 190, 58, Math.PI + 0.55);
    g.beginPath();
    g.arc(OX + 4, OY - OR + 8, 14, 0, Math.PI * 2);
    g.fillStyle = '#6a8a2a';
    g.fill();

    // Orange slice in front
    const LX = 842, LY = 1238, LR = 148;
    g.beginPath();
    g.arc(LX, LY, LR, 0, Math.PI * 2);
    g.fillStyle = C.orange;
    g.fill();
    g.lineWidth = 7;
    g.strokeStyle = C.ink;
    g.stroke();
    g.beginPath();
    g.arc(LX, LY, LR * 0.86, 0, Math.PI * 2);
    g.fillStyle = '#fbe8c6';
    g.fill();
    for (let i = 0; i < 11; i++) {
      const a0 = (i / 11) * Math.PI * 2 + 0.06, a1 = ((i + 1) / 11) * Math.PI * 2 - 0.06;
      g.beginPath();
      g.moveTo(LX + Math.cos((a0 + a1) / 2) * 12, LY + Math.sin((a0 + a1) / 2) * 12);
      g.arc(LX, LY, LR * 0.78, a0, a1);
      g.closePath();
      const fg = g.createRadialGradient(LX, LY, 10, LX, LY, LR * 0.8);
      fg.addColorStop(0, '#ffd27a');
      fg.addColorStop(1, '#f7a23a');
      g.fillStyle = fg;
      g.fill();
    }
    for (let i = 0; i < 18; i++) {
      const a = rng() * Math.PI * 2, r = 30 + rng() * 70;
      g.beginPath();
      g.ellipse(LX + Math.cos(a) * r, LY + Math.sin(a) * r, 6, 3, a, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.fill();
    }

    // Arched brand name + top line
    g.font = "700 46px 'Barlow Condensed'";
    g.letterSpacing = '10px';
    g.textAlign = 'center';
    g.fillStyle = C.cream;
    g.fillText('★  FANCY GRADE  ★', W / 2, 168);
    g.letterSpacing = '0px';
    archText(g, 'GOLDEN HOUR', 540, 1290, 1010, "400 132px 'Alfa Slab One'", 6);

    // Ribbon
    const RY = 1668, RW = 900, RH = 128;
    const tail = (dir) => {
      const x0 = W / 2 + (dir * RW) / 2;
      g.beginPath();
      g.moveTo(x0 - dir * 40, RY - RH / 2 + 30);
      g.lineTo(x0 + dir * 70, RY - RH / 2 + 30);
      g.lineTo(x0 + dir * 30, RY + 16);
      g.lineTo(x0 + dir * 70, RY + RH / 2 + 30);
      g.lineTo(x0 - dir * 40, RY + RH / 2 + 30);
      g.closePath();
      g.fillStyle = C.redDark;
      g.fill();
      g.lineWidth = 6;
      g.strokeStyle = C.ink;
      g.stroke();
    };
    tail(-1);
    tail(1);
    g.beginPath();
    g.rect(W / 2 - RW / 2, RY - RH / 2, RW, RH);
    g.fillStyle = C.red;
    g.fill();
    g.lineWidth = 7;
    g.strokeStyle = C.ink;
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(W / 2 - RW / 2 + 4, RY - RH / 2 + 4, RW - 8, 16);
    g.font = "400 80px 'Alfa Slab One'";
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 8;
    g.strokeStyle = C.ink;
    g.strokeText('SUNNY HOLLOW', W / 2, RY + 6);
    g.fillStyle = C.cream;
    g.fillText('SUNNY HOLLOW', W / 2, RY + 6);
    g.font = "600 40px 'Barlow Condensed'";
    g.letterSpacing = '7px';
    g.fillStyle = C.cream;
    g.fillText('VALLEY GROWERS  ·  EST. 1926', W / 2, 1800);
    g.letterSpacing = '0px';

    // Frame
    g.lineWidth = 14;
    g.strokeStyle = C.cream;
    g.strokeRect(40, 40, W - 80, H - 80);
    g.lineWidth = 3;
    g.strokeRect(64, 64, W - 128, H - 128);
    [[64, 64], [W - 64, 64], [64, H - 64], [W - 64, H - 64]].forEach(([x, y]) => {
      g.save();
      g.translate(x, y);
      g.rotate(Math.PI / 4);
      g.fillStyle = C.cream;
      g.fillRect(-14, -14, 28, 28);
      g.restore();
    });

    BM.art.label = c;
    return c;
  };
})();
