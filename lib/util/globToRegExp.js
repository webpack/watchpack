/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Haijie Xie @hai-x
*/

"use strict";

// Based on https://github.com/fitzgen/glob-to-regexp (MIT)
// Specialized for watchpack: `extended` and `globstar` always enabled.
// Returns the regexp source without `^`/`$` anchors.

const CC_EXCLAMATION = 33; // "!"
const CC_DOLLAR = 36; // "$"
const CC_LEFT_PARENTHESIS = 40; // "("
const CC_RIGHT_PARENTHESIS = 41; // ")"
const CC_ASTERISK = 42; // "*"
const CC_PLUS = 43; // "+"
const CC_COMMA = 44; // ","
const CC_DOT = 46; // "."
const CC_SLASH = 47; // "/"
const CC_EQUAL = 61; // "="
const CC_QUESTION_MARK = 63; // "?"
const CC_LEFT_BRACKET = 91; // "["
const CC_RIGHT_BRACKET = 93; // "]"
const CC_CARET = 94; // "^"
const CC_LEFT_BRACE = 123; // "{"
const CC_PIPE = 124; // "|"
const CC_RIGHT_BRACE = 125; // "}"

const CC_BACKSLASH = 92; // "\\"

// A globstar segment followed by more of the pattern: whole segments, each
// ending in "/", so no two ways split the same path and nothing backtracks.
const GLOBSTAR_SEGMENTS = "((?:[^/]*\\/)*)";
// A globstar that ends the pattern matches whatever is left.
const GLOBSTAR_REST = "(.*)";

/**
 * @param {string} glob glob pattern
 * @param {boolean} literal whether brackets, braces and backslashes are literal characters
 * @returns {string} regexp source without anchors
 */
const translate = (glob, literal) => {
	const len = glob.length;
	let reStr = "";
	let inGroup = false;
	// Start of the current run of literal characters, copied with one slice
	let literalStart = 0;

	for (let i = 0; i < len; i++) {
		const cc = glob.charCodeAt(i);
		const tokenStart = i;
		let mapped;

		switch (cc) {
			case CC_SLASH:
				mapped = "\\/";
				break;
			case CC_DOLLAR:
				mapped = "\\$";
				break;
			case CC_CARET:
				mapped = "\\^";
				break;
			case CC_PLUS:
				mapped = "\\+";
				break;
			case CC_DOT:
				mapped = "\\.";
				break;
			case CC_LEFT_PARENTHESIS:
				mapped = "\\(";
				break;
			case CC_RIGHT_PARENTHESIS:
				mapped = "\\)";
				break;
			case CC_EQUAL:
				mapped = "\\=";
				break;
			case CC_EXCLAMATION:
				mapped = "\\!";
				break;
			case CC_PIPE:
				mapped = "\\|";
				break;
			case CC_QUESTION_MARK:
				mapped = ".";
				break;
			case CC_LEFT_BRACKET:
				mapped = literal ? "\\[" : "[";
				break;
			case CC_RIGHT_BRACKET:
				mapped = literal ? "\\]" : "]";
				break;
			case CC_LEFT_BRACE:
				inGroup = !literal;
				mapped = literal ? "\\{" : "(";
				break;
			case CC_RIGHT_BRACE:
				inGroup = false;
				mapped = literal ? "\\}" : ")";
				break;
			case CC_BACKSLASH:
				if (!literal) continue;
				mapped = "\\\\";
				break;
			case CC_COMMA:
				mapped = inGroup ? "|" : "\\,";
				break;
			case CC_ASTERISK: {
				const atStart = i === 0;
				const afterSlash = !atStart && glob.charCodeAt(i - 1) === CC_SLASH;
				let starCount = 1;
				while (i + 1 < len && glob.charCodeAt(i + 1) === CC_ASTERISK) {
					starCount++;
					i++;
				}
				const atEnd = i + 1 === len;
				const beforeSlash = !atEnd && glob.charCodeAt(i + 1) === CC_SLASH;
				if (
					starCount > 1 &&
					(atStart || afterSlash) &&
					(atEnd || beforeSlash)
				) {
					// Globstar segment, matches zero or more path segments
					i++; // Move over the "/"
					if (i + 1 >= len) {
						mapped = GLOBSTAR_REST;
					} else if (
						reStr.endsWith(GLOBSTAR_SEGMENTS) &&
						literalStart === tokenStart
					) {
						// `**/**/` matches what one `**/` does
						mapped = "";
					} else {
						mapped = GLOBSTAR_SEGMENTS;
					}
				} else {
					// Not a globstar, matches one path segment
					mapped = "([^/]*)";
				}
				break;
			}
			default:
				// Literal character, extend the current run
				continue;
		}

		if (literalStart < tokenStart) {
			reStr += glob.slice(literalStart, tokenStart);
		}
		reStr += mapped;
		literalStart = i + 1;
	}

	if (literalStart < len) {
		reStr += literalStart === 0 ? glob : glob.slice(literalStart);
	}

	return reStr;
};

