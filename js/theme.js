// js/theme.js
// Initialize theme
function initTheme() {
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

// Toggle theme function
function toggleTheme() {
    const htmlClasses = document.documentElement.classList;
    if (htmlClasses.contains('dark')) {
        htmlClasses.remove('dark');
        localStorage.setItem('theme', 'light');
    } else {
        htmlClasses.add('dark');
        localStorage.setItem('theme', 'dark');
    }
    updateThemeIcons();
}

// Update the icons based on current theme
function updateThemeIcons() {
    const isDark = document.documentElement.classList.contains('dark');
    const sunIcons = document.querySelectorAll('.theme-icon-sun');
    const moonIcons = document.querySelectorAll('.theme-icon-moon');
    
    if (isDark) {
        sunIcons.forEach(el => el.classList.remove('hidden'));
        moonIcons.forEach(el => el.classList.add('hidden'));
    } else {
        sunIcons.forEach(el => el.classList.add('hidden'));
        moonIcons.forEach(el => el.classList.remove('hidden'));
    }
}

// Bind events to toggle buttons
function bindThemeToggles() {
    const toggles = document.querySelectorAll('.theme-toggle');
    toggles.forEach(btn => {
        // remove old listeners if re-binding
        btn.removeEventListener('click', toggleTheme);
        btn.addEventListener('click', toggleTheme);
    });
    updateThemeIcons();
}

// Run init immediately to prevent flash
initTheme();

// Wait for DOM to load to bind UI elements
document.addEventListener('DOMContentLoaded', () => {
    bindThemeToggles();
});


