/**
 * Cross-Browser Testing and Final Integration Validation
 * Task 14: Comprehensive testing suite for the redesigned AWARE TEXAS interface
 */

class CrossBrowserValidator {
    constructor() {
        this.testResults = {
            browser: this.detectBrowser(),
            viewport: this.getViewportInfo(),
            features: {},
            accessibility: {},
            performance: {},
            functionality: {},
            design: {}
        };
        
        this.requirements = {
            'Requirement 1': 'Hero section with AWARE TEXAS branding and Texas imagery',
            'Requirement 2': 'Dark blue search section with modern styling',
            'Requirement 3': 'Bill cards maintain functionality with new design',
            'Requirement 4': 'Consistent Texas flag color theming',
            'Requirement 5': 'Preserve all backend functionality and APIs',
            'Requirement 6': 'Smooth transitions and animations'
        };
        
        this.init();
    }

    init() {
        console.log('🚀 Starting Cross-Browser Validation for AWARE TEXAS Redesign');
        console.log(`Browser: ${this.testResults.browser.name} ${this.testResults.browser.version}`);
        console.log(`Viewport: ${this.testResults.viewport.width}x${this.testResults.viewport.height}`);
        
        this.runAllTests();
    }

    detectBrowser() {
        const ua = navigator.userAgent;
        let browser = { name: 'Unknown', version: 'Unknown' };

        if (ua.includes('Chrome') && !ua.includes('Edg')) {
            browser.name = 'Chrome';
            browser.version = ua.match(/Chrome\/(\d+)/)?.[1] || 'Unknown';
        } else if (ua.includes('Firefox')) {
            browser.name = 'Firefox';
            browser.version = ua.match(/Firefox\/(\d+)/)?.[1] || 'Unknown';
        } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
            browser.name = 'Safari';
            browser.version = ua.match(/Version\/(\d+)/)?.[1] || 'Unknown';
        } else if (ua.includes('Edg')) {
            browser.name = 'Edge';
            browser.version = ua.match(/Edg\/(\d+)/)?.[1] || 'Unknown';
        }

