import fs from 'fs'

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
