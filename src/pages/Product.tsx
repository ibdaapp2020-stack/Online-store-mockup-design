import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ProductCard } from '../components/ProductCard'
import { ProductPhoto, Qty } from '../components/ui'
import { categoryName, productVisible, setupById, subName } from '../data'
import { money, progressFor, setupRateLabel, suggestForRole, unitFor, volumeTiers } from '../pricing'
import { useStore } from '../store'

export function ProductPage() {
  const { id = '' } = useParams()
  const { audience, products, cart, addToCart, pricesOpen } = useStore()
  const product = products.find((item) => item.id === id && item.active && productVisible(item, audience))
  const [qty, setQty] = useState(1)
  const [colorId, setColorId] = useState(product?.colors?.[0]?.id ?? '')
  const [storageId, setStorageId] = useState(product?.storages?.[0]?.id ?? '')
  const [photo, setPhoto] = useState(0)
  useEffect(() => {
    setQty(1)
    setColorId(product?.colors?.[0]?.id ?? '')
    setStorageId(product?.storages?.[0]?.id ?? '')
    setPhoto(0)
  }, [product?.id])
  if (!audience) return null
  if (!product) {
    return (
      <div className="wrap empty">
        <h1>המוצר לא נמצא</h1>
        <Link className="btn btn-primary" to="/c/all">
          חזרה לקטלוג
        </Link>
      </div>
    )
  }

  const colors = product.colors ?? []
  const storages = product.storages ?? []
  const color = colors.find((item) => item.id === colorId) ?? colors[0]
  const storage = storages.find((item) => item.id === storageId) ?? storages[0]
  const priceAdd = storage?.add ?? 0
  const priced = unitFor(product, audience, qty, priceAdd)
  const images = product.images ?? []
  const setup = setupById(product.setupId)
  const progress = progressFor(products, cart).find((item) => item.setup.id === product.setupId)
  const suggestions = setup
    ? setup.roles
        .filter((role) => role.id !== product.role)
        .map((role) => ({ role, product: suggestForRole(products, setup.id, role.id, audience) }))
        .filter((item) => item.product && item.product.id !== product.id)
    : []
  const pairs = (product.pairWith ?? [])
    .map((pairId) => products.find((item) => item.id === pairId && item.active && productVisible(item, audience)))
    .filter((item): item is NonNullable<typeof item> => !!item)
  const similar = products
    .filter((item) => item.active && item.id !== product.id && item.sub === product.sub && productVisible(item, audience))
    .slice(0, 4)

  return (
    <div className="wrap">
      <p className="crumb">
        <Link to={`/c/${product.category}`}>{categoryName(product.category)}</Link>
        {product.sub && (
          <>
            <span>/</span>
            <Link to={`/c/${product.category}?sub=${product.sub}`}>{subName(product.category, product.sub)}</Link>
          </>
        )}
        <span>/</span>
        {product.name}
      </p>
      <div className="pdp">
        <div className="gallery">
          <div className={`art cat-${product.category} pdp-art`}>
            <ProductPhoto src={images[photo]} alt={product.name} />
            {!images[photo] && <span className="art-brand">{product.brand}</span>}
            {product.badge && <span className="badge">{product.badge}</span>}
          </div>
          {images.length > 1 && (
            <div className="thumbs">
              {images.map((src, index) => (
                <button key={src + index} type="button" className={index === photo ? 'on' : ''} onClick={() => setPhoto(index)}>
                  <ProductPhoto src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="pdp-info">
          <p className="eyebrow">{product.brand}</p>
          <h1>{product.name}</h1>
          <p className="lead">{product.blurb}</p>
          {pricesOpen ? (
            <div className="price-block">
              <strong className="price">{money(priced.unit)}</strong>
              <span>{audience === 'business' ? 'ליחידה לפני מע״מ' : 'כולל מע״מ'}</span>
              {audience === 'business' && <span className="muted">כ-{money(Math.round(priced.unit * 1.17))} כולל מע״מ</span>}
              {audience === 'private' && priced.unit >= 400 && (
                <span className="muted">או 12 תשלומים של {money(Math.ceil((priced.unit * qty) / 12))}</span>
              )}
            </div>
          ) : null}
          {colors.length > 0 && (
            <div className="option-block">
              <span>צבע {color ? `· ${color.name}` : ''}</span>
              <div className="swatches">
                {colors.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={color?.id === item.id ? 'swatch on' : 'swatch'}
                    style={{ background: item.hex }}
                    aria-label={item.name}
                    onClick={() => setColorId(item.id)}
                  />
                ))}
              </div>
            </div>
          )}
          {storages.length > 0 && (
            <div className="option-block">
              <span>אחסון</span>
              <div className="chips">
                {storages.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={storage?.id === item.id ? 'chip-btn on' : 'chip-btn'}
                    onClick={() => setStorageId(item.id)}
                  >
                    {item.label}
                    {pricesOpen && item.add > 0 ? ` · +${money(item.add)}` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}
          {audience === 'business' && pricesOpen && (
            <table className="vol-table">
              <thead>
                <tr>
                  <th>כמות</th>
                  <th>הנחה</th>
                  <th>ליחידה לפני מע״מ</th>
                </tr>
              </thead>
              <tbody>
                {volumeTiers.map((tier) => (
                  <tr key={tier.qty}>
                    <td>{tier.qty}+</td>
                    <td>{tier.label}</td>
                    <td>{money(unitFor(product, 'business', tier.qty, priceAdd).unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <ul className="specs">
            {product.specs.map((spec) => (
              <li key={spec}>{spec}</li>
            ))}
          </ul>
          <div className="buy-row">
            <Qty value={qty} max={Math.max(1, product.stock)} onChange={setQty} />
            {pricesOpen ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={product.stock <= 0}
                onClick={() =>
                  addToCart(product.id, qty, {
                    color: color?.name,
                    storage: storage?.label,
                    priceAdd,
                  })
                }
              >
                {product.stock <= 0 ? 'אזל מהמלאי' : 'הוספה לסל'}
              </button>
            ) : null}
          </div>
          <p className="fine">משלוח עד הבית, אקספרס, או איסוף עצמי · {product.stock} במלאי</p>
          {product.official && (
            <p className="fine">
              תמונה ומפרט מהאתר הרשמי של {product.brand}.{' '}
              <a href={product.official} target="_blank" rel="noreferrer">
                לפתוח את העמוד הרשמי
              </a>
            </p>
          )}
        </div>
      </div>

      {product.story && (
        <section className="block story">
          <h2>פירוט</h2>
          <p>{product.story}</p>
          {product.category === 'repair' && (
            <Link className="btn btn-ghost" to="/lab">
              הצעת מחיר עם תמונות
            </Link>
          )}
        </section>
      )}

      <section className="block video-card">
        <div>
          <h2>סרטון ופירוט</h2>
          <p>המפרט המלא, הצבעים והסרטון יושבים בעמוד הרשמי של היצרן. כאן בוחרים צבע ואחסון וסוגרים את הקנייה.</p>
        </div>
        {product.video ? (
          <iframe
            title={`סרטון ${product.name}`}
            src={`https://www.youtube.com/embed/${product.video}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : product.official ? (
          <a className="video-link" href={product.official} target="_blank" rel="noreferrer">
            <ProductPhoto src={images[0]} alt="" />
            <span>צפייה בעמוד הרשמי של {product.brand}</span>
          </a>
        ) : (
          <p className="muted">שירות המעבדה מתועד בתיאום הטלפוני, בלי סרטון יצרן.</p>
        )}
      </section>

      {setup && (
        <section className="block upsell">
          <div className="sec-head">
            <h2>מוצרים משלימים ל{setup.name}</h2>
            <p>
              {progress?.complete
                ? `המד מלא. ${setupRateLabel(audience)} כבר נעולים בסל.`
                : `עוד ${progress?.missing.length ?? setup.roles.length} חלקים ל-${setupRateLabel(audience)} ולמשלוח חינם.`}
            </p>
          </div>
          <div className="gap-list">
            {suggestions.map((item) => {
              if (!item.product) return null
              const filled = progress?.filledRoles.some((role) => role.id === item.role.id)
              return (
                <div key={item.role.id} className="gap-row">
                  <div>
                    <span className="eyebrow">{item.role.label}</span>
                    <strong>{item.product.name}</strong>
                  </div>
                  {filled ? <span className="saving">כבר בסל</span> : <Link to={`/p/${item.product.id}`}>למוצר</Link>}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {pairs.length > 0 && (
        <section className="block">
          <h2>קונים יחד</h2>
          <div className="grid">
            {pairs.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}

      {similar.length > 0 && (
        <section className="block">
          <div className="sec-head">
            <h2>מוצרים דומים</h2>
          </div>
          <div className="grid">
            {similar.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
