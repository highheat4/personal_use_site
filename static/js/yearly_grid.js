let currentYear = new Date().getFullYear();
let displayMode = 'combined';
const dayWidth = 30;  // Updated width of each day square
const dayHeight = 30; // Updated height of each day square
const gutter = 2;     // Space between squares

function getLocalDateString(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2,'0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

document.addEventListener('DOMContentLoaded', function() {
    // Set the current year display
    document.getElementById('current-year').textContent = currentYear;

    // Add event listeners to navigation buttons
    document.getElementById('prev-year').addEventListener('click', () => {
        currentYear--;
        updateYearlyGrid();
    });

    document.getElementById('next-year').addEventListener('click', () => {
        currentYear++;
        updateYearlyGrid();
    });

    // Add event listener to the display mode toggle
    const displayModeSelect = document.getElementById('display-mode');
    displayModeSelect.value = displayMode; // Set default value
    displayModeSelect.addEventListener('change', () => {
        displayMode = displayModeSelect.value;
        updateYearlyGrid();
    });

    // Fetch the initial data
    updateYearlyGrid();
});

function updateYearlyGrid() {
    document.getElementById('current-year').textContent = currentYear;

    // Disable the next button if currentYear is the same as the current year
    const nextYearButton = document.getElementById('next-year');
    if (currentYear >= new Date().getFullYear()) {
        nextYearButton.disabled = true;
    } else {
        nextYearButton.disabled = false;
    }

    fetchHistoryData(currentYear);
}

function fetchHistoryData(year) {
    axios.get(`/api/history?year=${year}`)
        .then(response => {
            const data = response.data;
            renderHeatmap(data, year, displayMode); // Pass displayMode
        })
        .catch(error => {
            console.error('Error fetching history data:', error);
            alert('No data available for this year.');
        });
}

function renderHeatmap(data, year, displayMode) {
    const container = document.getElementById('heatmap-container');
    container.innerHTML = '';
    const currentDate = new Date();

    const dataMap = new Map(Object.entries(data));

    // Create the main grid container
    const grid = document.createElement('div');
    grid.classList.add('heatmap-grid');

    // Iterate over each month
    for (let month = 0; month < 12; month++) {
        if (currentYear >= currentDate.getFullYear() && month > currentDate.getMonth()) {
            break;
        }

        const monthColumn = document.createElement('div');
        monthColumn.classList.add('month-column');

        const monthDate = new Date(year, month, 1);
        const monthName = monthDate.toLocaleString('default', { month: 'short' });

        // Create the month label
        const monthLabel = document.createElement('div');
        monthLabel.classList.add('month-label');
        monthLabel.textContent = monthName;
        monthColumn.appendChild(monthLabel);

        // Optionally, add weekday labels
        const weekdaysRow = document.createElement('div');
        weekdaysRow.classList.add('weekdays-row');
        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        weekdays.forEach(dayName => {
            const weekdayLabel = document.createElement('div');
            weekdayLabel.classList.add('weekday-label');
            weekdayLabel.textContent = dayName;
            weekdaysRow.appendChild(weekdayLabel);
        });
        monthColumn.appendChild(weekdaysRow);

        // Get the weekday of the first day of the month
        const firstWeekday = monthDate.getDay();

        // Create a grid for days
        const daysGrid = document.createElement('div');
        daysGrid.classList.add('days-grid');

        // Add empty cells for days before the first of the month
        for (let i = 0; i < firstWeekday; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.classList.add('day-cell', 'empty-cell');
            daysGrid.appendChild(emptyCell);
        }

        // Get total days in the month
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Create day cells
        for (let day = 1; day <= daysInMonth; day++) {

            if (currentYear >= currentDate.getFullYear() && (month == currentDate.getMonth() && day > currentDate.getDate() || (month > currentDate.getMonth()))) {
                break;
            }

            const date = new Date(year, month, day);
            const dateStr = getLocalDateString(date);

            const dayCell = document.createElement('div');
            dayCell.classList.add('day-cell');
            dayCell.dataset.date = dateStr;

            const dayData = dataMap.get(dateStr);
            let shade = '#444';

            if (dayData) {
                if (displayMode === 'combined') {
                    shade = getCombinedShade(dayData);
                } else if (displayMode === 'habits') {
                    shade = getHabitShade(dayData);
                } else if (displayMode === 'tasks') {
                    shade = getTaskShade(dayData);
                }
            } else {
                shade = '#444'; // Default shade when no data
            }
            dayCell.style.backgroundColor = shade;

            // Make the cell clickable
            dayCell.classList.add('clickable');
            dayCell.addEventListener('click', () => {
                if (dayData) {
                    showDetailsModal(dateStr, dayData);
                } else {
                    showDetailsModal(dateStr, {
                        availableHabits: 0,
                        completedHabits: 0,
                        completedTasks: [],
                        completedHabitsList: [],
                        completionRate: null
                    });
                }
            });

            daysGrid.appendChild(dayCell);
        }

        monthColumn.appendChild(daysGrid);
        grid.appendChild(monthColumn);
    }

    // Append grid to container
    container.appendChild(grid);

    // Remove calls to renderMonthLabels and renderWeekdayLabels
    // renderMonthLabels(container, startDate, endDate, totalWeeks);
    // renderWeekdayLabels(container);
}

////////////////////* https://yeun.github.io/open-color/ for colors *////////////////////////
function getCombinedShade(dayData) {
    const shades = [
        '#3b3b3b', // No tasks completed
        '#106030', // 1 task
        '#2b8a3e', // 2 tasks
        '#2f9e44', // 3 tasks
        '#37b24d', // 4 tasks
        '#40c057', // 5 tasks
        '#51cf66', // 6 tasks
        '#69db7c', // 7 tasks
        '#8ce99a', // 8 tasks
        '#b2f2bb', // 9 tasks
        '#d3f9d8', // 10 tasks
        '#ebfbee', // 11+ tasks
    ];

    if (!dayData || dayData.completedTasks.length + dayData.completedHabits === 0) {
        return shades[0];
    } else {
        const combinedCompleted = dayData.completedTasks.length + dayData.completedHabits;
        if (combinedCompleted === 1) {
            return shades[1];
        } else if (combinedCompleted === 2) {
            return shades[2];
        } else if (combinedCompleted === 3) {
            return shades[3];
        } else if (combinedCompleted === 4) {
            return shades[4];
        } else if (combinedCompleted === 5) {
            return shades[5];
        } else if (combinedCompleted === 6) {
            return shades[6];
        } else if (combinedCompleted === 7) {
            return shades[7];
        } else if (combinedCompleted === 8) {
            return shades[8];
        } else if (combinedCompleted === 9) {
            return shades[9];
        } else if (combinedCompleted === 10) {
            return shades[10];
        } else {
            return shades[11];
        }
    }
}
function getHabitShade(dayData) {
    const shades = [
        '#2c2c2c', // No habits available (darkest)
        '#3b3b3b', // 0% completion
        '#1864ab', // 10% completion
        '#1971c2', // 25% completion
        '#1c7ed6', // 40% completion
        '#228be6', // 65% completion
        '#339af0', // 75% completion
        '#4dabf7', // 85% completion
        '#74c0fc'  // 100% completion
    ];

    if (!dayData || dayData.completionRate === null) {
        return shades[0]; // No habits available
    } else {
        const completionRate = dayData.completionRate;
        if (completionRate === 0) {
            return shades[1];
        } else if (completionRate <= 0.1) {
            return shades[2];
        } else if (completionRate <= 0.25) {
            return shades[3];
        } else if (completionRate <= 0.40) {
            return shades[4];
        } else if (completionRate <= 0.65) {
            return shades[5];
        } else if (completionRate <= 0.75) {
            return shades[6];
        } else if (completionRate <= 0.85) {
            return shades[7];
        } else {
            return shades[8];
        }
    }
}
function getTaskShade(dayData) {
    const shades = [
        '#3b3b3b', // No tasks completed
        '#3E0101', // 1 task
        '#8B0000', // 2 tasks
        '#C92A2A', // 3 tasks
        '#E03030', // 4 tasks
        '#F03E3E', // 5 tasks
        '#FA5353', // 6 tasks
        '#FE6A6B', // 7 tasks
        '#FF8787', // 8 tasks
        '#FFC9C9', // 9 tasks
        '#FFE2E2', // 10 tasks
        '#FFF5F5', // 11+ tasks
    ];

    if (!dayData || dayData.completedTasks.length === 0) {
        return shades[0];
    } else {
        const tasksCompleted = dayData.completedTasks.length;
        if (tasksCompleted === 1) {
            return shades[1];
        } else if (tasksCompleted === 2) {
            return shades[2];
        } else if (tasksCompleted === 3) {
            return shades[3];
        } else if (tasksCompleted === 4) {
            return shades[4];
        } else if (tasksCompleted === 5) {
            return shades[5];
        } else if (tasksCompleted === 6) {
            return shades[6];
        } else if (tasksCompleted === 7) {
            return shades[7];
        } else if (tasksCompleted === 8) {
            return shades[8];
        } else if (tasksCompleted === 9) {
            return shades[9];
        } else if (tasksCompleted === 10) {
            return shades[10];
        } else {
            return shades[11];
        }
    }
}

function renderMonthLabels(container, startDate, endDate, totalWeeks) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const monthsRow = document.createElement('div');
    monthsRow.classList.add('months-row');

    let currentMonth = -1;
    let weeksInMonth = 0;
    let weekIndex = 0;
    let dateIterator = new Date(startDate);

    while (dateIterator <= endDate) {
        const month = dateIterator.getMonth();
        if (month !== currentMonth) {
            // New month
            if (currentMonth !== -1) {
                // Set the width of the previous month label
                monthsRow.children[monthsRow.children.length - 1].style.width = (weeksInMonth * (dayWidth + gutter)) + 'px';
            }
            // Create new month label
            currentMonth = month;
            weeksInMonth = 1;

            const monthLabel = document.createElement('div');
            monthLabel.classList.add('month-label');
            monthLabel.textContent = monthNames[currentMonth];
            monthsRow.appendChild(monthLabel);
        } else {
            // Same month
            weeksInMonth++;
        }

        // Move to the next week
        dateIterator.setDate(dateIterator.getDate() + 7);
        weekIndex++;
    }

     // Set the width for the last month label
    monthsRow.children[monthsRow.children.length - 1].style.width = (weeksInMonth * (dayWidth + gutter)) + 'px';

    // Append monthsRow to container
    container.insertBefore(monthsRow, container.firstChild);
}

