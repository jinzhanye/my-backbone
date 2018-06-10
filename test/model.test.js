const Backbone = require('./backbone-fe');
// const Backbone = require('../backbone');
const _ = require('underscore');

let ProxyModel = Backbone.Model.extend();
let Klass = Backbone.Collection.extend({
    url: function () {
        return '/collection';
    }
});
let doc;
let collection;

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
describe('Backbone.Model', () => {
    beforeEach(() => {
        doc = new ProxyModel({
            id: '1-the-tempest',
            title: 'The Tempest',
            author: 'Bill Shakespeare',
            length: 123
        });
        collection = new Klass();
        collection.add(doc);
    });

    it('initialize', () => {
        expect.assertions(3);
        let Model = Backbone.Model.extend({
            initialize() {
                this.one = 1;
                expect(this.collection).toBe(collection);
            }
        });
        let model = new Model({}, {collection: collection});
        expect(model.one).toBe(1);
        expect(model.collection).toBe(collection);
    });

    it('Object.prototype properties are overridden by attributes', () => {
        expect.assertions(1);
        let model = new Backbone.Model({hasOwnProperty: true});
        expect(model.get('hasOwnProperty')).toBe(true);
    });

    it('initialize with attributes and options', () => {
        expect.assertions(1);
        let Model = Backbone.Model.extend({
            initialize: function (attributes, options) {
                this.one = options.one;
            }
        });
        // new Model(attributes,options);
        let model = new Model({}, {one: 1});
        expect(model.one).toBe(1);
    });

    it('initialize with parsed attributes', () => {
        expect.assertions(1);
        let Model = Backbone.Model.extend({
            parse: function (attrs) {
                attrs.value += 1;
                return attrs;
            }
        });
        let model = new Model({value: 1}, {parse: true});
        expect(model.get('value')).toBe(2);
    });

    it('parse can return null', () => {
        expect.assertions(1);
        var Model = Backbone.Model.extend({
            parse: function (attrs) {
                attrs.value += 1;
                return null;
            }
        });
        var model = new Model({value: 1}, {parse: true});
        expect(JSON.stringify(model.toJSON())).toBe('{}');
    });

    it('url', () => {
        expect.assertions(3);
        doc.urlRoot = null;
        expect(doc.url()).toBe('/collection/1-the-tempest');

        doc.collection.url = '/collection/';
        expect(doc.url()).toBe('/collection/1-the-tempest');

        doc.collection = null;
        expect(() => {
            doc.url();
        }).toThrow();
        doc.collection = collection;
    });

    it('url when using urlRoot, and uri encoding', () => {
        expect.assertions(2);
        let Model = Backbone.Model.extend({
            urlRoot: '/collection'
        });
        let model = new Model();
        expect(model.url()).toBe('/collection');
        model.set({id: '+1+'});
        expect(model.url()).toBe('/collection/%2B1%2B');
    });

    it('url when using urlRoot as a function to determine urlRoot at runtime', () => {
        expect.assertions(2);
        var Model = Backbone.Model.extend({
            urlRoot: function () {
                return '/nested/' + this.get('parentId') + '/collection';
            }
        });

        var model = new Model({parentId: 1});
        expect(model.url()).toBe('/nested/1/collection');
        model.set({id: 2});
        expect(model.url()).toBe('/nested/1/collection/2');
    });

    // TODO
    it('underscore methods', () => {
        // expect.assertions(5);
        // let model = new Backbone.Model({foo: 'a', bar: 'b', baz: 'c'});
        // let model2 = model.clone();
        // expect(model.keys()).toEqual(['foo', 'bar', 'baz']);
        // expect(model.values()).toEqual(['a', 'b', 'c']);
        // expect(model.invert()).toEqual({a: 'foo', b: 'bar', c: 'baz'});
        // expect(model.pick('foo', 'baz')).toEqual({foo: 'a', baz: 'c'});
        // expect(model.omit('foo', 'bar')).toEqual({baz: 'c'});
    });

    it('chain', () => {

    });

    it('clone', () => {
        expect.assertions(10);
        let a = new Backbone.Model({foo: 1, bar: 2, baz: 3});
        let b = a.clone();

        expect(a.get('foo')).toBe(1);
        expect(a.get('bar')).toBe(2);
        expect(a.get('baz')).toBe(3);
        expect(a.get('foo')).toBe(b.get('foo'));
        expect(a.get('bar')).toBe(b.get('bar'));
        expect(a.get('baz')).toBe(b.get('baz'));
        a.set({foo: 100});
        expect(a.get('foo')).toBe(100);
        expect(b.get('foo')).toBe(1);

        let foo = new Backbone.Model({p: 1});
        let bar = new Backbone.Model({p: 2});
        bar.set(foo.clone().attributes, {unset: true});
        expect(foo.get('p')).toBe(1);
        expect(bar.get('p')).toBe(undefined);
    });

    it('isNew', () => {
        expect.assertions(6);
        let a = new Backbone.Model({foo: 1, bar: 2, baz: 3});
        expect(a.isNew()).toBeTruthy();
        a = new Backbone.Model({foo: 1, bar: 2, baz: 3, id: -5});
        expect(!a.isNew()).toBeTruthy();
        a = new Backbone.Model({foo: 1, bar: 2, baz: 3, id: 0});
        expect(!a.isNew()).toBeTruthy();
        expect(new Backbone.Model().isNew()).toBeTruthy();
        expect(!new Backbone.Model({id: 2}).isNew()).toBeTruthy();
        expect(!new Backbone.Model({id: -5}).isNew()).toBeTruthy();
    });

    it('escape', () => {
        expect.assertions(5);
        expect(doc.escape('title')).toBe('The Tempest');
        doc.set({audience: 'Bill & Bob'});
        expect(doc.escape('audience')).toBe('Bill &amp; Bob');
        doc.set({audience: 'Bill > Bob'});
        expect(doc.escape('audience')).toBe('Bill &gt; Bob');
        doc.set({audience: 10101});
        expect(doc.escape('audience')).toBe('10101');
        doc.unset('audience');
        expect(doc.escape('audience')).toBe('');
    });

    // it('matches', () => {
    //     expect.assertions(4);
    //     let model = new Backbone.Model();
    //
    //     expect(model.matches({name:'Jonas',cool:true})).toBe(false);
    //
    //     model.set({name: 'Jonas', cool: true});
    // });

    it('set and unset', () => {
        expect.assertions(8);
        let a = new Backbone.Model({id: 'id', foo: 1, bar: 2, baz: 3});
        let changeCount = 0;
        a.on('change:foo', function () {
            changeCount += 1;
        });
        a.set({foo: 2});
        expect(a.get('foo')).toBe(2);
        expect(changeCount).toBe(1);
        // set with value that is not new shouldn't fire change event
        a.set({foo: 2});
        expect(a.get('foo')).toBe(2);
        expect(changeCount).toBe(1);

        a.validate = function (attrs) {
            expect(attrs.foo).toBe(void 0);
        };
        a.unset('foo', {validate: true});
        expect(a.get('foo')).toBe(void 0);
        delete a.validate;
        expect(changeCount).toBe(2);

        a.unset('id');
        expect(a.id).toBe(undefined);
    });

    it('set triggers changes in the correct order', () => {
        let value = null;
        let model = new Backbone.Model;
        model.on('last', function () {
            value = 'last';
        });
        model.on('first', function () {
            value = 'first';
        });
        model.trigger('first');
        model.trigger('last');
        expect(value).toBe('last');
    });

    it('nested set triggers with the correct options', () => {
        let model = new Backbone.Model();
        let o1 = {};
        let o2 = {};
        let o3 = {};
        model.on('change', function (__, options) {
            switch (model.get('a')) {
                case 1:
                    expect(options).toBe(o1);
                    return model.set('a', 2, o2);
                case 2:
                    expect(options).toBe(o2);
                    return model.set('a', 3, o3);
                case 3:
                    expect(options).toBe(o3);
            }
        });
        model.set('a', 1, o1);
    });

    // Backbone.sync
    // -------------
    it('save within change event', () => {
        expect.assertions(1);
        let env = this;
        let model = new Backbone.Model({firstName: 'Jane', lastName: 'Eyre'});
        model.url = '/test';
        model.on('change', function () {
            model.save();
            expect(_.isEqual(env.syncArgs.model, model)).toBeTruthy();
        });
        model.set({lastName: 'Docker'});
    });

    it('validate after save', () => {
        expect.assertions(2);
        let lastError;
        let model = new Backbone.Model();
        model.validate = function (attrs) {
            if (attrs.admin) {
                return 'Cant\'t change admin status';
            }
        };
        model.sync = function (method, m, options) {
            options.success.call(this, {admin: true});
        };
        model.on('invalidate', function (m, error) {
            lastError = error;
        });
        model.save(null);

        expect(lastError).toBe('Cant\'t change admin status');
        expect(model.validationError).toBe('Cant\'t change admin status');
    });

    it('save', () => {
        expect.assertions(2);
        doc.save({title: 'Henry V'});
        expect(this.syncArgs.method).toBe('update');
        expect(_.isEqual(this.syncArgs.model, doc)).toBeTruthy();
    });

    it('save, fetch, destroy triggers error event when an errors occurs', () => {
        expect.assertions(3);
        let model = new Backbone.Model();
        model.on('error', function () {
            expect(true).toBeTruthy();
        });
        model.sync = function (method, model, options) {
            options.error();
        };
        model.save({data: 2, id: 2});
        model.fetch();
        model.destroy();
    });

    it('save in positional style', () => {
        expect.assertions(1);
        let model = new Backbone.Model();
        model.sync = function (method, model, options) {
            options.success();
        };
        model.save('title', 'Twelfth Night');
        expect(model.get('title')).toBe('Twelfth Night');
    });

    it('save with non-object success response', () => {
        expect.assertions(2);
        let model = new Backbone.Model();
        model.sync = function (method, m, options) {
            options.success('', options);
            options.success(null, options);
        };
        model.save({testing: 'empty'}, {
            success: function (model) {
                expect(model.attributes).toEqual({testing: 'empty'});
            }
        });
    });

    it('save with wait and supplied id', () => {
        let Model = Backbone.Model.extend({
            urlRoot: '/collection'
        });
        let model = new Model();
        model.save({id: 42}, {wait: true});
        expect(this.ajaxSettings.url).toBe('/collection/42');
    });

    it('save will pass extra options to success callback', () => {
        expect.assertions(1);
        let SpecialSyncModel = Backbone.Model.extend({
            sync: function (method, model, options) {
                _.extend(options, {specialSync: true});
                return Backbone.Model.prototype.sync.call(this, method, model, options);
            },
            urlRoot:'/test'
        });

        let model = new SpecialSyncModel();
        let onSuccess = function (model, response, options) {
            expect(options.specialSync).toBeTruthy();
        };

        model.save(null, {success: onSuccess});
        this.ajaxSettings.success();
    });
});
