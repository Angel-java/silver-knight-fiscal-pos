import { describe, it, expect, vi } from 'vitest'
import { AppError, errorHandler } from '../errorHandler'
import type { Request, Response, NextFunction } from 'express'

function mockReq(): Request {
  return {} as Request
}

function mockRes(): Response {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis()
  }
  return res as Response
}

function mockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction
}

describe('AppError', () => {
  it('creates an error with status code and message', () => {
    const err = new AppError(400, 'Bad request')
    expect(err).toBeInstanceOf(Error)
    expect(err.statusCode).toBe(400)
    expect(err.message).toBe('Bad request')
    expect(err.name).toBe('AppError')
  })

  it('includes optional details', () => {
    const err = new AppError(422, 'Validation failed', { field: 'name' })
    expect(err.details).toEqual({ field: 'name' })
  })
})

describe('errorHandler', () => {
  it('handles AppError with correct status and message', () => {
    const req = mockReq()
    const res = mockRes()
    const next = mockNext()
    const err = new AppError(404, 'Not found')

    errorHandler(err, req, res, next)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' })
  })

  it('handles generic error with 500', () => {
    const req = mockReq()
    const res = mockRes()
    const next = mockNext()
    const err = new Error('Something went wrong')

    errorHandler(err, req, res, next)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' })
  })

  it('handles P2002 Prisma error with 409', () => {
    const req = mockReq()
    const res = mockRes()
    const next = mockNext()
    const err = { code: 'P2002', meta: { target: ['email'] } } as unknown as Error

    errorHandler(err, req, res, next)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith({ error: 'Ya existe un registro con ese email' })
  })

  it('handles P2025 Prisma error with 404', () => {
    const req = mockReq()
    const res = mockRes()
    const next = mockNext()
    const err = { code: 'P2025' } as unknown as Error

    errorHandler(err as Error, req, res, next)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: 'Registro no encontrado' })
  })
})
