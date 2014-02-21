var expect = require('chai').expect;
var test = require('./lib/test.js');
var getFixture = require('./lib/getFixture.js');
var compile = require('../index.js');

describe('Partials', function() {
  it('should pass current data context to partials if no arguments provided', function() {
    var data = { name: 'The Name', description: 'The description.' };
    test({
      fixture: 'Partial without args',
      data: data,
      globals: {
        myPartial: compile(getFixture('Name and description'))
      },
      done: function($) {
        expect($('h1').text()).to.equal(data.name);
        expect($('p').text()).to.equal(data.description);
      }
    });
  });

  it('should pass arguments to partials', function() {
    var data = { info: { name: 'The Name', description: 'The description.' } };
    test({
      fixture: 'Partial with args',
      data: data,
      globals: {
        myPartial: compile(getFixture('Name and description'))
      },
      done: function($) {
        expect($('h1').text()).to.equal(data.info.name);
        expect($('p').text()).to.equal(data.info.description);
      }
    });
  });

  it('should invoke partials on current context with this.myPartial', function() {
    var data = { info: { name: 'The Name', description: 'The description.' } };
    test({
      fixture: 'Partial on context object',
      data: data,
      obj: {
        myPartial: compile(getFixture('Name and description'))
      },
      done: function($) {
        expect($('h1').text()).to.equal(data.info.name);
        expect($('p').text()).to.equal(data.info.description);
      }
    });
  });

  it('should invoke partials on data with data.myPartial', function() {
    var data = {
      info: { name: 'The Name', description: 'The description.' },
      myPartial: compile(getFixture('Name and description'))
    };
    test({
      fixture: 'Partial on data object',
      data: data,
      done: function($) {
        expect($('h1').text()).to.equal(data.info.name);
        expect($('p').text()).to.equal(data.info.description);
      }
    });
  });
});