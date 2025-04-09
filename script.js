document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const instructionText = document.getElementById('instruction-text');
    const startButton = document.getElementById('start-button');
    const skipButton = document.getElementById('skip-button'); // Get the new button
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

    // Tools & Reagents Buttons
    const tipBoxButton = document.getElementById('tip-box-button');
    const wasteBinButton = document.getElementById('waste-bin-button');
    const incubatorButton = document.getElementById('incubator-button');
    const uvLightButton = document.getElementById('uv-light-button');
    const ebButton = document.getElementById('eb-button');
    const cdnaButton = document.getElementById('cdna-button');
    const hbButton = document.getElementById('hb-button');
    

    // Pipette Visuals
    const pipetteDiv = document.getElementById('pipette');
    const pipetteTipDiv = document.getElementById('pipette-tip');
    const pipetteLiquidDiv = document.getElementById('pipette-liquid');

    // Lab Areas
    const microarrayCardDiv = document.getElementById('microarray-card');
    const quickstripPlateDiv = document.getElementById('quickstrip-plate');
    const analysisSection = document.getElementById('analysis-section');
    const resultsTableBody = document.querySelector('#results-table tbody');
    const checkResultsButton = document.getElementById('check-results-button');
    const eraseTableButton = document.getElementById('erase-table-button');
    const resultsFeedback = document.getElementById('results-feedback');

    // --- State Variables ---
    let currentStep = 'initial'; // 'initial', 'orient', 'load-eb', 'apply-eb', 'dry-eb', 'get-tip-mix', 'load-cdna', 'dispense-cdna', 'mix-well', 'spot-sample', 'dry-sample', 'get-tip-hb', 'load-hb', 'apply-hb', 'dry-hb', 'visualize', 'analyze', 'done'
    let pipetteState = { hasTip: false, loaded: null }; // loaded: null, 'EB', 'cDNA', 'HB', 'MIX'
    let incubatorBusy = false;
    let uvLightOn = false;
    let spotsState = {}; // Stores state for each spot: { id: 'E1', eb_applied: false, sample_applied: false, hb_applied: false, final_color: 'black', needs_processing: true/false, current_visual: 'initial' }
    let wellsState = {}; // Stores state for each well: { id: 'E1', foil: true, cdna_added: false, mixed: false, mix_clicks: 0 }
    let requiredClicks = 0; // Counter for multi-click steps (like applying buffer to all spots)
    let mixSpotCounter = 0; // Track progress through the 36 mix/spot steps
    const totalSamples = 36; // 4 rows * 9 columns

    // --- Expected Results (Based on Edvotek Page 12 example, mapped to E-H rows) ---
    // Rows E, F, G, H correspond to Patients 1, 2, 3, 4
    const expectedSpotColors = {
        'E': ['yellow', 'red', 'green', 'black', 'red', 'yellow', 'green', 'black', 'red'],    // Patient 1 (Grandpa Joe)
        'F': ['yellow', 'red', 'green', 'black', 'red', 'yellow', 'green', 'black', 'red'],    // Patient 2 (Using Patient 1 data for now)
        'G': ['yellow', 'red', 'green', 'black', 'red', 'yellow', 'green', 'black', 'yellow'], // Patient 3 (Using Patient 1 data, changed Gene 5)
        'H': ['yellow', 'red', 'green', 'black', 'red', 'yellow', 'yellow', 'black', 'red']   // Patient 4 (Using Patient 1 data, changed Gene 3)
    };

    // --- Initialization ---
    function init() {
        createGrid('spot', microarrayCardDiv, 4, 9, ['E', 'F', 'G', 'H']);
        createGrid('well', quickstripPlateDiv, 4, 9, ['E', 'F', 'G', 'H']);
        setupEventListeners();
        updateInstruction('Welcome! This simulation guides you through a DNA microarray experiment for lung cancer gene expression. Click "Start Experiment" to begin.');
        disableAllControls(); // Keep controls disabled until start
        startButton.disabled = false;
        if (skipButton) { // Check if button exists
            skipButton.addEventListener('click', skipToAnalysis);
       }
    }

    function createGrid(type, container, rows, cols, rowLabels) {
         container.innerHTML = ''; // Clear existing
         const stateObject = (type === 'spot') ? spotsState : wellsState;
         const baseId = type; // 'spot' or 'well'

         // Minimal row label handling (adjust CSS if needed)
         // container.style.gridTemplateRows = `repeat(${rows}, auto)`; // If using CSS grid for rows too

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const id = `${rowLabels[r]}${c + 1}`;
                const div = document.createElement('div');
                div.id = `${baseId}-${id}`;
                div.classList.add(type);
                div.dataset.row = rowLabels[r];
                div.dataset.col = c + 1;
                div.textContent = id; // Show ID for clarity

                 if (type === 'well') {
                    div.classList.add('foil');
                    stateObject[id] = { id: id, foil: true, cdna_added: false, mixed: false, mix_clicks: 0 };
                 } else { // spot
                    const patientIndex = rowLabels.indexOf(rowLabels[r]); // Ensure rowLabels matches expectedSpotColors keys
                    const color = expectedSpotColors[rowLabels[r]][c];
                     stateObject[id] = {
                        id: id,
                        eb_applied: false,
                        sample_applied: false,
                        hb_applied: false,
                        final_color: color,
                        needs_processing: true,
                        current_visual: 'initial'
                    };
                    div.classList.add('initial'); // Start with the base grey color class
                    div.classList.add('uv-off'); // Treat as UV off initially
                 }
                container.appendChild(div);
            }
        }
    }

    function setupEventListeners() {
        startButton.addEventListener('click', startExperiment);
        tipBoxButton.addEventListener('click', handleTipBoxClick);
        wasteBinButton.addEventListener('click', handleWasteBinClick);
        incubatorButton.addEventListener('click', handleIncubatorClick);
        uvLightButton.addEventListener('click', handleUvLightToggle);
        ebButton.addEventListener('click', () => handleReagentClick('EB'));
        cdnaButton.addEventListener('click', () => handleReagentClick('cDNA'));
        hbButton.addEventListener('click', () => handleReagentClick('HB'));

        microarrayCardDiv.addEventListener('click', (e) => {
            if (e.target.classList.contains('spot')) {
                handleSpotClick(e.target.id);
            }
        });
        quickstripPlateDiv.addEventListener('click', (e) => {
            // Only target wells, ignore clicks on the plate background
            if (e.target.classList.contains('well')) {
                handleWellClick(e.target.id);
            }
        });
         checkResultsButton.addEventListener('click', checkAnalysisResults);
         eraseTableButton.addEventListener('click', eraseAnalysisTable)
    }

    // --- Game Flow & Step Logic ---



    function startExperiment() {
        startButton.style.display = 'none';
        currentStep = 'orient';
        updateChecklist('orient');
        advanceStep('get-tip-eb'); // Changed: Go directly to getting tip for EB
    }

    // --- Define specific step advancement ---
     function advanceStep(nextStep) {
         currentStep = nextStep;
         // console.log("Advanced to step:", currentStep); // DEBUG
         updateUIForStep();
     }


    function updateUIForStep() {
        disableAllControls();
        let instruction = '';

        // Always enable discard button if a tip is present
        if (pipetteState.hasTip) {
            enableControls(['waste-bin-button']);
        }

        switch (currentStep) {
             // EB Cycle
            case 'get-tip-eb': // New step name for clarity
                instruction = 'Get a fresh pipette tip by clicking "Get New Tip".';
                enableControls(['tip-box-button']);
                break;
             case 'load-eb':
                 instruction = 'Load Equilibration Buffer (EB) by clicking the "EB" button.';
                 enableControls(['eb-button']); // Discard already handled
                 break;
            case 'apply-eb':
                instruction = `Apply 5µL EB to ${requiredClicks} remaining spots. Click each required spot.`;
                setSpotsClickable(true, 'eb'); // Only EB spots clickable
                break;
             case 'dry-eb':
                 instruction = 'Incubate the card to dry the EB. Click "Incubate (Dry)".';
                 enableControls(['incubator-button']);
                 break;

            // Mix/Spot Cycle
             case 'get-tip-mix':
                 instruction = `Prepare sample ${getWellIdFromCounter(mixSpotCounter)}. Get a fresh pipette tip.`;
                 enableControls(['tip-box-button']);
                 break;
             case 'load-cdna':
                 instruction = `Add 5µL Control cDNA to Well ${getWellIdFromCounter(mixSpotCounter)}. Click "Control cDNA".`;
                 enableControls(['cdna-button']);
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
                instruction = 'All samples spotted. Incubate the card. Click "Incubate (Dry)".';
                enableControls(['incubator-button']);
                break;

             // HB Cycle
             case 'get-tip-hb':
                 instruction = 'Prepare to apply Hybridization Buffer (HB). Get a fresh pipette tip.';
                 enableControls(['tip-box-button']);
                 break;
             case 'load-hb':
                 instruction = 'Load Hybridization Buffer (HB). Click the "HB" button.';
                 enableControls(['hb-button']);
                 break;
            case 'apply-hb':
                instruction = `Apply 5µL HB to ${requiredClicks} remaining spots. Click each required spot.`;
                setSpotsClickable(true, 'hb');
                break;
            case 'dry-hb':
                instruction = 'Incubate the card a final time. Click "Incubate (Dry)".';
                enableControls(['incubator-button']);
                break;

            // Visualization & Analysis
            case 'visualize':
                instruction = 'Experiment complete! Toggle the UV Light to view results. Then proceed to Analysis.';
                enableControls(['uv-light-button']);
                showAnalysisSection();
                break;
             case 'analyze':
                 instruction = 'Analyze results. Fill table based on colors (Red:Up, Green:Down, Yellow:Same, Black:None). Click "Check My Results".';
                 enableControls(['uv-light-button', 'check-results-button']);
                 // *** ENSURE CHECK & ERASE BUTTONS ARE ENABLED ***
                 enableControls(['uv-light-button', 'check-results-button', 'erase-table-button']);
                 break;
            case 'done':
                instruction = 'Analysis complete! Simulation finished.';
                // *** Keep Erase button active even when done? Optional. ***
                enableControls(['uv-light-button', 'erase-table-button']);
                // Disable check button once successful?
                // checkResultsButton.disabled = true;
                break;
            default:
                instruction = `Error: Unknown step '${currentStep}'`;
                console.error(`Unknown step: ${currentStep}`);
        }
        updateInstruction(instruction);
    }

    // --- Event Handlers ---

    function handleTipBoxClick() {
        if (pipetteState.hasTip) {
            updateInstruction('You already have a tip. Discard it first if you need a new one.');
            return;
        }
        pipetteState.hasTip = true;
        pipetteState.loaded = null;
        updatePipetteVisual();

        // Determine next logical step based on currentStep requiring a tip
        if (currentStep === 'get-tip-eb') advanceStep('load-eb');
        else if (currentStep === 'get-tip-mix') advanceStep('load-cdna');
        else if (currentStep === 'get-tip-hb') advanceStep('load-hb');
        else {
            console.warn(`Got tip during unexpected step: ${currentStep}`);
            updateUIForStep(); // Re-evaluate UI for current step
        }
    }

    function handleWasteBinClick() {
        if (!pipetteState.hasTip) {
            // updateInstruction('No tip to discard.'); // Can be annoying, maybe skip feedback
            return;
        }
        pipetteState.hasTip = false;
        pipetteState.loaded = null;
        updatePipetteVisual();
        updateUIForStep(); // Re-evaluate current step's UI (might enable getting a new tip)
    }

    function handleReagentClick(reagent) {
        // console.log(`handleReagentClick called with: ${reagent}, Current Step: ${currentStep}`); // DEBUG

        if (!pipetteState.hasTip) {
            updateInstruction('You need a pipette tip first!');
            return;
        }
        if (pipetteState.loaded) {
             updateInstruction(`Pipette already contains ${pipetteState.loaded}. Discard tip and get a new one.`);
             return;
        }

        let expectedReagent = null;
        if (currentStep === 'load-eb') expectedReagent = 'EB';
        else if (currentStep === 'load-cdna') expectedReagent = 'cDNA';
        else if (currentStep === 'load-hb') expectedReagent = 'HB';

        if (!expectedReagent) {
            updateInstruction(`You don't need to load ${reagent} right now.`);
            return;
        }
         if (reagent !== expectedReagent) {
             updateInstruction(`Incorrect reagent. You should be loading ${expectedReagent} now.`);
             return;
         }

        pipetteState.loaded = reagent;
        // console.log("Pipette state loaded set to:", pipetteState.loaded); // DEBUG
        updatePipetteVisual();

        let nextStep = null;
         if (reagent === 'EB') {
             requiredClicks = totalSamples;
             nextStep = 'apply-eb';
         } else if (reagent === 'cDNA') {
             nextStep = 'dispense-cdna';
         } else if (reagent === 'HB') {
             requiredClicks = totalSamples;
             nextStep = 'apply-hb';
         }

         if (nextStep) {
            // console.log(`Advancing step from ${currentStep} to ${nextStep}`); // DEBUG
            advanceStep(nextStep);
         } else {
            console.error("Error: Could not determine next step after loading reagent:", reagent);
         }
    }

     function handleWellClick(wellElementId) {
         const wellId = wellElementId.split('-')[1];
         const well = document.getElementById(wellElementId);
         const state = wellsState[wellId];

         // console.log(`handleWellClick: wellId=${wellId}, currentStep=${currentStep}, pipetteLoaded=${pipetteState.loaded}`); // DEBUG

         if (!well || !state) return;

         if (currentStep === 'dispense-cdna') {
              if (pipetteState.loaded !== 'cDNA') {
                 updateInstruction("Pipette is not loaded with Control cDNA. Load it first.");
                 console.warn("Attempted to dispense cDNA, but pipette state was:", pipetteState.loaded);
                 return;
              }

             const expectedWellId = getWellIdFromCounter(mixSpotCounter);
             if (wellId !== expectedWellId) {
                 updateInstruction(`Wrong well! You should be dispensing into Well ${expectedWellId}.`);
                 return;
             }
             if (state.foil) {
                 well.classList.remove('foil');
                 well.classList.add('punched');
                 state.foil = false;
                 // console.log(`Well ${wellId}: Foil punched.`); // DEBUG
             }
             if (!state.cdna_added) {
                well.classList.add('cdna-added');
                state.cdna_added = true;
                // console.log(`Well ${wellId}: cDNA added.`); // DEBUG

                pipetteState.loaded = null; // Empty pipette AFTER successful dispense
                updatePipetteVisual();

                advanceStep('mix-well');
             } else {
                 // console.log(`Well ${wellId}: cDNA already added.`); // DEBUG
             }
         }
         else if (currentStep === 'mix-well') {
              const expectedWellId = getWellIdFromCounter(mixSpotCounter);
               if (wellId !== expectedWellId) {
                   updateInstruction(`Wrong well! You should be mixing Well ${expectedWellId}.`);
                   return;
               }
               if (!state.cdna_added) {
                   updateInstruction(`Control cDNA hasn't been added to Well ${wellId} yet.`);
                   return;
               }
               if (!state.mixed) {
                   state.mix_clicks++;
                   // console.log(`Well ${wellId}: Mix click ${state.mix_clicks}`); // DEBUG
                   well.classList.add('mixed'); // Add class for animation
                   setTimeout(() => well.classList.remove('mixed'), 500); // Remove after animation duration

                   if (state.mix_clicks >= 3) {
                       state.mixed = true;
                       // console.log(`Well ${wellId}: Mixing complete.`); // DEBUG
                       pipetteState.loaded = 'MIX'; // Load pipette AFTER successful mixing
                       updatePipetteVisual();
                       advanceStep('spot-sample');
                   } else {
                       updateInstruction(`Mix the sample in Well ${wellId}. Click the well ${3-state.mix_clicks} more time(s).`);
                   }
               }
         } else {
            // Ignore clicks on wells during other steps
         }
     }

    function handleSpotClick(spotElementId) {
        const spotId = spotElementId.split('-')[1];
        const spot = document.getElementById(spotElementId);
        const state = spotsState[spotId];

        if (!spot || !state) return;

        let needsProcessingNow = false;
        let expectedReagent = null;
        let targetStep = null;
        let nextStepAfterAll = null;
        let stateFlag = '';
        let visualClass = '';

        if (currentStep === 'apply-eb') {
            expectedReagent = 'EB'; targetStep = 'apply-eb'; nextStepAfterAll = 'dry-eb';
            stateFlag = 'eb_applied'; visualClass = 'eb-applied';
            needsProcessingNow = !state.eb_applied;
        } else if (currentStep === 'spot-sample') {
            expectedReagent = 'MIX'; targetStep = 'spot-sample'; // No nextStepAfterAll for sample spotting loop
            stateFlag = 'sample_applied'; visualClass = 'sample-applied-temp';
            const expectedSpotId = getSpotIdFromCounter(mixSpotCounter);
            if (spotId !== expectedSpotId) {
                updateInstruction(`Wrong spot! Target Spot ${expectedSpotId}.`);
                return;
            }
            needsProcessingNow = !state.sample_applied;
        } else if (currentStep === 'apply-hb') {
            expectedReagent = 'HB'; targetStep = 'apply-hb'; nextStepAfterAll = 'dry-hb';
            stateFlag = 'hb_applied'; visualClass = 'hb-applied';
            needsProcessingNow = state.sample_applied && !state.hb_applied;
        } else {
            return; // Not in a spot application step
        }

        if (!needsProcessingNow) {
            // updateInstruction(`Spot ${spotId} does not need this action now.`);
            return; // Already done or not applicable
        }

        if (pipetteState.loaded !== expectedReagent) {
            updateInstruction(`Incorrect solution in pipette. Load ${expectedReagent || 'nothing'} first.`);
            return;
        }

        // --- Action is valid, proceed ---
        state[stateFlag] = true; // Update logical state

        // Visual Update
        spot.classList.remove('initial', 'eb-applied', 'sample-applied-temp', 'hb-applied', 'uv-off', 'dry');
        spot.classList.add(visualClass);
        state.current_visual = visualClass;
        // spot.classList.remove('clickable'); // Let setSpotsClickable handle this

        // Step Advancement Logic
        if (targetStep === 'spot-sample') {
            pipetteState.loaded = null; // Empty pipette AFTER successful spotting
            updatePipetteVisual();

            mixSpotCounter++;
            // console.log(`Spot ${spotId}: Sample applied. Advancing mixSpotCounter to ${mixSpotCounter}`); // DEBUG

            if (mixSpotCounter >= totalSamples) {
                updateChecklist('mixSpot'); // Mark checklist for the whole cycle
                advanceStep('dry-sample'); // Move to drying AFTER all samples are done
            } else {
                advanceStep('get-tip-mix'); // Loop back to get tip for the NEXT sample
            }
        } else { // Applying EB or HB
            requiredClicks--;
            updateInstruction(`Apply ${expectedReagent} to ${requiredClicks} remaining spots. Click each required spot.`);
            if (requiredClicks <= 0) {
                pipetteState.loaded = null; // Empty pipette AFTER finishing buffer application
                updatePipetteVisual();

                if (targetStep === 'apply-eb') updateChecklist('eb');
                if (targetStep === 'apply-hb') updateChecklist('hb');
                advanceStep(nextStepAfterAll); // Move to drying step
                setSpotsClickable(false); // Turn off spot clicking
            } else {
                 // Re-evaluate which spots are still clickable for this buffer step
                setSpotsClickable(true, targetStep);
            }
        }
    }


    function handleIncubatorClick() {
        if (incubatorBusy) return;

        // Check if it's a valid drying step
        if (currentStep !== 'dry-eb' && currentStep !== 'dry-sample' && currentStep !== 'dry-hb') {
            updateInstruction("Nothing to incubate right now.");
            return;
        }

        incubatorBusy = true;
        updateInstruction('Incubating... please wait.');
        disableAllControls();

        const incubationTime = 1500; // 1.5 seconds
        const progressBar = document.createElement('div');
        // Simple visual progress (can enhance later)
        progressBar.style.width = '0%';
        progressBar.style.height = '5px';
        progressBar.style.backgroundColor = 'lightblue';
        progressBar.style.transition = `width ${incubationTime / 1000}s linear`;
        instructionText.appendChild(progressBar);
        setTimeout(() => progressBar.style.width = '100%', 50);

        setTimeout(() => {
            incubatorBusy = false;
            if(instructionText.contains(progressBar)) { // Check if still exists
                 instructionText.removeChild(progressBar);
            }

            // Optional: Add 'dry' class visually
            Object.values(spotsState).forEach(s => {
                 if(s.eb_applied || s.sample_applied || s.hb_applied) { // Only mark if something was applied
                     const spotEl = document.getElementById(`spot-${s.id}`);
                     if (spotEl) spotEl.classList.add('dry');
                 }
            });

             // Advance based on which drying step it was
             if (currentStep === 'dry-eb') {
                 updateChecklist('dry1');
                 mixSpotCounter = 0; // Reset for the mix/spot cycle
                 advanceStep('get-tip-mix'); // Start mix/spot cycle
             } else if (currentStep === 'dry-sample') {
                  updateChecklist('dry2');
                 advanceStep('get-tip-hb'); // Start HB cycle
             } else if (currentStep === 'dry-hb') {
                  updateChecklist('dry3');
                 advanceStep('visualize'); // Move to visualization
             } else {
                 console.error("Incubation finished during unexpected step:", currentStep);
                 updateUIForStep(); // Try to recover UI state
             }

        }, incubationTime);
    }

    function handleUvLightToggle() {
        if (currentStep !== 'visualize' && currentStep !== 'analyze' && currentStep !== 'done') {
            updateInstruction('Cannot use UV light yet. Complete the experiment first.');
            return;
        }
        if (incubatorBusy) return;

        uvLightOn = !uvLightOn;
        uvLightButton.textContent = uvLightOn ? 'Turn UV Light OFF' : 'Turn UV Light ON';

        for (const spotId in spotsState) {
            const spotElement = document.getElementById(`spot-${spotId}`);
            const state = spotsState[spotId];
            if (spotElement) {
                // Cleanup previous visual classes
                spotElement.classList.remove(
                    'initial', 'eb-applied', 'sample-applied-temp',
                    'hb-applied', 'dry', 'uv-off',
                    'red', 'green', 'yellow', 'black'
                );

                if (state.sample_applied) { // Only show final color if sample was applied
                    if (uvLightOn) {
                        spotElement.classList.add(state.final_color);
                        spotElement.textContent = spotId;
                    } else {
                        spotElement.classList.add('uv-off');
                        spotElement.textContent = spotId;
                    }
                } else { // Spot where sample was never applied
                     if (uvLightOn) {
                         // Show as initial or blank under UV
                         spotElement.classList.add('initial'); // Or 'black' if appropriate
                         spotElement.textContent = spotId;
                     } else {
                         spotElement.classList.add('uv-off');
                         spotElement.textContent = spotId;
                     }
                }
            }
        }

        if (currentStep === 'visualize' && uvLightOn) {
            updateChecklist('visualize');
            advanceStep('analyze');
        }
    }

    // *** MODIFY THIS FUNCTION ***
    function skipToAnalysis() {
        console.log("--- Skipping to Analysis ---");

        // 1. Force State Variables
        // currentStep = 'visualize'; // Let advanceStep handle this
        uvLightOn = false;         // Ensure light starts OFF
        pipetteState = { hasTip: false, loaded: null }; // Reset pipette

        for (const spotId in spotsState) {
            spotsState[spotId].sample_applied = true;
            spotsState[spotId].eb_applied = true;
            spotsState[spotId].hb_applied = true;

            // *** Ensure spots visually start in the 'uv-off' state ***
            const spotElement = document.getElementById(`spot-${spotId}`);
            if(spotElement) {
                spotElement.classList.remove(
                    'initial', 'eb-applied', 'sample-applied-temp',
                    'hb-applied', 'dry',
                    'red', 'green', 'yellow', 'black'
                );
                spotElement.classList.add('uv-off');
                spotElement.textContent = spotId; // Keep label visible
            }
            // *** End visual reset ***
        }

        // 2. Update Checklist visually
        updateChecklist('orient');
        updateChecklist('eb');
        updateChecklist('dry1');
        updateChecklist('mixSpot');
        updateChecklist('dry2');
        updateChecklist('hb');
        updateChecklist('dry3');
        // 'visualize' will be checked when UV is toggled ON

        // 3. Prepare UI for Visualization/Analysis step
        showAnalysisSection(); // Ensure table is populated and visible

        // 4. *** SIMPLIFIED: Just advance to the visualize step ***
        // The updateUIForStep function for 'visualize' will handle enabling the button.
        advanceStep('visualize');

        // 5. Hide buttons
        skipButton.style.display = 'none';
        startButton.style.display = 'none';

        console.log("--- Ready for UV Toggle and Analysis ---");
    }
    // *** END OF MODIFIED FUNCTION ***

    // --- Analysis ---
    function showAnalysisSection() {
        analysisSection.classList.remove('hidden');
        // *** Add a check before populating ***
        if (resultsTableBody) {
           populateAnalysisTable();
        } else {
           console.error("ERROR: resultsTableBody element not found!");
        }
    }

     function populateAnalysisTable() {
        // console.log("Attempting to populate analysis table..."); // DEBUG
          // *** Check added in showAnalysisSection, but double-check doesn't hurt ***
          if (!resultsTableBody) {
            console.error("Cannot populate table, resultsTableBody is null.");
            return;
        }       
        resultsTableBody.innerHTML = ''; // Clear previous content first

        const rows = ['E', 'F', 'G', 'H']; // Patient row labels

        rows.forEach((rowLabel, index) => {
            const tr = document.createElement('tr'); // Create a new table row element

            const patientNum = index + 1;
            let patientName = `Patient ${patientNum}`;
            if (patientNum === 1) patientName += " (Joe)";

            // 1. Create the Patient Name cell
            const tdPatient = document.createElement('td');
            tdPatient.textContent = patientName;
            tr.appendChild(tdPatient); // Add patient cell to the row

            // 2. Create the 9 input cells
            for (let i = 0; i < 9; i++) {
                const colNum = i + 1;
                const spotId = `${rowLabel}${colNum}`; // e.g., E1, E2... H9

                const tdInput = document.createElement('td'); // Create cell for input
                const inputElement = document.createElement('input'); // Create input element
                inputElement.type = "text";
                inputElement.id = `input-${spotId}`;
                inputElement.dataset.row = rowLabel;
                inputElement.dataset.col = colNum;
                inputElement.maxLength = "1"; // Allow only one character

                tdInput.appendChild(inputElement); // Add input to the cell
                tr.appendChild(tdInput); // Add cell to the row
            }

            // 3. Append the complete row to the table body
            resultsTableBody.appendChild(tr);
            // console.log(`Added row for patient ${patientNum} (${rowLabel})`); // DEBUG
        });
        // console.log("Analysis table population complete."); // DEBUG
    }

    // *** ADD THIS FUNCTION ***
    function eraseAnalysisTable() {
        // Select all input fields within the results table body
        const inputFields = resultsTableBody.querySelectorAll('input[type="text"]');

        inputFields.forEach(input => {
            input.value = ''; // Clear the value
            input.style.backgroundColor = ''; // Reset background color
        });

        // Clear the feedback message
        resultsFeedback.textContent = '';

        // Ensure the Check button is enabled
        checkResultsButton.disabled = false;
        // Optionally disable erase button temporarily after erasing?
        // eraseTableButton.disabled = true;
        // setTimeout(() => { eraseTableButton.disabled = false; }, 500); // Re-enable after short delay

        console.log("Analysis table erased.");
    }
    // *** END ADD FUNCTION ***


    function checkAnalysisResults() {
        // This function remains unchanged from the previous version
         let correctCount = 0;
         const totalInputs = 36;
         resultsFeedback.textContent = '';

         for (const spotId in spotsState) {
             const state = spotsState[spotId];
             const inputElement = document.getElementById(`input-${spotId}`);
             if (inputElement) {
                 const userValue = inputElement.value.trim().toLowerCase();
                 let expectedSymbol = '';
                 let isCorrect = false;

                 if (state.sample_applied) {
                     switch (state.final_color) {
                         case 'red': expectedSymbol = '↑'; break;
                         case 'green': expectedSymbol = '↓'; break;
                         case 'yellow': expectedSymbol = 'n'; break;
                         case 'black': expectedSymbol = '-'; break;
                     }
                     if (state.final_color === 'red' && (userValue === '↑' || userValue === 'u')) isCorrect = true;
                     else if (state.final_color === 'green' && (userValue === '↓' || userValue === 'd')) isCorrect = true;
                     else if (state.final_color === 'yellow' && (userValue === 'n' || userValue === '=')) isCorrect = true;
                     else if (state.final_color === 'black' && (userValue === '-' || userValue === 'b' || userValue === '')) isCorrect = true; // Allow blank for black

                     if (isCorrect) {
                         correctCount++;
                         inputElement.style.backgroundColor = 'lightgreen';
                     } else {
                         inputElement.style.backgroundColor = 'lightcoral';
                     }
                 } else {
                     if (userValue === '' || userValue === '-') {
                         inputElement.style.backgroundColor = 'lightgrey';
                     } else {
                         inputElement.style.backgroundColor = 'lightcoral';
                     }
                 }
             }
         }
         const applicableSpots = Object.values(spotsState).filter(s => s.sample_applied).length;
         resultsFeedback.textContent = `You got ${correctCount} out of ${applicableSpots} applicable results correct. ${correctCount === applicableSpots ? 'Excellent!' : 'Review the colors and try again.'}`;

         if (correctCount === applicableSpots && applicableSpots > 0) {
             updateChecklist('analyze');
             // advanceStep('done'); // Keep analyze step active for erasing/reviewing
             currentStep = 'done'; // Mark internally as done
             updateUIForStep(); // Update UI for done state (disables check button if desired)
         } else {
              // Ensure Check button stays enabled if not perfect
              checkResultsButton.disabled = false;
         }
     }

    // --- Utility Functions ---

    function updateInstruction(text) {
        instructionText.textContent = text;
    }

     function updateChecklist(stepKey) {
         if(checklistItems[stepKey]) {
             checklistItems[stepKey].classList.add('completed');
         }
     }

    function updatePipetteVisual() {
        pipetteTipDiv.className = pipetteState.hasTip ? 'pipette-tip' : 'pipette-tip empty';
        pipetteLiquidDiv.classList.remove('empty', 'eb', 'cdna', 'hb', 'mix'); // Clear first

        if (pipetteState.hasTip && pipetteState.loaded) {
            const liquidClass = pipetteState.loaded.toLowerCase();
            pipetteLiquidDiv.classList.add(liquidClass);
        } else {
            pipetteLiquidDiv.classList.add('empty');
        }
    }

    function disableAllControls() {
        const controls = [startButton, tipBoxButton, wasteBinButton, incubatorButton, uvLightButton, ebButton, cdnaButton, hbButton, checkResultsButton, eraseTableButton]; // Add erase button
        controls.forEach(button => button.disabled = true);
        setSpotsClickable(false);
        setWellsClickable(false);
    }

    function enableControls(buttonIds) {
        buttonIds.forEach(id => {
            const button = document.getElementById(id);
            if (button) button.disabled = false;
        });
    }

    function setSpotsClickable(isClickable, stepContext = null, specificSpotId = null) {
        const spots = microarrayCardDiv.querySelectorAll('.spot');
        spots.forEach(spot => {
            const spotId = spot.id.split('-')[1];
            const state = spotsState[spotId];
            let makeClickable = false;

            if (isClickable && state) {
                let needsProcessingForStep = false;
                if (stepContext === 'eb' && !state.eb_applied) {
                    needsProcessingForStep = true;
                } else if (stepContext === 'spot-sample' && !state.sample_applied && spotId === specificSpotId) {
                    needsProcessingForStep = true; // ONLY the target spot for this sample
                } else if (stepContext === 'hb' && state.sample_applied && !state.hb_applied) {
                    needsProcessingForStep = true; // Any spot with sample, needing HB
                }

                if (needsProcessingForStep) {
                     // No further check needed here as specificSpotId is handled above
                    makeClickable = true;
                }
            }

            if (makeClickable) {
                spot.classList.add('clickable');
            } else {
                spot.classList.remove('clickable');
            }
        });
    }

     function setWellsClickable(isClickable, stepContext = null, specificWellId = null) {
         const wells = quickstripPlateDiv.querySelectorAll('.well');
         wells.forEach(well => {
             const wellId = well.id.split('-')[1];
             let makeClickable = false;
              // Only make the SPECIFIC well clickable for dispense/mix steps
              if (isClickable && specificWellId && wellId === specificWellId) {
                 if (stepContext === 'dispense-cdna' || stepContext === 'mix-well') {
                      makeClickable = true;
                 }
             }

             if (makeClickable) {
                 well.classList.add('clickable');
             } else {
                 well.classList.remove('clickable');
             }
         });
     }

    function getWellIdFromCounter(counter) {
         const rowLabels = ['E', 'F', 'G', 'H'];
         if (counter >= totalSamples) counter = totalSamples - 1; // Prevent index out of bounds
         const row = rowLabels[Math.floor(counter / 9)];
         const col = (counter % 9) + 1;
         return `${row}${col}`;
     }
    function getSpotIdFromCounter(counter) {
         return getWellIdFromCounter(counter);
     }

    // --- Start ---
    init();
});