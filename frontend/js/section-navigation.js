// Section Navigation Indicators Component
class SectionNavigation {
    constructor() {
        this.navContainer = null;
        this.navDots = [];
        this.sections = [];
        this.currentSection = 0;
        
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        this.navContainer = document.querySelector('.section-nav-indicators');
        this.sections = Array.from(document.querySelectorAll('.snap-section'));
        this.navDots = Array.from(document.querySelectorAll('.nav-dot'));
        
        if (!this.navContainer || this.sections.length === 0) {
            console.warn('SectionNavigation: Navigation container or sections not found');
            return;
        }

        this.bindEvents();
        this.updateActiveState(0);
        
        console.log(`SectionNavigation initialized with ${this.sections.length} sections`);
    }

    bindEvents() {
        // Click events for navigation dots
        this.navDots.forEach((dot, index) => {
            dot.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateToSection(index);
            });

            // Keyboard navigation for dots
            dot.addEventListener('keydown', (e) => {
                this.handleDotKeydown(e, index);
            });
        });

        // Listen for section changes from scroll snap manager
        document.addEventListener('sectionChange', (e) => {
            this.updateActiveState(e.detail.currentIndex);
        });

        // Listen for scroll events to update active state
        const container = document.querySelector('.snap-container');
        if (container) {
            let scrollTimeout;
            container.addEventListener('scroll', () => {
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    this.detectActiveSection();
                }, 100);
            });
        }
    }

    handleDotKeydown(event, index) {
        switch (event.key) {
            case 'Enter':
            case ' ':
                event.preventDefault();
                this.navigateToSection(index);
                break;
            
            case 'ArrowUp':
                event.preventDefault();
                const prevIndex = index > 0 ? index - 1 : this.navDots.length - 1;
                this.navDots[prevIndex].focus();
                break;
            
            case 'ArrowDown':
                event.preventDefault();
                const nextIndex = index < this.navDots.length - 1 ? index + 1 : 0;
                this.navDots[nextIndex].focus();
                break;
            
            case 'Home':
                event.preventDefault();
                this.navDots[0].focus();
                break;
            
            case 'End':
                event.preventDefault();
                this.navDots[this.navDots.length - 1].focus();
                break;
        }
    }

    navigateToSection(index) {
        if (index < 0 || index >= this.sections.length) {
            return;
        }

        // Use scroll snap manager if available, otherwise scroll directly
        if (window.scrollSnapManager) {
            window.scrollSnapManager.goToSection(index);
        } else {
            // Fallback direct scrolling
            const section = this.sections[index];
            const container = document.querySelector('.snap-container');
            
            if (container && section) {
                container.scrollTo({
                    top: section.offsetTop,
                    behavior: 'smooth'
                });
            }
        }

        this.updateActiveState(index);
        this.announceNavigation(index);
    }

    updateActiveState(index) {
        if (index === this.currentSection) {
            return; // No change needed
        }

        this.currentSection = index;

        // Update navigation dots
        this.navDots.forEach((dot, i) => {
            if (i === index) {
                dot.classList.add('active');
                dot.setAttribute('aria-current', 'true');
            } else {
                dot.classList.remove('active');
                dot.removeAttribute('aria-current');
            }
        });

        // Update sections
        this.sections.forEach((section, i) => {
            if (i === index) {
                section.classList.add('active-section');
                section.setAttribute('aria-current', 'true');
            } else {
                section.classList.remove('active-section');
                section.removeAttribute('aria-current');
            }
        });

        // Dispatch custom event
        const event = new CustomEvent('navigationChange', {
            detail: {
                currentIndex: index,
                currentSection: this.sections[index],
                totalSections: this.sections.length
            }
        });
        document.dispatchEvent(event);
    }

    detectActiveSection() {
        const container = document.querySelector('.snap-container');
        if (!container) return;

        const scrollTop = container.scrollTop;
        const viewportHeight = window.innerHeight;
        
        // Find the section that's most visible in the viewport
        let maxVisibleArea = 0;
        let activeIndex = 0;

        this.sections.forEach((section, index) => {
            const sectionTop = section.offsetTop;
            const sectionBottom = sectionTop + section.offsetHeight;
            
            // Calculate visible area of this section
            const visibleTop = Math.max(scrollTop, sectionTop);
            const visibleBottom = Math.min(scrollTop + viewportHeight, sectionBottom);
            const visibleArea = Math.max(0, visibleBottom - visibleTop);
            
            if (visibleArea > maxVisibleArea) {
                maxVisibleArea = visibleArea;
                activeIndex = index;
            }
        });

        this.updateActiveState(activeIndex);
    }

    announceNavigation(index) {
        const section = this.sections[index];
        const sectionName = this.getSectionName(section, index);
        
        // Create or update live region for announcements
        let liveRegion = document.getElementById('nav-announcements');
        if (!liveRegion) {
            liveRegion = document.createElement('div');
            liveRegion.id = 'nav-announcements';
            liveRegion.className = 'sr-only';
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.setAttribute('aria-atomic', 'true');
            document.body.appendChild(liveRegion);
        }
        
        liveRegion.textContent = `Navigated to ${sectionName}, section ${index + 1} of ${this.sections.length}`;
    }

    getSectionName(section, index) {
        // Try to get a meaningful name for the section
        const labelledBy = section.getAttribute('aria-labelledby');
        if (labelledBy) {
            const labelElement = document.getElementById(labelledBy);
            if (labelElement) {
                return labelElement.textContent.trim();
            }
        }

        const ariaLabel = section.getAttribute('aria-label');
        if (ariaLabel) {
            return ariaLabel;
        }

        // Fallback based on section classes
        if (section.classList.contains('hero-section')) {
            return 'Hero';
        } else if (section.classList.contains('search-section')) {
            return 'Search Bills';
        }

        return `Section ${index + 1}`;
    }

    // Public API methods
    getCurrentSection() {
        return this.currentSection;
    }

    getTotalSections() {
        return this.sections.length;
    }

    goToSection(index) {
        this.navigateToSection(index);
    }

    nextSection() {
        const nextIndex = (this.currentSection + 1) % this.sections.length;
        this.navigateToSection(nextIndex);
    }

    previousSection() {
        const prevIndex = (this.currentSection - 1 + this.sections.length) % this.sections.length;
        this.navigateToSection(prevIndex);
    }

    // Show/hide navigation (useful for fullscreen modes)
    show() {
        if (this.navContainer) {
            this.navContainer.style.display = 'block';
        }
    }

    hide() {
        if (this.navContainer) {
            this.navContainer.style.display = 'none';
        }
    }

    // Update navigation when sections are added/removed dynamically
    refresh() {
        this.sections = Array.from(document.querySelectorAll('.snap-section'));
        this.navDots = Array.from(document.querySelectorAll('.nav-dot'));
        this.detectActiveSection();
    }
}

// Initialize section navigation when DOM is ready
if (typeof window !== 'undefined') {
    window.sectionNavigation = new SectionNavigation();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SectionNavigation;
}