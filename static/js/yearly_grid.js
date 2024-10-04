document.addEventListener('DOMContentLoaded', () => {
    axios.get('/api/history')
        .then(response => {
            const data = response.data;
            const heatmapData = [];

            // Transform data into the format cal-heatmap expects
            Object.keys(data).forEach(dateStr => {
                const totalCompletions =
                    data[dateStr].completedTasks.length +
                    data[dateStr].completedHabits.length;
                heatmapData.push({
                    date: dateStr,
                    value: totalCompletions,
                });
            });

            const cal = new CalHeatmap();

            // Paint the calendar
            cal.paint({
                itemSelector: '#cal-heatmap',
                date: {
                    start: new Date(new Date().getFullYear(), 0),
                    min: new Date(new Date().getFullYear(), 0),
                    max: new Date(),
                },
                range: 12,
                domain: {
                    type: 'month',
                    gutter: 20,
                    label: {
                        text: 'MMM',
                        textAlign: 'start',
                        position: 'top',
                    },
                },
                subDomain: {
                    type: 'ghDay',
                    radius: 2,
                    width: 22,
                    height: 22,
                    gutter: 10,
                },
                data: {
                    source: heatmapData,
                    x: 'date',
                    y: 'value',
                    type: 'json',
                    defaultValue: 0,
                },
                scale: {
                    color: {
                        type: 'threshold',
                        range: ['#efefef', '#c6e48b', '#7bc96f', '#239a3b', '#196127'],
                        domain: [1, 3, 5, 7],
                    },
                }
            },
            [
                [CalendarLabel, {
                    position: 'left',
                    key: 'left',
                    text: () => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    textAlign: 'end',
                    width: 30,
                    padding: [30, 5, 0, 0],
                }]
            ]);
        })
        .catch((error) => {
            console.error('Error fetching history data:', error);
        });
});

// Function to show the modal with details for the selected date
function showDetails(dateStr) {
    axios
        .get(`/api/history`)  // Assuming /api/history returns data for all dates
        .then((response) => {
            const data = response.data[dateStr];
            if (data) {
                document.getElementById('selected-date').textContent = dateStr;
                const detailsContent = document.getElementById('details-content');
                detailsContent.innerHTML = '';  // Clear existing content

                // Display completed tasks
                if (data.completedTasks.length > 0) {
                    const tasksList = document.createElement('ul');
                    tasksList.innerHTML = `<h4>Completed Tasks:</h4>`;
                    data.completedTasks.forEach((task) => {
                        const listItem = document.createElement('li');
                        listItem.textContent = task;
                        tasksList.appendChild(listItem);
                    });
                    detailsContent.appendChild(tasksList);
                }

                // Display completed habits
                if (data.completedHabits.length > 0) {
                    const habitsList = document.createElement('ul');
                    habitsList.innerHTML = `<h4>Completed Habits:</h4>`;
                    data.completedHabits.forEach((habit) => {
                        const listItem = document.createElement('li');
                        listItem.textContent = habit;
                        habitsList.appendChild(listItem);
                    });
                    detailsContent.appendChild(habitsList);
                }

                // Display journal entries
                if (data.journalEntries.length > 0) {
                    const journalList = document.createElement('ul');
                    journalList.innerHTML = `<h4>Journal Entries:</h4>`;
                    data.journalEntries.forEach((entry) => {
                        const listItem = document.createElement('li');
                        listItem.textContent = entry;
                        journalList.appendChild(listItem);
                    });
                    detailsContent.appendChild(journalList);
                }

                // Show the modal
                const modal = document.getElementById('details-modal');
                modal.style.display = 'block';

                // Close modal when clicking the close button
                document.getElementById('modal-close').onclick = function () {
                    modal.style.display = 'none';
                };

                // Close modal when clicking outside the modal content
                window.onclick = function (event) {
                    if (event.target == modal) {
                        modal.style.display = 'none';
                    }
                };
            } else {
                alert('No data available for this date.');
            }
        })
        .catch((error) => {
            console.error('Error fetching details:', error);
        });
}
