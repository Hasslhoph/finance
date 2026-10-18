import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Settings } from './Settings.js'
import { api } from '../api/client.js'

beforeEach(() => {
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/settings')
})

describe('Settings', () => {
  it('показывает порог перерасхода', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    )

    expect(await screen.findByLabelText(/порог/i)).toHaveValue(1.5)
  })

  it('выход завершает сессию', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue(undefined as never)
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Выйти' }))

    expect(post).toHaveBeenCalledWith('/api/auth/logout')
  })
})
