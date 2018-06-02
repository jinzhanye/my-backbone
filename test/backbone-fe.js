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
    var eventSplitter = /\s+/;

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
        return internalOn(this, name, callback, context);
    };

    /**
     *
     *  有可能被 on、listenTo 调用
     *
     * @param obj {Object}  被监听对象
     * @param name
     * @param callback
     * @param context {*} 开发者指定的执行上下文
     * @param listening  当internalOn被listenTo调用时才存在。
     */
    var internalOn = function (obj, name, callback, context, listening) {
        obj._events = eventsApi(onApi, obj._events || {}, name, callback, {
            context: context,
            ctx: obj,
            listening: listening
        });
        return obj;
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
                ctx: context || ctx,
                listening: listening
            });
        }

        return events;
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
            // TODO _listeners ??
            listeners: this._listeners
        });

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
            for(var j = 0; j < handlers.length; j++){
                var handler = handlers[i];
                //  这里要判断什么？？
                if(
                    callback && callback !== handler.callback &&
                    callback !== handler.callback._callback ||
                    context && context !== handler.context
                ){

                }else {

                }
            }// inner for end

            if(remaining.length){
                events[name] = remaining;
            }else {
                delete events[name];
            }
        }// outer for end
        return events;
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

    // Backbone.Model
    // ---------------

    return Backbone;
});