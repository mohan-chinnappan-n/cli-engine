import deps from './deps'
const debug = require('debug')('util')

export function compare(...props: any[]) {
  return (a: any, b: any) => {
    for (let prop of props) {
      if (a[prop] === undefined) return -1
      if (b[prop] === undefined) return 1
      if (a[prop] < b[prop]) return -1
      if (a[prop] > b[prop]) return 1
    }
    return 0
  }
}

export function wait(ms: number, unref: boolean = false): Promise<void> {
  return new Promise(resolve => {
    let t: any = setTimeout(resolve, ms)
    if (unref) t.unref()
  })
}

export function timeout(p: Promise<any>, ms: number): Promise<void> {
  return Promise.race([p, wait(ms, true).then(() => debug('timed out'))])
}

export interface IESModule<T> {
  __esModule: true
  default: T
}

export function undefault<T>(obj: T | IESModule<T>): T {
  if ((obj as any).__esModule === true) return (obj as any).default
  return obj as any
}

export function isEmpty(obj: any) {
  // null and undefined are "empty"
  if (obj == null) return true

  // Assume if it has a length property with a non-zero value
  // that that property is correct.
  if (obj.length && obj.length > 0) return false
  if (obj.length === 0) return true

  // Otherwise, does it have any properties of its own?
  // Note that this doesn't handle
  // toString and toValue enumeration bugs in IE < 9
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) return false
  }

  return true
}

export function toArray<T>(o: T | T[]): T[] {
  return Array.isArray(o) ? o : [o]
}

export function objValsToArrays<T>(input?: { [k: string]: T | T[] }): { [k: string]: T[] } {
  return objEntries(input).reduce(
    (output, [k, v]) => {
      output[k] = toArray(v)
      return output
    },
    {} as { [k: string]: T[] },
  )
}

export function objEntries<T>(input?: { [k: string]: T }): [string, T][] {
  if (!input) return []
  return Object.keys(input).map(k => [k, input[k]] as [string, T])
}

export function objValues<T>(input?: { [k: string]: T }): T[] {
  return objEntries<T>(input).map(([, v]) => v)
}

export function minorVersionGreater(fromString: string, toString: string): boolean {
  const from = deps.semver.parse(fromString)!
  const to = deps.semver.parse(toString)!
  if (from.major < to.major) return true
  if (from.major === to.major && from.minor < to.minor) return true
  return false
}
