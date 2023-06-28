class Automation
{
    content = document.querySelector('.content .container');
    modal = document.querySelector('#modal');

    triggerType = ['property', 'telegram', 'mqtt', 'sunrise', 'sunset', 'time'];
    triggerStatement = ['equals', 'above', 'below'/*, 'between'*/];

    conditionType = ['property', 'date', 'time', 'week'];
    triggerStatement = ['equals', 'differs', 'above', 'below'/*, 'between'*/];

    actionType = ['property', 'telegram', 'mqtt', 'shell'];
    actionStatement = ['value', 'increase', 'decrease'];

    constructor(controller)
    {
        this.controller = controller;
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
                        case 2: cell.innerHTML = item.conditions ? '<span class="label">' + item.conditions.length + '</span>' : '-'; cell.classList.add('center'); break;
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
                automation.name = null;
                automation.data = {triggers: new Array(), conditions: new Array(), actions: new Array()};
                automation.content.querySelector('.remove').style.display = 'none';
            }

            if (!automation.data.name)
                automation.data.name = 'Automation ' + Math.random().toString(36).substring(2, 7);

            automation.content.querySelector('.edit').addEventListener('click', function() { automation.showAutomationEdit(); });
            automation.content.querySelector('.remove').addEventListener('click', function() { automation.showAutomationRemove(); });
            automation.content.querySelector('.save').addEventListener('click', function() { automation.controller.socket.publish('command/automation', {action: 'updateAutomation', automation: automation.name, data: automation.data}); });

            automation.content.querySelector('.name').innerHTML = automation.data.name;
            automation.content.querySelector('.delay').innerHTML = automation.data.delay ?? 0;
            automation.content.querySelector('.restart').innerHTML = automation.data.restart ?? false;

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

            automation.data.conditions.forEach(condition =>
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
        // TODO: between
        fetch('html/automation/automationEdit.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var automation = this;

            automation.modal.querySelector('.data').innerHTML = html;
            automation.modal.querySelector('.title').innerHTML = automation.data.name;
            automation.modal.querySelector('input[name="name"]').value = automation.data.name;
            automation.modal.querySelector('input[name="delay"]').value = automation.data.delay ?? 0;
            automation.modal.querySelector('input[name="restart"]').checked = automation.data.restart ?? false;

            automation.modal.querySelector('.save').addEventListener('click', function()
            {
                var data = formData(automation.modal.querySelector('form'));

                automation.data.name = data.name;
                automation.data.delay = data.delay;
                automation.data.restart = data.restart;

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
        // TODO: between
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
            case 'property': this.showPropertyTrigger(trigger, append); break;
            case 'telegram': this.showTelegramTrigger(trigger, append); break;
            case 'mqtt':     this.showMqttTrigger(trigger, append); break;
            case 'sunrise':  this.showSunTrigger('sunrise', trigger, append); break;
            case 'sunset':   this.showSunTrigger('sunset', trigger, append); break;
            case 'time':     this.showTimeTrigger(trigger, append); break;
        }
    }

    showPropertyTrigger(trigger, append)
    {
        // TODO: between
        fetch('html/automation/propertyTrigger.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var automation = this;

            automation.modal.querySelector('.data').innerHTML = html;
            automation.modal.querySelector('input[name="endpoint"]').value = trigger.endpoint ?? '';
            automation.modal.querySelector('input[name="property"]').value = trigger.property ?? '';

            automation.triggerStatement.forEach(statement =>
            {
                var option = document.createElement('option');

                option.innerHTML = statement;
                automation.modal.querySelector('select[name="statement"]').append(option);

                if (!trigger.hasOwnProperty(statement))
                    return;

                automation.modal.querySelector('select[name="statement"]').value = statement;
                automation.modal.querySelector('input[name="value"]').value = trigger[statement];
            });

            automation.modal.querySelector('.save').addEventListener('click', function()
            {
                var data = formData(automation.modal.querySelector('form'));

                automation.triggerStatement.forEach(statement => delete trigger[statement]);

                trigger.endpoint = data.endpoint;
                trigger.property = data.property;
                trigger[data.statement] = automation.parseValue(data.value);

                if (append)
                    automation.data.triggers.push(trigger);

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

    showAction(action, append = false)
    {
        switch (action.type)
        {
            case 'property': this.showPropertyAction(action, append); break;
            // case 'telegram': this.showTelegramTrigger(trigger, append); break;
            // case 'mqtt':     this.showMqttTrigger(trigger, append); break;
            // case 'sunrise':  this.showSunTrigger('sunrise', trigger, append); break;
            // case 'sunset':   this.showSunTrigger('sunset', trigger, append); break;
            // case 'time':     this.showTimeTrigger(trigger, append); break;
        }
    }

    showPropertyAction(action, append)
    {
        // TODO: increase/decrease
        fetch('html/automation/propertyAction.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var automation = this;

            automation.modal.querySelector('.data').innerHTML = html;
            automation.modal.querySelector('input[name="endpoint"]').value = action.endpoint ?? '';
            automation.modal.querySelector('input[name="property"]').value = action.property ?? '';

            automation.actionStatement.forEach(statement =>
            {
                var option = document.createElement('option');

                option.innerHTML = statement;
                automation.modal.querySelector('select[name="statement"]').append(option);

                if (!action[statement])
                    return;

                automation.modal.querySelector('select[name="statement"]').value = statement;
                automation.modal.querySelector('input[name="value"]').value = action[statement];
            });

            automation.modal.querySelector('.save').addEventListener('click', function()
            {
                var data = formData(automation.modal.querySelector('form'));

                automation.actionStatement.forEach(statement => delete action[statement]);

                action.endpoint = data.endpoint;
                action.property = data.property;
                action[data.statement] = automation.parseValue(data.value);

                console.log(action);

                if (append)
                    automation.data.actions.push(action);

                automation.modal.style.display = 'none';
                automation.showAutomationInfo();
            });

            automation.modal.querySelector('.cancel').addEventListener('click', function() { automation.modal.style.display = 'none'; });
            automation.modal.style.display = 'block';

            // automation.modal.addEventListener('keypress', function(event) { if (event.key == 'Enter') { event.preventDefault(); modal.querySelector('.save').click(); }});
            automation.modal.querySelector('input[name="endpoint"]').focus();
        });
    }

    triggerInfo(trigger)
    {
        switch (trigger.type)
        {
            case 'property':

                // TODO: between
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

    actionInfo(action)
    {
        switch (action.type)
        {
            case 'property':

            for (var i = 0; i < this.actionStatement.length; i++)
                if (action.hasOwnProperty(this.actionStatement[i]))
                    return '<span class="value">' + action.endpoint + '</span> > <span class="value">' + action.property + '</span> > ' +
                    (this.actionStatement[i] == 'increase' ? '<span class="value">+</span> ' : this.actionStatement[i] == 'decrease' ? '<span class="value">-</span> ' : '') +
                    '<span class="value">' + action[this.actionStatement[i]] + '</span>';

            break;

            case 'telegram': return '<span class="value">' + action.message + '</span>' + (action.chats ? ' to <span class="value">' + action.chats.join(', ') + '</span>': '');
        }
    }

    parseValue(value)
    {
        return value == 'true' || value == 'false' ? value == 'true' : isNaN(value) ? value : parseFloat(value);
    }
}