const Backbone = require('./backbone-fe');
// const Backbone = require('../backbone');
const _ = require('underscore');

let Library = Backbone.Collection.extend({
    url: function () {
        return '/library';
    }
});
let library;
let attrs = {
    title: 'The Tempest',
    author: 'Bill Shakespeare',
    length: 123
};

let sync = Backbone.sync;
let ajax = Backbone.ajax;
const env = this;
Backbone.ajax = function (settings) {
    env.ajaxSettings = settings;
};

Backbone.sync = function (method, model, options) {
    env.syncArgs = {
        method: method,
        model: model,
        options: options
    };
    sync.apply(this, arguments);
};

describe('Backbone.sync', () => {
    beforeEach(() => {
        library = new Library;
        library.create(attrs, {wait: false});
    });

    afterEach(() => {
        Backbone.emulateHTTP = false;
    });

    it('read', () => {
        expect.assertions(4);
        library.fetch();
        expect(this.ajaxSettings.url).toBe('/library');
        expect(this.ajaxSettings.type).toBe('GET');
        expect(this.ajaxSettings.dataType).toBe('json');
        expect(_.isEmpty(this.ajaxSettings.data)).toBeTruthy();
    });
});