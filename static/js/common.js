document.addEventListener('DOMContentLoaded', function () {

    // Handle menu toggle
    const menuState = localStorage.getItem('menuState');
    if (menuState === 'open') {
        document.body.classList.add('menu-active');
    }

    // Handle menu toggle
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', function() {
            document.body.classList.toggle('menu-active');

            // Save the new state to localStorage
            if (document.body.classList.contains('menu-active')) {
                localStorage.setItem('menuState', 'open');
            } else {
                localStorage.setItem('menuState', 'closed');
            }
        });
    }

    // Add any other common initialization code here

});