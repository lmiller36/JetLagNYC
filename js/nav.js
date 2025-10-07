/**
 * Navigation module for mobile menu functionality
 * Handles hamburger menu toggle and active state management
 */

(function() {
    'use strict';
    
    // Wait for DOM to be fully loaded
    document.addEventListener('DOMContentLoaded', function() {
        initNavigation();
    });
    
    function initNavigation() {
        const navToggle = document.querySelector('.nav-toggle');
        const navMenu = document.querySelector('.nav-menu');
        const navLinks = document.querySelectorAll('.nav-link');
        
        // Handle mobile menu toggle
        if (navToggle && navMenu) {
            navToggle.addEventListener('click', function() {
                toggleMobileMenu();
            });
            
            // Close menu when clicking outside
            document.addEventListener('click', function(event) {
                if (!navToggle.contains(event.target) && !navMenu.contains(event.target)) {
                    closeMobileMenu();
                }
            });
            
            // Close menu when pressing escape key
            document.addEventListener('keydown', function(event) {
                if (event.key === 'Escape') {
                    closeMobileMenu();
                }
            });
        }
        
        // Close mobile menu when clicking on nav links
        navLinks.forEach(function(link) {
            link.addEventListener('click', function() {
                closeMobileMenu();
            });
        });
        
        // Set active navigation state based on current page
        setActiveNavState();
    }
    
    function toggleMobileMenu() {
        const navMenu = document.querySelector('.nav-menu');
        const navToggle = document.querySelector('.nav-toggle');
        
        if (navMenu && navToggle) {
            const isOpen = navMenu.classList.contains('active');
            
            if (isOpen) {
                closeMobileMenu();
            } else {
                openMobileMenu();
            }
        }
    }
    
    function openMobileMenu() {
        const navMenu = document.querySelector('.nav-menu');
        const navToggle = document.querySelector('.nav-toggle');
        
        if (navMenu && navToggle) {
            navMenu.classList.add('active');
            navToggle.setAttribute('aria-expanded', 'true');
            navToggle.setAttribute('aria-label', 'Close navigation');
            
            // Animate hamburger to X
            const hamburger = navToggle.querySelector('.hamburger');
            if (hamburger) {
                hamburger.style.transform = 'rotate(45deg)';
                hamburger.style.backgroundColor = 'transparent';
            }
        }
    }
    
    function closeMobileMenu() {
        const navMenu = document.querySelector('.nav-menu');
        const navToggle = document.querySelector('.nav-toggle');
        
        if (navMenu && navToggle) {
            navMenu.classList.remove('active');
            navToggle.setAttribute('aria-expanded', 'false');
            navToggle.setAttribute('aria-label', 'Open navigation');
            
            // Reset hamburger animation
            const hamburger = navToggle.querySelector('.hamburger');
            if (hamburger) {
                hamburger.style.transform = 'rotate(0deg)';
                hamburger.style.backgroundColor = 'var(--white)';
            }
        }
    }
    
    function setActiveNavState() {
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('.nav-link');
        
        navLinks.forEach(function(link) {
            const linkPath = new URL(link.href).pathname;
            
            // Remove active class from all links
            link.classList.remove('active');
            
            // Add active class to current page link
            if (currentPath === linkPath || 
                (currentPath === '/' && linkPath.endsWith('index.html')) ||
                (currentPath.endsWith('/') && linkPath.endsWith('index.html'))) {
                link.classList.add('active');
            }
        });
    }
    
    // Expose functions for potential external use
    window.Navigation = {
        toggleMobileMenu: toggleMobileMenu,
        openMobileMenu: openMobileMenu,
        closeMobileMenu: closeMobileMenu,
        setActiveNavState: setActiveNavState
    };
})();