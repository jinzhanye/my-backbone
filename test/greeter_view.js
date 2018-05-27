const $ = require('jQuery');
const _ = require('underscore');
const Backbone = require('backbone');

let GreeterView = Backbone.View.extend({
    render() {
        this.$el.html('Hello World');
        return this;
    }
});

module.exports = GreeterView;