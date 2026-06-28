import { useEffect } from 'react'

export const useModalBehavior = (isOpen: boolean, onClose: () => void) => {
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    const bodyStyle = document.body.style
    const previousOverflow = bodyStyle.overflow
    const previousPosition = bodyStyle.position
    const previousTop = bodyStyle.top
    const previousLeft = bodyStyle.left
    const previousRight = bodyStyle.right
    const previousWidth = bodyStyle.width
    const scrollY = window.scrollY

    bodyStyle.overflow = 'hidden'
    bodyStyle.position = 'fixed'
    bodyStyle.top = `-${scrollY}px`
    bodyStyle.left = '0'
    bodyStyle.right = '0'
    bodyStyle.width = '100%'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      bodyStyle.overflow = previousOverflow
      bodyStyle.position = previousPosition
      bodyStyle.top = previousTop
      bodyStyle.left = previousLeft
      bodyStyle.right = previousRight
      bodyStyle.width = previousWidth
      window.scrollTo(0, scrollY)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, onClose])
}