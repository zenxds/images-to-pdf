"use strict";
exports.__esModule = true;
exports.chunk = void 0;
function chunk(arr, size) {
    var length = Math.ceil(arr.length / size);
    return Array.from({ length: length }, function (v, i) { return arr.slice(i * size, i * size + size); });
}
exports.chunk = chunk;
