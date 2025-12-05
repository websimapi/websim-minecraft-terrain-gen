export class InputHandler {
    constructor(controls) {
        this.controls = controls;
        this.keysPressed = {};
        this.bindEvents();
    }

    bindEvents() {
        const onKeyDown = (event) => {
            if (document.getElementById('chat-container').classList.contains('chat-open')) return;

            // Debug Hand Mode
            if (this.controls.debugHandMode && this.controls.player) {
                const hand = this.controls.player.hand;
                const tf = hand.getActiveTransform();
                const step = event.shiftKey ? 1.0 : 10.0; // Degrees

                let handled = true;
                switch(event.code) {
                    case 'ArrowUp': tf.rotX += step; break;
                    case 'ArrowDown': tf.rotX -= step; break;
                    case 'ArrowLeft': tf.rotY -= step; break;
                    case 'ArrowRight': tf.rotY += step; break;
                    case 'BracketRight': tf.rotZ -= step; break; // ]
                    case 'BracketLeft': tf.rotZ += step; break; // [
                    case 'KeyP': 
                        console.log("Current Transform:", JSON.stringify(tf, null, 2)); 
                        const msg = `Rot: ${tf.rotX.toFixed(1)}, ${tf.rotY.toFixed(1)}, ${tf.rotZ.toFixed(1)}`;
                        window.dispatchEvent(new CustomEvent('chat-msg', { detail: { user: 'Debug', msg } }));
                        break;
                    default: handled = false;
                }
                
                if (handled) return; // Consume event
            }

            if (event.shiftKey && (event.code === 'Digit3' || event.code === 'Digit5')) {
                 if (this.keysPressed['ShiftLeft'] && this.keysPressed['Digit3'] && this.keysPressed['Digit5']) {
                     window.dispatchEvent(new CustomEvent('toggle-night'));
                 }
            }

            this.keysPressed[event.code] = true;

            switch (event.code) {
                case 'ArrowUp': case 'KeyW': this.controls.moveForward = true; break;
                case 'ArrowLeft': case 'KeyA': this.controls.moveLeft = true; break;
                case 'ArrowDown': case 'KeyS': this.controls.moveBackward = true; break;
                case 'ArrowRight': case 'KeyD': this.controls.moveRight = true; break;
                case 'Space': this.controls.jump = true; break;
                case 'KeyQ': this.controls.dropItem(); break;
                case 'ShiftLeft': this.controls.sneak = true; break;
                case 'KeyR': this.controls.sprint = true; break;
                case 'Tab': 
                    event.preventDefault(); // Prevent focus switch
                    document.getElementById('player-tab-list').style.display = 'flex';
                    break;
                case 'F5': case 'KeyV':
                    event.preventDefault();
                    this.controls.cameraMode = (this.controls.cameraMode + 1) % 3;
                    break;
                case 'Digit3':
                    if (event.shiftKey) this.controls.isSpectator = true;
                    break;
                case 'Digit4':
                    if (event.shiftKey) this.controls.isSpectator = false;
                    break;
                case 'Digit7':
                    if (event.shiftKey) window.dispatchEvent(new CustomEvent('toggle-debug'));
                    break;
                case 'F4':
                    this.controls.toggleCreative();
                    break;
                case 'KeyG':
                    this.controls.toggleFly();
                    break;
                case 'KeyK':
                    this.controls.takeDamage(2);
                    break;
            }
        };

        const onKeyUp = (event) => {
            this.keysPressed[event.code] = false;

            if (event.code === 'Tab') {
                document.getElementById('player-tab-list').style.display = 'none';
            }

            if (document.getElementById('chat-container').classList.contains('chat-open')) {
                 this.controls.resetState();
                 return;
            }
            switch (event.code) {
                case 'ArrowUp': case 'KeyW': this.controls.moveForward = false; break;
                case 'ArrowLeft': case 'KeyA': this.controls.moveLeft = false; break;
                case 'ArrowDown': case 'KeyS': this.controls.moveBackward = false; break;
                case 'ArrowRight': case 'KeyD': this.controls.moveRight = false; break;
                case 'Space': this.controls.jump = false; break;
                case 'ShiftLeft': this.controls.sneak = false; break;
                case 'KeyR': this.controls.sprint = false; break;
            }
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);

        window.addEventListener('blur', () => this.controls.resetState());
    }
}
