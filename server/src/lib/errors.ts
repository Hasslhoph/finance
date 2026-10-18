export class AppError extends Error {
  statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
  }
}

export function badRequest(message: string): AppError {
  return new AppError(400, message)
}

export function notFound(message: string): AppError {
  return new AppError(404, message)
}
