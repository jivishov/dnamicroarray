document.addEventListener('DOMContentLoaded', () => {
    // --- SVG Namespace ---
    const svgNS = "http://www.w3.org/2000/svg";

    // --- DOM Elements ---
    const instructionText = document.getElementById('instruction-text');
    const startButton = document.getElementById('start-button');
    const skipButton = document.getElementById('skip-button'); // Keep reference even if commented out in HTML
    const checklistItems = {
        orient: document.getElementById('step-orient'),
        eb: document.getElementById('step-eb'),
        dry1: document.getElementById('step-dry1'),
        mixSpot: document.getElementById('step-mix-spot'),
        dry2: document.getElementById('step-dry2'),
        hb: document.getElementById('step-hb'),
        dry3: document.getElementById('step-dry3'),
        visualize: document.getElementById('step-visualize'),
        analyze: document.getElementById('step-analyze')
    };

    // Tool SVGs
    const pipetteSvg = document.getElementById('pipette-svg');
    const pipetteTipMount = document.getElementById('pipette-tip-mount');
    const tipBoxSvg = document.getElementById('tip-box-svg');
    const wasteBinSvg = document.getElementById('waste-bin-svg');
    const incubatorSvg = document.getElementById('incubator-svg');
    const uvLightSvg = document.getElementById('uv-light-svg');

    // Reagent SVGs
    const ebTube = document.getElementById('eb-tube-svg');
    const cdnaTube = document.getElementById('cdna-tube-svg');
    const hbTube = document.getElementById('hb-tube-svg');

    // Lab Areas
    const microarrayCardDiv = document.getElementById('microarray-card');
    const quickstripPlateDiv = document.getElementById('quickstrip-plate');

    // Analysis
    const analysisSection = document.getElementById('analysis-section');
    const resultsTableBody = document.querySelector('#results-table tbody');
    const checkResultsButton = document.getElementById('check-results-button');
    const eraseTableButton = document.getElementById('erase-table-button');
    const resultsFeedback = document.getElementById('results-feedback');

    // --- State Variables ---
    let currentStep = 'initial';
    let pipetteState = {
        hasTip: false,
        loaded: null, // 'EB', 'cDNA', 'HB', 'MIX', or null
        tipSvgElement: null, // Reference to the appended tip SVG element
        liquidSvgElement: null // Reference to the appended liquid SVG element
    };
    let incubatorBusy = false;
    let uvLightOn = false;
    let spotsState = {};
    let wellsState = {};
    let requiredClicks = 0;
    let mixSpotCounter = 0;
    const totalSamples = 36;
    const liquidColors = { 'EB': 'skyblue', 'cDNA': 'lightgreen', 'HB': 'violet', 'MIX': 'orange' };
    const expectedSpotColors = { 'E': ['yellow', 'red', 'green', 'black', 'red', 'yellow', 'green', 'black', 'red'], 'F': ['yellow', 'red', 'green', 'black', 'red', 'yellow', 'green', 'black', 'red'], 'G': ['yellow', 'red', 'green', 'black', 'red', 'yellow', 'green', 'black', 'yellow'], 'H': ['yellow', 'red', 'green', 'black', 'red', 'yellow', 'yellow', 'black', 'red'] };


    // *** DEFINE ALL FUNCTIONS FIRST ***

    // --- Initialization Function ---
    function init() {
        console.log("Initializing simulation..."); // DEBUG
        try {
            // Ensure critical elements are checked before proceeding
            const criticalElements = { instructionText, startButton, /*skipButton,*/ pipetteSvg, pipetteTipMount, tipBoxSvg, wasteBinSvg, incubatorSvg, uvLightSvg, ebTube, cdnaTube, hbTube, microarrayCardDiv, quickstripPlateDiv, analysisSection, resultsTableBody, checkResultsButton, eraseTableButton, resultsFeedback };
            for (const [name, element] of Object.entries(criticalElements)) {
                if (!element && name !== 'skipButton') { // Allow skip button to be optional
                    throw new Error(`Initialization Error: Could not find element "${name}". Check HTML ID.`);
                }
            }
            // Populate checklistItems after main elements are verified
            Object.keys(checklistItems).forEach(key => {
                checklistItems[key] = document.getElementById(`step-${key}`);
                if (!checklistItems[key]) console.warn(`Checklist item 'step-${key}' not found.`);
            });

            createGrid('spot', microarrayCardDiv, 4, 9, ['E', 'F', 'G', 'H']);
            createGrid('well', quickstripPlateDiv, 4, 9, ['E', 'F', 'G', 'H']);
            setupEventListeners(); // Setup listeners AFTER grids are created and functions are defined
            updateInstruction('Welcome! Click "Start Experiment" to begin.');
            disableAllControls();
            if(startButton) startButton.disabled = false;
            console.log("Initialization complete."); // DEBUG
        } catch (error) {
            console.error("Error during init:", error);
            alert(`An error occurred during initialization: ${error.message}. Check the console.`);
        }
    }

     // --- Grid Creation ---
     function createGrid(type, container, rows, cols, rowLabels) {
        if (!container) {
            console.error(`Cannot create grid: container for ${type} not found.`);
            return;
        }
        container.innerHTML = '';
        const stateObject = (type === 'spot') ? spotsState : wellsState;
        const expectedKeys = ['E', 'F', 'G', 'H']; // Check if expectedSpotColors has these keys

        for (let r = 0; r < rows; r++) {
            const rowLabel = rowLabels[r];
            if (type === 'spot' && !expectedSpotColors[rowLabel]) {
                 console.error(`Missing expected color data for row: ${rowLabel}`);
                 continue; // Skip row if data missing
            }
            for (let c = 0; c < cols; c++) {
                const id = `${rowLabel}${c + 1}`;
                const div = document.createElement('div');
                div.id = `${type}-${id}`; div.classList.add(type);
                div.dataset.row = rowLabel; div.dataset.col = c + 1;
                div.textContent = id;
                try { // Add try-catch for safety
                    if (type === 'well') {
                        div.classList.add('foil');
                        stateObject[id] = { id: id, foil: true, cdna_added: false, mixed: false, mix_clicks: 0 };
                    } else { // spot
                        if (!expectedSpotColors[rowLabel] || c >= expectedSpotColors[rowLabel].length) { // Check column index too
                             console.error(`Missing expected color data for spot: ${id}`);
                             continue; // Skip spot if data missing
                        }
                        const color = expectedSpotColors[rowLabel][c];
                        stateObject[id] = { id: id, eb_applied: false, sample_applied: false, hb_applied: false, final_color: color, needs_processing: true, current_visual: 'initial' };
                        div.classList.add('initial'); div.classList.add('uv-off');
                    }
                    container.appendChild(div);
                } catch (e) {
                    console.error(`Error creating element ${type}-${id}:`, e);
                }
            }
        }
    }

     // --- Event Listener Setup ---
     function setupEventListeners() {
         console.log("Setting up event listeners..."); // DEBUG
        if (startButton) startButton.addEventListener('click', startExperiment); else console.error("Start button not found for listener.");
        if (skipButton) skipButton.addEventListener('click', skipToAnalysis); // Keep listener if button exists

        // Attach listeners to SVGs, checking existence
        if (tipBoxSvg) tipBoxSvg.addEventListener('click', handleTipBoxClick); else console.error("tipBoxSvg not found for listener.");
        if (wasteBinSvg) wasteBinSvg.addEventListener('click', handleWasteBinClick); else console.error("wasteBinSvg not found for listener.");
        if (incubatorSvg) incubatorSvg.addEventListener('click', handleIncubatorClick); else console.error("incubatorSvg not found for listener.");
        if (uvLightSvg) uvLightSvg.addEventListener('click', handleUvLightToggle); else console.error("uvLightSvg not found for listener.");
        if (ebTube) ebTube.addEventListener('click', () => handleReagentClick('EB')); else console.error("ebTube not found for listener.");
        if (cdnaTube) cdnaTube.addEventListener('click', () => handleReagentClick('cDNA')); else console.error("cdnaTube not found for listener.");
        if (hbTube) hbTube.addEventListener('click', () => handleReagentClick('HB')); else console.error("hbTube not found for listener.");

        // Other listeners, checking existence
        if (microarrayCardDiv) microarrayCardDiv.addEventListener('click', (e) => { if (e.target.classList.contains('spot')) handleSpotClick(e.target.id); }); else console.error("microarrayCardDiv not found for listener.");
        if (quickstripPlateDiv) quickstripPlateDiv.addEventListener('click', (e) => { if (e.target.classList.contains('well')) handleWellClick(e.target.id); }); else console.error("quickstripPlateDiv not found for listener.");
        if (checkResultsButton) checkResultsButton.addEventListener('click', checkAnalysisResults); else console.error("checkResultsButton not found for listener.");
        if (eraseTableButton) eraseTableButton.addEventListener('click', eraseAnalysisTable); else console.error("eraseTableButton not found for listener.");
         console.log("Event listeners setup complete."); // DEBUG
    }

     // --- Game Flow & Step Logic ---
     function startExperiment() {
        if(startButton) startButton.style.display = 'none';
        if(skipButton) skipButton.style.display = 'none'; // Also hide skip button
        // Don't set currentStep here, let advanceStep do it
        updateChecklist('orient'); // Mark orientation done visually
        advanceStep('get-tip-eb'); // Advance to the *first* interactive step
    }

     function advanceStep(nextStep) {
         currentStep = nextStep;
         // console.log("Advanced to step:", currentStep); // DEBUG
         updateUIForStep();
     }

     function updateUIForStep() {
        // 1. Disable everything first
        disableAllControls();
        let instruction = ''; // Initialize instruction text

    // 2. *** MODIFIED: Enable discard CONDITIONALLY ***
    // Enable discard ONLY if a tip is present AND we are NOT in a multi-step application phase
    let allowDiscard = pipetteState.hasTip &&
                       currentStep !== 'apply-eb' &&
                       currentStep !== 'apply-hb' &&
                       currentStep !== 'spot-sample' &&
                       currentStep !== 'dispense-cdna' && // Disable while waiting to dispense
                       currentStep !== 'mix-well'; // Disable during mixing

    if (allowDiscard) {
        enableSvgControls(['waste-bin-svg']);
    }
    // *** END MODIFICATION ***

        // 3. Determine instruction and enable specific controls based on CURRENT step
        switch (currentStep) {
            case 'get-tip-eb':
                instruction = 'Get a fresh pipette tip by clicking the Tip Box icon.';
                enableSvgControls(['tip-box-svg']); // Enable ONLY the tip box
                break;
            case 'load-eb':
                instruction = 'Load Equilibration Buffer (EB) by clicking the blue EB tube.';
                enableSvgControls(['eb-tube-svg']); // Enable ONLY EB tube
            // Allow discard here if user loaded wrong reagent? Maybe not, keep it disabled until dispense/application.
            // Re-enable discard check from step 2:
            if (pipetteState.hasTip) enableSvgControls(['waste-bin-svg']);
            break;
            case 'apply-eb':
                instruction = `Apply 5µL EB to ${requiredClicks} remaining spots. Click each required spot.`;
                setSpotsClickable(true, 'eb'); // Enable spots
                break;
            case 'dry-eb':
                instruction = 'Incubate the card to dry the EB. Click the Incubator icon.';
                enableSvgControls(['incubator-svg']);
                // Allow discard here (pipette should be empty)
                 if (pipetteState.hasTip) enableSvgControls(['waste-bin-svg']);
                break;
            case 'get-tip-mix':
                instruction = `Prepare sample ${getWellIdFromCounter(mixSpotCounter)}. Click the Tip Box icon.`;
                enableSvgControls(['tip-box-svg']);
                break;
            case 'load-cdna':
                instruction = `Add 5µL Control cDNA to Well ${getWellIdFromCounter(mixSpotCounter)}. Click the green cDNA tube.`;
                enableSvgControls(['cdna-tube-svg']);
                            // Allow discard here
                if (pipetteState.hasTip) enableSvgControls(['waste-bin-svg']);
                break;
            case 'dispense-cdna':
                instruction = `Dispense Control cDNA into Well ${getWellIdFromCounter(mixSpotCounter)}. Click the correct well.`;
                setWellsClickable(true, 'dispense-cdna', getWellIdFromCounter(mixSpotCounter));
                break;
            case 'mix-well':
                const wellIdMix = getWellIdFromCounter(mixSpotCounter);
                instruction = `Mix sample in Well ${wellIdMix}. Click well 3 times (${wellsState[wellIdMix]?.mix_clicks || 0}/3).`;
                setWellsClickable(true, 'mix-well', wellIdMix);
                break;
            case 'spot-sample':
                instruction = `Apply 5µL mixed sample to Spot ${getSpotIdFromCounter(mixSpotCounter)}. Click the correct spot.`;
                setSpotsClickable(true, 'spot-sample', getSpotIdFromCounter(mixSpotCounter));
                break;
            case 'dry-sample':
                instruction = 'All samples spotted. Incubate the card. Click the Incubator icon.';
                enableSvgControls(['incubator-svg']);
                             // Allow discard here
                if (pipetteState.hasTip) enableSvgControls(['waste-bin-svg']);
                break;
            case 'get-tip-hb':
                instruction = 'Prepare to apply Hybridization Buffer (HB). Click the Tip Box icon.';
                enableSvgControls(['tip-box-svg']);
                break;
            case 'load-hb':
                instruction = 'Load Hybridization Buffer (HB). Click the violet HB tube.';
                enableSvgControls(['hb-tube-svg']);
                             // Allow discard here
                if (pipetteState.hasTip) enableSvgControls(['waste-bin-svg']);
                break;
            case 'apply-hb':
                instruction = `Apply 5µL HB to ${requiredClicks} remaining spots. Click each required spot.`;
                setSpotsClickable(true, 'hb');
                break;
            case 'dry-hb':
                instruction = 'Incubate the card a final time. Click the Incubator icon.';
                enableSvgControls(['incubator-svg']);
             // Allow discard here
                if (pipetteState.hasTip) enableSvgControls(['waste-bin-svg']);                
                break;
            case 'visualize':
                instruction = 'Experiment complete! Click the UV Light icon to view results. Then proceed to Analysis.';
                enableSvgControls(['uv-light-svg']);
                showAnalysisSection(); // Ensure analysis section is ready even if light isn't toggled yet
             // Allow discard here (pipette should be empty)
                if (pipetteState.hasTip) enableSvgControls(['waste-bin-svg']);                
                break;
             case 'analyze':
                 instruction = 'Analyze results. Fill table based on colors. Click "Check My Results".';
                 enableSvgControls(['uv-light-svg']);
                 enableControls(['check-results-button', 'erase-table-button']); // Enable regular buttons
                               // Allow discard here
                if (pipetteState.hasTip) enableSvgControls(['waste-bin-svg']);
                 break;
            case 'done':
                instruction = 'Analysis complete! Simulation finished.';
                enableSvgControls(['uv-light-svg']);
                enableControls(['erase-table-button']);
                             // Allow discard here
             if (pipetteState.hasTip) enableSvgControls(['waste-bin-svg']);
                break;
            default:
                instruction = `Error: Unknown step '${currentStep}'`;
                console.error(`Unknown step in updateUIForStep: ${currentStep}`);
        }

        // 4. Update the instruction text display *after* determining it
        updateInstruction(instruction);
    }


     // --- Event Handlers ---
     function handleTipBoxClick() {
        if (pipetteState.hasTip) {
            updateInstruction('You already have a tip. Discard it first.');
            return;
        }
        pipetteState.hasTip = true;
        pipetteState.loaded = null;
        updatePipetteVisual(); // Update SVG visual

        // Determine next step
        if (currentStep === 'get-tip-eb') advanceStep('load-eb');
        else if (currentStep === 'get-tip-mix') advanceStep('load-cdna');
        else if (currentStep === 'get-tip-hb') advanceStep('load-hb');
        else updateUIForStep();
    }

     function handleWasteBinClick() {
        if (!pipetteState.hasTip) return;
        pipetteState.hasTip = false;
        pipetteState.loaded = null;
        updatePipetteVisual(); // Update SVG visual
        updateUIForStep();
    }

     function handleReagentClick(reagent) {
         if (!pipetteState.hasTip) { updateInstruction('Need tip!'); return; }
         if (pipetteState.loaded) { updateInstruction('Pipette loaded, discard tip.'); return; }
         let expectedReagent = null;
         if (currentStep === 'load-eb') expectedReagent = 'EB';
         else if (currentStep === 'load-cdna') expectedReagent = 'cDNA';
         else if (currentStep === 'load-hb') expectedReagent = 'HB';
         if (!expectedReagent || reagent !== expectedReagent) { updateInstruction(`Incorrect reagent/time.`); return; }
         pipetteState.loaded = reagent;
         updatePipetteVisual(); // Update SVG visual
         let nextStep = null;
         if (reagent === 'EB') { requiredClicks = totalSamples; nextStep = 'apply-eb'; }
         else if (reagent === 'cDNA') { nextStep = 'dispense-cdna'; }
         else if (reagent === 'HB') { requiredClicks = totalSamples; nextStep = 'apply-hb'; }
         if (nextStep) advanceStep(nextStep);
         else console.error("Reagent click error:", reagent);
    }

     function handleWellClick(wellElementId) { // Calls updatePipetteVisual
         const wellId = wellElementId.split('-')[1];
         const well = document.getElementById(wellElementId);
         const state = wellsState[wellId];
         if (!well || !state) return;
         if (currentStep === 'dispense-cdna') {
              if (pipetteState.loaded !== 'cDNA') { updateInstruction("Pipette not loaded."); return; }
             const expectedWellId = getWellIdFromCounter(mixSpotCounter);
             if (wellId !== expectedWellId) { updateInstruction(`Wrong well! Target ${expectedWellId}.`); return; }
             if (state.foil) { well.classList.remove('foil'); well.classList.add('punched'); state.foil = false; }
             if (!state.cdna_added) {
                well.classList.add('cdna-added'); state.cdna_added = true;
                pipetteState.loaded = null; updatePipetteVisual(); // Update SVG
                advanceStep('mix-well');
             }
         }
         else if (currentStep === 'mix-well') {
              const expectedWellId = getWellIdFromCounter(mixSpotCounter);
               if (wellId !== expectedWellId) { updateInstruction(`Wrong well! Target ${expectedWellId}.`); return; }
               if (!state.cdna_added) { updateInstruction(`Add cDNA first.`); return; }
               if (!state.mixed) {
                   state.mix_clicks++;
                   well.classList.add('mixed'); setTimeout(() => well.classList.remove('mixed'), 500);
                   if (state.mix_clicks >= 3) {
                       state.mixed = true;
                       pipetteState.loaded = 'MIX'; updatePipetteVisual(); // Update SVG
                       advanceStep('spot-sample');
                   } else { updateInstruction(`Mix Well ${wellId} ${3-state.mix_clicks} more time(s).`); }
               }
         }
     }

     function handleSpotClick(spotElementId) { // Calls updatePipetteVisual
        const spotId = spotElementId.split('-')[1];
        const spot = document.getElementById(spotElementId);
        const state = spotsState[spotId];
        if (!spot || !state) return;
        let needsProcessingNow = false, expectedReagent = null, targetStep = null;
        let nextStepAfterAll = null, stateFlag = '', visualClass = '';
        if (currentStep === 'apply-eb') { expectedReagent='EB'; targetStep='apply-eb'; nextStepAfterAll='dry-eb'; stateFlag='eb_applied'; visualClass='eb-applied'; needsProcessingNow = !state.eb_applied; }
        else if (currentStep === 'spot-sample') { expectedReagent='MIX'; targetStep='spot-sample'; stateFlag='sample_applied'; visualClass='sample-applied-temp'; const expectedSpotId = getSpotIdFromCounter(mixSpotCounter); if (spotId !== expectedSpotId) { updateInstruction(`Wrong spot! Target ${expectedSpotId}.`); return; } needsProcessingNow = !state.sample_applied; }
        else if (currentStep === 'apply-hb') { expectedReagent='HB'; targetStep='apply-hb'; nextStepAfterAll='dry-hb'; stateFlag='hb_applied'; visualClass='hb-applied'; needsProcessingNow = state.sample_applied && !state.hb_applied; }
        else { return; }
        if (!needsProcessingNow) return;
        if (pipetteState.loaded !== expectedReagent) { updateInstruction(`Incorrect solution.`); return; }
        state[stateFlag] = true;
        spot.classList.remove('initial', 'eb-applied', 'sample-applied-temp', 'hb-applied', 'uv-off', 'dry');
        spot.classList.add(visualClass); state.current_visual = visualClass;
        if (targetStep === 'spot-sample') {
            pipetteState.loaded = null; updatePipetteVisual(); // Update SVG
            mixSpotCounter++;
            if (mixSpotCounter >= totalSamples) { updateChecklist('mixSpot'); advanceStep('dry-sample'); }
            else { advanceStep('get-tip-mix'); }
        } else {
            requiredClicks--; updateInstruction(`Apply ${expectedReagent} to ${requiredClicks} spots.`);
            if (requiredClicks <= 0) {
                pipetteState.loaded = null; updatePipetteVisual(); // Update SVG
                if (targetStep === 'apply-eb') updateChecklist('eb'); if (targetStep === 'apply-hb') updateChecklist('hb');
                advanceStep(nextStepAfterAll); setSpotsClickable(false);
            } else { setSpotsClickable(true, targetStep); }
        }
    }

     function handleIncubatorClick() {
         if (incubatorBusy) return;
         if (currentStep !== 'dry-eb' && currentStep !== 'dry-sample' && currentStep !== 'dry-hb') { updateInstruction("Nothing to incubate."); return; }
         incubatorBusy = true; updateInstruction('Incubating...'); disableAllControls();
         const incubationTime = 1500; const progressBar = document.createElement('div'); progressBar.style.cssText = `width:0%;height:5px;background-color:lightblue;transition:width ${incubationTime/1000}s linear;`; instructionText.appendChild(progressBar); setTimeout(() => progressBar.style.width = '100%', 50);
         setTimeout(() => {
             incubatorBusy = false; if(instructionText.contains(progressBar)) instructionText.removeChild(progressBar);
             Object.values(spotsState).forEach(s => { if(s.eb_applied || s.sample_applied || s.hb_applied) { const el = document.getElementById(`spot-${s.id}`); if(el) el.classList.add('dry'); }});
             if (currentStep === 'dry-eb') { updateChecklist('dry1'); mixSpotCounter = 0; advanceStep('get-tip-mix'); }
             else if (currentStep === 'dry-sample') { updateChecklist('dry2'); advanceStep('get-tip-hb'); }
             else if (currentStep === 'dry-hb') { updateChecklist('dry3'); advanceStep('visualize'); }
             else { console.error("Incubation finish error:", currentStep); updateUIForStep(); }
         }, incubationTime);
    }

     function handleUvLightToggle() {
         if (currentStep !== 'visualize' && currentStep !== 'analyze' && currentStep !== 'done') { updateInstruction('Cannot use UV yet.'); return; } if (incubatorBusy) return;
         uvLightOn = !uvLightOn;
         uvLightSvg.style.filter = uvLightOn ? 'drop-shadow(0 0 5px #DA70D6)' : ''; // Add/remove glow

         for (const spotId in spotsState) {
             const spotElement = document.getElementById(`spot-${spotId}`); const state = spotsState[spotId];
             if (spotElement) {
                 spotElement.classList.remove('initial','eb-applied','sample-applied-temp','hb-applied','dry','uv-off','red','green','yellow','black');
                 if (state.sample_applied) { spotElement.classList.add(uvLightOn ? state.final_color : 'uv-off'); spotElement.textContent = spotId; }
                 else { spotElement.classList.add(uvLightOn ? 'initial' : 'uv-off'); spotElement.textContent = spotId; }
             }
         }
         if (currentStep === 'visualize' && uvLightOn) { updateChecklist('visualize'); advanceStep('analyze'); }
    }

     // --- Skip Function ---
     function skipToAnalysis() {
        console.log("--- Skipping to Analysis ---");
        uvLightOn = false; pipetteState = { hasTip: false, loaded: null, tipSvgElement: null, liquidSvgElement: null };
        updatePipetteVisual(); // Clear pipette visual
        for (const spotId in spotsState) {
            spotsState[spotId].sample_applied=true; spotsState[spotId].eb_applied=true; spotsState[spotId].hb_applied=true;
            const spotElement = document.getElementById(`spot-${spotId}`);
            if(spotElement) { spotElement.classList.remove('initial','eb-applied','sample-applied-temp','hb-applied','dry','red','green','yellow','black'); spotElement.classList.add('uv-off'); spotElement.textContent = spotId; }
        }
        updateChecklist('orient'); updateChecklist('eb'); updateChecklist('dry1'); updateChecklist('mixSpot'); updateChecklist('dry2'); updateChecklist('hb'); updateChecklist('dry3');
        showAnalysisSection();
        advanceStep('visualize');
        if(skipButton) skipButton.style.display = 'none';
        if(startButton) startButton.style.display = 'none';
        console.log("--- Ready for UV Toggle and Analysis ---");
    }

     // --- Analysis Functions ---
     function showAnalysisSection() { if(analysisSection) analysisSection.classList.remove('hidden'); if (resultsTableBody) populateAnalysisTable(); else console.error("resultsTableBody not found!"); }
     function populateAnalysisTable() { if (!resultsTableBody) { console.error("Cannot populate table, resultsTableBody null."); return; } resultsTableBody.innerHTML = ''; const rows=['E','F','G','H']; rows.forEach((rowLabel,index)=>{const tr=document.createElement('tr'); const pNum=index+1; let pName=`Patient ${pNum}`; if(pNum===1)pName+=" (Joe)"; const tdP=document.createElement('td'); tdP.textContent=pName; tr.appendChild(tdP); for(let i=0;i<9;i++){const cN=i+1; const sId=`${rowLabel}${cN}`; const tdI=document.createElement('td'); const inp=document.createElement('input'); inp.type="text"; inp.id=`input-${sId}`; inp.dataset.row=rowLabel; inp.dataset.col=cN; inp.maxLength="1"; tdI.appendChild(inp); tr.appendChild(tdI);} resultsTableBody.appendChild(tr); }); }
     function eraseAnalysisTable() { if (!resultsTableBody) return; const inputs = resultsTableBody.querySelectorAll('input[type="text"]'); inputs.forEach(input => { input.value = ''; input.style.backgroundColor = ''; }); if(resultsFeedback) resultsFeedback.textContent = ''; if(checkResultsButton) checkResultsButton.disabled = false; console.log("Analysis table erased."); }
     function checkAnalysisResults() { if (!resultsTableBody || !resultsFeedback) return; let correctCount=0; let applicableSpots=0; resultsFeedback.textContent=''; for(const spotId in spotsState){const state=spotsState[spotId]; const inputEl=document.getElementById(`input-${spotId}`); if(inputEl){const userVal=inputEl.value.trim().toLowerCase(); let expectedSym='',isCorrect=false; if(state.sample_applied){applicableSpots++; switch(state.final_color){case 'red':expectedSym='↑';break; case 'green':expectedSym='↓';break; case 'yellow':expectedSym='n';break; case 'black':expectedSym='-';break;} if(state.final_color==='red'&&(userVal==='↑'||userVal==='u'))isCorrect=true; else if(state.final_color==='green'&&(userVal==='↓'||userVal==='d'))isCorrect=true; else if(state.final_color==='yellow'&&(userVal==='n'||userVal==='='))isCorrect=true; else if(state.final_color==='black'&&(userVal==='-'||userVal==='b'||userVal===''))isCorrect=true; if(isCorrect){correctCount++; inputEl.style.backgroundColor='lightgreen';}else{inputEl.style.backgroundColor='lightcoral';}}else{if(userVal===''||userVal==='-'){inputEl.style.backgroundColor='lightgrey';}else{inputEl.style.backgroundColor='lightcoral';}}}} resultsFeedback.textContent=`You got ${correctCount} out of ${applicableSpots} applicable results correct. ${correctCount===applicableSpots?'Excellent!':'Review colors.'}`; if(correctCount===applicableSpots&&applicableSpots>0){updateChecklist('analyze'); currentStep='done'; updateUIForStep();}else{if(checkResultsButton) checkResultsButton.disabled=false;}}

     // --- Utility Functions ---
     function updateInstruction(text) { if(instructionText) instructionText.textContent = text; }
     function updateChecklist(stepKey) { if(checklistItems[stepKey]) checklistItems[stepKey].classList.add('completed'); }

     // *** NEW updatePipetteVisual using SVG - LONGER & NARROWER Tip ***
     function updatePipetteVisual() {
        if (!pipetteTipMount) {
            console.error("pipetteTipMount element not found for visual update.");
            return;
        }
        // Clear existing tip/liquid visuals
        if (pipetteState.liquidSvgElement) {
             if (pipetteTipMount.contains(pipetteState.liquidSvgElement)) {
                 pipetteTipMount.removeChild(pipetteState.liquidSvgElement);
             }
             pipetteState.liquidSvgElement = null;
        }
         if (pipetteState.tipSvgElement) {
             if (!pipetteState.hasTip) { // Remove tip SVG only if state says no tip
                 if (pipetteTipMount.contains(pipetteState.tipSvgElement)) {
                     pipetteTipMount.removeChild(pipetteState.tipSvgElement);
                 }
                pipetteState.tipSvgElement = null;
             }
        }

        // Add new tip if needed
        if (pipetteState.hasTip && !pipetteState.tipSvgElement) {
            const tip = document.createElementNS(svgNS, "polygon");
            // *** LONGER & NARROWER CONE ***
            // Start wider at top, end very narrow (e.g., width 1) at a much larger Y value
            tip.setAttribute("points", "-4,0 4,0 0.5,45 -0.5,45"); // Long cone ending almost at a point
            tip.setAttribute("fill", "#FFFFFF");
            tip.setAttribute("stroke", "#555");
            tip.setAttribute("stroke-width", "0.5");
            pipetteTipMount.appendChild(tip);
            pipetteState.tipSvgElement = tip; // Store reference
        }

        // Add liquid if tip exists and reagent loaded
        if (pipetteState.tipSvgElement && pipetteState.loaded) {
            const liquid = document.createElementNS(svgNS, "polygon");
             // *** Adjust liquid to match LONGER & NARROWER tip ***
            // Start slightly narrower than tip top, end very narrow near tip bottom
            // Adjust y-coordinates proportionally
            liquid.setAttribute("points", "-3,5 3,5 0.4,43 -0.4,43"); // Liquid within the new tip shape
            liquid.setAttribute("fill", liquidColors[pipetteState.loaded] || '#808080');
            liquid.setAttribute("stroke", "none");
            pipetteTipMount.appendChild(liquid); // Append after tip
            pipetteState.liquidSvgElement = liquid; // Store reference
        }
    }
    // *** END NEW updatePipetteVisual ***

     function disableAllControls() {
         // Disable regular buttons
         const buttons = [startButton, skipButton, checkResultsButton, eraseTableButton];
         buttons.forEach(button => { if (button) button.disabled = true; });

         // Disable SVGs by adding class
         const svgs = [tipBoxSvg, wasteBinSvg, incubatorSvg, uvLightSvg, ebTube, cdnaTube, hbTube];
         svgs.forEach(svg => { if (svg) svg.classList.add('disabled'); });

         // Disable interactive areas
         setSpotsClickable(false);
         setWellsClickable(false);
     }

     function enableControls(buttonIds) { // Primarily for non-SVG buttons
         buttonIds.forEach(id => {
             const button = document.getElementById(id);
             if (button) button.disabled = false;
         });
     }

     function enableSvgControls(svgIds) { // Specifically for SVGs
         svgIds.forEach(id => {
             const svg = document.getElementById(id);
             if (svg) {
                 svg.classList.remove('disabled');
             } else {
                 console.error(`SVG element not found for enabling: ${id}`);
             }
         });
     }

     function setSpotsClickable(isClickable, stepContext = null, specificSpotId = null) {
         if (!microarrayCardDiv) return;
         const spots = microarrayCardDiv.querySelectorAll('.spot');
         spots.forEach(spot => { const spotId = spot.id.split('-')[1]; const state = spotsState[spotId]; let makeClickable = false; if (isClickable && state) { let needsProcessing=false; if (stepContext === 'eb' && !state.eb_applied) needsProcessing=true; else if (stepContext === 'spot-sample' && !state.sample_applied && spotId === specificSpotId) needsProcessing=true; else if (stepContext === 'hb' && state.sample_applied && !state.hb_applied) needsProcessing=true; if (needsProcessing) makeClickable = true; } if (makeClickable) spot.classList.add('clickable'); else spot.classList.remove('clickable'); });
     }

     function setWellsClickable(isClickable, stepContext = null, specificWellId = null) {
         if (!quickstripPlateDiv) return;
         const wells = quickstripPlateDiv.querySelectorAll('.well');
         wells.forEach(well => { const wellId = well.id.split('-')[1]; let makeClickable = false; if (isClickable && specificWellId && wellId === specificWellId && (stepContext === 'dispense-cdna' || stepContext === 'mix-well')) makeClickable = true; if (makeClickable) well.classList.add('clickable'); else well.classList.remove('clickable'); });
     }

     function getWellIdFromCounter(counter) {
         const rowLabels = ['E','F','G','H']; if (counter >= totalSamples) counter=totalSamples-1; const row = rowLabels[Math.floor(counter / 9)]; const col = (counter % 9) + 1; return `${row}${col}`;
     }
     function getSpotIdFromCounter(counter) { return getWellIdFromCounter(counter); }

    // --- Start Initialization ---
    init();

}); // End DOMContentLoaded