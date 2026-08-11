class Hello
{
    static serviceName = 'hello';
    static shortName = 'hlo';

    constructor(controller)
    {
        this.controller = controller;
    }

    parseMessage(list, message)
    {
        if (list[0] != 'status')
            return;

        this.version = message?.version;

        if (this.controller.service != this.service)
            return;

        this.controller.showPage(this.service);
    }

    showPage()
    {
        document.querySelector('#serviceVersion').innerHTML = this.version ? 'Hello ' + this.version : '<i>unknown</i>';
        loadHTML('hello.html', this, document.querySelector('.content .container'), function() {});
    }
}

registerPlugin(Hello);
