const columnOrder = ['to-do-week', 'to-do-today', 'in-progress', 'finished'];

function createTaskElement(task) {
  const taskElement = document.createElement('div');
  taskElement.className = 'task-card';
  taskElement.dataset.taskId = task.id;

  taskElement.innerHTML = `
    <div class="task-title" contenteditable="true" onblur="updateTaskTitle(${task.id}, this)">${task.title}</div>
    <div class="task-buttons">
      ${getButtonsForTask(task)}
    </div>
  `;
  return taskElement;
}

function initializeSortable() {
    columnOrder.forEach(columnId => {
      const columnElement = document.getElementById(columnId);
  
      Sortable.create(columnElement, {
        group: 'columns', // Enable moving items between columns
        animation: 150,
        handle: '.task-card',
        draggable: '.task-card',
        onEnd: function (evt) {
          // Update task order in the client-side state here
          // Optionally, save to localStorage or send to the server when appropriate
        },
      });
    });
}
  
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
          if (!columnElement) return;
  
          const taskElement = createTaskElement(task);
          columnElement.appendChild(taskElement);
        });
  
        // Add "Add a card" buttons to columns
        columnOrder.forEach(status => {
          const column = document.getElementById(status);
          const addCard = document.createElement('div');
          addCard.className = 'add-card';
          addCard.textContent = '+ Add a card';
          addCard.onclick = () => addTask(status);
          column.appendChild(addCard);
        });
  
        // Initialize Sortable
        initializeSortable();
      })
      .catch(error => {
        console.error('Error loading tasks:', error);
      });
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
            const todayStr = today.toISOString().split('T')[0]; // 'YYYY-MM-DD'
            const todayWeekday = today.getDay().toString(); // '0' (Sunday) to '6' (Saturday)

            habits.forEach(habit => {
                const isAvailableToday = habit.days.includes(todayWeekday);
                if (!isAvailableToday) {
                    // Skip habits not scheduled for today
                    return;
                }

                const habitElement = document.createElement('div');
                const habitDates = habit.dates || [];
                const isCompletedToday = habitDates.includes(todayStr);

                habitElement.className = `habit ${isCompletedToday ? 'habit-complete' : 'habit-incomplete'}`;
                habitElement.innerHTML = `<h3>${habit.name}</h3>`;
                habitElement.onclick = () => toggleHabit(habitElement, habit.id);
                habitsContainer.appendChild(habitElement);
            });
        })
        .catch(error => {
            console.error('Error loading habits:', error);
        });
}

function addHabit() {
    const name = document.getElementById('new-habit').value;
    const dayCheckboxes = document.querySelectorAll('#day-select input[type="checkbox"]:checked');
    const days = Array.from(dayCheckboxes).map(cb => cb.value);
    // console.log(days)
    if (name) {
        axios.post('/api/habits', { name, days })
            .then(() => {
                document.getElementById('new-habit').value = '';
                // Clear checkboxes
                document.querySelectorAll('#day-select input[type="checkbox"]').forEach(cb => cb.checked = false);
                loadHabits();
            });
    }
}

function toggleHabit(element, habitId) {
    const today = new Date().toISOString().split('T')[0];

    // Toggle the visual state immediately
    const isCurrentlyCompleted = element.classList.contains('habit-complete');

    if (isCurrentlyCompleted) {
        // Remove 'habit-complete', add 'habit-incomplete'
        element.classList.remove('habit-complete');
        element.classList.add('habit-incomplete');
    } else {
        // Add 'habit-complete', remove 'habit-incomplete'
        element.classList.add('habit-complete');
        element.classList.remove('habit-incomplete');
    }

    // Send the request to the backend
    axios.put(`/api/habits/${habitId}`, { toggle_date: today })
        .then(response => {
            if (!response.data.success) {
                console.error(`Failed to toggle habit ${habitId}`);
                // Optionally revert the visual change if the backend fails
                toggleVisualState(element);
            }
        })
        .catch(error => {
            console.error('Error toggling habit:', error.response ? error.response.data : error.message);
            // Optionally revert the visual change if the backend fails
            toggleVisualState(element);
        });
}

// Helper function to revert visual state if needed
function toggleVisualState(element) {
    const isCompleted = element.classList.contains('habit-complete');
    if (isCompleted) {
        element.classList.remove('habit-complete');
        element.classList.add('habit-incomplete');
    } else {
        element.classList.add('habit-complete');
        element.classList.remove('habit-incomplete');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    // Load tasks and habits on page load
    loadTasks();
    loadHabits();
});