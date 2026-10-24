export const scrollActiveNavigationItemIntoView = (navigationList: HTMLElement): void => {
  const isOverflowing = navigationList.scrollWidth > navigationList.clientWidth
  const activeNavigationLink = navigationList.querySelector<HTMLElement>('[aria-current="page"]')
  if (!isOverflowing || !activeNavigationLink) return
  const centredScrollLeft =
    activeNavigationLink.offsetLeft - (navigationList.clientWidth - activeNavigationLink.offsetWidth) / 2
  navigationList.scrollLeft = Math.max(0, centredScrollLeft)
}
