(function(){
    var _container = null;
    var _state = null;

    var DEFAULT_STATE = {
        sectors: [],
        entityTypes: [],
        countries: [],
        trajectoryMin: -100,
        trajectoryMax: 100,
        structuralMin: 0,
        structuralMax: 100,
        search: '',
        policyDirections: []
    };

    function cloneState(s) { return JSON.parse(JSON.stringify(s)); }

    function emit(partial) {
        Object.assign(_state, partial);
        window.dispatchEvent(new CustomEvent('sc:filter-change', { detail: cloneState(_state) }));
    }

    function buildSectorOptions(entities) {
        var seen = {};
        entities.forEach(function(e){ if (e.industry_sector) seen[e.industry_sector] = true; });
        return Object.keys(seen).sort();
    }

    function buildCountryOptions(entities) {
        var seen = {};
        entities.forEach(function(e){ if (e.country_code) seen[e.country_code] = true; });
        return Object.keys(seen).sort();
    }

    function makeLabelMap(codes) {
        var map = {
            'US':'United States','NL':'Netherlands','JP':'Japan','TW':'Taiwan',
            'KR':'South Korea','CN':'China','DE':'Germany','FR':'France',
            'IE':'Ireland','GB':'United Kingdom','SG':'Singapore','IN':'India'
        };
        return codes.map(function(c){ return { code: c, label: map[c] || c }; });
    }

    function makeSectorLabel(s) {
        return s.replace(/_/g,' ').replace(/\b\w/g, function(c){ return c.toUpperCase(); });
    }

    function buildCheckboxGroup(items, stateKey, labelFn, idPrefix) {
        var html = '<div class="sc-filter-chips">';
        items.forEach(function(item) {
            var val  = typeof item === 'object' ? item.code : item;
            var lbl  = typeof item === 'object' ? item.label : (labelFn ? labelFn(item) : item);
            var id   = idPrefix + '_' + val;
            html += '<label class="sc-chip" for="' + escapeHtml(id) + '">'
                + '<input type="checkbox" id="' + escapeHtml(id) + '" value="' + escapeHtml(val) + '" data-key="' + escapeHtml(stateKey) + '">'
                + escapeHtml(lbl) + '</label>';
        });
        html += '</div>';
        return html;
    }

    function build(container, entities) {
        _container = container;
        _state = cloneState(DEFAULT_STATE);

        var sectors   = buildSectorOptions(entities);
        var countries = makeLabelMap(buildCountryOptions(entities));
        var types     = ['manufacturer','distributor','company','port','warehouse','raw_material_source'];

        container.innerHTML = ''
            + '<div class="sc-filter-header">'
            + '<span>Filters</span>'
            + '<button class="sc-filter-reset" id="scFilterReset">Reset</button>'
            + '</div>'
            + '<div class="sc-filter-search">'
            + '<input type="text" id="scSearchInput" placeholder="Search entities..." class="sc-search-input">'
            + '</div>'
            + '<details class="sc-filter-group" open>'
            + '<summary>Industry Sector</summary>'
            + buildCheckboxGroup(sectors, 'sectors', makeSectorLabel, 'sector')
            + '</details>'
            + '<details class="sc-filter-group" open>'
            + '<summary>Trajectory</summary>'
            + '<div class="sc-range-group">'
            + '<div class="sc-range-labels"><span id="scTrajMinLbl">-100</span><span id="scTrajMaxLbl">+100</span></div>'
            + '<input type="range" id="scTrajMin" min="-100" max="100" value="-100" class="sc-range">'
            + '<input type="range" id="scTrajMax" min="-100" max="100" value="100" class="sc-range sc-range-upper">'
            + '</div>'
            + '</details>'
            + '<details class="sc-filter-group">'
            + '<summary>Structural Power</summary>'
            + '<div class="sc-range-group">'
            + '<div class="sc-range-labels"><span id="scStrMinLbl">0</span><span id="scStrMaxLbl">100</span></div>'
            + '<input type="range" id="scStrMin" min="0" max="100" value="0" class="sc-range">'
            + '<input type="range" id="scStrMax" min="0" max="100" value="100" class="sc-range sc-range-upper">'
            + '</div>'
            + '</details>'
            + '<details class="sc-filter-group">'
            + '<summary>Policy Direction</summary>'
            + buildCheckboxGroup(['tailwind','headwind','neutral'], 'policyDirections', makeSectorLabel, 'pdir')
            + '</details>'
            + '<details class="sc-filter-group">'
            + '<summary>Country</summary>'
            + buildCheckboxGroup(countries, 'countries', null, 'country')
            + '</details>'
            + '<details class="sc-filter-group">'
            + '<summary>Entity Type</summary>'
            + buildCheckboxGroup(types, 'entityTypes', makeSectorLabel, 'etype')
            + '</details>';

        wireEvents(container);
    }

    function wireEvents(container) {
        var searchInput = container.querySelector('#scSearchInput');
        if (searchInput) {
            var searchTimer;
            searchInput.addEventListener('input', function() {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(function(){ emit({ search: searchInput.value.trim().toLowerCase() }); }, 250);
            });
        }

        container.addEventListener('change', function(e) {
            if (e.target.type !== 'checkbox') return;
            var key = e.target.dataset.key;
            if (!key) return;
            var checked = Array.from(container.querySelectorAll('input[data-key="' + key + '"]:checked'))
                .map(function(el){ return el.value; });
            var update = {};
            update[key] = checked;
            emit(update);
        });

        function wireRange(minId, maxId, minLblId, maxLblId, stateMinKey, stateMaxKey) {
            var minEl = container.querySelector('#' + minId);
            var maxEl = container.querySelector('#' + maxId);
            var minLbl = container.querySelector('#' + minLblId);
            var maxLbl = container.querySelector('#' + maxLblId);
            if (!minEl || !maxEl) return;
            function update() {
                var lo = parseInt(minEl.value), hi = parseInt(maxEl.value);
                if (lo > hi) { var t = lo; lo = hi; hi = t; }
                if (minLbl) minLbl.textContent = (lo >= 0 ? '+' : '') + lo;
                if (maxLbl) maxLbl.textContent = (hi >= 0 ? '+' : '') + hi;
                var upd = {};
                upd[stateMinKey] = lo; upd[stateMaxKey] = hi;
                emit(upd);
            }
            minEl.addEventListener('input', update);
            maxEl.addEventListener('input', update);
        }
        wireRange('scTrajMin','scTrajMax','scTrajMinLbl','scTrajMaxLbl','trajectoryMin','trajectoryMax');
        wireRange('scStrMin','scStrMax','scStrMinLbl','scStrMaxLbl','structuralMin','structuralMax');

        var resetBtn = container.querySelector('#scFilterReset');
        if (resetBtn) {
            resetBtn.addEventListener('click', function() {
                _state = cloneState(DEFAULT_STATE);
                build(_container, window._scEntitiesCache || []);
                window.dispatchEvent(new CustomEvent('sc:filter-change', { detail: cloneState(_state) }));
            });
        }
    }

    function getState() { return _state ? cloneState(_state) : cloneState(DEFAULT_STATE); }

    window.SCFilterPanel = { build: build, getState: getState };
})();
