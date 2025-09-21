// Enhanced Section Scroller Class for Advanced Scroll Management
class SectionScroller {
    constructor() {
        this.container = null;
        this.sections = [];
        this.currentSectionIndex = 0;
        this.isScrolling = false;
        this.scrollTimeout = null;
        this.wheelTimeout = null;
        this.touchStartY = 0;
        this.touchEndY = 0;
        this.lastScrollTime = 0;
        this.scrollDirection = 'down';
        this.scrollVelocity = 0;
        this.isKeyboardNavigation = false;
        
        // Browser compatibility flags
        this.supportsScrollSnap = false;
        this.supportsIntersectionObserver = false;
        this.supportsSmoothScroll = false;
        
        // Performance tracking
        this.performanceMetrics = {
            scrollEvents: 0,
            sectionChanges: 0,
            averageScrollTime: 0
        };
        
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
            console.warn('SectionScroller: No snap container or sections found');
            return;
        }

        this.detectBrowserCapabilities();
        this.bindEvents();
        this.setupIntersectionObserver();
        this.setupViewportHeight();
        this.detectCurrentSection();
        
        console.log(`SectionScroller initialized with ${this.sections.length} sections`);
        console.log('Browser capabilities:', {
            scrollSnap: this.supportsScrollSnap,
            intersectionObserver: this.supportsIntersectionObserver,
            smoothScroll: this.supportsSmoothScroll
        });
    }

    detectBrowserCapabilities() {
        // Check for CSS scroll snap support
        this.supportsScrollSnap = CSS.supports('scroll-snap-type', 'y mandatory');
        
        // Check for Intersection Observer support
        this.supportsIntersectionObserver = 'IntersectionObserver' in window;
        
        // Check for smooth scroll support
        this.supportsSmoothScroll = 'scrollBehavior' in document.documentElement.style;
        
        // Add fallback classes to body for CSS targeting
        document.body.classList.toggle('no-scroll-snap', !this.supportsScrollSnap);
        document.body.classList.toggle('no-intersection-observer', !this.supportsIntersectionObserver);
        document.body.classList.toggle('no-smooth-scroll', !this.supportsSmoothScroll);
    }

    bindEvents() {
        // Enhanced wheel event handling with velocity tracking
        this.container.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        
        // Touch events for mobile devices with gesture recognition
        this.container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        this.container.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: true });
        this.container.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        
        // Enhanced keyboard navigation
        document.addEventListener('keydown', this.handleKeydown.bind(this));
        
        // Scroll event for fallback section detection
        this.container.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
        
        // Resize and orientation events
        window.addEventListener('resize', this.handleResize.bind(this));
        window.addEventListener('orientationchange', this.handleOrientationChange.bind(this));
        
        // Focus events for accessibility
        document.addEventListener('focusin', this.handleFocusIn.bind(this));
        
        // Page visibility for performance optimization
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }

    setupIntersectionObserver() {
        if (!this.supportsIntersectionObserver) {
            console.warn('SectionScroller: Using fallback scroll detection');
            return;
        }

        const observerOptions = {
            root: this.container,
            rootMargin: '-10% 0px -10% 0px',
            threshold: [0.1, 0.5, 0.9]
        };

        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const sectionIndex = this.sections.indexOf(entry.target);
                
                if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                    if (sectionIndex !== this.currentSectionIndex) {
                        this.updateCurrentSection(sectionIndex);
                    }
                }
            });
        }, observerOptions);

        // Observe all sections
        this.sections.forEach(section => {
            this.intersectionObserver.observe(section);
        });
    }

    handleWheel(event) {
        const now = performance.now();
        const deltaTime = now - this.lastScrollTime;
        this.lastScrollTime = now;
        
        // Calculate scroll velocity
        this.scrollVelocity = Math.abs(event.deltaY) / Math.max(deltaTime, 1);
        
        // Track performance
        this.performanceMetrics.scrollEvents++;
        
        // Determine scroll direction
        this.scrollDirection = event.deltaY > 0 ? 'down' : 'up';
        
        // Only handle wheel events if scroll snap is supported and we're not in a scrollable area
        if (!this.supportsScrollSnap || this.isInScrollableArea(event.target)) {
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

        // Determine scroll direction and threshold
        const deltaY = event.deltaY;
        const threshold = this.calculateScrollThreshold(this.scrollVelocity);
        
        if (Math.abs(deltaY) < threshold) {
            return;
        }

        // Prevent rapid scrolling
        if (this.isScrolling) {
            event.preventDefault();
            return;
        }

        this.isScrolling = true;
        this.isKeyboardNavigation = false;

        // Navigate to next/previous section
        if (deltaY > 0 && this.currentSectionIndex < this.sections.length - 1) {
            // Scroll down
            this.scrollToSection(this.currentSectionIndex + 1, 'wheel');
            event.preventDefault();
        } else if (deltaY < 0 && this.currentSectionIndex > 0) {
            // Scroll up
            this.scrollToSection(this.currentSectionIndex - 1, 'wheel');
            event.preventDefault();
        }
    }

    calculateScrollThreshold(velocity) {
        // Dynamic threshold based on scroll velocity
        const baseThreshold = 50;
        const velocityFactor = Math.min(velocity / 10, 2);
        return baseThreshold * (1 + velocityFactor);
    }

    isInScrollableArea(target) {
        // Check if the target is within a scrollable area (like search results)
        const scrollableSelectors = [
            '.search-results-container',
            '.search-results-area',
            '.filter-select[multiple]'
        ];
        
        return scrollableSelectors.some(selector => {
            const scrollableElement = target.closest(selector);
            return scrollableElement && this.hasScrollableContent(scrollableElement);
        });
    }

    hasScrollableContent(element) {
        return element.scrollHeight > element.clientHeight;
    }

    handleTouchStart(event) {
        this.touchStartY = event.touches[0].clientY;
        this.touchStartTime = performance.now();
    }

    handleTouchMove(event) {
        // Track touch movement for gesture recognition
        this.touchCurrentY = event.touches[0].clientY;
    }

    handleTouchEnd(event) {
        this.touchEndY = event.changedTouches[0].clientY;
        const touchEndTime = performance.now();
        const touchDuration = touchEndTime - this.touchStartTime;
        
        const deltaY = this.touchStartY - this.touchEndY;
        const velocity = Math.abs(deltaY) / touchDuration;
        
        // Dynamic threshold based on touch velocity and duration
        const threshold = this.calculateTouchThreshold(velocity, touchDuration);
        
        if (Math.abs(deltaY) < threshold) {
            return;
        }

        // Check if touch is in scrollable area
        if (this.isInScrollableArea(event.target)) {
            return;
        }

        // Prevent rapid swiping
        if (this.isScrolling) {
            event.preventDefault();
            return;
        }

        this.isScrolling = true;
        this.isKeyboardNavigation = false;

        // Navigate based on swipe direction
        if (deltaY > 0 && this.currentSectionIndex < this.sections.length - 1) {
            // Swipe up (scroll down)
            this.scrollToSection(this.currentSectionIndex + 1, 'touch');
            event.preventDefault();
        } else if (deltaY < 0 && this.currentSectionIndex > 0) {
            // Swipe down (scroll up)
            this.scrollToSection(this.currentSectionIndex - 1, 'touch');
            event.preventDefault();
        }

        setTimeout(() => {
            this.isScrolling = false;
        }, 800);
    }

    calculateTouchThreshold(velocity, duration) {
        const baseThreshold = 30;
        const velocityFactor = Math.min(velocity / 0.5, 2);
        const durationFactor = Math.max(1 - duration / 500, 0.5);
        return baseThreshold * velocityFactor * durationFactor;
    }

    handleKeydown(event) {
        // Only handle if no input is focused and not in scrollable area
        if (this.isInputFocused() || this.isInScrollableArea(event.target)) {
            return;
        }

        this.isKeyboardNavigation = true;
        let handled = false;

        switch (event.key) {
            case 'ArrowDown':
            case 'PageDown':
            case ' ': // Spacebar
                if (this.currentSectionIndex < this.sections.length - 1) {
                    this.scrollToSection(this.currentSectionIndex + 1, 'keyboard');
                    handled = true;
                }
                break;
            
            case 'ArrowUp':
            case 'PageUp':
                if (this.currentSectionIndex > 0) {
                    this.scrollToSection(this.currentSectionIndex - 1, 'keyboard');
                    handled = true;
                }
                break;
            
            case 'Home':
                this.scrollToSection(0, 'keyboard');
                handled = true;
                break;
            
            case 'End':
                this.scrollToSection(this.sections.length - 1, 'keyboard');
                handled = true;
                break;
                
            case 'Tab':
                // Handle tab navigation between sections
                this.handleTabNavigation(event);
                break;
        }

        if (handled) {
            event.preventDefault();
        }
    }

    isInputFocused() {
        const activeElement = document.activeElement;
        return activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.tagName === 'SELECT' ||
            activeElement.contentEditable === 'true'
        );
    }

    handleTabNavigation(event) {
        // Enhanced tab navigation for accessibility
        const focusableElements = this.getFocusableElementsInCurrentSection();
        const currentFocus = document.activeElement;
        const currentIndex = focusableElements.indexOf(currentFocus);
        
        if (event.shiftKey) {
            // Shift+Tab - move to previous section if at first element
            if (currentIndex === 0 && this.currentSectionIndex > 0) {
                event.preventDefault();
                this.scrollToSection(this.currentSectionIndex - 1, 'keyboard');
                setTimeout(() => {
                    const prevSectionElements = this.getFocusableElementsInSection(this.currentSectionIndex);
                    if (prevSectionElements.length > 0) {
                        prevSectionElements[prevSectionElements.length - 1].focus();
                    }
                }, 300);
            }
        } else {
            // Tab - move to next section if at last element
            if (currentIndex === focusableElements.length - 1 && this.currentSectionIndex < this.sections.length - 1) {
                event.preventDefault();
                this.scrollToSection(this.currentSectionIndex + 1, 'keyboard');
                setTimeout(() => {
                    const nextSectionElements = this.getFocusableElementsInSection(this.currentSectionIndex);
                    if (nextSectionElements.length > 0) {
                        nextSectionElements[0].focus();
                    }
                }, 300);
            }
        }
    }

    getFocusableElementsInCurrentSection() {
        return this.getFocusableElementsInSection(this.currentSectionIndex);
    }

    getFocusableElementsInSection(sectionIndex) {
        const section = this.sections[sectionIndex];
        if (!section) return [];
        
        const focusableSelectors = [
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            'a[href]',
            '[tabindex]:not([tabindex="-1"])'
        ];
        
        return Array.from(section.querySelectorAll(focusableSelectors.join(', ')))
            .filter(el => el.offsetParent !== null); // Only visible elements
    }

    handleScroll() {
        // Fallback scroll detection for browsers without Intersection Observer
        if (this.supportsIntersectionObserver) {
            return;
        }

        // Debounce scroll detection
        clearTimeout(this.scrollTimeout);
        this.scrollTimeout = setTimeout(() => {
            this.detectCurrentSectionFallback();
        }, 100);
    }

    detectCurrentSectionFallback() {
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
            this.updateCurrentSection(currentIndex);
        }
    }

    handleResize() {
        // Debounce resize handling
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            this.setupViewportHeight();
            this.scrollToSection(this.currentSectionIndex, false); // Re-align current section
        }, 250);
    }

    handleOrientationChange() {
        // Enhanced orientation change handling
        setTimeout(() => {
            this.setupViewportHeight();
            this.scrollToSection(this.currentSectionIndex, false);
        }, 300);
    }

    handleFocusIn(event) {
        // Ensure focused element is in current section
        const focusedSection = this.sections.find(section => section.contains(event.target));
        if (focusedSection) {
            const sectionIndex = this.sections.indexOf(focusedSection);
            if (sectionIndex !== this.currentSectionIndex) {
                this.scrollToSection(sectionIndex, 'focus');
            }
        }
    }

    handleVisibilityChange() {
        // Pause/resume performance tracking when page is hidden
        if (document.hidden) {
            this.pausePerformanceTracking();
        } else {
            this.resumePerformanceTracking();
        }
    }

    scrollToSection(index, trigger = 'manual') {
        if (index < 0 || index >= this.sections.length) {
            return;
        }

        const startTime = performance.now();
        const section = this.sections[index];
        
        // Choose scroll method based on browser capabilities and trigger
        if (this.supportsScrollSnap && trigger !== 'keyboard') {
            this.scrollWithSnapBehavior(section, index);
        } else {
            this.scrollWithFallback(section, index, trigger);
        }

        // Track performance
        const endTime = performance.now();
        this.updatePerformanceMetrics(endTime - startTime);
        
        this.updateCurrentSection(index);
    }

    scrollWithSnapBehavior(section, index) {
        const scrollOptions = {
            top: section.offsetTop,
            behavior: this.supportsSmoothScroll ? 'smooth' : 'auto'
        };
        
        this.container.scrollTo(scrollOptions);
    }

    scrollWithFallback(section, index, trigger) {
        const targetY = section.offsetTop;
        const duration = trigger === 'keyboard' ? 400 : 600;
        
        this.smoothScrollTo(targetY, duration);
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
            } else {
                this.isScrolling = false;
            }
        };

        requestAnimationFrame(animateScroll);
    }

    updateCurrentSection(index) {
        if (index === this.currentSectionIndex) {
            return;
        }

        const previousIndex = this.currentSectionIndex;
        this.currentSectionIndex = index;
        
        // Update performance metrics
        this.performanceMetrics.sectionChanges++;

        // Update section states
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
        const event = new CustomEvent('sectionChange', {
            detail: {
                currentIndex: index,
                previousIndex: previousIndex,
                currentSection: this.sections[index],
                previousSection: this.sections[previousIndex],
                totalSections: this.sections.length,
                trigger: this.isKeyboardNavigation ? 'keyboard' : 'scroll'
            }
        });
        document.dispatchEvent(event);

        // Announce to screen readers
        this.announceSection(index);
    }

    setupViewportHeight() {
        // Enhanced viewport height setup with mobile browser support
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
        
        // Enhanced mobile browser UI detection
        const isMobile = window.innerWidth <= 768;
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        
        if (isMobile && isIOS) {
            // Use -webkit-fill-available for better iOS support
            this.sections.forEach(section => {
                section.style.height = '-webkit-fill-available';
            });
        } else {
            // Force recalculation of section heights
            this.sections.forEach(section => {
                section.style.height = `${window.innerHeight}px`;
            });
        }
    }

    announceSection(index) {
        const section = this.sections[index];
        const sectionName = this.getSectionName(section, index);
        
        // Create or update live region for announcements
        let liveRegion = document.getElementById('section-scroller-announcements');
        if (!liveRegion) {
            liveRegion = document.createElement('div');
            liveRegion.id = 'section-scroller-announcements';
            liveRegion.className = 'sr-only';
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.setAttribute('aria-atomic', 'true');
            document.body.appendChild(liveRegion);
        }
        
        const navigationMethod = this.isKeyboardNavigation ? 'keyboard' : 'scroll';
        liveRegion.textContent = `Navigated to ${sectionName} using ${navigationMethod}, section ${index + 1} of ${this.sections.length}`;
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

    updatePerformanceMetrics(scrollTime) {
        const metrics = this.performanceMetrics;
        metrics.averageScrollTime = (metrics.averageScrollTime * (metrics.sectionChanges - 1) + scrollTime) / metrics.sectionChanges;
    }

    pausePerformanceTracking() {
        this.performanceTrackingPaused = true;
    }

    resumePerformanceTracking() {
        this.performanceTrackingPaused = false;
    }

    // Public API methods
    getCurrentSection() {
        return this.currentSectionIndex;
    }

    getTotalSections() {
        return this.sections.length;
    }

    goToSection(index) {
        this.scrollToSection(index, 'api');
    }

    nextSection() {
        if (this.currentSectionIndex < this.sections.length - 1) {
            this.scrollToSection(this.currentSectionIndex + 1, 'api');
        }
    }

    previousSection() {
        if (this.currentSectionIndex > 0) {
            this.scrollToSection(this.currentSectionIndex - 1, 'api');
        }
    }

    getPerformanceMetrics() {
        return { ...this.performanceMetrics };
    }

    // Cleanup method
    destroy() {
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
        }
        
        // Remove event listeners
        this.container.removeEventListener('wheel', this.handleWheel);
        this.container.removeEventListener('scroll', this.handleScroll);
        // ... remove other listeners
        
        // Clear timeouts
        clearTimeout(this.scrollTimeout);
        clearTimeout(this.wheelTimeout);
        clearTimeout(this.resizeTimeout);
    }
}

// Initialize section scroller when DOM is ready
if (typeof window !== 'undefined') {
    window.sectionScroller = new SectionScroller();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SectionScroller;
}