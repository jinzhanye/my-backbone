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
- eventApis iteree通用接口

## backbone.Model对象
````js
backbone.Model = {
 attributes:{bar: "I am Bar", color: "Blue", name: "Hello World", foo: "Hello git"},
 changed:{},
 cid:"c1",
 _changing:false,
 _events:{'change:color': Array(1)},
 _pending:false,
 _previousAttributes:{}   
}
````

## 启动流程
1. 识别环境
1. 绑定jQuery、underscore
1. extend


## Question
- attributes与attrs的区别

## 参考
[使用简介](https://javascript.ruanyifeng.com/advanced/backbonejs.html)
[各模块API图](https://www.jianshu.com/p/90a481e76eac)
[用到的设计模式](https://www.oschina.net/translate/backbone-js-tips-patterns?lang=chs&page=1#)
[源码分析](http://web.jobbole.com/85593/)

http://www.html-js.com/article/Backbonejs-basic-tutorial-of-MVC-mode-and-Backbonejs