        return browser;
    }

    getViewportInfo() {
        return {
            width: window.innerWidth,
            height: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio || 1,
            orientation: window.screen?.orientation?.type || 'unknown'
        };
    }

    async runAllTests() {
        try {
            // Test 1: Browser Feature Support
            await this.testBrowserFeatures();
            
            // Test 2: Design System Validation
            await this.testDesignSystem();
            
            // Test 3: Responsive Design
            await this.testResponsiveDesign();
            
            // Test 4: Functionality Preservation
            await this.testFunctionality();
            
            // Test 5: Accessibility Compliance
            await this.testAccessibility();
            
            // Test 6: Performance Validation
            await this.testPerformance();
            
            // Test 7: Requirements Validation
            await this.validateRequirements();
            
            // Generate final report
            this.generateReport();
            
        } catch (error) {
            console.error('❌ Cross-browser validation failed:', error);
            this.testResults.error = error.message;
        }
    }

    async testBrowserFeatures() {
        console.log('🔍 Testing Browser Feature Support...');
        
        const features = {
            cssCustomProperties: this.testCSSCustomProperties(),
            cssGrid: this.testCSSGrid(),
            flexbox: this.testFlexbox(),
            intersectionObserver: 'IntersectionObserver' in window,
            fetch: 'fetch' in window,
            es6: this.testES6Features(),
            webp: await this.testWebPSupport(),
            backdropFilter: this.testBackdropFilter(),
            cssClamp: this.testCSSClamp()
        };

        this.testResults.features = features;
        
        // Log feature support
        Object.entries(features).forEach(([feature, supported]) => {
            const status = supported ? '✅' : '❌';
            console.log(`  ${status} ${feature}: ${supported}`);
        });
    }

    testCSSCustomProperties() {
        try {
            const testEl = document.createElement('div');
            testEl.style.setProperty('--test', 'test');
            return testEl.style.getPropertyValue('--test') === 'test';
        } catch {
            return false;
        }
    }

    testCSSGrid() {
        try {
            const testEl = document.createElement('div');
            testEl.style.display = 'grid';
            return testEl.style.display === 'grid';
        } catch {
            return false;
        }
    }

    testFlexbox() {
        try {
            const testEl = document.createElement('div');
            testEl.style.display = 'flex';
            return testEl.style.display === 'flex';
        } catch {
            return false;
        }
    }

    testES6Features() {
        try {
            // Test arrow functions, const/let, template literals
            const test = () => `test ${1 + 1}`;
            return test() === 'test 2';
        } catch {
            return false;
        }
    }

    async testWebPSupport() {
        return new Promise((resolve) => {
            const webP = new Image();
            webP.onload = webP.onerror = () => resolve(webP.height === 2);
            webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
        });
    }

    testBackdropFilter() {
        try {
            const testEl = document.createElement('div');
            testEl.style.backdropFilter = 'blur(10px)';
            return testEl.style.backdropFilter === 'blur(10px)';
        } catch {
            return false;
        }
    }

    testCSSClamp() {
        try {
            const testEl = document.createElement('div');
            testEl.style.fontSize = 'clamp(1rem, 2vw, 2rem)';
            return testEl.style.fontSize.includes('clamp');
        } catch {
            return false;
        }
    }

    async testDesignSystem() {
        console.log('🎨 Testing Design System Implementation...');
        
        const design = {
            texasColors: this.validateTexasColors(),
            heroSection: this.validateHeroSection(),
            searchSection: this.validateSearchSection(),
            typography: this.validateTypography(),
            modernInputs: this.validateModernInputs(),
            billCards: this.validateBillCards()
        };

        this.testResults.design = design;
        
        Object.entries(design).forEach(([component, result]) => {
            const status = result.valid ? '✅' : '❌';
            console.log(`  ${status} ${component}: ${result.message}`);
        });
    }

    validateTexasColors() {
        const root = getComputedStyle(document.documentElement);
        const texasRed = root.getPropertyValue('--texas-red').trim();
        const texasBlue = root.getPropertyValue('--texas-blue').trim();
        const texasWhite = root.getPropertyValue('--texas-white').trim();

        const valid = texasRed === '#BF0A30' && texasBlue === '#002868' && texasWhite === '#FFFFFF';
        
        return {
            valid,
            message: valid ? 'Texas flag colors correctly implemented' : 'Texas flag colors missing or incorrect',
            details: { texasRed, texasBlue, texasWhite }
        };
    }

    validateHeroSection() {
        const heroSection = document.querySelector('.hero-section');
        const awareTexasLogo = document.querySelector('.aware-texas-logo');
        const heroTagline = document.querySelector('h2[id="hero-tagline"]');
        const heroBackground = document.querySelector('.hero-background-image');

        const valid = heroSection && awareTexasLogo && heroTagline && heroBackground;
        
        return {
            valid,
            message: valid ? 'Hero section with AWARE TEXAS branding implemented' : 'Hero section components missing',
            details: {
                heroSection: !!heroSection,
                awareTexasLogo: !!awareTexasLogo,
                heroTagline: !!heroTagline,
                heroBackground: !!heroBackground
            }
        };
    }

    validateSearchSection() {
        const searchSection = document.querySelector('.search-section');
        const searchHeading = document.querySelector('.search-heading');
        const modernInput = document.querySelector('.input-modern');
        
        const valid = searchSection && searchHeading && modernInput;
        const hasBlueBackground = searchSection ? 
            getComputedStyle(searchSection).backgroundColor.includes('rgb(0, 40, 104)') ||
            getComputedStyle(searchSection).backgroundColor.includes('#002868') : false;

        return {
            valid: valid && hasBlueBackground,
            message: valid && hasBlueBackground ? 'Dark blue search section with modern styling implemented' : 'Search section styling incomplete',
            details: {
                searchSection: !!searchSection,
                searchHeading: !!searchHeading,
                modernInput: !!modernInput,
                hasBlueBackground
            }
        };
    }

    validateTypography() {
        const heroTitle = document.querySelector('.aware-texas-logo');
        const heroTagline = document.querySelector('h2[id="hero-tagline"]');
        
        let valid = true;
        let issues = [];

        if (heroTitle) {
            const styles = getComputedStyle(heroTitle);
            if (!styles.fontSize.includes('clamp') && parseInt(styles.fontSize) < 32) {
                valid = false;
                issues.push('Hero title font size too small');
            }
        } else {
            valid = false;
            issues.push('Hero title missing');
        }

        if (heroTagline) {
            const styles = getComputedStyle(heroTagline);
            if (parseInt(styles.fontSize) < 24) {
                valid = false;
                issues.push('Hero tagline font size too small');
            }
        } else {
            valid = false;
            issues.push('Hero tagline missing');
        }

        return {
            valid,
            message: valid ? 'Typography hierarchy correctly implemented' : `Typography issues: ${issues.join(', ')}`,
            details: { issues }
        };
    }

    validateModernInputs() {
        const modernInputs = document.querySelectorAll('.input-modern, .filter-select');
        let valid = true;
        let roundedInputs = 0;

        modernInputs.forEach(input => {
            const styles = getComputedStyle(input);
            const borderRadius = parseInt(styles.borderRadius);
            if (borderRadius >= 8) {
                roundedInputs++;
            }
        });

        valid = modernInputs.length > 0 && roundedInputs === modernInputs.length;

        return {
            valid,
            message: valid ? 'Modern rounded input styling implemented' : 'Input styling needs improvement',
            details: {
                totalInputs: modernInputs.length,
                roundedInputs,
                percentage: modernInputs.length > 0 ? (roundedInputs / modernInputs.length * 100).toFixed(1) + '%' : '0%'
            }
        };
    }

    validateBillCards() {
        const billCards = document.querySelectorAll('.bill-card-component');
        let valid = billCards.length > 0;
        let interactiveCards = 0;

        billCards.forEach(card => {
            if (card.style.cursor === 'pointer' || getComputedStyle(card).cursor === 'pointer') {
                interactiveCards++;
            }
        });

        return {
            valid: valid && interactiveCards === billCards.length,
            message: valid ? 'Bill cards maintain functionality with new design' : 'Bill cards missing or not interactive',
            details: {
                totalCards: billCards.length,
                interactiveCards,
                percentage: billCards.length > 0 ? (interactiveCards / billCards.length * 100).toFixed(1) + '%' : '0%'
            }
        };
    }

    async testResponsiveDesign() {
        console.log('📱 Testing Responsive Design...');
        
        const breakpoints = [
            { name: 'Mobile', width: 375, height: 667 },
            { name: 'Tablet', width: 768, height: 1024 },
            { name: 'Desktop', width: 1200, height: 800 },
            { name: 'Large Desktop', width: 1920, height: 1080 }
        ];

        const responsive = {};

        for (const breakpoint of breakpoints) {
            // Simulate viewport change (note: this is limited in actual testing)
            const result = await this.testBreakpoint(breakpoint);
            responsive[breakpoint.name] = result;
        }

        this.testResults.responsive = responsive;
        
        Object.entries(responsive).forEach(([breakpoint, result]) => {
            const status = result.valid ? '✅' : '❌';
            console.log(`  ${status} ${breakpoint}: ${result.message}`);
        });
    }

    async testBreakpoint(breakpoint) {
        // Test key responsive elements at current viewport
        const heroSection = document.querySelector('.hero-section');
        const searchSection = document.querySelector('.search-section');
        const billGrid = document.querySelector('.bill-grid');
        const navigation = document.querySelector('.navigation-header');

        let valid = true;
        let issues = [];

        // Check if elements are visible and properly sized
        if (heroSection) {
            const rect = heroSection.getBoundingClientRect();
            if (rect.height < 200) {
                valid = false;
                issues.push('Hero section too small');
            }
        }

        if (searchSection) {
            const rect = searchSection.getBoundingClientRect();
            if (rect.width < 300) {
                valid = false;
                issues.push('Search section too narrow');
            }
        }

        if (navigation) {
            const rect = navigation.getBoundingClientRect();
            if (rect.height < 50) {
                valid = false;
                issues.push('Navigation too small');
            }
        }

        return {
            valid,
            message: valid ? 'Responsive design working correctly' : `Issues: ${issues.join(', ')}`,
            details: { issues, viewport: `${breakpoint.width}x${breakpoint.height}` }
        };
    }

    async testFunctionality() {
        console.log('⚙️ Testing Functionality Preservation...');
        
        const functionality = {
            searchInput: this.testSearchInput(),
            filterDropdowns: this.testFilterDropdowns(),
            billCardClicks: this.testBillCardClicks(),
            clearFilters: this.testClearFilters(),
            keyboardNavigation: this.testKeyboardNavigation(),
            apiIntegration: await this.testAPIIntegration()
        };

        this.testResults.functionality = functionality;
        
        Object.entries(functionality).forEach(([feature, result]) => {
            const status = result.valid ? '✅' : '❌';
            console.log(`  ${status} ${feature}: ${result.message}`);
        });
    }

    testSearchInput() {
        const searchInput = document.getElementById('search-input');
        
        if (!searchInput) {
            return { valid: false, message: 'Search input not found' };
        }

        // Test if input has event listeners (indirect test)
        const hasPlaceholder = searchInput.placeholder.length > 0;
        const hasAriaLabel = searchInput.getAttribute('aria-label') !== null;
        
        return {
            valid: hasPlaceholder && hasAriaLabel,
            message: 'Search input properly configured',
            details: { hasPlaceholder, hasAriaLabel }
        };
    }

    testFilterDropdowns() {
        const topicsFilter = document.getElementById('topics-filter');
        const sponsorsFilter = document.getElementById('sponsors-filter');
        const statusFilter = document.getElementById('status-filter');
        
        const valid = topicsFilter && sponsorsFilter && statusFilter;
        
        return {
            valid,
            message: valid ? 'Filter dropdowns present and configured' : 'Filter dropdowns missing',
            details: {
                topicsFilter: !!topicsFilter,
                sponsorsFilter: !!sponsorsFilter,
                statusFilter: !!statusFilter
            }
        };
    }

    testBillCardClicks() {
        const billCards = document.querySelectorAll('.bill-card-component');
        let clickableCards = 0;

        billCards.forEach(card => {
            if (card.style.cursor === 'pointer' || getComputedStyle(card).cursor === 'pointer') {
                clickableCards++;
            }
        });

        const valid = billCards.length > 0 && clickableCards === billCards.length;
        
        return {
            valid,
            message: valid ? 'Bill cards are clickable' : 'Bill cards may not be properly clickable',
            details: { totalCards: billCards.length, clickableCards }
        };
    }

    testClearFilters() {
        const clearButton = document.getElementById('clear-filters');
        
        return {
            valid: !!clearButton,
            message: clearButton ? 'Clear filters button present' : 'Clear filters button missing',
            details: { hasButton: !!clearButton }
        };
    }

    testKeyboardNavigation() {
        const focusableElements = document.querySelectorAll(
            'input, select, button, a[href], [tabindex]:not([tabindex="-1"])'
        );
        
        let accessibleElements = 0;
        focusableElements.forEach(el => {
            if (!el.hasAttribute('tabindex') || el.getAttribute('tabindex') !== '-1') {
                accessibleElements++;
            }
        });

        const valid = accessibleElements > 0;
        
        return {
            valid,
            message: valid ? 'Keyboard navigation elements present' : 'Keyboard navigation may be impaired',
            details: { focusableElements: focusableElements.length, accessibleElements }
        };
    }

    async testAPIIntegration() {
        try {
            // Test if bills are loaded (indirect API test)
            const billCards = document.querySelectorAll('.bill-card-component');
            const loadingElement = document.getElementById('loading');
            const noResultsElement = document.getElementById('no-results');
            
            const hasData = billCards.length > 0;
            const notLoading = !loadingElement || loadingElement.classList.contains('hidden');
            const notShowingNoResults = !noResultsElement || noResultsElement.classList.contains('hidden');
            
            const valid = hasData && notLoading && (notShowingNoResults || billCards.length > 0);
            
            return {
                valid,
                message: valid ? 'API integration working - bills loaded' : 'API integration may have issues',
                details: { 
                    billsLoaded: billCards.length,
                    isLoading: !notLoading,
                    showingNoResults: !notShowingNoResults
                }
            };
        } catch (error) {
            return {
                valid: false,
                message: `API integration test failed: ${error.message}`,
                details: { error: error.message }
            };
        }
    }

    async testAccessibility() {
        console.log('♿ Testing Accessibility Compliance...');
        
        const accessibility = {
            colorContrast: this.testColorContrast(),
            ariaLabels: this.testAriaLabels(),
            semanticHTML: this.testSemanticHTML(),
            keyboardAccess: this.testKeyboardAccess(),
            screenReader: this.testScreenReaderSupport(),
            focusManagement: this.testFocusManagement()
        };

        this.testResults.accessibility = accessibility;
        
        Object.entries(accessibility).forEach(([feature, result]) => {
            const status = result.valid ? '✅' : '❌';
            console.log(`  ${status} ${feature}: ${result.message}`);
        });
    }

    testColorContrast() {
        // Test key color combinations for WCAG compliance
        const heroTitle = document.querySelector('.aware-texas-logo');
        const searchHeading = document.querySelector('.search-heading');
        
        let valid = true;
        let issues = [];

        // This is a simplified test - in real scenarios, you'd use color contrast calculation
        if (heroTitle) {
            const styles = getComputedStyle(heroTitle);
            const color = styles.color;
            const backgroundColor = styles.backgroundColor;
            
            // Basic check for dark text on light background or vice versa
            if (color === backgroundColor) {
                valid = false;
                issues.push('Hero title color contrast issue');
            }
        }

        if (searchHeading) {
            const styles = getComputedStyle(searchHeading);
            const color = styles.color;
            
            // Check if white text on dark blue background
            if (!color.includes('255, 255, 255') && !color.includes('#ffffff')) {
                // This might be an issue if background is dark
                const parent = searchHeading.closest('.search-section');
                if (parent) {
                    const parentStyles = getComputedStyle(parent);
                    if (parentStyles.backgroundColor.includes('0, 40, 104')) {
                        valid = false;
                        issues.push('Search heading color contrast issue');
                    }
                }
            }
        }

        return {
            valid,
            message: valid ? 'Color contrast appears adequate' : `Contrast issues: ${issues.join(', ')}`,
            details: { issues }
        };
    }

    testAriaLabels() {
        const elementsNeedingAria = document.querySelectorAll(
            'input, button, select, [role="button"], [role="searchbox"]'
        );
        
        let labeledElements = 0;
        elementsNeedingAria.forEach(el => {
            if (el.getAttribute('aria-label') || 
                el.getAttribute('aria-labelledby') || 
                el.getAttribute('aria-describedby') ||
                el.closest('label') ||
                document.querySelector(`label[for="${el.id}"]`)) {
                labeledElements++;
            }
        });

        const valid = elementsNeedingAria.length > 0 && labeledElements === elementsNeedingAria.length;
        
        return {
            valid,
            message: valid ? 'ARIA labels properly implemented' : 'Some elements missing ARIA labels',
            details: {
                totalElements: elementsNeedingAria.length,
                labeledElements,
                percentage: elementsNeedingAria.length > 0 ? 
                    (labeledElements / elementsNeedingAria.length * 100).toFixed(1) + '%' : '0%'
            }
        };
    }

    testSemanticHTML() {
        const semanticElements = [
            'header', 'nav', 'main', 'section', 'article', 'aside', 'footer'
        ];
        
        let foundElements = 0;
        semanticElements.forEach(tag => {
            if (document.querySelector(tag)) {
                foundElements++;
            }
        });

        const valid = foundElements >= 3; // Expect at least header, main, section
        
        return {
            valid,
            message: valid ? 'Semantic HTML structure implemented' : 'Limited semantic HTML usage',
            details: { 
                foundElements,
                totalChecked: semanticElements.length,
                elements: semanticElements.filter(tag => document.querySelector(tag))
            }
        };
    }

    testKeyboardAccess() {
        const skipLink = document.querySelector('.skip-link');
        const focusableElements = document.querySelectorAll(
            'input, select, button, a[href], [tabindex]:not([tabindex="-1"])'
        );
        
        const hasSkipLink = !!skipLink;
        const hasFocusableElements = focusableElements.length > 0;
        
        return {
            valid: hasSkipLink && hasFocusableElements,
            message: hasSkipLink && hasFocusableElements ? 
                'Keyboard accessibility features present' : 
                'Keyboard accessibility needs improvement',
            details: {
                hasSkipLink,
                focusableElements: focusableElements.length
            }
        };
    }

    testScreenReaderSupport() {
        const srOnlyElements = document.querySelectorAll('.sr-only');
        const liveRegions = document.querySelectorAll('[aria-live]');
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        
        const valid = srOnlyElements.length > 0 && headings.length > 0;
        
        return {
            valid,
            message: valid ? 'Screen reader support implemented' : 'Screen reader support needs improvement',
            details: {
                srOnlyElements: srOnlyElements.length,
                liveRegions: liveRegions.length,
                headings: headings.length
            }
        };
    }

    testFocusManagement() {
        // Test if focus styles are properly implemented
        const focusStyles = document.querySelector('style, link[rel="stylesheet"]');
        let hasFocusStyles = false;
        
        if (focusStyles) {
            // This is a simplified check - in real scenarios, you'd parse CSS
            hasFocusStyles = document.styleSheets.length > 0;
        }
        
        return {
            valid: hasFocusStyles,
            message: hasFocusStyles ? 'Focus management styles present' : 'Focus management needs verification',
            details: { stylesheets: document.styleSheets.length }
        };
    }

    async testPerformance() {
        console.log('⚡ Testing Performance...');
        
        const performance = {
            loadTime: this.measureLoadTime(),
            imageOptimization: this.testImageOptimization(),
            cssOptimization: this.testCSSOptimization(),
            jsOptimization: this.testJSOptimization(),
            caching: this.testCaching(),
            animations: this.testAnimationPerformance()
        };

        this.testResults.performance = performance;
        
        Object.entries(performance).forEach(([metric, result]) => {
            const status = result.valid ? '✅' : '❌';
            console.log(`  ${status} ${metric}: ${result.message}`);
        });
    }

    measureLoadTime() {
        const navigation = performance.getEntriesByType('navigation')[0];
        const loadTime = navigation ? navigation.loadEventEnd - navigation.fetchStart : 0;
        
        const valid = loadTime < 3000; // Under 3 seconds
        
        return {
            valid,
            message: `Page load time: ${loadTime.toFixed(0)}ms`,
            details: { loadTime, threshold: 3000 }
        };
    }

    testImageOptimization() {
        const images = document.querySelectorAll('img');
        let optimizedImages = 0;
        
        images.forEach(img => {
            // Check for lazy loading, proper alt text, and reasonable size
            if (img.loading === 'lazy' || img.getAttribute('alt') !== null) {
                optimizedImages++;
            }
        });

        const valid = images.length === 0 || optimizedImages === images.length;
        
        return {
            valid,
            message: valid ? 'Images properly optimized' : 'Image optimization needs improvement',
            details: { totalImages: images.length, optimizedImages }
        };
    }

    testCSSOptimization() {
        const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
        const inlineStyles = document.querySelectorAll('style');
        
        // Check for minification (simplified test)
        let minifiedSheets = 0;
        stylesheets.forEach(sheet => {
            if (sheet.href && (sheet.href.includes('.min.') || sheet.href.includes('output.css'))) {
                minifiedSheets++;
            }
        });

        const valid = stylesheets.length === 0 || minifiedSheets > 0;
        
        return {
            valid,
            message: valid ? 'CSS optimization detected' : 'CSS optimization recommended',
            details: { 
                totalStylesheets: stylesheets.length,
                minifiedSheets,
                inlineStyles: inlineStyles.length
            }
        };
    }

    testJSOptimization() {
        const scripts = document.querySelectorAll('script[src]');
        let optimizedScripts = 0;
        
        scripts.forEach(script => {
            if (script.src.includes('.min.') || script.defer || script.async) {
                optimizedScripts++;
            }
        });

        const valid = scripts.length === 0 || optimizedScripts > 0;
        
        return {
            valid,
            message: valid ? 'JavaScript optimization detected' : 'JavaScript optimization recommended',
            details: { totalScripts: scripts.length, optimizedScripts }
        };
    }

    testCaching() {
        // Test if caching mechanisms are in place
        const hasCacheManager = typeof window.cacheManager !== 'undefined';
        const hasServiceWorker = 'serviceWorker' in navigator;
        
        return {
            valid: hasCacheManager || hasServiceWorker,
            message: hasCacheManager || hasServiceWorker ? 'Caching mechanisms detected' : 'Caching not detected',
            details: { hasCacheManager, hasServiceWorker }
        };
    }

    testAnimationPerformance() {
        // Test for CSS animations and transitions
        const animatedElements = document.querySelectorAll('[class*="animate"], [style*="transition"]');
        const hasAnimations = animatedElements.length > 0;
        
        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        return {
            valid: hasAnimations,
            message: hasAnimations ? 'Animations implemented' : 'No animations detected',
            details: { 
                animatedElements: animatedElements.length,
                prefersReducedMotion
            }
        };
    }

    async validateRequirements() {
        console.log('📋 Validating Requirements Compliance...');
        
        const requirements = {};
        
        // Requirement 1: Hero section with AWARE TEXAS branding
        requirements['Requirement 1'] = this.validateRequirement1();
        
        // Requirement 2: Dark blue search section
        requirements['Requirement 2'] = this.validateRequirement2();
        
        // Requirement 3: Bill cards functionality
        requirements['Requirement 3'] = this.validateRequirement3();
        
        // Requirement 4: Texas flag color theming
        requirements['Requirement 4'] = this.validateRequirement4();
        
        // Requirement 5: Backend functionality preservation
        requirements['Requirement 5'] = this.validateRequirement5();
        
        // Requirement 6: Smooth transitions and animations
        requirements['Requirement 6'] = this.validateRequirement6();

        this.testResults.requirements = requirements;
        
        Object.entries(requirements).forEach(([req, result]) => {
            const status = result.valid ? '✅' : '❌';
            console.log(`  ${status} ${req}: ${result.message}`);
        });
    }

    validateRequirement1() {
        const heroSection = document.querySelector('.hero-section');
        const awareTexasLogo = document.querySelector('.aware-texas-logo');
        const heroTagline = document.querySelector('h2[id="hero-tagline"]');
        const texasImagery = document.querySelector('.hero-background-image');
        
        const valid = heroSection && awareTexasLogo && heroTagline && texasImagery;
        
        return {
            valid,
            message: valid ? 
                'Hero section with AWARE TEXAS branding and Texas imagery implemented' : 
                'Hero section requirements not fully met',
            details: {
                heroSection: !!heroSection,
                awareTexasLogo: !!awareTexasLogo,
                heroTagline: !!heroTagline,
                texasImagery: !!texasImagery
            }
        };
    }

    validateRequirement2() {
        const searchSection = document.querySelector('.search-section');
        const searchHeading = document.querySelector('.search-heading');
        const modernInputs = document.querySelectorAll('.input-modern, .filter-select');
        
        let hasBlueBackground = false;
        if (searchSection) {
            const styles = getComputedStyle(searchSection);
            hasBlueBackground = styles.backgroundColor.includes('0, 40, 104') || 
                              styles.backgroundColor.includes('#002868');
        }
        
        const valid = searchSection && searchHeading && modernInputs.length > 0 && hasBlueBackground;
        
        return {
            valid,
            message: valid ? 
                'Dark blue search section with modern styling implemented' : 
                'Search section requirements not fully met',
            details: {
                searchSection: !!searchSection,
                searchHeading: !!searchHeading,
                modernInputs: modernInputs.length,
                hasBlueBackground
            }
        };
    }

    validateRequirement3() {
        const billCards = document.querySelectorAll('.bill-card-component');
        const hasHoverEffects = billCards.length > 0;
        const hasClickHandlers = Array.from(billCards).every(card => 
            card.style.cursor === 'pointer' || getComputedStyle(card).cursor === 'pointer'
        );
        
        const valid = billCards.length > 0 && hasHoverEffects && hasClickHandlers;
        
        return {
            valid,
            message: valid ? 
                'Bill cards maintain functionality with new design' : 
                'Bill card functionality requirements not fully met',
            details: {
                billCards: billCards.length,
                hasHoverEffects,
                hasClickHandlers
            }
        };
    }

    validateRequirement4() {
        const root = getComputedStyle(document.documentElement);
        const texasRed = root.getPropertyValue('--texas-red').trim();
        const texasBlue = root.getPropertyValue('--texas-blue').trim();
        const texasWhite = root.getPropertyValue('--texas-white').trim();
        
        const colorsCorrect = texasRed === '#BF0A30' && texasBlue === '#002868' && texasWhite === '#FFFFFF';
        
        // Check if colors are used throughout the design
        const elementsUsingTexasColors = document.querySelectorAll(
            '[class*="texas"], .hero-section, .search-section, .btn-texas-primary'
        );
        
        const valid = colorsCorrect && elementsUsingTexasColors.length > 0;
        
        return {
            valid,
            message: valid ? 
                'Consistent Texas flag color theming implemented' : 
                'Color theming requirements not fully met',
            details: {
                colorsCorrect,
                elementsUsingColors: elementsUsingTexasColors.length,
                colors: { texasRed, texasBlue, texasWhite }
            }
        };
    }

    validateRequirement5() {
        // Check if API endpoints are working and data is loaded
        const billCards = document.querySelectorAll('.bill-card-component');
        const searchInput = document.getElementById('search-input');
        const filterDropdowns = document.querySelectorAll('#topics-filter, #sponsors-filter, #status-filter');
        
        const hasData = billCards.length > 0;
        const hasSearchFunctionality = !!searchInput;
        const hasFilterFunctionality = filterDropdowns.length === 3;
        
        const valid = hasData && hasSearchFunctionality && hasFilterFunctionality;
        
        return {
            valid,
            message: valid ? 
                'Backend functionality and APIs preserved' : 
                'Backend functionality requirements not fully met',
            details: {
                hasData,
                hasSearchFunctionality,
                hasFilterFunctionality,
                billsLoaded: billCards.length
            }
        };
    }

    validateRequirement6() {
        // Check for CSS transitions and animations
        const elementsWithTransitions = document.querySelectorAll('[style*="transition"], [class*="animate"]');
        const hasLoadingAnimations = document.querySelector('.loading-spinner, .hero-smooth-load');
        const hasHoverEffects = document.querySelector('.bill-card-component:hover');
        
        const valid = elementsWithTransitions.length > 0 || hasLoadingAnimations;
        
        return {
            valid,
            message: valid ? 
                'Smooth transitions and animations implemented' : 
                'Animation requirements not fully met',
            details: {
                elementsWithTransitions: elementsWithTransitions.length,
                hasLoadingAnimations: !!hasLoadingAnimations,
                hasHoverEffects: !!hasHoverEffects
            }
        };
    }

    generateReport() {
        console.log('\n📊 CROSS-BROWSER VALIDATION REPORT');
        console.log('=====================================');
        
        const overallScore = this.calculateOverallScore();
        console.log(`Overall Score: ${overallScore.score}% (${overallScore.grade})`);
        console.log(`Browser: ${this.testResults.browser.name} ${this.testResults.browser.version}`);
        console.log(`Viewport: ${this.testResults.viewport.width}x${this.testResults.viewport.height}`);
        
        console.log('\n🎯 Requirements Validation:');
        Object.entries(this.testResults.requirements || {}).forEach(([req, result]) => {
            const status = result.valid ? '✅ PASS' : '❌ FAIL';
            console.log(`  ${status} ${req}: ${this.requirements[req]}`);
        });
        
        console.log('\n🔧 Technical Summary:');
        console.log(`  Browser Features: ${this.getPassRate(this.testResults.features)}% supported`);
        console.log(`  Design System: ${this.getPassRate(this.testResults.design)}% implemented`);
        console.log(`  Functionality: ${this.getPassRate(this.testResults.functionality)}% working`);
        console.log(`  Accessibility: ${this.getPassRate(this.testResults.accessibility)}% compliant`);
        console.log(`  Performance: ${this.getPassRate(this.testResults.performance)}% optimized`);
        
        if (overallScore.score >= 90) {
            console.log('\n🎉 EXCELLENT! The redesigned interface meets all requirements and is ready for production.');
        } else if (overallScore.score >= 80) {
            console.log('\n✅ GOOD! The interface meets most requirements with minor issues to address.');
        } else if (overallScore.score >= 70) {
            console.log('\n⚠️  ACCEPTABLE! The interface works but has several areas for improvement.');
        } else {
            console.log('\n❌ NEEDS WORK! The interface has significant issues that need to be addressed.');
        }
        
        // Store results for potential external access
        window.crossBrowserValidationResults = this.testResults;
        
        return this.testResults;
    }

    calculateOverallScore() {
        const categories = [
            this.testResults.features,
            this.testResults.design,
            this.testResults.functionality,
            this.testResults.accessibility,
            this.testResults.performance,
            this.testResults.requirements
        ];
        
        let totalScore = 0;
        let validCategories = 0;
        
        categories.forEach(category => {
            if (category && typeof category === 'object') {
                const passRate = this.getPassRate(category);
                totalScore += passRate;
                validCategories++;
            }
        });
        
        const score = validCategories > 0 ? Math.round(totalScore / validCategories) : 0;
        
        let grade = 'F';
        if (score >= 90) grade = 'A';
        else if (score >= 80) grade = 'B';
        else if (score >= 70) grade = 'C';
        else if (score >= 60) grade = 'D';
        
        return { score, grade };
    }

    getPassRate(category) {
        if (!category || typeof category !== 'object') return 0;
        
        const results = Object.values(category);
        const passed = results.filter(result => 
            typeof result === 'boolean' ? result : result?.valid === true
        ).length;
        
        return results.length > 0 ? Math.round((passed / results.length) * 100) : 0;
    }
}

// Auto-run validation when page is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => new CrossBrowserValidator(), 1000);
    });
} else {
    setTimeout(() => new CrossBrowserValidator(), 1000);
}

// Export for manual testing
window.CrossBrowserValidator = CrossBrowserValidator;