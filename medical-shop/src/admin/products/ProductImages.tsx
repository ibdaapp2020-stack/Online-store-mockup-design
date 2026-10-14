import { useState } from 'react'
import { imageSrc, uploadImages } from './storageService'

type Props = {
  images: string[]
  disabled?: boolean
  onChange: (images: string[]) => void
}

export function ProductImages({ images, disabled, onChange }: Props) {
  const [drag, setDrag] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')

  async function addFiles(list: FileList | File[] | null) {
    const files = list ? [...list].filter((file) => file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg|heic|avif)$/i.test(file.name)) : []
    if (!files.length) return
    setError('')
    setProgress(`מעלה ${files.length} תמונות...`)
    try {
      const urls = await uploadImages(files)
      onChange([...images, ...urls])
      setProgress('ההעלאה נשמרה בשרת')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'העלאת התמונה נכשלה')
      setProgress('')
    }
  }

  function move(index: number, to: number) {
    if (to < 0 || to >= images.length) return
    const next = [...images]
    const [item] = next.splice(index, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  return (
    <section className="form-block">
      <h2>תמונות</h2>
      <label
        className={drag ? 'dropzone on' : 'dropzone'}
        onDragOver={(event) => {
          event.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDrag(false)
          if (!disabled) void addFiles(event.dataTransfer.files)
        }}
      >
        <span>גררו תמונות לכאן או בחרו מהמחשב / מהטלפון</span>
        <input type="file" accept="image/*" multiple disabled={disabled} onChange={(event) => void addFiles(event.target.files)} />
      </label>
      {progress ? <p className="muted">{progress}</p> : null}
      {error ? <p className="form-errors">{error}</p> : null}
      <div className="image-grid">
        {images.map((url, index) => (
          <figure key={`${url}-${index}`} className={index === 0 ? 'image-tile main' : 'image-tile'}>
            <img
              src={imageSrc(url)}
              alt=""
              onError={(event) => {
                event.currentTarget.src = imageSrc()
              }}
            />
            <figcaption>{index === 0 ? 'ראשית' : `תמונה ${index + 1}`}</figcaption>
            {disabled ? null : (
              <div className="tile-actions">
                <button type="button" onClick={() => onChange([url, ...images.filter((item) => item !== url)])}>
                  ראשית
                </button>
                <button type="button" onClick={() => move(index, index - 1)}>
                  ימין
                </button>
                <button type="button" onClick={() => move(index, index + 1)}>
                  שמאל
                </button>
                <button type="button" className="danger-text" onClick={() => onChange(images.filter((_, current) => current !== index))}>
                  מחיקה
                </button>
              </div>
            )}
          </figure>
        ))}
      </div>
    </section>
  )
}
