class Automation
{
    content = document.querySelector('.content .container');
    modal = document.querySelector('#modal');

    triggerType = ['property', 'telegram', 'mqtt', 'sunrise', 'sunset', 'time'];
    triggerStatement = ['equals', 'above', 'below']; // TODO: add between

    conditionType = ['property', 'date', 'time', 'week'];
    conditionStatement = ['equals', 'differs', 'above', 'below']; // TODO: add between

    actionType = ['property', 'telegram', 'mqtt', 'shell'];
    actionStatement = ['value', 'increase', 'decrease'];

    constructor(controller)
    {
        this.controller = controller;
    }

    parseValue(value)
    {
        return value == 'true' || value == 'false' ? value == 'true' : isNaN(value) ? value : parseFloat(value);
    }

    triggerInfo(trigger)
    {
        switch (trigger.type)
        {
            case 'property':

                for (var i = 0; i < this.triggerStatement.length; i++)
                    if (trigger.hasOwnProperty(this.triggerStatement[i]))
                        return '<span class="value">' + trigger.endpoint + '</span> > <span class="value">' + trigger.property + '</span> ' + this.triggerStatement[i] + ' <span class="value">' + trigger[this.triggerStatement[i]] + '</span>';

                break;

            case 'telegram': return '<span class="value">' + trigger.message + '</span>' + (trigger.chats ? ' from <span class="value">' + trigger.chats.join(', ') + '</span>': '');
            case 'mqtt':     return '<span class="value">' + trigger.message + '</span> in <span class="value">' + trigger.topic + '</span> topic';
            case 'sunrise':  return '<span class="value">' + (trigger.offset > 0 ? '+' : '') + trigger.offset + '</span> minutes offset';
            case 'sunset':   return '<span class="value">' + (trigger.offset > 0 ? '+' : '') + trigger.offset + '</span> minutes offset';
            case 'time':     return '<span class="value">' + trigger.time + '</span>';
        }
    }

    conditionInfo(condition)
    {
        if (condition.type == 'week')
            return '<span class="value">' + condition.days.join(', ') + '</span>';

        for (var i = 0; i < this.conditionStatement.length; i++)
        {
            if (!condition.hasOwnProperty(this.conditionStatement[i]))
                continue;

            switch (condition.type)
            {
                case 'property': return '<span class="value">' + condition.endpoint + '</span> > <span class="value">' + condition.property + '</span> ' + this.conditionStatement[i] + ' <span class="value">' + condition[this.conditionStatement[i]] + '</span>';
                case 'date':     return this.conditionStatement[i] + ' <span class="value">' + condition[this.conditionStatement[i]] + '</span>';
                case 'time':     return this.conditionStatement[i] + ' <span class="value">' + condition[this.conditionStatement[i]] + '</span>';
            }
        }
    }

    actionInfo(action)
    {
        switch (action.type)
        {
            case 'property':

            for (var i = 0; i < this.actionStatement.length; i++)
                if (action.hasOwnProperty(this.actionStatement[i]))
                    return '<span class="value">' + action.endpoint + '</span> > <span class="value">' + action.property + '</span> > ' + (this.actionStatement[i] == 'increase' ? '<span class="value">+</span> ' : this.actionStatement[i] == 'decrease' ? '<span class="value">-</span> ' : '') + '<span class="value">' + action[this.actionStatement[i]] + '</span>';

            break;

            case 'telegram': return '<span class="value">' + action.message + '</span>' + (action.chats ? ' to <span class="value">' + action.chats.join(', ') + '</span>': '') + (action.silent ? ' [silent]' : '');
            case 'mqtt':     return '<span class="value">' + action.message + '</span> to <span class="value">' + action.topic + '</span> topic' + (action.retain ? ' [with retain]' : '');
            case 'shell':    return '<span class="value">' + action.command + '</span>';
        }
    }

