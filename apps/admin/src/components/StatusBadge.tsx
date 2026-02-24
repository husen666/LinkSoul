const MAP: Record<string, { cls: string; label: string }> = {
  ACTIVE: { cls: 'badge-active', label: '正常' },
  BANNED: { cls: 'badge-banned', label: '封禁' },
  INACTIVE: { cls: 'badge-inactive', label: '未激活' },
  DEACTIVATED: { cls: 'badge-inactive', label: '已注销' },
  PENDING: { cls: 'badge-pending', label: '待处理' },
  ACCEPTED: { cls: 'badge-accepted', label: '已匹配' },
  REJECTED: { cls: 'badge-rejected', label: '已拒绝' },
  EXPIRED: { cls: 'badge-inactive', label: '已过期' },
  RESOLVED: { cls: 'badge-resolved', label: '已解决' },
  DISMISSED: { cls: 'badge-dismissed', label: '已驳回' },
  REVIEWED: { cls: 'badge-reviewed', label: '已审核' },
};

export function StatusBadge({ status }: { status: string }) {
  const s = MAP[status] || { cls: 'badge-inactive', label: status };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}
