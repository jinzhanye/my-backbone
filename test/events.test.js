const Backbone = require('./backbone-fe');
// const Backbone = require('../backbone');
const _ = require('underscore');

describe('Backbone.Events', function () {
    it('on and trigger', function () {
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

    it('binding and triggering multiple events', function () {
        expect.assertions(4);
        let obj = {counter: 0};
        _.extend(obj, Backbone.Events);
        obj.on('a b c', () => {
            obj.counter += 1;
            console.log(obj.counter);
        });

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
});