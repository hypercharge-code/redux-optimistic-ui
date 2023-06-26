"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.findIndex = findIndex;
function findIndex(arr, predicate) {
  var l = arr.length;
  for (var i = 0; i < l; i++) {
    if (predicate(arr[i])) {
      return i;
    }
  }
  return -1;
}