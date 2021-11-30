"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const util_1 = require("util");
const puppeteer_1 = __importDefault(require("puppeteer"));
const express_1 = __importDefault(require("express"));
const pdf_merger_js_1 = __importDefault(require("pdf-merger-js"));
const get_port_1 = __importDefault(require("get-port"));
const utils_1 = require("./utils");
class ToPDF {
    constructor(options) {
        this.options = options;
        this.app = (0, express_1.default)();
        this.groups = (0, utils_1.chunk)(this.options.images, this.options.chunk);
        this.port = 3000;
    }
    async startServer() {
        const { app, groups, options } = this;
        app.set('views', path_1.default.join(__dirname, '../views'));
        app.set('view engine', 'hbs');
        app.get('/', (req, res) => {
            const page = req.query.page ? parseInt(req.query.page) : 1;
            res.render('index', { images: groups[page - 1] });
        });
        const port = this.port = await (0, get_port_1.default)({ port: 3000 });
        return new Promise((resolve) => {
            this.server = app.listen(port, () => {
                resolve();
            });
        });
    }
    async downloadPdf() {
        const { options, groups } = this;
        const browser = await puppeteer_1.default.launch();
        const page = await browser.newPage();
        const pdfOptions = {};
        if (options.width) {
            pdfOptions.width = options.width;
        }
        for (let i = 0; i < groups.length; i++) {
            await page.goto(`http://127.0.0.1:${this.port}/?page=${i + 1}`, {
                waitUntil: 'networkidle0'
            });
            const height = await page.evaluate(() => document.body.scrollHeight);
            await page.pdf(Object.assign(pdfOptions, {
                height,
                path: path_1.default.join(options.outputPath, `${options.outputName}${i + 1}.pdf`)
            }));
        }
        await browser.close();
    }
    async mergePDF() {
        const { options, groups } = this;
        const { outputName } = options;
        const merger = new pdf_merger_js_1.default();
        for (let i = 0; i < groups.length; i++) {
            merger.add(path_1.default.join(options.outputPath, `${outputName}${i + 1}.pdf`));
        }
        await merger.save(path_1.default.join(options.outputPath, `${outputName}.pdf`));
    }
    async clean() {
        const { options, server, groups } = this;
        for (let i = 0; i < groups.length; i++) {
            fs_1.default.unlinkSync(path_1.default.join(this.options.outputPath, `${options.outputName}${i + 1}.pdf`));
        }
        if (server) {
            const close = (0, util_1.promisify)(server.close.bind(server));
            await close();
        }
    }
}
class ImagesToPDF {
    constructor(options) {
        this.options = Object.assign({
            outputPath: path_1.default.join(__dirname, '../output')
        }, options);
    }
    async toPDF(pdfOptions) {
        const options = Object.assign({
            outputPath: this.options.outputPath,
            outputName: 'page',
            chunk: 10,
            images: []
        }, pdfOptions);
        const toPdf = new ToPDF(options);
        await toPdf.startServer();
        await toPdf.downloadPdf();
        await toPdf.mergePDF();
        await toPdf.clean();
    }
}
exports.default = ImagesToPDF;
