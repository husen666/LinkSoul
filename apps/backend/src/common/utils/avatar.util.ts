export const AVATAR_STYLES = ['MINIMAL', 'PLANET', 'CYBER'] as const;
export type AvatarStyle = (typeof AVATAR_STYLES)[number];

function escapeSvgText(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stableHash(text: string) {
  return text.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

export function pickAvatarStyle(seed: string): AvatarStyle {
  const hash = stableHash(seed || 'linksoul');
  return AVATAR_STYLES[hash % AVATAR_STYLES.length];
}

export function generateDefaultAvatar(
  nickname: string,
  style: AvatarStyle = 'MINIMAL',
) {
  const colors = ['5B8CFF', '7C3AED', 'EC4899', '06B6D4', '34D399', 'F59E0B'];
  const hash = stableHash(nickname);
  const colorA = colors[hash % colors.length];
  const colorB = colors[(hash + 2) % colors.length];
  const text = escapeSvgText(nickname.slice(0, 1).toUpperCase() || 'L');
  let svg = '';
  if (style === 'PLANET') {
    svg = `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#${colorA}'/><stop offset='100%' stop-color='#${colorB}'/></linearGradient></defs><rect width='100%' height='100%' rx='64' fill='#0a0a14'/><circle cx='64' cy='64' r='30' fill='url(#g)'/><ellipse cx='64' cy='64' rx='50' ry='16' fill='none' stroke='#ffffff' stroke-opacity='0.45' stroke-width='2'/><circle cx='24' cy='28' r='2' fill='#ffffff' fill-opacity='0.7'/><circle cx='99' cy='34' r='1.6' fill='#ffffff' fill-opacity='0.6'/><text x='64' y='72' text-anchor='middle' font-size='30' fill='white' font-family='Arial, sans-serif' font-weight='700'>${text}</text></svg>`;
  } else if (style === 'CYBER') {
    svg = `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><defs><linearGradient id='g' x1='0' y1='1' x2='1' y2='0'><stop offset='0%' stop-color='#080B14'/><stop offset='100%' stop-color='#12162A'/></linearGradient></defs><rect width='100%' height='100%' rx='64' fill='url(#g)'/><path d='M20 38H108M20 64H108M20 90H108' stroke='#${colorA}' stroke-opacity='0.22' stroke-width='1'/><circle cx='64' cy='64' r='36' fill='none' stroke='#${colorA}' stroke-width='3'/><circle cx='64' cy='64' r='24' fill='none' stroke='#${colorB}' stroke-width='2' stroke-opacity='0.85'/><text x='64' y='76' text-anchor='middle' font-size='34' fill='#ffffff' font-family='Arial, sans-serif' font-weight='700'>${text}</text></svg>`;
  } else {
    svg = `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><rect width='100%' height='100%' rx='64' fill='#${colorA}'/><circle cx='98' cy='24' r='22' fill='#ffffff' fill-opacity='0.13'/><text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' font-size='56' fill='white' font-family='Arial, sans-serif'>${text}</text></svg>`;
  }
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function generateAvatarBatch(
  nickname: string,
  options?: {
    perStyle?: number;
    styles?: AvatarStyle[];
  },
) {
  const perStyle = Math.max(1, options?.perStyle ?? 4);
  const styles = options?.styles?.length
    ? options.styles
    : [...AVATAR_STYLES];
  const base = (nickname || 'LinkSoul').trim() || 'LinkSoul';
  const pool: string[] = [];

  for (const style of styles) {
    for (let i = 0; i < perStyle; i++) {
      // Salted seed keeps initials stable while increasing visual variety.
      pool.push(generateDefaultAvatar(`${base}#${style}-${i + 1}`, style));
    }
  }
  return pool;
}

export function pickRandomAvatarFromBatch(
  nickname: string,
  options?: {
    perStyle?: number;
    styles?: AvatarStyle[];
  },
) {
  const pool = generateAvatarBatch(nickname, options);
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}
