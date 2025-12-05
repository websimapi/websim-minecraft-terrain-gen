import * as THREE from 'three';
import { BLOCKS } from '../constants.js';

export class StructureBlockUI {
    constructor(uiManager, world) {
        this.ui = uiManager;
        this.world = world;
        this.activeBlockPos = null;
        this.structures = {};

        this.element = null;
        this.previewMesh = null;
        this.initDOM();
        this.initPreview();
    }

    initPreview() {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const edges = new THREE.EdgesGeometry(geometry);
        this.previewMesh = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 }));
        this.previewMesh.visible = false;
        this.previewMesh.material.depthTest = false;
        this.previewMesh.renderOrder = 999;
        this.world.scene.add(this.previewMesh);
    }

    initDOM() {
        this.element = document.createElement('div');
        this.element.id = 'structure-block-menu';
        this.element.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: none; justify-content: center; align-items: center; z-index: 2500; color: #ffffff; font-family: 'Minecraft', sans-serif; text-shadow: 3px 3px 0 #000000;";

        const container = document.createElement('div');
        container.style.cssText = "width: 400px; background: #c6c6c6; border: 2px solid #000; padding: 10px; display: flex; flex-direction: column; gap: 10px; box-shadow: inset 2px 2px 0 #fff, inset -2px -2px 0 #555; color: #ffffff;";

        const title = document.createElement('div');
        title.innerText = "Structure Block";
        title.style.fontSize = "20px";
        title.style.marginBottom = "10px";
        container.appendChild(title);

        const createInputRow = (label, id, defVal) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';

            const lbl = document.createElement('label');
            lbl.innerText = label;
            lbl.htmlFor = id;

            const inp = document.createElement('input');
            inp.type = 'text';
            inp.id = id;
            inp.value = defVal;
            inp.style.width = '60px';
            inp.style.padding = '2px';
            inp.style.fontFamily = 'inherit';
            inp.addEventListener('input', () => this.updatePreview());

            row.appendChild(lbl);
            row.appendChild(inp);
            return { row, inp };
        };

        const nameRow = createInputRow('Structure Name', 'struct-name', 'my_house');
        nameRow.inp.style.width = '200px';
        container.appendChild(nameRow.row);

        const offsetDiv = document.createElement('div');
        offsetDiv.style.display = 'flex';
        offsetDiv.style.gap = '10px';
        offsetDiv.appendChild(createInputRow('Offset X', 'struct-ox', '0').row);
        offsetDiv.appendChild(createInputRow('Y', 'struct-oy', '1').row);
        offsetDiv.appendChild(createInputRow('Z', 'struct-oz', '0').row);
        container.appendChild(document.createTextNode('Relative Position'));
        container.appendChild(offsetDiv);

        const sizeDiv = document.createElement('div');
        sizeDiv.style.display = 'flex';
        sizeDiv.style.gap = '10px';
        sizeDiv.appendChild(createInputRow('Size X', 'struct-sx', '5').row);
        sizeDiv.appendChild(createInputRow('Y', 'struct-sy', '5').row);
        sizeDiv.appendChild(createInputRow('Z', 'struct-sz', '5').row);
        container.appendChild(document.createTextNode('Structure Size'));
        container.appendChild(sizeDiv);

        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.justifyContent = 'space-between';
        btnRow.style.marginTop = '10px';

        const btnSave = document.createElement('button');
        btnSave.innerText = "SAVE (Scan)";
        btnSave.className = 'btn-minecraft';
        btnSave.style.width = '120px';
        btnSave.onclick = () => this.saveStructure();

        const btnLoad = document.createElement('button');
        btnLoad.innerText = "LOAD (Place)";
        btnLoad.className = 'btn-minecraft';
        btnLoad.style.width = '120px';
        btnLoad.onclick = () => this.loadStructure();

        const btnExport = document.createElement('button');
        btnExport.innerText = "EXPORT JSON";
        btnExport.className = 'btn-minecraft';
        btnExport.style.width = '120px';
        btnExport.style.fontSize = '12px';
        btnExport.onclick = () => this.exportJSON();

        btnRow.appendChild(btnSave);
        btnRow.appendChild(btnLoad);

        container.appendChild(btnRow);
        container.appendChild(btnExport);

        const btnClose = document.createElement('button');
        btnClose.innerText = "Done";
        btnClose.className = 'btn-minecraft';
        btnClose.style.width = '100%';
        btnClose.style.marginTop = '10px';
        btnClose.onclick = () => this.ui.toggleInventory(false);
        container.appendChild(btnClose);

        this.element.appendChild(container);
        document.body.appendChild(this.element);

        this.inputs = {
            name: nameRow.inp,
            ox: document.getElementById('struct-ox'),
            oy: document.getElementById('struct-oy'),
            oz: document.getElementById('struct-oz'),
            sx: document.getElementById('struct-sx'),
            sy: document.getElementById('struct-sy'),
            sz: document.getElementById('struct-sz')
        };
    }

    show(x, y, z) {
        this.activeBlockPos = {x, y, z};
        this.element.style.display = 'flex';
        this.updatePreview();
        if (this.previewMesh) this.previewMesh.visible = true;
    }

    hide() {
        this.element.style.display = 'none';
        if (this.previewMesh) this.previewMesh.visible = false;
    }

    updatePreview() {
        if (!this.activeBlockPos || !this.previewMesh) return;
        const { offset, size } = this.getValues();
        
        const startX = this.activeBlockPos.x + offset.x;
        const startY = this.activeBlockPos.y + offset.y;
        const startZ = this.activeBlockPos.z + offset.z;
        
        this.previewMesh.position.set(
            startX + size.x / 2,
            startY + size.y / 2,
            startZ + size.z / 2
        );
        
        this.previewMesh.scale.set(size.x, size.y, size.z);
        this.previewMesh.updateMatrix();
    }

    getValues() {
        return {
            name: this.inputs.name.value,
            offset: {
                x: parseInt(this.inputs.ox.value) || 0,
                y: parseInt(this.inputs.oy.value) || 0,
                z: parseInt(this.inputs.oz.value) || 0
            },
            size: {
                x: parseInt(this.inputs.sx.value) || 1,
                y: parseInt(this.inputs.sy.value) || 1,
                z: parseInt(this.inputs.sz.value) || 1
            }
        };
    }

    saveStructure() {
        if (!this.activeBlockPos) return;
        const { name, offset, size } = this.getValues();

        const data = {
            size: size,
            palette: [],
            blocks: []
        };

        const paletteMap = new Map();
        let nextIndex = 0;

        const startX = this.activeBlockPos.x + offset.x;
        const startY = this.activeBlockPos.y + offset.y;
        const startZ = this.activeBlockPos.z + offset.z;

        for (let x = 0; x < size.x; x++) {
            for (let y = 0; y < size.y; y++) {
                for (let z = 0; z < size.z; z++) {
                    const wx = startX + x;
                    const wy = startY + y;
                    const wz = startZ + z;

                    const id = this.world.getBlock(wx, wy, wz);
                    const meta = this.world.getBlockMetadata(wx, wy, wz);

                    const key = `${id}:${meta}`;
                    let pIndex = paletteMap.get(key);
                    if (pIndex === undefined) {
                        pIndex = nextIndex++;
                        paletteMap.set(key, pIndex);
                        data.palette.push({ id, meta });
                    }

                    data.blocks.push({ pos: [x, y, z], state: pIndex });
                }
            }
        }

        this.structures[name] = data;
        alert(`Saved structure '${name}' with ${data.blocks.length} blocks to memory.`);
    }

    loadStructure() {
        if (!this.activeBlockPos) return;
        const { name, offset } = this.getValues();

        const data = this.structures[name];
        if (!data) {
            alert(`Structure '${name}' not found in memory.`);
            return;
        }

        const startX = this.activeBlockPos.x + offset.x;
        const startY = this.activeBlockPos.y + offset.y;
        const startZ = this.activeBlockPos.z + offset.z;

        let count = 0;
        for(const block of data.blocks) {
            const state = data.palette[block.state];
            const [dx, dy, dz] = block.pos;
            this.world.setBlock(startX + dx, startY + dy, startZ + dz, state.id, state.meta);
            count++;
        }
        alert(`Loaded '${name}' (${count} blocks placed).`);
    }

    exportJSON() {
        const { name } = this.getValues();
        const data = this.structures[name];
        if (!data) {
            alert("Save structure first!");
            return;
        }
        console.log(`--- STRUCTURE DATA: ${name} ---`);
        console.log(JSON.stringify(data));
        alert(`Structure data logged to Developer Console (F12). Copy it from there.`);
    }
}