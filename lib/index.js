"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var path_1 = require("path");
var fs_1 = require("fs");
var util_1 = require("util");
var puppeteer_1 = require("puppeteer");
var express_1 = require("express");
var pdf_merger_js_1 = require("pdf-merger-js");
var get_port_1 = require("get-port");
var utils_1 = require("./utils");
var ToPDF = /** @class */ (function () {
    function ToPDF(options) {
        this.options = options;
        this.app = (0, express_1["default"])();
        this.groups = (0, utils_1.chunk)(this.options.images, this.options.chunk);
        this.port = 3000;
    }
    ToPDF.prototype.startServer = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, app, groups, options, port, _b;
            var _this = this;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = this, app = _a.app, groups = _a.groups, options = _a.options;
                        app.set('views', path_1["default"].join(__dirname, '../views'));
                        app.set('view engine', 'hbs');
                        app.get('/', function (req, res) {
                            var page = req.query.page ? parseInt(req.query.page) : 1;
                            res.render('index', { images: groups[page - 1] });
                        });
                        _b = this;
                        return [4 /*yield*/, (0, get_port_1["default"])({ port: 3000 })];
                    case 1:
                        port = (_b.port = _c.sent());
                        return [2 /*return*/, new Promise(function (resolve) {
                                _this.server = app.listen(port, function () {
                                    resolve();
                                });
                            })];
                }
            });
        });
    };
    ToPDF.prototype.downloadPdf = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, options, groups, isLinux, args, browser, page, pdfOptions, i, height;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this, options = _a.options, groups = _a.groups;
                        isLinux = process.platform === 'linux';
                        args = [];
                        if (isLinux) {
                            args.push('--no-sandbox');
                        }
                        return [4 /*yield*/, puppeteer_1["default"].launch({
                                args: args
                            })];
                    case 1:
                        browser = _b.sent();
                        return [4 /*yield*/, browser.newPage()];
                    case 2:
                        page = _b.sent();
                        pdfOptions = {};
                        if (options.width) {
                            pdfOptions.width = options.width;
                        }
                        i = 0;
                        _b.label = 3;
                    case 3:
                        if (!(i < groups.length)) return [3 /*break*/, 8];
                        return [4 /*yield*/, page.goto("http://127.0.0.1:" + this.port + "/?page=" + (i + 1), {
                                waitUntil: 'networkidle0'
                            })];
                    case 4:
                        _b.sent();
                        return [4 /*yield*/, page.evaluate(function () { return document.body.scrollHeight; })];
                    case 5:
                        height = _b.sent();
                        return [4 /*yield*/, page.pdf(Object.assign(pdfOptions, {
                                height: height,
                                path: path_1["default"].join(options.outputPath, "" + options.outputName + (i + 1) + ".pdf")
                            }))];
                    case 6:
                        _b.sent();
                        _b.label = 7;
                    case 7:
                        i++;
                        return [3 /*break*/, 3];
                    case 8: return [4 /*yield*/, browser.close()];
                    case 9:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ToPDF.prototype.mergePDF = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, options, groups, outputName, merger, i;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this, options = _a.options, groups = _a.groups;
                        outputName = options.outputName;
                        merger = new pdf_merger_js_1["default"]();
                        for (i = 0; i < groups.length; i++) {
                            merger.add(path_1["default"].join(options.outputPath, "" + outputName + (i + 1) + ".pdf"));
                        }
                        return [4 /*yield*/, merger.save(path_1["default"].join(options.outputPath, outputName + ".pdf"))];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ToPDF.prototype.clean = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, options, server, groups, i, close_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this, options = _a.options, server = _a.server, groups = _a.groups;
                        for (i = 0; i < groups.length; i++) {
                            fs_1["default"].unlinkSync(path_1["default"].join(this.options.outputPath, "" + options.outputName + (i + 1) + ".pdf"));
                        }
                        if (!server) return [3 /*break*/, 2];
                        close_1 = (0, util_1.promisify)(server.close.bind(server));
                        return [4 /*yield*/, close_1()];
                    case 1:
                        _b.sent();
                        _b.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    return ToPDF;
}());
var ImagesToPDF = /** @class */ (function () {
    function ImagesToPDF(options) {
        this.options = Object.assign({
            outputPath: path_1["default"].join(__dirname, '../output')
        }, options);
    }
    ImagesToPDF.prototype.toPDF = function (pdfOptions) {
        return __awaiter(this, void 0, void 0, function () {
            var options, toPdf;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        options = Object.assign({
                            outputPath: this.options.outputPath,
                            outputName: 'page',
                            chunk: 10,
                            images: []
                        }, pdfOptions);
                        toPdf = new ToPDF(options);
                        return [4 /*yield*/, toPdf.startServer()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, toPdf.downloadPdf()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, toPdf.mergePDF()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, toPdf.clean()];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return ImagesToPDF;
}());
exports["default"] = ImagesToPDF;
