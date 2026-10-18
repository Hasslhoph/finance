import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App.js'

export function setViewport(width: number): void {
  const setter = (globalThis as unknown as { __setViewportWidth?: (value: number) => void }).__setViewportWidth
  if (setter) {
    setter(width)
  } else {
    window.innerWidth = width
  }
}

export function renderApp(path = '/'): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}
