"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
class FileCache {
    constructor(options) {
        this.options = options;
        const { root, name, file } = this.options;
        this.file = file || path_1.default.join(root, name + '.json');
        this.cache = this.getFileContent();
        this.ensureDir();
    }
    ensureDir() {
        fs_1.default.mkdirSync(path_1.default.dirname(this.file), {
            recursive: true
        });
    }
    getFileContent() {
        if (fs_1.default.existsSync(this.file)) {
            return require(this.file);
        }
        return {};
    }
    save() {
        const { file, cache } = this;
        this.ensureDir();
        fs_1.default.writeFileSync(file, JSON.stringify(cache, null, 2));
    }
    get(key) {
        return this.cache[key];
    }
    set(key, value) {
        this.cache[key] = value;
        this.save();
    }
    remove(key) {
        delete this.cache[key];
        this.save();
    }
    clean() {
        this.cache = {};
        this.save();
    }
}
exports.default = FileCache;