const CC_HYPHEN = 45; // "-"

/**
 * @param {number} cc char code
 * @returns {boolean} true for an ASCII hex digit
 */
const isHexDigit = (cc) =>
	(cc >= 48 && cc <= 57) || (cc >= 65 && cc <= 70) || (cc >= 97 && cc <= 102);

/**
 * @param {string} source regexp source
 * @param {number} start index after the opening "["
 * @returns {number} index of the closing "]", or -1 when the class is unclosed or holds a reversed range
 */
const readClass = (source, start) => {
	const len = source.length;
	let i = start;
	if (source.charCodeAt(i) === CC_CARET) i++;
	// Value of the atom at `i`, -1 for a set (`\d` and the like); moves `i` past it
	const readAtom = () => {
		const cc = source.charCodeAt(i++);
		if (cc !== CC_BACKSLASH) return cc;
		const next = source.charCodeAt(i++);
		switch (next) {
			case 100: // d
			case 68: // D
			case 115: // s
			case 83: // S
			case 119: // w
			case 87: // W
				return -1;
			case 98: // b
				return 8;
			case 102: // f
				return 12;
			case 110: // n
				return 10;
			case 114: // r
				return 13;
			case 116: // t
				return 9;
			case 118: // v
				return 11;
			case 120: // x
				if (
					isHexDigit(source.charCodeAt(i)) &&
					isHexDigit(source.charCodeAt(i + 1))
				) {
					i += 2;
					return Number.parseInt(source.slice(i - 2, i), 16);
				}
				return next;
			case 117: {
				// u
				let digits = 0;
				while (digits < 4 && isHexDigit(source.charCodeAt(i + digits))) {
					digits++;
				}
				if (digits < 4) return next;
				i += 4;
				return Number.parseInt(source.slice(i - 4, i), 16);
			}
			case 99: {
				// c
				const letter = source.charCodeAt(i);
				if (
					(letter >= 65 && letter <= 90) ||
					(letter >= 97 && letter <= 122) ||
					(letter >= 48 && letter <= 57) ||
					letter === 95
				) {
					i++;
					return letter % 32;
				}
				// A lone `\c` is a backslash; the `c` is the next atom
				i--;
				return CC_BACKSLASH;
			}
			default:
				if (next >= 48 && next <= 55) {
					// Legacy octal escape, up to `\377`
					let value = next - 48;
					const max = next <= 51 ? 2 : 1;
					for (let digits = 0; digits < max; digits++) {
						const digit = source.charCodeAt(i);
						if (digit < 48 || digit > 55) break;
						value = value * 8 + digit - 48;
						i++;
					}
					return value;
				}
				return next;
		}
	};
	while (i < len) {
		const cc = source.charCodeAt(i);
		if (cc === CC_RIGHT_BRACKET) return i;
		if (cc === CC_BACKSLASH && i + 1 >= len) return -1;
		const from = readAtom();
		if (
			source.charCodeAt(i) === CC_HYPHEN &&
			i + 1 < len &&
			source.charCodeAt(i + 1) !== CC_RIGHT_BRACKET
		) {
			i++;
			if (source.charCodeAt(i) === CC_BACKSLASH && i + 1 >= len) return -1;
			const to = readAtom();
			if (from !== -1 && to !== -1 && from > to) return -1;
		}
	}
	return -1;
};

/**
 * Whether `new RegExp(source)` would accept a source `translate` gave,
 * without building one.
 * @param {string} source regexp source
 * @returns {boolean} true when the source compiles
 */
const compiles = (source) => {
	const len = source.length;
	let depth = 0;
	for (let i = 0; i < len; i++) {
		const cc = source.charCodeAt(i);
		if (cc === CC_BACKSLASH) {
			if (++i >= len) return false;
		} else if (cc === CC_LEFT_PARENTHESIS) {
			depth++;
		} else if (cc === CC_RIGHT_PARENTHESIS) {
			if (--depth < 0) return false;
		} else if (cc === CC_LEFT_BRACKET) {
			i = readClass(source, i + 1);
			if (i === -1) return false;
		}
	}
	return depth === 0;
};

/**
 * @param {string} glob glob pattern
 * @returns {string} regexp source without anchors
 */
module.exports = (glob) => {
	if (typeof glob !== "string") {
		throw new TypeError("Expected a string");
	}

	const source = translate(glob, false);
	// An unbalanced or invalid bracket or brace: read those as the
	// characters they are rather than give a regexp that cannot compile.
	return compiles(source) ? source : translate(glob, true);
};
