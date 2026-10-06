import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { productImage } from '../data'
import { money } from '../pricing'
import type { Product } from '../types'
import { optionStock } from '../types'
import { useStore } from '../store'
import { BadgeTag, Stars } from './ui'

function choicesOf(product: Product) {
  return {
    size: Boolean(product.choices?.size || product.sizes?.length),
    color: Boolean(product.choices?.color || product.colors?.length),
    other: Boolean(product.choices?.other),
    otherLabel: product.choices?.otherLabel || 'אחר',
    others: product.choices?.others ?? [],
  }
}

export function ProductCard({ product }: { product: Product }) {
  const { addToCart } = useStore()
  const choices = choicesOf(product)
  const needsChoice = choices.size || choices.color || choices.other
  const soldOut = product.stock <= 0
  const [open, setOpen] = useState(false)
  const [size, setSize] = useState('')
  const [color, setColor] = useState('')
  const [other, setOther] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function close() {
    setOpen(false)
    setError('')
  }

  function add() {
    if (soldOut) return
    if (!needsChoice) {
      addToCart(product.id)
      return
    }
    setSize('')
    setColor('')
    setOther('')
    setError('')
    setOpen(true)
  }

  function confirm() {
    if (choices.size && !size) {
      setError('יש לבחור מידה')
      return
    }
    if (choices.color && !color) {
      setError('יש לבחור צבע')
      return
    }
    if (choices.other && !other) {
      setError(`יש לבחור ${choices.otherLabel}`)
      return
    }
    const stock = optionStock(product, {
      size: choices.size ? size : undefined,
      color: choices.color ? color : undefined,
      other: choices.other ? other : undefined,
    })
    if (stock <= 0) {
      setError('האפשרות הזו אזלה')
      return
    }
    addToCart(product.id, 1, { size, color, other })
    close()
  }

  return (
    <article className="card">
      <Link to={`/p/${product.id}`} className="card-media">
        <BadgeTag badge={product.badge} />
        <img src={productImage(product)} alt="" />
      </Link>
      <div className="card-body">
        <Link to={`/p/${product.id}`} className="card-title">
          {product.name}
        </Link>
        <Stars rating={product.rating} />
        <div className="price-row">
          <span className={product.compareAt ? 'price-now discounted' : 'price-now'}>{money(product.price)}</span>
          {product.compareAt ? <span className="compare">{money(product.compareAt)}</span> : null}
        </div>
        <button type="button" className="btn full" disabled={soldOut} onClick={add}>
          {soldOut ? 'אזל במלאי הדמו' : 'הוספה לסל'}
        </button>
      </div>
      {open
        ? createPortal(
            <div className="choice-dialog" role="dialog" aria-modal="true" aria-label="בחירת אפשרות">
              <button type="button" className="choice-backdrop" aria-label="סגירה" onClick={close} />
              <div className="choice-sheet">
                <div className="choice-sheet-head">
                  <strong>{product.name}</strong>
                  <button type="button" className="text-btn" onClick={close}>
                    סגירה
                  </button>
                </div>
                {choices.size ? (
                  <div>
                    <strong>מידה</strong>
                    <div className="choice-row">
                      {(product.sizes ?? []).map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={size === option ? 'choice on' : 'choice'}
                          disabled={optionStock(product, { size: option }) <= 0}
                          onClick={() => setSize(option)}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {choices.color ? (
                  <div>
                    <strong>צבע</strong>
                    <div className="choice-row">
                      {(product.colors ?? []).map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={color === option ? 'choice on' : 'choice'}
                          disabled={optionStock(product, { size: choices.size ? size : undefined, color: option }) <= 0}
                          onClick={() => setColor(option)}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {choices.other ? (
                  <div>
                    <strong>{choices.otherLabel}</strong>
                    <div className="choice-row">
                      {choices.others.map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={other === option ? 'choice on' : 'choice'}
                          disabled={
                            optionStock(product, {
                              size: choices.size ? size : undefined,
                              color: choices.color ? color : undefined,
                              other: option,
                            }) <= 0
                          }
                          onClick={() => setOther(option)}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {error ? <p className="form-errors">{error}</p> : null}
                <button type="button" className="btn full" onClick={confirm}>
                  הוספה לסל
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </article>
  )
}
