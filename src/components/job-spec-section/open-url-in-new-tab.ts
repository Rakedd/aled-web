export const openUrlInNewTab = (url: string): void => {
  const temporaryLink = document.createElement('a')
  temporaryLink.href = url
  temporaryLink.target = '_blank'
  temporaryLink.rel = 'noopener noreferrer'
  temporaryLink.click()
}
