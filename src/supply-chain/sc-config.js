(function(){
    window.SCConfig = {
        score: {
            colors: {
                strongLong:   '#10b981', // top-right: power + tailwind
                emerging:     '#84cc16', // top-left: weak + tailwind
                tollBooth:    '#f59e0b', // bottom-right: power + headwind
                avoid:        '#ef4444'  // bottom-left: weak + headwind
            },
            trajectoryColors: {
                strongTailwind: '#10b981',
                mildTailwind:   '#84cc16',
                neutral:        '#94a3b8',
                mildHeadwind:   '#f97316',
                strongHeadwind: '#ef4444'
            }
        },
        graph: {
            nodeMinPx: 22,
            nodeMaxPx: 58,
            revenueMin: 500000000,
            revenueMax: 400000000000
        },
        map: {
            defaultCenter: [25, 20],
            defaultZoom: 2
        },
        scoring: {
            baselineCagr: 3.0,
            maxPolicyNet: 15.0
        }
    };
})();
