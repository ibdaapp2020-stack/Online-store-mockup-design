export function Icon({ path, label }: { path: string; label: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <title>{label}</title>
      <path fill="currentColor" d={path} />
    </svg>
  )
}

export const ICONS = {
  view: 'M12 5c5 0 9 5 10 7-1 2-5 7-10 7S3 14 2 12c1-2 5-7 10-7zm0 3a4 4 0 100 8 4 4 0 000-8z',
  edit: 'M4 17.2V20h2.8l8.2-8.2-2.8-2.8L4 17.2zM19.7 7.3a1 1 0 000-1.4l-1.6-1.6a1 1 0 00-1.4 0l-1.3 1.3 2.8 2.8 1.5-1.1z',
  copy: 'M8 7h10v12H8zM6 5h10v2H8v10H6z',
  trash: 'M9 4h6l1 2h4v2H4V6h4zm1 6h2v8h-2zm4 0h2v8h-2z',
  close: 'M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z',
}
