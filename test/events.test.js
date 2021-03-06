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

    it('binding and trigger with event maps context', () => {
        expect.assertions(2);
        let obj = {counter: 0};
        let context = {color: 'blue'};
        _.extend(obj, Backbone.Events);

        // 当以对象的方式绑定事件时，context时既可以是第二个参数，也可以是第三个参数(这种情况下第二个参数会被忽略)
        obj.on({
            a: function () {
                expect(this).toBe(context);
            }
        }, context).trigger('a');// 源代码第99行，将原来第二参数为callback处理为context

        obj.off()
            .on({
                a: function () {
                    expect(this).toBe(context);
                }
            }, this, context).trigger('a');// 源代码第118行处理context参数
    });

    it('listenTo and stopListening', () => {
        expect.assertions(1);
        let a = _.extend({}, Backbone.Events);
        let b = _.extend({}, Backbone.Events);
        // *为什么Backbone.Events会有listenTo和stopListening,在很多的类库中使用的事件机制都是没有这两个方法的功能。
        // 这两个方法更像是专为view,model而生的。
        // 通过这两个方法可以方便的对view相关的对象监听事件进行跟踪，解绑。
        a.listenTo(b, 'all', function () {
            expect(true).toBeTruthy();
        });
        b.trigger('anything');
        a.listenTo(b, 'all', function () {
            expect(false).toBeTruthy();
        });
        a.stopListening();
        b.trigger('anything');
    });

    it('listenTo and stopListening with event maps', () => {
        expect.assertions(4);
        let a = _.extend({}, Backbone.Events);
        let b = _.extend({}, Backbone.Events);
        let cb = function () {
            expect(true).toBeTruthy();
        };
        a.listenTo(b, {event: cb});
        b.trigger('event');// 1
        a.listenTo(b, {event2: cb});
        b.on('event2', cb);
        a.stopListening(b, {event2: cb});// 只解除a监听b的cb，b监听event2不会被解除
        b.trigger('event event2');//event有一个handle event2有一个handle，所以callback触发 2次
        a.stopListening();// 解除a监听b的event事件
        b.trigger('event event2');// 触发event2，所以共触发cb次数：1 + 2 + 1 = 4
    });

    it('stopListening with omitted args', () => {
        expect.assertions(2);
        let a = _.extend({}, Backbone.Events);
        let b = _.extend({}, Backbone.Events);
        let cb = function () {
            expect(true).toBeTruthy();
        };
        a.listenTo(b, 'event', cb);
        a.listenTo(b, 'event2', cb);
        b.on('event', cb);
        a.stopListening(null, {event: cb});

        b.trigger('event event2');// 2次触发 , b.on('event', cb); a.listenTo(b, 'event2', cb);

        b.off();
        a.listenTo(b, 'event event2', cb);
        a.stopListening(null, 'event');
        a.stopListening();

        b.trigger('event2');//0
    });

    it('listenToOnce', () => {
        // Same as the previous test, but we use once rather than having to explicitly unbind
        expect.assertions(2);
        let obj = {counterA: 0, counterB: 0};
        _.extend(obj, Backbone.Events);
        let incrA = function () {
            obj.counterA += 1;
            obj.trigger('event');
        };
        let incrB = function () {
            obj.counterB += 1;
        };
        obj.listenToOnce(obj, 'event', incrA);
        obj.listenToOnce(obj, 'event', incrB);
        obj.trigger('event');
        expect(obj.counterA).toBe(1);
        expect(obj.counterA).toBe(1);
    });

    it('listenToOnce and stopListening', () => {
        expect.assertions(1);
        let a = _.extend({}, Backbone.Events);
        let b = _.extend({}, Backbone.Events);
        a.listenToOnce(b, 'all', function () {
            expect(true).toBeTruthy();
        });
        b.trigger('anything');
        b.trigger('anything');
        a.listenToOnce(b, 'all', function () {
            expect(false).toBeTruthy();
        });
        a.stopListening();
        b.trigger('anything');
    });

    it('listenTo and stopListening with event maps', () => {
        expect.assertions(1);
        let a = _.extend({}, Backbone.Events);
        let b = _.extend({}, Backbone.Events);
        a.listenToOnce(b, {
            change: function () {
                expect(true).toBeTruthy();
            }
        });
        b.trigger('change');
        a.listenToOnce(b, {
            change: function () {
                expect(false).toBeTruthy();
            }
        });
        a.stopListening();
        b.trigger('change');
    });

    it('listenTo yourself', () => {
        expect.assertions(1);
        let a = _.extend({}, Backbone.Events);
        a.listenTo(a, 'foo', function () {
            expect(true).toBeTruthy();
        });
        a.trigger('foo');
    });

    it('listenTo yourself cleans yourself up with stopListening', () => {
        expect.assertions(1);
        let a = _.extend({}, Backbone.Events);
        a.listenTo(a, 'foo', function () {
            expect(true).toBeTruthy();
        });
        a.trigger('foo');
        a.stopListening();
        a.trigger('foo');
    });

    it('stopListening cleans up references', () => {
        expect.assertions(12);
        let a = _.extend({}, Backbone.Events);
        let b = _.extend({}, Backbone.Events);
        var fn = function () {
        };
        b.on('event', fn);
        //
        a.listenTo(b, 'event', fn).stopListening();
        expect(_.size(a._listeningTo)).toBe(0);
        expect(_.size(b._events.event)).toBe(1);
        expect(_.size(b._listeners)).toBe(0);
        //
        a.listenTo(b, 'event', fn).stopListening(b);
        expect(_.size(a._listeningTo)).toBe(0);
        expect(_.size(b._events.event)).toBe(1);
        expect(_.size(b._listeners)).toBe(0);
        //
        a.listenTo(b, 'event', fn).stopListening(b, 'event');
        expect(_.size(a._listeningTo)).toBe(0);
        expect(_.size(b._events.event)).toBe(1);
        expect(_.size(b._listeners)).toBe(0);
        //
        a.listenTo(b, 'event', fn).stopListening(b, 'event', fn);
        expect(_.size(a._listeningTo)).toBe(0);
        expect(_.size(b._events.event)).toBe(1);
        expect(_.size(b._listeners)).toBe(0);
    });

    it('stopListening cleans up references from listenToOnce', () => {
        expect.assertions(12);
        let a = _.extend({}, Backbone.Events);
        let b = _.extend({}, Backbone.Events);
        var fn = function () {
        };
        b.on('event', fn);
        //
        a.listenToOnce(b, 'event', fn).stopListening();
        expect(_.size(a._listeningTo)).toBe(0);
        expect(_.size(b._events.event)).toBe(1);
        expect(_.size(b._listeners)).toBe(0);
        //
        a.listenToOnce(b, 'event', fn).stopListening(b);
        expect(_.size(a._listeningTo)).toBe(0);
        expect(_.size(b._events.event)).toBe(1);
        expect(_.size(b._listeners)).toBe(0);
        //
        a.listenToOnce(b, 'event', fn).stopListening(b, 'event');
        expect(_.size(a._listeningTo)).toBe(0);
        expect(_.size(b._events.event)).toBe(1);
        expect(_.size(b._listeners)).toBe(0);
        //
        a.listenToOnce(b, 'event', fn).stopListening(b, 'event', fn);
        expect(_.size(a._listeningTo)).toBe(0);
        expect(_.size(b._events.event)).toBe(1);
        expect(_.size(b._listeners)).toBe(0);
    });

    it('listenTo and off cleaning up references', () => {
        expect.assertions(8);
        let a = _.extend({}, Backbone.Events);
        let b = _.extend({}, Backbone.Events);
        var fn = function () {
        };
        b.on('event', fn);
        //
        a.listenToOnce(b, 'event', fn);
        b.off();
        expect(_.size(a._listeningTo)).toBe(0);
        expect(_.size(b._listeners)).toBe(0);
        //
        a.listenToOnce(b, 'event', fn);
        b.off('event');
        expect(_.size(a._listeningTo)).toBe(0);
        expect(_.size(b._listeners)).toBe(0);
        //
        a.listenToOnce(b, 'event', fn);
        b.off(null, fn);
        expect(_.size(a._listeningTo)).toBe(0);
        expect(_.size(b._listeners)).toBe(0);
        //
        a.listenToOnce(b, 'event', fn);
        b.off(null, null, a);
        expect(_.size(a._listeningTo)).toBe(0);
        expect(_.size(b._listeners)).toBe(0);
    });

    it('listenTo and stopListening cleaning up references', () => {
        expect.assertions(2);
        let a = _.extend({}, Backbone.Events);
        let b = _.extend({}, Backbone.Events);
        a.listenTo(b, 'all', function () {
            expect(true).toBeTruthy();
        });
        b.trigger('anything');
        a.listenTo(b, 'other', function () {
            expect(false).toBeTruthy();
        });
        a.stopListening(b, 'other');
        a.stopListening(b, 'all');
        expect(_.size(a._listeningTo)).toBe(0);
    });

    it('listenTo with empty callback doesn\'t throw an error', () => {
        expect.assertions(1);
        let e = _.extend({}, Backbone.Events);
        e.listenTo(e, 'foo', null);
        e.trigger('foo');
        expect(true).toBeTruthy();
    });

    it('bind a callback with a default context when none supplied', () => {
        expect.assertions(1);
        let obj = _.extend({
            assertTrue: function () {
                expect(this).toBe(obj)
            }
        }, Backbone.Events);

        obj.once('event', obj.assertTrue);
        obj.trigger('event');
    });

    it('if callback is truthy but not a function, `on` should throw an error just like jQuery', () => {
        expect.assertions(1);
        var view = _.extend({}, Backbone.Events).on('test', 'noop');
        expect(() => {
            view.trigger('test');
        }).toThrow();
    });

});
