$(() => {
    // 组织MVC
    // let AppName = {
    //     Models       :{},
    //     Views        :{},
    //     Collections  :{},
    //     Controllers  :{}
    // };

    let Todo = Backbone.Model.extend({
        defaults() {
            return {
                title: 'empty',
                order: Todos.nextOrder(),
                done: false
            }
        },
        toggle() {
            this.save({done: !this.get('done')});
        },
        initialize() {
            console.log('Todo Model initialize');
        }
    });

    let TodoList = Backbone.Collection.extend({
        model: Todo,
        localStorage: new Backbone.LocalStorage('todos-backbone'),
        done() {
            // where 与 filter功能相似
            return this.where({done: true});
        },
        remaining() {
            return this.where({done: false});
        },
        nextOrder() {
            if (!this.length) {
                return 1;
            }
            return this.last().get('order') + 1;
        }
    });

    let Todos = new TodoList;

    let TodoView = Backbone.View.extend({
        tagName: 'li',
        template: _.template($('#item-template').html()),
        events: {
            'click .toggle': 'toggleDone',
            'dblclick .view': 'edit',
            'click a.destroy': 'clear',
            'keypress .edit': 'updateOnEnter',
            'blur .edit': 'close',
        },
        initialize() {
            // model设值时触发change事件
            this.listenTo(this.model, 'change', this.render);
            // remove方法用于移除视图
            this.listenTo(this.model, 'destroy', this.remove);
        },
        render() {
            this.$el.html(this.template(this.model.toJSON()));
            this.$el.toggleClass('done', this.model.get('done'));
            this.input = this.$('.edit');
            return this;
        },
        toggleDone() {
            this.model.toggle();
        },
        edit() {
            this.$el.addClass('editing');
            this.input.focus();
        },
        close() {
            let value = this.input.val();
            if (!value) {
                this.clear();
            } else {
                // save 通过委托给Backbone.sync，保存模型到数据库（或替代持久化层）。 如果验证成功，返回jqXHR，否则为 false
                this.model.save({title: value});
                this.$el.removeClass('editing');
            }
        },
        // If you hit `enter`, we're through editing the item.
        updateOnEnter(e) {
            if (e.keyCode === 13) {
                this.close();
            }
        },
        clear() {
            this.model.destroy();
        },
    });

    let AppView = Backbone.View.extend({
        el: $('#todoapp'),
        statsTemplate: _.template($('#stats-template').html()),
        events: {
            'keypress #new-todo': 'createOnEnter',
            'click #clear-completed': 'clearCompleted',
            'click #toggle-all': 'toggleAllCompleted',
        },
        initialize() {
            // 最顶部输入框
            this.input = this.$('#new-todo');
            this.allCheckbox = this.$('#toggle-all')[0];
            // "add" (model, collection, options) — 当一个model（模型）被添加到一个collection（集合）时触发。
            this.listenTo(Todos, 'add', this.addOne);
            // "reset" (collection, options) — 当该collection（集合）的全部内容已被替换时触发。
            this.listenTo(Todos, 'reset', this.addAll);
            // "all" — 所有事件发生都能触发这个特别的事件，第一个参数是触发事件的名称。
            this.listenTo(Todos, 'all', this.render);

            this.footer = this.$('footer');
            this.main = $('#main');
            // fetch 通过委托给Backbone.sync从服务器重置模型的状态。返回jqXHR。
            Todos.fetch();
        },

        render() {
            let done = Todos.done().length;
            let remaining = Todos.remaining().length;

            if (Todos.length) {
                this.main.show();
                this.footer.show();
                this.footer.html(this.statsTemplate({done: done, remaining: remaining}));
            } else {
                this.main.hide();
                this.footer.hide();
            }

            this.allCheckbox.checked = !remaining;
        },
        addOne(todo) {
            let view = new TodoView({model: todo});
            this.$('#todo-list').append(view.render().el);
        },
        addAll() {
            // Todos.each(this.addOne, this);
        },
        clearCompleted() {
            _.invoke(Todos.done(), 'destroy');
        },
        createOnEnter(e) {
            if (e.keyCode !== 13) {
                return;
            }
            if (!this.input.val()) {
                return;
            }
            // create 方便地在集合中创建一个模型的新实例。 相当于使用属性哈希（键值对象）实例化一个模型， 然后将该模型保存到服务器， 创建成功后将模型添加到集合中。
            // 创建一个模型将立即触发集合上的"add"事件
            // collection.create(attributes, [options])
            Todos.create({title: this.input.val()});
            this.input.val('');
        },
        toggleAllCompleted() {
            let done = this.allCheckbox.checked;
            Todos.each((todo) => {
                // 触发model change事件
                // save 与 set 的区别在于有没有向服务器发送请求？
                todo.save({'done': done});
            });
        }
    });

    let App = new AppView;
});