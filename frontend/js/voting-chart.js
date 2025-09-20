/**
 * VotingChart - Creates pie charts for bill voting data
 * Shows Republican vs Democrat voting patterns with red/blue colors
 */
class VotingChart {
    constructor() {
        this.defaultColors = {
            republican: '#DC2626', // Red
            democrat: '#2563EB'     // Blue
        };
    }

    /**
     * Create a voting pie chart
     * @param {string} containerId - ID of the container element
     * @param {Object} votingData - Voting data object
     * @param {Object} options - Chart options
     */
    createChart(containerId, votingData, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container with ID '${containerId}' not found`);
            return;
        }

        // Validate voting data
        if (!this.validateVotingData(votingData)) {
            container.innerHTML = '<p class="text-gray-500 text-sm">Voting data not available</p>';
            return;
        }

        // Calculate totals
        const republicanTotal = (votingData.republicanYes || 0) + (votingData.republicanNo || 0);
        const democratTotal = (votingData.democratYes || 0) + (votingData.democratNo || 0);
        const totalVotes = republicanTotal + democratTotal;

        if (totalVotes === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm">No voting data available</p>';
            return;
        }

        // Calculate percentages
        const republicanPercent = (republicanTotal / totalVotes) * 100;
        const democratPercent = (democratTotal / totalVotes) * 100;

        // Create SVG pie chart
        const size = options.size || 120;
        const strokeWidth = options.strokeWidth || 8;
        const radius = (size - strokeWidth) / 2;
        const circumference = 2 * Math.PI * radius;
        
        // Calculate stroke dash arrays for pie segments
        const republicanDash = (republicanPercent / 100) * circumference;
        const democratDash = (democratPercent / 100) * circumference;
        
        // Create the chart HTML
        container.innerHTML = `
            <div class="voting-chart flex flex-col items-center">
                <div class="relative">
                    <svg width="${size}" height="${size}" class="transform -rotate-90">
                        <!-- Background circle -->
                        <circle
                            cx="${size / 2}"
                            cy="${size / 2}"
                            r="${radius}"
                            fill="none"
                            stroke="#E5E7EB"
                            stroke-width="${strokeWidth}"
                        />
                        
                        <!-- Republican segment -->
                        <circle
                            cx="${size / 2}"
                            cy="${size / 2}"
                            r="${radius}"
                            fill="none"
                            stroke="${this.defaultColors.republican}"
                            stroke-width="${strokeWidth}"
                            stroke-dasharray="${republicanDash} ${circumference}"
                            stroke-dashoffset="0"
                            stroke-linecap="round"
                        />
                        
                        <!-- Democrat segment -->
                        <circle
                            cx="${size / 2}"
                            cy="${size / 2}"
                            r="${radius}"
                            fill="none"
                            stroke="${this.defaultColors.democrat}"
                            stroke-width="${strokeWidth}"
                            stroke-dasharray="${democratDash} ${circumference}"
                            stroke-dashoffset="-${republicanDash}"
                            stroke-linecap="round"
                        />
                    </svg>
                    
                    <!-- Center text -->
                    <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <div class="text-lg font-bold text-gray-900">${totalVotes}</div>
                        <div class="text-xs text-gray-500">votes</div>
                    </div>
                </div>
                
                <!-- Legend -->
                <div class="mt-3 space-y-1 text-sm">
                    <div class="flex items-center justify-between min-w-[120px]">
                        <div class="flex items-center">
                            <div class="w-3 h-3 rounded-full mr-2" style="background-color: ${this.defaultColors.republican}"></div>
                            <span class="text-gray-700">Republican</span>
                        </div>
                        <span class="font-medium text-gray-900">${republicanTotal}</span>
                    </div>
                    <div class="flex items-center justify-between min-w-[120px]">
                        <div class="flex items-center">
                            <div class="w-3 h-3 rounded-full mr-2" style="background-color: ${this.defaultColors.democrat}"></div>
                            <span class="text-gray-700">Democrat</span>
                        </div>
                        <span class="font-medium text-gray-900">${democratTotal}</span>
                    </div>
                </div>
                
                ${options.showDetails ? this.createDetailedBreakdown(votingData) : ''}
                
                ${votingData.voteDate ? `
                    <div class="mt-2 text-xs text-gray-500">
                        Vote: ${new Date(votingData.voteDate).toLocaleDateString()}
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Create detailed voting breakdown
     * @param {Object} votingData - Voting data
     * @returns {string} HTML for detailed breakdown
     */
    createDetailedBreakdown(votingData) {
        return `
            <div class="mt-3 pt-3 border-t border-gray-200 w-full">
                <div class="text-xs text-gray-600 mb-2">Detailed Breakdown:</div>
                <div class="grid grid-cols-2 gap-2 text-xs">
                    <div class="space-y-1">
                        <div class="flex justify-between">
                            <span class="text-red-600">R Yes:</span>
                            <span class="font-medium">${votingData.republicanYes || 0}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-red-600">R No:</span>
                            <span class="font-medium">${votingData.republicanNo || 0}</span>
                        </div>
                    </div>
                    <div class="space-y-1">
                        <div class="flex justify-between">
                            <span class="text-blue-600">D Yes:</span>
                            <span class="font-medium">${votingData.democratYes || 0}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-blue-600">D No:</span>
                            <span class="font-medium">${votingData.democratNo || 0}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Validate voting data structure
     * @param {Object} votingData - Voting data to validate
     * @returns {boolean} True if valid
     */
    validateVotingData(votingData) {
        if (!votingData || typeof votingData !== 'object') {
            return false;
        }

        // Check if at least one vote count exists and is a number
        const voteFields = ['republicanYes', 'republicanNo', 'democratYes', 'democratNo'];
        return voteFields.some(field => 
            votingData.hasOwnProperty(field) && 
            typeof votingData[field] === 'number' && 
            votingData[field] >= 0
        );
    }

    /**
     * Create a mini chart for bill cards
     * @param {string} containerId - Container ID
     * @param {Object} votingData - Voting data
     */
    createMiniChart(containerId, votingData) {
        this.createChart(containerId, votingData, {
            size: 60,
            strokeWidth: 6,
            showDetails: false
        });
    }

    /**
     * Create a full chart for bill detail pages
     * @param {string} containerId - Container ID
     * @param {Object} votingData - Voting data
     */
    createDetailChart(containerId, votingData) {
        this.createChart(containerId, votingData, {
            size: 150,
            strokeWidth: 12,
            showDetails: true
        });
    }
}

// Create global instance
window.votingChart = new VotingChart();