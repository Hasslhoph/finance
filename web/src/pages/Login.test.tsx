import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Login } from './Login.js'
import { ApiError, api } from '../api/client.js'

beforeEach(() => {
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/login')
})

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  )
}

describe('Login', () => {
  it('показывает ошибку при неверном пароле', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(new ApiError('Неверный логин или пароль', 401))
    renderLogin()

    await userEvent.type(screen.getByLabelText('Логин'), 'sasha')
    await userEvent.type(screen.getByLabelText('Пароль'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }))

    expect(await screen.findByText(/неверн/i)).toBeInTheDocument()
  })

  it('отправляет логин и пароль и блокирует кнопку на время запроса', async () => {
    const spy = vi.spyOn(api, 'post').mockResolvedValue(undefined as never)
    renderLogin()

    await userEvent.type(screen.getByLabelText('Логин'), 'sasha')
    await userEvent.type(screen.getByLabelText('Пароль'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }))

    expect(spy).toHaveBeenCalledWith('/api/auth/login', { login: 'sasha', password: 'secret' })
  })

  it('не отправляет пустую форму', async () => {
    const spy = vi.spyOn(api, 'post').mockResolvedValue(undefined as never)
    renderLogin()

    await userEvent.click(screen.getByRole('button', { name: 'Войти' }))

    expect(spy).not.toHaveBeenCalled()
    expect(await screen.findByText(/введите логин/i)).toBeInTheDocument()
  })
})
