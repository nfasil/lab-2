const keyboard = document.querySelector(".keyboard");
const wavePicker = document.querySelector("select[name='mode']");
const MAX_POLYPHONY = 5;
const NOTE_MAX_GAIN = 1 / MAX_POLYPHONY;

let audioCtx;
let globalGain;
let activeOscillators = {};


document.addEventListener("DOMContentLoaded", function(event) {

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    globalGain = audioCtx.createGain();
    globalGain.gain.setValueAtTime(0.7, audioCtx.currentTime)
    globalGain.connect(audioCtx.destination);

    const noteData = {
        // --- OCTAVE 1 ---
        '90': { freq: 261.63, label: 'C',  color: '#FF0000', octave: 1, key: 'Z', row: 1 },
        '83': { freq: 277.18, label: 'C#', color: '#FF4500', octave: 1, key: 'S', row: 2 },
        '88': { freq: 293.66, label: 'D',  color: '#FFA500', octave: 1, key: 'X', row: 1 },
        '68': { freq: 311.13, label: 'D#', color: '#FFD700', octave: 1, key: 'D', row: 2 },
        '67': { freq: 329.63, label: 'E',  color: '#FFFF00', octave: 1, key: 'C', row: 1 },
        '86': { freq: 349.23, label: 'F',  color: '#00FF00', octave: 1, key: 'V', row: 1 },
        '71': { freq: 369.99, label: 'F#', color: '#00FA9A', octave: 1, key: 'G', row: 2 },
        '66': { freq: 392.00, label: 'G',  color: '#00FFFF', octave: 1, key: 'B', row: 1 },
        '72': { freq: 415.30, label: 'G#', color: '#1E90FF', octave: 1, key: 'H', row: 2 },
        '78': { freq: 440.00, label: 'A',  color: '#0000FF', octave: 1, key: 'N', row: 1 },
        '74': { freq: 466.16, label: 'A#', color: '#8A2BE2', octave: 1, key: 'J', row: 2 },
        '77': { freq: 493.88, label: 'B',  color: '#FF00FF', octave: 1, key: 'M', row: 1 },

        // --- OCTAVE 2 ---
        '81': { freq: 523.25, label: 'C',  color: '#FF6666', octave: 2, key: 'Q', row: 3 },
        '50': { freq: 554.37, label: 'C#', color: '#FF8C66', octave: 2, key: '2', row: 4 },
        '87': { freq: 587.33, label: 'D',  color: '#FFC966', octave: 2, key: 'W', row: 3 },
        '51': { freq: 622.25, label: 'D#', color: '#FFE666', octave: 2, key: '3', row: 4 },
        '69': { freq: 659.26, label: 'E',  color: '#FFFF99', octave: 2, key: 'E', row: 3 },
        '82': { freq: 698.46, label: 'F',  color: '#99FF99', octave: 2, key: 'R', row: 3 },
        '53': { freq: 739.99, label: 'F#', color: '#99FFEB', octave: 2, key: '5', row: 4 },
        '84': { freq: 783.99, label: 'G',  color: '#99EBFF', octave: 2, key: 'T', row: 3 },
        '54': { freq: 830.61, label: 'G#', color: '#99CCFF', octave: 2, key: '6', row: 4 },
        '89': { freq: 880.00, label: 'A',  color: '#9999FF', octave: 2, key: 'Y', row: 3 },
        '55': { freq: 932.33, label: 'A#', color: '#C299FF', octave: 2, key: '7', row: 4 },
        '85': { freq: 987.77, label: 'B',  color: '#FF99FF', octave: 2, key: 'U', row: 3 }
    };

    function buildKeyboardVisualizer() {
        const topRow = document.createElement('div');
        topRow.className = 'keyboard-row octave-2';
        
        const bottomRow = document.createElement('div');
        bottomRow.className = 'keyboard-row octave-1';

        const sortedNotes = Object.entries(noteData).sort((a, b) => a[1].freq - b[1].freq);

        sortedNotes.forEach(([keyCode, info]) => {
            const keyEl = document.createElement('div');
            keyEl.className = `keyboard-key ${info.label.includes('#') ? 'black-key' : 'white-key'}`;
            keyEl.dataset.keycode = keyCode;

            keyEl.innerHTML = `<span class="note-label">${info.label}</span>
                            <span class="key-hint">(${info.key})</span>`;

            if (info.octave === 2) {
                topRow.appendChild(keyEl);
            } else {
                bottomRow.appendChild(keyEl);
            }
        });

        keyboard.appendChild(topRow);
        keyboard.appendChild(bottomRow);
    }

    buildKeyboardVisualizer();

    window.addEventListener('keydown', keyDown, false);
    window.addEventListener('keyup', keyUp, false);

    window.addEventListener('blur', () => {
        console.log("releasing all notes.");
        Object.keys(activeOscillators).forEach(key => {
            stopNote(key);
        });
    });

    activeOscillators = {}

    const adsr = {
        attack: 0.05,
        decay: 0.2,
        sustain: 0.30,
        release: 0.1
    }    

    const partials = [
        { freqMultiplier: 1, amp: 0.5 }, // fundamental
        { freqMultiplier: 2, amp: 0.3 }, // 2nd partial
        { freqMultiplier: 3, amp: 0.1 }, // 3rd partial
        { freqMultiplier: 4, amp: 0.05 }, // 4th partial
    ];


    function keyDown(event) {
        console.log("key pressed: " + event.key)
        const key = (event.detail || event.which).toString();
        const keyEl = keyboard.querySelector(`[data-keycode="${key}"]`);
        if (keyEl) keyEl.classList.add('pressed');
        if (noteData[key] && !activeOscillators[key]) {
            playNote(key);
        }
    }

    function keyUp(event) {
        const key = (event.detail || event.which).toString();
        console.log("key released: " + event.key)
        const keyEl = keyboard.querySelector(`[data-keycode="${key}"]`);
        if (keyEl) keyEl.classList.remove('pressed');
        if (activeOscillators[key]) {
            stopNote(key);
        }
    }

    function stopNote(key) {
        if (activeOscillators[key]) {
            const now = audioCtx.currentTime;
            const note = activeOscillators[key];

            const releaseTime = note.release || 0.1;
            
            note.gain.gain.cancelScheduledValues(now);
            note.gain.gain.setValueAtTime(note.gain.gain.value, now);
            note.gain.gain.exponentialRampToValueAtTime(0.001, now + releaseTime);
            
            note.oscs.forEach(osc => {
                osc.stop(now + releaseTime);
            });

            delete activeOscillators[key];

            const keyEl = keyboard.querySelector(`[data-keycode="${key}"]`);
            if (keyEl) keyEl.classList.remove('pressed');
        }
    }

    function updatePartialSliders() {
        const container = document.getElementById('partialSlidersContainer');
        const numPartials = parseInt(document.getElementById('partialCount').value);
        container.innerHTML = '';

        for (let i = 1; i <= numPartials; i++) {
            const wrapper = document.createElement('div');
            wrapper.className = 'partial-slider-wrapper';
            
            const defaultValue = (1 / i).toFixed(2);
            
            wrapper.innerHTML = `
                <span>P${i}</span>
                <input type="range" class="partial-amp" data-index="${i}" 
                    min="0" max="1" step="0.01" value="${defaultValue}">
            `;
            container.appendChild(wrapper);
        }
    }

    document.getElementById('partialCount').addEventListener('input', updatePartialSliders);
    updatePartialSliders();


    function playNote(key) {
        const data = noteData[key];
        if (!data) return;

        const uiAttack = parseFloat(document.getElementById('attack').value);
        const uiDecay = parseFloat(document.getElementById('decay').value);
        const uiSustain = parseFloat(document.getElementById('sustain').value);
        const uiRelease = parseFloat(document.getElementById('release').value);
        const numPartials = parseInt(document.getElementById('partialCount').value);

        const now = audioCtx.currentTime;
        const mode = wavePicker.value;

        /* adsr envelope for all notes */
        const noteGain = audioCtx.createGain();
        noteGain.gain.setValueAtTime(0, now);
        noteGain.gain.linearRampToValueAtTime(NOTE_MAX_GAIN, now + uiAttack);
        noteGain.gain.exponentialRampToValueAtTime(uiSustain * NOTE_MAX_GAIN + 0.001, now + uiAttack + uiDecay);
        noteGain.connect(globalGain);
        
        /* track oscillators for this note */
        const oscillators = []
        
        switch(mode) {
            case 'additive':
                const sliderInputs = document.querySelectorAll('.partial-amp');
                let amps = [];
                let totalAmplitudeSum = 0;

                sliderInputs.forEach(input => {
                    const val = parseFloat(input.value);
                    amps.push(val);
                    totalAmplitudeSum += val;
                });

                if (totalAmplitudeSum === 0) totalAmplitudeSum = 0.95;

                amps.forEach((amp, index) => {
                    const n = index + 1;
                    const osc = audioCtx.createOscillator();
                    const oscGain = audioCtx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(data.freq * n, now);
                    
                    const normalizedAmp = amp / totalAmplitudeSum;
                    oscGain.gain.setValueAtTime(normalizedAmp, now);

                    osc.connect(oscGain);
                    oscGain.connect(noteGain);
                    osc.start();
                    oscillators.push(osc);
                });
                break;
                
    
        }        
       
        activeOscillators[key] = {
            oscs: oscillators, 
            gain: noteGain,
            release: uiRelease
        }
    }

})