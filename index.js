var cheerio = require('cheerio');

var variableRE = /\{\{(.*?)\}\}/g;
var blankRE = /^[\s]*$/;
var debug = false;
var count;

function getVariableArray(string) {
  var array = [];
  var lastOffset = 0;

  string.replace(variableRE, function(match, p1, offset, string) {
    // Add intermediate text
    var text = string.slice(lastOffset, offset);
    if (text.length) {
      array.push(text);
    }

    // Add variables
    array.push({ variable: p1 });

    lastOffset = offset + match.length;

    return match;
  });

  // Add the last bit of text
  if (lastOffset !== string.length) {
    array.push(string.slice(lastOffset));
  }

  return array;
}

function isBlank(string) {
  return !!string.match(blankRE);
}

function makeVariableExpression(string) {
  if (!usesVariables(string)) {
    return safe(string);
  }

  var expression = '';
  var pieces = getVariableArray(string);
  pieces.forEach(function(piece, index) {
    // Concat pieces together
    if (index !== 0) {
      expression += '+';
    }

    if (typeof piece === 'string') {
      // Include text directly
      expression += safe(piece);
    }
    else {
      // Substitute variables
      expression += 'data['+safe(piece.variable)+']';
    }
  });

  return expression;
}

function safe(string) {
  return JSON.stringify(string);
}

function createElement(elName, tag, elHandle) {
  var statement = 'var '+elName+' = ';
  var handleUsesDollar;
  var elHandleBare;
  var handleProperty;

  if (elHandle) {
    handleUsesDollar = elHandle.charAt(0) === '$';
    elHandleBare = handleUsesDollar ? elHandle.slice(1) : elHandle;
    handleProperty = 'this['+safe(elHandleBare)+']';
  }

  if (elHandle) {
    statement += handleProperty+' = ';
  }
  statement += 'document.createElement("'+tag+'");\n';

  if (elHandle && handleUsesDollar) {
    statement += 'this['+safe(elHandle)+'] = $('+elName+');\n';
  }

  return statement;
}

function setAttribute(elName, attr, value) {
  return elName+'.setAttribute('+safe(attr)+', '+makeVariableExpression(value)+');\n';
}

function setTextContent(elName, text) {
  return elName+'.textContent = '+makeVariableExpression(text)+';\n';
}

function usesVariables(string) {
  return string.match(variableRE);
}

function createTextNode(elName, text) {
  return 'var '+elName+' = document.createTextNode('+makeVariableExpression(text)+');\n';
}

function dataWrap(str) {
  return 'data['+safe(str)+']';
}

function buildFunctionBody($, el, options, parentName) {
  var func = '';
  var text;

  el.children.forEach(function(el) {
    var elName = 'el'+(count++);
    var doAppend = true;
    var needsClose = false;
    var elseEl;
    if (el.type === 'tag') {
      // Process special tags
      if (el.name === 'if') {
        // Anything inside of the if should be inserted in the parent
        elName = parentName;
        doAppend = false;
        needsClose = true;
        func += 'if ('+Object.keys(el.attribs).map(dataWrap).join('&&')+') {\n';

        // Find else statement
        elseEl = $(el).children('else');
        if (elseEl.length) {
          $(elseEl).remove();
        }
      }
      else {
        func += createElement(elName, el.name, el.attribs['data-handle']);

        var attrs = el.attribs;
        for (var attr in attrs) {
          // Skip internal handles
          if (attr === 'data-handle') {
            continue;
          }
          func += setAttribute(elName, attr, attrs[attr]);
        }
      }

      var children = el.children;
      if (children.length) {
        func += buildFunctionBody($, el, options, elName);
      }
      else {
        text = $(el).text();

        if (!(options.stripWhitespace && isBlank(text)) || text.length) {
          // Set text content directly if there are no children
          func += setTextContent(elName, text);
        }
      }

      if (needsClose) {
        func += '}\n';

        if (elseEl.length) {
          func += 'else {\n';
          func += buildFunctionBody($, elseEl[0], options, elName);
          func += '}\n';
        }
      }
    }
    else if (el.type === 'text') {
      text = $(el).text();

      // Don't include blank text nodes
      if ((options.stripWhitespace && isBlank(text)) || !text.length) {
        return;
      }

      func += createTextNode(elName, text);
    }

    if (parentName && doAppend) {
      func += parentName+'.appendChild('+elName+');\n';
    }
  });

  return func;
}

function indent(spaces) {
  return (new Array(spaces)).join('\t');
}

function prettyPrint(node, spaces) {
  var isFirst = spaces === undefined;

  spaces = spaces || 0;

  var name = node.type === 'tag' ? node.name : 'text';
  var desc = '';

  if (node.type === 'text') {
    desc = node.data;
  }
  else {
    for (var attr in node.attribs) {
      desc += attr+'='+node.attribs[attr]+' ';
    }
  }

  if (!isFirst) {
    console.log(indent(spaces), name, desc);
  }

  if (node.children) {
    node.children.forEach(function(child) {
      prettyPrint(child, spaces+1);
    })
  }
}

function compile(html, options) {
  var $ = cheerio.load('<div id="__template-root__">'+html+'</div>');

  var root = $('#__template-root__')[0];

  if (debug) {
    prettyPrint(root);
  }

  // Reset count
  count = 0;

  // Build function body
  var functionBody = buildFunctionBody($, root, options || {});

  if (root.children.length === 1) {
    // Return the root element, if there's only one
    functionBody += 'return el0;\n';
  }

  return new Function('data', functionBody);
}

module.exports = compile;
