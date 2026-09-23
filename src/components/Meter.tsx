import type { SetupProgress } from '../pricing'

export function Meter({ progress }: { progress: SetupProgress }) {
  return (
    <div className="meter">
      <div className="meter-top">
        <strong>{progress.setup.name}</strong>
        <span>
          {progress.filledRoles.length}/{progress.setup.roles.length}
        </span>
      </div>
      <div className="meter-track">
        {progress.setup.roles.map((role) => {
          const on = progress.filledRoles.some((filled) => filled.id === role.id)
          return (
            <div key={role.id} className={on ? 'node on' : 'node'}>
              <i />
              <span>{role.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
