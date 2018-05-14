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

    // Backbone.Events
    // ---------------
    var Events = Backbone.Events = {};

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

        //collection在获取model对应的后端url时使用，在model上设置collection并不会自动将model加入collection
        if (options.collection) {
            this.collection = options.collection;
        }

        //如果之后new的时候传入的是JSON,我们必须在options选项中声明parse为true
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
            if (typeof key === 'object') {
                attrs = key;
                options = val;
            } else {
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
            var change = [];
            // TODO 摘自网上： this._chaning用来标识set方法是否在处理中，我猜这里的设置跟webworker多线程有关
            var changing = this._changing;
            // 属性正在变动
            this._changing = true;

            if(!changing){

            }


        },
        // TODO Model function中有调用，但不知道为什么只返回resp ??
        parse: function (resp, options) {
            return resp;
        },
        // TODO
        _validate: function (attrs, options) {
            // 如果不需要验证，则返回true
            if (!options.validate || !this.validate) {
                return true;
            }


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

    return Backbone;
});