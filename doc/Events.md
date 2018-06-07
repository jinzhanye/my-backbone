# Events

## eventsApi
注册事件 onApi,onceApi / 触发事件 triggerApi /解绑事件 offApi 这些api共同使用了eventsApi做参数纠正，节省大量代码

## once设计思想

## listening 对象
为什么Backbone.Events会有listenTo和stopListening,在很多的类库中使用的事件机制都是没有这两个方法的功能。
这两个方法更像是专为view,model而生的。通过这两个方法可以方便的对view相关的对象监听事件进行跟踪，解绑。
````js
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
        this.interop = true;
        // 统计被监听对象绑定事件handler的数量
        this.count = 0;
        // ??
        this._events = void 0;
    };
````
a._listenTo与b._listeners指向同一个listening对象

## 借鉴
````js
// 统一用数组包装事件名
var names = name ? [name] : _.keys(events);
````

控制反转
https://segmentfault.com/a/1190000002549651