import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { browserThemePreferenceStore } from '@/lib/theme/theme-preference'
import type { ThemePreferenceStore } from '@/lib/theme/theme-preference'
import { ThemeMenu } from './theme-menu'

const createInMemoryStore = (initialPreference: 'light' | 'dark' | 'system' = 'system'): ThemePreferenceStore => {
  let currentPreference = initialPreference
  const listeners = new Set<() => void>()

  return {
    read: jest.fn(() => currentPreference),
    save: jest.fn((preference) => {
      currentPreference = preference
      listeners.forEach((listener) => listener())
    }),
    subscribe: jest.fn((listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }),
  }
}

const stubDeviceColorScheme = (prefersDarkColorScheme: boolean) => {
  window.matchMedia = jest.fn().mockReturnValue({ matches: prefersDarkColorScheme })
}

const stubResizeObserver = () => {
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }))
}

afterEach(() => {
  jest.restoreAllMocks()
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

describe('ThemeMenu', () => {
  it('shows the monitor icon when nothing is stored', () => {
    stubResizeObserver()
    const store = createInMemoryStore()
    render(<ThemeMenu themePreferenceStore={store} />)

    expect(screen.getByRole('button', { name: 'Thème' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thème' }).querySelector('[data-icon="monitor"]')).toBeInTheDocument()
  })

  it('opens the menu with three radio items when clicked', async () => {
    stubResizeObserver()
    const store = createInMemoryStore()
    const user = userEvent.setup()
    render(<ThemeMenu themePreferenceStore={store} />)

    await user.click(screen.getByRole('button', { name: 'Thème' }))

    const menu = await screen.findByRole('menu', { name: 'Thème' })
    expect(menu).toBeInTheDocument()
    const radioItems = screen.getAllByRole('menuitemradio')
    expect(radioItems).toHaveLength(3)
    expect(radioItems[0]).toHaveAccessibleName('Clair')
    expect(radioItems[1]).toHaveAccessibleName('Sombre')
    expect(radioItems[2]).toHaveAccessibleName('Système')
    expect(radioItems[2]).toHaveAttribute('aria-checked', 'true')
  })

  it('calls save when Sombre is selected and closes the menu', async () => {
    stubResizeObserver()
    const store = createInMemoryStore()
    const user = userEvent.setup()
    render(<ThemeMenu themePreferenceStore={store} />)

    await user.click(screen.getByRole('button', { name: 'Thème' }))
    const sombreItem = await screen.findByRole('menuitemradio', { name: 'Sombre' })
    await user.click(sombreItem)

    expect(store.save).toHaveBeenCalledWith('dark')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thème' })).toHaveFocus()
  })

  it('closes the menu when the already checked item is clicked', async () => {
    stubResizeObserver()
    const store = createInMemoryStore()
    const user = userEvent.setup()
    render(<ThemeMenu themePreferenceStore={store} />)

    await user.click(screen.getByRole('button', { name: 'Thème' }))
    const systemItem = await screen.findByRole('menuitemradio', { name: 'Système' })
    await user.click(systemItem)

    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Thème' })).toHaveFocus()
  })

  it('updates the icon to moon after selecting dark', async () => {
    stubResizeObserver()
    const store = createInMemoryStore()
    const user = userEvent.setup()
    render(<ThemeMenu themePreferenceStore={store} />)

    await user.click(screen.getByRole('button', { name: 'Thème' }))
    const sombreItem = await screen.findByRole('menuitemradio', { name: 'Sombre' })
    await user.click(sombreItem)

    expect(screen.getByRole('button', { name: 'Thème' }).querySelector('[data-icon="moon"]')).toBeInTheDocument()
  })

  it('opens menu with ArrowDown and navigates with keyboard', async () => {
    stubResizeObserver()
    const store = createInMemoryStore()
    const user = userEvent.setup()
    render(<ThemeMenu themePreferenceStore={store} />)

    const button = screen.getByRole('button', { name: 'Thème' })
    button.focus()
    await user.keyboard('{ArrowDown}')

    const menu = await screen.findByRole('menu', { name: 'Thème' })
    expect(menu).toBeInTheDocument()

    const radioItems = screen.getAllByRole('menuitemradio')
    await waitFor(() => expect(radioItems[0]).toHaveFocus())

    await user.keyboard('{ArrowDown}')
    expect(radioItems[1]).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })

  it('keeps the checked tone on the highlighted checked item', async () => {
    stubResizeObserver()
    const store = createInMemoryStore()
    const user = userEvent.setup()
    render(<ThemeMenu themePreferenceStore={store} />)

    screen.getByRole('button', { name: 'Thème' }).focus()
    await user.keyboard('{ArrowDown}')
    const radioItems = await screen.findAllByRole('menuitemradio')

    await waitFor(() => expect(radioItems[0]).toHaveFocus())
    expect(radioItems[0]).toHaveAttribute('data-highlighted')
    expect(radioItems[0]).toHaveAttribute('data-tone', 'popover')

    await user.keyboard('{ArrowDown}{ArrowDown}')

    await waitFor(() => expect(radioItems[2]).toHaveAttribute('data-highlighted'))
    expect(radioItems[2]).toHaveAttribute('data-tone', 'forest-soft')
    expect(radioItems[0]).not.toHaveAttribute('data-highlighted')
  })

  it('shows the sun icon when light is stored', () => {
    stubResizeObserver()
    const store = createInMemoryStore('light')
    render(<ThemeMenu themePreferenceStore={store} />)

    expect(screen.getByRole('button', { name: 'Thème' }).querySelector('[data-icon="sun"]')).toBeInTheDocument()
    expect(store.read).toHaveBeenCalled()
  })

  it('shows Clair as checked when light is stored', async () => {
    stubResizeObserver()
    const store = createInMemoryStore('light')
    const user = userEvent.setup()
    render(<ThemeMenu themePreferenceStore={store} />)

    await user.click(screen.getByRole('button', { name: 'Thème' }))

    const clairItem = await screen.findByRole('menuitemradio', { name: 'Clair' })
    expect(clairItem).toHaveAttribute('aria-checked', 'true')
  })

  it('applies the theme immediately when using the real browser store', async () => {
    stubResizeObserver()
    stubDeviceColorScheme(false)
    const user = userEvent.setup()
    render(<ThemeMenu themePreferenceStore={browserThemePreferenceStore} />)

    await user.click(screen.getByRole('button', { name: 'Thème' }))
    const sombreItem = await screen.findByRole('menuitemradio', { name: 'Sombre' })
    await user.click(sombreItem)

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('aled-theme')).toBe('dark')
  })
  it('shows the chosen theme when storage is blocked', async () => {
    stubResizeObserver()
    stubDeviceColorScheme(false)
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const user = userEvent.setup()
    render(<ThemeMenu themePreferenceStore={browserThemePreferenceStore} />)

    await user.click(screen.getByRole('button', { name: 'Thème' }))
    await user.click(await screen.findByRole('menuitemradio', { name: 'Sombre' }))

    expect(screen.getByRole('button', { name: 'Thème' }).querySelector('[data-icon="moon"]')).toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
