(function (factory) {
    // ************识别不同的运行环境**************

    // Establish the root object, `window` (`self`) in the browser, or `global` on the server.
    // We use `self` instead of `window` for `WebWorker` support.
    var root = (typeof self == 'object' && self.self === self && self) ||
        (typeof global == 'object' && global.global === global && global);

    // Set up Backbone appropriately for the environment. Start with AMD.
    if (typeof define === 'function' && define.amd) {
        define(['underscore', 'jquery', 'exports'], function (_, $, exports) {
            // Export global even in AMD case in case this script is loaded with
            // others that may still expect a global Backbone.
            root.Backbone = factory(root, exports, _, $);
        });

        // Next for Node.js or CommonJS. jQuery may not be needed as a module.
    } else if (typeof exports !== 'undefined') {
        var _ = require('underscore'), $;
        try {
            $ = require('jquery');
        } catch (e) {
        }
        // 注入underscore、jquery
        factory(root, exports, _, $);

        // Finally, as a browser global.
    } else {
        root.Backbone = factory(root, {}, root._, (root.jQuery || root.Zepto || root.ender || root.$));
    }
})(function (root, Backbone, _, $) {
    // Initial Setup
    // -------------
    var previousBackbone = root.Backbone;

    Backbone.VERSION = '1.3.3';

    Backbone.$ = $;

    // TODO 什么时候会用到noConflict？
    // 来自网上：这段代码的逻辑非常简单，我们可以通过以下方式使用:
    // var localBackbone = Backbone.noConflict();
    // var model = localBackbone.Model.extend(...);

    Backbone.noConflict = function () {
        root.Backbone = previousBackbone;
        return this;
    };

    // ****以下两个变量用于标识是否开启emulateHTTP、emulateJSON，Backbone.sync用到
    // Turn on `emulateHTTP` to support legacy HTTP servers. Setting this option
    // will fake `"PATCH"`, `"PUT"` and `"DELETE"` requests via the `_method` parameter and
    // set a `X-Http-Method-Override` header.
    Backbone.emulateHTTP = false;

    // Turn on `emulateJSON` to support legacy servers that can't deal with direct
    // `application/json` requests ... this will encode the body as
    // `application/x-www-form-urlencoded` instead and will send the model in a
    // form param named `model`.
    Backbone.emulateJSON = false;

    // Backbone.Events
    // ---------------
    var Events = Backbone.Events = {};
    // Regular expression used to split event strings.
    var eventSplitter = /\s+/;
    // A private global variable to share between listeners and listenees.
    var _listening;

    /** 先进行事件参数修正(与zepto相似)，然后将修正后的参数放到iteratee方法中执行。
     * @param iteratee {Function} 注册事件 onApi,onceApi / 触发事件 triggerApi /解绑事件 offApi
     * @param events {Object} events结构{eventName:[eventHandlers]}，一个事件可以有多个handler
     * @param name {String | Object}  String （例如：”change”,”change update”）, Object (例如：{“change”:function(){}, “update change”:function(){}})
     * @param callback
     * @param opts
     * @returns {*}
     */
    var eventsApi = function (iteratee, events, name, callback, opts) {
        var i = 0, names;
        if (name && typeof name === 'object') {
            // 处理model.on({"change": on_change_callback, "remove": on_remove_callback});
            // 这里`void 0`代表undefined
            if (callback !== void 0 && 'context' in opts && opts.context === void 0) opts.context = callback;
            for (names = _.keys(name); i < names.length; i++) {
                // 参数修正后递归调用
                events = eventsApi(iteratee, events, names[i], name[names[i]], opts);
            }
        } else if (name && eventSplitter.test(name)) {
            // 处理model.on("change remove", common_callback);
            for (names = name.split(eventSplitter); i < names.length; i++) {
                // events在被调用过程会被污染,为什么还要events对象接收返回的值?
                // 因为如果events在iteratee内部指向其他对象，那么将影响不到eventsApi这里的events，所以需要用events接收
                events = iteratee(events, names[i], callback, opts);
            }
        } else {
            // 处理model.on("change", callback);
            // 最简单的写法
            events = iteratee(events, name, callback, opts);
        }
        return events;
    };

    Events.on = function (name, callback, context) {
        this._events = eventsApi(onApi, this._events || {}, name, callback, {
            context: context,
            ctx: this,
            listening: _listening
        });

        if (_listening) {
            var listeners = this._listeners || (this._listeners = {});
            listeners[_listening.id] = _listening;
            // Allow the listening to use a counter, instead of tracking
            // callbacks for library interop
            _listening.interop = false;
        }

        return this;
    };

    /** 控制反转
     *  调用方式a.listenTo(b, {event: cb}); 或者 a.listenTo(b, 'event',cb);
     * @param obj 被监听对象
     * @param name 事件名称
     * @param callback 回调函数
     * @returns {Events}
     */
    Events.listenTo = function (obj, name, callback) {
        if (!obj) {
            return this;
        }
        // _.uniqueId:为被监听对象生成一个唯一的全局id,这个id以l开头，这个id在触发的时候会被用到
        var id = obj._listenId || (obj._listenId = _.uniqueId('l'));
        // 初始化_listeningTo对象
        var listeningTo = this._listeningTo || (this._listeningTo = {});
        // _listening
        var listening = _listening = listeningTo[id];

        if (!listening) {
            this._listenId || (this._listenId = _.uniqueId('l'));
            listening = _listening = listeningTo[id] = new Listening(this, obj);
        }

        // 在被监听对象上绑定回调函数，将源对象作为context
        var error = tryCatchOn(obj, name, callback, this);
        _listening = void 0;

        if (error) {
            throw error;
        }
        // 如果被监听对象不是Backbone.Events对象，那么手动跟踪事件
        if (listening.interop) {
            listening.on(name, callback);
        }

        return this;
    };

    /**
     *  这个api的作用是某一事件的回调函数队列增加一个回调函数
     *  这个添加的回调函数实际上是不区分到底是on添加的还是listento添加的，都是通过上下文进行区分的
     * @param events
     * @param name
     * @param callback
     * @param options
     */
    var onApi = function (events, name, callback, options) {
        // 防御callback为空，见测试用例 'listenTo with empty callback doesn't throw an error'
        if (callback) {
            var handlers = events[name] || (events[name] = []);
            var context = options.context,
                ctx = options.ctx,
                listening = options.listening;

            if (listening) {
                listening.count++;
            }

            handlers.push({
                callback: callback,
                context: context,
                // 如果开发者没有传入context，则以绑定事件的对象作为context
                // 见测试用例 'bind a callback with a default context when none supplied'
                ctx: context || ctx,
                listening: listening
            });
        }

        return events;
    };

    /**
     * 防止`_listening`全局变量被污染
     * @param obj
     * @param name
     * @param callback
     * @param context
     * @returns {*}
     */
    var tryCatchOn = function (obj, name, callback, context) {
        try {
            obj.on(name, callback, context);
        } catch (e) {
            return e;
        }
    };

    /**
     * Remove one or many callbacks. If `context` is null,
     * removes all callbacks with that function. If `callback` is null,
     * removes all callbacks for the event. If `name` is null, removes all bound
     callbacks for all events.

     ** 也可以理解为
     • 如果没有任何参数，off相当于把对应的_events对象整体清空
     • 如果有name参数但是没有具体指定哪个callback的时候，则把这个name(事件)对应的回调队列全部清空
     • 如果还有进一步详细的callback和context，那么这个时候移除回调函数非常严格，必须要求上下文和原来函数完全一致
     *
     * @param name
     * @param callback
     * @param context
     */
    Events.off = function (name, callback, context) {
        if (!this._events) {
            return this;
        }
        this._events = eventsApi(offApi, this._events, name, callback, {
            context: context,
            listeners: this._listeners
        });

        return this;
    };

    /**
     *  解除监听指定的的事件，或者当obj求值为false时解除当前对象对所有其他对象的监听
     * @param obj 被监听对象
     * @param name 事件名
     * @param callback 回调函数
     * @returns {Events}
     */
    Events.stopListening = function (obj, name, callback) {
        var listeningTo = this._listeningTo;
        if (!listeningTo) {
            return this;
        }

        var ids = obj ? [obj._listenId] : _.keys(listeningTo);
        for (var i = 0; i < ids.length; i++) {
            var listening = listeningTo[ids[i]];
            // If listening doesn't exist, this object iifs not currently
            // listening to obj. Break out early.
            if (!listening) {
                break;
            }
            // 调用被监听对象上的off方法
            listening.obj.off(name, callback, this);
            // TODO ??
            if (listening.interop) {
                listening.off(name, callback);
            }
        }
        if (_.isEmpty(listeningTo)) {
            this._listeningTo = void 0;
        }

        return this;
    };

    var offApi = function (events, name, callback, options) {
        if (!events) {
            return;
        }

        var context = options.context, listeners = options.listeners;
        var i = 0, names;

        // Delete all event listeners and "drop" events.
        if (!name && !callback && !context) {
            for (names = _.keys(listeners); i < names.length; i++) {
                listeners[names[i]].cleanup();
            }
            return;
        }

        // 统一用数组包装事件名
        var names = name ? [name] : _.keys(events);
        for (; i < names.length; i++) {
            name = names[i];
            var handlers = events[name];
            // 如果开发者在off方法传递一个没有被绑定的事件，比如obj.off('myEvent')
            // 自然在events容器中会找不到相应的handlers
            if (!handlers) {
                break;
            }

            var remaining = [];
            for (var j = 0; j < handlers.length; j++) {
                var handler = handlers[j];
                if (
                    // 指定的callback与该handler的callback不相符，所以就当保留这个handler
                    callback && callback !== handler.callback &&
                    // 当调用listenToOnce绑定事件时，once作为代理的回调函数(见onceMap函数)，真正的回调函数绑定在once._callback，所以这里还要进行一次比较
                    callback !== handler.callback._callback ||
                    // 指定的context与该handler的context不相符，所以就当保留这个handler
                    context && context !== handler.context
                ) {
                    remaining.push(handler);
                } else {
                    var listening = handler.listening;
                    if (listening) {
                        // 移除引用
                        listening.off(name, callback);
                    }
                }
            }// inner for end

            // Replace events if there are any remaining.  Otherwise, clean up.
            if (remaining.length) {
                events[name] = remaining;
            } else {
                delete events[name];
            }
        }// outer for end
        return events;
    };

    Events.once = function (name, callback, context) {
        // Map the event into a `{event: once}` object.
        var events = eventsApi(onceMap, {}, name, callback, this.off.bind(this));
        // 下面这个if为什么这么做??
        if (typeof name === 'string' && context == null) {
            callback = void 0;
        }
        return this.on(events, callback, context);
    };

    /**  'once' 方法 的控制反转版本
     * @param obj
     * @param name
     * @param callback
     * @returns {Events}
     */
    Events.listenToOnce = function (obj, name, callback) {
        // 注意this.stopListening.bind这里的bind的原生js的bind方法，不是Backbone提供的事件bind方法
        var events = eventsApi(onceMap, {}, name, callback, this.stopListening.bind(this, obj));
        return this.listenTo(obj, events);
    };

    /**
     *Reduces the event callbacks into a map of `{event: onceWrapper}`.
     `offer` unbinds the `onceWrapper` after it has been called.
     * @param map
     * @param name
     * @param callback
     * @param offer stopListening方法 或者 off 方法
     * @returns {*}
     */
    var onceMap = function (map, name, callback, offer) {
        if (callback) {
            // _.once(function) 返回一个只能调用一次的函数,二次调用不会起作用
            var once = map[name] = _.once(function () {
                // 解除绑定
                offer(name, once);
                // 执行回调
                callback.apply(this, arguments);
            });
            once._callback = callback;
        }
        return map;
    };

    /** 触发一个或多个事件
     * 调用路径:trigger -> (eventsApi --代理--> triggerApi) -> triggerEvents
     * @param name {String} 事件名称
     * @param params name后面可以跟多个参数，事件处理器的形参接收
     * @returns {Object} 触发当前事件的对象
     */
    Events.trigger = function (name) {
        // 如果当前对象没有监听任何事件，则直接返回
        // _events:{
        //     change:[事件处理器一,事件处理器二]
        //     move:[事件处理器一,事件处理器二,事件处理器三]
        // }
        if (!this._events) {
            return this;
        }
        // 确保length为0
        var length = Math.max(0, arguments.length - 1);
        var args = Array(length);
        for (var i = 0; i < length; i++) {
            args[i] = arguments[i + 1];
        }
        eventsApi(triggerApi, this._events, name, void 0, args);
        return this;
    };

    /** 对trigger进行进一步处理，比如区分是否监听了all事件
     * @param objEvents
     * @param name
     * @param callback
     * @param args
     */
    var triggerApi = function (objEvents, name, callback, args) {
        if (objEvents) {
            var events = objEvents[name];
            // 处理all事件进行监听的情况
            var allEvents = objEvents.all;
            if (events && allEvents) {
                // slice不传参会返回原值,利用这个特性做数组浅克隆
                allEvents = allEvents.slice();
            }
            if (events) {
                triggerEvents(events, args);
            }
            if (allEvents) {
                triggerEvents(allEvents, [name].concat(args));
            }
        }
        return objEvents;
    };

    /**
     * 对事件进行触发,优先进行call调用，call调用比apply调用效率更高，所以优先进行call调用,与underscore手法一样
     * 这里的events参数，实际上是回调函数列
     * @param events
     * @param args
     */
    var triggerEvents = function (events, args) {
        var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
        switch (args.length) {
            case 0:
                while (++i < l) {
                    (ev = events[i]).callback.call(ev.ctx);
                }
                return;
            case 1:
                while (++i < l) {
                    (ev = events[i]).callback.call(ev.ctx, a1);
                }
                return;
            case 2:
                while (++i < l) {
                    (ev = events[i]).callback.call(ev.ctx, a1, a2);
                }
                return;
            case 3:
                while (++i < l) {
                    (ev = events[i]).callback.call(ev.ctx, a1, a2, a3);
                }
                return;
            default:
                while (++i < l) {
                    (ev = events[i]).callback.apply(ev.ctx, args);
                }
                return;
        }
    };

    /**
     *
     * @param listener 进行监听的对象
     * @param obj 被监听对象
     * @constructor
     */
    var Listening = function (listener, obj) {
        this.id = listener._listenId;
        this.listener = listener;
        this.obj = obj;
        // 互操作性（英文：Interoperability；中文又称为：协同工作能力，互用性）作为一种特性，它指的是不同的系统和组织机构之间相互合作，协同工作（即互操作）的能力。
        // 这是新版本加上的，还不清楚用法，1.3.3版本是还没有的
        this.interop = true;
        // 统计被监听对象绑定事件handler的数量
        this.count = 0;
        // ??
        this._events = void 0;
    };

    Listening.prototype.on = Events.on;

    Listening.prototype.off = function (name, callback) {
        var cleanup;
        // TODO interop???
        if (this.interop) {
            this._events = eventsApi(offApi, this._events, name, callback, {
                context: void 0,
                listeners: void 0
            });
            cleanup = !this._events;
        } else {
            this.count--;
            cleanup = this.count === 0;
        }
        if (cleanup) {
            this.cleanup();
        }
    };

    Listening.prototype.cleanup = function () {
        // 在监听对象上删除对应id的listener
        delete this.listener._listeningTo[this.obj._listenId];
        if (!this.interop) {
            // 在被监听上删除对应id的listener
            delete this.obj._listeners[this.id];
        }
    };

    Events.bind = Events.on;
    Events.unbind = Events.off;

    // Allow the `Backbone` object to serve as a global event bus, for folks who
    // want global "pubsub" in a convenient place.
    _.extend(Backbone, Events);

    // Backbone.Model
    // ---------------

    // Backbone.View
    // ---------------
    var View = Backbone.View = function (options) {
        // preinitialize与initialize都是留给开发者实现的方法，主要逻辑在_ensureElement
        this.cid = _.uniqueId('view');
        this.preinitialize.apply(this, arguments);
        _.extend(this, _.pick(options, viewOptions));
        this._ensureElement();
        this.initialize.apply(this, arguments);
    };

    // Cached regex to split keys for `delegate`.
    // 比如 'click h1'
    var delegateEventSplitter = /^(\S+)\s*(.*)$/;

    // List of view options to be set as properties.
    var viewOptions = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events'];


    _.extend(View.prototype, Events, {
        // The default `tagName` of a View's element is `"div"`.
        tagName: 'div',
        $: function (selector) {
            return this.$el.find(selector);
        },
        // preinitialize、initialize、render均是留给开发者实现的方法
        preinitialize: function () {
        },
        initialize: function () {
        },
        render: function () {
            return this;
        },
        /**
         *
         * @param element {Object} 原生DOM节点
         */
        setElement: function (element) {
            this.undelegateEvents();
            this._setElement(element);
            this.delegateEvents();
            return this;
        },

        _setElement: function (el) {
            this.$el = el instanceof Backbone.$ ? el : Backbone.$(el);
            this.el = this.$el[0];
        },

        delegateEvents: function (events) {
            events || (events = _.result(this, 'events'));
            if (!events) {
                return this;
            }
            this.undelegateEvents();
            for (var key in events) {
                var method = events[key];
                if (!_.isFunction(method)) {
                    // 用属性名匹配 比如 {'click h1': 'increment'};
                    // myView.increment = function () {/*do something*/};
                    // 如测试用例 ‘delegateEvents‘
                    method = this[method];
                }
                if (!method) {
                    continue;
                }
                let match = key.match(delegateEventSplitter);
                this.delegate(match[1], match[2], method.bind(this));
            }
            return this;
        },

        delegate: function (eventName, selector, listener) {
            // 这里使用了jQuery的事件命名空间 click.delegateEvents.cid
            this.$el.on(eventName + '.delegateEvents' + this.cid, selector, listener);
            return this;
        },

        undelegateEvents: function () {
            if (this.$el) {
                this.$el.off('.delegateEvents' + this.cid);
            }
            return this;
        },

        // A finer-grained `undelegateEvents` for removing a single delegated event.
        // `selector` and `listener` are both optional.
        undelegate: function () {
            this.$el.off(eventName + '.delegateEvents' + this.cid, selector, listener);
            return this;
        },

        _createElement: function (tagName) {
            return document.createElement(tagName);
        },

        // Ensure that the View has a DOM element to render into.
        // If `this.el` is a string, pass it through `$()`, take the first
        // matching element, and re-assign it to `el`. Otherwise, create
        // an element from the `id`, `className` and `tagName` properties.
        _ensureElement: function () {
            if (!this.el) {
                var attrs = _.extend({}, _.result(this, 'attributes'));
                if (this.id) {
                    attrs.id = _.result(this, 'id');
                }
                if (this.className) {
                    // 为什么不用写成 attrs.class ??，与ES6有关？？
                    attrs['class'] = _.result(this, 'className');
                }
                this.setElement(this._createElement(_.result(this, 'tagName')));
                this._setAttributes(attrs);
            } else {
                // el 可以是 选择器如'#testElement' 、 jQuery对象 、 原生DOM对象
                this.setElement(_.result(this, 'el'));
            }
        },

        // Set attributes from a hash on this view's element.  Exposed for
        // subclasses using an alternative DOM manipulation API.
        _setAttributes: function (attributes) {
            this.$el.attr(attributes);
        }
    });

    // Helpers
    // -------

    // 使用寄生组合式继承
    var extend = function (protoProps, staticProps) {
        // this 可能是Model/Collection/Router/View/....
        var parent = this;
        var child;

        // protoProps可以是一个构造函数
        if (protoProps && _.has(protoProps, 'constructor')) {
            child = protoProps.constructor;
        } else {//protoProps也可以是一个实例，没有构造函数，则利用一个内置的parent函数作为构造函数。
            //比如 Backbone.Model.extend({defaults() {return {title: 'empty'}}})
            child = function () {
                return parent.apply(this, arguments);
            }
        }

        // underscore中的方法，与常见的mixin函数类似
        _.extend(child, parent, staticProps);

        // _.create 创建具有给定原型的新对象， 可选附加props 作为 own的属性。 基本上，和Object.create一样
        child.prototype = _.create(parent.prototype, protoProps);
        child.prototype.constructor = child;

        //提供一个访问父类原型的方式，方便调用
        child.__super__ = parent.prototype;
        return child;
    };

    View.extend = extend;
    // Model.extend = Collection.extend = Router.extend = View.extend = History.extend = extend;

    return Backbone;
});