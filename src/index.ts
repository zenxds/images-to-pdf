import path from 'path'
import fs from 'fs'
import http from 'http'
import { promisify } from 'util'
import puppeteer from 'puppeteer'
import express, { Express } from 'express'
import PDFMerger from 'pdf-merger-js'
import getPort from 'get-port'

import { chunk } from './utils'

class ToPDF {
  private options: ToPdfOptions
  private app: Express
  private groups: string[][]
  private server?: http.Server
  private port: number

  public constructor(options: ToPdfOptions) {
    this.options = options
    this.app = express()
    this.groups = chunk(this.options.images, this.options.chunk)
    this.port = 3000
  }

  public async startServer(): Promise<void> {
    const { app, groups, options } = this
    app.set('views', path.join(__dirname, '../views'))
    app.set('view engine', 'hbs')

    app.get(
      '/',
      (req, res): void => {
        const page = req.query.page ? parseInt(req.query.page as string) : 1
        res.render('index', { images: groups[page - 1] })
      }
    )

    const port = (this.port = await getPort({ port: 3000 }))
    return new Promise(
      (resolve): void => {
        this.server = app.listen(
          port,
          (): void => {
            resolve()
          }
        )
      }
    )
  }

  public async downloadPdf(): Promise<void> {
    const { options, groups } = this
    const isLinux = process.platform === 'linux'
    const args: string[] = []

    if (isLinux) {
      args.push('--no-sandbox')
    }

    const browser = await puppeteer.launch({
      args
    })
    const page = await browser.newPage()
    const pdfOptions: puppeteer.PDFOptions = {}

    if (options.width) {
      pdfOptions.width = options.width
    }

    for (let i = 0; i < groups.length; i++) {
      await page.goto(`http://127.0.0.1:${this.port}/?page=${i + 1}`, {
        waitUntil: 'networkidle0'
      })
      const height = await page.evaluate(
        (): number => document.body.scrollHeight
      )
      await page.pdf(
        Object.assign(pdfOptions, {
          height,
          path: path.join(
            options.outputPath,
            `${options.outputName}${i + 1}.pdf`
          )
        })
      )
    }

    await browser.close()
  }

  public async mergePDF(): Promise<void> {
    const { options, groups } = this
    const { outputName } = options
    const merger = new PDFMerger()

    for (let i = 0; i < groups.length; i++) {
      merger.add(path.join(options.outputPath, `${outputName}${i + 1}.pdf`))
    }

    await merger.save(path.join(options.outputPath, `${outputName}.pdf`))
  }

  public async clean(): Promise<void> {
    const { options, server, groups } = this

    for (let i = 0; i < groups.length; i++) {
      fs.unlinkSync(
        path.join(this.options.outputPath, `${options.outputName}${i + 1}.pdf`)
      )
    }

    if (server) {
      const close = promisify(server.close.bind(server))
      await close()
    }
  }
}

export default class ImagesToPDF {
  private options: Options

  public constructor(options: Partial<Options>) {
    this.options = Object.assign(
      {
        outputPath: path.join(__dirname, '../output')
      },
      options
    )
  }

  public async toPDF(pdfOptions: Partial<ToPdfOptions>): Promise<void> {
    const options: ToPdfOptions = Object.assign(
      {
        outputPath: this.options.outputPath,
        outputName: 'page',
        chunk: 10,
        images: []
      },
      pdfOptions
    )
    const toPdf = new ToPDF(options)

    await toPdf.startServer()
    await toPdf.downloadPdf()
    await toPdf.mergePDF()
    await toPdf.clean()
  }
}