    showAutomationList()
    {
        var status = this.controller.status.automation ?? new Object();

        this.controller.setService('automation');
        this.controller.setPage('automation');

        if (!status.automations)
        {
            this.controller.clearPage('automation', 'automation service automations list is empty'); // TODO: show empty page
            return;
        }

        fetch('html/automation/automationList.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var automation = this;
            var table;

            automation.content.innerHTML = html;
            table = automation.content.querySelector('.itemList table');

            status.automations.forEach(item =>
            {
                var row = table.querySelector('tbody').insertRow();

                if (!item.conditions)
                    item.conditions = new Array();

                row.addEventListener('click', function() { automation.data = JSON.parse(JSON.stringify(item)); automation.name = item.name; automation.showAutomationInfo(); });

                for (var i = 0; i < 4; i++)
                {
                    var cell = row.insertCell();

                    switch (i)
                    {
                        case 0: cell.innerHTML = item.name; break;
                        case 1: cell.innerHTML = '<span class="value">' + item.triggers.length + '</span>'; cell.classList.add('center'); break;
                        case 2: cell.innerHTML = item.conditions.length ? '<span class="value">' + item.conditions.length + '</span>' : '-'; cell.classList.add('center'); break;
                        case 3: cell.innerHTML = '<span class="value">' + item.actions.length + '</span>'; cell.classList.add('center'); break;
                    }
                }
            });

            table.querySelectorAll('th.sort').forEach(cell => cell.addEventListener('click', function() { sortTable(table, this.dataset.index); localStorage.setItem('automationSort', this.dataset.index); }) );
            sortTable(table, localStorage.getItem('automationSort') ?? 0);
        });
    }

    showAutomationInfo(add = false)
    {
        this.controller.setService('automation');
        this.controller.setPage('automationInfo');

        fetch('html/automation/automationInfo.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var automation = this;
            var triggers;
            var conditions;
            var actions;

            automation.content.innerHTML = html;

            if (add)
            {
                automation.content.querySelector('.remove').style.display = 'none';
                automation.data = {active: true, triggers: new Array(), conditions: new Array(), actions: new Array()};
                automation.name = null;
            }

            if (!automation.data.name)
                automation.data.name = 'Automation ' + Math.random().toString(36).substring(2, 7);

            automation.content.querySelector('.edit').addEventListener('click', function() { automation.showAutomationEdit(); });
            automation.content.querySelector('.remove').addEventListener('click', function() { automation.showAutomationRemove(); });
            automation.content.querySelector('.save').addEventListener('click', function() { automation.controller.socket.publish('command/automation', {action: 'updateAutomation', automation: automation.name, data: automation.data}); });

            automation.content.querySelector('.name').innerHTML = automation.data.name;
            automation.content.querySelector('.delay').innerHTML = '<span class="value">' + (automation.data.delay ?? 0) + '</span> seconds';
            automation.content.querySelector('.restart').innerHTML = '<span class="value">' + (automation.data.restart ?? false) + '</span>';
            automation.content.querySelector('.active').innerHTML = '<span class="value">' + automation.data.active + '</span>';

            triggers = automation.content.querySelector('.triggers');
            conditions = automation.content.querySelector('.conditions');
            actions = automation.content.querySelector('.actions');

            addDropdown(automation.content.querySelector('.addTrigger'), automation.triggerType, function(type) { automation.showTrigger({'type': type}, true); });
            addDropdown(automation.content.querySelector('.addCondition'), automation.conditionType, function(type) { automation.showCondition({'type': type}, true); });
            addDropdown(automation.content.querySelector('.addAction'), automation.actionType, function(type) { automation.showAction({'type': type}, true); });

            automation.data.triggers.forEach((trigger, index) =>
            {
                var row = triggers.insertRow();

                for(var i = 0; i < 3; i++)
                {
                    var cell = row.insertCell();

                    switch (i)
                    {
                        case 0: cell.innerHTML = trigger.type; break;
                        case 1: cell.innerHTML = automation.triggerInfo(trigger) ?? '<i>undefined</i>'; cell.classList.add('edit'); cell.addEventListener('click', function() { automation.showTrigger(trigger); }); break;
                        case 2: cell.innerHTML = '<i class="icon-trash"></i>'; cell.classList.add('remove', 'right'); cell.addEventListener('click', function() { automation.data.triggers.splice(index, 1); row.remove(); }); break;
                    }
                }
            });

            automation.data.conditions.forEach((condition, index) =>
            {
                var row = conditions.insertRow();

                for(var i = 0; i < 3; i++)
                {
                    var cell = row.insertCell();

                    switch (i)
                    {
                        case 0: cell.innerHTML = condition.type; break;
                        case 1: cell.innerHTML = automation.conditionInfo(condition) ?? '<i>undefined</i>'; cell.classList.add('edit'); cell.addEventListener('click', function() { automation.showCondition(condition); }); break;
                        case 2: cell.innerHTML = '<i class="icon-trash"></i>'; cell.classList.add('remove', 'right'); cell.addEventListener('click', function() { automation.data.conditions.splice(index, 1); row.remove(); }); break;
                    }
                }
            });

            automation.data.actions.forEach((action, index) =>
            {
                var row = actions.insertRow();

                for(var i = 0; i < 3; i++)
                {
                    var cell = row.insertCell();

                    switch (i)
                    {
                        case 0: cell.innerHTML = action.type; break;
                        case 1: cell.innerHTML = automation.actionInfo(action) ?? '<i>undefined</i>'; cell.classList.add('edit'); cell.addEventListener('click', function() { automation.showAction(action); }); break;
                        case 2: cell.innerHTML = '<i class="icon-trash"></i>'; cell.classList.add('remove', 'right'); cell.addEventListener('click', function() { automation.data.actions.splice(index, 1); row.remove(); }); break;
                    }
                }
            });
        });
    }

    showAutomationEdit()
    {
        fetch('html/automation/automationEdit.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var automation = this;

            automation.modal.querySelector('.data').innerHTML = html;
            automation.modal.querySelector('.title').innerHTML = automation.data.name;
            automation.modal.querySelector('input[name="name"]').value = automation.data.name;
            automation.modal.querySelector('input[name="delay"]').value = automation.data.delay ?? 0;
            automation.modal.querySelector('input[name="restart"]').checked = automation.data.restart ?? false;
            automation.modal.querySelector('input[name="active"]').checked = automation.data.active;

            automation.modal.querySelector('.save').addEventListener('click', function()
            {
                var data = formData(automation.modal.querySelector('form'));

                automation.data.name = data.name;
                automation.data.delay = data.delay;
                automation.data.restart = data.restart;
                automation.data.active = data.active;

                automation.modal.style.display = 'none';
                automation.showAutomationInfo();
            });

            automation.modal.querySelector('.cancel').addEventListener('click', function() { automation.modal.style.display = 'none'; });
            automation.modal.style.display = 'block';

            // automation.modal.addEventListener('keypress', function(event) { if (event.key == 'Enter') { event.preventDefault(); modal.querySelector('.save').click(); }});
            automation.modal.querySelector('input[name="name"]').focus();
        });
    }

    showAutomationRemove()
    {
        fetch('html/automation/automationRemove.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var automation = this;

            automation.modal.querySelector('.data').innerHTML = html;
            automation.modal.querySelector('.title').innerHTML = automation.data.name;
            automation.modal.querySelector('.remove').addEventListener('click', function() { automation.controller.socket.publish('command/automation', {action: 'removeAutomation', automation: automation.name}); automation.controller.clearPage('automation'); });
            automation.modal.querySelector('.cancel').addEventListener('click', function() { automation.modal.style.display = 'none'; });

            automation.modal.style.display = 'block';
        });
    }

    showTrigger(trigger, append = false)
    {
        switch (trigger.type)
        {
            case 'property': this.showPropertyItem(trigger, this.data.triggers, this.triggerStatement, 'trigger', append); break;
            case 'telegram': this.showTelegramTrigger(trigger, append); break;
            case 'mqtt':     this.showMqttTrigger(trigger, append); break;
            case 'sunrise':  this.showSunTrigger('sunrise', trigger, append); break;
            case 'sunset':   this.showSunTrigger('sunset', trigger, append); break;
            case 'time':     this.showTimeTrigger(trigger, append); break;
        }
    }

    showCondition(condition, append = false)
    {
        switch (condition.type)
        {
            case 'property': this.showPropertyItem(condition, this.data.conditions, this.conditionStatement, 'condition', append); break;
            case 'date':     this.showDateTimeCondition(condition, 'date', append); break;
            case 'time':     this.showDateTimeCondition(condition, 'time', append); break;
            case 'week':     this.showWeekCondition(condition, append); break;
        }
    }

    showAction(action, append = false)
    {
        switch (action.type)
        {
            case 'property': this.showPropertyItem(action, this.data.actions, this.actionStatement, 'action', append); break;
            case 'telegram': this.showTelegramAction(action, append); break;
            case 'mqtt':     this.showMqttAction(action, append); break;
            case 'shell':    this.showShellAction(action, append); break;
        }
    }

    showPropertyItem(item, list, statements, name, append)
    {
        fetch('html/automation/propertyItem.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var automation = this;

            automation.modal.querySelector('.data').innerHTML = html;
            automation.modal.querySelector('.title').innerHTML = 'property ' + name;
            automation.modal.querySelector('input[name="endpoint"]').value = item.endpoint ?? '';
            automation.modal.querySelector('input[name="property"]').value = item.property ?? '';

            statements.forEach(statement =>
            {
                var option = document.createElement('option');

                option.innerHTML = statement;
                automation.modal.querySelector('select[name="statement"]').append(option);

                if (!item[statement])
                    return;

                automation.modal.querySelector('select[name="statement"]').value = statement;
                automation.modal.querySelector('input[name="value"]').value = item[statement];
            });

            automation.modal.querySelector('.save').addEventListener('click', function()
            {
                var data = formData(automation.modal.querySelector('form'));

                statements.forEach(statement => delete item[statement]);

                item.endpoint = data.endpoint;
                item.property = data.property;
                item[data.statement] = automation.parseValue(data.value);

                if (append)
                    list.push(item);

                automation.modal.style.display = 'none';
                automation.showAutomationInfo();
            });

            automation.modal.querySelector('.cancel').addEventListener('click', function() { automation.modal.style.display = 'none'; });
            automation.modal.style.display = 'block';

            // automation.modal.addEventListener('keypress', function(event) { if (event.key == 'Enter') { event.preventDefault(); modal.querySelector('.save').click(); }});
            automation.modal.querySelector('input[name="endpoint"]').focus();
        });
    }

    showTelegramTrigger(trigger, append)
    {
        fetch('html/automation/telegramTrigger.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var automation = this;

            automation.modal.querySelector('.data').innerHTML = html;
            automation.modal.querySelector('input[name="message"]').value = trigger.message ?? '';
            automation.modal.querySelector('input[name="chats"]').value = trigger.chats ? trigger.chats.join(', ') : '';

            automation.modal.querySelector('.save').addEventListener('click', function()
            {
                var data = formData(automation.modal.querySelector('form'));
                var chats = data.chats ? data.chats.split(",").map(item => parseInt(item)).filter(item => !isNaN(item)) : new Array();

                trigger.message = data.message;
                trigger.chats = chats.length ? chats : null;

                if (append)
                    automation.data.triggers.push(trigger);

                automation.modal.style.display = 'none';
                automation.showAutomationInfo();
            });

            automation.modal.querySelector('.cancel').addEventListener('click', function() { automation.modal.style.display = 'none'; });
            automation.modal.style.display = 'block';

            // automation.modal.addEventListener('keypress', function(event) { if (event.key == 'Enter') { event.preventDefault(); modal.querySelector('.save').click(); }});
            automation.modal.querySelector('input[name="message"]').focus();
        });
    }

    showMqttTrigger(trigger, append)
    {
        fetch('html/automation/mqttTrigger.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var automation = this;

            automation.modal.querySelector('.data').innerHTML = html;
            automation.modal.querySelector('input[name="topic"]').value = trigger.topic ?? '';
            automation.modal.querySelector('input[name="message"]').value = trigger.message ?? '';

            automation.modal.querySelector('.save').addEventListener('click', function()
            {
                var data = formData(automation.modal.querySelector('form'));

                trigger.topic = data.topic;
                trigger.message = data.message;

                if (append)
                    automation.data.triggers.push(trigger);

                automation.modal.style.display = 'none';
                automation.showAutomationInfo();
            });

            automation.modal.querySelector('.cancel').addEventListener('click', function() { automation.modal.style.display = 'none'; });
            automation.modal.style.display = 'block';

            // automation.modal.addEventListener('keypress', function(event) { if (event.key == 'Enter') { event.preventDefault(); modal.querySelector('.save').click(); }});
            automation.modal.querySelector('input[name="topic"]').focus();
        });
    }

    showSunTrigger(type, trigger, append)
    {
        fetch('html/automation/sunTrigger.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var automation = this;

            automation.modal.querySelector('.data').innerHTML = html;
            automation.modal.querySelector('.title').innerHTML = type + ' trigger';
            automation.modal.querySelector('input[name="offset"]').value = trigger.offset ?? 0;

            automation.modal.querySelector('.save').addEventListener('click', function()
            {
                trigger.offset = parseInt(automation.modal.querySelector('input[name="offset"]').value);

                if (isNaN(trigger.offset))
                    trigger.offset = 0;

                if (append)
                    automation.data.triggers.push(trigger);

                automation.modal.style.display = 'none';
                automation.showAutomationInfo();
            });

            automation.modal.querySelector('.cancel').addEventListener('click', function() { automation.modal.style.display = 'none'; });
            automation.modal.style.display = 'block';

            // automation.modal.addEventListener('keypress', function(event) { if (event.key == 'Enter') { event.preventDefault(); modal.querySelector('.save').click(); }});
            automation.modal.querySelector('input[name="offset"]').focus();
        });
    }

    showTimeTrigger(trigger, append)
    {
        fetch('html/automation/timeTrigger.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var automation = this;

            automation.modal.querySelector('.data').innerHTML = html;
            automation.modal.querySelector('input[name="time"]').value = trigger.time ?? '12:00';

            automation.modal.querySelector('.save').addEventListener('click', function()
            {
                trigger.time = automation.modal.querySelector('input[name="time"]').value;

                if (append)
                    automation.data.triggers.push(trigger);

                automation.modal.style.display = 'none';
                automation.showAutomationInfo();
            });

            automation.modal.querySelector('.cancel').addEventListener('click', function() { automation.modal.style.display = 'none'; });
            automation.modal.style.display = 'block';

            // automation.modal.addEventListener('keypress', function(event) { if (event.key == 'Enter') { event.preventDefault(); modal.querySelector('.save').click(); }});
            automation.modal.querySelector('input[name="time"]').focus();
        });
    }

    showDateTimeCondition(condition, name, append)
    {
        fetch('html/automation/' + name + 'Condition.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var automation = this;

            automation.modal.querySelector('.data').innerHTML = html;

            automation.conditionStatement.forEach(statement =>
            {
                var option = document.createElement('option');

                option.innerHTML = statement;
                automation.modal.querySelector('select[name="statement"]').append(option);

                if (!condition[statement])
                    return;

                automation.modal.querySelector('select[name="statement"]').value = statement;
                automation.modal.querySelector('input[name="value"]').value = condition[statement];
            });

            automation.modal.querySelector('.save').addEventListener('click', function()
            {
                var data = formData(automation.modal.querySelector('form'));

                automation.conditionStatement.forEach(statement => delete condition[statement]);
                condition[data.statement] = data.value;

                if (append)
                    automation.data.conditions.push(condition);

                automation.modal.style.display = 'none';
                automation.showAutomationInfo();
            });

            automation.modal.querySelector('.cancel').addEventListener('click', function() { automation.modal.style.display = 'none'; });
            automation.modal.style.display = 'block';

            // automation.modal.addEventListener('keypress', function(event) { if (event.key == 'Enter') { event.preventDefault(); modal.querySelector('.save').click(); }});
            automation.modal.querySelector('select[name="statement"]').focus();
        });
    }

    showWeekCondition(condition, append)
    {
        fetch('html/automation/weekCondition.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var automation = this;

            automation.modal.querySelector('.data').innerHTML = html;
            automation.modal.querySelector('input[name="days"]').value = condition.days ? condition.days.join(', ') : '';

            automation.modal.querySelector('.save').addEventListener('click', function()
            {
                var data = formData(automation.modal.querySelector('form'));
                var days = data.days ? data.days.split(",").map(item => parseInt(item)).filter(item => !isNaN(item)) : new Array();

                condition.days = days.length ? days : null;

                if (append)
                    automation.data.conditions.push(condition);

                automation.modal.style.display = 'none';
                automation.showAutomationInfo();
            });

            automation.modal.querySelector('.cancel').addEventListener('click', function() { automation.modal.style.display = 'none'; });
            automation.modal.style.display = 'block';

            // automation.modal.addEventListener('keypress', function(event) { if (event.key == 'Enter') { event.preventDefault(); modal.querySelector('.save').click(); }});
            automation.modal.querySelector('input[name="message"]').focus();
        });
    }

    showTelegramAction(action, append)
    {
        fetch('html/automation/telegramAction.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var automation = this;

            automation.modal.querySelector('.data').innerHTML = html;
            automation.modal.querySelector('input[name="message"]').value = action.message ?? '';
            automation.modal.querySelector('input[name="chats"]').value = action.chats ? action.chats.join(', ') : '';
            automation.modal.querySelector('input[name="silent"]').checked = action.silent ?? false;

            automation.modal.querySelector('.save').addEventListener('click', function()
            {
                var data = formData(automation.modal.querySelector('form'));
                var chats = data.chats ? data.chats.split(",").map(item => parseInt(item)).filter(item => !isNaN(item)) : new Array();

                action.message = data.message;
                action.chats = chats.length ? chats : null;
                action.silent = data.silent;

                if (append)
                    automation.data.actions.push(action);

                automation.modal.style.display = 'none';
                automation.showAutomationInfo();
            });

            automation.modal.querySelector('.cancel').addEventListener('click', function() { automation.modal.style.display = 'none'; });
            automation.modal.style.display = 'block';

            // automation.modal.addEventListener('keypress', function(event) { if (event.key == 'Enter') { event.preventDefault(); modal.querySelector('.save').click(); }});
            automation.modal.querySelector('input[name="message"]').focus();
        });
    }

    showMqttAction(action, append)
    {
        fetch('html/automation/mqttAction.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var automation = this;

            automation.modal.querySelector('.data').innerHTML = html;
            automation.modal.querySelector('input[name="topic"]').value = action.topic ?? '';
            automation.modal.querySelector('input[name="message"]').value = action.message ?? '';
            automation.modal.querySelector('input[name="retain"]').checked = action.retain ?? false;

            automation.modal.querySelector('.save').addEventListener('click', function()
            {
                var data = formData(automation.modal.querySelector('form'));

                action.topic = data.topic;
                action.message = data.message;
                action.retain = data.retain;

                if (append)
                    automation.data.actions.push(action);

                automation.modal.style.display = 'none';
                automation.showAutomationInfo();
            });

            automation.modal.querySelector('.cancel').addEventListener('click', function() { automation.modal.style.display = 'none'; });
            automation.modal.style.display = 'block';

            // automation.modal.addEventListener('keypress', function(event) { if (event.key == 'Enter') { event.preventDefault(); modal.querySelector('.save').click(); }});
            automation.modal.querySelector('input[name="topic"]').focus();
        });
    }

    showShellAction(action, append)
    {
        fetch('html/automation/shellAction.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var automation = this;

            automation.modal.querySelector('.data').innerHTML = html;
            automation.modal.querySelector('input[name="command"]').value = action.command ?? '';

            automation.modal.querySelector('.save').addEventListener('click', function()
            {
                action.command = automation.modal.querySelector('input[name="command"]').value;

                if (append)
                    automation.data.actions.push(action);

                automation.modal.style.display = 'none';
                automation.showAutomationInfo();
            });

            automation.modal.querySelector('.cancel').addEventListener('click', function() { automation.modal.style.display = 'none'; });
            automation.modal.style.display = 'block';

            // automation.modal.addEventListener('keypress', function(event) { if (event.key == 'Enter') { event.preventDefault(); modal.querySelector('.save').click(); }});
            automation.modal.querySelector('input[name="topic"]').focus();
        });
    }
}