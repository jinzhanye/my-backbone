const Backbone = require('./backbone-fe');
// const Backbone = require('../backbone');
const _ = require('underscore');
const $ = require('jquery');

let view;

describe('Backbone.View', () => {
    beforeEach(() => {
        document.body.innerHTML =
            '<div id="jest"></div>' +
            '<div id="jest-fixture"></div>';

        $('#jest-fixture').append(
            '<div id="testElement"><h1>Test</h1></div>'
        );

        view = new Backbone.View({
            id: 'test-view',
            className: 'test-view',
            other: 'non-special-option'
        })
    });

    afterEach(() => {
        $('#jest-fixture').remove();
        $('#test-view').remove();
    });

    it('constructor', () => {
        expect.assertions(3);
        expect(view.el.id).toBe('test-view');
        expect(view.el.className).toBe('test-view');
        expect(view.el.other).toBeUndefined();
    });

    it('$', () => {
        expect.assertions(2);
        let myView = new Backbone.View;
        myView.setElement('<p><a><b>test</b></a></p>');
        let result = myView.$('a b');

        expect(result[0].innerHTML).toBe('test');
        // 为什么要做这个断言??
        expect(result.length === +result.length).toBeTruthy();
    });
});