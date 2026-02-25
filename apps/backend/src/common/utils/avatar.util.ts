export const AVATAR_STYLES = ['MINIMAL', 'PLANET', 'CYBER'] as const;
export type AvatarStyle = (typeof AVATAR_STYLES)[number];
export const AVATAR_POOL_MIN = 1;
export const AVATAR_POOL_MAX = 24;
export const DEFAULT_AVATAR_POOL_PER_STYLE = 8;
export const DEFAULT_MANAGED_AVATAR_COUNT = 1000;
export const MAX_MANAGED_AVATAR_COUNT = 5000;
let avatarPoolPerStyleOverride: number | null = null;
let managedDefaultAvatarPool: Array<{
  id: string;
  avatar: string;
  style: AvatarStyle;
  seed: string;
}> = [];
let managedDefaultAvatarUpdatedAt: string | null = null;

function parsePoolSize(rawValue: string | undefined, fallback: number) {
  const parsed = Number.parseInt(String(rawValue || ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(AVATAR_POOL_MAX, Math.max(AVATAR_POOL_MIN, parsed));
}

function resolveAvatarPoolPerStyle() {
  if (avatarPoolPerStyleOverride != null) return avatarPoolPerStyleOverride;
  return parsePoolSize(
    process.env.AVATAR_POOL_PER_STYLE,
    DEFAULT_AVATAR_POOL_PER_STYLE,
  );
}

export function getAvatarPoolConfig() {
  const rawValue = process.env.AVATAR_POOL_PER_STYLE;
  return {
    rawValue: rawValue ?? '',
    perStyle: resolveAvatarPoolPerStyle(),
    overridePerStyle: avatarPoolPerStyleOverride,
    source: avatarPoolPerStyleOverride != null ? 'runtime' : 'env',
    min: AVATAR_POOL_MIN,
    max: AVATAR_POOL_MAX,
    styles: [...AVATAR_STYLES],
  };
}

export function setAvatarPoolPerStyle(perStyle: number) {
  avatarPoolPerStyleOverride = parsePoolSize(
    String(perStyle),
    DEFAULT_AVATAR_POOL_PER_STYLE,
  );
  return getAvatarPoolConfig();
}

export function resetAvatarPoolPerStyle() {
  avatarPoolPerStyleOverride = null;
  return getAvatarPoolConfig();
}

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
  const perStyle = parsePoolSize(
    options?.perStyle != null ? String(options.perStyle) : undefined,
    resolveAvatarPoolPerStyle(),
  );
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

function clampManagedAvatarCount(input?: number) {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return DEFAULT_MANAGED_AVATAR_COUNT;
  return Math.min(MAX_MANAGED_AVATAR_COUNT, Math.max(1, Math.floor(parsed)));
}

export function generateManagedDefaultAvatarPool(count = DEFAULT_MANAGED_AVATAR_COUNT) {
  const targetCount = clampManagedAvatarCount(count);
  const baseSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const pool: Array<{
    id: string;
    avatar: string;
    style: AvatarStyle;
    seed: string;
  }> = [];

  for (let i = 0; i < targetCount; i++) {
    const style = AVATAR_STYLES[i % AVATAR_STYLES.length];
    const seed = `LS-${baseSeed}-${i + 1}-${Math.floor(Math.random() * 100000)}`;
    pool.push({
      id: `default-${i + 1}`,
      avatar: generateDefaultAvatar(seed, style),
      style,
      seed,
    });
  }

  managedDefaultAvatarPool = pool;
  managedDefaultAvatarUpdatedAt = new Date().toISOString();
  return getManagedDefaultAvatarPoolInfo();
}

function ensureManagedDefaultAvatarPool() {
  if (managedDefaultAvatarPool.length === 0) {
    generateManagedDefaultAvatarPool(DEFAULT_MANAGED_AVATAR_COUNT);
  }
}

export function getManagedDefaultAvatarPoolInfo() {
  ensureManagedDefaultAvatarPool();
  return {
    count: managedDefaultAvatarPool.length,
    updatedAt: managedDefaultAvatarUpdatedAt,
    defaultCount: DEFAULT_MANAGED_AVATAR_COUNT,
    maxCount: MAX_MANAGED_AVATAR_COUNT,
    styleCounts: AVATAR_STYLES.reduce(
      (acc, style) => {
        acc[style] = managedDefaultAvatarPool.filter((item) => item.style === style).length;
        return acc;
      },
      {} as Record<AvatarStyle, number>,
    ),
    preview: managedDefaultAvatarPool.slice(0, 20).map((item) => ({
      id: item.id,
      style: item.style,
      avatar: item.avatar,
    })),
  };
}

export function pickRandomManagedDefaultAvatar(options?: {
  styles?: AvatarStyle[];
  excludeAvatar?: string;
}) {
  ensureManagedDefaultAvatarPool();
  const styles = options?.styles?.length ? options.styles : undefined;
  const exclude = String(options?.excludeAvatar || '').trim();
  const filtered = managedDefaultAvatarPool.filter((item) => {
    if (styles && !styles.includes(item.style)) return false;
    if (exclude && item.avatar === exclude) return false;
    return true;
  });
  const pool = filtered.length > 0 ? filtered : managedDefaultAvatarPool;
  if (pool.length === 0) return null;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx].avatar;
}

// Warm up managed default avatar pool at startup.
ensureManagedDefaultAvatarPool();
