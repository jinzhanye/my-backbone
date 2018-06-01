const Backbone = require('./backbone-fe');
// const Backbone = require('../backbone');
const _ = require('underscore');

describe('Backbone.Events', () => {
    it('on and trigger', () => {
        expect.assertions(2);//表明这个case有两个断言
        let obj = {counter: 0};
        _.extend(obj, Backbone.Events);
        obj.on('event', function () {
            obj.counter += 1;
        });
        obj.trigger('event');
        expect(obj.counter).toBe(1);
        obj.trigger('event');
        obj.trigger('event');
        obj.trigger('event');
        obj.trigger('event');
        expect(obj.counter).toBe(5);
    });

    it('binding and triggering multiple events', () => {
        expect.assertions(4);
        let obj = {counter: 0};
        _.extend(obj, Backbone.Events);
        obj.on('a b c', () => obj.counter += 1);

        obj.trigger('a');
        expect(obj.counter).toBe(1);

        obj.trigger('a b');
        expect(obj.counter).toBe(3);

        obj.trigger('c');
        expect(obj.counter).toBe(4);

        obj.off('a c');
        obj.trigger('a b c');
        expect(obj.counter).toBe(5);
    });

    it('binding and trigger with event maps', () => {
        let obj = {counter: 0};
        _.extend(obj, Backbone.Events);

        let increment = function () {
            this.counter += 1;
        };

        obj.on({
            a: increment,
            b: increment,
            c: increment
        }, obj);// 第二个参数绑定context

        obj.trigger('a');
        expect(obj.counter).toBe(1);

        obj.trigger('a b');
        expect(obj.counter).toBe(3);

        obj.trigger('c');
        expect(obj.counter).toBe(4);

        obj.off({
            a: increment,
            c: increment,
        }, obj);

        obj.trigger('a b c');
        expect(obj.counter).toBe(5);
    });

    it('binding and triggering multiple event names with event maps', () => {
        let obj = {counter: 0};
        _.extend(obj, Backbone.Events);

        let increment = function () {
            this.counter += 1;
        };

        obj.on({'a b c': increment});

        obj.trigger('a');
        expect(obj.counter).toBe(1);

        obj.trigger('a b');
        expect(obj.counter).toBe(3);

        obj.trigger('c');
        expect(obj.counter).toBe(4);

        obj.off({'a c': increment});

        obj.trigger('a b c');
        expect(obj.counter).toBe(5);
    });
});