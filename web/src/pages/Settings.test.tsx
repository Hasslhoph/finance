import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Settings } from './Settings.js'
import { api } from '../api/client.js'

function renderSettings() {
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/settings')
  vi.spyOn(api, 'get').mockResolvedValue({ insights: { threshold: 1.5, minExcess: 200_000 } } as never)
})

describe('Settings', () => {
  it('показывает порог перерасхода', async () => {
    renderSettings()
    expect(await screen.findByLabelText(/порог/i)).toHaveValue(1.5)
  })

  it('берёт пороги с сервера, а не из вёрстки', async () => {
    vi.mocked(api.get).mockResolvedValue({ insights: { threshold: 2, minExcess: 500_000 } } as never)
    renderSettings()

    expect(await screen.findByLabelText(/порог/i)).toHaveValue(2)
    expect(screen.getByLabelText(/минимальное превышение/i)).toHaveValue(5000)
  })

  it('выход завершает сессию', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue(undefined as never)
    renderSettings()

    await userEvent.click(screen.getByRole('button', { name: 'Выйти' }))

    expect(post).toHaveBeenCalledWith('/api/auth/logout')
  })
})
