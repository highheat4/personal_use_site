const columnOrder = ['to-do-week', 'to-do-today', 'in-progress', 'finished'];

function loadTasks() {
    axios.get('/api/tasks')
        .then(response => {
            const tasks = response.data;

            // Clear columns
            columnOrder.forEach(status => {
                const column = document.getElementById(status);
                column.innerHTML = `
                    <div class="column-header">
                        <span class="column-title">${column.id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</span>
                        <span>...</span>
                    </div>
                `;
            });

            tasks.forEach(task => {
                const columnElement = document.getElementById(task.status);
                if (!columnElement) {
                    // Skip tasks with statuses that don't have corresponding columns
                    console.warn(`No column found for status '${task.status}'. Skipping task ID ${task.id}.`);
                    return;
                }

                const taskElement = document.createElement('div');
                taskElement.className = 'task-card';
                taskElement.draggable = true;

                taskElement.dataset.taskId = task.id;
                taskElement.innerHTML = `
                    <div class="task-title" contenteditable="true" onblur="updateTaskTitle(${task.id}, this)">${task.title}</div>
                    <div class="task-buttons">
                        ${getButtonsForTask(task)}
                    </div>
                `;

                taskElement.addEventListener('dragstart', handleDragStart);
                taskElement.addEventListener('dragend', handleDragEnd);
                taskElement.addEventListener('dragover', handleDragOver);

                columnElement.appendChild(taskElement);
            });

            // Add "Add a card" buttons to columns
            columnOrder.forEach(status => {
                const column = document.getElementById(status);
                column.addEventListener('dragover', handleDragOver);
                column.addEventListener('drop', handleDrop);

                const addCard = document.createElement('div');
                addCard.className = 'add-card';
                addCard.textContent = '+ Add a card';
                addCard.onclick = () => addTask(status);
                column.appendChild(addCard);
            });
        })
        .catch(error => {
            console.error('Error loading tasks:', error);
        });
}

let draggedTask = null;
let placeholder = null;

function handleDragStart(event) {
    draggedTask = event.target;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/html', draggedTask.outerHTML);
    draggedTask.classList.add('dragging');
    
    // Create placeholder
    placeholder = document.createElement('div');
    placeholder.className = 'task-card placeholder';
    placeholder.style.height = `${draggedTask.offsetHeight}px`;
}

function handleDragOver(event) {
    event.preventDefault();
    const column = event.currentTarget;
    const afterElement = getDragAfterElement(column, event.clientY);
    
    if (afterElement) {
        column.insertBefore(placeholder, afterElement);
    } else {
        const lastTaskCard = column.querySelector('.task-card:last-of-type');
        if (lastTaskCard) {
            column.insertBefore(placeholder, lastTaskCard.nextSibling);
        }
    }
}

function handleDrop(event) {
    event.preventDefault();
    const column = event.currentTarget;
    column.removeChild(placeholder);
    
    if (draggedTask.parentElement !== column) {
        const lastTaskCard = column.querySelector('.task-card:last-of-type');
        if (lastTaskCard) {
            column.insertBefore(draggedTask, lastTaskCard.nextSibling);
        } else {
            column.insertBefore(draggedTask, column.querySelector('.add-card'));
        }
        moveTask(draggedTask.dataset.taskId, column.id);
    } else {
        const afterElement = getDragAfterElement(column, event.clientY);
        if (afterElement) {
            column.insertBefore(draggedTask, afterElement);
        } else {
            const lastTaskCard = column.querySelector('.task-card:last-of-type');
            if (lastTaskCard && lastTaskCard !== draggedTask) {
                column.insertBefore(draggedTask, lastTaskCard.nextSibling);
            }
        }
    }
    updateTaskOrder(column);
}

function handleDragEnd(event) {
    draggedTask.classList.remove('dragging');
    draggedTask = null;
    if (placeholder && placeholder.parentNode) {
        placeholder.parentNode.removeChild(placeholder);
    }
    placeholder = null;
}

