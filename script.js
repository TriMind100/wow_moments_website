document.addEventListener("DOMContentLoaded", () => {
    // ----------------------------------------------------------------
    // 1. WebGL Background Animation
    // ----------------------------------------------------------------
    (function () {
        const canvas = document.getElementById('shader-canvas-ANIMATION_55');
        if (!canvas) return;

        // Sync the WebGL drawing-buffer size with the CSS-driven layout size.
        // This fires on initial layout and whenever the element is resized.
        function syncSize() {
            const w = canvas.clientWidth || 1280;
            const h = canvas.clientHeight || 720;
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
            }
        }
        if (typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(syncSize).observe(canvas);
        }
        syncSize();

        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return;
        const vs = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;
        const fs = `precision highp float;
varying vec2 v_texCoord;
uniform float u_time;
uniform vec2 u_resolution;

void main() {
    vec2 uv = v_texCoord;
    
    // Create soft, flowing blobs
    float noise = 0.0;
    vec2 center1 = vec2(0.5 + 0.3 * cos(u_time * 0.5), 0.5 + 0.2 * sin(u_time * 0.3));
    vec2 center2 = vec2(0.5 + 0.2 * sin(u_time * 0.4), 0.5 + 0.3 * cos(u_time * 0.6));
    
    float dist1 = length(uv - center1);
    float dist2 = length(uv - center2);
    
    float blob1 = smoothstep(0.6, 0.0, dist1);
    float blob2 = smoothstep(0.5, 0.0, dist2);
    
    // Wow Moments Palette
    vec3 color1 = vec3(1.0, 0.30, 0.55); // #FF4D8D
    vec3 color2 = vec3(1.0, 0.56, 0.67); // #FF8FAB
    vec3 color3 = vec3(1.0, 1.0, 1.0);    // White
    
    vec3 finalColor = mix(color3, color1, blob1);
    finalColor = mix(finalColor, color2, blob2);
    
    // Add a very subtle grain
    float grain = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
    finalColor += (grain - 0.5) * 0.03;
    
    gl_FragColor = vec4(finalColor, 0.15); // High transparency for background use
}`;
        function cs(type, src) {
            const s = gl.createShader(type);
            gl.shaderSource(s, src);
            gl.compileShader(s);
            return s;
        }
        const prog = gl.createProgram();
        gl.attachShader(prog, cs(gl.VERTEX_SHADER, vs));
        gl.attachShader(prog, cs(gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(prog);
        gl.useProgram(prog);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const pos = gl.getAttribLocation(prog, 'a_position');
        gl.enableVertexAttribArray(pos);
        gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
        const uTime = gl.getUniformLocation(prog, 'u_time');
        const uRes = gl.getUniformLocation(prog, 'u_resolution');
        const uMouse = gl.getUniformLocation(prog, 'u_mouse');

        // u_mouse is in pixel coordinates matching u_resolution (ShaderToy convention).
        let mouse = { x: canvas.width / 2, y: canvas.height / 2 };
        window.addEventListener('mousemove', (event) => {
            const rect = canvas.getBoundingClientRect();
            if (rect.width && rect.height) {
                const nx = (event.clientX - rect.left) / rect.width;
                const ny = 1.0 - (event.clientY - rect.top) / rect.height;
                mouse.x = nx * canvas.width;
                mouse.y = ny * canvas.height;
            }
        });

        function render(t) {
            if (typeof ResizeObserver === 'undefined') syncSize();
            gl.viewport(0, 0, canvas.width, canvas.height);
            if (uTime) gl.uniform1f(uTime, t * 0.001);
            if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
            if (uMouse) gl.uniform2f(uMouse, mouse.x, mouse.y);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            requestAnimationFrame(render);
        }
        render(0);
    })();

    // ----------------------------------------------------------------
    // 2. CMS Simulation: Load and Render Templates
    // ----------------------------------------------------------------
    const grid = document.getElementById('templates-grid');
    if (grid) {
        let templates = [];

        function generateWALink(name, price) {
            const baseUrl = "https://wa.me/918609539322";
            const message = `Hello Wow Moments 👋\nI would like to order the ${name} template.\nPrice: ${price}\n\nPlease let me know the next steps.`;
            return `${baseUrl}?text=${encodeURIComponent(message)}`;
        }

        function renderTemplates(filteredList) {
            if (!grid) return;
            grid.innerHTML = '';
            filteredList.forEach(t => {
                const card = document.createElement('div');
                card.className = "template-card glass-card review-card rounded-[2rem] overflow-hidden flex flex-col p-2 group";
                card.innerHTML = `
                    <div class="relative overflow-hidden rounded-[1.8rem]">
                        <img class="w-full h-72 object-cover group-hover:scale-110 transition-transform duration-700" src="${t.image}" alt="${t.name}">
                        ${t.tag ? `<div class="absolute top-4 left-4 ${t.tagColor} text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">${t.tag}</div>` : ''}
                    </div>
                    <div class="p-6 flex-1 flex flex-col justify-between">
                        <div>
                            <div class="flex justify-between items-start mb-2">
                                <h3 class="font-bold text-2xl brand-font leading-tight">${t.name}</h3>
                                <span class="text-primary font-bold whitespace-nowrap ml-2">${t.price}</span>
                            </div>
                            <p class="text-on-surface-variant text-sm mb-6">${t.description}</p>
                        </div>
                        ${t.preview ? `
                         <div class="flex gap-3">
                            <a href="${t.preview}" target="_blank" class="flex-1 py-3 md:py-4 rounded-2xl border-2 border-primary text-primary hover:bg-primary/5 font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 duration-200 text-xs sm:text-sm">
                                <span class="material-symbols-outlined text-base sm:text-lg">visibility</span> Preview
                            </a>
                            <a href="${generateWALink(t.name, t.price)}" class="btn-gradient flex-1 py-3 md:py-4 rounded-2xl text-white font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 duration-200 text-xs sm:text-sm">
                                <span class="material-symbols-outlined text-base sm:text-lg">chat</span> Order Now
                            </a>
                        </div>
                        ` : `
                        <a href="${generateWALink(t.name, t.price)}" class="btn-gradient w-full py-3 md:py-4 rounded-2xl text-white font-bold flex items-center justify-center gap-2 transition-all active:scale-95 duration-200 text-xs sm:text-sm">
                            <span class="material-symbols-outlined text-base sm:text-lg">chat</span> Order Now
                        </a>
                        `}
                    </div>
                `;
                grid.appendChild(card);
            });
        }

        // Fetch templates from API
        async function fetchTemplates() {
            try {
                const response = await fetch('/api/templates');
                if (!response.ok) throw new Error('Network response was not ok');
                templates = await response.json();
                renderTemplates(templates);
            } catch (err) {
                console.error('Error loading templates:', err);
                grid.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500 font-medium">Failed to load templates. Please try again later.</div>';
            }
        }

        // Load templates
        fetchTemplates();

        // Category filter click listener
        const categoryButtons = document.querySelectorAll('.category-btn');
        categoryButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.getAttribute('data-category');

                // Toggle active style classes
                categoryButtons.forEach(b => {
                    b.classList.remove('text-primary', 'bg-primary-container/20', 'border-primary/30');
                    b.classList.add('text-on-surface-variant');
                });
                btn.classList.add('text-primary', 'bg-primary-container/20', 'border-primary/30');
                btn.classList.remove('text-on-surface-variant');

                // Filter templates
                let filtered;
                if (category === 'all') {
                    filtered = templates;
                } else {
                    filtered = templates.filter(t => t.categories && t.categories.includes(category));
                }
                renderTemplates(filtered);

                // Smooth scroll to templates section
                const templatesSection = document.getElementById('templates');
                if (templatesSection) {
                    templatesSection.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });

        // View All Templates click listener
        const viewAllBtn = document.getElementById('view-all-templates');
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', (e) => {
                e.preventDefault();
                // Select "Love" button as active since it displays all templates
                categoryButtons.forEach(b => {
                    if (b.getAttribute('data-category') === 'love') {
                        b.classList.add('text-primary', 'bg-primary-container/20', 'border-primary/30');
                        b.classList.remove('text-on-surface-variant');
                    } else {
                        b.classList.remove('text-primary', 'bg-primary-container/20', 'border-primary/30');
                        b.classList.add('text-on-surface-variant');
                    }
                });
                renderTemplates(templates);
                const templatesSection = document.getElementById('templates');
                if (templatesSection) {
                    templatesSection.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }
    }

    // ----------------------------------------------------------------
    // 3. IntersectionObserver Reveal Animations
    // ----------------------------------------------------------------
    const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                // Special progress bar animation for How it Works
                if (entry.target.id === 'how-it-works') {
                    const progressBar = document.getElementById('progress-bar');
                    if (progressBar) {
                        progressBar.style.height = '100%';
                    }
                }
            }
        });
    }, observerOptions);

    document.querySelectorAll('.reveal-anim').forEach(el => observer.observe(el));

    // ----------------------------------------------------------------
    // 4. Sticky Nav Transformation
    // ----------------------------------------------------------------
    window.addEventListener('scroll', () => {
        const nav = document.getElementById('top-nav');
        if (!nav) return;
        if (window.scrollY > 50) {
            nav.classList.add('py-2', 'bg-surface/90');
            nav.classList.remove('py-4', 'bg-surface/60');
        } else {
            nav.classList.remove('py-2', 'bg-surface/90');
            nav.classList.add('py-4', 'bg-surface/60');
        }
    });

    // ----------------------------------------------------------------
    // 5. Mobile Menu Toggle Logic
    // ----------------------------------------------------------------
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenuClose = document.getElementById('mobile-menu-close');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

    function openMobileMenu() {
        if (!mobileMenu) return;
        mobileMenu.classList.remove('translate-x-full');
        mobileMenu.classList.add('translate-x-0');
        document.body.classList.add('overflow-hidden');
    }

    function closeMobileMenu() {
        if (!mobileMenu) return;
        mobileMenu.classList.remove('translate-x-0');
        mobileMenu.classList.add('translate-x-full');
        document.body.classList.remove('overflow-hidden');
    }

    if (mobileMenuBtn && mobileMenu && mobileMenuClose) {
        mobileMenuBtn.addEventListener('click', openMobileMenu);
        mobileMenuClose.addEventListener('click', closeMobileMenu);
        mobileNavLinks.forEach(link => {
            link.addEventListener('click', closeMobileMenu);
        });
    }
});
