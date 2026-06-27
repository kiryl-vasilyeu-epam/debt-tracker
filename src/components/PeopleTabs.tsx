import { useEffect, useRef } from 'react'
import type { Person } from '../types/person'

type PeopleTabsProps = {
  people: Person[]
  activePersonId: string | null
  onSelectPerson: (id: string) => void
}

export function PeopleTabs({
  people,
  activePersonId,
  onSelectPerson,
}: PeopleTabsProps) {
  const tabsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const tabsNode = tabsRef.current
    if (!tabsNode || !activePersonId) {
      return
    }

    const activeTabNode = tabsNode.querySelector<HTMLButtonElement>(
      '.person-tab-active',
    )
    activeTabNode?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    })
  }, [activePersonId])

  return (
    <section className="card tabs-card">
      <div className="tabs-title">
        <h2>Люди</h2>
        <span>{people.length}</span>
      </div>

      <div
        ref={tabsRef}
        className="people-tabs"
        role="tablist"
        aria-label="Вкладки людей"
      >
        {people.map((person) => (
          <button
            key={person.id}
            type="button"
            role="tab"
            aria-selected={person.id === activePersonId}
            className={`person-tab ${
              person.id === activePersonId ? 'person-tab-active' : ''
            }`}
            onClick={() => onSelectPerson(person.id)}
          >
            <span
              className="person-color-dot"
              style={{ backgroundColor: person.color }}
              aria-hidden="true"
            />
            {person.name}
          </button>
        ))}

        {people.length === 0 ? (
          <p className="empty-tabs">Людей пока нет. Откройте настройки и добавьте человека.</p>
        ) : null}
      </div>
    </section>
  )
}
