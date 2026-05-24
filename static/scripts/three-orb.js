// Three.js 3D Morphing Assistant Orb
// Designed by Antigravity for Farmify

(function () {
    const canvas = document.getElementById('three-orb-canvas');
    if (!canvas) return;

    let scene, camera, renderer, mesh;
    let initialVertices = [];
    let time = 0;
    let speed = 1.0;
    let mouse = { x: 0, y: 0 };
    let targetMouse = { x: 0, y: 0 };

    init();
    animate();

    function init() {
        scene = new THREE.Scene();

        // Camera
        const container = canvas.parentElement;
        const width = container.clientWidth || 300;
        const height = container.clientHeight || 300;

        camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        camera.position.z = 320;

        // Lights
        const ambientLight = new THREE.AmbientLight(0x0d2e1c, 0.8);
        scene.add(ambientLight);

        const dirLight1 = new THREE.DirectionalLight(0x27ae60, 1.5);
        dirLight1.position.set(100, 100, 50);
        scene.add(dirLight1);

        const dirLight2 = new THREE.DirectionalLight(0xf1c40f, 1.2);
        dirLight2.position.set(-100, -100, 50);
        scene.add(dirLight2);

        // Geometry - Sphere
        const geometry = new THREE.SphereGeometry(80, 64, 64);
        
        // Save initial vertex positions for noise deformation
        const posAttribute = geometry.attributes.position;
        for (let i = 0; i < posAttribute.count; i++) {
            initialVertices.push(new THREE.Vector3(
                posAttribute.getX(i),
                posAttribute.getY(i),
                posAttribute.getZ(i)
            ));
        }

        // Material - Premium Holographic Glass effect
        const material = new THREE.MeshPhysicalMaterial({
            color: 0x2e7d32,
            metalness: 0.1,
            roughness: 0.2,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            transmission: 0.3, // Glass translucency
            thickness: 1.5,
            flatShading: false
        });

        mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        // Renderer
        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(width, height);

        // Event Listeners
        window.addEventListener('resize', onWindowResize);
        container.addEventListener('pointermove', onPointerMove);
        container.addEventListener('pointerleave', onPointerLeave);

        // Expose a global hook so chatbot can alter speed when thinking
        window.setOrbSpeed = function(newSpeed) {
            speed = newSpeed;
            // Smoothly animate material color to indicate state
            gsap.to(material.color, {
                r: newSpeed > 1.5 ? 0.95 : 0.18, // shift color to gold/yellow when active
                g: newSpeed > 1.5 ? 0.6 : 0.49,
                b: newSpeed > 1.5 ? 0.06 : 0.2,
                duration: 0.8
            });
        };
    }

    function onPointerMove(event) {
        const rect = canvas.getBoundingClientRect();
        targetMouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        targetMouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function onPointerLeave() {
        targetMouse.x = 0;
        targetMouse.y = 0;
    }

    function onWindowResize() {
        const container = canvas.parentElement;
        const width = container.clientWidth || 300;
        const height = container.clientHeight || 300;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }

    // Simple procedural noise displacement function
    function noise(x, y, z) {
        return Math.sin(x * 0.05 + time) * Math.cos(y * 0.05 + time) * Math.sin(z * 0.05 + time);
    }

    function animate() {
        requestAnimationFrame(animate);

        // Smooth mouse tracking
        mouse.x += (targetMouse.x - mouse.x) * 0.1;
        mouse.y += (targetMouse.y - mouse.y) * 0.1;

        time += 0.015 * speed;

        // Perform mesh rotation based on mouse
        mesh.rotation.y = time * 0.1 + mouse.x * 0.5;
        mesh.rotation.x = time * 0.08 + mouse.y * 0.5;

        // Apply noise displacement to vertices
        const geometry = mesh.geometry;
        const posAttribute = geometry.attributes.position;
        const vertex = new THREE.Vector3();

        for (let i = 0; i < posAttribute.count; i++) {
            const initPos = initialVertices[i];
            vertex.copy(initPos);

            // Compute noise value based on coordinates and time
            const noiseVal = noise(
                initPos.x * 0.08,
                initPos.y * 0.08,
                initPos.z * 0.08
            );

            // Displace along surface normal (for sphere, normal is vector from center)
            const length = initPos.length();
            const displacement = 1.0 + noiseVal * 0.18 * (1.0 + Math.abs(mouse.x + mouse.y) * 0.4);
            vertex.normalize().multiplyScalar(length * displacement);

            posAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }

        posAttribute.needsUpdate = true;
        geometry.computeVertexNormals();

        renderer.render(scene, camera);
    }
})();
