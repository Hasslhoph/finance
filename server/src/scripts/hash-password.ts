import { hashPassword } from '../auth/password.js'

const password = process.argv[2]

if (!password) {
  console.error('Использование: npm run hash-password -w server -- "ваш пароль"')
  process.exit(1)
}

console.log(hashPassword(password))
