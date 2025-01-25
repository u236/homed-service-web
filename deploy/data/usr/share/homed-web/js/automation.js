class Automation
{
    intervals = [setInterval(function() { this.updateLastTriggered(); }.bind(this), 100)];

    triggerType = ['property', 'mqtt', 'telegram', 'time', 'interval'];
    triggerStatement = ['equals', 'above', 'below', 'between', 'changes', 'updates'];

    conditionType = ['property', 'mqtt', 'state', 'date', 'time', 'week', 'pattern', 'AND', 'OR', 'NOT'];
    conditionStatement = ['equals', 'differs', 'above', 'below', 'between'];

    actionType = ['property', 'mqtt', 'state', 'telegram', 'shell', 'condition', 'delay'];
    actionStatement = ['value', 'increase', 'decrease'];

    content = document.querySelector('.content .container');
    status = new Object();
    data = new Object();

    constructor(controller)
    {
        this.controller = controller;
    }

    updateLastTriggered()
    {
        if (this.controller.page != 'automation' || !this.status.automations)
            return;

        this.status.automations.forEach((item, index) =>
        {
            let cell = document.querySelector('tr[data-index="' + index + '"] .lastTriggered');
            let value = timeInterval((Date.now() - item.lastTriggered) / 1000);

            if (!item.lastTriggered || !cell || cell.innerHTML == value)
                return;

            cell.dataset.value = item.lastTriggered;
            cell.innerHTML = value;
        });
    }

    updateStates()
    {
        let list = Object.keys(this.status.states ?? new Object());
        let table = modal.querySelector('table.states');

        if (!table)
            return;

        list.forEach(state =>
        {
            let row = table.querySelector('tr[data-state="' + state + '"');

            if (row)
            {
                row.querySelector('.value').innerHTML = this.status.states[state];
                return;
            }

            row = table.insertRow();
            row.dataset.state = state;

            for (let i = 0; i < 3; i++)
            {
                let cell = row.insertCell();

                switch (i)
                {
                    case 0: cell.innerHTML = state; break;
                    case 1: cell.innerHTML = '<span class="value">' + this.status.states[state] + '</span>'; break;

                    case 2:
                        cell.innerHTML = '<i class="icon-trash"></i>';
                        cell.classList.add('remove');
                        cell.addEventListener('click', function() { cell.innerHTML = '<div class="dataLoader"></div>'; this.controller.socket.publish('command/automation', {action: 'removeState', state: state}); this.removeState = true; }.bind(this));
                        break;
                }
            }
        });

        table.querySelectorAll('tr').forEach(row => { if (!list.includes(row.dataset.state)) row.remove(); });

        modal.querySelector('.empty').style.display = list.length ? 'none' : 'block';
        table.style.display = list.length ? 'table' : 'none';
        
        sortTable(table, 0);
    }

    updatePage()
    {
        document.querySelector('#serviceVersion').innerHTML = 'Automation ' + this.status.version;
    }

    parseMessage(list, message)
    {
        switch (list[0])
        {
            case 'status':

                let check = this.status.automations?.map(automation => automation.name);

                this.status = message;
                this.updateStates();

                if (this.controller.service == 'automation')
                {
                    if (JSON.stringify(check) != JSON.stringify(this.status.automations?.map(automation => automation.name)))
                        this.controller.showPage('automation');

                    this.updatePage();
                }

                break;

            case 'event':

                let html = 'Automation <b>' + message.automation + '</b> ';

                if (this.controller.service != 'automation')
                    break;

                switch (message.event)
                {
                    case 'nameDuplicate':  this.controller.showToast(html + 'name is already in use', 'error'); break;
                    case 'incompleteData': this.controller.showToast(html + 'data is incomplete', 'error'); break;

                    case 'added':
                        this.controller.showToast(html + 'successfully added');
                        this.controller.clearPage();
                        this.updated = false;
                        this.status = new Object();
                        break;

                    case 'updated':
                        this.controller.showToast(html + 'successfully updated');
                        this.updated = false;
                        this.showAutomationInfo(false);
                        break;

                    case 'removed':
                        this.controller.showToast(html + 'removed', 'warning');
                        this.updated = false;
                        break;
                }

                break;
        }
    }

    parseValue(value)
    {
        return value == 'true' || value == 'false' ? value == 'true' : isNaN(value) ? value : parseFloat(value);
    }

    itemProperty(item, form = false)
    {
        let device = this.controller.findDevice(item);

        if (form)
            return  (device.info ? device.info.name : '<span class="error">' + item.endpoint + '</span>') + ' <i class="icon-right"></i> ' + exposeTitle(item.property, item.endpoint.split('/')[2] ?? 'common');

        return '<span class="value">' + (device.info ? device.info.name : '<span class="error">' + item.endpoint + '</span>') + '</span> <i class="icon-right"></i> <span class="value">' + exposeTitle(item.property, device.info ? item.endpoint.split('/')[2] ?? 'common' : 'common') + '</span>';
    }

    handleCopy(item, list, append)
    {
        let element = modal.querySelector('.copy');

        if (append)
        {
            element.style.display = 'none';
            return;
        }

        element.addEventListener('click', function() { list.push({...item}); this.showAutomationInfo(); }.bind(this));
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

    triggerInfo(trigger)
    {
        let data;

        switch (trigger.type)
        {
            case 'property':
            case 'mqtt':

                for (let i = 0; i < this.triggerStatement.length; i++)
                {
                    let statement = this.triggerStatement[i];

                    if (!trigger.hasOwnProperty(statement))
                        continue;

                    data = (trigger.type == 'property' ? this.itemProperty(trigger) + ' ' : '<span class="value">' + trigger.topic + '</span> ' + (trigger.property ? '<i class="icon-right"></i> <span class="value">' + trigger.property + '</span> ' : '')) + statement;

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

            case 'interval':
                data = 'every <span class="value">' + trigger.interval + '</span> ' + (trigger.interval != 1 ? 'minutes' : 'minute');
                break;
        }

        if (trigger.name)
            data += ' <span>with name</span> <span class="value">' + trigger.name + '</span>';

        if (trigger.force)
            data += ' <span class="shade">[force]</span>';

        return data;
    }

    conditionInfo(condition)
    {
        if (condition.type == 'week')
            return '<span class="value">' + condition.days.join(', ') + '</span>';

        for (let i = 0; i < this.conditionStatement.length; i++)
        {
            let statement = this.conditionStatement[i];
            let value;

            if (!condition.hasOwnProperty(statement))
                continue;

            value = statement == 'between' && Array.isArray(condition[statement]) ? condition[statement].join('</span> and <span class="value">') : condition[statement];

            switch (condition.type)
            {
                case 'property':
                case 'mqtt':
                    return (condition.type == 'property' ? this.itemProperty(condition) + ' ' : '<span class="value">' + condition.topic + '</span> ' + (condition.property ? '<i class="icon-right"></i> <span class="value">' + condition.property + '</span> ' : '')) + statement + ' <span class="value">' + value + '</span>';

                case 'state':
                case 'pattern':   
                    return '<span class="value">' + condition[condition.type == 'state' ? 'name' : 'pattern'] + '</span> ' + statement + ' <span class="value">' + value + '</span>';

                case 'date':
                    return statement + ' <span class="value">' + value + '</span>';

                case 'time':
                    return statement + ' <span class="value">' + value + '</span>';
            }
        }
    }

    actionInfo(action)
    {
        let data;

        switch (action.type)
        {
            case 'property':

                for (let i = 0; i < this.actionStatement.length; i++)
                {
                    let statement = this.actionStatement[i];

                    if (!action.hasOwnProperty(statement))
                        continue;

                    data = this.itemProperty(action) + ' <i class="icon-right"></i> ' + (statement == 'increase' ? '<span class="value">+</span> ' : statement == 'decrease' ? '<span class="value">-</span> ' : '') + '<span class="value">' + action[statement] + '</span>';
                }

                break;

            case 'mqtt':
                data = '<span class="value">' + action.message + '</span> to <span class="value">' + action.topic + '</span> topic' + (action.retain ? ' <span class="value">retained</span>' : '');
                break;

            case 'state':
                data = (action.value || action.value == false ? 'set' : 'remove') + ' <span class="value">' + action.name + '</span>' + (action.value || action.value == false ? ' to <span class="value">' + action.value + '</span>' : '');
                break;

            case 'telegram':
                data = (action.photo ? 'photo' : '<span class="value">' + action.message + '</span>') + (action.chats ? ' to <span class="value">' + action.chats.join(', ') + '</span>': '') + (action.silent ? ' <span class="shade">[silent]</span>' : '');
                break;

            case 'shell':
                data = '<span class="value">' + action.command + '</span>';
                break;

            case 'delay':
                data = '<span class="value">' + action.delay + '</span> seconds';
                break;
        }

        if (action.triggerName)
            data += ' <span>when trigger is</span> <span class="value">' + action.triggerName + '</span>';

        return data;
    }

    conditionDropdown(automation, list, type)
    {
        if (['AND', 'OR', 'NOT'].includes(type))
        {
            list.push({'type': type, 'conditions': new Array()});
            automation.showAutomationInfo();
            return;
        }

        automation.showCondition({'type': type}, list, true);
    }

    conditionList(automation, list, table, level = 0, colSpan = 0)
    {
        list?.forEach((condition, index) =>
        {
            let row = table.insertRow();

            for (let i = 0; i < 3; i++)
            {
                let cell = row.insertCell();

                switch (i)
                {
                    case 0:
                        for (let j = 0; j < level; j++) cell.innerHTML += '<span class="' + (j < level - 1 ? 'shade' : 'warning') + '"><i class="icon-enter"></i></span> ';
                        cell.innerHTML += ['AND', 'OR', 'NOT'].includes(condition.type) ? '<span class="value">' + condition.type + '</span>' : condition.type;
                        break;

                    case 1:

                        if (colSpan)
                            cell.colSpan = colSpan;

                        if (['AND', 'OR', 'NOT'].includes(condition.type))
                        {
                            cell.innerHTML = '<div class="dropdown"><i class="icon-plus"></i></div>';
                            cell.classList.add('right');
                            addDropdown(cell.querySelector('.dropdown'), automation.conditionType, function(type) { automation.conditionDropdown(automation, condition.conditions, type); }, 7);
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
        list?.forEach((action, index) =>
        {
            let row = table.insertRow();

            for (let i = 0; i < 5; i++)
            {
                let cell = row.insertCell();

                switch (i)
                {
                    case 0:
                        for (let j = 0; j < level; j++) cell.innerHTML += '<span class="' + (j < level - 1 ? 'shade' : 'warning') + '"><i class="icon-enter"></i></span> ';
                        cell.innerHTML += action.type == 'condition' ? '<span class="value">CONDITION</span>' : action.type;
                        break;

                    case 1:

                        if (action.type != 'condition')
                        {
                            cell.innerHTML = automation.actionInfo(action) ?? '<i>undefined</i>';
                            cell.classList.add('edit');
                            cell.addEventListener('click', function() { automation.showAction(action, list); });
                            break;
                        }

                        for (let j = 0; j < 3; j++)
                        {
                            let actionRow = table.insertRow();
                            let nameCell = actionRow.insertCell();
                            let actionCell = actionRow.insertCell();

                            for (let k = 0; k <= level; k++)
                                nameCell.innerHTML += '<span class="' + (k < level ? 'shade' : 'warning') + '"><i class="icon-enter"></i></span> ';

                            nameCell.colSpan = 4;
                            actionCell.innerHTML = '<div class="dropdown"><i class="icon-plus"></i></div>';

                            switch (j)
                            {
                                case 0:
                                    nameCell.innerHTML += '<span class="value">IF</span>';
                                    addDropdown(actionCell.querySelector('.dropdown'), automation.conditionType, function(type) { automation.conditionDropdown(automation, action.conditions, type); }, 7);
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


                    case 2:

                        if (list.length < 2 || index == list.length - 1)
                            break;

                        cell.innerHTML = '<i class="icon-down"></i>';
                        cell.classList.add('move');
                        cell.addEventListener('click', function() { list[index + 1] = list.splice(index, 1, list[index + 1])[0]; automation.showAutomationInfo(); });
                        break;

                    case 3:

                        if (list.length < 2 || !index)
                            break;

                        cell.innerHTML = '<i class="icon-up"></i>';
                        cell.classList.add('move');
                        cell.addEventListener('click', function() { list[index - 1] = list.splice(index, 1, list[index - 1])[0]; automation.showAutomationInfo(); });
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

    showPage(data)
    {
        let menu = document.querySelector('.menu');
        let list = data ? data.split('=') : new Array();
        let automation;

        menu.innerHTML  = '<span id="states"><i class="icon-settings"></i> States</span>';
        menu.innerHTML += '<span id="list"><i class="icon-list"></i> List</span>';
        menu.innerHTML += '<span id="add"><i class="icon-plus"></i> Add</span>';
        menu.innerHTML += '<span id="import" class="mobileHidden"><i class="icon-upload"></i> Import</span>';

        menu.querySelector('#states').addEventListener('click', function() { this.showStates(); }.bind(this));
        menu.querySelector('#list').addEventListener('click', function() { this.controller.showPage('automation'); }.bind(this));
        menu.querySelector('#add').addEventListener('click', function() { this.showAutomationInfo(false, true); }.bind(this));

        menu.querySelector('#import').addEventListener('click', function()
        {
            loadFile(function(data)
            {
                this.data = data;
                delete this.name;
                this.showAutomationInfo();

            }.bind(this));

        }.bind(this));

        if (!this.status.version)
            return;

        if (list[0] == 'index')
            automation = this.status.automations?.[list[1]];

        if (automation)
        {
            this.data = {...automation};
            this.name = automation.name;
            this.showAutomationInfo(false);
        }
        else
            this.showAutomationList();

        this.updatePage();
    }

    showStates()
    {
        fetch('html/automation/states.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.close').addEventListener('click', function() { showModal(false); });
            this.updateStates();
            showModal(true);
        });
    }
    
    showAutomationList()
    {
        if (!this.status.automations?.length)
        {
            this.content.innerHTML = '<div class="emptyList">automations list is empty</div>';
            return;
        }

        fetch('html/automation/automationList.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            let table;
            let count = 0;

            this.content.innerHTML = html;
            table = this.content.querySelector('.itemList table');

            this.status.automations.forEach((item, index) =>
            {
                let row = table.querySelector('tbody').insertRow();

                if (!item.conditions)
                    item.conditions = new Array();

                row.addEventListener('click', function() { this.controller.showPage('automation?index=' + index); }.bind(this));
                row.dataset.index = index;

                if (!item.active)
                    row.classList.add('inactive');

                for (let i = 0; i < 5; i++)
                {
                    let cell = row.insertCell();

                    switch (i)
                    {
                        case 0:

                            cell.innerHTML = item.name;

                            if (item.note)
                                row.title = item.note;

                            break;

                        case 1: cell.innerHTML = '<span class="value">' + item.triggers.length + '</span>'; cell.classList.add('center'); break;
                        case 2: cell.innerHTML = item.conditions.length ? '<span class="value">' + item.conditions.length + '</span>' : empty; cell.classList.add('center'); break;
                        case 3: cell.innerHTML = '<span class="value">' + item.actions.length + '</span>'; cell.classList.add('center'); break;
                        case 4: cell.innerHTML = empty; cell.classList.add('lastTriggered', 'right'); break;
                    }
                }

                count++;
            });

            table.querySelectorAll('th.sort').forEach(cell => cell.addEventListener('click', function() { let once = cell.classList.contains('once'); sortTable(table, this.dataset.index, true, once); if (!once) localStorage.setItem('automationSort', this.dataset.index); }));
            sortTable(table, localStorage.getItem('automationSort') ?? 0);

            table.querySelector('tfoot').innerHTML='<tr><th colspan="6">' + count + (count > 1 ? ' automations ' : ' automation ') + 'total</th></tr>';
        });
    }

    showAutomationInfo(updated = true, add = false)
    {
        fetch('html/automation/automationInfo.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            let triggers;
            let conditions;
            let actions;

            this.content.innerHTML = html;

            if (updated)
            {
                this.content.querySelector('.save').classList.add('warning');
                this.updated = true;
            }

            if (add)
            {
                this.data = {active: true, triggers: new Array(), conditions: new Array(), actions: new Array()};
                delete this.name;
            }

            if (this.name)
            {
                let automations = new Array();
                let list = new Array();
                let current;

                this.status.automations.forEach((automation, index) => { automations.push([index, automation.name.toLowerCase()]); });

                automations.sort(function(a, b) { return a[1] < b[1] ? -1 : 1; }).forEach((item, index) =>
                {
                    if (this.data.name.toLowerCase() == item[1])
                        current = index;

                    list.push(item[0]);
                });

                handleArrowButtons(this.content, list, current, function(index) { this.controller.showPage('automation?index=' + index); }.bind(this));
            }
            else
            {
                this.content.querySelector('.remove').style.display = 'none';
                this.content.querySelector('.copy').style.display = 'none';
                this.content.querySelector('.export').style.display = 'none';
                this.content.querySelector('.previous').style.display = 'none';
                this.content.querySelector('.next').style.display = 'none';
            }

            if (!this.data.name)
                this.data.name = 'Automation ' + randomString(4);

            this.content.querySelector('.edit').addEventListener('click', function() { this.showAutomationEdit(); }.bind(this));
            this.content.querySelector('.remove').addEventListener('click', function() { this.showAutomationRemove(); }.bind(this));
            this.content.querySelector('.save').addEventListener('click', function() { this.controller.socket.publish('command/automation', {action: 'updateAutomation', automation: this.name, data: this.data}); }.bind(this));
            this.content.querySelector('.copy').addEventListener('click', function() { delete this.data.active; this.data.name += ' (copy)'; delete this.name; this.showAutomationInfo(); }.bind(this));

            this.content.querySelector('.export').addEventListener('click', function()
            {
                let data = {...this.data};
                let item = document.createElement("a");

                delete data.active;
                delete data.lastTriggered;
                delete data.name;

                item.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
                item.download = this.data.name + '.json';
                item.click();

            }.bind(this));

            this.content.querySelector('.name').innerHTML = this.data.name + (this.name ? '' : ' <span class="warning value">NEW</span>');
            this.content.querySelector('.note').innerHTML = this.data.note ?? '';
            this.content.querySelector('.debounce').innerHTML = '<span class="value">' + (this.data.debounce ?? 0) + '</span> seconds';
            this.content.querySelector('.restart').innerHTML = '<span class="value">' + (this.data.restart ?? false) + '</span>';
            this.content.querySelector('.active').innerHTML = this.data.active ? '<i class="icon-true success"></i>' : '<i class="icon-false shade"></i>';

            triggers = this.content.querySelector('.triggers');
            conditions = this.content.querySelector('.conditions');
            actions = this.content.querySelector('.actions');

            addDropdown(this.content.querySelector('.addTrigger'), this.triggerType, function(type) { this.showTrigger({'type': type}, true); }.bind(this));
            addDropdown(this.content.querySelector('.addCondition'), this.conditionType, function(type) { this.conditionDropdown(this, this.data.conditions, type); }.bind(this), 7);
            addDropdown(this.content.querySelector('.addAction'), this.actionType, function(type) { this.actionDropdown(this, this.data.actions, type); }.bind(this), 5);

            this.data.triggers.forEach((trigger, index) =>
            {
                let row = triggers.insertRow();

                for (let i = 0; i < 3; i++)
                {
                    let cell = row.insertCell();

                    switch (i)
                    {
                        case 0: cell.innerHTML = trigger.type; break;

                        case 1:
                            cell.innerHTML = this.triggerInfo(trigger) ?? '<i>undefined</i>';
                            cell.classList.add('edit');
                            cell.addEventListener('click', function() { this.showTrigger(trigger); }.bind(this));
                            break;

                        case 2:
                            cell.innerHTML = '<i class="icon-trash"></i>';
                            cell.classList.add('remove');
                            cell.addEventListener('click', function() { this.data.triggers.splice(index, 1); this.showAutomationInfo(); }.bind(this));
                            break;
                    }
                }
            });

            this.conditionList(this, this.data.conditions, conditions);
            this.actionList(this, this.data.actions, actions);

            showModal(false);
        });
    }

    showAutomationEdit()
    {
        fetch('html/automation/automationEdit.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = this.data.name;
            modal.querySelector('input[name="name"]').value = this.data.name;
            modal.querySelector('textarea[name="note"]').value = this.data.note ?? '';
            modal.querySelector('input[name="debounce"]').value = this.data.debounce ?? 0;
            modal.querySelector('input[name="restart"]').checked = this.data.restart ?? false;
            modal.querySelector('input[name="active"]').checked = this.data.active;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                this.data.name = form.name;
                this.data.note = form.note;
                this.data.debounce = form.debounce;
                this.data.restart = form.restart;
                this.data.active = form.active;

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });
            showModal(true, 'input[name="name"]');
        });
    }

    showAutomationRemove()
    {
        fetch('html/automation/automationRemove.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = this.data.name;
            modal.querySelector('.remove').addEventListener('click', function() { this.controller.socket.publish('command/automation', {action: 'removeAutomation', automation: this.name}); this.controller.clearPage(); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });
            showModal(true);
        });
    }

    showTrigger(trigger, append = false)
    {
        switch (trigger.type)
        {
            case 'property': this.showPropertyItem(trigger, this.data.triggers, this.triggerStatement, append, 'trigger'); break;
            case 'mqtt':     this.showMqttItem(trigger, this.data.triggers, this.triggerStatement, append, 'trigger'); break;
            case 'telegram': this.showTelegramTrigger(trigger, append); break;
            case 'time':     this.showTimeTrigger(trigger, append); break;
            case 'interval': this.showIntervalTrigger(trigger, append); break;
        }
    }

    showCondition(condition, list, append = false)
    {
        switch (condition.type)
        {
            case 'property': this.showPropertyItem(condition, list, this.conditionStatement, append, 'condition'); break;
            case 'mqtt':     this.showMqttItem(condition, list, this.conditionStatement, append, 'condition'); break;
            case 'state':    this.showStatePatternCondition(condition, list, append, condition.type); break;
            case 'date':     this.showDateTimeCondition(condition, list, append, condition.type); break;
            case 'time':     this.showDateTimeCondition(condition, list, append, condition.type); break;
            case 'week':     this.showWeekCondition(condition, list, append); break;
            case 'pattern':  this.showStatePatternCondition(condition, list, append, condition.type); break;
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

    showPropertyItem(item, list, statements, append, type)
    {
        fetch('html/automation/propertyItem.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            let properties = this.controller.propertiesList();
            let data;

            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = 'Property ' + type;
            modal.querySelector('.property').innerHTML = append ? 'Select property there <i class="icon-right"></i>' : this.itemProperty(item, true);

            addDropdown(modal.querySelector('.dropdown'), Object.keys(properties), function(key)
            {
                data = properties[key];
                modal.querySelector('.property').innerHTML = this.itemProperty(data, true);
                modal.querySelector('.property').classList.remove('error');

            }.bind(this));

            statements.forEach(statement =>
            {
                let option = document.createElement('option');

                option.innerHTML = statement;
                modal.querySelector('select[name="statement"]').append(option);

                if (!item.hasOwnProperty(statement))
                    return;

                modal.querySelector('select[name="statement"]').value = statement;

                if (statement == 'between')
                {
                    modal.querySelector('input[name="min"]').value = item[statement][0];
                    modal.querySelector('input[name="max"]').value = item[statement][1];
                }
                else
                    modal.querySelector('textarea[name="value"]').value = statement != 'updates' ? item[statement] : '';

                this.valueForm(modal, statement);
            });

            modal.querySelector('#value.dropdown').style.display = type == 'trigger' ? 'none' : 'inline';
            
            modal.querySelector('.triggerName').style.display = type == 'condition' ? 'none' : 'block';
            modal.querySelector('input[name="triggerName"]').value = (type == 'trigger' ? item.name : item.triggerName) ?? '';

            modal.querySelector('.force').style.display = type != 'trigger' ? 'none' : 'block';
            modal.querySelector('input[name="force"]').checked = item.force ?? false;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                if (data)
                {
                    item.endpoint = data.endpoint;
                    item.property = data.property;
                }

                if (!item.endpoint || !item.property)
                {
                    modal.querySelector('.property').classList.add('error');
                    return;
                }

                statements.forEach(statement => delete item[statement]);
                item[form.statement] = form.statement == 'between' ? [this.parseValue(form.min), this.parseValue(form.max)] : form.statement != 'updates' ? this.parseValue(form.value) : true;

                if (form.triggerName)
                    item[type == 'trigger' ? 'name' : 'triggerName'] = form.triggerName;
                else
                    delete item[type == 'trigger' ? 'name' : 'triggerName'];

                if (form.force && type == 'trigger')
                    item.force = true;
                else
                    delete item.force;

                if (append)
                    list.push(item);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('select[name="statement"]').addEventListener('change', function(event) { this.valueForm(modal, event.target.value); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(item, list, append);
            showModal(true);
        });
    }

    showMqttItem(item, list, statements, append, type)
    {
        fetch('html/automation/mqttItem.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = 'MQTT ' + type;
            modal.querySelector('input[name="topic"]').value = item.topic ?? '';
            modal.querySelector('input[name="property"]').value = item.property ?? '';

            statements.forEach(statement =>
            {
                let option = document.createElement('option');

                option.innerHTML = statement;
                modal.querySelector('select[name="statement"]').append(option);

                if (!item.hasOwnProperty(statement))
                    return;

                modal.querySelector('select[name="statement"]').value = statement;

                if (statement == 'between')
                {
                    modal.querySelector('input[name="min"]').value = item[statement][0];
                    modal.querySelector('input[name="max"]').value = item[statement][1];
                }
                else
                    modal.querySelector('textarea[name="value"]').value = statement != 'updates' ? item[statement] : '';

                this.valueForm(modal, statement);
            });

            modal.querySelector('#value.dropdown').style.display = type == 'trigger' ? 'none' : 'inline';

            modal.querySelector('.triggerName').style.display = type == 'condition' ? 'none' : 'block';
            modal.querySelector('input[name="triggerName"]').value = (type == 'trigger' ? item.name : item.triggerName) ?? '';

            modal.querySelector('.force').style.display = type != 'trigger' ? 'none' : 'block';
            modal.querySelector('input[name="force"]').checked = item.force ?? false;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                statements.forEach(statement => delete item[statement]);

                item.topic = form.topic;
                item.property = form.property;
                item[form.statement] = form.statement == 'between' ? [this.parseValue(form.min), this.parseValue(form.max)] : form.statement != 'updates' ? this.parseValue(form.value) : true;

                if (form.triggerName)
                    item[type == 'trigger' ? 'name' : 'triggerName'] = form.triggerName;
                else
                    delete item[type == 'trigger' ? 'name' : 'triggerName'];

                if (form.force && type == 'trigger')
                    item.force = true;
                else
                    delete item.force;
                
                if (append)
                    list.push(item);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('select[name="statement"]').addEventListener('change', function(event) { this.valueForm(modal, event.target.value); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(item, list, append);
            showModal(true, 'input[name="topic"]');
        });
    }

    showTelegramTrigger(trigger, append)
    {
        fetch('html/automation/telegramTrigger.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('textarea[name="message"]').value = trigger.message ?? '';
            modal.querySelector('input[name="chats"]').value = trigger.chats ? trigger.chats.join(', ') : '';
            modal.querySelector('input[name="name"]').value = trigger.name ?? '';

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));
                let chats = form.chats ? form.chats.split(',').map(item => parseInt(item)).filter(item => !isNaN(item)) : new Array();

                trigger.message = form.message.trim();
                trigger.chats = chats.length ? chats : null;

                if (form.name)
                    trigger.name = form.name;
                else
                    delete trigger.name;

                if (append)
                    this.data.triggers.push(trigger);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(trigger, this.data.triggers, append);
            showModal(true, 'textarea[name="message"]');
        });
    }

    showTimeTrigger(trigger, append)
    {
        fetch('html/automation/timeTrigger.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('input[name="time"]').value = trigger.time ?? '12:00';
            modal.querySelector('input[name="name"]').value = trigger.name ?? '';

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                trigger.time = form.time;

                if (form.name)
                    trigger.name = form.name;
                else
                    delete trigger.name;

                if (append)
                    this.data.triggers.push(trigger);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(trigger, this.data.triggers, append);
            showModal(true, 'input[name="time"]');
        });
    }

    showIntervalTrigger(trigger, append)
    {
        fetch('html/automation/intervalTrigger.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('input[name="interval"]').value = trigger.interval ?? '10';
            modal.querySelector('input[name="name"]').value = trigger.name ?? '';

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                trigger.interval = form.interval;

                if (form.name)
                    trigger.name = form.name;
                else
                    delete trigger.name;

                if (append)
                    this.data.triggers.push(trigger);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(trigger, this.data.triggers, append);
            showModal(true, 'input[name="interval"]');
        });
    }

    showStatePatternCondition(condition, list, append, type)
    {
        fetch('html/automation/' + type + 'Condition.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector(type == 'state' ? 'input[name="name"]' : 'textarea[name="pattern"]').value = condition[type == 'state' ? 'name' : 'pattern'] ?? '';

            this.conditionStatement.forEach(statement =>
            {
                let option = document.createElement('option');

                option.innerHTML = statement;
                modal.querySelector('select[name="statement"]').append(option);

                if (!condition.hasOwnProperty(statement))
                    return;

                    modal.querySelector('select[name="statement"]').value = statement;

                if (statement == 'between')
                {
                    modal.querySelector('input[name="min"]').value = condition[statement][0];
                    modal.querySelector('input[name="max"]').value = condition[statement][1];
                }
                else
                    modal.querySelector('textarea[name="value"]').value = condition[statement];

                this.valueForm(modal, statement);
            });

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));
                let item = type == 'state' ? 'name' : 'pattern';

                this.conditionStatement.forEach(statement => delete condition[statement]);

                condition[item] = form[item];
                condition[form.statement] = form.statement == 'between' ? [this.parseValue(form.min), this.parseValue(form.max)] : this.parseValue(form.value);

                if (append)
                    list.push(condition);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('select[name="statement"]').addEventListener('change', function(event) { this.valueForm(modal, event.target.value); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(condition, this.data.conditions, append);
            showModal(true, type == 'state' ? 'input[name="name"]' : 'textarea[name="pattern"]');
        });
    }

    showDateTimeCondition(condition, list, append, type)
    {
        fetch('html/automation/' + type + 'Condition.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;

            this.conditionStatement.forEach(statement =>
            {
                let option = document.createElement('option');

                option.innerHTML = statement;
                modal.querySelector('select[name="statement"]').append(option);

                if (!condition.hasOwnProperty(statement))
                    return;

                modal.querySelector('select[name="statement"]').value = statement;

                if (statement == 'between')
                {
                    modal.querySelector('input[name="start"]').value = condition[statement][0];
                    modal.querySelector('input[name="end"]').value = condition[statement][1];
                }
                else
                    modal.querySelector('input[name="value"]').value = condition[statement];

                this.valueForm(modal, statement);
            });

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                this.conditionStatement.forEach(statement => delete condition[statement]);
                condition[form.statement] = form.statement == 'between' ? [form.start, form.end] : form.value;

                if (append)
                    list.push(condition);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('select[name="statement"]').addEventListener('change', function(event) { this.valueForm(modal, event.target.value); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(condition, this.data.conditions, append);
            showModal(true, 'input[name="value"]');
        });
    }

    showWeekCondition(condition, list, append)
    {
        fetch('html/automation/weekCondition.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('input[name="days"]').value = condition.days ? condition.days.join(', ') : '';

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));
                let days = form.days ? form.days.split(',').map(item => parseInt(item)).filter(item => !isNaN(item)) : new Array();

                condition.days = days.length ? days : null;

                if (append)
                    list.push(condition);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(condition, this.data.conditions, append);
            showModal(true, 'input[name="days"]');
        });
    }

    showMqttAction(action, list, append)
    {
        fetch('html/automation/mqttAction.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('input[name="topic"]').value = action.topic ?? '';
            modal.querySelector('textarea[name="message"]').value = action.message ?? '';
            modal.querySelector('input[name="triggerName"]').value = action.triggerName ?? '';
            modal.querySelector('input[name="retain"]').checked = action.retain ?? false;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                action.topic = form.topic;
                action.message = form.message.trim();
                action.retain = form.retain;

                if (form.triggerName)
                    action.triggerName = form.triggerName;
                else
                    delete action.triggerName;

                if (append)
                    list.push(action);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(action, this.data.actions, append);
            showModal(true, 'input[name="topic"]');
        });
    }

    showStateAction(action, list, append)
    {
        fetch('html/automation/stateAction.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('input[name="name"]').value = action.name ?? '';
            modal.querySelector('textarea[name="value"]').value = action.value ?? '';
            modal.querySelector('input[name="triggerName"]').value = action.triggerName ?? '';

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                action.name = form.name;
                action.value = this.parseValue(form.value);

                if (form.triggerName)
                    action.triggerName = form.triggerName;
                else
                    delete action.triggerName;

                if (append)
                    list.push(action);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(action, this.data.actions, append);
            showModal(true, 'input[name="name"]');
        });
    }

    showTelegramAction(action, list, append)
    {
        fetch('html/automation/telegramAction.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('textarea[name="message"]').value = action.message ?? '';
            modal.querySelector('textarea[name="file"]').value = action.file ?? '';
            modal.querySelector('input[name="photo"]').value = action.photo ?? '';
            modal.querySelector('textarea[name="keyboard"]').value = action.keyboard ?? '';
            modal.querySelector('input[name="thread"]').value = action.thread ? action.thread : '';
            modal.querySelector('input[name="chats"]').value = action.chats ? action.chats.join(', ') : '';
            modal.querySelector('input[name="triggerName"]').value = action.triggerName ?? '';
            modal.querySelector('input[name="silent"]').checked = action.silent ?? false;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));
                let chats = form.chats ? form.chats.split(',').map(item => parseInt(item)).filter(item => !isNaN(item)) : new Array();

                action.message = form.message.trim();
                action.file = form.file.trim();
                action.photo = form.photo.trim();
                action.keyboard = form.keyboard.trim();
                action.chats = chats.length ? chats : null;
                action.silent = form.silent;

                if (form.thread)
                    action.thread = form.thread;
                else
                    delete action.thread;

                if (form.triggerName)
                    action.triggerName = form.triggerName;
                else
                    delete action.triggerName;

                if (append)
                    list.push(action);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(action, this.data.actions, append);
            showModal(true, 'textarea[name="message"]');
        });
    }

    showShellAction(action, list, append)
    {
        fetch('html/automation/shellAction.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('textarea[name="command"]').value = action.command ?? '';
            modal.querySelector('input[name="triggerName"]').value = action.triggerName ?? '';

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                action.command = form.command.trim();

                if (form.triggerName)
                    action.triggerName = form.triggerName;
                else
                    delete action.triggerName;

                if (append)
                    list.push(action);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(action, this.data.actions, append);
            showModal(true, 'textarea[name="command"]');
        });
    }

    showDelayAction(action, list, append)
    {
        fetch('html/automation/delayAction.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('textarea[name="delay"]').value = action.delay ?? '';
            modal.querySelector('input[name="triggerName"]').value = action.triggerName ?? '';

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                action.delay = form.delay;

                if (form.triggerName)
                    action.triggerName = form.triggerName;
                else
                    delete action.triggerName;

                if (append)
                    list.push(action);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(action, this.data.actions, append);
            showModal(true, 'textarea[name="delay"]');
        });
    }

    showAlert(page)
    {
        fetch('html/automation/alert.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = this.data.name;
            modal.querySelector('.leave').addEventListener('click', function() { this.updated = false; this.controller.showPage(page); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });
            showModal(true);
        });
    }
}
