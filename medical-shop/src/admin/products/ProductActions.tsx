import type { Product } from '../../types'
import { ICONS, Icon } from './icons'

type Props = {
  product: Product
  onView: (product: Product) => void
  onEdit: (product: Product) => void
  onDuplicate: (product: Product) => void
  onDelete: (product: Product) => void
}

export function ProductActions({ product, onView, onEdit, onDuplicate, onDelete }: Props) {
  const actions = [
    { key: 'view', label: 'צפייה', path: ICONS.view, run: onView },
    { key: 'edit', label: 'עריכה', path: ICONS.edit, run: onEdit },
    { key: 'copy', label: 'שכפול', path: ICONS.copy, run: onDuplicate },
    { key: 'delete', label: 'מחיקה', path: ICONS.trash, run: onDelete, danger: true },
  ]
  return (
    <div className="row-actions">
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          className={action.danger ? 'icon-btn danger' : 'icon-btn'}
          title={action.label}
          aria-label={`${action.label} ${product.name}`}
          onClick={() => action.run(product)}
        >
          <Icon path={action.path} label={action.label} />
        </button>
      ))}
    </div>
  )
}
