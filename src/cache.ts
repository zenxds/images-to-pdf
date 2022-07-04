import path from 'path'
import fs from 'fs'

interface Options {
  root: string
  name: string
  file?: string
}

type Content = Record<string, string>

export default class FileCache {
  public options: Options
  public file: string
  public cache: Content

  public constructor(options: Options) {
    this.options = options

    const { root, name, file } = this.options
    this.file = file || path.join(root, name + '.json')
    this.cache = this.getFileContent()
    this.ensureDir()
  }

  private ensureDir(): void {
    fs.mkdirSync(path.dirname(this.file), {
      recursive: true
    })
  }

  public getFileContent(): Content {
    // json file
    if (fs.existsSync(this.file)) {
      return require(this.file)
    }

    return {}
  }

  public save(): void {
    const { file, cache } = this
    fs.writeFileSync(file, JSON.stringify(cache, null, 2))
  }

  public get(key: string): string {
    return this.cache[key] || ''
  }

  public set(key: string, value: string): void {
    this.cache[key] = value
    this.save()
  }

  public remove(key: string): void {
    delete this.cache[key]
    this.save()
  }

  public clean(): void {
    this.cache = {}
    this.save()
  }
}
