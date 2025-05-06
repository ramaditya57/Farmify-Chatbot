document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const header = document.getElementById('header-bar');
    const menuToggle = document.getElementById('menu-toggle');
    const nav = document.getElementById('farmify-nav');
    const navLinks = document.querySelectorAll('.nav-link');
    const dropdownBtn = document.querySelectorAll('.farmify-dropdown');
    
    // Add shrink effect to header on scroll
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
    
    // Toggle mobile menu
    menuToggle.addEventListener('click', function() {
        nav.classList.toggle('active');
        // Change icon based on menu state
        const icon = menuToggle.querySelector('i');
        if (nav.classList.contains('active')) {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-times');
        } else {
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        }
    });
    
    // Close mobile menu when a link is clicked
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (window.innerWidth <= 768) {
                nav.classList.remove('active');
                const icon = menuToggle.querySelector('i');
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
    });
    
    // Handle dropdown menus on mobile
    if (window.innerWidth <= 768) {
        dropdownBtn.forEach(dropdown => {
            const btn = dropdown.querySelector('.farmify-dropbtn');
            const content = dropdown.querySelector('.farmify-dropdown-content');
            
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                content.classList.toggle('show');
            });
        });
    }
    
    // Active link highlighting based on current page
    function setActiveLink() {
        const currentPath = window.location.pathname;
        const currentHash = window.location.hash;
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            
            // Check if link matches current path
            if (link.getAttribute('href') === currentPath) {
                link.classList.add('active');
            }
            
            // Check if link matches current hash
            if (currentHash && link.getAttribute('href').includes(currentHash)) {
                link.classList.add('active');
            }
            
            // Special case for home page
            if (currentPath === '/mainsec' && link.getAttribute('href') === '/mainsec#home') {
                link.classList.add('active');
            }
        });
    }
    
    // Set active link on page load
    setActiveLink();
    
    // Update active link when hash changes (for single page navigation)
    window.addEventListener('hashchange', setActiveLink);
});