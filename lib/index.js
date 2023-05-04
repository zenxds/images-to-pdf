"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToPDF = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const util_1 = require("util");
const puppeteer_1 = __importDefault(require("puppeteer"));
const express_1 = __importDefault(require("express"));
const fs_extra_1 = require("fs-extra");
const pdf_lib_1 = require("pdf-lib");
const get_port_1 = __importDefault(require("get-port"));
const jimp_1 = __importDefault(require("jimp"));
const cache_1 = __importDefault(require("./cache"));
const utils_1 = require("./utils");
class ToPDF {
    constructor(options) {
        this.options = options;
        this.app = (0, express_1.default)();
        this.port = 3000;
        if (Array.isArray(this.options.images[0])) {
            const images = this.options.images;
            this.images = (0, utils_1.flatten)(images);
            this.chunks = images;
        }
        else {
            const images = this.options.images;
            this.images = images;
            this.chunks = (0, utils_1.chunk)(images, this.options.chunk);
        }
        this.groups = (0, utils_1.chunk)(this.chunks, this.options.concurrent);
        this.cacheDir = path_1.default.join(options.outputPath, '_cache');
        this.cache = new cache_1.default({
            root: this.cacheDir,
            name: 'cache'
        });
        this.outputName = path_1.default.join(options.outputPath, `${options.name}.pdf`);
    }
    async setup() {
        await this.checkCache();
        await this.init();
        await this.cleanLatestChunk();
        await this.startServer();
    }
    init() {
        if (this.options.cacheChunk) {
            this.cache.set('chunk', this.options.chunk);
            this.cache.set('images', this.images);
        }
    }
    checkCache() {
        if (!this.options.cacheChunk) {
            return;
        }
        let cleanCache = false;
        const beforeChunk = this.cache.get('chunk');
        if (beforeChunk && beforeChunk !== this.options.chunk) {
            cleanCache = true;
        }
        const beforeImages = this.cache.get('images');
        if (beforeImages && !(0, utils_1.startsWidth)(this.images, beforeImages)) {
            cleanCache = true;
        }
        if (cleanCache) {
            (0, fs_extra_1.removeSync)(this.cacheDir);
            this.cache.clean();
        }
    }
    async cleanLatestChunk() {
        const { outputName } = this;
        const latest = this.cache.get('latest');
        if (!this.options.cacheChunk || !latest) {
            return;
        }
        const latestFile = path_1.default.join(this.cacheDir, latest);
        if (fs_1.default.existsSync(latestFile)) {
            (0, fs_extra_1.removeSync)(latestFile);
        }
        if (fs_1.default.existsSync(outputName)) {
            const pdf = await this.loadPDF(outputName);
            await pdf.removePage(pdf.getPageCount() - 1);
            fs_1.default.writeFileSync(outputName, await pdf.save());
        }
    }
    async startServer() {
        const { app, chunks, options } = this;
        app.set('views', path_1.default.join(__dirname, '../views'));
        app.set('view engine', 'hbs');
        app.use(express_1.default.static(options.outputPath));
        app.get('/', (req, res) => {
            const page = req.query.page ? parseInt(req.query.page) : 1;
            res.render('index', { images: chunks[page - 1] });
        });
        const port = (this.port = await (0, get_port_1.default)({ port: 3000 }));
        return new Promise((resolve) => {
            this.server = app.listen(port, () => {
                resolve();
            });
        });
    }
    async concurrentDownloadItem(browser, i) {
        const { options } = this;
        const chunkPath = this.getChunkPath(i);
        if (this.hasCacheFile(chunkPath.pdf)) {
            return;
        }
        const page = await browser.newPage();
        const images = this.chunks[i];
        const imageFiles = [];
        if (options.cacheImage) {
            page.on('response', async (response) => {
                const url = response.url();
                const ext = path_1.default.extname(url.split(/#|\?/)[0]);
                if (response.request().resourceType() === 'image') {
                    const buffer = await response.buffer();
                    const file = `${chunkPath.name}-${images.indexOf(url)}${ext}`;
                    fs_1.default.writeFileSync(file, buffer);
                    imageFiles.push(file);
                }
            });
        }
        await page.goto(`http://127.0.0.1:${this.port}/?page=${i + 1}`, {
            timeout: options.timeout,
            waitUntil: 'networkidle0'
        });
        const height = await page.evaluate(() => document.body.scrollHeight);
        const width = await page.evaluate(() => document.images[0].width);
        const pdfOptions = Object.assign({
            width,
            height,
            path: chunkPath.pdf
        }, options.pdf);
        if (options.convertHeight) {
            pdfOptions.height = options.convertHeight(height);
        }
        await page.pdf(pdfOptions);
        await page.close();
        if (options.cacheImage) {
            const image = new jimp_1.default(width, height);
            let offset = 0;
            for (let i = 0; i < imageFiles.length; i++) {
                const chunk = await jimp_1.default.read(imageFiles[i]);
                image.composite(chunk, 0, offset);
                offset += chunk.bitmap.height;
                fs_1.default.unlinkSync(imageFiles[i]);
            }
            await image.writeAsync(chunkPath.image);
        }
    }
    async concurrentDownload(browser, groupIndex) {
        const { groups, options } = this;
        const group = groups[groupIndex];
        await Promise.all(group.map((item, i) => this.concurrentDownloadItem(browser, groupIndex * options.concurrent + i)));
    }
    async downloadPDF() {
        const { groups, options } = this;
        const isLinux = process.platform === 'linux';
        const args = [];
        if (isLinux) {
            args.push('--no-sandbox');
        }
        if (options.proxy) {
            args.push('--proxy-server=' + options.proxy);
        }
        const browser = await puppeteer_1.default.launch({
            executablePath: this.options.chromePath,
            headless: 'new',
            args
        });
        (0, fs_extra_1.ensureDirSync)(options.outputPath);
        for (let i = 0; i < groups.length; i++) {
            await this.concurrentDownload(browser, i);
        }
        await browser.close();
    }
    async mergePDF() {
        const { chunks, outputName } = this;
        const { cacheChunk } = this.options;
        const mergedPdf = this.hasCacheFile(outputName)
            ? await this.loadPDF(outputName)
            : await pdf_lib_1.PDFDocument.create();
        const count = mergedPdf.getPageCount();
        for (let i = count; i < chunks.length; i++) {
            const chunkPath = this.getChunkPath(i);
            const document = await this.loadPDF(chunkPath.pdf);
            const copiedPages = await mergedPdf.copyPages(document, document.getPageIndices());
            copiedPages.forEach((page) => {
                mergedPdf.addPage(page);
            });
            if (cacheChunk) {
                this.cache.set('latest', path_1.default.basename(chunkPath.pdf));
            }
        }
        if (mergedPdf.getPageCount() > count) {
            const pdfBytes = await mergedPdf.save();
            fs_1.default.writeFileSync(outputName, pdfBytes);
        }
    }
    async clean() {
        const { server, chunks } = this;
        const { cacheChunk } = this.options;
        if (!cacheChunk) {
            (0, fs_extra_1.removeSync)(this.cache.file);
            for (let i = 0; i < chunks.length; i++) {
                const chunkPath = this.getChunkPath(i);
                (0, fs_extra_1.removeSync)(chunkPath.pdf);
                (0, fs_extra_1.removeSync)(chunkPath.image);
            }
            if ((0, utils_1.isEmptyDir)(this.cacheDir)) {
                (0, fs_extra_1.removeSync)(this.cacheDir);
            }
        }
        if (server) {
            const close = (0, util_1.promisify)(server.close.bind(server));
            await close();
        }
    }
    getChunkPath(i) {
        const { options } = this;
        const chunkName = path_1.default.join(this.cacheDir, `${options.name}${i + 1}`);
        return {
            name: chunkName,
            pdf: `${chunkName}.pdf`,
            image: `${chunkName}.jpg`
        };
    }
    hasCacheFile(file) {
        const { cacheChunk } = this.options;
        return cacheChunk && fs_1.default.existsSync(file);
    }
    loadPDF(file) {
        return pdf_lib_1.PDFDocument.load(fs_1.default.readFileSync(file));
    }
}
exports.ToPDF = ToPDF;
class ImagesToPDF {
    constructor(options) {
        this.options = Object.assign({
            outputPath: path_1.default.join(__dirname, '../output')
        }, options);
    }
    async toPDF(pdfOptions) {
        const options = Object.assign({
            name: 'images',
            chunk: 10,
            concurrent: 5,
            timeout: 0,
            cacheChunk: false,
            cacheImage: false,
            images: [],
            pdf: {}
        }, this.options, pdfOptions);
        const toPdf = new ToPDF(options);
        await toPdf.setup();
        await toPdf.downloadPDF();
        await toPdf.mergePDF();
        await toPdf.clean();
        return toPdf;
    }
}
exports.default = ImagesToPDF;
