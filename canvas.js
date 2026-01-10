    const MAX_VIEWPORT = 30;
    let viewport = MAX_VIEWPORT; 
    let drawGrid = true; 
    let showCircle = true; 
    let showHud = true;
    let scaleFactor = 1;

    let boltCircleMode = false;
    let circleDiameter = 0;
    let holes = 0;
    let startAngle = 0;
    let sweepAngle = 360;

    let selectedIndex = -1;

    let lastTouchX = 0;
    let lastTouchY = 0;
    let isPanning = false;
    let panX = 0;
    let panY = 0;

    let lastPinchDistance = 0;
    let lastPinchCenterX = 0;
    let lastPinchCenterY = 0;
    
    // Coordinate delle dita sullo schermo
    function getCanvasCoords(clientX, clientY) {
        const canvas = document.getElementById('circleHoleCanvas');
        const rect = canvas.getBoundingClientRect();
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }


    // Distanza tra le due dita con zoom ancorato
    function getPinchInfo(touches) {
        const p1 = getCanvasCoords(touches[0].clientX, touches[0].clientY);
        const p2 = getCanvasCoords(touches[1].clientX, touches[1].clientY);

        /* Matematicamente corretto
        return {
            dist: Math.hypot(p2.x - p1.x, p2.y - p1.y),
            cx: (p1.x + p2.x) / 2,
            cy: (p1.y + p2.y) / 2
        };
        */

        // Sbagliato!? ma funziona meglio!
        return {
            dist: Math.hypot(p2.x - p1.x, p2.y - p1.y),
            cx: (p1.x - p2.x) / 2,
            cy: (p1.y - p2.y) / 2
        };
    }


    // Mostra cerchio
    function circleView() {
        showCircle = !showCircle;
    }


    // Zoom
    function zoomOut() {
        viewport -= 5;
        if (viewport < 5) viewport = 5;
    }

    // Zoom 
    function zoomIn() {
        viewport += 5;
        if (viewport > 100) viewport = 100;
    }


    // Mostra/nascondi grid
    function grid_on() {
        drawGrid = !drawGrid;
    }


    // Pulisci inputs
    function newDataInput() {
        document.getElementById('error-box').classList.add('hidden');

        document.querySelectorAll('.numeric-input').forEach(input => {
                input.classList.remove('invalid');
                input.value = '';
        });

        boltCircleMode = false;
        selectedIndex = -1;

        circleDiameter = 0;
        holes = 0;
        startAngle = 0;
        sweepAngle = 360;
    }


    // Apri finestra dati
    function openCircleHolesWindow() {
        // Mostra overlay
        document.querySelector('.overlay').classList.add('open');
        // Mostra canvas fullscreen
        document.getElementById('canvasfullscreen').classList.remove('hidden');
        // Mostra finestra inserimento dati 
        document.querySelector('.circle-window').classList.remove('hidden');

        circleHolesWindowIsOpen = true;

        // Clean 
        newDataInput();

        // Clean
        updateTabellaFori(); 
    }


    /* Chiude tutto */
    function closeCircleHolesAll() {
        document.querySelector('.overlay').classList.remove('open');
        document.querySelector('.circle-window').classList.add('hidden');
        document.getElementById('canvasfullscreen').classList.add('hidden');

        circleHolesWindowIsOpen = false;
        boltCircleMode = false;
    }


    /* Chiude la finestra dati */
    function closeCircleHolesWindow() {
        document.querySelector('.overlay').classList.remove('open');
        document.querySelector('.circle-window').classList.add('hidden');

        // Grid in fullscreen 
        document.getElementById('canvasfullscreen').classList.remove('hidden');
    }


    /* Lista con input e messaggio di errore */
    function listInvalidInputs() {
        const invalidInputs = [];

        document.querySelectorAll('.numeric-input.invalid').forEach(inputs => {
            const label = inputs.dataset.label + " " + inputs.dataset.error;
            invalidInputs.push(label);
        });

        return invalidInputs;
    }


    /* Non usato */
    function autoFitScale() {
        const canvas = document.getElementById('circleHoleCanvas');
        const w = canvas.width;
        const h = canvas.height;

        const radius = circleDiameter / 2;

        const scaleX = (w / 2) / radius;
        const scaleY = (h / 2) / radius;

        viewport = Math.min(scaleX, scaleY) * 0.9;
    }


    function setRatio(ratio) {
        const canvas = document.getElementById('circleHoleCanvas');
        
        viewport = (canvas.height / circleDiameter) * ratio;

        // opzionale: ricentra la vista
        panX = 0;
        panY = 0;
    }

    function ratio1() { setRatio(0.5); }

    function ratio2() { setRatio(0.4); }

    function ratio3() { setRatio(1.0); }


    /* Determina il fattore di scala massimo del cerchio per non superare i limiti del canvas */
    function updateScale() {
        const canvas = document.getElementById('circleHoleCanvas');
        if (!canvas) return;

        const center = canvas.width / 2;
        const maxRadiusPx = center - 20; // con margine

        const realRadius = (circleDiameter / 2) * MAX_VIEWPORT;

        scaleFactor = Math.min(1, maxRadiusPx / realRadius);
    }


    /*  Genera fori */
    function createCircleHoles() {
        // Forza la validazione di tutti gli input
        document.querySelectorAll('.numeric-input').forEach(i => {
            i.dispatchEvent(new Event('blur'));
        });

        let box = document.getElementById('error-box');
        let invalidList = listInvalidInputs();

    
        // Lista vuota nessun errore, altrimenti inputs con valori non consentiti
        if (invalidList.length === 0) {
            box.classList.add('hidden');
        } else {
            let msg = "🚫 This operation could not be completed. Please fix the errors below:<br><br>";
            // Elenca errori inputs
            invalidList.forEach(name => {
                msg += "○ " + name + "<br>";
           });

            box.innerHTML = msg;
            box.classList.remove('hidden');

            return;
        } 


        boltCircleMode = true;
        selectedIndex = -1;

        //autoFitScale();

        updateScale();

        closeCircleHolesWindow();

        updateTabellaFori();
    }


    /* Imposta riferimento dello zero del piano assi X e Z */
    function setOriginXZ() {
        // Azzero assi
        axisX.setQuote(0);
        axisZ.setQuote(0);

        renderCircleHolesView();
    }


    /* Re-center canvas */
    function recenterCanvas() {
        panX = 0;
        panY = 0;
        renderCircleHolesView();
    }


    /* Installa eventi */
    function setupCircleArray() {
        const win = document.getElementById('circle-grid');
        const canvas = document.getElementById('circleHoleCanvas');
        

        // Click fuori nascondi messaggio di errore
        win.addEventListener('click', (e) => {
            document.getElementById('error-box').classList.add('hidden');
        });


        // Inputs dati
        document.querySelectorAll('.numeric-input').forEach(input => {
            const tip = input.parentElement.querySelector('.tool');

            function validateInput(e) {
                const ori = this.value.trim();
                const raw = ori.replace(',','.');
                const min = parseFloat(this.min);
                const max = parseFloat(this.max);

                let errorMsg = '';
                let invalid = false;

                document.getElementById('error-box').classList.add('hidden');

                if ((e.type === 'focus' || e.type === 'input') && raw === '') {
                    this.classList.remove('invalid');
                    tip.classList.remove('show');
                    return;
                }

                if (this.required && raw === '') {
                    errorMsg = 'required value';
                    invalid = true;
                    
                    if (e.type !== 'blur') {
                        this.classList.remove('show');
                    }
                }

                if (!invalid && raw !== '' && !/^-?(?:\d+\.?\d*|\.\d+)$/.test(raw)) {
                    errorMsg = 'invalid number';
                    invalid = true;
                }

                const value = invalid ? NaN : parseFloat(raw);

                if (!invalid && !isNaN(min) && value < min) {
                    errorMsg = 'value too small';
                    invalid = true;
                }

                if (!invalid && !isNaN(max) && value > max) {
                    errorMsg = 'value too large';
                    invalid = true;
                }

                if (invalid) {
                    this.classList.add('invalid');
                    this.dataset.error = errorMsg;

                    if (e.type === 'blur') {
                        tip.classList.remove('show');
                    } else {
                        tip.classList.add('show');
                    }
                } else {
                    this.classList.remove('invalid');
                    tip.classList.remove('show');
                    this.dataset.error = '';
                }

                if (!invalid) {
                    switch (this.id) {
                        case 'input-diameter': circleDiameter = value; break;
                        case 'input-holes': holes = value; break;
                        case 'input-startAngle': startAngle = value || 0; break;
                        case 'input-sweepAngle': sweepAngle = value || 360; break;
                    }
                }

            }

            
            input.addEventListener('input', validateInput);
            input.addEventListener('focus', validateInput);
            input.addEventListener('blur', validateInput);

            // Tastiera nativa il tasto Succ. poi passa a Vai (esegui)
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    createCircleHoles();
                }
            });
        });

        
        // Planning
        canvas.addEventListener('touchstart', (e) => {
            const t = e.touches[0];
            lastTouchX = t.clientX;
            lastTouchY = t.clientY;
            isPanning = true;
        });

        // Spostamento 
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault(); // Blocca scroll e refresh
            if (!isPanning) return;

            const t = e.touches[0];
            const dx = t.clientX - lastTouchX;
            const dy = t.clientY - lastTouchY;

            panX -= dx;
            panY += dy;

            lastTouchX = t.clientX;
            lastTouchY = t.clientY;

        }, { passive: false });

        canvas.addEventListener('touchend', () => {
            isPanning = false;
        });


        //renderCircleHolesView();

        fingertipZoom(canvas);
    }


    /* Zoom con due dita */
    function fingertipZoom(canvas) {
        // Zoom con dita
        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                const info = getPinchInfo(e.touches);
                lastPinchDistance = info.dist;
                lastPinchCenterX = info.cx;
                lastPinchCenterY = info.cy;
            }
        });


        canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();

                const info = getPinchInfo(e.touches);
            
                // Limiti zoom
                const oldScale = viewport;
                const newScale = oldScale * (info.dist / lastPinchDistance);
                viewport = Math.max(5, Math.min(100, newScale));
                
                // Mantieni il punto sotto le dita fermo
                const zoomRatio = viewport / oldScale;

                panX = info.cx - (info.cx - panX) * zoomRatio;
                panY = info.cy - (info.cy - panY) * zoomRatio;

                lastPinchDistance = info.dist;
                lastPinchCenterX = info.cx;
                lastPinchCenterY = info.cy;
            }
        }, { passive: false });

        // update
        renderCircleHolesView();
    }
  

    /* Mostra nascondi hud */
    function hideHud() {
        showHud = !showHud;

        if (showHud) {
            document.getElementById('table-hud').classList.remove('hidden');
        } else {
            document.getElementById('table-hud').classList.add('hidden');
        }
    }


    /* Crea tabella con coordinate dei fori */
    function updateTabellaFori() {
        const tbody = document.getElementById('tabellaForiBody');
        if (!tbody) return;

        tbody.innerHTML = ''; // Pulisci

        if (!boltCircleMode || holes === 0) return;

        for (let i = 0; i < holes; i++) {
            const angleDeg = (startAngle + (i * sweepAngle / holes)) % 360;
            const angleRad = angleDeg * Math.PI / 180;

            const targetX = (circleDiameter / 2) * Math.cos(angleRad);
            const targetZ = (circleDiameter / 2) * Math.sin(angleRad);

            const row = document.createElement('tr');
            row.style.cursor = 'pointer';
            //row.style.background = (i === selectedIndex) ? '#0f03' : 'transparent';

            if (i === selectedIndex) row.classList.add('selected');


            row.innerHTML = `
                <td style="padding: 10px; text-align: center;">${i + 1}</td>
                <td style="padding: 10px; text-align: center;">${targetX.toFixed(precision[axisX.name])}</td>
                <td style="padding: 10px; text-align: center;">${targetZ.toFixed(precision[axisX.name])}</td>
            `;


            row.addEventListener('click', () => {  
                selectedIndex = i;
                updateTabellaFori();
                renderCircleHolesView();
            });

            tbody.appendChild(row);
        }
    }



    
    /* Versione con shrink del cerchio */
    function renderCircleHolesView() {
        const canvas = document.getElementById('circleHoleCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');             
        const size = canvas.height;
        const center = canvas.width / 2;
        const crossSize = 15;

        const dynamicCrossSize = crossSize * (viewport / MAX_VIEWPORT);
        const dynamicPointRadius = 18 * (viewport / MAX_VIEWPORT);
        const dynamicFontSize = 22 * (viewport / MAX_VIEWPORT);

        // Clear canvas
        ctx.clearRect(0, 0, size, size);

        // 1, 2, 4, 8
        let gridMm = Math.pow(2, Math.floor(Math.log2(viewport / 10)));
        if (gridMm < 1) gridMm = 1;

        // Buffer extra: disegna linee oltre i bordi (per effetto "pronte dietro")
        const gridPixel = gridMm * viewport;
        const buffer = gridPixel * 2; // +2 linee 

        // Posizione zero logico (se impostato, altrimenti usa quota attuale)
        let zeroX = center - (axisX.quote * scaleFactor * viewport + panX);
        let zeroY = center + (axisZ.quote * scaleFactor * viewport + panY);

        // Griglia on/off
        ctx.lineWidth = 1;
        ctx.strokeStyle = drawGrid ? '#222' : 'rgba(0,0,0,0)';

        // Linee verticali
        let x = zeroX % gridPixel;
        if (x > 0) x -= gridPixel;
        x -= buffer;

        while (x < size + buffer) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, size);
            ctx.stroke();
            x += gridPixel;
        }
                
        // Linee orizzontali
        let y = zeroY % gridPixel;
        if (y > 0) y -= gridPixel;
        y -= buffer;

        while (y < size + buffer) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(size, y);
            ctx.stroke();
            y += gridPixel;
        }


        // Croce centrale GRANDE (zero logico)
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(zeroX, 0);
        ctx.lineTo(zeroX, size);
        ctx.moveTo(0, zeroY);
        ctx.lineTo(size, zeroY);
        ctx.stroke();


        // Cerchio e fori a 360 gradi
        if (boltCircleMode) {
            const radiusPx = (circleDiameter / 2) * viewport * scaleFactor;
                    
            // Cerchio 
            if (showCircle) {
                ctx.strokeStyle = '#0ff';
                ctx.lineWidth = 2;
                ctx.setLineDash([10, 10]);
                ctx.beginPath();
                ctx.arc(zeroX, zeroY, radiusPx, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
                
            // Posizione attuale delle assi
            const currentX = axisX.quote;
            const currentZ = axisZ.quote;
                    
            // Angolo attuale della asse rispetto allo zero (in gradi, 0 - 360)
            let currentAngle = Math.atan2(currentZ, currentX) * 180 / Math.PI;
            if (currentAngle < 0) currentAngle += 360;

            // Tolleranza (regolabile - es. 0.1mm su raggio, 3° angolare)
            const radiusTolerance = 0.01; // mmm
            const angleTolerance = 0.3;   // gradi


            // Disegna tutti i fori
            for (let i = 0; i < holes; i++) {
                const angleDeg = (startAngle + (i * sweepAngle / holes)) % 360;
                const angleRad = angleDeg * Math.PI / 180;
                        
                const targetX = (circleDiameter / 2) * Math.cos(angleRad);
                const targetZ = (circleDiameter / 2) * Math.sin(angleRad);

                const px = zeroX + (targetX * scaleFactor) * viewport;
                const py = zeroY + (targetZ * scaleFactor) * viewport;

                // Calcola distanza reale dal foro
                const xDiff = Math.abs(currentX - targetX);
                const zDiff = Math.abs(currentZ - targetZ);
                const radiusDiff = Math.sqrt(xDiff ** 2 + zDiff ** 2);
                        
                // Differenza angolare (minima tra oraria e antioraria)
                let angleDiff = Math.abs(currentAngle - angleDeg);
                angleDiff = Math.min(angleDiff, 360 - angleDiff);

                // Centro sul foro
                const highlight = (radiusDiff < radiusTolerance) && (angleDiff < angleTolerance);

                // Foro selezionato
                if (i == selectedIndex) 
                    ctx.fillStyle = 'rgba(400, 255, 0, 0.6)';    
                else if (highlight) 
                    ctx.fillStyle = 'rgba(0, 255, 0, 0.6)';
                else
                    ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
                        

                ctx.beginPath();
                ctx.arc(px, py, dynamicPointRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = highlight ? '#0f0' : '#0ff';
                ctx.lineWidth = highlight ? 3 : 2;
                ctx.stroke();


                // Indice sul foro
                ctx.fillStyle = highlight ? '#0f0' : '#fff';
                ctx.font = `bold ${dynamicFontSize}px monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(i + 1, px, py + 2);


                // Glow extra + feedback solo sul foro centrato
                if (highlight) {
                    // Quota sotto
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                            
                    ctx.fillStyle = '#fff';
                    ctx.fillText(`X: ${targetX.toFixed(precision[axisX.name])} Z: ${targetZ.toFixed(precision[axisZ.name])}`, 
                                px, 
                                py + (dynamicPointRadius * 2) + 50);

                    ctx.shadowBlur = 20;
                    ctx.shadowColor = '#0f0';
                    ctx.beginPath();
                    ctx.arc(px, py, dynamicPointRadius, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                }
            }
        }

        // Croce piccola MOBILE (posizione attuale)
        const posX = zeroX + (axisX.quote * scaleFactor) * viewport;
        const posY = zeroY + (axisZ.quote * scaleFactor) * viewport;


        const distance = Math.sqrt(axisX.quote ** 2 + axisZ.quote ** 2);
        const isCentered = distance < 0.01;


        // Disegna la croce
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4 * (viewport / MAX_VIEWPORT);
        ctx.beginPath();
        ctx.moveTo(posX - dynamicCrossSize, posY);
        ctx.lineTo(posX + dynamicCrossSize, posY);
        ctx.moveTo(posX, posY - dynamicCrossSize);
        ctx.lineTo(posX, posY + dynamicCrossSize);
        ctx.stroke();


        // Quota X Z 
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${dynamicFontSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(getX().toFixed(precision[axisX.name]), posX, posY - dynamicCrossSize - 6);


        // Glow verde se centrato
        if (isCentered) {
            ctx.shadowBlur = 35;
            ctx.shadowColor = '#0f0';
            ctx.strokeStyle = '#0f0';
            ctx.lineWidth = 6 * (viewport / MAX_VIEWPORT);
            ctx.beginPath();
            ctx.moveTo(posX - dynamicCrossSize- 5, posY);
            ctx.lineTo(posX + dynamicCrossSize + 5, posY);
            ctx.moveTo(posX, posY - dynamicCrossSize - 5);
            ctx.lineTo(posX, posY + dynamicCrossSize + 5);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }


        // Mostra etichetta per dimensione di 1 quadretto 
        if (drawGrid) {
            const value = (gridMm / scaleFactor).toFixed(2);
            const text = value + " mm";

            ctx.font = `bold 21px monospace`;

            const metrics = ctx.measureText(text);
            const textWidth = metrics.width;
            const paddingX = 20;
            const paddingY = 10;
            const w = textWidth + paddingX * 2;
            const h = 21 + paddingY * 2; // Font 24px
            const x = 57;
            const y = 57;

            ctx.fillStyle = '#fff';
            ctx.fillRect(x, y, w, h);

            ctx.fillStyle = '#444';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';

            // Posizione del riquadro
            ctx.fillText(text, x + paddingX, y + h / 2);
        }
    }
