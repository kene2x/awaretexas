// Accessibility Checker for Texas Senate Bill Tracker
// This script verifies WCAG AA compliance and accessibility features

class AccessibilityChecker {
    constructor() {
        this.contrastRatios = new Map();
        this.accessibilityIssues = [];
        this.init();
    }

    init() {
        // Run accessibility checks when DOM is loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.runAllChecks());
        } else {
            this.runAllChecks();
        }
    }

    runAllChecks() {
        console.log('🔍 Running accessibility checks...');
        
        this.checkColorContrast();
        this.checkAriaLabels();
        this.checkKeyboardNavigation();
        this.checkSemanticMarkup();
        this.checkFocusManagement();
        
        this.reportResults();
    }

    // Check color contrast ratios for WCAG AA compliance (4.5:1 minimum)
    checkColorContrast() {
        const contrastChecks = [
            // Hero section text on background
            {
                selector: '.aware-texas-logo',
                expectedRatio: 4.5,
                description: 'Hero title on background'
            },
            {
                selector: '#hero-tagline',
                expectedRatio: 4.5,
                description: 'Hero tagline on background'
            },
            // Search section text on dark blue background
            {
                selector: '.search-heading',
                expectedRatio: 4.5,
                description: 'Search heading on dark blue background'
            },
            // Form labels on dark background
            {
                selector: '.search-section label',
                expectedRatio: 4.5,
                description: 'Form labels on dark background'
            },
            // Button text
            {
                selector: '.btn-texas-primary',
                expectedRatio: 4.5,
                description: 'Button text'
            },
            // Bill card text
            {
                selector: '.bill-card-component h3',
                expectedRatio: 4.5,
                description: 'Bill card titles'
            },
            // Status badges
            {
                selector: '.status-badge',
                expectedRatio: 4.5,
                description: 'Status badge text'
            }
        ];

        contrastChecks.forEach(check => {
            const elements = document.querySelectorAll(check.selector);
            elements.forEach((element, index) => {
                const ratio = this.calculateContrastRatio(element);
                const passes = ratio >= check.expectedRatio;
                
                this.contrastRatios.set(`${check.selector}[${index}]`, {
                    ratio: ratio,
                    passes: passes,
                    description: check.description,
                    expectedRatio: check.expectedRatio
                });

                if (!passes) {
                    this.accessibilityIssues.push({
                        type: 'contrast',
                        element: check.selector,
                        issue: `Contrast ratio ${ratio.toFixed(2)}:1 is below WCAG AA standard of ${check.expectedRatio}:1`,
                        severity: 'high'
                    });
                }
            });
        });
    }

    // Calculate contrast ratio between text and background colors
    calculateContrastRatio(element) {
        const styles = window.getComputedStyle(element);
        const textColor = this.parseColor(styles.color);
        const backgroundColor = this.getBackgroundColor(element);
        
        if (!textColor || !backgroundColor) {
            return 0; // Unable to calculate
        }

        const textLuminance = this.getLuminance(textColor);
        const bgLuminance = this.getLuminance(backgroundColor);
        
        const lighter = Math.max(textLuminance, bgLuminance);
        const darker = Math.min(textLuminance, bgLuminance);
        
        return (lighter + 0.05) / (darker + 0.05);
    }

    // Parse RGB color string to RGB values
    parseColor(colorString) {
        const rgb = colorString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgb) {
            return {
                r: parseInt(rgb[1]),
                g: parseInt(rgb[2]),
                b: parseInt(rgb[3])
            };
        }
        return null;
    }

    // Get effective background color (traverses up DOM tree)
    getBackgroundColor(element) {
        let current = element;
        while (current && current !== document.body) {
            const styles = window.getComputedStyle(current);
            const bgColor = styles.backgroundColor;
            
            if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
                return this.parseColor(bgColor);
            }
            current = current.parentElement;
        }
        
        // Default to white background
        return { r: 255, g: 255, b: 255 };
    }

    // Calculate relative luminance
    getLuminance(rgb) {
        const { r, g, b } = rgb;
        
        const [rs, gs, bs] = [r, g, b].map(c => {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    }

    // Check for proper ARIA labels and semantic markup
    checkAriaLabels() {
        const requiredAriaElements = [
            { selector: '[role="banner"]', description: 'Hero section banner role' },
            { selector: '[role="search"]', description: 'Search section role' },
            { selector: '[role="main"]', description: 'Main content role' },
            { selector: '[aria-labelledby]', description: 'Elements with aria-labelledby' },
            { selector: '[aria-describedby]', description: 'Elements with aria-describedby' },
            { selector: '[aria-live]', description: 'Live regions for screen readers' }
        ];

        requiredAriaElements.forEach(check => {
            const elements = document.querySelectorAll(check.selector);
            if (elements.length === 0) {
                this.accessibilityIssues.push({
                    type: 'aria',
                    element: check.selector,
                    issue: `Missing required ARIA attribute: ${check.description}`,
                    severity: 'medium'
                });
            }
        });

        // Check for missing alt text on images
        const images = document.querySelectorAll('img:not([alt])');
        images.forEach((img, index) => {
            this.accessibilityIssues.push({
                type: 'alt-text',
                element: `img[${index}]`,
                issue: 'Image missing alt attribute',
                severity: 'high'
            });
        });
    }

    // Check keyboard navigation functionality
    checkKeyboardNavigation() {
        const interactiveElements = document.querySelectorAll(
            'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        let tabIndexIssues = 0;
        interactiveElements.forEach((element, index) => {
            const tabIndex = element.getAttribute('tabindex');
            
            // Check for positive tabindex values (anti-pattern)
            if (tabIndex && parseInt(tabIndex) > 0) {
                this.accessibilityIssues.push({
                    type: 'keyboard',
                    element: element.tagName.toLowerCase(),
                    issue: `Positive tabindex value (${tabIndex}) creates unpredictable tab order`,
                    severity: 'medium'
                });
                tabIndexIssues++;
            }
        });

        // Check for keyboard event handlers on non-interactive elements
        const nonInteractiveWithEvents = document.querySelectorAll(
            'div[onclick], span[onclick], p[onclick]'
        );
        
        nonInteractiveWithEvents.forEach(element => {
            if (!element.hasAttribute('tabindex') && !element.hasAttribute('role')) {
                this.accessibilityIssues.push({
                    type: 'keyboard',
                    element: element.tagName.toLowerCase(),
                    issue: 'Click handler on non-interactive element without keyboard support',
                    severity: 'high'
                });
            }
        });
    }

    // Check semantic HTML markup
    checkSemanticMarkup() {
        const semanticChecks = [
            { selector: 'h1', min: 1, max: 1, description: 'Page should have exactly one h1' },
            { selector: 'main', min: 1, max: 1, description: 'Page should have exactly one main element' },
            { selector: '[role="banner"]', min: 1, description: 'Page should have a banner role' },
            { selector: '[role="search"]', min: 1, description: 'Page should have a search role' }
        ];

        semanticChecks.forEach(check => {
            const elements = document.querySelectorAll(check.selector);
            const count = elements.length;

            if (count < check.min) {
                this.accessibilityIssues.push({
                    type: 'semantic',
                    element: check.selector,
                    issue: `${check.description} (found ${count}, expected at least ${check.min})`,
                    severity: 'medium'
                });
            }

            if (check.max && count > check.max) {
                this.accessibilityIssues.push({
                    type: 'semantic',
                    element: check.selector,
                    issue: `${check.description} (found ${count}, expected at most ${check.max})`,
                    severity: 'medium'
                });
            }
        });

        // Check heading hierarchy
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        let previousLevel = 0;
        
        headings.forEach((heading, index) => {
            const level = parseInt(heading.tagName.charAt(1));
            
            if (level > previousLevel + 1) {
                this.accessibilityIssues.push({
                    type: 'semantic',
                    element: `${heading.tagName.toLowerCase()}[${index}]`,
                    issue: `Heading level skipped (h${previousLevel} to h${level})`,
                    severity: 'medium'
                });
            }
            
            previousLevel = level;
        });
    }

    // Check focus management
    checkFocusManagement() {
        // Check for skip links
        const skipLinks = document.querySelectorAll('a[href^="#"]');
        let hasSkipToMain = false;
        
        skipLinks.forEach(link => {
            if (link.textContent.toLowerCase().includes('skip') && 
                link.textContent.toLowerCase().includes('main')) {
                hasSkipToMain = true;
            }
        });

        if (!hasSkipToMain) {
            this.accessibilityIssues.push({
                type: 'focus',
                element: 'skip-link',
                issue: 'Missing skip to main content link for keyboard users',
                severity: 'medium'
            });
        }

        // Check for focus indicators
        const focusableElements = document.querySelectorAll(
            'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        // Test focus visibility (this is a basic check)
        focusableElements.forEach((element, index) => {
            const styles = window.getComputedStyle(element, ':focus');
            const hasOutline = styles.outline !== 'none' && styles.outline !== '0px';
            const hasBoxShadow = styles.boxShadow !== 'none';
            
            if (!hasOutline && !hasBoxShadow) {
                this.accessibilityIssues.push({
                    type: 'focus',
                    element: `${element.tagName.toLowerCase()}[${index}]`,
                    issue: 'Element may not have visible focus indicator',
                    severity: 'low'
                });
            }
        });
    }

    // Report all accessibility check results
    reportResults() {
        console.log('\n📊 Accessibility Check Results');
        console.log('================================');

        // Report contrast ratios
        console.log('\n🎨 Color Contrast Results:');
        this.contrastRatios.forEach((result, selector) => {
            const status = result.passes ? '✅' : '❌';
            console.log(`${status} ${selector}: ${result.ratio.toFixed(2)}:1 (${result.description})`);
        });

        // Report issues by severity
        const issuesBySeverity = {
            high: this.accessibilityIssues.filter(issue => issue.severity === 'high'),
            medium: this.accessibilityIssues.filter(issue => issue.severity === 'medium'),
            low: this.accessibilityIssues.filter(issue => issue.severity === 'low')
        };

        console.log('\n🚨 Accessibility Issues:');
        
        if (issuesBySeverity.high.length > 0) {
            console.log('\n❌ High Priority Issues:');
            issuesBySeverity.high.forEach(issue => {
                console.log(`  • ${issue.issue} (${issue.element})`);
            });
        }

        if (issuesBySeverity.medium.length > 0) {
            console.log('\n⚠️ Medium Priority Issues:');
            issuesBySeverity.medium.forEach(issue => {
                console.log(`  • ${issue.issue} (${issue.element})`);
            });
        }

        if (issuesBySeverity.low.length > 0) {
            console.log('\n💡 Low Priority Issues:');
            issuesBySeverity.low.forEach(issue => {
                console.log(`  • ${issue.issue} (${issue.element})`);
            });
        }

        const totalIssues = this.accessibilityIssues.length;
        const passedContrast = Array.from(this.contrastRatios.values()).filter(r => r.passes).length;
        const totalContrast = this.contrastRatios.size;

        console.log('\n📈 Summary:');
        console.log(`  • Color Contrast: ${passedContrast}/${totalContrast} passed`);
        console.log(`  • Total Issues: ${totalIssues}`);
        console.log(`  • High Priority: ${issuesBySeverity.high.length}`);
        console.log(`  • Medium Priority: ${issuesBySeverity.medium.length}`);
        console.log(`  • Low Priority: ${issuesBySeverity.low.length}`);

        if (totalIssues === 0 && passedContrast === totalContrast) {
            console.log('\n🎉 All accessibility checks passed!');
        } else {
            console.log('\n🔧 Please address the issues above to improve accessibility.');
        }

        // Store results for potential use by other scripts
        window.accessibilityResults = {
            contrastRatios: this.contrastRatios,
            issues: this.accessibilityIssues,
            summary: {
                totalIssues,
                passedContrast,
                totalContrast,
                issuesBySeverity
            }
        };
    }
}

// Initialize accessibility checker
if (typeof window !== 'undefined') {
    window.accessibilityChecker = new AccessibilityChecker();
}

// Export for testing environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AccessibilityChecker;
}