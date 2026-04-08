"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.flatten = flatten;
exports.chunk = chunk;
exports.isEmptyDir = isEmptyDir;
exports.startsWidth = startsWidth;
const fs_1 = __importDefault(require("fs"));
function flatten(arr) {
    let ret = [];
    for (let i = 0; i < arr.length; i++) {
        ret = ret.concat(arr[i]);
    }
    return ret;
}
function chunk(arr, size) {
    const length = Math.ceil(arr.length / size);
    return Array.from({ length }, (v, i) => arr.slice(i * size, i * size + size));
}
function isEmptyDir(dest) {
    return (!fs_1.default.existsSync(dest) ||
        (fs_1.default.statSync(dest).isDirectory() && !fs_1.default.readdirSync(dest).length));
}
function startsWidth(arr1, arr2) {
    return arr1.join('').startsWith(arr2.join(''));
}
