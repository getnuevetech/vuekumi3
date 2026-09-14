import { startMediaWorker } from './lib/media-worker.js'

const log = {
  info: (obj: unknown, msg?: string) => console.log(msg ?? '', obj),
  warn: (obj: unknown, msg?: string) => console.warn(msg ?? '', obj),
  error: (obj: unknown, msg?: string) => console.error(msg ?? '', obj),
  debug: () => undefined,
  trace: () => undefined,
  fatal: (obj: unknown, msg?: string) => console.error(msg ?? '', obj),
  child: () => log,
  level: 'info',
  silent: false,
} as unknown as Parameters<typeof startMediaWorker>[0]

startMediaWorker(log)
console.log('Vuekumi media worker running')
