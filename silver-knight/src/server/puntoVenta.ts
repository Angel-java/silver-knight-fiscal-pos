import { EventEmitter } from 'events'
import { SerialPort } from 'serialport'
import { prisma } from './database/prisma'

export interface PuntoVentaConfig {
  port: string
  baudRate: number
  enabled: boolean
}

export interface TransactionResult {
  success: boolean
  approvalCode?: string
  cardNumber?: string
  message?: string
  error?: string
  raw?: string
}

class PuntoVentaService extends EventEmitter {
  private port: SerialPort | null = null
  private config: PuntoVentaConfig = { port: '', baudRate: 9600, enabled: false }
  private buffer = ''
  private _connecting = false

  get isConnected(): boolean {
    return this.port !== null && this.port.isOpen
  }

  get isConnecting(): boolean {
    return this._connecting
  }

  get currentConfig(): PuntoVentaConfig {
    return { ...this.config }
  }

  async loadConfig(): Promise<PuntoVentaConfig> {
    const rows = await prisma.setting.findMany({
      where: {
        key: { in: ['posTerminalPort', 'posTerminalBaudRate', 'posTerminalEnabled'] }
      }
    })
    const map: Record<string, string> = {}
    for (const r of rows) map[r.key] = r.value

    this.config = {
      port: map['posTerminalPort'] || '',
      baudRate: parseInt(map['posTerminalBaudRate'] || '9600', 10),
      enabled: map['posTerminalEnabled'] === 'true'
    }
    return this.currentConfig
  }

  async saveConfig(config: Partial<PuntoVentaConfig>): Promise<PuntoVentaConfig> {
    if (config.port !== undefined) {
      this.config.port = config.port
      await prisma.setting.upsert({
        where: { key: 'posTerminalPort' },
        update: { value: config.port },
        create: { key: 'posTerminalPort', value: config.port }
      })
    }
    if (config.baudRate !== undefined) {
      this.config.baudRate = config.baudRate
      await prisma.setting.upsert({
        where: { key: 'posTerminalBaudRate' },
        update: { value: String(config.baudRate) },
        create: { key: 'posTerminalBaudRate', value: String(config.baudRate) }
      })
    }
    if (config.enabled !== undefined) {
      this.config.enabled = config.enabled
      await prisma.setting.upsert({
        where: { key: 'posTerminalEnabled' },
        update: { value: String(config.enabled) },
        create: { key: 'posTerminalEnabled', value: String(config.enabled) }
      })
    }
    return this.currentConfig
  }

  async connect(config?: PuntoVentaConfig): Promise<void> {
    if (config) this.config = { ...config }
    if (!this.config.port) throw new Error('No hay puerto configurado')
    if (!this.config.enabled) throw new Error('Terminal POS no está habilitado')

    await this.disconnect()
    this._connecting = true

    return new Promise((resolve, reject) => {
      try {
        this.port = new SerialPort({
          path: this.config.port,
          baudRate: this.config.baudRate,
          autoOpen: false
        })

        this.port.on('open', () => {
          this._connecting = false
          this.buffer = ''
          this.emit('connected')
          resolve()
        })

        this.port.on('data', (data: Buffer) => {
          this.buffer += data.toString('utf-8')
          const lines = this.buffer.split('\n')
          this.buffer = lines.pop() || ''
          for (const line of lines) {
            this.emit('data', line.trim())
            const result = this.parseResponse(line.trim())
            if (result) this.emit('transaction', result)
          }
        })

        this.port.on('error', (err: Error) => {
          this._connecting = false
          this.emit('error', err)
          reject(err)
        })

        this.port.on('close', () => {
          this._connecting = false
          this.port = null
          this.emit('disconnected')
        })

        this.port.open()
      } catch (err) {
        this._connecting = false
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }

  async disconnect(): Promise<void> {
    if (this.port) {
      try {
        if (this.port.isOpen) {
          await new Promise<void>((resolve) => this.port!.close(() => resolve()))
        }
      } catch {
        /* ignore */
      }
      this.port = null
    }
    this._connecting = false
    this.buffer = ''
  }

  async sendAmount(amount: number): Promise<TransactionResult> {
    if (!this.isConnected) throw new Error('Terminal POS no conectado')

    const cmd = `${amount.toFixed(2)}\n`
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout: el terminal no respondió'))
      }, 30000)

      const onData = (data: string): void => {
        const result = this.parseResponse(data)
        if (result) {
          clearTimeout(timeout)
          this.off('data', onData)
          resolve(result)
        }
      }

      this.on('data', onData)
      this.port!.write(cmd, (err?: Error | null) => {
        if (err) {
          clearTimeout(timeout)
          this.off('data', onData)
          reject(err)
        }
      })
    })
  }

  async testConnection(): Promise<string> {
    await this.connect()
    await this.disconnect()
    return 'Conexión exitosa'
  }

  private parseResponse(line: string): TransactionResult | null {
    const upper = line.toUpperCase()
    if (
      upper.includes('APROB') ||
      upper.includes('APPR') ||
      upper.includes('OK') ||
      upper.includes('00')
    ) {
      const approvalCode = this.extractApprovalCode(line)
      const cardNumber = this.extractCardNumber(line)
      return { success: true, approvalCode, cardNumber, message: 'Transacción aprobada', raw: line }
    }
    if (
      upper.includes('RECHA') ||
      upper.includes('DECL') ||
      upper.includes('DEN') ||
      upper.includes('ERROR') ||
      upper.includes('FAIL')
    ) {
      return { success: false, error: line, raw: line }
    }
    return null
  }

  private extractApprovalCode(line: string): string | undefined {
    const m = line.match(/\b(\d{6})\b/)
    return m ? m[1] : undefined
  }

  private extractCardNumber(line: string): string | undefined {
    const m = line.match(/\b(\d{4}[\s*-]?\d{4}[\s*-]?\d{4}[\s*-]?\d{4})\b/)
    if (m)
      return m[1]
        .replace(/[\s*-]/g, '')
        .slice(-4)
        .padStart(4, '*')
    const last4 = line.match(/\*{4,}(\d{4})\b/)
    if (last4) return `****${last4[1]}`
    return undefined
  }

  async listAvailablePorts(): Promise<Array<{ path: string; manufacturer?: string }>> {
    try {
      const ports = await SerialPort.list()
      return ports.map((p) => ({
        path: p.path,
        manufacturer: p.manufacturer || undefined
      }))
    } catch {
      return []
    }
  }
}

export const puntoVentaService = new PuntoVentaService()
