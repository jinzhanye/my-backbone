const GreeterView = require('./greeter_view');

describe('greeter view', () => {
    it('greets the user', function () {
        let greeterView = new GreeterView().render();
        expect(greeterView.$el.html()).toBe('Hello World');
    });
});