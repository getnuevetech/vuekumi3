export class PaymentError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'PaymentError'
    this.statusCode = statusCode
  }
}
