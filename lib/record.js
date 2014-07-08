/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const util = require('util');

const stacktrace = require('stack-trace');
const Symbol = require('symbol');

const LEVELS = require('./levels');
const printf = require('./utils/printf');

const UNCAUGHT_SYMBOL = Symbol();
const LOG_VERSION = 1; // increment when log format changes
const HOSTNAME = require('os').hostname();

// stack formatter helper
function stack(e) {
  return {
    toString: function() {
      // first line is err.message, which we already show, so start from
      // second line
      return e.stack.substr(e.stack.indexOf('\n'));
    },
    toJSON: function() {
      return stacktrace.parse(e);
    }
  };
}

function lazy(proto, name, fn) {
  Object.defineProperty(proto, name, {
    configure: true,
    enumerable: true,
    get: function lazyGetter() {
      var val = fn.call(this);
      return this[name] = val;
    }
  });
}

function Trace(fn) {
  Error.captureStackTrace(this, fn);
}

Trace.prototype.toJSON = function() {
  return '[object Trace]';
};

function Record(name, level, args) {
  this.name = name;
  this.level = level;
  this.levelname = LEVELS.getLevelName(level);
  this.args = args;
  this.pid = process.pid;
  this.host = HOSTNAME;
  this.v = LOG_VERSION;

  var i = args.length;
  var trace;
  var isErr = false;
  while (i--) {
    var a = args[i];
    if (a && ((isErr = util.isError(a)) || a instanceof Trace)) {
      trace = a;
      break;
    }
  }
  this.exception = isErr;
  this.uncaughtException = isErr ? trace[UNCAUGHT_SYMBOL] : undefined;
  this.stack = trace ? stack(trace) : undefined;
}

lazy(Record.prototype, 'timestamp', function() {
  return new Date();
});

lazy(Record.prototype, 'message', function() {
  var args = this.args;
  var message = args[0];
  var isString = typeof message === 'string';
  if (!isString || args.length > 1) {
    if (!isString) {
      args = new Array(this.args.length + 1);
      args[0] = '%?';
      var i = args.length - 1;
      while (i--) {
        args[i + 1] = this.args[i];
      }
    }
    message = printf.apply(null, args);
  }
  return message;
});

Record.prototype.toJSON = function toJSON() {
  var json = {};
  var keys = Object.keys(this);
  var i = keys.length;
  while (i--) {
    var key = keys[i];
    if (key === 'args') {
      json.message = this[key];
    } else {
      json[key] = this[key];
    }
  }
  return json;
};

Record._Trace = Trace;
Record._UNCAUGHT_SYMBOL = UNCAUGHT_SYMBOL;
module.exports = Record;