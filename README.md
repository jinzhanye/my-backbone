# Backbone Source Analysis Note

## Model
Model表示数据层，也就是程序需要的数据源，通常使用JSON格式表示。

## View
View表示表现层，也就是用户界面，对于网页来说，就是用户看到的网页HTML代码。
render方法需要手动调用，一般在initialize方法内调用
remove方法用于移除视图


## Controller
Controller表示控制层，用来对原始数据（Model）进行加工，传送到View。

## Collections
在MVC/MV*框架中，提供一种组织模型的方式并不常见。在Backbone中，这种组织方式叫做Collections。将模型组织在一起允许我们在其中一个模型发生变化时编写对象的逻辑代码。你会发现，使用Collection会比使用单个Model要有用得多。

## AJAX
- fetch:GET
- save:POST/UPDATE
- destroy:DELETE

## 设计模式
- 装饰者模式
    - wrapError
    借用jQuery Error 处理函数 1603 -> 包装错误处理函数 2018 -> 开发者的错误处理函数
- 模版方法
    preinitialize与initialize都是要开发者自己实现的方法，形成一个生命周期
    ````js
    var View = Backbone.View = function (options) {
            this.cid = _.uniqueId('view');
            this.preinitialize.apply(this, arguments);
            _.extend(this, _.pick(options, viewOptions));
            this._ensureElement();
            this.initialize.apply(this, arguments);
        };
    ````    
- eventApis iteree通用接口

## Events
model的all事件只被该model的其他事件触发时触发，其他model的事件不会触发该model的all handler

## 其他插件

## backbone对象
Model

````js

this.model.prototype.idAttribute = 'id';
var prototype = {
    // 指定'id'属性用于存放model的id
    idAttribute: 'id',
    cidPrefix: 'c',
}
       
backbone.Model = {
    // id:'1', // 这个'id'一般情况下是不存在的，如果开发者设置了这个id则以这个id为model的识别id，
    // 在不设置id的情况下backbone内部会使用cid当作区分唯一model的id
    cid:"c1", // UUID
    attributes:{name: "Hello Kitty", color: "Blue", description: "Hello World"}, // 开发者的model对象
    changed:{},  // 保存当前model相对于上一个版本model修改过的属性数据,第一次set，不需要changed数据。change 由设置属性/删除属性所触发
    _changing:false,// 是否正在变化
    _events:{'change:color': Array(1)}, // 事件回调队列
    _pending:false,
    _previousAttributes:{}// model变化之前的属性   
}

````

Collection

````js
backbone.Collection = {
    length:2,
    models:[{},{}],
    _byId:{
        'cid1':{},//后面跟对应的model
        'cid2':{},
    },   
    _events:{'change:color': Array(1)}, // 事件回调队列 
}
````
Collection里每个model都有一个collection属性指向该Collection，可以在Backbone.Collection._prepareModel查阅

Collection里，对于单个监听all事件代理其他事件。
````js
    let UserCollection = Backbone.Collection.extend({
        model: User,
        initialize() {
            console.log('collection initialize');
            this.bindEvents();
        },
        bindEvents() {
            this.on('change:name', (model, nextVal) => {
                console.log('Hey, the name changed:', model.get('name'));
            });
            this.on('add', (model) => {
                console.log('add a student:', model.get('name'));
            });
    });

_addReference: function (model, options) {
            this._byId[model.cid] = model;
            var id = this.modelId(model.attributes);
            if (id != null) this._byId[id] = model;
            model.on('all', this._onModelEvent, this);
        }

_onModelEvent: function(){
    
}
````

### model原型链

###options对象有哪些属性？？


## 启动流程
1. 识别环境
1. 绑定jQuery、underscore 
1. Back.Model.extend({foo:bar})获得一个继承自参数对象的构造函数
    函数栈：extend内child闭包 -> Back.Model -> set

### 完成部分
- new model, set model value
- model update events
- new collection, set a model in collection
- model fetch data

#### ing
暂时先事件，回来再看_onModelEvent

## Question
- attributes与attrs的区别

## 参考
[使用简介](https://javascript.ruanyifeng.com/advanced/backbonejs.html)
[各模块API图](https://www.jianshu.com/p/90a481e76eac)
[用到的设计模式](https://www.oschina.net/translate/backbone-js-tips-patterns?lang=chs&page=1#)
[源码分析](http://web.jobbole.com/85593/)

http://www.html-js.com/article/Backbonejs-basic-tutorial-of-MVC-mode-and-Backbonejs

