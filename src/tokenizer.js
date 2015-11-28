/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import {EOF} from './special-symbols';

/**
 * A simple tokenizer that extracts tokens from the string,
 * based on the tokens from the grammar.
 *
 * We don't implement raw NFA/DFA here, rather use underlying
 * regexp implementaiton, however the tokenizer can easily be
 * replaced with any other custom implementation when is passed
 * to the parser.
 */
export default class Tokenizer {

  /**
   * Creates a tokenizer instance for a string
   * that belongs to the given grammar.
   */
  constructor({string, grammar}) {
    this._string = string + EOF;
    this._cursor = 0;
    this._grammar = grammar;
    this._lexRules = this._grammar.getLexRules();
  }

  getTokens() {
    if (!this._tokens) {
      this._tokens = [];
      while (this.hasMoreTokens()) {
        this._tokens.push(this.getNextToken());
      }
    }
    return this._tokens;
  }

  /**
   * Returns next token.
   */
  getNextToken() {
    if (!this.hasMoreTokens()) {
      return null;
    } else if (this.isEOF()) {
      this._cursor++;
      return {
        type: EOF,
        value: EOF,
      };
    }

    // Analyze untokenized yet part of the string starting from
    // the current cursor position (so all regexp are from ^).
    let string = this._string.slice(this._cursor);

    for (let lexRule of this._grammar.getLexRules()) {
      let matched = this._match(string, lexRule.getMatcher());
      if (matched) {
        let token = lexRule.getToken();

        // Usually whitespaces, etc.
        if (token.isSkip()) {
          return this.getNextToken();
        }

        return {
          type: token.getSymbol(),
          value: token.isTerminal()
            ? token.getSymbol()
            : matched,
        };
      }
    }

    throw new Error(`Unexpected token: "${string[0]}".`);
  }

  isEOF() {
    return this._string[this._cursor] === EOF;
  }

  hasMoreTokens() {
    return this._cursor < this._string.length;
  }

  /**
   * Generic tokenizing based on current regexp.
   */
  _match(string, regexp) {
    let matched = string.match(regexp);
    if (matched) {
      this._cursor += matched[0].length;
      return matched[0];
    }
    return null;
  }
};
