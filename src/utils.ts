import fs from 'fs'

export function flatten<T>(arr: T[][]): T[] {
  let ret: T[] = []

  for (let i = 0; i < arr.length; i++) {
    ret = ret.concat(arr[i])
  }

  return ret
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const length = Math.ceil(arr.length / size)

  return Array.from(
    { length },
    (v, i): T[] => arr.slice(i * size, i * size + size)
  )
}

export function isEmptyDir(dest: string): boolean {
  return (
    !fs.existsSync(dest) ||
    (fs.statSync(dest).isDirectory() && !fs.readdirSync(dest).length)
  )
}

export function startsWidth(arr1: string[], arr2: string[]): boolean {
  return arr1.join('').startsWith(arr2.join(''))
}
