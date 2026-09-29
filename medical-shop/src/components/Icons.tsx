export function CategoryIcon({ id }: { id: string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (id === 'first-aid') {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    )
  }
  if (id === 'monitors') {
    return (
      <svg {...common}>
        <path d="M4 14c2-5 4-5 6 0s4 5 6 0 4-5 4 0" />
        <path d="M5 18h14" />
      </svg>
    )
  }
  if (id === 'vitamins') {
    return (
      <svg {...common}>
        <rect x="8" y="3" width="8" height="18" rx="4" />
        <path d="M8 12h8" />
      </svg>
    )
  }
  if (id === 'hygiene') {
    return (
      <svg {...common}>
        <path d="M8 4h5l1 3H8z" />
        <path d="M9 7h7l-1 13H8L7 7" />
      </svg>
    )
  }
  if (id === 'ortho') {
    return (
      <svg {...common}>
        <path d="M8 5c2 2 2 4 0 6s-2 4 0 6" />
        <path d="M14 5c2 2 2 4 0 6s-2 4 0 6" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M4 10.5 12 5l8 5.5V19a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </svg>
  )
}
