import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { productImage } from '../data'
import { ProductCard } from '../components/ProductCard'
import { EmptyState, QtyControl, Stars, useTitle } from '../components/ui'
import { money } from '../pricing'
import { useStore } from '../store'
import { optionStock } from '../types'

export function ProductPage() {
  const { id = '' } = useParams()
  const { addToCart, products, categories, ready } = useStore()
  const product = products.find((item) => item.id === id)
  useTitle(product?.name ?? 'מוצר')
  const [qty, setQty] = useState(1)
  const [size, setSize] = useState('')
  const [color, setColor] = useState('')
  const [other, setOther] = useState('')
  const [choiceError, setChoiceError] = useState('')

  useEffect(() => {
    setQty(1)
    setSize('')
    setColor('')
    setOther('')
    setChoiceError('')
  }, [id])

  if (!ready) return null
  if (!product) {
    return <EmptyState title="המוצר לא נמצא" text="הפריט אינו בקטלוג." action={<Link className="btn" to="/catalog">חזרה לקטלוג</Link>} />
  }

  const category = categories.find((item) => item.id === product.category)
  const similar = products.filter((item) => item.category === product.category && item.id !== product.id).slice(0, 4)
  const choices = {
    size: Boolean(product.choices?.size || product.sizes?.length),
    color: Boolean(product.choices?.color || product.colors?.length),
    other: Boolean(product.choices?.other),
    otherLabel: product.choices?.otherLabel || 'אחר',
    others: product.choices?.others ?? [],
  }
  const selectedStock = optionStock(product, {
    size: choices.size ? size : undefined,
    color: choices.color ? color : undefined,
    other: choices.other ? other : undefined,
  })
  const soldOut = selectedStock <= 0
  const readyChoice = (!choices.size || size) && (!choices.color || color) && (!choices.other || other)

  return (
    <div>
      <p className="crumb">
        <Link to="/catalog">קטלוג</Link>
        {category ? <Link to={`/catalog?cat=${category.id}`}>{category.name}</Link> : null}
      </p>
      <div className="product-layout">
        <div className="gallery-main">
          <img src={productImage(product)} alt={product.name} />
        </div>
        <div className="product-copy">
          <h1>{product.name}</h1>
          <Stars rating={product.rating} reviews={product.reviews} />
          <p>{product.description}</p>
          <div className="price-row big">
            <span className={product.compareAt ? 'price-now discounted' : 'price-now'}>{money(product.price)}</span>
            {product.compareAt ? <span className="compare">{money(product.compareAt)}</span> : null}
          </div>
          <p className="stock">{soldOut ? 'האפשרות הזו אזלה' : readyChoice ? `נותרו ${selectedStock} מהבחירה הזו` : `במלאי ${product.stock}`}</p>
          {choices.size ? (
            <div>
              <strong>מידה אחת</strong>
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
              <strong>צבע אחד</strong>
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
                    disabled={optionStock(product, { size: choices.size ? size : undefined, color: choices.color ? color : undefined, other: option }) <= 0}
                    onClick={() => setOther(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <p className="muted">בוחרים אפשרות אחת בכל פריט. למידה או צבע נוספים מוסיפים את המוצר שוב לסל.</p>
          {soldOut || !readyChoice ? null : <QtyControl qty={qty} max={selectedStock} onChange={setQty} />}
          {choiceError ? <p className="form-errors">{choiceError}</p> : null}
          <button
            type="button"
            className="btn"
            disabled={soldOut}
            onClick={() => {
              if (choices.size && !size) {
                setChoiceError('יש לבחור מידה אחת')
                return
              }
              if (choices.color && !color) {
                setChoiceError('יש לבחור צבע אחד')
                return
              }
              if (choices.other && !other) {
                setChoiceError(`יש לבחור ${choices.otherLabel} אחד`)
                return
              }
              setChoiceError('')
              addToCart(product.id, qty, { size, color, other })
            }}
          >
            {soldOut ? 'אזל במלאי הדמו' : 'הוספה לסל'}
          </button>
          <h2>מפרט</h2>
          <ul className="specs">
            {product.specs.map((spec) => (
              <li key={spec}>{spec}</li>
            ))}
          </ul>
        </div>
      </div>
      {similar.length > 0 ? (
        <section>
          <div className="section-head">
            <h2>מוצרים דומים</h2>
          </div>
          <div className="product-grid">
            {similar.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
