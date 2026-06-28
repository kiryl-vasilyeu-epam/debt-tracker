export const scrollHorizontallyIntoView = (
  container: HTMLElement,
  item: HTMLElement,
) => {
  const maxScrollLeft = container.scrollWidth - container.clientWidth
  if (maxScrollLeft <= 0) {
    return
  }

  const itemLeft = item.offsetLeft
  const itemRight = itemLeft + item.offsetWidth
  const visibleLeft = container.scrollLeft
  const visibleRight = visibleLeft + container.clientWidth

  if (itemLeft >= visibleLeft && itemRight <= visibleRight) {
    return
  }

  const centeredLeft = itemLeft - (container.clientWidth - item.offsetWidth) / 2
  const nextScrollLeft = Math.max(0, Math.min(centeredLeft, maxScrollLeft))

  container.scrollTo({
    left: nextScrollLeft,
    behavior: 'smooth',
  })
}