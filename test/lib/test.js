var path = require('path');
var fs = require('fs');
var expect = require('chai').expect;
var domly = require('../../index.js');
var precompile = domly.precompile;
var compile = domly.compile;
var getFixture = require('./getFixture.js');
var jsdom = require('jsdom');
var jquery = fs.readFileSync(path.join(__dirname, '..', '..', 'bower_components', 'jquery', 'dist', 'jquery.js'), 'utf-8');

var html = '<html><head></head><body></body></html>';

function test(options) {
  if (!options.options) {
    options.options = {};
  }

  // Shortcut to enable debugging
  if (options.debug) {
    options.options.debug = true;
  }

  function doCompile() {
    functionText = precompile(fixture, options.options);
    template = compile(fixture, options.options);
  }

  var fixture = getFixture(options.fixture);
  var functionText = '';
  var template;

  if (options.throwOnCompile) {
    return expect(doCompile).to.Throw(Error);
  }

  doCompile();

  jsdom.env({
    html: html,
    src: [jquery],
    done: function (errors, window) {
      var prop;

      var document = global.document = window.document;
      var $ = global.$ = window.$;

      // Set globals
      if (options.globals) {
        for (prop in options.globals) {
          // Execute the method and set the property to its result
          if (prop.indexOf('_exec_') === 0 && typeof prop === 'function') {
            options.globals[prop]();
          }
          else {
            global[prop] = options.globals[prop];
          }
        }
      }

      if (options.exec) {
        options.exec();
      }

      var frag;
      if (options.throwOnRender) {
        return expect(function() {
          frag = template.call(options.obj, options.data);
        }).to.Throw(Error);
      }
      else {
        try {
          frag = template.call(options.obj, options.data);
        }
        catch (error) {
          // Get the line number
          var errorLine = (error.stack+'').split('\n')[1];
          var lineAndChar = errorLine.slice(errorLine.indexOf('<anonymous>') + 12, errorLine.length - 1).split(':');

          // Kill the stack
          error.stack = '';

          // Reset colors
          error.message += '\033[0m';

          // Add the template body and highlight the offending line
          error.message += '\n\n'+template.toString().split('\n').map(function(line, index) {
            line = '\t'+line;
            if (index === lineAndChar[0] - 1) {
              return '\033[31m'+line+'\033[0m';
            }
            return line;
          }).join('\n');

          throw error;
        }
      }

      document.body.appendChild(frag);

      if (options.options.debug) {
        console.log('Output HTML:');
        console.log(document.body.innerHTML);
      }

      options.done($, fixture, template, functionText, root, document, window);

      // Unset globals
      if (options.globals) {
        for (prop in options.globals) {
          delete global[prop];
        }
      }
    }
  });
}

module.exports = test;
