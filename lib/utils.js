"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startsWidth = exports.isEmptyDir = exports.chunk = exports.flatten = void 0;
const fs_1 = __importDefault(require("fs"));
function flatten(arr) {
    let ret = [];
    for (let i = 0; i < arr.length; i++) {
        ret = ret.concat(arr[i]);
    }
    return ret;
}
exports.flatten = flatten;
function chunk(arr, size) {
    const length = Math.ceil(arr.length / size);
    return Array.from({ length }, (v, i) => arr.slice(i * size, i * size + size));
}
exports.chunk = chunk;
function isEmptyDir(dest) {
    return (!fs_1.default.existsSync(dest) ||
        (fs_1.default.statSync(dest).isDirectory() && !fs_1.default.readdirSync(dest).length));
}
exports.isEmptyDir = isEmptyDir;
function startsWidth(arr1, arr2) {
    return arr1.join('').startsWith(arr2.join(''));
}
exports.startsWidth = startsWidth;
