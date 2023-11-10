class Automation
{
    content = document.querySelector('.content .container');
    modal = document.querySelector('#modal');

    triggerType = ['property', 'mqtt', 'telegram', 'time'];
    triggerStatement = ['equals', 'above', 'below', 'between', 'changes', 'updates'];

    conditionType = ['property', 'mqtt', 'state', 'date', 'time', 'week', 'AND', 'OR', 'NOT'];
    conditionStatement = ['equals', 'differs', 'above', 'below', 'between'];

    actionType = ['property', 'mqtt', 'state', 'telegram', 'shell', 'condition', 'delay'];
    actionStatement = ['value', 'increase', 'decrease'];

    constructor(controller)
    {
        this.controller = controller;
    }

    parseValue(value)
    {
        return value == 'true' || value == 'false' ? value == 'true' : isNaN(value) ? value : parseFloat(value);
    }

    valueForm(form, statement)
    {
        switch (statement)
        {
            case 'between':
                form.querySelector('.between').style.display = 'block';
                form.querySelector('.other').style.display = 'none';
                break;

            case 'updates':
                form.querySelector('.between').style.display = 'none';
                form.querySelector('.other').style.display = 'none';
                break;

            default:
                form.querySelector('.between').style.display = 'none';
                form.querySelector('.other').style.display = 'block';
                break;
        }
    }

    updateLastTriggered(row, lastTriggered)
    {
        if (!lastTriggered)
            return;

        row.querySelector('.lastTriggered').innerHTML = timeInterval((Date.now() - lastTriggered) / 1000);
    }

    triggerInfo(trigger)
    {
        var data;

        switch (trigger.type)
        {
            case 'property':
            case 'mqtt':

                for (var i = 0; i < this.triggerStatement.length; i++)
                {
                    var statement = this.triggerStatement[i];

                    if (!trigger.hasOwnProperty(statement))
                        continue;

                    data = '<span class="value">' + (trigger.type == 'mqtt' ? trigger.topic : trigger.endpoint) + '</span> ' + (trigger.property ? '&rarr; <span class="value">' + trigger.property + '</span> ' : '') + statement;

                    if (statement == 'updates')
                        break;

                    data += ' <span class="value">' + (statement == 'between' && Array.isArray(trigger[statement]) ? trigger[statement].join('</span> and <span class="value">') : trigger[statement]) + '</span>';
                }

                break;

            case 'telegram':
                data = '<span class="value">' + trigger.message + '</span>' + (trigger.chats ? ' from <span class="value">' + trigger.chats.join(', ') + '</span>': '');
                break;

            case 'time':
                data = '<span class="value">' + trigger.time + '</span>';
                break;
        }

        if (trigger.name)
            data += ' with name <span class="value">' + trigger.name + '</span>';

        return data;
    }

    conditionInfo(condition)
    {
        if (condition.type == 'week')
            return '<span class="value">' + condition.days.join(', ') + '</span>';

        for (var i = 0; i < this.conditionStatement.length; i++)
        {
            var statement = this.conditionStatement[i];
            var value;

            if (!condition.hasOwnProperty(statement))
                continue;

            value = statement == 'between' && Array.isArray(condition[statement]) ? condition[statement].join('</span> and <span class="value">') : condition[statement];

            switch (condition.type)
            {
                case 'property':
                case 'mqtt':
                    return '<span class="value">' + (condition.type == 'mqtt' ? condition.topic : condition.endpoint) + '</span> ' + (condition.property ? '&rarr; <span class="value">' + condition.property + '</span> ' : '') + statement + ' <span class="value">' + value + '</span>';

                case 'state':
                    return '<span class="value">' + condition.name + '</span> ' + statement + ' <span class="value">' + value + '</span>';

                case 'date':
                    return statement + ' <span class="value">' + value + '</span>';

                case 'time':
                    return statement + ' <span class="value">' + value + '</span>';
            }
        }
    }

    actionInfo(action)
    {
        var data;

        switch (action.type)
        {
            case 'property':

                for (var i = 0; i < this.actionStatement.length; i++)
                {
                    var statement = this.actionStatement[i];

                    if (!action.hasOwnProperty(statement))
                        continue;

                    data = '<span class="value">' + action.endpoint + '</span> &rarr; <span class="value">' + action.property + '</span> &rarr; ' + (statement == 'increase' ? '<span class="value">+</span> ' : statement == 'decrease' ? '<span class="value">-</span> ' : '') + '<span class="value">' + action[statement] + '</span>';
                }

                break;

            case 'mqtt':
                data = '<span class="value">' + action.message + '</span> to <span class="value">' + action.topic + '</span> topic' + (action.retain ? ' [retain]' : '');
                break;

            case 'state':
                data = (action.value || action.value == false ? 'set' : 'remove') + ' <span class="value">' + action.name + '</span>' + (action.value || action.value == false ? ' to <span class="value">' + action.value + '</span>' : '');
                break;

            case 'telegram':
                data = '<span class="value">' + action.message + '</span>' + (action.chats ? ' to <span class="value">' + action.chats.join(', ') + '</span>': '') + (action.silent ? ' [silent]' : '');
                break;

            case 'shell':
                data = '<span class="value">' + action.command + '</span>';
                break;

            case 'delay':
                data = '<span class="value">' + action.delay + '</span> seconds';
                break;
        }

        if (action.triggerName)
            data += ' when trigger is <span class="value">' + action.triggerName + '</span>';

        return data;
    }

    conditionDropdown(automation, list, type)
    {
        if (type == 'AND' || type == 'OR' || type == 'NOT')
        {
            list.push({'type': type, 'conditions': new Array()});
            automation.showAutomationInfo();
            return;
        }

        automation.showCondition({'type': type}, list, true);
    }

    conditionList(automation, list, table, level = 0, colSpan = 0)
    {
        list.forEach((condition, index) =>
        {
            var row = table.insertRow();

            for (var i = 0; i < 3; i++)
            {
                var cell = row.insertCell();

                switch (i)
                {
                    case 0:
                        for (var j = 0; j < level; j++) cell.innerHTML += '<span class="' + (j < level - 1 ? 'shade' : 'warning') + '">&#8618;</span> ';
                        cell.innerHTML += condition.type == 'AND' || condition.type == 'OR' || condition.type == 'NOT' ? '<span class="value">' + condition.type + '</span>' : condition.type;
                        break;

                    case 1:

                        if (colSpan)
                            cell.colSpan = colSpan;

                        if (condition.type == 'AND' || condition.type == 'OR' || condition.type == 'NOT')
                        {
                            cell.innerHTML = '<div class="dropdown"><i class="icon-plus"></i></div>';
                            cell.classList.add('right');
                            addDropdown(cell.querySelector('.dropdown'), automation.conditionType, function(type) { automation.conditionDropdown(automation, condition.conditions, type); }, 6);
                            automation.conditionList(automation, condition.conditions, table, level + 1, colSpan);
                            break;
                        }

                        cell.innerHTML = automation.conditionInfo(condition) ?? '<i>undefined</i>';
                        cell.classList.add('edit');
                        cell.addEventListener('click', function() { automation.showCondition(condition, list); });
                        break;

                    case 2:
                        cell.innerHTML = '<i class="icon-trash"></i>';
                        cell.classList.add('remove', 'right');
                        cell.addEventListener('click', function() { list.splice(index, 1); automation.showAutomationInfo(); });
                        break;
                }
            }
        });
    }

    actionDropdown(automation, list, type)
    {
        if (type == 'condition')
        {
            list.push({'type': type, 'conditions': new Array(), 'then': new Array(), 'else': new Array()});
            automation.showAutomationInfo();
            return;
        }

        automation.showAction({'type': type}, list, true);
    }

    actionList(automation, list, table, level = 0)
    {
        list.forEach((action, index) =>
        {
            var row = table.insertRow();

            for (var i = 0; i < 5; i++)
            {
                var cell = row.insertCell();

                switch (i)
                {
                    case 0:
                        for (var j = 0; j < level; j++) cell.innerHTML += '<span class="' + (j < level - 1 ? 'shade' : 'warning') + '">&#8618;</span> ';
                        cell.innerHTML += action.type == 'condition' ? '<span class="value">CONDITION</span>' : action.type;
                        break;

                    case 1:

                        if (action.type != 'condition')
                        {
                            cell.innerHTML = automation.actionInfo(action) ?? '<i>undefined</i>';
                            cell.classList.add('edit');
                            cell.addEventListener('click', function() { automation.showAction(action); });
                            break;
                        }

                        for (var j = 0; j < 3; j++)
                        {
                            var actionRow = table.insertRow();
                            var nameCell = actionRow.insertCell();
                            var actionCell = actionRow.insertCell();

                            for (var k = 0; k <= level; k++)
                                nameCell.innerHTML += '<span class="' + (k < level ? 'shade' : 'warning') + '">&#8618;</span> ';

                            nameCell.colSpan = 4;
                            actionCell.innerHTML = '<div class="dropdown"><i class="icon-plus"></i></div>';

                            switch (j)
                            {
                                case 0:
                                    nameCell.innerHTML += '<span class="value">IF</span>';
                                    addDropdown(actionCell.querySelector('.dropdown'), automation.conditionType, function(type) { automation.conditionDropdown(automation, action.conditions, type); }, 6);
                                    automation.conditionList(automation, action.conditions, table, level + 2, 3);
                                    break;

                                case 1:
                                    nameCell.innerHTML += '<span class="value">THEN</span>';
                                    addDropdown(actionCell.querySelector('.dropdown'), automation.actionType, function(type) { automation.actionDropdown(automation, action.then, type); }, 5);
                                    automation.actionList(automation, action.then, table, level + 2);
                                    break;

                                case 2:
                                    nameCell.innerHTML += '<span class="value">ELSE</span>';
                                    addDropdown(actionCell.querySelector('.dropdown'), automation.actionType, function(type) { automation.actionDropdown(automation, action.else, type); }, 5);
                                    automation.actionList(automation, action.else, table, level + 2);
                                    break;
                            }
                        }

                        break;

                    case 3:

                        if (list.length < 2 || !index)
                            break;

                        cell.innerHTML = '&uarr;';
                        cell.classList.add('move');
                        cell.addEventListener('click', function() { list[index - 1] =  list.splice(index, 1, list[index - 1])[0]; automation.showAutomationInfo(); });
                        break;

                    case 2:

                        if (list.length < 2 || index == list.length - 1)
                            break;

                        cell.innerHTML = '&darr;';
                        cell.classList.add('move');
                        cell.addEventListener('click', function() { list[index + 1] =  list.splice(index, 1, list[index + 1])[0]; automation.showAutomationInfo(); });
                        break;


                    case 4:
                        cell.innerHTML = '<i class="icon-trash"></i>';
                        cell.classList.add('remove');
                        cell.addEventListener('click', function() { list.splice(index, 1); automation.showAutomationInfo(); });
                        break;
                }
            }
        });
    }

    showAutomationList()
    {
        var status = this.controller.status.automation ?? new Object();

        this.controller.setService('automation');
        this.controller.setPage('automation');

        if (!status.automations || !status.automations.length)
        {
            this.content.innerHTML = '<div class="emptyList">automations list is empty</div>';
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

                for (var i = 0; i < 6; i++)
                {
                    var cell = row.insertCell();

                    switch (i)
                    {
                        case 0: cell.innerHTML = item.name; break;
                        case 1: cell.innerHTML = item.active ? '<i class="icon-true success"></i>' : '<i class="icon-false error"></i>'; cell.classList.add('center'); break;
                        case 2: cell.innerHTML = '<span class="value">' + item.triggers.length + '</span>'; cell.classList.add('center'); break;
                        case 3: cell.innerHTML = item.conditions.length ? '<span class="value">' + item.conditions.length + '</span>' : '-'; cell.classList.add('center'); break;
                        case 4: cell.innerHTML = '<span class="value">' + item.actions.length + '</span>'; cell.classList.add('center'); break;
                        case 5: cell.innerHTML = '-'; cell.classList.add('lastTriggered', 'right'); break;
                    }
                }

                automation.updateLastTriggered(row, item.lastTriggered);
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
                automation.data = {active: true, triggers: new Array(), conditions: new Array(), actions: new Array()};
                automation.name = null;
            }

            if (!automation.data.name)
                automation.data.name = 'Automation ' + Math.random().toString(36).substring(2, 7);

            if (!automation.name)
            {
                automation.content.querySelector('.copy').style.display = 'none';
                automation.content.querySelector('.remove').style.display = 'none';
            }

            automation.content.querySelector('.edit').addEventListener('click', function() { automation.showAutomationEdit(); });
            automation.content.querySelector('.copy').addEventListener('click', function() { automation.data.name += ' (copy)'; automation.data.active = false; automation.name = null; automation.showAutomationInfo(); });
            automation.content.querySelector('.remove').addEventListener('click', function() { automation.showAutomationRemove(); });
            automation.content.querySelector('.save').addEventListener('click', function() { automation.controller.socket.publish('command/automation', {action: 'updateAutomation', automation: automation.name, data: automation.data}); });

            automation.content.querySelector('.name').innerHTML = automation.data.name + (automation.name ? '' : ' <span class="warning value">NEW</span>');
            automation.content.querySelector('.debounce').innerHTML = '<span class="value">' + (automation.data.debounce ?? 0) + '</span> seconds';
            automation.content.querySelector('.restart').innerHTML = '<span class="value">' + (automation.data.restart ?? false) + '</span>';
            automation.content.querySelector('.active').innerHTML = automation.data.active ? '<i class="icon-true success"></i>' : '<i class="icon-false error"></i>';

            triggers = automation.content.querySelector('.triggers');
            conditions = automation.content.querySelector('.conditions');
            actions = automation.content.querySelector('.actions');

            addDropdown(automation.content.querySelector('.addTrigger'), automation.triggerType, function(type) { automation.showTrigger({'type': type}, true); });
            addDropdown(automation.content.querySelector('.addCondition'), automation.conditionType, function(type) { automation.conditionDropdown(automation, automation.data.conditions, type); }, 6);
            addDropdown(automation.content.querySelector('.addAction'), automation.actionType, function(type) { automation.actionDropdown(automation, automation.data.actions, type); }, 5);

            automation.data.triggers.forEach((trigger, index) =>
            {
                var row = triggers.insertRow();

                for (var i = 0; i < 3; i++)
                {
                    var cell = row.insertCell();

                    switch (i)
                    {
                        case 0: cell.innerHTML = trigger.type; break;

                        case 1:
                            cell.innerHTML = automation.triggerInfo(trigger) ?? '<i>undefined</i>';
                            cell.classList.add('edit');
                            cell.addEventListener('click', function() { automation.showTrigger(trigger); });
                            break;

                        case 2:
                            cell.innerHTML = '<i class="icon-trash"></i>';
                            cell.classList.add('remove');
                            cell.addEventListener('click', function() { automation.data.triggers.splice(index, 1); automation.showAutomationInfo(); });
                            break;
                    }
                }
            });

            automation.conditionList(automation, automation.data.conditions, conditions);
            automation.actionList(automation, automation.data.actions, actions)
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
            automation.modal.querySelector('input[name="debounce"]').value = automation.data.debounce ?? 0;
            automation.modal.querySelector('input[name="restart"]').checked = automation.data.restart ?? false;
            automation.modal.querySelector('input[name="active"]').checked = automation.data.active;

            automation.modal.querySelector('.save').addEventListener('click', function()
            {
                var data = formData(automation.modal.querySelector('form'));

                automation.data.name = data.name;
                automation.data.debounce = parseInt(data.debounce);
                automation.data.restart = data.restart;
                automation.data.active = data.active;

                automation.modal.style.display = 'none';
                automation.showAutomationInfo();
            });

            automation.modal.querySelector('.cancel').addEventListener('click', function() { automation.modal.style.display = 'none'; });
            automation.modal.style.display = 'block';

            automation.modal.removeEventListener('keypress', handleSave);
            automation.modal.addEventListener('keypress', handleSave);
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
            case 'property': this.showPropertyItem(trigger, this.data.triggers, this.triggerStatement, append, 'trigger'); break;
            case 'mqtt':     this.showPropertyItem(trigger, this.data.triggers, this.triggerStatement, append, 'trigger', true); break;
            case 'telegram': this.showTelegramTrigger(trigger, append); break;
            case 'time':     this.showTimeTrigger(trigger, append); break;
        }
    }

    showCondition(condition, list, append = false)
    {
        switch (condition.type)
        {
            case 'property': this.showPropertyItem(condition, list, this.conditionStatement, append, 'condition'); break;
            case 'mqtt':     this.showPropertyItem(condition, list, this.conditionStatement, append, 'condition', true); break;
            case 'state':    this.showStateCondition(condition, list, append); break;
            case 'date':     this.showDateTimeCondition(condition, list, 'date', append); break;
            case 'time':     this.showDateTimeCondition(condition, list, 'time', append); break;
            case 'week':     this.showWeekCondition(condition, list, append); break;
        }
    }

    showAction(action, list, append = false)
    {
        switch (action.type)
        {
            case 'property': this.showPropertyItem(action, list, this.actionStatement, append, 'action'); break;
            case 'mqtt':     this.showMqttAction(action, list, append); break;
            case 'state':    this.showStateAction(action, list, append); break;
            case 'telegram': this.showTelegramAction(action, list, append); break;
            case 'shell':    this.showShellAction(action, list, append); break;
            case 'delay':    this.showDelayAction(action, list, append); break;
        }
    }

    showPropertyItem(item, list, statements, append, type, mqtt)
    {
        fetch('html/automation/propertyItem.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var automation = this;

            automation.modal.querySelector('.data').innerHTML = html;
            automation.modal.querySelector('.title').innerHTML = (mqtt ? 'mqtt ' : 'property ') + type;
            automation.modal.querySelector('.item').innerHTML = mqtt ? 'Topic:' : 'Endpoint:';
            automation.modal.querySelector('input[name="item"]').value = mqtt ? item.topic ?? '' : item.endpoint ?? '';
            automation.modal.querySelector('input[name="property"]').value = item.property ?? '';

            statements.forEach(statement =>
            {
                var option = document.createElement('option');

                option.innerHTML = statement;
                automation.modal.querySelector('select[name="statement"]').append(option);

                if (!item.hasOwnProperty(statement))
                    return;

                automation.modal.querySelector('select[name="statement"]').value = statement;

                if (statement == 'between')
                {
                    automation.modal.querySelector('input[name="min"]').value = item[statement][0];
                    automation.modal.querySelector('input[name="max"]').value = item[statement][1];
                }
                else
                    automation.modal.querySelector('input[name="value"]').value = statement != 'updates' ? item[statement] : '';

                automation.valueForm(automation.modal, statement);
            });

            automation.modal.querySelector('.name').style.display = type != 'trigger' ? 'none' : 'block';
            automation.modal.querySelector('input[name="name"]').value = item.name ?? '';

            automation.modal.querySelector('.triggerName').style.display = type != 'action' ? 'none' : 'block';
            automation.modal.querySelector('input[name="triggerName"]').value = item.triggerName ?? '';

            automation.modal.querySelector('.save').addEventListener('click', function()
            {
                var data = formData(automation.modal.querySelector('form'));

                statements.forEach(statement => delete item[statement]);

                item[mqtt ? 'topic' : 'endpoint'] = data.item;
                item.property = data.property;
                item[data.statement] = data.statement == 'between' ? [automation.parseValue(data.min), automation.parseValue(data.max)] : data.statement != 'updates' ? automation.parseValue(data.value) : true;

                if (data.name)
                    item.name = data.name;
                else
                    delete item.name;

                if (data.triggerName)
                    item.triggerName = data.triggerName;
                else
                    delete item.triggerName;

                if (append)
                    list.push(item);

                console.log(item);

                automation.modal.style.display = 'none';
                automation.showAutomationInfo();
            });

            automation.modal.querySelector('select[name="statement"]').addEventListener('change', function(event) { automation.valueForm(automation.modal, event.target.value); });
            automation.modal.querySelector('.cancel').addEventListener('click', function() { automation.modal.style.display = 'none'; });
            automation.modal.style.display = 'block';

            automation.modal.removeEventListener('keypress', handleSave);
            automation.modal.addEventListener('keypress', handleSave);
            automation.modal.querySelector('input[name="item"]').focus();
        });
    }

    showTelegramTrigger(trigger, append)
    {
        fetch('html/automation/telegramTrigger.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var automation = this;

            automation.modal.querySelector('.data').innerHTML = html;
            automation.modal.querySelector('textarea[name="message"]').value = trigger.message ?? '';
            automation.modal.querySelector('input[name="chats"]').value = trigger.chats ? trigger.chats.join(', ') : '';
            automation.modal.querySelector('input[name="name"]').value = trigger.name ?? '';

            automation.modal.querySelector('.save').addEventListener('click', function()
            {
                var data = formData(automation.modal.querySelector('form'));
                var chats = data.chats ? data.chats.split(",").map(item => parseInt(item)).filter(item => !isNaN(item)) : new Array();

                trigger.message = data.message.trim();
                trigger.chats = chats.length ? chats : null;

                if (data.name)
                    trigger.name = data.name;
                else
                    delete trigger.name;

                if (append)
                    automation.data.triggers.push(trigger);

                automation.modal.style.display = 'none';
                automation.showAutomationInfo();
            });

            automation.modal.querySelector('.cancel').addEventListener('click', function() { automation.modal.style.display = 'none'; });
            automation.modal.style.display = 'block';

            automation.modal.removeEventListener('keypress', handleSave);
            automation.modal.addEventListener('keypress', handleSave);
            automation.modal.querySelector('textarea[name="message"]').focus();
        });
    }

    showTimeTrigger(trigger, append)
    {
        fetch('html/automation/timeTrigger.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var automation = this;

            automation.modal.querySelector('.data').innerHTML = html;
            automation.modal.querySelector('input[name="time"]').value = trigger.time ?? '12:00';
            automation.modal.querySelector('input[name="name"]').value = trigger.name ?? '';

            automation.modal.querySelector('.save').addEventListener('click', function()
            {
                var data = formData(automation.modal.querySelector('form'));

                trigger.time = automation.modal.querySelector('input[name="time"]').value;

                if (data.name)
                    trigger.name = data.name;
                else
                    delete trigger.name;

                if (append)
                    automation.data.triggers.push(trigger);

                automation.modal.style.display = 'none';
                automation.showAutomationInfo();
            });

            automation.modal.querySelector('.cancel').addEventListener('click', function() { automation.modal.style.display = 'none'; });
            automation.modal.style.display = 'block';

            automation.modal.removeEventListener('keypress', handleSave);
            automation.modal.addEventListener('keypress', handleSave);
            automation.modal.querySelector('input[name="time"]').focus();
        });
    }

    showStateCondition(condition, list, append)
    {
        fetch('html/automation/stateCondition.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var automation = this;

            automation.modal.querySelector('.data').innerHTML = html;
            automation.modal.querySelector('input[name="name"]').value = condition.name ?? '';

            automation.conditionStatement.forEach(statement =>
            {
                var option = document.createElement('option');

                option.innerHTML = statement;
                automation.modal.querySelector('select[name="statement"]').append(option);

                if (!condition.hasOwnProperty(statement))
                    return;

                automation.modal.querySelector('select[name="statement"]').value = statement;

                if (statement == 'between')
                {
                    automation.modal.querySelector('input[name="min"]').value = condition[statement][0];
                    automation.modal.querySelector('input[name="max"]').value = condition[statement][1];
                }
                else
                    automation.modal.querySelector('input[name="value"]').value = condition[statement];

                automation.valueForm(automation.modal, statement);
            });

            automation.modal.querySelector('.save').addEventListener('click', function()
            {
                var data = formData(automation.modal.querySelector('form'));

                automation.conditionStatement.forEach(statement => delete condition[statement]);

                condition.name = data.name;
                condition[data.statement] = data.statement == 'between' ? [automation.parseValue(data.min), automation.parseValue(data.max)] : automation.parseValue(data.value);

                if (append)
                    list.push(condition);

                automation.modal.style.display = 'none';
                automation.showAutomationInfo();
            });

            automation.modal.querySelector('select[name="statement"]').addEventListener('change', function(event) { automation.valueForm(automation.modal, event.target.value); });
            automation.modal.querySelector('.cancel').addEventListener('click', function() { automation.modal.style.display = 'none'; });
            automation.modal.style.display = 'block';

            automation.modal.removeEventListener('keypress', handleSave);
            automation.modal.addEventListener('keypress', handleSave);
            automation.modal.querySelector('input[name="name"]').focus();
        });
    }

    showDateTimeCondition(condition, list, name, append)
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

                if (!condition.hasOwnProperty(statement))
                    return;

                automation.modal.querySelector('select[name="statement"]').value = statement;

                if (statement == 'between')
                {
                    automation.modal.querySelector('input[name="start"]').value = condition[statement][0];
                    automation.modal.querySelector('input[name="end"]').value = condition[statement][1];
                }
                else
                    automation.modal.querySelector('input[name="value"]').value = condition[statement];

                automation.valueForm(automation.modal, statement);
            });

            automation.modal.querySelector('.save').addEventListener('click', function()
            {
                var data = formData(automation.modal.querySelector('form'));

                automation.conditionStatement.forEach(statement => delete condition[statement]);
                condition[data.statement] = data.statement == 'between' ? [data.start, data.end] : data.value;

                if (append)
                    list.push(condition);

                automation.modal.style.display = 'none';
                automation.showAutomationInfo();
            });

            automation.modal.querySelector('select[name="statement"]').addEventListener('change', function(event) { automation.valueForm(automation.modal, event.target.value); });
            automation.modal.querySelector('.cancel').addEventListener('click', function() { automation.modal.style.display = 'none'; });
            automation.modal.style.display = 'block';

            automation.modal.removeEventListener('keypress', handleSave);
            automation.modal.addEventListener('keypress', handleSave);
            automation.modal.querySelector('select[name="statement"]').focus();
        });
    }

    showWeekCondition(condition, list, append)
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
                    list.push(condition);

                automation.modal.style.display = 'none';
                automation.showAutomationInfo();
            });

            automation.modal.querySelector('.cancel').addEventListener('click', function() { automation.modal.style.display = 'none'; });
            automation.modal.style.display = 'block';

            automation.modal.removeEventListener('keypress', handleSave);
            automation.modal.addEventListener('keypress', handleSave);
            automation.modal.querySelector('input[name="days"]').focus();
        });
    }

    showMqttAction(action, list, append)
    {
        fetch('html/automation/mqttAction.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var automation = this;

            automation.modal.querySelector('.data').innerHTML = html;
            automation.modal.querySelector('input[name="topic"]').value = action.topic ?? '';
            automation.modal.querySelector('textarea[name="message"]').value = action.message ?? '';
            automation.modal.querySelector('input[name="triggerName"]').value = action.triggerName ?? '';
            automation.modal.querySelector('input[name="retain"]').checked = action.retain ?? false;

            automation.modal.querySelector('.save').addEventListener('click', function()
            {
                var data = formData(automation.modal.querySelector('form'));

                action.topic = data.topic;
                action.message = data.message.trim();
                action.retain = data.retain;

                if (data.triggerName)
                    item.triggerName = data.triggerName;
                else
                    delete item.triggerName;

                if (append)
                    list.push(action);

                automation.modal.style.display = 'none';
                automation.showAutomationInfo();
            });

            automation.modal.querySelector('.cancel').addEventListener('click', function() { automation.modal.style.display = 'none'; });
            automation.modal.style.display = 'block';

            automation.modal.removeEventListener('keypress', handleSave);
            automation.modal.addEventListener('keypress', handleSave);
            automation.modal.querySelector('input[name="topic"]').focus();
        });
    }

    showStateAction(action, list, append)
    {
        fetch('html/automation/stateAction.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var automation = this;

            automation.modal.querySelector('.data').innerHTML = html;
            automation.modal.querySelector('input[name="name"]').value = action.name ?? '';
            automation.modal.querySelector('input[name="value"]').value = action.value ?? '';

            automation.modal.querySelector('.save').addEventListener('click', function()
            {
                var data = formData(automation.modal.querySelector('form'));

                action.name = data.name;
                action.value = automation.parseValue(data.value);

                if (append)
                    list.push(action);

                automation.modal.style.display = 'none';
                automation.showAutomationInfo();
            });

            automation.modal.querySelector('.cancel').addEventListener('click', function() { automation.modal.style.display = 'none'; });
            automation.modal.style.display = 'block';

            automation.modal.removeEventListener('keypress', handleSave);
            automation.modal.addEventListener('keypress', handleSave);
            automation.modal.querySelector('input[name="name"]').focus();
        });
    }

    showTelegramAction(action, list, append)
    {
        fetch('html/automation/telegramAction.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var automation = this;

            automation.modal.querySelector('.data').innerHTML = html;
            automation.modal.querySelector('textarea[name="message"]').value = action.message ?? '';
            automation.modal.querySelector('input[name="chats"]').value = action.chats ? action.chats.join(', ') : '';
            automation.modal.querySelector('input[name="triggerName"]').value = action.triggerName ?? '';
            automation.modal.querySelector('input[name="silent"]').checked = action.silent ?? false;

            automation.modal.querySelector('.save').addEventListener('click', function()
            {
                var data = formData(automation.modal.querySelector('form'));
                var chats = data.chats ? data.chats.split(",").map(item => parseInt(item)).filter(item => !isNaN(item)) : new Array();

                action.message = data.message.trim();
                action.chats = chats.length ? chats : null;
                action.silent = data.silent;

                if (data.triggerName)
                    item.triggerName = data.triggerName;
                else
                    delete item.triggerName;

                if (append)
                    list.push(action);

                automation.modal.style.display = 'none';
                automation.showAutomationInfo();
            });

            automation.modal.querySelector('.cancel').addEventListener('click', function() { automation.modal.style.display = 'none'; });
            automation.modal.style.display = 'block';

            automation.modal.removeEventListener('keypress', handleSave);
            automation.modal.addEventListener('keypress', handleSave);
            automation.modal.querySelector('textarea[name="message"]').focus();
        });
    }

    showShellAction(action, list, append)
    {
        fetch('html/automation/shellAction.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var automation = this;

            automation.modal.querySelector('.data').innerHTML = html;
            automation.modal.querySelector('input[name="command"]').value = action.command ?? '';
            automation.modal.querySelector('input[name="triggerName"]').value = action.triggerName ?? '';

            automation.modal.querySelector('.save').addEventListener('click', function()
            {
                var data = formData(automation.modal.querySelector('form'));

                action.command = data.command.trim();

                if (data.triggerName)
                    item.triggerName = data.triggerName;
                else
                    delete item.triggerName;

                if (append)
                    list.push(action);

                automation.modal.style.display = 'none';
                automation.showAutomationInfo();
            });

            automation.modal.querySelector('.cancel').addEventListener('click', function() { automation.modal.style.display = 'none'; });
            automation.modal.style.display = 'block';

            automation.modal.removeEventListener('keypress', handleSave);
            automation.modal.addEventListener('keypress', handleSave);
            automation.modal.querySelector('input[name="command"]').focus();
        });
    }

    showDelayAction(action, list, append)
    {
        fetch('html/automation/delayAction.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var automation = this;

            automation.modal.querySelector('.data').innerHTML = html;
            automation.modal.querySelector('input[name="delay"]').value = action.delay ?? 0;
            automation.modal.querySelector('input[name="triggerName"]').value = action.triggerName ?? '';

            automation.modal.querySelector('.save').addEventListener('click', function()
            {
                var data = formData(automation.modal.querySelector('form'));

                action.delay = parseInt(data.delay);

                if (data.triggerName)
                    item.triggerName = data.triggerName;
                else
                    delete item.triggerName;

                if (append)
                    list.push(action);

                automation.modal.style.display = 'none';
                automation.showAutomationInfo();
            });

            automation.modal.querySelector('.cancel').addEventListener('click', function() { automation.modal.style.display = 'none'; });
            automation.modal.style.display = 'block';

            automation.modal.removeEventListener('keypress', handleSave);
            automation.modal.addEventListener('keypress', handleSave);
            automation.modal.querySelector('input[name="delay"]').focus();
        });
    }
}