function renderWeekdayLabels(container) {
    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const weekdaysColumn = document.createElement('div');
    weekdaysColumn.classList.add('weekdays-column');

    for (let i = 0; i < 7; i++) {
        const dayLabel = document.createElement('div');
        dayLabel.classList.add('weekday-label');

        // Show labels for Sun, Tue, Thu (or adjust as desired)
        if (i === 0 || i === 2 || i === 4) {
            dayLabel.textContent = weekdayNames[i];
        } else {
            dayLabel.textContent = ''; // Empty label for alignment
        }

        dayLabel.style.height = dayHeight + 'px';
        dayLabel.style.margin = (gutter / 2) + 'px 0'; // Adjust vertical margin

        weekdaysColumn.appendChild(dayLabel);
    }

    // Append the weekdaysColumn to container
    container.appendChild(weekdaysColumn);
}

function showDetailsModal(dateStr, dayData) {
    const modal = document.getElementById('details-modal');
    const modalDate = document.getElementById('modal-date');
    const modalContent = document.getElementById('modal-content');
    const closeButton = document.getElementById('modal-close');

    modalDate.textContent = dateStr;
    modalContent.innerHTML = '';

    // Display completed habits
    const habitsDiv = document.createElement('div');
    habitsDiv.innerHTML = `<h3>Completed Habits (${dayData.completedHabits}/${dayData.availableHabits})</h3>`;
    const habitsList = document.createElement('ul');

    dayData.completedHabitsList.forEach(habitName => {
        const li = document.createElement('li');
        li.textContent = habitName;
        habitsList.appendChild(li);
    });
    
    if (dayData.completedHabitsList.length > 0) {
        habitsDiv.appendChild(habitsList);
    } else {
        const noHabits = document.createElement('p');
        noHabits.textContent = 'No habits completed on this day.';
        habitsDiv.appendChild(noHabits);
    }

    modalContent.appendChild(habitsDiv);

    // Display completed tasks
    if (dayData.completedTasks.length > 0) {
        const tasksDiv = document.createElement('div');
        tasksDiv.innerHTML = `<h3>Completed Tasks</h3>`;
        const tasksList = document.createElement('ul');

        dayData.completedTasks.forEach(taskTitle => {
            const li = document.createElement('li');
            li.textContent = taskTitle;
            tasksList.appendChild(li);
        });
        tasksDiv.appendChild(tasksList);
        modalContent.appendChild(tasksDiv);
    } else {
        const noTasks = document.createElement('p');
        noTasks.textContent = 'No tasks completed on this day.';
        modalContent.appendChild(noTasks);
    }

    // Show the modal
    modal.style.display = 'block';

    // Close modal when clicking on the close button
    closeButton.onclick = function() {
        modal.style.display = 'none';
    };

    // Close modal when clicking outside the modal content
    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
}