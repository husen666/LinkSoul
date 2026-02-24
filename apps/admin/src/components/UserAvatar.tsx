const COLORS = ['#6366F1', '#EC4899', '#8B5CF6', '#14B8A6', '#F59E0B', '#EF4444', '#3B82F6'];

function hashColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

interface Props {
  name: string;
  avatar?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

export function UserAvatar({ name, avatar, size = 'md' }: Props) {
  const cls = size === 'sm' ? 'avatar avatar-sm' : size === 'lg' ? 'avatar avatar-lg' : 'avatar';

  if (avatar) {
    const s = size === 'sm' ? 28 : size === 'lg' ? 48 : 36;
    return <img src={avatar} alt={name} style={{ width: s, height: s, borderRadius: '50%', objectFit: 'cover' }} />;
  }

  return (
    <div className={cls} style={{ background: hashColor(name), color: '#fff' }}>
      {(name || '?')[0]}
    </div>
  );
}
