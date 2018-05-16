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

    /** 先进行事件参数修正(功能与zepto相似)，然后将修正后的参数放到iteratee方法中执行。
     * @param iteratee {Function} 注册事件/触发事件
     * @param events {Object} events结构{eventName:[eventHandlers]}，一个事件可以有多个handler
     * @param name
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
                events = iteratee(events, names[i], callback, opts);
            }
        } else {
            // 处理model.on("change", common_callback);
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
     * @param obj
     * @param name
     * @param callback
     * @param context
     * @param listening
     */
    var internalOn = function (obj, name, callback, context, listening) {
        obj._events = eventsApi(onApi, obj._events || {}, name, callback, {
            context: context,// 开发者传入的context
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
     *
     * @param name {String} 事件名称
     * TODO 可选参数
     *
     * @returns {Events}
     */
    Events.trigger = function (name) {
        // 如果当前对象没有绑定事件监听，则直接返回
        if (!this._events) {
            return this;
        }
        // 防止0个参数
        var length = Math.max(0, arguments.length - 1);
        var args = Array(length);
        for (var i = 0; i < length; i++) {
            args[i] = arguments[i + 1];
        }
        eventsApi(triggerApi, this._events, name, void 0, args);
        return this;
    };

    /**
     * 对trigger进行进一步处理，比如区分是否监听了all事件
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
    };

    /**
     * 对事件进行触发,优先进行call调用，call调用比apply调用效率更高，所以优先进行call调用,与underscore手法一样
     * 这里的events参数，实际上是回调函数列
     * @param events
     * @param args
     */
    var triggerEvents = function (events, args) {
        var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[3];
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
    var Model = Backbone.Model = function (attributes, options) {
        var attrs = attributes || {};
        options || (options = {});
        // 这个preinitialize函数实际上是为空的,可以给有兴趣的开发者重写这个函数，在初始化Model之前调用，
        // 主要是为ES6的class写法提供方便
        this.preinitialize.apply(this, arguments);

        // 使用underscore生成唯一id
        this.cid = _.uniqueId(this.cidPrefix);
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
        // _.defaults(object, *defaults)
        // 如果某个属性在object为undefined(即不存在)，那么该属性会被defaults填充
        // 因为调用_.extend({}, defaults, attrs)时attrs里可能存在某个值为undefined的属性会覆盖defaults里的值，外层再调用 _.defaults 确保默认值不会被undefined覆盖
        attrs = _.defaults(_.extend({}, defaults, attrs), defaults);
        this.set(attrs, options);
        // changed属性用来保存修改过的属性数据,第一次set，不需要changed数据
        this.changed = {};
        this.initialize.apply(this, arguments);
    };

    _.extend(Model.prototype, Events, {
        // The default name for the JSON `id` attribute is `"id"`. MongoDB and
        // CouchDB users may want to set this to `"_id"`.
        idAttribute: 'id',

        cidPrefix: 'c',
        // 空函数，提供给开发者重写，会在初始化一个实例之前调用
        preinitialize: function () {
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
            // TODO ??
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
                    this.trigger('change:' + changes[i], this, current[changes[i]], options)
                }
            }

            if (changing) {
                return this;
            }
            // TODO 为什么又多一次 !silent判断，跟递归有关？
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
        has: function (attr) {
            return this.get(attr) != null;
        },
        // 开放给供开发者修改的接口，默认情况下直接返回response
        parse: function (resp, options) {
            return resp;
        },
        // A model is new if it has never been saved to the server, and lacks an id.
        isNew: function () {
            return !this.has(this.idAttribute);
        },
        // TODO
        _validate: function (attrs, options) {
            // 如果不需要验证，则返回true
            // if (!options.validate || !this.validate) {
            return true;
            // }
        }
    });

    // Backbone.Collection
    // ---------------
    var Collection = Backbone.Collection = function () {

    };

    // Backbone.View
    // ---------------
    var View = Backbone.View = function () {

    };

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
        // 确保url存在
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

    // Backbone.History
    // ---------------
    var History = Backbone.History = function () {
    };

    // Backbone.Router
    // ---------------
    var Router = Backbone.Router = function () {
    };

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

    Model.extend = Collection.extend = Router.extend = View.extend = History.extend = extend;

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