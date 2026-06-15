(function(){
    window.SCConfig = {
        score: {
            colors: {
                strongLong:   '#10b981',
                emerging:     '#84cc16',
                tollBooth:    '#f59e0b',
                avoid:        '#ef4444'
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
