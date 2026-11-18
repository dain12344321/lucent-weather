(function (root) {
  const Solar = typeof module === 'undefined' ? root.Solar : require('./solar');
  const gold = 'var(--lucent-sun, #ffdc94)';
  const ice = 'var(--lucent-ice, #d1f2ff)';
  const lavender = 'var(--lucent-moon, #e4e5ff)';
  const cloudDay = 'var(--lucent-cloud, #e4edf7)';
  const cloudNight = 'var(--lucent-cloud, #bfcde3)';
  const rain = 'var(--lucent-rain, #82d6ff)';

  const cloud = 'M6.7 17.8a4 4 0 0 1-.7-7.9A6.1 6.1 0 0 1 17.5 8a5 5 0 1 1 2.7 9.8Z';
  const middleCloud = 'M7.4 22.8a3.8 3.8 0 0 1-.2-7.5 5.6 5.6 0 0 1 10.2-2.1 4.8 4.8 0 1 1 2.8 9.6Z';
  const bolt = 'M15 13.3 10.9 20h3.7l-1 6 6.1-8h-4l2.8-4.7Z';

  function stroke(d, color, width = 1.7) {
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  function fill(d, color) {
    return `<path d="${d}" fill="${color}"/>`;
  }

  function circle(x, y, r, color) {
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;
  }

  function sun() {
    return circle(14, 14, 5.5, gold) + stroke(
      'M14 2v3m0 18v3M2 14h3m18 0h3M5.5 5.5l2.2 2.2m12.6 12.6 2.2 2.2M22.5 5.5l-2.2 2.2M7.7 20.3l-2.2 2.2', gold,
    );
  }

  function horizon(kind) {
    const up = kind === 'sunrise';
    const down = kind === 'sunset';
    const hideDirection = !up && !down;
    const color = down ? 'var(--lucent-sunset, #ffc28e)' : gold;
    return fill('M7.9 17.6a6.1 6.1 0 0 1 12.2 0Z', color)
      + stroke('M3.4 20.6h21.2M8.5 24h11', color, 1.55)
      + stroke('M5.9 11.6 4.5 10.2m17.6 1.4 1.4-1.4', color, 1.55)
      + (hideDirection ? stroke('M14 3v3', color) : stroke(
        up ? 'M14 8.1V2.9m-2.7 2.7L14 2.9l2.7 2.7' : 'M14 2.9v5.2m-2.7-2.7L14 8.1l2.7-2.7', color,
      ));
  }

  function night() {
    return fill('M19.8 4.5a9.9 9.9 0 1 0 3.9 14.1A8.1 8.1 0 0 1 19.8 4.5Z', lavender);
  }

  function fog(frozen) {
    const marks = stroke('M5 9h14M3.5 14h21M7 19h14', 'var(--lucent-cloud, #d6e5f3)', 1.9);
    return frozen ? marks + fill('M22.4 5.6 25 8.2l-2.6 2.6-2.6-2.6Z', ice) : marks;
  }

  function rainStrokes(intensity, showers) {
    const marks = {
      light: 'M11 20.9 9.6 24.4m7.7-3.5-1.4 3.5',
      moderate: 'M8.3 20.4 6.8 24.3m7.6-3.4-1.6 4m7.8-4.5-1.5 3.9',
      heavy: 'M8 20.1 6 25.3M12.3 20.7l-2 5.3M16.6 20.1l-2 5.2M20.9 20.7l-2 5.3',
    };
    const broken = {
      light: 'M10.5 20.5 10 21.7m-1.6 3.4-.3.8m10.1-5.4-.5 1.2m-1.6 3.4-.3.8',
      moderate: 'M9 20.1 8.5 21.4m-1.6 3.4-.3.8m8.7-5.1-.5 1.2m-1.6 3.4-.3.8m8.7-5.8-.5 1.3m-1.6 3.4-.3.8',
      heavy: 'M8.5 20l-.6 1.4M6.4 24.8l-.4.9M12.8 20.5l-.6 1.4M10.7 25.3l-.4.9M17.1 20l-.6 1.4M15 24.8l-.4.9M21.4 20.5l-.6 1.4M19.3 25.3l-.4.9',
    };
    return stroke((showers ? broken : marks)[intensity], rain, 1.85);
  }

  function drizzle(intensity) {
    const dots = [[10.5, 20.6], [17.7, 20.6], [12.4, 24.4], [19.5, 24.4], [8, 24.4]];
    const count = { light: 2, moderate: 4, heavy: 5 }[intensity];
    return dots.slice(0, count).map(([x, y]) => circle(x, y, 1.12, rain)).join('');
  }

  function freezing(intensity, isDrizzle) {
    const diamond = (x, y) => fill(`M${x} ${y - 2.4}l2.15 2.4-2.15 2.4-2.15-2.4Z`, ice);
    const heavy = intensity === 'heavy';
    return diamond(14, 22.8)
      + (heavy ? diamond(20.6, 22.8) : '')
      + (isDrizzle ? circle(7.6, 22.8, 1.15, rain) : stroke('M8.6 20.5 6.9 24.7', rain, 1.8))
      + (heavy || isDrizzle ? '' : stroke('M21.5 20.5 19.8 24.7', rain, 1.8));
  }

  function flake(x, y, size) {
    return `<g transform="translate(${x} ${y}) scale(${size})">${stroke('M0-3V3m-2.6-4.5 5.2 3m0-3-5.2 3', ice, 1.25)}</g>`;
  }

  function snow(intensity, grains, showers) {
    if (grains) return circle(8, 21.5, 1.1, ice) + circle(13.5, 24, 1.1, ice) + circle(19, 21.5, 1.1, ice);
    if (showers) return flake(9, 22.8, .9) + flake(19, 22.8, .9)
      + (intensity === 'heavy' ? flake(14, 24.4, .7) : '');
    return flake(14, 22.6, 1.13)
      + (intensity === 'heavy' ? flake(7.1, 22.6, .68) + flake(20.9, 22.6, .68)
        : intensity === 'moderate' ? circle(7.7, 22.6, 1.1, ice) + circle(20.3, 22.6, 1.1, ice) : '');
  }

  function mixed(period, mostlyClear) {
    const hint = period === 'night'
      ? `<g transform="translate(9 -1) scale(.67)">${night()}</g>`
      : period === 'day'
        ? `<g transform="translate(10 -1) scale(.62)">${sun()}</g>`
        : `<g transform="translate(10 -1) scale(.62)">${horizon(period)}</g>`;
    const foreground = fill(middleCloud, period === 'night' ? cloudNight : cloudDay);
    return hint + (mostlyClear ? `<g transform="translate(1 5.5) scale(.76)">${foreground}</g>` : foreground);
  }

  function weather(code, period = 'day') {
    const known = Object.hasOwn(Solar.labels, code);
    const numeric = known ? Number(code) : null;
    const scene = Solar.scene(numeric, period !== 'night');
    const { kind, frozen, hail, intensity } = scene;
    const cloudColor = period === 'night' ? cloudNight : cloudDay;
    if (!known) return stroke('M7 14h14', 'var(--lucent-cloud, #c5cfdf)', 2.1);
    if (numeric === 0) return period === 'day' ? sun() : period === 'night' ? night() : horizon(period);
    if (numeric === 1 || numeric === 2) return mixed(period, numeric === 1);
    if (kind === 'overcast') return fill('M11.1 14a4.7 4.7 0 0 1 3.5-7.8 5.1 5.1 0 0 1 9.1 2.5 3.8 3.8 0 0 1-.3 7.6H12.9Z', '#a4b5cf')
      + fill(middleCloud, cloudColor);
    if (kind === 'fog') return fog(frozen);
    const base = fill(cloud, kind === 'storm' ? 'var(--lucent-cloud, #adbed9)' : cloudColor);
    if (kind === 'storm') return base + fill(bolt, gold)
      + (hail ? circle(8, 21.2, 1.2, ice) + circle(21.6, 21.2, 1.2, ice)
        + (intensity === 'heavy' ? circle(7.2, 25, 1.15, ice) + circle(21.1, 25, 1.15, ice) : '') : '');
    if (frozen) return base + freezing(intensity, kind === 'drizzle');
    if (kind === 'drizzle') return base + drizzle(intensity);
    if (kind === 'rain') return base + rainStrokes(intensity, numeric >= 80);
    return base + snow(intensity, numeric === 77, numeric >= 85);
  }

  function moon(phase) {
    const x = 14, y = 14, r = 9.6;
    const edge = '#adb9d8';
    if (phase === null || phase === undefined) return '<circle cx="14" cy="14" r="9.6" fill="none" stroke="#aebbd0" stroke-width="1.2" stroke-dasharray="2 2.8"/>'
      + stroke('M11 14h6', '#cbd4e4');
    const p = ((phase % 1) + 1) % 1;
    const waxing = p < .5;
    const crescent = p < .25 || p > .75;
    const rx = (Math.abs(Math.cos(p * Math.PI * 2)) * r).toFixed(4);
    const start = `M14 ${y - r}A${r} ${r} 0 0 ${Number(waxing)} 14 ${y + r}`;
    const finish = Number(rx) < .001 ? 'L14 4.4Z' : `A${rx} ${r} 0 0 ${Number(waxing !== crescent)} 14 ${y - r}Z`;
    const lit = p < .008 || p > .992 ? '' : fill(start + finish, lavender);
    const shading = p > .34 && p < .66
      ? circle(12, 11, 1.4, '#bec3e2') + circle(16.5, 15.7, 1.8, '#bec3e2') + circle(11.9, 18, .95, '#ccd1ed') : '';
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#293a5a" stroke="${edge}" stroke-width="1.05"/>${lit}${shading}`;
  }

  function solar(state) {
    switch (state) {
      case 'sunrise':
      case 'sunset': return horizon(state);
      case 'noon': return sun() + stroke('M11 26h6', gold, 1.3);
      case 'day': return sun();
      case 'night': return night();
      case 'continuousDay': return circle(14, 14, 6, gold) + `<circle cx="14" cy="14" r="10" fill="none" stroke="${gold}" stroke-width="1.5"/>`;
      case 'continuousNight': return `<g transform="translate(4 4) scale(.72)">${night()}</g><circle cx="14" cy="14" r="10" fill="none" stroke="${lavender}" stroke-width="1.5"/>`;
      default: return stroke('M7 14h14', '#aebbd0', 1.8);
    }
  }

  function graphic(markup, className = 'glyph') {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 28 28');
    icon.setAttribute('class', className);
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = markup;
    return icon;
  }

  const api = { weather, solar, moon, graphic };
  if (typeof module !== 'undefined') module.exports = api;
  else root.WeatherIcons = api;
})(globalThis);