function getDragAfterElement(column, y) {
    const draggableElements = [...column.querySelectorAll('.task-card:not(.dragging):not(.placeholder)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function updateTaskOrder(column) {
    const tasks = column.querySelectorAll('.task-card');
    const order = Array.from(tasks).map(task => task.dataset.taskId);
    axios.put('/api/tasks/order', { order, status: column.id }) //! WE don't have an api/tasks/order!
        .then(() => loadTasks());
}

function getButtonsForTask(task) {
    switch (task.status) {
        case 'to-do-week':
            return `<button class="task-button" onclick="moveTask(${task.id}, 'to-do-today')">→ Today</button>`;
        case 'to-do-today':
            return `
                <button class="task-button" onclick="moveTask(${task.id}, 'in-progress')">▶ IP</button>
                <button class="task-button" onclick="moveTask(${task.id}, 'finished')">✓</button>
            `;
        case 'in-progress':
            return `
                <button class="task-button" onclick="moveTask(${task.id}, 'to-do-week')">↺ Week</button>
                <button class="task-button" onclick="moveTask(${task.id}, 'to-do-today')">↺ Today</button>
                <button class="task-button" onclick="moveTask(${task.id}, 'finished')">✓</button>
            `;
        case 'finished':
            return `
                <button class="task-button" onclick="moveTask(${task.id}, 'to-do-week')">↺ Week</button>
                <button class="task-button" onclick="moveTask(${task.id}, 'to-do-today')">↺ Today</button>
            `;
        default:
            return '';
    }
}

function addTask(status) {
    const column = document.getElementById(status);
    
    // Hide the "Add a card" button
    const addCardButton = column.querySelector('.add-card');
    addCardButton.style.display = 'none';

    // Create a new task card div
    const newCard = document.createElement('div');
    newCard.classList.add('task-card');
    newCard.contentEditable = 'true';  // Make the new card editable

    // Add event listener to handle saving when 'Enter' is pressed
    newCard.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();  // Prevent new lines when pressing Enter
            const taskTitle = newCard.textContent.trim();
            if (taskTitle) {
                // Send task title and status to the backend
                axios.post('/api/tasks', { title: taskTitle, status })
                    .then(() => {
                        loadTasks();  // Reload tasks after adding new one
                        addCardButton.style.display = 'block';  // Show "Add a card" button again
                    });
            } else {
                // Remove the card if no text was entered
                newCard.remove();
                addCardButton.style.display = 'block';  // Show "Add a card" button again
            }
        }
    });

    // Add event listener for "Escape" key to discard the card
    newCard.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            newCard.remove();  // Discard the new card
            addCardButton.style.display = 'block';  // Show "Add a card" button again
        }
    });

    // Append the new card to the column
    column.appendChild(newCard);
    // Focus on the new card to allow typing immediately
    newCard.focus();
}

function moveTask(taskId, newStatus) {
    axios.put(`/api/tasks/${taskId}`, { status: newStatus })
        .then(() => loadTasks());
}

function updateTaskTitle(taskId, element) {
    const newTitle = element.textContent.trim();
    axios.put(`/api/tasks/${taskId}`, { title: newTitle })
    .then((response) => {
        if (response.data.deleted) {
            // If the task was deleted (empty title), remove it from the UI
            element.closest('.task-card').remove();
        } else {
            // If the task was updated, reload tasks to reflect any changes
            loadTasks();
        }
    })
    .catch((error) => {
        console.error('Error updating task:', error);
        loadTasks(); // Reload tasks to ensure UI is in sync with server
    });
}

function loadHabits() {
    axios.get('/api/habits')
        .then(response => {
            const habits = response.data;
            const habitsContainer = document.getElementById('habits');
            habitsContainer.innerHTML = '';
            const today = new Date();
            habits.forEach(habit => {
                const habitElement = document.createElement('div');
                const today = new Date().toISOString().split('T')[0];
                const isAvailableToday = habit.days.includes(today.getDay().toString());
                const isCompletedToday = habit.dates.some(date => 
                    new Date(date).toDateString() === today.toDateString()
                );
                habitElement.className = `habit ${isAvailableToday ? 'habit-available' : 'habit-unavailable'} ${isCompletedToday ? 'habit-complete' : 'habit-incomplete'}`;
                habitElement.textContent = habit.name;
                //if (isAvailableToday) {
                    habitElement.onclick = () => toggleHabit(habit.id);
                //}
                habitsContainer.appendChild(habitElement);
            });
        });
}

function addHabit() {
    const name = document.getElementById('new-habit').value;
    const days = []; // You might want to add a way for users to select days
    if (name) {
        axios.post('/api/habits', { name, days })
            .then(() => {
                document.getElementById('new-habit').value = '';
                loadHabits();
            });
    }
}

function toggleHabit(habitId) {
    const today = new Date().toISOString().split('T')[0];
    axios.put(`/api/habits/${habitId}`, { toggle_date: today })
    .then(response => {
        if (response.data.success) {
            console.log(`Habit ${habitId} toggled successfully`);
            loadHabits();
        } else {
            console.error(`Failed to toggle habit ${habitId}`);
        }
    })
    .catch(error => {
        console.error('Error toggling habit:', error.response ? error.response.data : error.message);
    });
}

document.getElementById('menu-toggle').addEventListener('click', function() {
    document.body.classList.toggle('menu-active');
});

// Load tasks and habits on page load
loadTasks();
loadHabits();