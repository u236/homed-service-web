class Automation
{
    content = document.querySelector('.content .container');
    modal = document.querySelector('#modal');

    triggerType = ['property', 'telegram', 'mqtt', 'sunrise', 'sunset', 'time'];
    triggerStatement = ['equals', 'above', 'below', 'between'];

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
            //automation.content.querySelector('.edit').addEventListener('click', function() { zigbee.showAutomationEdit(); });
            //automation.content.querySelector('.remove').addEventListener('click', function() { zigbee.showAutomationRemove(); });
            automation.content.querySelector('.update').addEventListener('click', function() { automation.controller.socket.publish('command/automation', {action: 'updateAutomation', automation: automation.name, data: automation.data}); });

            if (add)
            {
                automation.data = {name: 'New automation ' + Math.random().toString(36).substring(2, 7), triggers: new Array(), conditions: new Array(), actions: new Array()};
                automation.content.querySelector('.remove').style.display = 'none';
                // TODO: show edit here?
            }

            automation.content.querySelector('.name').innerHTML = automation.data.name;
            automation.content.querySelector('.delay').innerHTML = automation.data.delay ?? 0;
            automation.content.querySelector('.restart').innerHTML = automation.data.restart ?? false;

            triggers = automation.content.querySelector('.triggers');
            conditions = automation.content.querySelector('.conditions');
            actions = automation.content.querySelector('.actions');

            addDropdown(automation.content.querySelector('.addTrigger'), automation.triggerType, function(type) { automation.showTrigger({'type': type}, true); });

            automation.data.triggers.forEach((trigger, index) =>
            {
                var row = triggers.insertRow();

                for(var i = 0; i < 3; i++)
                {
                    var cell = row.insertCell();

                    switch (i)
                    {
                        case 0: cell.innerHTML = trigger.type; break;
                        case 1: cell.innerHTML = automation.triggerInfo(trigger) ?? '<i>undefined</i>'; cell.style.cursor = 'pointer'; cell.addEventListener('click', function() { automation.showTrigger(trigger); }); break;
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
                        case 1: cell.innerHTML = automation.conditionInfo(condition) ?? '<i>undefined</i>'; break;
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
                        case 1: cell.innerHTML = automation.actionInfo(action) ?? '<i>undefined</i>'; break;
                        case 2: cell.innerHTML = '<i class="icon-trash"></i>'; cell.classList.add('remove', 'right'); cell.addEventListener('click', function() { automation.data.actions.splice(index, 1); row.remove(); }); break;
                    }
                }
            });
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

                if (!trigger[statement])
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
                trigger[data.statement] = data.value;

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

                trigger.message = data.message;
                trigger.chats = data.chats ? data.chats.split(",").map(item => { return item.trim(); }) : null;

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
            automation.modal.querySelector('input[name="offset"]').value = trigger.offset;

            automation.modal.querySelector('.save').addEventListener('click', function()
            {
                trigger.offset = automation.modal.querySelector('input[name="offset"]').value;

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
            automation.modal.querySelector('input[name="time"]').value = trigger.time;

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

    triggerInfo(trigger)
    {
        switch (trigger.type)
        {
            case 'property':

                // TODO: between
                for (var i = 0; i < this.triggerStatement.length; i++)
                    if (trigger[this.triggerStatement[i]])
                        return '<span class="value">' + trigger.endpoint + '</span> > <span class="value">' + trigger.property + '</span> ' + this.triggerStatement[i] + ' <span class="value">' + trigger[this.triggerStatement[i]] + '</span>';

                break;

            case 'telegram': return '<span class="value">' + trigger.message + '</span>' + (trigger.chats ? ' from <span class="value">' + trigger.chats.join(', ') + '</span>': '');
            case 'mqtt':     return '<span class="value">' + trigger.message + '</span> in <span class="value">' + trigger.topic + '</span>';
            case 'sunrise':  return '<span class="value">' + (trigger.offset > 0 ? '+' : '') + trigger.offset + '</span> minutes offset';
            case 'sunset':   return '<span class="value">' + (trigger.offset > 0 ? '+' : '') + trigger.offset + '</span> minutes offset';
            case 'time':     return '<span class="value">' + trigger.time + '</span>';
        }
    }

    actionInfo(action)
    {
        switch (action.type)
        {
            case 'property': return '<span class="value">' + action.endpoint + '</span> > <span class="value">' + action.property + '</span> > <span class="value">' + action.value + '</span>';
            case 'telegram': return '<span class="value">' + action.message + '</span>' + (action.chats ? ' to <span class="value">' + action.chats.join(', ') + '</span>': '');
        }
    }
}