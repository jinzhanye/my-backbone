const Backbone = require('./backbone-fe');
// const Backbone = require('../backbone');
const _ = require('underscore');
const $ = require('jquery');

let view;

describe('Backbone.View', () => {
    beforeEach(() => {
        document.body.innerHTML =
            '<div id="jest"></div>' +
            '<div id="jest-fixture"></div>';

        $('#jest-fixture').append(
            '<div id="testElement"><h1>Test</h1></div>'
        );

        view = new Backbone.View({
            id: 'test-view',
            className: 'test-view',
            other: 'non-special-option'
        })
    });

    afterEach(() => {
        $('#jest-fixture').remove();
        $('#test-view').remove();
    });

    it('constructor', () => {
        expect.assertions(3);
        expect(view.el.id).toBe('test-view');
        expect(view.el.className).toBe('test-view');
        expect(view.el.other).toBeUndefined();
    });

    it('$', () => {
        expect.assertions(2);
        let myView = new Backbone.View;
        myView.setElement('<p><a><b>test</b></a></p>');
        let result = myView.$('a b');

        expect(result[0].innerHTML).toBe('test');
        // 为什么要做这个断言??
        expect(result.length === +result.length).toBeTruthy();
    });

    it('$el', () => {
        expect.assertions(3);
        let myView = new Backbone.View;
        // Node.ELEMENT_NODE === 1
        expect(myView.el.nodeType).toBe(1);

        expect(myView.$el instanceof Backbone.$).toBeTruthy();
        expect(myView.$el[0]).toBe(myView.el);
    });

    it('initialize', () => {
        expect.assertions(1);
        let View = Backbone.View.extend({
            initialize() {
                this.one = 1;
            }
        });
        expect(new View().one).toBe(1);
    });

    it('preinitialize occurs before the view is set up', () => {
        expect.assertions(2);
        let View = Backbone.View.extend({
            preinitialize() {
                expect(this.el).toBe(undefined);
            }
        });
        let _view = new View({});
        expect(_view.el).not.toBe(undefined);
    });

    it('render', () => {
        expect.assertions(1);
        let myView = new Backbone.View;
        expect(myView.render()).toBe(myView);
    });

    it('delegateEvents', () => {
        expect.assertions(6);
        let counter1 = 0, counter2 = 0;

        let myView = new Backbone.View({el: '#testElement'});
        myView.increment = function () {
            counter1++;
        };
        myView.$el.on('click', function () {
            counter2++;
        });

        let events = {'click h1': 'increment'};

        myView.delegateEvents(events);
        myView.$('h1').trigger('click');
        expect(counter1).toBe(1);
        expect(counter2).toBe(1);

        myView.$('h1').trigger('click');
        expect(counter1).toBe(2);
        expect(counter2).toBe(2);

        myView.delegateEvents(events);
        myView.$('h1').trigger('click');
        expect(counter1).toBe(3);
        expect(counter2).toBe(3);
    });

    it('delegate', () => {
        expect.assertions(3);
        let myView = new Backbone.View({el: '#testElement'});
        myView.delegate('click', 'h1', function () {
            expect(true).toBeTruthy();
        });
        myView.delegate('click', function () {
            expect(true).toBeTruthy();
        });
        myView.$('h1').trigger('click');

        expect(myView.delegate()).toBe(myView);
    });

    it('tagName can be provided as a function', () => {
        expect.assertions(1);
        var View = Backbone.View.extend({
            tagName: function () {
                return 'p';
            }
        });

        expect(new View().$el.is('p')).toBeTruthy();
    });

    it('_ensureElement with string el', () => {
        expect.assertions(3);
        let View = Backbone.View.extend({el: 'body'});
        expect(new View().el).toBe(document.body);

        View = Backbone.View.extend({el: '#testElement > h1'});
        expect(new View().el).toBe($('#testElement > h1').get(0));

        View = Backbone.View.extend({el: '#nonexistent'});
        expect(!new View().el).toBeTruthy();
    });

    it('multiple views per element', () => {
        expect.assertions(3);
        let count = 0;
        let $el = $('<p></p>');

        let View = Backbone.View.extend({
            el: $el,
            events: {
                click: function () {
                    count++;
                }
            }
        });

        let view1 = new View();
        $el.trigger('click');
        expect(1).toBe(count);

        let view2 = new View();
        $el.trigger('click');
        expect(3).toBe(count);

        view1.delegateEvents();
        // TODO 查看jQuery事件命名空间的用法
        $el.trigger('click');
        expect(5).toBe(count);
    });

    it('views stopListening', () => {
        // TODO 这是一个集成测试
        // expect.assertions(0);
        // let View = Backbone.View.extend({
        //     initialize() {
        //         this.listenTo(this.model, 'all x', function () {
        //             expect(false).toBeTruthy();
        //         });
        //         this.listenTo(this.collection, 'all x', function () {
        //             expect(false).toBeTruthy();
        //         });
        //     }
        // });
        //
        // let myView = new View({
        //     model: new Backbone.Model,
        //     collection: new Backbone.Collection,
        // });
        //
        // myView.stopListening();
        // myView.model.trigger('x');
        // myView.collection.trigger('x');
    });

    it('remove', () => {
        expect.assertions(2);
        let myView = new Backbone.View();
        document.body.appendChild(view.el);

        myView.delegate('click', function () {
            expect(false).toBeTruthy();
        });
        myView.listenTo(myView, 'all x',function () {
            expect(false).toBeTruthy();
        });

        expect(myView.remove()).toBe(myView);
        myView.$el.trigger('click');
        myView.trigger('x');

        expect(myView.el.parentNode).not.toBe(document.body);
    });
});
