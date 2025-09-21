// Enhanced Scroll Snap Manager for Fullscreen Sectioned Layout
class ScrollSnapManager {
    constructor() {
        this.container = null;
        this.sections = [];
        this.currentSectionIndex = 0;
        this.isScrolling = false;
        this.scrollTimeout = null;
        this.wheelTimeout = null;
        this.touchStartY = 0;
        this.touchEndY = 0;
        
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
        this.container = document.querySelector('.snap-container');
        this.sections = Array.from(document.querySelectorAll('.snap-section'));
        
        if (!this.container || this.sections.length === 0) {
            console.warn('ScrollSnapManager: No snap container or sections found');
            return;
        }

        this.bindEvents();
        this.setupViewportHeight();
        this.detectCurrentSection();
        
        console.log(`ScrollSnapManager initialized with ${this.sections.length} sections`);
    }

    bindEvents() {
        // Enhanced wheel event handling for better scroll snap control
        this.container.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        
        // Touch events for mobile devices
        this.container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        this.container.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        
        // Keyboard navigation
        document.addEventListener('keydown', this.handleKeydown.bind(this));
        
        // Scroll event for section detection
        this.container.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
        
        // Listen for search interactions to temporarily disable snap behavior
        this.setupSearchIntegration();
        
        // Resize event for viewport height adjustments
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // Enhanced orientation change handling for mobile devices
        window.addEventListener('orientationchange', () => {
            // Delay to allow browser to complete orientation change
            setTimeout(() => {
                this.setupViewportHeight();
                // Re-align current section after orientation change
                this.scrollToSection(this.currentSectionIndex, false);
            }, 300);
        });
        
        // Visual viewport API support for better mobile handling
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => {
                this.setupViewportHeight();
            });
        }
    }

    handleWheel(event) {
        // Only handle wheel events if scroll snap is supported
        if (!this.isScrollSnapSupported()) {
            return;
        }

        // Prevent default scrolling during snap transitions
        if (this.isScrolling) {
            event.preventDefault();
            return;
        }

        // Clear existing timeout
        clearTimeout(this.wheelTimeout);
        
        // Set timeout to detect end of wheel scrolling
        this.wheelTimeout = setTimeout(() => {
            this.isScrolling = false;
        }, 150);

        // Determine scroll direction
        const deltaY = event.deltaY;
        const threshold = 50; // Minimum delta to trigger section change
        
        if (Math.abs(deltaY) < threshold) {
            return;
        }

        // Prevent rapid scrolling
        if (this.isScrolling) {
            event.preventDefault();
            return;
        }

        this.isScrolling = true;

        // Navigate to next/previous section
        if (deltaY > 0 && this.currentSectionIndex < this.sections.length - 1) {
            // Scroll down
            this.scrollToSection(this.currentSectionIndex + 1);
            event.preventDefault();
        } else if (deltaY < 0 && this.currentSectionIndex > 0) {
            // Scroll up
            this.scrollToSection(this.currentSectionIndex - 1);
            event.preventDefault();
        }
    }

    handleTouchStart(event) {
        this.touchStartY = event.touches[0].clientY;
    }

    handleTouchEnd(event) {
        this.touchEndY = event.changedTouches[0].clientY;
        
        const deltaY = this.touchStartY - this.touchEndY;
        const threshold = 50; // Minimum swipe distance
        
        if (Math.abs(deltaY) < threshold) {
            return;
        }

        // Prevent rapid swiping
        if (this.isScrolling) {
            event.preventDefault();
            return;
        }

        this.isScrolling = true;

        // Navigate based on swipe direction
        if (deltaY > 0 && this.currentSectionIndex < this.sections.length - 1) {
            // Swipe up (scroll down)
            this.scrollToSection(this.currentSectionIndex + 1);
            event.preventDefault();
        } else if (deltaY < 0 && this.currentSectionIndex > 0) {
            // Swipe down (scroll up)
            this.scrollToSection(this.currentSectionIndex - 1);
            event.preventDefault();
        }

        setTimeout(() => {
            this.isScrolling = false;
        }, 800);
    }

    handleKeydown(event) {
        // Only handle if no input is focused
        if (document.activeElement.tagName === 'INPUT' || 
            document.activeElement.tagName === 'TEXTAREA' ||
            document.activeElement.tagName === 'SELECT') {
            return;
        }

        switch (event.key) {
            case 'ArrowDown':
            case 'PageDown':
                if (this.currentSectionIndex < this.sections.length - 1) {
                    this.scrollToSection(this.currentSectionIndex + 1);
                    event.preventDefault();
                }
                break;
            
            case 'ArrowUp':
            case 'PageUp':
                if (this.currentSectionIndex > 0) {
                    this.scrollToSection(this.currentSectionIndex - 1);
                    event.preventDefault();
                }
                break;
            
            case 'Home':
                this.scrollToSection(0);
                event.preventDefault();
                break;
            
            case 'End':
                this.scrollToSection(this.sections.length - 1);
                event.preventDefault();
                break;
        }
    }

    handleScroll() {
        // Debounce scroll detection
        clearTimeout(this.scrollTimeout);
        this.scrollTimeout = setTimeout(() => {
            this.detectCurrentSection();
        }, 100);
    }

    handleResize() {
        // Debounce resize handling
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            this.setupViewportHeight();
            this.scrollToSection(this.currentSectionIndex, false); // Re-align current section
        }, 250);
    }

    scrollToSection(index, smooth = true) {
        if (index < 0 || index >= this.sections.length) {
            return;
        }

        const section = this.sections[index];
        const scrollOptions = {
            top: section.offsetTop,
            behavior: smooth ? 'smooth' : 'auto'
        };

        // Use native scroll snap if supported, otherwise manual scrolling
        if (this.isScrollSnapSupported()) {
            this.container.scrollTo(scrollOptions);
        } else {
            // Fallback smooth scrolling for browsers without scroll snap
            this.smoothScrollTo(section.offsetTop, 600);
        }

        this.currentSectionIndex = index;
        this.updateSectionStates();
    }

    smoothScrollTo(targetY, duration) {
        const startY = this.container.scrollTop;
        const distance = targetY - startY;
        const startTime = performance.now();

        const easeInOutCubic = (t) => {
            return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
        };

        const animateScroll = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easeInOutCubic(progress);
            
            this.container.scrollTop = startY + (distance * easedProgress);
            
            if (progress < 1) {
                requestAnimationFrame(animateScroll);
            }
        };

        requestAnimationFrame(animateScroll);
    }

    detectCurrentSection() {
        const scrollTop = this.container.scrollTop;
        const viewportHeight = window.innerHeight;
        
        // Find the section that's most visible in the viewport
        let maxVisibleArea = 0;
        let currentIndex = 0;

        this.sections.forEach((section, index) => {
            const sectionTop = section.offsetTop;
            const sectionBottom = sectionTop + section.offsetHeight;
            
            // Calculate visible area of this section
            const visibleTop = Math.max(scrollTop, sectionTop);
            const visibleBottom = Math.min(scrollTop + viewportHeight, sectionBottom);
            const visibleArea = Math.max(0, visibleBottom - visibleTop);
            
            if (visibleArea > maxVisibleArea) {
                maxVisibleArea = visibleArea;
                currentIndex = index;
            }
        });

        if (currentIndex !== this.currentSectionIndex) {
            this.currentSectionIndex = currentIndex;
            this.updateSectionStates();
        }
    }

    updateSectionStates() {
        // Update section states for styling and accessibility
        this.sections.forEach((section, index) => {
            if (index === this.currentSectionIndex) {
                section.classList.add('active-section');
                section.setAttribute('aria-current', 'true');
            } else {
                section.classList.remove('active-section');
                section.removeAttribute('aria-current');
            }
        });

        // Dispatch custom event for other components to listen to
        const event = new CustomEvent('sectionChange', {
            detail: {
                currentIndex: this.currentSectionIndex,
                currentSection: this.sections[this.currentSectionIndex],
                totalSections: this.sections.length
            }
        });
        document.dispatchEvent(event);
    }

    setupViewportHeight() {
        // Set CSS custom property for viewport height (mobile browser support)
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
        
        // Enhanced mobile browser UI detection
        const isMobile = window.innerWidth <= 768;
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        
        if (isMobile) {
            // Handle mobile browser UI variations
            const actualHeight = window.innerHeight;
            const screenHeight = window.screen.height;
            const hasBottomUI = actualHeight < screenHeight * 0.85;
            
            if (hasBottomUI) {
                // Adjust for mobile browser UI
                document.documentElement.style.setProperty('--vh', `${actualHeight * 0.01}px`);
            }
            
            // iOS specific handling
            if (isIOS) {
                // Use -webkit-fill-available for better iOS support
                this.sections.forEach(section => {
                    section.style.height = '-webkit-fill-available';
                });
                return;
            }
        }
        
        // Force recalculation of section heights for non-iOS devices
        this.sections.forEach(section => {
            section.style.height = `${window.innerHeight}px`;
        });
    }

    isScrollSnapSupported() {
        // Check if browser supports CSS scroll snap
        return CSS.supports('scroll-snap-type', 'y mandatory');
    }

    // Public API methods
    getCurrentSection() {
        return this.currentSectionIndex;
    }

    getTotalSections() {
        return this.sections.length;
    }

    goToSection(index) {
        this.scrollToSection(index);
    }

    nextSection() {
        if (this.currentSectionIndex < this.sections.length - 1) {
            this.scrollToSection(this.currentSectionIndex + 1);
        }
    }

    previousSection() {
        if (this.currentSectionIndex > 0) {
            this.scrollToSection(this.currentSectionIndex - 1);
        }
    }

    // Accessibility method to announce section changes
    announceSection() {
        const section = this.sections[this.currentSectionIndex];
        const sectionName = section.getAttribute('aria-labelledby') || 
                           section.getAttribute('aria-label') || 
                           `Section ${this.currentSectionIndex + 1}`;
        
        // Create or update live region for announcements
        let liveRegion = document.getElementById('section-announcements');
        if (!liveRegion) {
            liveRegion = document.createElement('div');
            liveRegion.id = 'section-announcements';
            liveRegion.className = 'sr-only';
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.setAttribute('aria-atomic', 'true');
            document.body.appendChild(liveRegion);
        }
        
        liveRegion.textContent = `Now viewing ${sectionName}, section ${this.currentSectionIndex + 1} of ${this.sections.length}`;
    }

    // Test method to verify scroll snap functionality
    testScrollSnap() {
        console.log('Testing scroll snap functionality...');
        console.log(`Container: ${this.container ? 'Found' : 'Not found'}`);
        console.log(`Sections: ${this.sections.length} found`);
        console.log(`Current section: ${this.currentSectionIndex}`);
        console.log(`Scroll snap supported: ${this.isScrollSnapSupported()}`);
        
        // Test section navigation
        setTimeout(() => {
            console.log('Testing navigation to section 1...');
            this.scrollToSection(1);
        }, 1000);
        
        setTimeout(() => {
            console.log('Testing navigation back to section 0...');
            this.scrollToSection(0);
        }, 3000);
        
        return {
            container: !!this.container,
            sectionsCount: this.sections.length,
            currentSection: this.currentSectionIndex,
            scrollSnapSupported: this.isScrollSnapSupported()
        };
    }

    setupSearchIntegration() {
        // Find search-related elements
        const searchInput = document.getElementById('search-input');
        const searchResultsArea = document.querySelector('.search-results-area');
        
        if (searchInput) {
            // When user focuses on search, ensure we're in the search section
            searchInput.addEventListener('focus', () => {
                const searchSectionIndex = this.sections.findIndex(section => 
                    section.classList.contains('search-section'));
                if (searchSectionIndex !== -1 && this.currentSectionIndex !== searchSectionIndex) {
                    this.scrollToSection(searchSectionIndex);
                }
            });
        }
        
        // Allow normal scrolling within the entire search section
        const searchSection = document.querySelector('.search-section');
        if (searchSection) {
            searchSection.addEventListener('wheel', (event) => {
                // Allow normal scrolling within search section
                event.stopPropagation();
            }, { passive: true });
        }
    }
}

// Initialize scroll snap manager when DOM is ready
if (typeof window !== 'undefined') {
    window.scrollSnapManager = new ScrollSnapManager();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScrollSnapManager;
}