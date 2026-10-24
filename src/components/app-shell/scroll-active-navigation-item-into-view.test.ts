import { scrollActiveNavigationItemIntoView } from './scroll-active-navigation-item-into-view'

const defineLayout = (element: HTMLElement, layout: Record<string, number>) => {
  Object.entries(layout).forEach(([property, value]) => {
    Object.defineProperty(element, property, { configurable: true, value })
  })
}

const buildNavigationList = ({ scrollWidth, activeOffsetLeft }: { scrollWidth: number; activeOffsetLeft: number }) => {
  const navigationList = document.createElement('ul')
  const inactiveLink = document.createElement('a')
  const activeLink = document.createElement('a')
  activeLink.setAttribute('aria-current', 'page')
  navigationList.append(inactiveLink, activeLink)
  defineLayout(navigationList, { scrollWidth, clientWidth: 300 })
  defineLayout(activeLink, { offsetLeft: activeOffsetLeft, offsetWidth: 100 })
  return navigationList
}

describe('scrollActiveNavigationItemIntoView', () => {
  it('centres the active link when the row overflows', () => {
    const navigationList = buildNavigationList({ scrollWidth: 900, activeOffsetLeft: 600 })
    scrollActiveNavigationItemIntoView(navigationList)
    expect(navigationList.scrollLeft).toBe(500)
  })

  it('never scrolls before the start of the row', () => {
    const navigationList = buildNavigationList({ scrollWidth: 900, activeOffsetLeft: 20 })
    navigationList.scrollLeft = 120
    scrollActiveNavigationItemIntoView(navigationList)
    expect(navigationList.scrollLeft).toBe(0)
  })

  it('leaves the row untouched when everything fits', () => {
    const navigationList = buildNavigationList({ scrollWidth: 300, activeOffsetLeft: 200 })
    navigationList.scrollLeft = 40
    scrollActiveNavigationItemIntoView(navigationList)
    expect(navigationList.scrollLeft).toBe(40)
  })

  it('leaves the row untouched when no link is active', () => {
    const navigationList = buildNavigationList({ scrollWidth: 900, activeOffsetLeft: 600 })
    navigationList.querySelector('[aria-current]')?.removeAttribute('aria-current')
    navigationList.scrollLeft = 40
    scrollActiveNavigationItemIntoView(navigationList)
    expect(navigationList.scrollLeft).toBe(40)
  })
})
