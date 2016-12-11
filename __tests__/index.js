const babel = require('babel-core');

const customMatchers = {
  toBeTransformedTo: () => {
    const transformAmdToCommonJS = (code) => {
      return babel.transform(code, { plugins: ['./index'] }).code;
    };

    const transformTrivial = (code) => {
      return babel.transform(code).code;
    };

    const removeBlankLines = (string) => {
      return string.split('\n').filter(line => !!line.trim().length).join('\n');
    };

    return {
      compare(actual, expected) {
        const transformed = transformAmdToCommonJS(actual);
        actual = removeBlankLines(transformTrivial(actual));
        expected = removeBlankLines(transformTrivial(expected));
        const result = {
          pass: removeBlankLines(transformed) === expected
        };
        if(result.pass) {
          result.message = `Expected\n\n${actual}\n\nnot to be transformed ` +
            `to\n\n${expected}\n\nbut instead they were the same.\n`;
        } else {
          result.message = `Expected\n\n${actual}\n\nto be transformed ` +
            `to\n\n${expected}\n\nbut instead got\n\n${transformed}\n`;
        }
        return result;
      }
    };
  }
};

describe('Plugin', () => {
  beforeEach(() => {
    jasmine.addMatchers(customMatchers);
  });

  it('transforms anonymous define blocks with one dependency', () => {
    expect(`
      define(['stuff'], function(donkeys) {
        return {
          llamas: donkeys.version
        };
      });
    `).toBeTransformedTo(`
      var donkeys = require('stuff');
      module.exports = function() {
        return {
          llamas: donkeys.version
        };
      }();
    `);
  });

  it('transforms anonymous define blocks with multiple dependencies', () => {
    expect(`
      define(['stuff', 'here'], function(donkeys, aruba) {
        return {
           llamas: donkeys.version,
           cows: aruba.hi
        };
      });
    `).toBeTransformedTo(`
      var donkeys = require('stuff');
      var aruba = require('here');
      module.exports = function() {
        return {
          llamas: donkeys.version,
          cows: aruba.hi
        };
      }();
    `);
  });

  it('transforms anonymous define blocks with unused dependencies', () => {
    expect(`
      define(['stuff', 'here'], function(donkeys) {
        return {
           llamas: donkeys.version
        };
      });
    `).toBeTransformedTo(`
      var donkeys = require('stuff');
      require('here');
      module.exports = function() {
        return {
          llamas: donkeys.version
        };
      }();
    `);
  });

  it('only transforms define blocks at the top level', () => {
    const program = `
      if(someDumbCondition) {
        define(['stuff'], function(stuff) {
          return { hi: 'world' };
        });
      }
    `;
    expect(program).toBeTransformedTo(program);
  });

  it('transforms require blocks with one dependency', () => {
    expect(`
      require(['llamas'], function(llama) {
        llama.doSomeStuff();
      });
    `).toBeTransformedTo(`
      var llama = require('llamas');
      (function() {
        llama.doSomeStuff();
      })();
    `);
  });

  it('transforms require blocks with multiple dependencies', () => {
    expect(`
      require(['llamas', 'frogs'], function(llama, frog) {
        llama.doSomeStuff();
        frog.sayRibbit();
      });
    `).toBeTransformedTo(`
      var llama = require('llamas');
      var frog = require('frogs');
      (function() {
        llama.doSomeStuff();
        frog.sayRibbit();
      })();
    `);
  });

  it('transforms require blocks with unused dependencies', () => {
    expect(`
      require(['llamas', 'frogs'], function(llama) {
        llama.doSomeStuff();
      });
    `).toBeTransformedTo(`
      var llama = require('llamas');
      require('frogs');
      (function() {
        llama.doSomeStuff();
      })();
    `);
  });

  it('transforms anonymous define blocks with no dependency list', () => {
    expect(`
      define(function() {
        return {
           llamas: 'donkeys'
        };
      });
    `).toBeTransformedTo(`
      module.exports = function() {
        return {
          llamas: 'donkeys'
        };
      }();
    `);
  });

  it('transforms dependencies listed as variables', () => {
    expect(`
      var dependency = 'hey';
      define([dependency], function(here) {
        return {
           llamas: here.hi
        };
      });
    `).toBeTransformedTo(`
      var dependency = 'hey';
      var here = require(dependency);
      module.exports = function() {
        return {
          llamas: here.hi
        };
      }();
    `);
  });

  it('transforms named define blocks with dependencies', () => {
    expect(`
      define('thismoduletho', ['hi'], function(here) {
        return {
           llamas: here.hi
        };
      });
    `).toBeTransformedTo(`
      var here = require('hi');
      module.exports = function() {
        return {
          llamas: here.hi
        };
      }();
    `);
  });

  it('transforms named define blocks with no dependency list', () => {
    expect(`
      define('thismoduletho', function() {
        return {
           llamas: 'they are fluffy'
        };
      });
    `).toBeTransformedTo(`
      module.exports = function() {
        return {
          llamas: 'they are fluffy'
        };
      }();
    `);
  });

  it('transforms require blocks that have no factory function', () => {
    expect(`
      require(['here', 'are', 'some', 'deps']);
    `).toBeTransformedTo(`
      require('here');
      require('are');
      require('some');
      require('deps');
    `);
  });

  it('does not require a dependency name `require`', () => {
    expect(`
      define(['require'], function(require) {
        var x = require('x');
      });
    `).toBeTransformedTo(`
      module.exports = function() {
        var x = require('x');
      }();
    `);
  });

  it('handles injection of dependency named `module`', () => {
    expect(`
      define(['module'], function(module) {
        module.exports = { hey: 'boi' };
      });
    `).toBeTransformedTo(`
      (function() {
        module.exports = { hey: 'boi' };
      })();
    `);
  });

  it('handles injection of dependency name `exports`', () => {
    expect(`
      define(['exports'], function(exports) {
        exports.hey = 'boi';
      });
    `).toBeTransformedTo(`
      (function() {
        exports.hey = 'boi';
      })();
    `);
  });

  it('transforms the simplified commonjs wrapper', () => {
    expect(`
      define(function(require, exports, module) {
        var stuff = require('hi');
        exports.hey = stuff.boi;
      });
    `).toBeTransformedTo(`
      (function() {
        var stuff = require('hi');
        exports.hey = stuff.boi;
      })();
    `);
    expect(`
      define(function(require, exports) {
        var stuff = require('hi');
        exports.hey = stuff.boi;
      });
    `).toBeTransformedTo(`
      (function() {
        var stuff = require('hi');
        exports.hey = stuff.boi;
      })();
    `);
  });

  it("lets you declare a dependency as `module` even though that's crazy", () => {
    expect(`
      define(['notmodule'], function(module) {
        return {
          notmodule: module.notmodule
        };
      });
    `).toBeTransformedTo(`
      var module = require('notmodule');
      module.exports = function() {
        return {
          notmodule: module.notmodule
        };
      }();
    `);
  });

  it("lets you declare a dependency as `exports` even though that's crazy", () => {
    expect(`
      define(['notexports'], function(exports) {
        return {
          notexports: exports.notexports
        };
      });
    `).toBeTransformedTo(`
      var exports = require('notexports');
      module.exports = function() {
        return {
          notexports: exports.notexports
        };
      }();
    `);
  });
});
