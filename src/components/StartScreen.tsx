import type { Person } from '../types/person'

type StartScreenProps = {
  activePerson: Person | null
}

export function StartScreen({ activePerson }: StartScreenProps) {
  return (
    <section className="card start-screen">
      {!activePerson ? (
        <>
          <h2>Start screen</h2>
          <p>Add at least one person in settings to begin.</p>
        </>
      ) : (
        <>
          <h2>{activePerson.name}</h2>
          <p>
            Selected person color: <strong>{activePerson.color}</strong>
          </p>
        </>
      )}
    </section>
  )
}
