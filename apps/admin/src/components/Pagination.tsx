interface Props {
  page: number;
  totalPages: number;
  total: number;
  onChange: (p: number) => void;
}

export function Pagination({ page, totalPages, total, onChange }: Props) {
  if (totalPages <= 1) return null;

  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <nav className="pagination" aria-label="分页导航">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="上一页">‹</button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`e${i}`} className="info">...</span>
        ) : (
          <button key={p} className={p === page ? 'active' : ''} onClick={() => onChange(p)}
            aria-label={`第 ${p} 页`} aria-current={p === page ? 'page' : undefined}>
            {p}
          </button>
        )
      )}
      <button disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="下一页">›</button>
      <span className="info">共 {total} 条</span>
    </nav>
  );
}
