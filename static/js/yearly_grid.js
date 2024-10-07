let currentYear = new Date().getFullYear();
const dayWidth = 30;  // Updated width of each day square
const dayHeight = 30; // Updated height of each day square
const gutter = 2;     // Space between squares

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
            renderHeatmap(data, year);
        })
        .catch(error => {
            console.error('Error fetching history data:', error);
            alert('No data available for this year.');
        });
}

function renderHeatmap(data, year) {
    const container = document.getElementById('heatmap-container');
    container.innerHTML = '';
    const currentDate = new Date();

    const dataMap = new Map(Object.entries(data));

    // Create the main grid container
    const grid = document.createElement('div');
    grid.classList.add('heatmap-grid');

    // Iterate over each month
    for (let month = 0; month < 12; month++) {
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

            if (currentYear == currentDate.getFullYear() && (month == currentDate.getMonth() && day > currentDate.getDate()) || (month > currentDate.getMonth())) {
                break;
            }

            const date = new Date(year, month, day);
            const dateStr = date.toISOString().split('T')[0];

            const dayCell = document.createElement('div');
            dayCell.classList.add('day-cell');
            dayCell.dataset.date = dateStr;

            const dayData = dataMap.get(dateStr);

            if (dayData) {
                const completionRate = dayData.completionRate;

                if (completionRate !== null) {
                    const shade = getShade(completionRate);
                    dayCell.style.backgroundColor = shade;
                } else {
                    // No habits available on this day
                    dayCell.style.backgroundColor = '#444'; // Darker shade for no habits
                }
            } else {
                // Dates with no data
                dayCell.style.backgroundColor = '#444';
            }

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
function getShade(completionRate) {
    // Shades suitable for dark background
    const shades = [
        '#2c2c2c', // No habits available (darkest)
        '#3b3b3b', // 0% (no habits completed)
        '#255f3f', // >0% up to 25%
        '#2e8b57', // >25% up to 50%
        '#3cb371', // >50% up to 75%
        '#66cdaa'  // >75% to 100% (lightest)
    ];

    if (completionRate === null) {
        return shades[0]; // No habits available
    } else if (completionRate === 0) {
        return shades[1]; // No habits completed
    } else if (completionRate <= 0.25) {
        return shades[2];
    } else if (completionRate <= 0.5) {
        return shades[3];
    } else if (completionRate <= 0.75) {
        return shades[4];
    } else {
        return shades[5];
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