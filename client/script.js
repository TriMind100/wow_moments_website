document.addEventListener("DOMContentLoaded", () => {
    // ----------------------------------------------------------------
    // API Configuration (Vercel Client -> Render Server)
    // ----------------------------------------------------------------
    const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === ''
        ? 'http://localhost:3000'
        : 'https://wow-moments-website-backend.onrender.com';
    // ----------------------------------------------------------------
    // 1. WebGL Background Animation (Safely isolated for mobile)
    // ----------------------------------------------------------------
    (function () {
        try {
            const canvas = document.getElementById('shader-canvas-ANIMATION_55');
            if (!canvas) return;

            // Sync the WebGL drawing-buffer size with the CSS-driven layout size.
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
            const fs = `precision mediump float;
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
        } catch (e) {
            console.warn('WebGL shader background fallback:', e);
        }
    })();

    // ----------------------------------------------------------------
    // Safe LocalStorage Helper (Prevents mobile private mode errors)
    // ----------------------------------------------------------------
    const safeStorage = {
        getItem: (key) => {
            try { return localStorage.getItem(key); } catch (e) { return null; }
        },
        setItem: (key, val) => {
            try { localStorage.setItem(key, val); } catch (e) {}
        }
    };

    // ----------------------------------------------------------------
    // 2. CMS Simulation: Load and Render Templates
    // ----------------------------------------------------------------
    const grid = document.getElementById('templates-grid');

    // High-performance default templates baked into client for 0ms instant display on mobile/desktop
    const DEFAULT_TEMPLATES = [
        {
            id: "t1",
            name: "A Love That Defies Time!",
            price: "₹379",
            tag: "Trending",
            tagColor: "bg-amber-500",
            description: "Cinematic, interactive romantic story with dynamic particles, floating hearts, love timer, timeline, photo gallery, and a secret card reveal.",
            image: "assets/love_story_preview.png",
            preview: "https://wowmoments1.kolkode.in/",
            categories: ["love", "anniversary", "proposal"]
        },
        {
            id: "t2",
            name: "Vintage Scrapbook",
            price: "₹549",
            tag: "New",
            tagColor: "bg-secondary",
            description: "A nostalgic journey through photos with animated transitions, music, and custom messages.",
            image: "assets/love_story2_preview.png",
            preview: "https://wowmoments2.kolkode.in/",
            categories: ["love", "anniversary", "family", "friendship", "customized"]
        },
        {
            id: "t6",
            name: "Secret Passcode Birthday",
            price: "₹279",
            tag: "Interactive",
            tagColor: "bg-[#ff4d8d]",
            description: "A passcode-locked birthday surprise. Features an interactive cake with candles to blow out, a live age counter, and a beautiful handwritten letter.",
            image: "assets/love_story5_preview.png",
            preview: "https://wowmoments5.kolkode.in/",
            categories: ["love", "birthday", "customized"]
        },
        {
            id: "t7",
            name: "For Baba — Father's Day",
            price: "₹149",
            tag: "Special",
            tagColor: "bg-secondary",
            description: "A warm, nostalgic Father's Day page. Features a beautiful hand-drawn background, video memory, custom polaroid grid, and an interactive envelope letter reveal.",
            image: "assets/fathers_day_preview.png",
            preview: "https://fathersdaycard.kolkode.in/",
            categories: ["love", "family", "festival", "customized"]
        },
        {
            id: "t3",
            name: "Apology Gift",
            price: "₹149",
            tag: null,
            tagColor: "",
            description: "A touching, interactive website designed to express your heartfelt apologies and sweeten the healing.",
            image: "assets/apology_gift_preview.png",
            preview: "https://apologygift.kolkode.in/",
            categories: ["love", "friendship", "customized"]
        },
        {
            id: "t4",
            name: "A Surprise For You",
            price: "₹99",
            tag: "Cute",
            tagColor: "bg-[#ff4d8d]",
            description: "A sweet, playful interactive surprise card filled with custom animations and personalized notes.",
            image: "assets/love_story4_preview.png",
            preview: "https://wowmoments4.kolkode.in/",
            categories: ["love", "birthday", "friendship"]
        },
        {
            id: "t5",
            name: "A Love Letter",
            price: "₹99",
            tag: "Minimal",
            tagColor: "bg-secondary",
            description: "A beautifully styled, elegant digital stationery envelope and interactive love letter.",
            image: "assets/love_story3_preview.png",
            preview: "https://wowmoments3.kolkode.in/",
            categories: ["love", "proposal", "anniversary"]
        },
        {
            id: "t8",
            name: "Happy Anniversary Card",
            price: "₹129",
            tag: "New",
            tagColor: "bg-primary",
            description: "A beautiful Happy Anniversary digital card featuring a personalized photo and heartfelt message.",
            image: "assets/anniversary.png",
            preview: "https://wowmoments6.kolkode.in/",
            categories: ["love", "anniversary", "festival"]
        }
    ];

    if (grid) {
        let templates = DEFAULT_TEMPLATES;
        const TEMPLATES_CACHE_KEY = 'wow_templates_cache_v4';
        let currentCategory = 'all';

        function generateWALink(name, price) {
            const baseUrl = "https://wa.me/918609539322";
            const message = `Hello Wow Moments 👋\nI would like to order the ${name} template.\nPrice: ${price}\n\nPlease let me know the next steps.`;
            return `${baseUrl}?text=${encodeURIComponent(message)}`;
        }

        function getFallbackAsset(t) {
            const map = {
                't1': 'love_story_preview.png',
                't2': 'love_story2_preview.png',
                't3': 'apology_gift_preview.png',
                't4': 'love_story4_preview.png',
                't5': 'love_story3_preview.png',
                't6': 'love_story5_preview.png',
                't7': 'fathers_day_preview.png',
                't8': 'anniversary.png'
            };
            return map[t.id] || 'love_story_preview.png';
        }

        function renderTemplates(filteredList) {
            if (!grid) return;
            grid.innerHTML = '';
            if (!filteredList || filteredList.length === 0) {
                grid.innerHTML = '<div class="col-span-full text-center py-12 text-gray-400 font-medium">No templates found in this category.</div>';
                return;
            }
            filteredList.forEach((t, idx) => {
                const card = document.createElement('div');
                card.className = "template-card glass-card rounded-[2rem] overflow-hidden flex flex-col p-2 group";
                
                let imageUrl = t.image;
                if (imageUrl && imageUrl.startsWith('/api/templates/')) {
                    imageUrl = `${API_BASE}${imageUrl}`;
                } else if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('assets/')) {
                    imageUrl = `assets/${imageUrl}`;
                } else if (!imageUrl) {
                    imageUrl = `assets/${getFallbackAsset(t)}`;
                }
                
                let priceHtml;
                if (t.discountPercent > 0 && t.originalPrice) {
                    priceHtml = `
                        <div class="flex flex-col items-end flex-shrink-0 ml-2">
                            <div class="flex items-center gap-1.5">
                                <span class="text-xs text-gray-400 line-through">${t.originalPrice}</span>
                                <span class="text-primary font-extrabold whitespace-nowrap text-lg">${t.price}</span>
                            </div>
                            <span class="inline-block text-[8px] font-black uppercase tracking-wider text-white bg-primary px-1.5 py-0.5 rounded-full mt-0.5">${t.discountPercent}% OFF</span>
                        </div>
                    `;
                } else {
                    priceHtml = `<span class="text-primary font-bold whitespace-nowrap ml-2">${t.price}</span>`;
                }

                const fallbackSrc = `assets/${getFallbackAsset(t)}`;

                card.innerHTML = `
                    <div class="relative overflow-hidden rounded-[1.8rem] bg-gray-100">
                        <img class="w-full h-72 object-cover group-hover:scale-110 transition-transform duration-700" 
                             src="${imageUrl}" 
                             alt="${t.name}" 
                             loading="${idx < 2 ? 'eager' : 'lazy'}" 
                             decoding="async"
                             onerror="if(this.src !== '${fallbackSrc}' && !this.src.endsWith('${fallbackSrc}')){ this.src = '${fallbackSrc}'; }"
                             ${idx === 0 ? 'fetchpriority="high"' : ''}>
                        ${t.tag ? `<div class="absolute top-4 left-4 ${t.tagColor || 'bg-primary'} text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">${t.tag}</div>` : ''}
                    </div>
                    <div class="p-6 flex-1 flex flex-col justify-between">
                        <div>
                            <div class="flex justify-between items-start mb-2">
                                <h3 class="font-bold text-2xl brand-font leading-tight">${t.name}</h3>
                                ${priceHtml}
                            </div>
                            <p class="text-on-surface-variant text-sm mb-6">${t.description}</p>
                        </div>
                        ${t.preview ? `
                         <div class="flex gap-3">
                            <a href="${t.preview}" target="_blank" rel="noopener noreferrer" class="flex-1 py-3 md:py-4 rounded-2xl border-2 border-primary text-primary hover:bg-primary/5 font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 duration-200 text-xs sm:text-sm">
                                <span class="material-symbols-outlined text-base sm:text-lg">visibility</span> Preview
                            </a>
                            <a href="${generateWALink(t.name, t.price)}" target="_blank" rel="noopener noreferrer" class="btn-gradient flex-1 py-3 md:py-4 rounded-2xl text-white font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 duration-200 text-xs sm:text-sm">
                                <span class="material-symbols-outlined text-base sm:text-lg">chat</span> Order Now
                            </a>
                        </div>
                        ` : `
                        <a href="${generateWALink(t.name, t.price)}" target="_blank" rel="noopener noreferrer" class="btn-gradient w-full py-3 md:py-4 rounded-2xl text-white font-bold flex items-center justify-center gap-2 transition-all active:scale-95 duration-200 text-xs sm:text-sm">
                            <span class="material-symbols-outlined text-base sm:text-lg">chat</span> Order Now
                        </a>
                        `}
                    </div>
                `;
                grid.appendChild(card);
            });
        }

        // Instant display for 0ms mobile and desktop initial page load
        let cachedTemplatesRaw = safeStorage.getItem(TEMPLATES_CACHE_KEY);
        if (cachedTemplatesRaw) {
            try {
                const parsed = JSON.parse(cachedTemplatesRaw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    templates = parsed;
                }
            } catch (e) {}
        }
        // Render immediately on DOM load
        renderTemplates(templates);

        // Fetch fresh templates from API in background (stale-while-revalidate with retry)
        async function fetchTemplates(retryCount = 0) {
            try {
                const response = await fetch(`${API_BASE}/api/templates`);
                if (!response.ok) throw new Error('HTTP status ' + response.status);
                const freshTemplates = await response.json();
                
                if (Array.isArray(freshTemplates) && freshTemplates.length > 0) {
                    templates = freshTemplates;
                    const freshStr = JSON.stringify(freshTemplates);
                    safeStorage.setItem(TEMPLATES_CACHE_KEY, freshStr);
                    
                    if (currentCategory === 'all') {
                        renderTemplates(templates);
                    } else {
                        const filtered = templates.filter(t => t.categories && t.categories.includes(currentCategory));
                        renderTemplates(filtered.length > 0 ? filtered : templates);
                    }
                }
            } catch (err) {
                // If backend is sleeping, retry gracefully in background
                if (retryCount < 2) {
                    setTimeout(() => fetchTemplates(retryCount + 1), 3000);
                }
            }
        }

        // Trigger background revalidation
        fetchTemplates();

        // Category filter click listener
        const categoryButtons = document.querySelectorAll('.category-btn');
        categoryButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.getAttribute('data-category');
                currentCategory = category;

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
                categoryButtons.forEach(b => {
                    if (b.getAttribute('data-category') === 'all') {
                        b.classList.add('text-primary', 'bg-primary-container/20', 'border-primary/30');
                        b.classList.remove('text-on-surface-variant');
                    } else {
                        b.classList.remove('text-primary', 'bg-primary-container/20', 'border-primary/30');
                        b.classList.add('text-on-surface-variant');
                    }
                });
                currentCategory = 'all';
                renderTemplates(templates);
                const templatesSection = document.getElementById('templates');
                if (templatesSection) {
                    templatesSection.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }
    }

    // ----------------------------------------------------------------
    // 3. IntersectionObserver Reveal Animations (Mobile-Friendly)
    // ----------------------------------------------------------------
    const revealElements = document.querySelectorAll('.reveal-anim');
    const observerOptions = { threshold: 0.01, rootMargin: '50px 0px 50px 0px' };
    
    if ('IntersectionObserver' in window) {
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

        revealElements.forEach(el => observer.observe(el));
    } else {
        revealElements.forEach(el => el.classList.add('active'));
    }

    // Safety fallback: Ensure all content is revealed within 800ms on mobile devices
    setTimeout(() => {
        revealElements.forEach(el => el.classList.add('active'));
    }, 800);

    // ----------------------------------------------------------------
    // 3b. Interactive "How It Works" Workflow Experience
    // ----------------------------------------------------------------
    (function initWorkflowExperience() {
        const stepCards = document.querySelectorAll('.workflow-step-card');
        const stageScreens = document.querySelectorAll('.workflow-stage-screen');
        if (stepCards.length === 0 || stageScreens.length === 0) return;

        let currentStep = 1;
        let autoAdvanceTimer = null;
        let isUserInteracting = false;

        function setWorkflowStep(stepNum) {
            currentStep = stepNum;

            // Update step cards UI
            stepCards.forEach(card => {
                const cardStep = parseInt(card.dataset.step, 10);
                const badge = card.querySelector('.step-badge');
                const tag = card.querySelector('span[class*="rounded-full"]');
                const progressBar = card.querySelector('.step-progress-bar');
                const progressFill = card.querySelector('.step-progress-fill');
                const mobilePreview = card.querySelector('.mobile-step-preview');

                if (cardStep === stepNum) {
                    card.classList.remove('border-transparent', 'bg-white/60');
                    card.classList.add('border-primary', 'bg-white/90', 'shadow-[0_10px_30px_rgba(185,10,90,0.1)]');
                    if (badge) {
                        badge.className = "step-badge w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-[#b90a5a] to-[#ff4d8d] text-white flex items-center justify-center font-extrabold text-base flex-shrink-0 shadow-md transition-transform group-hover:scale-105";
                    }
                    if (tag) {
                        tag.className = "text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wider";
                    }
                    if (progressBar) {
                        progressBar.classList.remove('hidden');
                    }
                    if (progressFill) {
                        progressFill.style.width = '100%';
                    }
                    if (mobilePreview) {
                        mobilePreview.classList.remove('hidden');
                    }
                } else {
                    card.classList.remove('border-primary', 'bg-white/90', 'shadow-[0_10px_30px_rgba(185,10,90,0.1)]');
                    card.classList.add('border-transparent', 'bg-white/60');
                    if (badge) {
                        badge.className = "step-badge w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gray-100 text-gray-700 flex items-center justify-center font-extrabold text-base flex-shrink-0 shadow-xs transition-transform group-hover:scale-105";
                    }
                    if (tag) {
                        tag.className = "text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 uppercase tracking-wider";
                    }
                    if (progressBar) {
                        progressBar.classList.add('hidden');
                    }
                    if (progressFill) {
                        progressFill.style.width = '0%';
                    }
                    if (mobilePreview) {
                        mobilePreview.classList.add('hidden');
                    }
                }
            });

            // Transition stage screens
            stageScreens.forEach(screen => {
                const screenStage = parseInt(screen.dataset.stage, 10);
                if (screenStage === stepNum) {
                    screen.classList.remove('hidden');
                    setTimeout(() => {
                        screen.classList.remove('opacity-0', 'scale-95');
                        screen.classList.add('opacity-100', 'scale-100');
                    }, 20);
                } else {
                    screen.classList.add('opacity-0', 'scale-95');
                    screen.classList.remove('opacity-100', 'scale-100');
                    setTimeout(() => {
                        if (parseInt(screen.dataset.stage, 10) !== currentStep) {
                            screen.classList.add('hidden');
                        }
                    }, 300);
                }
            });
        }

        // Attach click listeners
        stepCards.forEach(card => {
            card.addEventListener('click', () => {
                isUserInteracting = true;
                const step = parseInt(card.dataset.step, 10);
                setWorkflowStep(step);
                restartTimer();
            });
        });

        function startAutoAdvance() {
            if (autoAdvanceTimer) clearInterval(autoAdvanceTimer);
            autoAdvanceTimer = setInterval(() => {
                if (!isUserInteracting) {
                    const next = currentStep >= 4 ? 1 : currentStep + 1;
                    setWorkflowStep(next);
                }
            }, 4500);
        }

        function restartTimer() {
            clearInterval(autoAdvanceTimer);
            setTimeout(() => {
                isUserInteracting = false;
                startAutoAdvance();
            }, 8000);
        }

        const section = document.getElementById('how-it-works');
        if (section) {
            section.addEventListener('mouseenter', () => { isUserInteracting = true; });
            section.addEventListener('mouseleave', () => { isUserInteracting = false; });
        }

        startAutoAdvance();
    })();

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

    // ----------------------------------------------------------------
    // 6. Sale Banner Popup
    // ----------------------------------------------------------------
    (async function initSaleBannerPopup() {
        const overlay    = document.getElementById('sale-popup-overlay');
        const closeBtn   = document.getElementById('sale-popup-close');
        const popupImg   = document.getElementById('sale-popup-img');
        const popupCap   = document.getElementById('sale-popup-caption');
        const popupCta   = document.getElementById('sale-popup-cta');

        if (!overlay || !closeBtn) return; // safety guard

        // Only show once per browser session
        if (sessionStorage.getItem('salePopupDismissed')) return;

        try {
            const res  = await fetch(`${API_BASE}/api/banner`);
            const data = await res.json();

            if (!data.active || !data.image) return; // no active banner

            // Populate popup content
            popupImg.src = data.image;
            popupImg.style.display = 'block';

            if (data.caption) {
                popupCap.textContent = data.caption;
                popupCap.style.display = 'block';
            } else {
                popupCap.style.display = 'none';
            }

            popupCta.textContent = data.ctaText || 'Shop Sale';
            popupCta.href        = data.ctaLink  || '#templates';

            // Show the popup with a short delay so the page can settle first
            setTimeout(() => {
                overlay.classList.add('visible');
                document.body.style.overflow = 'hidden'; // prevent scroll behind popup
            }, 700);

            // Close popup helper
            function closePopup() {
                overlay.classList.remove('visible');
                document.body.style.overflow = '';
                sessionStorage.setItem('salePopupDismissed', '1');
            }

            // Close button
            closeBtn.addEventListener('click', closePopup);

            // Click on dark backdrop (not on the card) also closes
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closePopup();
            });

            // CTA click closes popup then navigates
            popupCta.addEventListener('click', () => {
                closePopup();
            });

            // Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') closePopup();
            });

        } catch (err) {
            console.warn('Could not load sale banner:', err);
        }
    })();

    // ----------------------------------------------------------------
    // 7. Dynamic Reviews System (Carousel)
    // ----------------------------------------------------------------
    (async function initReviewsSystem() {
        const container = document.getElementById('reviews-container');
        const prevBtn = document.getElementById('reviews-prev');
        const nextBtn = document.getElementById('reviews-next');

        if (!container) return;

        // Render stars helper
        function renderStars(rating) {
            let starsHtml = '';
            for (let i = 0; i < 5; i++) {
                const filled = i < rating;
                starsHtml += `<span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' ${filled ? 1 : 0};">star</span>`;
            }
            return starsHtml;
        }

        // Render reviews list
        function renderReviewsList(reviews) {
            container.innerHTML = '';
            if (reviews.length === 0) {
                container.innerHTML = `<div class="col-span-full text-center py-8 text-gray-500 font-medium w-full">No reviews yet. Be the first to write one!</div>`;
                if (prevBtn) prevBtn.style.display = 'none';
                if (nextBtn) nextBtn.style.display = 'none';
                return;
            }

            reviews.forEach(r => {
                const card = document.createElement('div');
                card.className = "flex-none w-[82vw] max-w-[340px] sm:w-80 md:w-96 glass-card review-card p-5 sm:p-6 md:p-8 rounded-[1.8rem] sm:rounded-[2rem] flex flex-col h-auto self-start break-words";
                card.style.scrollSnapAlign = "center";

                // Avatar selection (image or initials fallback)
                let avatarHtml;
                if (r.avatar) {
                    avatarHtml = `<img class="w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover bg-gray-50 flex-shrink-0 shadow-xs ring-2 ring-white/80" src="${r.avatar}" alt="${r.name}">`;
                } else {
                    const initials = r.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                    avatarHtml = `<div class="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs sm:text-sm tracking-wider uppercase flex-shrink-0 shadow-xs ring-2 ring-white/80">${initials}</div>`;
                }

                card.innerHTML = `
                    <div class="flex items-center gap-3 mb-3 flex-shrink-0">
                        ${avatarHtml}
                        <div class="flex-1 min-w-0">
                            <p class="font-bold text-sm sm:text-base text-gray-900 leading-snug truncate">${r.name}</p>
                            ${r.location ? `<p class="text-[10px] sm:text-xs text-primary uppercase font-bold tracking-widest mt-0.5 truncate">${r.location}</p>` : ''}
                        </div>
                    </div>
                    <div class="flex gap-1 text-yellow-500 mb-3 flex-shrink-0">
                        ${renderStars(r.rating)}
                    </div>
                    <p class="italic text-on-surface-variant font-body-md text-xs sm:text-sm md:text-base leading-relaxed break-words whitespace-pre-line">"${r.comment}"</p>
                `;
                container.appendChild(card);
            });

            updateArrows();
        }

        // Render reviews skeleton loading animation (Glassmorphism & Shimmer)
        function renderReviewsSkeleton(count = 3) {
            if (!container) return;
            let skeletonHtml = '';
            for (let i = 0; i < count; i++) {
                const hiddenClass = i >= 2 ? 'hidden sm:flex' : 'flex';
                skeletonHtml += `
                    <div class="flex-none w-[82vw] max-w-[340px] sm:w-80 md:w-96 skeleton-card rounded-[1.8rem] sm:rounded-[2rem] p-5 sm:p-6 md:p-8 ${hiddenClass} flex-col gap-4 self-start">
                        <div class="flex items-center gap-3">
                            <div class="w-11 h-11 sm:w-12 sm:h-12 rounded-full skeleton-shimmer flex-shrink-0"></div>
                            <div class="flex-1 space-y-2">
                                <div class="h-4 w-28 rounded-lg skeleton-shimmer"></div>
                                <div class="h-3 w-16 rounded-md skeleton-shimmer"></div>
                            </div>
                        </div>
                        <div class="flex gap-1.5 py-0.5">
                            <div class="h-3.5 w-3.5 rounded-sm skeleton-shimmer"></div>
                            <div class="h-3.5 w-3.5 rounded-sm skeleton-shimmer"></div>
                            <div class="h-3.5 w-3.5 rounded-sm skeleton-shimmer"></div>
                            <div class="h-3.5 w-3.5 rounded-sm skeleton-shimmer"></div>
                            <div class="h-3.5 w-3.5 rounded-sm skeleton-shimmer"></div>
                        </div>
                        <div class="space-y-2 mt-1">
                            <div class="h-3.5 w-full rounded-md skeleton-shimmer"></div>
                            <div class="h-3.5 w-5/6 rounded-md skeleton-shimmer"></div>
                            <div class="h-3.5 w-3/4 rounded-md skeleton-shimmer"></div>
                        </div>
                        <div class="pt-2">
                            <div class="flex items-center gap-2 px-3 py-1 bg-white/70 backdrop-blur-md rounded-full shadow-2xs border border-white/80 buffering-pulse w-fit">
                                <span class="material-symbols-outlined text-primary text-xs animate-spin">sync</span>
                                <span class="text-[9px] font-extrabold text-primary brand-font uppercase tracking-wider">Loading reviews...</span>
                            </div>
                        </div>
                    </div>
                `;
            }
            container.innerHTML = skeletonHtml;
        }

        const REVIEWS_CACHE_KEY = 'wow_real_reviews_cache_v1';
        let cachedReviewsRaw = safeStorage.getItem(REVIEWS_CACHE_KEY);
        if (cachedReviewsRaw) {
            try {
                const parsed = JSON.parse(cachedReviewsRaw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    renderReviewsList(parsed);
                } else {
                    renderReviewsSkeleton(3);
                }
            } catch (e) {
                renderReviewsSkeleton(3);
            }
        } else {
            renderReviewsSkeleton(3);
        }

        // Fetch approved reviews (stale-while-revalidate with auto-retry)
        async function fetchReviews(retryCount = 0) {
            try {
                const res = await fetch(`${API_BASE}/api/reviews`);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const freshReviews = await res.json();
                if (Array.isArray(freshReviews)) {
                    const freshStr = JSON.stringify(freshReviews);
                    safeStorage.setItem(REVIEWS_CACHE_KEY, freshStr);
                    renderReviewsList(freshReviews);
                }
            } catch (err) {
                console.warn('Reviews loading issue:', err);
                if (retryCount < 2) {
                    setTimeout(() => fetchReviews(retryCount + 1), 2500);
                } else if (!cachedReviewsRaw) {
                    container.innerHTML = `
                        <div class="col-span-full flex flex-col items-center justify-center py-8 px-4 text-center mx-auto w-full gap-2">
                            <span class="material-symbols-outlined text-primary text-2xl">rate_review</span>
                            <p class="text-xs sm:text-sm font-semibold text-gray-600">Connecting to reviews server...</p>
                            <button id="retry-reviews-btn" class="px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-bold shadow-xs active:scale-95 transition-all mt-1">Tap to Retry</button>
                        </div>
                    `;
                    const retryBtn = document.getElementById('retry-reviews-btn');
                    if (retryBtn) {
                        retryBtn.addEventListener('click', () => {
                            renderReviewsSkeleton(3);
                            fetchReviews(0);
                        });
                    }
                }
            }
        }

        // Scroll functionality
        if (prevBtn && nextBtn) {
            const getScrollAmount = () => {
                const firstCard = container.querySelector('.review-card');
                return firstCard ? firstCard.offsetWidth + 24 : 320;
            };
            prevBtn.addEventListener('click', () => {
                container.scrollBy({ left: -getScrollAmount(), behavior: 'smooth' });
            });
            nextBtn.addEventListener('click', () => {
                container.scrollBy({ left: getScrollAmount(), behavior: 'smooth' });
            });

            container.addEventListener('scroll', updateArrows, { passive: true });
        }

        function updateArrows() {
            if (!prevBtn || !nextBtn) return;
            const scrollLeft = container.scrollLeft;
            const maxScroll = container.scrollWidth - container.clientWidth;
            
            prevBtn.disabled = scrollLeft <= 5;
            nextBtn.disabled = scrollLeft >= maxScroll - 5;
        }

        // Initial fetch
        fetchReviews();

        // ─── Active Navigation Styling & Scrollspy ────────────────────────────────
        const desktopNavLinks = document.querySelectorAll('#top-nav a[href^="#"]');
        const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
        const bottomNavLinks = document.querySelectorAll('nav.fixed.bottom-0 a[href^="#"]');

        const sections = [
            { id: 'home', element: document.querySelector('section.hero-radial-glow') },
            { id: 'templates', element: document.getElementById('templates') },
            { id: 'how-it-works', element: document.getElementById('how-it-works') },
            { id: 'reviews', element: document.getElementById('reviews') },
            { id: 'faq', element: document.getElementById('faq') }
        ];

        function setActiveLink(sectionId) {
            // Desktop Navbar Links
            desktopNavLinks.forEach(link => {
                const href = link.getAttribute('href');
                const isHome = href === '#' || href === '';
                if ((sectionId === 'home' && isHome) || href === `#${sectionId}`) {
                    link.className = "text-[#b90a5a] font-bold hover:opacity-80 transition-opacity";
                } else {
                    link.className = "text-on-surface-variant font-medium hover:text-[#b90a5a] transition-colors";
                }
            });

            // Mobile Overlay Menu Links
            mobileNavLinks.forEach(link => {
                const href = link.getAttribute('href');
                const isHome = href === '#' || href === '';
                if ((sectionId === 'home' && isHome) || href === `#${sectionId}`) {
                    link.className = "mobile-nav-link text-2xl font-bold text-[#b90a5a] hover:opacity-80 transition-all active:scale-95";
                } else {
                    link.className = "mobile-nav-link text-2xl font-bold text-[#594046] hover:text-[#b90a5a] transition-colors active:scale-95";
                }
            });

            // Bottom Nav Bar Links
            bottomNavLinks.forEach(link => {
                const href = link.getAttribute('href');
                const isHome = href === '#' || href === '';

                if ((sectionId === 'home' && isHome) || href === `#${sectionId}`) {
                    link.className = "flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-full px-4 py-1 transition-all duration-300";
                } else {
                    link.className = "flex flex-col items-center justify-center text-on-surface-variant transition-all duration-300";
                }
            });
        }

        // Setup click listeners
        desktopNavLinks.forEach(link => {
            link.addEventListener('click', () => {
                const href = link.getAttribute('href');
                const sectionId = href === '#' || href === '' ? 'home' : href.replace('#', '');
                setActiveLink(sectionId);
            });
        });

        mobileNavLinks.forEach(link => {
            link.addEventListener('click', () => {
                const href = link.getAttribute('href');
                const sectionId = href === '#' || href === '' ? 'home' : href.replace('#', '');
                setActiveLink(sectionId);
                const mobileMenu = document.getElementById('mobile-menu');
                if (mobileMenu) {
                    mobileMenu.classList.add('translate-x-full');
                }
            });
        });

        bottomNavLinks.forEach(link => {
            link.addEventListener('click', () => {
                const href = link.getAttribute('href');
                const sectionId = href === '#' || href === '' ? 'home' : href.replace('#', '');
                setActiveLink(sectionId);
            });
        });

        // Setup scrollspy listener
        window.addEventListener('scroll', () => {
            let currentSection = 'home';
            const scrollPos = window.scrollY + 120; // Offset for navbar

            sections.forEach(sec => {
                if (sec.element) {
                    const top = sec.element.getBoundingClientRect().top + window.scrollY;
                    if (scrollPos >= top - 20) {
                        currentSection = sec.id;
                    }
                }
            });

            // Handle bottom of page selection
            if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 50) {
                currentSection = 'faq';
            }

            setActiveLink(currentSection);
        });
    })();

    // ----------------------------------------------------------------
    // 8. Interactive FAQ Chatbot Assistant
    // ----------------------------------------------------------------
    (function initFAQChatbot() {
        const toggleBtn = document.getElementById('chatbot-toggle-btn');
        const closeBtn = document.getElementById('chatbot-close-btn');
        const modal = document.getElementById('chatbot-modal');
        const messagesArea = document.getElementById('chatbot-messages');
        const inputField = document.getElementById('chatbot-input');
        const sendBtn = document.getElementById('chatbot-send-btn');
        const iconOpen = document.getElementById('chatbot-icon-open');
        const iconClose = document.getElementById('chatbot-icon-close');
        const tooltip = document.getElementById('chatbot-tooltip');
        const tooltipClose = document.getElementById('chatbot-tooltip-close');
        const typingIndicator = document.getElementById('chatbot-typing');

        if (!toggleBtn || !modal || !messagesArea) return;

        const FAQ_CATEGORIES = [
            { id: "all", label: "All Questions" },
            { id: "order", label: "Order & Payment" },
            { id: "delivery", label: "Delivery" },
            { id: "custom", label: "Personalization" },
            { id: "privacy", label: "Privacy & Safety" },
            { id: "support", label: "Support" }
        ];

        const FAQ_KNOWLEDGE = [
            {
                id: "how_to_order",
                category: "order",
                icon: "shopping_bag",
                title: "How do I place an order?",
                subtitle: "Simple 3-step ordering process on WhatsApp",
                question: "How do I place an order?",
                keywords: ["order", "how to order", "buy", "purchase", "start", "process", "steps", "book"],
                answer: "✨ <strong>Ordering is easy and takes only 2 minutes:</strong><br><br>1️⃣ <strong>Pick a Template:</strong> Browse our website and choose the design you love.<br>2️⃣ <strong>Tap 'Order Now':</strong> It connects you directly with our design team on WhatsApp.<br>3️⃣ <strong>Send Details:</strong> Share your photos, favorite background song, and heartfelt message.<br><br>🎨 We will design your website and send you a private preview link to check before finalizing!"
            },
            {
                id: "pricing",
                category: "order",
                icon: "payments",
                title: "What are the prices and payment methods?",
                subtitle: "Affordable plans (₹99–₹549) with Google Pay / UPI",
                question: "What are the prices and payment options?",
                keywords: ["price", "cost", "pricing", "rate", "pay", "payment", "upi", "gpay", "phonepe", "paytm", "charges"],
                answer: "💳 <strong>Affordable & 100% Transparent:</strong><br><br>• <strong>Prices:</strong> Templates range from <strong>₹99 to ₹549</strong> based on interactive features and animations.<br>• <strong>Payment Methods:</strong> We accept <strong>Google Pay, PhonePe, Paytm, any UPI app, and Bank Transfer</strong>.<br>• <strong>No Hidden Fees:</strong> You only pay what you see!"
            },
            {
                id: "delivery_time",
                category: "delivery",
                icon: "schedule",
                title: "How long does delivery take?",
                subtitle: "Standard 24-48 hours • Express rush in 6-12 hours",
                question: "How long does delivery take?",
                keywords: ["delivery", "time", "how long", "urgent", "fast", "hours", "days", "when", "duration", "ready", "express", "rush", "today"],
                answer: "⏱️ <strong>Delivery Timelines:</strong><br><br>• <strong>Standard Delivery:</strong> Delivered within <strong>24 to 48 hours</strong> after we receive your photos and messages.<br>• <strong>Express Delivery (Rush Order):</strong> Need it today? We can deliver within <strong>6 to 12 hours</strong>! 🚀<br><br>Just mention your deadline when chatting with us on WhatsApp."
            },
            {
                id: "customization",
                category: "custom",
                icon: "palette",
                title: "Can I customize the songs, photos & letters?",
                subtitle: "100% personalized for your loved one",
                question: "Can I customize the music, photos, and messages?",
                keywords: ["custom", "customize", "music", "song", "audio", "message", "personalize", "change", "text", "photos", "letter", "video"],
                answer: "🎵 <strong>Everything is 100% Customizable:</strong><br><br>• <strong>Background Music:</strong> Choose any song (Bollywood, English, Romantic, Lo-Fi, etc.).<br>• <strong>Photos & Videos:</strong> Add your favorite memories in high quality.<br>• <strong>Secret Letters:</strong> Add surprise hidden notes or emotional messages.<br>• <strong>Dates & Timers:</strong> Add milestone countdowns, birthday counters, or anniversary dates!"
            },
            {
                id: "revisions",
                category: "support",
                icon: "edit_note",
                title: "Can I request changes or edits after it's made?",
                subtitle: "Free revisions until you are completely happy",
                question: "Can I make changes or corrections to the website?",
                keywords: ["change", "changes", "edit", "edits", "correction", "fix", "update", "photo change", "revision", "revisions"],
                answer: "✏️ <strong>Yes, Free Revisions Included:</strong><br><br>• We always send you a live preview link first.<br>• If you want to swap a photo, fix text/spelling, or change the background song, just tell us on WhatsApp.<br>• We update it immediately until you are 100% happy with your gift!"
            },
            {
                id: "sharing",
                category: "delivery",
                icon: "share",
                title: "How do I share the surprise website?",
                subtitle: "Instant WhatsApp link & printable QR code card",
                question: "How do I gift or share the website with someone?",
                keywords: ["share", "send", "gift", "link", "qr", "qr code", "how to give", "midnight", "open"],
                answer: "📱 <strong>Instant & Magical Gifting:</strong><br><br>• <strong>Private Live Link:</strong> You will get a unique link (e.g. <code>wowmoments.kolkode.in/your-name</code>) to send on WhatsApp, Instagram, or SMS at midnight 🕛!<br>• <strong>Digital QR Card:</strong> We also provide a stylish QR code image that they can scan with their phone camera to open the surprise instantly!"
            },
            {
                id: "privacy_safety",
                category: "privacy",
                icon: "lock",
                title: "Is my surprise website private and secure?",
                subtitle: "Hidden from Google with optional passcode lock",
                question: "Will my website and photos stay private?",
                keywords: ["private", "privacy", "secure", "security", "secret", "password", "safe", "link", "safety", "protect", "google", "search", "pin", "lock"],
                answer: "🔒 <strong>Your Privacy is 100% Protected:</strong><br><br>• <strong>Private Link:</strong> Your site is unlisted and hidden from Google and search engines.<br>• <strong>Only You & Your Loved One:</strong> Only people who have the exact secret link can view it.<br>• <strong>Optional Passcode Lock:</strong> We can lock the website with a secret 4-digit PIN/password so only they can unlock it!"
            },
            {
                id: "photo_confidentiality",
                category: "privacy",
                icon: "shield",
                title: "Who has access to my uploaded photos?",
                subtitle: "Strict confidentiality • Never shared publicly",
                question: "Who can see the photos and letters I share?",
                keywords: ["access", "see", "confidential", "storage", "who has access", "photos safety", "trust", "privacy policy"],
                answer: "🛡️ <strong>Strict Confidentiality:</strong><br><br>• Only the dedicated designer creating your gift has access to your files.<br>• We never share, sell, or post your personal memories on social media without your permission."
            },
            {
                id: "delete_data",
                category: "privacy",
                icon: "delete",
                title: "Can I delete my website or photos anytime?",
                subtitle: "Permanent data deletion within 24 hours",
                question: "Can I request to delete my website or data later?",
                keywords: ["delete", "remove", "erase", "take down", "storage", "cancel", "destroy", "purge", "later", "expire"],
                answer: "🗑️ <strong>You Have Full Control:</strong><br><br>• If you ever want the website taken down or photos permanently erased after delivery, just send us a quick message on WhatsApp.<br>• We permanently erase everything from our storage within 24 hours."
            },
            {
                id: "human_support",
                category: "support",
                icon: "support_agent",
                title: "Talk to our team on WhatsApp",
                subtitle: "Get instant human help for custom ideas & queries",
                question: "Can I speak to a team member directly on WhatsApp?",
                keywords: ["human", "support", "help", "chat", "whatsapp", "call", "talk", "agent", "person", "custom idea", "contact"],
                answer: "👋 <strong>Our Team is Ready to Help:</strong><br><br>• Have a special custom design idea, questions about audio/video, or need quick advice?<br>• Tap the green button below to chat directly with our friendly support team on WhatsApp!"
            }
        ];

        let isOpen = false;
        let hasInitialized = false;
        let selectedCategory = "all";

        function scrollToBottom() {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }

        function createBotBubble(htmlContent) {
            const wrap = document.createElement('div');
            wrap.className = "flex gap-2.5 items-start max-w-[94%]";
            wrap.innerHTML = `
                <div class="w-7 h-7 rounded-full bg-gradient-to-tr from-[#b90a5a] to-[#ff4d8d] text-white flex items-center justify-center flex-shrink-0 text-xs shadow-2xs mt-0.5">
                    <span class="material-symbols-outlined text-sm">smart_toy</span>
                </div>
                <div class="chat-bubble-bot px-3.5 py-3 text-xs sm:text-sm text-gray-800 leading-relaxed shadow-xs">
                    ${htmlContent}
                </div>
            `;
            return wrap;
        }

        function createUserBubble(text) {
            const wrap = document.createElement('div');
            wrap.className = "flex justify-end";
            wrap.innerHTML = `
                <div class="chat-bubble-user px-3.5 py-2.5 text-xs sm:text-sm max-w-[85%] break-words">
                    ${text}
                </div>
            `;
            return wrap;
        }

        function renderChips() {
            const container = document.createElement('div');
            container.className = "flex flex-col gap-2 pt-1 w-full";
            
            // Header with Category Filter Tabs
            const headerWrap = document.createElement('div');
            headerWrap.className = "space-y-1.5";
            
            const prompt = document.createElement('p');
            prompt.className = "text-[11px] font-bold text-gray-500 uppercase tracking-wider";
            prompt.textContent = "Select a Question to Ask:";
            headerWrap.appendChild(prompt);

            // Category Filter Pills
            const categoryBar = document.createElement('div');
            categoryBar.className = "flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar no-scrollbar";
            
            FAQ_CATEGORIES.forEach(cat => {
                const catBtn = document.createElement('button');
                const isActive = cat.id === selectedCategory;
                catBtn.className = `px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all active:scale-95 ${
                    isActive 
                        ? 'bg-[#b90a5a] text-white shadow-xs' 
                        : 'bg-white/90 text-gray-600 border border-gray-200 hover:border-pink-300 hover:text-[#b90a5a]'
                }`;
                catBtn.textContent = cat.label;
                catBtn.addEventListener('click', () => {
                    selectedCategory = cat.id;
                    refreshQuestionList(listContainer);
                    // update pills styling
                    categoryBar.querySelectorAll('button').forEach((b, idx) => {
                        const isThis = FAQ_CATEGORIES[idx].id === selectedCategory;
                        b.className = `px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all active:scale-95 ${
                            isThis 
                                ? 'bg-[#b90a5a] text-white shadow-xs' 
                                : 'bg-white/90 text-gray-600 border border-gray-200 hover:border-pink-300 hover:text-[#b90a5a]'
                        }`;
                    });
                });
                categoryBar.appendChild(catBtn);
            });
            headerWrap.appendChild(categoryBar);
            container.appendChild(headerWrap);

            // Questions List Container
            const listContainer = document.createElement('div');
            listContainer.className = "flex flex-col gap-1.5";
            refreshQuestionList(listContainer);
            container.appendChild(listContainer);

            // Direct WhatsApp Action Card
            const waCard = document.createElement('a');
            waCard.href = "https://wa.me/918609539322?text=" + encodeURIComponent("Hello Wow Moments 👋 I have a question about virtual gift websites.");
            waCard.target = "_blank";
            waCard.rel = "noopener noreferrer";
            waCard.className = "p-2.5 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/30 text-[#128C7E] hover:bg-[#25D366]/20 active:scale-98 transition-all shadow-2xs flex items-center justify-between gap-3 mt-1";
            waCard.innerHTML = `
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-xl bg-[#25D366] text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
                        <span class="material-symbols-outlined text-base">chat</span>
                    </div>
                    <p class="font-bold text-xs text-gray-900 leading-tight">Chat with Human on WhatsApp</p>
                </div>
                <span class="material-symbols-outlined text-sm text-[#128C7E]">open_in_new</span>
            `;
            container.appendChild(waCard);

            messagesArea.appendChild(container);
            scrollToBottom();
        }

        function refreshQuestionList(listContainer) {
            listContainer.innerHTML = '';
            const filteredFaqs = selectedCategory === "all" 
                ? FAQ_KNOWLEDGE 
                : FAQ_KNOWLEDGE.filter(f => f.category === selectedCategory);

            filteredFaqs.forEach(faq => {
                const card = document.createElement('button');
                card.className = "faq-chip text-left p-2.5 rounded-2xl bg-white border border-pink-100 text-gray-800 hover:border-[#b90a5a] hover:bg-[#fff0f5] active:scale-98 transition-all shadow-2xs flex items-center justify-between gap-2.5 group";
                card.innerHTML = `
                    <div class="flex items-center gap-2.5 min-w-0">
                        <div class="w-8 h-8 rounded-xl bg-pink-50 text-[#b90a5a] flex items-center justify-center flex-shrink-0 group-hover:bg-[#b90a5a] group-hover:text-white transition-colors">
                            <span class="material-symbols-outlined text-base">${faq.icon || 'help'}</span>
                        </div>
                        <p class="font-bold text-xs text-gray-900 leading-snug truncate">${faq.title}</p>
                    </div>
                    <span class="material-symbols-outlined text-sm text-gray-400 group-hover:text-[#b90a5a] transition-colors flex-shrink-0">chevron_right</span>
                `;
                card.addEventListener('click', () => {
                    handleUserQuestion(faq.question, faq);
                });
                listContainer.appendChild(card);
            });
        }

        function handleUserQuestion(questionText, matchedFaq) {
            // User message
            messagesArea.appendChild(createUserBubble(questionText));
            scrollToBottom();

            // Show typing indicator
            typingIndicator.classList.remove('hidden');
            scrollToBottom();

            setTimeout(() => {
                typingIndicator.classList.add('hidden');

                let botResponseHtml = '';
                if (matchedFaq) {
                    botResponseHtml = `
                        <div class="space-y-2">
                            <div class="flex items-center gap-1.5 font-bold text-gray-900 border-b border-gray-100 pb-1.5 text-xs sm:text-sm">
                                <span class="material-symbols-outlined text-primary text-base">${matchedFaq.icon || 'help'}</span>
                                <span>${matchedFaq.question}</span>
                            </div>
                            <div class="pt-0.5 text-xs sm:text-sm">${matchedFaq.answer}</div>
                        </div>
                    `;
                } else {
                    // Match keywords from text
                    const lower = questionText.toLowerCase();
                    const found = FAQ_KNOWLEDGE.find(f => f.keywords.some(kw => lower.includes(kw)));
                    if (found) {
                        botResponseHtml = `
                            <div class="space-y-2">
                                <div class="flex items-center gap-1.5 font-bold text-gray-900 border-b border-gray-100 pb-1.5 text-xs sm:text-sm">
                                    <span class="material-symbols-outlined text-primary text-base">${found.icon || 'help'}</span>
                                    <span>${found.question}</span>
                                </div>
                                <div class="pt-0.5 text-xs sm:text-sm">${found.answer}</div>
                            </div>
                        `;
                    } else {
                        botResponseHtml = `
                            <div>
                                <p class="mb-2 text-xs sm:text-sm">I'm not completely sure about that specific detail, but our friendly team is online right now on WhatsApp to answer you directly!</p>
                            </div>
                        `;
                    }
                }

                // Add follow-up action buttons container
                const botBubble = createBotBubble(botResponseHtml);
                
                const actionsWrap = document.createElement('div');
                actionsWrap.className = "flex flex-wrap gap-2 mt-3 pt-2.5 border-t border-gray-100";
                
                const waLink = document.createElement('a');
                waLink.href = "https://wa.me/918609539322?text=" + encodeURIComponent(`Hello Wow Moments 👋 I was asking about: "${questionText}" and would like to know more.`);
                waLink.target = "_blank";
                waLink.rel = "noopener noreferrer";
                waLink.className = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#25D366] text-white text-[11px] font-bold shadow-xs hover:bg-[#128C7E] active:scale-95 transition-all";
                waLink.innerHTML = `<span class="material-symbols-outlined text-xs">chat</span> Chat on WhatsApp`;
                actionsWrap.appendChild(waLink);

                const resetBtn = document.createElement('button');
                resetBtn.className = "inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 text-[11px] font-bold active:scale-95 transition-all";
                resetBtn.innerHTML = `<span class="material-symbols-outlined text-xs">refresh</span> Ask Another Question`;
                resetBtn.addEventListener('click', () => {
                    renderChips();
                });
                actionsWrap.appendChild(resetBtn);

                botBubble.querySelector('.chat-bubble-bot').appendChild(actionsWrap);
                messagesArea.appendChild(botBubble);
                scrollToBottom();
            }, 350);
        }

        function initWelcomeState() {
            if (hasInitialized) return;
            hasInitialized = true;
            messagesArea.innerHTML = '';
            
            const welcome1 = createBotBubble("👋 <strong>Hello! Welcome to Wow Moments.</strong><br>I'm your virtual FAQ assistant. Pick any topic below or ask any question to get quick answers:");
            messagesArea.appendChild(welcome1);
            renderChips();
        }

        function openChatbot() {
            isOpen = true;
            modal.classList.add('open');
            iconOpen.classList.add('hidden');
            iconClose.classList.remove('hidden');
            if (tooltip) tooltip.classList.add('opacity-0', 'pointer-events-none');
            initWelcomeState();
            setTimeout(() => {
                if (inputField) inputField.focus();
            }, 300);
        }

        function closeChatbot() {
            isOpen = false;
            modal.classList.remove('open');
            iconOpen.classList.remove('hidden');
            iconClose.classList.add('hidden');
        }

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isOpen) closeChatbot();
            else openChatbot();
        });

        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeChatbot();
        });

        if (tooltip) {
            tooltip.addEventListener('click', () => {
                openChatbot();
            });
        }
        if (tooltipClose) {
            tooltipClose.addEventListener('click', (e) => {
                e.stopPropagation();
                tooltip.style.display = 'none';
            });
        }

        function handleSend() {
            const query = inputField.value.trim();
            if (!query) return;
            inputField.value = '';
            handleUserQuestion(query, null);
        }

        sendBtn.addEventListener('click', handleSend);
        inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSend();
            }
        });

        // Close when clicking outside on mobile or desktop
        document.addEventListener('click', (e) => {
            if (isOpen && !modal.contains(e.target) && !toggleBtn.contains(e.target)) {
                closeChatbot();
            }
        });

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOpen) {
                closeChatbot();
            }
        });
    })();
});
