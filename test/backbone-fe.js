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
    var Model = Backbone.Model = function (attributes, options) {
        // 备份开发者传入的model
        var attrs = attributes || {};
        options || (options = {});
        // 这个preinitialize函数实际上是为空的,可以给有兴趣的开发者重写这个函数，在初始化Model之前调用，
        // 主要是为ES6的class写法提供方便??
        this.preinitialize.apply(this, arguments);
        // 使用underscore生成唯一id
        this.cid = _.uniqueId(this.cidPrefix);
        // 初始化model为空对象
        this.attributes = {};

        // collection在获取model对应的后端url时使用，在model上设置collection并不会自动将model加入collection
        if (options.collection) {
            this.collection = options.collection;
        }

        // 如果之后new的时候传入的是JSON,我们必须在options选项中声明parse为true
        if (options.parse) {
            attrs = this.parse(attrs, options) || {};
        }

        // 相当于this['defaults']
        var defaults = _.result(this, 'defaults');

        // ****将model默认对象与new时传入的对象混合到一个对象
        // _.defaults(object, *defaults)
        // 如果某个属性在object为undefined(即不存在)，那么该属性会被defaults填充
        // 因为调用_.extend({}, defaults, attrs)时attrs里可能存在某个值为undefined的属性会覆盖defaults里的值，外层再调用 _.defaults 确保默认值不会被undefined覆盖
        attrs = _.defaults(_.extend({}, defaults, attrs), defaults);
        this.set(attrs, options);
        // 调用set函数后，会多出一些changed属性值，但是changed属性用来保存修改过的属性数据,第一次set，不需要changed数据，所以这些需要清空
        this.changed = {};
        this.initialize.apply(this, arguments);
    };

    _.extend(Model.prototype, Events, {
        // 存储相对于上一次model变化的属性
        changed: null,
        // true:验证不通过 , false:验证失败
        validationError: null,
        // The default name for the JSON `id` attribute is `"id"`. MongoDB and
        // CouchDB users may want to set this to `"_id"`.
        idAttribute: 'id',

        cidPrefix: 'c',
        // 空函数，提供给开发者重写，会在初始化一个实例之前调用
        preinitialize: function () {
        },
        initialize: function () {
        },
        // 对model设值，并触发change事件
        /**
         *
         * @param key {Object} | String
         * @param val String
         * @param options
         * @returns {Model}
         */
        set: function (key, val, options) {
            if (key == null) {
                return this;
            }
            var attrs;
            // 参数修正
            // Handle both `"key", value` and `{key: value}` -style arguments.
            if (typeof key === 'object') {//{key: value}
                attrs = key;
                options = val;
            } else {//`"key", value`
                (attrs = {})[key] = val;
            }

            options || (options = {});

            //Run validation
            if (!this._validate(attrs, options)) {
                return false;
            }

            // Extract attributes and options
            // model.unset(attribute, [options])
            // 从内部属性散列表中删除指定属性(attribute)。 如果未设置 silent 选项，会触发 "change" 事件。
            var unset = options.unset;
            // 在不传入 {silent: true} 选项参数的情况下，会触发 "change" 事件
            var silent = options.silent;
            // //用来存放所有有变动的key
            var changes = [];
            // this._changing记录的是上一次递归setElement时是否在变化中
            // 如果this._changing为undefined或者false，表明是第一次递归setElement
            var changing = this._changing;
            // 属性正在变动
            this._changing = true;

            if (!changing) {
                // _.clone 是一个浅克隆方法
                this._previousAttributes = _.clone(this.attributes);
                // 每次set时，changed都会被重置的{}，仅保留最近一次的变化
                this.changed = {};
            }

            // 旧的属性值，执行完for (var attr in attrs)...后会拥有新的属性值
            var current = this.attributes;
            var changed = this.changed;
            // 旧的属性
            var prev = this._previousAttributes;

            // 填充changes与current即this.attributes
            for (var attr in attrs) {
                val = attrs[attr];
                if (!_.isEqual(current[attr], val)) {
                    changes.push(attr);
                }
                //changed只存储变化的变量，如果这次和上次相等，说明变量没有变化，就直接删除在changed中的键值对
                if (!_.isEqual(prev[attr], val)) {
                    changed[attr] = val;
                } else {
                    delete changed[attr];
                }
                // 判断了到底是删除还是更新
                unset ? delete current[attr] : current[attr] = val;
            }

            // 如果在set的时候传入新的id，那么这个时候可以更改id
            if (this.idAttribute in attrs) {
                this.id = this.get(this.idAttribute);
            }

            if (!silent) {
                if (changes.length) {
                    this._pending = options;
                }
                for (var i = 0; i < changes.length; i++) {
                    // 对每一个属性的更改都触发相应的事件,事件名采用 change:AttrName 格式
                    // changes保存的是key,current保存的是对象,current[changes[i]]即获取某个属性的值
                    // TODO
                    this.trigger('change:' + changes[i], this, current[changes[i]], options);
                }
            }

            if (changing) {
                return this;
            }
            // 为什么又多一次 !silent判断，见测试用例 'nested set triggers with the correct options'
            // You might be wondering why there's a `while` loop here. Changes can
            // be recursively nested within `"change"` events.
            if (!silent) {
                while (this._pending) {
                    options = this._pending;
                    this._pending = false;
                    this.trigger('change', this, options);
                }
            }
            this._pending = false;
            this._changing = false;
            return this;
        },

        // Remove an attribute from the model, firing `"change"`. `unset` is a noop
        // if the attribute doesn't exist.
        unset: function (attr, options) {
            return this.set(attr, void 0, _.extend({}, options, {unset: true}));
        },

        // Clear all attributes on the model, firing `"change"`.
        clear: function (options) {
            var attrs = {};
            for (var key in this.attributes) {
                attrs[key] = void 0;
            }
            return this.set(attrs, _.extend({}, options, {unset: true}));
        },

        fetch: function (options) {
            options = _.extend({parse: true}, options);
            var model = this;
            // 保存开发者传入的success callback
            var success = options.success;
            options.success = function (resp) {
                var serverAttrs = options.parse ? model.parse(resp, options) : resp;
                // set方法里会校验属性，如果不通过返回false
                if (!model.set(serverAttrs, options)) {
                    return false;
                }
                // 回调开发者传入的success callback
                if (success) {
                    success.call(options.context, model, resp, options);
                }
                model.trigger('sync', model, resp, options);
            };
            wrapError(this, options);
            return this.sync('read', this, options);
        },
        /**
         * Model的save方法，实际上是set并且同步到服务器
         * 其中，传递的options中可以使用的字段以及意义为：
         *
         • wait: 可以指定是否等待服务端的返回结果再更新model。默认情况下不等待
         • url: 可以覆盖掉backbone默认使用的url格式
         • attrs: 可以指定保存到服务端的字段有哪些，配合options.patch可以产生PATCH对模型进行部分更新
         • patch:boolean 指定使用部分更新的REST接口
         • success: 自己定义一个回调函数
         • data: 会被直接传递给jquery的ajax中的data，能够覆盖backbone所有的对上传的数据控制的行为
         • 其他: options中的任何参数都将直接传递给jquery的ajax，作为其options
         * @param key {{Object | String}}
         * @param val
         * @param options
         */
        save: function (key, val, options) {
            var attrs;
            // 支持key是对象或者key:val的形式
            if (key == null || typeof key === 'object') {
                attrs = key;
                options = val;
            } else {
                (attrs = {})[key] = val;
            }

            options = _.extend({validate: true, parse: true}, options);
            var wait = options.wait;

            if (attrs && !wait) {// 不等待服务器返回，直接更新model
                if (!this.set(attrs, options)) {// 如果没通过set的参数校验则返回false
                    return false;
                }
            } else if (!this._validate(attrs, options)) {
                return false;
            }

            var model = this;
            var success = options.success;
            // 下面会对this.attributes进行修改，先用临时变量进行保存
            var attributes = this.attributes;

            options.success = function (resp) {
                // 还原attributes
                model.attributes = attributes;
                var serverAttrs = options.parse ? model.parse(resp, options) : resp;
                if (wait) {
                    serverAttrs = _.extend({}, attrs, serverAttrs);
                }
                // TODO 如果非wait，在服务器响应前已经set过一次了，为什么现在还要再set一次??
                if (serverAttrs && !model.set(serverAttrs, options)) {
                    return false;
                }
                if (success) {
                    // args:model, resp, options
                    success.call(options.context, model, resp, options);
                }
                model.trigger('sync', model, resp, options);
            };
            wrapError(this, options);

            if (attrs && wait) {
                this.attributes = _.extend({}, attributes, attrs);
            }

            var method = this.isNew() ? 'create' : (options.patch ? 'patch' : 'update');
            if (method === 'patch' && !options.attrs) {
                options.attr = attrs;
            }

            var xhr = this.sync(method, this, options);
            //恢复刚才由于要判断isNew而临时改变的attributes
            this.attributes = attributes;

            return xhr;
        },
        /**
         * 销毁这个模型，我们可以分析，销毁模型要做以下几件事情：
         • 停止对该对象所有的事件监听,本身都没有了,还监听什么事件
         • 告知服务器自己要被销毁了(如果isNew()返回true,那么其实不用向服务器发送请求)
         • 如果它属于某一个collection,那么要告知这个collection要把这个模型移除

         其中，传递的options中可以使用的字段以及意义为：
         • wait: 可以指定是否等待服务端的返回结果再销毁。默认情况下不等待
         • success: 自己定义一个回调函数
         * @param options
         * @returns {boolean}
         */
        destroy: function (options) {
            options = options ? _.clone(options) : {};
            var model = this;
            var success = options.success;
            var wait = options.wait;
            var destroy = function () {
                model.stopListening();
                model.trigger('destroy', model, model.collection, options);
            };
            options.success = function (resp) {
                if (wait) {
                    destroy();
                }
                if (success) {
                    success.call(options.context, model, resp, options);
                }
                if (!model.isNew()) {
                    model.trigger('sync', model, resp, options);
                }
            };
            var xhr = false;
            if (this.isNew()) {
                _.defer(options.success);
            } else {
                wrapError(this, options);
                xhr = this.sync('delete', this, options);
            }
            if (!wait) {
                destroy();
            }
            return xhr;
        },
        // options不用？
        toJSON: function (options) {
            return _.clone(this.attributes);
        },
        sync: function () {
            return Backbone.sync.apply(this, arguments);
        },
        get: function (attr) {
            return this.attributes[attr];
        },
        escape: function (attr) {
            return _.escape(this.get(attr));
        },
        has: function (attr) {
            return this.get(attr) != null;
        },
        // matches: function (attrs) {
        //     return !!_.iteratee(attrs, this)(this.attributes);
        // },
        //backbone Model的url构造函数，我们可以指定一个urlRoot作为根路径，另外也可以继承来自collection的url
        //当然我们还可以覆盖这个url函数的写法(不推荐)
        url: function () {
            let base =
                _.result(this, 'urlRoot') ||
                _.result(this.collection, 'url') ||
                urlError();
            if (this.isNew()) {
                return base;
            }
            let id = this.get(this.idAttribute);
            // 这个正则表达式是一个很巧妙的处理,它的作用是匹配url是不是以`/`结尾，是的话就不管，不是的话就加上`/`,其中$&表示最后一个匹配的字符
            // 如果model有设置id,就将id拼接到url尾部
            return base.replace(/[^\/]$/, '$&/') + encodeURIComponent(id);
        },

        // 开放给供开发者修改的接口，默认情况下直接返回response
        parse: function (resp, options) {
            return resp;
        },

        clone: function () {
            // constructor是js prototype上内置的引用，[constructor].prototype.constructor 指向这个构造函数
            return new this.constructor(this.attributes);
        },

        // A model is new if it has never been saved to the server, and lacks an id.
        isNew: function () {
            return !this.has(this.idAttribute);
        },
        // TODO
        _validate: function (attrs, options) {
            // 达到 options:{validate:true}  model:{validate:function(){}} 两个条件才会进行验证
            if (!options.validate || !this.validate) {
                return true;
            }
            // 有可能在调用set方法时进行验证，attributes是原有的属性，attrs是调用set方法时传入的属性
            // rror所有的属性都需要验证
            attrs = _.extend({}, this.attributes, attrs);
            // validate 无返回表示验证通过
            var error = this.validationError = this.validate(attrs, options) || null;
            if (!error) {
                return true;
            }
            this.trigger('invalidate', this, error, _.extend(options, {validationError: error}));
            return false;
        }
    });

    // Backbone.Collection
    // ---------------
    var Collection = Backbone.Collection = function (models, options) {
        options || (options = {});
        this.preinitialize.apply(this, arguments);
        // 实际开发中大多数在创建集合类的时候大多数都会定义一个model,
        // 但是也可以在初始化的时候从options中指定model
        if (options.model) {
            this.model = options.model;
        }
        // 可以在options中指定一个comparator作为排序器
        if (options.comparator !== void 0) {
            this.comparator = options.comparator;
        }
        // 初始化
        this._reset();
        this.initialize.apply(this, arguments);
        if (models) {
            // 初始化时不需要触发change，所以设置silent:true
            this.reset(models, _.extend({silent: true}, options));
        }


    };


    var setOptions = {add: true, remove: true, merge: true};
    var addOptions = {add: true, remove: false};


    /**
     *
     *  在array数组的第at个位置插入insert数组
     *  与ES5的splice方法的功能相似，但这里没有删除功能
     *
     * @param array {Array}
     * @param insert {Array}
     * @param at {Number}
     */
    var splice = function (array, insert, at) {
        at = Math.min(Math.max(at, 0), array.length);
        var tail = Array(array.length - at);
        var length = insert.length;
        var i;
        for (i = 0; i < tail.length; i++) tail[i] = array[i + at];
        for (i = 0; i < length; i++) array[i + at] = insert[i];
        for (i = 0; i < tail.length; i++) array[i + length + at] = tail[i];
    };

    _.extend(Collection.prototype, Events, {
        // 应该被开发者覆盖
        model: Model,
        preinitialize: function () {
        },
        initialize: function () {
        },
        // 增加一个/组模型，这个模型可以是backbone模型，也可以是用来生成backbone模型的js键值对象？
        add: function (models, options) {
            return this.set(models, _.extend({merge: false}, options, addOptions));
        },
        /**
         * 返回索引为index的元素，index可为负数，表示倒数第index个元素
         * @param index {number}
         * @returns {*}
         */
        at: function (index) {
            if (index < 0) {
                index += this.length;
            }
            return this.models[index];
        },
        set: function (models, options) {
            // options 长这样
            // options = {
            //     add: true,
            //     merge: false,
            //     remove: false,
            //     previousModels: [],
            //     silent: true
            // }
            if (models == null) {
                return;
            }

            // 无论是添加单个model还是一组model，都统一用一组model处理
            var singular = !_.isArray(models);
            // models.slice() 相当于浅克隆一个数组
            models = singular ? [models] : models.slice();


            // TODO at这段还没抄
            // 处理at，确保at为合理的数字
            var at = options.at;

            // set表示经过本次处理后应当存在于this.models中的model
            var set = [];
            //存储本次操作增加的model数组
            var toAdd = [];
            // 本次操后修改的model数组
            var toMerge = [];
            // 本次操作删除的models
            var toRemove = [];
            // modelMap是本次变化后的应该存在于Collection中的models的key集合
            var modelMap = {};

            var add = options.add;
            var merge = options.merge;
            var remove = options.remove;

            var sort = false;
            // 标志是否可以排序
            // this.comparator是开发者传进来的排序方法
            var sortable = this.comparator && at == null && options.sort !== false;

            var sortAttr = _.isString(this.comparator) ? this.comparator : null;

            var model, i;
            for (i = 0; i < models.length; i++) {
                model = models[i];
                var existing = this.get(model);
                if (existing) {

                } else if (add) {
                    // _prepareModel将原始对象转化为Model实例，并建立model到collection的引用
                    model = models[i] = this._prepareModel(model, options);
                    if (model) {
                        toAdd.push(model);
                        // 将model和collections建立联系
                        this._addReference(model, options);
                        modelMap[model.cid] = true;
                        set.push(model);
                    }
                }
            }// for end

            // TODO
            if (remove) {

            }

            var orderChanged = false;

            // 如果是增加模式，remove是false
            var replace = !sortable && add && remove;

            if (set.length && replace) {// TODO

            } else if (toAdd.length) {
                if (sortable) {
                    sort = true;
                }
                splice(this.models, toAdd, at == null ? this.length : at);
                this.length = this.models.length;
            }

            if (sort) {// TODO
                this.sort({silent: true});
            }

            // 非silent情况下，触发add/sort/update事件
            if (!options.silent) {

            }

            // Return the added (or merged) model (or models).
            return singular ? models[0] : models;
        },
        /**
         *  通过id或cid获取Collection里对应的model
         * @param obj { String | Object }
         * @returns {*}
         */
        get: function (obj) {
            if (obj == null) {
                return void 0;
            }
            return this._byId[obj] ||//如果obj为cid或者id
                this._byId[this.modelId(this._isModel(obj) ? obj.attributes : obj)] ||//如果obj是一个对象
                obj.cid && this._byId[obj.cid];
        },
        toJSON: function (options) {
            return this.map(function (model) {
                return model.toJSON(options);
            });
        },
        sync: function () {
            return Backbone.sync.apply(this, arguments);
        },
        reset: function (models, options) {
            options = options ? _.clone(options) : {};
            for (var i = 0; i < this.models.length; i++) {
                this._removeReference(this.models[i], options);
            }
            options.previousModels = this.models;
            this._reset();
            // Collection初始化不需要触发change事件，所以silent: true
            models = this.add(models, _.extend({silent: true}));
            if (!options.silent) {
                this.trigger('reset', this, options);
            }
            return models;
        },
        create: function (model, options) {
            options = options ? _.clone(options) : {};
            var wait = options.wait;
            model = this._prepareModel(model, options);
            if (!model) {
                return false;
            }
            if (!wait) {
                this.add(model, options);
            }
            var collection = this;
            var success = options.success;
            options.success = function (m, resp, callbackOpts) {
                if (wait) {
                    collection.add(m, callbackOpts);
                }
                if (success) {
                    success.call(callbackOpts.context, m, resp, callbackOpts);
                }
            };
            model.save(null, options);
            return model;
        },
        _reset: function () {
            this.length = 0;
            this.models = [];
            this._byId = {};
            // _byId:{
            //     'cid1':{},//后面跟对应的model
            //     'cid2':{},
            // }
        },
        /* Prepare a hash of attributes(or other model) to be added to this
        *  使用场景
        *  比如以下userCollection，构造函数列表参数中既可以是一个model如modelUserA，也可以是一个普通的对象如James。
        *  此函数就是用作将普通的对象转化成model
        *
          let userCollection = new UserCollection([modelUserA,
                {// 还可以以普通的形式传参
                    name: 'James',
                    tall: 209
                }]
            );
        * */
        _prepareModel: function (attrs, options) {
            // Collection里每个model都有一个collection属性指向该Collection，方便开发者调用
            // 如果attrs是model，则关联Collection后返回attrs，如modelUserA
            if (this._isModel(attrs)) {
                if (!attrs.collection) {//
                    attrs.collection = this;
                }
                return attrs;
            }
            options = options ? _.clone(options) : {};
            options.collection = this;
            var model = new this.model(attrs, options);
            if (!model.validationError) {
                return model;
            }
            this.trigger('invalid', this, model.validationError, options);
            return false;
        },
        modelId: function (attrs) {
            return attrs[this.model.prototype.idAttribute || 'id'];
        },
        _isModel: function (model) {
            return model instanceof Model;
        },
        _addReference: function (model, options) {
            this._byId[model.cid] = model;
            var id = this.modelId(model.attributes);
            if (id != null) {
                this._byId[id] = model;
            }
            model.on('all', this._onModelEvent, this);
        },
        // 移除model与collection的联系
        _removeReference: function (model, options) {
            delete this._byId[model.cid];
            var id = this.modelId(model.attributes);
            if (id != null) {
                delete this._byId[id];
            }
        },

        _onModelEvent: function (event, model, collection, options) {
            if (model) {
                if ((event === 'add' || event === 'remove') && collection !== this) {
                    return;
                }
                if (event === 'destroy') {
                    this.remove(model, options);
                }
            }
            this.trigger.apply(this, arguments);
        }
    });


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

        remove: function () {
            this._removeElement();
            this.stopListening();
            return this;
        },

        _removeElement: function () {
            // 在Document中移除DOM对象，其他的比如绑定的事件、附加的数据等都会被移除
            this.$el.remove();
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

    // Backbone.sync
    // -------------
    Backbone.sync = function (method, model, options) {
        // this.sync('read', this, options)
        var type = methodMap[method];
        _.defaults(options || (options = {}), {
            emulateHTTP: Backbone.emulateHTTP,
            emulateJSON: Backbone.emulateJSON
        });
        // 默认为json格式请求
        var params = {type: type, dataType: 'json'};
        // 如果url不存在，则抛出异常
        if (!options.url) {
            params.url = _.result(model, 'url') || urlError();
        }
        // 确保传输格式为Json
        if (options.data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {
            params.contentType = 'application/json';
            params.data = JSON.stringify(options.attr || model.toJSON(options));
        }
        // 使用表单格式传输
        if (options.emulateJSON) {
            params.contentType = 'application/x-www-form-urlencoded';
            params.data = params.data ? {model: params.data} : {};
        }
        // TODO
        if (options.emulateHTTP && (type === 'PUT' || type === 'DELETE' || type === 'PATCH')) {
        }

        // TODO ？？
        // Don't process data on a non-GET request.
        if (params.type !== 'GET' && !options.emulateJSON) {
            params.processData = false;
        }

        var error = options.error;
        // 从jQuery error回调函数中获取`textStatus`和`errorThrown` .
        // xhr (在 jQuery 1.4.x前为XMLHttpRequest) 对象、描述发生错误类型的一个字符串 和 捕获的异常对象。
        // 如果发生了错误，错误信息（第二个参数）除了得到null之外，还可能是"timeout", "error", "abort" ，和 "parsererror"。
        // 当一个HTTP错误发生时，errorThrown 接收HTTP状态的文本部分，比如： "Not Found"（没有找到） 或者 "Internal Server Error."（服务器内部错误）。
        options.error = function (xhr, textStatus, errorThrown) {
            options.textStatus = textStatus;
            options.errorThrown = errorThrown;
            if (error) {
                error.call(options.context, xhr, textStatus, errorThrown);
            }
        };

        // params是内置配置，options是开发者传入的配置，这样做使开发的配置可以覆盖内置配置
        var xhr = options.xhr = Backbone.ajax(_.extend(params, options));
        model.trigger('request', model, xhr, options);
        return xhr;
    };

    var methodMap = {
        'create': 'POST',
        'update': 'PUT',
        'patch': 'PATCH',
        'delete': 'DELETE',
        'read': 'GET'
    };

    Backbone.ajax = function () {
        return Backbone.$.ajax.apply(Backbone.$, arguments);
    };


    /*
     这个函数和下面的函数的作用是将underscore中的方法加入到具体的对象(实际上是类)中,后文中只有两次调用addUnderscoreMethods方法：
     一次是给model添加方法，一次是给collection添加方法
    */
    var addMethods = function (base, length, method, attributes) {

    };

    var addUnderscoreMethods = function (Class, base, methods, attributes) {
        _.each(methods, function (length, method) {// function(element, index, list)
            if (base[method]) {

            }
        });
    };

    // Underscore methods that we want to implement on the Collection.
    // 90% of the core usefulness of Backbone Collections is actually implemented
    // right here:
    var collectionMethods = {
        forEach: 3, each: 3, map: 3, collect: 3, reduce: 0,
        foldl: 0, inject: 0, reduceRight: 0, foldr: 0, find: 3, detect: 3, filter: 3,
        select: 3, reject: 3, every: 3, all: 3, some: 3, any: 3, include: 3, includes: 3,
        contains: 3, invoke: 0, max: 3, min: 3, toArray: 1, size: 1, first: 3,
        head: 3, take: 3, initial: 3, rest: 3, tail: 3, drop: 3, last: 3,
        without: 0, difference: 0, indexOf: 3, shuffle: 1, lastIndexOf: 3,
        isEmpty: 1, chain: 1, sample: 3, partition: 3, groupBy: 3, countBy: 3,
        sortBy: 3, indexBy: 3, findIndex: 3, findLastIndex: 3
    };


    // Underscore methods that we want to implement on the Model, mapped to the
    // number of arguments they take.
    var modelMethods = {
        keys: 1, values: 1, pairs: 1, invert: 1, pick: 0,
        omit: 0, chain: 1, isEmpty: 1
    };

    // Mix in each Underscore method as a proxy to `Collection#models`.
    _.each([
        [Collection, collectionMethods, 'methods'],
        [Model, modelMethods, 'attributes'],
    ], function (config) {
        var Base = config[0],
            methods = config[1],
            attribute = config[2];

        Base.mixin = function (obj) {
            var mappings = _.reduce(_.functions(), function (memo, name) {// memo n.备忘录

            }, {});
            addUnderscoreMethods(Base, obj, mappings, attribute);
        };

        addUnderscoreMethods(Base, _, methods, attribute);
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

    Model.extend = Collection.extend = View.extend = extend;
    // Model.extend = Collection.extend = Router.extend = View.extend = History.extend = extend;

    var urlError = function () {
        throw new Error('A "url" property or function must be specified');
    };

    /**
     *  包装错误的函数,非常典型的设计模式中的装饰者模式,这里增加了一个触发
     * @param model
     * @param options
     */
    var wrapError = function (model, options) {
        // 保存开发者传入的error callback
        var error = options.error;
        options.error = function (resp) {
            // 开发者可以通过绑定error callback处理错误
            // 也可以监听error事件处理错误
            if (error) {
                error.call(options.context, model, resp, options);
            }
            model.trigger('error', model, resp, options);
        };
    };
    return Backbone;
});